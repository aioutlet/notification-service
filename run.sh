#!/bin/bash
# Run Notification Service with Dapr sidecar
# Usage: ./run.sh

echo "Starting Notification Service with Dapr..."
echo "Service will be available at: http://localhost:1011"
echo "Dapr HTTP endpoint: http://localhost:3511"
echo "Dapr gRPC endpoint: localhost:50011"
echo ""

dapr run \
  --app-id notification-service \
  --app-port 1011 \
  --dapr-http-port 3511 \
  --dapr-grpc-port 50011 \
  --resources-path .dapr/components \
  --config .dapr/config.yaml \
  --log-level warn \
  -- npx tsx watch src/server.ts
