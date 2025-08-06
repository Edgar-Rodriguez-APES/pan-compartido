const User = require('../models/User');
const TenantService = require('./TenantService');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { cache } = require('../config/redis');

class UserService {
  // Registrar nuevo usuario
  static async registerUser(userData) {
    try {
      // Verificar que el tenant existe y está activo
      const tenant = await TenantService.getTenant(userData.tenantId);

      // Verificar que el email no esté en uso en este tenant
      const existingUserByEmail = await User.findByEmailAndTenant(
        userData.email,
        userData.tenantId
      );

      if (existingUserByEmail) {
        throw new Error('EMAIL_ALREADY_EXISTS');
      }

      // Verificar que el teléfono no esté en uso en este tenant
      const existingUserByPhone = await User.findByPhoneAndTenant(
        userData.phone,
        userData.tenantId
      );

      if (existingUserByPhone) {
        throw new Error('PHONE_ALREADY_EXISTS');
      }

      // Crear usuario
      const user = await User.create({
        tenantId: userData.tenantId,
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        password: userData.password,
        role: userData.role || 'feligres',
        preferences: userData.preferences || {}
      });

      logger.info('Usuario registrado exitosamente', {
        userId: user.id,
        email: user.email,
        tenantId: user.tenantId
      });

      return user;
    } catch (error) {
      logger.error('Error en UserService.registerUser:', error);
      throw error;
    }
  }

  // Autenticar usuario
  static async authenticateUser(email, password, tenantId) {
    try {
      // Buscar usuario por email y tenant
      const user = await User.findByEmailAndTenant(email, tenantId);

      if (!user) {
        throw new Error('INVALID_CREDENTIALS');
      }

      // Verificar que el usuario esté activo
      if (!user.isActive) {
        throw new Error('USER_INACTIVE');
      }

      // Verificar contraseña
      const isValidPassword = await user.verifyPassword(password);
      if (!isValidPassword) {
        throw new Error('INVALID_CREDENTIALS');
      }

      // Actualizar último login
      await user.updateLastLogin();

      // Generar JWT
      const token = jwt.sign(
        { 
          userId: user.id, 
          tenantId: user.tenantId,
          role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      logger.info('Usuario autenticado exitosamente', {
        userId: user.id,
        email: user.email,
        tenantId: user.tenantId
      });

      return { user, token };
    } catch (error) {
      logger.error('Error en UserService.authenticateUser:', error);
      throw error;
    }
  }

  // Obtener usuario con validaciones
  static async getUser(userId, requestingUserId = null) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      if (!user.isActive) {
        throw new Error('USER_INACTIVE');
      }

      // Si no es el mismo usuario, verificar permisos
      if (requestingUserId && requestingUserId !== userId) {
        const requestingUser = await User.findById(requestingUserId);
        
        if (!requestingUser || !requestingUser.hasAnyRole(['parroco', 'admin', 'coordinador'])) {
          throw new Error('INSUFFICIENT_PERMISSIONS');
        }

        // Verificar que ambos usuarios pertenezcan al mismo tenant
        if (requestingUser.tenantId !== user.tenantId) {
          throw new Error('CROSS_TENANT_ACCESS_DENIED');
        }
      }

      return user;
    } catch (error) {
      logger.error('Error en UserService.getUser:', error);
      throw error;
    }
  }

  // Obtener usuario con estadísticas
  static async getUserWithStats(userId, requestingUserId = null) {
    try {
      const user = await this.getUser(userId, requestingUserId);
      const stats = await user.getStats();

      return {
        user: user.toJSON(),
        stats
      };
    } catch (error) {
      logger.error('Error en UserService.getUserWithStats:', error);
      throw error;
    }
  }

  // Actualizar perfil de usuario
  static async updateUserProfile(userId, updateData, requestingUserId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      // Verificar permisos
      if (requestingUserId !== userId) {
        const requestingUser = await User.findById(requestingUserId);
        
        if (!requestingUser || !requestingUser.hasAnyRole(['parroco', 'admin'])) {
          throw new Error('INSUFFICIENT_PERMISSIONS');
        }

        // Verificar que ambos usuarios pertenezcan al mismo tenant
        if (requestingUser.tenantId !== user.tenantId) {
          throw new Error('CROSS_TENANT_ACCESS_DENIED');
        }
      }

      // Validar que el email no esté en uso por otro usuario
      if (updateData.email && updateData.email !== user.email) {
        const existingUser = await User.findByEmailAndTenant(
          updateData.email,
          user.tenantId
        );

        if (existingUser && existingUser.id !== user.id) {
          throw new Error('EMAIL_ALREADY_EXISTS');
        }

        // Marcar email como no verificado si cambió
        updateData.emailVerified = false;
      }

      // Validar que el teléfono no esté en uso por otro usuario
      if (updateData.phone && updateData.phone !== user.phone) {
        const existingUser = await User.findByPhoneAndTenant(
          updateData.phone,
          user.tenantId
        );

        if (existingUser && existingUser.id !== user.id) {
          throw new Error('PHONE_ALREADY_EXISTS');
        }

        // Marcar teléfono como no verificado si cambió
        updateData.phoneVerified = false;
      }

      // Solo admins y párrocos pueden cambiar roles
      if (updateData.role && requestingUserId !== userId) {
        const requestingUser = await User.findById(requestingUserId);
        if (!requestingUser.hasAnyRole(['parroco', 'admin'])) {
          delete updateData.role;
        }
      }

      await user.update(updateData);

      logger.info('Perfil de usuario actualizado', {
        userId: user.id,
        updatedBy: requestingUserId,
        changes: Object.keys(updateData)
      });

      return user;
    } catch (error) {
      logger.error('Error en UserService.updateUserProfile:', error);
      throw error;
    }
  }

  // Listar usuarios de un tenant
  static async listTenantUsers(tenantId, options = {}, requestingUserId) {
    try {
      // Verificar permisos del usuario solicitante
      const requestingUser = await User.findById(requestingUserId);
      
      if (!requestingUser || !requestingUser.hasAnyRole(['parroco', 'admin', 'coordinador'])) {
        throw new Error('INSUFFICIENT_PERMISSIONS');
      }

      // Verificar que el usuario pertenezca al tenant
      if (requestingUser.tenantId !== tenantId) {
        throw new Error('CROSS_TENANT_ACCESS_DENIED');
      }

      const result = await User.findByTenant(tenantId, options);

      logger.info('Usuarios listados', {
        tenantId,
        requestedBy: requestingUserId,
        page: options.page || 1,
        total: result.pagination.total
      });

      return result;
    } catch (error) {
      logger.error('Error en UserService.listTenantUsers:', error);
      throw error;
    }
  }

  // Cambiar contraseña
  static async changePassword(userId, currentPassword, newPassword, requestingUserId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      // Solo el mismo usuario o un admin puede cambiar la contraseña
      if (requestingUserId !== userId) {
        const requestingUser = await User.findById(requestingUserId);
        
        if (!requestingUser || !requestingUser.hasAnyRole(['parroco', 'admin'])) {
          throw new Error('INSUFFICIENT_PERMISSIONS');
        }
      }

      // Si es el mismo usuario, verificar contraseña actual
      if (requestingUserId === userId) {
        const isValidPassword = await user.verifyPassword(currentPassword);
        if (!isValidPassword) {
          throw new Error('INVALID_CURRENT_PASSWORD');
        }
      }

      await user.update({ password: newPassword });

      logger.info('Contraseña cambiada', {
        userId: user.id,
        changedBy: requestingUserId
      });

      return { success: true };
    } catch (error) {
      logger.error('Error en UserService.changePassword:', error);
      throw error;
    }
  }

  // Verificar email
  static async verifyEmail(userId, verificationToken) {
    try {
      // En una implementación real, aquí verificarías el token
      // Por ahora, simplemente marcamos como verificado
      const user = await User.findById(userId);

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      await user.verifyEmail();

      logger.info('Email verificado', {
        userId: user.id,
        email: user.email
      });

      return user;
    } catch (error) {
      logger.error('Error en UserService.verifyEmail:', error);
      throw error;
    }
  }

  // Verificar teléfono
  static async verifyPhone(userId, verificationCode) {
    try {
      // En una implementación real, aquí verificarías el código SMS
      // Por ahora, simplemente marcamos como verificado
      const user = await User.findById(userId);

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      await user.verifyPhone();

      logger.info('Teléfono verificado', {
        userId: user.id,
        phone: user.phone
      });

      return user;
    } catch (error) {
      logger.error('Error en UserService.verifyPhone:', error);
      throw error;
    }
  }

  // Desactivar usuario
  static async deactivateUser(userId, requestingUserId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      // Solo admins y párrocos pueden desactivar usuarios
      const requestingUser = await User.findById(requestingUserId);
      
      if (!requestingUser || !requestingUser.hasAnyRole(['parroco', 'admin'])) {
        throw new Error('INSUFFICIENT_PERMISSIONS');
      }

      // Verificar que ambos usuarios pertenezcan al mismo tenant
      if (requestingUser.tenantId !== user.tenantId) {
        throw new Error('CROSS_TENANT_ACCESS_DENIED');
      }

      // No permitir que un usuario se desactive a sí mismo
      if (requestingUserId === userId) {
        throw new Error('CANNOT_DEACTIVATE_SELF');
      }

      await user.deactivate();

      logger.info('Usuario desactivado', {
        userId: user.id,
        deactivatedBy: requestingUserId
      });

      return user;
    } catch (error) {
      logger.error('Error en UserService.deactivateUser:', error);
      throw error;
    }
  }

  // Reactivar usuario
  static async reactivateUser(userId, requestingUserId) {
    try {
      const user = await User.findById(userId);

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      // Solo admins y párrocos pueden reactivar usuarios
      const requestingUser = await User.findById(requestingUserId);
      
      if (!requestingUser || !requestingUser.hasAnyRole(['parroco', 'admin'])) {
        throw new Error('INSUFFICIENT_PERMISSIONS');
      }

      // Verificar que ambos usuarios pertenezcan al mismo tenant
      if (requestingUser.tenantId !== user.tenantId) {
        throw new Error('CROSS_TENANT_ACCESS_DENIED');
      }

      await user.update({ isActive: true });

      logger.info('Usuario reactivado', {
        userId: user.id,
        reactivatedBy: requestingUserId
      });

      return user;
    } catch (error) {
      logger.error('Error en UserService.reactivateUser:', error);
      throw error;
    }
  }

  // Buscar usuarios por criterios
  static async searchUsers(tenantId, searchTerm, requestingUserId) {
    try {
      // Verificar permisos del usuario solicitante
      const requestingUser = await User.findById(requestingUserId);
      
      if (!requestingUser || !requestingUser.hasAnyRole(['parroco', 'admin', 'coordinador'])) {
        throw new Error('INSUFFICIENT_PERMISSIONS');
      }

      // Verificar que el usuario pertenezca al tenant
      if (requestingUser.tenantId !== tenantId) {
        throw new Error('CROSS_TENANT_ACCESS_DENIED');
      }

      const result = await User.findByTenant(tenantId, {
        search: searchTerm,
        limit: 50 // Limitar resultados de búsqueda
      });

      return result.users;
    } catch (error) {
      logger.error('Error en UserService.searchUsers:', error);
      throw error;
    }
  }

  // Limpiar cache de usuario
  static async clearUserCache(userId) {
    try {
      const cacheKeys = [
        `user:${userId}`,
        `user:${userId}:stats`
      ];

      await Promise.all(cacheKeys.map(key => cache.del(key)));

      logger.info('Cache de usuario limpiado', { userId });
    } catch (error) {
      logger.error('Error limpiando cache de usuario:', error);
    }
  }
}

module.exports = UserService;