import assert from 'node:assert/strict'
import test from 'node:test'
import Module, { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
const result = await build({
  stdin: {
    contents: [
      "export * from './src/config/valveMTO.config.js';",
      "export * from './src/config/valveMTOExporter.js';",
      "export * from './src/config/valveMTOImporter.js';",
    ].join('\n'),
    resolveDir: root,
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  write: false,
})
const compiled = new Module(path.join(root, 'tests', 'valve-mto-columns.cjs'))
compiled.paths = Module._nodeModulePaths(root)
compiled._compile(result.outputFiles[0].text, compiled.id)
const valve = compiled.exports

test('shared schema hides legacy columns without removing stored fields', () => {
  assert.equal(valve.VALVE_COLUMNS.find(c => c.key === 'size_1').label, 'SIZE (NB)')
  assert.equal(valve.isValveColumnVisible('size_1'), true)
  for (const key of ['size_2', 'line_list']) {
    assert.equal(valve.isValveColumnVisible(key), false)
    assert.ok(Object.hasOwn(valve.DEFAULT_ROW(), key))
  }
})

test('nominal size uses only an explicitly quoted leading line-number size', () => {
  for (const [line, expected] of [
    ['4"-PL-DC3N-8198-P', '4"'],
    ['1/2"-CD-AC3N-8052', '1/2"'],
    ['1-1/2"-PL-DC3N-8198-P', '1-1/2"'],
    ['1 1/2\u2033\u2013PL\u2013DC3N\u20138198\u2013P', '1 1/2"'],
    ['604-LFG-3-AC2GA0-2012', ''],
    ['DN100-PL-DC3N-8198-P', ''],
    ['', ''],
  ]) assert.equal(valve.sizeNBFromLineNumber(line), expected, line)
})

test('drawing titles are free text and do not select installation allocation', async t => {
  const title = 'PIPING AND INSTRUMENTATION DIAGRAM AA PRODUCTION PLATFORM MPFM'
  const column = valve.VALVE_COLUMNS.find(c => c.key === 'area')
  assert.equal(column.type, 'text')
  assert.equal(valve.allocationTab({ area: title }), '')
  assert.equal(valve.allocationTab({ area: 'OIL FIELD PROCESS DIAGRAM' }), '')
  assert.equal(valve.allocationTab({ area: title, tab: 'island' }), 'island')
  const source = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(source, XLSX.utils.aoa_to_sheet([
    ['TYPE', 'DRG. TITLE', 'SIZE (NB)', 'VALVE TAG'],
    ['GATE', title, '2"', 'HV-101'],
  ]), 'ISLAND')
  const buffer = XLSX.write(source, { type: 'buffer', bookType: 'xlsx' })
  const imported = await valve.importValveMTOFile({ arrayBuffer: async () => buffer })
  assert.equal(imported.rows[0].area, title)
  assert.equal(imported.rows[0].tab, 'island')
  const workbooks = []
  t.mock.method(XLSX, 'writeFile', wb => workbooks.push(wb))
  valve.exportValveMTOWorkbook({ rows: imported.rows })
  valve.exportValveMTOAllData({ rows: imported.rows })
  for (const wb of workbooks) {
    const cells = XLSX.utils.sheet_to_json(wb.Sheets.ISLAND, { header: 1 })
    assert.equal(cells[5][cells[4].indexOf('AREA')], title)
  }
})

test('blank size is filled from line prefix in import and both export formats', async t => {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['TYPE', 'AREA', 'VALVE TAG', 'LINE NUMBER'],
    ['GATE VALVE', 'ISLAND', 'HV-101', '4"-PL-DC3N-8198-P'],
  ]), 'ISLAND')
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  const imported = await valve.importValveMTOFile({ arrayBuffer: async () => buffer })
  assert.equal(imported.rows[0].size_1, '4"')
  const generated = []
  t.mock.method(XLSX, 'writeFile', wb => generated.push(wb))
  const rows = [{ type: 'GATE VALVE', area: 'ISLAND', line_number: '4"-PL-DC3N-8198-P', size_1: '' }]
  valve.exportValveMTOWorkbook({ rows })
  valve.exportValveMTOAllData({ rows })
  for (const wb of generated) {
    const cells = XLSX.utils.sheet_to_json(wb.Sheets.ISLAND, { header: 1 })
    assert.equal(cells[5][cells[4].indexOf('SIZE (NB)')], '4"')
  }
})

test('standard and all-data exports use revised headers and preserve remaining values', t => {
  const workbooks = []
  t.mock.method(XLSX, 'writeFile', workbook => workbooks.push(workbook))
  const rows = [{ type: 'GATE VALVE', area: 'ISLAND', size_1: '2"', size_2: '1"',
    line_list: 'LEGACY-LL', line_number: 'LINE-101', qty_island: 1, qty_observed: 1 }]
  valve.exportValveMTOWorkbook({ rows })
  valve.exportValveMTOAllData({ rows })
  for (const workbook of workbooks) {
    for (const name of workbook.SheetNames) {
      const cells = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '' })
      assert.ok(!cells.flat().some(cell => ['SIZE 1 (NB)', 'SIZE 2 (NB)', 'LINE LIST'].includes(cell)), name)
      if (/notes|pivot/i.test(name)) continue
      const headers = cells[4]
      assert.ok(headers.includes('SIZE (NB)'), name)
      if (name === 'FIELD') continue
      assert.equal(cells[5][headers.indexOf('SIZE (NB)')], '2"', name)
      assert.equal(cells[5][headers.indexOf('LINE NUMBER')], 'LINE-101', name)
    }
  }
  assert.equal(rows[0].size_2, '1"')
  assert.equal(rows[0].line_list, 'LEGACY-LL')
})

test('imports accept both the renamed size header and legacy columns', async () => {
  for (const sizeHeader of ['SIZE (NB)', 'SIZE 1 (NB)']) {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['TYPE', sizeHeader, 'SIZE 2 (NB)', 'LINE LIST', 'LINE NUMBER'],
      ['GATE VALVE', '2"', '1"', 'LEGACY-LL', 'LINE-101'],
    ]), 'ISLAND')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const imported = await valve.importValveMTOFile({ arrayBuffer: async () => buffer })
    assert.equal(imported.rows.length, 1)
    assert.equal(imported.rows[0].size_1, '2"')
    assert.equal(imported.rows[0].size_2, '1"')
    assert.equal(imported.rows[0].line_list, 'LEGACY-LL')
  }
})
