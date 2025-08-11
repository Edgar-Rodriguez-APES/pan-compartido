const express = require('express');
const CampaignJobs = require('../jobs/campaignJobs');
const { requireRole } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

// Obtener estadísticas de jobs (solo admins)
router.get('/stats', requireRole(['admin']), async (req, res, next) => {
  try {
    const stats = await CampaignJobs.getJobStats();
    
    res.json({
      message: 'Estadísticas de jobs de campañas',
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Ejecutar manualmente actualización de progreso
router.post('/run-progress-update', requireRole(['admin']), async (req, res, next) => {
  try {
    const updatedCount = await CampaignJobs.runProgressUpdateNow();
    
    res.json({
      message: 'Actualización de progreso ejecutada exitosamente',
      updatedCampaigns: updatedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error ejecutando actualización manual de progreso:', error);
    res.status(500).json({
      error: 'Error interno',
      message: 'No se pudo ejecutar la actualización de progreso'
    });
  }
});

// Ejecutar manualmente verificación de campañas expiradas
router.post('/run-expired-check', requireRole(['admin']), async (req, res, next) => {
  try {
    const completedCount = await CampaignJobs.runExpiredCheckNow();
    
    res.json({
      message: 'Verificación de campañas expiradas ejecutada exitosamente',
      completedCampaigns: completedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error ejecutando verificación manual de campañas expiradas:', error);
    res.status(500).json({
      error: 'Error interno',
      message: 'No se pudo ejecutar la verificación de campañas expiradas'
    });
  }
});

// Información sobre los jobs programados
router.get('/info', requireRole(['admin']), async (req, res, next) => {
  try {
    const jobsInfo = {
      progressUpdate: {
        description: 'Actualiza el progreso de todas las campañas activas',
        schedule: 'Cada 15 minutos',
        cron: '*/15 * * * *'
      },
      expiredCheck: {
        description: 'Verifica y completa campañas expiradas automáticamente',
        schedule: 'Cada hora',
        cron: '0 * * * *'
      },
      expirationReminders: {
        description: 'Envía recordatorios de campañas próximas a expirar',
        schedule: 'Diario a las 9:00 AM',
        cron: '0 9 * * *'
      },
      weeklyReports: {
        description: 'Genera reportes semanales de campañas',
        schedule: 'Lunes a las 8:00 AM',
        cron: '0 8 * * 1'
      }
    };

    res.json({
      message: 'Información de jobs de campañas',
      jobs: jobsInfo,
      timezone: 'America/Bogota',
      status: 'active'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;