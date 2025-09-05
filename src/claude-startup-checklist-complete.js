#!/usr/bin/env node
/**
 * Claude Startup Checklist COMPLETO - Verificación Exhaustiva de CI/CD
 * Standalone version for cicd-system
 */

import fs from 'fs/promises';
import { exec } from 'child_process';
import util from 'util';
import fetch from 'node-fetch';
import { readFileSync } from 'fs';

const execAsync = util.promisify(exec);

class CompleteStartupChecklist {
    constructor() {
        this.results = {
            timestamp: new Date().toISOString(),
            session: `claude-${Date.now()}`,
            status: 'UNKNOWN',
            components: {},
            issues: [],
            summary: '',
            score: 0,
            maxScore: 0
        };
        
        this.productionUrl = process.env.PRODUCTION_URL || 'https://tdbot.gocode.cl';
        this.localWebhookPort = process.env.WEBHOOK_PORT || '8765';
        this.githubRepo = process.env.GITHUB_REPO || 'moffermann/cicd-system';
    }

    async runChecklist() {
        console.log('🚀 CLAUDE STARTUP CHECKLIST COMPLETO - Verificando CI/CD...\n');
        
        try {
            // Core checks
            await this.checkWebhookRemote();
            await this.checkWebhookLocal();
            await this.checkGitRepository();
            await this.checkEnvironment();
            await this.checkDependencies();
            
            this.calculateOverallStatus();
            await this.generateSummary();
            await this.saveResults();
            
            this.displayResults();
            return this.results;
            
        } catch (error) {
            console.error('💥 Error fatal en checklist:', error);
            this.results.status = 'ERROR';
            this.results.issues.push(`Error fatal: ${error.message}`);
            return this.results;
        }
    }

    async checkWebhookRemote() {
        console.log('🌐 Verificando webhook remoto...');
        const score = { current: 0, max: 2 };
        const details = {};
        
        try {
            const response = await this.fetchWithTimeout(`${this.productionUrl}/health`, {
                method: 'GET',
                timeout: 10000
            });
            
            if (response && response.ok) {
                details.endpoint = 'OK';
                score.current += 2;
            } else {
                details.endpoint = `ERROR - Status: ${response ? response.status : 'No response'}`;
                this.results.issues.push('Webhook remoto no responde correctamente');
            }
            
        } catch (error) {
            details.endpoint = `ERROR - ${error.message}`;
            this.results.issues.push(`Error conectando webhook remoto: ${error.message}`);
        }
        
        this.results.components.webhookRemote = { score, details };
        this.results.score += score.current;
        this.results.maxScore += score.max;
        
        console.log(`   ${score.current}/${score.max} ✅`);
    }

    async checkWebhookLocal() {
        console.log('🏠 Verificando webhook local...');
        const score = { current: 0, max: 2 };
        const details = {};
        
        try {
            const response = await this.fetchWithTimeout(`http://localhost:${this.localWebhookPort}/health`, {
                method: 'GET',
                timeout: 5000
            });
            
            if (response && response.ok) {
                details.localServer = 'OK';
                score.current += 1;
            } else {
                details.localServer = 'No responde';
                this.results.issues.push('Webhook local no está ejecutándose');
            }
            
        } catch (error) {
            details.localServer = `ERROR - ${error.message}`;
            this.results.issues.push('Webhook local no accesible');
        }
        
        // Check if ngrok process is running (platform specific)
        try {
            const cmd = process.platform === 'win32' ? 
                'tasklist | findstr "ngrok"' : 
                'pgrep ngrok';
            
            await execAsync(cmd);
            details.ngrokProcess = 'Ejecutándose';
            score.current += 1;
        } catch (error) {
            details.ngrokProcess = 'No encontrado';
            this.results.issues.push('Proceso ngrok no está ejecutándose');
        }
        
        this.results.components.webhookLocal = { score, details };
        this.results.score += score.current;
        this.results.maxScore += score.max;
        
        console.log(`   ${score.current}/${score.max} ✅`);
    }

    async checkGitRepository() {
        console.log('📂 Verificando repositorio Git...');
        const score = { current: 0, max: 3 };
        const details = {};
        
        try {
            // Check if we're in a git repo
            await execAsync('git status');
            details.repository = 'OK';
            score.current += 1;
            
            // Check for uncommitted changes
            const { stdout } = await execAsync('git status --porcelain');
            if (stdout.trim() === '') {
                details.uncommittedChanges = 'Ninguno';
                score.current += 1;
            } else {
                details.uncommittedChanges = 'Hay cambios sin commit';
                this.results.issues.push('Hay cambios sin commit en el repositorio');
            }
            
            // Check current branch
            const { stdout: branch } = await execAsync('git branch --show-current');
            details.currentBranch = branch.trim();
            if (branch.trim() === 'master' || branch.trim() === 'main') {
                score.current += 1;
            } else {
                this.results.issues.push(`Rama actual no es master/main: ${branch.trim()}`);
            }
            
        } catch (error) {
            details.repository = `ERROR - ${error.message}`;
            this.results.issues.push('No se puede acceder al repositorio Git');
        }
        
        this.results.components.gitRepository = { score, details };
        this.results.score += score.current;
        this.results.maxScore += score.max;
        
        console.log(`   ${score.current}/${score.max} ✅`);
    }

    async checkEnvironment() {
        console.log('🌍 Verificando entorno...');
        const score = { current: 0, max: 3 };
        const details = {};
        
        // Check Node.js version
        const nodeVersion = process.version;
        details.nodeVersion = nodeVersion;
        if (nodeVersion >= 'v18.0.0') {
            score.current += 1;
        } else {
            this.results.issues.push(`Versión de Node.js muy antigua: ${nodeVersion}`);
        }
        
        // Check required environment variables
        const requiredVars = ['NGROK_AUTHTOKEN', 'PRODUCTION_URL'];
        let envVarsOk = 0;
        
        requiredVars.forEach(varName => {
            if (process.env[varName]) {
                envVarsOk++;
            } else {
                this.results.issues.push(`Variable de entorno faltante: ${varName}`);
            }
        });
        
        details.environmentVariables = `${envVarsOk}/${requiredVars.length} configuradas`;
        if (envVarsOk === requiredVars.length) {
            score.current += 1;
        }
        
        // Check if webhook-config.json exists
        try {
            const configExists = await fs.access('webhook-config.json');
            details.webhookConfig = 'Configurado';
            score.current += 1;
        } catch (error) {
            details.webhookConfig = 'Faltante';
            this.results.issues.push('Archivo webhook-config.json no encontrado');
        }
        
        this.results.components.environment = { score, details };
        this.results.score += score.current;
        this.results.maxScore += score.max;
        
        console.log(`   ${score.current}/${score.max} ✅`);
    }

    async checkDependencies() {
        console.log('📦 Verificando dependencias...');
        const score = { current: 0, max: 2 };
        const details = {};
        
        try {
            // Check npm dependencies
            await execAsync('npm ls --depth=0');
            details.npmDependencies = 'OK';
            score.current += 1;
        } catch (error) {
            details.npmDependencies = 'Hay problemas';
            this.results.issues.push('Problemas con dependencias npm');
        }
        
        try {
            // Check if ngrok is available
            await execAsync('ngrok version');
            details.ngrokInstalled = 'OK';
            score.current += 1;
        } catch (error) {
            details.ngrokInstalled = 'No instalado';
            this.results.issues.push('ngrok no está instalado o no está en PATH');
        }
        
        this.results.components.dependencies = { score, details };
        this.results.score += score.current;
        this.results.maxScore += score.max;
        
        console.log(`   ${score.current}/${score.max} ✅`);
    }

    calculateOverallStatus() {
        const percentage = (this.results.score / this.results.maxScore) * 100;
        
        if (percentage >= 90) {
            this.results.status = 'EXCELLENT';
        } else if (percentage >= 75) {
            this.results.status = 'GOOD';
        } else if (percentage >= 60) {
            this.results.status = 'FAIR';
        } else {
            this.results.status = 'POOR';
        }
    }

    async generateSummary() {
        const percentage = Math.round((this.results.score / this.results.maxScore) * 100);
        
        this.results.summary = `CI/CD Health Check: ${percentage}% (${this.results.score}/${this.results.maxScore})`;
        
        if (this.results.issues.length === 0) {
            this.results.summary += ' - ✅ Todo funcionando correctamente';
        } else {
            this.results.summary += ` - ⚠️ ${this.results.issues.length} problema(s) encontrado(s)`;
        }
    }

    async saveResults() {
        try {
            const filename = `checklist-${this.results.session}.json`;
            await fs.writeFile(filename, JSON.stringify(this.results, null, 2));
            console.log(`💾 Resultados guardados en ${filename}`);
        } catch (error) {
            console.error('❌ Error guardando resultados:', error.message);
        }
    }

    displayResults() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMEN DEL HEALTH CHECK');
        console.log('='.repeat(60));
        console.log(`🎯 Score: ${this.results.score}/${this.results.maxScore} (${Math.round((this.results.score/this.results.maxScore)*100)}%)`);
        console.log(`🏆 Status: ${this.results.status}`);
        console.log(`📅 Timestamp: ${this.results.timestamp}`);
        
        if (this.results.issues.length > 0) {
            console.log('\n🚨 PROBLEMAS ENCONTRADOS:');
            this.results.issues.forEach((issue, i) => {
                console.log(`   ${i + 1}. ${issue}`);
            });
        } else {
            console.log('\n✅ No se encontraron problemas');
        }
        
        console.log('\n📋 DETALLES POR COMPONENTE:');
        Object.entries(this.results.components).forEach(([name, component]) => {
            console.log(`\n🔧 ${name.toUpperCase()}:`);
            console.log(`   Score: ${component.score.current}/${component.score.max}`);
            Object.entries(component.details).forEach(([key, value]) => {
                console.log(`   ${key}: ${value}`);
            });
        });
        
        console.log('\n' + '='.repeat(60));
    }

    async fetchWithTimeout(url, options = {}) {
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

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const checklist = new CompleteStartupChecklist();
    checklist.runChecklist().then(results => {
        process.exit(results.status === 'ERROR' ? 1 : 0);
    });
}

export default CompleteStartupChecklist;