const express = require('express');
const Joi = require('joi');
const multer = require('multer');
const ProductService = require('../services/ProductService');
const Product = require('../models/Product');
const ProductCategory = require('../models/ProductCategory');
const { requireRole } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

// Configurar multer para subida de archivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// Esquemas de validación
const createCategorySchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  slug: Joi.string().pattern(/^[a-z0-9-]+$/).min(2).max(50).required(),
  description: Joi.string().max(500).optional(),
  icon: Joi.string().max(50).optional(),
  color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
  sortOrder: Joi.number().integer().min(0).optional(),
  metadata: Joi.object().optional()
});

const updateCategorySchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  slug: Joi.string().pattern(/^[a-z0-9-]+$/).min(2).max(50).optional(),
  description: Joi.string().max(500).optional(),
  icon: Joi.string().max(50).optional(),
  color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
  sortOrder: Joi.number().integer().min(0).optional(),
  isActive: Joi.boolean().optional(),
  metadata: Joi.object().optional()
});

const createProductSchema = Joi.object({
  name: Joi.string().min(2).max(200).required(),
  slug: Joi.string().pattern(/^[a-z0-9-]+$/).min(2).max(100).required(),
  categoryId: Joi.string().uuid().optional(),
  category: Joi.string().optional(), // Legacy support
  description: Joi.string().max(1000).optional(),
  imageUrl: Joi.string().uri().optional(),
  unit: Joi.string().required(),
  standardPackage: Joi.number().positive().optional(),
  estimatedPrice: Joi.number().min(0).optional(),
  nutritionalInfo: Joi.object().optional(),
  storageInfo: Joi.object().optional(),
  brand: Joi.string().max(100).optional(),
  barcode: Joi.string().max(50).optional(),
  weight: Joi.number().min(0).optional(),
  volume: Joi.number().min(0).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  sortOrder: Joi.number().integer().min(0).optional(),
  expiryDate: Joi.date().optional()
});

const updateProductSchema = Joi.object({
  name: Joi.string().min(2).max(200).optional(),
  slug: Joi.string().pattern(/^[a-z0-9-]+$/).min(2).max(100).optional(),
  categoryId: Joi.string().uuid().optional(),
  category: Joi.string().optional(),
  description: Joi.string().max(1000).optional(),
  imageUrl: Joi.string().uri().optional(),
  unit: Joi.string().optional(),
  standardPackage: Joi.number().positive().optional(),
  estimatedPrice: Joi.number().min(0).optional(),
  nutritionalInfo: Joi.object().optional(),
  storageInfo: Joi.object().optional(),
  brand: Joi.string().max(100).optional(),
  barcode: Joi.string().max(50).optional(),
  weight: Joi.number().min(0).optional(),
  volume: Joi.number().min(0).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  sortOrder: Joi.number().integer().min(0).optional(),
  expiryDate: Joi.date().optional(),
  isActive: Joi.boolean().optional()
});

// === RUTAS DE CATEGORÍAS ===

// Obtener todas las categorías
router.get('/categories', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      isActive = 'true',
      search,
      includeProductCount = 'false'
    } = req.query;

    if (isActive === 'true' && !search) {
      // Usar método optimizado para categorías activas
      const categories = await ProductCategory.getActive({
        includeProductCount: includeProductCount === 'true'
      });
      
      res.json({
        categories,
        total: categories.length
      });
    } else {
      // Usar método con filtros
      const result = await ProductCategory.findAll({
        page: parseInt(page),
        limit: parseInt(limit),
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : null,
        search
      });

      res.json({
        categories: result.categories,
        pagination: result.pagination
      });
    }
  } catch (error) {
    next(error);
  }
});

// Obtener categoría específica
router.get('/categories/:id', async (req, res, next) => {
  try {
    const category = await ProductCategory.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({
        error: 'Categoría no encontrada',
        message: 'La categoría especificada no existe'
      });
    }

    // Obtener estadísticas si se solicita
    if (req.query.includeStats === 'true') {
      const stats = await category.getStats();
      res.json({
        category: category.toJSON(),
        stats
      });
    } else {
      res.json({ category: category.toJSON() });
    }
  } catch (error) {
    next(error);
  }
});

// Crear nueva categoría (solo admins)
router.post('/categories', requireRole(['admin']), async (req, res, next) => {
  try {
    const { error, value } = createCategorySchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const category = await ProductService.createCategory(value, req.user);

    res.status(201).json({
      message: 'Categoría creada exitosamente',
      category: category.toJSON()
    });
  } catch (error) {
    if (error.message === 'CATEGORY_SLUG_EXISTS') {
      return res.status(409).json({
        error: 'Slug ya en uso',
        message: 'Ya existe una categoría con este identificador'
      });
    }
    next(error);
  }
});

// Actualizar categoría (solo admins)
router.put('/categories/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const { error, value } = updateCategorySchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const category = await ProductService.updateCategory(req.params.id, value, req.user);

    res.json({
      message: 'Categoría actualizada exitosamente',
      category: category.toJSON()
    });
  } catch (error) {
    if (error.message === 'CATEGORY_NOT_FOUND') {
      return res.status(404).json({
        error: 'Categoría no encontrada',
        message: 'La categoría especificada no existe'
      });
    }
    if (error.message === 'CATEGORY_SLUG_EXISTS') {
      return res.status(409).json({
        error: 'Slug ya en uso',
        message: 'Ya existe una categoría con este identificador'
      });
    }
    next(error);
  }
});

// Eliminar categoría (solo admins)
router.delete('/categories/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    await ProductService.deleteCategory(req.params.id, req.user);

    res.json({
      message: 'Categoría eliminada exitosamente'
    });
  } catch (error) {
    if (error.message === 'CATEGORY_NOT_FOUND') {
      return res.status(404).json({
        error: 'Categoría no encontrada',
        message: 'La categoría especificada no existe'
      });
    }
    if (error.message === 'CATEGORY_HAS_PRODUCTS') {
      return res.status(400).json({
        error: 'Categoría tiene productos',
        message: 'No se puede eliminar una categoría que tiene productos asociados'
      });
    }
    next(error);
  }
});

// Reordenar categorías (solo admins)
router.post('/categories/reorder', requireRole(['admin']), async (req, res, next) => {
  try {
    const { categoryOrders } = req.body;
    
    if (!Array.isArray(categoryOrders)) {
      return res.status(400).json({
        error: 'Datos inválidos',
        message: 'Se requiere un array de órdenes de categorías'
      });
    }

    await ProductCategory.reorder(categoryOrders);

    res.json({
      message: 'Categorías reordenadas exitosamente'
    });
  } catch (error) {
    next(error);
  }
});

// === RUTAS DE PRODUCTOS ===

// Búsqueda de productos
router.get('/search', async (req, res, next) => {
  try {
    const { q: query, category, limit = 20 } = req.query;
    
    if (!query) {
      return res.status(400).json({
        error: 'Query requerido',
        message: 'Debes proporcionar un término de búsqueda'
      });
    }

    const results = await ProductService.searchProducts(query, {
      categoryId: category,
      limit: parseInt(limit),
      includeCategory: true,
      includeSuggestions: true
    });

    res.json(results);
  } catch (error) {
    next(error);
  }
});

// Obtener productos destacados
router.get('/featured', async (req, res, next) => {
  try {
    const { limit = 10, category } = req.query;
    
    const products = await ProductService.getFeaturedProducts({
      limit: parseInt(limit),
      categoryId: category,
      includeCategory: true
    });

    res.json({
      products,
      total: products.length
    });
  } catch (error) {
    next(error);
  }
});

// Obtener etiquetas populares
router.get('/tags', async (req, res, next) => {
  try {
    const { category, limit = 20 } = req.query;
    
    const tags = await ProductService.getPopularTags(category, parseInt(limit));

    res.json({
      tags,
      total: tags.length
    });
  } catch (error) {
    next(error);
  }
});

// Obtener estadísticas del catálogo
router.get('/stats', requireRole(['parroco', 'coordinador', 'admin']), async (req, res, next) => {
  try {
    const stats = await ProductService.getCatalogStats();

    res.json({
      message: 'Estadísticas del catálogo',
      stats
    });
  } catch (error) {
    next(error);
  }
});

// Listar todos los productos
router.get('/', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      categoryId,
      isActive = 'true',
      search,
      tags,
      brand,
      minPrice,
      maxPrice,
      orderBy = 'sort_order',
      orderDirection = 'asc',
      includeCategory = 'true'
    } = req.query;

    const result = await Product.findAll({
      page: parseInt(page),
      limit: parseInt(limit),
      category,
      categoryId,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : null,
      search,
      tags: tags ? tags.split(',') : null,
      brand,
      minPrice: minPrice ? parseFloat(minPrice) : null,
      maxPrice: maxPrice ? parseFloat(maxPrice) : null,
      orderBy,
      orderDirection,
      includeCategory: includeCategory === 'true'
    });

    res.json({
      products: result.products,
      pagination: result.pagination,
      filters: {
        category,
        categoryId,
        isActive,
        search,
        tags,
        brand,
        minPrice,
        maxPrice
      }
    });
  } catch (error) {
    next(error);
  }
});

// Obtener productos por categoría
router.get('/category/:categoryId', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      orderBy = 'sort_order',
      orderDirection = 'asc'
    } = req.query;

    const result = await ProductService.getProductsByCategory(req.params.categoryId, {
      page: parseInt(page),
      limit: parseInt(limit),
      orderBy,
      orderDirection,
      isActive: true
    });

    res.json(result);
  } catch (error) {
    if (error.message === 'CATEGORY_NOT_FOUND') {
      return res.status(404).json({
        error: 'Categoría no encontrada',
        message: 'La categoría especificada no existe'
      });
    }
    next(error);
  }
});

// Obtener producto específico
router.get('/:id', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id, true);
    
    if (!product) {
      return res.status(404).json({
        error: 'Producto no encontrado',
        message: 'El producto especificado no existe'
      });
    }

    // Obtener productos relacionados si se solicita
    let relatedProducts = [];
    if (req.query.includeRelated === 'true') {
      relatedProducts = await product.getRelatedProducts(5);
    }

    res.json({
      product: product.toJSON(),
      relatedProducts
    });
  } catch (error) {
    next(error);
  }
});

// Crear nuevo producto (solo admins)
router.post('/', requireRole(['admin']), async (req, res, next) => {
  try {
    const { error, value } = createProductSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const product = await ProductService.createProduct(value, req.user);

    res.status(201).json({
      message: 'Producto creado exitosamente',
      product: product.toJSON()
    });
  } catch (error) {
    if (error.message === 'PRODUCT_SLUG_EXISTS') {
      return res.status(409).json({
        error: 'Slug ya en uso',
        message: 'Ya existe un producto con este identificador'
      });
    }
    if (error.message === 'CATEGORY_NOT_FOUND') {
      return res.status(400).json({
        error: 'Categoría no encontrada',
        message: 'La categoría especificada no existe'
      });
    }
    next(error);
  }
});

// Actualizar producto (solo admins)
router.put('/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const { error, value } = updateProductSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const product = await ProductService.updateProduct(req.params.id, value, req.user);

    res.json({
      message: 'Producto actualizado exitosamente',
      product: product.toJSON()
    });
  } catch (error) {
    if (error.message === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json({
        error: 'Producto no encontrado',
        message: 'El producto especificado no existe'
      });
    }
    if (error.message === 'PRODUCT_SLUG_EXISTS') {
      return res.status(409).json({
        error: 'Slug ya en uso',
        message: 'Ya existe un producto con este identificador'
      });
    }
    if (error.message === 'CATEGORY_NOT_FOUND') {
      return res.status(400).json({
        error: 'Categoría no encontrada',
        message: 'La categoría especificada no existe'
      });
    }
    next(error);
  }
});

// Eliminar producto (solo admins)
router.delete('/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    await ProductService.deleteProduct(req.params.id, req.user);

    res.json({
      message: 'Producto eliminado exitosamente'
    });
  } catch (error) {
    if (error.message === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json({
        error: 'Producto no encontrado',
        message: 'El producto especificado no existe'
      });
    }
    if (error.message === 'PRODUCT_IN_USE') {
      return res.status(400).json({
        error: 'Producto en uso',
        message: 'No se puede eliminar un producto que está siendo usado en campañas activas'
      });
    }
    next(error);
  }
});

// Reordenar productos (solo admins)
router.post('/reorder', requireRole(['admin']), async (req, res, next) => {
  try {
    const { productOrders } = req.body;
    
    if (!Array.isArray(productOrders)) {
      return res.status(400).json({
        error: 'Datos inválidos',
        message: 'Se requiere un array de órdenes de productos'
      });
    }

    await Product.reorder(productOrders);

    res.json({
      message: 'Productos reordenados exitosamente'
    });
  } catch (error) {
    next(error);
  }
});

// Importar productos (solo admins)
router.post('/import', requireRole(['admin']), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Archivo requerido',
        message: 'Debes subir un archivo CSV o JSON'
      });
    }

    const fileContent = req.file.buffer.toString('utf8');
    let data;

    try {
      if (req.file.mimetype === 'application/json') {
        data = JSON.parse(fileContent);
      } else {
        // Asumir CSV y convertir a JSON
        const lines = fileContent.split('\n');
        const headers = lines[0].split(',');
        data = lines.slice(1).map(line => {
          const values = line.split(',');
          const obj = {};
          headers.forEach((header, index) => {
            obj[header.trim()] = values[index]?.trim();
          });
          return obj;
        });
      }
    } catch (parseError) {
      return res.status(400).json({
        error: 'Formato de archivo inválido',
        message: 'El archivo debe ser un JSON válido o CSV'
      });
    }

    const results = await ProductService.importProducts(data, req.user);

    res.json({
      message: 'Importación completada',
      results
    });
  } catch (error) {
    next(error);
  }
});

// Exportar productos (solo admins)
router.get('/export/:format', requireRole(['admin']), async (req, res, next) => {
  try {
    const { format } = req.params;
    const { category, isActive = 'true' } = req.query;

    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({
        error: 'Formato no soportado',
        message: 'Los formatos soportados son: json, csv'
      });
    }

    const data = await ProductService.exportProducts(format, {
      categoryId: category,
      isActive: isActive === 'true',
      includeCategory: true
    });

    const filename = `productos_${new Date().toISOString().split('T')[0]}.${format}`;

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(data);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.json(data);
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;