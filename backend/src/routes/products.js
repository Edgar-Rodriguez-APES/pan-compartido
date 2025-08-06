const express = require('express');
const Joi = require('joi');
const ProductService = require('../services/ProductService');
const { requireRole } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

// Esquemas de validación
const createProductSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  category: Joi.string().min(2).max(50).required(),
  description: Joi.string().max(500).optional(),
  imageUrl: Joi.string().uri().optional(),
  unit: Joi.string().valid('kg', 'litros', 'paquetes', 'latas', 'unidades', 'gramos', 'ml').required(),
  standardPackage: Joi.number().integer().positive().default(1),
  estimatedPrice: Joi.number().min(0).default(0)
});

const updateProductSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  category: Joi.string().min(2).max(50).optional(),
  description: Joi.string().max(500).optional(),
  imageUrl: Joi.string().uri().optional(),
  unit: Joi.string().valid('kg', 'litros', 'paquetes', 'latas', 'unidades', 'gramos', 'ml').optional(),
  standardPackage: Joi.number().integer().positive().optional(),
  estimatedPrice: Joi.number().min(0).optional(),
  isActive: Joi.boolean().optional()
});

// Listar productos con filtros
router.get('/', async (req, res, next) => {
  try {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50,
      category: req.query.category || null,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : true,
      search: req.query.search || null,
      orderBy: req.query.orderBy || 'name',
      orderDirection: req.query.orderDirection || 'asc'
    };

    const result = await ProductService.listProducts(options);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Obtener categorías de productos
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await ProductService.getCategories();
    res.json({ categories });
  } catch (error) {
    next(error);
  }
});

// Obtener productos populares
router.get('/popular', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const products = await ProductService.getPopularProducts(limit);
    res.json({ products });
  } catch (error) {
    next(error);
  }
});

// Obtener productos más necesitados
router.get('/most-needed', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const products = await ProductService.getMostNeededProducts(limit);
    res.json({ products });
  } catch (error) {
    next(error);
  }
});

// Buscar productos
router.get('/search', async (req, res, next) => {
  try {
    const { q: searchTerm } = req.query;

    if (!searchTerm) {
      return res.status(400).json({
        error: 'Término de búsqueda requerido',
        message: 'Debes proporcionar un término de búsqueda'
      });
    }

    const options = {
      limit: parseInt(req.query.limit) || 20,
      category: req.query.category || null,
      activeOnly: req.query.activeOnly !== 'false'
    };

    const products = await ProductService.searchProducts(searchTerm, options);
    res.json({ products });
  } catch (error) {
    if (error.message === 'SEARCH_TERM_TOO_SHORT') {
      return res.status(400).json({
        error: 'Término muy corto',
        message: 'El término de búsqueda debe tener al menos 2 caracteres'
      });
    }
    next(error);
  }
});

// Obtener productos por categoría
router.get('/category/:category', async (req, res, next) => {
  try {
    const { category } = req.params;
    const activeOnly = req.query.activeOnly !== 'false';

    const products = await ProductService.getProductsByCategory(category, activeOnly);
    res.json({ products });
  } catch (error) {
    next(error);
  }
});

// Obtener productos recomendados para una campaña
router.post('/recommendations', async (req, res, next) => {
  try {
    const { campaignGoals } = req.body;

    if (!campaignGoals) {
      return res.status(400).json({
        error: 'Objetivos de campaña requeridos',
        message: 'Debes proporcionar los objetivos de la campaña'
      });
    }

    const products = await ProductService.getRecommendedProducts(campaignGoals);
    res.json({ products });
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

    const product = await ProductService.createProduct(value, req.userId);

    res.status(201).json({
      message: 'Producto creado exitosamente',
      product: product.toJSON()
    });
  } catch (error) {
    if (error.message === 'INSUFFICIENT_PERMISSIONS') {
      return res.status(403).json({
        error: 'Permisos insuficientes',
        message: 'No tienes permisos para crear productos'
      });
    }
    if (error.message === 'MISSING_REQUIRED_FIELDS') {
      return res.status(400).json({
        error: 'Campos requeridos faltantes',
        message: 'Nombre, categoría y unidad son campos obligatorios'
      });
    }
    next(error);
  }
});

// Obtener producto específico
router.get('/:identifier', async (req, res, next) => {
  try {
    const includeStats = req.query.includeStats === 'true';

    if (includeStats) {
      const result = await ProductService.getProductWithStats(req.params.identifier);
      res.json(result);
    } else {
      const product = await ProductService.getProduct(req.params.identifier);
      res.json({ product: product.toJSON() });
    }
  } catch (error) {
    if (error.message === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json({
        error: 'Producto no encontrado',
        message: 'El producto especificado no existe'
      });
    }
    next(error);
  }
});

// Actualizar producto (solo admins)
router.put('/:productId', requireRole(['admin']), async (req, res, next) => {
  try {
    const { error, value } = updateProductSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const product = await ProductService.updateProduct(
      req.params.productId,
      value,
      req.userId
    );

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
    if (error.message === 'INSUFFICIENT_PERMISSIONS') {
      return res.status(403).json({
        error: 'Permisos insuficientes',
        message: 'No tienes permisos para actualizar productos'
      });
    }
    next(error);
  }
});

// Activar/desactivar producto (solo admins)
router.patch('/:productId/status', requireRole(['admin']), async (req, res, next) => {
  try {
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        error: 'Estado inválido',
        message: 'El campo isActive debe ser true o false'
      });
    }

    const product = await ProductService.toggleProductStatus(
      req.params.productId,
      isActive,
      req.userId
    );

    res.json({
      message: `Producto ${isActive ? 'activado' : 'desactivado'} exitosamente`,
      product: product.toJSON()
    });
  } catch (error) {
    if (error.message === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json({
        error: 'Producto no encontrado',
        message: 'El producto especificado no existe'
      });
    }
    if (error.message === 'INSUFFICIENT_PERMISSIONS') {
      return res.status(403).json({
        error: 'Permisos insuficientes',
        message: 'No tienes permisos para cambiar el estado de productos'
      });
    }
    next(error);
  }
});

// Sincronizar productos con campañas (solo admins)
router.post('/sync-campaigns', requireRole(['admin']), async (req, res, next) => {
  try {
    const result = await ProductService.syncProductsWithCampaigns();

    res.json({
      message: 'Sincronización completada exitosamente',
      ...result
    });
  } catch (error) {
    next(error);
  }
});

// Limpiar cache de productos (solo admins)
router.delete('/cache', requireRole(['admin']), async (req, res, next) => {
  try {
    await ProductService.clearProductCache();

    res.json({
      message: 'Cache de productos limpiado exitosamente'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;