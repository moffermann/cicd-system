const fs = require('fs/promises');

class ChecklistLogger {
    constructor(session) {
        this.results = {
            timestamp: new Date().toISOString(),
            session: session || `claude-${Date.now()}`,
            status: 'UNKNOWN',
            components: {},
            issues: [],
            summary: '',
            score: 0,
            maxScore: 0
        };
    }

    addIssue(issue) {
        this.results.issues.push(issue);
    }

    addComponent(name, componentResult) {
        this.results.components[name] = componentResult;
        this.results.score += componentResult.score.current;
        this.results.maxScore += componentResult.score.max;
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

    generateSummary() {
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

    getResults() {
        return this.results;
    }
}

module.exports = ChecklistLogger;