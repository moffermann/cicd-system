# 🚀 Universal CI/CD Notification System

A **complete, production-ready CI/CD notification system** that provides **dual-channel notifications** (Windows + WhatsApp) for deployment events across multiple projects.

## ✨ Features

### 🔔 **Dual-Channel Notifications**
- **Windows Desktop**: Priority notifications with differentiated sounds
- **WhatsApp Business API**: Mobile notifications with template support + fallback

### 🎵 **Smart Audio Feedback** 
- **SUCCESS/WARNING/INFO**: Hero sound (pleasant)
- **ERROR**: Pop sound (urgent, attention-grabbing)
- **High Priority**: Bypasses Focus/Do Not Disturb mode

### 📱 **WhatsApp Integration**
- Meta Business API integration with template support
- Automatic fallback to plain text when templates fail
- International phone number format support

### 🔗 **Intelligent Action Links**
- **SUCCESS**: Direct links to live site
- **ERROR**: Direct links to GitHub Actions logs for debugging
- **WARNING**: Links to check details and investigate
- **INFO**: Links to follow deployment progress

### 🎯 **Multi-Project Support**
- Single system handles multiple repositories
- Project-specific configuration
- Centralized notification management

---

## 📋 Notification Types

| Type | Sound | Windows | WhatsApp | Primary Action |
|------|--------|---------|----------|----------------|
| ✅ **SUCCESS** | Hero | ✅ | ✅ | VIEW LIVE SITE |
| ❌ **ERROR** | Pop | ✅ | ✅ | VIEW LOGS |
| ⚠️ **WARNING** | Hero | ✅ | ✅ | CHECK DETAILS |
| 🚀 **INFO** | Hero | ✅ | ✅ | FOLLOW PROGRESS |

---

## 🚀 Quick Start

### 1. **Clone and Install**
```bash
git clone https://github.com/moffermann/cicd-system.git
cd cicd-system
npm install
```

### 2. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. **Configure Notifications**
```bash
node scripts/configure-notifications.cjs
```

### 4. **Start System**
```bash
npm start
```

### 5. **Test Notifications**
```bash
# Test all notification types
node scripts/testing/test-enhanced-notifications.cjs

# Test specific type
node scripts/testing/test-notifications.cjs
```

---

## ⚙️ Configuration

### **Environment Variables**

```env
# Windows Notifications
ENABLE_WINDOWS_NOTIFICATIONS=true

# WhatsApp Business API (Optional)
WHATSAPP_ACCESS_TOKEN=your_meta_business_token
WHATSAPP_PHONE_NUMBER=56912345678  # International format
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_BUSINESS_ACCOUNT_ID=123456789012345

# External Webhook (Optional)
NOTIFICATION_WEBHOOK_URL=https://hooks.slack.com/services/...

# Production URL
PRODUCTION_URL=https://your-production-site.com
```

### **WhatsApp Setup**

1. **Create Meta Business Account**: https://business.facebook.com/
2. **Set up WhatsApp Business API**: https://developers.facebook.com/products/whatsapp/
3. **Get Access Token and Phone Number ID**
4. **Configure webhook endpoint** (if using templates)

**Phone Number Format Examples:**
- 🇨🇱 Chile: `56912345678` (remove + and 0)
- 🇺🇸 US: `15551234567`
- 🇲🇽 Mexico: `52155512345678`

---

## 🏗️ Architecture

```
cicd-system/
├── 📁 src/
│   ├── 🔔 notifications/          # Notification system
│   │   ├── NotificationManager.cjs # Main notification orchestrator  
│   │   └── WhatsAppBusinessAPI.cjs # WhatsApp Business API client
│   ├── 🌐 webhook/                # GitHub webhook processing
│   ├── 🔧 config/                 # Configuration management
│   └── 📊 utils/                  # Utilities and logging
├── 📁 scripts/
│   ├── 🧪 testing/               # Test scripts
│   ├── ⚙️ configure-notifications.cjs # Interactive setup
│   └── 🚀 deployment scripts...   # Various deployment tools
├── 📁 docs/                      # Comprehensive documentation
└── 🔧 Configuration files
```

---

## 🧪 Testing

### **Test Individual Components**
```bash
# Test Windows notifications
node scripts/testing/test-notifications.cjs

# Test WhatsApp connectivity
node scripts/testing/test-enhanced-notifications.cjs

# Test complete deployment flow
node scripts/testing/test-deployment-flow.cjs
```

### **Sound Testing**
```bash
# Test different error sounds
node scripts/testing/test-error-sounds.cjs

# Test urgent sound variations
node scripts/testing/test-urgent-sounds.cjs
```

---

## 🔧 Integration

### **With Existing Projects**

1. **Add as Git Submodule**:
```bash
git submodule add https://github.com/moffermann/cicd-system.git cicd
```

2. **Configure Project-Specific Settings**:
```javascript
// In your deployment script
const NotificationManager = require('./cicd/src/notifications/NotificationManager.cjs');

const notifications = new NotificationManager();

// On successful deployment
await notifications.deploymentSuccess({
  project: 'your-project-name',
  commit: process.env.GITHUB_SHA,
  branch: process.env.GITHUB_REF_NAME,
  repo: 'username/repository',
  duration: '2m 30s',
  productionUrl: 'https://your-site.com'
});
```

### **With GitHub Actions**

```yaml
# .github/workflows/deploy.yml
name: Deploy with Notifications

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy Application
        run: ./deploy.sh
        
      - name: Notify Success
        if: success()
        run: |
          curl -X POST http://your-webhook-server/webhook \
            -H "Content-Type: application/json" \
            -d '{"type": "success", "project": "${{ github.repository }}", "commit": "${{ github.sha }}"}'
            
      - name: Notify Failure  
        if: failure()
        run: |
          curl -X POST http://your-webhook-server/webhook \
            -H "Content-Type: application/json" \
            -d '{"type": "error", "project": "${{ github.repository }}", "commit": "${{ github.sha }}"}'
```

---

## 📚 Documentation

- **[Complete Setup Guide](docs/CI-CD-IMPLEMENTATION-GUIDE.md)** - Step-by-step implementation
- **[Webhook Configuration](docs/WEBHOOK_SETUP.md)** - GitHub webhook setup
- **[Deployment Guide](docs/DEPLOYMENT_SETUP_GUIDE.md)** - Production deployment
- **[Claude Automation](CLAUDE_SETUP.md)** - Automated setup with Claude

---

## 🔍 Troubleshooting

### **Windows Notifications Not Appearing**

1. **Check Focus Mode**: Notifications use high priority to bypass
2. **Verify node-notifier**: `npm list node-notifier`
3. **Test manually**: `node scripts/testing/test-notifications.cjs`

### **WhatsApp Messages Not Sending**

1. **Verify token**: Check Meta Business Manager
2. **Check phone format**: Must be international format without +
3. **Test connection**: `node scripts/testing/test-enhanced-notifications.cjs`
4. **Check logs**: Look for detailed error messages

### **Webhook Not Receiving Events**

1. **Verify server running**: `npm start`
2. **Check GitHub webhook config**: Must point to your server
3. **Verify webhook secret**: Must match environment variable
4. **Test locally**: Use ngrok for local testing

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Add tests for new features
5. Commit changes: `git commit -m 'Add feature'`
6. Push to branch: `git push origin feature-name`
7. Submit a pull request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🎯 Use Cases

- **Development Teams**: Get notified of deployment status on desktop and mobile
- **DevOps Engineers**: Monitor multiple projects from a single notification system  
- **Solo Developers**: Stay informed of deployment status without constantly checking
- **Remote Teams**: Ensure everyone gets deployment notifications regardless of location

---

## ⭐ Key Benefits

- ✅ **Dual Channel**: Never miss a deployment notification
- 🎵 **Audio Differentiation**: Know the status before reading
- 📱 **Mobile Ready**: WhatsApp integration for on-the-go notifications
- 🔗 **Actionable**: Direct links to relevant resources
- 🚀 **Production Ready**: Robust error handling and fallbacks
- 📈 **Scalable**: Supports multiple projects and notification channels

---

**Ready to enhance your CI/CD pipeline with professional notifications?**

[🚀 Get Started](#-quick-start) | [📚 Read the Docs](docs/) | [🤝 Contribute](#-contributing)

## ✨ Additional Features

- 🔗 **Webhook Server** - GitHub webhook receiver with multi-project support
- 🚀 **Deployment Scripts** - Production deployment with health checks and rollback
- 📊 **System Monitoring** - Health checks and startup validation
- 🔧 **Process Management** - PID management and port conflict resolution
- 📱 **Notifications** - WhatsApp and Windows notifications for deployment status
- 🗃️ **Database Management** - Schema diagnostics and automated fixes
- 🎯 **Cross-Platform** - Windows batch files and PowerShell scripts included
- 🛠️ **Windows Service** - Auto-start webhook server as Windows service

## 🎯 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Git repository access
- Administrator privileges (for Windows service installation)

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

## 🛠️ Windows Service Installation

For **automatic startup** and **persistent execution**:

### Quick Setup
```powershell
# Run as Administrator
scripts\service-control.bat
# Select option 1 to install service
```

### Manual Installation  
```powershell
# As Administrator
cd D:\devel\node\cicd-system
node scripts\install-windows-service.js
```

### Service Management
```powershell
# Control panel
scripts\service-control.bat

# Windows commands
sc start "CICD-Webhook-Server"    # Start
sc stop "CICD-Webhook-Server"     # Stop  
sc query "CICD-Webhook-Server"    # Status
```

### Verification
```bash
# Test webhook server
curl http://localhost:8765/health

# Expected response:
# {"status":"ok","timestamp":"...","projects":2}
```

📋 **See [Windows Service Setup Guide](docs/WINDOWS-SERVICE-SETUP.md) for detailed instructions**

## 🏗️ Architecture

### Core Components

```
src/
├── webhook-server-multi.js    # Multi-project webhook receiver
├── deploy-production.js       # Production deployment automation  
├── claude-startup-checklist-complete.js  # System health validation
├── pid-manager.js             # Process and port management
├── database/
│   └── DatabaseManager.cjs    # SQLite database management
└── webhook/
    └── WebhookHandler.cjs     # GitHub webhook processing

scripts/
├── install-windows-service.js       # Windows service installer
├── uninstall-windows-service.js     # Windows service uninstaller  
├── service-control.bat              # Service management control panel
├── start-ssh-tunnel-service.ps1     # PowerShell SSH tunnel setup
├── keep-ssh-tunnel-alive.ps1        # SSH tunnel monitoring
└── auto-startup-claude.bat          # Complete system initialization
```

### Workflow

1. **GitHub Push** → Triggers webhook to `https://cicd.gocode.cl/webhook`
2. **Remote Server** → Processes webhook and triggers deployment
3. **Local Development** → Optional Windows service for local testing
4. **Production Deploy** → Multi-phase deployment with validation
5. **Health Monitoring** → Continuous system validation
6. **Database Logging** → All deployments tracked in SQLite

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
