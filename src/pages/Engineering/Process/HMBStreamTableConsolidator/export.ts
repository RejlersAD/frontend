import ExcelJS from 'exceljs'
import type { CaseData } from './index.ts'
import { buildComparison, rowVaries } from './compare.ts'

export interface ExportOptions {
  highlightVariation: boolean
  flagEdited: boolean
  includeSummary: boolean
}

export function buildComparisonFilename(date: Date = new Date()): string {
  return `HMB_Comparison_${date.toISOString().slice(0, 10)}.xlsx`
}

const FILL_HEADER = 'FF172B4D'
const FILL_STREAM = 'FFEFF6FF'
const FILL_ALT = 'FFF8FAFC'
const FILL_VARIES = 'FFFFF7DB'
const FONT_EDITED = 'FFB45309'
const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFD8D8D2' } },
  bottom: { style: 'thin', color: { argb: 'FFD8D8D2' } },
  left: { style: 'thin', color: { argb: 'FFE6E6E0' } },
  right: { style: 'thin', color: { argb: 'FFE6E6E0' } },
}

const argb = (hex: string) => 'FF' + hex.replace('#', '').toUpperCase()

function numFormat(unit: string): string {
  if (/fraction|mol %|mass %/i.test(unit)) return '0.0000'
  return '#,##0.00##'
}

export async function exportComparison(
  cases: CaseData[],
  options: ExportOptions,
): Promise<void> {
  const blob = await buildComparisonWorkbookBlob(cases, options)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = buildComparisonFilename()
  a.click()
  URL.revokeObjectURL(a.href)
}

export async function buildComparisonWorkbookBlob(
  cases: CaseData[],
  options: ExportOptions,
): Promise<Blob> {
  const { rows, streamNames } = buildComparison(cases)
  const wb = new ExcelJS.Workbook()
  wb.creator = 'HMB Stream Table Consolidator'
  wb.created = new Date()

  if (options.includeSummary) {
    const sum = wb.addWorksheet('Summary')
    sum.columns = [
      { width: 24 }, { width: 30 }, { width: 18 }, { width: 12 }, { width: 14 },
    ]
    const t = sum.addRow(['HMB Stream Table Comparison'])
    t.font = { bold: true, size: 14, color: { argb: 'FF161616' } }
    sum.addRow([`Generated ${new Date().toLocaleString()}`]).font = {
      size: 10, color: { argb: 'FF989F9B' },
    }
    sum.addRow([])
    const head = sum.addRow(['Case', 'Source file', 'Sheet', 'Streams', 'Values'])
    head.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL_HEADER } }
      c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
      c.border = BORDER_THIN
    })
    for (const c of cases) {
      const n = c.streams.filter((s) => s.included)
      const r = sum.addRow([
        c.name,
        c.fileName,
        c.sheetName,
        n.length,
        n.reduce((k, s) => k + s.properties.filter((p) => p.value !== null).length, 0),
      ])
      r.getCell(1).font = { bold: true, color: { argb: argb(c.color) }, size: 10 }
      r.eachCell((cell) => { cell.border = BORDER_THIN })
    }
  }

  const ws = wb.addWorksheet('Comparison', {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 2 }],
  })

  // Title row
  const nCols = 3 + cases.length
  ws.mergeCells(1, 1, 1, nCols)
  const title = ws.getCell(1, 1)
  title.value = 'Consolidated Stream Table — Cross-Case Comparison'
  title.font = { bold: true, size: 13, color: { argb: 'FF161616' } }
  title.alignment = { vertical: 'middle' }
  ws.getRow(1).height = 24

  // Header row
  const hr = ws.addRow(['Stream', 'Property', 'Unit', ...cases.map((c) => c.name)])
  hr.height = 20
  hr.eachCell((cell, col) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL_HEADER } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.border = BORDER_THIN
    cell.alignment = { vertical: 'middle', horizontal: col > 3 ? 'right' : 'left' }
    if (col > 3 && cases[col - 4]) {
      cell.font = { bold: true, color: { argb: argb(cases[col - 4].color) }, size: 10 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF232323' } }
    }
  })

  const caseIds = cases.map((c) => c.id)
  let alt = false
  let lastStream = ''

  for (const row of rows) {
    if (row.streamName !== lastStream) {
      lastStream = row.streamName
      alt = false
      // stream band row
      const band = ws.addRow([row.streamName])
      ws.mergeCells(band.number, 1, band.number, nCols)
      const cell = band.getCell(1)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL_STREAM } }
      cell.font = { bold: true, size: 10, color: { argb: 'FF161616' } }
      band.eachCell((c) => { c.border = BORDER_THIN })
      band.height = 16
    }

    const r = ws.addRow([
      '',
      row.propertyName,
      row.unit,
      ...caseIds.map((id) => row.values[id] ?? null),
    ])
    const varies = options.highlightVariation && rowVaries(row, caseIds)
    const baseFill = varies ? FILL_VARIES : alt ? FILL_ALT : 'FFFFFFFF'
    r.eachCell((cell, col) => {
      cell.border = BORDER_THIN
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseFill } }
      cell.font = { size: 10, color: { argb: 'FF161616' } }
      if (col === 2) cell.font = { size: 10, color: { argb: 'FF161616' } }
      if (col === 3) cell.font = { size: 9, color: { argb: 'FF989F9B' } }
      if (col > 3) {
        cell.alignment = { horizontal: 'right' }
        const v = row.values[caseIds[col - 4]]
        if (typeof v === 'number') cell.numFmt = numFormat(row.unit)
        if (options.flagEdited && row.editedFlags[caseIds[col - 4]]) {
          cell.font = { size: 10, bold: true, italic: true, color: { argb: FONT_EDITED } }
        }
        if (varies) cell.font = { ...cell.font, bold: true }
      }
    })
    alt = !alt
  }

  // Column widths
  ws.getColumn(1).width = 4
  ws.getColumn(2).width = 26
  ws.getColumn(3).width = 10
  cases.forEach((_, i) => {
    ws.getColumn(4 + i).width = 16
  })

  // Footer note
  ws.addRow([])
  const note = ws.addRow([
    `${streamNames.length} streams × ${cases.length} cases — edited values shown in orange italic; amber rows vary across cases.`,
  ])
  ws.mergeCells(note.number, 1, note.number, nCols)
  note.getCell(1).font = { size: 9, color: { argb: 'FF989F9B' } }

  const buf = await wb.xlsx.writeBuffer()
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
