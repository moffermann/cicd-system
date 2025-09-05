const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

class DependencyChecker {
    constructor(logger) {
        this.logger = logger;
    }

    async checkDependencies() {
        const score = { current: 0, max: 2 };
        const details = {};
        
        try {
            await execAsync('npm ls --depth=0');
            details.npmDependencies = 'OK';
            score.current += 1;
        } catch (error) {
            details.npmDependencies = 'Hay problemas';
            this.logger.addIssue('Problemas con dependencias npm');
        }
        
        try {
            await execAsync('ssh -V');
            details.sshInstalled = 'OK';
            score.current += 1;
        } catch (error) {
            details.sshInstalled = 'No instalado';
            this.logger.addIssue('SSH no está instalado o no está en PATH');
        }
        
        return { score, details };
    }
}

module.exports = DependencyChecker;