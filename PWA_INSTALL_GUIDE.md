# 🚀 RADAI PWA Installation Guide

## Quick Test (5 minutes)

### 1. Open the App
```
http://localhost:5173/
```

### 2. Open Browser Console
Press `F12` → Click **Console** tab

### 3. Look for These Logs:
```
🚀 PWA: Component mounted, checking installation status...
📱 PWA: Install button visible
✅ PWA: 1 service worker(s) registered
   - SW State: activated
✅ PWA: Service Worker is ready and active
📍 PWA: Running on http://localhost:5173
```

**If you see:** `✅✅✅ PWA: beforeinstallprompt event captured!`
→ **GREAT!** Browser supports one-click install

**If you see:** `⚠️ PWA: No beforeinstallprompt event after 2 seconds`
→ **NORMAL on localhost** - Manual install required

---

## 📥 Installing RADAI as Desktop App

### Method 1: One-Click Install (If Available)

1. Click the **"Download Desktop App"** button (bottom-right)
2. Browser's native install popup appears
3. Click **"Install"**
4. ✅ Done! App installs to Desktop & Start Menu

### Method 2: Manual Install from Browser Menu

#### **Chrome / Edge:**

**Option A - Install Icon:**
1. Look for 🖥️ icon in address bar (right side)
2. Click it → "Install RADAI"
3. Confirm

**Option B - Menu:**
1. Click **⋮** (three dots) top-right
2. **"Install RADAI"** or **"Cast, save and share"** → **"Install"**
3. Confirm

#### **Firefox:**
1. Click **≡** menu
2. **"Install app"**
3. Confirm

#### **Safari (Mac/iOS):**
1. Share button **📤**
2. **"Add to Home Screen"**
3. **"Add"**

---

## 🔍 Troubleshooting

### ❌ "Download Desktop App" Button Not Visible

**Check:**
1. Hard refresh: `Ctrl + Shift + R`
2. Console logs (F12) - look for errors
3. Not already installed (check if already running in standalone mode)

**Fix:**
- Clear browser cache
- Use Chrome/Edge (best PWA support)

### ❌ Clicking Button Does Nothing

**Check Console:**
```
🖱️ PWA: Install button clicked!
   - Has deferred prompt: false
   - Service Worker ready: true
ℹ️ PWA: No native prompt available, showing installation modal
```

**This means:**
- Browser doesn't support auto-install on localhost (normal!)
- Modal should appear with manual instructions
- Follow the manual install steps

### ❌ Modal Shows But Install Fails

**Try:**
1. Follow browser-specific steps in modal
2. Look for install icon in address bar
3. Check browser supports PWA (Chrome/Edge recommended)

### ❌ Service Worker Not Registering

**Console shows:** `❌ PWA: Service Worker error`

**Fix:**
1. Check if running on `http://localhost:5173/` (correct URL)
2. Clear Service Workers:
   - F12 → Application → Service Workers → Unregister
   - Hard refresh
3. Restart dev server:
   ```powershell
   cd frontend
   npm run dev
   ```

---

## ✅ How to Verify Installation

### Check if Installed:

1. **Start Menu** - Search "RADAI"
2. **Desktop** - Look for RADAI shortcut
3. **Open the app** - Should run in standalone window (no browser address bar)
4. **Console** (in standalone app):
   ```
   ✅ PWA: Already installed (running in standalone mode)
   ```

### App Should:
- ✅ Open in own window (no browser UI)
- ✅ Have RADAI icon
- ✅ Work offline (after first load)
- ✅ Auto-update when we deploy changes

---

## 🧪 Advanced Testing

### Test Page:
```
http://localhost:5173/pwa-test.html
```

**Shows:**
- Service worker status
- beforeinstallprompt event status
- Install button if supported
- Real-time diagnostic logs

---

## 📝 Notes for Developers

### PWA on Localhost:
- `beforeinstallprompt` event **may not fire** in dev mode
- This is **normal browser behavior**
- Manual install always works (browser menu)
- Production (HTTPS) has better auto-install support

### Debugging:
- All console logs prefixed with `PWA:`
- Key markers:
  - `🚀` = Component loaded
  - `✅✅✅` = Native install available
  - `⚠️` = Warning (usually normal)
  - `❌` = Error (needs attention)

### Production vs Localhost:

| Feature | Localhost | Production (HTTPS) |
|---------|-----------|-------------------|
| Service Worker | ✅ Works | ✅ Works |
| Manual Install | ✅ Always | ✅ Always |
| Auto-install Prompt | ⚠️ May not fire | ✅ Usually fires |
| Offline Mode | ✅ Works | ✅ Works |

---

## 🎯 Expected Behavior Summary

**When you click "Download Desktop App":**

### Scenario A (Best Case):
1. Browser's install dialog appears immediately
2. User clicks "Install"
3. App installs to desktop

### Scenario B (Localhost Normal):
1. Custom modal appears with instructions
2. User follows browser-specific steps
3. App installs via browser menu

**Both scenarios work!** Scenario B is just normal on localhost.

---

## 📞 Still Having Issues?

**Check:**
1. Console logs (F12) - paste error messages
2. Browser version (Chrome 90+, Edge 90+ recommended)
3. URL is exactly `http://localhost:5173/`

**Quick Fixes:**
```powershell
# Restart dev server
cd frontend
npm run dev

# Clear everything
Ctrl + Shift + Delete → Clear browsing data → Cached images and files
```

**Test the simplified diagnostic page:**
```
http://localhost:5173/pwa-test.html
```
