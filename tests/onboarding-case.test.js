import assert from 'node:assert/strict'
import test from 'node:test'
import { CASE_STAGES, caseActivity, caseDate, caseError, caseProgress, isPastCaseDate, validCaseDate } from '../src/pages/HR/onboardingCaseData.js'

const task = (id, stage, completed = false, overrides = {}) => ({ id, stage, task_name: `Task ${id}`, completed, ...overrides })
const completedStages = () => CASE_STAGES.map((stage, index) => task(index + 1, stage.id, true))

test('case readiness requires actual completion evidence in each of the four stages', () => {
  const empty = caseProgress(null)
  assert.equal(empty.percent, 0)
  assert.equal(empty.allComplete, false)
  assert.equal(empty.currentIndex, 0)
  assert.equal(empty.stages.length, 4)
  assert.ok(empty.stages.every(stage => !stage.complete && stage.items.length === 0))

  const partial = caseProgress({ checklist_items: completedStages().slice(0, 3) })
  assert.equal(partial.percent, 75)
  assert.equal(partial.allComplete, false)
  assert.equal(partial.stages[partial.currentIndex].id, 'final_validation')

  const complete = caseProgress({ checklist_items: completedStages() })
  assert.equal(complete.percent, 100)
  assert.equal(complete.allComplete, true)
  assert.equal(complete.currentIndex, 3)
})

test('readiness weights all four stages and selects the earliest incomplete stage', () => {
  const result = caseProgress({ checklist_items: [
    task(1, 'pre_hire', true), task(2, 'pre_hire'),
    ...Array.from({ length: 8 }, (_, index) => task(index + 3, 'it_provisioning', true)),
  ] })
  assert.equal(result.percent, 38)
  assert.equal(result.currentIndex, 0)
  assert.equal(result.stages[0].done, 1)
  assert.equal(result.stages[1].complete, true)
  assert.equal(result.stages[2].complete, false)
})

test('general, unknown and offboarding tasks cannot inflate or block onboarding stage readiness', () => {
  const result = caseProgress({ checklist_items: [
    ...completedStages(), task(10, 'general'), task(11, 'exit_initiation'), task(12, 'unknown', true), task(13, undefined, true),
  ] })
  assert.equal(result.percent, 100)
  assert.equal(result.allComplete, true)
  assert.deepEqual(result.stages.flatMap(stage => stage.items.map(item => item.id)), [1, 2, 3, 4])
  assert.equal(caseProgress({ checklist_items: [task(1, 'general', true)] }).percent, 0)
})

test('closed legacy status and record counts do not invent checklist readiness or stage evidence', () => {
  for (const status of ['completed', 'cancelled']) {
    const result = caseProgress({ status, progress_percentage: 100, checklist_completed_count: 50, checklist_count: 50 })
    assert.equal(result.percent, 0)
    assert.equal(result.allComplete, false)
  }
  const history = caseActivity({ status: 'completed', actual_completion_date: '2026-09-21' })
  assert.equal(history[0].title, 'Onboarding completed')
  assert.equal(history[0].detail, 'Workflow completion recorded')
  const verifiedHistory = caseActivity({ status: 'completed', actual_completion_date: '2026-09-21', checklist_items: completedStages() })
  assert.equal(verifiedHistory[0].detail, 'All four checklist stages completed')
})

test('activity uses dated recorded events in newest-first order and omits pending or undated completion', () => {
  const result = caseActivity({
    created_at: '2026-09-01T09:00:00Z', initiated_date: '2026-09-01T10:00:00Z', created_by_name: 'HR Operator',
    status: 'completed', actual_completion_date: '2026-09-21T15:00:00Z',
    checklist_items: [
      task(1, 'pre_hire', true, { completed_date: '2026-09-10T12:00:00Z', completed_by_name: 'Case Owner' }),
      task(2, 'it_provisioning', false, { completed_date: '2026-09-20T12:00:00Z' }),
      task(3, 'first_day', true),
      task(4, 'final_validation', true, { completed_date: '2026-09-21T12:00:00Z' }),
      task(5, 'pre_hire', true, { completed_date: '2026-02-30T12:00:00Z' }),
      task(6, 'pre_hire', true, { completed_date: 'invalid date' }),
    ],
  })
  assert.deepEqual(result.map(event => event.id), ['completed', 'task-4', 'task-1', 'initiated', 'created'])
  assert.match(result.find(event => event.id === 'task-1').detail, /Case Owner/)
  assert.equal(result.find(event => event.id === 'created').detail, 'HR Operator')
  assert.deepEqual(caseActivity({ status: 'completed', progress_percentage: 100 }), [])
  assert.deepEqual(caseActivity(null), [])
})

test('calendar validation handles leap years and rejects normalized impossible dates', () => {
  assert.equal(validCaseDate('2024-02-29'), true)
  assert.equal(validCaseDate('2026-09-21'), true)
  for (const value of ['2026-02-29', '2026-02-30', '2026-04-31', '2026-13-01', '2026-00-10', '0000-01-01', '2026-9-1', '2026-09-21T12:00:00Z', '', null, undefined]) {
    assert.equal(validCaseDate(value), false, String(value))
  }
})

test('date display and overdue indicators preserve calendar dates and reject missing or invalid values', () => {
  const today = new Date(2026, 8, 21, 23, 30)
  assert.equal(caseDate('2026-09-21'), '21 Sept 2026')
  assert.equal(isPastCaseDate('2026-09-20', today), true)
  assert.equal(isPastCaseDate('2026-09-21', today), false)
  assert.equal(isPastCaseDate('2026-09-22', today), false)
  assert.equal(isPastCaseDate('2026-09-20T23:00:00Z', today), true)
  for (const value of [null, undefined, '', '0', 'invalid', '2026-02-30', '2026-02-30T12:00:00Z']) {
    assert.equal(caseDate(value), 'Not set', String(value))
    assert.equal(isPastCaseDate(value, today), false, String(value))
  }
  assert.equal(caseDate(undefined, 'No date recorded'), 'No date recorded')
})

test('API error messages retain actionable stage and field validation reasons', () => {
  assert.equal(caseError({ response: { data: { detail: 'Complete the previous stage.' } } }, 'Retry'), 'Complete the previous stage.')
  assert.equal(caseError({ response: { data: { assigned_to: ['Select an active owner.'] } } }, 'Retry'), 'assigned to: Select an active owner.')
  assert.equal(caseError(new Error('Network unavailable'), 'Refresh and retry'), 'Refresh and retry')
})
