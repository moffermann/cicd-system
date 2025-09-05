# 🚀 Deployment Setup Guide

**Status**: ✅ Production Ready  
**Last Updated**: September 2025  
**Environment**: Ubuntu 20.04 LTS  
**Node.js**: 18.x LTS  

---

## 📋 **Prerequisites**

- Ubuntu 20.04+ server with SSH access
- Domain name with DNS configured
- GitHub repository with webhook access
- Node.js 18+ and npm installed
- PM2 process manager
- Nginx reverse proxy
- SSL certificate (Let's Encrypt recommended)

---

## 🏗️ **1. Server Environment Setup**

### 1.1 System Updates
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl nginx certbot python3-certbot-nginx
```

### 1.2 Node.js Installation
```bash
# Install Node.js 18.x LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x
```

### 1.3 PM2 Process Manager
```bash
# Install PM2 globally
sudo npm install -g pm2

# Enable PM2 startup
sudo pm2 startup systemd
```

---

## 🔧 **2. Application Deployment**

### 2.1 Clone Repository
```bash
# Create application directory
sudo mkdir -p /var/www/talento-bot
sudo chown $USER:$USER /var/www/talento-bot

# Clone repository
cd /var/www/talento-bot
git clone https://github.com/username/talento-whatsappbot.git .

# Install dependencies
npm install --production
```

### 2.2 Environment Configuration
```bash
# Create production environment file
cp .env.example .env

# Edit environment variables
nano .env
```

**Required Environment Variables:**
```bash
# Node Environment
NODE_ENV=production
PORT=3000

# WhatsApp Configuration
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_verify_token

# OpenAI Configuration
LLM_API_URL=https://api.openai.com/v1
LLM_API_KEY=your_openai_api_key

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Salesforce Configuration
SALESFORCE_LOGIN_URL=https://login.salesforce.com
SALESFORCE_CLIENT_ID=your_client_id
SALESFORCE_PRIVATE_KEY_PATH=/path/to/private.key
SALESFORCE_USERNAME=your_username

# GitHub Webhook
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Security
JWT_SECRET=your_jwt_secret
ADMIN_PASSWORD=your_admin_password
```

### 2.3 PM2 Application Configuration
```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'talento-bot-api',
    script: 'src/app.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/pm2/talento-bot-api-error.log',
    out_file: '/var/log/pm2/talento-bot-api-out.log',
    log_file: '/var/log/pm2/talento-bot-api.log',
    time: true,
    max_memory_restart: '1G'
  }, {
    name: 'talento-bot-worker',
    script: 'src/worker.js',
    instances: 1,
    env: {
      NODE_ENV: 'production'
    },
    error_file: '/var/log/pm2/talento-bot-worker-error.log',
    out_file: '/var/log/pm2/talento-bot-worker-out.log',
    log_file: '/var/log/pm2/talento-bot-worker.log',
    time: true,
    max_memory_restart: '512M'
  }]
};
EOF
```

### 2.4 Start Application
```bash
# Create log directory
sudo mkdir -p /var/log/pm2
sudo chown $USER:$USER /var/log/pm2

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Check application status
pm2 status
pm2 logs
```

---

## 🌐 **3. Nginx Reverse Proxy Setup**

### 3.1 Create Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/talento-bot
```

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;
    
    # SSL Configuration (will be added by certbot)
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Main application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Health check endpoint
    location /healthz {
        proxy_pass http://localhost:3000/healthz;
        access_log off;
    }
    
    # Static files (if any)
    location /static/ {
        alias /var/www/talento-bot/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Gzip compression
    gzip on;
    gzip_types
        text/plain
        text/css
        text/js
        text/xml
        text/javascript
        application/javascript
        application/json
        application/xml+rss;
}
```

### 3.2 Enable Site and SSL
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/talento-bot /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test SSL renewal
sudo certbot renew --dry-run
```

---

## 🐘 **4. PostgreSQL Database Setup**

### 4.1 Install PostgreSQL
```bash
sudo apt install -y postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 4.2 Create Database and User
```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE talento_bot;
CREATE USER talento_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE talento_bot TO talento_user;
\q
```

### 4.3 Run Database Migrations
```bash
# Run migration scripts
psql -h localhost -U talento_user -d talento_bot -f database_migrations/001_initial_schema.sql
psql -h localhost -U talento_user -d talento_bot -f database_migrations/002_analytics_schema.sql
psql -h localhost -U talento_user -d talento_bot -f database_migrations/003_user_management_system.sql
```

---

## 📡 **5. Redis Setup**

### 5.1 Install Redis
```bash
sudo apt install -y redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf
```

### 5.2 Redis Configuration
```bash
# Set password (uncomment and modify)
requirepass your_secure_redis_password

# Bind to localhost only
bind 127.0.0.1

# Enable persistence
save 900 1
save 300 10
save 60 10000
```

### 5.3 Start Redis
```bash
sudo systemctl restart redis-server
sudo systemctl enable redis-server

# Test Redis connection
redis-cli ping
# Should return PONG
```

---

## 🔐 **6. Security Hardening**

### 6.1 Firewall Configuration
```bash
# Enable UFW firewall
sudo ufw enable

# Allow SSH, HTTP, and HTTPS
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'

# Check firewall status
sudo ufw status
```

### 6.2 Fail2ban Setup
```bash
# Install fail2ban
sudo apt install -y fail2ban

# Create jail configuration
sudo nano /etc/fail2ban/jail.local
```

**Fail2ban Configuration:**
```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[ssh]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3
```

### 6.3 SSL Security
```bash
# Generate strong DH parameters
sudo openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048

# Add to Nginx configuration
ssl_dhparam /etc/ssl/certs/dhparam.pem;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
```

---

## 🔄 **7. Automated Deployment Setup**

### 7.1 GitHub Webhook Configuration
```bash
# Create deployment script
cat > /var/www/talento-bot/deploy.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Pull latest changes
git pull origin master

# Install/update dependencies
npm install --production

# Run database migrations if any
if [ -d "database_migrations" ]; then
    echo "📊 Running database migrations..."
    # Add migration logic here
fi

# Restart application
pm2 restart ecosystem.config.js

# Wait for application to start
sleep 5

# Health check
if curl -f http://localhost:3000/healthz; then
    echo "✅ Deployment successful!"
else
    echo "❌ Deployment failed - rolling back..."
    git reset --hard HEAD~1
    pm2 restart ecosystem.config.js
    exit 1
fi
EOF

# Make script executable
chmod +x /var/www/talento-bot/deploy.sh
```

### 7.2 GitHub Webhook Endpoint
Add this to your application:

```javascript
// Webhook endpoint for automated deployment
app.post('/api/deploy', authenticateWebhook, (req, res) => {
  if (req.body.ref !== 'refs/heads/master') {
    return res.json({ message: 'Only master branch triggers deployment' });
  }
  
  const { exec } = require('child_process');
  
  exec('/var/www/talento-bot/deploy.sh', (error, stdout, stderr) => {
    if (error) {
      console.error('Deployment failed:', error);
      return res.status(500).json({ error: 'Deployment failed' });
    }
    
    console.log('Deployment output:', stdout);
    res.json({ success: true, message: 'Deployment completed' });
  });
});
```

---

## 📊 **8. Monitoring and Logging**

### 8.1 Log Rotation
```bash
# Create logrotate configuration
sudo nano /etc/logrotate.d/talento-bot
```

```bash
/var/log/pm2/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 $USER $USER
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 8.2 System Monitoring
```bash
# Install monitoring tools
sudo apt install -y htop iotop nethogs

# Monitor application
pm2 monit

# Check system resources
htop

# Monitor network connections
ss -tulpn
```

### 8.3 Health Checks
```bash
# Create health check script
cat > /usr/local/bin/health-check.sh << 'EOF'
#!/bin/bash

# Check application health
if ! curl -f http://localhost:3000/healthz > /dev/null 2>&1; then
    echo "❌ Application health check failed"
    pm2 restart ecosystem.config.js
fi

# Check database connection
if ! pg_isready -h localhost -U talento_user > /dev/null 2>&1; then
    echo "❌ Database connection failed"
fi

# Check Redis connection
if ! redis-cli ping > /dev/null 2>&1; then
    echo "❌ Redis connection failed"
fi
EOF

# Make executable and add to cron
chmod +x /usr/local/bin/health-check.sh
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/health-check.sh") | crontab -
```

---

## ✅ **9. Deployment Verification**

### 9.1 Application Health
```bash
# Test API endpoints
curl https://your-domain.com/healthz
curl https://your-domain.com/api/health

# Check application logs
pm2 logs

# Verify database connection
psql -h localhost -U talento_user -d talento_bot -c "SELECT 1;"

# Test Redis connection
redis-cli ping
```

### 9.2 Performance Tests
```bash
# Install Apache Bench
sudo apt install -y apache2-utils

# Test API performance
ab -n 1000 -c 10 https://your-domain.com/healthz

# Test WebSocket connections
# (Add specific tests based on your application)
```

### 9.3 Security Verification
```bash
# Test SSL configuration
ssl-cert-check -b -c /etc/letsencrypt/live/your-domain.com/cert.pem

# Check for security headers
curl -I https://your-domain.com

# Verify firewall rules
sudo ufw status verbose
```

---

## 📋 **Deployment Checklist**

### Pre-Deployment
- [ ] ✅ Server provisioned and updated
- [ ] ✅ Domain DNS configured
- [ ] ✅ SSL certificate obtained
- [ ] ✅ Database and Redis installed
- [ ] ✅ Environment variables configured
- [ ] ✅ Security hardening applied

### Deployment
- [ ] ✅ Application code deployed
- [ ] ✅ Dependencies installed
- [ ] ✅ Database migrations run
- [ ] ✅ PM2 processes started
- [ ] ✅ Nginx configuration applied
- [ ] ✅ Health checks passing

### Post-Deployment
- [ ] ✅ Automated deployment configured
- [ ] ✅ Monitoring and logging setup
- [ ] ✅ Backup procedures implemented
- [ ] ✅ Documentation updated
- [ ] ✅ Team access configured

---

## 🆘 **Troubleshooting**

### Common Issues

**Application won't start:**
```bash
# Check logs
pm2 logs

# Check environment variables
cat .env

# Test database connection
psql -h localhost -U talento_user -d talento_bot -c "SELECT 1;"
```

**502 Bad Gateway:**
```bash
# Check if application is running
pm2 status

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Restart services
pm2 restart all
sudo systemctl restart nginx
```

**SSL Certificate Issues:**
```bash
# Renew certificate
sudo certbot renew

# Check certificate status
sudo certbot certificates

# Test SSL configuration
ssl-cert-check -c /etc/letsencrypt/live/your-domain.com/cert.pem
```

---

**🎯 Result**: Production-ready deployment with automated deployment, monitoring, security, and high availability.
