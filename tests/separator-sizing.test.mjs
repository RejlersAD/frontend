import assert from 'node:assert/strict'
import test from 'node:test'
import ExcelJS from 'exceljs'
import { mapSeparatorStream, normalizeSizingEdit, restoreSizingEdits, separatorComparisonSources, separatorSourceCases, sizingCalculationUnit, sizingInputBundle, sourceSizingCell, SEPARATOR_INPUT_KEYS } from '../src/pages/Engineering/Process/HMBStreamTableConsolidator/separatorMapping.ts'
import { buildGoverningCaseColumns, buildTemplateComparisonRows, getGoverningCaseValue } from '../src/pages/Engineering/Process/HMBStreamTableConsolidator/compare.ts'
import { MASTER_REVIEW_ROWS } from '../src/pages/Engineering/Process/HMBStreamTableConsolidator/template.ts'
import { buildSeparatorWorkbook } from '../src/pages/Engineering/Process/HMBStreamTableConsolidator/separatorExport.js'
import { restoreSeparatorSnapshot, snapshotBasis } from '../src/pages/Engineering/Process/HMBStreamTableConsolidator/separatorSnapshot.js'
import { separatorDatasheet } from '../src/pages/Engineering/Process/HMBStreamTableConsolidator/separatorDatasheetModel.js'

const property = (section, name, unit, value) => ({ section, name, unit, value, edited: false })
const stream = { name: '1032', included: true, properties: [
  property('', 'Pressure', 'psig', 290.07547546),
  property('', 'Temperature', 'F', 140),
  property('Vapour', 'Std Gas Flow', 'MMSCFD', 30),
  property('Vapour', 'Molecular Weight', '<none>', 20),
  property('Vapour', 'Z Factor', '<none>', .92),
  property('Light Liquid', 'Actual Volume Flow', 'barrel/day', 30190),
  property('Light Liquid', 'Mass Density', 'lb/ft3', 51.2),
  property('Light Liquid', 'Viscosity', 'cP', 3),
  property('Heavy Liquid', 'Actual Volume Flow', 'ft3/hr', 1765.733),
] }

test('mapping uses phase-qualified actual properties, explicit units and provenance', () => {
  const mapped = mapSeparatorStream(stream)
  assert.ok(Math.abs(mapped.pressure.value - 20) < 1e-8)
  assert.ok(Math.abs(mapped.temperature.value - 60) < 1e-10)
  assert.equal(mapped.gas_mw.value, 20)
  assert.equal(mapped.gas_z.value, .92)
  assert.equal(mapped.oil_flow.source.unit, 'barrel/day')
  assert.ok(mapped.oil_flow.value > 199 && mapped.oil_flow.value < 201)
  assert.equal(mapped.water_density.value, null)
})

test('missingness, zero and reviewed edits are preserved; unknown units are not guessed', () => {
  const mapped = mapSeparatorStream({ ...stream, properties: [
    property('Vapour', 'Std Gas Flow', 'MMSCFD', 0),
    property('Light Liquid', 'Actual Volume Flow', '', 100),
    { ...property('Heavy Liquid', 'Actual Volume Flow', 'ft3/hr', 100), edited: true },
    property('', 'Molecular Weight', '<none>', 99),
  ] })
  assert.equal(mapped.gas_flow.value, 0)
  assert.equal(mapped.oil_flow.value, null)
  assert.equal(mapped.gas_mw.value, null)
  assert.equal(mapped.water_flow.source.edited, true)
})

test('standard ideal liquid and mass flow are never actual-flow fallbacks', () => {
  const mapped = mapSeparatorStream({ ...stream, properties: [
    property('Light Liquid', 'Standard Ideal Liquid Volume Flow', 'barrel/day', 100),
    property('Heavy Liquid', 'Mass Flow', 'lb/hr', 1000),
  ] })
  assert.equal(mapped.oil_flow.value, null)
  assert.equal(mapped.water_flow.value, null)
})

test('all cases with an included matching stream retain their own properties', () => {
  const cases = [
    { id: 'a', name: 'A', fileName: 'a.xlsx', sheetName: 'Streams', streams: [stream] },
    { id: 'b', name: 'B', fileName: 'b.xlsx', sheetName: 'Streams', streams: [{ ...stream, included: false }] },
  ]
  assert.deepEqual(separatorSourceCases(cases, '1032').map((item) => item.id), ['a'])
})

test('gas density stays vapour-scoped and normalized separately from sizing inputs', () => {
  const gasStream = { ...stream, properties: [...stream.properties,
    property('Vapour', 'Mass Density', 'lb/ft3', 1),
    property('Light Liquid', 'Mass Density', 'lb/ft3', 99)] }
  const sources = separatorSourceCases([{ id: 'a', name: 'A', fileName: 'a.xlsx', sheetName: 'Streams', streams: [gasStream] }], '1032')
  assert.ok(Math.abs(sources[0].gasDensity.value - 16.01846337396) < 1e-10)
  assert.equal(sources[0].gasDensity.source.section, 'Vapour')
  assert.equal(Object.hasOwn(sources[0].mapping, 'gas_density'), false)
})

test('four-sheet XLSX preserves numeric results, criteria, provenance and qualifications', async () => {
  const result = { version: 'separator-1.0', status: 'REVIEW', qualification: 'Engineering aid only',
    governing_case: 'A', diameter_m: 2.8, length_m: 11.2, effective_length_m: 8.96,
    cases: [{ id: 'a', name: 'A', oil_retention: 8.17, settling: { oil_re: 3.77 }, warnings: ['Outside Stokes range'], status: 'REVIEW' }],
    nozzles: { inlet: { required_mm: 397.4, selected_mm: 438.2, nps: 18, case_id: 'a', status: 'OK' } },
    levels_mm: { nll: 1680 }, preliminary: { status: 'PRELIMINARY - NOT CODE VERIFIED', shell_mm: 26, warnings: ['Not ASME certified'] } }
  const request = { cases: [{ id: 'a', name: 'A', inputs: { gas_flow: 30 } }], criteria: { k: .12 } }
  const provenance = [{ id: 'a', fileName: 'a.xlsx', sheetName: 'Streams', mapping: mapSeparatorStream(stream), overrideKeys: ['gas_flow'],
    comparisonColumn: 'Max Gas', sourceCaseId: 'original-a', sourceCaseName: 'Original A' }]
  const schema = { inputs: { gas_flow: { label: 'Gas flow', unit: 'MMSCFD' } }, criteria: { k: { label: 'K', unit: 'm/s' } }, nozzle_table: [{ nps: 18, id_mm: 438.2 }] }
  const blob = await buildSeparatorWorkbook(result, request, provenance, { tag: 'V-1001', service: 'Separator', stream: '1032' }, schema)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await blob.arrayBuffer())
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ['Input', 'Design Criteria', 'Calculation', 'Data Sheet'])
  assert.equal(workbook.getWorksheet('Input').getCell('E8').value, 30)
  assert.equal(workbook.getWorksheet('Input').getCell('L8').value, true)
  assert.equal(workbook.getWorksheet('Input').getCell('M8').value, 'Vapour')
  assert.equal(workbook.getWorksheet('Input').getCell('N8').value, 'Max Gas')
  assert.equal(workbook.getWorksheet('Input').getCell('O8').value, 'original-a')
  assert.equal(workbook.getWorksheet('Input').getCell('P8').value, 'Original A')
  assert.equal(workbook.getWorksheet('Design Criteria').getCell('B6').value, 438.2)
  assert.equal(workbook.getWorksheet('Data Sheet').getCell('B7').value, 2.8)
  assert.ok(JSON.stringify(workbook.getWorksheet('Data Sheet').getSheetValues()).includes('NOT CODE VERIFIED'))
})

test('snapshot basis retains source evidence and only relevant exclusions/overrides', () => {
  const sources = [{ id: 'a', mapping: mapSeparatorStream(stream) }]
  const request = { cases: [], criteria: { k: .12 } }
  const basis = snapshotBasis(request, sources, ['a', 'removed'], { 'a:oil_flow': '210', 'removed:oil_flow': '9' }, { tag: 'V-1001' })
  assert.deepEqual(basis.excluded, ['a'])
  assert.deepEqual(basis.overrides, { 'a:oil_flow': '210' })
  assert.equal(basis.sources[0].mapping.oil_flow.source.unit, 'barrel/day')
})

test('restoring a supported historical snapshot preserves criteria without calculating', () => {
  const snapshot = { format: 'radai.separator.snapshot', format_version: 1, calculator_version: 'old',
    result: { version: 'old', diameter_m: 2.8 }, schema: { version: 'old' },
    basis: { sources: [{ id: 'a' }], excluded: [], overrides: {}, metadata: { tag: 'V-1001' }, request: { criteria: { k: .12 } } } }
  const restored = restoreSeparatorSnapshot({ historical: true, archive: { project_id: 'project' }, snapshot })
  assert.deepEqual(restored.criteria, { k: '0.12' })
  assert.equal(restored.snapshot.result.version, 'old')
  assert.throws(() => restoreSeparatorSnapshot({ snapshot }), /invalid/)
})

function comparisonCase(id, pressure, temperature, gas, oil, water, mw) {
  return { id, name: `HYSYS ${id}`, fileName: `${id}.xlsx`, sheetName: 'Streams',
    streams: [{ name: '101', included: true, properties: [
      property('', 'Pressure', 'psig', pressure / .0689475729318),
      property('', 'Temperature', 'F', temperature * 9 / 5 + 32),
      property('', 'Molecular Weight', '<none>', 999),
      property('Vapour', 'Std Gas Flow', 'MMSCFD', gas),
      property('Vapour', 'Molecular Weight', '<none>', mw),
      property('Vapour', 'Compressibility', '<none>', .92),
      property('Vapour', 'Viscosity', 'cP', .012),
      property('Vapour', 'Mass Density', 'lb/ft3', 1),
      property('Light Liquid', 'Actual Volume Flow', 'ft3/hr', oil / .028316846592),
      property('Light Liquid', 'Mass Density', 'lb/ft3', 825 / 16.01846337396),
      property('Light Liquid', 'Viscosity', 'cP', 3.5),
      property('Heavy Liquid', 'Actual Volume Flow', 'ft3/hr', water / .028316846592),
      property('Heavy Liquid', 'Mass Density', 'lb/ft3', 1035 / 16.01846337396),
      property('Heavy Liquid', 'Viscosity', 'cP', .48),
    ] }] }
}

test('sizing consumes only the three full Cross-case comparison governing columns', () => {
  const cases = [comparisonCase('oil', 20, 60, 30, 200, 50, 20),
    comparisonCase('water', 21, 65, 25, 120, 220, 20.5),
    comparisonCase('gas', 22, 55, 60, 150, 80, 19.5),
    comparisonCase('not-selected', 1, 30, 1, 1, 1, 18)]
  const sources = separatorComparisonSources(cases, '101')
  assert.deepEqual(sources.map((item) => item.name), ['Max Oil', 'Max Water', 'Max Gas'])
  assert.deepEqual(sources.map((item) => item.sourceCaseId), ['oil', 'water', 'gas'])
  assert.deepEqual(sources.map((item) => item.comparisonColumn), ['Max Liquid', 'Max Water', 'Max Gas'])
  const rows = buildTemplateComparisonRows(cases, MASTER_REVIEW_ROWS)
  const columns = buildGoverningCaseColumns(cases).get('101')
  for (const [index, kind] of ['liquid', 'water', 'gas'].entries()) {
    const pressure = rows.find((row) => row.section === '' && row.propertyName === 'Pressure')
    const oil = rows.find((row) => row.section === 'Light Liquid' && row.propertyName === 'Actual Volume Flow' && row.unit === 'ft3/hr')
    assert.equal(sources[index].mapping.pressure.value, getGoverningCaseValue(pressure, columns[kind]) * .0689475729318)
    assert.equal(sources[index].mapping.oil_flow.value, getGoverningCaseValue(oil, columns[kind]) * .028316846592)
  }
  assert.equal(sources[1].mapping.gas_flow.value, 25)
  assert.equal(sources[1].mapping.gas_mw.value, 20.5)
  assert.ok(Math.abs(sources[1].mapping.temperature.value - 65) < 1e-10)
  assert.ok(Math.abs(sources[1].mapping.oil_flow.value - 120) < 1e-10)
})

test('one governing source can fill all three columns without duplicate sizing IDs', () => {
  const sources = separatorComparisonSources([comparisonCase('shared', 20, 60, 10, 10, 10, 20)], '101')
  assert.equal(new Set(sources.map((item) => item.id)).size, 3)
  assert.deepEqual(sources.map((item) => item.sourceCaseId), ['shared', 'shared', 'shared'])
})

test('comparison missing phase properties stay missing instead of falling back to raw/overall values', () => {
  const data = comparisonCase('a', 20, 60, 10, 10, 10, 20)
  data.streams[0].properties = data.streams[0].properties.filter((item) => !(item.section === 'Vapour' && item.name === 'Molecular Weight'))
  const sources = separatorComparisonSources([data], '101')
  assert.equal(sources[0].mapping.gas_mw.value, null)
  assert.equal(sources[0].mapping.gas_flow.value, 10)
  assert.deepEqual(separatorComparisonSources([data], 'missing-stream'), [])
})

const calculationSpecs = Object.fromEntries(SEPARATOR_INPUT_KEYS.map((key) => [key, { unit: sizingCalculationUnit(key) }]))

test('editable comparison units are retained and conversions occur in calculation payloads', () => {
  const sources = separatorComparisonSources([comparisonCase('water', 20, 65, 25, 120, 220, 20.5)], '101')
  const selected = sources[1]
  assert.equal(sourceSizingCell(selected, 'pressure').unit, 'psig')
  assert.equal(sourceSizingCell(selected, 'temperature').unit, 'F')
  assert.equal(sourceSizingCell(selected, 'oil_flow').unit, 'ft3/hr')
  assert.equal(sourceSizingCell(selected, 'oil_density').unit, 'lb/ft3')
  const overrides = { [`${selected.id}:temperature`]: '212', [`${selected.id}:pressure`]: '100',
    [`${selected.id}:oil_flow`]: '1000', [`${selected.id}:oil_density`]: '50' }
  const bundle = sizingInputBundle(sources, overrides, calculationSpecs)
  assert.deepEqual(bundle.unitErrors, [])
  const inputs = bundle.cases[1].inputs
  assert.ok(Math.abs(inputs.temperature - 100) < 1e-10)
  assert.ok(Math.abs(inputs.pressure - 6.89475729318) < 1e-10)
  assert.ok(Math.abs(inputs.oil_flow - 28.316846592) < 1e-10)
  assert.ok(Math.abs(inputs.oil_density - 800.923168698) < 1e-9)
  const restored = restoreSizingEdits(sources, bundle.normalizedOverrides)
  for (const [key, value] of Object.entries(overrides)) assert.ok(Math.abs(Number(restored[key]) - Number(value)) < 1e-9)
  assert.equal(sourceSizingCell(selected, 'temperature').value, 149)
})

test('source units survive missing comparison values and unknown/absolute units block sizing', () => {
  const data = comparisonCase('a', 20, 60, 10, 10, 10, 20)
  data.streams[0].properties = data.streams[0].properties.filter((item) => item.name !== 'Molecular Weight')
  const sources = separatorComparisonSources([data], '101')
  assert.equal(sourceSizingCell(sources[0], 'gas_mw').unit, '<none>')
  assert.equal(sourceSizingCell(sources[0], 'gas_mw').value, null)
  sources[0].comparisonInputs.pressure.unit = 'psia'
  const bundle = sizingInputBundle(sources, {}, calculationSpecs)
  assert.ok(bundle.unitErrors.some((error) => error.includes('psia')))
  assert.equal(bundle.cases[0].inputs.pressure, null)
  assert.throws(() => normalizeSizingEdit('pressure', 'psia', 100), /unsupported/)
})

test('unit checks detect source/normalized disagreement, target changes and conversion overflow', () => {
  const sources = separatorComparisonSources([comparisonCase('a', 20, 60, 10, 10, 10, 20)], '101')
  sources[0].comparisonInputs.pressure.value += 10
  assert.ok(sizingInputBundle(sources, {}, calculationSpecs).unitErrors.some((error) => error.includes('disagree')))
  const changed = { ...calculationSpecs, temperature: { unit: 'K' } }
  assert.ok(sizingInputBundle(sources, {}, changed).unitErrors.some((error) => error.includes('temperature')))
  assert.throws(() => normalizeSizingEdit('oil_density', 'lb/ft3', 1e308), /bounds/)
  const bundle = sizingInputBundle(sources, { [`${sources[1].id}:oil_density`]: '1e308' }, calculationSpecs)
  assert.ok(bundle.unitErrors.some((error) => error.includes('bounds')))
})

test('datasheet exposes document header and sections 1-10 without demonstration defaults', () => {
  const model = separatorDatasheet({ tag: 'V-2001', service: 'Production', document: {
    project: 'Project A', client: 'Client A', documentNo: 'DS-2001', revision: 'B', date: '2026-11-05', preparedChecked: 'Prepared / Checked',
  } }, null)
  assert.equal(model.header.find((row) => row.label === 'Project').values[0], 'Project A')
  assert.equal(model.sections.length, 10)
  assert.equal(model.sections[0].rows.find((row) => row.label === 'Governing (design) case').values[0], 'Not calculated')
  assert.equal(model.sections[6].rows[0].values[0], 'Not configured')
  assert.equal(model.sections[7].schedule.find((row) => row[0] === 'N5')[3], 'Not configured')
})

test('datasheet uses current calculation values and preserves REVIEW statuses', () => {
  const result = { status: 'REVIEW', governing_case_id: 'water', governing_case: 'Max Water', diameter_m: 2.8, length_m: 11.2,
    criteria: { interface_trip: 200, interface_alarm: 100, oil_retention: 5, water_retention: 5, water_drop: 500, oil_drop: 200, gas_margin: .1, oil_margin: .1, water_margin: .1 },
    cases: [{ id: 'water', name: 'Max Water', inputs: { pressure: 20, temperature: 65 }, control: 'Liquid retention',
      nil_mm: 1102, status: 'REVIEW', gas_utilization: .83, warnings: ['Outside Stokes range'] }],
    levels_mm: { hhll: 1960 }, nozzles: {}, preliminary: { empty_kg: 28594, design_pressure_barg: 22 } }
  const model = separatorDatasheet({ tag: 'V-1001', service: 'Production' }, result)
  assert.equal(model.sections[3].rows[0].values[0], 2800)
  assert.equal(model.sections[4].rows.find((row) => row.label === 'HHIL - interface').values[0], 1302)
  assert.equal(model.sections[5].rows.find((row) => row.label === 'Overall check').values.at(-1), 'REVIEW')
  assert.equal(model.sections[8].rows[0].values[0], 28594)
})
