const express = require('express');
const Joi = require('joi');
const BrandingService = require('../services/BrandingService');
const { requireRole } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

// Esquemas de validación
const brandingUpdateSchema = Joi.object({
  branding: Joi.object({
    colors: Joi.object({
      primary: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
      secondary: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
      accent: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
      background: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
      text: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional()
    }).optional(),
    fonts: Joi.object({
      primary: Joi.string().max(100).optional(),
      secondary: Joi.string().max(100).optional()
    }).optional(),
    customCss: Joi.string().max(5000).optional()
  }).optional(),
  contact: Joi.object({
    phone: Joi.string().max(20).optional(),
    email: Joi.string().email().optional(),
    address: Joi.string().max(200).optional(),
    website: Joi.string().uri().optional(),
    socialMedia: Joi.object({
      facebook: Joi.string().uri().optional().allow(''),
      instagram: Joi.string().uri().optional().allow(''),
      twitter: Joi.string().uri().optional().allow(''),
      whatsapp: Joi.string().max(20).optional().allow('')
    }).optional()
  }).optional(),
  settings: Joi.object({
    campaignFrequency: Joi.string().valid('weekly', 'biweekly', 'monthly').optional(),
    minOrderAmount: Joi.number().positive().optional(),
    platformFeePercentage: Joi.number().min(0).max(20).optional(),
    allowPublicDonations: Joi.boolean().optional(),
    requirePhoneVerification: Joi.boolean().optional(),
    enableWhatsAppNotifications: Joi.boolean().optional(),
    enableEmailNotifications: Joi.boolean().optional()
  }).optional(),
  logoUrl: Joi.string().uri().optional()
});

const templateUpdateSchema = Joi.object({
  platform: Joi.string().valid('whatsapp', 'email', 'social').required(),
  templateType: Joi.string().required(),
  content: Joi.alternatives().try(
    Joi.string().max(1000),
    Joi.object()
  ).required()
});

// Obtener configuración completa de branding
router.get('/', async (req, res, next) => {
  try {
    const config = await BrandingService.getBrandingConfig(req.tenantId);
    res.json(config);
  } catch (error) {
    next(error);
  }
});

// Obtener configuración pública de branding (sin autenticación)
router.get('/public', async (req, res, next) => {
  try {
    const config = await BrandingService.getPublicBrandingConfig(req.tenantId);
    res.json(config);
  } catch (error) {
    next(error);
  }
});

// Actualizar configuración de branding (solo párrocos y admins)
router.put('/', requireRole(['parroco', 'admin']), async (req, res, next) => {
  try {
    const { error, value } = brandingUpdateSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    // Validar configuración adicional
    const validationErrors = BrandingService.validateBrandingConfig(value);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Configuración inválida',
        message: 'Hay errores en la configuración proporcionada',
        details: validationErrors
      });
    }

    const updatedConfig = await BrandingService.updateBrandingConfig(
      req.tenantId,
      value,
      req.user
    );

    res.json({
      message: 'Configuración de branding actualizada exitosamente',
      config: updatedConfig
    });
  } catch (error) {
    next(error);
  }
});

// Generar CSS personalizado
router.get('/css', async (req, res, next) => {
  try {
    const css = await BrandingService.generateCustomCSS(req.tenantId);
    
    res.setHeader('Content-Type', 'text/css');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache por 1 hora
    res.send(css);
  } catch (error) {
    next(error);
  }
});

// Obtener templates de mensajes
router.get('/templates', async (req, res, next) => {
  try {
    const templates = await BrandingService.getMessageTemplates(req.tenantId);
    res.json(templates);
  } catch (error) {
    next(error);
  }
});

// Actualizar template de mensaje específico (solo párrocos y admins)
router.put('/templates', requireRole(['parroco', 'admin']), async (req, res, next) => {
  try {
    const { error, value } = templateUpdateSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const updatedTemplates = await BrandingService.customizeMessageTemplate(
      req.tenantId,
      value.platform,
      value.templateType,
      value.content,
      req.user
    );

    res.json({
      message: 'Template actualizado exitosamente',
      templates: updatedTemplates
    });
  } catch (error) {
    next(error);
  }
});

// Previsualizar mensaje con datos de ejemplo
router.post('/templates/preview', requireRole(['parroco', 'admin']), async (req, res, next) => {
  try {
    const { platform, templateType, data } = req.body;

    if (!platform || !templateType) {
      return res.status(400).json({
        error: 'Parámetros requeridos',
        message: 'Se requieren platform y templateType'
      });
    }

    const templates = await BrandingService.getMessageTemplates(req.tenantId);
    let template = templates[platform]?.[templateType];

    if (!template) {
      return res.status(404).json({
        error: 'Template no encontrado',
        message: `No se encontró el template ${templateType} para ${platform}`
      });
    }

    // Datos de ejemplo si no se proporcionan
    const sampleData = {
      name: 'María González',
      items: 'Arroz (5kg), Aceite (2L)',
      families: '15',
      needs: '• Arroz: 25kg\n• Aceite: 15L\n• Atún: 50 latas',
      progress: '75',
      date: new Date().toLocaleDateString('es-CO'),
      value: '$45.000',
      donations: '23',
      donors: '18',
      totalDonations: '45',
      ...data
    };

    // Reemplazar placeholders
    if (typeof template === 'string') {
      Object.keys(sampleData).forEach(key => {
        const regex = new RegExp(`{${key}}`, 'g');
        template = template.replace(regex, sampleData[key]);
      });
    } else if (typeof template === 'object') {
      template = JSON.parse(JSON.stringify(template));
      const replaceInObject = (obj) => {
        Object.keys(obj).forEach(key => {
          if (typeof obj[key] === 'string') {
            Object.keys(sampleData).forEach(dataKey => {
              const regex = new RegExp(`{${dataKey}}`, 'g');
              obj[key] = obj[key].replace(regex, sampleData[dataKey]);
            });
          } else if (typeof obj[key] === 'object') {
            replaceInObject(obj[key]);
          }
        });
      };
      replaceInObject(template);
    }

    res.json({
      platform,
      templateType,
      preview: template,
      sampleData
    });
  } catch (error) {
    next(error);
  }
});

// Limpiar cache de branding (solo admins)
router.delete('/cache', requireRole(['admin']), async (req, res, next) => {
  try {
    await BrandingService.clearBrandingCache(req.tenantId);
    
    res.json({
      message: 'Cache de branding limpiado exitosamente'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;