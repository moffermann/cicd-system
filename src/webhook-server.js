#!/usr/bin/env node

import express from 'express';
import { spawn } from 'child_process';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AutoWebhookServer {
  constructor() {
    this.app = express();
    this.port = 8765; // Puerto fijo para el servidor local
    this.ngrokProcess = null;
    this.currentTunnel = null;
    this.configFile = path.join(__dirname, '..', 'webhook-config.json');
    this.productionUrl = process.env.PRODUCTION_URL || 'https://tdbot.gocode.cl';
    this.adminToken = null; // Se cargará del archivo de configuración
  }

  async loadConfig() {
    try {
      const config = await fs.readFile(this.configFile, 'utf8');
      const data = JSON.parse(config);
      this.adminToken = data.adminToken;
      console.log('✅ Configuración cargada');
    } catch (error) {
      console.log('⚠️  No se encontró configuración, necesitas configurar el token de admin');
      console.log('📝 Crea el archivo webhook-config.json con: {"adminToken": "tu-token-jwt"}');
      process.exit(1);
    }
  }

  async startNgrok() {
    return new Promise((resolve, reject) => {
      console.log('🚀 Iniciando ngrok...');
      
      // Usar ngrok con authtoken para URL fija (requiere cuenta ngrok)
      this.ngrokProcess = spawn('ngrok', ['http', this.port, '--authtoken', process.env.NGROK_AUTHTOKEN || 'your-ngrok-token'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.ngrokProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('ngrok:', output.trim());
        
        // Buscar la URL del tunnel
        const urlMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.ngrok-free\.app/);
        if (urlMatch) {
          this.currentTunnel = urlMatch[0];
          console.log(`✅ Ngrok tunnel activo: ${this.currentTunnel}`);
          resolve(this.currentTunnel);
        }
      });

      this.ngrokProcess.stderr.on('data', (data) => {
        console.error('ngrok error:', data.toString());
      });

      this.ngrokProcess.on('close', (code) => {
        console.log(`ngrok cerrado con código: ${code}`);
        // Auto-reiniciar ngrok si se cierra inesperadamente
        if (code !== 0) {
          setTimeout(() => this.startNgrok(), 5000);
        }
      });

      // Timeout si ngrok no responde en 30 segundos
      setTimeout(() => {
        if (!this.currentTunnel) {
          reject(new Error('Ngrok no pudo iniciarse en 30 segundos'));
        }
      }, 30000);
    });
  }

  async configureWebhookInProduction(webhookUrl) {
    try {
      console.log(`🔧 Configurando webhook en producción: ${webhookUrl}`);
      
      const response = await fetch(`${this.productionUrl}/api/ci/configure-webhook`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          webhookUrl: `${webhookUrl}/ci-notification`
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Webhook configurado en producción exitosamente');
        
        // Guardar la URL actual en configuración
        const config = { 
          adminToken: this.adminToken, 
          currentWebhook: webhookUrl,
          lastUpdated: new Date().toISOString()
        };
        await fs.writeFile(this.configFile, JSON.stringify(config, null, 2));
        
      } else {
        throw new Error(result.message || 'Error configurando webhook');
      }
      
    } catch (error) {
      console.error('❌ Error configurando webhook en producción:', error.message);
      throw error;
    }
  }

  setupWebhookEndpoints() {
    this.app.use(express.json());
    
    // Endpoint principal para recibir notificaciones de CI
    this.app.post('/ci-notification', (req, res) => {
      console.log('\n🔔 ===== NOTIFICACIÓN DE CI RECIBIDA =====');
      console.log('📅 Timestamp:', new Date().toLocaleString());
      console.log('📦 Payload:', JSON.stringify(req.body, null, 2));
      
      const notification = req.body;
      
      // Mostrar notificación formateada
      if (notification.phase && notification.status) {
        const emoji = notification.status === 'success' ? '✅' : 
                     notification.status === 'failure' ? '❌' : 
                     notification.status === 'running' ? '🔄' : '📋';
        
        console.log(`\n${emoji} FASE: ${notification.phase}`);
        console.log(`📊 Estado: ${notification.status.toUpperCase()}`);
        
        if (notification.duration) {
          console.log(`⏱️  Duración: ${notification.duration}ms`);
        }
        
        if (notification.deploymentId) {
          console.log(`🆔 Deployment: ${notification.deploymentId}`);
        }
        
        if (notification.summary) {
          console.log('📋 Resumen:', notification.summary);
        }
        
        if (notification.error) {
          console.log('🚨 Error:', notification.error);
        }

        // Notificación especial para pipeline completo
        if (notification.phase === 'pipeline') {
          console.log('\n🎯 ===== PIPELINE CI COMPLETADO =====');
          if (notification.status === 'complete') {
            console.log('🎉 ¡Todos los tests pasaron exitosamente!');
          } else {
            console.log('💥 Pipeline falló - revisar logs arriba');
          }
          console.log('=====================================\n');
        }
      }
      
      res.json({ success: true, message: 'Notification received' });
    });

    // Endpoint de health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        tunnel: this.currentTunnel,
        timestamp: new Date().toISOString()
      });
    });

    // Endpoint para reconfigurar webhook manualmente
    this.app.post('/reconfigure', async (req, res) => {
      try {
        if (this.currentTunnel) {
          await this.configureWebhookInProduction(this.currentTunnel);
          res.json({ success: true, message: 'Webhook reconfigurado' });
        } else {
          res.status(400).json({ error: 'No hay tunnel activo' });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  async start() {
    try {
      console.log('🚀 Iniciando Auto Webhook Server...');
      
      // 1. Cargar configuración
      await this.loadConfig();
      
      // 2. Configurar endpoints
      this.setupWebhookEndpoints();
      
      // 3. Iniciar servidor HTTP
      const server = this.app.listen(this.port, () => {
        console.log(`✅ Servidor HTTP iniciado en puerto ${this.port}`);
      });
      
      // 4. Iniciar ngrok
      const tunnelUrl = await this.startNgrok();
      
      // 5. Configurar webhook en producción
      await this.configureWebhookInProduction(tunnelUrl);
      
      console.log('\n🎉 ===== AUTO WEBHOOK SERVER LISTO =====');
      console.log(`🌐 URL Local: http://localhost:${this.port}`);
      console.log(`🔗 URL Pública: ${tunnelUrl}`);
      console.log(`🎯 Endpoint CI: ${tunnelUrl}/ci-notification`);
      console.log('📡 Webhook configurado en producción ✅');
      console.log('=====================================\n');
      console.log('💡 Tip: Haz git push para probar el pipeline completo');
      console.log('🔔 Las notificaciones aparecerán aquí automáticamente\n');
      
      // Manejar cierre gracefully
      process.on('SIGINT', () => {
        console.log('\n🛑 Cerrando Auto Webhook Server...');
        if (this.ngrokProcess) {
          this.ngrokProcess.kill();
        }
        server.close();
        process.exit(0);
      });
      
    } catch (error) {
      console.error('❌ Error iniciando Auto Webhook Server:', error.message);
      process.exit(1);
    }
  }
}

// Iniciar el servidor automáticamente
const webhookServer = new AutoWebhookServer();
webhookServer.start();