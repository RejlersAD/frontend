import type { CaseData, Stream } from './index.ts'
import { buildGoverningCaseColumns, buildTemplateComparisonRows, convertTemplateEditValue, getGoverningCaseValue, resolveTemplateProperty } from './compare.ts'
import { MASTER_REVIEW_ROWS } from './template.ts'

export const SEPARATOR_INPUT_KEYS = [
  'pressure', 'temperature', 'gas_flow', 'gas_mw', 'gas_z', 'gas_viscosity',
  'oil_flow', 'oil_density', 'oil_viscosity', 'water_flow', 'water_density', 'water_viscosity',
] as const
export type SeparatorInputKey = typeof SEPARATOR_INPUT_KEYS[number]
export type SeparatorInputs = Record<SeparatorInputKey, number | null>
type Candidate = { unit: string; factor: number; offset?: number }
type Mapping = { section: string; name: string; candidates: Candidate[] }
type SourceCell = { unit: string; value: number | string | null }
type EditableSource = {
  id: string
  name: string
  mapping: ReturnType<typeof mapSeparatorStream>
  comparisonInputs?: Partial<Record<SeparatorInputKey, SourceCell>>
}
const density = [{ unit: 'lb/ft3', factor: 16.01846337396 }, { unit: 'kg/m3', factor: 1 }]
const actualFlow = [{ unit: 'ft3/hr', factor: .028316846592 }, { unit: 'm3/h', factor: 1 }]
const mappings: Record<SeparatorInputKey, Mapping> = {
  pressure: { section: '', name: 'Pressure', candidates: [{ unit: 'psig', factor: .0689475729318 }, { unit: 'barg', factor: 1 }] },
  temperature: { section: '', name: 'Temperature', candidates: [{ unit: 'F', factor: 5 / 9, offset: -32 * 5 / 9 }, { unit: 'C', factor: 1 }] },
  gas_flow: { section: 'Vapour', name: 'Std Gas Flow', candidates: [{ unit: 'MMSCFD', factor: 1 }] },
  gas_mw: { section: 'Vapour', name: 'Molecular Weight', candidates: [{ unit: '<none>', factor: 1 }, { unit: 'kg/kmol', factor: 1 }] },
  gas_z: { section: 'Vapour', name: 'Compressibility', candidates: [{ unit: '<none>', factor: 1 }, { unit: '-', factor: 1 }] },
  gas_viscosity: { section: 'Vapour', name: 'Viscosity', candidates: [{ unit: 'cP', factor: 1 }] },
  oil_flow: { section: 'Light Liquid', name: 'Actual Volume Flow', candidates: actualFlow },
  oil_density: { section: 'Light Liquid', name: 'Mass Density', candidates: density },
  oil_viscosity: { section: 'Light Liquid', name: 'Viscosity', candidates: [{ unit: 'cP', factor: 1 }] },
  water_flow: { section: 'Heavy Liquid', name: 'Actual Volume Flow', candidates: actualFlow },
  water_density: { section: 'Heavy Liquid', name: 'Mass Density', candidates: density },
  water_viscosity: { section: 'Heavy Liquid', name: 'Viscosity', candidates: [{ unit: 'cP', factor: 1 }] },
}

function normalizedUnit(unit: string) {
  return unit.trim().toLowerCase().replace(/[()\s]/g, '').replace(/³/g, '3').replace(/^°/, '')
}

export function sizingCalculationUnit(key: SeparatorInputKey) {
  const candidates = mappings[key].candidates
  return candidates[candidates.length - 1].unit
}

export function sizingUnitConversion(key: SeparatorInputKey, sourceUnit: string) {
  const candidate = mappings[key].candidates.find((entry) => normalizedUnit(entry.unit) === normalizedUnit(sourceUnit))
  if (candidate) return { factor: candidate.factor, offset: candidate.offset || 0 }
  if ((key === 'oil_flow' || key === 'water_flow') && normalizedUnit(sourceUnit) === 'barrel/day') {
    const cubicFeet = Number(convertTemplateEditValue('1', 'barrel/day', 'ft3/hr'))
    return { factor: cubicFeet * actualFlow[0].factor, offset: 0 }
  }
  return null
}

export function sourceSizingCell(source: EditableSource, key: SeparatorInputKey): SourceCell | null {
  const declared = source.comparisonInputs?.[key]
  if (declared) return typeof declared.unit === 'string' && declared.unit.trim() ? declared : null
  const original = source.mapping[key].source
  return original ? { unit: original.unit, value: original.value } : null
}

export function normalizeSizingEdit(key: SeparatorInputKey, unit: string, value: string | number | null) {
  const conversion = sizingUnitConversion(key, unit)
  if (!conversion) throw new Error(`${key}: unsupported comparison unit "${unit}".`)
  if (value === null || typeof value === 'string' && !value.trim()) return null
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) throw new Error(`${key}: enter a finite value in ${unit}.`)
  const converted = numeric * conversion.factor + conversion.offset
  if (!Number.isFinite(converted)) throw new RangeError(`${key}: conversion from ${unit} exceeds calculation bounds.`)
  return converted
}

export function restoreSizingEdits(sources: EditableSource[], overrides: Record<string, string>) {
  const restored: Record<string, string> = {}
  for (const source of sources) for (const key of SEPARATOR_INPUT_KEYS) {
    const overrideKey = `${source.id}:${key}`
    const value = overrides[overrideKey]
    if (value === undefined) continue
    const cell = sourceSizingCell(source, key)
    const conversion = cell ? sizingUnitConversion(key, cell.unit) : null
    // Old snapshots without source units stay review-only; do not guess a unit.
    restored[overrideKey] = !conversion || !value.trim() ? value : String((Number(value) - conversion.offset) / conversion.factor)
  }
  return restored
}

export function sizingInputBundle(sources: EditableSource[], overrides: Record<string, string>, specs: Record<string, { unit: string }>) {
  const normalizedOverrides: Record<string, string> = {}
  const unitErrors: string[] = []
  const unitMappings: Array<{ caseId: string; caseName: string; key: SeparatorInputKey; sourceUnit: string; calculationUnit: string; supported: boolean; note: string }> = []
  const cases = sources.map((source) => {
    const inputs = {} as SeparatorInputs
    for (const key of SEPARATOR_INPUT_KEYS) {
      const cell = sourceSizingCell(source, key)
      const calculationUnit = sizingCalculationUnit(key)
      const conversion = cell ? sizingUnitConversion(key, cell.unit) : null
      const supported = !!conversion && typeof specs[key]?.unit === 'string' && normalizedUnit(specs[key].unit) === normalizedUnit(calculationUnit)
      unitMappings.push({ caseId: source.id, caseName: source.name, key, sourceUnit: cell?.unit || 'Unavailable',
        calculationUnit, supported, note: key === 'gas_mw' && cell?.unit === '<none>' ? 'Confirm HYSYS molecular-weight convention: numeric value is kg/kmol.' :
          key === 'gas_flow' ? 'Confirm HMB standard gas conditions against workbook reference pressure and temperature.' : '' })
      if (!supported || !cell) {
        unitErrors.push(`${source.name} / ${key}: comparison unit ${cell?.unit || 'unavailable'} cannot be verified against workbook unit ${calculationUnit}.`)
        inputs[key] = null
        continue
      }
      const overrideKey = `${source.id}:${key}`
      const override = overrides[overrideKey]
      if (override !== undefined) {
        const numeric = override.trim() === '' ? null : Number(override)
        if (numeric !== null && !Number.isFinite(numeric)) {
          unitErrors.push(`${source.name} / ${key}: invalid numeric edit in ${cell.unit}.`)
          inputs[key] = null
          continue
        }
        let value: number | null
        try {
          value = normalizeSizingEdit(key, cell.unit, numeric)
        } catch (error) {
          if (!(error instanceof RangeError)) throw error
          unitErrors.push(`${source.name} / ${error.message}`)
          inputs[key] = null
          continue
        }
        inputs[key] = value
        normalizedOverrides[overrideKey] = value === null ? '' : String(value)
      } else {
        inputs[key] = source.mapping[key].value
        let calculated: number | null = null
        if (typeof cell.value === 'number' && Number.isFinite(cell.value)) {
          try {
            calculated = normalizeSizingEdit(key, cell.unit, cell.value)
          } catch (error) {
            if (!(error instanceof RangeError)) throw error
            unitErrors.push(`${source.name} / ${error.message}`)
          }
        }
        const retained = inputs[key]
        if ((calculated === null) !== (retained === null) || calculated !== null && retained !== null &&
            Math.abs(calculated - retained) > 1e-10 * Math.max(1, Math.abs(calculated), Math.abs(retained))) {
          unitErrors.push(`${source.name} / ${key}: source value and unit disagree with the normalized workbook input.`)
        }
      }
    }
    return { id: source.id, name: source.name, inputs }
  })
  return { cases, normalizedOverrides, unitErrors, unitMappings }
}

function resolveSizingProperty(stream: Stream | undefined, mapping: Mapping) {
    for (const candidate of mapping.candidates) {
      const resolved = resolveTemplateProperty(stream, { ...mapping, unit: candidate.unit })
      // The comparison resolver permits unspecified units; sizing must not guess them.
      if (!resolved || !resolved.property.unit.trim() || typeof resolved.value !== 'number' || !Number.isFinite(resolved.value)) continue
      return { value: resolved.value * candidate.factor + (candidate.offset || 0),
        source: { property: resolved.property.name, section: resolved.property.section || resolved.property.phase || '',
          unit: resolved.property.unit, value: resolved.property.value, edited: resolved.property.edited } }
    }
    return { value: null, source: null }
}

export function mapSeparatorStream(stream: Stream | undefined) {
  const entries = SEPARATOR_INPUT_KEYS.map((key) => [key, resolveSizingProperty(stream, mappings[key])])
  return Object.fromEntries(entries) as Record<SeparatorInputKey, { value: number | null; source: {
    property: string; section: string; unit: string; value: number | string | null; edited: boolean
  } | null }>
}

export function separatorSourceCases(cases: CaseData[], streamName: string) {
  return cases.flatMap((caseData) => {
    const stream = caseData.streams.find((item) => item.included && item.name.trim().toLowerCase() === streamName.trim().toLowerCase())
    return stream ? [{ id: caseData.id, name: caseData.name, fileName: caseData.fileName,
      sheetName: caseData.sheetName, streamName: stream.name, mapping: mapSeparatorStream(stream),
      gasDensity: resolveSizingProperty(stream, { section: 'Vapour', name: 'Mass Density', candidates: density }) }] : []
  })
}

export function separatorComparisonSources(cases: CaseData[], streamName: string) {
  const selectedCases = cases.map((item) => ({
    ...item,
    streams: item.streams.filter((stream) => stream.included && stream.name.trim().toLowerCase() === streamName.trim().toLowerCase()),
  }))
  const rows = buildTemplateComparisonRows(selectedCases, MASTER_REVIEW_ROWS)
  if (!rows.length) return []
  const displayName = rows[0].streamName
  const columns = buildGoverningCaseColumns(selectedCases).get(displayName)
  if (!columns) return []
  const roles = [
    { kind: 'liquid' as const, name: 'Max Oil', label: 'Max Liquid' },
    { kind: 'water' as const, name: 'Max Water', label: 'Max Water' },
    { kind: 'gas' as const, name: 'Max Gas', label: 'Max Gas' },
  ]
  return roles.map((role) => {
    const column = columns[role.kind]
    const original = selectedCases.find((item) => item.id === column.caseId)
    const resolvedStream: Stream = {
      name: displayName, included: true,
      properties: rows.map((row) => ({
        name: row.propertyName, section: row.section, unit: row.unit,
        value: getGoverningCaseValue(row, column),
        edited: column.caseId ? !!row.editedFlags[column.caseId] : false,
      })),
    }
    const mapping = mapSeparatorStream(resolvedStream)
    const comparisonInputs = Object.fromEntries(SEPARATOR_INPUT_KEYS.map((key) => {
      const originalCell = mapping[key].source
      if (originalCell) return [key, { unit: originalCell.unit, value: originalCell.value }]
      const definition = mappings[key]
      const row = definition.candidates.map((candidate) => rows.find((item) =>
        item.section === definition.section && item.propertyName === definition.name && normalizedUnit(item.unit) === normalizedUnit(candidate.unit))).find(Boolean)
      return [key, row ? { unit: row.unit, value: getGoverningCaseValue(row, column) } : undefined]
    })) as Partial<Record<SeparatorInputKey, SourceCell>>
    const gasDensityRow = rows.find((row) => row.section === 'Vapour' && row.propertyName === 'Mass Density' && row.unit === 'lb/ft3')
    return {
      id: `comparison-${role.kind}-${column.caseId || 'missing'}`,
      name: role.name, comparisonColumn: role.label,
      sourceCaseId: column.caseId, sourceCaseName: column.caseName,
      fileName: original?.fileName || 'Missing governing case',
      sheetName: original?.sheetName || 'Cross-case comparison',
      streamName: displayName,
      mapping, comparisonInputs,
      comparisonGasDensity: gasDensityRow ? { unit: gasDensityRow.unit, value: getGoverningCaseValue(gasDensityRow, column) } : null,
      gasDensity: resolveSizingProperty(resolvedStream, { section: 'Vapour', name: 'Mass Density', candidates: density }),
    }
  })
}
