#!/usr/bin/env pwsh
# ==============================================================================
# Post-Pull Cache Cleaner for RADAI Frontend
# ==============================================================================
# Purpose: Automatically clean Vite and node caches after pulling code
# Usage: ./clean-after-pull.ps1
# ==============================================================================

Write-Host "🧹 Cleaning frontend caches after git pull..." -ForegroundColor Cyan

# Navigate to frontend directory
$frontendPath = $PSScriptRoot
Set-Location $frontendPath

# Clean Vite cache
Write-Host "📦 Removing Vite cache..." -ForegroundColor Yellow
Remove-Item -Path "node_modules/.vite" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path ".vite" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "dist" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "dev-dist" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "✅ Cache cleaned successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Tip: Run 'npm run dev:force' to start dev server with fresh cache" -ForegroundColor Cyan
Write-Host "💡 Or run 'npm install' if dependencies changed" -ForegroundColor Cyan
