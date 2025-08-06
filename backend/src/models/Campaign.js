const db = require('../config/database');
const { cache } = require('../config/redis');
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
    this.targetAmount = data.target_amount;
    this.raisedAmount = data.raised_amount;
    this.targetFamilies = data.target_families;
    this.helpedFamilies = data.helped_families;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Crear nueva campaña
  static async create(data) {
    try {
      const [campaign] = await db('campaigns')
        .insert({
          tenant_id: data.tenantId,
          created_by: data.createdBy,
          title: data.title,
          description: data.description,
          goals: data.goals || {},
          current_progress: {},
          status: data.status || 'draft',
          frequency: data.frequency || 'weekly',
          start_date: data.startDate,
          end_date: data.endDate,
          target_amount: data.targetAmount || 0,
          raised_amount: 0,
          target_families: data.targetFamilies || 0,
          helped_families: 0
        })
        .returning('*');

      logger.info('Campaña creada', {
        campaignId: campaign.id,
        title: campaign.title,
        tenantId: campaign.tenant_id,
        createdBy: campaign.created_by
      });

      return new Campaign(campaign);
    } catch (error) {
      logger.error('Error creando campaña:', error);
      throw error;
    }
  }

  // Buscar campaña por ID
  static async findById(id) {
    try {
      const cacheKey = `campaign:${id}`;
      let campaignData = await cache.get(cacheKey);

      if (!campaignData) {
        campaignData = await db('campaigns')
          .where('id', id)
          .first();

        if (campaignData) {
          // Guardar en cache por 30 minutos
          await cache.set(cacheKey, campaignData, 1800);
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
        includeStats = false
      } = options;

      const offset = (page - 1) * limit;
      let query = db('campaigns')
        .where('tenant_id', tenantId);

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

      // Obtener total para paginación
      const totalQuery = query.clone();
      const [{ count: total }] = await totalQuery.count('* as count');

      // Obtener resultados paginados
      let selectQuery = query
        .select('*')
        .orderBy(orderBy, orderDirection)
        .limit(limit)
        .offset(offset);

      const campaigns = await selectQuery;

      const campaignObjects = campaigns.map(campaign => new Campaign(campaign));

      // Incluir estadísticas si se solicita
      if (includeStats) {
        for (let campaign of campaignObjects) {
          campaign.stats = await campaign.getStats();
        }
      }

      return {
        campaigns: campaignObjects,
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
  static async findActiveCampaigns(tenantId) {
    try {
      const cacheKey = `active_campaigns:${tenantId}`;
      let campaigns = await cache.get(cacheKey);

      if (!campaigns) {
        const campaignData = await db('campaigns')
          .where('tenant_id', tenantId)
          .where('status', 'active')
          .where('start_date', '<=', new Date())
          .where('end_date', '>=', new Date())
          .orderBy('created_at', 'desc');

        campaigns = campaignData.map(campaign => new Campaign(campaign));

        // Guardar en cache por 15 minutos
        await cache.set(cacheKey, campaigns, 900);
      }

      return campaigns;
    } catch (error) {
      logger.error('Error obteniendo campañas activas:', error);
      throw error;
    }
  }

  // Actualizar campaña
  async update(data) {
    try {
      const updateData = {};

      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.goals !== undefined) updateData.goals = data.goals;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.frequency !== undefined) updateData.frequency = data.frequency;
      if (data.startDate !== undefined) updateData.start_date = data.startDate;
      if (data.endDate !== undefined) updateData.end_date = data.endDate;
      if (data.targetAmount !== undefined) updateData.target_amount = data.targetAmount;
      if (data.targetFamilies !== undefined) updateData.target_families = data.targetFamilies;

      updateData.updated_at = new Date();

      const [updatedCampaign] = await db('campaigns')
        .where('id', this.id)
        .update(updateData)
        .returning('*');

      // Actualizar propiedades del objeto actual
      Object.assign(this, new Campaign(updatedCampaign));

      // Limpiar cache
      await this.clearCache();

      logger.info('Campaña actualizada', {
        campaignId: this.id,
        changes: Object.keys(updateData)
      });

      return this;
    } catch (error) {
      logger.error('Error actualizando campaña:', error);
      throw error;
    }
  }

  // Actualizar progreso de la campaña
  async updateProgress() {
    try {
      // Calcular progreso actual basado en donaciones
      const [donationStats, paymentStats] = await Promise.all([
        // Estadísticas de donaciones
        db('donations')
          .where('campaign_id', this.id)
          .where('status', 'received')
          .select(
            db.raw('COUNT(*) as total_donations'),
            db.raw('jsonb_agg(items) as all_items')
          )
          .first(),

        // Estadísticas de pagos
        db('payments')
          .join('donations', 'payments.donation_id', 'donations.id')
          .where('donations.campaign_id', this.id)
          .where('payments.status', 'completed')
          .sum('payments.donation_amount as total_raised')
          .first()
      ]);

      // Procesar items donados
      const currentProgress = {};
      if (donationStats.all_items) {
        const allItems = donationStats.all_items.flat();
        allItems.forEach(item => {
          if (item && item.name) {
            const key = item.name.toLowerCase();
            if (!currentProgress[key]) {
              currentProgress[key] = { received: 0, unit: item.unit || 'unidades' };
            }
            currentProgress[key].received += parseFloat(item.quantity) || 0;
          }
        });
      }

      // Actualizar en base de datos
      await db('campaigns')
        .where('id', this.id)
        .update({
          current_progress: currentProgress,
          raised_amount: parseFloat(paymentStats.total_raised) || 0,
          updated_at: new Date()
        });

      // Actualizar propiedades del objeto
      this.currentProgress = currentProgress;
      this.raisedAmount = parseFloat(paymentStats.total_raised) || 0;

      // Limpiar cache
      await this.clearCache();

      logger.info('Progreso de campaña actualizado', {
        campaignId: this.id,
        raisedAmount: this.raisedAmount,
        progressItems: Object.keys(currentProgress).length
      });

      return this;
    } catch (error) {
      logger.error('Error actualizando progreso de campaña:', error);
      throw error;
    }
  }

  // Obtener estadísticas de la campaña
  async getStats() {
    try {
      const cacheKey = `campaign:${this.id}:stats`;
      let stats = await cache.get(cacheKey);

      if (!stats) {
        const [donationStats, donorStats, progressStats] = await Promise.all([
          // Estadísticas de donaciones
          db('donations')
            .where('campaign_id', this.id)
            .select(
              db.raw('COUNT(*) as total_donations'),
              db.raw('COUNT(CASE WHEN status = \'received\' THEN 1 END) as received_donations'),
              db.raw('COUNT(CASE WHEN status = \'pending\' THEN 1 END) as pending_donations')
            )
            .first(),

          // Estadísticas de donantes
          db('donations')
            .where('campaign_id', this.id)
            .countDistinct('user_id as unique_donors')
            .first(),

          // Progreso por objetivos
          this.calculateGoalProgress()
        ]);

        stats = {
          totalDonations: parseInt(donationStats.total_donations) || 0,
          receivedDonations: parseInt(donationStats.received_donations) || 0,
          pendingDonations: parseInt(donationStats.pending_donations) || 0,
          uniqueDonors: parseInt(donorStats.unique_donors) || 0,
          raisedAmount: this.raisedAmount || 0,
          targetAmount: this.targetAmount || 0,
          progressPercentage: this.targetAmount > 0 ? (this.raisedAmount / this.targetAmount) * 100 : 0,
          goalProgress: progressStats,
          daysRemaining: this.endDate ? Math.max(0, Math.ceil((new Date(this.endDate) - new Date()) / (1000 * 60 * 60 * 24))) : null
        };

        // Guardar en cache por 10 minutos
        await cache.set(cacheKey, stats, 600);
      }

      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas de campaña:', error);
      throw error;
    }
  }

  // Calcular progreso de objetivos específicos
  async calculateGoalProgress() {
    try {
      const goalProgress = {};

      if (this.goals && Object.keys(this.goals).length > 0) {
        Object.keys(this.goals).forEach(goalKey => {
          const goal = this.goals[goalKey];
          const current = this.currentProgress[goalKey] || { received: 0 };
          
          goalProgress[goalKey] = {
            needed: goal.needed || 0,
            received: current.received || 0,
            unit: goal.unit || current.unit || 'unidades',
            percentage: goal.needed > 0 ? (current.received / goal.needed) * 100 : 0,
            remaining: Math.max(0, (goal.needed || 0) - (current.received || 0))
          };
        });
      }

      return goalProgress;
    } catch (error) {
      logger.error('Error calculando progreso de objetivos:', error);
      return {};
    }
  }

  // Verificar si la campaña está activa
  isActive() {
    const now = new Date();
    const startDate = new Date(this.startDate);
    const endDate = new Date(this.endDate);
    
    return this.status === 'active' && 
           now >= startDate && 
           now <= endDate;
  }

  // Verificar si la campaña ha terminado
  isExpired() {
    const now = new Date();
    const endDate = new Date(this.endDate);
    
    return now > endDate;
  }

  // Verificar si se pueden hacer donaciones
  canReceiveDonations() {
    return this.isActive() && this.status !== 'completed';
  }

  // Marcar campaña como completada
  async markAsCompleted() {
    try {
      await this.update({ status: 'completed' });
      
      logger.info('Campaña marcada como completada', {
        campaignId: this.id,
        title: this.title
      });

      return this;
    } catch (error) {
      logger.error('Error marcando campaña como completada:', error);
      throw error;
    }
  }

  // Obtener donaciones de la campaña
  async getDonations(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        status = null,
        orderBy = 'created_at',
        orderDirection = 'desc'
      } = options;

      const offset = (page - 1) * limit;
      let query = db('donations')
        .join('users', 'donations.user_id', 'users.id')
        .where('donations.campaign_id', this.id)
        .select(
          'donations.*',
          'users.name as donor_name',
          'users.email as donor_email'
        );

      if (status) {
        query = query.where('donations.status', status);
      }

      // Obtener total
      const totalQuery = query.clone();
      const [{ count: total }] = await totalQuery.count('donations.id as count');

      // Obtener resultados paginados
      const donations = await query
        .orderBy(`donations.${orderBy}`, orderDirection)
        .limit(limit)
        .offset(offset);

      return {
        donations,
        pagination: {
          page,
          limit,
          total: parseInt(total),
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error obteniendo donaciones de campaña:', error);
      throw error;
    }
  }

  // Limpiar cache de la campaña
  async clearCache() {
    try {
      const cacheKeys = [
        `campaign:${this.id}`,
        `campaign:${this.id}:stats`,
        `active_campaigns:${this.tenantId}`
      ];

      await Promise.all(cacheKeys.map(key => cache.del(key)));

      logger.info('Cache de campaña limpiado', { campaignId: this.id });
    } catch (error) {
      logger.error('Error limpiando cache de campaña:', error);
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
      isActive: this.isActive(),
      isExpired: this.isExpired(),
      canReceiveDonations: this.canReceiveDonations()
    };
  }
}

module.exports = Campaign;