const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

const authMiddleware = async (req, res, next) => {
  try {
    // Obtener token del header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Token requerido',
        message: 'Debes iniciar sesión para acceder a este recurso'
      });
    }

    const token = authHeader.substring(7); // Remover 'Bearer '

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Buscar usuario en cache primero
    const cacheKey = `user:${decoded.userId}`;
    let user = await cache.get(cacheKey);

    if (!user) {
      // Si no está en cache, buscar en base de datos
      user = await db('users')
        .where('id', decoded.userId)
        .first();

      if (!user) {
        return res.status(401).json({
          error: 'Usuario no encontrado',
          message: 'Tu sesión ha expirado, por favor inicia sesión nuevamente'
        });
      }

      // Guardar en cache por 30 minutos
      await cache.set(cacheKey, user, 1800);
    }

    // Verificar que el usuario esté activo
    if (!user.is_active) {
      return res.status(403).json({
        error: 'Usuario inactivo',
        message: 'Tu cuenta ha sido deshabilitada. Contacta al administrador.'
      });
    }

    // Verificar que el usuario pertenezca al tenant (si hay tenant en el request)
    if (req.tenantId && user.tenant_id !== req.tenantId) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tienes permisos para acceder a los datos de esta parroquia'
      });
    }

    // Agregar usuario al request
    req.user = user;
    req.userId = user.id;

    logger.info('Usuario autenticado', {
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      tenantId: user.tenant_id,
      requestPath: req.path
    });

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'Tu sesión ha expirado, por favor inicia sesión nuevamente'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Sesión expirada',
        message: 'Tu sesión ha expirado, por favor inicia sesión nuevamente'
      });
    }

    logger.error('Error en authMiddleware:', error);
    next(error);
  }
};

// Middleware para verificar roles específicos
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'No autenticado',
        message: 'Debes iniciar sesión para acceder a este recurso'
      });
    }

    const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
    const requiredRoles = Array.isArray(roles) ? roles : [roles];

    const hasRole = requiredRoles.some(role => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        error: 'Permisos insuficientes',
        message: `Necesitas uno de estos roles: ${requiredRoles.join(', ')}`
      });
    }

    next();
  };
};

module.exports = { authMiddleware, requireRole };