const express = require('express');
const router = express.Router();
const PaymentService = require('../services/PaymentService');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

/**
 * Process payment with automatic gateway selection
 */
router.post('/process', authMiddleware, async (req, res) => {
  try {
    const { amount, currency, paymentMethod, customerInfo, paymentDetails, metadata } = req.body;
    const tenantId = req.tenant.id;

    // Validate required fields
    if (!amount || !currency || !paymentMethod || !customerInfo?.email) {
      return res.status(400).json({
        error: 'Missing required payment information'
      });
    }

    // Determine gateway based on currency and method
    const gateway = currency === 'COP' ? 'wompi' : 'stripe';
    
    let result;
    
    if (gateway === 'wompi') {
      const wompiData = {
        amount_in_cents: Math.round(amount * 100),
        currency,
        customer_email: customerInfo.email,
        payment_method: {
          type: paymentMethod === 'card' ? 'CARD' : 'PSE',
          ...paymentDetails
        },
        reference: `PC-${tenantId}-${Date.now()}`,
        redirect_url: `${req.protocol}://${req.get('host')}/payment/callback?gateway=wompi`,
        metadata: {
          tenant_id: tenantId,
          user_id: req.user?.id,
          ...metadata
        }
      };

      result = await PaymentService.processWompiPayment(wompiData, tenantId);
    } else {
      const stripeData = {
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        payment_method_types: [paymentMethod === 'card' ? 'card' : 'sepa_debit'],
        customer_email: customerInfo.email,
        metadata: {
          tenant_id: tenantId,
          user_id: req.user?.id,
          ...metadata
        },
        success_url: `${req.protocol}://${req.get('host')}/payment/callback?gateway=stripe&status=success`,
        cancel_url: `${req.protocol}://${req.get('host')}/payment/callback?gateway=stripe&status=canceled`
      };

      result = await PaymentService.processStripePayment(stripeData, tenantId);
    }

    res.json({
      success: true,
      gateway,
      paymentId: result.id,
      paymentUrl: result.payment_link_url || result.url,
      status: result.status
    });

  } catch (error) {
    logger.error('Payment processing error:', error);
    res.status(500).json({
      error: error.message || 'Payment processing failed'
    });
  }
});

/**
 * Process Wompi payment specifically
 */
router.post('/wompi/process', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const result = await PaymentService.processWompiPayment(req.body, tenantId);
    
    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    logger.error('Wompi payment error:', error);
    res.status(500).json({
      error: error.message || 'Wompi payment failed'
    });
  }
});

/**
 * Process Stripe payment specifically
 */
router.post('/stripe/process', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const result = await PaymentService.processStripePayment(req.body, tenantId);
    
    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    logger.error('Stripe payment error:', error);
    res.status(500).json({
      error: error.message || 'Stripe payment failed'
    });
  }
});

/**
 * Get payment status
 */
router.get('/:gateway/:paymentId/status', authMiddleware, async (req, res) => {
  try {
    const { gateway, paymentId } = req.params;
    
    let result;
    
    if (gateway === 'wompi') {
      result = await PaymentService.getWompiPaymentStatus(paymentId);
    } else if (gateway === 'stripe') {
      result = await PaymentService.getStripePaymentStatus(paymentId);
    } else {
      return res.status(400).json({
        error: 'Unsupported payment gateway'
      });
    }

    res.json(result);

  } catch (error) {
    logger.error('Error getting payment status:', error);
    res.status(500).json({
      error: error.message || 'Failed to get payment status'
    });
  }
});

/**
 * Wompi webhook endpoint
 */
router.post('/wompi/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-signature'];
    const webhookData = JSON.parse(req.body.toString());

    await PaymentService.handleWompiWebhook(webhookData, signature);

    res.json({ received: true });

  } catch (error) {
    logger.error('Wompi webhook error:', error);
    res.status(400).json({
      error: error.message || 'Webhook processing failed'
    });
  }
});

/**
 * Stripe webhook endpoint
 */
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];

    await PaymentService.handleStripeWebhook(req.body, signature);

    res.json({ received: true });

  } catch (error) {
    logger.error('Stripe webhook error:', error);
    res.status(400).json({
      error: error.message || 'Webhook processing failed'
    });
  }
});

/**
 * Refund payment
 */
router.post('/:gateway/refund', authMiddleware, async (req, res) => {
  try {
    const { gateway } = req.params;
    const { payment_id, amount, reason } = req.body;
    const tenantId = req.tenant.id;

    // Check if user has permission to refund (admin/priest role)
    if (!req.user || !['admin', 'priest'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions for refund'
      });
    }

    const result = await PaymentService.refundPayment(
      payment_id,
      gateway,
      amount,
      reason,
      tenantId
    );

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    logger.error('Refund error:', error);
    res.status(500).json({
      error: error.message || 'Refund failed'
    });
  }
});

/**
 * Get supported payment methods for gateway
 */
router.get('/methods/:gateway', async (req, res) => {
  try {
    const { gateway } = req.params;
    const { currency = 'COP' } = req.query;

    const methods = PaymentService.getSupportedPaymentMethods(gateway, currency);

    res.json({
      gateway,
      currency,
      methods
    });

  } catch (error) {
    logger.error('Error getting payment methods:', error);
    res.status(500).json({
      error: error.message || 'Failed to get payment methods'
    });
  }
});

/**
 * Calculate gateway fees
 */
router.post('/fees/calculate', async (req, res) => {
  try {
    const { gateway, amount, currency, paymentMethod } = req.body;

    if (!gateway || !amount || !currency || !paymentMethod) {
      return res.status(400).json({
        error: 'Missing required parameters'
      });
    }

    const fee = PaymentService.getGatewayFees(gateway, amount, currency, paymentMethod);

    res.json({
      gateway,
      amount,
      currency,
      paymentMethod,
      fee,
      total: amount + fee
    });

  } catch (error) {
    logger.error('Error calculating fees:', error);
    res.status(500).json({
      error: error.message || 'Failed to calculate fees'
    });
  }
});

/**
 * Log payment attempt (for analytics)
 */
router.post('/logs', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    await PaymentService.logPaymentAttempt(tenantId, {
      user_id: req.user?.id,
      ...req.body
    });

    res.json({ logged: true });

  } catch (error) {
    logger.error('Error logging payment attempt:', error);
    res.status(500).json({
      error: error.message || 'Failed to log payment attempt'
    });
  }
});

/**
 * Get payment statistics (admin only)
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    // Check admin permissions
    if (!req.user || !['admin', 'priest'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions'
      });
    }

    const tenantId = req.tenant.id;
    const { period = '30d' } = req.query;

    // This would query your database for payment statistics
    // const stats = await PaymentService.getPaymentStats(tenantId, period);

    // Mock response for now
    const stats = {
      totalPayments: 0,
      totalAmount: 0,
      successRate: 0,
      gatewayBreakdown: {
        wompi: { count: 0, amount: 0 },
        stripe: { count: 0, amount: 0 }
      },
      methodBreakdown: {
        card: { count: 0, amount: 0 },
        pse: { count: 0, amount: 0 }
      }
    };

    res.json(stats);

  } catch (error) {
    logger.error('Error getting payment stats:', error);
    res.status(500).json({
      error: error.message || 'Failed to get payment statistics'
    });
  }
});

module.exports = router;