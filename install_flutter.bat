@echo off
title Install Flutter SDK for Loaf n Leaf
color 0B

echo =======================================================
echo          FLUTTER SDK AUTOMATIC INSTALLER
echo =======================================================
echo.
echo Installing Flutter SDK into: %USERPROFILE%\flutter
echo.

where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git is required to download Flutter. Please install Git first.
    pause
    exit /b 1
)

if exist "%USERPROFILE%\flutter\bin\flutter.bat" (
    echo [INFO] Flutter already exists at %USERPROFILE%\flutter.
) else (
    echo [1/3] Cloning Flutter stable branch (this may take a few minutes)...
    git clone https://github.com/flutter/flutter.git -b stable "%USERPROFILE%\flutter"
)

echo.
echo [2/3] Adding Flutter to User PATH...
powershell -Command "[Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') + ';%USERPROFILE%\flutter\bin', 'User')"

set "PATH=%PATH%;%USERPROFILE%\flutter\bin"

echo.
echo [3/3] Verifying Flutter installation...
call "%USERPROFILE%\flutter\bin\flutter.bat" doctor

echo.
echo =======================================================
echo   Flutter SDK installation complete!
echo   You can now run build_windows.bat or build_apk.bat
echo =======================================================
pause
