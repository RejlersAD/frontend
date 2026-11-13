import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { ArrowRight, Folder, Save } from 'lucide-react'
import { getProject } from '../services/projectControl.service'
import { getProjectActivity, getProjectInstructions, saveProjectInstructions } from '../services/radaiIntelligence.service'
import RadaiKnowledgePanel from './RadaiKnowledgePanel'
import RadaiEngineeringPanel from './RadaiEngineeringPanel'

const FIELDS = [
  ['instructions', 'Project AI instructions', 'How should the assistant work within this project?'],
  ['discipline_context', 'Discipline context', 'Relevant engineering disciplines and scope'],
  ['engineering_references', 'Engineering references', 'Applicable controlled standards and project requirements'],
  ['response_format', 'Response format', 'Preferred structure and level of detail'],
  ['terminology', 'Terminology', 'Project naming and terminology conventions'],
  ['evidence_expectations', 'Evidence and citations', 'How source evidence should be identified'],
  ['review_requirements', 'Review requirements', 'What must be checked by a person before action'],
]
const emptyInstructions = Object.fromEntries(FIELDS.map(([key]) => [key, '']))
const TABS = ['Overview', 'Instructions', 'Knowledge', 'Connections', 'Activity']

export default function RadaiProjectWorkspace({ projectId, onStartChat, initialTab = 'Overview' }) {
  const [tab, setTab] = useState(initialTab)
  const [project, setProject] = useState(null)
  const [record, setRecord] = useState(null)
  const [form, setForm] = useState(emptyInstructions)
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setNotice('')
    setTab(initialTab)
    Promise.all([getProject(projectId), getProjectInstructions(projectId), getProjectActivity(projectId)])
      .then(([projectData, instructionData, events]) => {
        if (!active) return
        setProject(projectData)
        setRecord(instructionData)
        setForm(Object.fromEntries(FIELDS.map(([key]) => [key, instructionData[key] || ''])))
        setActivity(Array.isArray(events) ? events : [])
      })
      .catch(() => { if (active) setError('This project workspace could not be loaded. Check your access and try again.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [projectId, initialTab])

  const save = async event => {
    event.preventDefault()
    if (!record?.can_edit || saving) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const updated = await saveProjectInstructions(projectId, { ...form, expected_version: record.version })
      setRecord(updated)
      setForm(Object.fromEntries(FIELDS.map(([key]) => [key, updated[key] || ''])))
      setActivity(await getProjectActivity(projectId))
      setNotice('Project instructions saved.')
    } catch (requestError) {
      setError(requestError?.response?.status === 409
        ? 'These instructions changed since you opened them. Reload the project before saving.'
        : 'Instructions could not be saved. Your edits are still here.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="mx-auto max-w-3xl py-12 text-sm text-[var(--rd-text-muted)]" role="status">Loading project workspace…</p>
  if (error && !project) return <p className="mx-auto max-w-3xl py-12 text-sm text-[var(--rd-danger)]" role="alert">{error}</p>

  return <div className="mx-auto w-full max-w-4xl pb-10">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--rd-text-faint)]">Project workspace · {project.code}</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">{project.name}</h1><p className="mt-2 text-sm text-[var(--rd-text-muted)]">{project.description || 'No project description has been recorded.'}</p></div>
      <button type="button" onClick={onStartChat} className="rd-btn rd-btn-primary"><ArrowRight size={16} aria-hidden="true" />Open conversation</button>
    </div>
    <div role="tablist" aria-label="Project workspace tabs" className="mt-7 flex gap-1 overflow-x-auto border-b border-[var(--rd-border-soft)]">
      {TABS.map(item => <button type="button" role="tab" aria-selected={tab === item} key={item} onClick={() => { setTab(item); setNotice(''); setError('') }} className={`min-h-11 shrink-0 border-b-2 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)] ${tab === item ? 'border-[var(--rd-primary)] font-medium text-[var(--rd-primary)]' : 'border-transparent text-[var(--rd-text-muted)] hover:text-[var(--rd-text)]'}`}>{item}</button>)}
    </div>
    <section role="tabpanel" aria-label={`${tab} panel`} className="pt-6">
      {tab === 'Overview' && <div className="grid gap-5 text-sm sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase text-[var(--rd-text-faint)]">Project context</p><dl className="mt-3 space-y-2"><div><dt className="inline text-[var(--rd-text-muted)]">Code: </dt><dd className="inline font-mono">{project.code}</dd></div><div><dt className="inline text-[var(--rd-text-muted)]">Status: </dt><dd className="inline">{project.status}</dd></div><div><dt className="inline text-[var(--rd-text-muted)]">Scope: </dt><dd className="inline">{project.scope_type || 'Not specified'}</dd></div></dl></div><div><p className="text-xs font-semibold uppercase text-[var(--rd-text-faint)]">Your access</p><p className="mt-3">{record.can_edit ? 'Read and edit project instructions' : 'Read project instructions'}</p><p className="mt-2 text-[var(--rd-text-muted)]">Engineering decisions and approved documents remain in their controlled RADAI workflows.</p></div></div>}
      {tab === 'Overview' && <RadaiEngineeringPanel projectId={projectId} />}
      {tab === 'Instructions' && <form onSubmit={save} className="max-w-2xl space-y-5"><p className="text-sm text-[var(--rd-text-muted)]">Project preferences guide assistant responses. They cannot override authorization, controlled standards, validation, or human approval.</p>{FIELDS.map(([key, label, placeholder]) => <div key={key}><label htmlFor={`project-ai-${key}`} className="block text-sm font-medium">{label}</label><textarea id={`project-ai-${key}`} value={form[key]} disabled={!record.can_edit || saving} onChange={event => setForm(previous => ({ ...previous, [key]: event.target.value }))} maxLength={key === 'instructions' ? 6000 : 2000} rows={key === 'instructions' ? 5 : 3} placeholder={placeholder} className="rd-input mt-2 w-full resize-y disabled:opacity-70" /></div>)}<div className="flex flex-wrap items-center gap-3"><button type="submit" disabled={!record.can_edit || saving} className="rd-btn rd-btn-primary"><Save size={16} aria-hidden="true" />{saving ? 'Saving…' : 'Save instructions'}</button><span className="text-xs text-[var(--rd-text-muted)]">Version {record.version}</span></div>{notice && <p role="status" className="text-sm text-[var(--rd-success)]">{notice}</p>}{error && <p role="alert" className="text-sm text-[var(--rd-danger)]">{error}</p>}</form>}
      {tab === 'Activity' && <div className="max-w-2xl"><h2 className="text-base font-semibold">Instruction activity</h2>{activity.length ? <ol className="mt-4 divide-y divide-[var(--rd-border-soft)]">{activity.map(event => <li key={event.id} className="py-3 text-sm"><span className="font-medium">Version {event.version}</span> · {event.action} by {event.actor}<time className="mt-1 block text-xs text-[var(--rd-text-muted)]">{new Date(event.timestamp).toLocaleString()}</time></li>)}</ol> : <p className="mt-3 text-sm text-[var(--rd-text-muted)]">No instruction changes have been recorded.</p>}</div>}
      {tab === 'Knowledge' && <RadaiKnowledgePanel projectId={projectId} />}
      {tab === 'Connections' && <div className="max-w-xl py-10 text-center"><Folder size={24} className="mx-auto text-[var(--rd-text-faint)]" aria-hidden="true" /><h2 className="mt-4 text-base font-semibold">Connections are not available yet</h2><p className="mt-2 text-sm text-[var(--rd-text-muted)]">Microsoft 365 needs approved tenant authorization before it can connect.</p></div>}
    </section>
    {record.can_edit && <p className="mt-8 border-t border-[var(--rd-border-soft)] pt-4 text-xs text-[var(--rd-text-muted)]">Project creation and core metadata remain in <Link to="/projects" className="font-medium text-[var(--rd-primary)] underline-offset-2 hover:underline">Project Control</Link>.</p>}
  </div>
}

RadaiProjectWorkspace.propTypes = { projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, onStartChat: PropTypes.func.isRequired, initialTab: PropTypes.string }
