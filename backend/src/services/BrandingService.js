const { cache } = require('../config/redis');
const TenantService = require('./TenantService');
const logger = require('../utils/logger');

class BrandingService {
  // Obtener configuración completa de branding
  static async getBrandingConfig(tenantId) {
    try {
      const cacheKey = `branding:${tenantId}`;
      let config = await cache.get(cacheKey);

      if (!config) {
        const tenant = await TenantService.getTenant(tenantId);
        
        config = {
          tenant: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug
          },
          branding: {
            logo: tenant.logoUrl || '/images/default-logo.png',
            colors: {
              primary: tenant.branding?.colors?.primary || '#2563eb',
              secondary: tenant.branding?.colors?.secondary || '#10b981',
              accent: tenant.branding?.colors?.accent || '#f59e0b',
              background: tenant.branding?.colors?.background || '#f8fafc',
              text: tenant.branding?.colors?.text || '#1f2937'
            },
            fonts: {
              primary: tenant.branding?.fonts?.primary || 'Inter, sans-serif',
              secondary: tenant.branding?.fonts?.secondary || 'Inter, sans-serif'
            },
            customCss: tenant.branding?.customCss || ''
          },
          contact: {
            phone: tenant.contactInfo?.phone || '',
            email: tenant.contactInfo?.email || '',
            address: tenant.contactInfo?.address || '',
            website: tenant.contactInfo?.website || '',
            socialMedia: {
              facebook: tenant.contactInfo?.socialMedia?.facebook || '',
              instagram: tenant.contactInfo?.socialMedia?.instagram || '',
              twitter: tenant.contactInfo?.socialMedia?.twitter || '',
              whatsapp: tenant.contactInfo?.socialMedia?.whatsapp || ''
            }
          },
          settings: {
            campaignFrequency: tenant.settings?.campaignFrequency || 'weekly',
            minOrderAmount: tenant.settings?.minOrderAmount || 50000,
            platformFeePercentage: tenant.settings?.platformFeePercentage || 5,
            allowPublicDonations: tenant.settings?.allowPublicDonations || true,
            requirePhoneVerification: tenant.settings?.requirePhoneVerification || false,
            enableWhatsAppNotifications: tenant.settings?.enableWhatsAppNotifications || true,
            enableEmailNotifications: tenant.settings?.enableEmailNotifications || true
          }
        };

        // Guardar en cache por 2 horas
        await cache.set(cacheKey, config, 7200);
      }

      return config;
    } catch (error) {
      logger.error('Error obteniendo configuración de branding:', error);
      throw error;
    }
  }

  // Actualizar configuración de branding
  static async updateBrandingConfig(tenantId, updates, updatedBy) {
    try {
      const tenant = await TenantService.getTenant(tenantId);
      
      // Preparar datos de actualización
      const updateData = {};

      // Actualizar branding
      if (updates.branding) {
        updateData.branding = {
          ...tenant.branding,
          ...updates.branding
        };

        // Validar colores si se proporcionan
        if (updates.branding.colors) {
          updateData.branding.colors = {
            ...tenant.branding?.colors,
            ...updates.branding.colors
          };
        }

        // Validar fuentes si se proporcionan
        if (updates.branding.fonts) {
          updateData.branding.fonts = {
            ...tenant.branding?.fonts,
            ...updates.branding.fonts
          };
        }
      }

      // Actualizar información de contacto
      if (updates.contact) {
        updateData.contactInfo = {
          ...tenant.contactInfo,
          ...updates.contact
        };

        // Manejar redes sociales por separado
        if (updates.contact.socialMedia) {
          updateData.contactInfo.socialMedia = {
            ...tenant.contactInfo?.socialMedia,
            ...updates.contact.socialMedia
          };
        }
      }

      // Actualizar configuraciones
      if (updates.settings) {
        updateData.settings = {
          ...tenant.settings,
          ...updates.settings
        };
      }

      // Actualizar logo URL si se proporciona
      if (updates.logoUrl) {
        updateData.logoUrl = updates.logoUrl;
      }

      // Actualizar tenant
      await tenant.update(updateData);

      // Limpiar cache
      await this.clearBrandingCache(tenantId);

      logger.info('Configuración de branding actualizada', {
        tenantId,
        updatedBy: updatedBy.id,
        sections: Object.keys(updates)
      });

      return await this.getBrandingConfig(tenantId);
    } catch (error) {
      logger.error('Error actualizando configuración de branding:', error);
      throw error;
    }
  }

  // Generar CSS personalizado para el tenant
  static async generateCustomCSS(tenantId) {
    try {
      const config = await this.getBrandingConfig(tenantId);
      const { colors, fonts, customCss } = config.branding;

      const css = `
        :root {
          --primary-color: ${colors.primary};
          --secondary-color: ${colors.secondary};
          --accent-color: ${colors.accent};
          --background-color: ${colors.background};
          --text-color: ${colors.text};
          --primary-font: ${fonts.primary};
          --secondary-font: ${fonts.secondary};
        }

        .btn-primary {
          background-color: var(--primary-color);
          border-color: var(--primary-color);
        }

        .btn-primary:hover {
          background-color: color-mix(in srgb, var(--primary-color) 85%, black);
          border-color: color-mix(in srgb, var(--primary-color) 85%, black);
        }

        .btn-secondary {
          background-color: var(--secondary-color);
          border-color: var(--secondary-color);
        }

        .btn-secondary:hover {
          background-color: color-mix(in srgb, var(--secondary-color) 85%, black);
          border-color: color-mix(in srgb, var(--secondary-color) 85%, black);
        }

        .text-primary {
          color: var(--primary-color) !important;
        }

        .text-secondary {
          color: var(--secondary-color) !important;
        }

        .bg-primary {
          background-color: var(--primary-color) !important;
        }

        .bg-secondary {
          background-color: var(--secondary-color) !important;
        }

        .border-primary {
          border-color: var(--primary-color) !important;
        }

        body {
          font-family: var(--primary-font);
          background-color: var(--background-color);
          color: var(--text-color);
        }

        h1, h2, h3, h4, h5, h6 {
          font-family: var(--secondary-font);
        }

        ${customCss || ''}
      `;

      return css.trim();
    } catch (error) {
      logger.error('Error generando CSS personalizado:', error);
      throw error;
    }
  }

  // Obtener templates de mensajes personalizados
  static async getMessageTemplates(tenantId) {
    try {
      const cacheKey = `templates:${tenantId}`;
      let templates = await cache.get(cacheKey);

      if (!templates) {
        const config = await this.getBrandingConfig(tenantId);
        const tenantName = config.tenant.name;
        const contactInfo = config.contact;

        templates = {
          whatsapp: {
            welcome: `¡Hola! 👋 Bienvenido a ${tenantName}. Estamos aquí para ayudar a las familias de nuestra comunidad. ¿En qué podemos ayudarte?`,
            
            newCampaign: `🙏 ¡Hola {name}! ${tenantName} necesita tu ayuda esta semana:\n\n{needs}\n\n¿Puedes colaborar? Responde SÍ para donar. ¡Dios te bendiga! 🙏`,
            
            donationConfirmed: `¡Gracias {name}! 🙏 Tu donación de {items} está confirmada. Con tu ayuda alimentaremos a {families} familias. ${tenantName} te agradece infinitamente.`,
            
            reminder: `📅 Hola {name}! Recordatorio amigable: habíamos quedado en que donarías {items} esta semana. ¿Sigue en pie? ¡No hay problema si cambió algo! Bendiciones 🙏`,
            
            thankYou: `🙏 {name}, gracias por tu generoso corazón. Tu donación de {items} llegó perfectamente. Que Dios multiplique tu bendición. - ${tenantName}`,
            
            campaignComplete: `🎉 ¡Increíble! Gracias a donantes como tú, completamos la meta de esta semana. {families} familias recibirán sus mercados. ¡Dios los bendiga! - ${tenantName}`
          },
          
          email: {
            welcome: {
              subject: `Bienvenido a ${tenantName} - Pan Compartido`,
              body: `Estimado/a {name},\n\nBienvenido a la familia de ${tenantName}. Juntos podemos hacer la diferencia en nuestra comunidad.\n\nContacto: ${contactInfo.phone}\nEmail: ${contactInfo.email}\n\nBendiciones,\nEquipo ${tenantName}`
            },
            
            donationReceipt: {
              subject: `Confirmación de Donación - ${tenantName}`,
              body: `Estimado/a {name},\n\nConfirmamos la recepción de tu donación:\n{items}\n\nFecha: {date}\nValor estimado: {value}\n\nGracias por tu generosidad.\n\nBendiciones,\n${tenantName}`
            },
            
            campaignUpdate: {
              subject: `Actualización de Campaña - ${tenantName}`,
              body: `Estimado/a {name},\n\nTe contamos cómo va nuestra campaña:\n\nProgreso: {progress}%\nFamilias ayudadas: {families}\nDonaciones recibidas: {donations}\n\n¡Gracias por ser parte de esta misión!\n\nBendiciones,\n${tenantName}`
            }
          },
          
          social: {
            facebook: {
              newCampaign: `🏛️ ${tenantName} necesita tu ayuda:\n\n{needs}\n\n¡Únete a nuestra misión de alimentar a las familias necesitadas! 💝\n\n#PanCompartido #${tenantName.replace(/\s+/g, '')} #Solidaridad`,
              
              progress: `📊 ¡Vamos muy bien! Gracias a nuestros donantes:\n\n✅ {progress}% de la meta alcanzada\n👨‍👩‍👧‍👦 {families} familias serán ayudadas\n🙏 {donors} personas han donado\n\n¡Sigamos juntos! #PanCompartido`,
              
              completed: `🎉 ¡META ALCANZADA! Gracias a todos los que donaron:\n\n👨‍👩‍👧‍👦 {families} familias recibirán sus mercados\n💝 {totalDonations} donaciones recibidas\n\n¡Dios los bendiga! #PanCompartido #Logrado`
            },
            
            instagram: {
              story: `${tenantName} 🏛️\n\n{needs}\n\n¡Ayúdanos! 💝\n\n#PanCompartido`,
              post: `🙏 Juntos podemos más. ${tenantName} necesita:\n\n{needs}\n\n¡Tu donación hace la diferencia! 💝\n\n#PanCompartido #Solidaridad #ComunidadUnida`
            }
          }
        };

        // Guardar en cache por 4 horas
        await cache.set(cacheKey, templates, 14400);
      }

      return templates;
    } catch (error) {
      logger.error('Error obteniendo templates de mensajes:', error);
      throw error;
    }
  }

  // Personalizar template de mensaje
  static async customizeMessageTemplate(tenantId, platform, templateType, content, updatedBy) {
    try {
      // Obtener templates actuales
      const templates = await this.getMessageTemplates(tenantId);
      
      // Actualizar el template específico
      if (!templates[platform]) {
        templates[platform] = {};
      }
      
      templates[platform][templateType] = content;

      // Guardar en base de datos (en el campo branding del tenant)
      const tenant = await TenantService.getTenant(tenantId);
      const updatedBranding = {
        ...tenant.branding,
        messageTemplates: {
          ...tenant.branding?.messageTemplates,
          [platform]: {
            ...tenant.branding?.messageTemplates?.[platform],
            [templateType]: content
          }
        }
      };

      await tenant.update({ branding: updatedBranding });

      // Limpiar cache
      await cache.del(`templates:${tenantId}`);

      logger.info('Template de mensaje personalizado', {
        tenantId,
        platform,
        templateType,
        updatedBy: updatedBy.id
      });

      return await this.getMessageTemplates(tenantId);
    } catch (error) {
      logger.error('Error personalizando template de mensaje:', error);
      throw error;
    }
  }

  // Validar configuración de branding
  static validateBrandingConfig(config) {
    const errors = [];

    // Validar colores
    if (config.branding?.colors) {
      const colorRegex = /^#[0-9A-Fa-f]{6}$/;
      const colors = config.branding.colors;
      
      Object.keys(colors).forEach(colorKey => {
        if (colors[colorKey] && !colorRegex.test(colors[colorKey])) {
          errors.push(`Color ${colorKey} debe ser un código hexadecimal válido`);
        }
      });
    }

    // Validar URLs
    if (config.logoUrl) {
      try {
        new URL(config.logoUrl);
      } catch {
        errors.push('La URL del logo no es válida');
      }
    }

    // Validar email
    if (config.contact?.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(config.contact.email)) {
        errors.push('El email de contacto no es válido');
      }
    }

    // Validar teléfono
    if (config.contact?.phone) {
      const phoneRegex = /^[0-9\-\+\(\)\s]+$/;
      if (!phoneRegex.test(config.contact.phone)) {
        errors.push('El teléfono de contacto no es válido');
      }
    }

    return errors;
  }

  // Limpiar cache de branding
  static async clearBrandingCache(tenantId) {
    try {
      const cacheKeys = [
        `branding:${tenantId}`,
        `templates:${tenantId}`,
        `css:${tenantId}`
      ];

      await Promise.all(cacheKeys.map(key => cache.del(key)));
      
      logger.info('Cache de branding limpiado', { tenantId });
    } catch (error) {
      logger.error('Error limpiando cache de branding:', error);
    }
  }

  // Obtener configuración pública (sin datos sensibles)
  static async getPublicBrandingConfig(tenantId) {
    try {
      const config = await this.getBrandingConfig(tenantId);
      
      // Retornar solo información pública
      return {
        tenant: config.tenant,
        branding: {
          logo: config.branding.logo,
          colors: config.branding.colors,
          fonts: config.branding.fonts
        },
        contact: {
          phone: config.contact.phone,
          email: config.contact.email,
          address: config.contact.address,
          website: config.contact.website,
          socialMedia: config.contact.socialMedia
        }
      };
    } catch (error) {
      logger.error('Error obteniendo configuración pública de branding:', error);
      throw error;
    }
  }
}

module.exports = BrandingService;