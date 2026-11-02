// Read-only HYSYS workbook audit against the 68-row master layout. A nonzero
// exit status means a source value or governing case did not match. Input
// workbook content is data; it is never evaluated as code or written back.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { MASTER_REVIEW_ROWS as template } from '../src/pages/Engineering/Process/HMBStreamTableConsolidator/template.ts'
import { parseWorkbook, makeCase } from '../src/pages/Engineering/Process/HMBStreamTableConsolidator/parse.ts'
import { buildTemplateComparisonRows, buildGoverningCaseColumns, getGoverningCaseValue, resolveTemplateProperty } from '../src/pages/Engineering/Process/HMBStreamTableConsolidator/compare.ts'
const norm = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const present = value => value !== null && value !== undefined && value !== ''
const number = value => typeof value === 'string' && /^-?[\d,]+(\.\d+)?([eE][+-]?\d+)?$/.test(value.trim()) ? Number(value.replaceAll(',', '')) : value
const phase = value => /vapou?r/i.test(value) ? 'Vapour' : /aqueous|heavy liquid/i.test(value) ? 'Heavy Liquid' : /liquid/i.test(value) ? 'Light Liquid' : ''
const key = (stream, row) => JSON.stringify([norm(stream), row.section, row.name, row.unit])
const aliases = {
  Temperature: ['Temperature'], Pressure: ['Pressure'], 'Molecular Weight': ['Molecular Weight'],
  'Mass Flow': ['Mass Flow'], 'Vapour Fraction': ['Vapour / Phase Fraction', 'Vapor / Phase Fraction'],
  'Std Gas Flow': ['Std. Gas Flow', 'Standard Gas Flow'],
  'Standard Ideal Liquid Volume Flow': ['Std Ideal Liq Vol Flow', 'Standard Ideal Liquid Volume Flow'],
  'Mass Density': ['Mass Density'], Viscosity: ['Viscosity'],
  Compressibility: ['Z Factor', 'Compressibility'], 'Thermal Conductivity': ['Thermal Conductivity'],
  'Mass Heat Capacity': ['Mass Heat Capacity'], 'Cp/Cv (Gamma)': ['Cp/Cv', 'Cp/Cv (Ent. Method)', 'Ideal Gas Cp/Cv'],
}
function sourceValue(data, headers, row) {
  if (!data) return null
  if (row.name === 'Actual Volume Flow') {
    const choices = row.unit === 'barrel/day'
      ? [['Act. Volume Flow', 1], ['Act. Liq. Flow', 24 / 5.614583333333333], ['Act. Gas Flow', 60 * 24 / 5.614583333333333]]
      : row.section === 'Vapour'
        ? [['Act. Gas Flow', 60], ['Act. Volume Flow', 5.614583333333333 / 24]]
        : [['Act. Liq. Flow', 1], ['Act. Volume Flow', 5.614583333333333 / 24]]
    for (const [name, factor] of choices) {
      const col = headers.findIndex(h => norm(h) === norm(name))
      if (col >= 0 && present(data[col])) return number(data[col]) * factor
    }
    return null
  }
  for (const name of aliases[row.name] || [row.name]) {
    const col = headers.findIndex(h => norm(h) === norm(name))
    if (col >= 0 && present(data[col])) return number(data[col])
  }
  return null
}

// Independently read the documented HYSYS criterion hierarchy from source cells.
function sourceRate(kind, section, data, overall, phaseHeaders, overallHeaders) {
  const read = (name, unit = '') => sourceValue(data, phaseHeaders, { name, section, unit })
  const readOverall = name => sourceValue(overall, overallHeaders, { name, section: '', unit: '' })
  const scale = (value, factor) => present(value) ? value * factor : null
  const volume = 5.614583333333333 / 24
  let candidates
  if (kind === 'gas') candidates = [
    [4, read('Std Gas Flow')], [3, read('Actual Volume Flow', 'ft3/hr')],
    [2, read('Mass Flow')], [1, readOverall('Std Gas Flow')],
    [0, scale(sourceValue(overall, overallHeaders, {name:'Act. Gas Flow', section:''}), 60)],
  ]
  if (kind === 'liquid') candidates = [
    [4, read('Actual Volume Flow', 'ft3/hr')],
    [3, scale(read('Standard Ideal Liquid Volume Flow'), volume)],
    [2, read('Mass Flow')],
    [1, sourceValue(overall, overallHeaders, {name:'Act. Liq. Flow', section:''})
      ?? scale(readOverall('Standard Ideal Liquid Volume Flow'), volume)],
  ]
  if (kind === 'water') candidates = [
    [4, read('Mass Flow')], [3, scale(read('Standard Ideal Liquid Volume Flow'), volume)],
    [2, read('Actual Volume Flow', 'ft3/hr')],
  ]
  return candidates.find(([, value]) => typeof value === 'number' && Number.isFinite(value)) || null
}
const folder = process.argv[2]
if (!folder) throw new Error('Usage: node --experimental-strip-types scripts/audit-hmb-workbooks.mjs <workbook-directory> [report.json]')
const files = readdirSync(folder).filter(f => /^Case_.*HYSYS_Streams(?: \(1\))?\.xlsx$/.test(f)).sort()
if (!files.length) throw new Error('No HYSYS case workbooks found in the supplied directory.')
const cases = [], expectedByCase = new Map(), criteriaByCase = new Map(), summaries = []
const grid = (wb, sheet) => XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: null })
for (const file of files) {
  const buffer = readFileSync(`${folder}/${file}`)
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const streams = grid(wb, 'Streams'), phases = grid(wb, 'Phase Properties'), comps = grid(wb, 'Compositions')
  const overall = new Map(streams.slice(3).filter(r => present(r[0])).map(r => [norm(r[0]), r]))
  const phaseRows = new Map(phases.slice(2).map(r => [`${norm(r[0])}|${phase(r[1])}`, r]))
  const ci = comps[0].findIndex(h => norm(h) === 'component'), fi = comps[0].findIndex(h => norm(h) === 'mole fraction')
  const components = new Map(comps.slice(2).filter(r => norm(r[1]) === 'overall').map(r => [`${norm(r[0])}|${norm(r[ci])}`, r[fi]]))
  const parsed = makeCase(parseWorkbook(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), file), file)
  cases.push(parsed)
  const expected = new Map(), criteria = new Map()
  let reported = 0
  for (const [stream, source] of overall) {
    for (const row of template) {
      const value = row.section === 'Composition' ? components.get(`${stream}|${norm(row.name)}`)
        : sourceValue(row.section ? phaseRows.get(`${stream}|${row.section}`) : source, row.section ? phases[0] : streams[1], row)
      expected.set(key(stream, row), present(value) ? number(value) : null)
      if (present(value)) reported++
    }
    const primary = {}
    for (const [kind, section] of [['gas','Vapour'],['liquid','Light Liquid'],['water','Heavy Liquid']]) {
      primary[kind] = sourceRate(kind, section, phaseRows.get(`${stream}|${section}`), source, phases[0], streams[1])
    }
    criteria.set(stream, primary)
  }
  expectedByCase.set(parsed.id, expected)
  criteriaByCase.set(parsed.id, criteria)
  summaries.push({file,sourceStreams:overall.size,parsedStreams:parsed.streams.length,sourcePopulatedTemplateCells:reported})
  console.log('READ', JSON.stringify(summaries.at(-1)))
}
const rows = buildTemplateComparisonRows(cases, template)
const rowMap = new Map(rows.map(r => [key(r.streamName, {section:r.section,name:r.propertyName,unit:r.unit}),r]))
const issues = new Map(), samples = []
let checked = 0, reviewGaps = 0, comparisonGaps = 0
const equal = (a,b) => a === b || typeof a === 'number' && typeof b === 'number'
  && Math.abs(a-b) <= Math.max(Math.abs(a),Math.abs(b),Number.MIN_VALUE)*1e-9
for (const item of cases) {
  const lookup = new Map(item.streams.map(s=>[norm(s.name),s]))
  for (const [cellKey, expected] of expectedByCase.get(item.id)) {
    if (present(expected)) checked++
    const [stream,section,name,unit] = JSON.parse(cellKey)
    const row = {section,name,unit}
    const reviewed = lookup.has(stream) ? resolveTemplateProperty(lookup.get(stream),row)?.value ?? null : null
    const compared = rowMap.get(cellKey)?.values[item.id] ?? null
    for(const [view,actual] of [['review',reviewed],['comparison',compared]]) {
      if(equal(actual,expected)) continue
      if(view==='review') reviewGaps++; else comparisonGaps++
      const label=`${view}|${section}|${name}|${unit}`
      issues.set(label,(issues.get(label)||0)+1)
      if(samples.length<30) samples.push({file:item.fileName,stream,section,name,unit,view,expected,actual})
    }
  }
}
const columns=buildGoverningCaseColumns(cases)
let governingChecked=0, governingMismatches=0, maxCellsChecked=0, maxCellMismatches=0
for(const [stream,entry] of columns){
 for(const kind of ['gas','liquid','water']){
  let expectedCase=null, max=null, priority=-1
  for(const item of cases){
    const candidate=criteriaByCase.get(item.id).get(norm(stream))?.[kind]
    if(!candidate)continue
    const [rank,v]=candidate
    if(rank>priority || rank===priority && (max===null||v>max)){priority=rank;max=v;expectedCase=item.id}
  }
  if(expectedCase){governingChecked++;if(entry[kind].caseId!==expectedCase){governingMismatches++;if(samples.length<40)samples.push({stream,kind,expectedCase:cases.find(c=>c.id===expectedCase).name,actualCase:entry[kind].caseName})}}
 }
}
for(const row of rows) for(const kind of ['gas','liquid','water']){
 const column=columns.get(row.streamName)?.[kind]
 if(!column?.caseId)continue
 maxCellsChecked++
 const sourceExpected=expectedByCase.get(column.caseId).get(key(row.streamName,{section:row.section,name:row.propertyName,unit:row.unit}))??null
 if(!equal(getGoverningCaseValue(row,column),sourceExpected)) maxCellMismatches++
}
const potentialCells=summaries.reduce((count,file)=>count+file.sourceStreams*template.length,0)
const report={files:summaries,templateRows:template.length,streams:columns.size,checked,sourceEmptyTemplateCells:potentialCells-checked,reviewGaps,comparisonGaps,issues:Object.fromEntries(issues),governingChecked,governingMismatches,maxCellsChecked,maxCellMismatches,samples}
if (process.argv[3]) writeFileSync(process.argv[3],JSON.stringify(report,null,2))
process.exitCode = reviewGaps || comparisonGaps || governingMismatches || maxCellMismatches ? 1 : 0
console.log('REPORT',JSON.stringify(report,null,2))
