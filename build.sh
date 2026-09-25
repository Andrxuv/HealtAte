#!/bin/bash
# Render build script — runs from repo root
set -e

echo "=== Building frontend ==="
cd "$(dirname "$0")/frontend"
npm install
npm run build

echo "=== Installing backend deps ==="
cd "$(dirname "$0")/backend"
npm install

echo "=== Build complete ==="
