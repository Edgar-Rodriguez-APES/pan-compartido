const express = require('express');
const router = express.Router();
const AutoNotificationService = require('../services/AutoNotificationService');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

/**
 * Send campaign creation notification
 */
router.post('/campaign-created', authMiddleware, async (req, res) => {
  try {
    const { campaignId } = req.body;
    const tenantId = req.tenant.id;

    // Check permissions (priest or admin)
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to send notifications'
      });
    }

    if (!campaignId) {
      return res.status(400).json({
        error: 'Campaign ID is required'
      });
    }

    const result = await AutoNotificationService.notifyCampaignCreated(campaignId, tenantId);

    res.json({
      success: true,
      message: 'Campaign creation notifications sent',
      sent: result.successful,
      failed: result.failed
    });

  } catch (error) {
    logger.error('Error sending campaign creation notification:', error);
    res.status(500).json({
      error: error.message || 'Failed to send notifications'
    });
  }
});

/**
 * Send campaign goal reached notification
 */
router.post('/campaign-goal-reached', authMiddleware, async (req, res) => {
  try {
    const { campaignId } = req.body;
    const tenantId = req.tenant.id;

    // Check permissions
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to send notifications'
      });
    }

    if (!campaignId) {
      return res.status(400).json({
        error: 'Campaign ID is required'
      });
    }

    const result = await AutoNotificationService.notifyCampaignGoalReached(campaignId, tenantId);

    res.json({
      success: true,
      message: 'Campaign goal reached notifications sent',
      sent: result.successful,
      failed: result.failed
    });

  } catch (error) {
    logger.error('Error sending campaign goal reached notification:', error);
    res.status(500).json({
      error: error.message || 'Failed to send notifications'
    });
  }
});

/**
 * Send urgent campaign notification
 */
router.post('/campaign-urgent', authMiddleware, async (req, res) => {
  try {
    const { campaignId, urgentNeeds } = req.body;
    const tenantId = req.tenant.id;

    // Check permissions
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to send notifications'
      });
    }

    if (!campaignId) {
      return res.status(400).json({
        error: 'Campaign ID is required'
      });
    }

    const result = await AutoNotificationService.notifyUrgentCampaign(
      campaignId, 
      tenantId, 
      urgentNeeds || []
    );

    res.json({
      success: true,
      message: 'Urgent campaign notifications sent',
      sent: result.successful,
      failed: result.failed
    });

  } catch (error) {
    logger.error('Error sending urgent campaign notification:', error);
    res.status(500).json({
      error: error.message || 'Failed to send notifications'
    });
  }
});

/**
 * Send campaign ending notification
 */
router.post('/campaign-ending', authMiddleware, async (req, res) => {
  try {
    const { campaignId } = req.body;
    const tenantId = req.tenant.id;

    // Check permissions
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to send notifications'
      });
    }

    if (!campaignId) {
      return res.status(400).json({
        error: 'Campaign ID is required'
      });
    }

    const result = await AutoNotificationService.notifyCampaignEnding(campaignId, tenantId);

    res.json({
      success: true,
      message: 'Campaign ending notifications sent',
      sent: result.successful,
      failed: result.failed
    });

  } catch (error) {
    logger.error('Error sending campaign ending notification:', error);
    res.status(500).json({
      error: error.message || 'Failed to send notifications'
    });
  }
});

/**
 * Send donation thank you notification
 */
router.post('/donation-thank-you', authMiddleware, async (req, res) => {
  try {
    const { donationId, donorPhone } = req.body;
    const tenantId = req.tenant.id;

    if (!donationId || !donorPhone) {
      return res.status(400).json({
        error: 'Donation ID and donor phone are required'
      });
    }

    const result = await AutoNotificationService.notifyDonationThankYou(
      donationId, 
      tenantId, 
      donorPhone
    );

    res.json({
      success: true,
      message: 'Thank you notification sent',
      sent: result.sent,
      failed: result.failed
    });

  } catch (error) {
    logger.error('Error sending donation thank you:', error);
    res.status(500).json({
      error: error.message || 'Failed to send notification'
    });
  }
});

/**
 * Send weekly summary
 */
router.post('/weekly-summary', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;

    // Check permissions
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to send summaries'
      });
    }

    const result = await AutoNotificationService.sendWeeklySummary(tenantId);

    res.json({
      success: true,
      message: 'Weekly summary sent',
      sent: result.successful,
      failed: result.failed
    });

  } catch (error) {
    logger.error('Error sending weekly summary:', error);
    res.status(500).json({
      error: error.message || 'Failed to send weekly summary'
    });
  }
});

/**
 * Send monthly report
 */
router.post('/monthly-report', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;

    // Check permissions
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to send reports'
      });
    }

    const result = await AutoNotificationService.sendMonthlyReport(tenantId);

    res.json({
      success: true,
      message: 'Monthly report sent',
      sent: result.successful,
      failed: result.failed
    });

  } catch (error) {
    logger.error('Error sending monthly report:', error);
    res.status(500).json({
      error: error.message || 'Failed to send monthly report'
    });
  }
});

/**
 * Send emergency alert
 */
router.post('/emergency-alert', authMiddleware, async (req, res) => {
  try {
    const { message, priority = 'high' } = req.body;
    const tenantId = req.tenant.id;

    // Check permissions (admin only for emergency alerts)
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Only administrators can send emergency alerts'
      });
    }

    if (!message || message.trim().length < 10) {
      return res.status(400).json({
        error: 'Emergency message must be at least 10 characters long'
      });
    }

    const validPriorities = ['low', 'medium', 'high'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        error: 'Priority must be one of: ' + validPriorities.join(', ')
      });
    }

    const result = await AutoNotificationService.sendEmergencyAlert(
      tenantId, 
      message, 
      priority
    );

    res.json({
      success: true,
      message: 'Emergency alert sent',
      sent: result.successful,
      failed: result.failed,
      priority
    });

  } catch (error) {
    logger.error('Error sending emergency alert:', error);
    res.status(500).json({
      error: error.message || 'Failed to send emergency alert'
    });
  }
});

/**
 * Subscribe user to notifications
 */
router.post('/subscribe', authMiddleware, async (req, res) => {
  try {
    const { phoneNumber, preferences = {} } = req.body;
    const tenantId = req.tenant.id;
    const userId = req.user.id;

    if (!phoneNumber) {
      return res.status(400).json({
        error: 'Phone number is required'
      });
    }

    // Validate phone number format
    const phoneRegex = /^\\+?[1-9]\\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber.replace(/\\s/g, ''))) {
      return res.status(400).json({
        error: 'Invalid phone number format'
      });
    }

    const success = await AutoNotificationService.subscribeUser(
      tenantId, 
      phoneNumber, 
      userId, 
      preferences
    );

    if (success) {
      res.json({
        success: true,
        message: 'Successfully subscribed to notifications'
      });
    } else {
      res.status(500).json({
        error: 'Failed to subscribe to notifications'
      });
    }

  } catch (error) {
    logger.error('Error subscribing to notifications:', error);
    res.status(500).json({
      error: error.message || 'Failed to subscribe'
    });
  }
});

/**
 * Unsubscribe user from notifications
 */
router.post('/unsubscribe', authMiddleware, async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const tenantId = req.tenant.id;

    if (!phoneNumber) {
      return res.status(400).json({
        error: 'Phone number is required'
      });
    }

    const success = await AutoNotificationService.unsubscribeUser(tenantId, phoneNumber);

    if (success) {
      res.json({
        success: true,
        message: 'Successfully unsubscribed from notifications'
      });
    } else {
      res.status(500).json({
        error: 'Failed to unsubscribe from notifications'
      });
    }

  } catch (error) {
    logger.error('Error unsubscribing from notifications:', error);
    res.status(500).json({
      error: error.message || 'Failed to unsubscribe'
    });
  }
});

/**
 * Get notification statistics
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { period = '30d' } = req.query;

    // Check permissions
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to view notification statistics'
      });
    }

    // Get notification statistics from database
    const db = require('../config/database');
    
    const startDate = new Date();
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    const stats = await db('notification_logs')
      .where('tenant_id', tenantId)
      .where('created_at', '>=', startDate)
      .select(
        'type',
        db.raw('COUNT(*) as total_batches'),
        db.raw('SUM(recipients) as total_recipients'),
        db.raw('SUM(successful) as total_successful'),
        db.raw('SUM(failed) as total_failed')
      )
      .groupBy('type');

    const subscriberCount = await db('notification_subscribers')
      .where({ tenant_id: tenantId, active: true })
      .count('* as count')
      .first();

    const totalStats = stats.reduce((acc, stat) => {
      acc.totalBatches += parseInt(stat.total_batches);
      acc.totalRecipients += parseInt(stat.total_recipients);
      acc.totalSuccessful += parseInt(stat.total_successful);
      acc.totalFailed += parseInt(stat.total_failed);
      return acc;
    }, { totalBatches: 0, totalRecipients: 0, totalSuccessful: 0, totalFailed: 0 });

    const successRate = totalStats.totalRecipients > 0 
      ? (totalStats.totalSuccessful / totalStats.totalRecipients) * 100 
      : 0;

    res.json({
      success: true,
      stats: {
        period,
        subscribers: parseInt(subscriberCount.count),
        total_batches: totalStats.totalBatches,
        total_recipients: totalStats.totalRecipients,
        total_successful: totalStats.totalSuccessful,
        total_failed: totalStats.totalFailed,
        success_rate: parseFloat(successRate.toFixed(2)),
        by_type: stats.map(stat => ({
          type: stat.type,
          batches: parseInt(stat.total_batches),
          recipients: parseInt(stat.total_recipients),
          successful: parseInt(stat.total_successful),
          failed: parseInt(stat.total_failed)
        }))
      }
    });

  } catch (error) {
    logger.error('Error getting notification stats:', error);
    res.status(500).json({
      error: error.message || 'Failed to get notification statistics'
    });
  }
});

/**
 * Test notification system
 */
router.post('/test', authMiddleware, async (req, res) => {
  try {
    const { phoneNumber, type = 'test' } = req.body;
    const tenantId = req.tenant.id;

    // Check permissions (admin only for testing)
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Only administrators can test notifications'
      });
    }

    if (!phoneNumber) {
      return res.status(400).json({
        error: 'Phone number is required for testing'
      });
    }

    const WhatsAppService = require('../services/WhatsAppService');
    const testMessage = `🧪 *Prueba de Notificaciones*\\n\\nEste es un mensaje de prueba del sistema de notificaciones automáticas de Pan Compartido.\\n\\nFecha: ${new Date().toLocaleString('es-CO')}\\nTipo: ${type}`;
    
    await WhatsAppService.sendMessage(phoneNumber, testMessage, tenantId);

    res.json({
      success: true,
      message: 'Test notification sent successfully'
    });

  } catch (error) {
    logger.error('Error sending test notification:', error);
    res.status(500).json({
      error: error.message || 'Failed to send test notification'
    });
  }
});

module.exports = router;