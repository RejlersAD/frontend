import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'

async function service(responses) {
  const requests = [], storage = new Map()
  const api = {
    async post(path) {
      requests.push(path)
      const response = responses.shift()
      if (response instanceof Error) throw response
      return { data: response }
    },
    get(path) {
      requests.push(path)
      // Simulate health never answering while the auth/user endpoints work.
      if (path === '/health/') return new Promise(() => {})
      return Promise.resolve({ data: { id: 12 } })
    },
  }
  const context = createContext({
    console: { log() {}, warn() {}, error() {} }, setTimeout,
    window: { __LOGIN_RESILIENCE_OVERRIDE: { LOGIN_RETRY_DELAY_MS: 0 } },
    localStorage: { setItem: (key, value) => storage.set(key, value), getItem: key => storage.get(key) ?? null },
  })
  const dependencies = {
    './api.service': { default: api },
    '../config/api.config': { API_ENDPOINTS: { LOGIN: '/auth/login/', HEALTH: '/health/', USER_ME: '/users/me/' } },
    '../config/app.config': { STORAGE_KEYS: { ACCESS_TOKEN: 'access', REFRESH_TOKEN: 'refresh', USER_DATA: 'user' } },
    './passwordExpiry.service': { default: { async checkPasswordExpiry() {}, startPeriodicCheck() {} } },
    '../config/environment.config': { getApiTimeouts: () => ({ timeoutAuth: 90000 }) },
    './pushNotification.service': { default: {} },
    './pushDeviceSession': { clearDevicePushSession: async () => {}, getPushOwner: () => null },
  }
  const module = new SourceTextModule(await readFile(new URL('../src/services/auth.service.js', import.meta.url), 'utf8'), {
    context, initializeImportMeta: meta => { meta.env = { DEV: false } },
  })
  await module.link(specifier => {
    const exports = dependencies[specifier]
    assert.ok(exports, `Unexpected dependency: ${specifier}`)
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
    }, { context })
  })
  await module.evaluate()
  return { auth: module.namespace.authService, requests, storage }
}

test('stalled health cannot delay login and rejected credentials are not retried', { timeout: 2000 }, async () => {
  const error = Object.assign(new Error('Rejected credentials'), { response: { status: 401 } })
  const { auth, requests, storage } = await service([error])
  await assert.rejects(auth.login({ email: 'synthetic@example.test', password: 'synthetic' }), /Invalid email or password/)
  assert.deepEqual(requests, ['/auth/login/'])
  assert.equal(storage.size, 0)
})

test('transient failure still retries and authenticated user/tokens are retained', { timeout: 2000 }, async () => {
  const error = Object.assign(new Error('Unavailable'), { response: { status: 503 } })
  const { auth, requests, storage } = await service([error, { access: 'synthetic-access', refresh: 'synthetic-refresh' }])
  const user = await auth.login({ email: 'synthetic@example.test', password: 'synthetic' })
  assert.equal(user.id, 12)
  assert.deepEqual(requests, ['/auth/login/', '/auth/login/', '/users/me/'])
  assert.equal(storage.get('access'), 'synthetic-access')
  assert.equal(storage.get('refresh'), 'synthetic-refresh')
})
