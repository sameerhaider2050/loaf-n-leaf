@echo off
title Loaf n Leaf Local Server & POS Backend
color 0A

echo =======================================================
echo     LOAF N LEAF RESTAURANT MANAGEMENT SYSTEM
echo          Local Authoritative Server Engine
echo =======================================================
echo.

cd /d "%~dp0backend"

echo [1/3] Checking Python runtime...
python --version
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH!
    pause
    exit /b 1
)

echo [2/3] Verifying dependencies...
pip install -r requirements.txt --quiet

echo [3/3] Starting FastAPI Server on port 8000...
echo Server running at: http://localhost:8000
echo API Documentation: http://localhost:8000/docs
echo.
echo Press CTRL+C to stop server.
echo.

python run.py
pause
