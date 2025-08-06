const express = require('express');
const Joi = require('joi');
const UserService = require('../services/UserService');
const TenantService = require('../services/TenantService');
const logger = require('../utils/logger');

const router = express.Router();

// Esquemas de validación
const registerSchema = Joi.object({
  tenantId: Joi.string().uuid().required(),
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
  password: Joi.string().min(6).required()
});

const loginSchema = Joi.object({
  tenantId: Joi.string().uuid().required(),
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Registro de usuario
router.post('/register', async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const user = await UserService.registerUser(value);
    const { token } = await UserService.authenticateUser(value.email, value.password, value.tenantId);
    
    // Obtener información del tenant
    const tenant = await TenantService.getTenant(value.tenantId);

    res.status(201).json({
      message: '¡Cuenta creada exitosamente!',
      user: user.toJSON(),
      token,
      tenant: tenant.toJSON()
    });
  } catch (error) {
    if (error.message === 'EMAIL_ALREADY_EXISTS') {
      return res.status(409).json({
        error: 'Email ya registrado',
        message: 'Ya existe una cuenta con este email en esta parroquia'
      });
    }
    if (error.message === 'PHONE_ALREADY_EXISTS') {
      return res.status(409).json({
        error: 'Teléfono ya registrado',
        message: 'Ya existe una cuenta con este teléfono en esta parroquia'
      });
    }
    if (error.message === 'TENANT_NOT_FOUND') {
      return res.status(404).json({
        error: 'Parroquia no encontrada',
        message: 'La parroquia especificada no existe'
      });
    }
    next(error);
  }
});

// Login de usuario
router.post('/login', async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const { tenantId, email, password } = value;

    const { user, token } = await UserService.authenticateUser(email, password, tenantId);
    
    // Obtener información del tenant
    const tenant = await TenantService.getTenant(tenantId);

    res.json({
      message: '¡Bienvenido de vuelta!',
      user: user.toJSON(),
      token,
      tenant: tenant.toJSON()
    });
  } catch (error) {
    if (error.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({
        error: 'Credenciales inválidas',
        message: 'Email o contraseña incorrectos'
      });
    }
    if (error.message === 'USER_INACTIVE') {
      return res.status(403).json({
        error: 'Cuenta deshabilitada',
        message: 'Tu cuenta ha sido deshabilitada. Contacta al administrador.'
      });
    }
    next(error);
  }
});

// Verificar token
router.get('/verify', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Token requerido',
        message: 'No se proporcionó token de autenticación'
      });
    }

    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await UserService.getUser(decoded.userId);
    const tenant = await TenantService.getTenant(user.tenantId);

    res.json({
      valid: true,
      user: user.toJSON(),
      tenant: tenant.toJSON()
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        valid: false,
        error: 'Token inválido',
        message: 'El token ha expirado o no es válido'
      });
    }
    if (error.message === 'USER_NOT_FOUND' || error.message === 'USER_INACTIVE') {
      return res.status(401).json({
        valid: false,
        error: 'Token inválido',
        message: 'El token no es válido o el usuario no existe'
      });
    }
    next(error);
  }
});

module.exports = router;