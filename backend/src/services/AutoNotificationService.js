const WhatsAppService = require('./WhatsAppService');
const MessageTemplateService = require('./MessageTemplateService');
const logger = require('../utils/logger');

class AutoNotificationService {
  constructor() {
    this.notificationTypes = {
      CAMPAIGN_CREATED: 'campaign_created',
      CAMPAIGN_GOAL_REACHED: 'campaign_goal_reached',
      CAMPAIGN_URGENT: 'campaign_urgent',
      CAMPAIGN_ENDING: 'campaign_ending',
      DONATION_RECEIVED: 'donation_received',
      DONATION_THANK_YOU: 'donation_thank_you',
      WEEKLY_SUMMARY: 'weekly_summary',
      MONTHLY_REPORT: 'monthly_report',
      SUPPLIER_PAYMENT: 'supplier_payment',
      EMERGENCY_ALERT: 'emergency_alert'
    };

    // Notification scheduling intervals
    this.schedules = {
      CAMPAIGN_REMINDERS: '0 18 * * *', // Daily at 6 PM
      WEEKLY_SUMMARIES: '0 10 * * 0', // Sundays at 10 AM
      MONTHLY_REPORTS: '0 9 1 * *',  // 1st of month at 9 AM
      URGENT_CHECKS: '0 */6 * * *'  // Every 6 hours
    };
  }

  /**
   * Send campaign creation notification
   */
  async notifyCampaignCreated(campaignId, tenantId) {
    try {
      const CampaignService = require('./CampaignService');
      const campaign = await CampaignService.getCampaignById(campaignId, tenantId);
      
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Get subscribers for campaign notifications
      const subscribers = await this.getCampaignSubscribers(tenantId);
      
      if (subscribers.length === 0) {
        logger.info('No subscribers for campaign notifications', { tenantId, campaignId });
        return { sent: 0, failed: 0 };
      }

      // Get message template
      const template = await MessageTemplateService.getNotificationTemplate(
        tenantId, 
        this.notificationTypes.CAMPAIGN_CREATED
      );

      const message = this.formatTemplate(template.content, {
        campaign_title: campaign.title,
        campaign_description: campaign.description,
        target_amount: this.formatCurrency(campaign.targetAmount),
        end_date: this.formatDate(campaign.endDate)
      });

      // Send notifications
      const results = await this.sendBulkNotifications(
        subscribers,
        message,
        tenantId,
        { campaignId, type: this.notificationTypes.CAMPAIGN_CREATED }
      );

      logger.info('Campaign creation notifications sent:', {
        tenantId,
        campaignId,
        sent: results.successful,
        failed: results.failed
      });

      return results;

    } catch (error) {
      logger.error('Error sending campaign creation notification:', error);
      throw error;
    }
  }

  /**
   * Send campaign goal reached notification
   */
  async notifyCampaignGoalReached(campaignId, tenantId) {
    try {
      const CampaignService = require('./CampaignService');
      const campaign = await CampaignService.getCampaignById(campaignId, tenantId);
      
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Get all subscribers (broader audience for success stories)
      const subscribers = await this.getAllSubscribers(tenantId);
      
      const template = await MessageTemplateService.getNotificationTemplate(
        tenantId, 
        this.notificationTypes.CAMPAIGN_GOAL_REACHED
      );

      const message = this.formatTemplate(template.content, {
        campaign_title: campaign.title,
        target_amount: this.formatCurrency(campaign.targetAmount),
        raised_amount: this.formatCurrency(campaign.raisedAmount),
        completion_percentage: Math.round(campaign.completionPercentage),
        donor_count: campaign.donorCount || 0
      });

      const results = await this.sendBulkNotifications(
        subscribers,
        message,
        tenantId,
        { campaignId, type: this.notificationTypes.CAMPAIGN_GOAL_REACHED }
      );

      logger.info('Campaign goal reached notifications sent:', {
        tenantId,
        campaignId,
        sent: results.successful,
        failed: results.failed
      });

      return results;

    } catch (error) {
      logger.error('Error sending campaign goal reached notification:', error);
      throw error;
    }
  }

  /**
   * Send urgent campaign notification
   */
  async notifyUrgentCampaign(campaignId, tenantId, urgentNeeds = []) {
    try {
      const CampaignService = require('./CampaignService');
      const campaign = await CampaignService.getCampaignById(campaignId, tenantId);
      
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Get active donors and frequent contributors
      const subscribers = await this.getActiveDonors(tenantId);
      
      const template = await MessageTemplateService.getNotificationTemplate(
        tenantId, 
        this.notificationTypes.CAMPAIGN_URGENT
      );

      let urgentItemsList = '';
      if (urgentNeeds.length > 0) {
        urgentItemsList = urgentNeeds.slice(0, 3).map(need => 
          `• ${need.productName}: ${need.remaining} ${need.unit}`
        ).join('\\n');
      }

      const message = this.formatTemplate(template.content, {
        campaign_title: campaign.title,
        urgent_items: urgentItemsList,
        days_remaining: this.calculateDaysRemaining(campaign.endDate),
        completion_percentage: Math.round(campaign.completionPercentage)
      });

      const results = await this.sendBulkNotifications(
        subscribers,
        message,
        tenantId,
        { campaignId, type: this.notificationTypes.CAMPAIGN_URGENT }
      );

      logger.info('Urgent campaign notifications sent:', {
        tenantId,
        campaignId,
        sent: results.successful,
        failed: results.failed
      });

      return results;

    } catch (error) {
      logger.error('Error sending urgent campaign notification:', error);
      throw error;
    }
  }

  /**
   * Send campaign ending soon notification
   */
  async notifyCampaignEnding(campaignId, tenantId) {
    try {
      const CampaignService = require('./CampaignService');
      const campaign = await CampaignService.getCampaignById(campaignId, tenantId);
      
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      const subscribers = await this.getCampaignSubscribers(tenantId);
      
      const template = await MessageTemplateService.getNotificationTemplate(
        tenantId, 
        this.notificationTypes.CAMPAIGN_ENDING
      );

      const daysRemaining = this.calculateDaysRemaining(campaign.endDate);
      const remainingAmount = campaign.targetAmount - campaign.raisedAmount;

      const message = this.formatTemplate(template.content, {
        campaign_title: campaign.title,
        days_remaining: daysRemaining,
        completion_percentage: Math.round(campaign.completionPercentage),
        remaining_amount: this.formatCurrency(remainingAmount),
        target_amount: this.formatCurrency(campaign.targetAmount)
      });

      const results = await this.sendBulkNotifications(
        subscribers,
        message,
        tenantId,
        { campaignId, type: this.notificationTypes.CAMPAIGN_ENDING }
      );

      logger.info('Campaign ending notifications sent:', {
        tenantId,
        campaignId,
        sent: results.successful,
        failed: results.failed
      });

      return results;

    } catch (error) {
      logger.error('Error sending campaign ending notification:', error);
      throw error;
    }
  }

  /**
   * Send donation thank you notification
   */
  async notifyDonationThankYou(donationId, tenantId, donorPhone) {
    try {
      // Get donation details
      const donation = await this.getDonationDetails(donationId, tenantId);
      
      if (!donation) {
        throw new Error('Donation not found');
      }

      const template = await MessageTemplateService.getNotificationTemplate(
        tenantId, 
        this.notificationTypes.DONATION_THANK_YOU
      );

      const message = this.formatTemplate(template.content, {
        donor_name: donation.donorName || 'Hermano/a',
        donation_amount: donation.type === 'money' 
          ? this.formatCurrency(donation.amount)
          : 'productos donados',
        campaign_title: donation.campaignTitle,
        impact_message: donation.impactMessage || 'Tu donación ayudará a familias necesitadas'
      });

      await WhatsAppService.sendMessage(donorPhone, message, tenantId);

      logger.info('Donation thank you sent:', {
        tenantId,
        donationId,
        donorPhone
      });

      return { sent: 1, failed: 0 };

    } catch (error) {
      logger.error('Error sending donation thank you:', error);
      return { sent: 0, failed: 1 };
    }
  }

  /**
   * Send weekly summary to subscribers
   */
  async sendWeeklySummary(tenantId) {
    try {
      // Get weekly statistics
      const weeklyStats = await this.getWeeklyStats(tenantId);
      const subscribers = await this.getSummarySubscribers(tenantId);
      
      if (subscribers.length === 0) {
        logger.info('No subscribers for weekly summary', { tenantId });
        return { sent: 0, failed: 0 };
      }

      const template = await MessageTemplateService.getNotificationTemplate(
        tenantId, 
        this.notificationTypes.WEEKLY_SUMMARY
      );

      const message = this.formatTemplate(template.content, {
        week_donations: this.formatCurrency(weeklyStats.totalDonations),
        week_donors: weeklyStats.totalDonors,
        active_campaigns: weeklyStats.activeCampaigns,
        families_helped: weeklyStats.familiesHelped,
        top_campaign: weeklyStats.topCampaign?.title || 'N/A'
      });

      const results = await this.sendBulkNotifications(
        subscribers,
        message,
        tenantId,
        { type: this.notificationTypes.WEEKLY_SUMMARY }
      );

      logger.info('Weekly summary sent:', {
        tenantId,
        sent: results.successful,
        failed: results.failed
      });

      return results;

    } catch (error) {
      logger.error('Error sending weekly summary:', error);
      throw error;
    }
  }

  /**
   * Send monthly report
   */
  async sendMonthlyReport(tenantId) {
    try {
      const monthlyStats = await this.getMonthlyStats(tenantId);
      const subscribers = await this.getAllSubscribers(tenantId);
      
      if (subscribers.length === 0) {
        logger.info('No subscribers for monthly report', { tenantId });
        return { sent: 0, failed: 0 };
      }

      const template = await MessageTemplateService.getNotificationTemplate(
        tenantId, 
        this.notificationTypes.MONTHLY_REPORT
      );

      const message = this.formatTemplate(template.content, {
        month_donations: this.formatCurrency(monthlyStats.totalDonations),
        month_donors: monthlyStats.totalDonors,
        completed_campaigns: monthlyStats.completedCampaigns,
        families_helped: monthlyStats.familiesHelped,
        impact_stories: monthlyStats.impactStories?.slice(0, 2).join('\\n\\n') || 'Muchas familias fueron bendecidas'
      });

      const results = await this.sendBulkNotifications(
        subscribers,
        message,
        tenantId,
        { type: this.notificationTypes.MONTHLY_REPORT }
      );

      logger.info('Monthly report sent:', {
        tenantId,
        sent: results.successful,
        failed: results.failed
      });

      return results;

    } catch (error) {
      logger.error('Error sending monthly report:', error);
      throw error;
    }
  }

  /**
   * Send emergency alert
   */
  async sendEmergencyAlert(tenantId, alertMessage, priority = 'high') {
    try {
      // Get all active subscribers for emergency alerts
      const subscribers = await this.getAllSubscribers(tenantId);
      
      if (subscribers.length === 0) {
        logger.info('No subscribers for emergency alert', { tenantId });
        return { sent: 0, failed: 0 };
      }

      const template = await MessageTemplateService.getNotificationTemplate(
        tenantId, 
        this.notificationTypes.EMERGENCY_ALERT
      );

      const message = this.formatTemplate(template.content, {
        alert_message: alertMessage,
        priority_icon: priority === 'high' ? '🚨' : '⚠️',
        timestamp: this.formatDateTime(new Date())
      });

      const results = await this.sendBulkNotifications(
        subscribers,
        message,
        tenantId,
        { type: this.notificationTypes.EMERGENCY_ALERT, priority }
      );

      logger.info('Emergency alert sent:', {
        tenantId,
        priority,
        sent: results.successful,
        failed: results.failed
      });

      return results;

    } catch (error) {
      logger.error('Error sending emergency alert:', error);
      throw error;
    }
  }

  /**
   * Send bulk notifications with rate limiting
   */
  async sendBulkNotifications(recipients, message, tenantId, metadata = {}) {
    try {
      const results = {
        successful: 0,
        failed: 0,
        details: []
      };

      // Process in batches to avoid rate limiting
      const batchSize = 10;
      const batches = this.chunkArray(recipients, batchSize);

      for (const batch of batches) {
        const batchPromises = batch.map(async (recipient) => {
          try {
            await WhatsAppService.sendMessage(recipient, message, tenantId);
            results.successful++;
            results.details.push({ recipient, success: true });
          } catch (error) {
            results.failed++;
            results.details.push({ recipient, success: false, error: error.message });
          }
        });

        await Promise.all(batchPromises);
        
        // Wait between batches to respect rate limits
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Log notification batch
      await this.logNotificationBatch(tenantId, {
        type: metadata.type,
        recipients: recipients.length,
        successful: results.successful,
        failed: results.failed,
        metadata
      });

      return results;

    } catch (error) {
      logger.error('Error sending bulk notifications:', error);
      throw error;
    }
  }

  /**
   * Get campaign subscribers
   */
  async getCampaignSubscribers(tenantId) {
    try {
      const db = require('../config/database');
      
      const subscribers = await db('notification_subscribers')
        .where({ 
          tenant_id: tenantId, 
          campaign_notifications: true,
          active: true 
        })
        .pluck('phone_number');

      return subscribers;

    } catch (error) {
      logger.error('Error getting campaign subscribers:', error);
      return [];
    }
  }

  /**
   * Get all subscribers
   */
  async getAllSubscribers(tenantId) {
    try {
      const db = require('../config/database');
      
      const subscribers = await db('notification_subscribers')
        .where({ 
          tenant_id: tenantId,
          active: true 
        })
        .pluck('phone_number');

      return subscribers;

    } catch (error) {
      logger.error('Error getting all subscribers:', error);
      return [];
    }
  }

  /**
   * Get active donors
   */
  async getActiveDonors(tenantId) {
    try {
      const db = require('../config/database');
      
      // Get users who donated in the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const subscribers = await db('notification_subscribers')
        .join('donations', 'notification_subscribers.user_id', 'donations.user_id')
        .where('notification_subscribers.tenant_id', tenantId)
        .where('notification_subscribers.active', true)
        .where('donations.created_at', '>=', thirtyDaysAgo)
        .distinct('notification_subscribers.phone_number')
        .pluck('notification_subscribers.phone_number');

      return subscribers;

    } catch (error) {
      logger.error('Error getting active donors:', error);
      return [];
    }
  }

  /**
   * Get summary subscribers
   */
  async getSummarySubscribers(tenantId) {
    try {
      const db = require('../config/database');
      
      const subscribers = await db('notification_subscribers')
        .where({ 
          tenant_id: tenantId, 
          summary_notifications: true,
          active: true 
        })
        .pluck('phone_number');

      return subscribers;

    } catch (error) {
      logger.error('Error getting summary subscribers:', error);
      return [];
    }
  }

  /**
   * Format template with variables
   */
  formatTemplate(template, variables) {
    let formatted = template;
    
    Object.keys(variables).forEach(key => {
      const placeholder = `{{${key}}}`;
      formatted = formatted.replace(new RegExp(placeholder, 'g'), variables[key]);
    });

    return formatted;
  }

  /**
   * Get weekly statistics
   */
  async getWeeklyStats(tenantId) {
    try {
      const db = require('../config/database');
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const stats = await db('donations')
        .where('tenant_id', tenantId)
        .where('created_at', '>=', weekAgo)
        .select(
          db.raw('SUM(amount) as total_donations'),
          db.raw('COUNT(DISTINCT user_id) as total_donors'),
          db.raw('COUNT(*) as total_donations_count')
        )
        .first();

      const activeCampaigns = await db('campaigns')
        .where({ tenant_id: tenantId, status: 'active' })
        .count('* as count')
        .first();

      return {
        totalDonations: parseFloat(stats.total_donations) || 0,
        totalDonors: parseInt(stats.total_donors) || 0,
        activeCampaigns: parseInt(activeCampaigns.count) || 0,
        familiesHelped: Math.floor((parseInt(stats.total_donations_count) || 0) / 3), // Estimate
        topCampaign: null // Would need more complex query
      };

    } catch (error) {
      logger.error('Error getting weekly stats:', error);
      return {
        totalDonations: 0,
        totalDonors: 0,
        activeCampaigns: 0,
        familiesHelped: 0,
        topCampaign: null
      };
    }
  }

  /**
   * Get monthly statistics
   */
  async getMonthlyStats(tenantId) {
    try {
      const db = require('../config/database');
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);

      const stats = await db('donations')
        .where('tenant_id', tenantId)
        .where('created_at', '>=', monthAgo)
        .select(
          db.raw('SUM(amount) as total_donations'),
          db.raw('COUNT(DISTINCT user_id) as total_donors')
        )
        .first();

      const completedCampaigns = await db('campaigns')
        .where('tenant_id', tenantId)
        .where('status', 'completed')
        .where('updated_at', '>=', monthAgo)
        .count('* as count')
        .first();

      return {
        totalDonations: parseFloat(stats.total_donations) || 0,
        totalDonors: parseInt(stats.total_donors) || 0,
        completedCampaigns: parseInt(completedCampaigns.count) || 0,
        familiesHelped: Math.floor((parseInt(stats.total_donors) || 0) * 2), // Estimate
        impactStories: [
          'María y sus 3 hijos recibieron alimentos por un mes completo',
          'La familia González pudo acceder a medicinas esenciales'
        ]
      };

    } catch (error) {
      logger.error('Error getting monthly stats:', error);
      return {
        totalDonations: 0,
        totalDonors: 0,
        completedCampaigns: 0,
        familiesHelped: 0,
        impactStories: []
      };
    }
  }

  /**
   * Utility functions
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  }

  formatDate(date) {
    return new Date(date).toLocaleDateString('es-CO');
  }

  formatDateTime(date) {
    return new Date(date).toLocaleString('es-CO');
  }

  calculateDaysRemaining(endDate) {
    const now = new Date();
    const end = new Date(endDate);
    const diffTime = end - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async getDonationDetails(donationId, tenantId) {
    try {
      const db = require('../config/database');
      
      const donation = await db('donations')
        .join('campaigns', 'donations.campaign_id', 'campaigns.id')
        .join('users', 'donations.user_id', 'users.id')
        .where('donations.id', donationId)
        .where('donations.tenant_id', tenantId)
        .select(
          'donations.*',
          'campaigns.title as campaignTitle',
          'users.name as donorName'
        )
        .first();

      return donation;

    } catch (error) {
      logger.error('Error getting donation details:', error);
      return null;
    }
  }

  async logNotificationBatch(tenantId, logData) {
    try {
      const db = require('../config/database');
      
      await db('notification_logs').insert({
        tenant_id: tenantId,
        ...logData,
        created_at: new Date()
      });

    } catch (error) {
      logger.error('Error logging notification batch:', error);
    }
  }

  /**
   * Subscribe user to notifications
   */
  async subscribeUser(tenantId, phoneNumber, userId, preferences = {}) {
    try {
      const db = require('../config/database');
      
      const subscription = {
        tenant_id: tenantId,
        phone_number: phoneNumber,
        user_id: userId,
        campaign_notifications: preferences.campaigns !== false,
        summary_notifications: preferences.summaries !== false,
        urgent_notifications: preferences.urgent !== false,
        active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      await db('notification_subscribers')
        .insert(subscription)
        .onConflict(['tenant_id', 'phone_number'])
        .merge(subscription);

      logger.info('User subscribed to notifications:', {
        tenantId,
        phoneNumber,
        userId
      });

      return true;

    } catch (error) {
      logger.error('Error subscribing user:', error);
      return false;
    }
  }

  /**
   * Unsubscribe user from notifications
   */
  async unsubscribeUser(tenantId, phoneNumber) {
    try {
      const db = require('../config/database');
      
      await db('notification_subscribers')
        .where({ tenant_id: tenantId, phone_number: phoneNumber })
        .update({ active: false, updated_at: new Date() });

      logger.info('User unsubscribed from notifications:', {
        tenantId,
        phoneNumber
      });

      return true;

    } catch (error) {
      logger.error('Error unsubscribing user:', error);
      return false;
    }
  }
}

module.exports = new AutoNotificationService();