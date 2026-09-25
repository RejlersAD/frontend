import { expect, test } from '@playwright/test'

const job = (id, overrides = {}) => ({ id, project: 32, job_type: 'analyze', status: 'running', ...overrides })
const mount = async (page, setup = {}) => {
  await page.addInitScript(value => {
    window.jobRecoverySetup = value
    localStorage.removeItem('planning-job-recovery-test')
    if (value.saved) localStorage.setItem('planning-job-recovery-test', String(value.saved))
  }, setup)
  await page.goto('/tests/fixtures/planning-job-recovery.html')
  await expect.poll(() => page.evaluate(() => Boolean(window.jobRecovery))).toBe(true)
}
const focus = page => page.evaluate(() => window.dispatchEvent(new Event('focus')))
const calls = (page, method) => page.evaluate(name => window.jobRecovery.calls.filter(call => call.method === name), method)
const expectNoStarts = async page => expect(await calls(page, 'start')).toHaveLength(0)

test('opt-out schedule hooks never discover jobs on entry or focus', async ({ page }) => {
  await mount(page, { enabled: false, list: [{ value: [job(76)] }] })
  await focus(page)
  expect(await calls(page, 'list')).toHaveLength(0)
  await expect(page.locator('output')).toHaveText('No job')
})

test('entry recovers only an active same-project analysis and monitors completion with reads', async ({ page }) => {
  await mount(page, {
    list: [{ value: [job(80, { status: 'succeeded' }), job(79, { project: 99 }), job(78, { job_type: 'generate' }), job(76, { status: 'queued' })] }],
    get: [{ value: job(76, { status: 'succeeded' }) }],
  })
  await expect(page.locator('output')).toHaveText('76: succeeded')
  expect((await calls(page, 'list'))[0].args[0]).toBe(32)
  expect((await calls(page, 'get')).map(call => call.args[0])).toEqual([76])
  await expectNoStarts(page)
})

test('historical terminal, foreign, and other operation jobs never auto-open', async ({ page }) => {
  await mount(page, { list: [{ value: [job(80, { status: 'succeeded' }), job(79, { status: 'failed' }), job(78, { status: 'cancelled' }), job(77, { project: 99 }), job(76, { job_type: 'preview' })] }] })
  await expect.poll(async () => (await calls(page, 'list')).length).toBe(1)
  await expect(page.locator('output')).toHaveText('No job')
  expect(await calls(page, 'get')).toHaveLength(0)
  await expectNoStarts(page)
})

test('focus discovers a later server analysis when entry had no pointer or active job', async ({ page }) => {
  await mount(page, { list: [{ value: [] }, { value: [job(76)] }] })
  await expect.poll(async () => (await calls(page, 'list')).length).toBe(1)
  await focus(page)
  await expect(page.locator('output')).toHaveText('76: running')
  await focus(page)
  expect(await calls(page, 'list')).toHaveLength(2)
  await expectNoStarts(page)
})

test('a valid local monitor takes priority over passive discovery', async ({ page }) => {
  await mount(page, { saved: 70, get: [{ value: job(70) }], list: [{ value: [job(76)] }] })
  await expect(page.locator('output')).toHaveText('70: running')
  await focus(page)
  expect(await calls(page, 'list')).toHaveLength(0)
  await expectNoStarts(page)
})

test('a foreign local pointer is discarded before scoped recovery', async ({ page }) => {
  await mount(page, { saved: 70, get: [{ value: job(70, { project: 99 }) }], list: [{ value: [job(76)] }] })
  await expect(page.locator('output')).toHaveText('76: running')
  expect(await page.evaluate(() => localStorage.getItem('planning-job-recovery-test'))).toBe('76')
  await expectNoStarts(page)
})

test('a missing remembered job can recover another accessible active analysis', async ({ page }) => {
  await mount(page, { saved: 70, get: [{ error: { status: 404 } }], list: [{ value: [job(76)] }] })
  await expect(page.locator('output')).toHaveText('76: running')
  expect(await page.evaluate(() => window.jobRecovery.monitoringError)).toBeNull()
  await expectNoStarts(page)
})

test('a transient saved-pointer error retains explicit reconnect instead of discovering a different job', async ({ page }) => {
  await mount(page, {
    saved: 70, get: [{ error: { status: 503 } }, { value: job(70, { status: 'succeeded' }) }],
    list: [{ value: [job(76)] }],
  })
  await expect.poll(() => page.evaluate(() => window.jobRecovery.monitoringError?.message)).toBe('Status unavailable')
  await focus(page)
  expect(await calls(page, 'list')).toHaveLength(0)
  expect(await page.evaluate(() => localStorage.getItem('planning-job-recovery-test'))).toBe('70')
  await page.evaluate(() => window.jobRecovery.retry())
  await expect(page.locator('output')).toHaveText('70: succeeded')
  expect((await calls(page, 'get')).map(call => String(call.args[0]))).toEqual(['70', '70'])
  await expectNoStarts(page)
})

test('clearing an unavailable status dismisses that remembered ID but permits a newer analysis', async ({ page }) => {
  await mount(page, {
    saved: 70, get: [{ error: { status: 503 } }],
    list: [{ value: [job(70), job(76)] }],
  })
  await expect.poll(() => page.evaluate(() => window.jobRecovery.monitoringError?.message)).toBe('Status unavailable')
  await page.evaluate(() => window.jobRecovery.clear())
  await focus(page)
  await expect(page.locator('output')).toHaveText('76: running')
  await expectNoStarts(page)
})

test('a late discovery cannot replace a newly started user job', async ({ page }) => {
  await mount(page, { list: [{ defer: 'discovery' }], start: [{ value: job(90) }] })
  await page.evaluate(() => window.jobRecovery.run())
  await expect(page.locator('output')).toHaveText('90: running')
  await page.evaluate(value => window.jobRecovery.resolve('discovery', { value }), [job(76)])
  await expect(page.locator('output')).toHaveText('90: running')
  expect(await calls(page, 'start')).toHaveLength(1)
})

test('focus cannot attach an old server job while a user start request is pending', async ({ page }) => {
  await mount(page, { list: [{ value: [] }, { value: [job(76)] }], start: [{ defer: 'start' }] })
  await page.evaluate(() => window.jobRecovery.run())
  await focus(page)
  expect(await calls(page, 'list')).toHaveLength(1)
  await page.evaluate(value => window.jobRecovery.resolve('start', { value }), job(90))
  await expect(page.locator('output')).toHaveText('90: running')
})

test('project changes reject late discovery from the previous project', async ({ page }) => {
  await mount(page, { list: [{ defer: 'old-project' }, { value: [job(88, { project: 33 })] }], get: [{ value: job(88, { project: 33, status: 'succeeded' }) }] })
  await page.evaluate(() => window.jobRecovery.setProjectId(33))
  await expect(page.locator('output')).toHaveText('88: succeeded')
  await page.evaluate(value => window.jobRecovery.resolve('old-project', { value }), [job(76)])
  await expect(page.locator('output')).toHaveText('88: succeeded')
  expect((await calls(page, 'list')).map(call => call.args[0])).toEqual([32, 33])
  await expectNoStarts(page)
})

test('clear invalidates a pending discovery response', async ({ page }) => {
  await mount(page, { list: [{ defer: 'discovery' }] })
  await page.evaluate(() => window.jobRecovery.clear())
  await page.evaluate(value => window.jobRecovery.resolve('discovery', { value }), [job(76)])
  await expect(page.locator('output')).toHaveText('No job')
  expect(await calls(page, 'list')).toHaveLength(1)
  expect(await page.evaluate(() => localStorage.getItem('planning-job-recovery-test'))).toBeNull()
})

test('a cleared job stays dismissed while focus can discover a newer analysis', async ({ page }) => {
  await mount(page, {
    list: [{ value: [job(75)] }, { value: [job(75), job(76)] }],
    get: [{ value: job(75, { status: 'succeeded' }) }],
  })
  await expect(page.locator('output')).toHaveText('75: succeeded')
  await page.evaluate(() => window.jobRecovery.clear())
  await focus(page)
  await expect(page.locator('output')).toHaveText('76: running')
  await expectNoStarts(page)
})

test('recovered monitoring failures keep the existing GET-only explicit retry', async ({ page }) => {
  await mount(page, { list: [{ value: [job(76)] }], get: [{ error: { status: 503 } }, { value: job(76, { status: 'succeeded' }) }] })
  await expect.poll(() => page.evaluate(() => window.jobRecovery.monitoringError?.message)).toBe('Status unavailable')
  await focus(page)
  expect(await calls(page, 'list')).toHaveLength(1)
  await page.evaluate(() => window.jobRecovery.retry())
  await expect(page.locator('output')).toHaveText('76: succeeded')
  expect(await page.evaluate(() => window.jobRecovery.monitoringError)).toBeNull()
  await expectNoStarts(page)
})

test('a passive denied lookup can retry on focus without creating work', async ({ page }) => {
  await mount(page, { list: [{ error: { status: 403 } }, { value: [job(76)] }] })
  await expect.poll(async () => (await calls(page, 'list')).length).toBe(1)
  await expect(page.locator('output')).toHaveText('No job')
  await focus(page)
  await expect(page.locator('output')).toHaveText('76: running')
  await expectNoStarts(page)
})

test('an unspecified project never performs unscoped discovery', async ({ page }) => {
  await mount(page, { projectId: null, list: [{ value: [job(76)] }] })
  await focus(page)
  await page.evaluate(() => window.jobRecovery.setProjectId(undefined))
  await focus(page)
  expect(await calls(page, 'list')).toHaveLength(0)
  await expect(page.locator('output')).toHaveText('No job')
})
