const Tenant = require('../models/Tenant');
const logger = require('../utils/logger');
const { cache } = require('../config/redis');

class TenantService {
  // Crear nuevo tenant con validaciones
  static async createTenant(data, createdBy = null) {
    try {
      // Validar que el slug no esté en uso
      const existingTenant = await Tenant.findBySlug(data.slug);
      if (existingTenant) {
        throw new Error('SLUG_ALREADY_EXISTS');
      }

      // Validar configuración por defecto
      const tenantData = {
        ...data,
        settings: {
          campaignFrequency: 'weekly',
          minOrderAmount: 50000,
          platformFeePercentage: 5,
          ...data.settings
        },
        branding: {
          colors: {
            primary: '#2563eb',
            secondary: '#10b981'
          },
          ...data.branding
        }
      };

      const tenant = await Tenant.create(tenantData);

      logger.info('Tenant creado por servicio', {
        tenantId: tenant.id,
        createdBy: createdBy?.id,
        slug: tenant.slug
      });

      return tenant;
    } catch (error) {
      logger.error('Error en TenantService.createTenant:', error);
      throw error;
    }
  }

  // Obtener tenant con validaciones de acceso
  static async getTenant(identifier, userId = null) {
    try {
      const tenant = await Tenant.findByIdOrSlug(identifier);
      
      if (!tenant) {
        throw new Error('TENANT_NOT_FOUND');
      }

      if (!tenant.isActive) {
        throw new Error('TENANT_INACTIVE');
      }

      return tenant;
    } catch (error) {
      logger.error('Error en TenantService.getTenant:', error);
      throw error;
    }
  }

  // Obtener tenant con estadísticas
  static async getTenantWithStats(identifier) {
    try {
      const tenant = await this.getTenant(identifier);
      const stats = await tenant.getStats();

      return {
        tenant: tenant.toJSON(),
        stats
      };
    } catch (error) {
      logger.error('Error en TenantService.getTenantWithStats:', error);
      throw error;
    }
  }

  // Actualizar configuración del tenant
  static async updateTenantConfig(tenantId, data, updatedBy) {
    try {
      const tenant = await Tenant.findById(tenantId);
      
      if (!tenant) {
        throw new Error('TENANT_NOT_FOUND');
      }

      // Validar que solo se actualicen campos permitidos
      const allowedFields = ['branding', 'contactInfo', 'settings'];
      const updateData = {};

      allowedFields.forEach(field => {
        if (data[field] !== undefined) {
          updateData[field] = data[field];
        }
      });

      if (Object.keys(updateData).length === 0) {
        throw new Error('NO_VALID_FIELDS_TO_UPDATE');
      }

      await tenant.update(updateData);

      logger.info('Configuración de tenant actualizada', {
        tenantId: tenant.id,
        updatedBy: updatedBy.id,
        fields: Object.keys(updateData)
      });

      return tenant;
    } catch (error) {
      logger.error('Error en TenantService.updateTenantConfig:', error);
      throw error;
    }
  }

  // Listar tenants con filtros
  static async listTenants(options = {}) {
    try {
      const result = await Tenant.findAll(options);
      
      logger.info('Tenants listados', {
        page: options.page || 1,
        total: result.pagination.total
      });

      return result;
    } catch (error) {
      logger.error('Error en TenantService.listTenants:', error);
      throw error;
    }
  }

  // Activar/desactivar tenant
  static async toggleTenantStatus(tenantId, isActive, updatedBy) {
    try {
      const tenant = await Tenant.findById(tenantId);
      
      if (!tenant) {
        throw new Error('TENANT_NOT_FOUND');
      }

      await tenant.update({ isActive });

      logger.info('Estado de tenant cambiado', {
        tenantId: tenant.id,
        newStatus: isActive,
        updatedBy: updatedBy.id
      });

      return tenant;
    } catch (error) {
      logger.error('Error en TenantService.toggleTenantStatus:', error);
      throw error;
    }
  }

  // Validar acceso de usuario a tenant
  static async validateUserAccess(userId, tenantId) {
    try {
      const db = require('../config/database');
      
      const user = await db('users')
        .where('id', userId)
        .where('tenant_id', tenantId)
        .where('is_active', true)
        .first();

      if (!user) {
        throw new Error('USER_NO_ACCESS_TO_TENANT');
      }

      return true;
    } catch (error) {
      logger.error('Error en TenantService.validateUserAccess:', error);
      throw error;
    }
  }

  // Obtener configuración de branding para el frontend
  static async getBrandingConfig(identifier) {
    try {
      const cacheKey = `tenant:${identifier}:branding`;
      let branding = await cache.get(cacheKey);

      if (!branding) {
        const tenant = await Tenant.findByIdOrSlug(identifier);
        
        if (!tenant || !tenant.isActive) {
          throw new Error('TENANT_NOT_FOUND');
        }

        branding = {
          name: tenant.name,
          slug: tenant.slug,
          logoUrl: tenant.logoUrl,
          colors: tenant.branding.colors || {
            primary: '#2563eb',
            secondary: '#10b981'
          },
          contactInfo: tenant.contactInfo
        };

        // Guardar en cache por 2 horas
        await cache.set(cacheKey, branding, 7200);
      }

      return branding;
    } catch (error) {
      logger.error('Error en TenantService.getBrandingConfig:', error);
      throw error;
    }
  }

  // Limpiar cache de tenant
  static async clearTenantCache(tenantId, slug = null) {
    try {
      const cacheKeys = [
        `tenant:${tenantId}`,
        `tenant:${tenantId}:stats`,
        `tenant:${tenantId}:branding`
      ];

      if (slug) {
        cacheKeys.push(`tenant:${slug}`);
        cacheKeys.push(`tenant:${slug}:branding`);
      }

      await Promise.all(cacheKeys.map(key => cache.del(key)));

      logger.info('Cache de tenant limpiado', { tenantId, slug });
    } catch (error) {
      logger.error('Error limpiando cache de tenant:', error);
    }
  }

  // Verificar salud del tenant (para monitoreo)
  static async checkTenantHealth(tenantId) {
    try {
      const tenant = await Tenant.findById(tenantId);
      
      if (!tenant) {
        return { healthy: false, reason: 'TENANT_NOT_FOUND' };
      }

      if (!tenant.isActive) {
        return { healthy: false, reason: 'TENANT_INACTIVE' };
      }

      // Verificar que tenga al menos un usuario activo
      const db = require('../config/database');
      const userCount = await db('users')
        .where('tenant_id', tenantId)
        .where('is_active', true)
        .count('* as count')
        .first();

      if (parseInt(userCount.count) === 0) {
        return { healthy: false, reason: 'NO_ACTIVE_USERS' };
      }

      return { healthy: true };
    } catch (error) {
      logger.error('Error verificando salud del tenant:', error);
      return { healthy: false, reason: 'CHECK_ERROR' };
    }
  }
}

module.exports = TenantService;