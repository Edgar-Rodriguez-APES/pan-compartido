const WhatsAppService = require('./WhatsAppService');
const MessageTemplateService = require('./MessageTemplateService');
const logger = require('../utils/logger');

class NotificationService {
  constructor() {
    this.channels = {
      WHATSAPP: 'whatsapp',
      EMAIL: 'email',
      SMS: 'sms'
    };

    this.notificationTypes = {
      CAMPAIGN_CREATED: 'campaign_created',
      CAMPAIGN_URGENT: 'campaign_urgent',
      CAMPAIGN_COMPLETED: 'campaign_completed',
      DONATION_RECEIVED: 'donation_received',
      DONATION_CONFIRMATION: 'donation_confirmation',
      PAYMENT_SUCCESS: 'payment_success',
      PAYMENT_FAILED: 'payment_failed',
      WEEKLY_SUMMARY: 'weekly_summary',
      MONTHLY_REPORT: 'monthly_report',
      SUPPLIER_APPROVED: 'supplier_approved',
      LOW_STOCK_ALERT: 'low_stock_alert'
    };

    // Notification preferences by user role
    this.defaultPreferences = {
      priest: {
        [this.notificationTypes.CAMPAIGN_CREATED]: [this.channels.WHATSAPP, this.channels.EMAIL],
        [this.notificationTypes.DONATION_RECEIVED]: [this.channels.WHATSAPP],
        [this.notificationTypes.CAMPAIGN_COMPLETED]: [this.channels.WHATSAPP, this.channels.EMAIL],
        [this.notificationTypes.WEEKLY_SUMMARY]: [this.channels.EMAIL],
        [this.notificationTypes.MONTHLY_REPORT]: [this.channels.EMAIL],
        [this.notificationTypes.LOW_STOCK_ALERT]: [this.channels.WHATSAPP]
      },
      parishioner: {
        [this.notificationTypes.CAMPAIGN_CREATED]: [this.channels.WHATSAPP],
        [this.notificationTypes.CAMPAIGN_URGENT]: [this.channels.WHATSAPP],
        [this.notificationTypes.DONATION_CONFIRMATION]: [this.channels.WHATSAPP],
        [this.notificationTypes.PAYMENT_SUCCESS]: [this.channels.WHATSAPP],
        [this.notificationTypes.PAYMENT_FAILED]: [this.channels.WHATSAPP]
      },
      coordinator: {
        [this.notificationTypes.CAMPAIGN_CREATED]: [this.channels.WHATSAPP],
        [this.notificationTypes.DONATION_RECEIVED]: [this.channels.WHATSAPP],
        [this.notificationTypes.SUPPLIER_APPROVED]: [this.channels.WHATSAPP],
        [this.notificationTypes.LOW_STOCK_ALERT]: [this.channels.WHATSAPP]
      }
    };
  }

  /**
   * Send notification to user(s)
   */
  async sendNotification(tenantId, notificationType, recipients, data = {}) {
    try {
      const results = [];

      // Ensure recipients is an array
      const recipientList = Array.isArray(recipients) ? recipients : [recipients];

      for (const recipient of recipientList) {
        try {
          const userPreferences = await this.getUserNotificationPreferences(
            recipient.id || recipient.userId, 
            recipient.role, 
            tenantId
          );

          const channels = userPreferences[notificationType] || [];

          for (const channel of channels) {
            const result = await this.sendNotificationByChannel(
              channel,
              tenantId,
              notificationType,
              recipient,
              data
            );
            results.push(result);
          }

        } catch (error) {
          logger.error('Error sending notification to recipient:', {
            recipient: recipient.id || recipient.phone,
            error: error.message
          });
          results.push({
            recipient: recipient.id || recipient.phone,
            success: false,
            error: error.message
          });
        }
      }

      // Log notification summary
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      logger.info('Notification batch sent:', {
        tenantId,
        notificationType,
        totalRecipients: recipientList.length,
        successful,
        failed
      });

      return {
        success: true,
        results,
        summary: {
          total: recipientList.length,
          successful,
          failed
        }
      };

    } catch (error) {
      logger.error('Error in sendNotification:', error);
      throw error;
    }
  }

  /**
   * Send notification by specific channel
   */
  async sendNotificationByChannel(channel, tenantId, notificationType, recipient, data) {
    try {
      switch (channel) {
        case this.channels.WHATSAPP:
          return await this.sendWhatsAppNotification(tenantId, notificationType, recipient, data);
        case this.channels.EMAIL:
          return await this.sendEmailNotification(tenantId, notificationType, recipient, data);
        case this.channels.SMS:
          return await this.sendSMSNotification(tenantId, notificationType, recipient, data);
        default:
          throw new Error(`Unsupported notification channel: ${channel}`);
      }
    } catch (error) {
      logger.error(`Error sending ${channel} notification:`, error);
      return {
        recipient: recipient.id || recipient.phone,
        channel,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send WhatsApp notification
   */
  async sendWhatsAppNotification(tenantId, notificationType, recipient, data) {
    try {
      if (!recipient.phone) {
        throw new Error('Recipient phone number is required for WhatsApp notifications');
      }

      // Get message template
      const template = await MessageTemplateService.getTemplate(tenantId, notificationType, 'whatsapp');
      if (!template) {
        throw new Error(`No WhatsApp template found for ${notificationType}`);
      }

      // Process template with data
      const message = await this.processTemplate(template.content, data, tenantId);

      // Send WhatsApp message
      const result = await WhatsAppService.sendMessage(recipient.phone, message, tenantId);

      return {
        recipient: recipient.id || recipient.phone,
        channel: this.channels.WHATSAPP,
        success: true,
        messageId: result.messages[0].id
      };

    } catch (error) {
      throw new Error(`WhatsApp notification failed: ${error.message}`);
    }
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(tenantId, notificationType, recipient, data) {
    try {
      if (!recipient.email) {
        throw new Error('Recipient email is required for email notifications');
      }

      // Get email template
      const template = await MessageTemplateService.getTemplate(tenantId, notificationType, 'email');
      if (!template) {
        throw new Error(`No email template found for ${notificationType}`);
      }

      // Process template
      const subject = await this.processTemplate(template.subject || 'Notificación - Pan Compartido', data, tenantId);
      const content = await this.processTemplate(template.content, data, tenantId);

      // TODO: Integrate with email service (SendGrid, SES, etc.)
      logger.info('Email notification would be sent:', {
        to: recipient.email,
        subject,
        content: content.substring(0, 100) + '...'
      });

      return {
        recipient: recipient.id || recipient.email,
        channel: this.channels.EMAIL,
        success: true,
        messageId: `email_${Date.now()}`
      };

    } catch (error) {
      throw new Error(`Email notification failed: ${error.message}`);
    }
  }

  /**
   * Send SMS notification
   */
  async sendSMSNotification(tenantId, notificationType, recipient, data) {
    try {
      if (!recipient.phone) {
        throw new Error('Recipient phone number is required for SMS notifications');
      }

      // Get SMS template
      const template = await MessageTemplateService.getTemplate(tenantId, notificationType, 'sms');
      if (!template) {
        throw new Error(`No SMS template found for ${notificationType}`);
      }

      // Process template
      const message = await this.processTemplate(template.content, data, tenantId);

      // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
      logger.info('SMS notification would be sent:', {
        to: recipient.phone,
        message: message.substring(0, 100) + '...'
      });

      return {
        recipient: recipient.id || recipient.phone,
        channel: this.channels.SMS,
        success: true,
        messageId: `sms_${Date.now()}`
      };

    } catch (error) {
      throw new Error(`SMS notification failed: ${error.message}`);
    }
  }

  /**
   * Process message template with data
   */
  async processTemplate(template, data, tenantId) {
    try {
      let processedMessage = template;

      // Get tenant info for branding
      const TenantService = require('./TenantService');
      const tenant = await TenantService.getTenantById(tenantId);

      // Standard replacements
      const replacements = {
        '{{tenant_name}}': tenant?.name || 'Pan Compartido',
        '{{tenant_contact}}': tenant?.contactInfo?.phone || '',
        '{{date}}': new Date().toLocaleDateString('es-CO'),
        '{{time}}': new Date().toLocaleTimeString('es-CO'),
        ...data
      };

      // Replace all placeholders
      for (const [placeholder, value] of Object.entries(replacements)) {
        const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
        processedMessage = processedMessage.replace(regex, value || '');
      }

      return processedMessage;

    } catch (error) {
      logger.error('Error processing template:', error);
      return template; // Return original template if processing fails
    }
  }

  /**
   * Get user notification preferences
   */
  async getUserNotificationPreferences(userId, userRole, tenantId) {
    try {
      // TODO: Query user preferences from database
      // For now, return default preferences based on role
      return this.defaultPreferences[userRole] || this.defaultPreferences.parishioner;

    } catch (error) {
      logger.error('Error getting user notification preferences:', error);
      return this.defaultPreferences.parishioner;
    }
  }

  /**
   * Send campaign creation notification
   */
  async notifyCampaignCreated(tenantId, campaign, createdBy) {
    try {
      // Get all parishioners for this tenant
      const recipients = await this.getParishioners(tenantId);

      const data = {
        '{{campaign_title}}': campaign.title,
        '{{campaign_description}}': campaign.description,
        '{{target_amount}}': this.formatCurrency(campaign.targetAmount),
        '{{created_by}}': createdBy.name,
        '{{campaign_url}}': `${process.env.FRONTEND_URL}/campaigns/${campaign.id}`
      };

      return await this.sendNotification(
        tenantId,
        this.notificationTypes.CAMPAIGN_CREATED,
        recipients,
        data
      );

    } catch (error) {
      logger.error('Error sending campaign creation notification:', error);
      throw error;
    }
  }

  /**
   * Send urgent campaign notification
   */
  async notifyCampaignUrgent(tenantId, campaign) {
    try {
      const recipients = await this.getParishioners(tenantId);

      const data = {
        '{{campaign_title}}': campaign.title,
        '{{days_remaining}}': campaign.daysRemaining,
        '{{completion_percentage}}': Math.round(campaign.completionPercentage),
        '{{remaining_amount}}': this.formatCurrency(campaign.targetAmount - campaign.raisedAmount),
        '{{campaign_url}}': `${process.env.FRONTEND_URL}/campaigns/${campaign.id}`
      };

      return await this.sendNotification(
        tenantId,
        this.notificationTypes.CAMPAIGN_URGENT,
        recipients,
        data
      );

    } catch (error) {
      logger.error('Error sending urgent campaign notification:', error);
      throw error;
    }
  }

  /**
   * Send donation confirmation
   */
  async notifyDonationConfirmation(tenantId, donation, donor) {
    try {
      const data = {
        '{{donor_name}}': donor.name,
        '{{donation_amount}}': this.formatCurrency(donation.amount),
        '{{campaign_title}}': donation.campaign?.title || 'Donación general',
        '{{donation_id}}': donation.id,
        '{{donation_date}}': new Date(donation.createdAt).toLocaleDateString('es-CO')
      };

      return await this.sendNotification(
        tenantId,
        this.notificationTypes.DONATION_CONFIRMATION,
        [donor],
        data
      );

    } catch (error) {
      logger.error('Error sending donation confirmation:', error);
      throw error;
    }
  }

  /**
   * Send payment success notification
   */
  async notifyPaymentSuccess(tenantId, payment, user) {
    try {
      const data = {
        '{{user_name}}': user.name,
        '{{payment_amount}}': this.formatCurrency(payment.amount),
        '{{payment_id}}': payment.id,
        '{{payment_method}}': payment.paymentMethod,
        '{{payment_date}}': new Date(payment.createdAt).toLocaleDateString('es-CO')
      };

      return await this.sendNotification(
        tenantId,
        this.notificationTypes.PAYMENT_SUCCESS,
        [user],
        data
      );

    } catch (error) {
      logger.error('Error sending payment success notification:', error);
      throw error;
    }
  }

  /**
   * Send weekly summary to priests
   */
  async sendWeeklySummary(tenantId) {
    try {
      // Get priests for this tenant
      const priests = await this.getPriests(tenantId);

      // Get weekly statistics
      const stats = await this.getWeeklyStats(tenantId);

      const data = {
        '{{week_start}}': stats.weekStart,
        '{{week_end}}': stats.weekEnd,
        '{{total_donations}}': stats.totalDonations,
        '{{total_amount}}': this.formatCurrency(stats.totalAmount),
        '{{new_campaigns}}': stats.newCampaigns,
        '{{completed_campaigns}}': stats.completedCampaigns,
        '{{active_parishioners}}': stats.activeParishioners
      };

      return await this.sendNotification(
        tenantId,
        this.notificationTypes.WEEKLY_SUMMARY,
        priests,
        data
      );

    } catch (error) {
      logger.error('Error sending weekly summary:', error);
      throw error;
    }
  }

  /**
   * Schedule automatic notifications
   */
  async scheduleNotifications(tenantId) {
    try {
      // This would integrate with a job scheduler like node-cron or Bull
      const cron = require('node-cron');

      // Weekly summary every Monday at 9 AM
      cron.schedule('0 9 * * 1', async () => {
        await this.sendWeeklySummary(tenantId);
      });

      // Check for urgent campaigns daily at 6 PM
      cron.schedule('0 18 * * *', async () => {
        await this.checkUrgentCampaigns(tenantId);
      });

      logger.info('Automatic notifications scheduled for tenant:', tenantId);

    } catch (error) {
      logger.error('Error scheduling notifications:', error);
      throw error;
    }
  }

  /**
   * Check for urgent campaigns and notify
   */
  async checkUrgentCampaigns(tenantId) {
    try {
      const CampaignService = require('./CampaignService');
      const campaigns = await CampaignService.getActiveCampaigns(tenantId);

      for (const campaign of campaigns) {
        // Notify if campaign is urgent (less than 3 days remaining and less than 75% complete)
        if (campaign.daysRemaining <= 3 && campaign.completionPercentage < 75) {
          await this.notifyCampaignUrgent(tenantId, campaign);
        }
      }

    } catch (error) {
      logger.error('Error checking urgent campaigns:', error);
    }
  }

  /**
   * Get parishioners for notifications
   */
  async getParishioners(tenantId) {
    try {
      // TODO: Query database for parishioners
      // This would get users with role 'parishioner' and notification preferences
      return [];

    } catch (error) {
      logger.error('Error getting parishioners:', error);
      return [];
    }
  }

  /**
   * Get priests for notifications
   */
  async getPriests(tenantId) {
    try {
      // TODO: Query database for priests
      return [];

    } catch (error) {
      logger.error('Error getting priests:', error);
      return [];
    }
  }

  /**
   * Get weekly statistics
   */
  async getWeeklyStats(tenantId) {
    try {
      const now = new Date();
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      // TODO: Query actual statistics from database
      return {
        weekStart: weekStart.toLocaleDateString('es-CO'),
        weekEnd: weekEnd.toLocaleDateString('es-CO'),
        totalDonations: 45,
        totalAmount: 2500000,
        newCampaigns: 3,
        completedCampaigns: 1,
        activeParishioners: 89
      };

    } catch (error) {
      logger.error('Error getting weekly stats:', error);
      return {};
    }
  }

  /**
   * Format currency
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Send bulk notification to all parishioners
   */
  async sendBulkNotification(tenantId, message, senderId) {
    try {
      const recipients = await this.getParishioners(tenantId);
      
      if (recipients.length === 0) {
        throw new Error('No recipients found');
      }

      // Send via WhatsApp
      const phoneNumbers = recipients
        .filter(r => r.phone)
        .map(r => r.phone);

      const result = await WhatsAppService.sendBroadcast(phoneNumbers, message, tenantId);

      logger.info('Bulk notification sent:', {
        tenantId,
        senderId,
        totalRecipients: phoneNumbers.length,
        message: message.substring(0, 50) + '...'
      });

      return result;

    } catch (error) {
      logger.error('Error sending bulk notification:', error);
      throw error;
    }
  }

  /**
   * Get notification analytics
   */
  async getNotificationAnalytics(tenantId, period = '30d') {
    try {
      // TODO: Query notification logs from database
      return {
        totalSent: 1250,
        successRate: 94.5,
        channelBreakdown: {
          whatsapp: 850,
          email: 300,
          sms: 100
        },
        typeBreakdown: {
          campaign_created: 45,
          donation_confirmation: 380,
          payment_success: 420,
          weekly_summary: 12,
          urgent_campaign: 23
        },
        deliveryRate: {
          whatsapp: 96.2,
          email: 89.1,
          sms: 98.5
        }
      };

    } catch (error) {
      logger.error('Error getting notification analytics:', error);
      throw error;
    }
  }
}

module.exports = new NotificationService();