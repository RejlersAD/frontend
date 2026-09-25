import { test, expect } from '@playwright/test'
import { planningInputsHarness, populatePlanningEvidence } from '../fixtures/planning-inputs.fixture.js'
import { fixedNow, pageOf } from '../fixtures/schedule-performance.fixture.js'
import { expectRetainedScheduleVersion } from '../fixtures/retained-schedule-controls.js'

test.setTimeout(60000)
test.use({ viewport: { width: 1672, height: 941 } })

test('restored completed package waits for the older WBS edit and save without changing its generation target', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('radai-planning-active-job', '502'))
  const state = await planningInputsHarness(page, {
    harnessPath: '/tests/fixtures/project-performance-harness.jsx',
    query: 'project=17&view=plan-baseline&scheduleMode=documents&shell=true',
    prepare(current) {
      current.holdJob = true
      current.jobReleases = []
      current.saveReleases = []
      current.editWrites = []
      const record = current.records[17]
      populatePlanningEvidence(record)
      record.masterVersionId = 90
      const run = record.runs.find(row => row.status === 'succeeded')
      const base = {
        project: record.planningProject.id,
        intelligence: structuredClone(run.intelligence),
        activities: [], wbs: [{ code: '1', level: 0, name: 'Older generation WBS' }],
        logic_matrix: [], eddr: [], manhours: {}, validation: [], narrative: '',
        created_at: fixedNow, updated_at: fixedNow,
      }
      current.olderGeneration = { ...base, id: 1601, version: 3, generation_mode: 'document_driven' }
      const version = { ...record.versions[0], id: 99, version: 4, status: 'draft', source_generation: 1702 }
      record.versions.unshift(version)
      const activities = record.workspace.activities.map(row => ({ ...row, version: 99, name: `Package: ${row.name}` }))
      current.packageWorkspace = { ...structuredClone(record.workspace), version, activities, planning_package: {
        generation_id: 1702, intelligence_run_id: run.id, project_start: '2026-09-25',
        contractual_finish: null, status: 'proposed',
        calendar: { name: 'Proposed package calendar', working_weekdays: [0, 1, 2, 3, 4], hours_per_day: 8 },
        assumptions: [{ field: 'workflow_durations', message: 'Workflow durations are proposed planning values.' }],
      } }
      current.completedGeneration = { ...base, id: 1702, version: 4, generation_mode: 'planning_package',
        intelligence_run_id: run.id, schedule_id: record.schedule.id, schedule_version_id: version.id,
        intelligence: { ...base.intelligence, schedule_engine: { policy: 'planning_package', source_analysis_run_id: run.id } },
        activities, wbs: current.packageWorkspace.wbs, logic_matrix: current.packageWorkspace.relationships,
      }
      current.completedJob = { id: 502, project: record.planningProject.id, job_type: 'generate',
        status: 'succeeded', terminal: true, progress: 100, created_at: fixedNow, updated_at: fixedNow,
        request_data: { generation_options: { mode: 'planning_package', intelligence_run_id: run.id } },
        result_generation: 1702, result_data: { generation_mode: 'planning_package', intelligence_run_id: run.id,
          generation_id: 1702, schedule_id: record.schedule.id, schedule_version_id: version.id, state: 'draft' },
      }
    },
    async handleRequest({ path, route, state: current, reply, record }) {
      const send = async data => { await reply(route, data); return true }
      if (path.endsWith('/jobs/502/')) {
        if (current.holdJob) await new Promise(resolve => current.jobReleases.push(resolve))
        return send(current.completedJob)
      }
      if (path.endsWith('/jobs/')) return send(pageOf([]))
      if (path.endsWith('/generations/')) return send(pageOf([current.olderGeneration]))
      if (path.endsWith('/generations/1601/')) return send(current.olderGeneration)
      if (path.endsWith('/generations/1702/')) return send(current.completedGeneration)
      if (/\/generations\/\d+\/edit\/$/.test(path)) {
        const body = route.request().postDataJSON()
        current.editWrites.push({ path, body })
        await new Promise(resolve => current.saveReleases.push(resolve))
        current.savedRevision = { ...current.olderGeneration, ...body, id: 1602, version: 4, parent_generation: 1601,
          schedule_id: null, schedule_version_id: null, materialization_issues: [] }
        return send(current.savedRevision)
      }
      if (path.endsWith('/schedule-versions/99/workspace/')) return send(current.packageWorkspace)
      if (path.endsWith('/schedule-configurations/')) return send(pageOf([]))
      const runId = path.match(/\/intelligence-runs\/(\d+)\/$/)?.[1]
      if (runId) return send(record.runs.find(row => String(row.id) === runId))
      return false
    },
  })

  const workflow = page.getByRole('navigation', { name: 'Document Intelligence workflow', exact: true })
  await workflow.getByRole('button', { name: /3\. WBS Builder/ }).click()
  const heading = page.getByRole('heading', { name: /^Work Breakdown Structure/ })
  await expect(heading).toContainText('v3')
  const editor = heading.locator('../..')
  await editor.getByRole('button', { name: /Edit/ }).click()
  const name = editor.getByRole('textbox').first()
  await name.fill('Keep my older WBS revision')
  await expect.poll(() => state.jobReleases.length).toBeGreaterThan(0)
  state.holdJob = false
  state.jobReleases.splice(0).forEach(release => release())

  await expect(page.getByText('Analysis findings are saved. Save or cancel your current edits to open the Schedule Planner.', { exact: true })).toBeVisible()
  await expect(heading).toContainText('v3')
  await expect(name).toHaveValue('Keep my older WBS revision')
  await editor.getByRole('button', { name: 'Save Changes', exact: true }).click()
  await expect.poll(() => state.saveReleases.length).toBe(1)
  expect(state.editWrites).toEqual([{ path: '/api/v1/planning-intelligence/generations/1601/edit/',
    body: { wbs: [{ code: '1', level: 0, name: 'Keep my older WBS revision' }] } }])
  await expect(heading).toContainText('v3')
  await expect(name).toHaveValue('Keep my older WBS revision')
  await expect(editor.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled()
  state.saveReleases.splice(0).forEach(release => release())

  await expectRetainedScheduleVersion(page, 99)
  expect(state.savedRevision.parent_generation).toBe(1601)
  expect(state.savedRevision.wbs[0].name).toBe('Keep my older WBS revision')
  expect(state.requests.filter(row => row.method !== 'GET')).toEqual([
    expect.objectContaining({ path: '/api/v1/planning-intelligence/generations/1601/edit/', method: 'PATCH' }),
  ])
  expect(state.unknown).toEqual([])
  expect(state.pageErrors).toEqual([])
})
