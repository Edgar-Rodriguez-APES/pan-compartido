const db = require('../config/database');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

class Tenant {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.slug = data.slug;
    this.logoUrl = data.logo_url;
    this.config = data.config || {};
    this.branding = data.branding || {};
    this.contactInfo = data.contact_info || {};
    this.settings = data.settings || {};
    this.isActive = data.is_active;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Crear nuevo tenant
  static async create(data) {
    try {
      const [tenant] = await db('tenants')
        .insert({
          name: data.name,
          slug: data.slug,
          logo_url: data.logoUrl,
          config: data.config || {},
          branding: data.branding || {
            colors: {
              primary: '#2563eb',
              secondary: '#10b981'
            }
          },
          contact_info: data.contactInfo || {},
          settings: data.settings || {
            campaignFrequency: 'weekly',
            minOrderAmount: 50000,
            platformFeePercentage: 5
          }
        })
        .returning('*');

      logger.info('Tenant creado', { tenantId: tenant.id, name: tenant.name });
      
      // Limpiar cache
      await cache.del(`tenant:${tenant.id}`);
      await cache.del(`tenant:${tenant.slug}`);
      
      return new Tenant(tenant);
    } catch (error) {
      logger.error('Error creando tenant:', error);
      throw error;
    }
  }

  // Buscar tenant por ID
  static async findById(id) {
    try {
      // Buscar en cache primero
      const cacheKey = `tenant:${id}`;
      let tenantData = await cache.get(cacheKey);

      if (!tenantData) {
        tenantData = await db('tenants')
           
        .where('id', id)
          .first();

        if (tenantData) {
          // Guardar en cache por 1 hora
          await cache.set(cacheKey, tenantData, 3600);
        }
      }

      return tenantData ? new Tenant(tenantData) : null;
    } catch (error) {
      logger.error('Error buscando tenant por ID:', error);
      throw error;
    }
  }

  // Buscar tenant por slug
  static async findBySlug(slug) {
    try {
      // Buscar en cache primero
      const cacheKey = `tenant:${slug}`;
      let tenantData = await cache.get(cacheKey);

      if (!tenantData) {
        tenantData = await db('tenants')
          .where('slug', slug)
          .first();

        if (tenantData) {
          // Guardar en cache por 1 hora
          await cache.set(cacheKey, tenantData, 3600);
        }
      }

      return tenantData ? new Tenant(tenantData) : null;
    } catch (error) {
      logger.error('Error buscando tenant por slug:', error);
      throw error;
    }
  }

  // Buscar tenant por ID o slug
  static async findByIdOrSlug(identifier) {
    try {
      // Intentar buscar por UUID primero
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      
      if (uuidRegex.test(identifier)) {
        return await this.findById(identifier);
      } else {
        return await this.findBySlug(identifier);
      }
    } catch (error) {
      logger.error('Error buscando tenant:', error);
      throw error;
    }
  }

  // Obtener todos los tenants con paginación
  static async findAll(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        isActive = null,
        search = null
      } = options;

      const offset = (page - 1) * limit;
      let query = db('tenants').select('*');

      // Filtros
      if (isActive !== null) {
        query = query.where('is_active', isActive);
      }

      if (search) {
        query = query.where(function() {
          this.where('name', 'ilike', `%${search}%`)
              .orWhere('slug', 'ilike', `%${search}%`);
        });
      }

      // Obtener total para paginación
      const totalQuery = query.clone();
      const [{ count: total }] = await totalQuery.count('* as count');

      // Obtener resultados paginados
      const tenants = await query
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset);

      return {
        tenants: tenants.map(tenant => new Tenant(tenant)),
        pagination: {
          page,
          limit,
          total: parseInt(total),
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error obteniendo tenants:', error);
      throw error;
    }
  }

  // Actualizar tenant
  async update(data) {
    try {
      const updateData = {};
      
      if (data.name !== undefined) updateData.name = data.name;
      if (data.logoUrl !== undefined) updateData.logo_url = data.logoUrl;
      if (data.branding !== undefined) updateData.branding = data.branding;
      if (data.contactInfo !== undefined) updateData.contact_info = data.contactInfo;
      if (data.settings !== undefined) updateData.settings = data.settings;
      if (data.isActive !== undefined) updateData.is_active = data.isActive;
      
      updateData.updated_at = new Date();

      const [updatedTenant] = await db('tenants')
        .where('id', this.id)
        .update(updateData)
        .returning('*');

      // Actualizar propiedades del objeto actual
      Object.assign(this, new Tenant(updatedTenant));

      // Limpiar cache
      await cache.del(`tenant:${this.id}`);
      await cache.del(`tenant:${this.slug}`);

      logger.info('Tenant actualizado', { tenantId: this.id, changes: Object.keys(updateData) });

      return this;
    } catch (error) {
      logger.error('Error actualizando tenant:', error);
      throw error;
    }
  }

  // Eliminar tenant (soft delete)
  async delete() {
    try {
      await db('tenants')
        .where('id', this.id)
        .update({
          is_active: false,
          updated_at: new Date()
        });

      this.isActive = false;

      // Limpiar cache
      await cache.del(`tenant:${this.id}`);
      await cache.del(`tenant:${this.slug}`);

      logger.info('Tenant desactivado', { tenantId: this.id });

      return this;
    } catch (error) {
      logger.error('Error desactivando tenant:', error);
      throw error;
    }
  }

  // Obtener estadísticas del tenant
  async getStats() {
    try {
      const cacheKey = `tenant:${this.id}:stats`;
      let stats = await cache.get(cacheKey);

      if (!stats) {
        const [
          campaignsCount,
          usersCount,
          donationsCount,
          totalRaised
        ] = await Promise.all([
          db('campaigns').where('tenant_id', this.id).count('* as count').first(),
          db('users').where('tenant_id', this.id).where('is_active', true).count('* as count').first(),
          db('donations').where('tenant_id', this.id).count('* as count').first(),
          db('payments')
            .where('tenant_id', this.id)
            .where('status', 'completed')
            .sum('total_amount as total')
            .first()
        ]);

        stats = {
          campaigns: parseInt(campaignsCount.count) || 0,
          users: parseInt(usersCount.count) || 0,
          donations: parseInt(donationsCount.count) || 0,
          totalRaised: parseFloat(totalRaised.total) || 0
        };

        // Guardar en cache por 15 minutos
        await cache.set(cacheKey, stats, 900);
      }

      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas del tenant:', error);
      throw error;
    }
  }

  // Verificar si el tenant puede crear campañas
  canCreateCampaigns() {
    return this.isActive && this.settings.campaignFrequency;
  }

  // Obtener configuración completa del tenant
  getFullConfig() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      logoUrl: this.logoUrl,
      branding: this.branding,
      contactInfo: this.contactInfo,
      settings: this.settings,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // Serializar para respuesta JSON
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      logoUrl: this.logoUrl,
      branding: this.branding,
      contactInfo: this.contactInfo,
      settings: this.settings,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Tenant;