@echo off
:loop
echo.
echo ============================================
echo Starting notification service...
echo ============================================
echo.

REM Check if port 3003 is in use and kill the process
echo Checking port 3003...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3003 ^| findstr LISTENING') do (
    echo Port 3003 is in use by PID %%a, killing process...
    taskkill /PID %%a /F >nul 2>&1
    timeout /t 1 >nul
)

echo Starting service on port 3003...
npm run dev

echo.
echo ============================================
echo Service stopped. Press any key to restart or Ctrl+C to exit.
echo ============================================
pause > nul
goto loop
