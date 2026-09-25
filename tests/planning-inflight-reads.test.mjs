import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createInFlightReads } from '../src/services/inFlightReads.js'

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
test('concurrent schedule consumers share a request; completed results are not cached', async () => {
  const reads = createInFlightReads(), pending = deferred()
  let calls = 0
  const request = () => { calls += 1; return pending.promise }
  const first = reads.get('version:12', request), second = reads.get('version:12', request)
  pending.resolve({ id: 12 }); assert.deepEqual(await first, await second); assert.equal(calls, 1)
  await reads.get('version:12', request); assert.equal(calls, 2)
})
test('one consumer cancellation does not cancel the other consumer', async () => {
  const reads = createInFlightReads(), pending = deferred(), controller = new AbortController()
  let underlying
  const request = signal => { underlying = signal; return pending.promise }
  const first = reads.get('v', request, controller.signal), second = reads.get('v', request)
  const stopped = assert.rejects(first, { code: 'ERR_CANCELED' })
  await Promise.resolve(); controller.abort(); await stopped
  assert.equal(underlying.aborted, false)
  pending.resolve(8); assert.equal(await second, 8)
})
test('all consumer cancellation aborts transport and permits a fresh request', async () => {
  const reads = createInFlightReads(), controller = new AbortController(), pending = deferred()
  let underlying
  const first = reads.get('v', signal => { underlying = signal; return pending.promise }, controller.signal)
  const stopped = assert.rejects(first, { code: 'ERR_CANCELED' })
  await Promise.resolve(); controller.abort(); await stopped
  assert.equal(underlying.aborted, true)
  assert.equal(await reads.get('v', () => 2), 2)
  pending.resolve(1)
})
test('mutation invalidates pending reads and neither result nor failure is cached', async () => {
  const reads = createInFlightReads(), pending = deferred()
  const old = reads.get('v', () => pending.promise), stopped = assert.rejects(old, { code: 'ERR_CANCELED' })
  reads.invalidate(); const fresh = reads.get('v', () => 2)
  pending.resolve(1); await stopped; assert.equal(await fresh, 2)
  await assert.rejects(reads.get('v', () => Promise.reject(new Error('denied'))), /denied/)
  assert.equal(await reads.get('v', () => 3), 3)
})
test('changed authentication and permission scope never receives the previous pending response', async () => {
  let identity = 'account-a:permission-v1'
  const reads = createInFlightReads(() => identity), pending = deferred()
  const old = reads.get('v', () => pending.promise), stopped = assert.rejects(old, { code: 'ERR_CANCELED' })
  identity = 'account-b:permission-v2'
  assert.equal(await reads.get('v', () => 'new account'), 'new account')
  pending.resolve('sensitive old value'); await stopped
})
test('different project/version selectors never share requests', async () => {
  const reads = createInFlightReads()
  assert.deepEqual(await Promise.all([reads.get('project:1/version:3', () => 13), reads.get('project:2/version:3', () => 23)]), [13, 23])
})
test('already aborted consumers issue no request', async () => {
  const reads = createInFlightReads(), controller = new AbortController()
  controller.abort()
  await assert.rejects(reads.get('v', () => assert.fail('transport must not run'), controller.signal), { code: 'ERR_CANCELED' })
})
