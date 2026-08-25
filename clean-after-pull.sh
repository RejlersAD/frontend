#!/bin/bash
# ==============================================================================
# Post-Pull Cache Cleaner for RADAI Frontend (Linux/Mac)
# ==============================================================================
# Purpose: Automatically clean Vite and node caches after pulling code
# Usage: ./clean-after-pull.sh
# ==============================================================================

echo "🧹 Cleaning frontend caches after git pull..."

# Navigate to frontend directory
cd "$(dirname "$0")"

# Clean Vite cache
echo "📦 Removing Vite cache..."
rm -rf node_modules/.vite
rm -rf .vite
rm -rf dist
rm -rf dev-dist

echo "✅ Cache cleaned successfully!"
echo ""
echo "💡 Tip: Run 'npm run dev:force' to start dev server with fresh cache"
echo "💡 Or run 'npm install' if dependencies changed"
