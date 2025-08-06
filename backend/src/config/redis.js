const redis = require('redis');
const logger = require('../utils/logger');

const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      logger.error('Redis server rechazó la conexión');
      return new Error('Redis server rechazó la conexión');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      logger.error('Tiempo de reintento de Redis agotado');
      return new Error('Tiempo de reintento agotado');
    }
    if (options.attempt > 10) {
      logger.error('Máximo número de reintentos de Redis alcanzado');
      return undefined;
    }
    // Reconectar después de
    return Math.min(options.attempt * 100, 3000);
  }
});

client.on('connect', () => {
  logger.info('✅ Conectado a Redis');
});

client.on('error', (err) => {
  logger.error('❌ Error de Redis:', err);
});

client.on('ready', () => {
  logger.info('🚀 Redis listo para usar');
});

// Funciones helper para cache
const cache = {
  get: async (key) => {
    try {
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Error obteniendo del cache:', error);
      return null;
    }
  },

  set: async (key, value, expireInSeconds = 3600) => {
    try {
      await client.setex(key, expireInSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error('Error guardando en cache:', error);
      return false;
    }
  },

  del: async (key) => {
    try {
      await client.del(key);
      return true;
    } catch (error) {
      logger.error('Error eliminando del cache:', error);
      return false;
    }
  },

  exists: async (key) => {
    try {
      const exists = await client.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error('Error verificando existencia en cache:', error);
      return false;
    }
  }
};

module.exports = { client, cache };