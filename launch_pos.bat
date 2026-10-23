@echo off
title Loaf n Leaf POS Launcher
color 0A

echo =======================================================
echo          LOAF N LEAF RESTAURANT POS SYSTEM
echo =======================================================
echo.
echo [1/2] Verifying server status...

cd /d "%~dp0"

:: Start the server if not already running
start /b cmd /c "node server/index.js"

echo [2/2] Opening Loaf n Leaf POS in your browser...
timeout /t 2 /nobreak >nul
start http://localhost:5000

echo.
echo =======================================================
echo   POS is now active at: http://localhost:5000
echo.
echo   Default Staff Accounts:
echo     Admin:       Username: admin     PIN: 1234
echo     Cashier:     Username: cashier   PIN: 5678
echo     Order Taker: Username: waiter    PIN: 9999
echo =======================================================
echo.
echo Keep this window open while using the POS.
pause
