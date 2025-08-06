const Campaign = require('../models/Campaign');
const User = require('../models/User');
const TenantService = require('./TenantService');
const logger = require('../utils/logger');
const { cache } = require('../config/redis');

class CampaignService {
  // Crear nueva campaña
  static async createCampaign(campaignData, createdBy) {
    try {
      // Verificar que el usuario tenga permisos para crear campañas
      const user = await User.findById(createdBy);
      if (!user || !user.hasAnyRole(['coordinador', 'parroco', 'admin'])) {
        throw new Error('INSUFFICIENT_PERMISSIONS');
      }

      // Verificar que el tenant existe
      await TenantService.getTenant(campaignData.tenantId);

      // Validar fechas
      const startDate = new Date(campaignData.startDate);
      const endDate = new Date(campaignData.endDate);
      
      if (startDate >= endDate) {
        throw new Error('INVALID_DATE_RANGE');
      }

      if (endDate <= new Date()) {
        throw new Error('END_DATE_IN_PAST');
      }

      // Validar objetivos
      if (campaignData.goals && Object.keys(campaignData.goals).length === 0) {
        throw new Error('GOALS_REQUIRED');
      }

      // Crear campaña
      const campaign = await Campaign.create({
        ...campaignData,
        createdBy
      });

      logger.info('Campaña creada por servicio', {
        campaignId: campaign.id,
        title: campaign.title,
        createdBy,
        tenantId: campaignData.tenantId
      });

      return campaign;
    } catch (error) {
      logger.error('Error en CampaignService.createCampaign:', error);
      throw error;
    }
  }

  // Obtener campaña con validaciones
  static async getCampaign(campaignId, userId = null) {
    try {
      const campaign = await Campaign.findById(campaignId);
      
      if (!campaign) {
        throw new Error('CAMPAIGN_NOT_FOUND');
      }

      // Si hay usuario, verificar que pertenezca al mismo tenant
      if (userId) {
        const user = await User.findById(userId);
        if (user && user.tenantId !== campaign.tenantId) {
          throw new Error('CROSS_TENANT_ACCESS_DENIED');
        }
      }

      return campaign;
    } catch (error) {
      logger.error('Error en CampaignService.getCampaign:', error);
      throw error;
    }
  }

  // Obtener campaña con estadísticas
  static async getCampaignWithStats(campaignId, userId = null) {
    try {
      const campaign = await this.getCampaign(campaignId, userId);
      const stats = await campaign.getStats();

      return {
        campaign: campaign.toJSON(),
        stats
      };
    } catch (error) {
      logger.error('Error en CampaignService.getCampaignWithStats:', error);
      throw error;
    }
  }

  // Listar campañas de un tenant
  static async listTenantCampaigns(tenantId, options = {}, userId = null) {
    try {
      // Verificar acceso del usuario si se proporciona
      if (userId) {
        const user = await User.findById(userId);
        if (!user || user.tenantId !== tenantId) {
          throw new Error('CROSS_TENANT_ACCESS_DENIED');
        }
      }

      const result = await Campaign.findByTenant(tenantId, options);

      logger.info('Campañas listadas', {
        tenantId,
        requestedBy: userId,
        page: options.page || 1,
        total: result.pagination.total
      });

      return result;
    } catch (error) {
      logger.error('Error en CampaignService.listTenantCampaigns:', error);
      throw error;
    }
  }

  // Obtener campañas activas
  static async getActiveCampaigns(tenantId, userId = null) {
    try {
      // Verificar acceso del usuario si se proporciona
      if (userId) {
        const user = await User.findById(userId);
        if (!user || user.tenantId !== tenantId) {
          throw new Error('CROSS_TENANT_ACCESS_DENIED');
        }
      }

      const campaigns = await Campaign.findActiveCampaigns(tenantId);

      // Agregar estadísticas a cada campaña
      for (let campaign of campaigns) {
        campaign.stats = await campaign.getStats();
      }

      return campaigns;
    } catch (error) {
      logger.error('Error en CampaignService.getActiveCampaigns:', error);
      throw error;
    }
  }

  // Actualizar campaña
  static async updateCampaign(campaignId, updateData, updatedBy) {
    try {
      const campaign = await Campaign.findById(campaignId);
      
      if (!campaign) {
        throw new Error('CAMPAIGN_NOT_FOUND');
      }

      // Verificar permisos del usuario
      const user = await User.findById(updatedBy);
      if (!user || user.tenantId !== campaign.tenantId) {
        throw new Error('CROSS_TENANT_ACCESS_DENIED');
      }

      if (!user.hasAnyRole(['coordinador', 'parroco', 'admin'])) {
        throw new Error('INSUFFICIENT_PERMISSIONS');
      }

      // Validar que no se pueda editar una campaña completada
      if (campaign.status === 'completed') {
        throw new Error('CANNOT_EDIT_COMPLETED_CAMPAIGN');
      }

      // Validar fechas si se actualizan
      if (updateData.startDate || updateData.endDate) {
        const startDate = new Date(updateData.startDate || campaign.startDate);
        const endDate = new Date(updateData.endDate || campaign.endDate);
        
        if (startDate >= endDate) {
          throw new Error('INVALID_DATE_RANGE');
        }

        // No permitir cambiar fecha de inicio si la campaña ya está activa
        if (campaign.status === 'active' && updateData.startDate) {
          throw new Error('CANNOT_CHANGE_START_DATE_ACTIVE_CAMPAIGN');
        }
      }

      await campaign.update(updateData);

      logger.info('Campaña actualizada por servicio', {
        campaignId: campaign.id,
        updatedBy,
        changes: Object.keys(updateData)
      });

      return campaign;
    } catch (error) {
      logger.error('Error en CampaignService.updateCampaign:', error);
      throw error;
    }
  }

  // Activar campaña
  static async activateCampaign(campaignId, activatedBy) {
    try {
      const campaign = await Campaign.findById(campaignId);
      
      if (!campaign) {
        throw new Error('CAMPAIGN_NOT_FOUND');
      }

      // Verificar permisos
      const user = await User.findById(activatedBy);
      if (!user || user.tenantId !== campaign.tenantId) {
        throw new Error('CROSS_TENANT_ACCESS_DENIED');
      }

      if (!user.hasAnyRole(['coordinador', 'parroco', 'admin'])) {
        throw new Error('INSUFFICIENT_PERMISSIONS');
      }

      // Verificar que la campaña esté en estado draft
      if (campaign.status !== 'draft') {
        throw new Error('CAMPAIGN_NOT_IN_DRAFT_STATUS');
      }

      // Verificar que tenga objetivos definidos
      if (!campaign.goals || Object.keys(campaign.goals).length === 0) {
        throw new Error('CAMPAIGN_MISSING_GOALS');
      }

      // Verificar fechas
      const now = new Date();
      const startDate = new Date(campaign.startDate);
      const endDate = new Date(campaign.endDate);

      if (endDate <= now) {
        throw new Error('CAMPAIGN_END_DATE_PASSED');
      }

      await campaign.update({ status: 'active' });

      logger.info('Campaña activada', {
        campaignId: campaign.id,
        title: campaign.title,
        activatedBy
      });

      return campaign;
    } catch (error) {
      logger.error('Error en CampaignService.activateCampaign:', error);
      throw error;
    }
  }

  // Completar campaña
  static async completeCampaign(campaignId, completedBy) {
    try {
      const campaign = await Campaign.findById(campaignId);
      
      if (!campaign) {
        throw new Error('CAMPAIGN_NOT_FOUND');
      }

      // Verificar permisos
      const user = await User.findById(completedBy);
      if (!user || user.tenantId !== campaign.tenantId) {
        throw new Error('CROSS_TENANT_ACCESS_DENIED');
      }

      if (!user.hasAnyRole(['coordinador', 'parroco', 'admin'])) {
        throw new Error('INSUFFICIENT_PERMISSIONS');
      }

      // Verificar que la campaña esté activa
      if (campaign.status !== 'active') {
        throw new Error('CAMPAIGN_NOT_ACTIVE');
      }

      // Actualizar progreso final
      await campaign.updateProgress();

      // Marcar como completada
      await campaign.markAsCompleted();

      logger.info('Campaña completada', {
        campaignId: campaign.id,
        title: campaign.title,
        completedBy,
        finalAmount: campaign.raisedAmount
      });

      return campaign;
    } catch (error) {
      logger.error('Error en CampaignService.completeCampaign:', error);
      throw error;
    }
  }

  // Cancelar campaña
  static async cancelCampaign(campaignId, cancelledBy, reason = null) {
    try {
      const campaign = await Campaign.findById(campaignId);
      
      if (!campaign) {
        throw new Error('CAMPAIGN_NOT_FOUND');
      }

      // Verificar permisos
      const user = await User.findById(cancelledBy);
      if (!user || user.tenantId !== campaign.tenantId) {
        throw new Error('CROSS_TENANT_ACCESS_DENIED');
      }

      if (!user.hasAnyRole(['parroco', 'admin'])) {
        throw new Error('INSUFFICIENT_PERMISSIONS');
      }

      // No permitir cancelar campañas completadas
      if (campaign.status === 'completed') {
        throw new Error('CANNOT_CANCEL_COMPLETED_CAMPAIGN');
      }

      await campaign.update({ 
        status: 'cancelled',
        description: campaign.description + (reason ? `\n\nCancelada: ${reason}` : '\n\nCampaña cancelada')
      });

      logger.info('Campaña cancelada', {
        campaignId: campaign.id,
        title: campaign.title,
        cancelledBy,
        reason
      });

      return campaign;
    } catch (error) {
      logger.error('Error en CampaignService.cancelCampaign:', error);
      throw error;
    }
  }

  // Obtener donaciones de una campaña
  static async getCampaignDonations(campaignId, options = {}, userId) {
    try {
      const campaign = await this.getCampaign(campaignId, userId);
      const result = await campaign.getDonations(options);

      return result;
    } catch (error) {
      logger.error('Error en CampaignService.getCampaignDonations:', error);
      throw error;
    }
  }

  // Actualizar progreso de todas las campañas activas
  static async updateAllActiveProgress(tenantId = null) {
    try {
      let query = db('campaigns').where('status', 'active');
      
      if (tenantId) {
        query = query.where('tenant_id', tenantId);
      }

      const activeCampaigns = await query;

      for (let campaignData of activeCampaigns) {
        const campaign = new Campaign(campaignData);
        await campaign.updateProgress();
      }

      logger.info('Progreso actualizado para campañas activas', {
        tenantId,
        campaignsUpdated: activeCampaigns.length
      });

      return activeCampaigns.length;
    } catch (error) {
      logger.error('Error actualizando progreso de campañas activas:', error);
      throw error;
    }
  }

  // Verificar y completar campañas expiradas
  static async checkExpiredCampaigns(tenantId = null) {
    try {
      const db = require('../config/database');
      let query = db('campaigns')
        .where('status', 'active')
        .where('end_date', '<', new Date());
      
      if (tenantId) {
        query = query.where('tenant_id', tenantId);
      }

      const expiredCampaigns = await query;

      for (let campaignData of expiredCampaigns) {
        const campaign = new Campaign(campaignData);
        await campaign.updateProgress();
        await campaign.markAsCompleted();
      }

      logger.info('Campañas expiradas completadas automáticamente', {
        tenantId,
        campaignsCompleted: expiredCampaigns.length
      });

      return expiredCampaigns.length;
    } catch (error) {
      logger.error('Error verificando campañas expiradas:', error);
      throw error;
    }
  }

  // Obtener estadísticas generales de campañas
  static async getCampaignStatistics(tenantId, userId) {
    try {
      // Verificar acceso
      const user = await User.findById(userId);
      if (!user || user.tenantId !== tenantId) {
        throw new Error('CROSS_TENANT_ACCESS_DENIED');
      }

      const cacheKey = `campaign_stats:${tenantId}`;
      let stats = await cache.get(cacheKey);

      if (!stats) {
        const db = require('../config/database');
        
        const [
          totalStats,
          statusStats,
          monthlyStats
        ] = await Promise.all([
          // Estadísticas totales
          db('campaigns')
            .where('tenant_id', tenantId)
            .select(
              db.raw('COUNT(*) as total_campaigns'),
              db.raw('SUM(raised_amount) as total_raised'),
              db.raw('SUM(target_amount) as total_target'),
              db.raw('SUM(helped_families) as total_families_helped')
            )
            .first(),

          // Estadísticas por estado
          db('campaigns')
            .where('tenant_id', tenantId)
            .select('status')
            .count('* as count')
            .groupBy('status'),

          // Estadísticas del mes actual
          db('campaigns')
            .where('tenant_id', tenantId)
            .whereRaw('EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)')
            .whereRaw('EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)')
            .select(
              db.raw('COUNT(*) as campaigns_this_month'),
              db.raw('SUM(raised_amount) as raised_this_month')
            )
            .first()
        ]);

        stats = {
          total: {
            campaigns: parseInt(totalStats.total_campaigns) || 0,
            raised: parseFloat(totalStats.total_raised) || 0,
            target: parseFloat(totalStats.total_target) || 0,
            familiesHelped: parseInt(totalStats.total_families_helped) || 0,
            successRate: totalStats.total_target > 0 ? 
              (parseFloat(totalStats.total_raised) / parseFloat(totalStats.total_target)) * 100 : 0
          },
          byStatus: statusStats.reduce((acc, stat) => {
            acc[stat.status] = parseInt(stat.count);
            return acc;
          }, {}),
          thisMonth: {
            campaigns: parseInt(monthlyStats.campaigns_this_month) || 0,
            raised: parseFloat(monthlyStats.raised_this_month) || 0
          }
        };

        // Guardar en cache por 30 minutos
        await cache.set(cacheKey, stats, 1800);
      }

      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas de campañas:', error);
      throw error;
    }
  }

  // Limpiar cache de campañas
  static async clearCampaignCache(tenantId) {
    try {
      const cacheKeys = [
        `active_campaigns:${tenantId}`,
        `campaign_stats:${tenantId}`
      ];

      await Promise.all(cacheKeys.map(key => cache.del(key)));

      logger.info('Cache de campañas limpiado', { tenantId });
    } catch (error) {
      logger.error('Error limpiando cache de campañas:', error);
    }
  }
}

module.exports = CampaignService;