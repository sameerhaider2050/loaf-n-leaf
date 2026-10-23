#!/usr/bin/env bash
set -e

echo "======================================================="
echo "    BUILDING LOAF N LEAF ANDROID APK (LINUX/MAC)"
echo "======================================================="

cd "$(dirname "$0")/flutter_app"

echo "[1/3] Checking Flutter SDK..."
if ! command -v flutter &> /dev/null; then
    echo "[ERROR] flutter command not found in PATH!"
    exit 1
fi

echo "[2/3] Fetching Flutter dependencies..."
flutter pub get

echo "[3/3] Compiling Release Android APK..."
flutter build apk --release

echo "Build complete: flutter_app/build/app/outputs/flutter-apk/app-release.apk"
