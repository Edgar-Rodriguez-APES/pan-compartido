const express = require('express');
const Joi = require('joi');
const TenantService = require('../services/TenantService');
const { requireRole } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

// Esquema de validación para crear tenant
const createTenantSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  slug: Joi.string().pattern(/^[a-z0-9-]+$/).min(2).max(50).required(),
  branding: Joi.object({
    logo: Joi.string().uri().optional(),
    colors: Joi.object({
      primary: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
      secondary: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional()
    }).optional()
  }).optional(),
  contactInfo: Joi.object({
    phone: Joi.string().optional(),
    email: Joi.string().email().optional(),
    address: Joi.string().optional()
  }).optional(),
  settings: Joi.object({
    campaignFrequency: Joi.string().valid('weekly', 'biweekly', 'monthly').optional(),
    minOrderAmount: Joi.number().positive().optional(),
    platformFeePercentage: Joi.number().min(0).max(20).optional()
  }).optional()
});

// Obtener información del tenant actual
router.get('/current', async (req, res, next) => {
  try {
    const result = await TenantService.getTenantWithStats(req.tenantId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Actualizar configuración del tenant (solo párrocos y admins)
router.put('/current', requireRole(['parroco', 'admin']), async (req, res, next) => {
  try {
    const updateSchema = Joi.object({
      branding: Joi.object({
        logo: Joi.string().uri().optional(),
        colors: Joi.object({
          primary: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
          secondary: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional()
        }).optional()
      }).optional(),
      contactInfo: Joi.object({
        phone: Joi.string().optional(),
        email: Joi.string().email().optional(),
        address: Joi.string().optional()
      }).optional(),
      settings: Joi.object({
        campaignFrequency: Joi.string().valid('weekly', 'biweekly', 'monthly').optional(),
        minOrderAmount: Joi.number().positive().optional(),
        platformFeePercentage: Joi.number().min(0).max(20).optional()
      }).optional()
    });

    const { error, value } = updateSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const updatedTenant = await TenantService.updateTenantConfig(
      req.tenantId,
      value,
      req.user
    );

    res.json({
      message: 'Configuración actualizada exitosamente',
      tenant: updatedTenant.toJSON()
    });
  } catch (error) {
    next(error);
  }
});

// Crear nuevo tenant (solo super admins)
router.post('/', requireRole(['admin']), async (req, res, next) => {
  try {
    const { error, value } = createTenantSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const newTenant = await TenantService.createTenant(value, req.user);

    res.status(201).json({
      message: 'Parroquia creada exitosamente',
      tenant: newTenant.toJSON()
    });
  } catch (error) {
    if (error.message === 'SLUG_ALREADY_EXISTS') {
      return res.status(409).json({
        error: 'Slug ya en uso',
        message: 'Ya existe una parroquia con este identificador'
      });
    }
    next(error);
  }
});

// Listar todos los tenants (solo super admins)
router.get('/', requireRole(['admin']), async (req, res, next) => {
  try {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : null,
      search: req.query.search || null
    };

    const result = await TenantService.listTenants(options);

    res.json({
      tenants: result.tenants.map(tenant => ({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        isActive: tenant.isActive,
        createdAt: tenant.createdAt
      })),
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;