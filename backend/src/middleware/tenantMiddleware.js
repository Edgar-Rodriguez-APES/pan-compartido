const TenantService = require('../services/TenantService');
const logger = require('../utils/logger');

const tenantMiddleware = async (req, res, next) => {
  try {
    let tenantId = null;

    // Obtener tenant ID de diferentes fuentes
    // 1. Header X-Tenant-ID (para APIs)
    if (req.headers['x-tenant-id']) {
      tenantId = req.headers['x-tenant-id'];
    }
    // 2. Subdominio (para web)
    else if (req.headers.host) {
      const subdomain = req.headers.host.split('.')[0];
      if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
        tenantId = subdomain;
      }
    }
    // 3. Query parameter (fallback)
    else if (req.query.tenant) {
      tenantId = req.query.tenant;
    }

    if (!tenantId) {
      return res.status(400).json({
        error: 'Tenant requerido',
        message: 'Debes especificar la parroquia (tenant) para acceder a este recurso'
      });
    }

    // Usar el servicio para obtener el tenant
    const tenant = await TenantService.getTenant(tenantId);

    // Agregar tenant al request
    req.tenant = tenant.toJSON();
    req.tenantId = tenant.id;

    logger.info('Tenant identificado', {
      tenantId: tenant.id,
      tenantName: tenant.name,
      requestPath: req.path
    });

    next();
  } catch (error) {
    logger.error('Error en tenantMiddleware:', error);
    next(error);
  }
};

module.exports = tenantMiddleware;