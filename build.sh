#!/bin/bash

# Echode Build Script

echo "Starting build process..."

# 1. Install/Check Root Dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing root dependencies..."
    npm install
else
    echo "Root dependencies found."
fi

# 2. Build Webview UI
echo "Building Webview UI..."
cd webview-ui

if [ ! -d "node_modules" ]; then
    echo "Installing webview dependencies..."
    npm install
fi

npm run build
if [ $? -ne 0 ]; then
    echo "Webview build failed."
    exit 1
fi
cd ..

# 3. Package Extension
echo "Packaging extension..."
npm run package:vsix

if [ $? -eq 0 ]; then
    echo "Build complete! Artifact is in ./builds/"
else
    echo "Packaging failed."
    exit 1
fi