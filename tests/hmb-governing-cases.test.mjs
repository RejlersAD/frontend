import assert from 'node:assert/strict'
import test from 'node:test'
import * as XLSX from 'xlsx'
import { buildComparison, buildTemplateComparisonRows, buildGoverningCaseColumns, getGoverningCaseValue, resolveTemplateProperty, convertTemplateEditValue } from '../src/pages/Engineering/Process/HMBStreamTableConsolidator/compare.ts'
import { MASTER_REVIEW_ROWS } from '../src/pages/Engineering/Process/HMBStreamTableConsolidator/template.ts'
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

test('all master rows resolve consistently across multiple non-1032 streams with different governing cases', () => {
  const streamNames = ['7', '12', '33']
  const cases = make1032Cases().slice(0, 3).map((item, ci) => ({ ...item,
    streams: streamNames.map((name, si) => {
      const p = (name, section, unit, value) => ({ name, section, unit, value, edited: false })
      const liquid = ci === (si + 1) % 3 ? 100 : ci + 1
      return { name, included: true, properties: [
        p('Temperature', '', 'F', 100 + 10 * si + ci),
        p('Std. Gas Flow', 'Vapour', 'MMSCFD', ci === si ? 10 : ci + 1),
        p('Act. Volume Flow', 'Vapour', 'barrel/day', [0, 240, 3.826e-10][si]),
        p('Act. Volume Flow', 'Light Liquid', 'barrel/day', liquid * 24 / 5.614583333333333),
        p('Mass Flow', 'Heavy Liquid', 'lb/hr', ci === (si + 2) % 3 ? 1000 : ci + 1),
        p('H2O', 'Composition', 'mol frac.', 0.9 + ci / 100),
      ] }
    }),
  }))
  const rows = buildTemplateComparisonRows(cases, MASTER_REVIEW_ROWS)
  assert.equal(rows.length, 3 * 68)
  const governing = buildGoverningCaseColumns(cases)
  for (const row of rows) {
    const si = streamNames.indexOf(row.streamName)
    cases.forEach(c => {
      const resolved = resolveTemplateProperty(c.streams[si], { section: row.section, name: row.propertyName, unit: row.unit })
      assert.equal(resolved?.value ?? null, row.values[c.id])
    })
    for (const [kind, winner] of [['gas', si], ['liquid', (si + 1) % 3], ['water', (si + 2) % 3]]) {
      assert.equal(governing.get(row.streamName)[kind].caseId, cases[winner].id)
      assert.equal(getGoverningCaseValue(row, governing.get(row.streamName)[kind]), row.values[cases[winner].id])
    }
  }
  const zero = rows.find(r => r.streamName === '7' && r.section === 'Vapour' && r.propertyName === 'Actual Volume Flow')
  assert.equal(zero.values[cases[0].id], 0)
  const tiny = rows.find(r => r.streamName === '33' && r.section === 'Vapour' && r.propertyName === 'Actual Volume Flow')
  assert.ok(tiny.values[cases[0].id] > 0)
  const missing = rows.find(r => r.streamName === '12' && r.section === 'Light Liquid' && r.propertyName === 'Viscosity')
  assert.equal(missing.values[cases[0].id], null)
})

test('converted Review edits retain source units and identity and update comparison values', () => {
  const property = { name: 'Act. Volume Flow', section: 'Light Liquid', unit: 'barrel/day', value: 240, edited: false }
  const stream = { name: '12', included: true, properties: [property] }
  const row = { section: 'Light Liquid', name: 'Actual Volume Flow', unit: 'ft3/hr' }
  const resolved = resolveTemplateProperty(stream, row)
  assert.equal(resolved.property, property)
  assert.equal(resolved.value, 240 * 5.614583333333333 / 24)
  property.value = Number(convertTemplateEditValue('100', row.unit, property.unit))
  assert.ok(Math.abs(property.value - 100 * 24 / 5.614583333333333) < 1e-9)
  assert.ok(Math.abs(resolveTemplateProperty(stream, row).value - 100) < 1e-9)
  assert.equal(property.unit, 'barrel/day')
  assert.equal(convertTemplateEditValue('', row.unit, property.unit), '')
  assert.equal(convertTemplateEditValue('not numeric', row.unit, property.unit), 'not numeric')
  assert.equal(convertTemplateEditValue('120', 'ft3/hr', 'ACFM'), '2')
})
