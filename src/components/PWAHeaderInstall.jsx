import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import pwaInstallService from '../services/pwaInstall.service'

const isStandaloneDisplay = () => (
  window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true
)

const PWAHeaderInstall = () => {
  const [promptAvailable, setPromptAvailable] = useState(
    () => pwaInstallService.getState().available,
  )
  const [installed, setInstalled] = useState(isStandaloneDisplay)
  const [instructionsOpen, setInstructionsOpen] = useState(false)
  const [installing, setInstalling] = useState(false)

  const device = useMemo(() => {
    const agent = navigator.userAgent.toLowerCase()
    if (/iphone|ipad|ipod/.test(agent)) return 'ios'
    if (/android/.test(agent)) return 'android'
    if (/macintosh|mac os x/.test(agent)) return 'mac'
    return 'desktop'
  }, [])

  useEffect(() => {
    const displayQuery = window.matchMedia('(display-mode: standalone)')
    const handleDisplayChange = () => setInstalled(isStandaloneDisplay())
    const unsubscribe = pwaInstallService.subscribe((state) => {
      setPromptAvailable(state.available)
      setInstalled(state.installed || isStandaloneDisplay())
      if (state.installed) setInstructionsOpen(false)
    })

    displayQuery.addEventListener?.('change', handleDisplayChange)
    return () => {
      unsubscribe()
      displayQuery.removeEventListener?.('change', handleDisplayChange)
    }
  }, [])

  const install = async () => {
    if (!promptAvailable) {
      setInstructionsOpen(true)
      return
    }

    setInstalling(true)
    try {
      const result = await pwaInstallService.install()
      if (!result.available) setInstructionsOpen(true)
      if (result.outcome === 'accepted') setInstalled(true)
    } catch (error) {
      console.warn('RADAI installation prompt was unavailable:', error)
      setInstructionsOpen(true)
    } finally {
      setInstalling(false)
    }
  }

  if (installed) return null

  const instructions = device === 'ios'
    ? 'Open RADAI in Safari, select Share, then choose Add to Home Screen.'
    : device === 'android'
      ? 'Open the browser menu and choose Install app or Add to Home screen.'
      : device === 'mac'
        ? 'In Safari choose File > Add to Dock. In Chrome or Edge, use Install RADAI in the address bar or browser menu.'
        : 'In Chrome or Edge, select the install icon in the address bar or choose Apps > Install RADAI from the browser menu.'

  return (
    <>
      <button
        type="button"
        onClick={install}
        disabled={installing}
        className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
        aria-label="Install RADAI on this device"
        title="Install RADAI"
      >
        <ArrowDownTrayIcon className={`h-5 w-5 ${installing ? 'animate-bounce' : ''}`} />
      </button>

      {instructionsOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setInstructionsOpen(false)
          }}
        >
          <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-white">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                  {device === 'ios' || device === 'android'
                    ? <DevicePhoneMobileIcon className="h-6 w-6" />
                    : <ComputerDesktopIcon className="h-6 w-6" />}
                </span>
                <div>
                  <h2 id="pwa-install-title" className="text-lg font-bold">Install RADAI</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Use RADAI like a native application.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInstructionsOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close installation instructions"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {instructions}
            </p>

            <div className="mt-5 grid gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-emerald-600" />Standalone full-screen workspace</span>
              <span className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-emerald-600" />Desktop, Start menu or home-screen access</span>
              <span className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-emerald-600" />Automatic application updates</span>
            </div>

            <button
              type="button"
              onClick={() => setInstructionsOpen(false)}
              className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Done
            </button>
          </section>
        </div>
      )}
    </>
  )
}

export default PWAHeaderInstall
