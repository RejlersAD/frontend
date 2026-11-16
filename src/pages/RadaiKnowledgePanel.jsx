import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { FileText, Plus, Trash2 } from 'lucide-react'
import { listDocuments, uploadDocument } from '../services/projectControl.service'
import {
  getKnowledgeSource, linkCrsRevision, linkProjectDocument, listEngineeringEvidence,
  listProjectKnowledge, retryKnowledgeSource, unlinkKnowledgeSource,
} from '../services/radaiIntelligence.service'

const rows = response => Array.isArray(response) ? response : (response?.results || [])

export default function RadaiKnowledgePanel({ projectId }) {
  const [sources, setSources] = useState([])
  const [nextPage, setNextPage] = useState(null)
  const [documents, setDocuments] = useState([])
  const [revisions, setRevisions] = useState([])
  const [canEdit, setCanEdit] = useState(false)
  const [selectedDocument, setSelectedDocument] = useState('')
  const [selectedRevision, setSelectedRevision] = useState('')
  const [search, setSearch] = useState('')
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = async () => {
    const [knowledge, projectDocuments] = await Promise.all([
      listProjectKnowledge(projectId, search), listDocuments(projectId),
    ])
    setSources(rows(knowledge))
    setNextPage(knowledge?.next || null)
    setCanEdit(Boolean(knowledge?.can_edit))
    setDocuments(rows(projectDocuments))
    try { setRevisions(rows(await listEngineeringEvidence(projectId))) } catch { setRevisions([]) }
  }

  useEffect(() => {
    let active = true
    Promise.all([listDocuments(projectId), listEngineeringEvidence(projectId).catch(() => [])])
      .then(([projectDocuments, evidence]) => {
        if (!active) return
        setDocuments(rows(projectDocuments)); setRevisions(rows(evidence))
      })
      .catch(() => { if (active) setError('Knowledge could not be loaded. Check project access and retry.') })
    return () => { active = false }
  }, [projectId])

  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      listProjectKnowledge(projectId, search).then(result => {
        if (!active) return
        setSources(rows(result)); setNextPage(result?.next || null); setCanEdit(Boolean(result?.can_edit))
      }).catch(() => { if (active) setError('Knowledge search could not be loaded.') })
    }, search ? 250 : 0)
    return () => { active = false; clearTimeout(timer) }
  }, [projectId, search])

  const perform = async operation => {
    setBusy(true); setError('')
    try { await operation(); await refresh() } catch { setError('Knowledge could not be updated. Check permissions and source availability.') }
    finally { setBusy(false) }
  }
  const upload = event => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 12 * 1024 * 1024) { setError('Choose a file smaller than 12 MB.'); event.target.value = ''; return }
    perform(async () => {
      const document = await uploadDocument(projectId, file, { kind: 'other', title: file.name })
      await linkProjectDocument(projectId, document.id)
      event.target.value = ''
    })
  }
  const openPreview = async source => {
    setError('')
    try { setPreview(await getKnowledgeSource(projectId, source.id)) }
    catch { setError('The source preview is unavailable.') }
  }
  const loadMore = async () => {
    if (!nextPage) return
    try {
      const result = await listProjectKnowledge(projectId, search, nextPage)
      setSources(previous => [...previous, ...rows(result)])
      setNextPage(result?.next || null)
    } catch { setError('More knowledge could not be loaded.') }
  }
  const linkedDocuments = new Set(sources.map(source => source.project_document_id))
  const linkedRevisions = new Set(sources.map(source => source.crs_revision_id))
  const availableDocuments = documents.filter(document => !linkedDocuments.has(document.id))
  const availableRevisions = revisions.filter(revision => !linkedRevisions.has(revision.revision_id))
  const filtered = sources.filter(source => `${source.name} ${source.revision || ''}`.toLowerCase().includes(search.toLowerCase()))

  return <div className="max-w-3xl space-y-6 text-sm">
    <div><h2 className="text-base font-semibold">Project knowledge</h2><p className="mt-1 text-[var(--rd-text-muted)]">Sources remain unverified until their controlled workflow confirms approval. Only explicitly linked project evidence is used in answers.</p></div>
    {canEdit && <div className="space-y-3 rounded-xl border border-[var(--rd-border-soft)] p-4">
      <label className="block font-medium" htmlFor="knowledge-file">Upload a supporting document</label>
      <input id="knowledge-file" type="file" accept=".pdf,.docx,.xlsx,.csv,.txt" disabled={busy} onChange={upload} className="block w-full text-xs file:mr-3 file:rounded-md file:border file:border-[var(--rd-border-soft)] file:bg-[var(--rd-surface)] file:px-3 file:py-2" />
      <p className="text-xs text-[var(--rd-text-muted)]">PDF, DOCX, XLSX, CSV, TXT · 12 MB maximum. Scanned files without embedded text need review.</p>
      <div className="flex flex-wrap gap-2"><label className="sr-only" htmlFor="knowledge-existing">Existing project document</label><select id="knowledge-existing" value={selectedDocument} onChange={event => setSelectedDocument(event.target.value)} className="rd-input min-w-0 flex-1"><option value="">Select existing project document</option>{availableDocuments.map(document => <option key={document.id} value={document.id}>{document.title || document.original_filename}</option>)}</select><button type="button" className="rd-btn" disabled={!selectedDocument || busy} onClick={() => perform(async () => { await linkProjectDocument(projectId, Number(selectedDocument)); setSelectedDocument('') })}><Plus size={16} />Link</button></div>
      <div className="flex flex-wrap gap-2"><label className="sr-only" htmlFor="knowledge-crs">Linked CRS revision</label><select id="knowledge-crs" value={selectedRevision} onChange={event => setSelectedRevision(event.target.value)} className="rd-input min-w-0 flex-1"><option value="">Select linked CRS revision</option>{availableRevisions.map(revision => <option key={revision.revision_id} value={revision.revision_id}>Revision {revision.revision_label} · {revision.extraction_id}</option>)}</select><button type="button" className="rd-btn" disabled={!selectedRevision || busy} onClick={() => perform(async () => { await linkCrsRevision(projectId, Number(selectedRevision)); setSelectedRevision('') })}><Plus size={16} />Link</button></div>
    </div>}
    <div><label className="block font-medium" htmlFor="knowledge-search">Find knowledge</label><input id="knowledge-search" value={search} onChange={event => setSearch(event.target.value)} className="rd-input mt-2 w-full" placeholder="Search by document or revision" /></div>
    {error && <p role="alert" className="text-[var(--rd-danger)]">{error}</p>}
    {filtered.length ? <ul className="divide-y divide-[var(--rd-border-soft)] border-y border-[var(--rd-border-soft)]">{filtered.map(source => <li key={source.id} className="flex flex-wrap items-center gap-3 py-3"><FileText size={17} className="shrink-0 text-[var(--rd-text-muted)]" /><div className="min-w-0 flex-1"><p className="truncate font-medium">{source.name}</p><p className="text-xs text-[var(--rd-text-muted)]">{source.revision || 'Supporting file'} · {source.status} · {source.approval}</p></div>{canEdit && ["failed", "needs_review"].includes(source.status) && <button type="button" disabled={busy} onClick={() => perform(() => retryKnowledgeSource(projectId, source.id))} className="rd-btn">Retry processing</button>}<button type="button" onClick={() => openPreview(source)} className="rd-btn">Preview</button>{canEdit && <button type="button" disabled={busy} aria-label={`Unlink ${source.name}`} onClick={() => perform(() => unlinkKnowledgeSource(projectId, source.id))} className="rounded-md p-2 text-[var(--rd-text-muted)] hover:text-[var(--rd-danger)]"><Trash2 size={16} /></button>}</li>)}</ul> : <p className="text-[var(--rd-text-muted)]">No project knowledge matches your search.</p>}
    {nextPage && <button type="button" onClick={loadMore} className="rd-btn">Load more knowledge</button>}
    {preview && <section aria-label="Knowledge preview" className="rounded-xl border border-[var(--rd-border-soft)] p-4"><div className="flex justify-between gap-3"><h3 className="font-semibold">{preview.name}</h3><button type="button" onClick={() => setPreview(null)} className="text-xs underline">Close preview</button></div>{preview.pages?.length ? preview.pages.map(page => <div key={page.location} className="mt-4"><p className="text-xs font-medium text-[var(--rd-text-muted)]">{page.location}</p><p className="mt-1 whitespace-pre-wrap break-words leading-6">{page.text}</p></div>) : <p className="mt-3 text-[var(--rd-text-muted)]">No searchable text is available.</p>}</section>}
  </div>
}

RadaiKnowledgePanel.propTypes = { projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired }
