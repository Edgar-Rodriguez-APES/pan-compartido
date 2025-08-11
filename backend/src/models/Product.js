const db = require('../config/database');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

class Product {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.slug = data.slug;
    this.category = data.category; // Legacy field
    this.categoryId = data.category_id;
    this.description = data.description;
    this.imageUrl = data.image_url;
    this.unit = data.unit;
    this.standardPackage = data.standard_package;
    this.estimatedPrice = parseFloat(data.estimated_price) || 0;
    this.nutritionalInfo = data.nutritional_info || {};
    this.storageInfo = data.storage_info || {};
    this.brand = data.brand;
    this.barcode = data.barcode;
    this.weight = parseFloat(data.weight) || 0;
    this.volume = parseFloat(data.volume) || 0;
    this.tags = data.tags || [];
    this.sortOrder = data.sort_order || 0;
    this.expiryDate = data.expiry_date;
    this.isActive = data.is_active;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    
    // Campos relacionados (si están disponibles)
    this.categoryName = data.category_name;
    this.categorySlug = data.category_slug;
    this.categoryIcon = data.category_icon;
    this.categoryColor = data.category_color;
  }

  // Crear nuevo producto
  static async create(data) {
    try {
      const [product] = await db('products')
        .insert({
          name: data.name,
          slug: data.slug,
          category: data.category, // Legacy support
          category_id: data.categoryId,
          description: data.description,
          image_url: data.imageUrl,
          unit: data.unit,
          standard_package: data.standardPackage || 1,
          estimated_price: data.estimatedPrice || 0,
          nutritional_info: data.nutritionalInfo || {},
          storage_info: data.storageInfo || {},
          brand: data.brand,
          barcode: data.barcode,
          weight: data.weight || 0,
          volume: data.volume || 0,
          tags: data.tags || [],
          sort_order: data.sortOrder || 0,
          expiry_date: data.expiryDate,
          is_active: data.isActive !== undefined ? data.isActive : true
        })
        .returning('*');

      logger.info('Producto creado', {
        productId: product.id,
        name: product.name,
        slug: product.slug,
        categoryId: product.category_id
      });

      // Limpiar cache
      await this.clearCache();

      return new Product(product);
    } catch (error) {
      logger.error('Error creando producto:', error);
      throw error;
    }
  }

  // Buscar producto por ID
  static async findById(id, includeCategory = false) {
    try {
      const cacheKey = `product:${id}:${includeCategory}`;
      let productData = await cache.get(cacheKey);

      if (!productData) {
        let query = db('products').where('products.id', id);

        if (includeCategory) {
          query = query
            .leftJoin('product_categories', 'products.category_id', 'product_categories.id')
            .select(
              'products.*',
              'product_categories.name as category_name',
              'product_categories.slug as category_slug',
              'product_categories.icon as category_icon',
              'product_categories.color as category_color'
            );
        } else {
          query = query.select('products.*');
        }

        productData = await query.first();

        if (productData) {
          // Guardar en cache por 1 hora
          await cache.set(cacheKey, productData, 3600);
        }
      }

      return productData ? new Product(productData) : null;
    } catch (error) {
      logger.error('Error buscando producto por ID:', error);
      throw error;
    }
  }

  // Buscar producto por slug
  static async findBySlug(slug, includeCategory = false) {
    try {
      const cacheKey = `product:slug:${slug}:${includeCategory}`;
      let productData = await cache.get(cacheKey);

      if (!productData) {
        let query = db('products').where('products.slug', slug);

        if (includeCategory) {
          query = query
            .leftJoin('product_categories', 'products.category_id', 'product_categories.id')
            .select(
              'products.*',
              'product_categories.name as category_name',
              'product_categories.slug as category_slug',
              'product_categories.icon as category_icon',
              'product_categories.color as category_color'
            );
        } else {
          query = query.select('products.*');
        }

        productData = await query.first();

        if (productData) {
          // Guardar en cache por 1 hora
          await cache.set(cacheKey, productData, 3600);
        }
      }

      return productData ? new Product(productData) : null;
    } catch (error) {
      logger.error('Error buscando producto por slug:', error);
      throw error;
    }
  }

  // Obtener productos con filtros avanzados
  static async findAll(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        categoryId = null,
        category = null, // Legacy support
        isActive = null,
        search = null,
        tags = null,
        brand = null,
        minPrice = null,
        maxPrice = null,
        orderBy = 'sort_order',
        orderDirection = 'asc',
        includeCategory = false
      } = options;

      const offset = (page - 1) * limit;
      let query = db('products');

      if (includeCategory) {
        query = query
          .leftJoin('product_categories', 'products.category_id', 'product_categories.id')
          .select(
            'products.*',
            'product_categories.name as category_name',
            'product_categories.slug as category_slug',
            'product_categories.icon as category_icon',
            'product_categories.color as category_color'
          );
      } else {
        query = query.select('products.*');
      }

      // Filtros
      if (categoryId) {
        query = query.where('products.category_id', categoryId);
      }

      if (category) { // Legacy support
        query = query.where('products.category', category);
      }

      if (isActive !== null) {
        query = query.where('products.is_active', isActive);
      }

      if (search) {
        query = query.where(function() {
          this.where('products.name', 'ilike', `%${search}%`)
              .orWhere('products.description', 'ilike', `%${search}%`)
              .orWhere('products.brand', 'ilike', `%${search}%`)
              .orWhereRaw('products.tags::text ilike ?', [`%${search}%`]);
        });
      }

      if (tags && Array.isArray(tags)) {
        query = query.whereRaw('products.tags ?| array[?]', [tags]);
      }

      if (brand) {
        query = query.where('products.brand', 'ilike', `%${brand}%`);
      }

      if (minPrice !== null) {
        query = query.where('products.estimated_price', '>=', minPrice);
      }

      if (maxPrice !== null) {
        query = query.where('products.estimated_price', '<=', maxPrice);
      }

      // Obtener total para paginación
      const totalQuery = query.clone();
      const [{ count: total }] = await totalQuery.count('products.id as count');

      // Obtener resultados paginados
      const products = await query
        .orderBy(`products.${orderBy}`, orderDirection)
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

  // Buscar productos por categoría
  static async findByCategory(categoryId, options = {}) {
    return this.findAll({ ...options, categoryId });
  }

  // Buscar productos por etiquetas
  static async findByTags(tags, options = {}) {
    return this.findAll({ ...options, tags });
  }

  // Búsqueda inteligente de productos
  static async search(query, options = {}) {
    try {
      const {
        limit = 10,
        includeCategory = true,
        categoryId = null
      } = options;

      const cacheKey = `product_search:${query}:${limit}:${includeCategory}:${categoryId}`;
      let results = await cache.get(cacheKey);

      if (!results) {
        let dbQuery = db('products');

        if (includeCategory) {
          dbQuery = dbQuery
            .leftJoin('product_categories', 'products.category_id', 'product_categories.id')
            .select(
              'products.*',
              'product_categories.name as category_name',
              'product_categories.slug as category_slug',
              'product_categories.icon as category_icon',
              'product_categories.color as category_color'
            );
        } else {
          dbQuery = dbQuery.select('products.*');
        }

        // Filtros de búsqueda con ponderación
        dbQuery = dbQuery
          .where('products.is_active', true)
          .where(function() {
            this.where('products.name', 'ilike', `%${query}%`)
                .orWhere('products.description', 'ilike', `%${query}%`)
                .orWhere('products.brand', 'ilike', `%${query}%`)
                .orWhereRaw('products.tags::text ilike ?', [`%${query}%`]);
          });

        if (categoryId) {
          dbQuery = dbQuery.where('products.category_id', categoryId);
        }

        // Ordenar por relevancia (nombre exacto primero, luego por popularidad)
        dbQuery = dbQuery
          .orderByRaw(`
            CASE 
              WHEN LOWER(products.name) = LOWER(?) THEN 1
              WHEN LOWER(products.name) LIKE LOWER(?) THEN 2
              ELSE 3
            END, products.sort_order ASC
          `, [query, `${query}%`])
          .limit(limit);

        const productData = await dbQuery;
        results = productData.map(product => new Product(product));

        // Guardar en cache por 15 minutos
        await cache.set(cacheKey, results, 900);
      }

      return results;
    } catch (error) {
      logger.error('Error en búsqueda de productos:', error);
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
      if (data.categoryId !== undefined) updateData.category_id = data.categoryId;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.imageUrl !== undefined) updateData.image_url = data.imageUrl;
      if (data.unit !== undefined) updateData.unit = data.unit;
      if (data.standardPackage !== undefined) updateData.standard_package = data.standardPackage;
      if (data.estimatedPrice !== undefined) updateData.estimated_price = data.estimatedPrice;
      if (data.nutritionalInfo !== undefined) updateData.nutritional_info = data.nutritionalInfo;
      if (data.storageInfo !== undefined) updateData.storage_info = data.storageInfo;
      if (data.brand !== undefined) updateData.brand = data.brand;
      if (data.barcode !== undefined) updateData.barcode = data.barcode;
      if (data.weight !== undefined) updateData.weight = data.weight;
      if (data.volume !== undefined) updateData.volume = data.volume;
      if (data.tags !== undefined) updateData.tags = data.tags;
      if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder;
      if (data.expiryDate !== undefined) updateData.expiry_date = data.expiryDate;
      if (data.isActive !== undefined) updateData.is_active = data.isActive;

      updateData.updated_at = new Date();

      const [updatedProduct] = await db('products')
        .where('id', this.id)
        .update(updateData)
        .returning('*');

      // Actualizar propiedades del objeto actual
      Object.assign(this, new Product(updatedProduct));

      // Limpiar cache
      await Product.clearCache();

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

  // Eliminar producto (soft delete)
  async delete() {
    try {
      await db('products')
        .where('id', this.id)
        .update({
          is_active: false,
          updated_at: new Date()
        });

      this.isActive = false;

      // Limpiar cache
      await Product.clearCache();

      logger.info('Producto desactivado', { productId: this.id });

      return this;
    } catch (error) {
      logger.error('Error desactivando producto:', error);
      throw error;
    }
  }

  // Obtener productos relacionados
  async getRelatedProducts(limit = 5) {
    try {
      const cacheKey = `product:${this.id}:related:${limit}`;
      let relatedProducts = await cache.get(cacheKey);

      if (!relatedProducts) {
        // Buscar productos de la misma categoría, excluyendo el actual
        let query = db('products')
          .where('is_active', true)
          .where('id', '!=', this.id);

        if (this.categoryId) {
          query = query.where('category_id', this.categoryId);
        } else if (this.category) {
          query = query.where('category', this.category);
        }

        const productData = await query
          .orderBy('sort_order', 'asc')
          .limit(limit);

        relatedProducts = productData.map(product => new Product(product));

        // Guardar en cache por 30 minutos
        await cache.set(cacheKey, relatedProducts, 1800);
      }

      return relatedProducts;
    } catch (error) {
      logger.error('Error obteniendo productos relacionados:', error);
      throw error;
    }
  }

  // Verificar si el producto está próximo a vencer
  isNearExpiry(days = 30) {
    if (!this.expiryDate) return false;
    
    const expiryDate = new Date(this.expiryDate);
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + days);
    
    return expiryDate <= warningDate;
  }

  // Verificar si el producto está vencido
  isExpired() {
    if (!this.expiryDate) return false;
    return new Date(this.expiryDate) < new Date();
  }

  // Obtener información nutricional formateada
  getFormattedNutritionalInfo() {
    if (!this.nutritionalInfo || Object.keys(this.nutritionalInfo).length === 0) {
      return null;
    }

    return {
      calories: this.nutritionalInfo.calories || 0,
      protein: this.nutritionalInfo.protein || 0,
      carbs: this.nutritionalInfo.carbs || 0,
      fat: this.nutritionalInfo.fat || 0,
      fiber: this.nutritionalInfo.fiber || 0,
      sodium: this.nutritionalInfo.sodium || 0,
      sugar: this.nutritionalInfo.sugar || 0
    };
  }

  // Limpiar cache de productos
  static async clearCache() {
    try {
      const keys = await cache.keys('product*');
      if (keys.length > 0) {
        await Promise.all(keys.map(key => cache.del(key)));
      }

      logger.info('Cache de productos limpiado');
    } catch (error) {
      logger.error('Error limpiando cache de productos:', error);
    }
  }

  // Reordenar productos
  static async reorder(productOrders) {
    try {
      const transaction = await db.transaction();

      try {
        for (const { id, sortOrder } of productOrders) {
          await transaction('products')
            .where('id', id)
            .update({ 
              sort_order: sortOrder,
              updated_at: new Date()
            });
        }

        await transaction.commit();

        // Limpiar cache
        await this.clearCache();

        logger.info('Productos reordenados', {
          productsCount: productOrders.length
        });

        return true;
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      logger.error('Error reordenando productos:', error);
      throw error;
    }
  }

  // Serializar para respuesta JSON
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      category: this.category,
      categoryId: this.categoryId,
      description: this.description,
      imageUrl: this.imageUrl,
      unit: this.unit,
      standardPackage: this.standardPackage,
      estimatedPrice: this.estimatedPrice,
      nutritionalInfo: this.nutritionalInfo,
      storageInfo: this.storageInfo,
      brand: this.brand,
      barcode: this.barcode,
      weight: this.weight,
      volume: this.volume,
      tags: this.tags,
      sortOrder: this.sortOrder,
      expiryDate: this.expiryDate,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      // Campos de categoría (si están disponibles)
      categoryName: this.categoryName,
      categorySlug: this.categorySlug,
      categoryIcon: this.categoryIcon,
      categoryColor: this.categoryColor,
      // Campos calculados
      isNearExpiry: this.isNearExpiry(),
      isExpired: this.isExpired(),
      formattedNutritionalInfo: this.getFormattedNutritionalInfo()
    };
  }
}

module.exports = Product;