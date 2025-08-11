const express = require('express');
const Joi = require('joi');
const multer = require('multer');
const BrandingService = require('../services/BrandingService');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

// Configurar multer para subida de archivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes JPEG, PNG, SVG y WebP.'));
    }
  }
});

// Esquemas de validación
const brandingUpdateSchema = Joi.object({
  primaryColor: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
  secondaryColor: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
  accentColor: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
  backgroundColor: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
  textColor: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
  fontFamily: Joi.string().max(100).optional(),
  organizationName: Joi.string().max(100).optional(),
  tagline: Joi.string().max(200).optional(),
  customCss: Joi.string().max(5000).optional(),
  emailSignature: Joi.string().max(1000).optional(),
  whatsappFooter: Joi.string().max(200).optional()
});

const contactInfoSchema = Joi.object({
  phone: Joi.string().max(20).optional(),
  email: Joi.string().email().optional(),
  address: Joi.string().max(300).optional(),
  website: Joi.string().uri().optional(),
  socialMedia: Joi.object({
    facebook: Joi.string().max(100).optional(),
    instagram: Joi.string().max(100).optional(),
    twitter: Joi.string().max(100).optional(),
    youtube: Joi.string().max(100).optional()
  }).optional()
});

/**
 * Get complete branding configuration
 */
router.get('/config', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    // Check permissions
    if (!req.user || !['priest', 'admin', 'coordinator'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to view branding configuration'
      });
    }

    const brandingConfig = await BrandingService.getBrandingConfig(tenantId);
    
    res.json({
      success: true,
      branding: brandingConfig
    });

  } catch (error) {
    logger.error('Error getting branding config:', error);
    res.status(500).json({
      error: error.message || 'Failed to get branding configuration'
    });
  }
});

/**
 * Get public branding (no authentication required)
 */
router.get('/public/:tenantId', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    
    if (!tenantId || isNaN(tenantId)) {
      return res.status(400).json({
        error: 'Invalid tenant ID'
      });
    }

    const publicBranding = await BrandingService.getPublicBranding(tenantId);
    
    res.json({
      success: true,
      branding: publicBranding
    });

  } catch (error) {
    logger.error('Error getting public branding:', error);
    res.status(500).json({
      error: error.message || 'Failed to get public branding'
    });
  }
});

/**
 * Get CSS variables for frontend
 */
router.get('/css/:tenantId', async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    
    if (!tenantId || isNaN(tenantId)) {
      return res.status(400).json({
        error: 'Invalid tenant ID'
      });
    }

    const cssVariables = await BrandingService.generateCssVariables(tenantId);
    
    res.setHeader('Content-Type', 'text/css');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(cssVariables);

  } catch (error) {
    logger.error('Error generating CSS variables:', error);
    res.status(500).send('/* Error generating CSS variables */');
  }
});

/**
 * Update branding configuration
 */
router.put('/config', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    // Check permissions (priest or admin only)
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Only priests and administrators can update branding configuration'
      });
    }

    const { error, value } = brandingUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const updatedConfig = await BrandingService.updateBrandingConfig(
      tenantId,
      value,
      req.user
    );

    res.json({
      success: true,
      message: 'Branding configuration updated successfully',
      branding: updatedConfig
    });

  } catch (error) {
    logger.error('Error updating branding config:', error);
    res.status(500).json({
      error: error.message || 'Failed to update branding configuration'
    });
  }
});

/**
 * Update contact information
 */
router.put('/contact', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    // Check permissions
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Only priests and administrators can update contact information'
      });
    }

    const { error, value } = contactInfoSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }

    const updatedBranding = await BrandingService.updateContactInfo(
      tenantId,
      value,
      req.user
    );

    res.json({
      success: true,
      message: 'Contact information updated successfully',
      contactInfo: updatedBranding.contactInfo
    });

  } catch (error) {
    logger.error('Error updating contact info:', error);
    res.status(500).json({
      error: error.message || 'Failed to update contact information'
    });
  }
});

/**
 * Upload logo
 */
router.post('/logo', authMiddleware, upload.single('logo'), async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    // Check permissions
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Only priests and administrators can upload logos'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'Logo file is required'
      });
    }

    const result = await BrandingService.uploadBrandingImage(
      tenantId,
      req.file,
      'logo',
      req.user
    );

    res.json({
      success: true,
      message: 'Logo uploaded successfully',
      ...result
    });

  } catch (error) {
    logger.error('Error uploading logo:', error);
    res.status(500).json({
      error: error.message || 'Failed to upload logo'
    });
  }
});

/**
 * Upload favicon
 */
router.post('/favicon', authMiddleware, upload.single('favicon'), async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    // Check permissions
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Only priests and administrators can upload favicons'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'Favicon file is required'
      });
    }

    const result = await BrandingService.uploadBrandingImage(
      tenantId,
      req.file,
      'favicon',
      req.user
    );

    res.json({
      success: true,
      message: 'Favicon uploaded successfully',
      ...result
    });

  } catch (error) {
    logger.error('Error uploading favicon:', error);
    res.status(500).json({
      error: error.message || 'Failed to upload favicon'
    });
  }
});

/**
 * Delete logo
 */
router.delete('/logo', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    // Check permissions
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Only priests and administrators can delete logos'
      });
    }

    await BrandingService.deleteBrandingImage(tenantId, 'logo', req.user);

    res.json({
      success: true,
      message: 'Logo deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting logo:', error);
    res.status(500).json({
      error: error.message || 'Failed to delete logo'
    });
  }
});

/**
 * Delete favicon
 */
router.delete('/favicon', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    // Check permissions
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Only priests and administrators can delete favicons'
      });
    }

    await BrandingService.deleteBrandingImage(tenantId, 'favicon', req.user);

    res.json({
      success: true,
      message: 'Favicon deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting favicon:', error);
    res.status(500).json({
      error: error.message || 'Failed to delete favicon'
    });
  }
});

/**
 * Get contact information
 */
router.get('/contact', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    const contactInfo = await BrandingService.getContactInfo(tenantId);
    
    res.json({
      success: true,
      contactInfo
    });

  } catch (error) {
    logger.error('Error getting contact info:', error);
    res.status(500).json({
      error: error.message || 'Failed to get contact information'
    });
  }
});

/**
 * Get branding statistics
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    // Check permissions
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions to view branding statistics'
      });
    }

    const stats = await BrandingService.getBrandingStats(tenantId);
    
    res.json({
      success: true,
      stats
    });

  } catch (error) {
    logger.error('Error getting branding stats:', error);
    res.status(500).json({
      error: error.message || 'Failed to get branding statistics'
    });
  }
});

/**
 * Export branding configuration
 */
router.get('/export', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    // Check permissions
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Only priests and administrators can export branding configuration'
      });
    }

    const exportData = await BrandingService.exportBrandingConfig(tenantId);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="branding-config-${tenantId}-${Date.now()}.json"`);
    res.json(exportData);

  } catch (error) {
    logger.error('Error exporting branding config:', error);
    res.status(500).json({
      error: error.message || 'Failed to export branding configuration'
    });
  }
});

/**
 * Import branding configuration
 */
router.post('/import', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    // Check permissions
    if (!req.user || !['priest', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        error: 'Only priests and administrators can import branding configuration'
      });
    }

    if (!req.body || !req.body.branding) {
      return res.status(400).json({
        error: 'Invalid import data. Expected branding configuration object.'
      });
    }

    const importedBranding = await BrandingService.importBrandingConfig(
      tenantId,
      req.body,
      req.user
    );

    res.json({
      success: true,
      message: 'Branding configuration imported successfully',
      branding: importedBranding
    });

  } catch (error) {
    logger.error('Error importing branding config:', error);
    res.status(500).json({
      error: error.message || 'Failed to import branding configuration'
    });
  }
});

/**
 * Clear branding cache
 */
router.post('/clear-cache', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    // Check permissions (admin only)
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Only administrators can clear branding cache'
      });
    }

    await BrandingService.clearBrandingCache(tenantId);

    res.json({
      success: true,
      message: 'Branding cache cleared successfully'
    });

  } catch (error) {
    logger.error('Error clearing branding cache:', error);
    res.status(500).json({
      error: error.message || 'Failed to clear branding cache'
    });
  }
});

module.exports = router;