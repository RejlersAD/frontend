import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import apiClient from '../../services/api.service'

// Approvals > AI project invitation: the full project, the access the role brings, accept or decline.
const when = value => (value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not recorded')

function Row({ label, children }) {
  return <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 py-1.5 text-sm">
    <dt className="text-slate-500">{label}</dt><dd className="min-w-0 break-words text-slate-900">{children}</dd>
  </div>
}
Row.propTypes = { label: PropTypes.string.isRequired, children: PropTypes.node }

export default function ProjectInvitationReview({ item, initialAction, onClose, onDecision }) {
  const [action, setAction] = useState(['approve', 'reject'].includes(initialAction) ? initialAction : null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const project = item.project || {}
  const canAccept = item.rbac_access === true

  useEffect(() => {
    const escape = event => { if (event.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [busy, onClose])

  const decide = async decision => {
    if (busy) return
    setBusy(true); setError('')
    try {
      await apiClient.post(`/ai-workspaces/invitations/${item.id}/${decision}/`, decision === 'decline' ? { reason: reason.trim() } : {}, { suppressErrorToast: true })
      onDecision?.(item)
      onClose()
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || `The invitation could not be ${decision === 'accept' ? 'accepted' : 'declined'}. Please retry.`)
      setBusy(false)
    }
  }

  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose() }}>
    <div role="dialog" aria-modal="true" aria-labelledby="ai-invite-title" className="flex max-h-[calc(100dvh-32px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header className="flex flex-shrink-0 items-start justify-between gap-4 px-6 py-5 text-white" style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/80">AI project invitation · {item.reference}</p>
          <h2 id="ai-invite-title" className="mt-0.5 truncate text-xl font-bold">{project.name}</h2>
          <p className="mt-1 text-sm text-white/85">{item.requester_name} invited you as <strong className="capitalize">{item.role}</strong> · {when(item.created_at)}</p>
        </div>
        <button type="button" aria-label="Close invitation" disabled={busy} onClick={onClose} className="rounded-lg p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"><XMarkIcon className="h-6 w-6" /></button>
      </header>

      <div className="space-y-5 overflow-y-auto p-6">
        {!canAccept && <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">
          <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />Your RBAC roles don&apos;t include RADAI Intelligence yet, so you can&apos;t accept. Ask an administrator to grant it in Roles &amp; Access. You can still decline.
        </p>}

        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Project</h3>
          <dl className="divide-y divide-slate-100">
            <Row label="Description">{project.description || <span className="italic text-slate-400">No description</span>}</Row>
            <Row label="Owner">{project.owner_name} <span className="text-slate-500">({project.owner_email})</span></Row>
            {project.folder && <Row label="Folder">{project.folder}</Row>}
            {project.enterprise_project && <Row label="Linked project">{project.enterprise_project}</Row>}
            <Row label="Visibility"><span className="capitalize">{project.visibility}</span> · {project.members} member{project.members === 1 ? '' : 's'}</Row>
            <Row label="Created">{when(project.created_at)} · updated {when(project.updated_at)}</Row>
          </dl>
        </section>

        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">What RADAI uses in this project</h3>
          <dl className="divide-y divide-slate-100">
            <Row label="Instructions">{project.instruction_sections?.length ? project.instruction_sections.join(', ') : <span className="italic text-slate-400">None yet</span>}</Row>
            {project.role_behavior && <Row label="AI role">{project.role_behavior}</Row>}
            {project.goals && <Row label="Goals">{project.goals}</Row>}
            <Row label="Knowledge files">{project.documents ? <>{project.documents} file{project.documents === 1 ? '' : 's'}{project.document_names?.length > 0 && <span className="block text-slate-500">{project.document_names.join(' · ')}{project.documents > project.document_names.length ? ' …' : ''}</span>}</> : <span className="italic text-slate-400">None yet</span>}</Row>
            {project.chat_models?.length > 0 && <Row label="AI models">{project.chat_models.join(', ')}</Row>}
          </dl>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Your access as {item.role}</h3>
          <ul className="space-y-1 text-sm text-slate-800">{(item.access || []).map(line => <li key={line} className="flex gap-2"><CheckCircleIcon className="h-4 w-4 flex-shrink-0 text-emerald-600" />{line}</li>)}</ul>
          <p className="mt-2 text-xs text-slate-500">Access is controlled by RBAC: it applies while your roles include RADAI Intelligence and you stay a member.</p>
        </section>

        {action === 'reject' && <label className="block text-sm font-semibold text-slate-700">Reason for declining (optional)
          <textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={500} rows={3} disabled={busy}
            className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm font-normal" placeholder="The owner sees this reason." />
        </label>}
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </div>

      <footer className="flex flex-shrink-0 flex-wrap items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
        <button type="button" onClick={onClose} disabled={busy} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50">Close</button>
        {action === 'reject' ? <>
          <button type="button" onClick={() => setAction(null)} disabled={busy} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-50">Back</button>
          <button type="button" onClick={() => decide('decline')} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{busy ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <XCircleIcon className="h-4 w-4" />}Decline invitation</button>
        </> : <>
          <button type="button" onClick={() => setAction('reject')} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><XCircleIcon className="h-4 w-4" />Decline</button>
          <button type="button" onClick={() => decide('accept')} disabled={busy || !canAccept} title={canAccept ? undefined : 'Needs RADAI Intelligence access in RBAC'} className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50">{busy ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <CheckCircleIcon className="h-4 w-4" />}Accept and join</button>
        </>}
      </footer>
    </div>
  </div>
}

ProjectInvitationReview.propTypes = {
  item: PropTypes.object.isRequired, initialAction: PropTypes.string, onClose: PropTypes.func.isRequired, onDecision: PropTypes.func,
}
