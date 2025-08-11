const express = require('express');
const Joi = require('joi');
const CampaignService = require('../services/CampaignService');
const { requireRole } = require('../middleware/authMiddleware');
const tenantMiddleware = require('../middleware/tenantMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

// Aplicar middleware de tenant a todas las rutas
router.use(tenantMiddleware);

// Esquemas de validación
const createCampaignSchema = Joi.object({
  title: Joi.string().min(3).max(200).required(),
  description: Joi.string().max(1000).optional(),
  goals: Joi.object().pattern(
    Joi.string(),
    Joi.object({
      needed: Joi.number().positive().required(),
      unit: Joi.string().required(),
      estimated_price: Joi.number().positive().optional()
    })
  ).required(),
  frequency: Joi.string().valid('weekly', 'biweekly', 'monthly').default('weekly'),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  targetFamilies: Joi.number().positive().optional(),
  targetAmount: Joi.number().positive().optional()
});

const updateCampaignSchema = Joi.object({
  title: Joi.string().min(3).max(200).optional(),
  description: Joi.string().max(1000).optional(),
  goals: Joi.object().pattern(
    Joi.string(),
    Joi.object({
      needed: Joi.number().positive().required(),
      unit: Joi.string().required(),
      estimated_price: Joi.number().positive().optional()
    })
  ).optional(),
  frequency: Joi.string().valid('weekly', 'biweekly', 'monthly').optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  targetFamilies: Joi.number().positive().optional(),
  targetAmount: Joi.number().positive().optional(),
  status: Joi.string().valid('draft', 'active', 'completed', 'cancelled').optional()
});

const listCampaignsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('draft', 'active', 'completed', 'cancelled').optional(),
  frequency: Joi.string().valid('weekly', 'biweekly', 'monthly').optional(),
  search: Joi.string().max(100).optional(),
  orderBy: Joi.string().valid('created_at', 'title', 'start_date', 'end_date', 'raised_amount').default('created_at'),
  orderDirection: Joi.string().valid('asc', 'desc').default('desc'),
  dateFrom: Joi.date().optional(),
  dateTo: Joi.date().optional(),
  includeCreator: Joi.boolean().default(false)
});

// Obtener campañas activas (público para feligreses)
router.get('/active', async (req, res, next) => {
  try {
    const campaigns = await CampaignService.getActiveCampaigns(req.tenantId);
    
    res.json({
      campaigns,
      tenant: req.tenant.name,
      count: campaigns.length
    });
  } catch (error) {
    next(error);
  }
});

// Obtener dashboard de campañas (solo párrocos y coordinadores)
router.get('/dashboard', requireRole(['parroco', 'coordinador', 'admin']), async (req, res, next) => {
  try {
    const dashboard = await CampaignService.getCampaignDashboard(req.tenantId);
    
    res.json({
      message: 'Dashboard de campañas',
      dashboard,
      tenant: req.tenant.name
    });
  } catch (error) {
    next(error);
  }
});

// Listar todas las campañas con filtros
router.get('/', async (req, res, next) => {
  try {
    const { error, value } = listCampaignsSchema.validate(req.query);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const result = await CampaignService.listCampaigns(req.tenantId, value);
    
    res.json({
      campaigns: result.campaigns,
      pagination: result.pagination,
      filters: value,
      tenant: req.tenant.name
    });
  } catch (error) {
    next(error);
  }
});

// Obtener campaña específica
router.get('/:id', async (req, res, next) => {
  try {
    const includeStats = req.query.includeStats === 'true';
    
    if (includeStats) {
      const result = await CampaignService.getCampaignWithStats(req.params.id, req.tenantId);
      res.json(result);
    } else {
      const campaign = await CampaignService.getCampaign(req.params.id, req.tenantId, req.user?.id);
      res.json({ campaign: campaign.toJSON() });
    }
  } catch (error) {
    if (error.message === 'CAMPAIGN_NOT_FOUND') {
      return res.status(404).json({
        error: 'Campaña no encontrada',
        message: 'La campaña especificada no existe o no pertenece a esta parroquia'
      });
    }
    next(error);
  }
});

// Crear nueva campaña (solo párrocos y coordinadores)
router.post('/', requireRole(['parroco', 'coordinador', 'admin']), async (req, res, next) => {
  try {
    const { error, value } = createCampaignSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const campaign = await CampaignService.createCampaign(value, req.tenantId, req.user);

    res.status(201).json({
      message: 'Campaña creada exitosamente',
      campaign: campaign.toJSON()
    });
  } catch (error) {
    if (error.message === 'TOO_MANY_ACTIVE_CAMPAIGNS') {
      return res.status(400).json({
        error: 'Demasiadas campañas activas',
        message: 'No puedes tener más de 3 campañas activas al mismo tiempo'
      });
    }
    if (error.message === 'INVALID_DATE_RANGE') {
      return res.status(400).json({
        error: 'Rango de fechas inválido',
        message: 'La fecha de inicio debe ser anterior a la fecha de fin'
      });
    }
    if (error.message === 'EMPTY_GOALS') {
      return res.status(400).json({
        error: 'Metas vacías',
        message: 'La campaña debe tener al menos una meta de producto'
      });
    }
    next(error);
  }
});

// Actualizar campaña
router.put('/:id', requireRole(['parroco', 'coordinador', 'admin']), async (req, res, next) => {
  try {
    const { error, value } = updateCampaignSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const campaign = await CampaignService.updateCampaign(
      req.params.id,
      value,
      req.tenantId,
      req.user
    );

    res.json({
      message: 'Campaña actualizada exitosamente',
      campaign: campaign.toJSON()
    });
  } catch (error) {
    if (error.message === 'CAMPAIGN_NOT_FOUND') {
      return res.status(404).json({
        error: 'Campaña no encontrada',
        message: 'La campaña especificada no existe'
      });
    }
    if (error.message === 'INSUFFICIENT_PERMISSIONS') {
      return res.status(403).json({
        error: 'Permisos insuficientes',
        message: 'No tienes permisos para actualizar esta campaña'
      });
    }
    if (error.message === 'CAMPAIGN_COMPLETED') {
      return res.status(400).json({
        error: 'Campaña completada',
        message: 'No se puede modificar una campaña completada'
      });
    }
    if (error.message === 'INVALID_STATUS_TRANSITION') {
      return res.status(400).json({
        error: 'Transición de estado inválida',
        message: 'No se puede cambiar al estado especificado'
      });
    }
    next(error);
  }
});

// Activar campaña
router.post('/:id/activate', requireRole(['parroco', 'coordinador', 'admin']), async (req, res, next) => {
  try {
    const campaign = await CampaignService.activateCampaign(
      req.params.id,
      req.tenantId,
      req.user
    );

    res.json({
      message: 'Campaña activada exitosamente',
      campaign: campaign.toJSON()
    });
  } catch (error) {
    if (error.message === 'CAMPAIGN_NOT_FOUND') {
      return res.status(404).json({
        error: 'Campaña no encontrada',
        message: 'La campaña especificada no existe'
      });
    }
    if (error.message === 'CAMPAIGN_NOT_DRAFT') {
      return res.status(400).json({
        error: 'Campaña no es borrador',
        message: 'Solo se pueden activar campañas en estado borrador'
      });
    }
    if (error.message === 'CAMPAIGN_NO_GOALS') {
      return res.status(400).json({
        error: 'Campaña sin metas',
        message: 'La campaña debe tener metas definidas antes de activarse'
      });
    }
    if (error.message === 'CAMPAIGN_NO_TITLE') {
      return res.status(400).json({
        error: 'Campaña sin título',
        message: 'La campaña debe tener un título antes de activarse'
      });
    }
    next(error);
  }
});

// Completar campaña
router.post('/:id/complete', requireRole(['parroco', 'coordinador', 'admin']), async (req, res, next) => {
  try {
    const result = await CampaignService.completeCampaign(
      req.params.id,
      req.tenantId,
      req.user
    );

    res.json({
      message: 'Campaña completada exitosamente',
      campaign: result.campaign.toJSON(),
      report: result.report
    });
  } catch (error) {
    if (error.message === 'CAMPAIGN_NOT_FOUND') {
      return res.status(404).json({
        error: 'Campaña no encontrada',
        message: 'La campaña especificada no existe'
      });
    }
    if (error.message === 'CAMPAIGN_NOT_ACTIVE') {
      return res.status(400).json({
        error: 'Campaña no activa',
        message: 'Solo se pueden completar campañas activas'
      });
    }
    next(error);
  }
});

// Cancelar campaña
router.post('/:id/cancel', requireRole(['parroco', 'coordinador', 'admin']), async (req, res, next) => {
  try {
    const { reason } = req.body;
    
    const campaign = await CampaignService.getCampaign(req.params.id, req.tenantId);
    await campaign.cancel(req.tenantId, reason);

    res.json({
      message: 'Campaña cancelada exitosamente',
      campaign: campaign.toJSON()
    });
  } catch (error) {
    if (error.message === 'CAMPAIGN_NOT_FOUND') {
      return res.status(404).json({
        error: 'Campaña no encontrada',
        message: 'La campaña especificada no existe'
      });
    }
    if (error.message === 'CAMPAIGN_ALREADY_COMPLETED') {
      return res.status(400).json({
        error: 'Campaña ya completada',
        message: 'No se puede cancelar una campaña completada'
      });
    }
    next(error);
  }
});

// Obtener progreso detallado de productos
router.get('/:id/progress', async (req, res, next) => {
  try {
    const campaign = await CampaignService.getCampaign(req.params.id, req.tenantId);
    const productProgress = campaign.getProductProgress();

    res.json({
      campaignId: campaign.id,
      title: campaign.title,
      status: campaign.status,
      completionPercentage: campaign.getCompletionPercentage(),
      daysRemaining: campaign.getDaysRemaining(),
      productProgress,
      urgentNeeds: CampaignService.getUrgentNeeds(campaign),
      impactMessage: CampaignService.generateImpactMessage(campaign)
    });
  } catch (error) {
    if (error.message === 'CAMPAIGN_NOT_FOUND') {
      return res.status(404).json({
        error: 'Campaña no encontrada',
        message: 'La campaña especificada no existe'
      });
    }
    next(error);
  }
});

// Obtener estadísticas de campaña
router.get('/:id/stats', async (req, res, next) => {
  try {
    const result = await CampaignService.getCampaignWithStats(req.params.id, req.tenantId);
    
    res.json({
      campaign: {
        id: result.campaign.id,
        title: result.campaign.title,
        status: result.campaign.status
      },
      stats: result.stats
    });
  } catch (error) {
    if (error.message === 'CAMPAIGN_NOT_FOUND') {
      return res.status(404).json({
        error: 'Campaña no encontrada',
        message: 'La campaña especificada no existe'
      });
    }
    next(error);
  }
});

// Obtener reporte de campaña (solo para campañas completadas)
router.get('/:id/report', requireRole(['parroco', 'coordinador', 'admin']), async (req, res, next) => {
  try {
    const campaign = await CampaignService.getCampaign(req.params.id, req.tenantId);
    
    if (campaign.status !== 'completed') {
      return res.status(400).json({
        error: 'Campaña no completada',
        message: 'Solo se pueden generar reportes de campañas completadas'
      });
    }

    const report = await CampaignService.generateCampaignReport(campaign, req.tenantId);
    
    res.json({
      message: 'Reporte de campaña generado',
      report
    });
  } catch (error) {
    if (error.message === 'CAMPAIGN_NOT_FOUND') {
      return res.status(404).json({
        error: 'Campaña no encontrada',
        message: 'La campaña especificada no existe'
      });
    }
    next(error);
  }
});

// Duplicar campaña (crear una nueva basada en una existente)
router.post('/:id/duplicate', requireRole(['parroco', 'coordinador', 'admin']), async (req, res, next) => {
  try {
    const originalCampaign = await CampaignService.getCampaign(req.params.id, req.tenantId);
    
    const duplicateData = {
      title: `${originalCampaign.title} (Copia)`,
      description: originalCampaign.description,
      goals: originalCampaign.goals,
      frequency: originalCampaign.frequency,
      targetFamilies: originalCampaign.targetFamilies
    };

    const newCampaign = await CampaignService.createCampaign(duplicateData, req.tenantId, req.user);

    res.status(201).json({
      message: 'Campaña duplicada exitosamente',
      original: { id: originalCampaign.id, title: originalCampaign.title },
      campaign: newCampaign.toJSON()
    });
  } catch (error) {
    if (error.message === 'CAMPAIGN_NOT_FOUND') {
      return res.status(404).json({
        error: 'Campaña no encontrada',
        message: 'La campaña especificada no existe'
      });
    }
    next(error);
  }
});

module.exports = router;