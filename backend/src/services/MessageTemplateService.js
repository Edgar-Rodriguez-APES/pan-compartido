const { cache } = require('../config/redis');
const { createTenantQuery } = require('../utils/tenantQuery');
const logger = require('../utils/logger');

class MessageTemplateService {
  // Templates por defecto del sistema
  static getDefaultTemplates() {
    return {
      // Templates de WhatsApp
      whatsapp: {
        welcome: {
          name: 'Mensaje de Bienvenida',
          content: '¡Hola {{name}}! 👋 Bienvenido a {{parish_name}}. Ahora puedes recibir información sobre nuestras necesidades y contribuir fácilmente. ¿Te gustaría saber cómo ayudar?',
          variables: ['name', 'parish_name'],
          category: 'onboarding'
        },
        campaign_new: {
          name: 'Nueva Campaña',
          content: '🙏 ¡Hola {{name}}! Tu parroquia {{parish_name}} necesita tu ayuda esta semana:\n\n{{campaign_needs}}\n\n¿Puedes colaborar? Responde SÍ para donar o VER para más detalles.',
          variables: ['name', 'parish_name', 'campaign_needs'],
          category: 'campaigns'
        },
        donation_confirmed: {
          name: 'Donación Confirmada',
          content: '¡Gracias {{name}}! 🙏 Tu donación de {{items}} está confirmada. Con tu ayuda alimentaremos a {{families}} familias. ¡Dios te bendiga!',
          variables: ['name', 'items', 'families'],
          category: 'donations'
        },
        campaign_goal_reached: {
          name: 'Meta Alcanzada',
          content: '🎉 ¡Increíble {{name}}! Gracias a tu generosidad y la de otros feligreses, hemos alcanzado la meta de {{campaign_title}}. ¡Juntos alimentaremos a {{families}} familias!',
          variables: ['name', 'campaign_title', 'families'],
          category: 'campaigns'
        },
        reminder_gentle: {
          name: 'Recordatorio Suave',
          content: 'Hola {{name}} 😊 Solo un recordatorio amigable: nuestra campaña {{campaign_title}} aún necesita tu apoyo. Cada contribución cuenta. ¿Puedes ayudarnos?',
          variables: ['name', 'campaign_title'],
          category: 'reminders'
        },
        payment_failed: {
          name: 'Pago Fallido',
          content: 'Hola {{name}}, hubo un problema procesando tu donación de {{amount}}. Por favor intenta de nuevo o contacta con nosotros. Tu generosidad es muy importante. 🙏',
          variables: ['name', 'amount'],
          category: 'payments'
        }
      },
      
      // Templates de Email
      email: {
        welcome: {
          name: 'Email de Bienvenida',
          subject: 'Bienvenido a {{parish_name}} - Pan Compartido',
          content: `
            <h1>¡Bienvenido {{name}}!</h1>
            <p>Nos alegra tenerte como parte de la comunidad de <strong>{{parish_name}}</strong>.</p>
            <p>A través de esta plataforma podrás:</p>
            <ul>
              <li>Ver las necesidades actuales de nuestra comunidad</li>
              <li>Hacer donaciones de manera fácil y segura</li>
              <li>Comprar productos para tu familia a precios mayoristas</li>
              <li>Recibir actualizaciones sobre el impacto de tu generosidad</li>
            </ul>
            <p>¡Gracias por ser parte de esta misión de amor y servicio!</p>
            <p>Con bendiciones,<br>Equipo de {{parish_name}}</p>
          `,
          variables: ['name', 'parish_name'],
          category: 'onboarding'
        },
        donation_receipt: {
          name: 'Recibo de Donación',
          subject: 'Recibo de tu donación - {{parish_name}}',
          content: `
            <h1>Recibo de Donación</h1>
            <p>Estimado/a {{name}},</p>
            <p>Gracias por tu generosa donación a {{parish_name}}.</p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Detalles de la Donación</h3>
              <p><strong>Fecha:</strong> {{date}}</p>
              <p><strong>Monto:</strong> ${{amount}}</p>
              <p><strong>Campaña:</strong> {{campaign_title}}</p>
              <p><strong>Productos:</strong> {{items}}</p>
              <p><strong>ID de Transacción:</strong> {{transaction_id}}</p>
            </div>
            
            <p>Tu donación ayudará a alimentar a familias necesitadas en nuestra comunidad.</p>
            <p>¡Que Dios bendiga tu generosidad!</p>
          `,
          variables: ['name', 'parish_name', 'date', 'amount', 'campaign_title', 'items', 'transaction_id'],
          category: 'donations'
        },
        monthly_report: {
          name: 'Reporte Mensual',
          subject: 'Tu impacto en {{parish_name}} - {{month}} {{year}}',
          content: `
            <h1>Tu Impacto en {{month}} {{year}}</h1>
            <p>Querido/a {{name}},</p>
            <p>Queremos compartir contigo el increíble impacto que has tenido en nuestra comunidad:</p>
            
            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Tus Contribuciones</h3>
              <p><strong>Donaciones realizadas:</strong> {{donations_count}}</p>
              <p><strong>Monto total donado:</strong> ${{total_donated}}</p>
              <p><strong>Familias ayudadas:</strong> {{families_helped}}</p>
            </div>
            
            <div style="background: #f3e5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Impacto Comunitario</h3>
              <p><strong>Total de mercados entregados:</strong> {{total_markets}}</p>
              <p><strong>Familias beneficiadas:</strong> {{total_families}}</p>
              <p><strong>Productos más donados:</strong> {{top_products}}</p>
            </div>
            
            <p>¡Gracias por ser parte de esta hermosa misión!</p>
          `,
          variables: ['name', 'parish_name', 'month', 'year', 'donations_count', 'total_donated', 'families_helped', 'total_markets', 'total_families', 'top_products'],
          category: 'reports'
        }
      },
      
      // Templates de Notificaciones Push
      push: {
        campaign_new: {
          name: 'Nueva Campaña (Push)',
          title: 'Nueva campaña en {{parish_name}}',
          body: 'Tu parroquia necesita tu ayuda. ¡Descubre cómo puedes contribuir!',
          variables: ['parish_name'],
          category: 'campaigns'
        },
        donation_confirmed: {
          name: 'Donación Confirmada (Push)',
          title: '¡Donación confirmada!',
          body: 'Gracias {{name}}, tu donación ayudará a {{families}} familias',
          variables: ['name', 'families'],
          category: 'donations'
        },
        goal_reached: {
          name: 'Meta Alcanzada (Push)',
          title: '🎉 ¡Meta alcanzada!',
          body: 'Gracias a tu generosidad, hemos completado {{campaign_title}}',
          variables: ['campaign_title'],
          category: 'campaigns'
        }
      }
    };
  }

  // Obtener templates para un tenant
  static async getTemplates(tenantId, category = null) {
    try {
      const cacheKey = `templates:${tenantId}${category ? `:${category}` : ''}`;
      let templates = await cache.get(cacheKey);

      if (!templates) {
        const tenantQuery = createTenantQuery(tenantId);
        
        // Obtener templates personalizados del tenant
        let customTemplates = {};
        const customTemplateRecords = await tenantQuery.table('message_templates')
          .select('*')
          .where(category ? { category } : {});

        // Organizar templates personalizados por canal y clave
        customTemplateRecords.forEach(template => {
          if (!customTemplates[template.channel]) {
            customTemplates[template.channel] = {};
          }
          customTemplates[template.channel][template.template_key] = {
            name: template.name,
            content: template.content,
            subject: template.subject,
            title: template.title,
            body: template.body,
            variables: template.variables || [],
            category: template.category,
            isCustom: true,
            id: template.id,
            updatedAt: template.updated_at
          };
        });

        // Combinar templates por defecto con personalizados
        const defaultTemplates = this.getDefaultTemplates();
        templates = this.mergeTemplates(defaultTemplates, customTemplates);

        // Filtrar por categoría si se especifica
        if (category) {
          templates = this.filterTemplatesByCategory(templates, category);
        }

        // Guardar en cache por 30 minutos
        await cache.set(cacheKey, templates, 1800);
      }

      return templates;
    } catch (error) {
      logger.error('Error obteniendo templates:', error);
      throw error;
    }
  }

  // Obtener un template específico
  static async getTemplate(tenantId, channel, templateKey) {
    try {
      const templates = await this.getTemplates(tenantId);
      
      if (!templates[channel] || !templates[channel][templateKey]) {
        throw new Error('TEMPLATE_NOT_FOUND');
      }

      return templates[channel][templateKey];
    } catch (error) {
      logger.error('Error obteniendo template específico:', error);
      throw error;
    }
  }

  // Obtener template de notificación (para compatibilidad con NotificationService)
  static async getNotificationTemplate(tenantId, type) {
    try {
      const db = require('../config/database');
      
      // Try to get custom template from database
      const template = await db('notification_templates')
        .where({
          tenant_id: tenantId,
          type: type,
          active: true
        })
        .first();

      if (template) {
        return {
          type: template.type,
          content: template.content,
          variables: JSON.parse(template.variables || '[]')
        };
      }

      // Fallback to WhatsApp templates if not found in notification_templates
      try {
        const whatsappTemplate = await this.getTemplate(tenantId, 'whatsapp', type);
        return {
          type: type,
          content: whatsappTemplate.content,
          variables: whatsappTemplate.variables || []
        };
      } catch (whatsappError) {
        // Return default template if nothing found
        return {
          type: type,
          content: `Notificación de {{parish_name}}: {{message}}`,
          variables: ['parish_name', 'message']
        };
      }

    } catch (error) {
      logger.error('Error getting notification template:', error);
      throw error;
    }
  }

  // Crear o actualizar template personalizado
  static async saveTemplate(tenantId, templateData, updatedBy) {
    try {
      const tenantQuery = createTenantQuery(tenantId);

      // Validar datos del template
      const validatedData = this.validateTemplateData(templateData);

      let template;
      if (validatedData.id) {
        // Actualizar template existente
        const [updatedTemplate] = await tenantQuery.update('message_templates', 
          {
            name: validatedData.name,
            content: validatedData.content,
            subject: validatedData.subject,
            title: validatedData.title,
            body: validatedData.body,
            variables: validatedData.variables,
            updated_at: new Date()
          },
          { id: validatedData.id }
        ).returning('*');
        
        template = updatedTemplate;
      } else {
        // Crear nuevo template
        const [newTemplate] = await tenantQuery.insert('message_templates', {
          channel: validatedData.channel,
          template_key: validatedData.templateKey,
          name: validatedData.name,
          content: validatedData.content,
          subject: validatedData.subject,
          title: validatedData.title,
          body: validatedData.body,
          variables: validatedData.variables,
          category: validatedData.category
        }).returning('*');
        
        template = newTemplate;
      }

      // Limpiar cache
      await this.clearTemplateCache(tenantId);

      logger.info('Template guardado', {
        tenantId,
        templateId: template.id,
        channel: validatedData.channel,
        templateKey: validatedData.templateKey,
        updatedBy: updatedBy?.id
      });

      return template;
    } catch (error) {
      logger.error('Error guardando template:', error);
      throw error;
    }
  }

  // Renderizar template con variables
  static renderTemplate(template, variables = {}) {
    try {
      let rendered = {
        content: template.content || '',
        subject: template.subject || '',
        title: template.title || '',
        body: template.body || ''
      };

      // Reemplazar variables en todos los campos
      Object.keys(rendered).forEach(field => {
        if (rendered[field]) {
          rendered[field] = this.replaceVariables(rendered[field], variables);
        }
      });

      return rendered;
    } catch (error) {
      logger.error('Error renderizando template:', error);
      throw error;
    }
  }

  // Reemplazar variables en texto
  static replaceVariables(text, variables) {
    return text.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
      return variables[variable] !== undefined ? variables[variable] : match;
    });
  }

  // Validar datos de template
  static validateTemplateData(data) {
    const required = ['channel', 'templateKey', 'name', 'category'];
    
    for (const field of required) {
      if (!data[field]) {
        throw new Error(`MISSING_FIELD: ${field}`);
      }
    }

    // Validar canal
    const validChannels = ['whatsapp', 'email', 'push'];
    if (!validChannels.includes(data.channel)) {
      throw new Error('INVALID_CHANNEL');
    }

    // Validar que tenga al menos un campo de contenido
    if (!data.content && !data.subject && !data.title && !data.body) {
      throw new Error('MISSING_CONTENT');
    }

    // Extraer variables del contenido
    const variables = this.extractVariables(data);

    return {
      ...data,
      variables
    };
  }

  // Extraer variables de un template
  static extractVariables(templateData) {
    const variableRegex = /\{\{(\w+)\}\}/g;
    const variables = new Set();

    // Buscar variables en todos los campos de contenido
    const contentFields = ['content', 'subject', 'title', 'body'];
    
    contentFields.forEach(field => {
      if (templateData[field]) {
        let match;
        while ((match = variableRegex.exec(templateData[field])) !== null) {
          variables.add(match[1]);
        }
      }
    });

    return Array.from(variables);
  }

  // Combinar templates por defecto con personalizados
  static mergeTemplates(defaultTemplates, customTemplates) {
    const merged = JSON.parse(JSON.stringify(defaultTemplates)); // Deep clone

    Object.keys(customTemplates).forEach(channel => {
      if (!merged[channel]) {
        merged[channel] = {};
      }
      
      Object.keys(customTemplates[channel]).forEach(templateKey => {
        merged[channel][templateKey] = customTemplates[channel][templateKey];
      });
    });

    return merged;
  }

  // Filtrar templates por categoría
  static filterTemplatesByCategory(templates, category) {
    const filtered = {};

    Object.keys(templates).forEach(channel => {
      filtered[channel] = {};
      
      Object.keys(templates[channel]).forEach(templateKey => {
        if (templates[channel][templateKey].category === category) {
          filtered[channel][templateKey] = templates[channel][templateKey];
        }
      });
    });

    return filtered;
  }

  // Eliminar template personalizado
  static async deleteTemplate(tenantId, templateId, deletedBy) {
    try {
      const tenantQuery = createTenantQuery(tenantId);

      // Verificar que el template existe y pertenece al tenant
      const template = await tenantQuery.findById('message_templates', templateId);
      
      if (!template) {
        throw new Error('TEMPLATE_NOT_FOUND');
      }

      // Eliminar template
      await tenantQuery.delete('message_templates', { id: templateId });

      // Limpiar cache
      await this.clearTemplateCache(tenantId);

      logger.info('Template eliminado', {
        tenantId,
        templateId,
        deletedBy: deletedBy?.id
      });

      return true;
    } catch (error) {
      logger.error('Error eliminando template:', error);
      throw error;
    }
  }

  // Limpiar cache de templates
  static async clearTemplateCache(tenantId) {
    try {
      const cacheKeys = [
        `templates:${tenantId}`,
        `templates:${tenantId}:*`
      ];

      // Obtener todas las claves que coincidan con el patrón
      const keys = await cache.keys(`templates:${tenantId}*`);
      
      if (keys.length > 0) {
        await Promise.all(keys.map(key => cache.del(key)));
      }

      logger.info('Cache de templates limpiado', { tenantId });
    } catch (error) {
      logger.error('Error limpiando cache de templates:', error);
    }
  }

  // Obtener estadísticas de uso de templates
  static async getTemplateStats(tenantId) {
    try {
      const tenantQuery = createTenantQuery(tenantId);

      const stats = await tenantQuery.table('message_templates')
        .select('channel', 'category')
        .count('* as count')
        .groupBy('channel', 'category');

      const organized = {
        total: 0,
        byChannel: {},
        byCategory: {}
      };

      stats.forEach(stat => {
        const count = parseInt(stat.count);
        organized.total += count;

        if (!organized.byChannel[stat.channel]) {
          organized.byChannel[stat.channel] = 0;
        }
        organized.byChannel[stat.channel] += count;

        if (!organized.byCategory[stat.category]) {
          organized.byCategory[stat.category] = 0;
        }
        organized.byCategory[stat.category] += count;
      });

      return organized;
    } catch (error) {
      logger.error('Error obteniendo estadísticas de templates:', error);
      throw error;
    }
  }
}

module.exports = MessageTemplateService;