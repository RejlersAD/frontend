import { useCallback, useEffect, useMemo, useState } from 'react'
import apiClient from '../../services/api.service'
import { PROJECT_CONTROL_ENDPOINTS as endpoints } from '../../config/projectControl.config'

const sameId = (a, b) => a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b)
const number = value => (typeof value === 'number' || typeof value === 'string') && String(value).trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null
const timestamp = value => typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null
const KINDS = { boq: 'BOQ', tender: 'Tender', contract: 'Contract', change_order: 'Change Order', drawing: 'Drawing', progress_report: 'Progress Report', minutes: 'Meeting Minutes', specification: 'Specification', other: 'Other' }
const PARSING = { pending: ['Metadata pending', 'neutral'], queued: ['Metadata queued', 'blue'], done: ['Metadata processed', 'green'], failed: ['Processing failed', 'red'], skipped: ['Processing skipped', 'amber'] }
const newest = (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || Number(b.id) - Number(a.id)
const emptyData = () => ({ documents: null, selected: null, selectedId: null, capabilities: null })

export function normalizeProjectDocument(raw, detailLoaded = false) {
  const filename = String(raw.original_filename || '')
  const parts = filename.split('.')
  const [parseLabel, tone] = PARSING[raw.parse_status] || ['Processing state unavailable', 'neutral']
  return {
    id: raw.id, title: raw.title || filename || `Document ${raw.id}`, kind: raw.kind,
    kindLabel: raw.kind_display || KINDS[raw.kind] || 'Unclassified', filename,
    extension: parts.length > 1 ? parts.at(-1).toLowerCase() : null,
    contentType: raw.content_type || null, sizeBytes: number(raw.size_bytes),
    uploadedById: raw.uploaded_by ?? null, uploadedBy: raw.uploaded_by_name || null,
    createdAt: timestamp(raw.created_at), updatedAt: timestamp(raw.updated_at),
    parseStatus: raw.parse_status || null, parseLabel, tone,
    hasFile: raw.has_file === true, canEdit: raw.can_edit === true, canDelete: raw.can_delete === true,
    canDownload: raw.can_download === true && raw.has_file === true,
    parsedData: detailLoaded && raw.parsed_data && typeof raw.parsed_data === 'object' ? raw.parsed_data : null,
    parseError: detailLoaded ? raw.parse_error || null : null, detailLoaded,
    // Engineering revision, approval and review dates are not persisted by this registry.
    revision: null, reviewStatus: null, approvalStatus: null, virusScanStatus: null,
    raw,
  }
}

export function buildDocumentModel(project, data, issues = []) {
  const list = Array.isArray(data?.documents) ? data.documents.filter(row => sameId(row.project, project?.id)) : null
  const rows = (list || []).slice().sort(newest).map(row => normalizeProjectDocument(row))
  const summary = (list || []).find(row => sameId(row.id, data?.selectedId))
  const detail = sameId(data?.selected?.id, summary?.id) && sameId(data?.selected?.project, project?.id) ? data.selected : null
  const selected = summary ? normalizeProjectDocument(detail || summary, Boolean(detail)) : null
  const count = predicate => list === null ? null : rows.filter(predicate).length
  const counts = {
    total: list === null ? null : rows.length,
    processed: count(row => row.parseStatus === 'done'),
    pending: count(row => ['pending', 'queued'].includes(row.parseStatus)),
    failed: count(row => row.parseStatus === 'failed'), skipped: count(row => row.parseStatus === 'skipped'),
    unknown: count(row => !PARSING[row.parseStatus]), downloadable: count(row => row.canDownload),
    missingFiles: count(row => !row.hasFile),
    totalBytes: list !== null && rows.every(row => row.sizeBytes !== null && row.sizeBytes >= 0) ? rows.reduce((total, row) => total + row.sizeBytes, 0) : null,
    approved: null, reviews: null, revisions: null, transmittals: null,
  }
  const capabilities = data?.capabilities || {}
  const canUpload = capabilities.can_upload === true
  const kinds = Array.isArray(capabilities.document_kinds) && capabilities.document_kinds.length
    ? capabilities.document_kinds.filter(row => typeof row.value === 'string' && typeof row.label === 'string')
    : Object.entries(KINDS).map(([value, label]) => ({ value, label }))
  const latestUploadDate = rows.map(row => row.createdAt).filter(Boolean).sort().at(-1) || null
  const lastUpdatedAt = rows.map(row => row.updatedAt).filter(Boolean).sort().at(-1) || null
  const quality = [
    { id: 'register', label: 'Uploaded register', status: list === null ? 'Unavailable' : rows.length ? 'Loaded' : 'No documents', tone: list === null ? 'red' : 'green', ready: list !== null, detail: list === null ? 'The complete project document register could not be retrieved. Refresh to retry.' : `${rows.length} uploaded records loaded across all pages.` },
    { id: 'processing', label: 'Metadata processing', status: list === null ? 'Unavailable' : counts.failed ? 'Failures recorded' : counts.pending ? 'Pending' : counts.unknown ? 'Unknown states' : counts.skipped ? 'Skipped records' : rows.length ? 'Processed' : 'No documents', tone: list === null || counts.failed ? 'red' : counts.pending || counts.skipped || counts.unknown ? 'amber' : 'green', ready: list !== null && !counts.failed && !counts.pending && !counts.skipped && !counts.unknown, detail: 'Processing status describes the metadata task. It is not engineering approval, a virus scan or verified content extraction.' },
    { id: 'files', label: 'Stored file references', status: list === null ? 'Unavailable' : counts.missingFiles ? 'Missing references' : 'Registered', tone: list === null || counts.missingFiles ? 'amber' : 'green', ready: list !== null && !counts.missingFiles, detail: 'A stored filename is registered. Actual storage availability is checked when you download the file.' },
    { id: 'revisions', label: 'Revision control', status: 'Not configured', tone: 'neutral', ready: false, detail: 'This uploaded register has no persisted revision chain or superseded-document relationship. Matching filenames do not establish revisions.' },
    { id: 'reviews', label: 'Reviews and approvals', status: 'Not configured', tone: 'neutral', ready: false, detail: 'Reviewers, approval decisions and review due dates are not stored for these project documents.' },
    { id: 'transmittals', label: 'Transmittals', status: 'Not configured', tone: 'neutral', ready: false, detail: 'This register has no linked transmittal numbers, issue dates or client return records.' },
    { id: 'extraction', label: 'Content extraction', status: 'Not verified', tone: 'neutral', ready: false, detail: 'The upload task currently processes metadata only. Server file extraction remains available through the separate server-file source where configured.' },
  ]
  const actions = rows.filter(row => row.parseStatus === 'failed' || !row.hasFile).map(row => ({
    id: `document-${row.id}`, documentId: row.id, priority: 'High',
    title: !row.hasFile ? 'Review missing file reference' : 'Review processing failure',
    detail: row.title, action: 'details', view: 'details', button: 'Review',
  }))
  if (issues.length) actions.unshift({ id: 'reload', documentId: null, priority: 'High', title: 'Reload document data', detail: issues.join(' '), action: 'refresh', view: 'quality', button: 'Refresh' })
  const health = { label: list === null ? 'Unavailable' : counts.failed || counts.missingFiles ? 'Review required' : counts.pending ? 'Processing pending' : rows.length ? 'Register available' : 'No documents', tone: list === null || counts.failed ? 'danger' : counts.missingFiles || counts.pending ? 'warning' : rows.length ? 'success' : 'neutral' }
  return {
    rows, options: rows.map(row => ({ id: row.id, label: row.title })), selected, counts, quality, actions,
    canUpload, maxDocumentBytes: number(capabilities.max_document_bytes), kinds,
    latestUploadDate, lastUpdatedAt, dataDate: lastUpdatedAt?.slice(0, 10) || latestUploadDate?.slice(0, 10) || null,
    dataDateSource: 'Latest document record update', health,
    availability: { list: list !== null, selected: Boolean(detail) },
    capabilities: { upload: canUpload, revisions: false, reviews: false, transmittals: false, deliverablePlan: false, extraction: false },
    scopeNote: 'Uploaded files for this project. Server folders are a separate source; document-control workflows are not linked to this register.',
  }
}

async function allDocuments(projectId, signal) {
  const rows = [], seen = new Set()
  let capabilities = null
  for (let page = 1; page <= 100; page += 1) {
    const response = await apiClient.get(endpoints.documents, { params: { project: projectId, page }, signal })
    const data = response.data
    if (!Array.isArray(data) && !Array.isArray(data?.results)) throw new Error('Invalid document register response.')
    if (page === 1) capabilities = data.capabilities || null
    for (const row of Array.isArray(data) ? data : data.results) {
      if (!sameId(row.project, projectId)) throw new Error('Document register project scope did not match.')
      if (seen.has(String(row.id))) throw new Error('The document register changed while loading. Refresh to retry.')
      seen.add(String(row.id)); rows.push(row)
    }
    if (!data?.next) {
      if (number(data.count) !== null && Number(data.count) !== rows.length) throw new Error('The complete document register could not be loaded.')
      return { documents: rows, capabilities }
    }
  }
  throw new Error('The document register exceeds the supported page limit.')
}

export default function useDocumentControl(project, revision = 0, options = {}) {
  const { enabled = true, documentId = null } = options
  const projectId = project?.id ?? null
  const [reloadToken, setReloadToken] = useState(0)
  const [listState, setListState] = useState({ key: null, data: emptyData(), loading: false, issues: [], loadedAt: null })
  const [detailState, setDetailState] = useState({ key: null, data: null, loading: false, issues: [] })
  const listKey = `${projectId ?? ''}:${revision}:${reloadToken}:${project?.updated_at || ''}`
  const reload = useCallback(() => setReloadToken(value => value + 1), [])
  useEffect(() => {
    if (!enabled || !projectId) return undefined
    let current = true
    const controller = new AbortController()
    setListState({ key: listKey, data: emptyData(), loading: true, issues: [], loadedAt: null })
    const load = async () => {
      let data = emptyData(), issues = []
      try { data = { ...data, ...await allDocuments(projectId, controller.signal) } }
      catch { issues = ['The complete document register is unavailable. Refresh to retry.'] }
      finally { if (current) setListState({ key: listKey, data, loading: false, issues, loadedAt: new Date().toISOString() }) }
    }
    load()
    return () => { current = false; controller.abort() }
  }, [enabled, projectId, listKey])
  const matches = listState.key === listKey
  const list = matches ? listState.data.documents : null
  const selectedSummary = documentId !== null ? list?.find(row => sameId(row.id, documentId)) : list?.slice().sort(newest)[0]
  const selectedId = selectedSummary?.id ?? null
  const detailKey = `${listKey}:${selectedId ?? ''}`
  useEffect(() => {
    if (!enabled || !projectId || !selectedId) return undefined
    let current = true
    const controller = new AbortController()
    setDetailState({ key: detailKey, data: null, loading: true, issues: [] })
    const load = async () => {
      let data = null, issues = []
      try {
        const response = await apiClient.get(`${endpoints.documents}${selectedId}/`, { signal: controller.signal })
        if (!sameId(response.data?.project, projectId) || !sameId(response.data?.id, selectedId)) throw new Error('Document scope did not match.')
        data = response.data
      } catch { issues = ['Selected document details are unavailable. Refresh to retry.'] }
      finally { if (current) setDetailState({ key: detailKey, data, loading: false, issues }) }
    }
    load()
    return () => { current = false; controller.abort() }
  }, [enabled, projectId, selectedId, detailKey])
  const detailMatches = detailState.key === detailKey
  const issues = useMemo(() => [...(matches ? listState.issues : []), ...(selectedId && detailMatches ? detailState.issues : []), ...(list && documentId !== null && !selectedSummary ? ['The selected document is no longer in this project register. Select another document.'] : [])], [matches, listState.issues, selectedId, detailMatches, detailState.issues, list, documentId, selectedSummary])
  const model = useMemo(() => buildDocumentModel(project, matches ? { ...listState.data, selectedId, selected: detailMatches ? detailState.data : null } : emptyData(), issues), [project, matches, listState.data, selectedId, detailMatches, detailState.data, issues])
  return { loading: Boolean(enabled && projectId && (!matches || listState.loading || selectedId && (!detailMatches || detailState.loading))), listLoading: Boolean(enabled && projectId && (!matches || listState.loading)), detailLoading: Boolean(enabled && selectedId && (!detailMatches || detailState.loading)), issues, model, reload, loadedAt: matches ? listState.loadedAt : null }
}
