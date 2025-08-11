const db = require('../config/database');

class Supplier {
  static tableName = 'suppliers';

  static async create(supplierData) {
    const [id] = await db(this.tableName).insert({
      ...supplierData,
      created_at: new Date(),
      updated_at: new Date()
    });
    return this.findById(id);
  }

  static async findById(id) {
    return await db(this.tableName)
      .where({ id })
      .first();
  }

  static async findByTenant(tenantId, options = {}) {
    const { 
      status, 
      category, 
      search, 
      limit = 50, 
      offset = 0,
      orderBy = 'name',
      orderDirection = 'asc'
    } = options;

    let query = db(this.tableName)
      .where({ tenant_id: tenantId })
      .limit(limit)
      .offset(offset)
      .orderBy(orderBy, orderDirection);

    if (status) {
      query = query.where('status', status);
    }

    if (category) {
      query = query.where('category', category);
    }

    if (search) {
      query = query.where(function() {
        this.where('name', 'ilike', `%${search}%`)
            .orWhere('business_name', 'ilike', `%${search}%`)
            .orWhere('contact_email', 'ilike', `%${search}%`);
      });
    }

    return await query;
  }

  static async update(id, updateData) {
    await db(this.tableName)
      .where({ id })
      .update({
        ...updateData,
        updated_at: new Date()
      });
    return this.findById(id);
  }

  static async delete(id) {
    return await db(this.tableName)
      .where({ id })
      .del();
  }

  static async updateStatus(id, status) {
    return this.update(id, { status });
  }

  static async updateRating(id, rating, reviewCount) {
    return this.update(id, { 
      rating,
      review_count: reviewCount,
      last_rating_update: new Date()
    });
  }

  static async getSupplierStats(supplierId) {
    const supplier = await this.findById(supplierId);
    if (!supplier) return null;

    // Get order statistics
    const orderStats = await db('supplier_orders')
      .where({ supplier_id: supplierId })
      .select(
        db.raw('COUNT(*) as total_orders'),
        db.raw('COUNT(CASE WHEN status = \'completed\' THEN 1 END) as completed_orders'),
        db.raw('COUNT(CASE WHEN status = \'pending\' THEN 1 END) as pending_orders'),
        db.raw('COUNT(CASE WHEN status = \'cancelled\' THEN 1 END) as cancelled_orders'),
        db.raw('SUM(CASE WHEN status = \'completed\' THEN total_amount ELSE 0 END) as total_revenue'),
        db.raw('AVG(CASE WHEN status = \'completed\' THEN total_amount ELSE NULL END) as avg_order_value')
      )
      .first();

    // Get product count
    const productCount = await db('supplier_products')
      .where({ supplier_id: supplierId, status: 'active' })
      .count('* as count')
      .first();

    // Get recent reviews
    const recentReviews = await db('supplier_reviews')
      .where({ supplier_id: supplierId })
      .orderBy('created_at', 'desc')
      .limit(5)
      .select('rating', 'comment', 'created_at', 'reviewer_name');

    return {
      supplier,
      stats: {
        ...orderStats,
        total_orders: parseInt(orderStats.total_orders),
        completed_orders: parseInt(orderStats.completed_orders),
        pending_orders: parseInt(orderStats.pending_orders),
        cancelled_orders: parseInt(orderStats.cancelled_orders),
        total_revenue: parseFloat(orderStats.total_revenue) || 0,
        avg_order_value: parseFloat(orderStats.avg_order_value) || 0,
        product_count: parseInt(productCount.count),
        completion_rate: orderStats.total_orders > 0 
          ? (orderStats.completed_orders / orderStats.total_orders) * 100 
          : 0
      },
      recent_reviews: recentReviews
    };
  }

  static async getSuppliersByCategory(tenantId) {
    return await db(this.tableName)
      .where({ tenant_id: tenantId, status: 'active' })
      .select('category')
      .count('* as count')
      .groupBy('category')
      .orderBy('count', 'desc');
  }

  static async getTopSuppliers(tenantId, limit = 10) {
    return await db(this.tableName)
      .where({ tenant_id: tenantId, status: 'active' })
      .orderBy('rating', 'desc')
      .orderBy('review_count', 'desc')
      .limit(limit);
  }

  static async searchByLocation(tenantId, latitude, longitude, radiusKm = 50) {
    // Using Haversine formula for distance calculation
    return await db(this.tableName)
      .where({ tenant_id: tenantId, status: 'active' })
      .whereNotNull('latitude')
      .whereNotNull('longitude')
      .select('*')
      .select(
        db.raw(`
          (6371 * acos(
            cos(radians(?)) * cos(radians(latitude)) * 
            cos(radians(longitude) - radians(?)) + 
            sin(radians(?)) * sin(radians(latitude))
          )) AS distance_km
        `, [latitude, longitude, latitude])
      )
      .having('distance_km', '<=', radiusKm)
      .orderBy('distance_km');
  }

  static async getSupplierProducts(supplierId, options = {}) {
    const { status = 'active', category, limit = 100, offset = 0 } = options;

    let query = db('supplier_products')
      .where({ supplier_id: supplierId })
      .limit(limit)
      .offset(offset)
      .orderBy('name');

    if (status) {
      query = query.where('status', status);
    }

    if (category) {
      query = query.where('category', category);
    }

    return await query;
  }

  static async updateInventory(supplierId, productId, quantity, price) {
    const existingProduct = await db('supplier_products')
      .where({ supplier_id: supplierId, product_id: productId })
      .first();

    if (existingProduct) {
      return await db('supplier_products')
        .where({ supplier_id: supplierId, product_id: productId })
        .update({
          available_quantity: quantity,
          unit_price: price,
          last_updated: new Date(),
          updated_at: new Date()
        });
    } else {
      return await db('supplier_products').insert({
        supplier_id: supplierId,
        product_id: productId,
        available_quantity: quantity,
        unit_price: price,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      });
    }
  }

  static async addReview(supplierId, reviewData) {
    const { rating, comment, reviewer_name, order_id } = reviewData;

    // Insert review
    await db('supplier_reviews').insert({
      supplier_id: supplierId,
      rating,
      comment,
      reviewer_name,
      order_id,
      created_at: new Date()
    });

    // Update supplier's average rating
    const ratingStats = await db('supplier_reviews')
      .where({ supplier_id: supplierId })
      .select(
        db.raw('AVG(rating) as avg_rating'),
        db.raw('COUNT(*) as review_count')
      )
      .first();

    await this.updateRating(
      supplierId, 
      parseFloat(ratingStats.avg_rating).toFixed(1),
      parseInt(ratingStats.review_count)
    );

    return ratingStats;
  }

  static async getSupplierReviews(supplierId, options = {}) {
    const { limit = 20, offset = 0, orderBy = 'created_at', orderDirection = 'desc' } = options;

    return await db('supplier_reviews')
      .where({ supplier_id: supplierId })
      .orderBy(orderBy, orderDirection)
      .limit(limit)
      .offset(offset);
  }

  static async validateSupplierData(data) {
    const errors = [];

    if (!data.name || data.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters long');
    }

    if (!data.contact_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contact_email)) {
      errors.push('Valid email address is required');
    }

    if (!data.contact_phone || data.contact_phone.trim().length < 10) {
      errors.push('Valid phone number is required');
    }

    if (!data.category || data.category.trim().length === 0) {
      errors.push('Category is required');
    }

    if (data.tax_id && data.tax_id.trim().length < 5) {
      errors.push('Tax ID must be at least 5 characters long');
    }

    return errors;
  }

  static async checkDuplicateEmail(email, tenantId, excludeId = null) {
    let query = db(this.tableName)
      .where({ contact_email: email, tenant_id: tenantId });

    if (excludeId) {
      query = query.whereNot('id', excludeId);
    }

    const existing = await query.first();
    return !!existing;
  }

  static async getSupplierPerformanceMetrics(supplierId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const metrics = await db('supplier_orders')
      .where({ supplier_id: supplierId })
      .where('created_at', '>=', startDate)
      .select(
        db.raw('COUNT(*) as total_orders'),
        db.raw('AVG(EXTRACT(EPOCH FROM (delivered_at - created_at))/3600) as avg_delivery_hours'),
        db.raw('COUNT(CASE WHEN status = \'completed\' AND delivered_at <= expected_delivery THEN 1 END) as on_time_deliveries'),
        db.raw('COUNT(CASE WHEN status = \'completed\' THEN 1 END) as completed_orders'),
        db.raw('AVG(quality_rating) as avg_quality_rating'),
        db.raw('AVG(service_rating) as avg_service_rating')
      )
      .first();

    const onTimeRate = metrics.completed_orders > 0 
      ? (metrics.on_time_deliveries / metrics.completed_orders) * 100 
      : 0;

    return {
      ...metrics,
      total_orders: parseInt(metrics.total_orders),
      avg_delivery_hours: parseFloat(metrics.avg_delivery_hours) || 0,
      on_time_deliveries: parseInt(metrics.on_time_deliveries),
      completed_orders: parseInt(metrics.completed_orders),
      on_time_rate: parseFloat(onTimeRate.toFixed(1)),
      avg_quality_rating: parseFloat(metrics.avg_quality_rating) || 0,
      avg_service_rating: parseFloat(metrics.avg_service_rating) || 0
    };
  }
}

module.exports = Supplier;