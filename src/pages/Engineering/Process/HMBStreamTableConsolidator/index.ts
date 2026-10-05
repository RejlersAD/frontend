export interface StreamProperty {
  name: string
  unit: string
  value: number | string | null
  edited: boolean
}

export interface Stream {
  name: string
  included: boolean
  properties: StreamProperty[]
}

export interface CaseData {
  id: string
  name: string
  fileName: string
  sheetName: string
  streams: Stream[]
  color: string
}

export type CellValue = number | string | null

/** A row in the cross-case comparison matrix */
export interface ComparisonRow {
  streamName: string
  propertyName: string
  unit: string
  /** value per case id, null when the case lacks this stream/property */
  values: Record<string, CellValue>
  editedFlags: Record<string, boolean>
}
