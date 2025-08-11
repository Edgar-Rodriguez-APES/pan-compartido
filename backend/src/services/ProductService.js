const Product = require('../models/Product');
const ProductCategory = require('../models/ProductCategory');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

class ProductService {
  // Crear nueva categoría con validaciones
  static async createCategory(data, createdBy) {
    try {
      // Validar que el slug no esté en uso
      const existingCategory = await ProductCategory.findBySlug(data.slug);
      if (existingCategory) {
        throw new Error('CATEGORY_SLUG_EXISTS');
      }

      const category = await ProductCategory.create(data);

      logger.info('Categoría creada por servicio', {
        categoryId: category.id,
        name: category.name,
        createdBy: createdBy?.id
      });

      return category;
    } catch (error) {
      logger.error('Error en ProductService.createCategory:', error);
      throw error;
    }
  }

  // Crear nuevo producto con validaciones
  static async createProduct(data, createdBy) {
    try {
      // Validar que el slug no esté en uso
      const existingProduct = await Product.findBySlug(data.slug);
      if (existingProduct) {
        throw new Error('PRODUCT_SLUG_EXISTS');
      }

      // Validar que la categoría existe si se proporciona
      if (data.categoryId) {
        const category = await ProductCategory.findById(data.categoryId);
        if (!category) {
          throw new Error('CATEGORY_NOT_FOUND');
        }
      }

      const product = await Product.create(data);

      logger.info('Producto creado por servicio', {
        productId: product.id,
        name: product.name,
        createdBy: createdBy?.id
      });

      return product;
    } catch (error) {
      logger.error('Error en ProductService.createProduct:', error);
      throw error;
    }
  }

  // Obtener categorías con productos
  static async getCategoriesWithProducts(options = {}) {
    try {
      const categories = await ProductCategory.getActive({
        includeProductCount: true,
        ...options
      });

      // Enriquecer con productos destacados si se solicita
      if (options.includeFeaturedProducts) {
        for (const category of categories) {
          const products = await Product.findByCategory(category.id, {
            limit: options.featuredProductsLimit || 5,
            isActive: true,
            orderBy: 'sort_order'
          });
          category.featuredProducts = products.products;
        }
      }

      return categories;
    } catch (error) {
      logger.error('Error en ProductService.getCategoriesWithProducts:', error);
      throw error;
    }
  }

  // Búsqueda inteligente de productos
  static async searchProducts(query, options = {}) {
    try {
      const {
        categoryId = null,
        limit = 20,
        includeCategory = true,
        includeSuggestions = true
      } = options;

      // Búsqueda principal
      const products = await Product.search(query, {
        categoryId,
        limit,
        includeCategory
      });

      let suggestions = [];
      
      // Generar sugerencias si no hay resultados o hay pocos
      if (includeSuggestions && products.length < 3) {
        suggestions = await this.generateSearchSuggestions(query, categoryId);
      }

      return {
        products,
        suggestions,
        query,
        totalResults: products.length
      };
    } catch (error) {
      logger.error('Error en ProductService.searchProducts:', error);
      throw error;
    }
  }

  // Generar sugerencias de búsqueda
  static async generateSearchSuggestions(query, categoryId = null) {
    try {
      const cacheKey = `search_suggestions:${query}:${categoryId}`;
      let suggestions = await cache.get(cacheKey);

      if (!suggestions) {
        // Buscar productos similares por nombre parcial
        const similarProducts = await Product.findAll({
          search: query.substring(0, Math.max(3, query.length - 2)),
          categoryId,
          limit: 5,
          isActive: true
        });

        // Buscar por etiquetas populares
        const popularTags = await this.getPopularTags(categoryId);
        const tagSuggestions = popularTags
          .filter(tag => tag.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 3);

        suggestions = {
          similarProducts: similarProducts.products.map(p => ({
            id: p.id,
            name: p.name,
            category: p.categoryName || p.category
          })),
          tags: tagSuggestions,
          categories: await this.getSuggestedCategories(query)
        };

        // Guardar en cache por 30 minutos
        await cache.set(cacheKey, suggestions, 1800);
      }

      return suggestions;
    } catch (error) {
      logger.error('Error generando sugerencias:', error);
      return { similarProducts: [], tags: [], categories: [] };
    }
  }

  // Obtener etiquetas populares
  static async getPopularTags(categoryId = null, limit = 20) {
    try {
      const cacheKey = `popular_tags:${categoryId}:${limit}`;
      let tags = await cache.get(cacheKey);

      if (!tags) {
        let query = db('products')
          .where('is_active', true)
          .whereNotNull('tags')
          .whereRaw("jsonb_array_length(tags) > 0");

        if (categoryId) {
          query = query.where('category_id', categoryId);
        }

        const products = await query.select('tags');
        
        // Contar frecuencia de etiquetas
        const tagCount = {};
        products.forEach(product => {
          if (product.tags && Array.isArray(product.tags)) {
            product.tags.forEach(tag => {
              tagCount[tag] = (tagCount[tag] || 0) + 1;
            });
          }
        });

        // Ordenar por frecuencia y tomar los más populares
        tags = Object.entries(tagCount)
          .sort(([,a], [,b]) => b - a)
          .slice(0, limit)
          .map(([tag]) => tag);

        // Guardar en cache por 1 hora
        await cache.set(cacheKey, tags, 3600);
      }

      return tags;
    } catch (error) {
      logger.error('Error obteniendo etiquetas populares:', error);
      return [];
    }
  }

  // Obtener categorías sugeridas para búsqueda
  static async getSuggestedCategories(query) {
    try {
      const categories = await ProductCategory.getActive();
      
      return categories
        .filter(category => 
          category.name.toLowerCase().includes(query.toLowerCase()) ||
          category.description?.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 3)
        .map(category => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          icon: category.icon
        }));
    } catch (error) {
      logger.error('Error obteniendo categorías sugeridas:', error);
      return [];
    }
  }

  // Obtener productos destacados
  static async getFeaturedProducts(options = {}) {
    try {
      const {
        limit = 10,
        categoryId = null,
        includeCategory = true
      } = options;

      const cacheKey = `featured_products:${limit}:${categoryId}:${includeCategory}`;
      let products = await cache.get(cacheKey);

      if (!products) {
        // Criterios para productos destacados:
        // 1. Productos con mejor precio estimado
        // 2. Productos más utilizados en campañas
        // 3. Productos con mejor información (imágenes, descripciones)
        
        const result = await Product.findAll({
          categoryId,
          isActive: true,
          includeCategory,
          orderBy: 'estimated_price',
          orderDirection: 'asc',
          limit: limit * 2 // Obtener más para filtrar
        });

        // Filtrar productos con información completa
        const featuredProducts = result.products
          .filter(product => 
            product.description && 
            product.estimatedPrice > 0 &&
            product.imageUrl
          )
          .slice(0, limit);

        products = featuredProducts;

        // Guardar en cache por 1 hora
        await cache.set(cacheKey, products, 3600);
      }

      return products;
    } catch (error) {
      logger.error('Error obteniendo productos destacados:', error);
      throw error;
    }
  }

  // Obtener productos por categoría con filtros avanzados
  static async getProductsByCategory(categoryId, options = {}) {
    try {
      const category = await ProductCategory.findById(categoryId);
      if (!category) {
        throw new Error('CATEGORY_NOT_FOUND');
      }

      const products = await Product.findByCategory(categoryId, {
        includeCategory: true,
        ...options
      });

      return {
        category: category.toJSON(),
        products: products.products,
        pagination: products.pagination
      };
    } catch (error) {
      logger.error('Error en ProductService.getProductsByCategory:', error);
      throw error;
    }
  }

  // Actualizar producto con validaciones
  static async updateProduct(productId, data, updatedBy) {
    try {
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('PRODUCT_NOT_FOUND');
      }

      // Validar slug único si se está cambiando
      if (data.slug && data.slug !== product.slug) {
        const existingProduct = await Product.findBySlug(data.slug);
        if (existingProduct) {
          throw new Error('PRODUCT_SLUG_EXISTS');
        }
      }

      // Validar categoría si se está cambiando
      if (data.categoryId && data.categoryId !== product.categoryId) {
        const category = await ProductCategory.findById(data.categoryId);
        if (!category) {
          throw new Error('CATEGORY_NOT_FOUND');
        }
      }

      await product.update(data);

      logger.info('Producto actualizado por servicio', {
        productId: product.id,
        updatedBy: updatedBy?.id,
        changes: Object.keys(data)
      });

      return product;
    } catch (error) {
      logger.error('Error en ProductService.updateProduct:', error);
      throw error;
    }
  }

  // Actualizar categoría con validaciones
  static async updateCategory(categoryId, data, updatedBy) {
    try {
      const category = await ProductCategory.findById(categoryId);
      if (!category) {
        throw new Error('CATEGORY_NOT_FOUND');
      }

      // Validar slug único si se está cambiando
      if (data.slug && data.slug !== category.slug) {
        const existingCategory = await ProductCategory.findBySlug(data.slug);
        if (existingCategory) {
          throw new Error('CATEGORY_SLUG_EXISTS');
        }
      }

      await category.update(data);

      logger.info('Categoría actualizada por servicio', {
        categoryId: category.id,
        updatedBy: updatedBy?.id,
        changes: Object.keys(data)
      });

      return category;
    } catch (error) {
      logger.error('Error en ProductService.updateCategory:', error);
      throw error;
    }
  }

  // Eliminar producto con validaciones
  static async deleteProduct(productId, deletedBy) {
    try {
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('PRODUCT_NOT_FOUND');
      }

      // Verificar si el producto está siendo usado en campañas activas
      const db = require('../config/database');
      const activeCampaigns = await db('campaigns')
        .where('status', 'active')
        .whereRaw('goals ? ?', [productId])
        .count('* as count')
        .first();

      if (parseInt(activeCampaigns.count) > 0) {
        throw new Error('PRODUCT_IN_USE');
      }

      await product.delete();

      logger.info('Producto eliminado por servicio', {
        productId: product.id,
        deletedBy: deletedBy?.id
      });

      return true;
    } catch (error) {
      logger.error('Error en ProductService.deleteProduct:', error);
      throw error;
    }
  }

  // Eliminar categoría con validaciones
  static async deleteCategory(categoryId, deletedBy) {
    try {
      const category = await ProductCategory.findById(categoryId);
      if (!category) {
        throw new Error('CATEGORY_NOT_FOUND');
      }

      await category.delete();

      logger.info('Categoría eliminada por servicio', {
        categoryId: category.id,
        deletedBy: deletedBy?.id
      });

      return true;
    } catch (error) {
      logger.error('Error en ProductService.deleteCategory:', error);
      throw error;
    }
  }

  // Obtener estadísticas del catálogo
  static async getCatalogStats() {
    try {
      const cacheKey = 'catalog_stats';
      let stats = await cache.get(cacheKey);

      if (!stats) {
        const db = require('../config/database');
        
        const [
          totalProducts,
          activeProducts,
          totalCategories,
          activeCategories,
          avgPrice,
          productsWithImages,
          productsWithNutrition
        ] = await Promise.all([
          db('products').count('* as count').first(),
          db('products').where('is_active', true).count('* as count').first(),
          db('product_categories').count('* as count').first(),
          db('product_categories').where('is_active', true).count('* as count').first(),
          db('products').where('is_active', true).avg('estimated_price as avg').first(),
          db('products').where('is_active', true).whereNotNull('image_url').count('* as count').first(),
          db('products').where('is_active', true).whereRaw("nutritional_info != '{}'").count('* as count').first()
        ]);

        stats = {
          products: {
            total: parseInt(totalProducts.count) || 0,
            active: parseInt(activeProducts.count) || 0,
            withImages: parseInt(productsWithImages.count) || 0,
            withNutrition: parseInt(productsWithNutrition.count) || 0
          },
          categories: {
            total: parseInt(totalCategories.count) || 0,
            active: parseInt(activeCategories.count) || 0
          },
          pricing: {
            averagePrice: parseFloat(avgPrice.avg) || 0
          }
        };

        // Guardar en cache por 1 hora
        await cache.set(cacheKey, stats, 3600);
      }

      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas del catálogo:', error);
      throw error;
    }
  }

  // Importar productos desde CSV/JSON
  static async importProducts(data, importedBy) {
    try {
      const results = {
        success: 0,
        errors: 0,
        skipped: 0,
        details: []
      };

      for (const productData of data) {
        try {
          // Validar datos mínimos
          if (!productData.name || !productData.slug) {
            results.errors++;
            results.details.push({
              product: productData.name || 'Sin nombre',
              error: 'Faltan campos requeridos (name, slug)'
            });
            continue;
          }

          // Verificar si ya existe
          const existing = await Product.findBySlug(productData.slug);
          if (existing) {
            results.skipped++;
            results.details.push({
              product: productData.name,
              message: 'Producto ya existe'
            });
            continue;
          }

          // Crear producto
          await Product.create(productData);
          results.success++;
          results.details.push({
            product: productData.name,
            message: 'Importado exitosamente'
          });

        } catch (error) {
          results.errors++;
          results.details.push({
            product: productData.name || 'Sin nombre',
            error: error.message
          });
        }
      }

      logger.info('Importación de productos completada', {
        importedBy: importedBy?.id,
        results
      });

      return results;
    } catch (error) {
      logger.error('Error en importación de productos:', error);
      throw error;
    }
  }

  // Exportar productos a CSV/JSON
  static async exportProducts(format = 'json', options = {}) {
    try {
      const {
        categoryId = null,
        isActive = true,
        includeCategory = true
      } = options;

      const result = await Product.findAll({
        categoryId,
        isActive,
        includeCategory,
        limit: 10000 // Límite alto para exportación
      });

      const products = result.products.map(product => {
        const exported = product.toJSON();
        
        // Limpiar campos no necesarios para exportación
        delete exported.createdAt;
        delete exported.updatedAt;
        delete exported.isNearExpiry;
        delete exported.isExpired;
        
        return exported;
      });

      if (format === 'csv') {
        return this.convertToCSV(products);
      }

      return products;
    } catch (error) {
      logger.error('Error exportando productos:', error);
      throw error;
    }
  }

  // Convertir datos a CSV
  static convertToCSV(data) {
    if (!data.length) return '';

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          if (typeof value === 'object') {
            return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
          }
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');

    return csvContent;
  }
}

module.exports = ProductService;