import api from './api';

class PaymentService {
  constructor() {
    this.defaultGateway = 'wompi'; // Primary gateway for Colombia
    this.fallbackGateway = 'stripe'; // International fallback
    this.retryAttempts = 3;
  }

  /**
   * Process payment with automatic fallback
   */
  async processPayment(paymentData, tenantId) {
    const { amount, currency = 'COP', paymentMethod, metadata = {} } = paymentData;

    // Validate payment data
    this.validatePaymentData(paymentData);

    // Determine best gateway based on currency and region
    const primaryGateway = this.selectPrimaryGateway(currency, paymentMethod);
    const fallbackGateway = this.selectFallbackGateway(currency, paymentMethod);

    let lastError = null;

    // Try primary gateway
    try {
      console.log(`Attempting payment with ${primaryGateway}...`);
      const result = await this.processWithGateway(primaryGateway, paymentData, tenantId);
      
      // Log successful payment
      await this.logPaymentAttempt(tenantId, {
        gateway: primaryGateway,
        status: 'success',
        amount,
        currency,
        paymentId: result.paymentId
      });

      return {
        success: true,
        gateway: primaryGateway,
        paymentId: result.paymentId,
        transactionId: result.transactionId,
        status: result.status,
        metadata: result.metadata
      };

    } catch (error) {
      console.error(`Payment failed with ${primaryGateway}:`, error);
      lastError = error;

      // Log failed attempt
      await this.logPaymentAttempt(tenantId, {
        gateway: primaryGateway,
        status: 'failed',
        amount,
        currency,
        error: error.message
      });
    }

    // Try fallback gateway if available
    if (fallbackGateway && fallbackGateway !== primaryGateway) {
      try {
        console.log(`Attempting payment with fallback ${fallbackGateway}...`);
        const result = await this.processWithGateway(fallbackGateway, paymentData, tenantId);
        
        // Log successful fallback payment
        await this.logPaymentAttempt(tenantId, {
          gateway: fallbackGateway,
          status: 'success',
          amount,
          currency,
          paymentId: result.paymentId,
          isFallback: true
        });

        return {
          success: true,
          gateway: fallbackGateway,
          paymentId: result.paymentId,
          transactionId: result.transactionId,
          status: result.status,
          metadata: result.metadata,
          usedFallback: true
        };

      } catch (fallbackError) {
        console.error(`Fallback payment failed with ${fallbackGateway}:`, fallbackError);
        
        // Log failed fallback attempt
        await this.logPaymentAttempt(tenantId, {
          gateway: fallbackGateway,
          status: 'failed',
          amount,
          currency,
          error: fallbackError.message,
          isFallback: true
        });

        lastError = fallbackError;
      }
    }

    // All gateways failed
    throw new Error(`Payment failed on all gateways. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Process payment with specific gateway
   */
  async processWithGateway(gateway, paymentData, tenantId) {
    switch (gateway) {
      case 'wompi':
        return await this.processWompiPayment(paymentData, tenantId);
      case 'stripe':
        return await this.processStripePayment(paymentData, tenantId);
      default:
        throw new Error(`Unsupported payment gateway: ${gateway}`);
    }
  }

  /**
   * Process payment with Wompi (Colombia)
   */
  async processWompiPayment(paymentData, tenantId) {
    const { amount, currency, paymentMethod, customerInfo, metadata } = paymentData;

    const wompiData = {
      amount_in_cents: Math.round(amount * 100), // Wompi expects cents
      currency,
      customer_email: customerInfo?.email,
      payment_method: {
        type: paymentMethod === 'card' ? 'CARD' : 'PSE',
        ...this.formatWompiPaymentMethod(paymentMethod, paymentData.paymentDetails)
      },
      reference: `PC-${tenantId}-${Date.now()}`,
      redirect_url: `${window.location.origin}/payment/callback`,
      metadata: {
        tenant_id: tenantId,
        platform: 'pan_compartido',
        ...metadata
      }
    };

    try {
      const response = await api.post('/payments/wompi/process', wompiData, {
        headers: { 'X-Tenant-ID': tenantId }
      });

      return {
        paymentId: response.data.id,
        transactionId: response.data.reference,
        status: response.data.status,
        paymentUrl: response.data.payment_link_url,
        metadata: response.data.metadata
      };

    } catch (error) {
      throw new Error(`Wompi payment failed: ${error.response?.data?.error?.reason || error.message}`);
    }
  }

  /**
   * Process payment with Stripe (International)
   */
  async processStripePayment(paymentData, tenantId) {
    const { amount, currency, paymentMethod, customerInfo, metadata } = paymentData;

    const stripeData = {
      amount: Math.round(amount * 100), // Stripe expects cents
      currency: currency.toLowerCase(),
      payment_method_types: [paymentMethod === 'card' ? 'card' : 'sepa_debit'],
      customer_email: customerInfo?.email,
      metadata: {
        tenant_id: tenantId,
        platform: 'pan_compartido',
        ...metadata
      },
      success_url: `${window.location.origin}/payment/success`,
      cancel_url: `${window.location.origin}/payment/cancel`
    };

    try {
      const response = await api.post('/payments/stripe/process', stripeData, {
        headers: { 'X-Tenant-ID': tenantId }
      });

      return {
        paymentId: response.data.id,
        transactionId: response.data.payment_intent,
        status: response.data.status,
        paymentUrl: response.data.url,
        metadata: response.data.metadata
      };

    } catch (error) {
      throw new Error(`Stripe payment failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Select primary gateway based on currency and region
   */
  selectPrimaryGateway(currency, paymentMethod) {
    // For Colombian Pesos, prefer Wompi
    if (currency === 'COP') {
      return 'wompi';
    }

    // For international currencies, prefer Stripe
    if (['USD', 'EUR', 'GBP'].includes(currency)) {
      return 'stripe';
    }

    // Default to configured primary gateway
    return this.defaultGateway;
  }

  /**
   * Select fallback gateway
   */
  selectFallbackGateway(currency, paymentMethod) {
    const primary = this.selectPrimaryGateway(currency, paymentMethod);
    
    // Return the other gateway as fallback
    if (primary === 'wompi') {
      return 'stripe';
    } else {
      return 'wompi';
    }
  }

  /**
   * Format payment method for Wompi
   */
  formatWompiPaymentMethod(paymentMethod, paymentDetails = {}) {
    if (paymentMethod === 'card') {
      return {
        token: paymentDetails.token, // Card token from Wompi tokenization
        installments: paymentDetails.installments || 1
      };
    }

    if (paymentMethod === 'pse') {
      return {
        user_type: paymentDetails.userType || '0', // 0: Natural person
        user_legal_id_type: paymentDetails.idType || 'CC',
        user_legal_id: paymentDetails.userId,
        financial_institution_code: paymentDetails.bankCode
      };
    }

    return {};
  }

  /**
   * Validate payment data
   */
  validatePaymentData(paymentData) {
    const { amount, currency, paymentMethod, customerInfo } = paymentData;

    if (!amount || amount <= 0) {
      throw new Error('Invalid payment amount');
    }

    if (!currency) {
      throw new Error('Currency is required');
    }

    if (!paymentMethod) {
      throw new Error('Payment method is required');
    }

    if (!customerInfo?.email) {
      throw new Error('Customer email is required');
    }

    // Validate minimum amounts
    if (currency === 'COP' && amount < 1000) {
      throw new Error('Minimum payment amount is $1,000 COP');
    }

    if (currency === 'USD' && amount < 1) {
      throw new Error('Minimum payment amount is $1 USD');
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId, gateway, tenantId) {
    try {
      const response = await api.get(`/payments/${gateway}/${paymentId}/status`, {
        headers: { 'X-Tenant-ID': tenantId }
      });

      return {
        paymentId,
        gateway,
        status: response.data.status,
        amount: response.data.amount,
        currency: response.data.currency,
        createdAt: response.data.created_at,
        updatedAt: response.data.updated_at,
        metadata: response.data.metadata
      };

    } catch (error) {
      throw new Error(`Failed to get payment status: ${error.message}`);
    }
  }

  /**
   * Handle payment webhook
   */
  async handleWebhook(gateway, webhookData, tenantId) {
    try {
      const response = await api.post(`/payments/${gateway}/webhook`, webhookData, {
        headers: { 'X-Tenant-ID': tenantId }
      });

      return response.data;

    } catch (error) {
      console.error(`Webhook handling failed for ${gateway}:`, error);
      throw error;
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(paymentId, gateway, amount, reason, tenantId) {
    try {
      const refundData = {
        payment_id: paymentId,
        amount: amount ? Math.round(amount * 100) : undefined, // Partial refund if amount specified
        reason
      };

      const response = await api.post(`/payments/${gateway}/refund`, refundData, {
        headers: { 'X-Tenant-ID': tenantId }
      });

      return {
        refundId: response.data.id,
        paymentId,
        gateway,
        amount: response.data.amount / 100,
        status: response.data.status,
        reason
      };

    } catch (error) {
      throw new Error(`Refund failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Get supported payment methods for gateway
   */
  getSupportedPaymentMethods(gateway, currency = 'COP') {
    const methods = {
      wompi: {
        COP: ['card', 'pse', 'nequi', 'bancolombia_transfer'],
        USD: ['card']
      },
      stripe: {
        USD: ['card', 'paypal'],
        EUR: ['card', 'sepa_debit'],
        GBP: ['card'],
        COP: ['card'] // Limited support
      }
    };

    return methods[gateway]?.[currency] || [];
  }

  /**
   * Get gateway fees
   */
  getGatewayFees(gateway, amount, currency, paymentMethod) {
    const feeStructures = {
      wompi: {
        card: { percentage: 0.029, fixed: 0 }, // 2.9%
        pse: { percentage: 0.015, fixed: 0 }, // 1.5%
        nequi: { percentage: 0.02, fixed: 0 } // 2%
      },
      stripe: {
        card: { percentage: 0.029, fixed: currency === 'USD' ? 0.30 : 0 }, // 2.9% + $0.30
        paypal: { percentage: 0.034, fixed: 0 } // 3.4%
      }
    };

    const feeStructure = feeStructures[gateway]?.[paymentMethod];
    if (!feeStructure) return 0;

    return (amount * feeStructure.percentage) + feeStructure.fixed;
  }

  /**
   * Log payment attempt for analytics
   */
  async logPaymentAttempt(tenantId, logData) {
    try {
      await api.post('/payments/logs', {
        tenant_id: tenantId,
        timestamp: new Date().toISOString(),
        ...logData
      });
    } catch (error) {
      console.error('Failed to log payment attempt:', error);
      // Don't throw - logging failure shouldn't break payment flow
    }
  }

  /**
   * Format currency for display
   */
  formatCurrency(amount, currency = 'COP') {
    const formatters = {
      COP: new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
      }),
      USD: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }),
      EUR: new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR'
      })
    };

    return formatters[currency]?.format(amount) || `${amount} ${currency}`;
  }
}

// Export singleton instance
export default new PaymentService();