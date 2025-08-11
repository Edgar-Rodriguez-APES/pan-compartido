const express = require('express');
const router = express.Router();
const WhatsAppService = require('../services/WhatsAppService');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

/**
 * WhatsApp webhook verification (GET)
 */
router.get('/webhook', (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verificationResult = WhatsAppService.verifyWebhook(mode, token, challenge);
    
    if (verificationResult) {
      logger.info('WhatsApp webhook verified successfully');
      res.status(200).send(verificationResult);
    } else {
      logger.warn('WhatsApp webhook verification failed');
      res.status(403).send('Forbidden');
    }

  } catch (error) {
    logger.error('Error in webhook verification:', error);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * WhatsApp webhook endpoint (POST)
 */
router.post('/webhook', express.json(), async (req, res) => {
  try {
    logger.info('WhatsApp webhook received:', JSON.stringify(req.body, null, 2));

    const result = await WhatsAppService.processWebhook(req.body);
    
    if (result.processed) {
      res.status(200).json({ success: true });
    } else {
      logger.warn('Webhook not processed:', result.reason);
      res.status(200).json({ success: false, reason: result.reason });
    }

  } catch (error) {
    logger.error('Error processing WhatsApp webhook:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * Send message manually (for testing or admin use)
 */
router.post('/send-message', authMiddleware, async (req, res) => {
  try {
    const { to, message } = req.body;
    const tenantId = req.tenant.id;

    // Check permissions (admin or priest)
    if (!req.user || !['admin', 'priest'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to send WhatsApp messages'
      });
    }

    if (!to || !message) {
      return res.status(400).json({
        error: 'Phone number (to) and message are required'
      });
    }

    const result = await WhatsAppService.sendMessage(to, message, tenantId);

    res.json({
      success: true,
      messageId: result.messages[0].id,
      message: 'Message sent successfully'
    });

  } catch (error) {
    logger.error('Error sending manual WhatsApp message:', error);
    res.status(500).json({
      error: error.message || 'Failed to send message'
    });
  }
});

/**
 * Send button message
 */
router.post('/send-button-message', authMiddleware, async (req, res) => {
  try {
    const { to, text, buttons } = req.body;
    const tenantId = req.tenant.id;

    // Check permissions
    if (!req.user || !['admin', 'priest'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to send WhatsApp messages'
      });
    }

    if (!to || !text || !buttons || !Array.isArray(buttons)) {
      return res.status(400).json({
        error: 'Phone number (to), text, and buttons array are required'
      });
    }

    if (buttons.length > 3) {
      return res.status(400).json({
        error: 'Maximum 3 buttons allowed'
      });
    }

    const result = await WhatsAppService.sendButtonMessage(to, text, buttons, tenantId);

    res.json({
      success: true,
      messageId: result.messages[0].id,
      message: 'Button message sent successfully'
    });

  } catch (error) {
    logger.error('Error sending WhatsApp button message:', error);
    res.status(500).json({
      error: error.message || 'Failed to send button message'
    });
  }
});

/**
 * Send broadcast message
 */
router.post('/broadcast', authMiddleware, async (req, res) => {
  try {
    const { recipients, message } = req.body;
    const tenantId = req.tenant.id;

    // Check permissions (admin or priest)
    if (!req.user || !['admin', 'priest'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to send broadcast messages'
      });
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        error: 'Recipients array is required and cannot be empty'
      });
    }

    if (!message) {
      return res.status(400).json({
        error: 'Message is required'
      });
    }

    if (recipients.length > 100) {
      return res.status(400).json({
        error: 'Maximum 100 recipients allowed per broadcast'
      });
    }

    const results = await WhatsAppService.sendBroadcast(recipients, message, tenantId);

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      success: true,
      summary: {
        total: recipients.length,
        successful,
        failed
      },
      results
    });

  } catch (error) {
    logger.error('Error sending WhatsApp broadcast:', error);
    res.status(500).json({
      error: error.message || 'Failed to send broadcast'
    });
  }
});

/**
 * Get conversation analytics
 */
router.get('/analytics', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { period = '30d' } = req.query;

    // Check permissions
    if (!req.user || !['admin', 'priest'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to view analytics'
      });
    }

    const analytics = await WhatsAppService.getConversationAnalytics(tenantId, period);

    res.json({
      success: true,
      analytics,
      period
    });

  } catch (error) {
    logger.error('Error getting WhatsApp analytics:', error);
    res.status(500).json({
      error: error.message || 'Failed to get analytics'
    });
  }
});

/**
 * Get bot status and configuration
 */
router.get('/status', authMiddleware, async (req, res) => {
  try {
    // Check permissions
    if (!req.user || !['admin', 'priest'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to view bot status'
      });
    }

    const status = {
      configured: !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
      webhook_verified: !!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID || 'Not configured',
      active_conversations: WhatsAppService.conversationStates.size,
      supported_features: [
        'Text messages',
        'Button messages',
        'List messages',
        'Donation flow',
        'Campaign information',
        'Broadcast messages'
      ]
    };

    res.json({
      success: true,
      status
    });

  } catch (error) {
    logger.error('Error getting WhatsApp status:', error);
    res.status(500).json({
      error: error.message || 'Failed to get status'
    });
  }
});

/**
 * Test bot functionality
 */
router.post('/test', authMiddleware, async (req, res) => {
  try {
    const { phone_number } = req.body;
    const tenantId = req.tenant.id;

    // Check permissions (admin only for testing)
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Only administrators can test the bot'
      });
    }

    if (!phone_number) {
      return res.status(400).json({
        error: 'Phone number is required for testing'
      });
    }

    // Send test message
    const testMessage = '🤖 *Mensaje de Prueba*\n\nEste es un mensaje de prueba del bot de WhatsApp de Pan Compartido.\n\nEscribe *menu* para ver las opciones disponibles.';
    
    const result = await WhatsAppService.sendMessage(phone_number, testMessage, tenantId);

    res.json({
      success: true,
      messageId: result.messages[0].id,
      message: 'Test message sent successfully'
    });

  } catch (error) {
    logger.error('Error testing WhatsApp bot:', error);
    res.status(500).json({
      error: error.message || 'Failed to send test message'
    });
  }
});

/**
 * Reset conversation state (for debugging)
 */
router.post('/reset-conversation', authMiddleware, async (req, res) => {
  try {
    const { phone_number } = req.body;

    // Check permissions (admin only)
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Only administrators can reset conversations'
      });
    }

    if (!phone_number) {
      return res.status(400).json({
        error: 'Phone number is required'
      });
    }

    // Reset conversation state
    WhatsAppService.conversationStates.delete(phone_number);

    res.json({
      success: true,
      message: 'Conversation state reset successfully'
    });

  } catch (error) {
    logger.error('Error resetting conversation:', error);
    res.status(500).json({
      error: error.message || 'Failed to reset conversation'
    });
  }
});

/**
 * Get active conversations
 */
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    // Check permissions
    if (!req.user || !['admin', 'priest'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to view conversations'
      });
    }

    const conversations = [];
    
    for (const [phoneNumber, state] of WhatsAppService.conversationStates.entries()) {
      conversations.push({
        phone_number: phoneNumber,
        current_flow: state.flow,
        current_step: state.step,
        last_updated: state.lastUpdated || new Date().toISOString()
      });
    }

    res.json({
      success: true,
      conversations,
      total: conversations.length
    });

  } catch (error) {
    logger.error('Error getting conversations:', error);
    res.status(500).json({
      error: error.message || 'Failed to get conversations'
    });
  }
});

module.exports = router;