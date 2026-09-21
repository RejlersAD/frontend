import { test, expect } from '@playwright/test'

async function openWizard(page, approved = true, evidenceOnly = false) {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/__tests/document-generation', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="en"><head><title>Source generation validation</title><script type="module">import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;</script></head><body><div id="test-root"></div><script type="module">
    import React from '/node_modules/.vite/deps/react.js';
    import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
    import GenerationWizard from '/src/components/planning/GenerationWizard.jsx';
    import service from '/src/services/planningIntelligence.service.js';
    window.calls = [];
    const record = (name, value) => async (...args) => { window.calls.push({ name, args }); return value; };
    service.listScheduleConfigurations = record('configuration', [{ configuration_version: 3 }]);
    service.listScheduleBases = record('basis', [{ id: 1, status: 'approved' }]);
    service.listGenerationPlans = record('plan', [{ id: 2, basis: 1, version: 4, status: '${approved ? 'approved' : 'draft'}', deliverables: [{ id: 'package-a', canonical_name: 'Lift inspection package', source_references: [{ filename: 'Inspection contract.docx', locator: { page: 7 } }] }], dependencies: [], phases: [] }]);
    service.listWorkflowTemplates = record('UNEXPECTED workflow templates', []);
    service.listDependencyTemplates = record('UNEXPECTED dependency templates', []);
    service.createScheduleDefaultProposal = record('UNEXPECTED default approval', {});
    service.previewGeneration = record('preview', { wbs_node_count: 1, deliverable_count: 1, activity_count: 1, configured_workflow_activity_count: 0, relationship_count: 0, milestone_count: 0, missing_information: [{ activity_id: 'inspect-a', missing_fields: ['dependencies', 'calendar'] }], validation: [{ severity: 'warning', message: 'Calendar Not Specified.' }], sample_activities: [{ id: 'inspect-a', name: 'Lift inspection package', original_duration_days: 12, duration_unit: 'calendar_days', source_references: [{ filename: 'Inspection contract.docx', locator: { page: 7 } }], predecessors: [] }] });
    const onGenerate = record('generate', { generation: { version: 5 }, job: { result_data: { schedule_version_id: ${evidenceOnly ? 'null' : 8}, state: '${evidenceOnly ? 'needs_evidence_review' : 'complete'}' } } });
    ReactDOM.createRoot(document.getElementById('test-root')).render(React.createElement(GenerationWizard, { open: true, project: { id: 21, name: 'Inspection programme' }, files: [{ id: 1, parse_status: 'done' }], intelligence: { disciplines: ${approved ? "{ inspection: { in_scope: true, deliverables: ['Lift inspection package'] } }" : "{}"} }, onClose: () => {}, onGenerate, onOpenPlanner: record('UNEXPECTED planner navigation', null), onReviewEvidence: record('review evidence', null) }));
  </script></body></html>` }))
  await page.goto('/__tests/document-generation')
  const dialog = page.getByRole('dialog', { name: 'Schedule generation wizard', exact: true })
  await expect(dialog.getByRole('button', { name: 'Continue →', exact: true })).toBeVisible()
  return { dialog, errors }
}

test('document generation reviews source evidence without auto-selecting or saving workflow templates', async ({ page }) => {
  const { dialog, errors } = await openWizard(page)
  await dialog.getByRole('button', { name: 'Continue →', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Review source activities', exact: true })).toBeVisible()
  await expect(dialog).toContainText('Lift inspection package')
  await expect(dialog).toContainText('Inspection contract.docx · Page 7')
  await expect(dialog).toContainText('12 calendar days')
  await expect(dialog.getByRole('spinbutton')).toHaveCount(0)
  await expect(dialog.getByText('Standard five-stage workflow', { exact: true })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Continue →', exact: true }).click()
  await expect(dialog).toContainText('Not Specified: no extracted source relationships.')
  await expect(dialog.getByRole('combobox')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Continue →', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Review the source generation plan', exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Generate new draft', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Schedule generated successfully', exact: true })).toBeVisible()
  const calls = await page.evaluate(() => window.calls)
  expect(calls.map(call => call.name)).toEqual(['configuration', 'preview', 'generate'])
  expect(calls.at(-1).args).toEqual([{ expected_configuration_version: 3 }])
  expect(errors).toEqual([])
})

test('generic activity evidence can be reviewed without catalogue deliverables or schedule-control approvals', async ({ page }) => {
  const { dialog, errors } = await openWizard(page, false, true)
  await dialog.getByRole('button', { name: 'Continue →', exact: true }).click()
  await expect(dialog).toContainText('Showing 1 of 1 extracted activities.')
  await expect(dialog).toContainText('Lift inspection package')
  for (let step = 0; step < 2; step++) await dialog.getByRole('button', { name: 'Continue →', exact: true }).click()
  await expect(dialog).toContainText('Calendar Not Specified.')
  await dialog.getByRole('button', { name: 'Generate new draft', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Document evidence ready for review', exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.calls.map(call => call.name))).toEqual(['configuration', 'preview', 'generate'])
  expect(errors).toEqual([])
})

test('an evidence-only result cannot claim calculated CPM or navigate to a nonexistent schedule version', async ({ page }) => {
  const { dialog, errors } = await openWizard(page, true, true)
  for (let step = 0; step < 3; step++) await dialog.getByRole('button', { name: 'Continue →', exact: true }).click()
  await dialog.getByRole('button', { name: 'Generate new draft', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'Document evidence ready for review', exact: true })).toBeVisible()
  await expect(dialog).toContainText('Review Not Specified values and source relationships before schedule calculation.')
  await expect(dialog).not.toContainText('Schedule generated successfully')
  await expect(dialog).not.toContainText('relational CPM')
  await expect(dialog).not.toContainText('undefined')
  await expect(dialog.getByRole('button', { name: 'Open Planner Workspace →', exact: true })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Review source evidence', exact: true }).click()
  expect(await page.evaluate(() => window.calls.at(-1).name)).toBe('review evidence')
  expect(errors).toEqual([])
})
