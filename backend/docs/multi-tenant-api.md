# API Multi-Tenant - Pan Compartido

## Introducción

La plataforma Pan Compartido utiliza un sistema multi-tenant que permite que múltiples parroquias operen de forma independiente en la misma infraestructura. Cada parroquia (tenant) tiene sus propios datos aislados y configuración personalizada.

## Identificación de Tenant

Para acceder a los recursos de una parroquia específica, debes identificar el tenant de una de las siguientes maneras:

### 1. Header HTTP (Recomendado para APIs)
```http
X-Tenant-ID: parroquia-san-jose
```

### 2. Subdominio (Para aplicaciones web)
```
https://san-jose.pancompartido.org/api/campaigns
```

### 3. Query Parameter (Fallback)
```
GET /api/campaigns?tenant=parroquia-san-jose
```

## Endpoints de Gestión de Tenants

### Obtener información del tenant actual
```http
GET /api/tenants/current
X-Tenant-ID: parroquia-san-jose
Authorization: Bearer <token>
```

**Respuesta:**
```json
{
  "tenant": {
    "id": "uuid",
    "name": "Parroquia San José",
    "slug": "parroquia-san-jose",
    "logoUrl": "/logos/san-jose.png",
    "branding": {
      "colors": {
        "primary": "#2563eb",
        "secondary": "#10b981"
      }
    },
    "contactInfo": {
      "phone": "300-123-4567",
      "email": "contacto@parroquiasanjose.org",
      "address": "Calle 123 #45-67, Bogotá"
    },
    "settings": {
      "campaignFrequency": "weekly",
      "minOrderAmount": 50000,
      "platformFeePercentage": 5
    },
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "stats": {
    "users": 150,
    "campaigns": 12,
    "donations": 450,
    "purchases": 89,
    "totalRaised": 2500000
  }
}
```

### Actualizar configuración del tenant
```http
PUT /api/tenants/current
X-Tenant-ID: parroquia-san-jose
Authorization: Bearer <token>
Content-Type: application/json
```

**Cuerpo de la petición:**
```json
{
  "branding": {
    "colors": {
      "primary": "#1e40af",
      "secondary": "#059669"
    }
  },
  "contactInfo": {
    "phone": "300-555-0123",
    "email": "nuevo@parroquiasanjose.org"
  },
  "settings": {
    "campaignFrequency": "biweekly",
    "minOrderAmount": 75000
  }
}
```

**Respuesta:**
```json
{
  "message": "Configuración actualizada exitosamente",
  "tenant": {
    // ... datos actualizados del tenant
  }
}
```

### Crear nuevo tenant (Solo super admins)
```http
POST /api/tenants
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Cuerpo de la petición:**
```json
{
  "name": "Parroquia Santa María",
  "slug": "santa-maria",
  "branding": {
    "colors": {
      "primary": "#dc2626",
      "secondary": "#ea580c"
    }
  },
  "contactInfo": {
    "phone": "300-555-0001",
    "email": "contacto@santamaria.org",
    "address": "Carrera 15 #32-45, Medellín"
  },
  "settings": {
    "campaignFrequency": "weekly",
    "minOrderAmount": 60000,
    "platformFeePercentage": 4
  }
}
```

### Listar todos los tenants (Solo super admins)
```http
GET /api/tenants?page=1&limit=20&search=san&isActive=true
Authorization: Bearer <admin-token>
```

**Respuesta:**
```json
{
  "tenants": [
    {
      "id": "uuid",
      "name": "Parroquia San José",
      "slug": "parroquia-san-jose",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

## Aislamiento de Datos

### Principios de Aislamiento

1. **Separación por tenant_id**: Todas las tablas principales incluyen una columna `tenant_id` que referencia al tenant propietario de los datos.

2. **Middleware automático**: El middleware `tenantMiddleware` se encarga de:
   - Identificar el tenant de la petición
   - Validar que el tenant existe y está activo
   - Agregar el contexto del tenant al objeto `req`
   - Proporcionar utilidades de consulta con aislamiento automático

3. **Consultas seguras**: La utilidad `TenantQuery` asegura que todas las operaciones de base de datos incluyan automáticamente el filtro por `tenant_id`.

### Tablas con Aislamiento de Tenant

- `users` - Usuarios de cada parroquia
- `campaigns` - Campañas de donación
- `donations` - Donaciones realizadas
- `purchases` - Compras personales
- `payments` - Pagos procesados

### Tablas Globales (Sin tenant_id)

- `products` - Catálogo de productos compartido
- `tenants` - Información de las parroquias

## Uso de TenantQuery en Controladores

### Ejemplo básico
```javascript
const express = require('express');
const tenantMiddleware = require('../middleware/tenantMiddleware');

const router = express.Router();

// Aplicar middleware de tenant a todas las rutas
router.use(tenantMiddleware);

router.get('/campaigns', async (req, res) => {
  try {
    // req.tenantQuery ya está disponible con aislamiento automático
    const campaigns = await req.tenantQuery.table('campaigns')
      .where('status', 'active')
      .orderBy('created_at', 'desc');

    res.json({ campaigns });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/campaigns', async (req, res) => {
  try {
    // El tenant_id se agrega automáticamente
    const [campaign] = await req.tenantQuery.insert('campaigns', {
      title: req.body.title,
      description: req.body.description,
      created_by: req.user.id,
      status: 'draft'
    }).returning('*');

    res.status(201).json({ campaign });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Ejemplo con paginación
```javascript
router.get('/users', async (req, res) => {
  try {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      where: req.query.role ? { role: req.query.role } : {},
      orderBy: 'name'
    };

    const result = await req.tenantQuery.findWithPagination('users', options);

    res.json({
      users: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Ejemplo con transacciones
```javascript
router.post('/donations', async (req, res) => {
  try {
    const result = await req.tenantQuery.transaction(async (trx) => {
      // Crear donación
      const [donation] = await trx.insert('donations', {
        campaign_id: req.body.campaignId,
        user_id: req.user.id,
        items: req.body.items,
        estimated_value: req.body.estimatedValue
      }).returning('*');

      // Actualizar progreso de campaña
      await trx.update('campaigns', 
        { raised_amount: trx.raw('raised_amount + ?', [req.body.estimatedValue]) },
        { id: req.body.campaignId }
      );

      return donation;
    });

    res.status(201).json({ donation: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Validación de Permisos por Tenant

### Middleware de validación de acceso
```javascript
const validateTenantAccess = async (req, res, next) => {
  try {
    // Verificar que el usuario pertenece al tenant
    const hasAccess = await req.tenantQuery.validateOwnership('users', req.user.id);
    
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tienes permisos para acceder a este tenant'
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

### Validación de propiedad de recursos
```javascript
router.get('/campaigns/:id', async (req, res) => {
  try {
    // Verificar que la campaña pertenece al tenant actual
    const isOwner = await req.tenantQuery.validateOwnership('campaigns', req.params.id);
    
    if (!isOwner) {
      return res.status(404).json({
        error: 'Campaña no encontrada'
      });
    }

    const campaign = await req.tenantQuery.findById('campaigns', req.params.id);
    res.json({ campaign });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Configuración de Branding por Tenant

### Obtener configuración de branding
```http
GET /api/branding
X-Tenant-ID: parroquia-san-jose
```

**Respuesta:**
```json
{
  "name": "Parroquia San José",
  "slug": "parroquia-san-jose",
  "logoUrl": "/logos/san-jose.png",
  "colors": {
    "primary": "#2563eb",
    "secondary": "#10b981"
  },
  "contactInfo": {
    "phone": "300-123-4567",
    "email": "contacto@parroquiasanjose.org",
    "address": "Calle 123 #45-67, Bogotá"
  }
}
```

## Manejo de Errores Multi-Tenant

### Errores comunes

**Tenant no especificado:**
```json
{
  "error": "Tenant requerido",
  "message": "Debes especificar la parroquia (tenant) para acceder a este recurso"
}
```

**Tenant no encontrado:**
```json
{
  "error": "TENANT_NOT_FOUND",
  "message": "La parroquia especificada no existe"
}
```

**Tenant inactivo:**
```json
{
  "error": "TENANT_INACTIVE",
  "message": "La parroquia especificada está desactivada"
}
```

**Acceso denegado:**
```json
{
  "error": "USER_NO_ACCESS_TO_TENANT",
  "message": "No tienes permisos para acceder a esta parroquia"
}
```

## Mejores Prácticas

### 1. Siempre usar TenantQuery
```javascript
// ❌ Incorrecto - consulta directa sin aislamiento
const users = await db('users').select('*');

// ✅ Correcto - consulta con aislamiento automático
const users = await req.tenantQuery.table('users').select('*');
```

### 2. Validar propiedad de recursos
```javascript
// ✅ Siempre validar antes de operaciones sensibles
const isOwner = await req.tenantQuery.validateOwnership('campaigns', campaignId);
if (!isOwner) {
  return res.status(404).json({ error: 'Recurso no encontrado' });
}
```

### 3. Usar transacciones para operaciones complejas
```javascript
// ✅ Usar transacciones para mantener consistencia
await req.tenantQuery.transaction(async (trx) => {
  // Múltiples operaciones relacionadas
});
```

### 4. Cachear configuración de tenant
```javascript
// ✅ La configuración de branding se cachea automáticamente
const branding = await TenantService.getBrandingConfig(req.tenantId);
```

### 5. Logs con contexto de tenant
```javascript
logger.info('Operación realizada', {
  tenantId: req.tenantId,
  tenantName: req.tenant.name,
  userId: req.user.id,
  operation: 'create_campaign'
});
```

## Monitoreo y Métricas

### Estadísticas por tenant
```javascript
// Obtener estadísticas del tenant actual
const stats = await req.tenantQuery.getStats();

// Respuesta incluye:
// - users: número de usuarios activos
// - campaigns: número de campañas
// - donations: número de donaciones
// - purchases: número de compras
// - totalRaised: total recaudado
```

### Salud del tenant
```javascript
const health = await TenantService.checkTenantHealth(tenantId);
// Retorna: { healthy: boolean, reason?: string }
```

Esta documentación proporciona una guía completa para trabajar con el sistema multi-tenant de Pan Compartido, asegurando el aislamiento correcto de datos y la seguridad entre parroquias.