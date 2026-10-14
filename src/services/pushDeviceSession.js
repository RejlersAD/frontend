import { STORAGE_KEYS } from '../config/app.config.js'

export const PUSH_OWNER_KEY = 'radai_push_owner'
export const PUSH_SESSION_CACHE = 'radai-push-session-v1'
export const PUSH_SESSION_PATH = '/__radai_push_session__'

export const currentPushUserId = () => {
  try {
    if (!localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)) return ''
    const profile = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER_DATA) || 'null')
    return String(profile?.user?.id ?? profile?.id ?? '')
  } catch { return '' }
}

export const getPushOwner = () => {
  try { return JSON.parse(localStorage.getItem(PUSH_OWNER_KEY) || 'null') }
  catch { return null }
}

let sessionWrite = Promise.resolve()
export const writePushSession = userId => {
  const controller = navigator.serviceWorker?.controller
  controller?.postMessage({ type: 'RADAI_PUSH_SESSION', userId })
  sessionWrite = sessionWrite.catch(() => {}).then(async () => {
    if (!controller) (await navigator.serviceWorker?.getRegistration?.())?.active?.postMessage({ type: 'RADAI_PUSH_SESSION', userId })
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(PUSH_SESSION_CACHE)
      await cache.put(PUSH_SESSION_PATH, new Response(JSON.stringify({ userId: String(userId || '') }), { headers: { 'Content-Type': 'application/json' } }))
    }
  })
  return sessionWrite
}

export const bindDevicePushSession = async (userId, endpoint) => {
  await writePushSession(userId)
  localStorage.setItem(PUSH_OWNER_KEY, JSON.stringify({ userId: String(userId), endpoint }))
}

// Local cleanup must succeed even when the API is unavailable or the JWT expired.
export const clearDevicePushSession = async () => {
  localStorage.removeItem(PUSH_OWNER_KEY)
  const clearSubscription = async () => {
    const registration = await navigator.serviceWorker?.getRegistration?.()
    const tasks = []
    if (registration?.pushManager) tasks.push(registration.pushManager.getSubscription().then(subscription => subscription?.unsubscribe()))
    if (registration?.getNotifications) tasks.push(registration.getNotifications().then(items => items.forEach(item => item.close())))
    await Promise.allSettled(tasks)
  }
  await Promise.allSettled([writePushSession(''), clearSubscription()])
}

export const installPushSessionListeners = () => {
  const onStorage = event => {
    if ([STORAGE_KEYS.ACCESS_TOKEN, STORAGE_KEYS.USER_DATA, null].includes(event.key)) {
      const owner = getPushOwner()
      if (!currentPushUserId() || (owner && owner.userId !== currentPushUserId())) void clearDevicePushSession().catch(() => {})
    }
  }
  window.addEventListener('storage', onStorage)
  onStorage({ key: null })
  return () => window.removeEventListener('storage', onStorage)
}
