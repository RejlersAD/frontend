import apiClient from './api.service'

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
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

const getStatus = async () => {
  if (!isSupported()) return { supported: false, available: false, enabled: false, permission: 'unsupported' }
  const [{ data: config }, subscription] = await Promise.all([
    apiClient.get('/notifications/push-config/', { timeout: 10000, silentTimeout: true }),
    getSubscription(),
  ])
  return {
    supported: true,
    available: Boolean(config.available && config.public_key),
    enabled: Boolean(subscription),
    permission: Notification.permission,
  }
}

const enable = async () => {
  if (!isSupported()) throw new Error('Browser push notifications are not supported on this device.')
  const { data: config } = await apiClient.get('/notifications/push-config/')
  if (!config.available || !config.public_key) {
    throw new Error('Push notifications are not configured by the RADAI administrator yet.')
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was not granted.')

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.public_key),
    })
  }
  await apiClient.post('/notifications/push-subscribe/', subscription.toJSON())
  return true
}

const disable = async () => {
  const subscription = await getSubscription()
  if (!subscription) return false
  await apiClient.post('/notifications/push-unsubscribe/', { endpoint: subscription.endpoint })
  await subscription.unsubscribe()
  return false
}

export default { disable, enable, getStatus, isSupported }
