#!/bin/bash

echo "========================================"
echo "Building Spotify Alt for Production"
echo "========================================"
echo ""

echo "[1/3] Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "Failed to install dependencies"
    exit 1
fi

echo ""
echo "[2/3] Building production bundle..."
npm run build
if [ $? -ne 0 ]; then
    echo "Build failed"
    exit 1
fi

echo ""
echo "[3/3] Build complete!"
echo "========================================"
echo ""
echo "Production files are in: dist/"
echo ""
echo "To preview: npm run preview"
echo "To deploy: Serve the dist/ folder"
echo ""
echo "========================================"
