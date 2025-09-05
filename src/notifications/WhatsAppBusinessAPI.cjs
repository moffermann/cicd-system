const { request } = require('undici');
const Logger = require('../utils/Logger.cjs');
const logger = new Logger('WhatsApp');
require('dotenv').config();

class WhatsAppBusinessAPI {
  constructor(config = {}) {
    this.accessToken = config.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
    this.phoneNumberId = config.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.businessAccountId = config.businessAccountId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    this.apiVersion = config.apiVersion || process.env.WHATSAPP_API_VERSION || 'v21.0';
    this.baseUrl = config.baseUrl || process.env.WHATSAPP_BASE_URL || 'https://graph.facebook.com';
    
    if (!this.accessToken) {
      throw new Error('WhatsApp Access Token is required');
    }
    if (!this.phoneNumberId) {
      throw new Error('WhatsApp Phone Number ID is required');
    }
  }

  /**
   * Build the API URL for a specific endpoint
   */
  buildApiUrl(endpoint) {
    return `${this.baseUrl}/${this.apiVersion}/${endpoint}`;
  }

  /**
   * Make authenticated request to WhatsApp Business API
   */
  async makeRequest(endpoint, method = 'GET', body = null) {
    const url = this.buildApiUrl(endpoint);
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await request(url, options);
      const data = await response.body.json();
      
      if (response.statusCode >= 400) {
        logger.error({ 
          statusCode: response.statusCode, 
          error: data,
          endpoint,
          method 
        }, 'WhatsApp API request failed');
        throw new Error(`WhatsApp API Error: ${data.error?.message || 'Unknown error'}`);
      }

      return data;
    } catch (error) {
      logger.error({ 
        error: error.message,
        endpoint,
        method 
      }, 'WhatsApp API request exception');
      throw error;
    }
  }

  /**
   * Send a text message
   */
  async sendMessage(to, message, options = {}) {
    // Clean phone number (remove WhatsApp suffix if present)
    const phoneNumber = to.replace('@c.us', '').replace('+', '');
    
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'text',
      text: {
        body: message
      }
    };

    // Add preview_url if message contains URLs
    if (message.includes('http://') || message.includes('https://')) {
      payload.text.preview_url = options.preview_url !== false;
    }

    try {
      const response = await this.makeRequest(`${this.phoneNumberId}/messages`, 'POST', payload);
      
      logger.debug({ 
        to: phoneNumber,
        messageId: response.messages?.[0]?.id,
        message: message.substring(0, 100) + (message.length > 100 ? '...' : '')
      }, 'WhatsApp message sent successfully');
      
      return {
        success: true,
        messageId: response.messages?.[0]?.id,
        status: response.messages?.[0]?.status
      };
    } catch (error) {
      logger.error({ 
        to: phoneNumber,
        error: error.message,
        message: message.substring(0, 100) + (message.length > 100 ? '...' : '')
      }, 'Failed to send WhatsApp message');
      throw error;
    }
  }

  /**
   * Send a template message
   */
  async sendTemplate(to, templateName, language = 'es', parameters = []) {
    const phoneNumber = to.replace('@c.us', '').replace('+', '');
    
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: language
        }
      }
    };

    if (parameters.length > 0) {
      payload.template.components = [{
        type: 'body',
        parameters: parameters.map(param => ({
          type: 'text',
          text: param
        }))
      }];
    }

    try {
      const response = await this.makeRequest(`${this.phoneNumberId}/messages`, 'POST', payload);
      
      logger.debug({ 
        to: phoneNumber,
        templateName,
        messageId: response.messages?.[0]?.id
      }, 'WhatsApp template sent successfully');
      
      return {
        success: true,
        messageId: response.messages?.[0]?.id,
        status: response.messages?.[0]?.status
      };
    } catch (error) {
      logger.error({ 
        to: phoneNumber,
        templateName,
        error: error.message
      }, 'Failed to send WhatsApp template');
      throw error;
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId) {
    const payload = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId
    };

    try {
      const response = await this.makeRequest(`${this.phoneNumberId}/messages`, 'POST', payload);
      
      logger.debug({ messageId }, 'Message marked as read');
      return response;
    } catch (error) {
      logger.error({ 
        messageId,
        error: error.message
      }, 'Failed to mark message as read');
      throw error;
    }
  }

  /**
   * Get business profile information
   */
  async getBusinessProfile() {
    try {
      const response = await this.makeRequest(`${this.phoneNumberId}?fields=verified_name,display_phone_number,quality_rating`);
      return response;
    } catch (error) {
      logger.error({ error: error.message }, 'Failed to get business profile');
      throw error;
    }
  }
}

module.exports = WhatsAppBusinessAPI;