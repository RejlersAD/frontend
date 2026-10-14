import test from 'node:test'
import assert from 'node:assert/strict'
import {
  INITIAL_ENQUIRY_FILTERS, dateTime, elapsedText, enquiriesCsv, enquiryAge,
  enquiryMetrics, enquiryParams, metricNumber, metricText, priorityLabel,
  readEnquiryList, statusLabel,
} from '../src/components/enquiries/enquiryOperations.js'

const NOW = Date.parse('2026-09-16T12:00:00Z')
const hoursAgo = hours => new Date(NOW - hours * 3600000).toISOString()

test('unknown, malformed and negative measurements never become observed zero', () => {
  for (const value of [undefined, null, '', ' ', '\t', [], [0], {}, true, false, NaN, Infinity, -1, '-1', 'unknown']) {
    assert.equal(metricNumber(value), null, `Expected unknown for ${JSON.stringify(value)}`)
  }
  for (const value of [0, '0', '0.0']) assert.equal(metricNumber(value), 0)
  assert.equal(metricNumber(' 2.5 '), 2.5)
  assert.equal(metricText(0), '0')
  assert.notEqual(metricText(null), '0')
})

test('legacy completion SLA and average fallbacks cannot populate new response KPIs', () => {
  const metrics = enquiryMetrics({ total: 0, sla_compliance: 100, average_response_hours: 0 })
  assert.equal(metrics.total, 0)
  assert.equal(metrics.firstResponseSla, null)
  assert.equal(metrics.median, null)
  assert.equal(metrics.responseCount, null)
  assert.equal(metrics.slaCount, null)
})

test('zero measured duration and zero-percent SLA require positive independent cohorts', () => {
  const data = { median_response_hours: 0, response_sample_count: 2, first_response_sla_compliance: 0, first_response_sla_sample_count: 1 }
  assert.equal(enquiryMetrics(data).median, 0)
  assert.equal(enquiryMetrics(data).firstResponseSla, 0)
  assert.equal(enquiryMetrics({ ...data, response_sample_count: 0 }).median, null)
  assert.equal(enquiryMetrics({ ...data, first_response_sla_sample_count: 0 }).firstResponseSla, null)
  assert.equal(enquiryMetrics({ ...data, first_response_sla_sample_count: undefined }).firstResponseSla, null)
})

test('invalid percentage and missing measurement remain unknown despite sample counts', () => {
  for (const value of [undefined, null, -1, 100.1, Infinity, 'invalid']) {
    assert.equal(enquiryMetrics({ first_response_sla_sample_count: 4, first_response_sla_compliance: value }).firstResponseSla, null)
  }
  assert.equal(enquiryMetrics({ first_response_sla_sample_count: 4, first_response_sla_compliance: 100 }).firstResponseSla, 100)
  assert.equal(enquiryMetrics({ response_sample_count: 3, median_response_hours: null }).median, null)
})

test('open and unassigned counts use the active API fields and preserve observed zero', () => {
  const metrics = enquiryMetrics({ open_count: 0, active_unassigned: 0, unassigned: 10, new: 20, total: 30,
    assigned_to_me: 0, overdue: 0, resolved_this_week: 0 })
  assert.equal(metrics.open, 0)
  assert.equal(metrics.unassigned, 0)
  assert.equal(metrics.mine, 0)
  assert.equal(metrics.overdue, 0)
  assert.equal(metrics.resolvedWeek, 0)
  assert.equal(enquiryMetrics({ unassigned: 10 }).unassigned, null)
})

test('queue, owner and SLA controls become intersecting server parameters', () => {
  const filters = { ...INITIAL_ENQUIRY_FILTERS, queue: 'mine', owner: '42', sla: 'due_today',
    search: '  ENQ-000014  ', status: 'in_progress', urgency: 'high', department: 'Finance' }
  const before = structuredClone(filters)
  assert.deepEqual(enquiryParams(filters, 3, 100), { page: 3, page_size: 100, queue: 'mine',
    search: 'ENQ-000014', status: 'in_progress', urgency: 'high', department: 'Finance',
    assigned_to: '42', sla: 'due_today' })
  assert.deepEqual(filters, before)
  assert.equal(enquiryParams({ ...filters, owner: 'unassigned' }).assigned_to, 'unassigned')
})

test('empty filters are omitted without dropping the All queue or page metadata', () => {
  assert.deepEqual(enquiryParams(INITIAL_ENQUIRY_FILTERS), { page: 1, page_size: 7, queue: 'all' })
  assert.deepEqual(enquiryParams({ ...INITIAL_ENQUIRY_FILTERS, search: '   ' }, 2), { page: 2, page_size: 7, queue: 'all' })
})

test('paginated count remains the server total rather than the returned page size', () => {
  const data = { success: true, count: 31, page: 2, page_size: 7, results: [{ id: 8 }, { id: 9 }] }
  const before = structuredClone(data)
  assert.deepEqual(readEnquiryList(data), { items: data.results, count: 31 })
  assert.deepEqual(data, before)
  assert.deepEqual(readEnquiryList({ success: true, count: 0, results: [] }), { items: [], count: 0 })
})

test('invalid register payloads fail instead of silently becoming an empty queue', () => {
  for (const data of [null, {}, { count: 0 }, { count: null, results: [] },
    { count: -1, results: [] }, { count: 0.5, results: [] }, { count: 1, results: [null] },
    { count: 1, results: [{}] }, { count: 1, results: ['not a row'] }]) {
    assert.throws(() => readEnquiryList(data), /incomplete response/)
  }
})

test('age uses recorded timestamps and rejects invalid or future created dates', () => {
  assert.equal(elapsedText(hoursAgo(0.25), NOW), '<1h')
  assert.equal(elapsedText(hoursAgo(5.9), NOW), '5h')
  assert.equal(elapsedText(hoursAgo(49.9), NOW), '2d 1h')
  for (const value of [null, undefined, '', 'not a date', hoursAgo(-1)]) {
    assert.equal(elapsedText(value, NOW), 'Age unknown')
  }
})

test('overdue age relies on the strict server flag and never infers a breach from an old deadline', () => {
  const row = { created_at: hoursAgo(48), due_at: hoursAgo(5), is_overdue: true }
  assert.equal(enquiryAge(row, NOW), '5h overdue')
  assert.equal(enquiryAge({ ...row, due_at: 'invalid' }, NOW), 'Overdue')
  for (const flag of [false, undefined, 'true', 1]) {
    assert.equal(enquiryAge({ ...row, is_overdue: flag }, NOW), '2d')
  }
})

test('date and categorical labels disclose missing records without invented workflow status', () => {
  for (const value of [null, undefined, '', 'not a date']) assert.equal(dateTime(value), 'Not recorded')
  assert.match(dateTime('2026-09-16T12:00:00Z'), /2026/)
  assert.equal(statusLabel('pending_confirmation'), 'Awaiting confirmation')
  assert.equal(statusLabel('not_real'), 'Not recorded')
  assert.equal(priorityLabel('urgent'), 'Urgent')
  assert.equal(priorityLabel(undefined), 'Not set')
})

test('CSV includes operational columns while excluding messages, contact details and internal evidence', () => {
  const row = { id: 14, reference: 'ENQ-000014', subject: 'Access help', name: 'Example requester',
    department: 'IT', assigned_to: { id: 42, name: 'Example owner', email: 'owner-secret@example.test' },
    urgency: 'normal', status: 'new', created_at: hoursAgo(4), due_at: hoursAgo(-2), is_overdue: false,
    email: 'private-email@example.test', phone: 'private-phone', message: 'private-message',
    admin_notes: 'private-notes', source_ip: 'private-source-ip', user_agent: 'private-agent',
    attachments: [{ name: 'private-document' }], messages: [{ body: 'private-conversation' }] }
  const before = structuredClone(row)
  const csv = enquiriesCsv([row])
  assert.ok(csv.startsWith('\uFEFF"Reference"'))
  assert.ok(csv.includes('ENQ-000014'))
  assert.ok(csv.includes('Example owner'))
  assert.ok(csv.includes('"No"'))
  for (const value of ['private-', 'owner-secret', 'attachments', 'admin_notes', 'source_ip']) assert.ok(!csv.includes(value), value)
  assert.deepEqual(row, before)
})

test('CSV prevents spreadsheet formulas while escaping quotes and preserving cell newlines', () => {
  for (const value of ['=HYPERLINK("https://example.test")', '+SUM(1,2)', '-1+2', '@SUM(1,2)', '\t=1+1', '\r=1+1', '  =1+1']) {
    const csv = enquiriesCsv([{ reference: value }])
    assert.ok(csv.includes(`"'${value.replaceAll('"', '""')}"`), value)
  }
  const csv = enquiriesCsv([{ reference: 'ENQ-14', subject: 'A "quoted" request\nwith another line' }])
  assert.ok(csv.includes('"A ""quoted"" request\nwith another line"'))
})

test('CSV distinguishes unknown overdue state from observed false', () => {
  const csv = enquiriesCsv([{ reference: 'unknown' }, { reference: 'overdue', is_overdue: true }, { reference: 'clear', is_overdue: false }])
  const lines = csv.split('\r\n')
  assert.ok(lines[1].endsWith('"Not recorded"'))
  assert.ok(lines[2].endsWith('"Yes"'))
  assert.ok(lines[3].endsWith('"No"'))
})
