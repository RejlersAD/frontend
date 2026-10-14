const SOUND_KEY = 'radai_notification_sound_enabled'

let audioContext = null
let unlocked = false
let listenersInstalled = false

const isSoundEnabled = () => localStorage.getItem(SOUND_KEY) !== 'false'

const unlock = () => {
  if (!isSoundEnabled()) return
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return
  audioContext ||= new AudioContextClass()
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {})
  unlocked = true
}

const installUnlockListeners = () => {
  if (listenersInstalled || typeof window === 'undefined') return
  listenersInstalled = true
  const handleInteraction = () => {
    unlock()
    window.removeEventListener('pointerdown', handleInteraction)
    window.removeEventListener('keydown', handleInteraction)
  }
  window.addEventListener('pointerdown', handleInteraction, { passive: true })
  window.addEventListener('keydown', handleInteraction)
}

const play = () => {
  if (!isSoundEnabled() || !unlocked || !audioContext) return false
  try {
    const now = audioContext.currentTime
    const gain = audioContext.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5)
    gain.connect(audioContext.destination)

    ;[659.25, 880].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      oscillator.connect(gain)
      oscillator.start(now + index * 0.12)
      oscillator.stop(now + 0.28 + index * 0.12)
    })
    return true
  } catch (error) {
    console.warn('[NotificationAlert] Unable to play alert:', error.message)
    return false
  }
}

const setSoundEnabled = (enabled) => {
  localStorage.setItem(SOUND_KEY, String(Boolean(enabled)))
  if (enabled) unlock()
  return Boolean(enabled)
}

export default { installUnlockListeners, isSoundEnabled, play, setSoundEnabled }
