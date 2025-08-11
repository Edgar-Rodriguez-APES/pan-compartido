const db = require('../config/database');
const { cache } = require('../config/redis');
const { createTenantQuery } = require('../utils/tenantQuery');
const logger = require('../utils/logger');

class Campaign {
  constructor(data) {
    this.id = data.id;
    this.tenantId = data.tenant_id;
    this.createdBy = data.created_by;
    this.title = data.title;
    this.description = data.description;
    this.goals = data.goals || {};
    this.currentProgress = data.current_progress || {};
    this.status = data.status;
    this.frequency = data.frequency;
    this.startDate = data.start_date;
    this.endDate = data.end_date;
    this.targetAmount = parseFloat(data.target_amount) || 0;
    this.raisedAmount = parseFloat(data.raised_amount) || 0;
    this.targetFamilies = parseInt(data.target_families) || 0;
    this.helpedFamilies = parseInt(data.helped_families) || 0;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Crear nueva campaña
  static async create(data, tenantId) {
    try {
      const tenantQuery = createTenantQuery(tenantId);

      // Calcular fechas automáticamente si no se proporcionan
      const startDate = data.startDate || new Date();
      const endDate = data.endDate || this.calculateEndDate(startDate, data.frequency || 'weekly');

      // Calcular monto objetivo basado en las metas de productos
      const targetAmount = data.targetAmount || this.calculateTargetAmount(data.goals || {});

      const [campaign] = await tenantQuery.insert('campaigns', {
        created_by: data.createdBy,
        title: data.title,
        description: data.description,
        goals: data.goals || {},
        current_progress: {},
        status: data.status || 'draft',
        frequency: data.frequency || 'weekly',
        start_date: startDate,
        end_date: endDate,
        target_amount: targetAmount,
        raised_amount: 0,
        target_families: data.targetFamilies || 0,
        helped_families: 0
      }).returning('*');

      logger.info('Campaña creada', {
        campaignId: campaign.id,
        tenantId,
        title: campaign.title,
        createdBy: data.createdBy
      });

      return new Campaign(campaign);
    } catch (error) {
      logger.error('Error creando campaña:', error);
      throw error;
    }
  }

  // Buscar campaña por ID
  static async findById(id, tenantId) {
    try {
      const cacheKey = `campaign:${tenantId}:${id}`;
      let campaignData = await cache.get(cacheKey);

      if (!campaignData) {
        const tenantQuery = createTenantQuery(tenantId);
        campaignData = await tenantQuery.findById('campaigns', id);

        if (campaignData) {
          // Guardar en cache por 15 minutos
          await cache.set(cacheKey, campaignData, 900);
        }
      }

      return campaignData ? new Campaign(campaignData) : null;
    } catch (error) {
      logger.error('Error buscando campaña por ID:', error);
      throw error;
    }
  }

  // Obtener campañas de un tenant con filtros
  static async findByTenant(tenantId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        status = null,
        frequency = null,
        search = null,
        orderBy = 'created_at',
        orderDirection = 'desc',
        dateFrom = null,
        dateTo = null
      } = options;

      const tenantQuery = createTenantQuery(tenantId);
      let query = tenantQuery.table('campaigns').select('*');

      // Filtros
      if (status) {
        query = query.where('status', status);
      }

      if (frequency) {
        query = query.where('frequency', frequency);
      }

      if (search) {
        query = query.where(function() {
          this.where('title', 'ilike', `%${search}%`)
              .orWhere('description', 'ilike', `%${search}%`);
        });
      }

      if (dateFrom) {
        query = query.where('start_date', '>=', dateFrom);
      }

      if (dateTo) {
        query = query.where('end_date', '<=', dateTo);
      }

      // Obtener total para paginación
      const totalQuery = query.clone();
      const [{ count: total }] = await totalQuery.count('* as count');

      // Obtener resultados paginados
      const offset = (page - 1) * limit;
      const campaigns = await query
        .orderBy(orderBy, orderDirection)
        .limit(limit)
        .offset(offset);

      return {
        campaigns: campaigns.map(campaign => new Campaign(campaign)),
        pagination: {
          page,
          limit,
          total: parseInt(total),
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error obteniendo campañas por tenant:', error);
      throw error;
    }
  }

  // Obtener campañas activas
  static async getActiveCampaigns(tenantId) {
    try {
      const cacheKey = `campaigns:${tenantId}:active`;
      let campaigns = await cache.get(cacheKey);

      if (!campaigns) {
        const tenantQuery = createTenantQuery(tenantId);
        const campaignData = await tenantQuery.table('campaigns')
          .where('status', 'active')
          .where('start_date', '<=', new Date())
          .where('end_date', '>=', new Date())
          .orderBy('created_at', 'desc');

        campaigns = campaignData.map(campaign => new Campaign(campaign));

        // Guardar en cache por 5 minutos
        await cache.set(cacheKey, campaigns, 300);
      }

      return campaigns;
    } catch (error) {
      logger.error('Error obteniendo campañas activas:', error);
      throw error;
    }
  }

  // Actualizar campaña
  async update(data, tenantId) {
    try {
      const tenantQuery = createTenantQuery(tenantId);
      const updateData = {};

      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.goals !== undefined) {
        updateData.goals = data.goals;
        // Recalcular monto objetivo si cambian las metas
        updateData.target_amount = Campaign.calculateTargetAmount(data.goals);
      }
      if (data.status !== undefined) updateData.status = data.status;
      if (data.frequency !== undefined) updateData.frequency = data.frequency;
      if (data.startDate !== undefined) updateData.start_date = data.startDate;
      if (data.endDate !== undefined) updateData.end_date = data.endDate;
      if (data.targetAmount !== undefined) updateData.target_amount = data.targetAmount;
      if (data.targetFamilies !== undefined) updateData.target_families = data.targetFamilies;

      updateData.updated_at = new Date();

      const [updatedCampaign] = await tenantQuery.update('campaigns', 
        updateData, 
        { id: this.id }
      ).returning('*');

      // Actualizar propiedades del objeto actual
      Object.assign(this, new Campaign(updatedCampaign));

      // Limpiar cache
      await this.clearCache(tenantId);

      logger.info('Campaña actualizada', {
        campaignId: this.id,
        tenantId,
        changes: Object.keys(updateData)
      });

      return this;
    } catch (error) {
      logger.error('Error actualizando campaña:', error);
      throw error;
    }
  }

  // Actualizar progreso de la campaña
  async updateProgress(productId, quantity, unit, tenantId) {
    try {
      const tenantQuery = createTenantQuery(tenantId);

      // Actualizar progreso actual
      const newProgress = { ...this.currentProgress };
      if (!newProgress[productId]) {
        newProgress[productId] = { received: 0, unit };
      }
      newProgress[productId].received += quantity;

      // Calcular nuevo monto recaudado basado en el progreso
      const newRaisedAmount = this.calculateRaisedAmount(newProgress);

      // Actualizar en base de datos
      const [updatedCampaign] = await tenantQuery.update('campaigns', {
        current_progress: newProgress,
        raised_amount: newRaisedAmount,
        updated_at: new Date()
      }, { id: this.id }).returning('*');

      // Actualizar objeto actual
      Object.assign(this, new Campaign(updatedCampaign));

      // Verificar si se completó la campaña
      await this.checkCompletion(tenantId);

      // Limpiar cache
      await this.clearCache(tenantId);

      logger.info('Progreso de campaña actualizado', {
        campaignId: this.id,
        tenantId,
        productId,
        quantity,
        newProgress: newProgress[productId]
      });

      return this;
    } catch (error) {
      logger.error('Error actualizando progreso de campaña:', error);
      throw error;
    }
  }

  // Activar campaña
  async activate(tenantId) {
    try {
      if (this.status !== 'draft') {
        throw new Error('CAMPAIGN_NOT_DRAFT');
      }

      await this.update({ status: 'active' }, tenantId);

      logger.info('Campaña activada', {
        campaignId: this.id,
        tenantId,
        title: this.title
      });

      return this;
    } catch (error) {
      logger.error('Error activando campaña:', error);
      throw error;
    }
  }

  // Completar campaña
  async complete(tenantId) {
    try {
      if (this.status !== 'active') {
        throw new Error('CAMPAIGN_NOT_ACTIVE');
      }

      await this.update({ status: 'completed' }, tenantId);

      logger.info('Campaña completada', {
        campaignId: this.id,
        tenantId,
        title: this.title,
        raisedAmount: this.raisedAmount,
        targetAmount: this.targetAmount
      });

      return this;
    } catch (error) {
      logger.error('Error completando campaña:', error);
      throw error;
    }
  }

  // Cancelar campaña
  async cancel(tenantId, reason = null) {
    try {
      if (this.status === 'completed') {
        throw new Error('CAMPAIGN_ALREADY_COMPLETED');
      }

      await this.update({ status: 'cancelled' }, tenantId);

      logger.info('Campaña cancelada', {
        campaignId: this.id,
        tenantId,
        title: this.title,
        reason
      });

      return this;
    } catch (error) {
      logger.error('Error cancelando campaña:', error);
      throw error;
    }
  }

  // Verificar si la campaña se completó automáticamente
  async checkCompletion(tenantId) {
    try {
      if (this.status !== 'active') return;

      const completionPercentage = this.getCompletionPercentage();
      
      // Completar automáticamente si se alcanza el 100% o si pasó la fecha de fin
      if (completionPercentage >= 100 || new Date() > new Date(this.endDate)) {
        await this.complete(tenantId);
      }
    } catch (error) {
      logger.error('Error verificando completación de campaña:', error);
    }
  }

  // Calcular porcentaje de completación
  getCompletionPercentage() {
    if (this.targetAmount === 0) return 0;
    return Math.min((this.raisedAmount / this.targetAmount) * 100, 100);
  }

  // Obtener progreso por producto
  getProductProgress() {
    const progress = [];
    
    Object.keys(this.goals).forEach(productId => {
      const goal = this.goals[productId];
      const current = this.currentProgress[productId] || { received: 0, unit: goal.unit };
      
      progress.push({
        productId,
        needed: goal.needed,
        received: current.received,
        unit: goal.unit,
        percentage: goal.needed > 0 ? Math.min((current.received / goal.needed) * 100, 100) : 0,
        remaining: Math.max(goal.needed - current.received, 0),
        estimatedPrice: goal.estimated_price || 0
      });
    });

    return progress;
  }

  // Verificar si la campaña está activa
  isActive() {
    const now = new Date();
    return this.status === 'active' && 
           new Date(this.startDate) <= now && 
           new Date(this.endDate) >= now;
  }

  // Verificar si la campaña está vencida
  isExpired() {
    return new Date() > new Date(this.endDate);
  }

  // Obtener días restantes
  getDaysRemaining() {
    const now = new Date();
    const endDate = new Date(this.endDate);
    const diffTime = endDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(diffDays, 0);
  }

  // Calcular monto recaudado basado en el progreso
  calculateRaisedAmount(progress = null) {
    const currentProgress = progress || this.currentProgress;
    let total = 0;

    Object.keys(currentProgress).forEach(productId => {
      const productProgress = currentProgress[productId];
      const goal = this.goals[productId];
      
      if (goal && goal.estimated_price) {
        total += productProgress.received * goal.estimated_price;
      }
    });

    return total;
  }

  // Calcular monto objetivo basado en las metas
  static calculateTargetAmount(goals) {
    let total = 0;

    Object.keys(goals).forEach(productId => {
      const goal = goals[productId];
      if (goal.needed && goal.estimated_price) {
        total += goal.needed * goal.estimated_price;
      }
    });

    return total;
  }

  // Calcular fecha de fin basada en frecuencia
  static calculateEndDate(startDate, frequency) {
    const start = new Date(startDate);
    const end = new Date(start);

    switch (frequency) {
      case 'weekly':
        end.setDate(start.getDate() + 7);
        break;
      case 'biweekly':
        end.setDate(start.getDate() + 14);
        break;
      case 'monthly':
        end.setMonth(start.getMonth() + 1);
        break;
      default:
        end.setDate(start.getDate() + 7);
    }

    return end;
  }

  // Limpiar cache de la campaña
  async clearCache(tenantId) {
    try {
      const cacheKeys = [
        `campaign:${tenantId}:${this.id}`,
        `campaigns:${tenantId}:active`,
        `campaigns:${tenantId}:stats`
      ];

      await Promise.all(cacheKeys.map(key => cache.del(key)));
    } catch (error) {
      logger.error('Error limpiando cache de campaña:', error);
    }
  }

  // Obtener estadísticas de la campaña
  async getStats(tenantId) {
    try {
      const tenantQuery = createTenantQuery(tenantId);

      const [
        donationsCount,
        uniqueDonors,
        averageDonation
      ] = await Promise.all([
        tenantQuery.count('donations', { campaign_id: this.id }),
        db('donations')
          .where('campaign_id', this.id)
          .where('tenant_id', tenantId)
          .countDistinct('user_id as count')
          .first(),
        db('donations')
          .where('campaign_id', this.id)
          .where('tenant_id', tenantId)
          .avg('estimated_value as avg')
          .first()
      ]);

      return {
        donations: donationsCount,
        uniqueDonors: parseInt(uniqueDonors.count) || 0,
        averageDonation: parseFloat(averageDonation.avg) || 0,
        completionPercentage: this.getCompletionPercentage(),
        daysRemaining: this.getDaysRemaining(),
        isActive: this.isActive(),
        isExpired: this.isExpired()
      };
    } catch (error) {
      logger.error('Error obteniendo estadísticas de campaña:', error);
      throw error;
    }
  }

  // Serializar para respuesta JSON
  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      createdBy: this.createdBy,
      title: this.title,
      description: this.description,
      goals: this.goals,
      currentProgress: this.currentProgress,
      status: this.status,
      frequency: this.frequency,
      startDate: this.startDate,
      endDate: this.endDate,
      targetAmount: this.targetAmount,
      raisedAmount: this.raisedAmount,
      targetFamilies: this.targetFamilies,
      helpedFamilies: this.helpedFamilies,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      // Campos calculados
      completionPercentage: this.getCompletionPercentage(),
      daysRemaining: this.getDaysRemaining(),
      isActive: this.isActive(),
      isExpired: this.isExpired(),
      productProgress: this.getProductProgress()
    };
  }
}

module.exports = Campaign;