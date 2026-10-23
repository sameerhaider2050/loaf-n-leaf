@echo off
title Build Loaf n Leaf Windows Desktop POS App
color 0B

echo =======================================================
echo     BUILDING LOAF N LEAF WINDOWS DESKTOP APP
echo =======================================================
echo.

cd /d "%~dp0flutter_app"

echo [1/3] Checking Flutter SDK...
where flutter >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Flutter SDK not found in PATH!
    echo Please install Flutter from https://docs.flutter.dev/get-started/install/windows
    echo and add flutter\bin to your system PATH.
    pause
    exit /b 1
)

echo [2/3] Fetching Flutter dependencies...
call flutter pub get

echo [3/3] Compiling Release Windows Executable...
call flutter build windows --release

if %errorlevel% equ 0 (
    echo.
    echo =======================================================
    echo   BUILD SUCCESSFUL!
    echo   Executable located at:
    echo   flutter_app\build\windows\x64\runner\Release\loaf_n_leaf_pos.exe
    echo =======================================================
) else (
    echo.
    echo [ERROR] Build failed. Please inspect logs above.
)

pause
