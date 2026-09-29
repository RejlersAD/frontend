import { test, expect } from '@playwright/test'
import {
  prepare, message, listing, paginated, mailbox, detail, detected, assertReadOnly,
} from '../fixtures/sales-email-api-fixture.js'

const incoming = (overrides = {}) => message({ direction: 'incoming', ...overrides })
const info = (aiReview) => detected({
  detection_version: 2,
  classification: { version: 1, status: 'classified', code: 'rfq', needs_review: true, evidence: [], alternatives: [] },
  ...(aiReview ? { ai_review: aiReview } : {}),
})
const emailDetail = (record, aiReview) => detail(record, { extracted_information: info(aiReview) })
const response = (overrides = {}) => ({
  version: 1, kind: 'answer', answer: 'The email requests revision C.',
  citations: [{ source_id: 'selected-email', excerpt: 'Please confirm revision C for the pump package.' }],
  provider: 'anthropic', model: 'synthetic-test-model', coverage: { messages_reviewed: 1 },
  partial: false, needs_review: true, ...overrides,
})
const hold = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
const panel = page => page.getByRole('region', { name: 'Ask RADAI', exact: true })
const openAssistant = async page => {
  await page.getByRole('tab', { name: 'Ask AI', exact: true }).click()
  await expect(panel(page)).toBeVisible()
}
const question = page => panel(page).getByRole('textbox', { name: 'Ask about the selected email', exact: true })
const ask = page => panel(page).getByRole('button', { name: 'Ask RADAI', exact: true })
const chip = (page, name) => panel(page).getByRole('button', { name, exact: true })
const row = (page, record) => page.getByRole('button', { name: `Open email: ${record.subject}`, exact: true })
const batchButton = page => page.getByRole('button', { name: /^Analyze unread/ })
const batchStatus = page => page.locator('.sales-email-batch-status')
const ready = async (page, options = {}) => {
  const record = incoming()
  const state = await prepare(page, { messages: listing([record]), details: emailDetail(record), ...options })
  if (options.connections?.results.length > 1) await page.getByRole('combobox', { name: 'Mailbox', exact: true }).selectOption('shared-1')
  await openAssistant(page)
  return state
}
const assistantRoute = async (page, handler = () => ({ body: response() })) => {
  const calls = []
  await page.route('**/api/v1/sales/**/review-assistant/', async route => {
    const request = route.request()
    const call = { path: new URL(request.url()).pathname, method: request.method(), body: request.postDataJSON(), authorization: request.headers().authorization }
    calls.push(call)
    const result = await handler(call, calls.length)
    if (result.hold) await result.hold.promise
    await route.fulfill({ status: result.status ?? 200, json: result.body })
  })
  return calls
}

for (const [reason, expected] of [
  ['disabled', 'Email AI is disabled on the server.'],
  ['configuration_missing', 'Email AI configuration is incomplete.'],
  ['provider_authentication', 'The AI provider rejected the configured API key.'],
  ['provider_rate_limit', "The AI provider's usage or rate limit was reached."],
  ['mailbox_unavailable', 'The selected email could not be reloaded from Microsoft.'],
]) {
  test(`assistant explains ${reason} without exposing server details or losing input`, async ({ page }) => {
    const state = await ready(page)
    const calls = await assistantRoute(page, () => ({ status: 503, body: {
      code: 'email_assistant_unavailable', reason,
      detail: 'PRIVATE_DIAGNOSTIC synthetic-secret-key private-email-text',
    } }))
    await question(page).fill('What is the submission deadline?')
    await ask(page).click()
    await expect(panel(page).getByRole('alert')).toContainText(expected)
    await expect(question(page)).toHaveValue('What is the submission deadline?')
    await expect(panel(page)).not.toContainText('PRIVATE_DIAGNOSTIC')
    await expect(panel(page)).not.toContainText('synthetic-secret-key')
    await expect(ask(page)).toBeEnabled()
    expect(calls).toHaveLength(1)
    assertReadOnly(state)
  })
}

test('older assistant timeout and citation errors remain distinct and keep edited drafts', async ({ page }) => {
  const state = await ready(page)
  let outcome = { body: response({ kind: 'reply_draft', answer: 'Draft for review.' }) }
  const calls = await assistantRoute(page, () => outcome)
  await chip(page, 'Draft reply').click()
  const draft = panel(page).getByRole('textbox', { name: 'Reply draft', exact: true })
  await draft.fill('My reviewed draft remains here.')
  for (const [status, code, expected] of [
    [504, 'email_assistant_timeout', 'The AI request timed out.'],
    [502, 'email_assistant_invalid_response', 'The AI answer could not be verified against this email.'],
  ]) {
    outcome = { status, body: { code, detail: 'PRIVATE_DIAGNOSTIC' } }
    await chip(page, 'Check deadline').click()
    await expect(panel(page).getByRole('alert')).toContainText(expected)
    await expect(panel(page).getByRole('alert')).not.toContainText('configuration')
    await expect(panel(page)).not.toContainText('PRIVATE_DIAGNOSTIC')
    await expect(draft).toHaveValue('My reviewed draft remains here.')
  }
  expect(calls).toHaveLength(3)
  assertReadOnly(state)
})

test('unknown and hostile failure reasons use a safe fallback and a later retry can succeed', async ({ page }) => {
  const state = await ready(page)
  let outcome
  const calls = await assistantRoute(page, () => outcome)
  await question(page).fill('Which revision is requested?')
  for (const reason of [undefined, 'toString', '__proto__', '<img src=x onerror=alert(1)>', { provider_authentication: true }]) {
    outcome = { status: 503, body: { code: 'email_assistant_unavailable', reason, detail: 'PRIVATE_DIAGNOSTIC' } }
    await ask(page).click()
    await expect(panel(page).getByRole('alert')).toContainText('Ask RADAI is temporarily unavailable.')
    await expect(panel(page)).not.toContainText('PRIVATE_DIAGNOSTIC')
    await expect(question(page)).toHaveValue('Which revision is requested?')
    await expect(panel(page).locator('img')).toHaveCount(0)
  }
  outcome = { body: response() }
  await ask(page).click()
  await expect(panel(page).getByRole('alert')).toHaveCount(0)
  await expect(panel(page)).toContainText('The email requests revision C.')
  expect(calls).toHaveLength(6)
  assertReadOnly(state)
})

test('Ask RADAI waits for an explicit question and uses only the selected source identifiers', async ({ page }) => {
  const state = await ready(page)
  const calls = await assistantRoute(page)
  await expect(ask(page)).toBeDisabled()
  await expect(question(page)).toHaveAttribute('maxlength', '2000')
  await question(page).fill('Which revision is requested?')
  expect(calls).toHaveLength(0)
  await ask(page).click()
  await expect(panel(page)).toContainText('The email requests revision C.')
  expect(calls).toEqual([{
    path: '/api/v1/sales/mailbox-connections/shared-1/review-assistant/', method: 'POST',
    body: { message_id: incoming().id, action: 'question', question: 'Which revision is requested?' },
    authorization: 'Bearer mailbox-fixture-user-11',
  }])
  await panel(page).getByText('Source evidence (1)', { exact: true }).click()
  await expect(panel(page).getByText('Please confirm revision C for the pump package.', { exact: true })).toBeVisible()
  assertReadOnly(state)
})

test('assistant chips request real actions and reply drafts stay editable and copy-only', async ({ page }) => {
  const state = await ready(page)
  const calls = await assistantRoute(page, ({ body }) => ({ body: response(body.action === 'draft_reply'
    ? { kind: 'reply_draft', answer: 'Dear sender,\n[Add your reviewed response.]' }
    : { answer: body.action === 'check_deadline' ? 'A deadline is not established.' : 'Review the pump package revision.' }) }))
  await chip(page, 'Extract requirements').click()
  await expect(panel(page)).toContainText('Review the pump package revision.')
  await chip(page, 'Check deadline').click()
  await expect(panel(page)).toContainText('A deadline is not established.')
  await chip(page, 'Draft reply').click()
  const draft = panel(page).getByRole('textbox', { name: 'Reply draft', exact: true })
  await expect(draft).toHaveValue('Dear sender,\n[Add your reviewed response.]')
  await draft.fill('Dear sender,\nPlease clarify the required revision.')
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.copiedAssistantDraft = value } } }))
  await chip(page, 'Copy draft').click()
  await expect(panel(page)).toContainText('Draft copied.')
  expect(await page.evaluate(() => window.copiedAssistantDraft)).toBe('Dear sender,\nPlease clarify the required revision.')
  await expect(panel(page)).toContainText('Nothing has been sent or saved to Outlook.')
  expect(calls.map(call => call.body.action)).toEqual(['extract_requirements', 'check_deadline', 'draft_reply'])
  expect(calls.every(call => Object.keys(call.body).sort().join(',') === 'action,message_id,question')).toBe(true)
  assertReadOnly(state)
})

test('unavailable and malformed assistant responses retain the question and local draft edits', async ({ page }) => {
  const state = await ready(page)
  let outcome = { body: response({ kind: 'reply_draft', answer: 'Initial draft for review.' }) }
  await assistantRoute(page, () => outcome)
  await chip(page, 'Draft reply').click()
  const draft = panel(page).getByRole('textbox', { name: 'Reply draft', exact: true })
  await draft.fill('My reviewed draft stays here.')
  await question(page).fill('Check this request again')
  outcome = { status: 503, body: { code: 'email_assistant_unavailable', detail: 'Private upstream diagnostic must not be displayed.' } }
  await ask(page).click()
  await expect(panel(page).getByRole('alert')).toContainText('unavailable')
  await expect(question(page)).toHaveValue('Check this request again')
  await expect(draft).toHaveValue('My reviewed draft stays here.')
  await expect(panel(page)).not.toContainText('Private upstream diagnostic')
  outcome = { body: response({ citations: [{ source_id: 'selected-email', excerpt: null }] }) }
  await ask(page).click()
  await expect(panel(page).getByRole('alert')).toContainText('could not answer')
  await expect(question(page)).toHaveValue('Check this request again')
  await expect(draft).toHaveValue('My reviewed draft stays here.')
  assertReadOnly(state)
})

for (const status of [401, 403, 404]) {
  test(`assistant HTTP ${status} removes previous answers and source content`, async ({ page }) => {
    const state = await ready(page)
    let denied = false
    await assistantRoute(page, () => denied ? { status, body: { detail: 'Unavailable' } } : { body: response() })
    await chip(page, 'Extract requirements').click()
    await expect(panel(page)).toContainText('The email requests revision C.')
    // Keep the fixture mounted long enough to verify immediate clearing; the
    // real interceptor still removes credentials on its usual 401 path.
    if (status === 401) await page.evaluate(() => history.replaceState(null, '', '/login'))
    denied = true
    await chip(page, 'Check deadline').click()
    await expect(panel(page)).toHaveCount(0)
    await expect(page.getByText('The email requests revision C.', { exact: true })).toHaveCount(0)
    await expect(row(page, incoming())).toHaveCount(0)
    assertReadOnly(state)
  })
}

for (const change of ['selection', 'mailbox', 'account', 'unmount']) {
  test(`late assistant answer is discarded after ${change} changes`, async ({ page }) => {
    const first = incoming()
    const second = incoming({ id: 'message-two', subject: 'Second selected email' })
    const state = await ready(page, {
      messages: listing([first, second]),
      ...(change === 'mailbox' ? { connections: paginated([mailbox(), mailbox({ id: 'shared-2', mailbox_address: 'projects@example.test' })]) } : {}),
      messageHandler: ({ url }) => ({ body: listing([first, second], null, url.pathname.includes('shared-2') ? 'projects@example.test' : 'sales@example.test') }),
      detailHandler: ({ url }) => ({ body: emailDetail(url.searchParams.get('message_id') === second.id ? second : first) }),
    })
    const pending = hold()
    const calls = await assistantRoute(page, () => ({ hold: pending, body: response({ answer: 'OLD SOURCE ANSWER MUST STAY HIDDEN' }) }))
    await question(page).fill('Old source question')
    await ask(page).click()
    await expect.poll(() => calls.length).toBe(1)
    await expect(ask(page)).toBeDisabled()
    await expect(chip(page, 'Draft reply')).toBeDisabled()
    if (change === 'selection') await row(page, second).click()
    if (change === 'mailbox') await page.getByRole('combobox', { name: 'Mailbox', exact: true }).selectOption('shared-2')
    if (change === 'account') await page.evaluate(() => window.setSalesMailboxMessageActor({ id: 900, user: { id: 22 }, email: 'second-admin@example.test' }))
    if (change === 'unmount') await page.evaluate(() => window.setSalesMailboxMessagesMounted(false))
    else {
      await openAssistant(page)
      await expect(question(page)).toHaveValue('')
    }
    const arrived = page.waitForResponse(item => item.url().endsWith('/review-assistant/'))
    pending.resolve()
    await arrived
    await expect(page.getByText('OLD SOURCE ANSWER MUST STAY HIDDEN', { exact: true })).toHaveCount(0)
    if (change !== 'unmount') await expect(ask(page)).toBeDisabled()
    expect(calls).toHaveLength(1)
    assertReadOnly(state)
  })
}

test('saved email assistant uses its saved endpoint and unsupported drafts are not offered as a reply', async ({ page }) => {
  const record = { ...incoming({ id: 'saved-assistant-source' }), status: 'received', extracted_information: info() }
  const state = await ready(page, { view: 'imported', imported: paginated([record]) })
  const calls = await assistantRoute(page, () => ({ body: response({ kind: 'reply_draft', answer: 'The available email does not establish an answer to this request.', citations: [] }) }))
  await chip(page, 'Draft reply').click()
  await expect(panel(page)).toContainText('The available email does not establish an answer')
  await expect(panel(page).getByRole('textbox', { name: 'Reply draft', exact: true })).toHaveCount(0)
  await expect(chip(page, 'Copy draft')).toHaveCount(0)
  expect(calls[0]).toMatchObject({ path: '/api/v1/sales/email-intakes/saved-assistant-source/review-assistant/', body: { action: 'draft_reply', question: '' } })
  expect(calls[0].body).not.toHaveProperty('message_id')
  assertReadOnly(state)
})

test('assistant output and citations render hostile markup as inert text', async ({ page }) => {
  const state = await ready(page)
  const hostile = '<img src="https://untrusted.example.test/pixel" onerror="window.assistantInjected=true">'
  await assistantRoute(page, () => ({ body: response({ answer: hostile, partial: true, citations: [{ source_id: 'selected-email', excerpt: hostile }] }) }))
  await chip(page, 'Extract requirements').click()
  await expect(panel(page)).toContainText('Only part of the conversation was available')
  await panel(page).getByText('Source evidence (1)', { exact: true }).click()
  await expect(panel(page).getByText(hostile, { exact: true })).toHaveCount(2)
  await expect(panel(page).locator('img, iframe, script')).toHaveCount(0)
  expect(await page.evaluate(() => window.assistantInjected)).toBeUndefined()
  assertReadOnly(state)
})

const batchRecords = () => [
  incoming({ id: 'read-selected', subject: 'Read selected email', is_read: true }),
  incoming({ id: 'unread-one', subject: 'Unread one' }),
  incoming({ id: 'unread-two', subject: 'Unread two' }),
  incoming({ id: 'unread-three', subject: 'Unread three' }),
  incoming({ id: 'outgoing-one', subject: 'Outgoing email', direction: 'outgoing' }),
  incoming({ id: 'draft-one', subject: 'Draft email', is_draft: true, direction: 'draft' }),
  incoming({ id: 'read-unknown', subject: 'Unknown read status', is_read: null }),
]

test('Analyze unread is explicit, sequential and distinguishes validated AI, rules and failure', async ({ page }) => {
  const records = batchRecords()
  const pending = hold()
  const requested = []
  let runningBatch = false
  const state = await ready(page, {
    messages: listing(records),
    detailHandler: ({ url }) => {
      const id = url.searchParams.get('message_id')
      if (runningBatch) requested.push(id)
      const record = records.find(item => item.id === id)
      if (id === 'unread-three') return { status: 500, body: { detail: 'Synthetic failure' } }
      return { body: emailDetail(record, id === 'unread-one' ? { version: 1, status: 'validated' } : null), ...(id === 'unread-one' ? { hold: pending } : {}) }
    },
  })
  expect(requested).toEqual([])
  await expect(batchButton(page)).toHaveText('Analyze unread (3)')
  runningBatch = true
  await batchButton(page).click()
  await expect.poll(() => requested).toEqual(['unread-one'])
  await expect(page.getByRole('button', { name: /^Stop analysis/ })).toBeVisible()
  expect(requested).toEqual(['unread-one'])
  pending.resolve()
  await expect(batchStatus(page)).toContainText('3 of 3 emails reviewed · 1 AI results')
  await expect(batchStatus(page)).toContainText('Some emails could not be analyzed')
  expect(requested).toEqual(['unread-one', 'unread-two', 'unread-three'])
  for (const record of records.slice(1, 4)) await expect(row(page, record)).toContainText('Unread')
  await page.getByRole('navigation', { name: 'Email read status', exact: true }).getByRole('button', { name: /^AI suggestions/ }).click()
  await expect(row(page, records[1])).toBeVisible()
  await expect(row(page, records[2])).toHaveCount(0)
  await expect(row(page, records[3])).toHaveCount(0)
  assertReadOnly(state)
})

test('batch skips a newly read source and rejects a mismatched response without changing list read state', async ({ page }) => {
  const records = batchRecords().slice(0, 3)
  const state = await ready(page, {
    messages: listing(records),
    detailHandler: ({ url }) => {
      const id = url.searchParams.get('message_id')
      const record = records.find(item => item.id === id)
      return { body: emailDetail({ ...record, ...(id === 'unread-one' ? { is_read: true } : {}), ...(id === 'unread-two' ? { id: 'wrong-source' } : {}) }, { version: 1, status: 'validated' }) }
    },
  })
  await batchButton(page).click()
  await expect(batchStatus(page)).toContainText('2 of 2 emails reviewed · 0 AI results')
  await expect(batchStatus(page)).toContainText('Some emails could not be analyzed')
  for (const record of records.slice(1)) await expect(row(page, record)).toContainText('Unread')
  assertReadOnly(state)
})

for (const [batchAI, laterAI] of [[false, true], [true, false]]) {
  test(`new detail ${laterAI ? 'validated AI' : 'rules'} replaces an older ${batchAI ? 'validated AI' : 'rules'} batch summary`, async ({ page }) => {
    const records = batchRecords().slice(0, 2)
    let candidateReads = 0
    const state = await ready(page, {
      messages: listing(records),
      detailHandler: ({ url }) => {
        const id = url.searchParams.get('message_id')
        const candidate = id === records[1].id
        if (candidate) candidateReads += 1
        const validated = candidate && (candidateReads === 1 ? batchAI : laterAI)
        return { body: emailDetail(records.find(item => item.id === id), validated ? { version: 1, status: 'validated' } : null) }
      },
    })
    const suggestions = page.getByRole('navigation', { name: 'Email read status', exact: true }).getByRole('button', { name: /^AI suggestions/ })
    await batchButton(page).click()
    await expect(batchStatus(page)).toContainText('1 of 1 emails reviewed')
    await expect(suggestions).toHaveText(new RegExp(`AI suggestions\\s*${batchAI ? 1 : 0}`))
    await row(page, records[1]).click()
    await expect.poll(() => candidateReads).toBe(2)
    await expect(row(page, records[1])).toHaveAttribute('aria-pressed', 'true')
    await expect(suggestions).toHaveText(new RegExp(`AI suggestions\\s*${laterAI ? 1 : 0}`))
    // The completed batch report describes that run, while the filter follows
    // the latest successful detail read for each email.
    await expect(batchStatus(page)).toContainText(`${batchAI ? 1 : 0} AI results`)
    assertReadOnly(state)
  })
}

test('batch input is bounded to the first 50 current-page rows', async ({ page }) => {
  const records = Array.from({ length: 55 }, (_, index) => incoming({ id: `bounded-${index}`, subject: `Bounded email ${index}`, is_read: index === 0 }))
  const requested = []
  let batch = false
  const state = await ready(page, {
    messages: listing(records),
    detailHandler: ({ url }) => {
      const id = url.searchParams.get('message_id')
      if (batch) requested.push(id)
      return { body: emailDetail(records.find(item => item.id === id)) }
    },
  })
  batch = true
  await batchButton(page).click()
  await expect(batchStatus(page)).toContainText('49 of 49 emails reviewed · 0 AI results', { timeout: 30000 })
  expect(requested).toEqual(records.slice(1, 50).map(item => item.id))
  assertReadOnly(state)
})

for (const change of ['stop', 'page', 'account']) {
  test(`batch review ignores late results after ${change} and queues no more old-page requests`, async ({ page }) => {
    const records = batchRecords().slice(0, 3)
    const next = incoming({ id: 'next-page', subject: 'Next page email', is_read: true })
    const pending = hold()
    const requested = []
    const state = await ready(page, {
      messages: listing(records, 'synthetic-next-page'),
      messageHandler: ({ url }) => ({ body: url.searchParams.has('cursor') ? listing([next]) : listing(records, 'synthetic-next-page') }),
      detailHandler: ({ url }) => {
        const id = url.searchParams.get('message_id')
        if (id.startsWith('unread')) requested.push(id)
        return { body: emailDetail([...records, next].find(item => item.id === id), { version: 1, status: 'validated' }), ...(id === 'unread-one' ? { hold: pending } : {}) }
      },
    })
    await batchButton(page).click()
    await expect.poll(() => requested.length).toBe(1)
    if (change === 'stop') await page.getByRole('button', { name: /^Stop analysis/ }).click()
    if (change === 'page') await page.getByRole('button', { name: 'Next page', exact: true }).click()
    if (change === 'account') await page.evaluate(() => window.setSalesMailboxMessageActor({ id: 900, user: { id: 22 }, email: 'second-admin@example.test' }))
    if (change === 'page') await expect(row(page, next)).toBeVisible()
    if (change === 'account') await openAssistant(page)
    const arrived = page.waitForResponse(item => item.url().includes('message_id=unread-one'))
    pending.resolve()
    await arrived
    expect(requested).toEqual(['unread-one'])
    if (change === 'stop') await expect(batchStatus(page)).toContainText('0 of 2 emails reviewed · 0 AI results')
    else await expect(batchStatus(page)).toHaveCount(0)
    assertReadOnly(state)
  })
}

for (const status of [401, 403, 404]) {
  test(`batch HTTP ${status} clears completed summaries and stops the remaining queue`, async ({ page }) => {
    const records = batchRecords().slice(0, 4)
    const requested = []
    const state = await ready(page, {
      messages: listing(records),
      detailHandler: ({ url }) => {
        const id = url.searchParams.get('message_id')
        if (id.startsWith('unread')) requested.push(id)
        return id === 'unread-two' ? { status, body: { detail: 'Unavailable' } }
          : { body: emailDetail(records.find(item => item.id === id), { version: 1, status: 'validated' }) }
      },
    })
    if (status === 401) await page.evaluate(() => history.replaceState(null, '', '/login'))
    await batchButton(page).click()
    await expect(row(page, records[0])).toHaveCount(0)
    await expect(batchStatus(page)).toHaveCount(0)
    await expect(panel(page)).toHaveCount(0)
    expect(requested).toEqual(['unread-one', 'unread-two'])
    assertReadOnly(state)
  })
}
