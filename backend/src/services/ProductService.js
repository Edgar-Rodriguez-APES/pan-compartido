const Product = require('../models/Product');
const User = require('../models/User');
const logger = require('../utils/logger');
const { cache } = require('../config/redis');

class ProductService {
  // Crear nuevo producto
  static async createProduct(productData, createdBy) {
    try {
      // Verificar permisos del usuario
      const user = await User.findById(createdBy);
      if (!user || !user.hasAnyRole(['admin'])) {
        throw new Error('INSUFFICIENT_PERMISSIONS');
      }

      // Generar slug único
      const slug = await Product.generateUniqueSlug(productData.name);

      // Validar datos requeridos
      if (!productData.name || !productData.category || !productData.unit) {
        throw new Error('MISSING_REQUIRED_FIELDS');
      }

      // Crear producto
      const product = await Product.create({
        ...productData,
        slug
      });

      logger.info('Producto creado por servicio', {
        productId: product.id,
        name: product.name,
        createdBy
      });

      return product;
    } catch (error) {
      logger.error('Error en ProductService.createProduct:', error);
      throw error;
    }
  }

  // Obtener producto por ID o slug
  static async getProduct(identifier) {
    try {
      let product;

      // Intentar buscar por UUID primero
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      if (uuidRegex.test(identifier)) {
        product = await Product.findById(identifier);
      } else {
        product = await Product.findBySlug(identifier);
      }

      if (!product) {
        throw new Error('PRODUCT_NOT_FOUND');
      }

      return product;
    } catch (error) {
      logger.error('Error en ProductService.getProduct:', error);
      throw error;
    }
  }

  // Obtener producto con estadísticas
  static async getProductWithStats(identifier) {
    try {
      const product = await this.getProduct(identifier);
      const stats = await product.getUsageStats();

      return {
        product: product.toJSON(),
        stats
      };
    } catch (error) {
      logger.error('Error en ProductService.getProductWithStats:', error);
      throw error;
    }
  }

  // Listar productos con filtros
  static async listProducts(options = {}) {
    try {
      const result = await Product.findAll(options);

      logger.info('Productos listados', {
        page: options.page || 1,
        total: result.pagination.total,
        category: options.category || 'all'
      });

      return result;
    } catch (error) {
      logger.error('Error en ProductService.listProducts:', error);
      throw error;
    }
  }

  // Obtener productos por categoría
  static async getProductsByCategory(category, activeOnly = true) {
    try {
      const products = await Product.findByCategory(category, activeOnly);

      return products.map(product => product.toJSON());
    } catch (error) {
      logger.error('Error en ProductService.getProductsByCategory:', error);
      throw error;
    }
  }

  // Obtener todas las categorías
  static async getCategories() {
    try {
      const categories = await Product.getCategories();

      return categories;
    } catch (error) {
      logger.error('Error en ProductService.getCategories:', error);
      throw error;
    }
  }

  // Obtener productos populares
  static async getPopularProducts(limit = 10) {
    try {
      const products = await Product.getPopularProducts(limit);

      return products.map(product => product.toJSON());
    } catch (error) {
      logger.error('Error en ProductService.getPopularProducts:', error);
      throw error;
    }
  }

  // Buscar productos
  static async searchProducts(searchTerm, options = {}) {
    try {
      if (!searchTerm || searchTerm.length < 2) {
        throw new Error('SEARCH_TERM_TOO_SHORT');
      }

      const products = await Product.search(searchTerm, options);

      return products.map(product => product.toJSON());
    } catch (error) {
      logger.error('Error en ProductService.searchProducts:', error);
      throw error;
    }
  }

  // Actualizar producto
  static async updateProduct(productId, updateData, updatedBy) {
    try {
      const product = await Product.findById(productId);

      if (!product) {
        throw new Error('PRODUCT_NOT_FOUND');
      }

      // Verificar permisos
      const user = await User.findById(updatedBy);
      if (!user || !user.hasAnyRole(['admin'])) {
        throw new Error('INSUFFICIENT_PERMISSIONS');
      }

      // Generar nuevo slug si el nombre cambió
      if (updateData.name && updateData.name !== product.name) {
        updateData.slug = await Product.generateUniqueSlug(updateData.name, productId);
      }

      await product.update(updateData);

      logger.info('Producto actualizado por servicio', {
        productId: product.id,
        updatedBy,
        changes: Object.keys(updateData)
      });

      return product;
    } catch (error) {
      logger.error('Error en ProductService.updateProduct:', error);
      throw error;
    }
  }

  // Activar/desactivar producto
  static async toggleProductStatus(productId, isActive, updatedBy) {
    try {
      const product = await Product.findById(productId);

      if (!product) {
        throw new Error('PRODUCT_NOT_FOUND');
      }

      // Verificar permisos
      const user = await User.findById(updatedBy);
      if (!user || !user.hasAnyRole(['admin'])) {
        throw new Error('INSUFFICIENT_PERMISSIONS');
      }

      await product.update({ isActive });

      logger.info('Estado de producto cambiado', {
        productId: product.id,
        newStatus: isActive,
        updatedBy
      });

      return product;
    } catch (error) {
      logger.error('Error en ProductService.toggleProductStatus:', error);
      throw error;
    }
  }

  // Obtener productos recomendados para una campaña
  static async getRecommendedProducts(campaignGoals) {
    try {
      if (!campaignGoals || Object.keys(campaignGoals).length === 0) {
        return [];
      }

      const productNames = Object.keys(campaignGoals);
      const products = [];

      for (let productName of productNames) {
        try {
          // Buscar productos que coincidan con el nombre
          const matchingProducts = await Product.search(productName, {
            limit: 3,
            activeOnly: true
          });

          products.push(...matchingProducts);
        } catch (error) {
          logger.warn('Error buscando producto recomendado:', {
            productName,
            error: error.message
          });
        }
      }

      // Eliminar duplicados
      const uniqueProducts = products.filter((product, index, self) => 
        index === self.findIndex(p => p.id === product.id)
      );

      return uniqueProducts.map(product => product.toJSON());
    } catch (error) {
      logger.error('Error en ProductService.getRecommendedProducts:', error);
      throw error;
    }
  }

  // Obtener productos más necesitados (basado en campañas activas)
  static async getMostNeededProducts(limit = 10) {
    try {
      const cacheKey = `most_needed_products:${limit}`;
      let products = await cache.get(cacheKey);

      if (!products) {
        const db = require('../config/database');
        
        // Obtener productos más necesitados de campañas activas
        const neededProducts = await db('campaigns')
          .where('status', 'active')
          .where('start_date', '<=', new Date())
          .where('end_date', '>=', new Date())
          .select('goals', 'current_progress')
          .then(campaigns => {
            const productNeeds = {};

            campaigns.forEach(campaign => {
              const goals = campaign.goals || {};
              const progress = campaign.current_progress || {};

              Object.keys(goals).forEach(productName => {
                const needed = goals[productName]?.needed || 0;
                const received = progress[productName]?.received || 0;
                const remaining = Math.max(0, needed - received);

                if (remaining > 0) {
                  if (!productNeeds[productName]) {
                    productNeeds[productName] = {
                      name: productName,
                      totalNeeded: 0,
                      totalReceived: 0,
                      totalRemaining: 0,
                      unit: goals[productName]?.unit || 'unidades'
                    };
                  }

                  productNeeds[productName].totalNeeded += needed;
                  productNeeds[productName].totalReceived += received;
                  productNeeds[productName].totalRemaining += remaining;
                }
              });
            });

            return Object.values(productNeeds)
              .sort((a, b) => b.totalRemaining - a.totalRemaining)
              .slice(0, limit);
          });

        // Buscar productos correspondientes
        const productPromises = neededProducts.map(async (need) => {
          try {
            const matchingProducts = await Product.search(need.name, {
              limit: 1,
              activeOnly: true
            });

            if (matchingProducts.length > 0) {
              return {
                ...matchingProducts[0].toJSON(),
                needInfo: need
              };
            }

            return {
              name: need.name,
              needInfo: need,
              isVirtual: true // Producto que no existe en el catálogo pero se necesita
            };
          } catch (error) {
            return {
              name: need.name,
              needInfo: need,
              isVirtual: true
            };
          }
        });

        products = await Promise.all(productPromises);

        // Guardar en cache por 30 minutos
        await cache.set(cacheKey, products, 1800);
      }

      return products;
    } catch (error) {
      logger.error('Error en ProductService.getMostNeededProducts:', error);
      throw error;
    }
  }

  // Sincronizar productos con campañas activas
  static async syncProductsWithCampaigns() {
    try {
      const db = require('../config/database');
      
      // Obtener productos únicos de campañas activas
      const campaignProducts = await db('campaigns')
        .where('status', 'active')
        .select('goals')
        .then(campaigns => {
          const productSet = new Set();

          campaigns.forEach(campaign => {
            const goals = campaign.goals || {};
            Object.keys(goals).forEach(productName => {
              productSet.add(productName.toLowerCase());
            });
          });

          return Array.from(productSet);
        });

      let createdCount = 0;

      // Crear productos que no existen
      for (let productName of campaignProducts) {
        const existing = await Product.search(productName, { limit: 1 });
        
        if (existing.length === 0) {
          try {
            // Inferir categoría basada en el nombre
            const category = this.inferProductCategory(productName);
            const unit = this.inferProductUnit(productName);

            await Product.create({
              name: productName.charAt(0).toUpperCase() + productName.slice(1),
              slug: await Product.generateUniqueSlug(productName),
              category,
              description: `Producto agregado automáticamente desde campañas`,
              unit,
              standardPackage: 1,
              estimatedPrice: 0,
              isActive: true
            });

            createdCount++;
          } catch (error) {
            logger.warn('Error creando producto automáticamente:', {
              productName,
              error: error.message
            });
          }
        }
      }

      logger.info('Sincronización de productos completada', {
        campaignProducts: campaignProducts.length,
        createdProducts: createdCount
      });

      return { campaignProducts: campaignProducts.length, createdProducts: createdCount };
    } catch (error) {
      logger.error('Error en ProductService.syncProductsWithCampaigns:', error);
      throw error;
    }
  }

  // Inferir categoría de producto basada en el nombre
  static inferProductCategory(productName) {
    const name = productName.toLowerCase();
    
    const categoryKeywords = {
      'granos': ['arroz', 'frijol', 'lenteja', 'garbanzo', 'quinoa', 'avena'],
      'aceites': ['aceite', 'manteca', 'margarina'],
      'pastas': ['pasta', 'espagueti', 'macarron', 'fideos'],
      'enlatados': ['atun', 'sardina', 'conserva', 'lata'],
      'endulzantes': ['azucar', 'miel', 'panela'],
      'condimentos': ['sal', 'pimienta', 'comino', 'oregano'],
      'lacteos': ['leche', 'queso', 'yogurt'],
      'carnes': ['pollo', 'carne', 'pescado', 'cerdo'],
      'frutas': ['manzana', 'banana', 'naranja', 'fruta'],
      'verduras': ['tomate', 'cebolla', 'zanahoria', 'verdura'],
      'bebidas': ['jugo', 'gaseosa', 'agua'],
      'panaderia': ['pan', 'galleta', 'torta'],
      'limpieza': ['jabon', 'detergente', 'limpiador'],
      'higiene': ['champu', 'pasta dental', 'papel higienico']
    };

    for (let [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => name.includes(keyword))) {
        return category;
      }
    }

    return 'otros';
  }

  // Inferir unidad de producto basada en el nombre
  static inferProductUnit(productName) {
    const name = productName.toLowerCase();
    
    if (name.includes('aceite') || name.includes('leche') || name.includes('jugo')) {
      return 'litros';
    }
    
    if (name.includes('arroz') || name.includes('azucar') || name.includes('sal')) {
      return 'kg';
    }
    
    if (name.includes('pasta') || name.includes('galleta')) {
      return 'paquetes';
    }
    
    if (name.includes('atun') || name.includes('sardina')) {
      return 'latas';
    }

    return 'unidades';
  }

  // Limpiar cache de productos
  static async clearProductCache() {
    try {
      const cacheKeys = [
        'product_categories',
        'popular_products:10',
        'most_needed_products:10'
      ];

      await Promise.all(cacheKeys.map(key => cache.del(key)));

      logger.info('Cache de productos limpiado');
    } catch (error) {
      logger.error('Error limpiando cache de productos:', error);
    }
  }
}

module.exports = ProductService;