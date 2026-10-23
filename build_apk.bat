@echo off
title Build Loaf n Leaf Android POS APK
color 0E

echo =======================================================
echo     BUILDING LOAF N LEAF ANDROID APK
echo =======================================================
echo.

cd /d "%~dp0flutter_app"

echo [1/3] Checking Flutter SDK...
where flutter >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Flutter SDK not found in PATH!
    echo Please install Flutter and Android SDK.
    pause
    exit /b 1
)

echo [2/3] Fetching Flutter dependencies...
call flutter pub get

echo [3/3] Compiling Release Android APK...
call flutter build apk --release

if %errorlevel% equ 0 (
    echo.
    echo =======================================================
    echo   BUILD SUCCESSFUL!
    echo   Android APK located at:
    echo   flutter_app\build\app\outputs\flutter-apk\app-release.apk
    echo =======================================================
) else (
    echo.
    echo [ERROR] Build failed. Please inspect logs above.
)

pause
