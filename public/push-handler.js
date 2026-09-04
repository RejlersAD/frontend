self.addEventListener('push', function (event) {
  var data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (error) {
    data = { body: event.data ? event.data.text() : 'You have a new RADAI notification.' }
  }

  event.waitUntil(self.registration.showNotification(data.title || 'RADAI notification', {
    body: data.body || 'You have a new notification.',
    icon: '/assets/radai-icon-192.png',
    badge: '/assets/radai-icon-192.png',
    tag: data.tag || 'radai-notification',
    renotify: true,
    silent: false,
    data: { url: data.url || '/notifications', notificationId: data.notification_id },
  }))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  var targetUrl = new URL(event.notification.data.url || '/notifications', self.location.origin).href
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
    for (var index = 0; index < clients.length; index += 1) {
      if ('focus' in clients[index]) {
        clients[index].navigate(targetUrl)
        return clients[index].focus()
      }
    }
    return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined
  }))
})
