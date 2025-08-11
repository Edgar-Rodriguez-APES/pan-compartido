const express = require('express');
const router = express.Router();
const SupplierService = require('../services/SupplierService');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

/**
 * Get suppliers list with filtering and pagination
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const {
      status,
      category,
      search,
      limit = 50,
      offset = 0,
      orderBy = 'name',
      orderDirection = 'asc'
    } = req.query;

    const options = {
      status,
      category,
      search,
      limit: parseInt(limit),
      offset: parseInt(offset),
      orderBy,
      orderDirection
    };

    const result = await SupplierService.getSuppliers(tenantId, options);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    logger.error('Error getting suppliers:', error);
    res.status(500).json({
      error: error.message || 'Failed to get suppliers'
    });
  }
});

/**
 * Get supplier by ID with full details
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const supplierId = req.params.id;

    const supplier = await SupplierService.getSupplierDetails(supplierId, tenantId);

    res.json({
      success: true,
      supplier
    });

  } catch (error) {
    logger.error('Error getting supplier details:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      error: error.message || 'Failed to get supplier details'
    });
  }
});

/**
 * Create new supplier
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    // Check permissions (priest or admin)
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to create suppliers'
      });
    }

    const supplierData = req.body;
    const supplier = await SupplierService.createSupplier(supplierData, tenantId);

    res.status(201).json({
      success: true,
      supplier,
      message: 'Supplier created successfully'
    });

  } catch (error) {
    logger.error('Error creating supplier:', error);
    res.status(400).json({
      error: error.message || 'Failed to create supplier'
    });
  }
});

/**
 * Update supplier
 */
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const supplierId = req.params.id;
    
    // Check permissions
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to update suppliers'
      });
    }

    const updateData = req.body;
    const supplier = await SupplierService.updateSupplier(supplierId, updateData, tenantId);

    res.json({
      success: true,
      supplier,
      message: 'Supplier updated successfully'
    });

  } catch (error) {
    logger.error('Error updating supplier:', error);
    res.status(error.message.includes('not found') ? 404 : 400).json({
      error: error.message || 'Failed to update supplier'
    });
  }
});

/**
 * Approve supplier
 */
router.post('/:id/approve', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const supplierId = req.params.id;
    
    // Check permissions (priest or admin)
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to approve suppliers'
      });
    }

    const supplier = await SupplierService.approveSupplier(
      supplierId, 
      tenantId, 
      req.user.id
    );

    res.json({
      success: true,
      supplier,
      message: 'Supplier approved successfully'
    });

  } catch (error) {
    logger.error('Error approving supplier:', error);
    res.status(error.message.includes('not found') ? 404 : 400).json({
      error: error.message || 'Failed to approve supplier'
    });
  }
});

/**
 * Reject supplier
 */
router.post('/:id/reject', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const supplierId = req.params.id;
    const { reason } = req.body;
    
    // Check permissions
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to reject suppliers'
      });
    }

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        error: 'Rejection reason must be at least 10 characters long'
      });
    }

    const supplier = await SupplierService.rejectSupplier(
      supplierId, 
      tenantId, 
      req.user.id,
      reason
    );

    res.json({
      success: true,
      supplier,
      message: 'Supplier rejected successfully'
    });

  } catch (error) {
    logger.error('Error rejecting supplier:', error);
    res.status(error.message.includes('not found') ? 404 : 400).json({
      error: error.message || 'Failed to reject supplier'
    });
  }
});

/**
 * Suspend supplier
 */
router.post('/:id/suspend', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const supplierId = req.params.id;
    const { reason } = req.body;
    
    // Check permissions
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to suspend suppliers'
      });
    }

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        error: 'Suspension reason must be at least 10 characters long'
      });
    }

    const supplier = await SupplierService.suspendSupplier(
      supplierId, 
      tenantId, 
      req.user.id,
      reason
    );

    res.json({
      success: true,
      supplier,
      message: 'Supplier suspended successfully'
    });

  } catch (error) {
    logger.error('Error suspending supplier:', error);
    res.status(error.message.includes('not found') ? 404 : 400).json({
      error: error.message || 'Failed to suspend supplier'
    });
  }
});

/**
 * Update supplier inventory
 */
router.put('/:id/inventory', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const supplierId = req.params.id;
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        error: 'Inventory updates array is required'
      });
    }

    // Validate each update
    for (const update of updates) {
      if (!update.product_id || update.quantity < 0 || update.price < 0) {
        return res.status(400).json({
          error: 'Each update must have product_id, quantity >= 0, and price >= 0'
        });
      }
    }

    const results = await SupplierService.updateInventory(supplierId, tenantId, updates);

    res.json({
      success: true,
      results,
      message: 'Inventory updated successfully'
    });

  } catch (error) {
    logger.error('Error updating inventory:', error);
    res.status(error.message.includes('not found') ? 404 : 400).json({
      error: error.message || 'Failed to update inventory'
    });
  }
});

/**
 * Add supplier review
 */
router.post('/:id/reviews', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const supplierId = req.params.id;
    const reviewData = {
      ...req.body,
      reviewer_name: req.user.name || 'Anonymous'
    };

    const ratingStats = await SupplierService.addSupplierReview(
      supplierId, 
      tenantId, 
      reviewData
    );

    res.json({
      success: true,
      rating_stats: ratingStats,
      message: 'Review added successfully'
    });

  } catch (error) {
    logger.error('Error adding supplier review:', error);
    res.status(error.message.includes('not found') ? 404 : 400).json({
      error: error.message || 'Failed to add review'
    });
  }
});

/**
 * Get supplier reviews
 */
router.get('/:id/reviews', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const supplierId = req.params.id;
    const {
      limit = 20,
      offset = 0,
      orderBy = 'created_at',
      orderDirection = 'desc'
    } = req.query;

    const options = {
      limit: parseInt(limit),
      offset: parseInt(offset),
      orderBy,
      orderDirection
    };

    const reviews = await SupplierService.getSupplierReviews(
      supplierId, 
      tenantId, 
      options
    );

    res.json({
      success: true,
      reviews
    });

  } catch (error) {
    logger.error('Error getting supplier reviews:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      error: error.message || 'Failed to get reviews'
    });
  }
});

/**
 * Search suppliers by location
 */
router.get('/search/location', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { latitude, longitude, radius = 50 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Latitude and longitude are required'
      });
    }

    const suppliers = await SupplierService.searchSuppliersByLocation(
      tenantId,
      parseFloat(latitude),
      parseFloat(longitude),
      parseInt(radius)
    );

    res.json({
      success: true,
      suppliers,
      search_params: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radius: parseInt(radius)
      }
    });

  } catch (error) {
    logger.error('Error searching suppliers by location:', error);
    res.status(400).json({
      error: error.message || 'Failed to search suppliers by location'
    });
  }
});

/**
 * Get top performing suppliers
 */
router.get('/top/performers', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { limit = 10 } = req.query;

    const suppliers = await SupplierService.getTopSuppliers(
      tenantId, 
      parseInt(limit)
    );

    res.json({
      success: true,
      suppliers
    });

  } catch (error) {
    logger.error('Error getting top suppliers:', error);
    res.status(500).json({
      error: error.message || 'Failed to get top suppliers'
    });
  }
});

/**
 * Get supplier dashboard data
 */
router.get('/dashboard/summary', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    // Check permissions
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to view supplier dashboard'
      });
    }

    const dashboard = await SupplierService.getSupplierDashboard(tenantId);

    res.json({
      success: true,
      dashboard
    });

  } catch (error) {
    logger.error('Error getting supplier dashboard:', error);
    res.status(500).json({
      error: error.message || 'Failed to get supplier dashboard'
    });
  }
});

/**
 * Generate supplier report
 */
router.get('/reports/generate', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    // Check permissions
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to generate reports'
      });
    }

    const { period = '30d', format = 'json' } = req.query;

    const report = await SupplierService.generateSupplierReport(tenantId, {
      period,
      format
    });

    res.json({
      success: true,
      report
    });

  } catch (error) {
    logger.error('Error generating supplier report:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate supplier report'
    });
  }
});

/**
 * Bulk operations on suppliers
 */
router.post('/bulk/action', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    // Check permissions
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions for bulk operations'
      });
    }

    const { action, supplier_ids, data } = req.body;

    if (!action || !supplier_ids || !Array.isArray(supplier_ids)) {
      return res.status(400).json({
        error: 'Action and supplier_ids array are required'
      });
    }

    const results = [];
    const errors = [];

    for (const supplierId of supplier_ids) {
      try {
        let result;
        
        switch (action) {
          case 'approve':
            result = await SupplierService.approveSupplier(supplierId, tenantId, req.user.id);
            break;
          case 'suspend':
            if (!data?.reason) {
              throw new Error('Reason is required for suspension');
            }
            result = await SupplierService.suspendSupplier(supplierId, tenantId, req.user.id, data.reason);
            break;
          case 'update_status':
            if (!data?.status) {
              throw new Error('Status is required for status update');
            }
            result = await SupplierService.updateSupplier(supplierId, { status: data.status }, tenantId);
            break;
          default:
            throw new Error(`Unsupported bulk action: ${action}`);
        }

        results.push({ supplier_id: supplierId, success: true, result });
      } catch (error) {
        errors.push({ supplier_id: supplierId, error: error.message });
      }
    }

    res.json({
      success: true,
      results,
      errors,
      summary: {
        total: supplier_ids.length,
        successful: results.length,
        failed: errors.length
      }
    });

  } catch (error) {
    logger.error('Error in bulk supplier operation:', error);
    res.status(400).json({
      error: error.message || 'Failed to perform bulk operation'
    });
  }
});

module.exports = router;