const logger = require('../utils/logger');
const PaymentService = require('./PaymentService');

class FundDistributionService {
  constructor() {
    // Default distribution percentages (can be configured per tenant)
    this.defaultDistribution = {
      suppliers: 0.70,      // 70% for suppliers/products
      sustainability: 0.20, // 20% for parish sustainability
      reserve: 0.07,        // 7% for emergency reserve
      platform: 0.03       // 3% for platform maintenance
    };

    // Minimum amounts before distribution (in COP)
    this.minimumDistribution = {
      suppliers: 50000,     // $50,000 COP minimum
      sustainability: 20000, // $20,000 COP minimum
      reserve: 10000        // $10,000 COP minimum
    };
  }

  /**
   * Process fund distribution for a completed payment
   */
  async distributePaymentFunds(paymentData, tenantId) {
    try {
      const { amount, currency, metadata, paymentId, gateway } = paymentData;
      
      // Convert to COP if needed
      const amountCOP = await this.convertToCOP(amount, currency);
      
      // Get tenant-specific distribution rules
      const distributionRules = await this.getTenantDistributionRules(tenantId);
      
      // Calculate distribution amounts
      const distribution = this.calculateDistribution(amountCOP, distributionRules, metadata);
      
      // Create distribution record
      const distributionRecord = await this.createDistributionRecord({
        tenantId,
        paymentId,
        gateway,
        totalAmount: amountCOP,
        currency: 'COP',
        distribution,
        metadata,
        status: 'pending'
      });

      // Process each distribution
      await this.processDistributions(distributionRecord, tenantId);
      
      // Update distribution status
      await this.updateDistributionStatus(distributionRecord.id, 'completed');
      
      logger.info('Fund distribution completed:', {
        distributionId: distributionRecord.id,
        tenantId,
        paymentId,
        totalAmount: amountCOP
      });

      return distributionRecord;

    } catch (error) {
      logger.error('Fund distribution error:', error);
      throw error;
    }
  }

  /**
   * Calculate fund distribution based on rules and payment type
   */
  calculateDistribution(amount, rules, metadata = {}) {
    const distribution = {
      suppliers: 0,
      sustainability: 0,
      reserve: 0,
      platform: 0,
      breakdown: []
    };

    // Handle donations vs purchases differently
    const isDonation = metadata.type === 'donation' || metadata.donationsTotal > 0;
    const isPurchase = metadata.type === 'purchase' || metadata.purchasesTotal > 0;

    if (isDonation && isPurchase) {
      // Mixed payment - split by type
      const donationAmount = metadata.donationsTotal || 0;
      const purchaseAmount = metadata.purchasesTotal || 0;
      
      // Donations go mostly to suppliers and sustainability
      const donationDist = this.calculateDonationDistribution(donationAmount, rules);
      
      // Purchases have different distribution
      const purchaseDist = this.calculatePurchaseDistribution(purchaseAmount, rules);
      
      // Combine distributions
      distribution.suppliers = donationDist.suppliers + purchaseDist.suppliers;
      distribution.sustainability = donationDist.sustainability + purchaseDist.sustainability;
      distribution.reserve = donationDist.reserve + purchaseDist.reserve;
      distribution.platform = donationDist.platform + purchaseDist.platform;
      
      distribution.breakdown.push(
        { type: 'donation', amount: donationAmount, ...donationDist },
        { type: 'purchase', amount: purchaseAmount, ...purchaseDist }
      );

    } else if (isDonation) {
      // Pure donation
      const donationDist = this.calculateDonationDistribution(amount, rules);
      Object.assign(distribution, donationDist);
      
      distribution.breakdown.push({
        type: 'donation',
        amount,
        ...donationDist
      });

    } else {
      // Pure purchase
      const purchaseDist = this.calculatePurchaseDistribution(amount, rules);
      Object.assign(distribution, purchaseDist);
      
      distribution.breakdown.push({
        type: 'purchase',
        amount,
        ...purchaseDist
      });
    }

    // Round amounts to avoid floating point issues
    Object.keys(distribution).forEach(key => {
      if (typeof distribution[key] === 'number') {
        distribution[key] = Math.round(distribution[key]);
      }
    });

    return distribution;
  }

  /**
   * Calculate distribution for donations
   */
  calculateDonationDistribution(amount, rules) {
    return {
      suppliers: Math.round(amount * rules.donation.suppliers),
      sustainability: Math.round(amount * rules.donation.sustainability),
      reserve: Math.round(amount * rules.donation.reserve),
      platform: Math.round(amount * rules.donation.platform)
    };
  }

  /**
   * Calculate distribution for purchases
   */
  calculatePurchaseDistribution(amount, rules) {
    return {
      suppliers: Math.round(amount * rules.purchase.suppliers),
      sustainability: Math.round(amount * rules.purchase.sustainability),
      reserve: Math.round(amount * rules.purchase.reserve),
      platform: Math.round(amount * rules.purchase.platform)
    };
  }

  /**
   * Get tenant-specific distribution rules
   */
  async getTenantDistributionRules(tenantId) {
    try {
      // This would query the database for tenant-specific rules
      // const db = require('../config/database');
      // const rules = await db('tenant_distribution_rules')
      //   .where({ tenant_id: tenantId })
      //   .first();

      // For now, return default rules with some customization
      return {
        donation: {
          suppliers: 0.75,      // 75% to suppliers for donations
          sustainability: 0.15, // 15% for parish sustainability
          reserve: 0.07,        // 7% for emergency reserve
          platform: 0.03       // 3% for platform
        },
        purchase: {
          suppliers: 0.65,      // 65% to suppliers for purchases
          sustainability: 0.25, // 25% for parish sustainability
          reserve: 0.07,        // 7% for emergency reserve
          platform: 0.03       // 3% for platform
        }
      };

    } catch (error) {
      logger.error('Error getting distribution rules:', error);
      return {
        donation: this.defaultDistribution,
        purchase: this.defaultDistribution
      };
    }
  }

  /**
   * Create distribution record in database
   */
  async createDistributionRecord(distributionData) {
    try {
      // This would insert into fund_distributions table
      // const db = require('../config/database');
      // const [id] = await db('fund_distributions').insert({
      //   ...distributionData,
      //   created_at: new Date(),
      //   updated_at: new Date()
      // });

      // Mock record for now
      const record = {
        id: `dist_${Date.now()}`,
        ...distributionData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      logger.info('Distribution record created:', record.id);
      return record;

    } catch (error) {
      logger.error('Error creating distribution record:', error);
      throw error;
    }
  }

  /**
   * Process individual distributions
   */
  async processDistributions(distributionRecord, tenantId) {
    const { distribution, id: distributionId } = distributionRecord;
    const results = [];

    try {
      // Process supplier payments
      if (distribution.suppliers > this.minimumDistribution.suppliers) {
        const supplierResult = await this.processSupplierDistribution(
          distribution.suppliers,
          distributionId,
          tenantId
        );
        results.push(supplierResult);
      }

      // Process sustainability fund
      if (distribution.sustainability > this.minimumDistribution.sustainability) {
        const sustainabilityResult = await this.processSustainabilityDistribution(
          distribution.sustainability,
          distributionId,
          tenantId
        );
        results.push(sustainabilityResult);
      }

      // Process reserve fund
      if (distribution.reserve > this.minimumDistribution.reserve) {
        const reserveResult = await this.processReserveDistribution(
          distribution.reserve,
          distributionId,
          tenantId
        );
        results.push(reserveResult);
      }

      // Process platform fee
      if (distribution.platform > 0) {
        const platformResult = await this.processPlatformDistribution(
          distribution.platform,
          distributionId,
          tenantId
        );
        results.push(platformResult);
      }

      return results;

    } catch (error) {
      logger.error('Error processing distributions:', error);
      throw error;
    }
  }

  /**
   * Process supplier distribution
   */
  async processSupplierDistribution(amount, distributionId, tenantId) {
    try {
      // Get pending supplier payments for this tenant
      const pendingPayments = await this.getPendingSupplierPayments(tenantId);
      
      if (pendingPayments.length === 0) {
        // No pending payments, add to supplier fund
        return await this.addToSupplierFund(amount, distributionId, tenantId);
      }

      // Process payments in order of priority
      let remainingAmount = amount;
      const processedPayments = [];

      for (const payment of pendingPayments) {
        if (remainingAmount <= 0) break;

        const paymentAmount = Math.min(remainingAmount, payment.amount);
        
        const result = await this.processSupplierPayment(
          payment.supplierId,
          paymentAmount,
          payment.id,
          distributionId,
          tenantId
        );

        processedPayments.push(result);
        remainingAmount -= paymentAmount;
      }

      // Add remaining amount to supplier fund
      if (remainingAmount > 0) {
        const fundResult = await this.addToSupplierFund(
          remainingAmount,
          distributionId,
          tenantId
        );
        processedPayments.push(fundResult);
      }

      return {
        type: 'supplier',
        totalAmount: amount,
        processedPayments,
        status: 'completed'
      };

    } catch (error) {
      logger.error('Error processing supplier distribution:', error);
      throw error;
    }
  }

  /**
   * Process sustainability fund distribution
   */
  async processSustainabilityDistribution(amount, distributionId, tenantId) {
    try {
      // Add to parish sustainability fund
      // This could be used for parish operations, maintenance, etc.
      
      // const db = require('../config/database');
      // await db('parish_funds').insert({
      //   tenant_id: tenantId,
      //   fund_type: 'sustainability',
      //   amount,
      //   distribution_id: distributionId,
      //   created_at: new Date()
      // });

      logger.info('Sustainability fund updated:', {
        tenantId,
        amount,
        distributionId
      });

      return {
        type: 'sustainability',
        amount,
        status: 'completed',
        description: 'Added to parish sustainability fund'
      };

    } catch (error) {
      logger.error('Error processing sustainability distribution:', error);
      throw error;
    }
  }

  /**
   * Process reserve fund distribution
   */
  async processReserveDistribution(amount, distributionId, tenantId) {
    try {
      // Add to emergency reserve fund
      
      // const db = require('../config/database');
      // await db('parish_funds').insert({
      //   tenant_id: tenantId,
      //   fund_type: 'reserve',
      //   amount,
      //   distribution_id: distributionId,
      //   created_at: new Date()
      // });

      logger.info('Reserve fund updated:', {
        tenantId,
        amount,
        distributionId
      });

      return {
        type: 'reserve',
        amount,
        status: 'completed',
        description: 'Added to emergency reserve fund'
      };

    } catch (error) {
      logger.error('Error processing reserve distribution:', error);
      throw error;
    }
  }

  /**
   * Process platform fee distribution
   */
  async processPlatformDistribution(amount, distributionId, tenantId) {
    try {
      // Transfer platform fee to main platform account
      
      logger.info('Platform fee processed:', {
        tenantId,
        amount,
        distributionId
      });

      return {
        type: 'platform',
        amount,
        status: 'completed',
        description: 'Platform maintenance fee'
      };

    } catch (error) {
      logger.error('Error processing platform distribution:', error);
      throw error;
    }
  }

  /**
   * Get pending supplier payments
   */
  async getPendingSupplierPayments(tenantId) {
    try {
      // This would query pending supplier payments
      // const db = require('../config/database');
      // return await db('supplier_payments')
      //   .where({ 
      //     tenant_id: tenantId, 
      //     status: 'pending' 
      //   })
      //   .orderBy('priority', 'desc')
      //   .orderBy('created_at', 'asc');

      // Mock data for now
      return [];

    } catch (error) {
      logger.error('Error getting pending supplier payments:', error);
      return [];
    }
  }

  /**
   * Process individual supplier payment
   */
  async processSupplierPayment(supplierId, amount, paymentId, distributionId, tenantId) {
    try {
      // This would process payment to supplier
      // Could integrate with bank APIs for automatic transfers
      
      logger.info('Supplier payment processed:', {
        supplierId,
        amount,
        paymentId,
        distributionId,
        tenantId
      });

      return {
        supplierId,
        amount,
        paymentId,
        status: 'completed',
        processedAt: new Date()
      };

    } catch (error) {
      logger.error('Error processing supplier payment:', error);
      throw error;
    }
  }

  /**
   * Add amount to supplier fund
   */
  async addToSupplierFund(amount, distributionId, tenantId) {
    try {
      // Add to general supplier fund for future payments
      
      // const db = require('../config/database');
      // await db('parish_funds').insert({
      //   tenant_id: tenantId,
      //   fund_type: 'supplier',
      //   amount,
      //   distribution_id: distributionId,
      //   created_at: new Date()
      // });

      logger.info('Supplier fund updated:', {
        tenantId,
        amount,
        distributionId
      });

      return {
        type: 'supplier_fund',
        amount,
        status: 'completed',
        description: 'Added to supplier payment fund'
      };

    } catch (error) {
      logger.error('Error adding to supplier fund:', error);
      throw error;
    }
  }

  /**
   * Update distribution status
   */
  async updateDistributionStatus(distributionId, status) {
    try {
      // const db = require('../config/database');
      // await db('fund_distributions')
      //   .where({ id: distributionId })
      //   .update({ 
      //     status, 
      //     updated_at: new Date() 
      //   });

      logger.info('Distribution status updated:', { distributionId, status });

    } catch (error) {
      logger.error('Error updating distribution status:', error);
    }
  }

  /**
   * Convert currency to COP
   */
  async convertToCOP(amount, currency) {
    if (currency === 'COP') {
      return amount;
    }

    try {
      // This would use a currency conversion API
      // For now, using approximate rates
      const rates = {
        USD: 4000,  // 1 USD = 4000 COP (approximate)
        EUR: 4300,  // 1 EUR = 4300 COP (approximate)
        GBP: 5000   // 1 GBP = 5000 COP (approximate)
      };

      const rate = rates[currency] || 1;
      return Math.round(amount * rate);

    } catch (error) {
      logger.error('Currency conversion error:', error);
      return amount; // Return original amount if conversion fails
    }
  }

  /**
   * Get fund balances for tenant
   */
  async getFundBalances(tenantId) {
    try {
      // This would query current fund balances
      // const db = require('../config/database');
      // const balances = await db('parish_funds')
      //   .select('fund_type')
      //   .sum('amount as total')
      //   .where({ tenant_id: tenantId })
      //   .groupBy('fund_type');

      // Mock data for now
      return {
        supplier: 0,
        sustainability: 0,
        reserve: 0,
        total: 0
      };

    } catch (error) {
      logger.error('Error getting fund balances:', error);
      throw error;
    }
  }

  /**
   * Get distribution history
   */
  async getDistributionHistory(tenantId, options = {}) {
    try {
      const { limit = 50, offset = 0, startDate, endDate } = options;

      // This would query distribution history
      // const db = require('../config/database');
      // let query = db('fund_distributions')
      //   .where({ tenant_id: tenantId })
      //   .orderBy('created_at', 'desc')
      //   .limit(limit)
      //   .offset(offset);

      // if (startDate) query = query.where('created_at', '>=', startDate);
      // if (endDate) query = query.where('created_at', '<=', endDate);

      // return await query;

      // Mock data for now
      return [];

    } catch (error) {
      logger.error('Error getting distribution history:', error);
      throw error;
    }
  }

  /**
   * Generate distribution report
   */
  async generateDistributionReport(tenantId, period = '30d') {
    try {
      const endDate = new Date();
      const startDate = new Date();
      
      // Calculate start date based on period
      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
      }

      // Get distribution data for period
      const distributions = await this.getDistributionHistory(tenantId, {
        startDate,
        endDate,
        limit: 1000
      });

      // Calculate totals
      const report = {
        period,
        startDate,
        endDate,
        totalDistributions: distributions.length,
        totalAmount: 0,
        breakdown: {
          suppliers: 0,
          sustainability: 0,
          reserve: 0,
          platform: 0
        },
        averageDistribution: 0,
        currentBalances: await this.getFundBalances(tenantId)
      };

      // Calculate totals from distributions
      distributions.forEach(dist => {
        report.totalAmount += dist.totalAmount || 0;
        if (dist.distribution) {
          report.breakdown.suppliers += dist.distribution.suppliers || 0;
          report.breakdown.sustainability += dist.distribution.sustainability || 0;
          report.breakdown.reserve += dist.distribution.reserve || 0;
          report.breakdown.platform += dist.distribution.platform || 0;
        }
      });

      report.averageDistribution = distributions.length > 0 
        ? Math.round(report.totalAmount / distributions.length)
        : 0;

      return report;

    } catch (error) {
      logger.error('Error generating distribution report:', error);
      throw error;
    }
  }
}

module.exports = new FundDistributionService();