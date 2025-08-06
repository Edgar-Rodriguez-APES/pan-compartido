const express = require('express');
const Joi = require('joi');
const UserService = require('../services/UserService');
const { requireRole } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

// Esquemas de validación
const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  email: Joi.string().email().optional(),
  phone: Joi.string().pattern(/^[0-9]{10}$/).optional(),
  preferences: Joi.object().optional()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required()
});

const adminUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  email: Joi.string().email().optional(),
  phone: Joi.string().pattern(/^[0-9]{10}$/).optional(),
  role: Joi.string().valid('feligres', 'coordinador', 'parroco', 'admin').optional(),
  isActive: Joi.boolean().optional(),
  preferences: Joi.object().optional()
});

// Obtener perfil del usuario actual
router.get('/profile', async (req, res, next) => {
  try {
    const result = await UserService.getUserWithStats(req.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Actualizar perfil del usuario actual
router.put('/profile', async (req, res, next) => {
  try {
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const updatedUser = await UserService.updateUserProfile(
      req.userId,
      value,
      req.userId
    );

    res.json({
      message: 'Perfil actualizado exitosamente',
      user: updatedUser.toJSON()
    });
  } catch (error) {
    if (error.message === 'EMAIL_ALREADY_EXISTS') {
      return res.status(409).json({
        error: 'Email ya en uso',
        message: 'Ya existe otro usuario con este email'
      });
    }
    if (error.message === 'PHONE_ALREADY_EXISTS') {
      return res.status(409).json({
        error: 'Teléfono ya en uso',
        message: 'Ya existe otro usuario con este teléfono'
      });
    }
    next(error);
  }
});

// Cambiar contraseña
router.put('/password', async (req, res, next) => {
  try {
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    await UserService.changePassword(
      req.userId,
      value.currentPassword,
      value.newPassword,
      req.userId
    );

    res.json({
      message: 'Contraseña cambiada exitosamente'
    });
  } catch (error) {
    if (error.message === 'INVALID_CURRENT_PASSWORD') {
      return res.status(400).json({
        error: 'Contraseña actual incorrecta',
        message: 'La contraseña actual que ingresaste no es correcta'
      });
    }
    next(error);
  }
});

// Verificar email
router.post('/verify-email', async (req, res, next) => {
  try {
    const { verificationToken } = req.body;
    
    const user = await UserService.verifyEmail(req.userId, verificationToken);

    res.json({
      message: 'Email verificado exitosamente',
      user: user.toJSON()
    });
  } catch (error) {
    next(error);
  }
});

// Verificar teléfono
router.post('/verify-phone', async (req, res, next) => {
  try {
    const { verificationCode } = req.body;
    
    const user = await UserService.verifyPhone(req.userId, verificationCode);

    res.json({
      message: 'Teléfono verificado exitosamente',
      user: user.toJSON()
    });
  } catch (error) {
    next(error);
  }
});

// Listar usuarios del tenant (solo coordinadores, párrocos y admins)
router.get('/', requireRole(['coordinador', 'parroco', 'admin']), async (req, res, next) => {
  try {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      role: req.query.role || null,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : null,
      search: req.query.search || null,
      orderBy: req.query.orderBy || 'created_at',
      orderDirection: req.query.orderDirection || 'desc'
    };

    const result = await UserService.listTenantUsers(
      req.tenantId,
      options,
      req.userId
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Buscar usuarios (solo coordinadores, párrocos y admins)
router.get('/search', requireRole(['coordinador', 'parroco', 'admin']), async (req, res, next) => {
  try {
    const { q: searchTerm } = req.query;

    if (!searchTerm || searchTerm.length < 2) {
      return res.status(400).json({
        error: 'Término de búsqueda requerido',
        message: 'Debes proporcionar al menos 2 caracteres para buscar'
      });
    }

    const users = await UserService.searchUsers(
      req.tenantId,
      searchTerm,
      req.userId
    );

    res.json({
      users: users.map(user => user.toJSON())
    });
  } catch (error) {
    next(error);
  }
});

// Obtener usuario específico (solo coordinadores, párrocos y admins)
router.get('/:userId', requireRole(['coordinador', 'parroco', 'admin']), async (req, res, next) => {
  try {
    const result = await UserService.getUserWithStats(
      req.params.userId,
      req.userId
    );

    res.json(result);
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'El usuario especificado no existe'
      });
    }
    if (error.message === 'INSUFFICIENT_PERMISSIONS') {
      return res.status(403).json({
        error: 'Permisos insuficientes',
        message: 'No tienes permisos para ver este usuario'
      });
    }
    next(error);
  }
});

// Actualizar usuario específico (solo párrocos y admins)
router.put('/:userId', requireRole(['parroco', 'admin']), async (req, res, next) => {
  try {
    const { error, value } = adminUpdateSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const updatedUser = await UserService.updateUserProfile(
      req.params.userId,
      value,
      req.userId
    );

    res.json({
      message: 'Usuario actualizado exitosamente',
      user: updatedUser.toJSON()
    });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'El usuario especificado no existe'
      });
    }
    if (error.message === 'EMAIL_ALREADY_EXISTS') {
      return res.status(409).json({
        error: 'Email ya en uso',
        message: 'Ya existe otro usuario con este email'
      });
    }
    if (error.message === 'PHONE_ALREADY_EXISTS') {
      return res.status(409).json({
        error: 'Teléfono ya en uso',
        message: 'Ya existe otro usuario con este teléfono'
      });
    }
    next(error);
  }
});

// Desactivar usuario (solo párrocos y admins)
router.delete('/:userId', requireRole(['parroco', 'admin']), async (req, res, next) => {
  try {
    const user = await UserService.deactivateUser(
      req.params.userId,
      req.userId
    );

    res.json({
      message: 'Usuario desactivado exitosamente',
      user: user.toJSON()
    });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'El usuario especificado no existe'
      });
    }
    if (error.message === 'CANNOT_DEACTIVATE_SELF') {
      return res.status(400).json({
        error: 'Acción no permitida',
        message: 'No puedes desactivar tu propia cuenta'
      });
    }
    next(error);
  }
});

// Reactivar usuario (solo párrocos y admins)
router.post('/:userId/reactivate', requireRole(['parroco', 'admin']), async (req, res, next) => {
  try {
    const user = await UserService.reactivateUser(
      req.params.userId,
      req.userId
    );

    res.json({
      message: 'Usuario reactivado exitosamente',
      user: user.toJSON()
    });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'El usuario especificado no existe'
      });
    }
    next(error);
  }
});

// Cambiar contraseña de otro usuario (solo párrocos y admins)
router.put('/:userId/password', requireRole(['parroco', 'admin']), async (req, res, next) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        error: 'Contraseña inválida',
        message: 'La nueva contraseña debe tener al menos 6 caracteres'
      });
    }

    await UserService.changePassword(
      req.params.userId,
      null, // No se requiere contraseña actual para admins
      newPassword,
      req.userId
    );

    res.json({
      message: 'Contraseña cambiada exitosamente'
    });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'El usuario especificado no existe'
      });
    }
    next(error);
  }
});

module.exports = router;