const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

class User {
  constructor(data) {
    this.id = data.id;
    this.tenantId = data.tenant_id;
    this.name = data.name;
    this.email = data.email;
    this.phone = data.phone;
    this.passwordHash = data.password_hash;
    this.role = data.role;
    this.preferences = data.preferences || {};
    this.isActive = data.is_active;
    this.emailVerified = data.email_verified;
    this.phoneVerified = data.phone_verified;
    this.lastLogin = data.last_login;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Crear nuevo usuario
  static async create(data) {
    try {
      // Hash de la contraseña
      const passwordHash = await bcrypt.hash(data.password, 12);

      const [user] = await db('users')
        .insert({
          tenant_id: data.tenantId,
          name: data.name,
          email: data.email,
          phone: data.phone,
          password_hash: passwordHash,
          role: data.role || 'feligres',
          preferences: data.preferences || {},
          email_verified: false,
          phone_verified: false
        })
        .returning('*');

      logger.info('Usuario creado', {
        userId: user.id,
        email: user.email,
        tenantId: user.tenant_id,
        role: user.role
      });

      return new User(user);
    } catch (error) {
      logger.error('Error creando usuario:', error);
      throw error;
    }
  }

  // Buscar usuario por ID
  static async findById(id) {
    try {
      const cacheKey = `user:${id}`;
      let userData = await cache.get(cacheKey);

      if (!userData) {
        userData = await db('users')
          .where('id', id)
          .first();

        if (userData) {
          // Guardar en cache por 30 minutos
          await cache.set(cacheKey, userData, 1800);
        }
      }

      return userData ? new User(userData) : null;
    } catch (error) {
      logger.error('Error buscando usuario por ID:', error);
      throw error;
    }
  }

  // Buscar usuario por email y tenant
  static async findByEmailAndTenant(email, tenantId) {
    try {
      const userData = await db('users')
        .where('email', email)
        .where('tenant_id', tenantId)
        .first();

      return userData ? new User(userData) : null;
    } catch (error) {
      logger.error('Error buscando usuario por email:', error);
      throw error;
    }
  }

  // Buscar usuario por teléfono y tenant
  static async findByPhoneAndTenant(phone, tenantId) {
    try {
      const userData = await db('users')
        .where('phone', phone)
        .where('tenant_id', tenantId)
        .first();

      return userData ? new User(userData) : null;
    } catch (error) {
      logger.error('Error buscando usuario por teléfono:', error);
      throw error;
    }
  }

  // Obtener usuarios de un tenant con filtros
  static async findByTenant(tenantId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        role = null,
        isActive = null,
        search = null,
        orderBy = 'created_at',
        orderDirection = 'desc'
      } = options;

      const offset = (page - 1) * limit;
      let query = db('users')
        .where('tenant_id', tenantId)
        .select('id', 'name', 'email', 'phone', 'role', 'is_active', 'email_verified', 'phone_verified', 'last_login', 'created_at');

      // Filtros
      if (role) {
        query = query.where('role', role);
      }

      if (isActive !== null) {
        query = query.where('is_active', isActive);
      }

      if (search) {
        query = query.where(function() {
          this.where('name', 'ilike', `%${search}%`)
              .orWhere('email', 'ilike', `%${search}%`)
              .orWhere('phone', 'ilike', `%${search}%`);
        });
      }

      // Obtener total para paginación
      const totalQuery = query.clone();
      const [{ count: total }] = await totalQuery.count('* as count');

      // Obtener resultados paginados
      const users = await query
        .orderBy(orderBy, orderDirection)
        .limit(limit)
        .offset(offset);

      return {
        users: users.map(user => new User(user)),
        pagination: {
          page,
          limit,
          total: parseInt(total),
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error obteniendo usuarios por tenant:', error);
      throw error;
    }
  }

  // Verificar contraseña
  async verifyPassword(password) {
    try {
      return await bcrypt.compare(password, this.passwordHash);
    } catch (error) {
      logger.error('Error verificando contraseña:', error);
      return false;
    }
  }

  // Actualizar usuario
  async update(data) {
    try {
      const updateData = {};

      if (data.name !== undefined) updateData.name = data.name;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.phone !== undefined) updateData.phone = data.phone;
      if (data.role !== undefined) updateData.role = data.role;
      if (data.preferences !== undefined) updateData.preferences = data.preferences;
      if (data.isActive !== undefined) updateData.is_active = data.isActive;
      if (data.emailVerified !== undefined) updateData.email_verified = data.emailVerified;
      if (data.phoneVerified !== undefined) updateData.phone_verified = data.phoneVerified;

      // Hash nueva contraseña si se proporciona
      if (data.password) {
        updateData.password_hash = await bcrypt.hash(data.password, 12);
      }

      updateData.updated_at = new Date();

      const [updatedUser] = await db('users')
        .where('id', this.id)
        .update(updateData)
        .returning('*');

      // Actualizar propiedades del objeto actual
      Object.assign(this, new User(updatedUser));

      // Limpiar cache
      await cache.del(`user:${this.id}`);

      logger.info('Usuario actualizado', {
        userId: this.id,
        changes: Object.keys(updateData)
      });

      return this;
    } catch (error) {
      logger.error('Error actualizando usuario:', error);
      throw error;
    }
  }

  // Actualizar último login
  async updateLastLogin() {
    try {
      await db('users')
        .where('id', this.id)
        .update({ last_login: new Date() });

      this.lastLogin = new Date();

      // Limpiar cache
      await cache.del(`user:${this.id}`);

      return this;
    } catch (error) {
      logger.error('Error actualizando último login:', error);
      throw error;
    }
  }

  // Desactivar usuario (soft delete)
  async deactivate() {
    try {
      await this.update({ isActive: false });
      
      logger.info('Usuario desactivado', { userId: this.id });
      
      return this;
    } catch (error) {
      logger.error('Error desactivando usuario:', error);
      throw error;
    }
  }

  // Verificar email
  async verifyEmail() {
    try {
      await this.update({ emailVerified: true });
      
      logger.info('Email verificado', { userId: this.id, email: this.email });
      
      return this;
    } catch (error) {
      logger.error('Error verificando email:', error);
      throw error;
    }
  }

  // Verificar teléfono
  async verifyPhone() {
    try {
      await this.update({ phoneVerified: true });
      
      logger.info('Teléfono verificado', { userId: this.id, phone: this.phone });
      
      return this;
    } catch (error) {
      logger.error('Error verificando teléfono:', error);
      throw error;
    }
  }

  // Obtener estadísticas del usuario
  async getStats() {
    try {
      const cacheKey = `user:${this.id}:stats`;
      let stats = await cache.get(cacheKey);

      if (!stats) {
        const [
          donationsCount,
          purchasesCount,
          totalDonated,
          totalPurchased
        ] = await Promise.all([
          db('donations').where('user_id', this.id).count('* as count').first(),
          db('purchases').where('user_id', this.id).count('* as count').first(),
          db('payments')
            .join('donations', 'payments.donation_id', 'donations.id')
            .where('donations.user_id', this.id)
            .where('payments.status', 'completed')
            .sum('payments.donation_amount as total')
            .first(),
          db('payments')
            .join('purchases', 'payments.purchase_id', 'purchases.id')
            .where('purchases.user_id', this.id)
            .where('payments.status', 'completed')
            .sum('payments.purchase_amount as total')
            .first()
        ]);

        stats = {
          donations: parseInt(donationsCount.count) || 0,
          purchases: parseInt(purchasesCount.count) || 0,
          totalDonated: parseFloat(totalDonated.total) || 0,
          totalPurchased: parseFloat(totalPurchased.total) || 0
        };

        // Guardar en cache por 15 minutos
        await cache.set(cacheKey, stats, 900);
      }

      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas del usuario:', error);
      throw error;
    }
  }

  // Verificar si el usuario tiene un rol específico
  hasRole(role) {
    const userRoles = Array.isArray(this.role) ? this.role : [this.role];
    return userRoles.includes(role);
  }

  // Verificar si el usuario tiene alguno de los roles especificados
  hasAnyRole(roles) {
    const userRoles = Array.isArray(this.role) ? this.role : [this.role];
    return roles.some(role => userRoles.includes(role));
  }

  // Verificar si el usuario puede realizar una acción
  canPerformAction(action) {
    const permissions = {
      'feligres': ['view_campaigns', 'create_donation', 'create_purchase', 'view_own_data'],
      'coordinador': ['view_campaigns', 'create_donation', 'create_purchase', 'view_own_data', 'manage_campaigns', 'view_donations'],
      'parroco': ['*'], // Todos los permisos
      'admin': ['*'] // Todos los permisos
    };

    const userPermissions = permissions[this.role] || [];
    return userPermissions.includes('*') || userPermissions.includes(action);
  }

  // Obtener perfil público (sin datos sensibles)
  getPublicProfile() {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      emailVerified: this.emailVerified,
      phoneVerified: this.phoneVerified,
      createdAt: this.createdAt
    };
  }

  // Serializar para respuesta JSON (sin contraseña)
  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      name: this.name,
      email: this.email,
      phone: this.phone,
      role: this.role,
      preferences: this.preferences,
      isActive: this.isActive,
      emailVerified: this.emailVerified,
      phoneVerified: this.phoneVerified,
      lastLogin: this.lastLogin,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = User;