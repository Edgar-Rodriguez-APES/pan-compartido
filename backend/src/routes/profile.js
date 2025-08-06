const express = require('express');
const Joi = require('joi');
const UserProfileService = require('../services/UserProfileService');
const logger = require('../utils/logger');

const router = express.Router();

// Esquemas de validación
const donationPreferencesSchema = Joi.object({
  preferredCampaignTypes: Joi.array().items(Joi.string()).optional(),
  notificationFrequency: Joi.string().valid('daily', 'weekly', 'monthly').optional(),
  maxDonationAmount: Joi.number().positive().optional(),
  preferredDonationDay: Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday').optional(),
  autoRenewDonations: Joi.boolean().optional(),
  receiveImpactReports: Joi.boolean().optional(),
  preferredProducts: Joi.array().items(Joi.string()).optional()
});

const purchasePreferencesSchema = Joi.object({
  deliveryAddress: Joi.string().max(200).optional(),
  preferredDeliveryDay: Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday').optional(),
  maxOrderAmount: Joi.number().positive().optional(),
  notifyOnDeals: Joi.boolean().optional(),
  autoReorderFavorites: Joi.boolean().optional(),
  dietaryRestrictions: Joi.array().items(Joi.string()).optional(),
  householdSize: Joi.number().integer().min(1).max(20).optional()
});

// Obtener perfil completo del usuario
router.get('/complete', async (req, res, next) => {
  try {
    const profile = await UserProfileService.getFullUserProfile(req.userId);
    res.json(profile);
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'El usuario especificado no existe'
      });
    }
    next(error);
  }
});

// Obtener estadísticas como donante
router.get('/donor-stats', async (req, res, next) => {
  try {
    const stats = await UserProfileService.getDonorStats(req.userId);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Obtener estadísticas como consumidor
router.get('/consumer-stats', async (req, res, next) => {
  try {
    const stats = await UserProfileService.getConsumerStats(req.userId);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Obtener actividad reciente
router.get('/activity', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const activity = await UserProfileService.getRecentActivity(req.userId, limit);
    res.json({ activities: activity });
  } catch (error) {
    next(error);
  }
});

// Obtener preferencias de donación
router.get('/donation-preferences', async (req, res, next) => {
  try {
    const preferences = await UserProfileService.getDonationPreferences(req.userId);
    res.json(preferences);
  } catch (error) {
    next(error);
  }
});

// Actualizar preferencias de donación
router.put('/donation-preferences', async (req, res, next) => {
  try {
    const { error, value } = donationPreferencesSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const updatedPreferences = await UserProfileService.updateDonationPreferences(
      req.userId,
      value
    );

    res.json({
      message: 'Preferencias de donación actualizadas exitosamente',
      preferences: updatedPreferences
    });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'El usuario especificado no existe'
      });
    }
    next(error);
  }
});

// Obtener preferencias de compra
router.get('/purchase-preferences', async (req, res, next) => {
  try {
    const preferences = await UserProfileService.getPurchasePreferences(req.userId);
    res.json(preferences);
  } catch (error) {
    next(error);
  }
});

// Actualizar preferencias de compra
router.put('/purchase-preferences', async (req, res, next) => {
  try {
    const { error, value } = purchasePreferencesSchema.validate(req.body);
    if (error) {
      error.isJoi = true;
      return next(error);
    }

    const updatedPreferences = await UserProfileService.updatePurchasePreferences(
      req.userId,
      value
    );

    res.json({
      message: 'Preferencias de compra actualizadas exitosamente',
      preferences: updatedPreferences
    });
  } catch (error) {
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({
        error: 'Usuario no encontrado',
        message: 'El usuario especificado no existe'
      });
    }
    next(error);
  }
});

// Obtener recomendaciones personalizadas
router.get('/recommendations', async (req, res, next) => {
  try {
    const recommendations = await UserProfileService.getPersonalizedRecommendations(req.userId);
    res.json(recommendations);
  } catch (error) {
    next(error);
  }
});

// Obtener resumen del impacto del usuario
router.get('/impact-summary', async (req, res, next) => {
  try {
    const profile = await UserProfileService.getFullUserProfile(req.userId);
    
    const impactSummary = {
      totalContribution: profile.donorProfile.stats.totalDonated + profile.consumerProfile.stats.platformFeesContributed,
      familiesHelped: profile.donorProfile.stats.familiesHelped,
      campaignsSupported: profile.donorProfile.stats.campaignsSupported,
      personalSavings: profile.consumerProfile.savings.totalSaved,
      donorLevel: profile.donorProfile.level,
      consumerLevel: profile.consumerProfile.level,
      badges: profile.donorProfile.badges,
      monthlyActivity: {
        donations: profile.donorProfile.stats.currentMonthDonations,
        purchases: profile.consumerProfile.stats.currentMonthPurchases
      }
    };

    res.json(impactSummary);
  } catch (error) {
    next(error);
  }
});

// Comparar perfil con otros usuarios (estadísticas anónimas)
router.get('/comparison', async (req, res, next) => {
  try {
    const userProfile = await UserProfileService.getFullUserProfile(req.userId);
    
    // Obtener estadísticas promedio de usuarios similares (mismo tenant)
    const db = require('../config/database');
    
    const [avgDonorStats, avgConsumerStats] = await Promise.all([
      db('donations')
        .join('users', 'donations.user_id', 'users.id')
        .where('users.tenant_id', req.tenantId)
        .where('donations.status', 'received')
        .select(
          db.raw('AVG(CASE WHEN payments.donation_amount IS NOT NULL THEN payments.donation_amount ELSE 0 END) as avg_donation'),
          db.raw('COUNT(donations.id)::float / COUNT(DISTINCT donations.user_id) as avg_donations_per_user')
        )
        .leftJoin('payments', 'payments.donation_id', 'donations.id')
        .first(),
      
      db('purchases')
        .join('users', 'purchases.user_id', 'users.id')
        .where('users.tenant_id', req.tenantId)
        .where('purchases.status', 'delivered')
        .select(
          db.raw('AVG(purchases.total_amount) as avg_purchase'),
          db.raw('COUNT(purchases.id)::float / COUNT(DISTINCT purchases.user_id) as avg_purchases_per_user')
        )
        .first()
    ]);

    const comparison = {
      donations: {
        userTotal: userProfile.donorProfile.stats.totalDonations,
        communityAverage: parseFloat(avgDonorStats.avg_donations_per_user) || 0,
        userAvgAmount: userProfile.donorProfile.stats.averageDonation,
        communityAvgAmount: parseFloat(avgDonorStats.avg_donation) || 0
      },
      purchases: {
        userTotal: userProfile.consumerProfile.stats.totalPurchases,
        communityAverage: parseFloat(avgConsumerStats.avg_purchases_per_user) || 0,
        userAvgAmount: userProfile.consumerProfile.stats.averagePurchase,
        communityAvgAmount: parseFloat(avgConsumerStats.avg_purchase) || 0
      }
    };

    res.json(comparison);
  } catch (error) {
    next(error);
  }
});

// Limpiar cache del perfil
router.delete('/cache', async (req, res, next) => {
  try {
    await UserProfileService.clearUserProfileCache(req.userId);
    
    res.json({
      message: 'Cache del perfil limpiado exitosamente'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;