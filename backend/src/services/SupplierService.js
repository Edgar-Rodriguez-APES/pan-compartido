const Supplier = require('../models/Supplier');
const logger = require('../utils/logger');

class SupplierService {
  /**
   * Create a new supplier
   */
  async createSupplier(supplierData, tenantId) {
    try {
      // Validate supplier data
      const validationErrors = await Supplier.validateSupplierData(supplierData);
      if (validationErrors.length > 0) {
        throw new Error(`Validation errors: ${validationErrors.join(', ')}`);
      }

      // Check for duplicate email
      const isDuplicateEmail = await Supplier.checkDuplicateEmail(
        supplierData.contact_email, 
        tenantId
      );
      if (isDuplicateEmail) {
        throw new Error('A supplier with this email already exists');
      }

      // Create supplier
      const supplier = await Supplier.create({
        ...supplierData,
        tenant_id: tenantId,
        status: 'pending', // New suppliers start as pending
        rating: 0,
        review_count: 0
      });

      logger.info('Supplier created:', { supplierId: supplier.id, tenantId });
      return supplier;

    } catch (error) {
      logger.error('Error creating supplier:', error);
      throw error;
    }
  }

  /**
   * Update supplier information
   */
  async updateSupplier(supplierId, updateData, tenantId) {
    try {
      // Verify supplier belongs to tenant
      const supplier = await Supplier.findById(supplierId);
      if (!supplier || supplier.tenant_id !== tenantId) {
        throw new Error('Supplier not found or access denied');
      }

      // Validate update data
      if (updateData.contact_email || updateData.name || updateData.contact_phone) {
        const validationErrors = await Supplier.validateSupplierData({
          ...supplier,
          ...updateData
        });
        if (validationErrors.length > 0) {
          throw new Error(`Validation errors: ${validationErrors.join(', ')}`);
        }
      }

      // Check for duplicate email if email is being updated
      if (updateData.contact_email && updateData.contact_email !== supplier.contact_email) {
        const isDuplicateEmail = await Supplier.checkDuplicateEmail(
          updateData.contact_email, 
          tenantId, 
          supplierId
        );
        if (isDuplicateEmail) {
          throw new Error('A supplier with this email already exists');
        }
      }

      const updatedSupplier = await Supplier.update(supplierId, updateData);
      
      logger.info('Supplier updated:', { supplierId, tenantId });
      return updatedSupplier;

    } catch (error) {
      logger.error('Error updating supplier:', error);
      throw error;
    }
  }

  /**
   * Get supplier by ID with full details
   */
  async getSupplierDetails(supplierId, tenantId) {
    try {
      const supplier = await Supplier.findById(supplierId);
      if (!supplier || supplier.tenant_id !== tenantId) {
        throw new Error('Supplier not found or access denied');
      }

      // Get comprehensive supplier statistics
      const stats = await Supplier.getSupplierStats(supplierId);
      const performanceMetrics = await Supplier.getSupplierPerformanceMetrics(supplierId);
      const products = await Supplier.getSupplierProducts(supplierId);

      return {
        ...stats,
        performance_metrics: performanceMetrics,
        products
      };

    } catch (error) {
      logger.error('Error getting supplier details:', error);
      throw error;
    }
  }

  /**
   * Get suppliers list with filtering and pagination
   */
  async getSuppliers(tenantId, options = {}) {
    try {
      const suppliers = await Supplier.findByTenant(tenantId, options);
      
      // Get summary statistics
      const totalCount = await this.getSuppliersCount(tenantId, options);
      const categoryBreakdown = await Supplier.getSuppliersByCategory(tenantId);

      return {
        suppliers,
        pagination: {
          total: totalCount,
          limit: options.limit || 50,
          offset: options.offset || 0
        },
        summary: {
          total_suppliers: totalCount,
          categories: categoryBreakdown
        }
      };

    } catch (error) {
      logger.error('Error getting suppliers:', error);
      throw error;
    }
  }

  /**
   * Get suppliers count for pagination
   */
  async getSuppliersCount(tenantId, filters = {}) {
    try {
      const db = require('../config/database');
      let query = db('suppliers').where({ tenant_id: tenantId });

      if (filters.status) {
        query = query.where('status', filters.status);
      }

      if (filters.category) {
        query = query.where('category', filters.category);
      }

      if (filters.search) {
        query = query.where(function() {
          this.where('name', 'ilike', `%${filters.search}%`)
              .orWhere('business_name', 'ilike', `%${filters.search}%`)
              .orWhere('contact_email', 'ilike', `%${filters.search}%`);
        });
      }

      const result = await query.count('* as count').first();
      return parseInt(result.count);

    } catch (error) {
      logger.error('Error getting suppliers count:', error);
      return 0;
    }
  }

  /**
   * Approve supplier
   */
  async approveSupplier(supplierId, tenantId, approvedBy) {
    try {
      const supplier = await Supplier.findById(supplierId);
      if (!supplier || supplier.tenant_id !== tenantId) {
        throw new Error('Supplier not found or access denied');
      }

      if (supplier.status !== 'pending') {
        throw new Error('Only pending suppliers can be approved');
      }

      const updatedSupplier = await Supplier.update(supplierId, {
        status: 'active',
        approved_by: approvedBy,
        approved_at: new Date()
      });

      // Send approval notification
      await this.sendSupplierNotification(supplierId, 'approved');

      logger.info('Supplier approved:', { supplierId, tenantId, approvedBy });
      return updatedSupplier;

    } catch (error) {
      logger.error('Error approving supplier:', error);
      throw error;
    }
  }

  /**
   * Reject supplier
   */
  async rejectSupplier(supplierId, tenantId, rejectedBy, reason) {
    try {
      const supplier = await Supplier.findById(supplierId);
      if (!supplier || supplier.tenant_id !== tenantId) {
        throw new Error('Supplier not found or access denied');
      }

      const updatedSupplier = await Supplier.update(supplierId, {
        status: 'rejected',
        rejected_by: rejectedBy,
        rejected_at: new Date(),
        rejection_reason: reason
      });

      // Send rejection notification
      await this.sendSupplierNotification(supplierId, 'rejected', reason);

      logger.info('Supplier rejected:', { supplierId, tenantId, rejectedBy, reason });
      return updatedSupplier;

    } catch (error) {
      logger.error('Error rejecting supplier:', error);
      throw error;
    }
  }

  /**
   * Suspend supplier
   */
  async suspendSupplier(supplierId, tenantId, suspendedBy, reason) {
    try {
      const supplier = await Supplier.findById(supplierId);
      if (!supplier || supplier.tenant_id !== tenantId) {
        throw new Error('Supplier not found or access denied');
      }

      const updatedSupplier = await Supplier.update(supplierId, {
        status: 'suspended',
        suspended_by: suspendedBy,
        suspended_at: new Date(),
        suspension_reason: reason
      });

      // Send suspension notification
      await this.sendSupplierNotification(supplierId, 'suspended', reason);

      logger.info('Supplier suspended:', { supplierId, tenantId, suspendedBy, reason });
      return updatedSupplier;

    } catch (error) {
      logger.error('Error suspending supplier:', error);
      throw error;
    }
  }

  /**
   * Update supplier inventory
   */
  async updateInventory(supplierId, tenantId, inventoryUpdates) {
    try {
      const supplier = await Supplier.findById(supplierId);
      if (!supplier || supplier.tenant_id !== tenantId) {
        throw new Error('Supplier not found or access denied');
      }

      if (supplier.status !== 'active') {
        throw new Error('Only active suppliers can update inventory');
      }

      const results = [];
      for (const update of inventoryUpdates) {
        const { product_id, quantity, price } = update;
        
        if (!product_id || quantity < 0 || price < 0) {
          throw new Error('Invalid inventory update data');
        }

        const result = await Supplier.updateInventory(supplierId, product_id, quantity, price);
        results.push(result);
      }

      // Log inventory update
      logger.info('Inventory updated:', { 
        supplierId, 
        tenantId, 
        updatesCount: inventoryUpdates.length 
      });

      return results;

    } catch (error) {
      logger.error('Error updating inventory:', error);
      throw error;
    }
  }

  /**
   * Add supplier review
   */
  async addSupplierReview(supplierId, tenantId, reviewData) {
    try {
      const supplier = await Supplier.findById(supplierId);
      if (!supplier || supplier.tenant_id !== tenantId) {
        throw new Error('Supplier not found or access denied');
      }

      // Validate review data
      if (!reviewData.rating || reviewData.rating < 1 || reviewData.rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }

      if (!reviewData.reviewer_name || reviewData.reviewer_name.trim().length < 2) {
        throw new Error('Reviewer name is required');
      }

      const ratingStats = await Supplier.addReview(supplierId, reviewData);

      logger.info('Supplier review added:', { 
        supplierId, 
        tenantId, 
        rating: reviewData.rating 
      });

      return ratingStats;

    } catch (error) {
      logger.error('Error adding supplier review:', error);
      throw error;
    }
  }

  /**
   * Get supplier reviews
   */
  async getSupplierReviews(supplierId, tenantId, options = {}) {
    try {
      const supplier = await Supplier.findById(supplierId);
      if (!supplier || supplier.tenant_id !== tenantId) {
        throw new Error('Supplier not found or access denied');
      }

      const reviews = await Supplier.getSupplierReviews(supplierId, options);
      return reviews;

    } catch (error) {
      logger.error('Error getting supplier reviews:', error);
      throw error;
    }
  }

  /**
   * Search suppliers by location
   */
  async searchSuppliersByLocation(tenantId, latitude, longitude, radiusKm = 50) {
    try {
      if (!latitude || !longitude) {
        throw new Error('Latitude and longitude are required');
      }

      const suppliers = await Supplier.searchByLocation(tenantId, latitude, longitude, radiusKm);
      
      logger.info('Location-based supplier search:', { 
        tenantId, 
        latitude, 
        longitude, 
        radiusKm, 
        resultsCount: suppliers.length 
      });

      return suppliers;

    } catch (error) {
      logger.error('Error searching suppliers by location:', error);
      throw error;
    }
  }

  /**
   * Get top performing suppliers
   */
  async getTopSuppliers(tenantId, limit = 10) {
    try {
      const suppliers = await Supplier.getTopSuppliers(tenantId, limit);
      
      // Get performance metrics for each supplier
      const suppliersWithMetrics = await Promise.all(
        suppliers.map(async (supplier) => {
          const metrics = await Supplier.getSupplierPerformanceMetrics(supplier.id);
          return {
            ...supplier,
            performance_metrics: metrics
          };
        })
      );

      return suppliersWithMetrics;

    } catch (error) {
      logger.error('Error getting top suppliers:', error);
      throw error;
    }
  }

  /**
   * Get supplier dashboard data
   */
  async getSupplierDashboard(tenantId) {
    try {
      const db = require('../config/database');

      // Get supplier counts by status
      const statusCounts = await db('suppliers')
        .where({ tenant_id: tenantId })
        .select('status')
        .count('* as count')
        .groupBy('status');

      // Get category breakdown
      const categoryBreakdown = await Supplier.getSuppliersByCategory(tenantId);

      // Get recent suppliers
      const recentSuppliers = await db('suppliers')
        .where({ tenant_id: tenantId })
        .orderBy('created_at', 'desc')
        .limit(5);

      // Get performance summary
      const performanceSummary = await db('suppliers')
        .where({ tenant_id: tenantId, status: 'active' })
        .select(
          db.raw('AVG(rating) as avg_rating'),
          db.raw('COUNT(*) as total_active'),
          db.raw('SUM(review_count) as total_reviews')
        )
        .first();

      return {
        status_counts: statusCounts.reduce((acc, item) => {
          acc[item.status] = parseInt(item.count);
          return acc;
        }, {}),
        category_breakdown: categoryBreakdown,
        recent_suppliers: recentSuppliers,
        performance_summary: {
          avg_rating: parseFloat(performanceSummary.avg_rating) || 0,
          total_active: parseInt(performanceSummary.total_active),
          total_reviews: parseInt(performanceSummary.total_reviews)
        }
      };

    } catch (error) {
      logger.error('Error getting supplier dashboard:', error);
      throw error;
    }
  }

  /**
   * Send notification to supplier
   */
  async sendSupplierNotification(supplierId, type, message = '') {
    try {
      const supplier = await Supplier.findById(supplierId);
      if (!supplier) return;

      // This would integrate with email/SMS service
      const notifications = {
        approved: {
          subject: 'Supplier Application Approved',
          message: 'Congratulations! Your supplier application has been approved.'
        },
        rejected: {
          subject: 'Supplier Application Rejected',
          message: `Your supplier application has been rejected. Reason: ${message}`
        },
        suspended: {
          subject: 'Supplier Account Suspended',
          message: `Your supplier account has been suspended. Reason: ${message}`
        }
      };

      const notification = notifications[type];
      if (!notification) return;

      // Log notification (in real implementation, send email/SMS)
      logger.info('Supplier notification sent:', {
        supplierId,
        type,
        email: supplier.contact_email,
        subject: notification.subject
      });

      // Here you would integrate with email service like SendGrid, SES, etc.
      // await emailService.send({
      //   to: supplier.contact_email,
      //   subject: notification.subject,
      //   body: notification.message
      // });

    } catch (error) {
      logger.error('Error sending supplier notification:', error);
    }
  }

  /**
   * Generate supplier report
   */
  async generateSupplierReport(tenantId, options = {}) {
    try {
      const { period = '30d', format = 'json' } = options;
      
      const dashboard = await this.getSupplierDashboard(tenantId);
      const topSuppliers = await this.getTopSuppliers(tenantId, 10);
      
      const report = {
        generated_at: new Date().toISOString(),
        period,
        tenant_id: tenantId,
        summary: dashboard,
        top_suppliers: topSuppliers,
        recommendations: this.generateRecommendations(dashboard, topSuppliers)
      };

      logger.info('Supplier report generated:', { tenantId, period });
      return report;

    } catch (error) {
      logger.error('Error generating supplier report:', error);
      throw error;
    }
  }

  /**
   * Generate recommendations based on supplier data
   */
  generateRecommendations(dashboard, topSuppliers) {
    const recommendations = [];

    // Check if there are pending suppliers
    if (dashboard.status_counts.pending > 0) {
      recommendations.push({
        type: 'action_required',
        priority: 'high',
        message: `You have ${dashboard.status_counts.pending} pending supplier applications that need review.`
      });
    }

    // Check supplier diversity
    if (dashboard.category_breakdown.length < 3) {
      recommendations.push({
        type: 'growth_opportunity',
        priority: 'medium',
        message: 'Consider recruiting suppliers from more categories to diversify your supply chain.'
      });
    }

    // Check for low-rated suppliers
    const lowRatedSuppliers = topSuppliers.filter(s => s.rating < 3.0);
    if (lowRatedSuppliers.length > 0) {
      recommendations.push({
        type: 'quality_concern',
        priority: 'high',
        message: `${lowRatedSuppliers.length} suppliers have ratings below 3.0. Consider reviewing their performance.`
      });
    }

    return recommendations;
  }
}

module.exports = new SupplierService();