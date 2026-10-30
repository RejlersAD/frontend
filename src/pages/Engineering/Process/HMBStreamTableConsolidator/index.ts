export interface StreamProperty {
  name: string
  unit: string
  section?: string
  phase?: string
  value: number | string | null
  edited: boolean
}

export interface Stream {
  name: string
  description?: string
  pfdNo?: string
  included: boolean
  properties: StreamProperty[]
}

export interface CaseData {
  id: string
  name: string
  fileName: string
  sheetName: string
  sheetNames?: string[]
  templateTitle?: string
  streams: Stream[]
  color: string
}

export type CellValue = number | string | null

/** A row in the cross-case comparison matrix */
export interface ComparisonRow {
  streamName: string
  section?: string
  propertyName: string
  unit: string
  /** value per case id, null when the case lacks this stream/property */
  values: Record<string, CellValue>
  editedFlags: Record<string, boolean>
}

/**
 * Governing-case calculation for one stream and phase: the case with the
 * highest criterion value (Light Liquid Act Flow / Std Ideal Gas Vol Flow /
 * Heavy Liquid Flow) is identified, and its entire stream column is copied.
 */
export interface GoverningCaseColumn {
  /** Comparison case that governs this phase (null when none reported a value) */
  caseName: string | null
  /** Copied cell values keyed by lowercase property name */
  values: Record<string, CellValue>
}

export interface StreamGoverningColumns {
  liquid: GoverningCaseColumn
  gas: GoverningCaseColumn
  water: GoverningCaseColumn
}
