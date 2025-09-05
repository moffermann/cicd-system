#!/usr/bin/env node
/**
 * Basic functionality tests for CI/CD system
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class BasicTests {
    constructor() {
        this.passed = 0;
        this.failed = 0;
        this.tests = [];
    }

    async runTests() {
        console.log('🧪 Running Basic Functionality Tests\n');

        // File structure tests
        await this.testFileStructure();
        
        // Module import tests
        await this.testModuleImports();
        
        // Configuration tests
        await this.testConfiguration();

        this.displayResults();
        return this.failed === 0;
    }

    async testFileStructure() {
        console.log('📁 Testing file structure...');

        const requiredFiles = [
            'package.json',
            'README.md',
            'src/webhook-server.js',
            'src/deploy-production.js', 
            'src/claude-startup-checklist-complete.js',
            'src/pid-manager.js',
            'scripts/start-webhook-server.bat',
            'scripts/auto-startup-claude.bat'
        ];

        for (const file of requiredFiles) {
            const filePath = join(__dirname, '..', file);
            if (existsSync(filePath)) {
                this.pass(`✅ ${file} exists`);
            } else {
                this.fail(`❌ ${file} missing`);
            }
        }
    }

    async testModuleImports() {
        console.log('\n📦 Testing module imports...');

        const modules = [
            { name: 'PidManager', path: '../src/pid-manager.js' },
            { name: 'CompleteStartupChecklist', path: '../src/claude-startup-checklist-complete.js' },
            { name: 'ProductionDeployer', path: '../src/deploy-production.js' }
        ];

        for (const module of modules) {
            try {
                const imported = await import(module.path);
                if (imported.default || imported[module.name]) {
                    this.pass(`✅ ${module.name} imports successfully`);
                } else {
                    this.fail(`❌ ${module.name} export not found`);
                }
            } catch (error) {
                this.fail(`❌ ${module.name} import failed: ${error.message}`);
            }
        }
    }

    async testConfiguration() {
        console.log('\n⚙️ Testing configuration...');

        // Test package.json
        try {
            const pkg = JSON.parse(await import('fs').then(fs => 
                fs.readFileSync(join(__dirname, '..', 'package.json'), 'utf8')
            ));
            
            if (pkg.name === 'cicd-system') {
                this.pass('✅ Package name correct');
            } else {
                this.fail(`❌ Package name incorrect: ${pkg.name}`);
            }

            if (pkg.type === 'module') {
                this.pass('✅ ES modules configured');
            } else {
                this.fail('❌ ES modules not configured');
            }

            const requiredScripts = ['start', 'deploy', 'health-check', 'pid-manager'];
            for (const script of requiredScripts) {
                if (pkg.scripts && pkg.scripts[script]) {
                    this.pass(`✅ Script "${script}" defined`);
                } else {
                    this.fail(`❌ Script "${script}" missing`);
                }
            }

        } catch (error) {
            this.fail(`❌ Package.json test failed: ${error.message}`);
        }

        // Test environment requirements
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
        
        if (majorVersion >= 18) {
            this.pass(`✅ Node.js version adequate: ${nodeVersion}`);
        } else {
            this.fail(`❌ Node.js version too old: ${nodeVersion} (requires 18+)`);
        }
    }

    pass(message) {
        this.passed++;
        this.tests.push({ status: 'PASS', message });
        console.log(`  ${message}`);
    }

    fail(message) {
        this.failed++;
        this.tests.push({ status: 'FAIL', message });
        console.log(`  ${message}`);
    }

    displayResults() {
        console.log('\n' + '='.repeat(60));
        console.log('🧪 TEST RESULTS');
        console.log('='.repeat(60));
        console.log(`✅ Passed: ${this.passed}`);
        console.log(`❌ Failed: ${this.failed}`);
        console.log(`📊 Total: ${this.passed + this.failed}`);
        console.log(`🎯 Success Rate: ${Math.round((this.passed / (this.passed + this.failed)) * 100)}%`);
        
        if (this.failed > 0) {
            console.log('\n🚨 FAILED TESTS:');
            this.tests.filter(t => t.status === 'FAIL').forEach((test, i) => {
                console.log(`  ${i + 1}. ${test.message}`);
            });
        }
        
        console.log('\n' + '='.repeat(60));
        
        if (this.failed === 0) {
            console.log('🎉 ALL TESTS PASSED! CI/CD system is ready to use.');
        } else {
            console.log('⚠️ Some tests failed. Please fix the issues above.');
        }
    }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const tester = new BasicTests();
    tester.runTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}

export default BasicTests;