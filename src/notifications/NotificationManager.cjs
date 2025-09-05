#!/usr/bin/env node

/**
 * Notification Manager for CI/CD System
 * Handles deployment notifications via multiple channels
 */

const notifier = require('node-notifier');
const path = require('path');

class NotificationManager {
  constructor() {
    this.notifications = {
      windows: process.env.ENABLE_WINDOWS_NOTIFICATIONS !== 'false',
      console: true,
      webhook: process.env.NOTIFICATION_WEBHOOK_URL || null
    };
  }

  /**
   * Send deployment started notification
   */
  async deploymentStarted(deployment) {
    const title = `🚀 Deployment Started`;
    const message = `Project: ${deployment.project}\nCommit: ${deployment.commit}\nBranch: ${deployment.branch}`;
    
    await this.send({
      title,
      message,
      type: 'info',
      deployment
    });
  }

  /**
   * Send deployment success notification
   */
  async deploymentSuccess(deployment) {
    const title = `✅ Deployment Success`;
    const message = `Project: ${deployment.project}\nCommit: ${deployment.commit}\nDuration: ${deployment.duration || 'N/A'}`;
    
    await this.send({
      title,
      message,
      type: 'success',
      deployment
    });
  }

  /**
   * Send deployment failure notification
   */
  async deploymentFailed(deployment) {
    const title = `❌ Deployment Failed`;
    const message = `Project: ${deployment.project}\nCommit: ${deployment.commit}\nError: ${deployment.error || 'Unknown error'}`;
    
    await this.send({
      title,
      message,
      type: 'error',
      deployment
    });
  }

  /**
   * Send deployment warning notification
   */
  async deploymentWarning(deployment) {
    const title = `⚠️ Deployment Warning`;
    const message = `Project: ${deployment.project}\nCommit: ${deployment.commit}\nWarning: ${deployment.warning}`;
    
    await this.send({
      title,
      message,
      type: 'warning',
      deployment
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
      promises.push(this.sendWindows({ title, message, type }));
    }

    // Webhook notification
    if (this.notifications.webhook) {
      promises.push(this.sendWebhook({ title, message, type, deployment }));
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
  async sendWindows({ title, message, type }) {
    try {
      return new Promise((resolve) => {
        notifier.notify({
          title: title,
          message: message,
          icon: this.getIcon(type),
          sound: type === 'error' ? 'Basso' : 'Hero',
          timeout: 10,
          appID: 'CICD-System'
        }, (err, response, metadata) => {
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