import test from 'node:test'
import assert from 'node:assert/strict'
import { loadNotificationInbox } from '../src/utils/notificationInbox.js'

const row = id => ({ id, title: `Notification ${id}` })
const page = (ids, count = ids.length, next = null) => ({ count, next, previous: null, results: ids.map(row) })

test('loads all linked pages without a second pass for a stable inbox', async () => {
  const requested = []
  const result = await loadNotificationInbox(async number => {
    requested.push(number)
    return number === 1 ? page([1, 2], 3, '/api/v1/notifications/?page=2') : page([3], 3)
  })
  assert.deepEqual(result.map(item => item.id), [1, 2, 3])
  assert.deepEqual(requested, [1, 2])
})

test('accepts terminal results after one refresh when a live count stays stale', async () => {
  let calls = 0
  const result = await loadNotificationInbox(async () => { calls++; return page([1, 2], 3) })
  assert.deepEqual(result.map(item => item.id), [1, 2])
  assert.equal(calls, 2)
})

test('restarts after a delivery shifts records between pages and uses the fresh traversal', async () => {
  const responses = [page([1, 2], 3, '?page=2'), page([2, 3], 4), page([4, 1], 4, '?page=2'), page([2, 3], 4)]
  const requested = []
  const result = await loadNotificationInbox(async number => { requested.push(number); return responses.shift() })
  assert.deepEqual(result.map(item => item.id), [4, 1, 2, 3])
  assert.deepEqual(requested, [1, 2, 1, 2])
})

test('a deletion during loading uses the latest traversal without retaining a deleted row', async () => {
  const responses = [page([1, 2], 3, '?page=2'), page([], 2), page([1], 2, '?page=2'), page([3], 2)]
  const result = await loadNotificationInbox(async () => responses.shift())
  assert.deepEqual(result.map(item => item.id), [1, 3])
})

test('continually changing valid pages remain usable and do not retry indefinitely', async () => {
  const responses = [page([1, 2], 3, '?page=2'), page([2, 3], 4), page([4, 1], 4, '?page=2'), page([1, 2, 3], 5)]
  let calls = 0
  const result = await loadNotificationInbox(async () => { calls++; return responses.shift() })
  assert.deepEqual(result.map(item => item.id), [4, 1, 2, 3])
  assert.equal(calls, 4)
})

test('supports existing unpaginated array and results-only responses', async () => {
  assert.deepEqual(await loadNotificationInbox(async () => [row(1)]), [row(1)])
  assert.deepEqual(await loadNotificationInbox(async () => ({ results: [] })), [])
})

for (const [label, response] of [
  ['HTML', '<html>Sign in</html>'],
  ['missing results', { count: 1, next: null }],
  ['missing continuation metadata', { count: 1, results: [row(1)] }],
  ['missing identity', { count: 1, next: null, results: [{}] }],
  ['backwards link', page([1], 2, '?page=1')],
  ['skipped page', page([1], 2, '?page=3')],
  ['empty continuing page', page([], 2, '?page=2')],
]) test(`rejects ${label} instead of publishing an invalid inbox`, async () => {
  await assert.rejects(loadNotificationInbox(async () => response), { message: 'Invalid notification pages' })
})

test('propagates a later-page failure without returning partial results', async () => {
  const denied = Object.assign(new Error('Denied'), { status: 403 })
  await assert.rejects(loadNotificationInbox(async number => {
    if (number === 1) return page([1], 2, '?page=2')
    throw denied
  }), error => error === denied)
})

test('cancellation prevents subsequent page requests and snapshot retries', async () => {
  const controller = new AbortController()
  let calls = 0
  await assert.rejects(loadNotificationInbox(async () => {
    calls++
    controller.abort()
    return page([1], 2, '?page=2')
  }, { signal: controller.signal }), { name: 'AbortError' })
  assert.equal(calls, 1)
})
