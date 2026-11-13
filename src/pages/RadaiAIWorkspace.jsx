import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { ArrowRight, FileText, Plus, Save, Trash2, Users } from 'lucide-react'
import { listProjects } from '../services/projectControl.service'
import {
  addAIMember, archiveAIKnowledge, getAIActivity, getAIInstructions, getAIKnowledge,
  listAIKnowledge, listAIMembers, removeAIMember, saveAIInstructions, uploadAIKnowledge, updateAIProject,
} from '../services/radaiIntelligence.service'

const fields = [
  ['role_behavior', 'AI role and behavior'], ['goals', 'Project goals'],
  ['response_format', 'Response format'], ['terminology', 'Company terminology'],
  ['standards', 'Applicable standards'], ['evidence_requirements', 'Evidence and citations'],
  ['constraints', 'Special constraints'],
]
const tabs = ['Chat', 'Instructions', 'Knowledge', 'Members', 'Activity', 'Connections']

export default function RadaiAIWorkspace({ project, onStartChat, onProjectUpdated }) {
  const [tab, setTab] = useState('Instructions')
  const [instructions, setInstructions] = useState(null)
  const [form, setForm] = useState({})
  const [documents, setDocuments] = useState([])
  const [preview, setPreview] = useState(null)
  const [members, setMembers] = useState([])
  const [activity, setActivity] = useState([])
  const [memberEmail, setMemberEmail] = useState('')
  const [memberRole, setMemberRole] = useState('viewer')
  const [enterpriseProjects, setEnterpriseProjects] = useState([])
  const [enterpriseError, setEnterpriseError] = useState('')
  const [enterpriseId, setEnterpriseId] = useState(String(project.enterprise_project_id || ''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const canEdit = project.role === 'owner' || project.role === 'editor'

  const refresh = async () => {
    const [rule, knowledge, people, events] = await Promise.all([
      getAIInstructions(project.id), listAIKnowledge(project.id), listAIMembers(project.id), getAIActivity(project.id),
    ])
    setInstructions(rule)
    setForm(Object.fromEntries(fields.map(([key]) => [key, rule[key] || ''])))
    setDocuments(knowledge.results || [])
    setMembers(people.results || [])
    setActivity(events || [])
  }
  useEffect(() => { let active = true; setError(''); Promise.all([
    getAIInstructions(project.id), listAIKnowledge(project.id), listAIMembers(project.id), getAIActivity(project.id),
  ]).then(([rule, knowledge, people, events]) => { if (!active) return; setInstructions(rule); setForm(Object.fromEntries(fields.map(([key]) => [key, rule[key] || '']))); setDocuments(knowledge.results || []); setMembers(people.results || []); setActivity(events || []) }).catch(() => { if (active) setError('Project details could not be loaded. Check your access.') }); return () => { active = false } }, [project.id])
  useEffect(() => { if (tab !== 'Connections' || project.role !== 'owner') return; let active = true; listProjects({ page: 1, page_size: 100 }).then(result => { if (active) setEnterpriseProjects(Array.isArray(result) ? result : result.results || []) }).catch(() => { if (active) setEnterpriseError('Enterprise project linking is unavailable for your account.') }); return () => { active = false } }, [tab, project.role])
  const run = async (operation, message) => { setBusy(true); setError(''); setNotice(''); try { await operation(); await refresh(); setNotice(message) } catch (err) { setError(err?.response?.data?.detail || 'The change could not be saved. Check your permissions and try again.') } finally { setBusy(false) } }
  const upload = event => { const file = event.target.files?.[0]; if (file) run(() => uploadAIKnowledge(project.id, file), 'Document processed. Check its status before using it in chat.'); event.target.value = '' }

  return <div className="mx-auto w-full max-w-4xl pb-10">
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs font-semibold uppercase text-[var(--rd-text-faint)]">Project · {project.role}</p><h1 className="mt-2 text-2xl font-semibold">{project.name}</h1><p className="mt-2 text-sm text-[var(--rd-text-muted)]">{project.description || 'Add instructions and reference files for this workspace.'}</p></div><button type="button" onClick={onStartChat} className="rd-btn rd-btn-primary"><ArrowRight size={16} />Open chat</button></div>
    <div role="tablist" aria-label="Project sections" className="mt-7 flex gap-1 overflow-x-auto border-b border-[var(--rd-border-soft)]">{tabs.map(name => <button role="tab" aria-selected={tab === name} key={name} type="button" onClick={() => { setTab(name); setError(''); setNotice('') }} className={`min-h-11 shrink-0 border-b-2 px-3 text-sm ${tab === name ? 'border-[var(--rd-primary)] font-medium text-[var(--rd-primary)]' : 'border-transparent text-[var(--rd-text-muted)]'}`}>{name}</button>)}</div>
    {error && <p className="mt-4 text-sm text-[var(--rd-danger)]" role="alert">{error}</p>}{notice && <p className="mt-4 text-sm" role="status">{notice}</p>}
    {!instructions ? <p className="mt-6 text-sm" role="status">Loading project…</p> : <section role="tabpanel" aria-label={`${tab} panel`} className="pt-6">
      {tab === 'Chat' && <div><p className="text-sm text-[var(--rd-text-muted)]">Your conversations are private unless you explicitly share one.</p><button type="button" onClick={onStartChat} className="rd-btn mt-4">Start a conversation</button></div>}
      {tab === 'Instructions' && <form className="max-w-2xl space-y-4" onSubmit={event => { event.preventDefault(); run(() => saveAIInstructions(project.id, { ...form, expected_version: instructions.version }), 'Instructions saved.') }}><p className="text-sm text-[var(--rd-text-muted)]">These preferences guide answers. Security and engineering approval rules still apply.</p>{fields.map(([key, label]) => <div key={key}><label htmlFor={`ai-${key}`} className="text-sm font-medium">{label}</label><textarea id={`ai-${key}`} value={form[key] || ''} maxLength={key === 'role_behavior' ? 6000 : 2000} disabled={!canEdit || busy} onChange={event => setForm(previous => ({ ...previous, [key]: event.target.value }))} rows={key === 'role_behavior' ? 4 : 2} className="rd-input mt-1 w-full resize-y" /></div>)}<button type="submit" className="rd-btn rd-btn-primary" disabled={!canEdit || busy}><Save size={16} />Save instructions</button>{!canEdit && <p className="text-xs text-[var(--rd-text-muted)]">Editors and owners can change instructions.</p>}</form>}
      {tab === 'Knowledge' && <div className="max-w-2xl space-y-5 text-sm"><p className="text-[var(--rd-text-muted)]">Files are private to this project. Uploading does not approve a company standard. Scanned PDFs without embedded text need review.</p>{canEdit && <div><label className="block font-medium" htmlFor="ai-project-file">Upload knowledge</label><input id="ai-project-file" type="file" accept=".pdf,.docx,.xlsx,.csv,.txt" onChange={upload} disabled={busy} className="mt-2 block w-full text-xs" /><p className="mt-1 text-xs text-[var(--rd-text-muted)]">PDF, DOCX, XLSX, CSV, TXT · 12 MB maximum</p></div>}{documents.length ? <ul className="divide-y divide-[var(--rd-border-soft)] border-y border-[var(--rd-border-soft)]">{documents.map(doc => <li key={doc.id} className="flex items-center gap-3 py-3"><FileText size={17} className="shrink-0" /><div className="min-w-0 flex-1"><p className="truncate font-medium">{doc.name}</p><p className="text-xs text-[var(--rd-text-muted)]">Version {doc.version} · {doc.status} · unverified</p></div><button type="button" className="rd-btn" onClick={() => getAIKnowledge(project.id, doc.id).then(setPreview).catch(() => setError('Preview unavailable.'))}>Preview</button>{canEdit && <button type="button" aria-label={`Unlink ${doc.name}`} onClick={() => run(() => archiveAIKnowledge(project.id, doc.id), 'Document unlinked.')} disabled={busy}><Trash2 size={16} /></button>}</li>)}</ul> : <p className="text-[var(--rd-text-muted)]">No knowledge uploaded yet.</p>}{preview && <div className="rounded-lg border border-[var(--rd-border-soft)] p-4"><div className="flex justify-between"><strong>{preview.name}</strong><button type="button" onClick={() => setPreview(null)} className="underline">Close</button></div>{preview.pages?.length ? preview.pages.map(page => <div key={page.location} className="mt-4"><p className="font-medium">{page.location}</p><p className="mt-1 whitespace-pre-wrap break-words">{page.text}</p></div>) : <p className="mt-3">No searchable text is available.</p>}</div>}</div>}
      {tab === 'Members' && <div className="max-w-2xl space-y-4 text-sm"><p className="text-[var(--rd-text-muted)]">Members can use this project’s knowledge. Their own conversations remain private.</p>{project.role === 'owner' && <form onSubmit={event => { event.preventDefault(); run(() => addAIMember(project.id, { email: memberEmail.trim(), role: memberRole }), 'Member added.'); setMemberEmail('') }} className="flex flex-wrap gap-2"><label className="sr-only" htmlFor="ai-member-id">Employee email</label><input id="ai-member-id" type="email" value={memberEmail} onChange={event => setMemberEmail(event.target.value)} placeholder="Employee email" className="rd-input min-w-0 flex-1" required /><label className="sr-only" htmlFor="ai-member-role">Role</label><select id="ai-member-role" value={memberRole} onChange={event => setMemberRole(event.target.value)} className="rd-input"><option value="viewer">Viewer</option><option value="editor">Editor</option></select><button type="submit" disabled={busy} className="rd-btn"><Plus size={16} />Add</button></form>}<ul className="divide-y divide-[var(--rd-border-soft)] border-y border-[var(--rd-border-soft)]">{members.map(member => <li key={member.user_id} className="flex items-center gap-3 py-3"><Users size={16} /><span className="min-w-0 flex-1 truncate">{member.email || `User ${member.user_id}`}</span><span className="text-[var(--rd-text-muted)]">{member.role}</span>{project.role === 'owner' && member.role !== 'owner' && <button type="button" onClick={() => run(() => removeAIMember(project.id, member.user_id), 'Member removed.')} aria-label={`Remove ${member.email || member.user_id}`} disabled={busy}><Trash2 size={16} /></button>}</li>)}</ul></div>}
      {tab === 'Activity' && <div className="max-w-2xl text-sm">{activity.length ? <ul className="divide-y divide-[var(--rd-border-soft)]">{activity.map((event, index) => <li key={index} className="py-2">{event.action} · {new Date(event.created_at).toLocaleString()}</li>)}</ul> : <p>No activity yet.</p>}</div>}
      {tab === 'Connections' && <div className="max-w-2xl space-y-5 text-sm"><p className="text-[var(--rd-text-muted)]">Microsoft 365 connections are unavailable until your organization authorizes tenant access. Enterprise project records are not shared with workspace members.</p><div><h2 className="font-medium">Optional enterprise project link</h2><p className="mt-1 text-[var(--rd-text-muted)]">This identifies an existing RADAI project. It does not import documents or grant members access to engineering records.</p>{project.role === 'owner' ? enterpriseError ? <p className="mt-3 text-[var(--rd-text-muted)]">{enterpriseError}</p> : <div className="mt-3 flex flex-wrap gap-2"><label className="sr-only" htmlFor="ai-enterprise-link">Enterprise project</label><select id="ai-enterprise-link" value={enterpriseId} onChange={event => setEnterpriseId(event.target.value)} className="rd-input min-w-0 flex-1"><option value="">No enterprise project</option>{enterpriseProjects.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select><button type="button" disabled={busy} onClick={() => run(async () => { await updateAIProject(project.id, { enterprise_project_id: enterpriseId || null }); await onProjectUpdated() }, 'Enterprise link updated.')} className="rd-btn">Save link</button></div> : <p className="mt-2 text-[var(--rd-text-muted)]">Only the owner can change this link.</p>}</div></div>}
    </section>}
  </div>
}

RadaiAIWorkspace.propTypes = { project: PropTypes.object.isRequired, onStartChat: PropTypes.func.isRequired, onProjectUpdated: PropTypes.func.isRequired }
