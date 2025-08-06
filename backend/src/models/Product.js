const db = require('../config/database');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

class Product {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.slug = data.slug;
    this.category = data.category;
    this.description = data.description;
    this.imageUrl = data.image_url;
    this.unit = data.unit;
    this.standardPackage = data.standard_package;
    this.estimatedPrice = data.estimated_price;
    this.isActive = data.is_active;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Crear nuevo producto
  static async create(data) {
    try {
      const [product] = await db('products')
        .insert({
          name: data.name,
          slug: data.slug,
          category: data.category,
          description: data.description,
          image_url: data.imageUrl,
          unit: data.unit,
          standard_package: data.standardPackage || 1,
          estimated_price: data.estimatedPrice || 0,
          is_active: data.isActive !== false
        })
        .returning('*');

      logger.info('Producto creado', {
        productId: product.id,
        name: product.name,
        category: product.category
      });

      return new Product(product);
    } catch (error) {
      logger.error('Error creando producto:', error);
      throw error;
    }
  }

  // Buscar producto por ID
  static async findById(id) {
    try {
      const cacheKey = `product:${id}`;
      let productData = await cache.get(cacheKey);

      if (!productData) {
        productData = await db('products')
          .where('id', id)
          .first();

        if (productData) {
          // Guardar en cache por 2 horas
          await cache.set(cacheKey, productData, 7200);
        }
      }

      return productData ? new Product(productData) : null;
    } catch (error) {
      logger.error('Error buscando producto por ID:', error);
      throw error;
    }
  }

  // Buscar producto por slug
  static async findBySlug(slug) {
    try {
      const cacheKey = `product:slug:${slug}`;
      let productData = await cache.get(cacheKey);

      if (!productData) {
        productData = await db('products')
          .where('slug', slug)
          .first();

        if (productData) {
          // Guardar en cache por 2 horas
          await cache.set(cacheKey, productData, 7200);
        }
      }

      return productData ? new Product(productData) : null;
    } catch (error) {
      logger.error('Error buscando producto por slug:', error);
      throw error;
    }
  }

  // Obtener todos los productos con filtros
  static async findAll(options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        category = null,
        isActive = true,
        search = null,
        orderBy = 'name',
        orderDirection = 'asc'
      } = options;

      const offset = (page - 1) * limit;
      let query = db('products').select('*');

      // Filtros
      if (isActive !== null) {
        query = query.where('is_active', isActive);
      }

      if (category) {
        query = query.where('category', category);
      }

      if (search) {
        query = query.where(function() {
          this.where('name', 'ilike', `%${search}%`)
              .orWhere('description', 'ilike', `%${search}%`)
              .orWhere('category', 'ilike', `%${search}%`);
        });
      }

      // Obtener total para paginación
      const totalQuery = query.clone();
      const [{ count: total }] = await totalQuery.count('* as count');

      // Obtener resultados paginados
      const products = await query
        .orderBy(orderBy, orderDirection)
        .limit(limit)
        .offset(offset);

      return {
        products: products.map(product => new Product(product)),
        pagination: {
          page,
          limit,
          total: parseInt(total),
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error obteniendo productos:', error);
      throw error;
    }
  }

  // Obtener productos por categoría
  static async findByCategory(category, activeOnly = true) {
    try {
      const cacheKey = `products:category:${category}:${activeOnly}`;
      let products = await cache.get(cacheKey);

      if (!products) {
        let query = db('products')
          .where('category', category);

        if (activeOnly) {
          query = query.where('is_active', true);
        }

        const productData = await query.orderBy('name', 'asc');
        products = productData.map(product => new Product(product));

        // Guardar en cache por 1 hora
        await cache.set(cacheKey, products, 3600);
      }

      return products;
    } catch (error) {
      logger.error('Error obteniendo productos por categoría:', error);
      throw error;
    }
  }

  // Obtener todas las categorías
  static async getCategories() {
    try {
      const cacheKey = 'product_categories';
      let categories = await cache.get(cacheKey);

      if (!categories) {
        const categoryData = await db('products')
          .where('is_active', true)
          .select('category')
          .count('* as product_count')
          .groupBy('category')
          .orderBy('category', 'asc');

        categories = categoryData.map(cat => ({
          name: cat.category,
          productCount: parseInt(cat.product_count),
          displayName: this.getCategoryDisplayName(cat.category)
        }));

        // Guardar en cache por 4 horas
        await cache.set(cacheKey, categories, 14400);
      }

      return categories;
    } catch (error) {
      logger.error('Error obteniendo categorías:', error);
      throw error;
    }
  }

  // Obtener productos más populares (basado en donaciones)
  static async getPopularProducts(limit = 10) {
    try {
      const cacheKey = `popular_products:${limit}`;
      let products = await cache.get(cacheKey);

      if (!products) {
        // Consulta compleja para obtener productos más donados
        const popularProductIds = await db('donations')
          .select(db.raw('jsonb_array_elements(items) as item'))
          .where('status', 'received')
          .then(results => {
            const productCounts = {};
            results.forEach(row => {
              const item = row.item;
              if (item && item.name) {
                const productName = item.name.toLowerCase();
                productCounts[productName] = (productCounts[productName] || 0) + (parseFloat(item.quantity) || 1);
              }
            });
            
            return Object.entries(productCounts)
              .sort(([,a], [,b]) => b - a)
              .slice(0, limit)
              .map(([name]) => name);
          });

        // Obtener productos correspondientes
        if (popularProductIds.length > 0) {
          const productData = await db('products')
            .whereIn(db.raw('LOWER(name)'), popularProductIds)
            .where('is_active', true)
            .orderBy(db.raw(`CASE ${popularProductIds.map((name, index) => 
              `WHEN LOWER(name) = '${name}' THEN ${index}`
            ).join(' ')} END`));

          products = productData.map(product => new Product(product));
        } else {
          products = [];
        }

        // Guardar en cache por 2 horas
        await cache.set(cacheKey, products, 7200);
      }

      return products;
    } catch (error) {
      logger.error('Error obteniendo productos populares:', error);
      throw error;
    }
  }

  // Buscar productos por texto
  static async search(searchTerm, options = {}) {
    try {
      const {
        limit = 20,
        category = null,
        activeOnly = true
      } = options;

      let query = db('products')
        .where(function() {
          this.where('name', 'ilike', `%${searchTerm}%`)
              .orWhere('description', 'ilike', `%${searchTerm}%`);
        });

      if (activeOnly) {
        query = query.where('is_active', true);
      }

      if (category) {
        query = query.where('category', category);
      }

      const products = await query
        .orderBy('name', 'asc')
        .limit(limit);

      return products.map(product => new Product(product));
    } catch (error) {
      logger.error('Error buscando productos:', error);
      throw error;
    }
  }

  // Actualizar producto
  async update(data) {
    try {
      const updateData = {};

      if (data.name !== undefined) updateData.name = data.name;
      if (data.slug !== undefined) updateData.slug = data.slug;
      if (data.category !== undefined) updateData.category = data.category;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.imageUrl !== undefined) updateData.image_url = data.imageUrl;
      if (data.unit !== undefined) updateData.unit = data.unit;
      if (data.standardPackage !== undefined) updateData.standard_package = data.standardPackage;
      if (data.estimatedPrice !== undefined) updateData.estimated_price = data.estimatedPrice;
      if (data.isActive !== undefined) updateData.is_active = data.isActive;

      updateData.updated_at = new Date();

      const [updatedProduct] = await db('products')
        .where('id', this.id)
        .update(updateData)
        .returning('*');

      // Actualizar propiedades del objeto actual
      Object.assign(this, new Product(updatedProduct));

      // Limpiar cache
      await this.clearCache();

      logger.info('Producto actualizado', {
        productId: this.id,
        changes: Object.keys(updateData)
      });

      return this;
    } catch (error) {
      logger.error('Error actualizando producto:', error);
      throw error;
    }
  }

  // Obtener estadísticas de uso del producto
  async getUsageStats() {
    try {
      const cacheKey = `product:${this.id}:stats`;
      let stats = await cache.get(cacheKey);

      if (!stats) {
        const [donationStats, purchaseStats] = await Promise.all([
          // Estadísticas de donaciones
          db('donations')
            .select(db.raw('jsonb_array_elements(items) as item'))
            .where('status', 'received')
            .then(results => {
              let totalDonated = 0;
              let donationCount = 0;
              
              results.forEach(row => {
                const item = row.item;
                if (item && item.name && item.name.toLowerCase() === this.name.toLowerCase()) {
                  totalDonated += parseFloat(item.quantity) || 0;
                  donationCount++;
                }
              });
              
              return { totalDonated, donationCount };
            }),

          // Estadísticas de compras
          db('purchases')
            .select(db.raw('jsonb_array_elements(items) as item'))
            .where('status', 'delivered')
            .then(results => {
              let totalPurchased = 0;
              let purchaseCount = 0;
              
              results.forEach(row => {
                const item = row.item;
                if (item && item.product_id === this.id) {
                  totalPurchased += parseFloat(item.quantity) || 0;
                  purchaseCount++;
                }
              });
              
              return { totalPurchased, purchaseCount };
            })
        ]);

        stats = {
          donations: {
            total: donationStats.totalDonated,
            count: donationStats.donationCount
          },
          purchases: {
            total: purchaseStats.totalPurchased,
            count: purchaseStats.purchaseCount
          },
          totalUsage: donationStats.totalDonated + purchaseStats.totalPurchased
        };

        // Guardar en cache por 1 hora
        await cache.set(cacheKey, stats, 3600);
      }

      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas de producto:', error);
      throw error;
    }
  }

  // Obtener nombre de categoría para mostrar
  static getCategoryDisplayName(category) {
    const categoryNames = {
      'granos': 'Granos y Cereales',
      'aceites': 'Aceites y Grasas',
      'pastas': 'Pastas',
      'enlatados': 'Enlatados y Conservas',
      'endulzantes': 'Endulzantes',
      'condimentos': 'Condimentos y Especias',
      'lacteos': 'Lácteos',
      'carnes': 'Carnes y Proteínas',
      'frutas': 'Frutas',
      'verduras': 'Verduras y Hortalizas',
      'bebidas': 'Bebidas',
      'panaderia': 'Panadería',
      'limpieza': 'Productos de Limpieza',
      'higiene': 'Productos de Higiene',
      'otros': 'Otros'
    };

    return categoryNames[category] || category.charAt(0).toUpperCase() + category.slice(1);
  }

  // Generar slug único
  static async generateUniqueSlug(name, excludeId = null) {
    try {
      let baseSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim('-');

      let slug = baseSlug;
      let counter = 1;

      while (true) {
        let query = db('products').where('slug', slug);
        
        if (excludeId) {
          query = query.where('id', '!=', excludeId);
        }

        const existing = await query.first();
        
        if (!existing) {
          break;
        }

        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      return slug;
    } catch (error) {
      logger.error('Error generando slug único:', error);
      throw error;
    }
  }

  // Limpiar cache del producto
  async clearCache() {
    try {
      const cacheKeys = [
        `product:${this.id}`,
        `product:slug:${this.slug}`,
        `product:${this.id}:stats`,
        `products:category:${this.category}:true`,
        `products:category:${this.category}:false`,
        'product_categories',
        'popular_products:10'
      ];

      await Promise.all(cacheKeys.map(key => cache.del(key)));

      logger.info('Cache de producto limpiado', { productId: this.id });
    } catch (error) {
      logger.error('Error limpiando cache de producto:', error);
    }
  }

  // Verificar si el producto está disponible
  isAvailable() {
    return this.isActive;
  }

  // Obtener precio formateado
  getFormattedPrice() {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(this.estimatedPrice);
  }

  // Serializar para respuesta JSON
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      category: this.category,
      categoryDisplayName: Product.getCategoryDisplayName(this.category),
      description: this.description,
      imageUrl: this.imageUrl,
      unit: this.unit,
      standardPackage: this.standardPackage,
      estimatedPrice: this.estimatedPrice,
      formattedPrice: this.getFormattedPrice(),
      isActive: this.isActive,
      isAvailable: this.isAvailable(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Product;