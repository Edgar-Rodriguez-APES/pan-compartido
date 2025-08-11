const { cache } = require('../config/redis');
const { createTenantQuery } = require('../utils/tenantQuery');
const logger = require('../utils/logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

class BrandingService {
  constructor() {
    this.defaultBranding = {
      primaryColor: '#2563eb',
      secondaryColor: '#1e40af',
      accentColor: '#f59e0b',
      backgroundColor: '#ffffff',
      textColor: '#1f2937',
      fontFamily: 'Inter, sans-serif',
      logoUrl: null,
      faviconUrl: null,
      organizationName: 'Pan Compartido',
      tagline: 'Compartiendo esperanza, alimentando amor',
      contactInfo: {
        phone: '',
        email: '',
        address: '',
        website: '',
        socialMedia: {
          facebook: '',
          instagram: '',
          twitter: '',
          youtube: ''
        }
      },
      customCss: '',
      emailSignature: '',
      whatsappFooter: '🙏 Pan Compartido - Compartiendo esperanza'
    };
  }

  /**
   * Get branding configuration for tenant
   */
  async getBrandingConfig(tenantId) {
    try {
      const cacheKey = `branding:${tenantId}`;
      let branding = await cache.get(cacheKey);

      if (!branding) {
        const tenantQuery = createTenantQuery(tenantId);
        
        // Get branding configuration from database
        const brandingRecord = await tenantQuery.table('tenant_branding')
          .where('tenant_id', tenantId)
          .first();

        if (brandingRecord) {
          branding = {
            ...this.defaultBranding,
            ...JSON.parse(brandingRecord.config || '{}'),
            id: brandingRecord.id,
            updatedAt: brandingRecord.updated_at
          };
        } else {
          // Return default branding if none exists
          branding = { ...this.defaultBranding };
        }

        // Cache for 1 hour
        await cache.set(cacheKey, branding, 3600);
      }

      return branding;
    } catch (error) {
      logger.error('Error getting branding config:', error);
      return { ...this.defaultBranding };
    }
  }

  /**
   * Update branding configuration
   */
  async updateBrandingConfig(tenantId, brandingData, updatedBy) {
    try {
      const tenantQuery = createTenantQuery(tenantId);

      // Validate branding data
      const validatedData = this.validateBrandingData(brandingData);

      // Check if branding record exists
      const existingBranding = await tenantQuery.table('tenant_branding')
        .where('tenant_id', tenantId)
        .first();

      let branding;
      if (existingBranding) {
        // Update existing branding
        const [updatedBranding] = await tenantQuery.table('tenant_branding')
          .where('tenant_id', tenantId)
          .update({
            config: JSON.stringify(validatedData),
            updated_at: new Date(),
            updated_by: updatedBy?.id
          })
          .returning('*');
        
        branding = updatedBranding;
      } else {
        // Create new branding record
        const [newBranding] = await tenantQuery.table('tenant_branding')
          .insert({
            tenant_id: tenantId,
            config: JSON.stringify(validatedData),
            created_at: new Date(),
            updated_at: new Date(),
            created_by: updatedBy?.id,
            updated_by: updatedBy?.id
          })
          .returning('*');
        
        branding = newBranding;
      }

      // Clear cache
      await this.clearBrandingCache(tenantId);

      logger.info('Branding configuration updated:', {
        tenantId,
        brandingId: branding.id,
        updatedBy: updatedBy?.id
      });

      return {
        ...this.defaultBranding,
        ...validatedData,
        id: branding.id,
        updatedAt: branding.updated_at
      };

    } catch (error) {
      logger.error('Error updating branding config:', error);
      throw error;
    }
  }

  /**
   * Upload logo or favicon
   */
  async uploadBrandingImage(tenantId, file, imageType, updatedBy) {
    try {
      // Validate image type
      const validTypes = ['logo', 'favicon'];
      if (!validTypes.includes(imageType)) {
        throw new Error('Invalid image type. Must be logo or favicon');
      }

      // Validate file
      if (!file) {
        throw new Error('No file provided');
      }

      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new Error('Invalid file type. Only JPEG, PNG, SVG, and WebP are allowed');
      }

      // Create upload directory if it doesn't exist
      const uploadDir = path.join(process.cwd(), 'uploads', 'branding', tenantId.toString());
      await fs.mkdir(uploadDir, { recursive: true });

      // Generate unique filename
      const fileExtension = path.extname(file.originalname);
      const fileName = `${imageType}_${Date.now()}${fileExtension}`;
      const filePath = path.join(uploadDir, fileName);

      // Save file
      await fs.writeFile(filePath, file.buffer);

      // Generate public URL
      const publicUrl = `/uploads/branding/${tenantId}/${fileName}`;

      // Update branding configuration
      const currentBranding = await this.getBrandingConfig(tenantId);
      const updatedBranding = {
        ...currentBranding,
        [`${imageType}Url`]: publicUrl
      };

      await this.updateBrandingConfig(tenantId, updatedBranding, updatedBy);

      logger.info('Branding image uploaded:', {
        tenantId,
        imageType,
        fileName,
        updatedBy: updatedBy?.id
      });

      return {
        success: true,
        imageType,
        url: publicUrl,
        fileName
      };

    } catch (error) {
      logger.error('Error uploading branding image:', error);
      throw error;
    }
  }

  /**
   * Delete branding image
   */
  async deleteBrandingImage(tenantId, imageType, updatedBy) {
    try {
      const validTypes = ['logo', 'favicon'];
      if (!validTypes.includes(imageType)) {
        throw new Error('Invalid image type');
      }

      const currentBranding = await this.getBrandingConfig(tenantId);
      const imageUrl = currentBranding[`${imageType}Url`];

      if (imageUrl) {
        // Delete file from filesystem
        try {
          const filePath = path.join(process.cwd(), imageUrl);
          await fs.unlink(filePath);
        } catch (fileError) {
          logger.warn('Could not delete image file:', fileError);
        }

        // Update branding configuration
        const updatedBranding = {
          ...currentBranding,
          [`${imageType}Url`]: null
        };

        await this.updateBrandingConfig(tenantId, updatedBranding, updatedBy);
      }

      logger.info('Branding image deleted:', {
        tenantId,
        imageType,
        updatedBy: updatedBy?.id
      });

      return { success: true };

    } catch (error) {
      logger.error('Error deleting branding image:', error);
      throw error;
    }
  }

  /**
   * Get contact information for tenant
   */
  async getContactInfo(tenantId) {
    try {
      const branding = await this.getBrandingConfig(tenantId);
      return branding.contactInfo || this.defaultBranding.contactInfo;
    } catch (error) {
      logger.error('Error getting contact info:', error);
      return this.defaultBranding.contactInfo;
    }
  }

  /**
   * Update contact information
   */
  async updateContactInfo(tenantId, contactInfo, updatedBy) {
    try {
      const currentBranding = await this.getBrandingConfig(tenantId);
      
      const updatedBranding = {
        ...currentBranding,
        contactInfo: {
          ...this.defaultBranding.contactInfo,
          ...currentBranding.contactInfo,
          ...contactInfo
        }
      };

      return await this.updateBrandingConfig(tenantId, updatedBranding, updatedBy);

    } catch (error) {
      logger.error('Error updating contact info:', error);
      throw error;
    }
  }

  /**
   * Generate CSS variables for frontend
   */
  async generateCssVariables(tenantId) {
    try {
      const branding = await this.getBrandingConfig(tenantId);

      const cssVariables = `
        :root {
          --primary-color: ${branding.primaryColor};
          --secondary-color: ${branding.secondaryColor};
          --accent-color: ${branding.accentColor};
          --background-color: ${branding.backgroundColor};
          --text-color: ${branding.textColor};
          --font-family: ${branding.fontFamily};
        }
        
        ${branding.customCss || ''}
      `;

      return cssVariables.trim();

    } catch (error) {
      logger.error('Error generating CSS variables:', error);
      return '';
    }
  }

  /**
   * Get branding for public pages (no authentication required)
   */
  async getPublicBranding(tenantId) {
    try {
      const branding = await this.getBrandingConfig(tenantId);

      // Return only public-safe branding information
      return {
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        accentColor: branding.accentColor,
        backgroundColor: branding.backgroundColor,
        textColor: branding.textColor,
        fontFamily: branding.fontFamily,
        logoUrl: branding.logoUrl,
        faviconUrl: branding.faviconUrl,
        organizationName: branding.organizationName,
        tagline: branding.tagline,
        contactInfo: {
          phone: branding.contactInfo?.phone || '',
          email: branding.contactInfo?.email || '',
          address: branding.contactInfo?.address || '',
          website: branding.contactInfo?.website || '',
          socialMedia: branding.contactInfo?.socialMedia || {}
        }
      };

    } catch (error) {
      logger.error('Error getting public branding:', error);
      return this.getPublicDefaultBranding();
    }
  }

  /**
   * Validate branding data
   */
  validateBrandingData(data) {
    const validated = {};

    // Validate colors (hex format)
    const colorFields = ['primaryColor', 'secondaryColor', 'accentColor', 'backgroundColor', 'textColor'];
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

    colorFields.forEach(field => {
      if (data[field]) {
        if (hexColorRegex.test(data[field])) {
          validated[field] = data[field];
        } else {
          throw new Error(`Invalid color format for ${field}. Must be hex format (e.g., #ffffff)`);
        }
      }
    });

    // Validate strings
    const stringFields = ['fontFamily', 'organizationName', 'tagline', 'customCss', 'emailSignature', 'whatsappFooter'];
    stringFields.forEach(field => {
      if (data[field] !== undefined) {
        validated[field] = String(data[field]).trim();
      }
    });

    // Validate URLs
    const urlFields = ['logoUrl', 'faviconUrl'];
    urlFields.forEach(field => {
      if (data[field]) {
        try {
          new URL(data[field]);
          validated[field] = data[field];
        } catch {
          // If not a valid URL, treat as relative path
          validated[field] = data[field];
        }
      }
    });

    // Validate contact info
    if (data.contactInfo) {
      validated.contactInfo = this.validateContactInfo(data.contactInfo);
    }

    return validated;
  }

  /**
   * Validate contact information
   */
  validateContactInfo(contactInfo) {
    const validated = {};

    // Validate basic contact fields
    const contactFields = ['phone', 'email', 'address', 'website'];
    contactFields.forEach(field => {
      if (contactInfo[field] !== undefined) {
        validated[field] = String(contactInfo[field]).trim();
      }
    });

    // Validate email format
    if (validated.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(validated.email)) {
        throw new Error('Invalid email format');
      }
    }

    // Validate phone format (basic validation)
    if (validated.phone) {
      const phoneRegex = /^[\+]?[1-9][\d\s\-\(\)]{7,15}$/;
      if (!phoneRegex.test(validated.phone.replace(/\s/g, ''))) {
        throw new Error('Invalid phone format');
      }
    }

    // Validate social media
    if (contactInfo.socialMedia) {
      validated.socialMedia = {};
      const socialFields = ['facebook', 'instagram', 'twitter', 'youtube'];
      
      socialFields.forEach(field => {
        if (contactInfo.socialMedia[field] !== undefined) {
          validated.socialMedia[field] = String(contactInfo.socialMedia[field]).trim();
        }
      });
    }

    return validated;
  }

  /**
   * Clear branding cache
   */
  async clearBrandingCache(tenantId) {
    try {
      const cacheKey = `branding:${tenantId}`;
      await cache.del(cacheKey);
      
      logger.info('Branding cache cleared:', { tenantId });
    } catch (error) {
      logger.error('Error clearing branding cache:', error);
    }
  }

  /**
   * Get default public branding
   */
  getPublicDefaultBranding() {
    return {
      primaryColor: this.defaultBranding.primaryColor,
      secondaryColor: this.defaultBranding.secondaryColor,
      accentColor: this.defaultBranding.accentColor,
      backgroundColor: this.defaultBranding.backgroundColor,
      textColor: this.defaultBranding.textColor,
      fontFamily: this.defaultBranding.fontFamily,
      logoUrl: null,
      faviconUrl: null,
      organizationName: this.defaultBranding.organizationName,
      tagline: this.defaultBranding.tagline,
      contactInfo: this.defaultBranding.contactInfo
    };
  }

  /**
   * Export branding configuration
   */
  async exportBrandingConfig(tenantId) {
    try {
      const branding = await this.getBrandingConfig(tenantId);
      
      return {
        exportedAt: new Date().toISOString(),
        tenantId,
        branding: {
          ...branding,
          // Remove sensitive or system-specific data
          id: undefined,
          updatedAt: undefined
        }
      };

    } catch (error) {
      logger.error('Error exporting branding config:', error);
      throw error;
    }
  }

  /**
   * Import branding configuration
   */
  async importBrandingConfig(tenantId, importData, updatedBy) {
    try {
      if (!importData.branding) {
        throw new Error('Invalid import data: missing branding configuration');
      }

      // Validate and import branding data
      const validatedData = this.validateBrandingData(importData.branding);
      
      const result = await this.updateBrandingConfig(tenantId, validatedData, updatedBy);

      logger.info('Branding configuration imported:', {
        tenantId,
        importedFrom: importData.exportedAt,
        updatedBy: updatedBy?.id
      });

      return result;

    } catch (error) {
      logger.error('Error importing branding config:', error);
      throw error;
    }
  }

  /**
   * Get branding statistics
   */
  async getBrandingStats(tenantId) {
    try {
      const branding = await this.getBrandingConfig(tenantId);
      
      const stats = {
        hasCustomLogo: !!branding.logoUrl,
        hasCustomFavicon: !!branding.faviconUrl,
        hasCustomColors: branding.primaryColor !== this.defaultBranding.primaryColor,
        hasCustomCss: !!branding.customCss,
        hasContactInfo: !!(branding.contactInfo?.phone || branding.contactInfo?.email),
        hasSocialMedia: !!(
          branding.contactInfo?.socialMedia?.facebook ||
          branding.contactInfo?.socialMedia?.instagram ||
          branding.contactInfo?.socialMedia?.twitter ||
          branding.contactInfo?.socialMedia?.youtube
        ),
        customizationLevel: 0
      };

      // Calculate customization level (0-100)
      const customizationFactors = [
        stats.hasCustomLogo,
        stats.hasCustomFavicon,
        stats.hasCustomColors,
        stats.hasCustomCss,
        stats.hasContactInfo,
        stats.hasSocialMedia
      ];

      stats.customizationLevel = Math.round(
        (customizationFactors.filter(Boolean).length / customizationFactors.length) * 100
      );

      return stats;

    } catch (error) {
      logger.error('Error getting branding stats:', error);
      return {
        hasCustomLogo: false,
        hasCustomFavicon: false,
        hasCustomColors: false,
        hasCustomCss: false,
        hasContactInfo: false,
        hasSocialMedia: false,
        customizationLevel: 0
      };
    }
  }
}

module.exports = new BrandingService();