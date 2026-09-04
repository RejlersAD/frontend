const canUseDOM = typeof window !== 'undefined'

let deferredPrompt = null
let installed = canUseDOM && (
  window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true
)
const subscribers = new Set()

const snapshot = () => ({
  available: Boolean(deferredPrompt),
  installed,
})

const notify = () => {
  const state = snapshot()
  subscribers.forEach((subscriber) => subscriber(state))
}

if (canUseDOM) {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event
    notify()
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    installed = true
    notify()
  })
}

const pwaInstallService = {
  getState: snapshot,

  subscribe(subscriber) {
    subscribers.add(subscriber)
    subscriber(snapshot())
    return () => subscribers.delete(subscriber)
  },

  async install() {
    if (!deferredPrompt) return { available: false, outcome: null }

    const prompt = deferredPrompt
    deferredPrompt = null
    notify()

    await prompt.prompt()
    const choice = await prompt.userChoice
    if (choice.outcome === 'accepted') installed = true
    notify()
    return { available: true, outcome: choice.outcome }
  },
}

export default pwaInstallService
