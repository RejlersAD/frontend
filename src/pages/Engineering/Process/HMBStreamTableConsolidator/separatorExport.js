export async function buildSeparatorWorkbook(result, request, provenance, metadata, schema) {
  if (!Array.isArray(schema.nozzle_table)) throw new Error('Calculator nozzle table is missing. Reload the criteria before exporting.')
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'RADAI HMB Separator Sizing'
  workbook.created = new Date()
  const input = workbook.addWorksheet('Input')
  input.addRow(['RADAI three-phase separator', 'Engineering aid - not approved design'])
  input.addRow(['Calculator version', result.version])
  input.addRow(['Equipment tag', metadata.tag])
  input.addRow(['Service', metadata.service])
  input.addRow(['Stream', metadata.stream])
  input.addRow(['Basis confirmed', request.basis_confirmed === true, request.execution_mode === 'automatic_preview' ? 'Unapproved automatic preview' : 'Horizontal / 2:1 heads; case-adjustable NIL'])
  input.addRow(['Case', 'Case ID', 'Property', 'Unit', 'Used value', 'Source file', 'Source sheet',
    'Source property', 'Source unit', 'Source value', 'HMB edited', 'Sizing override', 'Source phase',
    'Comparison column', 'Governing source case ID', 'Governing source case name'])
  for (const item of request.cases) {
    const source = provenance.find((entry) => entry.id === item.id)
    for (const [key, val] of Object.entries(item.inputs)) {
      const original = source?.mapping[key]
      input.addRow([item.name, item.id, schema.inputs[key].label, schema.inputs[key].unit, val,
        source?.fileName, source?.sheetName, original?.source?.property,
        original?.source?.unit, original?.source?.value, original?.source?.edited || false,
        source?.overrideKeys?.includes(key) ?? (val !== original?.value), original?.source?.section,
        source?.comparisonColumn, source?.sourceCaseId, source?.sourceCaseName])
    }
  }
  const criteria = workbook.addWorksheet('Design Criteria')
  criteria.addRow(['Engineer-confirmed criteria', 'Not project-approved specifications'])
  criteria.addRow(['Criterion', 'Value', 'Unit'])
  for (const [key, val] of Object.entries(request.criteria)) {
    criteria.addRow([schema.criteria[key].label, val, schema.criteria[key].unit])
  }
  criteria.addRow(['Nozzle table', 'Workbook Sch 40 <= 10 in / STD above; confirm project applicability'])
  criteria.addRow(['NPS in', 'Inside diameter mm'])
  for (const pipe of schema.nozzle_table) criteria.addRow([pipe.nps, pipe.id_mm])
  const calculation = workbook.addWorksheet('Calculation')
  calculation.addRow(['Deterministic calculated snapshot', result.version, result.status])
  calculation.addRow([result.qualification])
  calculation.addRow(['Case', 'Case ID', 'Metric', 'Value'])
  for (const item of result.cases) {
    for (const [key, val] of Object.entries(item)) {
      if (typeof val === 'number' || val === null || key === 'control' || key === 'status') {
        calculation.addRow([item.name, item.id, key, val])
      }
    }
    for (const [key, val] of Object.entries(item.settling)) calculation.addRow([item.name, item.id, `settling.${key}`, val])
    for (const warning of item.warnings) calculation.addRow([item.name, item.id, 'REVIEW', warning])
  }
  const data = workbook.addWorksheet('Data Sheet')
  data.addRow(['PROCESS DATA SHEET - THREE-PHASE SEPARATOR', result.status])
  data.addRow([result.qualification])
  data.addRow(['Equipment tag', metadata.tag])
  data.addRow(['Service', metadata.service])
  data.addRow(['Stream', metadata.stream])
  data.addRow(['Governing case', result.governing_case])
  data.addRow(['ID', result.diameter_m, 'm'])
  data.addRow(['T-T length', result.length_m, 'm'])
  data.addRow(['Effective length', result.effective_length_m, 'm'])
  for (const [level, height] of Object.entries(result.levels_mm)) data.addRow([level.toUpperCase(), height, 'mm'])
  data.addRow(['Nozzle', 'Required ID mm', 'Selected ID mm', 'NPS in', 'Controlling case ID', 'Status'])
  for (const [key, nozzle] of Object.entries(result.nozzles)) data.addRow([key, nozzle.required_mm, nozzle.selected_mm, nozzle.nps, nozzle.case_id, nozzle.status])
  data.addRow(['PRELIMINARY ESTIMATES - NOT CODE VERIFIED'])
  for (const [key, val] of Object.entries(result.preliminary)) {
    if (Array.isArray(val)) for (const warning of val) data.addRow(['Qualification', warning])
    else data.addRow([key, val])
  }
  const sheetModel = separatorDatasheet(metadata, result)
  data.addRow(['DOCUMENT INFORMATION'])
  for (const row of sheetModel.header) data.addRow([row.label, row.values[0]])
  for (const section of sheetModel.sections) {
    data.addRow([section.title])
    if (section.schedule) {
      data.addRow(section.columns)
      for (const row of section.schedule) data.addRow(row)
    } else {
      data.addRow(['Parameter', 'Unit', ...(section.columns || ['Value'])])
      for (const row of section.rows) data.addRow([row.label, row.unit, ...row.values])
    }
  }
  for (const sheet of workbook.worksheets) {
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF172B4D' } }
    sheet.columns.forEach((column) => { column.width = 28 })
    sheet.eachRow((row) => row.eachCell((cell) => {
      cell.alignment = { vertical: 'top', wrapText: true }
      if (typeof cell.value === 'number') cell.numFmt = '0.0000'
    }))
  }
  return new Blob([await workbook.xlsx.writeBuffer()], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export async function downloadSeparatorWorkbook(...args) {
  const blob = await buildSeparatorWorkbook(...args)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `Separator_${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
import { separatorDatasheet } from './separatorDatasheetModel.js'
