@echo off
REM Run notification-service with Dapr sidecar

echo.
echo [92m========================================[0m
echo [92m Starting Notification Service with Dapr[0m
echo [92m========================================[0m
echo.

REM Load environment variables from .env file
if exist .env (
    for /f "usebackq tokens=*" %%a in (".env") do (
        echo %%a | findstr /v /r "^#" | findstr /r "=" > nul
        if not errorlevel 1 set %%a
    )
)

REM Dapr configuration
set APP_ID=notification-service
if not defined HEALTH_PORT set HEALTH_PORT=3003
if not defined DAPR_HTTP_PORT set DAPR_HTTP_PORT=3503
if not defined DAPR_GRPC_PORT set DAPR_GRPC_PORT=50003
if not defined DAPR_METRICS_PORT set DAPR_METRICS_PORT=9093

echo [93mConfiguration:[0m
echo   App ID: %APP_ID%
echo   App Port: %HEALTH_PORT%
echo   Dapr HTTP Port: %DAPR_HTTP_PORT%
echo   Dapr gRPC Port: %DAPR_GRPC_PORT%
echo   Dapr Metrics Port: %DAPR_METRICS_PORT%
echo.

REM Run with Dapr
set DAPR_ENABLED=true
dapr run ^
  --app-id %APP_ID% ^
  --app-port %HEALTH_PORT% ^
  --dapr-http-port %DAPR_HTTP_PORT% ^
  --dapr-grpc-port %DAPR_GRPC_PORT% ^
  --metrics-port %DAPR_METRICS_PORT% ^
  --components-path .\.dapr\components ^
  --config .\.dapr\config.yaml ^
  --log-level info ^
  -- npm run dev
