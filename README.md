# Red Pan Compartido

Sistema multi-parroquial de gestión de donaciones que conecta donantes, consumidores y proveedores para facilitar la distribución de mercados alimenticios a familias necesitadas.

## 🏗️ Arquitectura

La plataforma utiliza una arquitectura de microservicios con:

- **Frontend**: React.js con Tailwind CSS
- **Backend**: Node.js con Express
- **Base de Datos**: PostgreSQL con esquema multi-tenant
- **Cache**: Redis para sesiones y datos frecuentes
- **Autenticación**: JWT con roles y permisos

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 18+ 
- PostgreSQL 13+
- Redis 6+
- npm o yarn

### Instalación

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd pan-compartido
```

2. **Instalar dependencias del frontend**
```bash
npm install
```

3. **Instalar dependencias del backend**
```bash
cd backend
npm install
```

4. **Configurar variables de entorno**
```bash
cd backend
cp .env.example .env
# Editar .env con tus configuraciones
```

5. **Configurar base de datos**
```bash
# Crear base de datos PostgreSQL
createdb pan_compartido

# Ejecutar migraciones
npm run migrate

# Cargar datos de prueba
npm run seed
```

6. **Iniciar servicios**

Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

Terminal 2 (Frontend):
```bash
npm start
```

## 🔐 Credenciales de Prueba

**Tenant Demo**: `demo`
- **Párroco**: admin@demo.pancompartido.org / admin123
- **Feligrés**: maria@example.com / feligres123

## 📁 Estructura del Proyecto

```
pan-compartido/
├── backend/                 # API Backend
│   ├── src/
│   │   ├── routes/         # Rutas de la API
│   │   ├── middleware/     # Middleware personalizado
│   │   ├── config/         # Configuraciones
│   │   └── utils/          # Utilidades
│   ├── migrations/         # Migraciones de BD
│   └── seeds/             # Datos de prueba
├── src/                    # Frontend React
│   ├── components/        # Componentes React
│   ├── contexts/          # Contextos (Auth, etc.)
│   ├── services/          # Servicios API
│   └── utils/             # Utilidades
├── .kiro/specs/           # Especificaciones del proyecto
└── docs/                  # Documentación
```

## 🌟 Características Principales

### ✅ Implementado
- [x] Arquitectura multi-tenant
- [x] Sistema de autenticación JWT
- [x] Base de datos PostgreSQL con migraciones
- [x] API REST con middleware de seguridad
- [x] Frontend React con contexto de autenticación
- [x] Interfaz de login responsiva

### 🚧 En Desarrollo
- [ ] Sistema de campañas y donaciones
- [ ] Integración con pasarelas de pago
- [ ] WhatsApp Bot
- [ ] Dashboard para párrocos
- [ ] Sistema de proveedores y subastas

## 🔧 Scripts Disponibles

### Frontend
```bash
npm start          # Servidor de desarrollo
npm run build      # Build de producción
npm test           # Ejecutar tests
```

### Backend
```bash
npm run dev        # Servidor con nodemon
npm start          # Servidor de producción
npm run migrate    # Ejecutar migraciones
npm run seed       # Cargar datos de prueba
npm test           # Ejecutar tests
```

## 🌐 API Endpoints

### Autenticación
- `POST /api/v1/auth/login` - Iniciar sesión
- `POST /api/v1/auth/register` - Registrar usuario
- `GET /api/v1/auth/verify` - Verificar token

### Tenants
- `GET /api/v1/tenants/current` - Obtener tenant actual
- `PUT /api/v1/tenants/current` - Actualizar configuración

### Próximamente
- Campañas, Donaciones, Pagos, Proveedores, etc.

## 🏛️ Multi-Tenancy

Cada parroquia es un "tenant" independiente con:
- Datos completamente aislados
- Configuración personalizable (colores, logos, contacto)
- Usuarios y roles específicos por parroquia
- Subdominios personalizados (futuro)

## 🔒 Seguridad

- Autenticación JWT con expiración
- Middleware de autorización por roles
- Validación de datos con Joi
- Encriptación de contraseñas con bcrypt
- Headers de seguridad con Helmet
- Aislamiento de datos por tenant

## 📊 Monitoreo

- Logs estructurados con Winston
- Métricas de performance
- Health checks en `/health`
- Error tracking y alertas

## 🤝 Contribuir

1. Fork el proyecto
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abrir Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 📞 Soporte

Para soporte técnico o preguntas:
- Email: soporte@pancompartido.org
- Documentación: [docs/](docs/)
- Issues: GitHub Issues

---

**Pan Compartido** - Conectando corazones, alimentando esperanzas 🙏
