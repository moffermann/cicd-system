#!/usr/bin/env node
/**
 * Claude Startup Checklist COMPLETO - Verificación Exhaustiva de CI/CD
 * Standalone version for cicd-system
 */

const ProjectConfig = require('./config/ProjectConfig.cjs');
const WebhookChecker = require('./checklist/WebhookChecker.cjs');
const GitChecker = require('./checklist/GitChecker.cjs');
const EnvironmentChecker = require('./checklist/EnvironmentChecker.cjs');
const DependencyChecker = require('./checklist/DependencyChecker.cjs');
const ChecklistLogger = require('./checklist/ChecklistLogger.cjs');

class CompleteStartupChecklist {
    constructor() {
        this.config = null;
        this.logger = null;
        this.webhookChecker = null;
        this.gitChecker = null;
        this.environmentChecker = null;
        this.dependencyChecker = null;
    }

    async runChecklist() {
        console.log('🚀 CLAUDE STARTUP CHECKLIST COMPLETO - Verificando CI/CD...\n');
        
        try {
            this.config = await ProjectConfig.load();
            console.log(`📁 Verificando proyecto: ${this.config.projectName}\n`);
            
            this.logger = new ChecklistLogger();
            this.webhookChecker = new WebhookChecker(this.config, this.logger);
            this.gitChecker = new GitChecker(this.logger);
            this.environmentChecker = new EnvironmentChecker(this.logger);
            this.dependencyChecker = new DependencyChecker(this.logger);
            
            await this.runAllChecks();
            
            this.logger.calculateOverallStatus();
            this.logger.generateSummary();
            await this.logger.saveResults();
            
            this.logger.displayResults();
            return this.logger.getResults();
            
        } catch (error) {
            console.error('💥 Error fatal en checklist:', error);
            if (this.logger) {
                this.logger.addIssue(`Error fatal: ${error.message}`);
                return this.logger.getResults();
            }
            return { status: 'ERROR', issues: [`Error fatal: ${error.message}`] };
        }
    }

    async runAllChecks() {
        console.log('🌐 Verificando webhook remoto...');
        const remoteResult = await this.webhookChecker.checkRemoteWebhook();
        this.logger.addComponent('webhookRemote', remoteResult);
        console.log(`   ${remoteResult.score.current}/${remoteResult.score.max} ✅`);

        console.log('🏠 Verificando webhook local...');
        const localResult = await this.webhookChecker.checkLocalWebhook();
        const sshResult = await this.webhookChecker.checkSSHTunnelService();
        
        const combinedLocalResult = {
            score: { 
                current: localResult.score.current + sshResult.score.current, 
                max: localResult.score.max + sshResult.score.max 
            },
            details: { ...localResult.details, ...sshResult.details }
        };
        this.logger.addComponent('webhookLocal', combinedLocalResult);
        console.log(`   ${combinedLocalResult.score.current}/${combinedLocalResult.score.max} ✅`);

        console.log('📂 Verificando repositorio Git...');
        const gitResult = await this.gitChecker.checkRepository();
        this.logger.addComponent('gitRepository', gitResult);
        console.log(`   ${gitResult.score.current}/${gitResult.score.max} ✅`);

        console.log('🌍 Verificando entorno...');
        const envResult = await this.environmentChecker.checkEnvironment();
        this.logger.addComponent('environment', envResult);
        console.log(`   ${envResult.score.current}/${envResult.score.max} ✅`);

        console.log('📦 Verificando dependencias...');
        const depResult = await this.dependencyChecker.checkDependencies();
        this.logger.addComponent('dependencies', depResult);
        console.log(`   ${depResult.score.current}/${depResult.score.max} ✅`);
    }

}

// Execute if called directly
if (require.main === module) {
    const checklist = new CompleteStartupChecklist();
    checklist.runChecklist().then(results => {
        process.exit(results.status === 'ERROR' ? 1 : 0);
    });
}

module.exports = CompleteStartupChecklist;