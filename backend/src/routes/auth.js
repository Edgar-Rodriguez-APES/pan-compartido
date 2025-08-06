const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const db = require('../config/database');
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

    const { tenantId, name, email, phone, password } = value;

    // Verificar que el tenant existe
    const tenant = await db('tenants').where('id', tenantId).first();
    if (!tenant) {
      return res.status(404).json({
        error: 'Parroquia no encontrada',
        message: 'La parroquia especificada no existe'
      });
    }

    // Verificar que el email no esté en uso en este tenant
    const existingUser = await db('users')
      .where('tenant_id', tenantId)
      .where('email', email)
      .first();

    if (existingUser) {
      return res.status(409).json({
        error: 'Email ya registrado',
        message: 'Ya existe una cuenta con este email en esta parroquia'
      });
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 12);

    // Crear usuario
    const [user] = await db('users')
      .insert({
        tenant_id: tenantId,
        name,
        email,
        phone,
        password_hash: passwordHash,
        role: 'feligres'
      })
      .returning(['id', 'name', 'email', 'phone', 'role', 'tenant_id']);

    // Generar JWT
    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    logger.info('Usuario registrado', {
      userId: user.id,
      email: user.email,
      tenantId: user.tenant_id
    });

    res.status(201).json({
      message: '¡Cuenta creada exitosamente!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        tenantId: user.tenant_id
      },
      token,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug
      }
    });
  } catch (error) {
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

    // Buscar usuario
    const user = await db('users')
      .where('tenant_id', tenantId)
      .where('email', email)
      .first();

    if (!user) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
        message: 'Email o contraseña incorrectos'
      });
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
        message: 'Email o contraseña incorrectos'
      });
    }

    // Verificar que el usuario esté activo
    if (!user.is_active) {
      return res.status(403).json({
        error: 'Cuenta deshabilitada',
        message: 'Tu cuenta ha sido deshabilitada. Contacta al administrador.'
      });
    }

    // Actualizar último login
    await db('users')
      .where('id', user.id)
      .update({ last_login: new Date() });

    // Generar JWT
    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Obtener información del tenant
    const tenant = await db('tenants').where('id', user.tenant_id).first();

    logger.info('Usuario logueado', {
      userId: user.id,
      email: user.email,
      tenantId: user.tenant_id
    });

    res.json({
      message: '¡Bienvenido de vuelta!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        tenantId: user.tenant_id
      },
      token,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        branding: tenant.branding
      }
    });
  } catch (error) {
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await db('users')
      .where('id', decoded.userId)
      .first();

    if (!user || !user.is_active) {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'El token no es válido o el usuario no existe'
      });
    }

    const tenant = await db('tenants').where('id', user.tenant_id).first();

    res.json({
      valid: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        tenantId: user.tenant_id
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        branding: tenant.branding
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        valid: false,
        error: 'Token inválido',
        message: 'El token ha expirado o no es válido'
      });
    }
    next(error);
  }
});

module.exports = router;