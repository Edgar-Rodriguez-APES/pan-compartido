const cron = require('node-cron');
const CampaignService = require('../services/CampaignService');
const MessageTemplateService = require('../services/MessageTemplateService');
const logger = require('../utils/logger');
const db = require('../config/database');

class CampaignJobs {
  // Inicializar todos los jobs programados
  static init() {
    logger.info('Inicializando jobs de campañas...');

    // Actualizar progreso de campañas activas cada 15 minutos
    this.scheduleProgressUpdate();

    // Verificar campañas expiradas cada hora
    this.scheduleExpiredCampaignsCheck();

    // Enviar recordatorios de campañas próximas a expirar cada día a las 9 AM
    this.scheduleExpirationReminders();

    // Generar reportes semanales los lunes a las 8 AM
    this.scheduleWeeklyReports();

    logger.info('✅ Jobs de campañas inicializados correctamente');
  }

  // Actualizar progreso de campañas activas
  static scheduleProgressUpdate() {
    // Cada 15 minutos
    cron.schedule('*/15 * * * *', async () => {
      try {
        logger.info('Iniciando actualización de progreso de campañas activas...');
        
        const updatedCount = await CampaignService.updateAllActiveProgress();
        
        logger.info(`Progreso actualizado para ${updatedCount} campañas activas`);
      } catch (error) {
        logger.error('Error en job de actualización de progreso:', error);
      }
    }, {
      scheduled: true,
      timezone: "America/Bogota"
    });

    logger.info('📊 Job de actualización de progreso programado (cada 15 minutos)');
  }

  // Verificar y completar campañas expiradas
  static scheduleExpiredCampaignsCheck() {
    // Cada hora
    cron.schedule('0 * * * *', async () => {
      try {
        logger.info('Verificando campañas expiradas...');
        
        const completedCount = await CampaignService.checkExpiredCampaigns();
        
        if (completedCount > 0) {
          logger.info(`${completedCount} campañas expiradas completadas automáticamente`);
          
          // Enviar notificaciones a los administradores
          await this.notifyExpiredCampaigns(completedCount);
        }
      } catch (error) {
        logger.error('Error en job de verificación de campañas expiradas:', error);
      }
    }, {
      scheduled: true,
      timezone: "America/Bogota"
    });

    logger.info('⏰ Job de verificación de campañas expiradas programado (cada hora)');
  }

  // Enviar recordatorios de campañas próximas a expirar
  static scheduleExpirationReminders() {
    // Todos los días a las 9:00 AM
    cron.schedule('0 9 * * *', async () => {
      try {
        logger.info('Enviando recordatorios de campañas próximas a expirar...');
        
        await this.sendExpirationReminders();
        
        logger.info('Recordatorios de expiración enviados');
      } catch (error) {
        logger.error('Error en job de recordatorios de expiración:', error);
      }
    }, {
      scheduled: true,
      timezone: "America/Bogota"
    });

    logger.info('📅 Job de recordatorios de expiración programado (diario a las 9 AM)');
  }

  // Generar reportes semanales
  static scheduleWeeklyReports() {
    // Lunes a las 8:00 AM
    cron.schedule('0 8 * * 1', async () => {
      try {
        logger.info('Generando reportes semanales de campañas...');
        
        await this.generateWeeklyReports();
        
        logger.info('Reportes semanales generados');
      } catch (error) {
        logger.error('Error en job de reportes semanales:', error);
      }
    }, {
      scheduled: true,
      timezone: "America/Bogota"
    });

    logger.info('📈 Job de reportes semanales programado (lunes a las 8 AM)');
  }

  // Enviar notificaciones sobre campañas expiradas
  static async notifyExpiredCampaigns(count) {
    try {
      // Obtener todos los tenants con campañas expiradas
      const tenantsWithExpired = await db('campaigns')
        .join('tenants', 'campaigns.tenant_id', 'tenants.id')
        .where('campaigns.status', 'completed')
        .whereRaw('campaigns.updated_at > NOW() - INTERVAL \'1 hour\'')
        .select('tenants.id', 'tenants.name')
        .groupBy('tenants.id', 'tenants.name');

      for (const tenant of tenantsWithExpired) {
        // Obtener administradores del tenant
        const admins = await db('users')
          .where('tenant_id', tenant.id)
          .whereIn('role', ['parroco', 'admin'])
          .where('is_active', true);

        // Enviar notificación a cada administrador
        for (const admin of admins) {
          await this.sendExpiredCampaignNotification(admin, tenant, count);
        }
      }
    } catch (error) {
      logger.error('Error enviando notificaciones de campañas expiradas:', error);
    }
  }

  // Enviar recordatorios de campañas próximas a expirar
  static async sendExpirationReminders() {
    try {
      // Buscar campañas que expiran en 1-3 días
      const expiringCampaigns = await db('campaigns')
        .join('tenants', 'campaigns.tenant_id', 'tenants.id')
        .where('campaigns.status', 'active')
        .whereRaw('campaigns.end_date BETWEEN NOW() + INTERVAL \'1 day\' AND NOW() + INTERVAL \'3 days\'')
        .select(
          'campaigns.*',
          'tenants.name as tenant_name'
        );

      for (const campaign of expiringCampaigns) {
        // Obtener administradores del tenant
        const admins = await db('users')
          .where('tenant_id', campaign.tenant_id)
          .whereIn('role', ['coordinador', 'parroco', 'admin'])
          .where('is_active', true);

        // Calcular días restantes
        const daysRemaining = Math.ceil((new Date(campaign.end_date) - new Date()) / (1000 * 60 * 60 * 24));

        // Enviar recordatorio a cada administrador
        for (const admin of admins) {
          await this.sendExpirationReminder(admin, campaign, daysRemaining);
        }
      }
    } catch (error) {
      logger.error('Error enviando recordatorios de expiración:', error);
    }
  }

  // Generar reportes semanales
  static async generateWeeklyReports() {
    try {
      // Obtener todos los tenants activos
      const tenants = await db('tenants')
        .where('is_active', true)
        .select('*');

      for (const tenant of tenants) {
        await this.generateTenantWeeklyReport(tenant);
      }
    } catch (error) {
      logger.error('Error generando reportes semanales:', error);
    }
  }

  // Generar reporte semanal para un tenant específico
  static async generateTenantWeeklyReport(tenant) {
    try {
      // Obtener estadísticas de la semana pasada
      const weeklyStats = await db('campaigns')
        .where('tenant_id', tenant.id)
        .whereRaw('created_at >= NOW() - INTERVAL \'7 days\'')
        .select(
          db.raw('COUNT(*) as campaigns_created'),
          db.raw('SUM(raised_amount) as total_raised'),
          db.raw('SUM(target_families) as families_targeted')
        )
        .first();

      // Obtener campañas completadas esta semana
      const completedCampaigns = await db('campaigns')
        .where('tenant_id', tenant.id)
        .where('status', 'completed')
        .whereRaw('updated_at >= NOW() - INTERVAL \'7 days\'')
        .select('title', 'raised_amount', 'target_amount');

      // Obtener administradores para enviar el reporte
      const admins = await db('users')
        .where('tenant_id', tenant.id)
        .whereIn('role', ['parroco', 'admin'])
        .where('is_active', true);

      // Enviar reporte a cada administrador
      for (const admin of admins) {
        await this.sendWeeklyReport(admin, tenant, weeklyStats, completedCampaigns);
      }

      logger.info(`Reporte semanal generado para ${tenant.name}`, {
        tenantId: tenant.id,
        campaignsCreated: weeklyStats.campaigns_created,
        totalRaised: weeklyStats.total_raised
      });
    } catch (error) {
      logger.error(`Error generando reporte semanal para tenant ${tenant.id}:`, error);
    }
  }

  // Enviar notificación de campaña expirada
  static async sendExpiredCampaignNotification(admin, tenant, count) {
    try {
      // Aquí se integraría con el servicio de notificaciones
      // Por ahora solo loggeamos
      logger.info('Notificación de campaña expirada', {
        adminId: admin.id,
        adminEmail: admin.email,
        tenantName: tenant.name,
        expiredCount: count
      });

      // TODO: Integrar con servicio de email/WhatsApp
      // await NotificationService.sendExpiredCampaignNotification(admin, tenant, count);
    } catch (error) {
      logger.error('Error enviando notificación de campaña expirada:', error);
    }
  }

  // Enviar recordatorio de expiración
  static async sendExpirationReminder(admin, campaign, daysRemaining) {
    try {
      logger.info('Recordatorio de expiración enviado', {
        adminId: admin.id,
        campaignId: campaign.id,
        campaignTitle: campaign.title,
        daysRemaining
      });

      // TODO: Integrar con servicio de notificaciones
      // await NotificationService.sendExpirationReminder(admin, campaign, daysRemaining);
    } catch (error) {
      logger.error('Error enviando recordatorio de expiración:', error);
    }
  }

  // Enviar reporte semanal
  static async sendWeeklyReport(admin, tenant, stats, completedCampaigns) {
    try {
      logger.info('Reporte semanal enviado', {
        adminId: admin.id,
        tenantId: tenant.id,
        stats
      });

      // TODO: Integrar con servicio de email
      // await EmailService.sendWeeklyReport(admin, tenant, stats, completedCampaigns);
    } catch (error) {
      logger.error('Error enviando reporte semanal:', error);
    }
  }

  // Obtener estadísticas de rendimiento de jobs
  static async getJobStats() {
    try {
      const stats = {
        lastProgressUpdate: await this.getLastJobExecution('progress_update'),
        lastExpiredCheck: await this.getLastJobExecution('expired_check'),
        lastReminderSent: await this.getLastJobExecution('reminder_sent'),
        lastWeeklyReport: await this.getLastJobExecution('weekly_report')
      };

      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas de jobs:', error);
      return null;
    }
  }

  // Obtener última ejecución de un job (esto requeriría una tabla de logs)
  static async getLastJobExecution(jobType) {
    try {
      // TODO: Implementar tabla de logs de jobs si es necesario
      return new Date().toISOString();
    } catch (error) {
      logger.error(`Error obteniendo última ejecución de ${jobType}:`, error);
      return null;
    }
  }

  // Ejecutar manualmente actualización de progreso
  static async runProgressUpdateNow() {
    try {
      logger.info('Ejecutando actualización manual de progreso...');
      const updatedCount = await CampaignService.updateAllActiveProgress();
      logger.info(`Actualización manual completada: ${updatedCount} campañas actualizadas`);
      return updatedCount;
    } catch (error) {
      logger.error('Error en actualización manual de progreso:', error);
      throw error;
    }
  }

  // Ejecutar manualmente verificación de campañas expiradas
  static async runExpiredCheckNow() {
    try {
      logger.info('Ejecutando verificación manual de campañas expiradas...');
      const completedCount = await CampaignService.checkExpiredCampaigns();
      logger.info(`Verificación manual completada: ${completedCount} campañas completadas`);
      return completedCount;
    } catch (error) {
      logger.error('Error en verificación manual de campañas expiradas:', error);
      throw error;
    }
  }
}

module.exports = CampaignJobs;