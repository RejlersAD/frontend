import assert from 'node:assert/strict'
import test from 'node:test'
import * as XLSX from 'xlsx'
import { buildComparison, buildTemplateComparisonRows, buildGoverningCaseColumns, getGoverningCaseValue } from '../src/pages/Engineering/Process/HMBStreamTableConsolidator/compare.ts'
import { buildComparisonWorkbookBlob } from '../src/pages/Engineering/Process/HMBStreamTableConsolidator/export.ts'
import { reopenComparisonWorkbook } from '../src/pages/Engineering/Process/HMBStreamTableConsolidator/reopen.ts'
import { make1032Cases, templateRows } from './fixtures/hmb-governing-cases.mjs'

test('1032 selects phase criteria rather than larger Overall/gas-equivalent values', () => {
  const columns = buildGoverningCaseColumns(make1032Cases()).get('1032')
  assert.equal(columns.gas.caseId, 'B1a')
  assert.equal(columns.liquid.caseId, 'B1a')
  assert.equal(columns.water.caseId, 'A2b') // tied B2b loses to the earlier import
})

test('every Max cell copies the governing case row across summary, phases, aliases and composition', () => {
  const cases = make1032Cases()
  const columns = buildGoverningCaseColumns(cases).get('1032')
  const rows = buildTemplateComparisonRows(cases, templateRows)
  for (const row of rows) {
    assert.equal(getGoverningCaseValue(row, columns.gas), row.values.B1a)
    assert.equal(getGoverningCaseValue(row, columns.liquid), row.values.B1a)
    assert.equal(getGoverningCaseValue(row, columns.water), row.values.A2b)
  }
  const mass = section => rows.find(r => r.section === section && r.propertyName === 'Mass Flow')
  assert.equal(getGoverningCaseValue(mass(''), columns.gas), 1458000)
  assert.equal(getGoverningCaseValue(mass('Vapour'), columns.gas), 14900)
  assert.equal(getGoverningCaseValue(mass('Light Liquid'), columns.liquid), 305800)
  assert.equal(getGoverningCaseValue(mass('Heavy Liquid'), columns.water), 1386000)
  assert.ok(rows.find(r => r.section === 'Vapour' && r.propertyName === 'Compressibility').values.B1a > 0)
})

test('different volume units are normalized before choosing liquid maxima', () => {
  const cases = make1032Cases().slice(0, 2)
  for (const c of cases) c.streams[0].properties = [{ name: 'Actual Volume Flow',
    section: 'Light Liquid', unit: c.id === 'A1b' ? 'ft3/hr' : 'barrel/day',
    value: c.id === 'A1b' ? 120 : 500, edited: false }]
  assert.equal(buildGoverningCaseColumns(cases).get('1032').liquid.caseId, 'A1b')
})

test('standard gas rate units are converted and Heavy Liquid is recognized as the aqueous phase', () => {
  const cases = make1032Cases().slice(0, 2)
  cases[0].streams[0].properties = [{ name: 'Std Gas Flow', section: 'Vapour', unit: 'MMSCFD', value: 4 }]
  cases[1].streams[0].properties = [
    { name: 'Std Gas Flow', section: 'Vapour', unit: 'SCFH', value: 200000 },
    { name: 'Mass Flow', phase: 'Heavy Liquid', unit: 'lb/hr', value: 200 },
  ]
  const columns = buildGoverningCaseColumns(cases).get('1032')
  assert.equal(columns.gas.caseId, 'A2a')
  assert.equal(columns.water.caseId, 'A2a')
  const [row] = buildTemplateComparisonRows(cases, [{ section: 'Heavy Liquid', name: 'Mass Flow', unit: 'lb/hr' }])
  assert.equal(getGoverningCaseValue(row, columns.water), 200)
})

test('excluded streams and missing criteria do not supply a governing column', () => {
  const cases = make1032Cases()
  cases.find(c => c.id === 'B1a').streams[0].included = false
  assert.equal(buildGoverningCaseColumns(cases).get('1032').gas.caseId, 'A1b')
  for (const c of cases) c.streams[0].properties = []
  assert.equal(buildGoverningCaseColumns(cases).get('1032').gas.caseId, null)
})

test('null primary criteria do not block numeric alternatives, zero is eligible and true gaps remain empty', () => {
  const cases = make1032Cases().slice(0, 1)
  cases[0].streams[0].properties = [
    { name: 'Std Gas Flow', section: 'Vapour', unit: 'MMSCFD', value: null },
    { name: 'Standard Gas Flow', section: 'Vapour', unit: 'MMSCFD', value: 0 },
  ]
  const column = buildGoverningCaseColumns(cases).get('1032').gas
  assert.equal(column.caseId, 'A1b')
  const [gasRow] = buildTemplateComparisonRows(cases, [{ section: 'Vapour', name: 'Std Gas Flow', unit: 'MMSCFD' }])
  assert.equal(gasRow.values.A1b, 0)
  const [row] = buildTemplateComparisonRows(cases, [{ section: 'Vapour', name: 'Viscosity', unit: 'cP' }])
  assert.equal(getGoverningCaseValue(row, column), null)
})

test('raw export rows keep phase and unit identity instead of overwriting repeated property names', () => {
  const cases = make1032Cases()
  cases[0].streams[0].properties.push({ name: 'Actual Volume Flow', section: 'Vapour', unit: 'barrel/day', value: 1000, edited: false })
  const { rows } = buildComparison(cases)
  assert.equal(rows.filter(r => r.propertyName === 'Mass Flow').length, 4)
  assert.equal(rows.filter(r => r.section === 'Vapour' && r.propertyName === 'Actual Volume Flow').length, 2)
})

test('XLSX Max columns match their source case and reopen retains every phase and composition', async () => {
  const cases = make1032Cases()
  const blob = await buildComparisonWorkbookBlob(cases, { includeSummary: true, highlightVariation: true, flagEdited: true })
  const buffer = await blob.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Comparison, { header: 1, defval: null })
  const header = rows[1]
  for (const row of rows.slice(2).filter(row => row[1])) {
    assert.equal(row[header.indexOf('Max Gas')], row[header.indexOf('B1a')])
    assert.equal(row[header.indexOf('Max Liquid')], row[header.indexOf('B1a')])
    assert.equal(row[header.indexOf('Max Water')], row[header.indexOf('A2b')])
  }
  const reopened = reopenComparisonWorkbook(buffer, 'comparison.xlsx')
  const restoredRows = buildTemplateComparisonRows(reopened, templateRows)
  const originalRows = buildTemplateComparisonRows(cases, templateRows)
  restoredRows.forEach((row, i) => {
    reopened.forEach((c, ci) => assert.equal(row.values[c.id], originalRows[i].values[cases[ci].id]))
  })
  assert.equal(buildGoverningCaseColumns(reopened).get('1032').gas.caseName, 'B1a')
})
