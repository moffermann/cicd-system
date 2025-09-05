const { exec } = require('child_process');
const util = require('util');

// Use dynamic import for node-fetch to avoid ES module issues
let fetch;
try {
    fetch = require('node-fetch');
} catch (err) {
    // Fallback for ES module issues
    fetch = null;
}

const execAsync = util.promisify(exec);

class WebhookChecker {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
    }

    async checkRemoteWebhook() {
        const score = { current: 0, max: 2 };
        const details = {};
        
        try {
            const response = await this.fetchWithTimeout(`${this.config.productionUrl}/health`, {
                method: 'GET',
                timeout: 10000
            });
            
            if (response && response.ok) {
                details.endpoint = 'OK';
                score.current += 2;
            } else {
                details.endpoint = `ERROR - Status: ${response ? response.status : 'No response'}`;
                this.logger.addIssue('Webhook remoto no responde correctamente');
            }
            
        } catch (error) {
            details.endpoint = `ERROR - ${error.message}`;
            this.logger.addIssue(`Error conectando webhook remoto: ${error.message}`);
        }
        
        return { score, details };
    }

    async checkLocalWebhook() {
        const score = { current: 0, max: 2 };
        const details = {};
        
        try {
            const response = await this.fetchWithTimeout(`http://localhost:${this.config.port}/health`, {
                method: 'GET',
                timeout: 5000
            });
            
            if (response && response.ok) {
                details.localServer = 'OK';
                score.current += 1;
            } else {
                details.localServer = 'No responde';
                this.logger.addIssue('Webhook local no está ejecutándose');
            }
            
        } catch (error) {
            details.localServer = `ERROR - ${error.message}`;
            this.logger.addIssue('Webhook local no accesible');
        }
        
        return { score, details };
    }

    async checkSSHTunnelService() {
        const score = { current: 0, max: 1 };
        const details = {};
        
        try {
            const cmd = process.platform === 'win32' ? 
                'sc query "CICD-SSH-Tunnel"' : 
                'systemctl is-active ssh-tunnel';
            
            await execAsync(cmd);
            details.sshTunnelService = 'Ejecutándose';
            score.current += 1;
        } catch (error) {
            details.sshTunnelService = 'No encontrado';
            this.logger.addIssue('Servicio SSH Tunnel no está ejecutándose');
        }
        
        return { score, details };
    }

    async fetchWithTimeout(url, options = {}) {
        if (!fetch) {
            throw new Error('Fetch not available - ES module compatibility issue');
        }
        
        const { timeout = 5000, ...fetchOptions } = options;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                ...fetchOptions,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
}

module.exports = WebhookChecker;