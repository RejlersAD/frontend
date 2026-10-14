import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildOnboardingDashboard,
  getOnboardingFilterOptions,
  loadOnboardingDashboardRecords,
} from '../src/pages/HR/onboardingDashboardData.js'

const NOW = new Date(2025, 3, 26, 9)
const employee = (id, overrides = {}) => ({
  id,
  employee_name: `Employee ${id}`,
  position: 'Engineer',
  status: 'documentation',
  joining_date: '2025-04-28',
  branch: 'RAD',
  department: 'Engineering',
  checklist_items: [],
  ...overrides,
})
const task = (id, task_name, stage, due_date, completed = false) => ({ id, task_name, stage, due_date, completed, priority: 'high' })
const readyTasks = () => [
  task(1, 'Verify approved hiring request and employee profile', 'pre_hire', null, true),
  task(2, 'Collect and validate required identity documents', 'pre_hire', null, true),
  task(3, 'Create corporate email and Microsoft 365 account', 'it_provisioning', null, true),
  task(4, 'Prepare and assign workstation or laptop', 'it_provisioning', null, true),
]

test('date horizon limits upcoming joiners without hiding active workflows', () => {
  const records = [
    employee(1, { joining_date: '2025-04-01' }),
    employee(2),
    employee(3, { joining_date: '2025-05-03' }),
    employee(4, { joining_date: '2025-05-04' }),
    employee(5, { joining_date: '2025-06-01' }),
    employee(6, { status: 'completed' }),
    employee(7, { status: 'cancelled' }),
  ]
  const result = buildOnboardingDashboard(records, { dateRange: '7' }, NOW)
  assert.deepEqual(result.activeRecords.map(record => record.id), [1, 2, 3, 4, 5])
  assert.equal(result.activeCount, 5)
  assert.equal(result.joiningSoonCount, 2)
  assert.deepEqual(result.joiners.map(({ record }) => record.id), [2, 3])
  assert.equal(result.upcomingOutsideRangeCount, 2)
  assert.equal(result.pastActiveCount, 1)
  assert.equal(result.futureActiveCount, 4)
  assert.equal(buildOnboardingDashboard(records, { dateRange: 'all' }, NOW).activeCount, 5)
})

test('new past, far-future, and undated cases stay active without checklist evidence and newest cases appear first', () => {
  const records = [
    employee(1, { status: 'initiated', joining_date: '2025-06-30', created_at: '2025-04-26T10:00:00Z' }),
    employee(2, { status: 'initiated', joining_date: '2025-04-20', created_at: '2025-04-26T11:00:00Z' }),
    employee(3, { status: 'initiated', joining_date: null, initiated_date: '2025-04-26T12:00:00Z' }),
    employee(4, { joining_date: '2025-04-26' }),
    employee(5, { status: 'completed' }),
    employee(6, { branch: 'RIN' }),
    employee(7, { department: 'Finance' }),
  ]
  const filters = { entity: 'RAD', department: 'Engineering' }
  const result = buildOnboardingDashboard(records, filters, NOW)
  assert.deepEqual(result.activeRecords.map(record => record.id), [3, 2, 1, 4])
  assert.equal(result.activeCount, 4)
  assert.equal(result.pastActiveCount, 1)
  assert.equal(result.undatedActiveCount, 1)
  assert.equal(result.futureActiveCount, 2)
  assert.equal(result.upcomingOutsideRangeCount, 1)
  assert.equal(result.joiningSoonCount, 1)
  assert.deepEqual(result.joiners.map(({ record }) => record.id), [4])
  assert.equal(result.dayOneReadyPercent, null)
  assert.equal(result.actions.length, 0)
  assert.ok(result.readiness.every(category => category.percent === null))

  const allDates = buildOnboardingDashboard(records, { ...filters, dateRange: 'all' }, NOW)
  assert.equal(allDates.activeCount, 4)
  assert.equal(allDates.upcomingOutsideRangeCount, 0)
  assert.deepEqual(allDates.joiners.map(({ record }) => record.id), [4, 1])
  assert.deepEqual(records.map(record => record.id), [1, 2, 3, 4, 5, 6, 7], 'building the dashboard must not reorder the API collection')
})

test('upcoming range does not suppress future-case tasks, owner workload, or readiness evidence', () => {
  const records = [employee(1, { joining_date: '2025-06-30', checklist_items: [
    ...readyTasks(),
    task(5, 'Recheck corporate email account', 'it_provisioning', '2025-04-24'),
    task(6, 'Prepare headset', 'it_provisioning', '2025-06-20'),
  ] })]
  const result = buildOnboardingDashboard(records, { dateRange: '7' }, NOW)
  assert.equal(result.activeCount, 1)
  assert.equal(result.joiners.length, 0)
  assert.equal(result.upcomingOutsideRangeCount, 1)
  assert.equal(result.actions.length, 2)
  assert.equal(result.overdueCount, 1)
  assert.equal(result.setupNeededCount, 1)
  assert.equal(result.workload.find(owner => owner.id === 'it').open, 2)
  assert.equal(result.workload.find(owner => owner.id === 'it').overdue, 1)
  assert.equal(result.dayOneReadyPercent, 0)
  assert.equal(result.readiness.find(category => category.id === 'access').percent, 50)
  assert.deepEqual(result.readiness, buildOnboardingDashboard(records, { dateRange: 'all' }, NOW).readiness)
})

test('entity and department filters apply consistently to counts, actions, and filter options', () => {
  const records = [
    employee(1, { checklist_items: [task(1, 'Collect identity documents', 'pre_hire', '2025-04-20')] }),
    employee(2, { branch: 'RIN', department: 'Finance' }),
    employee(3, { department: 'Finance' }),
  ]
  const result = buildOnboardingDashboard(records, { entity: 'RAD', department: 'Finance' }, NOW)
  assert.equal(result.activeCount, 1)
  assert.equal(result.actions.length, 0)
  assert.equal(result.overdueCount, 0)
  assert.deepEqual(getOnboardingFilterOptions(records), {
    entities: [{ value: 'RAD', label: 'Rejlers Abu Dhabi' }, { value: 'RIN', label: 'Rejlers India' }],
    departments: [{ value: 'Engineering', label: 'Engineering' }, { value: 'Finance', label: 'Finance' }],
  })
})

test('overdue counts actual open tasks without inventing tasks or deadlines from employee status', () => {
  const result = buildOnboardingDashboard([
    employee(1, {
      joining_date: '2025-04-01',
      checklist_items: [
        task(1, 'Create corporate email account', 'it_provisioning', '2025-04-24'),
        task(2, 'Prepare and assign workstation or laptop', 'it_provisioning', null),
        task(3, 'Collect identity documents', 'pre_hire', '2025-04-20', true),
        task(4, 'HR welcome', 'first_day', '2025-04-26'),
      ],
    }),
    employee(2, { joining_date: '2025-04-01', equipment_count: 5, access_count: 2 }),
  ], {}, NOW)
  assert.equal(result.actions.length, 3)
  assert.equal(result.overdueCount, 1)
  assert.equal(result.setupNeededCount, 1)
  assert.equal(result.actions.find(action => action.id === '1-2').severity, 'pending')
  assert.equal(result.actions.find(action => action.id === '1-4').severity, 'soon')
  assert.equal(result.actions.find(action => action.id === '1-1').focusItChecklist, true)
})

test('readiness requires tracked category evidence and cannot be inferred from counts or status', () => {
  const unknown = buildOnboardingDashboard([employee(1, { progress_percentage: 90, documents_count: 4, access_count: 5, equipment_count: 2 })], {}, NOW)
  assert.equal(unknown.dayOneReadyPercent, null)
  assert.ok(unknown.readiness.every(category => category.percent === null))
  assert.equal(unknown.joiners[0].readiness, 'Not tracked')

  const partial = buildOnboardingDashboard([employee(1, { checklist_items: readyTasks().slice(0, 2) })], {}, NOW)
  assert.equal(partial.dayOneReadyPercent, 0)
  assert.equal(partial.joiners[0].readiness, 'In progress')
  assert.equal(partial.readiness.find(category => category.id === 'access').percent, null)

  const complete = buildOnboardingDashboard([employee(1, { checklist_items: readyTasks() })], {}, NOW)
  assert.equal(complete.dayOneReadyPercent, 100)
  assert.equal(complete.joiners[0].readiness, 'Day-one ready')

  const blocked = buildOnboardingDashboard([employee(1, { checklist_items: [...readyTasks(), { ...task(5, 'Final validation', 'final_validation', null), priority: 'critical' }] })], {}, NOW)
  assert.equal(blocked.dayOneReadyPercent, 0)
})

test('workload follows backend workflow teams and preserves untracked ownership', () => {
  const result = buildOnboardingDashboard([employee(1, { checklist_items: [
    task(1, 'Issue building access card or ID badge', 'it_provisioning', '2025-04-24'),
    task(2, 'Complete HR welcome and company induction', 'first_day', '2025-04-28'),
    task(3, 'Custom task without a workflow stage', 'general', null),
  ] })], {}, NOW)
  assert.equal(result.actions.find(action => action.id === '1-1').owner, 'IT')
  assert.equal(result.actions.find(action => action.id === '1-2').owner, 'HR / Manager')
  assert.equal(result.actions.find(action => action.id === '1-3').owner, 'Unassigned')
  assert.equal(result.workload.find(owner => owner.id === 'it').overdue, 1)
  assert.equal(result.workload.find(owner => owner.id === 'workplace').open, null)
  assert.equal(result.workload.find(owner => owner.id === 'workplace').overdue, null)
})

test('loader scopes every checklist page to onboarding, excludes offboarding tasks, and forwards cancellation', async () => {
  const responses = new Map([
    ['/onboarding/onboarding/', { results: [employee(1)], next: 'http://api.local/api/v1/onboarding/onboarding/?page=2' }],
    ['/onboarding/onboarding/?page=2', { results: [employee(2)], next: null }],
    ['/onboarding/checklist/?workflow=onboarding', { results: [{ ...readyTasks()[0], onboarding_record: 1 }, { ...readyTasks()[1], offboarding_record: 1 }], next: 'http://api.local/api/v1/onboarding/checklist/?page=2' }],
    ['/onboarding/checklist/?page=2&workflow=onboarding', { results: [{ ...readyTasks()[2], onboarding_record: 2 }], next: null }],
  ])
  const signal = new AbortController().signal
  const requests = []
  const records = await loadOnboardingDashboardRecords({ get: async (url, options) => {
    requests.push(url)
    assert.equal(options.signal, signal)
    assert.ok(responses.has(url), url)
    return { data: responses.get(url) }
  } }, { signal })
  assert.equal(requests.length, 4)
  requests.filter(url => url.startsWith('/onboarding/checklist/')).forEach(url => {
    assert.equal(new URL(url, 'https://onboarding.local').searchParams.get('workflow'), 'onboarding')
  })
  assert.deepEqual(records.map(record => record.checklist_items.length), [1, 1])
  assert.equal(records[1].checklist_items[0].id, 3)
})

test('loader rejects malformed or repeated pages instead of presenting partial dashboard totals', async () => {
  await assert.rejects(loadOnboardingDashboardRecords({ get: async () => ({ data: {} }) }), /Unable to read onboarding records/)
  await assert.rejects(loadOnboardingDashboardRecords({ get: async (url) => ({ data: { results: [], next: url } }) }), /repeated page/)
})
