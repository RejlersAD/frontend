import assert from 'node:assert/strict'
import test from 'node:test'
import { buildOffboardingDashboard, loadOffboardingDashboardRecords } from '../src/pages/HR/offboardingDashboardData.js'

const NOW = new Date(2025, 3, 26, 9)
const employee = (id, overrides = {}) => ({
  id,
  employee_name: `Employee ${id}`,
  position: 'Engineer',
  status: 'initiated',
  last_working_day: '2025-04-28',
  project_manager_approval_status: 'not_required',
  branch: 'RAD',
  department: 'Engineering',
  checklist_items: [],
  ...overrides,
})
const task = (id, task_name, stage, due_date, completed = false) => ({ id, task_name, stage, due_date, completed, priority: 'high' })
const readyTasks = () => [
  task(1, 'Confirm resignation or termination approval', 'exit_initiation', null, true),
  task(2, 'Schedule email and directory account deactivation', 'access_revocation', null, true),
  task(3, 'Collect laptop, desktop, and monitors', 'asset_return', null, true),
  task(4, 'Calculate and approve final settlement', 'final_settlement', null, true),
  task(5, 'Conduct exit interview', 'exit_clearance', null, true),
]

test('departure range retains all active work and includes cleared future departures without counting them as active', () => {
  const records = [
    employee(1, { last_working_day: '2025-04-01' }),
    employee(2, { project_manager_approval_status: 'pending' }),
    employee(3, { last_working_day: '2025-05-03' }),
    employee(4, { last_working_day: '2025-05-04' }),
    employee(5, { last_working_day: '2025-06-01', checklist_items: [task(1, 'Confirm resignation approval', 'exit_initiation', '2025-04-20')] }),
    employee(6, { status: 'completed' }),
    employee(7, { status: 'cancelled' }),
    employee(8, { status: 'rejected' }),
    employee(9, { last_working_day: null }),
  ]
  const result = buildOffboardingDashboard(records, { dateRange: '7' }, NOW)
  assert.deepEqual(result.activeRecords.map(record => record.id), [1, 2, 3, 4, 5, 9])
  assert.equal(result.activeCount, 6)
  assert.equal(result.joiningSoonCount, 3)
  assert.equal(result.overdueCount, 1)
  assert.deepEqual(result.joiners.map(({ record }) => record.id), [2, 6, 3])
  assert.equal(result.joiners.find(({ record }) => record.id === 6).readiness, 'Not tracked')
  assert.equal(result.upcomingOutsideRangeCount, 2)
  assert.equal(result.pastActiveCount, 1)
  assert.equal(result.undatedActiveCount, 1)
  assert.equal(result.futureActiveCount, 4)
  assert.equal(buildOffboardingDashboard(records, { dateRange: 'all' }, NOW).activeCount, 6)
})

test('new past, far-future, and undated exits remain active before their checklists start', () => {
  const records = [
    employee(1, { last_working_day: '2025-06-30', created_at: '2025-04-26T10:00:00Z' }),
    employee(2, { last_working_day: '2025-04-20', created_at: '2025-04-26T11:00:00Z' }),
    employee(3, { last_working_day: null, initiated_date: '2025-04-26T12:00:00Z' }),
    employee(4, { last_working_day: '2025-04-26' }),
    employee(5, { status: 'cancelled' }),
    employee(6, { branch: 'RIN' }),
    employee(7, { department: 'Finance' }),
  ]
  const filters = { entity: 'RAD', department: 'Engineering' }
  const result = buildOffboardingDashboard(records, filters, NOW)
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

  const allDates = buildOffboardingDashboard(records, { ...filters, dateRange: 'all' }, NOW)
  assert.equal(allDates.activeCount, 4)
  assert.equal(allDates.upcomingOutsideRangeCount, 0)
  assert.deepEqual(allDates.joiners.map(({ record }) => record.id), [4, 1])
  assert.deepEqual(records.map(record => record.id), [1, 2, 3, 4, 5, 6, 7], 'building the dashboard must not reorder the API collection')
})

test('upcoming departure range does not suppress active tasks, owner workload, or clearance evidence', () => {
  const records = [employee(1, { last_working_day: '2025-06-30', checklist_items: [
    ...readyTasks(),
    task(6, 'Revoke VPN access', 'access_revocation', '2025-04-24'),
    task(7, 'Recover headset', 'asset_return', '2025-06-20'),
  ] })]
  const result = buildOffboardingDashboard(records, { dateRange: '7' }, NOW)
  assert.equal(result.activeCount, 1)
  assert.equal(result.joiners.length, 0)
  assert.equal(result.upcomingOutsideRangeCount, 1)
  assert.equal(result.actions.length, 2)
  assert.equal(result.overdueCount, 1)
  assert.equal(result.setupNeededCount, 1)
  assert.equal(result.workload.find(owner => owner.id === 'it').open, 1)
  assert.equal(result.workload.find(owner => owner.id === 'it').overdue, 1)
  assert.equal(result.workload.find(owner => owner.id === 'it_hr').open, 1)
  assert.equal(result.dayOneReadyPercent, 0)
  assert.equal(result.readiness.find(category => category.id === 'access').percent, 50)
  assert.deepEqual(result.readiness, buildOffboardingDashboard(records, { dateRange: 'all' }, NOW).readiness)
})

test('entity and department filters apply to every offboarding metric', () => {
  const records = [
    employee(1, { checklist_items: [task(1, 'Revoke remote access', 'access_revocation', '2025-04-20')] }),
    employee(2, { branch: 'RIN', department: 'Finance' }),
    employee(3, { department: 'Finance', checklist_items: readyTasks() }),
  ]
  const result = buildOffboardingDashboard(records, { entity: 'RAD', department: 'Finance' }, NOW)
  assert.equal(result.activeCount, 1)
  assert.equal(result.overdueCount, 0)
  assert.equal(result.setupNeededCount, 0)
  assert.equal(result.dayOneReadyPercent, 100)
  assert.equal(result.actions.length, 0)
  assert.deepEqual(result.joiners.map(({ record }) => record.id), [3])
})

test('overdue and access alerts count recorded incomplete tasks and preserve missing deadlines', () => {
  const result = buildOffboardingDashboard([
    employee(1, { checklist_items: [
      task(1, 'Schedule account deactivation', 'access_revocation', '2025-04-24'),
      task(2, 'Revoke VPN, MFA, and remote access', 'access_revocation', null),
      task(3, 'Inspect returned assets and record condition', 'asset_return', '2025-04-20', true),
      task(4, 'Conduct exit interview', 'exit_clearance', '2025-04-26'),
      task(5, 'Calculate and approve final settlement', 'final_settlement', '2025-05-04'),
    ] }),
    employee(2, { last_working_day: '2025-04-01', equipment_count: 5, access_count: 2 }),
  ], {}, NOW)
  assert.equal(result.actions.length, 4)
  assert.equal(result.overdueCount, 1)
  assert.equal(result.setupNeededCount, 1)
  assert.equal(result.actions.find(action => action.id === '1-2').dueDate, null)
  assert.equal(result.actions.find(action => action.id === '1-2').severity, 'pending')
  assert.equal(result.actions.find(action => action.id === '1-4').severity, 'soon')
  assert.equal(result.actions.find(action => action.id === '1-5').severity, 'pending')
  assert.deepEqual(result.actions.map(action => action.id), ['1-1', '1-4', '1-5', '1-2'])
})

test('clearance requires completion evidence in every category, all recorded work, and no pending project approval', () => {
  const unknown = buildOffboardingDashboard([employee(1, { progress_percentage: 100, documents_count: 4, access_count: 5, equipment_count: 2 })], {}, NOW)
  assert.equal(unknown.dayOneReadyPercent, null)
  assert.ok(unknown.readiness.every(category => category.percent === null))
  assert.equal(unknown.joiners[0].readiness, 'Not tracked')

  const partial = buildOffboardingDashboard([employee(1, { checklist_items: readyTasks().slice(0, 2) })], {}, NOW)
  assert.equal(partial.dayOneReadyPercent, 0)
  assert.equal(partial.joiners[0].readiness, 'In progress')
  assert.equal(partial.readiness.find(category => category.id === 'equipment').percent, null)

  const complete = buildOffboardingDashboard([employee(1, { checklist_items: readyTasks() })], {}, NOW)
  assert.equal(complete.dayOneReadyPercent, 100)
  assert.equal(complete.joiners[0].readiness, 'Clearance complete')

  const pendingTask = buildOffboardingDashboard([employee(1, { checklist_items: [...readyTasks(), task(6, 'Custom outstanding check', 'general', null)] })], {}, NOW)
  assert.equal(pendingTask.dayOneReadyPercent, 0)
  assert.equal(pendingTask.joiners[0].readiness, 'Mostly ready')

  const pendingApproval = buildOffboardingDashboard([employee(1, { project_manager_approval_status: 'pending', checklist_items: readyTasks() })], {}, NOW)
  assert.equal(pendingApproval.dayOneReadyPercent, 0)
  assert.equal(pendingApproval.activeCount, 1)
})

test('completed exits with all five stages contribute clearance readiness until departure', () => {
  const result = buildOffboardingDashboard([
    employee(1, { checklist_items: [task(10, 'Schedule account deactivation', 'access_revocation', '2025-04-24')] }),
    employee(2, { status: 'completed', checklist_items: readyTasks() }),
  ], {}, NOW)
  assert.equal(result.activeCount, 1)
  assert.deepEqual(result.activeRecords.map(record => record.id), [1])
  assert.equal(result.overdueCount, 1)
  assert.equal(result.actions.length, 1)
  assert.equal(result.workload.find(owner => owner.id === 'it').open, 1)
  assert.equal(result.dayOneReadyPercent, 50)
  assert.equal(result.joiningSoonCount, 2)
  assert.equal(result.joiners.find(({ record }) => record.id === 2).readiness, 'Clearance complete')
  assert.deepEqual(result.readiness.map(({ id, percent }) => ({ id, percent })), [
    { id: 'documents', percent: 100 },
    { id: 'access', percent: 50 },
    { id: 'equipment', percent: 100 },
    { id: 'finance', percent: 100 },
  ])

  const completedOnly = buildOffboardingDashboard([employee(2, { status: 'completed', checklist_items: readyTasks() })], {}, NOW)
  assert.equal(completedOnly.activeCount, 0)
  assert.equal(completedOnly.dayOneReadyPercent, 100)
  assert.equal(completedOnly.joiningSoonCount, 1)
})

test('completed cohort obeys date, entity and department filters while all dates includes historical completions', () => {
  const records = [
    employee(1, { status: 'completed', last_working_day: '2025-04-20', checklist_items: readyTasks() }),
    employee(2, { status: 'completed', last_working_day: '2025-04-26', checklist_items: readyTasks() }),
    employee(3, { status: 'completed', last_working_day: '2025-05-03', checklist_items: readyTasks() }),
    employee(4, { status: 'completed', last_working_day: '2025-05-04', checklist_items: readyTasks() }),
    employee(5, { status: 'completed', branch: 'RIN', checklist_items: readyTasks() }),
    employee(6, { status: 'completed', department: 'Finance', checklist_items: readyTasks() }),
    employee(7, { status: 'completed', last_working_day: null, checklist_items: readyTasks() }),
  ]
  const result = buildOffboardingDashboard(records, { entity: 'RAD', department: 'Engineering', dateRange: '7' }, NOW)
  assert.equal(result.activeCount, 0)
  assert.equal(result.dayOneReadyPercent, 100)
  assert.deepEqual(result.joiners.map(({ record }) => record.id), [2, 3])
  const historical = buildOffboardingDashboard([records[0]], { dateRange: '7' }, NOW)
  assert.equal(historical.dayOneReadyPercent, null)
  assert.ok(historical.readiness.every(category => category.percent === null))
  const allDates = buildOffboardingDashboard([records[0]], { dateRange: 'all' }, NOW)
  assert.equal(allDates.dayOneReadyPercent, 100)
  assert.equal(allDates.joiners.length, 0)
})

test('legacy completed status cannot replace evidence from every mandatory stage or cleared approvals', () => {
  const missingStage = buildOffboardingDashboard([employee(1, { status: 'completed', checklist_items: readyTasks().filter(item => item.stage !== 'exit_clearance') })], {}, NOW)
  assert.equal(missingStage.dayOneReadyPercent, 0)
  assert.notEqual(missingStage.joiners[0].readiness, 'Clearance complete')
  const missingEvidence = buildOffboardingDashboard([employee(1, { status: 'completed', progress_percentage: 100 })], {}, NOW)
  assert.equal(missingEvidence.dayOneReadyPercent, null)
  assert.equal(missingEvidence.joiners[0].readiness, 'Not tracked')
  const pendingExitApproval = buildOffboardingDashboard([employee(1, { checklist_items: readyTasks(), exit_approvals: [{ status: 'pending' }] })], {}, NOW)
  assert.equal(pendingExitApproval.dayOneReadyPercent, 0)
  const unknownProjectApproval = buildOffboardingDashboard([employee(1, { checklist_items: readyTasks(), project_manager_approval_status: undefined })], {}, NOW)
  assert.equal(unknownProjectApproval.dayOneReadyPercent, 0)
})

test('category completion is calculated from tasks instead of global record progress', () => {
  const result = buildOffboardingDashboard([employee(1, { progress_percentage: 100, checklist_items: [
    ...readyTasks(),
    task(6, 'Issue service and employment documents', 'final_settlement', null),
    task(7, 'Revoke VPN, MFA, and remote access', 'access_revocation', null),
  ] })], {}, NOW)
  assert.deepEqual(result.readiness.map(({ id, percent }) => ({ id, percent })), [
    { id: 'documents', percent: 67 },
    { id: 'access', percent: 50 },
    { id: 'equipment', percent: 100 },
    { id: 'finance', percent: 100 },
  ])
  assert.equal(result.dayOneReadyPercent, 0)
})

test('workload reflects shared backend team ownership without inventing manager assignments', () => {
  const result = buildOffboardingDashboard([employee(1, { checklist_items: [
    task(1, 'Confirm handover owner and transition plan', 'exit_initiation', '2025-04-24'),
    task(2, 'Revoke VPN access', 'access_revocation', '2025-04-24'),
    task(3, 'Collect laptop', 'asset_return', '2025-04-28'),
    task(4, 'Complete knowledge and document handover', 'exit_clearance', '2025-04-28'),
    task(5, 'Confirm attendance, leave, and payroll inputs', 'final_settlement', '2025-04-24'),
    task(6, 'Custom task without ownership', 'general', null),
  ] })], {}, NOW)
  const action = id => result.actions.find(item => item.id === `1-${id}`)
  assert.equal(action(1).owner, 'HR')
  assert.equal(action(2).owner, 'IT')
  assert.equal(action(3).owner, 'IT / HR')
  assert.equal(action(4).owner, 'HR')
  assert.equal(action(5).owner, 'HR / Finance')
  assert.equal(action(6).owner, 'Unassigned')
  assert.equal(result.workload.find(owner => owner.id === 'hr').open, 2)
  assert.equal(result.workload.find(owner => owner.id === 'it').overdue, 1)
  assert.equal(result.workload.find(owner => owner.id === 'it_hr').open, 1)
  assert.equal(result.workload.find(owner => owner.id === 'finance').overdue, 1)
  assert.equal(result.workload.find(owner => owner.id === 'managers').open, null)
  assert.equal(result.workload.find(owner => owner.id === 'managers').overdue, null)
})

test('loader follows every page, joins offboarding tasks only, and forwards cancellation', async () => {
  const responses = new Map([
    ['/onboarding/offboarding/', { results: [employee(1)], next: 'http://api.local/api/v1/onboarding/offboarding/?page=2' }],
    ['/onboarding/offboarding/?page=2', { results: [employee(2), employee(3)], next: null }],
    ['/onboarding/checklist/', { results: [{ ...readyTasks()[0], offboarding_record: '1' }, { ...readyTasks()[1], onboarding_record: 1 }], next: 'http://api.local/api/v1/onboarding/checklist/?page=2' }],
    ['/onboarding/checklist/?page=2', { results: [{ ...readyTasks()[2], offboarding_record: 2 }], next: null }],
  ])
  const signal = new AbortController().signal
  const requests = []
  const records = await loadOffboardingDashboardRecords({ get: async (url, options) => {
    requests.push(url)
    assert.equal(options.signal, signal)
    assert.ok(responses.has(url), url)
    return { data: responses.get(url) }
  } }, { signal })
  assert.equal(requests.length, 4)
  assert.deepEqual(records.map(record => record.checklist_items.length), [1, 1, 0])
  assert.equal(records[1].checklist_items[0].id, 3)
})

test('loader fails on malformed or repeated pages instead of returning partial dashboard totals', async () => {
  await assert.rejects(loadOffboardingDashboardRecords({ get: async () => ({ data: {} }) }), /Unable to read offboarding records/)
  await assert.rejects(loadOffboardingDashboardRecords({ get: async url => ({ data: { results: [], next: url } }) }), /repeated page/)
})
