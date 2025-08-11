const axios = require('axios');
const logger = require('../utils/logger');

class WhatsAppService {
  constructor() {
    this.baseUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.webhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    
    // Bot conversation states
    this.conversationStates = new Map();
    
    // Bot flows
    this.flows = {
      MAIN_MENU: 'main_menu',
      DONATION_FLOW: 'donation_flow',
      CAMPAIGN_INFO: 'campaign_info',
      HELP: 'help',
      CONTACT: 'contact'
    };
  }

  /**
   * Send a text message
   */
  async sendMessage(to, message, tenantId) {
    try {
      const data = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: {
          body: message
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        data,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('WhatsApp message sent:', {
        to,
        messageId: response.data.messages[0].id,
        tenantId
      });

      return response.data;

    } catch (error) {
      logger.error('Error sending WhatsApp message:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send an interactive button message
   */
  async sendButtonMessage(to, text, buttons, tenantId) {
    try {
      const data = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: text
          },
          action: {
            buttons: buttons.map((button, index) => ({
              type: 'reply',
              reply: {
                id: button.id || `btn_${index}`,
                title: button.title
              }
            }))
          }
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        data,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('WhatsApp button message sent:', {
        to,
        messageId: response.data.messages[0].id,
        tenantId
      });

      return response.data;

    } catch (error) {
      logger.error('Error sending WhatsApp button message:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send a list message
   */
  async sendListMessage(to, text, buttonText, sections, tenantId) {
    try {
      const data = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: {
            text: text
          },
          action: {
            button: buttonText,
            sections: sections
          }
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        data,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('WhatsApp list message sent:', {
        to,
        messageId: response.data.messages[0].id,
        tenantId
      });

      return response.data;

    } catch (error) {
      logger.error('Error sending WhatsApp list message:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Process incoming webhook
   */
  async processWebhook(webhookData) {
    try {
      const { entry } = webhookData;
      
      if (!entry || entry.length === 0) {
        return { processed: false, reason: 'No entry data' };
      }

      for (const entryItem of entry) {
        const { changes } = entryItem;
        
        if (!changes || changes.length === 0) continue;

        for (const change of changes) {
          if (change.field === 'messages') {
            await this.processMessage(change.value);
          }
        }
      }

      return { processed: true };

    } catch (error) {
      logger.error('Error processing WhatsApp webhook:', error);
      throw error;
    }
  }

  /**
   * Process individual message
   */
  async processMessage(messageData) {
    try {
      const { messages, contacts } = messageData;
      
      if (!messages || messages.length === 0) return;

      for (const message of messages) {
        const { from, type, text, interactive } = message;
        const contact = contacts?.find(c => c.wa_id === from);
        
        // Get tenant from phone number (you'd implement this logic)
        const tenantId = await this.getTenantFromPhoneNumber(from);
        
        if (!tenantId) {
          await this.sendMessage(from, 'Lo siento, no pude identificar tu parroquia. Por favor contacta al administrador.', null);
          continue;
        }

        // Process different message types
        let messageText = '';
        let buttonId = null;

        if (type === 'text') {
          messageText = text.body.toLowerCase().trim();
        } else if (type === 'interactive') {
          if (interactive.type === 'button_reply') {
            buttonId = interactive.button_reply.id;
            messageText = interactive.button_reply.title.toLowerCase();
          } else if (interactive.type === 'list_reply') {
            buttonId = interactive.list_reply.id;
            messageText = interactive.list_reply.title.toLowerCase();
          }
        }

        // Process the message through conversation flow
        await this.handleConversation(from, messageText, buttonId, tenantId, contact);
      }

    } catch (error) {
      logger.error('Error processing message:', error);
    }
  }

  /**
   * Handle conversation flow
   */
  async handleConversation(phoneNumber, message, buttonId, tenantId, contact) {
    try {
      // Get current conversation state
      const currentState = this.conversationStates.get(phoneNumber) || {
        flow: this.flows.MAIN_MENU,
        step: 0,
        data: {}
      };

      let response;

      // Handle different flows
      switch (currentState.flow) {
        case this.flows.MAIN_MENU:
          response = await this.handleMainMenu(phoneNumber, message, buttonId, tenantId, contact);
          break;
        case this.flows.DONATION_FLOW:
          response = await this.handleDonationFlow(phoneNumber, message, buttonId, tenantId, currentState);
          break;
        case this.flows.CAMPAIGN_INFO:
          response = await this.handleCampaignInfo(phoneNumber, message, buttonId, tenantId);
          break;
        case this.flows.HELP:
          response = await this.handleHelp(phoneNumber, message, buttonId, tenantId);
          break;
        case this.flows.CONTACT:
          response = await this.handleContact(phoneNumber, message, buttonId, tenantId);
          break;
        default:
          response = await this.handleMainMenu(phoneNumber, message, buttonId, tenantId, contact);
      }

      // Update conversation state if needed
      if (response.newState) {
        this.conversationStates.set(phoneNumber, response.newState);
      }

    } catch (error) {
      logger.error('Error handling conversation:', error);
      await this.sendMessage(phoneNumber, 'Lo siento, ocurrió un error. Por favor intenta de nuevo.', tenantId);
    }
  }

  /**
   * Handle main menu
   */
  async handleMainMenu(phoneNumber, message, buttonId, tenantId, contact) {
    try {
      // Get tenant info for personalized greeting
      const TenantService = require('./TenantService');
      const tenant = await TenantService.getTenantById(tenantId);
      
      const userName = contact?.profile?.name || 'Hermano/a';
      
      if (message === 'hola' || message === 'menu' || message === 'inicio' || !buttonId) {
        // Send welcome message with main menu
        const welcomeText = `¡Hola ${userName}! 👋\n\nBienvenido/a a *${tenant.name}*\n\n¿En qué puedo ayudarte hoy?`;
        
        const buttons = [
          { id: 'donate', title: '❤️ Hacer Donación' },
          { id: 'campaigns', title: '📋 Ver Campañas' },
          { id: 'help', title: '❓ Ayuda' }
        ];

        await this.sendButtonMessage(phoneNumber, welcomeText, buttons, tenantId);
        
        return { newState: { flow: this.flows.MAIN_MENU, step: 1, data: {} } };
      }

      // Handle button selections
      switch (buttonId) {
        case 'donate':
          return await this.startDonationFlow(phoneNumber, tenantId);
        case 'campaigns':
          return await this.showCampaigns(phoneNumber, tenantId);
        case 'help':
          return await this.showHelp(phoneNumber, tenantId);
        default:
          // Handle text-based commands
          if (message.includes('donar') || message.includes('donacion')) {
            return await this.startDonationFlow(phoneNumber, tenantId);
          } else if (message.includes('campaña') || message.includes('necesidad')) {
            return await this.showCampaigns(phoneNumber, tenantId);
          } else if (message.includes('ayuda') || message.includes('help')) {
            return await this.showHelp(phoneNumber, tenantId);
          } else {
            // Default response
            await this.sendMessage(
              phoneNumber, 
              'No entendí tu mensaje. Escribe *menu* para ver las opciones disponibles.', 
              tenantId
            );
            return { newState: null };
          }
      }

    } catch (error) {
      logger.error('Error in main menu:', error);
      throw error;
    }
  }

  /**
   * Start donation flow
   */
  async startDonationFlow(phoneNumber, tenantId) {
    try {
      // Get active campaigns
      const CampaignService = require('./CampaignService');
      const campaigns = await CampaignService.getActiveCampaigns(tenantId, { limit: 5 });

      if (campaigns.length === 0) {
        await this.sendMessage(
          phoneNumber,
          'En este momento no hay campañas activas. Te notificaremos cuando haya nuevas necesidades.',
          tenantId
        );
        return { newState: { flow: this.flows.MAIN_MENU, step: 0, data: {} } };
      }

      // Create campaign list
      const sections = [{
        title: 'Campañas Activas',
        rows: campaigns.map(campaign => ({
          id: `campaign_${campaign.id}`,
          title: campaign.title.substring(0, 24),
          description: `${Math.round(campaign.completionPercentage)}% completado`
        }))
      }];

      await this.sendListMessage(
        phoneNumber,
        '¡Gracias por tu generosidad! 🙏\n\nSelecciona la campaña a la que te gustaría donar:',
        'Ver Campañas',
        sections,
        tenantId
      );

      return { 
        newState: { 
          flow: this.flows.DONATION_FLOW, 
          step: 1, 
          data: { campaigns } 
        } 
      };

    } catch (error) {
      logger.error('Error starting donation flow:', error);
      throw error;
    }
  }

  /**
   * Handle donation flow
   */
  async handleDonationFlow(phoneNumber, message, buttonId, tenantId, currentState) {
    try {
      const { step, data } = currentState;

      switch (step) {
        case 1: // Campaign selection
          if (buttonId && buttonId.startsWith('campaign_')) {
            const campaignId = buttonId.replace('campaign_', '');
            const selectedCampaign = data.campaigns.find(c => c.id == campaignId);
            
            if (!selectedCampaign) {
              await this.sendMessage(phoneNumber, 'Campaña no encontrada. Por favor intenta de nuevo.', tenantId);
              return { newState: currentState };
            }

            // Show campaign details and donation options
            const campaignText = `*${selectedCampaign.title}*\n\n${selectedCampaign.description}\n\n📊 Progreso: ${Math.round(selectedCampaign.completionPercentage)}%\n💰 Meta: ${this.formatCurrency(selectedCampaign.targetAmount)}\n\n¿Cómo te gustaría donar?`;

            const buttons = [
              { id: 'donate_money', title: '💵 Donar Dinero' },
              { id: 'donate_products', title: '📦 Donar Productos' },
              { id: 'back_campaigns', title: '⬅️ Otras Campañas' }
            ];

            await this.sendButtonMessage(phoneNumber, campaignText, buttons, tenantId);

            return {
              newState: {
                flow: this.flows.DONATION_FLOW,
                step: 2,
                data: { ...data, selectedCampaign }
              }
            };
          }
          break;

        case 2: // Donation type selection
          if (buttonId === 'donate_money') {
            return await this.handleMoneyDonation(phoneNumber, tenantId, currentState);
          } else if (buttonId === 'donate_products') {
            return await this.handleProductDonation(phoneNumber, tenantId, currentState);
          } else if (buttonId === 'back_campaigns') {
            return await this.startDonationFlow(phoneNumber, tenantId);
          }
          break;

        case 3: // Amount/product selection
          return await this.processDonationDetails(phoneNumber, message, buttonId, tenantId, currentState);

        default:
          return await this.startDonationFlow(phoneNumber, tenantId);
      }

      return { newState: currentState };

    } catch (error) {
      logger.error('Error in donation flow:', error);
      throw error;
    }
  }

  /**
   * Handle money donation
   */
  async handleMoneyDonation(phoneNumber, tenantId, currentState) {
    try {
      const text = '💰 *Donación en Dinero*\n\nSelecciona el monto que deseas donar o escribe una cantidad personalizada:';
      
      const buttons = [
        { id: 'amount_10000', title: '$10,000' },
        { id: 'amount_25000', title: '$25,000' },
        { id: 'amount_50000', title: '$50,000' }
      ];

      await this.sendButtonMessage(phoneNumber, text, buttons, tenantId);

      return {
        newState: {
          ...currentState,
          step: 3,
          data: { ...currentState.data, donationType: 'money' }
        }
      };

    } catch (error) {
      logger.error('Error in money donation:', error);
      throw error;
    }
  }

  /**
   * Handle product donation
   */
  async handleProductDonation(phoneNumber, tenantId, currentState) {
    try {
      const { selectedCampaign } = currentState.data;
      
      // Get urgent needs for the campaign
      let text = '📦 *Donación de Productos*\n\n';
      
      if (selectedCampaign.urgentNeeds && selectedCampaign.urgentNeeds.length > 0) {
        text += '*Necesidades Urgentes:*\n';
        selectedCampaign.urgentNeeds.slice(0, 3).forEach(need => {
          text += `• ${need.productName}: ${need.remaining} ${need.unit}\n`;
        });
        text += '\n';
      }
      
      text += 'Escribe el nombre del producto que deseas donar y la cantidad.\n\n*Ejemplo:* "Arroz 5 kg" o "Aceite 2 litros"';

      await this.sendMessage(phoneNumber, text, tenantId);

      return {
        newState: {
          ...currentState,
          step: 3,
          data: { ...currentState.data, donationType: 'products' }
        }
      };

    } catch (error) {
      logger.error('Error in product donation:', error);
      throw error;
    }
  }

  /**
   * Process donation details
   */
  async processDonationDetails(phoneNumber, message, buttonId, tenantId, currentState) {
    try {
      const { donationType, selectedCampaign } = currentState.data;
      let amount = 0;
      let products = [];

      if (donationType === 'money') {
        // Handle money amount
        if (buttonId && buttonId.startsWith('amount_')) {
          amount = parseInt(buttonId.replace('amount_', ''));
        } else {
          // Parse custom amount from message
          const amountMatch = message.match(/(\d+)/);
          if (amountMatch) {
            amount = parseInt(amountMatch[1]);
          }
        }

        if (amount < 1000) {
          await this.sendMessage(phoneNumber, 'El monto mínimo de donación es $1,000. Por favor ingresa un monto válido.', tenantId);
          return { newState: currentState };
        }
      } else {
        // Handle product donation
        products = this.parseProductDonation(message);
        if (products.length === 0) {
          await this.sendMessage(phoneNumber, 'No pude entender los productos. Por favor usa el formato: "Producto cantidad unidad"\n\nEjemplo: "Arroz 5 kg"', tenantId);
          return { newState: currentState };
        }
      }

      // Generate donation link
      const donationLink = await this.generateDonationLink(tenantId, selectedCampaign.id, {
        type: donationType,
        amount,
        products,
        phoneNumber
      });

      let confirmationText = `✅ *Confirmación de Donación*\n\n`;
      confirmationText += `📋 Campaña: ${selectedCampaign.title}\n`;
      
      if (donationType === 'money') {
        confirmationText += `💰 Monto: ${this.formatCurrency(amount)}\n\n`;
      } else {
        confirmationText += `📦 Productos:\n`;
        products.forEach(product => {
          confirmationText += `• ${product.name}: ${product.quantity} ${product.unit}\n`;
        });
        confirmationText += '\n';
      }
      
      confirmationText += `Para completar tu donación, haz clic en el siguiente enlace:\n\n${donationLink}\n\n¡Gracias por tu generosidad! 🙏`;

      await this.sendMessage(phoneNumber, confirmationText, tenantId);

      // Reset conversation state
      return { newState: { flow: this.flows.MAIN_MENU, step: 0, data: {} } };

    } catch (error) {
      logger.error('Error processing donation details:', error);
      throw error;
    }
  }

  /**
   * Show campaigns
   */
  async showCampaigns(phoneNumber, tenantId) {
    try {
      const CampaignService = require('./CampaignService');
      const campaigns = await CampaignService.getActiveCampaigns(tenantId, { limit: 5 });

      if (campaigns.length === 0) {
        await this.sendMessage(phoneNumber, 'En este momento no hay campañas activas.', tenantId);
        return { newState: { flow: this.flows.MAIN_MENU, step: 0, data: {} } };
      }

      let text = '📋 *Campañas Activas*\n\n';
      campaigns.forEach((campaign, index) => {
        text += `${index + 1}. *${campaign.title}*\n`;
        text += `   📊 ${Math.round(campaign.completionPercentage)}% completado\n`;
        text += `   💰 ${this.formatCurrency(campaign.raisedAmount)} de ${this.formatCurrency(campaign.targetAmount)}\n\n`;
      });

      text += 'Escribe *donar* para hacer una donación o *menu* para volver al inicio.';

      await this.sendMessage(phoneNumber, text, tenantId);

      return { newState: { flow: this.flows.MAIN_MENU, step: 0, data: {} } };

    } catch (error) {
      logger.error('Error showing campaigns:', error);
      throw error;
    }
  }

  /**
   * Show help
   */
  async showHelp(phoneNumber, tenantId) {
    try {
      const helpText = `❓ *Ayuda - Pan Compartido*\n\n*Comandos disponibles:*\n\n• *menu* - Ver menú principal\n• *donar* - Hacer una donación\n• *campañas* - Ver campañas activas\n• *ayuda* - Ver esta ayuda\n\n*¿Cómo donar?*\n1. Escribe "donar"\n2. Selecciona una campaña\n3. Elige donar dinero o productos\n4. Sigue las instrucciones\n\n*¿Necesitas más ayuda?*\nEscribe *contacto* para hablar con un coordinador.`;

      await this.sendMessage(phoneNumber, helpText, tenantId);

      return { newState: { flow: this.flows.MAIN_MENU, step: 0, data: {} } };

    } catch (error) {
      logger.error('Error showing help:', error);
      throw error;
    }
  }

  /**
   * Parse product donation from text
   */
  parseProductDonation(text) {
    try {
      const products = [];
      
      // Simple parsing - can be enhanced with NLP
      const patterns = [
        /(\w+)\s+(\d+)\s*(\w+)/g, // "Arroz 5 kg"
        /(\d+)\s*(\w+)\s+de\s+(\w+)/g, // "5 kg de arroz"
      ];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          if (pattern === patterns[0]) {
            products.push({
              name: match[1],
              quantity: parseInt(match[2]),
              unit: match[3]
            });
          } else {
            products.push({
              name: match[3],
              quantity: parseInt(match[1]),
              unit: match[2]
            });
          }
        }
      }

      return products;

    } catch (error) {
      logger.error('Error parsing product donation:', error);
      return [];
    }
  }

  /**
   * Generate donation link
   */
  async generateDonationLink(tenantId, campaignId, donationData) {
    try {
      // Create a temporary donation record and return link
      const baseUrl = process.env.FRONTEND_URL || 'https://pancompartido.com';
      const donationId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store temporary donation data (you'd use Redis or database)
      // await this.storeTempDonation(donationId, donationData);

      return `${baseUrl}/donate/${campaignId}?ref=whatsapp&temp=${donationId}`;

    } catch (error) {
      logger.error('Error generating donation link:', error);
      return `${process.env.FRONTEND_URL || 'https://pancompartido.com'}/donate/${campaignId}`;
    }
  }

  /**
   * Get tenant from phone number
   */
  async getTenantFromPhoneNumber(phoneNumber) {
    try {
      // This would implement logic to determine which tenant/parish
      // the phone number belongs to. Could be based on:
      // 1. User registration data
      // 2. Geographic area codes
      // 3. Previous interactions
      // 4. Manual assignment
      
      // For now, return a default tenant ID
      // In production, you'd query the database
      return 'default-tenant-id';

    } catch (error) {
      logger.error('Error getting tenant from phone number:', error);
      return null;
    }
  }

  /**
   * Format currency
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Verify webhook
   */
  verifyWebhook(mode, token, challenge) {
    if (mode === 'subscribe' && token === this.webhookVerifyToken) {
      return challenge;
    }
    return null;
  }

  /**
   * Send broadcast message to multiple recipients
   */
  async sendBroadcast(recipients, message, tenantId) {
    try {
      const results = [];
      
      for (const recipient of recipients) {
        try {
          const result = await this.sendMessage(recipient, message, tenantId);
          results.push({ recipient, success: true, messageId: result.messages[0].id });
        } catch (error) {
          results.push({ recipient, success: false, error: error.message });
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      logger.info('Broadcast sent:', {
        tenantId,
        totalRecipients: recipients.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

      return results;

    } catch (error) {
      logger.error('Error sending broadcast:', error);
      throw error;
    }
  }

  /**
   * Get conversation analytics
   */
  async getConversationAnalytics(tenantId, period = '30d') {
    try {
      // This would query conversation logs from database
      // For now, return mock analytics
      
      return {
        totalConversations: 150,
        completedDonations: 45,
        conversionRate: 30,
        topCommands: [
          { command: 'donar', count: 89 },
          { command: 'campañas', count: 67 },
          { command: 'ayuda', count: 34 }
        ],
        peakHours: [
          { hour: 19, conversations: 23 },
          { hour: 20, conversations: 31 },
          { hour: 21, conversations: 28 }
        ]
      };

    } catch (error) {
      logger.error('Error getting conversation analytics:', error);
      throw error;
    }
  }
}

module.exports = new WhatsAppService();