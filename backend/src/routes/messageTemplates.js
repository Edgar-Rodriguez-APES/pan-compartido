const express = require('express');
const Joi = require('joi');
const MessageTemplateService = require('../services/MessageTemplateService');
const { requireRole } = require('../middleware/authMiddleware');
const tenantMiddleware = require('../middleware/tenantMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

// Aplicar middleware de tenant a todas las rutas
router.use(tenantMiddleware);

// Esquemas de validación
const templateSchema = Joi.object({
  id: Joi.string().uuid().optional(),
  channel: Joi.string().valid('whatsapp', 'email', 'push').required(),
  templateKey: Joi.string().min(1).max(50).required(),
  name: Joi.string().min(1).max(100).required(),
  content: Joi.string().allow('').optional(),
  subject: Joi.string().allow('').optional(),
  title: Joi.string().allow('').optional(),
  body: Joi.string().allow('').optional(),
  category: Joi.string().valid('onboarding', 'campaigns', 'donations', 'payments', 'reminders', 'reports').required()
});

const renderTemplateSchema = Joi.object({
  channel: Joi.string().valid('whatsapp', 'email', 'push').required(),
  templateKey: Joi.string().required(),
  variables: Joi.object().optional()
});

// Obtener todos los templates del tenant
router.get('/', async (req, res, next) => {
  try {
    const { category } = req.query;
    const templates = await MessageTemplateService.getTemplates(req.tenantId, category);
    
    res.json({
      templates,
      tenant: req.tenant.name
    });
  } catch (error) {
    next(error);
  }
});

// Obtener templates por defecto (para referencia)
router.get('/defaults', requireRole(['parroco', 'admin']), async (req, res, next) => {
  try {
    const defaultTemplates = MessageTemplateService.getDefaultTemplates();
    
    res.json({
      message: 'Templates por defecto del sistema',
      templates: defaultTemplates
    });
  } catch (error) {
    next(error);
  }
});

// Obtener un template específico
router.get('/:channel/:templateKey', async (req, res, next) => {
  try {
    const { channel, templateKey } = req.params;
    const template = await MessageTemplateService.getTemplate(req.tenantId, channel, templateKey);
    
    res.json({
      template,
      channel,
      templateKey
    });
  } catch (error) {
    if (error.message === 'TEMPLATE_NOT_FOUND') {
      return res.status(404).json({
        error: 'Template no encontrado',
        message: `No se encontró el template ${templateKey} para el canal ${channel}`
      });
    }
    next(error);
  }
});

// Crear o actualizar template personalizado (solo párrocos y admins)
router.post('/', requireRole(['parroco', 'admin']), async (req, res, next) => {
  try {
    const { error, value } = templateSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const template = await MessageTemplateService.saveTemplate(req.tenantId, value, req.user);

    res.status(201).json({
      message: value.id ? 'Template actualizado exitosamente' : 'Template creado exitosamente',
      template
    });
  } catch (error) {
    if (error.message.startsWith('MISSING_FIELD:')) {
      return res.status(400).json({
        error: 'Campo requerido',
        message: `El campo ${error.message.split(':')[1]} es requerido`
      });
    }
    if (error.message === 'INVALID_CHANNEL') {
      return res.status(400).json({
        error: 'Canal inválido',
        message: 'El canal debe ser whatsapp, email o push'
      });
    }
    if (error.message === 'MISSING_CONTENT') {
      return res.status(400).json({
        error: 'Contenido requerido',
        message: 'El template debe tener al menos un campo de contenido (content, subject, title o body)'
      });
    }
    next(error);
  }
});

// Actualizar template existente
router.put('/:id', requireRole(['parroco', 'admin']), async (req, res, next) => {
  try {
    const templateData = { ...req.body, id: req.params.id };
    
    const { error, value } = templateSchema.validate(templateData);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const template = await MessageTemplateService.saveTemplate(req.tenantId, value, req.user);

    res.json({
      message: 'Template actualizado exitosamente',
      template
    });
  } catch (error) {
    next(error);
  }
});

// Eliminar template personalizado
router.delete('/:id', requireRole(['parroco', 'admin']), async (req, res, next) => {
  try {
    await MessageTemplateService.deleteTemplate(req.tenantId, req.params.id, req.user);

    res.json({
      message: 'Template eliminado exitosamente'
    });
  } catch (error) {
    if (error.message === 'TEMPLATE_NOT_FOUND') {
      return res.status(404).json({
        error: 'Template no encontrado',
        message: 'El template especificado no existe o no pertenece a esta parroquia'
      });
    }
    next(error);
  }
});

// Renderizar template con variables
router.post('/render', async (req, res, next) => {
  try {
    const { error, value } = renderTemplateSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const template = await MessageTemplateService.getTemplate(
      req.tenantId, 
      value.channel, 
      value.templateKey
    );

    const rendered = MessageTemplateService.renderTemplate(template, value.variables || {});

    res.json({
      message: 'Template renderizado exitosamente',
      original: template,
      rendered,
      variables: value.variables || {}
    });
  } catch (error) {
    if (error.message === 'TEMPLATE_NOT_FOUND') {
      return res.status(404).json({
        error: 'Template no encontrado',
        message: 'El template especificado no existe'
      });
    }
    next(error);
  }
});

// Previsualizar template con variables de ejemplo
router.get('/:channel/:templateKey/preview', async (req, res, next) => {
  try {
    const { channel, templateKey } = req.params;
    const template = await MessageTemplateService.getTemplate(req.tenantId, channel, templateKey);

    // Variables de ejemplo para previsualización
    const sampleVariables = {
      name: 'María González',
      parish_name: req.tenant.name,
      campaign_title: 'Mercados Solidarios Semana 15',
      campaign_needs: '• Arroz: 25kg\n• Aceite: 15 litros\n• Atún: 50 latas',
      items: 'Arroz (5kg), Aceite (2L)',
      families: '12',
      amount: '$45.000',
      date: new Date().toLocaleDateString('es-CO'),
      transaction_id: 'TXN-123456789',
      month: new Date().toLocaleDateString('es-CO', { month: 'long' }),
      year: new Date().getFullYear(),
      donations_count: '3',
      total_donated: '$135.000',
      families_helped: '8',
      total_markets: '45',
      total_families: '120',
      top_products: 'Arroz, Aceite, Atún'
    };

    const rendered = MessageTemplateService.renderTemplate(template, sampleVariables);

    res.json({
      message: 'Previsualización del template',
      template,
      rendered,
      sampleVariables,
      note: 'Esta es una previsualización con datos de ejemplo'
    });
  } catch (error) {
    if (error.message === 'TEMPLATE_NOT_FOUND') {
      return res.status(404).json({
        error: 'Template no encontrado',
        message: 'El template especificado no existe'
      });
    }
    next(error);
  }
});

// Obtener estadísticas de templates
router.get('/stats', requireRole(['parroco', 'admin']), async (req, res, next) => {
  try {
    const stats = await MessageTemplateService.getTemplateStats(req.tenantId);

    res.json({
      message: 'Estadísticas de templates',
      stats,
      tenant: req.tenant.name
    });
  } catch (error) {
    next(error);
  }
});

// Limpiar cache de templates (para desarrollo/debugging)
router.post('/clear-cache', requireRole(['admin']), async (req, res, next) => {
  try {
    await MessageTemplateService.clearTemplateCache(req.tenantId);

    res.json({
      message: 'Cache de templates limpiado exitosamente'
    });
  } catch (error) {
    next(error);
  }
});

// Obtener variables disponibles para un template
router.get('/:channel/:templateKey/variables', async (req, res, next) => {
  try {
    const { channel, templateKey } = req.params;
    const template = await MessageTemplateService.getTemplate(req.tenantId, channel, templateKey);

    // Descripción de variables comunes
    const variableDescriptions = {
      name: 'Nombre del usuario',
      parish_name: 'Nombre de la parroquia',
      campaign_title: 'Título de la campaña',
      campaign_needs: 'Lista de necesidades de la campaña',
      items: 'Productos donados o comprados',
      families: 'Número de familias beneficiadas',
      amount: 'Monto de la donación o compra',
      date: 'Fecha de la transacción',
      transaction_id: 'ID de la transacción',
      month: 'Mes actual',
      year: 'Año actual',
      donations_count: 'Número de donaciones realizadas',
      total_donated: 'Monto total donado',
      families_helped: 'Familias ayudadas por el usuario',
      total_markets: 'Total de mercados entregados',
      total_families: 'Total de familias beneficiadas',
      top_products: 'Productos más donados'
    };

    const variablesWithDescriptions = template.variables.map(variable => ({
      name: variable,
      description: variableDescriptions[variable] || 'Variable personalizada',
      example: variable === 'name' ? 'María González' : 
               variable === 'parish_name' ? req.tenant.name :
               variable === 'amount' ? '$45.000' :
               variable === 'families' ? '12' :
               `{{${variable}}}`
    }));

    res.json({
      message: 'Variables disponibles para el template',
      template: {
        channel,
        templateKey,
        name: template.name
      },
      variables: variablesWithDescriptions,
      totalVariables: template.variables.length
    });
  } catch (error) {
    if (error.message === 'TEMPLATE_NOT_FOUND') {
      return res.status(404).json({
        error: 'Template no encontrado',
        message: 'El template especificado no existe'
      });
    }
    next(error);
  }
});

module.exports = router;