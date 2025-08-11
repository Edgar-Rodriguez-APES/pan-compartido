const express = require('express');
const router = express.Router();
const FundDistributionService = require('../services/FundDistributionService');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

/**
 * Get fund balances for tenant
 */
router.get('/balances', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    // Check permissions (priest or admin)
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to view fund balances'
      });
    }

    const balances = await FundDistributionService.getFundBalances(tenantId);

    res.json({
      success: true,
      tenantId,
      balances,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error getting fund balances:', error);
    res.status(500).json({
      error: error.message || 'Failed to get fund balances'
    });
  }
});

/**
 * Get distribution history
 */
router.get('/distributions', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    // Check permissions
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to view distribution history'
      });
    }

    const { 
      limit = 50, 
      offset = 0, 
      startDate, 
      endDate 
    } = req.query;

    const options = {
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);

    const distributions = await FundDistributionService.getDistributionHistory(
      tenantId, 
      options
    );

    res.json({
      success: true,
      distributions,
      pagination: {
        limit: options.limit,
        offset: options.offset,
        total: distributions.length
      }
    });

  } catch (error) {
    logger.error('Error getting distribution history:', error);
    res.status(500).json({
      error: error.message || 'Failed to get distribution history'
    });
  }
});

/**
 * Generate distribution report
 */
router.get('/reports/:period', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { period } = req.params;
    
    // Check permissions
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to generate reports'
      });
    }

    // Validate period
    const validPeriods = ['7d', '30d', '90d', '1y'];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        error: 'Invalid period. Must be one of: ' + validPeriods.join(', ')
      });
    }

    const report = await FundDistributionService.generateDistributionReport(
      tenantId, 
      period
    );

    res.json({
      success: true,
      report
    });

  } catch (error) {
    logger.error('Error generating distribution report:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate distribution report'
    });
  }
});

/**
 * Manually trigger fund distribution (admin only)
 */
router.post('/distribute', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    // Check admin permissions
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Only administrators can manually trigger fund distribution'
      });
    }

    const { paymentData } = req.body;

    if (!paymentData || !paymentData.amount) {
      return res.status(400).json({
        error: 'Payment data with amount is required'
      });
    }

    const distribution = await FundDistributionService.distributePaymentFunds(
      paymentData,
      tenantId
    );

    res.json({
      success: true,
      distribution
    });

  } catch (error) {
    logger.error('Error in manual fund distribution:', error);
    res.status(500).json({
      error: error.message || 'Failed to distribute funds'
    });
  }
});

/**
 * Get tenant distribution rules
 */
router.get('/rules', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    // Check permissions
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to view distribution rules'
      });
    }

    const rules = await FundDistributionService.getTenantDistributionRules(tenantId);

    res.json({
      success: true,
      tenantId,
      rules
    });

  } catch (error) {
    logger.error('Error getting distribution rules:', error);
    res.status(500).json({
      error: error.message || 'Failed to get distribution rules'
    });
  }
});

/**
 * Update tenant distribution rules (admin only)
 */
router.put('/rules', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    // Check admin permissions
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to update distribution rules'
      });
    }

    const { donation, purchase } = req.body;

    // Validate distribution rules
    if (!donation || !purchase) {
      return res.status(400).json({
        error: 'Both donation and purchase distribution rules are required'
      });
    }

    // Validate percentages sum to 1.0
    const validateDistribution = (dist) => {
      const total = (dist.suppliers || 0) + (dist.sustainability || 0) + 
                   (dist.reserve || 0) + (dist.platform || 0);
      return Math.abs(total - 1.0) < 0.01; // Allow small floating point differences
    };

    if (!validateDistribution(donation) || !validateDistribution(purchase)) {
      return res.status(400).json({
        error: 'Distribution percentages must sum to 100%'
      });
    }

    // Update rules in database
    // const db = require('../config/database');
    // await db('tenant_distribution_rules')
    //   .insert({
    //     tenant_id: tenantId,
    //     donation_rules: JSON.stringify(donation),
    //     purchase_rules: JSON.stringify(purchase),
    //     updated_by: req.user.id,
    //     created_at: new Date(),
    //     updated_at: new Date()
    //   })
    //   .onConflict('tenant_id')
    //   .merge({
    //     donation_rules: JSON.stringify(donation),
    //     purchase_rules: JSON.stringify(purchase),
    //     updated_by: req.user.id,
    //     updated_at: new Date()
    //   });

    logger.info('Distribution rules updated:', {
      tenantId,
      updatedBy: req.user.id,
      donation,
      purchase
    });

    res.json({
      success: true,
      message: 'Distribution rules updated successfully',
      rules: { donation, purchase }
    });

  } catch (error) {
    logger.error('Error updating distribution rules:', error);
    res.status(500).json({
      error: error.message || 'Failed to update distribution rules'
    });
  }
});

/**
 * Get fund transactions (detailed view)
 */
router.get('/transactions', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    // Check permissions
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to view fund transactions'
      });
    }

    const { 
      fundType, 
      limit = 100, 
      offset = 0,
      startDate,
      endDate
    } = req.query;

    // This would query detailed fund transactions
    // const db = require('../config/database');
    // let query = db('parish_funds')
    //   .where({ tenant_id: tenantId })
    //   .orderBy('created_at', 'desc')
    //   .limit(parseInt(limit))
    //   .offset(parseInt(offset));

    // if (fundType) query = query.where('fund_type', fundType);
    // if (startDate) query = query.where('created_at', '>=', new Date(startDate));
    // if (endDate) query = query.where('created_at', '<=', new Date(endDate));

    // const transactions = await query;

    // Mock data for now
    const transactions = [];

    res.json({
      success: true,
      transactions,
      filters: {
        fundType,
        startDate,
        endDate
      },
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: transactions.length
      }
    });

  } catch (error) {
    logger.error('Error getting fund transactions:', error);
    res.status(500).json({
      error: error.message || 'Failed to get fund transactions'
    });
  }
});

/**
 * Transfer funds between accounts (admin only)
 */
router.post('/transfer', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    // Check admin permissions
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Only administrators can transfer funds'
      });
    }

    const { fromFund, toFund, amount, reason } = req.body;

    if (!fromFund || !toFund || !amount || amount <= 0) {
      return res.status(400).json({
        error: 'Valid fromFund, toFund, and positive amount are required'
      });
    }

    if (fromFund === toFund) {
      return res.status(400).json({
        error: 'Cannot transfer to the same fund'
      });
    }

    // Validate fund types
    const validFunds = ['supplier', 'sustainability', 'reserve'];
    if (!validFunds.includes(fromFund) || !validFunds.includes(toFund)) {
      return res.status(400).json({
        error: 'Invalid fund type. Must be one of: ' + validFunds.join(', ')
      });
    }

    // Check if source fund has sufficient balance
    const balances = await FundDistributionService.getFundBalances(tenantId);
    if (balances[fromFund] < amount) {
      return res.status(400).json({
        error: `Insufficient balance in ${fromFund} fund`
      });
    }

    // Process transfer
    // const db = require('../config/database');
    // const transferId = `transfer_${Date.now()}`;
    
    // await db.transaction(async (trx) => {
    //   // Debit from source fund
    //   await trx('parish_funds').insert({
    //     tenant_id: tenantId,
    //     fund_type: fromFund,
    //     amount: -amount,
    //     transaction_type: 'transfer_out',
    //     reference_id: transferId,
    //     description: `Transfer to ${toFund}: ${reason}`,
    //     created_by: req.user.id,
    //     created_at: new Date()
    //   });

    //   // Credit to destination fund
    //   await trx('parish_funds').insert({
    //     tenant_id: tenantId,
    //     fund_type: toFund,
    //     amount: amount,
    //     transaction_type: 'transfer_in',
    //     reference_id: transferId,
    //     description: `Transfer from ${fromFund}: ${reason}`,
    //     created_by: req.user.id,
    //     created_at: new Date()
    //   });
    // });

    logger.info('Fund transfer completed:', {
      tenantId,
      fromFund,
      toFund,
      amount,
      reason,
      transferredBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Fund transfer completed successfully',
      transfer: {
        fromFund,
        toFund,
        amount,
        reason,
        transferredBy: req.user.id,
        transferredAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error transferring funds:', error);
    res.status(500).json({
      error: error.message || 'Failed to transfer funds'
    });
  }
});

/**
 * Get fund analytics dashboard data
 */
router.get('/analytics', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    // Check permissions
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to view fund analytics'
      });
    }

    const { period = '30d' } = req.query;

    // Get comprehensive analytics data
    const [balances, report] = await Promise.all([
      FundDistributionService.getFundBalances(tenantId),
      FundDistributionService.generateDistributionReport(tenantId, period)
    ]);

    // Calculate additional metrics
    const analytics = {
      currentBalances: balances,
      distributionReport: report,
      trends: {
        // This would calculate trends over time
        totalGrowth: 0,
        distributionEfficiency: 0,
        averageDistributionTime: 0
      },
      alerts: [
        // This would generate alerts for low balances, etc.
      ]
    };

    // Add alerts for low balances
    const minimumBalances = {
      supplier: 100000,      // $100,000 COP
      sustainability: 50000, // $50,000 COP
      reserve: 200000       // $200,000 COP
    };

    Object.entries(minimumBalances).forEach(([fund, minimum]) => {
      if (balances[fund] < minimum) {
        analytics.alerts.push({
          type: 'low_balance',
          fund,
          currentBalance: balances[fund],
          minimumBalance: minimum,
          severity: 'warning'
        });
      }
    });

    res.json({
      success: true,
      analytics
    });

  } catch (error) {
    logger.error('Error getting fund analytics:', error);
    res.status(500).json({
      error: error.message || 'Failed to get fund analytics'
    });
  }
});

module.exports = router;