# Guía Multi-Tenant - Pan Compartido

## Arquitectura Multi-Tenant

### Opción 1: Subdominio por Parroquia
```
parroquia1.pancompartido.com
parroquia2.pancompartido.com
```

### Opción 2: Path por Parroquia  
```
pancompartido.com/parroquia1
pancompartido.com/parroquia2
```

## Cambios Necesarios en el Código

### 1. Configuración de Tenant
```javascript
// src/config/tenant.js
export const getTenantConfig = () => {
  const subdomain = window.location.hostname.split('.')[0];
  
  const tenants = {
    'parroquia1': {
      name: 'Parroquia San José',
      logo: '/logos/san-jose.png',
      colors: { primary: '#2563eb', secondary: '#10b981' },
      phone: '300-123-4567',
      address: 'Calle 123 #45-67'
    },
    'parroquia2': {
      name: 'Parroquia Santa María',
      logo: '/logos/santa-maria.png', 
      colors: { primary: '#dc2626', secondary: '#f59e0b' },
      phone: '311-987-6543',
      address: 'Carrera 89 #12-34'
    }
  };
  
  return tenants[subdomain] || tenants['default'];
};
```

### 2. Base de Datos Separada por Tenant
```javascript
// src/services/database.js
class DatabaseService {
  constructor(tenantId) {
    this.tenantId = tenantId;
    this.prefix = `tenant_${tenantId}_`;
  }
  
  saveDonations(donations) {
    localStorage.setItem(`${this.prefix}donations`, JSON.stringify(donations));
  }
  
  getDonations() {
    return JSON.parse(localStorage.getItem(`${this.prefix}donations`) || '[]');
  }
}
```

### 3. Componente Principal Modificado
```javascript
// src/App.js - Cambios principales
import { getTenantConfig } from './config/tenant';
import DatabaseService from './services/database';

const PanCompartidoSystem = () => {
  const tenantConfig = getTenantConfig();
  const db = new DatabaseService(tenantConfig.id);
  
  // Usar tenantConfig para personalizar UI
  // Usar db para operaciones de datos
};
```

## Implementación Paso a Paso

### Fase 1: Configuración Básica
1. Crear archivo de configuración de tenants
2. Modificar componente principal para usar configuración
3. Separar datos por tenant en localStorage

### Fase 2: Personalización Visual
1. Logo y colores por parroquia
2. Información de contacto personalizada
3. Mensajes WhatsApp con nombre de parroquia

### Fase 3: Base de Datos Real
1. Implementar backend con Node.js/Express
2. Base de datos PostgreSQL con esquema multi-tenant
3. API REST para cada operación

### Fase 4: Autenticación
1. Sistema de login por parroquia
2. Roles: Admin, Encargado, Voluntario
3. Permisos diferenciados

## Estructura de Archivos Multi-Tenant
```
src/
├── config/
│   ├── tenant.js          # Configuración de parroquias
│   └── database.js        # Configuración BD por tenant
├── services/
│   ├── api.js            # Llamadas API con tenant
│   └── storage.js        # Almacenamiento separado
├── components/
│   ├── TenantProvider.js # Context de tenant
│   └── ThemedComponents/ # Componentes personalizables
└── utils/
    └── tenant-utils.js   # Utilidades multi-tenant
```

## Costos y Consideraciones

### Hosting Multi-Tenant:
- **Vercel Pro**: $20/mes - Dominios ilimitados
- **Netlify Pro**: $19/mes - Subdominios ilimitados  
- **AWS/DigitalOcean**: $10-50/mes según uso

### Base de Datos:
- **Supabase**: Gratis hasta 500MB, luego $25/mes
- **PlanetScale**: Gratis hasta 1GB, luego $29/mes
- **MongoDB Atlas**: Gratis hasta 512MB, luego $57/mes

## Próximos Pasos Recomendados

1. **Inmediato**: Implementar configuración básica de tenant
2. **1 semana**: Personalización visual por parroquia
3. **2 semanas**: Backend con base de datos real
4. **1 mes**: Sistema de autenticación completo

¿Quieres que implemente alguna de estas fases específicamente?