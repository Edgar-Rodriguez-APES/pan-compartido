const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  // Log del error
  logger.logError(err, req);

  // Error de validación de Joi
  if (err.isJoi) {
    return res.status(400).json({
      error: 'Datos inválidos',
      message: 'Por favor verifica los datos enviados',
      details: err.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  // Error de base de datos
  if (err.code === '23505') { // Unique violation
    return res.status(409).json({
      error: 'Conflicto de datos',
      message: 'Ya existe un registro con estos datos'
    });
  }

  if (err.code === '23503') { // Foreign key violation
    return res.status(400).json({
      error: 'Referencia inválida',
      message: 'Los datos hacen referencia a un registro que no existe'
    });
  }

  // Error de JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Token inválido',
      message: 'Tu sesión ha expirado, por favor inicia sesión nuevamente'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Sesión expirada',
      message: 'Tu sesión ha expirado, por favor inicia sesión nuevamente'
    });
  }

  // Error de autorización
  if (err.status === 403) {
    return res.status(403).json({
      error: 'Acceso denegado',
      message: 'No tienes permisos para realizar esta acción'
    });
  }

  // Error de tenant no encontrado
  if (err.message === 'TENANT_NOT_FOUND') {
    return res.status(404).json({
      error: 'Parroquia no encontrada',
      message: 'La parroquia especificada no existe o no está activa'
    });
  }

  // Error de pago
  if (err.type === 'StripeCardError') {
    return res.status(400).json({
      error: 'Error de pago',
      message: 'Hubo un problema con tu tarjeta. Por favor verifica los datos e intenta nuevamente.'
    });
  }

  // Error de WhatsApp
  if (err.code === 'WHATSAPP_ERROR') {
    return res.status(500).json({
      error: 'Error de WhatsApp',
      message: 'No pudimos enviar el mensaje por WhatsApp. Intenta nuevamente.'
    });
  }

  // Errores HTTP conocidos
  if (err.status) {
    return res.status(err.status).json({
      error: err.message || 'Error del servidor',
      message: 'Ocurrió un error procesando tu solicitud'
    });
  }

  // Error genérico del servidor
  res.status(500).json({
    error: 'Error interno del servidor',
    message: 'Algo salió mal de nuestro lado. Nuestro equipo ha sido notificado.',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err.message
    })
  });
};

module.exports = errorHandler;