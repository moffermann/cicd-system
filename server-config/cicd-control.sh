#!/bin/bash

# CI/CD Webhook Server Control Script
# Usage: ./cicd-control.sh {start|stop|restart|status|logs|install}

SERVICE_NAME="cicd-webhook"
SERVICE_FILE="cicd-webhook.service"
NGINX_CONF="nginx-cicd.conf"
PROJECT_DIR="/opt/cicd-system"

case "$1" in
    start)
        echo "🚀 Starting CI/CD Webhook Server..."
        sudo systemctl start $SERVICE_NAME
        echo "✅ Service started"
        systemctl status $SERVICE_NAME --no-pager
        ;;
    
    stop)
        echo "🛑 Stopping CI/CD Webhook Server..."
        sudo systemctl stop $SERVICE_NAME
        echo "✅ Service stopped"
        ;;
    
    restart)
        echo "🔄 Restarting CI/CD Webhook Server..."
        sudo systemctl restart $SERVICE_NAME
        echo "✅ Service restarted"
        systemctl status $SERVICE_NAME --no-pager
        ;;
    
    status)
        echo "📊 CI/CD Webhook Server Status:"
        systemctl status $SERVICE_NAME --no-pager
        echo ""
        echo "🌐 Port Status:"
        netstat -tlnp | grep :8765 || echo "Port 8765 not listening"
        echo ""
        echo "🗄️ Database Status:"
        ls -la $PROJECT_DIR/data/cicd-system.db 2>/dev/null || echo "Database not found"
        ;;
    
    logs)
        echo "📝 CI/CD Webhook Server Logs (last 50 lines):"
        journalctl -u $SERVICE_NAME -n 50 --no-pager
        echo ""
        echo "📋 Follow logs with: journalctl -u $SERVICE_NAME -f"
        ;;
    
    install)
        echo "📦 Installing CI/CD Webhook Server..."
        
        # Copy service file
        echo "Installing systemd service..."
        sudo cp $PROJECT_DIR/server-config/$SERVICE_FILE /etc/systemd/system/
        sudo systemctl daemon-reload
        sudo systemctl enable $SERVICE_NAME
        echo "✅ Service installed and enabled"
        
        # Copy nginx configuration
        echo "Installing nginx configuration..."
        sudo cp $PROJECT_DIR/server-config/$NGINX_CONF /etc/nginx/sites-available/cicd.gocode.cl
        sudo ln -sf /etc/nginx/sites-available/cicd.gocode.cl /etc/nginx/sites-enabled/
        
        # Test nginx configuration
        sudo nginx -t
        if [ $? -eq 0 ]; then
            sudo systemctl reload nginx
            echo "✅ Nginx configuration installed and reloaded"
        else
            echo "❌ Nginx configuration error - please check"
            exit 1
        fi
        
        # Create necessary directories
        sudo mkdir -p $PROJECT_DIR/data $PROJECT_DIR/logs
        sudo chown -R ubuntu:ubuntu $PROJECT_DIR/data $PROJECT_DIR/logs
        echo "✅ Directories created"
        
        # Initialize database with sample projects
        echo "Initializing database..."
        cd $PROJECT_DIR && node -e "
        const { getDatabase } = require('./src/database/DatabaseManager.cjs');
        const db = getDatabase();
        
        // Add cicd-system project
        db.upsertProject({
          name: 'cicd-system',
          github_repo: 'moffermann/cicd-system',
          production_url: 'https://cicd.gocode.cl',
          staging_url: 'https://staging-cicd.gocode.cl',
          deploy_path: '/opt/cicd-system',
          main_branch: 'master',
          webhook_secret: null
        });
        
        console.log('✅ Database initialized with cicd-system project');
        db.close();
        "
        
        echo ""
        echo "🎉 Installation complete!"
        echo "To start the service: $0 start"
        echo "To check status: $0 status"
        echo "To view logs: $0 logs"
        ;;
    
    update)
        echo "🔄 Updating CI/CD System..."
        cd $PROJECT_DIR
        git pull origin master
        npm install --production
        sudo systemctl restart $SERVICE_NAME
        echo "✅ Update complete"
        ;;
    
    test)
        echo "🧪 Testing CI/CD System..."
        
        # Test local server
        echo "Testing local server..."
        curl -s http://localhost:8765/health | jq . || echo "Local server not responding"
        
        # Test external access
        echo "Testing external access..."
        curl -s https://cicd.gocode.cl/health | jq . || echo "External access not working"
        
        # Show database status
        echo "Database projects:"
        cd $PROJECT_DIR && node -e "
        const { getDatabase } = require('./src/database/DatabaseManager.cjs');
        const db = getDatabase();
        const projects = db.getAllProjects();
        console.log(JSON.stringify(projects, null, 2));
        db.close();
        "
        ;;
    
    *)
        echo "Usage: $0 {start|stop|restart|status|logs|install|update|test}"
        echo ""
        echo "Commands:"
        echo "  start     - Start the webhook server"
        echo "  stop      - Stop the webhook server"  
        echo "  restart   - Restart the webhook server"
        echo "  status    - Show server status"
        echo "  logs      - Show recent logs"
        echo "  install   - Install service and nginx config"
        echo "  update    - Update from git and restart"
        echo "  test      - Test system functionality"
        exit 1
        ;;
esac

exit 0