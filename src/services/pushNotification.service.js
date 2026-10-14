import apiClient from './api.service'
import { API_BASE_URL } from '../config/api.config'
import { STORAGE_KEYS } from '../config/app.config'
import { bindDevicePushSession, clearDevicePushSession, currentPushUserId, getPushOwner } from './pushDeviceSession'

const urlBase64ToUint8Array = (value) => {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)))
}

const isSupported = () => (
  typeof window !== 'undefined'
  && 'serviceWorker' in navigator
  && 'PushManager' in window
  && 'Notification' in window
)

const getSubscription = async () => {
  if (!isSupported()) return null
  const registration = await navigator.serviceWorker.getRegistration()
  return registration?.pushManager.getSubscription() || null
}

const getStatus = async () => {
  if (!isSupported()) return { supported: false, available: false, enabled: false, permission: 'unsupported' }
  const [{ data: config }, subscription] = await Promise.all([
    apiClient.get('/notifications/push-config/', { timeout: 10000, silentTimeout: true }),
    getSubscription(),
  ])
  const owner = getPushOwner()
  const enabled = Boolean(subscription && currentPushUserId() && owner?.userId === currentPushUserId() && owner.endpoint === subscription.endpoint)
  if (subscription && !enabled) await clearDevicePushSession()
  if (enabled) await bindDevicePushSession(owner.userId, subscription.endpoint)
  return {
    supported: true,
    available: Boolean(config.available && config.public_key),
    enabled,
    permission: Notification.permission,
  }
}

const enable = async () => {
  if (!isSupported()) throw new Error('Browser push notifications are not supported on this device.')
  const userId = currentPushUserId()
  if (!userId) throw new Error('Sign in before enabling browser notifications.')
  const ensureSameUser = () => {
    if (currentPushUserId() !== userId) throw new Error('Your account changed. Enable notifications again for the signed-in account.')
  }
  const { data: config } = await apiClient.get('/notifications/push-config/')
  if (!config.available || !config.public_key) {
    throw new Error('Push notifications are not configured by the RADAI administrator yet.')
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was not granted.')

  ensureSameUser()
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) throw new Error('Reload RADAI before enabling browser notifications.')
  let subscription = await registration.pushManager.getSubscription()
  if (subscription && getPushOwner()?.userId !== userId) {
    await clearDevicePushSession()
    subscription = null
  }
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.public_key),
    })
  }
  try {
    ensureSameUser()
    const { data: registered } = await apiClient.post('/notifications/push-subscribe/', subscription.toJSON())
    ensureSameUser()
    if (String(registered.recipient_user_id || '') !== userId) throw new Error('The notification account could not be verified. Sign in again and enable notifications.')
    await bindDevicePushSession(userId, subscription.endpoint)
    ensureSameUser()
  } catch (error) {
    await clearDevicePushSession()
    throw error
  }
  return true
}

const disable = async () => {
  const subscription = await getSubscription()
  try {
    if (subscription) await apiClient.post('/notifications/push-unsubscribe/', { endpoint: subscription.endpoint }, { timeout: 10000 })
  } finally {
    await clearDevicePushSession()
  }
  return false
}

const clearForLogout = () => {
  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
  const endpoint = getPushOwner()?.endpoint
  void clearDevicePushSession().catch(() => {})
  if (token && endpoint) {
    void fetch(`${API_BASE_URL}/notifications/push-unsubscribe/`, {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ endpoint }),
    }).catch(() => {})
  }
}

export default { disable, enable, getStatus, isSupported, clearForLogout }
