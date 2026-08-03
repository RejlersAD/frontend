import React, { useState, useEffect } from 'react'
import PWAInstallModal from './PWAInstallModal'

/**
 * PWA Install Prompt Component
 * Shows "Download Desktop App" button for PWA installation
 * 
 * Strategy:
 * - Always shows button by default (except if already installed)
 * - Captures beforeinstallprompt event when available
 * - Provides fallback instructions if browser doesn't support PWA
 */
const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showInstall, setShowInstall] = useState(true) // Show by default
  const [isInstalled, setIsInstalled] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [debugInfo, setDebugInfo] = useState({ hasPrompt: false, swReady: false })

  useEffect(() => {
    console.log('🚀 PWA: Component mounted, checking installation status...')
    
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      setShowInstall(false)
      console.log('✅ PWA: Already installed (running in standalone mode)')
      return
    }

    // Check if running as PWA on iOS
    if (window.navigator.standalone === true) {
      setIsInstalled(true)
      setShowInstall(false)
      console.log('✅ PWA: Already installed (iOS standalone)')
      return
    }

    // Show the install button by default
    setShowInstall(true)
    console.log('📱 PWA: Install button visible')

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      console.log('✅✅✅ PWA: beforeinstallprompt event captured! Browser supports native install!')
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault()
      // Stash the event so it can be triggered later
      setDeferredPrompt(e)
      setDebugInfo(prev => ({ ...prev, hasPrompt: true }))
      // Ensure button is visible
      setShowInstall(true)
    }

    // Listen for successful installation
    const handleAppInstalled = () => {
      console.log('🎉 PWA: App installed successfully!')
      setIsInstalled(true)
      setShowInstall(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    // Check service worker status
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        console.log(`✅ PWA: ${registrations.length} service worker(s) registered`)
        if (registrations.length > 0) {
          registrations.forEach(reg => {
            console.log('   - SW State:', reg.active ? reg.active.state : 'no active worker')
          })
        }
      })
      
      navigator.serviceWorker.ready.then(() => {
        console.log('✅ PWA: Service Worker is ready and active')
        setDebugInfo(prev => ({ ...prev, swReady: true }))
      }).catch(err => {
        console.error('❌ PWA: Service Worker error:', err)
      })
    } else {
      console.warn('⚠️ PWA: Service Workers not supported in this browser')
    }

    // Debug: Log current URL and protocol
    console.log(`📍 PWA: Running on ${window.location.protocol}//${window.location.host}`)
    console.log(`🔐 PWA: HTTPS: ${window.location.protocol === 'https:'}`)
    
    // Check after a delay if prompt was captured
    setTimeout(() => {
      if (!deferredPrompt) {
        console.warn('⚠️ PWA: No beforeinstallprompt event after 2 seconds')
        console.warn('💡 This is NORMAL on localhost - browser may not fire the event in dev mode')
        console.warn('💡 Users can still install via browser menu (⋮) → "Install app"')
      }
    }, 2000)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    console.log('🖱️ PWA: Install button clicked!')
    console.log('   - Has deferred prompt:', !!deferredPrompt)
    console.log('   - Service Worker ready:', debugInfo.swReady)
    
    // If we have the native prompt ready, use it immediately
    if (deferredPrompt) {
      console.log('🚀 PWA: Using native browser install prompt...')
      try {
        // Show the browser's native install prompt
        await deferredPrompt.prompt()

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice
        console.log('👤 PWA: User choice:', outcome)

        if (outcome === 'accepted') {
          console.log('✅ PWA: User accepted installation')
          setShowInstall(false)
        } else {
          console.log('❌ PWA: User dismissed installation')
        }

        // Clear the deferred prompt
        setDeferredPrompt(null)
      } catch (error) {
        console.error('❌ PWA: Install prompt failed:', error)
        console.log('📱 PWA: Falling back to modal with instructions')
        // Fallback to modal
        setShowModal(true)
      }
    } else {
      // No native prompt available - show our custom modal with instructions
      console.log('ℹ️ PWA: No native prompt available, showing installation modal')
      console.log('💡 This is normal on localhost - browser may require HTTPS for auto-install')
      setShowModal(true)
    }
  }

  const handleModalInstall = async () => {
    // Close modal first
    setShowModal(false)
    
    // If we still have a deferred prompt, try using it
    if (deferredPrompt) {
      console.log('📱 PWA: Triggering native browser install prompt from modal...')
      
      // Small delay for better UX
      await new Promise(resolve => setTimeout(resolve, 300))

      try {
        // Show the browser's native install prompt
        deferredPrompt.prompt()

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice

        if (outcome === 'accepted') {
          console.log('✅ PWA: User accepted installation')
          setShowInstall(false)
        } else {
          console.log('❌ PWA: User dismissed installation')
        }

        // Clear the deferred prompt
        setDeferredPrompt(null)
        return
      } catch (error) {
        console.error('❌ PWA: Install prompt failed:', error)
      }
    }

    // No deferred prompt - provide browser-specific instructions
    console.log('ℹ️ PWA: No beforeinstallprompt event - showing browser-specific instructions')
    
    // Small delay after closing modal
    await new Promise(resolve => setTimeout(resolve, 300))
    
    // Detect browser
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor)
    const isEdge = /Edg/.test(navigator.userAgent)
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
    const isFirefox = /Firefox/.test(navigator.userAgent)
    
    let instructions = '📱 RADAI Installation Guide\n\n'
    
    if (isChrome || isEdge) {
      instructions += '✅ Chrome/Edge Installation:\n\n'
      instructions += '1. Look for the 🖥️ install icon in the address bar (right side)\n'
      instructions += '   OR\n'
      instructions += '2. Click the ⋮ menu (top-right corner)\n'
      instructions += '3. Select "Install RADAI" or "Install app"\n'
      instructions += '4. Click "Install" in the popup\n\n'
      instructions += '💡 The app will appear on your desktop and start menu!'
    } else if (isSafari) {
      instructions += '✅ Safari Installation (iOS/Mac):\n\n'
      instructions += '1. Tap the Share button (📤) at the bottom\n'
      instructions += '2. Scroll down and tap "Add to Home Screen"\n'
      instructions += '3. Tap "Add" to confirm\n\n'
      instructions += '💡 The app icon will appear on your home screen!'
    } else if (isFirefox) {
      instructions += '✅ Firefox Installation:\n\n'
      instructions += '1. Click the ⋮ menu button\n'
      instructions += '2. Select "Install" or "Add to Home Screen"\n'
      instructions += '3. Confirm the installation\n\n'
      instructions += '💡 The app will be added to your applications!'
    } else {
      instructions += '✅ Installation Options:\n\n'
      instructions += '1. Look for install options in your browser menu (⋮)\n'
      instructions += '2. Or use Chrome/Edge for best PWA support\n\n'
      instructions += '💡 For the best experience, we recommend Chrome or Edge!'
    }
    
    alert(instructions)
  }

  // Don't render if already installed
  if (isInstalled || !showInstall) return null

  return (
    <>
      {/* Floating install button */}
      <button
        onClick={handleInstallClick}
        className="fixed bottom-6 right-6 z-50 group"
        style={{
          background: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 50%, #0e7490 100%)',
          boxShadow: '0 10px 40px -10px rgba(8, 145, 178, 0.6), 0 0 0 2px rgba(115, 189, 200, 0.2)'
        }}
      >
        <div className="relative px-6 py-3 rounded-xl overflow-hidden">
          {/* Animated background shimmer */}
          <div 
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 2s ease-in-out infinite'
            }}
          />

          {/* Content */}
          <div className="relative z-10 flex items-center space-x-3">
            {/* Download icon */}
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            
            <div className="text-left">
              <div className="text-white font-black text-sm leading-tight">
                Download Desktop App
              </div>
              <div className="text-cyan-100 text-xs font-semibold">
                Install RADAI for faster access
              </div>
            </div>

            {/* Arrow icon */}
            <svg className="w-5 h-5 text-white transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </div>
        </div>

        {/* Keyframe animations */}
        <style>{`
          @keyframes shimmer {
            0% { background-position: 200% center; }
            100% { background-position: -200% center; }
          }
        `}</style>
      </button>

      {/* Professional Installation Modal */}
      <PWAInstallModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onInstall={handleModalInstall}
      />
    </>
  )
}

export default PWAInstallPrompt
