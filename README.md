# 🚀 CI/CD System

Standalone CI/CD system with webhook server, deployment scripts, and notification system for automated development workflows.

## ✨ Features

- 🔗 **Webhook Server** - GitHub webhook receiver with ngrok tunnel support
- 🚀 **Deployment Scripts** - Production deployment with health checks and rollback
- 📊 **System Monitoring** - Health checks and startup validation
- 🔧 **Process Management** - PID management and port conflict resolution
- 📱 **Notifications** - WhatsApp and Windows notifications for deployment status
- 🗃️ **Database Management** - Schema diagnostics and automated fixes
- 🎯 **Cross-Platform** - Windows batch files and PowerShell scripts included

## 🎯 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- ngrok account with authtoken
- Git repository access

### Installation

```bash
# Clone the repository
git clone https://github.com/moffermann/cicd-system.git
cd cicd-system

# Install dependencies
npm install

# Create configuration file
echo '{"adminToken": "your-jwt-token-here"}' > webhook-config.json

# Set environment variables
export NGROK_AUTHTOKEN="your-ngrok-token"
export PRODUCTION_URL="https://your-domain.com"
export GITHUB_REPO="your-username/your-repo"
```

### Basic Usage

```bash
# Start webhook server
npm start

# Run health check
npm run health-check

# Deploy to production
npm run deploy

# Manage processes
npm run pid-manager cleanup
```

## 🏗️ Architecture

### Core Components

```
src/
├── webhook-server.js          # Main webhook receiver
├── deploy-production.js       # Production deployment automation  
├── claude-startup-checklist-complete.js  # System health validation
├── pid-manager.js             # Process and port management
└── diagnose-database.js       # Database diagnostics

scripts/
├── start-ssh-tunnel-service.ps1     # PowerShell SSH tunnel setup
├── keep-ssh-tunnel-alive.ps1        # SSH tunnel monitoring
├── start-webhook-server.bat         # Windows webhook server startup
└── auto-startup-claude.bat          # Complete system initialization
```

### Workflow

1. **GitHub Push** → Triggers webhook
2. **Local Webhook Server** → Receives notification via ngrok tunnel
3. **Production Deploy** → Executes deployment with health checks
4. **Health Monitoring** → Continuous system validation
5. **Notifications** → Status updates via WhatsApp/Windows

## 🔧 Configuration

### webhook-config.json
```json
{
  "adminToken": "your-jwt-admin-token",
  "currentWebhook": "https://abc123.ngrok-free.app",
  "lastUpdated": "2025-01-15T10:30:00.000Z"
}
```

### Environment Variables
```bash
# Required
NGROK_AUTHTOKEN=your-ngrok-auth-token
PRODUCTION_URL=https://your-production-domain.com

# Optional
WEBHOOK_PORT=8765
STAGING_URL=https://staging.your-domain.com  
GITHUB_REPO=username/repository-name
```

## 📜 Scripts Reference

### Core Scripts

| Script | Description | Usage |
|--------|-------------|--------|
| `start` | Start webhook server | `npm start` |
| `deploy` | Deploy to production | `npm run deploy` |
| `health-check` | Run system health check | `npm run health-check` |
| `pid-manager` | Manage process PIDs | `npm run pid-manager cleanup` |
| `diagnose` | Diagnose database issues | `npm run diagnose` |

### Windows Scripts

| Script | Description |
|--------|-------------|
| `start-webhook-server.bat` | Start webhook server on Windows |
| `auto-startup-claude.bat` | Complete system startup for Claude Code |
| `start-ssh-tunnel-service.ps1` | Start SSH tunnel (PowerShell) |
| `keep-ssh-tunnel-alive.ps1` | Monitor and restart SSH tunnel |

## 🔍 System Monitoring

The health check system monitors:

- ✅ **Webhook Endpoints** - Remote and local webhook availability
- 🔗 **SSH Tunnels** - ngrok tunnel status and connectivity  
- 📁 **Git Repository** - Repository status and uncommitted changes
- 🌍 **Environment** - Node.js version and required variables
- 📦 **Dependencies** - npm packages and external tools
- 🗄️ **Database** - Connection status and schema validation

### Health Check Output
```bash
🎯 Score: 12/15 (80%)
🏆 Status: GOOD
📅 Timestamp: 2025-01-15T10:30:00.000Z

🚨 PROBLEMS FOUND:
   1. ngrok process not running
   2. Environment variable missing: STAGING_URL

📋 COMPONENT DETAILS:
🔧 WEBHOOKREMOTE:
   Score: 2/2
   endpoint: OK

🏠 WEBHOOKLOCAL:
   Score: 1/2
   localServer: OK
   ngrokProcess: No encontrado
```

## 🚀 Production Deployment

The deployment script implements a 5-phase process:

### Phase 1: Pre-Validation
- Unit tests
- Code linting  
- Type checking
- Security audit

### Phase 2: Staging Deployment  
- Deploy to staging environment
- Smoke tests
- Performance tests

### Phase 3: Pre-Production Checks
- Environment validation
- Database connection check
- Dependencies verification
- SSL certificates validation
- Production backup creation

### Phase 4: Production Deployment
- Store rollback data
- Deploy to production
- Health checks
- Production smoke tests

### Phase 5: Post-Deployment Monitoring
- 5 minutes of continuous monitoring
- Health endpoint checks
- Error rate monitoring
- Response time validation
- Automatic rollback on failure

### Example Deployment Output
```bash
🚀 PRODUCTION DEPLOYMENT REPORT
============================================================
Deployment ID: deploy_1642234567890
Total Time: 8m 32s
Health Checks Passed: 45
Errors Encountered: 0
Status: SUCCESS
============================================================
```

## 🔧 Process Management

### PID Manager Features

```bash
# Check process status
node src/pid-manager.js status

# Clean up hanging processes
node src/pid-manager.js cleanup

# Start with PID management
node src/pid-manager.js start
```

The PID manager:
- ✅ Prevents port conflicts
- 🧹 Cleans up zombie processes
- 🔄 Handles graceful shutdowns
- 📝 Tracks running processes

## 🐛 Troubleshooting

### Common Issues

**Webhook server won't start**
```bash
# Check if port is in use
npm run pid-manager cleanup
npm start
```

**ngrok tunnel not working**
```bash
# Verify ngrok installation
ngrok version

# Check auth token
ngrok config check
```

**Deployment fails health checks**
```bash
# Run diagnostics
npm run health-check

# Check specific endpoints
curl https://your-domain.com/health
```

**SSH tunnel keeps disconnecting**
```powershell
# Use PowerShell monitoring script
./scripts/keep-ssh-tunnel-alive.ps1
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Related Projects

- [talento-whatsappbot](https://github.com/moigomez/talento-whatsappbot) - Original WhatsApp bot project
- [Claude Code](https://claude.ai/code) - AI-powered development environment

---

**🎯 Ready to deploy?** Run `npm run health-check` to verify your setup, then `npm start` to begin!
