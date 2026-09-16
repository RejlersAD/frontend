import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { resolveNotificationTarget } from '../src/utils/notificationNavigation.js'
import { safeLoginReturnPath } from '../src/utils/loginRedirect.js'

const source = await readFile(new URL('../public/push-handler.js', import.meta.url), 'utf8')
function worker(owner = '12', clients = [], loadGate = null) {
  const handlers = {}, shown = [], opened = []
  const cache = { match: async () => {
    const saved = new Response(JSON.stringify({ userId: owner }))
    if (loadGate) { loadGate.started(); await loadGate.promise }
    return saved
  }, put: async (_, value) => { owner = (await value.json()).userId } }
  const self = { location: { origin: 'https://radai.test' }, addEventListener: (name, callback) => { handlers[name] = callback },
    registration: { showNotification: async (...args) => shown.push(args) }, clients: { matchAll: async () => clients, openWindow: async url => opened.push(url) } }
  vm.runInNewContext(source, { self, URL, Response, caches: { open: async () => cache } })
  const emit = async (name, fields) => {
    const waits = []
    handlers[name]({ ...fields, waitUntil: promise => waits.push(promise) })
    await Promise.all(waits)
  }
  return { shown, opened, emit, push: data => emit('push', { data: { json: () => data } }), click: data => emit('notificationclick', { notification: { data, close() {} } }) }
}

test('worker displays only the bound recipient and retains record deep links', async () => {
  const instance = worker()
  await instance.push({ recipient_user_id: '99', title: 'Other user' })
  await instance.push({ title: 'Legacy unbound payload' })
  await instance.push({ recipient_user_id: '12', notification_id: 6, title: 'Review PR', url: '/notifications?preview=pr&id=42' })
  assert.equal(instance.shown.length, 1)
  assert.equal(instance.shown[0][1].data.url, 'https://radai.test/notifications?preview=pr&id=42')
  assert.equal(instance.shown[0][1].data.recipientUserId, '12')
})
test('logout session messages suppress queued pushes and stale clicks open only inbox', async () => {
  const instance = worker()
  await instance.push({ recipient_user_id: '12' })
  await instance.emit('message', { data: { type: 'RADAI_PUSH_SESSION', userId: '' } })
  await instance.push({ recipient_user_id: '12' })
  await instance.click({ recipientUserId: '12', url: '/notifications?preview=po&id=24' })
  assert.equal(instance.shown.length, 1)
  assert.deepEqual(instance.opened, ['https://radai.test/notifications'])
})
test('logout wins over an in-flight worker read of the old account binding', async () => {
  let finishRead, started
  const promise = new Promise(resolve => { finishRead = resolve })
  const reading = new Promise(resolve => { started = resolve })
  const instance = worker('12', [], { promise, started })
  const pending = instance.push({ recipient_user_id: '12' })
  await reading
  await instance.emit('message', { data: { type: 'RADAI_PUSH_SESSION', userId: '' } })
  finishRead()
  await pending
  assert.equal(instance.shown.length, 0)
})
test('worker rejects external or executable targets and tolerates missing data', async () => {
  for (const url of ['https://other.test/approve', 'javascript:alert(1)', '//other.test/approve']) {
    const instance = worker()
    await instance.click({ recipientUserId: '12', url })
    assert.deepEqual(instance.opened, ['https://radai.test/notifications'])
  }
  const instance = worker()
  await instance.click(undefined)
  assert.deepEqual(instance.opened, ['https://radai.test/notifications'])
})
test('notification click awaits navigation and focuses the resulting current client', async () => {
  const calls = []
  const instance = worker('12', [{ url: 'https://radai.test/dashboard', navigate: async url => { calls.push(url); return { focus: async () => calls.push('focused') } }, focus() { throw new Error('Must focus returned navigation client') } }])
  await instance.click({ recipientUserId: '12', url: '/notifications?preview=po&id=24' })
  assert.deepEqual(calls, ['https://radai.test/notifications?preview=po&id=24', 'focused'])
  assert.deepEqual(instance.opened, [])
})
test('notification click falls back to a new window when an old client is gone', async () => {
  const instance = worker('12', [{ url: 'https://radai.test/dashboard', navigate: async () => { throw new Error('closed') }, focus() {} }])
  await instance.click({ recipientUserId: '12', url: '/notifications?preview=pr&id=42' })
  assert.deepEqual(instance.opened, ['https://radai.test/notifications?preview=pr&id=42'])
})
test('notification metadata targets the right record and cannot execute a URL', () => {
  assert.equal(resolveNotificationTarget({ metadata: { pr_id: 'a/b' } }).href, '/notifications?preview=pr&id=a%2Fb')
  assert.equal(resolveNotificationTarget({ metadata: { po_id: 24 } }).href, '/notifications?preview=po&id=24')
  assert.equal(resolveNotificationTarget({ action_url: 'javascript:alert(1)' }), null)
})
test('login retains local notification route and rejects external return URLs', () => {
  assert.equal(safeLoginReturnPath('/notifications?preview=pr&id=42'), '/notifications?preview=pr&id=42')
  for (const value of ['https://other.test', '//other.test', '/\\other.test', 'javascript:alert(1)', '/login']) assert.equal(safeLoginReturnPath(value), null)
})
