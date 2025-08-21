#!/bin/bash

# Notification Service Simple Setup
# This script sets up the notification service using simplified configuration (.env file)

set -e

SERVICE_NAME="notification-service"
SERVICE_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# OS detection function
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        echo "windows"
    else
        echo "unknown"
    fi
}

# Check for Node.js
check_nodejs() {
    log_info "Checking Node.js installation..."
    
    if command_exists node; then
        NODE_VERSION=$(node --version)
        log_success "Node.js $NODE_VERSION is installed"
    else
        log_error "Node.js is not installed. Please install Node.js 18+"
        exit 1
    fi
    
    if command_exists npm; then
        NPM_VERSION=$(npm --version)
        log_success "npm $NPM_VERSION is installed"
    else
        log_error "npm is not installed. Please install npm"
        exit 1
    fi
}

# Install dependencies
install_dependencies() {
    log_info "Installing Node.js dependencies..."
    cd "$SERVICE_PATH"
    
    if npm install; then
        log_success "Dependencies installed successfully"
    else
        log_error "Failed to install dependencies"
        exit 1
    fi
}

# Create environment file if it doesn't exist
create_env_template() {
    local env_file="$SERVICE_PATH/.env"
    
    if [ ! -f "$env_file" ]; then
        log_info "Creating .env template (Node.js standard)"
        
        cat > "$env_file" << EOF
# Notification Service Environment Configuration

# Server Configuration
NODE_ENV=development
PORT=3003
HOST=localhost
API_VERSION=1.0.0

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=notification_service_dev
DB_USER=notification_user
DB_PASSWORD=notification_dev_pass_123

# SMTP Configuration (for email notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@aioutlet.com

# Twilio Configuration (for SMS notifications)
TWILIO_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_FROM_NUMBER=+1234567890

# Firebase Configuration (for push notifications)
FCM_SERVER_KEY=your-fcm-server-key

# RabbitMQ Configuration
RABBITMQ_URL=amqp://admin:admin123@localhost:5672
RABBITMQ_EXCHANGE=notifications
RABBITMQ_QUEUE=notification-queue

# JWT Configuration
JWT_SECRET=notification_service_jwt_secret_dev_123

# Logging Configuration
LOG_LEVEL=debug
LOG_TO_FILE=false
LOG_TO_CONSOLE=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF
        log_success "Environment template created: .env"
    else
        log_info "Environment file already exists: .env"
    fi
}

# Validate setup
validate_setup() {
    log_info "Validating setup..."
    
    # Check if package.json exists
    if [ ! -f "$SERVICE_PATH/package.json" ]; then
        log_error "package.json not found"
        return 1
    fi
    
    # Check if node_modules exists
    if [ ! -d "$SERVICE_PATH/node_modules" ]; then
        log_error "node_modules not found - dependencies may not be installed"
        return 1
    fi
    
    log_success "Setup validation completed"
    return 0
}

# Main execution
main() {
    echo "🚀 Setting up notification-service for development..."
    echo "=========================================="
    echo "🔔 Notification Service Environment Setup"
    echo "=========================================="
    
    OS=$(detect_os)
    log_info "Detected OS: $OS"
    log_info "Using Node.js standard .env configuration"
    
    # Create environment file if it doesn't exist
    create_env_template
    
    # Check prerequisites
    check_nodejs
    
    # Install dependencies
    install_dependencies
    
    # Database setup managed by Docker Compose
    log_info "Database setup managed by Docker Compose"
    log_info "Database: notification_service_dev"
    log_info "User: notification_user"
    log_success "Database configuration ready for Docker Compose"
    
    # Validate setup
    if validate_setup; then
        echo "=========================================="
        log_success "✅ Notification Service setup completed successfully!"
        echo "=========================================="
        echo ""
        
        # Start services with Docker Compose
        log_info "🐳 Starting services with Docker Compose..."
        if docker-compose up -d; then
            log_success "Services started successfully"
            echo ""
            log_info "⏳ Waiting for services to be ready..."
            sleep 15
            
            # Check service health
            if docker-compose ps | grep -q "Up.*healthy"; then
                log_success "Services are healthy and ready"
            else
                log_warning "Services may still be starting up"
            fi
        else
            log_error "Failed to start services with Docker Compose"
            return 1
        fi
        echo ""
        
        echo "📧 Setup Summary:"
        echo "  • Environment: development"
        echo "  • Port: 3003"
        echo "  • Database: notification_service_dev"
        echo "  • Health Check: http://localhost:3003/health"
        echo "  • API Base: http://localhost:3003/api"
        echo ""
        echo "📧 Notification Features:"
        echo "  • Email Notifications (SMTP)"
        echo "  • SMS Notifications (Twilio)"
        echo "  • Push Notifications (FCM)"
        echo "  • Webhook Notifications"
        echo "  • Template System"
        echo "  • RabbitMQ Integration"
        echo ""
        echo "🚀 Service is now running:"
        echo "  • View status: docker-compose ps"
        echo "  • View logs: docker-compose logs -f"
        echo "  • Stop services: bash .ops/teardown.sh"
        echo ""
    else
        log_error "Setup validation failed"
        exit 1
    fi
}

# Run main function
main "$@"
