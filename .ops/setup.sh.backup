#!/bin/bash

# Admin Service Setup
# This script sets up the admin service using simplified configuration (.env file)

set -e

SERVICE_NAME="admin-service"
SERVICE_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Parse command line arguments (simplified - only help)
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            echo "Usage: $0"
            echo ""
            echo "This script sets up the admin service using .env configuration"
            echo "Docker Compose file contains hardcoded development secrets"
            echo ""
            echo "Options:"
            echo "  -h, --help           Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

echo "🚀 Setting up $SERVICE_NAME with simplified configuration..."

# Color codes for output
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

# Function to validate environment file
validate_env_file() {
    local env_file="$1"
    local required_vars=(
        "PORT"
        "NODE_ENV" 
        "SERVICE_NAME"
        "JWT_SECRET"
        "USER_SERVICE_URL"
    )
    
    if [ ! -f "$env_file" ]; then
        log_error "Environment file not found: $env_file"
        return 1
    fi
    
    log_info "Validating environment file: $env_file"
    
    local missing_vars=()
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$env_file"; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        log_error "Missing required environment variables in $env_file:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        return 1
    fi
    
    log_success "Environment file validation passed"
    return 0
}

# Function to install dependencies
install_dependencies() {
    log_info "Installing Node.js dependencies..."
    
    if [ ! -f "package.json" ]; then
        log_error "package.json not found in $SERVICE_PATH"
        return 1
    fi
    
    if command -v npm >/dev/null 2>&1; then
        if npm install; then
            log_success "Dependencies installed successfully"
        else
            log_error "Failed to install dependencies"
            return 1
        fi
    else
        log_error "npm not found. Please install Node.js and npm"
        return 1
    fi
}

# Function to setup environment
setup_environment() {
    local env_file=".env"
    
    log_info "Setting up environment configuration..."
    
    # Check if .env file exists
    if [ ! -f "$env_file" ]; then
        log_error "Environment file $env_file not found"
        log_info "Available environment files:"
        ls -la .env* 2>/dev/null || echo "  No .env* files found"
        return 1
    fi
    
    # Validate the environment file
    if ! validate_env_file "$env_file"; then
        return 1
    fi
    
    log_success "Using environment file: $env_file"
    
    # Show key configuration
    local port=$(grep "^PORT=" "$env_file" | cut -d'=' -f2 2>/dev/null || echo "3010")
    local node_env=$(grep "^NODE_ENV=" "$env_file" | cut -d'=' -f2 2>/dev/null || echo "development")
    local service_name=$(grep "^SERVICE_NAME=" "$env_file" | cut -d'=' -f2 2>/dev/null || echo "admin-service")
    
    log_info "Environment configuration:"
    echo "  🌍 Environment: $node_env"
    echo "  🚪 Port: $port"
    echo "  📦 Service: $service_name"
}

# Function to verify setup
verify_setup() {
    log_info "Verifying setup..."
    
    # Check required files
    local required_files=(".env" "package.json" "src/app.js")
    for file in "${required_files[@]}"; do
        if [ -f "$file" ]; then
            log_success "✅ $file exists"
        else
            log_warning "⚠️  $file not found"
        fi
    done
    
    # Check node_modules
    if [ -d "node_modules" ]; then
        log_success "✅ Dependencies installed"
    else
        log_warning "⚠️  node_modules directory not found"
    fi
    
    # Load environment variables and check external services
    if [ -f ".env" ]; then
        source .env
        log_info "External service configuration:"
        echo "  👥 User Service: ${USER_SERVICE_URL:-Not configured}"
    fi
}

# Main setup process
main() {
    cd "$SERVICE_PATH"
    
    log_info "📍 Working directory: $SERVICE_PATH"
    log_info "🎯 Using simplified configuration (.env file)"
    echo ""
    
    # Step 1: Setup environment configuration
    if setup_environment; then
        log_success "✅ Environment setup completed"
    else
        log_error "❌ Environment setup failed"
        exit 1
    fi
    echo ""
    
    # Step 2: Install dependencies
    if install_dependencies; then
        log_success "✅ Dependencies installation completed"
    else
        log_error "❌ Dependencies installation failed"
        exit 1
    fi
    echo ""
    
    # Step 3: Verify setup
    verify_setup
    echo ""
    
    # Step 4: Start services with Docker Compose
    log_info "🐳 Starting services with Docker Compose..."
    if docker-compose up -d; then
        log_success "Services started successfully"
        echo ""
        log_info "⏳ Waiting for services to be ready..."
        sleep 10
        
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
    
    log_success "🎉 $SERVICE_NAME setup completed successfully!"
    echo ""
    log_info "💡 Service is now running:"
    echo "  • Docker containers: docker-compose ps"
    echo "  • View logs: docker-compose logs -f"
    echo "  • Stop services: bash .ops/teardown.sh"
    echo ""
    log_info "🔗 Service endpoints:"
    echo "  • Service: http://localhost:3010"
}

# Execute main function
main "$@"
