const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

class PaymentService {
  constructor() {
    this.wompiConfig = {
      baseUrl: process.env.WOMPI_BASE_URL || 'https://production.wompi.co/v1',
      publicKey: process.env.WOMPI_PUBLIC_KEY,
      privateKey: process.env.WOMPI_PRIVATE_KEY,
      eventSecret: process.env.WOMPI_EVENT_SECRET
    };

    this.stripeConfig = {
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
    };

    // Initialize Stripe
    if (this.stripeConfig.secretKey) {
      this.stripe = require('stripe')(this.stripeConfig.secretKey);
    }
  }

  /**
   * Process payment with Wompi
   */
  async processWompiPayment(paymentData, tenantId) {
    try {
      const { amount_in_cents, currency, customer_email, payment_method, reference, redirect_url, metadata } = paymentData;

      // Create payment source based on method type
      let paymentSource;
      
      if (payment_method.type === 'CARD') {
        // For card payments, create payment source
        paymentSource = await this.createWompiCardSource(payment_method, customer_email);
      } else if (payment_method.type === 'PSE') {
        // For PSE payments, create PSE source
        paymentSource = await this.createWompiPSESource(payment_method, customer_email);
      }

      // Create transaction
      const transactionData = {
        amount_in_cents,
        currency,
        customer_email,
        payment_source_id: paymentSource.id,
        reference,
        redirect_url,
        payment_method: {
          type: payment_method.type,
          installments: payment_method.installments || 1
        },
        metadata: {
          tenant_id: tenantId,
          ...metadata
        }
      };

      const response = await axios.post(
        `${this.wompiConfig.baseUrl}/transactions`,
        transactionData,
        {
          headers: {
            'Authorization': `Bearer ${this.wompiConfig.privateKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const transaction = response.data.data;

      // Log transaction
      await this.logPaymentAttempt(tenantId, {
        gateway: 'wompi',
        payment_id: transaction.id,
        reference: transaction.reference,
        amount: amount_in_cents / 100,
        currency,
        status: transaction.status,
        payment_method: payment_method.type
      });

      return {
        id: transaction.id,
        reference: transaction.reference,
        status: transaction.status,
        payment_link_url: transaction.payment_link_url,
        metadata: transaction.metadata
      };

    } catch (error) {
      logger.error('Wompi payment error:', error.response?.data || error.message);
      throw new Error(`Wompi payment failed: ${error.response?.data?.error?.reason || error.message}`);
    }
  }

  /**
   * Create Wompi card payment source
   */
  async createWompiCardSource(paymentMethod, customerEmail) {
    try {
      const sourceData = {
        type: 'CARD',
        token: paymentMethod.token,
        customer_email: customerEmail,
        acceptance_token: await this.getWompiAcceptanceToken()
      };

      const response = await axios.post(
        `${this.wompiConfig.baseUrl}/payment_sources`,
        sourceData,
        {
          headers: {
            'Authorization': `Bearer ${this.wompiConfig.privateKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.data;

    } catch (error) {
      logger.error('Wompi card source creation error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Create Wompi PSE payment source
   */
  async createWompiPSESource(paymentMethod, customerEmail) {
    try {
      const sourceData = {
        type: 'PSE',
        user_type: paymentMethod.user_type || '0',
        user_legal_id_type: paymentMethod.user_legal_id_type,
        user_legal_id: paymentMethod.user_legal_id,
        financial_institution_code: paymentMethod.financial_institution_code,
        customer_email: customerEmail,
        acceptance_token: await this.getWompiAcceptanceToken()
      };

      const response = await axios.post(
        `${this.wompiConfig.baseUrl}/payment_sources`,
        sourceData,
        {
          headers: {
            'Authorization': `Bearer ${this.wompiConfig.privateKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.data;

    } catch (error) {
      logger.error('Wompi PSE source creation error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get Wompi acceptance token
   */
  async getWompiAcceptanceToken() {
    try {
      const response = await axios.get(
        `${this.wompiConfig.baseUrl}/merchants/${this.wompiConfig.publicKey}`,
        {
          headers: {
            'Authorization': `Bearer ${this.wompiConfig.publicKey}`
          }
        }
      );

      return response.data.data.presigned_acceptance.acceptance_token;

    } catch (error) {
      logger.error('Error getting Wompi acceptance token:', error);
      throw error;
    }
  }

  /**
   * Process payment with Stripe
   */
  async processStripePayment(paymentData, tenantId) {
    try {
      if (!this.stripe) {
        throw new Error('Stripe not configured');
      }

      const { amount, currency, payment_method_types, customer_email, metadata, success_url, cancel_url } = paymentData;

      // Create checkout session
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types,
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: 'Pan Compartido - Donación y Compras',
                description: 'Donaciones y compras personales'
              },
              unit_amount: amount
            },
            quantity: 1
          }
        ],
        mode: 'payment',
        success_url,
        cancel_url,
        customer_email,
        metadata: {
          tenant_id: tenantId,
          ...metadata
        }
      });

      // Log transaction
      await this.logPaymentAttempt(tenantId, {
        gateway: 'stripe',
        payment_id: session.id,
        payment_intent: session.payment_intent,
        amount: amount / 100,
        currency,
        status: session.status,
        payment_method: payment_method_types[0]
      });

      return {
        id: session.id,
        payment_intent: session.payment_intent,
        status: session.status,
        url: session.url,
        metadata: session.metadata
      };

    } catch (error) {
      logger.error('Stripe payment error:', error.message);
      throw new Error(`Stripe payment failed: ${error.message}`);
    }
  }

  /**
   * Get payment status from Wompi
   */
  async getWompiPaymentStatus(paymentId) {
    try {
      const response = await axios.get(
        `${this.wompiConfig.baseUrl}/transactions/${paymentId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.wompiConfig.privateKey}`
          }
        }
      );

      const transaction = response.data.data;

      return {
        paymentId: transaction.id,
        gateway: 'wompi',
        status: transaction.status,
        amount: transaction.amount_in_cents / 100,
        currency: transaction.currency,
        created_at: transaction.created_at,
        updated_at: transaction.updated_at,
        metadata: transaction.metadata
      };

    } catch (error) {
      logger.error('Error getting Wompi payment status:', error);
      throw error;
    }
  }

  /**
   * Get payment status from Stripe
   */
  async getStripePaymentStatus(sessionId) {
    try {
      if (!this.stripe) {
        throw new Error('Stripe not configured');
      }

      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      
      let paymentIntent = null;
      if (session.payment_intent) {
        paymentIntent = await this.stripe.paymentIntents.retrieve(session.payment_intent);
      }

      return {
        paymentId: session.id,
        gateway: 'stripe',
        status: paymentIntent?.status || session.status,
        amount: session.amount_total / 100,
        currency: session.currency,
        created_at: new Date(session.created * 1000).toISOString(),
        updated_at: new Date((paymentIntent?.created || session.created) * 1000).toISOString(),
        metadata: session.metadata
      };

    } catch (error) {
      logger.error('Error getting Stripe payment status:', error);
      throw error;
    }
  }

  /**
   * Handle Wompi webhook
   */
  async handleWompiWebhook(webhookData, signature) {
    try {
      // Verify webhook signature
      const isValid = this.verifyWompiSignature(webhookData, signature);
      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }

      const { event, data } = webhookData;
      
      logger.info('Wompi webhook received:', { event, transactionId: data.transaction?.id });

      switch (event) {
        case 'transaction.updated':
          await this.handleTransactionUpdate(data.transaction, 'wompi');
          break;
        default:
          logger.info('Unhandled Wompi webhook event:', event);
      }

      return { received: true };

    } catch (error) {
      logger.error('Wompi webhook error:', error);
      throw error;
    }
  }

  /**
   * Handle Stripe webhook
   */
  async handleStripeWebhook(webhookData, signature) {
    try {
      if (!this.stripe) {
        throw new Error('Stripe not configured');
      }

      // Verify webhook signature
      const event = this.stripe.webhooks.constructEvent(
        webhookData,
        signature,
        this.stripeConfig.webhookSecret
      );

      logger.info('Stripe webhook received:', { type: event.type, id: event.data.object.id });

      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleTransactionUpdate(event.data.object, 'stripe');
          break;
        case 'payment_intent.succeeded':
          await this.handleTransactionUpdate(event.data.object, 'stripe');
          break;
        case 'payment_intent.payment_failed':
          await this.handleTransactionUpdate(event.data.object, 'stripe');
          break;
        default:
          logger.info('Unhandled Stripe webhook event:', event.type);
      }

      return { received: true };

    } catch (error) {
      logger.error('Stripe webhook error:', error);
      throw error;
    }
  }

  /**
   * Verify Wompi webhook signature
   */
  verifyWompiSignature(payload, signature) {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.wompiConfig.eventSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      logger.error('Error verifying Wompi signature:', error);
      return false;
    }
  }

  /**
   * Handle transaction status update
   */
  async handleTransactionUpdate(transactionData, gateway) {
    try {
      const tenantId = transactionData.metadata?.tenant_id;
      
      if (!tenantId) {
        logger.warn('Transaction update without tenant_id:', transactionData.id);
        return;
      }

      // Update payment status in database
      await this.updatePaymentStatus(transactionData.id, gateway, transactionData.status, tenantId);

      // Handle successful payments
      if (transactionData.status === 'APPROVED' || transactionData.status === 'succeeded') {
        await this.handleSuccessfulPayment(transactionData, gateway, tenantId);
      }

      // Handle failed payments
      if (transactionData.status === 'DECLINED' || transactionData.status === 'failed') {
        await this.handleFailedPayment(transactionData, gateway, tenantId);
      }

    } catch (error) {
      logger.error('Error handling transaction update:', error);
    }
  }

  /**
   * Handle successful payment
   */
  async handleSuccessfulPayment(transactionData, gateway, tenantId) {
    try {
      logger.info('Processing successful payment:', {
        paymentId: transactionData.id,
        gateway,
        tenantId
      });

      // 1. Update donation/order status
      if (transactionData.metadata?.donation_id) {
        // await this.updateDonationStatus(transactionData.metadata.donation_id, 'completed');
      }

      if (transactionData.metadata?.order_id) {
        // await this.updateOrderStatus(transactionData.metadata.order_id, 'paid');
      }

      // 2. Trigger automatic fund distribution
      const FundDistributionService = require('./FundDistributionService');
      
      const paymentData = {
        paymentId: transactionData.id,
        gateway,
        amount: gateway === 'wompi' 
          ? transactionData.amount_in_cents / 100 
          : transactionData.amount_total / 100,
        currency: transactionData.currency || 'COP',
        metadata: transactionData.metadata
      };

      await FundDistributionService.distributePaymentFunds(paymentData, tenantId);

      // 3. Send confirmation emails
      // await this.sendPaymentConfirmation(transactionData, tenantId);

      // 4. Update user statistics
      // await this.updateUserStats(transactionData.metadata?.user_id, paymentData);

      // 5. Send notifications
      // await this.sendPaymentNotifications(transactionData, tenantId);

    } catch (error) {
      logger.error('Error handling successful payment:', error);
    }
  }

  /**
   * Handle failed payment
   */
  async handleFailedPayment(transactionData, gateway, tenantId) {
    try {
      logger.info('Processing failed payment:', {
        paymentId: transactionData.id,
        gateway,
        tenantId
      });

      // Here you would:
      // 1. Update donation/order status to failed
      // 2. Send failure notifications
      // 3. Trigger retry mechanisms if applicable

    } catch (error) {
      logger.error('Error handling failed payment:', error);
    }
  }

  /**
   * Update payment status in database
   */
  async updatePaymentStatus(paymentId, gateway, status, tenantId) {
    try {
      // This would update your payments table
      // const db = require('../config/database');
      // await db('payments')
      //   .where({ payment_id: paymentId, gateway, tenant_id: tenantId })
      //   .update({ 
      //     status, 
      //     updated_at: new Date() 
      //   });

      logger.info('Payment status updated:', { paymentId, gateway, status, tenantId });

    } catch (error) {
      logger.error('Error updating payment status:', error);
    }
  }

  /**
   * Log payment attempt
   */
  async logPaymentAttempt(tenantId, logData) {
    try {
      // This would log to your payment_logs table
      // const db = require('../config/database');
      // await db('payment_logs').insert({
      //   tenant_id: tenantId,
      //   ...logData,
      //   created_at: new Date()
      // });

      logger.info('Payment attempt logged:', { tenantId, ...logData });

    } catch (error) {
      logger.error('Error logging payment attempt:', error);
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(paymentId, gateway, amount, reason, tenantId) {
    try {
      if (gateway === 'wompi') {
        return await this.refundWompiPayment(paymentId, amount, reason);
      } else if (gateway === 'stripe') {
        return await this.refundStripePayment(paymentId, amount, reason);
      } else {
        throw new Error(`Unsupported gateway for refund: ${gateway}`);
      }
    } catch (error) {
      logger.error('Refund error:', error);
      throw error;
    }
  }

  /**
   * Refund Wompi payment
   */
  async refundWompiPayment(transactionId, amount, reason) {
    try {
      const refundData = {
        transaction_id: transactionId,
        amount_in_cents: amount ? Math.round(amount * 100) : undefined,
        reason
      };

      const response = await axios.post(
        `${this.wompiConfig.baseUrl}/transactions/${transactionId}/void`,
        refundData,
        {
          headers: {
            'Authorization': `Bearer ${this.wompiConfig.privateKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        refundId: response.data.data.id,
        status: response.data.data.status,
        amount: response.data.data.amount_in_cents / 100
      };

    } catch (error) {
      logger.error('Wompi refund error:', error);
      throw error;
    }
  }

  /**
   * Refund Stripe payment
   */
  async refundStripePayment(paymentIntentId, amount, reason) {
    try {
      if (!this.stripe) {
        throw new Error('Stripe not configured');
      }

      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
        reason: reason || 'requested_by_customer'
      });

      return {
        refundId: refund.id,
        status: refund.status,
        amount: refund.amount / 100
      };

    } catch (error) {
      logger.error('Stripe refund error:', error);
      throw error;
    }
  }
}

module.exports = new PaymentService();