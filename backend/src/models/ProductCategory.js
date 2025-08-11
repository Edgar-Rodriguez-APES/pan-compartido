const db = require('../config/database');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

class ProductCategory {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.slug = data.slug;
    this.description = data.description;
    this.icon = data.icon;
    this.color = data.color;
    this.sortOrder = data.sort_order;
    this.isActive = data.is_active;
    this.metadata = data.metadata || {};
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Crear nueva categoría
  static async create(data) {
    try {
      const [category] = await db('product_categories')
        .insert({
          name: data.name,
          slug: data.slug,
          description: data.description,
          icon: data.icon,
          color: data.color || '#6b7280',
          sort_order: data.sortOrder || 0,
          is_active: data.isActive !== undefined ? data.isActive : true,
          metadata: data.metadata || {}
        })
        .returning('*');

      logger.info('Categoría de producto creada', {
        categoryId: category.id,
        name: category.name,
        slug: category.slug
      });

      // Limpiar cache
      await this.clearCache();

      return new ProductCategory(category);
    } catch (error) {
      logger.error('Error creando categoría de producto:', error);
      throw error;
    }
  }

  // Buscar categoría por ID
  static async findById(id) {
    try {
      const cacheKey = `product_category:${id}`;
      let categoryData = await cache.get(cacheKey);

      if (!categoryData) {
        categoryData = await db('product_categories')
          .where('id', id)
          .first();

        if (categoryData) {
          // Guardar en cache por 1 hora
          await cache.set(cacheKey, categoryData, 3600);
        }
      }

      return categoryData ? new ProductCategory(categoryData) : null;
    } catch (error) {
      logger.error('Error buscando categoría por ID:', error);
      throw error;
    }
  }

  // Buscar categoría por slug
  static async findBySlug(slug) {
    try {
      const cacheKey = `product_category:slug:${slug}`;
      let categoryData = await cache.get(cacheKey);

      if (!categoryData) {
        categoryData = await db('product_categories')
          .where('slug', slug)
          .first();

        if (categoryData) {
          // Guardar en cache por 1 hora
          await cache.set(cacheKey, categoryData, 3600);
        }
      }

      return categoryData ? new ProductCategory(categoryData) : null;
    } catch (error) {
      logger.error('Error buscando categoría por slug:', error);
      throw error;
    }
  }

  // Obtener todas las categorías activas
  static async getActive(options = {}) {
    try {
      const {
        includeProductCount = false,
        orderBy = 'sort_order',
        orderDirection = 'asc'
      } = options;

      const cacheKey = `product_categories:active:${includeProductCount}:${orderBy}:${orderDirection}`;
      let categories = await cache.get(cacheKey);

      if (!categories) {
        let query = db('product_categories')
          .where('is_active', true)
          .orderBy(orderBy, orderDirection);

        if (includeProductCount) {
          query = query
            .leftJoin('products', 'product_categories.id', 'products.category_id')
            .select('product_categories.*')
            .count('products.id as product_count')
            .groupBy('product_categories.id');
        } else {
          query = query.select('product_categories.*');
        }

        const categoryData = await query;
        categories = categoryData.map(category => {
          const categoryObj = new ProductCategory(category);
          if (includeProductCount) {
            categoryObj.productCount = parseInt(category.product_count) || 0;
          }
          return categoryObj;
        });

        // Guardar en cache por 30 minutos
        await cache.set(cacheKey, categories, 1800);
      }

      return categories;
    } catch (error) {
      logger.error('Error obteniendo categorías activas:', error);
      throw error;
    }
  }

  // Obtener todas las categorías con paginación
  static async findAll(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        isActive = null,
        search = null,
        orderBy = 'sort_order',
        orderDirection = 'asc'
      } = options;

      const offset = (page - 1) * limit;
      let query = db('product_categories').select('*');

      // Filtros
      if (isActive !== null) {
        query = query.where('is_active', isActive);
      }

      if (search) {
        query = query.where(function() {
          this.where('name', 'ilike', `%${search}%`)
              .orWhere('description', 'ilike', `%${search}%`);
        });
      }

      // Obtener total para paginación
      const totalQuery = query.clone();
      const [{ count: total }] = await totalQuery.count('* as count');

      // Obtener resultados paginados
      const categories = await query
        .orderBy(orderBy, orderDirection)
        .limit(limit)
        .offset(offset);

      return {
        categories: categories.map(category => new ProductCategory(category)),
        pagination: {
          page,
          limit,
          total: parseInt(total),
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error obteniendo categorías:', error);
      throw error;
    }
  }

  // Actualizar categoría
  async update(data) {
    try {
      const updateData = {};

      if (data.name !== undefined) updateData.name = data.name;
      if (data.slug !== undefined) updateData.slug = data.slug;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.icon !== undefined) updateData.icon = data.icon;
      if (data.color !== undefined) updateData.color = data.color;
      if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder;
      if (data.isActive !== undefined) updateData.is_active = data.isActive;
      if (data.metadata !== undefined) updateData.metadata = data.metadata;

      updateData.updated_at = new Date();

      const [updatedCategory] = await db('product_categories')
        .where('id', this.id)
        .update(updateData)
        .returning('*');

      // Actualizar propiedades del objeto actual
      Object.assign(this, new ProductCategory(updatedCategory));

      // Limpiar cache
      await ProductCategory.clearCache();

      logger.info('Categoría de producto actualizada', {
        categoryId: this.id,
        changes: Object.keys(updateData)
      });

      return this;
    } catch (error) {
      logger.error('Error actualizando categoría de producto:', error);
      throw error;
    }
  }

  // Eliminar categoría (soft delete)
  async delete() {
    try {
      // Verificar si hay productos asociados
      const productCount = await db('products')
        .where('category_id', this.id)
        .count('* as count')
        .first();

      if (parseInt(productCount.count) > 0) {
        throw new Error('CATEGORY_HAS_PRODUCTS');
      }

      await db('product_categories')
        .where('id', this.id)
        .update({
          is_active: false,
          updated_at: new Date()
        });

      this.isActive = false;

      // Limpiar cache
      await ProductCategory.clearCache();

      logger.info('Categoría de producto desactivada', { categoryId: this.id });

      return this;
    } catch (error) {
      logger.error('Error desactivando categoría de producto:', error);
      throw error;
    }
  }

  // Obtener productos de esta categoría
  async getProducts(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        isActive = true,
        orderBy = 'sort_order',
        orderDirection = 'asc'
      } = options;

      const offset = (page - 1) * limit;
      let query = db('products')
        .where('category_id', this.id);

      if (isActive !== null) {
        query = query.where('is_active', isActive);
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
        products,
        pagination: {
          page,
          limit,
          total: parseInt(total),
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error obteniendo productos de categoría:', error);
      throw error;
    }
  }

  // Reordenar categorías
  static async reorder(categoryOrders) {
    try {
      const transaction = await db.transaction();

      try {
        for (const { id, sortOrder } of categoryOrders) {
          await transaction('product_categories')
            .where('id', id)
            .update({ 
              sort_order: sortOrder,
              updated_at: new Date()
            });
        }

        await transaction.commit();

        // Limpiar cache
        await this.clearCache();

        logger.info('Categorías reordenadas', {
          categoriesCount: categoryOrders.length
        });

        return true;
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      logger.error('Error reordenando categorías:', error);
      throw error;
    }
  }

  // Limpiar cache de categorías
  static async clearCache() {
    try {
      const keys = await cache.keys('product_category*');
      if (keys.length > 0) {
        await Promise.all(keys.map(key => cache.del(key)));
      }

      logger.info('Cache de categorías limpiado');
    } catch (error) {
      logger.error('Error limpiando cache de categorías:', error);
    }
  }

  // Obtener estadísticas de la categoría
  async getStats() {
    try {
      const cacheKey = `product_category:${this.id}:stats`;
      let stats = await cache.get(cacheKey);

      if (!stats) {
        const [
          productCount,
          activeProductCount,
          avgPrice
        ] = await Promise.all([
          db('products').where('category_id', this.id).count('* as count').first(),
          db('products').where('category_id', this.id).where('is_active', true).count('* as count').first(),
          db('products').where('category_id', this.id).where('is_active', true).avg('estimated_price as avg').first()
        ]);

        stats = {
          totalProducts: parseInt(productCount.count) || 0,
          activeProducts: parseInt(activeProductCount.count) || 0,
          averagePrice: parseFloat(avgPrice.avg) || 0
        };

        // Guardar en cache por 15 minutos
        await cache.set(cacheKey, stats, 900);
      }

      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas de categoría:', error);
      throw error;
    }
  }

  // Serializar para respuesta JSON
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      description: this.description,
      icon: this.icon,
      color: this.color,
      sortOrder: this.sortOrder,
      isActive: this.isActive,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      productCount: this.productCount // Si está disponible
    };
  }
}

module.exports = ProductCategory;