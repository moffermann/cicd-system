#!/usr/bin/env node

/**
 * Notification Manager for CI/CD System
 * Handles deployment notifications via multiple channels
 */

const notifier = require('node-notifier');
const path = require('path');
const WhatsAppBusinessAPI = require('./WhatsAppBusinessAPI.cjs');

class NotificationManager {
  constructor() {
    this.notifications = {
      windows: process.env.ENABLE_WINDOWS_NOTIFICATIONS !== 'false',
      console: true,
      webhook: process.env.NOTIFICATION_WEBHOOK_URL || null,
      whatsapp: {
        enabled: !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER),
        phoneNumber: process.env.WHATSAPP_PHONE_NUMBER
      }
    };

    // Initialize WhatsApp Business API if enabled
    if (this.notifications.whatsapp.enabled) {
      try {
        this.whatsappAPI = new WhatsAppBusinessAPI();
        console.log('✅ WhatsApp Business API initialized');
      } catch (error) {
        console.error('❌ Failed to initialize WhatsApp Business API:', error.message);
        this.notifications.whatsapp.enabled = false;
      }
    }
  }

  /**
   * Send deployment started notification
   */
  async deploymentStarted(deployment) {
    const title = `🚀 Deployment Started`;
    const githubUrl = deployment.githubUrl || `https://github.com/${deployment.repo || 'owner/repo'}/commit/${deployment.commit}`;
    const logsUrl = deployment.logsUrl || `https://github.com/${deployment.repo || 'owner/repo'}/actions`;
    
    const message = `🚀 Starting deployment...\n\nProject: ${deployment.project}\nCommit: ${deployment.commit}\nBranch: ${deployment.branch}\n\n📋 FOLLOW PROGRESS:\n${logsUrl}\n\n🔗 Commit: ${githubUrl}`;
    
    await this.send({
      title,
      message,
      type: 'info',
      deployment: { ...deployment, githubUrl, logsUrl }
    });
  }

  /**
   * Send deployment success notification
   */
  async deploymentSuccess(deployment) {
    const title = `✅ Deployment Success`;
    const githubUrl = deployment.githubUrl || `https://github.com/${deployment.repo || 'owner/repo'}/commit/${deployment.commit}`;
    const productionUrl = deployment.productionUrl || process.env.PRODUCTION_URL;
    
    const message = `🎉 Deployed successfully in ${deployment.duration || 'N/A'}!\n\nProject: ${deployment.project}\nCommit: ${deployment.commit}\n\n🌐 VIEW LIVE SITE:\n${productionUrl}\n\n🔗 Commit: ${githubUrl}`;
    
    await this.send({
      title,
      message,
      type: 'success',
      deployment: { ...deployment, githubUrl, productionUrl }
    });
  }

  /**
   * Send deployment failure notification
   */
  async deploymentFailed(deployment) {
    const title = `❌ Deployment Failed`;
    const githubUrl = deployment.githubUrl || `https://github.com/${deployment.repo || 'owner/repo'}/commit/${deployment.commit}`;
    const logsUrl = deployment.logsUrl || `https://github.com/${deployment.repo || 'owner/repo'}/actions`;
    
    const message = `🚨 ${deployment.error || 'Unknown error'}\n\nProject: ${deployment.project}\nCommit: ${deployment.commit}\n\n📋 VIEW LOGS:\n${logsUrl}\n\n🔗 Commit: ${githubUrl}`;
    
    await this.send({
      title,
      message,
      type: 'error',
      deployment: { ...deployment, githubUrl, logsUrl }
    });
  }

  /**
   * Send deployment warning notification
   */
  async deploymentWarning(deployment) {
    const title = `⚠️ Deployment Warning`;
    const githubUrl = deployment.githubUrl || `https://github.com/${deployment.repo || 'owner/repo'}/commit/${deployment.commit}`;
    const logsUrl = deployment.logsUrl || `https://github.com/${deployment.repo || 'owner/repo'}/actions`;
    
    const message = `⚠️ ${deployment.warning || 'Warning detected'}\n\nProject: ${deployment.project}\nCommit: ${deployment.commit}\n\n📋 CHECK DETAILS:\n${logsUrl}\n\n🔗 Commit: ${githubUrl}`;
    
    await this.send({
      title,
      message,
      type: 'warning',
      deployment: { ...deployment, githubUrl, logsUrl }
    });
  }

  /**
   * Send notification via all configured channels
   */
  async send({ title, message, type, deployment }) {
    const promises = [];

    // Console notification (always enabled)
    if (this.notifications.console) {
      promises.push(this.sendConsole({ title, message, type }));
    }

    // Windows notification
    if (this.notifications.windows && process.platform === 'win32') {
      promises.push(this.sendWindows({ title, message, type, deployment }));
    }

    // Webhook notification
    if (this.notifications.webhook) {
      promises.push(this.sendWebhook({ title, message, type, deployment }));
    }

    // WhatsApp notification
    if (this.notifications.whatsapp.enabled) {
      promises.push(this.sendWhatsApp({ title, message, type, deployment }));
    }

    // Wait for all notifications to complete
    await Promise.allSettled(promises);
  }

  /**
   * Send console notification
   */
  async sendConsole({ title, message, type }) {
    try {
      const timestamp = new Date().toISOString();
      const emoji = this.getEmoji(type);
      
      console.log(`\n📢 ${emoji} ${title}`);
      console.log(`🕐 ${timestamp}`);
      console.log(`📝 ${message.replace(/\n/g, '\n   ')}\n`);
      
      return { success: true, channel: 'console' };
    } catch (error) {
      console.error('Console notification failed:', error);
      return { success: false, channel: 'console', error };
    }
  }

  /**
   * Send Windows notification
   */
  async sendWindows({ title, message, type, deployment }) {
    try {
      return new Promise((resolve) => {
        // Extraer URL principal para hacer clickeable
        const mainUrl = this.extractMainUrl(deployment, type);
        
        const notificationConfig = {
          title: title,
          message: message,
          icon: this.getIcon(type),
          sound: type === 'error' ? 'Pop' : 'Hero',
          timeout: 20, // Más tiempo para leer el link
          appID: 'CICD-System',
          // HIGH PRIORITY para superar modo concentración  
          urgency: 'critical',
          priority: 'high',
          category: 'device'
        };

        notifier.notify(notificationConfig, (err, response, metadata) => {
          if (err) {
            console.error('Windows notification failed:', err);
            resolve({ success: false, channel: 'windows', error: err });
          } else {
            resolve({ success: true, channel: 'windows', response, metadata });
          }
        });
      });
    } catch (error) {
      console.error('Windows notification failed:', error);
      return { success: false, channel: 'windows', error };
    }
  }

  /**
   * Send webhook notification
   */
  async sendWebhook({ title, message, type, deployment }) {
    try {
      const payload = {
        title,
        message,
        type,
        timestamp: new Date().toISOString(),
        deployment: {
          project: deployment?.project,
          commit: deployment?.commit,
          branch: deployment?.branch,
          status: deployment?.status,
          phase: deployment?.phase
        }
      };

      // In a real implementation, you would use fetch or axios to send to webhook
      console.log('📡 Webhook notification payload:', JSON.stringify(payload, null, 2));
      
      return { success: true, channel: 'webhook' };
    } catch (error) {
      console.error('Webhook notification failed:', error);
      return { success: false, channel: 'webhook', error };
    }
  }

  /**
   * Send WhatsApp notification with template using Business API
   */
  async sendWhatsApp({ title, message, type, deployment }) {
    try {
      if (!this.notifications.whatsapp.enabled || !this.whatsappAPI) {
        console.log('⚠️ WhatsApp notifications disabled (no token/phone configured)');
        return { success: false, channel: 'whatsapp', error: 'Not configured' };
      }

      const templateName = this.getWhatsAppTemplate(type);
      const templateParams = this.getWhatsAppTemplateParams(deployment, type);
      
      try {
        // Intentar primero con template
        const result = await this.whatsappAPI.sendTemplate(
          this.notifications.whatsapp.phoneNumber,
          templateName,
          'es', // language
          templateParams
        );

        console.log('📱 WhatsApp template message sent successfully:', result.messageId);
        return { success: true, channel: 'whatsapp', method: 'template', messageId: result.messageId };

      } catch (templateError) {
        console.log('⚠️ WhatsApp template failed, using fallback text message');
        
        // Fallback a mensaje de texto
        const fallbackMessage = `${title}\n\n${message}\n\n📊 Proyecto: ${deployment?.project}\n🔗 Commit: ${deployment?.commit}\n🌿 Branch: ${deployment?.branch}`;
        
        const result = await this.whatsappAPI.sendMessage(
          this.notifications.whatsapp.phoneNumber,
          fallbackMessage
        );

        console.log('📱 WhatsApp fallback message sent successfully:', result.messageId);
        return { success: true, channel: 'whatsapp', method: 'fallback', messageId: result.messageId };
      }

    } catch (error) {
      console.error('📱❌ WhatsApp notification failed:', error.message);
      return { success: false, channel: 'whatsapp', error: error.message };
    }
  }

  /**
   * Get WhatsApp template name based on notification type
   */
  getWhatsAppTemplate(type) {
    const templates = {
      success: 'cicd_deployment_success',
      error: 'cicd_deployment_failed',
      warning: 'cicd_deployment_warning',
      info: 'cicd_deployment_started'
    };
    return templates[type] || 'cicd_general_notification';
  }

  /**
   * Get WhatsApp template parameters
   */
  getWhatsAppTemplateParams(deployment, type) {
    return [
      deployment?.project || 'Unknown',
      deployment?.commit || 'Unknown', 
      deployment?.branch || 'Unknown',
      new Date().toLocaleString('es-ES')
    ];
  }

  /**
   * Get emoji for notification type
   */
  getEmoji(type) {
    const emojis = {
      info: '📘',
      success: '🟢',
      error: '🔴', 
      warning: '🟡'
    };
    return emojis[type] || '📄';
  }

  /**
   * Get icon for notification type
   */
  getIcon(type) {
    // Windows notification icons
    const icons = {
      info: path.join(__dirname, '..', '..', 'assets', 'info.ico'),
      success: path.join(__dirname, '..', '..', 'assets', 'success.ico'),
      error: path.join(__dirname, '..', '..', 'assets', 'error.ico'),
      warning: path.join(__dirname, '..', '..', 'assets', 'warning.ico')
    };
    return icons[type] || null;
  }

  /**
   * Extract main URL for clickeable notifications
   */
  extractMainUrl(deployment, type) {
    if (!deployment) return null;
    
    switch (type) {
      case 'success':
        // SUCCESS: abrir sitio en vivo
        return deployment.productionUrl || process.env.PRODUCTION_URL;
      case 'error':
        // ERROR: abrir logs para investigar
        return deployment.logsUrl || `https://github.com/${deployment.repo || 'owner/repo'}/actions`;
      case 'warning':
      case 'info':
      default:
        // DEFAULT: abrir commit en GitHub
        return deployment.githubUrl || `https://github.com/${deployment.repo || 'owner/repo'}/commit/${deployment.commit}`;
    }
  }

  /**
   * Test all notification channels
   */
  async testNotifications() {
    console.log('🧪 Testing notification system...\n');

    const testDeployment = {
      project: 'cicd-system',
      commit: 'test123',
      branch: 'main',
      status: 'success',
      phase: 'testing'
    };

    // Test each notification type
    await this.deploymentStarted(testDeployment);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await this.deploymentSuccess(testDeployment);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await this.deploymentWarning({ ...testDeployment, warning: 'Test warning message' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await this.deploymentFailed({ ...testDeployment, error: 'Test error message' });

    console.log('✅ Notification system test completed');
  }
}

// Export for use in other modules
module.exports = NotificationManager;

// Allow running directly for testing
if (require.main === module) {
  const notificationManager = new NotificationManager();
  notificationManager.testNotifications().catch(console.error);
}