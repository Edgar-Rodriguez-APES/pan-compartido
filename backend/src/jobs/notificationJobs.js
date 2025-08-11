const cron = require('node-cron');
const AutoNotificationService = require('../services/AutoNotificationService');
const logger = require('../utils/logger');

class NotificationJobs {
  constructor() {
    this.jobs = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize all notification jobs
   */
  initialize() {
    if (this.isInitialized) {
      logger.warn('Notification jobs already initialized');
      return;
    }

    try {
      // Daily campaign reminders at 6 PM
      this.scheduleJob('campaign-reminders', '0 18 * * *', async () => {
        await this.processCampaignReminders();
      });

      // Weekly summaries on Sundays at 10 AM
      this.scheduleJob('weekly-summaries', '0 10 * * 0', async () => {
        await this.processWeeklySummaries();
      });

      // Monthly reports on 1st of month at 9 AM
      this.scheduleJob('monthly-reports', '0 9 1 * *', async () => {
        await this.processMonthlyReports();
      });

      // Check for urgent campaigns every 6 hours
      this.scheduleJob('urgent-checks', '0 */6 * * *', async () => {
        await this.processUrgentChecks();
      });

      // Check for ending campaigns daily at 9 AM
      this.scheduleJob('ending-campaigns', '0 9 * * *', async () => {
        await this.processEndingCampaigns();
      });

      // Check for completed campaigns every hour
      this.scheduleJob('completed-campaigns', '0 * * * *', async () => {
        await this.processCompletedCampaigns();
      });

      // Clean up old notification logs weekly
      this.scheduleJob('cleanup-logs', '0 2 * * 0', async () => {
        await this.cleanupOldLogs();
      });

      this.isInitialized = true;
      logger.info('Notification jobs initialized successfully');

    } catch (error) {
      logger.error('Error initializing notification jobs:', error);
      throw error;
    }
  }

  /**
   * Schedule a job
   */
  scheduleJob(name, schedule, task) {
    try {
      const job = cron.schedule(schedule, async () => {
        logger.info(`Starting job: ${name}`);
        const startTime = Date.now();
        
        try {
          await task();
          const duration = Date.now() - startTime;
          logger.info(`Job completed: ${name} (${duration}ms)`);
        } catch (error) {
          logger.error(`Job failed: ${name}`, error);
        }
      }, {
        scheduled: false,
        timezone: 'America/Bogota'
      });

      this.jobs.set(name, job);
      job.start();
      
      logger.info(`Job scheduled: ${name} with schedule: ${schedule}`);

    } catch (error) {
      logger.error(`Error scheduling job ${name}:`, error);
      throw error;
    }
  }

  /**
   * Process campaign reminders
   */
  async processCampaignReminders() {
    try {
      const db = require('../config/database');
      
      // Get all active tenants
      const tenants = await db('tenants')
        .where('status', 'active')
        .select('id', 'name');

      let totalProcessed = 0;
      let totalSent = 0;

      for (const tenant of tenants) {
        try {
          // Get campaigns that need reminders
          const campaigns = await this.getCampaignsNeedingReminders(tenant.id);
          
          for (const campaign of campaigns) {
            // Check if campaign needs urgent notification
            if (this.shouldSendUrgentNotification(campaign)) {
              const result = await AutoNotificationService.notifyUrgentCampaign(
                campaign.id, 
                tenant.id, 
                campaign.urgentNeeds
              );
              totalSent += result.successful;
            }
            
            // Check if campaign is ending soon
            if (this.shouldSendEndingNotification(campaign)) {
              const result = await AutoNotificationService.notifyCampaignEnding(
                campaign.id, 
                tenant.id
              );
              totalSent += result.successful;
            }
          }
          
          totalProcessed += campaigns.length;

        } catch (error) {
          logger.error(`Error processing reminders for tenant ${tenant.id}:`, error);
        }
      }

      logger.info('Campaign reminders processed:', {
        tenants: tenants.length,
        campaigns: totalProcessed,
        notifications: totalSent
      });

    } catch (error) {
      logger.error('Error processing campaign reminders:', error);
    }
  }

  /**
   * Process weekly summaries
   */
  async processWeeklySummaries() {
    try {
      const db = require('../config/database');
      
      const tenants = await db('tenants')
        .where('status', 'active')
        .select('id', 'name');

      let totalSent = 0;

      for (const tenant of tenants) {
        try {
          const result = await AutoNotificationService.sendWeeklySummary(tenant.id);
          totalSent += result.successful;
        } catch (error) {
          logger.error(`Error sending weekly summary for tenant ${tenant.id}:`, error);
        }
      }

      logger.info('Weekly summaries processed:', {
        tenants: tenants.length,
        notifications: totalSent
      });

    } catch (error) {
      logger.error('Error processing weekly summaries:', error);
    }
  }

  /**
   * Process monthly reports
   */
  async processMonthlyReports() {
    try {
      const db = require('../config/database');
      
      const tenants = await db('tenants')
        .where('status', 'active')
        .select('id', 'name');

      let totalSent = 0;

      for (const tenant of tenants) {
        try {
          const result = await AutoNotificationService.sendMonthlyReport(tenant.id);
          totalSent += result.successful;
        } catch (error) {
          logger.error(`Error sending monthly report for tenant ${tenant.id}:`, error);
        }
      }

      logger.info('Monthly reports processed:', {
        tenants: tenants.length,
        notifications: totalSent
      });

    } catch (error) {
      logger.error('Error processing monthly reports:', error);
    }
  }

  /**
   * Process urgent checks
   */
  async processUrgentChecks() {
    try {
      const db = require('../config/database');
      
      const tenants = await db('tenants')
        .where('status', 'active')
        .select('id', 'name');

      let totalProcessed = 0;
      let totalSent = 0;

      for (const tenant of tenants) {
        try {
          // Get campaigns with urgent needs
          const urgentCampaigns = await this.getUrgentCampaigns(tenant.id);
          
          for (const campaign of urgentCampaigns) {
            // Check if we haven't sent urgent notification recently
            const lastUrgentNotification = await this.getLastNotification(
              tenant.id, 
              campaign.id, 
              'campaign_urgent'
            );
            
            const hoursSinceLastNotification = lastUrgentNotification 
              ? (Date.now() - new Date(lastUrgentNotification.created_at).getTime()) / (1000 * 60 * 60)
              : 24; // If no previous notification, consider it's been 24 hours
            
            // Only send if it's been more than 12 hours since last urgent notification
            if (hoursSinceLastNotification >= 12) {
              const result = await AutoNotificationService.notifyUrgentCampaign(
                campaign.id, 
                tenant.id, 
                campaign.urgentNeeds
              );
              totalSent += result.successful;
            }
          }
          
          totalProcessed += urgentCampaigns.length;

        } catch (error) {
          logger.error(`Error processing urgent checks for tenant ${tenant.id}:`, error);
        }
      }

      logger.info('Urgent checks processed:', {
        tenants: tenants.length,
        campaigns: totalProcessed,
        notifications: totalSent
      });

    } catch (error) {
      logger.error('Error processing urgent checks:', error);
    }
  }

  /**
   * Process ending campaigns
   */
  async processEndingCampaigns() {
    try {
      const db = require('../config/database');
      
      const tenants = await db('tenants')
        .where('status', 'active')
        .select('id', 'name');

      let totalProcessed = 0;
      let totalSent = 0;

      for (const tenant of tenants) {
        try {
          // Get campaigns ending in 3 days or less
          const endingCampaigns = await this.getEndingCampaigns(tenant.id, 3);
          
          for (const campaign of endingCampaigns) {
            // Check if we haven't sent ending notification for this campaign
            const lastEndingNotification = await this.getLastNotification(
              tenant.id, 
              campaign.id, 
              'campaign_ending'
            );
            
            // Only send once per campaign
            if (!lastEndingNotification) {
              const result = await AutoNotificationService.notifyCampaignEnding(
                campaign.id, 
                tenant.id
              );
              totalSent += result.successful;
            }
          }
          
          totalProcessed += endingCampaigns.length;

        } catch (error) {
          logger.error(`Error processing ending campaigns for tenant ${tenant.id}:`, error);
        }
      }

      logger.info('Ending campaigns processed:', {
        tenants: tenants.length,
        campaigns: totalProcessed,
        notifications: totalSent
      });

    } catch (error) {
      logger.error('Error processing ending campaigns:', error);
    }
  }

  /**
   * Process completed campaigns
   */
  async processCompletedCampaigns() {
    try {
      const db = require('../config/database');
      
      const tenants = await db('tenants')
        .where('status', 'active')
        .select('id', 'name');

      let totalProcessed = 0;
      let totalSent = 0;

      for (const tenant of tenants) {
        try {
          // Get recently completed campaigns (completed in last hour)
          const completedCampaigns = await this.getRecentlyCompletedCampaigns(tenant.id);
          
          for (const campaign of completedCampaigns) {
            // Check if we haven't sent completion notification
            const lastCompletionNotification = await this.getLastNotification(
              tenant.id, 
              campaign.id, 
              'campaign_goal_reached'
            );
            
            // Only send once per campaign
            if (!lastCompletionNotification) {
              const result = await AutoNotificationService.notifyCampaignGoalReached(
                campaign.id, 
                tenant.id
              );
              totalSent += result.successful;
            }
          }
          
          totalProcessed += completedCampaigns.length;

        } catch (error) {
          logger.error(`Error processing completed campaigns for tenant ${tenant.id}:`, error);
        }
      }

      logger.info('Completed campaigns processed:', {
        tenants: tenants.length,
        campaigns: totalProcessed,
        notifications: totalSent
      });

    } catch (error) {
      logger.error('Error processing completed campaigns:', error);
    }
  }

  /**
   * Clean up old notification logs
   */
  async cleanupOldLogs() {
    try {
      const db = require('../config/database');
      
      // Delete logs older than 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const deletedCount = await db('notification_logs')
        .where('created_at', '<', ninetyDaysAgo)
        .del();

      logger.info('Old notification logs cleaned up:', {
        deleted: deletedCount,
        cutoff_date: ninetyDaysAgo.toISOString()
      });

    } catch (error) {
      logger.error('Error cleaning up old logs:', error);
    }
  }

  /**
   * Helper methods for campaign queries
   */
  async getCampaignsNeedingReminders(tenantId) {
    try {
      const db = require('../config/database');
      
      const campaigns = await db('campaigns')
        .where({
          tenant_id: tenantId,
          status: 'active'
        })
        .where('end_date', '>', new Date())
        .select('*');

      // Add logic to determine urgent needs for each campaign
      for (const campaign of campaigns) {
        campaign.urgentNeeds = await this.getUrgentNeedsForCampaign(campaign.id);
      }

      return campaigns;

    } catch (error) {
      logger.error('Error getting campaigns needing reminders:', error);
      return [];
    }
  }

  async getUrgentCampaigns(tenantId) {
    try {
      const db = require('../config/database');
      
      // Get campaigns that are less than 50% funded and ending in 7 days
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const campaigns = await db('campaigns')
        .where({
          tenant_id: tenantId,
          status: 'active'
        })
        .where('end_date', '<=', sevenDaysFromNow)
        .where('end_date', '>', new Date())
        .whereRaw('raised_amount < (target_amount * 0.5)')
        .select('*');

      // Add urgent needs for each campaign
      for (const campaign of campaigns) {
        campaign.urgentNeeds = await this.getUrgentNeedsForCampaign(campaign.id);
      }

      return campaigns;

    } catch (error) {
      logger.error('Error getting urgent campaigns:', error);
      return [];
    }
  }

  async getEndingCampaigns(tenantId, daysThreshold) {
    try {
      const db = require('../config/database');
      
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

      const campaigns = await db('campaigns')
        .where({
          tenant_id: tenantId,
          status: 'active'
        })
        .where('end_date', '<=', thresholdDate)
        .where('end_date', '>', new Date())
        .select('*');

      return campaigns;

    } catch (error) {
      logger.error('Error getting ending campaigns:', error);
      return [];
    }
  }

  async getRecentlyCompletedCampaigns(tenantId) {
    try {
      const db = require('../config/database');
      
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const campaigns = await db('campaigns')
        .where({
          tenant_id: tenantId,
          status: 'completed'
        })
        .where('updated_at', '>=', oneHourAgo)
        .select('*');

      return campaigns;

    } catch (error) {
      logger.error('Error getting recently completed campaigns:', error);
      return [];
    }
  }

  async getUrgentNeedsForCampaign(campaignId) {
    try {
      const db = require('../config/database');
      
      // This would get the most urgent product needs for a campaign
      const urgentNeeds = await db('campaign_products')
        .join('products', 'campaign_products.product_id', 'products.id')
        .where('campaign_products.campaign_id', campaignId)
        .whereRaw('campaign_products.received_quantity < campaign_products.target_quantity')
        .select(
          'products.name as productName',
          'products.unit',
          db.raw('(campaign_products.target_quantity - campaign_products.received_quantity) as remaining')
        )
        .orderBy('remaining', 'desc')
        .limit(5);

      return urgentNeeds;

    } catch (error) {
      logger.error('Error getting urgent needs for campaign:', error);
      return [];
    }
  }

  async getLastNotification(tenantId, campaignId, type) {
    try {
      const db = require('../config/database');
      
      const lastNotification = await db('notification_logs')
        .where({
          tenant_id: tenantId,
          type: type
        })
        .whereRaw("metadata->>'campaignId' = ?", [campaignId.toString()])
        .orderBy('created_at', 'desc')
        .first();

      return lastNotification;

    } catch (error) {
      logger.error('Error getting last notification:', error);
      return null;
    }
  }

  shouldSendUrgentNotification(campaign) {
    const daysRemaining = Math.ceil((new Date(campaign.end_date) - new Date()) / (1000 * 60 * 60 * 24));
    const completionPercentage = (campaign.raised_amount / campaign.target_amount) * 100;
    
    // Send urgent if less than 7 days remaining and less than 50% complete
    return daysRemaining <= 7 && completionPercentage < 50;
  }

  shouldSendEndingNotification(campaign) {
    const daysRemaining = Math.ceil((new Date(campaign.end_date) - new Date()) / (1000 * 60 * 60 * 24));
    
    // Send ending notification if 3 days or less remaining
    return daysRemaining <= 3 && daysRemaining > 0;
  }

  /**
   * Stop all jobs
   */
  stopAll() {
    try {
      this.jobs.forEach((job, name) => {
        job.stop();
        logger.info(`Job stopped: ${name}`);
      });
      
      this.jobs.clear();
      this.isInitialized = false;
      
      logger.info('All notification jobs stopped');

    } catch (error) {
      logger.error('Error stopping notification jobs:', error);
    }
  }

  /**
   * Get job status
   */
  getStatus() {
    const status = {
      initialized: this.isInitialized,
      jobs: []
    };

    this.jobs.forEach((job, name) => {
      status.jobs.push({
        name,
        running: job.running || false
      });
    });

    return status;
  }
}

module.exports = new NotificationJobs();