import assert from 'node:assert/strict'
import process from 'node:process'
import { build } from 'esbuild'
import { chromium } from 'playwright'

const item = {
  id: 11, version_id: 3, title: 'Supplier capacity', description: 'Capacity could delay the package.',
  status: 'open', priority: 'high', owner_id: '7', owner_name: 'Project owner', revision: 2,
  response: 'Confirm alternate supplier.', resolution: '', provenance: { type: 'planner', label: 'Planner entry' },
  probability_percent: '25.00', cost_impact: '10000.00', impact_currency: 'AED', expected_cost_impact: '2500.00',
  schedule_impact_days: '5.00', impact_basis: 'Supplier review.', mitigation_status: 'in_progress', mitigation_due_date: '2026-09-01',
}
const fixture = {
  items: [item], version_id: 3, owners: [{ id: '7', name: 'Project owner' }],
  permissions: { can_create: true, can_edit: true, can_view_costs: true },
  analysis: { active_risks: 1, probability_assessed: 1, schedule_assessed: 1, overdue_mitigations: 1,
    cost_assessed: 1, expected_cost_by_currency: { AED: '2500.00' }, cost_basis: 'Assessed active risks only.', schedule_basis: 'Conditional delay estimates per risk.' },
}
const bundle = await build({
  stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
    import Register from './src/components/planning/PlanningRiskRegister.jsx';
    const root = createRoot(document.getElementById('root'));
    window.renderRegister = key => root.render(<Register key={key} projectId={4} versionId={3} />);
    window.renderRegister('initial');`, resolveDir: process.cwd(), loader: 'jsx' },
  bundle: true, write: false, format: 'iife', jsx: 'automatic', loader: { '.css': 'empty' },
  plugins: [{ name: 'risk-register-fixture', setup(builder) {
    builder.onLoad({ filter: /services[\\/]planningIntelligence\.service\.js$/ }, () => ({ loader: 'js', contents: `
      export const planningIntelligenceService = {
        getPlanningRiskRegister: async () => structuredClone(window.riskFixture),
        createPlanningRisk: async (projectId, payload) => { window.riskWrites.push({ method: 'post', projectId, payload }); return structuredClone(window.riskFixture) },
        updatePlanningRisk: async (projectId, payload) => { window.riskWrites.push({ method: 'patch', projectId, payload }); return structuredClone(window.riskFixture) }
      };` }))
  } }],
})

const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setContent('<html lang="en"><head><title>Planning risk register check</title></head><body><main id="root"></main></body></html>')
  await page.evaluate(value => { window.riskFixture = value; window.riskWrites = [] }, fixture)
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
  await page.getByRole('button', { name: 'Review Supplier capacity', exact: true }).waitFor()
  assert.match(await page.getByRole('region', { name: 'Risk impact analysis' }).innerText(), /AED 2500.00/)
  await page.getByRole('button', { name: 'Add planning risk', exact: true }).click()
  await page.getByLabel('Risk title', { exact: true }).fill('Zero likelihood assessment')
  await page.getByLabel('Risk description', { exact: true }).fill('Reviewed capacity concern.')
  await page.getByLabel('Risk probability percent', { exact: true }).fill('0')
  await page.getByLabel('Risk schedule impact days', { exact: true }).fill('0')
  await page.getByLabel('Risk cost impact', { exact: true }).fill('0')
  await page.getByLabel('Risk impact currency', { exact: true }).fill('aed')
  await page.getByLabel('Risk impact basis', { exact: true }).fill('Explicit zero assessment.')
  await page.getByLabel('Risk response', { exact: true }).fill('Confirm capacity.')
  await page.getByLabel('Risk mitigation status', { exact: true }).selectOption('planned')
  await page.getByLabel('Risk mitigation due date', { exact: true }).fill('2026-12-01')
  await page.getByLabel('Risk decision reason', { exact: true }).fill('Project review.')
  await page.getByRole('button', { name: 'Save risk review', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Risk register decision saved.' }).waitFor()
  const created = await page.evaluate(() => window.riskWrites.at(-1))
  assert.equal(created.method, 'post')
  assert.equal(created.payload.probability_percent, '0')
  assert.equal(created.payload.cost_impact, '0')
  assert.equal(created.payload.impact_currency, 'AED')
  assert.equal(created.payload.schedule_impact_days, '0')
  assert.equal(created.payload.mitigation_status, 'planned')
  assert.equal(created.payload.mitigation_due_date, '2026-12-01')

  await page.evaluate(() => {
    window.riskFixture.permissions.can_view_costs = false
    window.riskFixture.items[0] = { ...window.riskFixture.items[0], cost_impact: null, impact_currency: null, expected_cost_impact: null, cost_data_restricted: true }
    window.riskFixture.analysis.expected_cost_by_currency = null
    window.riskFixture.analysis.cost_assessed = null
    window.renderRegister('restricted')
  })
  await page.getByText('Cost assessments require commercial access.', { exact: true }).waitFor()
  assert.equal(await page.getByText('AED 2500.00', { exact: false }).count(), 0)
  await page.getByRole('button', { name: 'Review Supplier capacity', exact: true }).click()
  assert.equal(await page.getByLabel('Risk cost impact', { exact: true }).count(), 0)
  await page.getByLabel('Risk schedule impact days', { exact: true }).fill('')
  await page.getByLabel('Risk mitigation status', { exact: true }).selectOption('completed')
  await page.getByLabel('Risk decision reason', { exact: true }).fill('Alternate supplier confirmed.')
  await page.getByRole('button', { name: 'Save risk review', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Risk register decision saved.' }).waitFor()
  const changed = await page.evaluate(() => window.riskWrites.at(-1))
  assert.equal(changed.method, 'patch')
  assert.equal(changed.payload.revision, 2)
  assert.equal(changed.payload.schedule_impact_days, null)
  assert.equal(changed.payload.probability_percent, '25.00')
  assert.equal(changed.payload.mitigation_status, 'completed')
  assert.equal(Object.hasOwn(changed.payload, 'cost_impact'), false)
  assert.equal(Object.hasOwn(changed.payload, 'impact_currency'), false)
  assert.deepEqual(errors, [])
  console.log('Passed: risk impact summary, explicit zero inputs, mitigation due/status, unknown clearing, and restricted edits without hidden cost writes.')
} finally {
  await browser.close()
}
