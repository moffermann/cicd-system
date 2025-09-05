const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

class GitChecker {
    constructor(logger) {
        this.logger = logger;
    }

    async checkRepository() {
        const score = { current: 0, max: 3 };
        const details = {};
        
        try {
            await execAsync('git status');
            details.repository = 'OK';
            score.current += 1;
            
            const { stdout } = await execAsync('git status --porcelain');
            if (stdout.trim() === '') {
                details.uncommittedChanges = 'Ninguno';
                score.current += 1;
            } else {
                details.uncommittedChanges = 'Hay cambios sin commit';
                this.logger.addIssue('Hay cambios sin commit en el repositorio');
            }
            
            const { stdout: branch } = await execAsync('git branch --show-current');
            details.currentBranch = branch.trim();
            if (branch.trim() === 'master' || branch.trim() === 'main') {
                score.current += 1;
            } else {
                this.logger.addIssue(`Rama actual no es master/main: ${branch.trim()}`);
            }
            
        } catch (error) {
            details.repository = `ERROR - ${error.message}`;
            this.logger.addIssue('No se puede acceder al repositorio Git');
        }
        
        return { score, details };
    }
}

module.exports = GitChecker;