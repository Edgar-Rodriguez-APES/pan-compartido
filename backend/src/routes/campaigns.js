const express = require('express');
const Joi = require('joi');
const CampaignService = require('../services/CampaignService');
const { requireRole } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

// Esquemas de validación
const createCampaignSchema = Joi.object({
  title: Joi.string().min(3).max(200).required(),
  description: Joi.string().max(1000).required(),
  goals: Joi.object().pattern(
    Joi.string(),
    Joi.object({
      needed: Joi.number().positive().required(),
      unit: Joi.string().required()
    })
  ).required(),
  frequency: Joi.string().valid('weekly', 'biweekly', 'monthly').default('weekly'),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).required(),
  targetAmount: Joi.number().positive().optional(),
  targetFamilies: Joi.number().integer().positive().optional()
});

const updateCampaignSchema = Joi.object({
  title: Joi.string().min(3).max(200).optional(),
  description: Joi.string().max(1000).optional(),
  goals: Joi.object().pattern(
    Joi.string(),
    Joi.object({
      needed: Joi.number().positive().required(),
      unit: Joi.string().required()
    })
  ).optional(),
  frequency: Joi.string().valid('weekly', 'biweekly', 'monthly').optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  targetAmount: Joi.number().positive().optional(),
  targetFamilies: Joi.number().integer().positive().optional()
});

// Listar campañas del tenant
router.get('/', async (req, res, next) => {
  try {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      status: req.query.status || null,
      frequency: req.query.frequency || null,
      search: req.query.search || null,
      orderBy: req.query.orderBy || 'created_at',
      orderDirection: req.query.orderDirection || 'desc',
      includeStats: req.query.includeStats === 'true'
    };

    const result = await CampaignService.listTenantCampaigns(
      req.tenantId,
      options,
      req.userId
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Obtener campañas activas
router.get('/active', async (req, res, next) => {
  try {
    const campaigns = await CampaignService.getActiveCampaigns(
      req.tenantId,
      req.userId
    );

    res.json({ campaigns });
  } catch (error) {
    next(error);
  }
});

// Obtener estadísticas generales de campañas
router.get('/statistics', requireRole(['coordinador', 'parroco', 'admin']), async (req, res, next) => {
  try {
    const stats = await CampaignService.getCampaignStatistics(
      req.tenantId,
      req.userId
    );

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Crear nueva campaña
router.post('/', requireRole(['coordinador', 'parroco', 'admin']), async (req, res, next) => {
  try {
    const { error, value } = createCampaignSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const campaign = await CampaignService.createCampaign(
      { ...value, tenantId: req.tenantId },
      req.userId
    );

    res.status(201).json({
      message: 'Campaña creada exitosamente',
      campaign: campaign.toJSON()
    });
  } catch (error) {
    if (error.message === 'INSUFFICIENT_PERMISSIONS') {
      return res.status(403).json({
        error: 'Permisos insuficientes',
        message: 'No tienes permisos para crear campañas'
      });
    }
    if (error.message === 'INVALID_DATE_RANGE') {
      return res.status(400).json({
        error: 'Rango de fechas inválido',
        message: 'La fecha de fin debe ser posterior a la fecha de inicio'
      });
    }
    if (error.message === 'END_DATE_IN_PAST') {
      return res.status(400).json({
        error: 'Fecha de fin inválida',
        message: 'La fecha de fin no puede estar en el pasado'
      });
    }
    if (error.message === 'GOALS_REQUIRED') {
      return res.status(400).json({
        error: 'Objetivos requeridos',
        message: 'Debes definir al menos un objetivo para la campaña'
      });
    }
    next(error);
  }
});

// Obtener campaña específica
router.get('/:campaignId', async (req, res, next) => {
  try {
    const result = await CampaignService.getCampaignWithStats(
      req.params.campaignId,
      req.userId
    );

    res.json(result);
  } catch (error) {
    if (error.message === 'CAMPAIGN_NOT_FOUND') {
      return res.status(404).json({
        error: 'Campaña no encontrada',
        message: 'La campaña especificada no existe'
      });
    }
    if (error.message === 'CROSS_TENANT_ACCESS_DENIED') {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tienes acceso a esta campaña'
      });
    }
    next(error);
  }
});

// Actualizar campaña
router.put('/:campaignId', requireRole(['coordinador', 'parroco', 'admin']), async (req, res, next) => {
  try {
    const { error, value } = updateCampaignSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const campaign = await CampaignService.updateCampaign(
      req.params.campaignId,
      value,
      req.userId
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
    if (error.message === 'CANNOT_EDIT_COMPLETED_CAMPAIGN') {
      return res.status(400).json({
        error: 'Campaña completada',
        message: 'No se puede editar una campaña que ya está completada'
      });
    }
    if (error.message === 'CANNOT_CHANGE_START_DATE_ACTIVE_CAMPAIGN') {
      return res.status(400).json({
        error: 'Campaña activa',
        message: 'No se puede cambiar la fecha de inicio de una campaña activa'
      });
    }
    next(error);
  }
});

// Activar campaña
router.post('/:campaignId/activate', requireRole(['coordinador', 'parroco', 'admin']), async (req, res, next) => {
  try {
    const campaign = await CampaignService.activateCampaign(
      req.params.campaignId,
      req.userId
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
    if (error.message === 'CAMPAIGN_NOT_IN_DRAFT_STATUS') {
      return res.status(400).json({
        error: 'Estado inválido',
        message: 'Solo se pueden activar campañas en estado borrador'
      });
    }
    if (error.message === 'CAMPAIGN_MISSING_GOALS') {
      return res.status(400).json({
        error: 'Objetivos faltantes',
        message: 'La campaña debe tener objetivos definidos antes de activarse'
      });
    }
    if (error.message === 'CAMPAIGN_END_DATE_PASSED') {
      return res.status(400).json({
        error: 'Fecha expirada',
        message: 'No se puede activar una campaña cuya fecha de fin ya pasó'
      });
    }
    next(error);
  }
});

// Completar campaña
router.post('/:campaignId/complete', requireRole(['coordinador', 'parroco', 'admin']), async (req, res, next) => {
  try {
    const campaign = await CampaignService.completeCampaign(
      req.params.campaignId,
      req.userId
    );

    res.json({
      message: 'Campaña completada exitosamente',
      campaign: campaign.toJSON()
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
router.post('/:campaignId/cancel', requireRole(['parroco', 'admin']), async (req, res, next) => {
  try {
    const { reason } = req.body;

    const campaign = await CampaignService.cancelCampaign(
      req.params.campaignId,
      req.userId,
      reason
    );

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
    if (error.message === 'CANNOT_CANCEL_COMPLETED_CAMPAIGN') {
      return res.status(400).json({
        error: 'Campaña completada',
        message: 'No se puede cancelar una campaña completada'
      });
    }
    next(error);
  }
});

// Obtener donaciones de una campaña
router.get('/:campaignId/donations', requireRole(['coordinador', 'parroco', 'admin']), async (req, res, next) => {
  try {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      status: req.query.status || null,
      orderBy: req.query.orderBy || 'created_at',
      orderDirection: req.query.orderDirection || 'desc'
    };

    const result = await CampaignService.getCampaignDonations(
      req.params.campaignId,
      options,
      req.userId
    );

    res.json(result);
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

// Actualizar progreso de campaña manualmente
router.post('/:campaignId/update-progress', requireRole(['coordinador', 'parroco', 'admin']), async (req, res, next) => {
  try {
    const campaign = await CampaignService.getCampaign(req.params.campaignId, req.userId);
    await campaign.updateProgress();

    const stats = await campaign.getStats();

    res.json({
      message: 'Progreso actualizado exitosamente',
      campaign: campaign.toJSON(),
      stats
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