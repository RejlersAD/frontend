import * as XLSX from 'xlsx'
import type { CaseData, Stream, StreamProperty } from './index.ts'
import { CASE_COLORS } from './parse.ts'

type WorksheetRow = Array<unknown>

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

function findRow(rows: WorksheetRow[], expected: string[]): number {
  return rows.findIndex((row) => expected.every(
    (label, index) => text(row[index]).toLocaleLowerCase() === label.toLocaleLowerCase(),
  ))
}

function hasCellValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== ''
}

/** Rebuild an editable browser session from a RADAI comparison workbook. */
export function reopenComparisonWorkbook(buffer: ArrayBuffer, archiveName: string): CaseData[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const comparisonSheet = workbook.Sheets.Comparison
  if (!comparisonSheet) {
    throw new Error('This saved workbook has no Comparison sheet and cannot be reopened.')
  }

  const comparisonRows = XLSX.utils.sheet_to_json<WorksheetRow>(comparisonSheet, {
    header: 1,
    raw: true,
    defval: null,
  })
  const headerIndex = findRow(comparisonRows, ['Stream', 'Property', 'Unit'])
  if (headerIndex < 0) {
    throw new Error('The saved Comparison sheet does not use the RADAI consolidator layout.')
  }

  const header = comparisonRows[headerIndex]
  const caseNames = header.slice(3).map(text).filter(Boolean)
  if (!caseNames.length) {
    throw new Error('The saved Comparison sheet contains no cases to reopen.')
  }

  const summaryRows = workbook.Sheets.Summary
    ? XLSX.utils.sheet_to_json<WorksheetRow>(workbook.Sheets.Summary, {
      header: 1,
      raw: true,
      defval: null,
    })
    : []
  const summaryHeaderIndex = findRow(summaryRows, ['Case', 'Source file', 'Sheet'])
  const summaryByIndex = caseNames.map((_, index) => (
    summaryHeaderIndex >= 0 ? summaryRows[summaryHeaderIndex + index + 1] || [] : []
  ))

  const streamMaps = caseNames.map(() => new Map<string, Stream>())
  let currentStream = ''

  for (const row of comparisonRows.slice(headerIndex + 1)) {
    const first = text(row[0])
    const propertyName = text(row[1])
    const unit = text(row[2])

    if (first && !propertyName) {
      currentStream = first
      continue
    }
    if (!currentStream || !propertyName) continue

    caseNames.forEach((_, caseIndex) => {
      const value = row[caseIndex + 3]
      if (!hasCellValue(value)) return

      let stream = streamMaps[caseIndex].get(currentStream)
      if (!stream) {
        stream = { name: currentStream, included: true, properties: [] }
        streamMaps[caseIndex].set(currentStream, stream)
      }
      const property: StreamProperty = {
        name: propertyName,
        unit,
        value: value as number | string,
        edited: false,
      }
      stream.properties.push(property)
    })
  }

  const reopenedAt = Date.now()
  const cases = caseNames.map((name, index): CaseData => {
    const summary = summaryByIndex[index]
    return {
      id: `reopened-${reopenedAt}-${index}`,
      name,
      fileName: text(summary[1]) || archiveName,
      sheetName: text(summary[2]) || 'Comparison',
      streams: Array.from(streamMaps[index].values()),
      color: CASE_COLORS[index % CASE_COLORS.length],
    }
  })

  if (cases.every((item) => item.streams.length === 0)) {
    throw new Error('The saved Comparison sheet contains no stream values to reopen.')
  }
  return cases
}
