import { useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import {
  Activity, ArrowRight, BookOpen, CheckCircle2, Clock, Download, Eye, FileText, Folder, Link2, Lock, MessageCircle,
  Pencil, Plus, Save, Search, Settings2, Share2, Sparkles, Trash2, UploadCloud, UserMinus, UserPlus, Users, X,
} from 'lucide-react'
import { listProjects } from '../services/projectControl.service'
import {
  addAIMember, archiveAIKnowledge, downloadAIKnowledge, getAIActivity, getAIInstructions, getAIKnowledge,
  listAIKnowledge, listAIMembers, removeAIMember, saveAIInstructions, searchAIEmployees, uploadAIKnowledge, updateAIProject,
} from '../services/radaiIntelligence.service'
import RadaiTeamShare from './RadaiTeamShare'

// Instruction fields, grouped so the form reads as three short sections instead of one long column.
const FIELD_GROUPS = [
  ['How RADAI should behave', [
    ['role_behavior', 'AI role and behavior', 'You are a process engineering assistant for Unit 100. Be concise and cite drawing numbers.', 6000],
    ['goals', 'Project goals', 'Close CRS comments on the Train 4 tie-ins before IFC.', 2000],
    ['response_format', 'Response format', 'Short answer first, then a table of findings with source and page.', 2000],
  ]],
  ['Engineering context', [
    ['terminology', 'Company terminology', 'IFC = Issued for Construction; CRS = Comment Resolution Sheet', 2000],
    ['standards', 'Applicable standards', 'ADNOC AGES, API 520, ASME B31.3', 2000],
  ]],
  ['Rules and evidence', [
    ['evidence_requirements', 'Evidence and citations', 'Every finding must cite the document, revision and page.', 2000],
    ['constraints', 'Special constraints', 'Never state a design is approved. Flag missing information.', 2000],
  ]],
]
const FIELDS = FIELD_GROUPS.flatMap(([, rows]) => rows)
const TABS = [
  ['Overview', Sparkles], ['Instructions', BookOpen], ['Knowledge', FileText],
  ['Members', Users], ['Activity', Activity], ['Connections', Link2],
]
const STATUS = {
  ready: ['Ready', 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'],
  processing: ['Processing', 'bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200'],
  pending: ['Waiting', 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'],
  needs_review: ['Needs review', 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200'],
  failed: ['Failed', 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200'],
}
const TILE_TONES = ['from-violet-500 to-indigo-700', 'from-sky-500 to-blue-700', 'from-emerald-500 to-teal-700', 'from-amber-500 to-orange-600', 'from-rose-500 to-pink-700', 'from-cyan-500 to-sky-700']
const ACCEPT = '.pdf,.docx,.xlsx,.csv,.txt'

const initials = name => (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'P'
const ago = iso => {
  if (!iso) return ''
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days < 30 ? `${days} day${days === 1 ? '' : 's'} ago` : new Date(iso).toLocaleDateString()
}
const personName = email => (email || 'Someone').split('@')[0].split(/[._-]/).filter(Boolean).map(p => p[0].toUpperCase() + p.slice(1)).join(' ')

// Turn an audit row into a sentence and an icon.
function describeEvent(e) {
  const m = e.metadata || {}
  if (m.instructions_version) return [BookOpen, `updated the instructions (version ${m.instructions_version})`]
  if (m.download_document_id) return [Download, 'downloaded a knowledge file']
  if (m.document_id) return e.action === 'delete' ? [Trash2, 'unlinked a knowledge file'] : [UploadCloud, `uploaded a knowledge file${m.version > 1 ? ` (version ${m.version})` : ''}`]
  if (m.member_user_id) return e.action === 'delete' ? [UserMinus, 'removed a member'] : [UserPlus, `added or updated a member${m.role ? ` as ${m.role}` : ''}`]
  if (m.shared_with_user_id) return [Share2, 'shared a chat']
  if (m.unshared_user_id) return [Share2, 'stopped sharing a chat']
  if (m.conversation_id) return e.action === 'create' ? [MessageCircle, 'started a chat'] : e.action === 'delete' ? [Trash2, 'archived a chat'] : [MessageCircle, 'updated a chat']
  if (e.action === 'create') return [Sparkles, 'created the project']
  if (e.action === 'delete') return [Trash2, 'archived the project']
  if (e.action === 'read') return [Eye, 'viewed project content']
  return [Pencil, 'updated project details']
}

export default function RadaiAIWorkspace({ project, onStartChat, onProjectUpdated, onManageTeams, initialTab = 'Overview' }) {
  const [tab, setTab] = useState(TABS.some(([name]) => name === initialTab) ? initialTab : 'Overview')
  const [instructions, setInstructions] = useState(null)
  const [form, setForm] = useState({})
  const [documents, setDocuments] = useState([])
  const [docQuery, setDocQuery] = useState('')
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState(null)
  const [members, setMembers] = useState([])
  const [activity, setActivity] = useState([])
  const [employeeQuery, setEmployeeQuery] = useState('')
  const [employeeResults, setEmployeeResults] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [employeeSearchBusy, setEmployeeSearchBusy] = useState(false)
  const [employeeSearchError, setEmployeeSearchError] = useState('')
  const employeeSearchInput = useRef(null)
  const fileInput = useRef(null)
  const [memberRole, setMemberRole] = useState('viewer')
  const [enterpriseProjects, setEnterpriseProjects] = useState([])
  const [enterpriseError, setEnterpriseError] = useState('')
  const [enterpriseId, setEnterpriseId] = useState(String(project.enterprise_project_id || ''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const canEdit = project.role === 'owner' || project.role === 'editor'
  const isOwner = project.role === 'owner'

  const applyInstructions = rule => { setInstructions(rule); setForm(Object.fromEntries(FIELDS.map(([key]) => [key, rule[key] || '']))) }
  const refresh = async () => {
    const [rule, knowledge, people, events] = await Promise.all([
      getAIInstructions(project.id), listAIKnowledge(project.id), listAIMembers(project.id), getAIActivity(project.id),
    ])
    applyInstructions(rule)
    setDocuments(knowledge.results || [])
    setMembers(people.results || [])
    setActivity(events || [])
  }
  useEffect(() => {
    let active = true
    setError('')
    Promise.all([getAIInstructions(project.id), listAIKnowledge(project.id), listAIMembers(project.id), getAIActivity(project.id)])
      .then(([rule, knowledge, people, events]) => {
        if (!active) return
        applyInstructions(rule); setDocuments(knowledge.results || []); setMembers(people.results || []); setActivity(events || [])
      })
      .catch(() => { if (active) setError('Project details could not be loaded. Check your access.') })
    return () => { active = false }
  }, [project.id])
  useEffect(() => {
    if (tab !== 'Connections' || !isOwner) return undefined
    let active = true
    listProjects({ page: 1, page_size: 100 })
      .then(result => { if (active) setEnterpriseProjects(Array.isArray(result) ? result : result.results || []) })
      .catch(() => { if (active) setEnterpriseError('Enterprise project linking is unavailable for your account.') })
    return () => { active = false }
  }, [tab, isOwner])
  useEffect(() => {
    if (tab !== 'Members' || !isOwner || selectedEmployee || employeeQuery.trim().length < 2) {
      setEmployeeResults([]); setEmployeeSearchBusy(false); return undefined
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setEmployeeSearchBusy(true); setEmployeeSearchError('')
      searchAIEmployees(employeeQuery.trim(), controller.signal)
        .then(result => {
          if (controller.signal.aborted) return
          const needle = employeeQuery.trim().toLocaleLowerCase()
          setEmployeeResults((result.results || []).filter(employee => [
            `${employee.first_name || ''} ${employee.last_name || ''}`.trim(), employee.email, employee.employee_number, employee.employment_id,
          ].some(value => String(value || '').toLocaleLowerCase().includes(needle))).slice(0, 20))
        })
        .catch(() => { if (!controller.signal.aborted) setEmployeeSearchError('Employee search is unavailable. You can still enter an exact email address.') })
        .finally(() => { if (!controller.signal.aborted) setEmployeeSearchBusy(false) })
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [tab, isOwner, employeeQuery, selectedEmployee])

  const run = async (operation, message) => {
    setBusy(true); setError(''); setNotice('')
    try { await operation(); await refresh(); setNotice(message); return true }
    catch (err) { setError(err?.response?.data?.detail || 'The change could not be saved. Check your permissions and try again.'); return false }
    finally { setBusy(false) }
  }
  const uploadFiles = async files => {
    const list = [...(files || [])]
    if (!list.length) return
    const ok = await run(async () => { for (const file of list) await uploadAIKnowledge(project.id, file) },
      `${list.length === 1 ? 'Document' : `${list.length} documents`} processed. Check the status before using ${list.length === 1 ? 'it' : 'them'} in chat.`)
    if (ok && fileInput.current) fileInput.current.value = ''
  }
  const addMember = async event => {
    event.preventDefault()
    const email = employeeQuery.trim()
    if (!selectedEmployee && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
    setBusy(true); setError(''); setNotice('')
    try {
      const added = await addAIMember(project.id, selectedEmployee ? { user_id: selectedEmployee.user_id, role: memberRole } : { email, role: memberRole })
      setMembers(previous => previous.some(member => String(member.user_id) === String(added.user_id))
        ? previous.map(member => String(member.user_id) === String(added.user_id) ? added : member)
        : [...previous, added])
      setEmployeeQuery(''); setSelectedEmployee(null); setEmployeeResults([])
      setNotice('Project access updated.')
    } catch (err) {
      setError(err?.response?.data?.detail || err?.response?.data?.email?.[0] || 'The employee could not be added. Check the selection and try again.')
    } finally { setBusy(false) }
  }
  const download = async doc => {
    try {
      const response = await downloadAIKnowledge(project.id, doc.id)
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url; link.download = doc.name; link.click()
      URL.revokeObjectURL(url)
    } catch { setError('The file could not be downloaded.') }
  }

  const dirty = instructions && FIELDS.some(([key]) => (form[key] || '') !== (instructions[key] || ''))
  const filled = instructions ? FIELDS.filter(([key]) => (instructions[key] || '').trim()).length : 0
  const readyDocs = documents.filter(doc => doc.status === 'ready').length
  const attentionDocs = documents.filter(doc => ['failed', 'needs_review'].includes(doc.status)).length
  const visibleDocs = useMemo(() => documents.filter(doc => !docQuery.trim() || doc.name.toLowerCase().includes(docQuery.trim().toLowerCase())), [documents, docQuery])
  const counts = { Knowledge: documents.length, Members: members.length, Activity: activity.length }
  const tone = TILE_TONES[Number(project.id) % TILE_TONES.length]
  const card = 'rounded-2xl border border-[var(--rd-border-soft)] bg-[var(--rd-surface)] p-5'
  const sectionTitle = 'flex items-center gap-2 text-sm font-semibold text-[var(--rd-text)]'
  const muted = 'text-[var(--rd-text-muted)]'

  return <div className="mx-auto w-full max-w-[1200px] pb-10">
    {/* Header */}
    <div className="flex flex-wrap items-start gap-4">
      <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${tone} text-lg font-bold text-white shadow-md`} aria-hidden="true">{initials(project.name)}</span>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-bold tracking-tight">{project.name}</h1>
        <p className={`mt-1 line-clamp-2 text-sm ${muted}`}>{project.description || 'Add instructions and reference files for this workspace.'}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="rounded-full bg-[var(--rd-primary-soft)] px-2 py-0.5 font-medium capitalize text-[var(--rd-primary)]">{project.role}</span>
          <span className={`inline-flex items-center gap-1 rounded-full border border-[var(--rd-border-soft)] px-2 py-0.5 ${muted}`}>{project.visibility === 'shared' ? <Users size={11} /> : <Lock size={11} />}{project.visibility === 'shared' ? 'Shared' : 'Private'}</span>
          {project.folder && <span className={`inline-flex items-center gap-1 rounded-full border border-[var(--rd-border-soft)] px-2 py-0.5 ${muted}`}><Folder size={11} />{project.folder}</span>}
        </div>
      </div>
      <button type="button" onClick={onStartChat} className="radai-ai-new-chat !h-10 w-full shrink-0 px-4 sm:w-auto"><MessageCircle size={16} />Chat in this project</button>
    </div>

    {/* Tabs */}
    <div role="tablist" aria-label="Project sections" className="mt-6 flex gap-1 overflow-x-auto rounded-2xl border border-[var(--rd-border-soft)] bg-[var(--rd-surface-subtle)] p-1">
      {TABS.map(([name, Icon]) => {
        const on = tab === name
        return <button role="tab" aria-selected={on} key={name} type="button" onClick={() => { setTab(name); setError(''); setNotice('') }}
          className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm ${on ? 'bg-[var(--rd-surface)] font-semibold text-[var(--rd-text)] shadow-sm' : `${muted} hover:text-[var(--rd-text)]`}`}>
          <Icon size={15} />{name}{counts[name] != null && <span className={`rounded-full px-1.5 text-[11px] font-semibold ${on ? 'bg-[var(--rd-primary-soft)] text-[var(--rd-primary)]' : 'bg-[var(--rd-surface)]'}`}>{counts[name]}</span>}
        </button>
      })}
    </div>
    {error && <p className="mt-4 rounded-xl border border-[var(--rd-danger)]/40 bg-[var(--rd-danger-soft)] px-4 py-2.5 text-sm text-[var(--rd-danger)]" role="alert">{error}</p>}
    {notice && <p className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--rd-success)]/40 bg-[var(--rd-success-soft)] px-4 py-2.5 text-sm" role="status"><CheckCircle2 size={15} className="text-[var(--rd-success)]" />{notice}</p>}

    {!instructions ? <p className={`mt-6 text-sm ${muted}`} role="status">Loading project…</p> : <section role="tabpanel" aria-label={`${tab} panel`} className="pt-5">

      {tab === 'Overview' && <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--rd-border-soft)] bg-gradient-to-br from-indigo-50 via-[var(--rd-surface)] to-sky-50 p-6 lg:col-span-3 dark:from-indigo-950/50 dark:to-sky-950/30">
          <h2 className="text-lg font-semibold">Ask RADAI about {project.name}</h2>
          <p className={`mt-1 max-w-2xl text-sm ${muted}`}>Chats in this project use its {filled} instruction section{filled === 1 ? '' : 's'} and {readyDocs} ready file{readyDocs === 1 ? '' : 's'}. Your conversations stay private unless you share them.</p>
          <button type="button" onClick={onStartChat} className="radai-ai-new-chat mt-4 !h-10 px-4"><Sparkles size={16} />Start a conversation<ArrowRight size={15} /></button>
        </div>
        {[
          ['Instructions', BookOpen, `${filled} of ${FIELDS.length} sections filled`, instructions.version ? `Version ${instructions.version}` : 'Not set up yet', filled / FIELDS.length, canEdit ? 'Edit instructions' : 'View instructions'],
          ['Knowledge', FileText, `${documents.length} file${documents.length === 1 ? '' : 's'}`, attentionDocs ? `${attentionDocs} need${attentionDocs === 1 ? 's' : ''} attention` : `${readyDocs} ready for chat`, documents.length ? readyDocs / documents.length : 0, canEdit ? 'Manage files' : 'View files'],
          ['Members', Users, `${members.length} ${members.length === 1 ? 'person' : 'people'}`, project.visibility === 'shared' ? 'Shared project' : 'Private project', null, isOwner ? 'Manage people' : 'View people'],
        ].map(([name, Icon, big, small, progress, action]) => (
          <div key={name} className={`${card} flex flex-col`}>
            <div className={sectionTitle}><span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--rd-primary-soft)] text-[var(--rd-primary)]"><Icon size={16} /></span>{name}</div>
            <div className="mt-4 text-xl font-semibold">{big}</div>
            <div className={`text-sm ${name === 'Knowledge' && attentionDocs ? 'text-[var(--rd-warning)]' : muted}`}>{small}</div>
            {progress != null && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--rd-surface-subtle)]"><div className="h-full rounded-full bg-[var(--rd-primary)]" style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
            <button type="button" onClick={() => setTab(name)} className="mt-auto inline-flex items-center gap-1 pt-4 text-left text-sm font-medium text-[var(--rd-primary)] hover:underline">{action}<ArrowRight size={14} /></button>
          </div>
        ))}
        <div className={`${card} lg:col-span-3`}>
          <div className="flex items-center justify-between"><div className={sectionTitle}><Activity size={16} />Recent activity</div>{activity.length > 5 && <button type="button" onClick={() => setTab('Activity')} className="text-sm text-[var(--rd-primary)] hover:underline">See all</button>}</div>
          {activity.length ? <ul className="mt-3 divide-y divide-[var(--rd-border-soft)]">{activity.slice(0, 5).map((event, index) => {
            const [Icon, text] = describeEvent(event)
            return <li key={index} className="flex items-center gap-3 py-2.5 text-sm"><Icon size={15} className="shrink-0 text-[var(--rd-text-faint)]" /><span className="min-w-0 flex-1 truncate"><strong className="font-medium">{personName(event.user_email)}</strong> {text}</span><span className={`shrink-0 text-xs ${muted}`}>{ago(event.created_at)}</span></li>
          })}</ul> : <p className={`mt-3 text-sm ${muted}`}>Nothing has happened in this project yet.</p>}
        </div>
      </div>}

      {tab === 'Instructions' && <form onSubmit={async event => { event.preventDefault(); await run(() => saveAIInstructions(project.id, { ...form, expected_version: instructions.version }), 'Instructions saved.') }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className={`max-w-2xl text-sm ${muted}`}>These preferences guide every answer in this project. Security and engineering approval rules still apply.</p>
          <span className={`text-xs ${muted}`}>{instructions.version ? `Version ${instructions.version}` : 'Not saved yet'} · {filled} of {FIELDS.length} filled</span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
          {FIELD_GROUPS.map(([title, rows], groupIndex) => <fieldset key={title} className={`${card} space-y-4 ${groupIndex === 0 ? 'lg:row-span-2' : ''}`}>
            <legend className="sr-only">{title}</legend>
            <div className={sectionTitle}>{title}</div>
            {rows.map(([key, labelText, placeholder, limit]) => <div key={key}>
              <div className="flex items-center justify-between"><label htmlFor={`ai-${key}`} className="text-sm font-medium">{labelText}</label><span className={`text-[11px] ${(form[key] || '').length > limit * 0.9 ? 'text-[var(--rd-warning)]' : 'text-[var(--rd-text-faint)]'}`}>{(form[key] || '').length}/{limit}</span></div>
              <textarea id={`ai-${key}`} value={form[key] || ''} maxLength={limit} disabled={!canEdit || busy} placeholder={canEdit ? placeholder : 'Not set'}
                onChange={event => setForm(previous => ({ ...previous, [key]: event.target.value }))} rows={key === 'role_behavior' ? 6 : 3} className="rd-input mt-1 w-full resize-y" />
            </div>)}
          </fieldset>)}
        </div>
        {canEdit ? <div className={`sticky bottom-0 mt-4 flex flex-wrap items-center justify-end gap-3 rounded-2xl border px-4 py-3 ${dirty ? 'border-[var(--rd-warning)]/50 bg-[var(--rd-warning-soft)]' : 'border-[var(--rd-border-soft)] bg-[var(--rd-surface)]'}`}>
          {dirty && <span className="mr-auto text-sm">You have unsaved changes.</span>}
          {dirty && <button type="button" className="rd-btn" disabled={busy} onClick={() => applyInstructions(instructions)}>Discard</button>}
          <button type="submit" className="rd-btn rd-btn-primary" disabled={busy || !dirty}><Save size={16} />Save instructions</button>
        </div> : <p className={`mt-4 text-xs ${muted}`}>Editors and owners can change instructions.</p>}
      </form>}

      {tab === 'Knowledge' && <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="space-y-4">
          {canEdit && <div
            onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
            onDrop={event => { event.preventDefault(); setDragging(false); uploadFiles(event.dataTransfer.files) }}
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${dragging ? 'border-[var(--rd-primary)] bg-[var(--rd-primary-soft)]' : 'border-[var(--rd-border)] bg-[var(--rd-surface)]'}`}>
            <UploadCloud size={28} className="text-[var(--rd-primary)]" />
            <p className="mt-2 text-sm font-medium">Drop files here, or <button type="button" className="text-[var(--rd-primary)] underline" onClick={() => fileInput.current?.click()} disabled={busy}>browse</button></p>
            <p className={`mt-1 text-xs ${muted}`}>PDF, DOCX, XLSX, CSV, TXT · 12 MB each · Scanned PDFs without text need review</p>
            <label htmlFor="ai-project-file" className="sr-only">Upload knowledge</label>
            <input ref={fileInput} id="ai-project-file" type="file" multiple accept={ACCEPT} className="sr-only" onChange={event => uploadFiles(event.target.files)} disabled={busy} />
            {busy && <p className="mt-2 text-xs" role="status">Uploading and reading files…</p>}
          </div>}
          <div className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className={sectionTitle}><FileText size={16} />Files <span className={`text-xs font-normal ${muted}`}>{readyDocs} ready{attentionDocs ? ` · ${attentionDocs} need attention` : ''}</span></div>
              {documents.length > 3 && <div className="relative w-full sm:w-56"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--rd-text-faint)]" /><input value={docQuery} onChange={event => setDocQuery(event.target.value)} placeholder="Find a file" aria-label="Find a file" className="rd-input w-full !pl-8" /></div>}
            </div>
            <p className={`mt-1 text-xs ${muted}`}>Files are private to this project. Uploading doesn&apos;t approve a company standard.</p>
            {visibleDocs.length ? <ul className="mt-3 divide-y divide-[var(--rd-border-soft)]">{visibleDocs.map(doc => {
              const [statusText, statusTone] = STATUS[doc.status] || [doc.status, STATUS.pending[1]]
              const open = preview?.id === doc.id
              return <li key={doc.id} className={`flex flex-wrap items-center gap-3 py-3 ${open ? 'bg-[var(--rd-primary-soft)]/40' : ''}`}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--rd-surface-subtle)] text-[10px] font-bold uppercase text-[var(--rd-text-muted)]">{doc.name.split('.').pop().slice(0, 4)}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{doc.name}</p><p className={`text-xs ${muted}`}>Version {doc.version} · {doc.locations?.length || 0} page{doc.locations?.length === 1 ? '' : 's'} read · {ago(doc.created_at)}{doc.error ? ` · ${doc.error}` : ''}</p></div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusTone}`}>{statusText}</span>
                <div className="flex items-center gap-1">
                  <button type="button" className="radai-ai-icon-btn" aria-label={`Preview ${doc.name}`} title="Preview" onClick={() => getAIKnowledge(project.id, doc.id).then(setPreview).catch(() => setError('Preview unavailable.'))}><Eye size={15} /></button>
                  <button type="button" className="radai-ai-icon-btn" aria-label={`Download ${doc.name}`} title="Download" onClick={() => download(doc)}><Download size={15} /></button>
                  {canEdit && <button type="button" className="radai-ai-icon-btn hover:!text-[var(--rd-danger)]" aria-label={`Unlink ${doc.name}`} title="Unlink" disabled={busy}
                    onClick={() => run(() => archiveAIKnowledge(project.id, doc.id), 'Document unlinked.').then(ok => { if (ok && open) setPreview(null) })}><Trash2 size={15} /></button>}
                </div>
              </li>
            })}</ul> : <p className={`mt-4 text-sm ${muted}`}>{documents.length ? 'No files match.' : 'No knowledge uploaded yet.'}</p>}
          </div>
        </div>
        <aside className={`${card} lg:sticky lg:top-4 lg:max-h-[70vh] lg:overflow-y-auto`} aria-label="File preview">
          {preview ? <>
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold">{preview.name}</p><p className={`text-xs ${muted}`}>Text RADAI can read from this file</p></div><button type="button" className="radai-ai-icon-btn" aria-label="Close preview" onClick={() => setPreview(null)}><X size={15} /></button></div>
            {preview.pages?.length ? preview.pages.map(page => <div key={page.location} className="mt-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--rd-text-faint)]">{page.location}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{page.text}</p></div>) : <p className={`mt-4 text-sm ${muted}`}>No searchable text is available. A scanned file may need review.</p>}
          </> : <div className={`grid min-h-[160px] place-items-center text-center text-sm ${muted}`}><div><Eye size={22} className="mx-auto text-[var(--rd-text-faint)]" /><p className="mt-2">Choose a file&apos;s eye icon to see the text RADAI reads from it.</p></div></div>}
        </aside>
      </div>}

      {tab === 'Members' && <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className={card}>
          <div className={sectionTitle}><Users size={16} />People with access</div>
          <p className={`mt-1 text-xs ${muted}`}>Members can use this project&apos;s knowledge. Their own conversations stay private unless explicitly shared.</p>
          <ul className="mt-3 divide-y divide-[var(--rd-border-soft)]">{members.map(member => <li key={member.user_id} className="flex items-center gap-3 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--rd-surface-subtle)] text-xs font-semibold">{initials(personName(member.email))}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{personName(member.email)}</p><p className={`truncate text-xs ${muted}`}>{member.email || `User ${member.user_id}`}</p></div>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${member.role === 'owner' ? 'bg-[var(--rd-primary-soft)] text-[var(--rd-primary)]' : 'bg-[var(--rd-surface-subtle)]'}`}>{member.role}</span>
            {isOwner && member.role !== 'owner' && <button type="button" className="radai-ai-icon-btn hover:!text-[var(--rd-danger)]" onClick={() => run(() => removeAIMember(project.id, member.user_id), 'Member removed.')} aria-label={`Remove ${member.email || member.user_id}`} disabled={busy}><Trash2 size={15} /></button>}
          </li>)}</ul>
        </div>
        <div className="space-y-4">
          {isOwner && <form onSubmit={addMember} className={`${card} space-y-3`}>
            <div className={sectionTitle}><UserPlus size={16} />Add people</div>
            <div className="relative">
              <label htmlFor="ai-member-search" className={`block text-xs font-medium ${muted}`}>Search active RADAI employees</label>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-[var(--rd-border-soft)] px-3"><Search size={16} aria-hidden="true" /><input ref={employeeSearchInput} id="ai-member-search" type="search" value={employeeQuery} onChange={event => { setEmployeeQuery(event.target.value); setSelectedEmployee(null); setEmployeeResults([]); setEmployeeSearchBusy(event.target.value.trim().length >= 2); setEmployeeSearchError('') }} placeholder="Name, employee ID or email" autoComplete="off" className="min-h-10 min-w-0 flex-1 bg-transparent outline-none" /></div>
              {employeeSearchBusy && <p className={`mt-2 text-xs ${muted}`} role="status">Searching employees…</p>}
              {employeeSearchError && <p className="mt-2 text-xs text-[var(--rd-danger)]" role="alert">{employeeSearchError}</p>}
              {!selectedEmployee && employeeQuery.trim().length >= 2 && !employeeSearchBusy && !employeeSearchError && <div className="absolute left-0 right-0 z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[var(--rd-border-soft)] bg-[var(--rd-surface)] shadow-[var(--rd-shadow-overlay)]" aria-label="Matching employees">
                {employeeResults.filter(employee => !members.some(member => String(member.user_id) === String(employee.user_id))).length
                  ? employeeResults.filter(employee => !members.some(member => String(member.user_id) === String(employee.user_id))).map(employee => <button key={employee.user_id} type="button" onClick={() => { setSelectedEmployee(employee); setEmployeeQuery(`${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.email); setEmployeeResults([]); setEmployeeSearchBusy(false); requestAnimationFrame(() => employeeSearchInput.current?.focus()) }} className="flex w-full flex-col border-b border-[var(--rd-border-soft)] px-3 py-2 text-left last:border-0 hover:bg-[var(--rd-primary-soft)]"><span className="font-medium">{`${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.email}</span><span className={`text-xs ${muted}`}>{[employee.email, employee.employee_number, employee.department].filter(Boolean).join(' · ')}</span></button>)
                  : <p className={`px-3 py-2 text-xs ${muted}`}>No eligible employees found.</p>}
              </div>}
              {selectedEmployee && <p className={`mt-2 text-xs ${muted}`}>Selected: {selectedEmployee.email || `${selectedEmployee.first_name} ${selectedEmployee.last_name}`}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[['viewer', 'Viewer', 'Reads knowledge and chats'], ['editor', 'Editor', 'Also edits instructions and files']].map(([value, title, hint]) => <label key={value} className={`cursor-pointer rounded-xl border px-3 py-2 text-sm ${memberRole === value ? 'border-[var(--rd-primary)] bg-[var(--rd-primary-soft)]' : 'border-[var(--rd-border-soft)]'}`}>
                <input type="radio" name="ai-member-role" value={value} checked={memberRole === value} onChange={() => setMemberRole(value)} className="sr-only" />
                <span className="block font-medium">{title}</span><span className={`block text-[11px] ${muted}`}>{hint}</span>
              </label>)}
            </div>
            <button type="submit" disabled={busy || (!selectedEmployee && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employeeQuery.trim()))} className="rd-btn rd-btn-primary w-full justify-center"><Plus size={16} />Add person</button>
            <p className={`text-xs ${muted}`}>You can also enter an exact employee email if search is unavailable.</p>
          </form>}
          {isOwner && <RadaiTeamShare project={project} onChanged={refresh} onManageTeams={onManageTeams} />}
          {!isOwner && <p className={`${card} text-sm ${muted}`}>Only the project owner can add people or share with a team.</p>}
        </div>
      </div>}

      {tab === 'Activity' && <div className={card}>
        <div className={sectionTitle}><Clock size={16} />Project activity <span className={`text-xs font-normal ${muted}`}>latest {activity.length}</span></div>
        {activity.length ? <ol className="relative mt-4 space-y-4 border-l border-[var(--rd-border-soft)] pl-6">{activity.map((event, index) => {
          const [Icon, text] = describeEvent(event)
          return <li key={index} className="relative">
            <span className="absolute -left-[37px] grid h-6 w-6 place-items-center rounded-full border border-[var(--rd-border-soft)] bg-[var(--rd-surface)] text-[var(--rd-primary)]"><Icon size={12} /></span>
            <p className="text-sm"><strong className="font-medium">{personName(event.user_email)}</strong> {text}</p>
            <p className={`text-xs ${muted}`} title={new Date(event.created_at).toLocaleString()}>{ago(event.created_at)} · {new Date(event.created_at).toLocaleString()}</p>
          </li>
        })}</ol> : <p className={`mt-3 text-sm ${muted}`}>No activity yet.</p>}
      </div>}

      {tab === 'Connections' && <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <div className={card}>
          <div className={sectionTitle}><Settings2 size={16} />Enterprise project link</div>
          <p className={`mt-1 text-sm ${muted}`}>Identifies an existing RADAI project. It doesn&apos;t import documents or give members access to engineering records.</p>
          {isOwner ? enterpriseError ? <p className={`mt-3 text-sm ${muted}`}>{enterpriseError}</p> : <div className="mt-4 flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="ai-enterprise-link">Enterprise project</label>
            <select id="ai-enterprise-link" value={enterpriseId} onChange={event => setEnterpriseId(event.target.value)} className="rd-input min-w-0 flex-1"><option value="">No enterprise project</option>{enterpriseProjects.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
            <button type="button" disabled={busy} onClick={() => run(async () => { await updateAIProject(project.id, { enterprise_project_id: enterpriseId || null }); await onProjectUpdated() }, 'Enterprise link updated.')} className="rd-btn">Save link</button>
          </div> : <p className={`mt-3 text-sm ${muted}`}>Only the owner can change this link.</p>}
        </div>
        <div className={`${card} opacity-80`}>
          <div className={sectionTitle}><Link2 size={16} />Microsoft 365</div>
          <p className={`mt-1 text-sm ${muted}`}>SharePoint, OneDrive and Outlook connections become available once your organization authorizes tenant access.</p>
          <span className="mt-4 inline-flex rounded-full bg-[var(--rd-surface-subtle)] px-2.5 py-1 text-xs">Coming later</span>
        </div>
      </div>}
    </section>}
  </div>
}

RadaiAIWorkspace.propTypes = { project: PropTypes.object.isRequired, onStartChat: PropTypes.func.isRequired, onProjectUpdated: PropTypes.func.isRequired, onManageTeams: PropTypes.func, initialTab: PropTypes.string }
