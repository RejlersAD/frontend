# Frontend Cache Management Guide

## Problem
When pulling code from different developers, you may encounter errors like:
- `Uncaught TypeError: createTheme_default is not a function`
- `Uncaught TypeError: styled_default is not a function`
- Other "xxx is not a function" errors

These are caused by **Vite's dependency pre-bundling cache** becoming stale after pulling changes.

## Permanent Solution (Soft-Coded)

### 🔧 Automatic Cache Clearing

The frontend now includes automatic cache management:

1. **Auto-clean on dev start**: Running `npm run dev` automatically clears Vite cache
2. **Force clean**: Use `npm run dev:force` to clear ALL caches and force re-optimization
3. **Post-pull helper**: Run cleanup scripts after pulling code

### 📋 Recommended Workflow

#### After Pulling Code (Windows):
```powershell
# Option 1: Run cleanup script
./clean-after-pull.ps1

# Option 2: Use npm script
npm run postpull

# Option 3: Manual cleanup
npm run clean:all && npm install
```

#### After Pulling Code (Linux/Mac):
```bash
# Option 1: Run cleanup script
chmod +x clean-after-pull.sh
./clean-after-pull.sh

# Option 2: Use npm script
npm run postpull

# Option 3: Manual cleanup
npm run clean:all && npm install
```

### 🚀 Available NPM Scripts

```json
{
  "dev": "vite",                        // Normal dev (auto-cleans cache)
  "dev:force": "...",                   // Force clean everything + dev
  "clean:cache": "...",                 // Clean only Vite cache
  "clean:all": "...",                   // Clean all caches and builds
  "postpull": "..."                     // Run after git pull
}
```

### 🐳 Docker Containers

Containers automatically handle cache clearing:
- Vite cache is not persisted between builds
- Each container build starts fresh
- If issues persist, rebuild: `docker compose --profile local build --no-cache frontend_local`

### 🔍 Why This Happens

Vite pre-bundles dependencies for faster dev server startup. When you:
1. Pull code with updated dependencies
2. Switch branches
3. Merge changes from other developers

...the cached pre-bundled modules may become incompatible with the new code.

### 💡 Prevention Tips

1. **Always run cleanup after pulling**: Make it a habit
2. **Use the auto-clean scripts**: They're configured to run automatically
3. **Force re-optimization when in doubt**: `npm run dev:force`
4. **Keep dependencies in sync**: Regular `npm install` after pulls

### ⚙️ Technical Details

The solution includes:
- **Vite config**: Forces dependency re-optimization in development
- **Pre-dev hook**: Clears cache before starting dev server
- **Optimized deps list**: Explicitly includes MUI and React dependencies
- **.npmrc**: Ensures consistent dependency resolution
- **Helper scripts**: Easy cleanup for all platforms

### 🛠️ Troubleshooting

If you still see errors after cleanup:

```bash
# 1. Nuclear option - remove everything and reinstall
rm -rf node_modules package-lock.json
npm install

# 2. Clear browser cache
# Chrome: Ctrl+Shift+Delete, clear "Cached images and files"

# 3. Rebuild Docker container
docker compose --profile local build --no-cache frontend_local
docker compose --profile local up
```

### 📝 For Team Members

**After pulling code, simply run:**
```bash
npm run postpull
```

This will:
1. Clean Vite cache
2. Reinstall dependencies if needed
3. Prepare for a clean dev server start
