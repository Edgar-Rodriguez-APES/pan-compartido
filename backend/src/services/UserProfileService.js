const User = require('../models/User');
const db = require('../config/database');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');

class UserProfileService {
  // Obtener perfil completo del usuario con estadísticas de donante y consumidor
  static async getFullUserProfile(userId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      // Obtener estadísticas como donante
      const donorStats = await this.getDonorStats(userId);
      
      // Obtener estadísticas como consumidor
      const consumerStats = await this.getConsumerStats(userId);
      
      // Obtener historial reciente
      const recentActivity = await this.getRecentActivity(userId);
      
      // Obtener preferencias de donación
      const donationPreferences = await this.getDonationPreferences(userId);
      
      // Obtener preferencias de compra
      const purchasePreferences = await this.getPurchasePreferences(userId);

      return {
        user: user.toJSON(),
        donorProfile: {
          stats: donorStats,
          preferences: donationPreferences,
          level: this.calculateDonorLevel(donorStats),
          badges: this.calculateDonorBadges(donorStats)
        },
        consumerProfile: {
          stats: consumerStats,
          preferences: purchasePreferences,
          level: this.calculateConsumerLevel(consumerStats),
          savings: this.calculateSavings(consumerStats)
        },
        recentActivity
      };
    } catch (error) {
      logger.error('Error obteniendo perfil completo del usuario:', error);
      throw error;
    }
  }

  // Obtener estadísticas como donante
  static async getDonorStats(userId) {
    try {
      const cacheKey = `user:${userId}:donor_stats`;
      let stats = await cache.get(cacheKey);

      if (!stats) {
        const [
          totalDonations,
          totalDonated,
          currentMonthDonations,
          favoriteCampaigns,
          impactStats
        ] = await Promise.all([
          // Total de donaciones
          db('donations')
            .where('user_id', userId)
            .where('status', 'received')
            .count('* as count')
            .first(),
          
          // Total donado en dinero
          db('payments')
            .join('donations', 'payments.donation_id', 'donations.id')
            .where('donations.user_id', userId)
            .where('payments.status', 'completed')
            .sum('payments.donation_amount as total')
            .first(),
          
          // Donaciones del mes actual
          db('donations')
            .where('user_id', userId)
            .where('status', 'received')
            .whereRaw('EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)')
            .whereRaw('EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)')
            .count('* as count')
            .first(),
          
          // Campañas favoritas (más donadas)
          db('donations')
            .join('campaigns', 'donations.campaign_id', 'campaigns.id')
            .where('donations.user_id', userId)
            .where('donations.status', 'received')
            .select('campaigns.title', 'campaigns.id')
            .count('donations.id as donation_count')
            .groupBy('campaigns.id', 'campaigns.title')
            .orderBy('donation_count', 'desc')
            .limit(3),
          
          // Estadísticas de impacto
          db('donations')
            .join('campaigns', 'donations.campaign_id', 'campaigns.id')
            .where('donations.user_id', userId)
            .where('donations.status', 'received')
            .select(
              db.raw('COUNT(DISTINCT campaigns.id) as campaigns_supported'),
              db.raw('SUM(CASE WHEN campaigns.helped_families > 0 THEN campaigns.helped_families ELSE 0 END) as families_helped')
            )
            .first()
        ]);

        stats = {
          totalDonations: parseInt(totalDonations.count) || 0,
          totalDonated: parseFloat(totalDonated.total) || 0,
          currentMonthDonations: parseInt(currentMonthDonations.count) || 0,
          favoriteCampaigns: favoriteCampaigns || [],
          campaignsSupported: parseInt(impactStats.campaigns_supported) || 0,
          familiesHelped: parseInt(impactStats.families_helped) || 0,
          averageDonation: totalDonations.count > 0 ? (parseFloat(totalDonated.total) || 0) / parseInt(totalDonations.count) : 0
        };

        // Guardar en cache por 15 minutos
        await cache.set(cacheKey, stats, 900);
      }

      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas de donante:', error);
      throw error;
    }
  }

  // Obtener estadísticas como consumidor
  static async getConsumerStats(userId) {
    try {
      const cacheKey = `user:${userId}:consumer_stats`;
      let stats = await cache.get(cacheKey);

      if (!stats) {
        const [
          totalPurchases,
          totalSpent,
          currentMonthPurchases,
          favoriteProducts,
          savingsData
        ] = await Promise.all([
          // Total de compras
          db('purchases')
            .where('user_id', userId)
            .where('status', 'delivered')
            .count('* as count')
            .first(),
          
          // Total gastado
          db('payments')
            .join('purchases', 'payments.purchase_id', 'purchases.id')
            .where('purchases.user_id', userId)
            .where('payments.status', 'completed')
            .sum('payments.purchase_amount as total')
            .first(),
          
          // Compras del mes actual
          db('purchases')
            .where('user_id', userId)
            .where('status', 'delivered')
            .whereRaw('EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE)')
            .whereRaw('EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)')
            .count('* as count')
            .first(),
          
          // Productos favoritos (más comprados)
          db('purchases')
            .where('user_id', userId)
            .where('status', 'delivered')
            .select(db.raw('jsonb_array_elements(items) as item'))
            .then(results => {
              const productCounts = {};
              results.forEach(row => {
                const item = row.item;
                if (item.product_id) {
                  productCounts[item.product_id] = (productCounts[item.product_id] || 0) + (item.quantity || 1);
                }
              });
              
              return Object.entries(productCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([productId, quantity]) => ({ productId, quantity }));
            }),
          
          // Datos de ahorro (comparación con precios regulares)
          db('payments')
            .join('purchases', 'payments.purchase_id', 'purchases.id')
            .where('purchases.user_id', userId)
            .where('payments.status', 'completed')
            .select(
              db.raw('SUM(payments.purchase_amount) as total_paid'),
              db.raw('SUM(purchases.subtotal) as subtotal'),
              db.raw('SUM(purchases.platform_fee) as fees')
            )
            .first()
        ]);

        // Calcular ahorro estimado (asumiendo 20% de ahorro vs precios regulares)
        const totalPaid = parseFloat(savingsData.total_paid) || 0;
        const estimatedRegularPrice = totalPaid * 1.25; // Asumiendo 25% de descuento
        const estimatedSavings = estimatedRegularPrice - totalPaid;

        stats = {
          totalPurchases: parseInt(totalPurchases.count) || 0,
          totalSpent: parseFloat(totalSpent.total) || 0,
          currentMonthPurchases: parseInt(currentMonthPurchases.count) || 0,
          favoriteProducts: favoriteProducts || [],
          averagePurchase: totalPurchases.count > 0 ? (parseFloat(totalSpent.total) || 0) / parseInt(totalPurchases.count) : 0,
          estimatedSavings: estimatedSavings,
          platformFeesContributed: parseFloat(savingsData.fees) || 0
        };

        // Guardar en cache por 15 minutos
        await cache.set(cacheKey, stats, 900);
      }

      return stats;
    } catch (error) {
      logger.error('Error obteniendo estadísticas de consumidor:', error);
      throw error;
    }
  }

  // Obtener actividad reciente del usuario
  static async getRecentActivity(userId, limit = 10) {
    try {
      const [donations, purchases] = await Promise.all([
        // Donaciones recientes
        db('donations')
          .join('campaigns', 'donations.campaign_id', 'campaigns.id')
          .where('donations.user_id', userId)
          .select(
            'donations.id',
            'donations.created_at',
            'donations.status',
            'campaigns.title as campaign_title',
            'donations.items',
            db.raw("'donation' as type")
          )
          .orderBy('donations.created_at', 'desc')
          .limit(limit / 2),
        
        // Compras recientes
        db('purchases')
          .where('user_id', userId)
          .select(
            'id',
            'created_at',
            'status',
            'items',
            'total_amount',
            db.raw("'purchase' as type")
          )
          .orderBy('created_at', 'desc')
          .limit(limit / 2)
      ]);

      // Combinar y ordenar por fecha
      const activities = [...donations, ...purchases]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, limit);

      return activities;
    } catch (error) {
      logger.error('Error obteniendo actividad reciente:', error);
      throw error;
    }
  }

  // Obtener preferencias de donación
  static async getDonationPreferences(userId) {
    try {
      const user = await User.findById(userId);
      
      const defaultPreferences = {
        preferredCampaignTypes: ['food', 'emergency'],
        notificationFrequency: 'weekly',
        maxDonationAmount: 100000,
        preferredDonationDay: 'friday',
        autoRenewDonations: false,
        receiveImpactReports: true,
        preferredProducts: []
      };

      return {
        ...defaultPreferences,
        ...user.preferences?.donation
      };
    } catch (error) {
      logger.error('Error obteniendo preferencias de donación:', error);
      throw error;
    }
  }

  // Obtener preferencias de compra
  static async getPurchasePreferences(userId) {
    try {
      const user = await User.findById(userId);
      
      const defaultPreferences = {
        deliveryAddress: '',
        preferredDeliveryDay: 'saturday',
        maxOrderAmount: 200000,
        notifyOnDeals: true,
        autoReorderFavorites: false,
        dietaryRestrictions: [],
        householdSize: 1
      };

      return {
        ...defaultPreferences,
        ...user.preferences?.purchase
      };
    } catch (error) {
      logger.error('Error obteniendo preferencias de compra:', error);
      throw error;
    }
  }

  // Actualizar preferencias de donación
  static async updateDonationPreferences(userId, preferences) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      const updatedPreferences = {
        ...user.preferences,
        donation: {
          ...user.preferences?.donation,
          ...preferences
        }
      };

      await user.update({ preferences: updatedPreferences });

      // Limpiar cache
      await cache.del(`user:${userId}:donor_stats`);

      logger.info('Preferencias de donación actualizadas', {
        userId,
        preferences: Object.keys(preferences)
      });

      return updatedPreferences.donation;
    } catch (error) {
      logger.error('Error actualizando preferencias de donación:', error);
      throw error;
    }
  }

  // Actualizar preferencias de compra
  static async updatePurchasePreferences(userId, preferences) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      const updatedPreferences = {
        ...user.preferences,
        purchase: {
          ...user.preferences?.purchase,
          ...preferences
        }
      };

      await user.update({ preferences: updatedPreferences });

      // Limpiar cache
      await cache.del(`user:${userId}:consumer_stats`);

      logger.info('Preferencias de compra actualizadas', {
        userId,
        preferences: Object.keys(preferences)
      });

      return updatedPreferences.purchase;
    } catch (error) {
      logger.error('Error actualizando preferencias de compra:', error);
      throw error;
    }
  }

  // Calcular nivel de donante
  static calculateDonorLevel(stats) {
    const { totalDonations, totalDonated } = stats;
    
    if (totalDonations >= 50 && totalDonated >= 500000) {
      return { level: 'Benefactor', color: 'gold', icon: '👑' };
    } else if (totalDonations >= 20 && totalDonated >= 200000) {
      return { level: 'Colaborador', color: 'silver', icon: '⭐' };
    } else if (totalDonations >= 5 && totalDonated >= 50000) {
      return { level: 'Solidario', color: 'bronze', icon: '🤝' };
    } else {
      return { level: 'Nuevo', color: 'blue', icon: '🌱' };
    }
  }

  // Calcular insignias de donante
  static calculateDonorBadges(stats) {
    const badges = [];
    
    if (stats.totalDonations >= 10) {
      badges.push({ name: 'Donante Frecuente', icon: '🎯', description: '10+ donaciones realizadas' });
    }
    
    if (stats.campaignsSupported >= 5) {
      badges.push({ name: 'Apoyo Diverso', icon: '🌈', description: '5+ campañas diferentes apoyadas' });
    }
    
    if (stats.currentMonthDonations >= 4) {
      badges.push({ name: 'Activo del Mes', icon: '🔥', description: '4+ donaciones este mes' });
    }
    
    if (stats.totalDonated >= 100000) {
      badges.push({ name: 'Gran Corazón', icon: '💝', description: '$100,000+ donados en total' });
    }

    return badges;
  }

  // Calcular nivel de consumidor
  static calculateConsumerLevel(stats) {
    const { totalPurchases, totalSpent } = stats;
    
    if (totalPurchases >= 30 && totalSpent >= 1000000) {
      return { level: 'VIP', color: 'purple', icon: '💎' };
    } else if (totalPurchases >= 15 && totalSpent >= 500000) {
      return { level: 'Premium', color: 'gold', icon: '🏆' };
    } else if (totalPurchases >= 5 && totalSpent >= 100000) {
      return { level: 'Regular', color: 'green', icon: '🛒' };
    } else {
      return { level: 'Nuevo', color: 'blue', icon: '🆕' };
    }
  }

  // Calcular ahorros del consumidor
  static calculateSavings(stats) {
    return {
      totalSaved: stats.estimatedSavings,
      averageSavingsPerPurchase: stats.totalPurchases > 0 ? stats.estimatedSavings / stats.totalPurchases : 0,
      savingsPercentage: 20, // Asumiendo 20% de ahorro promedio
      platformContribution: stats.platformFeesContributed
    };
  }

  // Obtener recomendaciones personalizadas
  static async getPersonalizedRecommendations(userId) {
    try {
      const profile = await this.getFullUserProfile(userId);
      const recommendations = {
        donations: [],
        purchases: [],
        campaigns: []
      };

      // Recomendaciones de donación basadas en historial
      if (profile.donorProfile.stats.favoriteCampaigns.length > 0) {
        recommendations.donations.push({
          type: 'similar_campaigns',
          title: 'Campañas similares a las que apoyas',
          description: 'Basado en tus donaciones anteriores'
        });
      }

      // Recomendaciones de compra basadas en productos favoritos
      if (profile.consumerProfile.stats.favoriteProducts.length > 0) {
        recommendations.purchases.push({
          type: 'favorite_products',
          title: 'Tus productos favoritos están disponibles',
          description: 'Productos que compras frecuentemente'
        });
      }

      // Recomendaciones de nuevas campañas
      recommendations.campaigns.push({
        type: 'new_campaigns',
        title: 'Nuevas campañas que podrían interesarte',
        description: 'Basado en tu perfil de donante'
      });

      return recommendations;
    } catch (error) {
      logger.error('Error obteniendo recomendaciones personalizadas:', error);
      throw error;
    }
  }

  // Limpiar cache del perfil de usuario
  static async clearUserProfileCache(userId) {
    try {
      const cacheKeys = [
        `user:${userId}:donor_stats`,
        `user:${userId}:consumer_stats`,
        `user:${userId}:profile`
      ];

      await Promise.all(cacheKeys.map(key => cache.del(key)));

      logger.info('Cache del perfil de usuario limpiado', { userId });
    } catch (error) {
      logger.error('Error limpiando cache del perfil:', error);
    }
  }
}

module.exports = UserProfileService;