/* eslint-disable react/prop-types */
import { useEffect, useMemo, useRef, useState } from 'react'
import apiClient from '../../../../services/api.service'
import { restoreSizingEdits, separatorComparisonSources, sizingInputBundle } from './separatorMapping.ts'
import { downloadSeparatorWorkbook } from './separatorExport.js'
import { restoreSeparatorSnapshot, snapshotBasis } from './separatorSnapshot.js'
import EquipmentSizingView from './EquipmentSizingView'
import { DOCUMENT_DEFAULTS } from './separatorDatasheetModel.js'
import './SeparatorSizingPanel.css'

const ENDPOINT = '/process-datasheet/datasheets/hmb-stream-consolidator/separator-sizing/'
const SNAPSHOTS = '/process-datasheet/datasheets/hmb-stream-consolidator/separator-snapshots/'
const errorMessage = (error) => error.response?.data?.error ||
  (error.response?.status === 404 ? 'Required sizing endpoint is unavailable. Update or restart the backend.' : error.message) ||
  'Sizing service is unavailable.'

export default function SeparatorSizingPanel({ cases, active, projectId = '', onRefreshProject, actionHost, referenceExample, automatic = true, preferredStream = '' }) {
  const demo = !!referenceExample
  const [schema, setSchema] = useState(referenceExample?.schema || null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [stream, setStream] = useState(referenceExample?.metadata.stream || '')
  const [tag, setTag] = useState(referenceExample?.metadata.tag || '')
  const [service, setService] = useState(referenceExample?.metadata.service || 'Three-phase separator')
  const [document, setDocument] = useState({ ...DOCUMENT_DEFAULTS, ...referenceExample?.metadata.document })
  const [criteria, setCriteria] = useState({})
  const [overrides, setOverrides] = useState({})
  const [excluded, setExcluded] = useState([])
  const [confirmed, setConfirmed] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [savedSources, setSavedSources] = useState(null)
  const [historical, setHistorical] = useState(null)
  const [archives, setArchives] = useState([])
  const [archiveBusy, setArchiveBusy] = useState('')
  const [archiveError, setArchiveError] = useState('')
  const [archiveRefresh, setArchiveRefresh] = useState(0)
  const [pendingOpen, setPendingOpen] = useState(null)
  const [savedMessage, setSavedMessage] = useState('')
  const [tab, setTab] = useState('inputs')
  const [focusedCase, setFocusedCase] = useState(referenceExample?.selectedCaseId || '')
  const generation = useRef(0)
  const projectRef = useRef(projectId)
  projectRef.current = projectId
  const archiveGeneration = useRef(0)
  const automaticRun = useRef(null)
  const previousPreferred = useRef('')
  useEffect(() => {
    if (!active || schema || demo) return undefined
    const controller = new AbortController()
    apiClient.get(ENDPOINT, { signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return
      setSchema(data)
      setCriteria(Object.fromEntries(Object.entries(data.criteria).map(([key, spec]) => [key, String(spec.default)])))
      setError('')
    }).catch((failure) => {
      if (!controller.signal.aborted) setError(errorMessage(failure))
    })
    return () => controller.abort()
  }, [active, schema, loadAttempt, demo])
  useEffect(() => () => { generation.current += 1; archiveGeneration.current += 1 }, [])
  useEffect(() => {
    setArchives([])
    setPendingOpen(null)
    setArchiveError('')
    if (!active || !projectId || demo) return undefined
    const controller = new AbortController()
    apiClient.get(SNAPSHOTS, { params: { project_id: projectId }, signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted || projectRef.current !== projectId) return
      if (!Array.isArray(data.results)) throw new Error('Snapshot history response is invalid.')
      setArchives(data.results)
    }).catch((failure) => {
      if (!controller.signal.aborted && projectRef.current === projectId) setArchiveError(errorMessage(failure))
    })
    return () => controller.abort()
  }, [active, projectId, archiveRefresh, demo])
  const streams = useMemo(() => [...new Set(cases.flatMap((item) => item.streams.filter((entry) => entry.included).map((entry) => entry.name)))], [cases])
  useEffect(() => {
    if (!automatic || !active || demo || savedSources) return
    if (preferredStream && streams.includes(preferredStream) && previousPreferred.current !== preferredStream) {
      previousPreferred.current = preferredStream
      setStream(preferredStream); setOverrides({}); setExcluded([])
    } else if (!streams.includes(stream)) {
      setStream(streams[0] || ''); setOverrides({}); setExcluded([])
    }
  }, [automatic, active, demo, savedSources, preferredStream, stream, streams])
  const liveSources = useMemo(() => separatorComparisonSources(cases, stream), [cases, stream])
  const detached = savedSources?.projectId === projectId
  const sources = demo ? referenceExample.sources : detached ? savedSources.sources : liveSources
  const selected = sources.filter((item) => !excluded.includes(item.id))
  const activeSource = sources.find((item) => item.id === focusedCase) || sources.find((item) => item.name === 'Max Water') || sources[0]
  const inputBundle = schema ? sizingInputBundle(sources, overrides, schema.inputs) : { cases: [], normalizedOverrides: {}, unitErrors: [], unitMappings: [] }
  const request = {
    basis_confirmed: !automatic,
    ...(automatic ? { execution_mode: 'automatic_preview' } : {}),
    criteria: Object.fromEntries(Object.entries(criteria).map(([key, val]) => [key, val.trim() === '' ? null : Number(val)])),
    cases: inputBundle.cases.filter((item) => !excluded.includes(item.id)),
  }
  const metadata = { tag, service, stream, document }
  const signature = JSON.stringify({ request, sources, metadata: { tag, service, stream }, overrides, excluded, projectId, version: schema?.version, unitErrors: inputBundle.unitErrors })
  const currentResult = result?.signature === signature ? result.data : null
  const ready = schema && selected.length > 0 && !inputBundle.unitErrors.length &&
    !selected.some((item) => !item.comparisonColumn || !item.sourceCaseId) &&
    request.cases.every((item) => {
      const keys = ['pressure', 'temperature', 'gas_flow', 'oil_flow', 'water_flow']
      for (const [phase, required] of [['gas', ['gas_mw', 'gas_z']], ['oil', ['oil_density', 'oil_viscosity']], ['water', ['water_density', 'water_viscosity']]]) {
        if (item.inputs[`${phase}_flow`] > 0) keys.push(...required)
      }
      return keys.every((key) => item.inputs[key] !== null && Number.isFinite(item.inputs[key]))
    })
  useEffect(() => {
    if (!automatic || !active || demo) return undefined
    const controller = new AbortController()
    generation.current += 1
    setBusy(false); setError('')
    if (!ready) return undefined
    const timer = setTimeout(() => automaticRun.current({ signal: controller.signal, preview: true }), 350)
    return () => { clearTimeout(timer); controller.abort(); generation.current += 1 }
  }, [automatic, active, demo, signature, ready])
  async function run({ signal, preview = false } = {}) {
    if (preview && !ready) return
    if (demo) { setError('Reference example only; production sizing is disabled.'); return }
    if (detached && sources.some((item) => !item.comparisonColumn)) {
      setError('Relink the historical per-case revision to Cross-case comparison before sizing.')
      return
    }
    if (!selected.length || selected.some((item) => item.comparisonColumn && !item.sourceCaseId)) {
      setError('A governing comparison case is missing. Review Cross-case comparison before sizing.')
      return
    }
    if (inputBundle.unitErrors.length) {
      setError(`Source-unit cross-check failed: ${inputBundle.unitErrors.join(' ')}`)
      return
    }
    const attempt = ++generation.current
    setBusy(true); setError(''); setResult(null)
    try {
      const { data } = await apiClient.post(ENDPOINT, request, { signal })
      if (!data || data.version !== schema.version) throw new Error('Calculator version changed or response is invalid. Reload and confirm the current criteria.')
      if (!['OK', 'REVIEW'].includes(data.status) || !Array.isArray(data.cases) ||
          data.cases.length !== request.cases.length ||
          data.cases.some((item) => !item || typeof item !== 'object' || !['OK', 'REVIEW'].includes(item.status) ||
            !Array.isArray(item.warnings) || item.warnings.some((warning) => typeof warning !== 'string') ||
            ['gas_utilization', 'oil_retention', 'water_retention', 'nil_mm'].some((key) => item[key] !== null && !Number.isFinite(item[key]))) ||
          new Set(data.cases.map((item) => item.id)).size !== request.cases.length ||
          data.cases.some((item) => !request.cases.some((entry) => entry.id === item.id)) ||
          !Number.isFinite(data.diameter_m) || data.diameter_m <= 0 || !Number.isFinite(data.length_m) || data.length_m <= 0) {
        throw new Error('Sizing service returned invalid or incomplete results. No verification was accepted.')
      }
      if (generation.current === attempt && !signal?.aborted) { setResult({ signature, data }); if (!preview) setTab('calculations') }
    } catch (failure) {
      if (generation.current === attempt && !signal?.aborted) setError(errorMessage(failure))
    } finally {
      if (generation.current === attempt) setBusy(false)
    }
  }
  automaticRun.current = run
  async function exportWorkbook() {
    if (demo) { setError('Reference example cannot be exported as an engineering result.'); return }
    setExporting(true); setError('')
    try {
      const provenance = sources.map((item) => ({ ...item, overrideKeys: Object.keys(item.mapping).filter((key) => Object.hasOwn(overrides, `${item.id}:${key}`)) }))
      await downloadSeparatorWorkbook(currentResult, request, provenance, metadata, schema)
    } catch (failure) { setError(errorMessage(failure)) } finally { setExporting(false) }
  }
  async function saveSnapshot() {
    if (demo) { setArchiveError('Reference example cannot be saved as a revision.'); return }
    const attempt = ++archiveGeneration.current
    const scope = projectId
    setArchiveBusy('saving'); setArchiveError(''); setSavedMessage('')
    try {
      const { data } = await apiClient.post(SNAPSHOTS, { project_id: scope, calculator_version: currentResult.version, basis: snapshotBasis(request, sources, excluded, inputBundle.normalizedOverrides, metadata) })
      if (!data.snapshot?.id) throw new Error('Save response did not include a saved record.')
      if (projectRef.current === scope && archiveGeneration.current === attempt) { setSavedMessage(`Snapshot saved for ${metadata.tag}.`); setArchiveRefresh((value) => value + 1) }
    } catch (failure) {
      if (projectRef.current === scope && archiveGeneration.current === attempt) setArchiveError(errorMessage(failure))
    } finally { if (archiveGeneration.current === attempt) setArchiveBusy('') }
  }
  async function openSnapshot(record) {
    const attempt = ++archiveGeneration.current
    const scope = projectId
    setArchiveBusy('opening'); setArchiveError(''); setSavedMessage(''); setPendingOpen(null)
    try {
      const { data } = await apiClient.get(`${SNAPSHOTS}${record.id}/`, { params: { project_id: scope } })
      const restored = restoreSeparatorSnapshot(data)
      if (restored.archive.project_id !== scope) throw new Error('Snapshot belongs to a different project.')
      if (projectRef.current !== scope || archiveGeneration.current !== attempt) return
      generation.current += 1; setBusy(false)
      setSavedSources({ projectId: scope, sources: restored.sources })
      setStream(restored.metadata.stream); setTag(restored.metadata.tag); setService(restored.metadata.service)
      setDocument({ ...DOCUMENT_DEFAULTS, ...restored.metadata.document })
      setCriteria(restored.criteria); setOverrides(restoreSizingEdits(restored.sources, restored.overrides)); setExcluded(restored.excluded); setHistorical(restored)
      setFocusedCase(restored.sources.find((item) => item.name === 'Max Water')?.id || restored.sources[0]?.id || ''); setTab('inputs'); setResult(null); setConfirmed(''); setError('')
    } catch (failure) {
      if (projectRef.current === scope && archiveGeneration.current === attempt) setArchiveError(errorMessage(failure))
    } finally { if (archiveGeneration.current === attempt) setArchiveBusy('') }
  }
  return <EquipmentSizingView
    schema={schema} demo={demo} referenceExample={referenceExample} actionHost={actionHost} automatic={automatic}
    sources={sources} activeSource={activeSource} selected={selected} streams={streams} detached={detached}
    metadata={metadata} tab={tab} setTab={setTab} criteria={criteria} overrides={overrides} excluded={excluded}
    normalizedCases={inputBundle.cases} unitErrors={inputBundle.unitErrors} unitMappings={inputBundle.unitMappings}
    result={currentResult} stale={!!result && !currentResult} historical={historical?.archive.project_id === projectId ? historical : null}
    confirmed={confirmed === signature} onConfirm={(checked) => setConfirmed(checked ? signature : '')}
    busy={busy} exporting={exporting} archiveBusy={archiveBusy} error={error} archiveError={archiveError} savedMessage={savedMessage}
    projectId={projectId} archives={archives} pendingOpen={pendingOpen} onPendingOpen={setPendingOpen}
    onOpenSnapshot={openSnapshot} onRefreshHistory={() => setArchiveRefresh((value) => value + 1)} onRefreshProject={onRefreshProject}
    onRetry={() => setLoadAttempt((value) => value + 1)} onRun={run} onSave={saveSnapshot} onExport={exportWorkbook}
    onCase={setFocusedCase}
    onExclude={(id, included) => setExcluded((previous) => included ? previous.filter((key) => key !== id) : [...previous, id])}
    onStream={(value) => { setStream(value); setOverrides({}); setExcluded([]); setConfirmed(''); setSavedSources(null); setHistorical(null); setResult(null); setFocusedCase('') }}
    onTag={setTag} onService={setService}
    onDocument={(key, value) => setDocument((previous) => ({ ...previous, [key]: value }))}
    onOverride={(key, value) => setOverrides((previous) => ({ ...previous, [`${activeSource.id}:${key}`]: value }))}
    onReset={(key) => setOverrides((previous) => { const next = { ...previous }; delete next[`${activeSource.id}:${key}`]; return next })}
    onCriterion={(key, value) => setCriteria((previous) => ({ ...previous, [key]: value }))}
  />
}
