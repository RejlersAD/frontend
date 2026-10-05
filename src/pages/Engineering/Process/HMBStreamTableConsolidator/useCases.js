import { useCallback, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { makeCase, parseWorkbook } from './parse.ts'

const DEMO_FILES = [
  'Case_A1b_HYSYS_Streams.xlsx',
  'Case_A2a_HYSYS_Streams.xlsx',
  'Case_1B_Stream_Summary 2.xlsx',
]

const DEMO_BASE = '/demo/hmb-stream-table-consolidator'

export function useCases() {
  const [cases, setCases] = useState([])
  const [activeCaseId, setActiveCaseId] = useState(null)
  const [errors, setErrors] = useState([])
  const [importing, setImporting] = useState(false)

  const importFiles = useCallback(async (files) => {
    setImporting(true)
    const failures = []
    const added = []

    for (const file of Array.from(files)) {
      try {
        const buffer = await file.arrayBuffer()
        added.push(makeCase(parseWorkbook(buffer, file.name), file.name))
      } catch (error) {
        failures.push({ fileName: file.name, message: error instanceof Error ? error.message : 'Unable to parse workbook.' })
      }
    }

    if (added.length) {
      setCases((current) => [...current, ...added])
      setActiveCaseId((current) => current || added[0].id)
      toast.success(`Imported ${added.length} case${added.length === 1 ? '' : 's'}.`)
    }
    if (failures.length) {
      setErrors((current) => [...current, ...failures])
      failures.forEach((failure) => toast.error(`${failure.fileName}: ${failure.message}`))
    }
    setImporting(false)
  }, [])

  const loadDemo = useCallback(async () => {
    setImporting(true)
    const added = []
    const failures = []

    for (const fileName of DEMO_FILES) {
      try {
        const response = await fetch(`${DEMO_BASE}/${encodeURIComponent(fileName)}`)
        if (!response.ok) throw new Error(`Demo workbook returned HTTP ${response.status}.`)
        const buffer = await response.arrayBuffer()
        added.push(makeCase(parseWorkbook(buffer, fileName), fileName))
      } catch (error) {
        failures.push({ fileName, message: error instanceof Error ? error.message : 'Unable to load demo workbook.' })
      }
    }

    if (added.length) {
      setCases((current) => [...current, ...added])
      setActiveCaseId((current) => current || added[0].id)
      toast.success(`Loaded ${added.length} HYSYS demo cases.`)
    }
    if (failures.length) {
      setErrors((current) => [...current, ...failures])
      failures.forEach((failure) => toast.error(`${failure.fileName}: ${failure.message}`))
    }
    setImporting(false)
  }, [])

  const removeCase = useCallback((id) => {
    setCases((current) => current.filter((item) => item.id !== id))
    setActiveCaseId((current) => (current === id ? null : current))
  }, [])

  const renameCase = useCallback((id, name) => {
    setCases((current) => current.map((item) => (item.id === id ? { ...item, name } : item)))
  }, [])

  const toggleStream = useCallback((caseId, streamName) => {
    setCases((current) => current.map((item) => item.id !== caseId ? item : {
      ...item,
      streams: item.streams.map((stream) => stream.name === streamName
        ? { ...stream, included: !stream.included }
        : stream),
    }))
  }, [])

  const setCellValue = useCallback((caseId, streamName, propertyName, raw) => {
    setCases((current) => current.map((item) => {
      if (item.id !== caseId) return item
      return {
        ...item,
        streams: item.streams.map((stream) => {
          if (stream.name !== streamName) return stream
          return {
            ...stream,
            properties: stream.properties.map((property) => {
              if (property.name !== propertyName) return property
              const trimmed = raw.trim()
              const numeric = trimmed === '' ? null : Number(trimmed)
              const value = trimmed === '' ? null : Number.isFinite(numeric) ? numeric : trimmed
              return { ...property, value, edited: true }
            }),
          }
        }),
      }
    }))
  }, [])

  const resetAll = useCallback(() => {
    setCases([])
    setErrors([])
    setActiveCaseId(null)
  }, [])

  const replaceCases = useCallback((reopenedCases) => {
    setCases(reopenedCases)
    setErrors([])
    setActiveCaseId(reopenedCases[0]?.id || null)
  }, [])

  const activeCase = useMemo(
    () => cases.find((item) => item.id === activeCaseId) || cases[0] || null,
    [cases, activeCaseId],
  )

  const editedCount = useMemo(() => cases.reduce(
    (total, item) => total + item.streams.reduce(
      (streamTotal, stream) => streamTotal + stream.properties.filter((property) => property.edited).length,
      0,
    ),
    0,
  ), [cases])

  return {
    cases,
    activeCase,
    activeCaseId: activeCase?.id || null,
    setActiveCaseId,
    importFiles,
    loadDemo,
    removeCase,
    renameCase,
    toggleStream,
    setCellValue,
    replaceCases,
    resetAll,
    errors,
    clearErrors: () => setErrors([]),
    importing,
    editedCount,
  }
}
