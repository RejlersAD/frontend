import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { openPreparation } from '../fixtures/proposal-preparation-api'

// The shared register fixture page can take over a minute on a cold dev server.
test.describe.configure({ timeout: 150000 })

// Authored proposal content as the API returns it: raw paths, codes and ids must never be shown.
const P = '02_Tender/02_RFT'
const para = (id, text, evidence) => ({ id, kind: 'paragraph', text, evidence_ids: evidence, requirement_ids: evidence.filter(e => e.startsWith('REQ')) })
const section = (key, title, kind, pages, paragraphs, extra = {}) => ({ key, title, kind, pages, paragraphs, items: paragraphs, blocks: [], findings: [], approved: false, status: 'draft', requirement_ids: [], ...extra })
const INTERNAL = /03_Proposal|02_Tender\/|LEGACY_REFERENCE|SECTION_NO_SOURCE|EVIDENCE_REQUIRED|sha256|PAR-|REQ-1|STD-2|upload:|rejlers_authored_v1|build_meta/

function content(version, approved = {}) {
  const sections = [
    section('cover', 'COVER PAGE', 'cover', [1, 1], [{ id: 'PAR-cover', kind: 'generated', text: 'COVER PAGE (generated from the template)', evidence_ids: [], requirement_ids: [] }]),
    section('qs', '1. QUALIFICATION STATEMENT', 'authored', [6, 6], [para('PAR-2', 'Rejlers confirms compliance with the tender requirements.', ['REQ-1'])]),
    section('experience', '2.1 PREVIOUS EXPERIENCE', 'evidence', [8, 8], [], {
      findings: [{ severity: 'ERROR', code: 'EVIDENCE_REQUIRED', message: 'Previous Experience: company evidence required (Relevant project references, FEED experience list); supplied by the Rejlers Evidence Library' }] }),
    section('execution', '2.3 METHOD STATEMENT / EXECUTION', 'authored', [12, 30], [
      para('PAR-3', 'Rejlers will deliver the FEED for the replacement of the firewater network.', ['REQ-1', 'STD-2']),
      para('PAR-4', 'Site visits follow Company HSE rules.', ['REQ-2'])], {
      findings: [{ severity: 'WARN', code: 'OPEN_POINT', message: 'SCOPE OF SERVICES: Confirm site access dates' }] }),
    section('schedule', '2.4 WORK SCHEDULE', 'authored', [32, 33], [para('PAR-5', 'The work is completed within 6 months.', ['T1.1.1'])]),
  ].map(item => ({ ...item, approved: Boolean(approved[item.key]), status: approved[item.key] ? 'approved' : 'draft' }))
  return {
    title: 'Q-102134 Technical Proposal', template_version: 'rejlers_authored_v1', client_name: 'ADNOC',
    opportunity_reference: 'Q-102134', proposal_number: 'PROP-2026-001', revision: version, sections,
    publication_validation: { ready: false, blockers: ['build_EVIDENCE_REQUIRED:x'] },
    evidence_registry: {
      'REQ-1': { kind: 'tender', source: `${P}/Request for Tender.pdf`, location: 'p. 3', excerpt: 'x' },
      'REQ-2': { kind: 'tender', source: `${P}/Request for Tender.pdf`, location: 'p. 5', excerpt: 'x' },
      'T1.1.1': { kind: 'tender', source: `${P}/Scope of Work.pdf`, location: 'page 1', excerpt: 'x' },
      'STD-2': { kind: 'standard', source: 'Rejlers standard methodology', location: 'EXECUTION OVERVIEW', excerpt: 'x' } },
    build_findings: [
      ...sections.flatMap(item => item.findings),
      { severity: 'WARN', code: 'REQUIREMENT_NOT_ADDRESSED', message: '4 of 30 tender requirements are not referenced by any section; see the compliance matrix' },
      { severity: 'INFO', code: 'COMPANY_STAMP', message: 'internal' },
    ],
    build_meta: { facts: {
      client: { value: 'ADNOC', source: 'Opportunity record' },
      tender_title: { value: 'C & F The Study & Feed For Miscellaneous Works', source: 'Opportunity record' },
      rft_number: { value: '6000116210', source: `${P}/Request for Tender.pdf`, location: 'page 1' },
      validity_days: { value: '120', source: `${P}/Request for Tender.pdf` } }, deliverable: { file_id: 'radai-1' } },
    compliance_matrix: [],
  }
}

async function standardApi(page, state) {
  await page.route('**/api/v1/sales/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method()
    const body = ['POST', 'PUT', 'PATCH'].includes(method) ? request.postDataJSON() : null
    if (/\/quotes\/[^/]+\/workspace\/$/.test(path) && method === 'GET') {
      return route.fulfill({ json: { quote_id: 'q', builder: 'standard', current: state.version ? { id: `v${state.version}`, version: state.version, content: content(state.version, state.approved) } : null,
        history: state.version ? [{ id: `v${state.version}`, version: state.version, created_at: '2026-11-23T08:00:00Z', reason: 'generated from tender' }] : [] } })
    }
    if (/\/workspace\/jobs\/[^/]+\/$/.test(path)) {
      const next = state.jobs.length > 1 ? state.jobs.shift() : state.jobs[0]
      if (next?.status === 'succeeded') state.version = next.result_version
      return route.fulfill({ json: { job: next || null } })
    }
    if (path.endsWith('/workspace/generate/')) {
      state.calls.push('generate')
      state.jobs = [{ id: 'job-2', status: 'running', attempts: 1 }, { id: 'job-2', status: 'succeeded', attempts: 1, result_version: 1 }]
      return route.fulfill({ status: 202, json: { job: { id: 'job-2', status: 'queued', attempts: 0 } } })
    }
    if (path.endsWith('/workspace/plan/')) {
      state.calls.push('plan')
      return route.fulfill({ json: { plan: [
        { key: 'cover', label: 'COVER PAGE', kind: 'cover', documents: [] },
        { key: 'qs', label: '1. QUALIFICATION STATEMENT', kind: 'authored', documents: [`${P}/Request for Tender.pdf`] },
        { key: 'experience', label: '2.1 PREVIOUS EXPERIENCE', kind: 'evidence', documents: [] },
        { key: 'schedule', label: '2.4 WORK SCHEDULE', kind: 'authored', documents: [] }],
      facts: content(1).build_meta.facts, findings: [
        { severity: 'ERROR', code: 'EVIDENCE_REQUIRED', message: 'Previous Experience: company evidence required (Relevant project references)' },
        { severity: 'ERROR', code: 'SECTION_NO_SOURCE', message: '2.4 WORK SCHEDULE: no tender text relates to this section' }],
      tender: { documents: 2, requirements: 30 } } })
    }
    if (path.endsWith('/workspace/review/')) {
      state.reviews.push(body)
      state.approved = { ...state.approved, [body.section_key]: body.approved }
      state.version += 1
      return route.fulfill({ status: 201, json: { version: state.version } })
    }
    if (/\/workspace\/sections\/[^/]+\/regenerate\/$/.test(path)) {
      state.calls.push(`rebuild:${path.split('/sections/')[1].split('/')[0]}:${body.reason}`)
      state.jobs = [{ id: 'job-3', status: 'succeeded', attempts: 1, result_version: state.version + 1, section_key: 'schedule' }]
      return route.fulfill({ status: 202, json: { job: { id: 'job-3', status: 'queued', attempts: 0, section_key: 'schedule' } } })
    }
    if (path.endsWith('/workspace/pdf/')) {
      state.calls.push(`pdf:${url.searchParams.get('version')}`)
      return route.fulfill({ body: '%PDF-1.4\n%%EOF', headers: { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="proposal.pdf"' } })
    }
    if (path.endsWith('/analysis/registry/')) {
      return route.fulfill({ json: { sources: [
        { key: 'upload:1', name: 'Request for Tender.pdf', folder: 'tender', path: `${P}/Request for Tender.pdf`, sha256: 'x', chunks_total: 3 },
        { key: 'upload:2', name: 'Scope of Work.pdf', folder: 'tender', path: `${P}/Scope of Work.pdf` },
        { key: 'upload:3', name: '250626 ADON Email (RFT).msg', folder: 'correspondence', path: 'a.msg' },
        { key: 'upload:4', name: 'Q-102134 Technical Proposal.pdf', folder: 'proposal', path: 'x.pdf' }] } })
    }
    if (path.endsWith('/analysis/source-selection/')) {
      if (method === 'PUT') { state.selection = body.source_keys; state.calls.push('select') }
      return route.fulfill({ json: { source_keys: state.selection, snapshot: 's', stale: false } })
    }
    return route.fallback()
  })
}

async function open(page, options = {}) {
  const state = { version: 1, approved: {}, jobs: [{ id: 'job-1', status: 'succeeded', attempts: 1, result_version: 1 }], reviews: [], calls: [], selection: [], ...options }
  await openPreparation(page, { beforeOpen: async target => standardApi(target, state) })
  const root = page.getByRole('region', { name: 'Technical proposal', exact: true })
  await expect(root).toBeVisible()
  return { state, root }
}

test('workspace shows one proposal document, its status and issues in proposal language', async ({ page }) => {
  const { root } = await open(page)
  await expect(root.getByText('Needs attention', { exact: true })).toBeVisible()
  await expect(root.getByText('0 of 5 sections approved · 1 issue to fix')).toBeVisible()
  await expect(root.getByText(/Q-102134 Technical Proposal · V1 \(PDF\)/)).toBeVisible()
  await expect(root.getByRole('link', { name: 'Review & comments' })).toHaveAttribute('href', /\/sales\/proposals\/.+\/preview$/)
  await expect(root.getByText('Previous Experience needs company evidence')).toBeVisible()
  await expect(root.getByText('Confirm site access dates')).toBeVisible()
  await expect(root.getByText('6000116210')).toBeVisible()
  await expect(root.getByText('120 days')).toBeVisible()
  expect(await root.innerText()).not.toMatch(INTERNAL)
  const scan = await new AxeBuilder({ page }).include('.ssp').analyze()
  expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact))).toEqual([])
  await root.screenshot({ path: 'test-results/standard-proposal-workspace.png' })
})

test('generate: tender documents preselected, check shows what each section is written from', async ({ page }) => {
  const { state, root } = await open(page, { version: 0, jobs: [null] })
  await expect(root.getByText('Not generated', { exact: true })).toBeVisible()
  await root.getByRole('tab', { name: 'Generate', exact: true }).click()
  await expect(root.getByRole('checkbox', { name: 'Tender (2)' })).toBeChecked()
  await expect(root.getByRole('checkbox', { name: '250626 ADON Email (RFT).msg' })).toBeChecked()
  await expect(root.getByRole('checkbox', { name: 'Q-102134 Technical Proposal.pdf' })).not.toBeChecked()
  await root.getByRole('button', { name: 'Save selection' }).click()
  await expect(root.getByRole('button', { name: 'Selection saved' })).toBeDisabled()
  expect(state.selection).toEqual(['upload:1', 'upload:2', 'upload:3'])
  await root.getByRole('button', { name: 'Check documents' }).click()
  await expect(root.getByText('Written from the tender · Request for Tender.pdf')).toBeVisible()
  await expect(root.getByText('Company evidence needed', { exact: true })).toBeVisible()
  await expect(root.getByText('Written from the tender · no tender text found')).toBeVisible()
  expect(await root.innerText()).not.toMatch(INTERNAL)
  await root.screenshot({ path: 'test-results/standard-proposal-generate.png' })
  await root.getByRole('button', { name: 'Generate proposal' }).click()
  await expect(root.getByText('Building the proposal')).toBeVisible({ timeout: 10000 })
  await expect(root.getByText('The proposal was generated. Review each section next.')).toBeVisible({ timeout: 15000 })
  expect(state.calls).toEqual(['select', 'plan', 'generate'])
})

test('evidence review shows the draft and its tender sources, approves and rewrites with instructions', async ({ page }) => {
  const { state, root } = await open(page)
  await root.getByRole('tab', { name: 'Evidence review', exact: true }).click()
  const execution = root.getByRole('listitem').filter({ hasText: '2.3 METHOD STATEMENT / EXECUTION' }).first()
  await execution.locator('summary').click()
  await expect(execution.getByText('Rejlers will deliver the FEED for the replacement of the firewater network.')).toBeVisible()
  await expect(execution.getByText('Request for Tender.pdf')).toBeVisible()
  await expect(execution.getByText('Rejlers standard methodology')).toBeVisible()
  await expect(execution.getByRole('button', { name: 'Approve' })).toBeDisabled()
  await root.getByRole('textbox', { name: /Review note/ }).fill('Use months instead of weeks')
  await execution.getByRole('button', { name: 'Approve' }).click()
  await expect(root.getByText('2.3 METHOD STATEMENT / EXECUTION approved.')).toBeVisible()
  expect(state.reviews[0]).toMatchObject({ section_key: 'execution', approved: true, reason: 'Use months instead of weeks' })
  const schedule = root.getByRole('listitem').filter({ hasText: '2.4 WORK SCHEDULE' }).first()
  await schedule.locator('summary').click()
  await schedule.getByRole('button', { name: 'Rewrite section' }).click()
  await expect(root.getByText('The section was rebuilt. Review it again.')).toBeVisible({ timeout: 15000 })
  expect(state.calls).toContain('rebuild:schedule:Use months instead of weeks')
  expect(await root.innerText()).not.toMatch(INTERNAL)
  await root.screenshot({ path: 'test-results/standard-proposal-review.png' })
})

test('preview loads the proposal PDF and jumps to a section', async ({ page }) => {
  const { state, root } = await open(page)
  await root.getByRole('tab', { name: 'Preview', exact: true }).click()
  const frame = root.locator('iframe')
  await expect(frame).toHaveAttribute('src', /#page=1$/)
  await root.getByRole('navigation', { name: 'Proposal sections' }).getByRole('button', { name: /2\.3 METHOD STATEMENT/ }).click()
  await expect(frame).toHaveAttribute('src', /#page=12$/)
  expect(state.calls.filter(call => call.startsWith('pdf:'))).toEqual(['pdf:1'])
})

test('narrow screens keep the workspace usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const { root } = await open(page)
  await root.getByRole('tab', { name: 'Evidence review', exact: true }).click()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  await root.screenshot({ path: 'test-results/standard-proposal-mobile.png' })
})
