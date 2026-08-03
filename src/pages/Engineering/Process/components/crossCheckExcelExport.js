/**
 * Excel export helper for P&ID Checker V2 cross-check results.
 *
 * All three cross-check panels (Line List, Equipment List, Instrument
 * Index) share the same result envelope shape:
 *
 *     { summary: {...counts + coverage_pct},
 *       findings: [{kind, tag, message, ai_suggested_match?, …variant-specific fields}],
 *       ai_used?: bool }
 *
 * We render two worksheets:
 *   - Summary  — key/value list of the summary counters
 *   - Findings — one row per finding, columns keyed off the variant config
 *
 * Kept dependency-free apart from `xlsx`, which is already bundled for
 * the Equipment List page. Soft-coded column definitions per variant
 * live at the top of this file.
 */
import * as XLSX from 'xlsx'

// ── Soft-coded finding-column definitions per variant ───────────────
// `key`   → property on the finding object
// `label` → column header in the exported .xlsx
const COMMON_FINDING_COLUMNS = [
  { key: 'kind',                label: 'Kind' },
  { key: 'tag',                 label: 'Tag' },
  { key: 'message',             label: 'Message' },
]

const AI_FINDING_COLUMNS = [
  { key: 'ai_suggested_match', label: 'AI suggested match' },
  { key: 'ai_confidence',      label: 'AI confidence' },
  { key: 'ai_reason',          label: 'AI reason' },
]

// Per-variant extra columns inserted between "Message" and the AI block.
const VARIANT_EXTRA_COLUMNS = {
  line_list: [
    { key: 'service',           label: 'Service' },
    { key: 'size',              label: 'Size' },
    { key: 'spec',              label: 'Spec' },
    { key: 'serial',            label: 'Serial' },
    { key: 'line_list_row',     label: 'Excel row' },
  ],
  equipment_list: [
    { key: 'description',       label: 'Description' },
    { key: 'moc',               label: 'MOC' },
    { key: 'phase',             label: 'Phase' },
    { key: 'severity',          label: 'Overall Severity' },
    { key: 'equipment_list_row', label: 'Excel row' },
  ],
  instrument_index: [
    { key: 'instrument_type',       label: 'Type' },
    { key: 'service_description',   label: 'Service' },
    { key: 'pid_no',                label: 'P&ID No.' },
    { key: 'eqpt_no',               label: 'Equipment No.' },
    { key: 'line_no',               label: 'Line No.' },
    { key: 'severity',              label: 'Overall Severity' },
    { key: 'instrument_index_row',  label: 'Excel row' },
  ],
}

// Human-readable summary rows per variant.
const VARIANT_SUMMARY_LABELS = {
  line_list: [
    ['P&ID tags',       'pid_total'],
    ['Line List rows',  'line_list_total'],
    ['Match',           'match'],
    ['Missing on P&ID', 'missing_on_pid'],
    ['Extra on P&ID',   'extra_on_pid'],
    ['Mismatch',        'mismatch'],
    ['Coverage (%)',    'coverage_pct'],
  ],
  equipment_list: [
    ['P&ID tags',           'pid_total'],
    ['Equipment List',      'equipment_list_total'],
    ['Match',               'match'],
    ['Missing on P&ID',     'missing_on_pid'],
    ['Extra on P&ID',       'extra_on_pid'],
    ['Attribute mismatches','attribute_mismatches'],
    ['Attribute critical',  'attribute_critical'],
    ['Attribute minor',     'attribute_minor'],
    ['Coverage (%)',        'coverage_pct'],
  ],
  instrument_index: [
    ['P&ID tags',            'pid_total'],
    ['Instrument Index',     'instrument_index_total'],
    ['Match',                'match'],
    ['Missing on P&ID',      'missing_on_pid'],
    ['Extra on P&ID',        'extra_on_pid'],
    ['Attribute mismatches', 'attribute_mismatches'],
    ['Attribute critical',   'attribute_critical'],
    ['Attribute minor',      'attribute_minor'],
    ['Coverage (%)',         'coverage_pct'],
  ],
}

const DEFAULT_FILENAMES = {
  line_list:        'Line_List_cross_check.xlsx',
  equipment_list:   'Equipment_List_cross_check.xlsx',
  instrument_index: 'Instrument_Index_cross_check.xlsx',
}

/**
 * Export a cross-check `result` to Excel.
 *
 * @param {object}  result    The API response ({ summary, findings, ai_used, … }).
 * @param {'line_list'|'equipment_list'|'instrument_index'} variant
 * @param {object} [opts]
 * @param {string} [opts.filename]         Overrides the default file name.
 * @param {string} [opts.contextTitle]     Optional string added to the top-left of Summary sheet (e.g. active master file name).
 */
export function downloadCrossCheckExcel(result, variant, opts = {}) {
  if (!result || typeof result !== 'object') {
    throw new Error('downloadCrossCheckExcel: result is required')
  }
  const summaryLabels = VARIANT_SUMMARY_LABELS[variant]
  const extraCols     = VARIANT_EXTRA_COLUMNS[variant]
  if (!summaryLabels || !extraCols) {
    throw new Error(`downloadCrossCheckExcel: unknown variant '${variant}'`)
  }

  const filename = opts.filename || DEFAULT_FILENAMES[variant]
  const s        = result.summary || {}

  // ── Summary sheet ────────────────────────────────────────────────
  const summaryAoa = []
  if (opts.contextTitle) {
    summaryAoa.push(['Compared against', opts.contextTitle])
    summaryAoa.push([])
  }
  summaryAoa.push(['Metric', 'Value'])
  for (const [label, key] of summaryLabels) {
    summaryAoa.push([label, s[key] ?? ''])
  }
  summaryAoa.push([])
  summaryAoa.push(['AI enrichment applied', result.ai_used ? 'Yes' : 'No'])
  summaryAoa.push(['Exported', new Date().toISOString()])
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryAoa)
  summarySheet['!cols'] = [{ wch: 28 }, { wch: 44 }]

  // ── Findings sheet ───────────────────────────────────────────────
  const findingCols = [
    ...COMMON_FINDING_COLUMNS,
    ...extraCols,
    ...AI_FINDING_COLUMNS,
  ]
  const findings = Array.isArray(result.findings) ? result.findings : []
  const findingRows = findings.map(f => {
    const row = {}
    for (const c of findingCols) {
      const v = f[c.key]
      row[c.label] = v == null ? '' : v
    }
    return row
  })
  const findingsSheet = XLSX.utils.json_to_sheet(findingRows, {
    header: findingCols.map(c => c.label),
  })
  findingsSheet['!cols'] = findingCols.map(c => ({
    wch: Math.max(c.label.length + 2, 14),
  }))

  // ── Workbook ────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary')
  XLSX.utils.book_append_sheet(wb, findingsSheet, 'Findings')

  // Attribute-comparison sheet (equipment_list + instrument_index)
  if (variant === 'equipment_list' || variant === 'instrument_index') {
    const headers = ATTRIBUTE_SHEET_HEADERS[variant]
    const attrRows = buildAttributeRows(findings, variant)
    if (attrRows.length > 0) {
      const attrSheet = XLSX.utils.json_to_sheet(attrRows, { header: headers })
      attrSheet['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 16) }))
      XLSX.utils.book_append_sheet(wb, attrSheet, 'Attribute Comparison')
    }
  }

  XLSX.writeFile(wb, filename)
}

// Attribute-comparison sheet: header set per variant (label of the
// master-side column changes to name the correct source).
const ATTRIBUTE_SHEET_HEADERS = {
  equipment_list: [
    'Tag', 'Attribute', 'P&ID Value', 'Equipment List Value',
    'Status', 'Overall Severity', 'Note',
  ],
  instrument_index: [
    'Tag', 'Attribute', 'P&ID Value', 'Instrument Index Value',
    'Status', 'Overall Severity', 'Note',
  ],
}

function buildAttributeRows(findings, variant) {
  const excelValueLabel = variant === 'instrument_index'
    ? 'Instrument Index Value'
    : 'Equipment List Value'
  const out = []
  for (const f of findings) {
    if (!Array.isArray(f?.attributes) || f.attributes.length === 0) continue
    for (const a of f.attributes) {
      out.push({
        'Tag':               f.tag || '',
        'Attribute':         a.label || a.key || '',
        'P&ID Value':        a.pid_value || '',
        [excelValueLabel]:   a.excel_value || '',
        'Status':            a.status || '',
        'Overall Severity':  f.severity || '',
        'Note':              a.note || '',
      })
    }
  }
  return out
}

export const CROSS_CHECK_EXPORT_VARIANTS = Object.keys(VARIANT_SUMMARY_LABELS)

// ─── Combined workbook export ──────────────────────────────────────
// Sheets produced by downloadCombinedWorkbook (in this order):
//   1. Report Summary        — meta + roll-up across all three variants
//   2. P&ID Tags (Overview)  — full extraction result
//   3. Legend                — active legend entries (kind, symbol, description)
//   4. Line List Findings    — findings from the line-list cross-check
//   5. Equipment Findings    — findings from the equipment cross-check
//   6. Instrument Findings   — findings from the instrument cross-check
//
// Sections whose source data is missing are skipped gracefully.

const COMBINED_DEFAULT_FILENAME = 'PID_Checker_Full_Report.xlsx'

const VARIANT_LABELS = {
  line_list:        'Line List',
  equipment_list:   'Equipment List',
  instrument_index: 'Instrument Index',
}

const VARIANT_SHEET_NAMES = {
  line_list:        'Line List Findings',
  equipment_list:   'Equipment Findings',
  instrument_index: 'Instrument Findings',
}

function buildFindingRows(result, variant) {
  const extraCols = VARIANT_EXTRA_COLUMNS[variant] || []
  const cols = [...COMMON_FINDING_COLUMNS, ...extraCols, ...AI_FINDING_COLUMNS]
  const findings = Array.isArray(result?.findings) ? result.findings : []
  const rows = findings.map(f => {
    const row = {}
    for (const c of cols) {
      const v = f[c.key]
      row[c.label] = v == null ? '' : v
    }
    return row
  })
  return { rows, cols }
}

/**
 * Build a single Excel workbook that consolidates every visible result
 * on the PID Checker V2 page.
 *
 * @param {object} sections
 * @param {object} [sections.overview]           Extraction result ({ filename, tags, summary, mode, model })
 * @param {object} [sections.legend]             Active legend ({ title, entries:[{kind,symbol,description}] })
 * @param {object} [sections.lineList]           Line-list cross-check result
 * @param {object} [sections.equipment]          Equipment cross-check result
 * @param {object} [sections.instrument]         Instrument cross-check result
 * @param {object} [opts]
 * @param {string} [opts.filename]               Overrides the default file name.
 * @param {string} [opts.reportTitle]            Optional title placed at the top of the summary sheet.
 */
export function downloadCombinedWorkbook(sections = {}, opts = {}) {
  const { overview, legend, lineList, equipment, instrument } = sections
  const wb = XLSX.utils.book_new()

  // ── 1. Report Summary ──────────────────────────────────────────
  const summaryAoa = []
  if (opts.reportTitle) {
    summaryAoa.push(['Report', opts.reportTitle])
    summaryAoa.push([])
  }
  if (overview) {
    summaryAoa.push(['P&ID file',     overview.filename || ''])
    summaryAoa.push(['Extraction mode', overview.mode || ''])
    summaryAoa.push(['Model',         overview.model || ''])
    summaryAoa.push(['Total tags',    overview.summary?.total ?? overview.tags?.length ?? 0])
    summaryAoa.push([])
  }

  const variantResults = [
    ['line_list',        lineList],
    ['equipment_list',   equipment],
    ['instrument_index', instrument],
  ]
  for (const [variant, result] of variantResults) {
    if (!result) continue
    summaryAoa.push([`— ${VARIANT_LABELS[variant]} —`])
    const labels = VARIANT_SUMMARY_LABELS[variant] || []
    const s = result.summary || {}
    for (const [label, key] of labels) {
      summaryAoa.push([label, s[key] ?? ''])
    }
    summaryAoa.push(['AI enrichment applied', result.ai_used ? 'Yes' : 'No'])
    summaryAoa.push([])
  }
  summaryAoa.push(['Exported', new Date().toISOString()])

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryAoa)
  summarySheet['!cols'] = [{ wch: 28 }, { wch: 48 }]
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Report Summary')

  // ── 2. P&ID Tags (Overview) ────────────────────────────────────
  if (overview && Array.isArray(overview.tags) && overview.tags.length) {
    const rows = overview.tags.map(t => ({
      Tag:      t.tag ?? '',
      Group:    t.group ?? t.kind ?? '',
      Page:     t.page ?? '',
      Context:  t.context ?? t.description ?? '',
    }))
    const sheet = XLSX.utils.json_to_sheet(rows, {
      header: ['Tag', 'Group', 'Page', 'Context'],
    })
    sheet['!cols'] = [{ wch: 22 }, { wch: 18 }, { wch: 8 }, { wch: 60 }]
    XLSX.utils.book_append_sheet(wb, sheet, 'P&ID Tags')
  }

  // ── 3. Legend ─────────────────────────────────────────────────
  if (legend && Array.isArray(legend.entries) && legend.entries.length) {
    const rows = legend.entries.map(e => ({
      Kind:        e.kind ?? '',
      Symbol:      e.symbol ?? '',
      Description: e.description ?? '',
    }))
    const sheet = XLSX.utils.json_to_sheet(rows, {
      header: ['Kind', 'Symbol', 'Description'],
    })
    sheet['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 60 }]
    XLSX.utils.book_append_sheet(wb, sheet, 'Legend')
  }

  // ── 4-6. Findings sheets ──────────────────────────────────────
  for (const [variant, result] of variantResults) {
    if (!result) continue
    const { rows, cols } = buildFindingRows(result, variant)
    if (!rows.length) continue
    const sheet = XLSX.utils.json_to_sheet(rows, {
      header: cols.map(c => c.label),
    })
    sheet['!cols'] = cols.map(c => ({ wch: Math.max(c.label.length + 2, 14) }))
    XLSX.utils.book_append_sheet(wb, sheet, VARIANT_SHEET_NAMES[variant])
  }

  if (wb.SheetNames.length === 0) {
    throw new Error('downloadCombinedWorkbook: nothing to export yet')
  }

  XLSX.writeFile(wb, opts.filename || COMBINED_DEFAULT_FILENAME)
}
