var pushSessionCache = 'radai-push-session-v1'
var pushSessionPath = '/__radai_push_session__'
var pushSessionUser
var pushSessionRevision = 0

function safePushUrl(value) {
  try {
    var parsed = new URL(value || '/notifications', self.location.origin)
    if (parsed.origin === self.location.origin && ['http:', 'https:'].includes(parsed.protocol)) return parsed.href
  } catch (error) { /* Invalid notification targets return to the inbox. */ }
  return new URL('/notifications', self.location.origin).href
}

async function pushRecipientMatches(recipientId) {
  if (pushSessionUser === undefined) {
    var revision = pushSessionRevision
    try {
      var cache = await caches.open(pushSessionCache)
      var saved = await cache.match(pushSessionPath)
      var savedUser = saved ? String((await saved.json()).userId || '') : ''
      if (revision === pushSessionRevision) pushSessionUser = savedUser
    } catch (error) { if (revision === pushSessionRevision) pushSessionUser = '' }
  }
  return Boolean(pushSessionUser && recipientId && pushSessionUser === String(recipientId))
}

self.addEventListener('message', function (event) {
  if (event.data?.type !== 'RADAI_PUSH_SESSION') return
  pushSessionRevision += 1
  pushSessionUser = String(event.data.userId || '')
  event.waitUntil(caches.open(pushSessionCache).then(function (cache) {
    return cache.put(pushSessionPath, new Response(JSON.stringify({ userId: pushSessionUser }), { headers: { 'Content-Type': 'application/json' } }))
  }))
})

self.addEventListener('push', function (event) {
  var data
  try { data = event.data ? event.data.json() : {} }
  catch (error) { return }
  if (!data || typeof data !== 'object') return
  event.waitUntil(pushRecipientMatches(data.recipient_user_id).then(function (matches) {
    if (!matches) return
    return self.registration.showNotification(data.title || 'RADAI notification', {
      body: data.body || 'You have a new notification.',
      icon: '/assets/radai-icon-192.png',
      badge: '/assets/radai-icon-192.png',
      tag: data.tag || 'radai-notification',
      renotify: true,
      silent: false,
      data: { url: safePushUrl(data.url), notificationId: data.notification_id, recipientUserId: String(data.recipient_user_id) },
    })
  }))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  var data = event.notification.data || {}
  event.waitUntil(pushRecipientMatches(data.recipientUserId).then(async function (matches) {
    var targetUrl = safePushUrl(matches ? data.url : '/notifications')
    var clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (var index = 0; index < clients.length; index += 1) {
      var client = clients[index]
      if (new URL(client.url).origin !== self.location.origin || !client.focus || !client.navigate) continue
      try {
        var navigated = await client.navigate(targetUrl)
        if (navigated) return navigated.focus()
      } catch (error) { /* Try another client or open a new window. */ }
    }
    return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined
  }))
})
