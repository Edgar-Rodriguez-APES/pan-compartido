const Campaign = require('../models/Campaign');
const { createTenantQuery } = require('../utils/tenantQuery');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

class CampaignService {
  // Crear nueva campaña con validaciones
  static async createCampaign(data, tenantId, createdBy) {
    try {
      // Validar que no haya campañas activas conflictivas
      await this.validateCampaignCreation(data, tenantId);

      // Enriquecer datos con información del creador
      const campaignData = {
        ...data,
        createdBy: createdBy.id
      };

      const campaign = await Campaign.create(campaignData, tenantId);

      logger.info('Campaña creada por servicio', {
        campaignId: campaign.id,
        tenantId,
        title: campaign.title,
        createdBy: createdBy.id
      });

      return campaign;
    } catch (error) {
      logger.error('Error en CampaignService.createCampaign:', error);
      throw error;
    }
  }

  // Obtener campaña con validaciones de acceso
  static async getCampaign(campaignId, tenantId, userId = null) {
    try {
      const campaign = await Campaign.findById(campaignId, tenantId);
      
      if (!campaign) {
        throw new Error('CAMPAIGN_NOT_FOUND');
      }

      // Verificar acceso si se proporciona userId
      if (userId) {
        await this.validateUserAccess(campaign, userId, tenantId);
      }

      return campaign;
    } catch (error) {
      logger.error('Error en CampaignService.getCampaign:', error);
      throw error;
    }
  }

  // Obtener campaña con estadísticas
  static async getCampaignWithStats(campaignId, tenantId) {
    try {
      const campaign = await this.getCampaign(campaignId, tenantId);
      const stats = await campaign.getStats(tenantId);

      return {
        campaign: campaign.toJSON(),
        stats
      };
    } catch (error) {
      logger.error('Error en CampaignService.getCampaignWithStats:', error);
      throw error;
    }
  }

  // Listar campañas con filtros avanzados
  static async listCampaigns(tenantId, options = {}) {
    try {
      const result = await Campaign.findByTenant(tenantId, options);
      
      // Enriquecer con información adicional si es necesario
      const enrichedCampaigns = await Promise.all(
        result.campaigns.map(async (campaign) => {
          const campaignJson = campaign.toJSON();
          
          // Agregar información del creador si es necesario
          if (options.includeCreator && campaign.createdBy) {
            const tenantQuery = createTenantQuery(tenantId);
            const creator = await tenantQuery.findById('users', campaign.createdBy);
            campaignJson.creator = creator ? {
              id: creator.id,
              name: creator.name,
              role: creator.role
            } : null;
          }

          return campaignJson;
        })
      );

      logger.info('Campañas listadas', {
        tenantId,
        page: options.page || 1,
        total: result.pagination.total,
        filters: Object.keys(options).filter(key => options[key] !== null && options[key] !== undefined)
      });

      return {
        campaigns: enrichedCampaigns,
        pagination: result.pagination
      };
    } catch (error) {
      logger.error('Error en CampaignService.listCampaigns:', error);
      throw error;
    }
  }

  // Obtener campañas activas para feligreses
  static async getActiveCampaigns(tenantId) {
    try {
      const campaigns = await Campaign.getActiveCampaigns(tenantId);
      
      return campaigns.map(campaign => {
        const campaignJson = campaign.toJSON();
        
        // Agregar información útil para feligreses
        campaignJson.urgentNeeds = this.getUrgentNeeds(campaign);
        campaignJson.impactMessage = this.generateImpactMessage(campaign);
        
        return campaignJson;
      });
    } catch (error) {
      logger.error('Error en CampaignService.getActiveCampaigns:', error);
      throw error;
    }
  }

  // Actualizar campaña con validaciones
  static async updateCampaign(campaignId, data, tenantId, updatedBy) {
    try {
      const campaign = await this.getCampaign(campaignId, tenantId);

      // Validar permisos de actualización
      await this.validateUpdatePermissions(campaign, updatedBy, tenantId);

      // Validar cambios específicos
      await this.validateCampaignUpdate(campaign, data, tenantId);

      await campaign.update(data, tenantId);

      logger.info('Campaña actualizada por servicio', {
        campaignId: campaign.id,
        tenantId,
        updatedBy: updatedBy.id,
        changes: Object.keys(data)
      });

      return campaign;
    } catch (error) {
      logger.error('Error en CampaignService.updateCampaign:', error);
      throw error;
    }
  }

  // Activar campaña
  static async activateCampaign(campaignId, tenantId, activatedBy) {
    try {
      const campaign = await this.getCampaign(campaignId, tenantId);

      // Validar que el usuario puede activar campañas
      if (!activatedBy.hasAnyRole(['parroco', 'coordinador', 'admin'])) {
        throw new Error('INSUFFICIENT_PERMISSIONS');
      }

      // Validar que la campaña puede ser activada
      await this.validateCampaignActivation(campaign, tenantId);

      await campaign.activate(tenantId);

      // Enviar notificaciones (implementar después)
      await this.sendCampaignNotifications(campaign, 'activated', tenantId);

      logger.info('Campaña activada por servicio', {
        campaignId: campaign.id,
        tenantId,
        activatedBy: activatedBy.id
      });

      return campaign;
    } catch (error) {
      logger.error('Error en CampaignService.activateCampaign:', error);
      throw error;
    }
  }

  // Completar campaña
  static async completeCampaign(campaignId, tenantId, completedBy) {
    try {
      const campaign = await this.getCampaign(campaignId, tenantId);

      // Validar permisos
      if (!completedBy.hasAnyRole(['parroco', 'coordinador', 'admin'])) {
        throw new Error('INSUFFICIENT_PERMISSIONS');
      }

      await campaign.complete(tenantId);

      // Generar reporte final
      const finalReport = await this.generateCampaignReport(campaign, tenantId);

      // Enviar notificaciones de completación
      await this.sendCampaignNotifications(campaign, 'completed', tenantId);

      logger.info('Campaña completada por servicio', {
        campaignId: campaign.id,
        tenantId,
        completedBy: completedBy.id,
        finalStats: finalReport.summary
      });

      return { campaign, report: finalReport };
    } catch (error) {
      logger.error('Error en CampaignService.completeCampaign:', error);
      throw error;
    }
  }

  // Procesar donación y actualizar progreso
  static async processDonation(campaignId, donationData, tenantId) {
    try {
      const campaign = await this.getCampaign(campaignId, tenantId);

      if (!campaign.isActive()) {
        throw new Error('CAMPAIGN_NOT_ACTIVE');
      }

      // Actualizar progreso por cada producto donado
      for (const item of donationData.items) {
        await campaign.updateProgress(
          item.product_id,
          item.quantity,
          item.unit,
          tenantId
        );
      }

      // Verificar si se alcanzaron hitos importantes
      await this.checkMilestones(campaign, tenantId);

      logger.info('Donación procesada para campaña', {
        campaignId: campaign.id,
        tenantId,
        items: donationData.items.length,
        newProgress: campaign.getCompletionPercentage()
      });

      return campaign;
    } catch (error) {
      logger.error('Error en CampaignService.processDonation:', error);
      throw error;
    }
  }

  // Obtener dashboard de campañas para párrocos
  static async getCampaignDashboard(tenantId) {
    try {
      const cacheKey = `dashboard:campaigns:${tenantId}`;
      let dashboard = await cache.get(cacheKey);

      if (!dashboard) {
        const tenantQuery = createTenantQuery(tenantId);

        const [
          activeCampaigns,
          totalCampaigns,
          completedCampaigns,
          totalRaised,
          totalFamiliesHelped
        ] = await Promise.all([
          Campaign.getActiveCampaigns(tenantId),
          tenantQuery.count('campaigns'),
          tenantQuery.count('campaigns', { status: 'completed' }),
          tenantQuery.table('campaigns')
            .sum('raised_amount as total')
            .where('status', 'completed')
            .first(),
          tenantQuery.table('campaigns')
            .sum('helped_families as total')
            .where('status', 'completed')
            .first()
        ]);

        // Calcular métricas
        const activeCount = activeCampaigns.length;
        const completionRate = totalCampaigns > 0 ? (completedCampaigns / totalCampaigns) * 100 : 0;

        // Obtener campañas que necesitan atención
        const needsAttention = activeCampaigns.filter(campaign => {
          const daysRemaining = campaign.getDaysRemaining();
          const completion = campaign.getCompletionPercentage();
          return daysRemaining <= 2 || (daysRemaining <= 7 && completion < 50);
        });

        dashboard = {
          summary: {
            activeCampaigns: activeCount,
            totalCampaigns,
            completedCampaigns,
            completionRate: Math.round(completionRate),
            totalRaised: parseFloat(totalRaised?.total || 0),
            totalFamiliesHelped: parseInt(totalFamiliesHelped?.total || 0)
          },
          activeCampaigns: activeCampaigns.map(c => c.toJSON()),
          needsAttention: needsAttention.map(c => ({
            ...c.toJSON(),
            attentionReason: this.getAttentionReason(c)
          })),
          recentActivity: await this.getRecentActivity(tenantId)
        };

        // Guardar en cache por 10 minutos
        await cache.set(cacheKey, dashboard, 600);
      }

      return dashboard;
    } catch (error) {
      logger.error('Error en CampaignService.getCampaignDashboard:', error);
      throw error;
    }
  }

  // Validar creación de campaña
  static async validateCampaignCreation(data, tenantId) {
    // Verificar que no haya demasiadas campañas activas
    const activeCampaigns = await Campaign.getActiveCampaigns(tenantId);
    
    if (activeCampaigns.length >= 3) {
      throw new Error('TOO_MANY_ACTIVE_CAMPAIGNS');
    }

    // Validar fechas
    if (data.startDate && data.endDate) {
      if (new Date(data.startDate) >= new Date(data.endDate)) {
        throw new Error('INVALID_DATE_RANGE');
      }
    }

    // Validar metas de productos
    if (data.goals && Object.keys(data.goals).length === 0) {
      throw new Error('EMPTY_GOALS');
    }
  }

  // Validar actualización de campaña
  static async validateCampaignUpdate(campaign, data, tenantId) {
    // No permitir cambios en campañas completadas
    if (campaign.status === 'completed') {
      throw new Error('CAMPAIGN_COMPLETED');
    }

    // Validar cambios de estado
    if (data.status && !this.isValidStatusTransition(campaign.status, data.status)) {
      throw new Error('INVALID_STATUS_TRANSITION');
    }
  }

  // Validar activación de campaña
  static async validateCampaignActivation(campaign, tenantId) {
    if (campaign.status !== 'draft') {
      throw new Error('CAMPAIGN_NOT_DRAFT');
    }

    if (!campaign.goals || Object.keys(campaign.goals).length === 0) {
      throw new Error('CAMPAIGN_NO_GOALS');
    }

    if (!campaign.title || campaign.title.trim().length === 0) {
      throw new Error('CAMPAIGN_NO_TITLE');
    }
  }

  // Validar permisos de actualización
  static async validateUpdatePermissions(campaign, user, tenantId) {
    // Solo el creador, coordinadores, párrocos y admins pueden actualizar
    if (campaign.createdBy !== user.id && !user.hasAnyRole(['parroco', 'coordinador', 'admin'])) {
      throw new Error('INSUFFICIENT_PERMISSIONS');
    }
  }

  // Validar acceso de usuario
  static async validateUserAccess(campaign, userId, tenantId) {
    const tenantQuery = createTenantQuery(tenantId);
    const user = await tenantQuery.findById('users', userId);
    
    if (!user || user.tenant_id !== tenantId) {
      throw new Error('USER_NO_ACCESS');
    }
  }

  // Verificar transiciones de estado válidas
  static isValidStatusTransition(currentStatus, newStatus) {
    const validTransitions = {
      'draft': ['active', 'cancelled'],
      'active': ['completed', 'cancelled'],
      'completed': [], // No se puede cambiar desde completado
      'cancelled': ['draft'] // Solo se puede reactivar como borrador
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  // Obtener necesidades urgentes
  static getUrgentNeeds(campaign) {
    const progress = campaign.getProductProgress();
    return progress
      .filter(p => p.percentage < 50 && campaign.getDaysRemaining() <= 3)
      .sort((a, b) => a.percentage - b.percentage)
      .slice(0, 3);
  }

  // Generar mensaje de impacto
  static generateImpactMessage(campaign) {
    const completion = campaign.getCompletionPercentage();
    const families = campaign.targetFamilies;

    if (completion >= 100) {
      return `¡Meta alcanzada! Ayudaremos a ${families} familias.`;
    } else if (completion >= 75) {
      return `¡Casi lo logramos! Solo falta ${Math.round(100 - completion)}% para ayudar a ${families} familias.`;
    } else if (completion >= 50) {
      return `Vamos por buen camino. Con tu ayuda alimentaremos a ${families} familias.`;
    } else {
      return `Tu donación puede marcar la diferencia para ${families} familias necesitadas.`;
    }
  }

  // Obtener razón de atención
  static getAttentionReason(campaign) {
    const daysRemaining = campaign.getDaysRemaining();
    const completion = campaign.getCompletionPercentage();

    if (daysRemaining <= 1) {
      return 'Termina mañana';
    } else if (daysRemaining <= 2) {
      return 'Termina pronto';
    } else if (completion < 25 && daysRemaining <= 7) {
      return 'Progreso lento';
    } else if (completion < 50 && daysRemaining <= 3) {
      return 'Necesita impulso';
    }

    return 'Requiere atención';
  }

  // Verificar hitos importantes
  static async checkMilestones(campaign, tenantId) {
    const completion = campaign.getCompletionPercentage();
    const milestones = [25, 50, 75, 100];

    for (const milestone of milestones) {
      if (completion >= milestone) {
        // Enviar notificación de hito (implementar después)
        await this.sendMilestoneNotification(campaign, milestone, tenantId);
      }
    }
  }

  // Generar reporte de campaña
  static async generateCampaignReport(campaign, tenantId) {
    try {
      const stats = await campaign.getStats(tenantId);
      const productProgress = campaign.getProductProgress();

      return {
        campaign: campaign.toJSON(),
        summary: {
          ...stats,
          duration: this.calculateDuration(campaign.startDate, campaign.endDate),
          efficiency: stats.donations > 0 ? stats.uniqueDonors / stats.donations : 0
        },
        productBreakdown: productProgress,
        timeline: await this.getCampaignTimeline(campaign.id, tenantId)
      };
    } catch (error) {
      logger.error('Error generando reporte de campaña:', error);
      throw error;
    }
  }

  // Calcular duración de campaña
  static calculateDuration(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // Obtener actividad reciente
  static async getRecentActivity(tenantId, limit = 10) {
    try {
      const tenantQuery = createTenantQuery(tenantId);
      
      const recentDonations = await tenantQuery.table('donations')
        .join('campaigns', 'donations.campaign_id', 'campaigns.id')
        .join('users', 'donations.user_id', 'users.id')
        .select(
          'donations.created_at',
          'campaigns.title as campaign_title',
          'users.name as donor_name',
          'donations.estimated_value'
        )
        .orderBy('donations.created_at', 'desc')
        .limit(limit);

      return recentDonations.map(activity => ({
        type: 'donation',
        timestamp: activity.created_at,
        message: `${activity.donor_name} donó $${activity.estimated_value} a "${activity.campaign_title}"`,
        amount: activity.estimated_value
      }));
    } catch (error) {
      logger.error('Error obteniendo actividad reciente:', error);
      return [];
    }
  }

  // Obtener timeline de campaña
  static async getCampaignTimeline(campaignId, tenantId) {
    try {
      const tenantQuery = createTenantQuery(tenantId);
      
      const events = await tenantQuery.table('donations')
        .where('campaign_id', campaignId)
        .join('users', 'donations.user_id', 'users.id')
        .select(
          'donations.created_at',
          'users.name as donor_name',
          'donations.estimated_value',
          'donations.items'
        )
        .orderBy('donations.created_at', 'asc');

      return events.map(event => ({
        timestamp: event.created_at,
        type: 'donation',
        donor: event.donor_name,
        amount: event.estimated_value,
        items: event.items
      }));
    } catch (error) {
      logger.error('Error obteniendo timeline de campaña:', error);
      return [];
    }
  }

  // Enviar notificaciones de campaña (placeholder)
  static async sendCampaignNotifications(campaign, event, tenantId) {
    try {
      // TODO: Implementar sistema de notificaciones
      logger.info('Notificación de campaña enviada', {
        campaignId: campaign.id,
        tenantId,
        event
      });
    } catch (error) {
      logger.error('Error enviando notificaciones de campaña:', error);
    }
  }

  // Enviar notificación de hito (placeholder)
  static async sendMilestoneNotification(campaign, milestone, tenantId) {
    try {
      // TODO: Implementar notificación de hitos
      logger.info('Notificación de hito enviada', {
        campaignId: campaign.id,
        tenantId,
        milestone
      });
    } catch (error) {
      logger.error('Error enviando notificación de hito:', error);
    }
  }
}

module.exports = CampaignService;