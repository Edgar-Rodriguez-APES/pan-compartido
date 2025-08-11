const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const tenantMiddleware = require('./middleware/tenantMiddleware');
const authMiddleware = require('./middleware/authMiddleware');

// Importar rutas
const authRoutes = require('./routes/auth');
const tenantsRoutes = require('./routes/tenants');
const brandingRoutes = require('./routes/branding');
const messageTemplatesRoutes = require('./routes/messageTemplates');
const profileRoutes = require('./routes/profile');
const campaignsRoutes = require('./routes/campaigns');
const campaignJobsRoutes = require('./routes/campaignJobs');
const productsRoutes = require('./routes/products');
const donationsRoutes = require('./routes/donations');
const usersRoutes = require('./routes/users');
const paymentsRoutes = require('./routes/payments');
const suppliersRoutes = require('./routes/suppliers');
const whatsappRoutes = require('./routes/whatsapp');
const notificationsRoutes = require('./routes/notifications');

const app = express();

// Inicializar jobs programados
if (process.env.NODE_ENV !== 'test') {
  const CampaignJobs = require('./jobs/campaignJobs');
  CampaignJobs.init();
  
  // Inicializar jobs de notificaciones automáticas
  const NotificationJobs = require('./jobs/notificationJobs');
  NotificationJobs.initialize();
}

// Middleware de seguridad
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Middleware de parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware de logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || 'v1'
  });
});

// Rutas públicas (sin autenticación)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/whatsapp', whatsappRoutes);

// Middleware de tenant (para rutas que requieren tenant)
app.use('/api/v1', tenantMiddleware);

// Rutas protegidas (requieren autenticación)
app.use('/api/v1/tenants', authMiddleware, tenantsRoutes);
app.use('/api/v1/branding', authMiddleware, brandingRoutes);
app.use('/api/v1/message-templates', authMiddleware, messageTemplatesRoutes);
app.use('/api/v1/profile', authMiddleware, profileRoutes);
app.use('/api/v1/campaigns', authMiddleware, campaignsRoutes);
app.use('/api/v1/campaign-jobs', authMiddleware, campaignJobsRoutes);
app.use('/api/v1/products', authMiddleware, productsRoutes);
app.use('/api/v1/donations', authMiddleware, donationsRoutes);
app.use('/api/v1/users', authMiddleware, usersRoutes);
app.use('/api/v1/payments', authMiddleware, paymentsRoutes);
app.use('/api/v1/suppliers', authMiddleware, suppliersRoutes);
app.use('/api/v1/notifications', authMiddleware, notificationsRoutes);

// Middleware de manejo de errores
app.use(errorHandler);

// Ruta 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    message: `La ruta ${req.originalUrl} no existe`
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  logger.info(`🚀 Servidor iniciado en puerto ${PORT}`);
  logger.info(`📊 Ambiente: ${process.env.NODE_ENV}`);
  logger.info(`🔗 API URL: http://localhost:${PORT}/api/v1`);
});

module.exports = app;