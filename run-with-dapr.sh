#!/bin/bash
# Run notification-service with Dapr sidecar

# Colors for output
GREEN='\033[0.32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Notification Service with Dapr...${NC}"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Dapr configuration
APP_ID="notification-service"
APP_PORT="${HEALTH_PORT:-3003}"
DAPR_HTTP_PORT="${DAPR_HTTP_PORT:-3503}"
DAPR_GRPC_PORT="${DAPR_GRPC_PORT:-50003}"
DAPR_METRICS_PORT="${DAPR_METRICS_PORT:-9093}"

echo -e "${YELLOW}📋 Configuration:${NC}"
echo "  App ID: $APP_ID"
echo "  App Port: $APP_PORT"
echo "  Dapr HTTP Port: $DAPR_HTTP_PORT"
echo "  Dapr gRPC Port: $DAPR_GRPC_PORT"
echo "  Dapr Metrics Port: $DAPR_METRICS_PORT"
echo ""

# Run with Dapr
DAPR_ENABLED=true dapr run \
  --app-id "$APP_ID" \
  --app-port "$APP_PORT" \
  --dapr-http-port "$DAPR_HTTP_PORT" \
  --dapr-grpc-port "$DAPR_GRPC_PORT" \
  --metrics-port "$DAPR_METRICS_PORT" \
  --components-path ./.dapr/components \
  --config ./.dapr/config.yaml \
  --log-level info \
  -- npm run dev
