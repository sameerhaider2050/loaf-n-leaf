@echo off
title Authorize This PC as Admin - Loaf n Leaf
color 0A

echo =======================================================
echo     AUTHORIZING THIS PC FOR ADMINISTRATOR ACCESS
echo =======================================================
echo.

cd /d "%~dp0"
node scripts/authorize_admin_device.js

echo.
echo =======================================================
echo   Done! You can now log into Admin at:
echo   http://localhost:5000
echo.
echo   Admin Login:
echo     Quick PIN: 1234 or 2007
echo     Username: admin
echo     Password: admin123 (or admin password)
echo =======================================================
pause
