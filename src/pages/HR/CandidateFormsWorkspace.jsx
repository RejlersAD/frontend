import { useState } from 'react'
import { talentAcquisitionService as service } from '../../services/talentAcquisition.service'
import './CandidateFormsWorkspace.css'

const forms = [
  { value: 'cv', label: 'Candidate CV Submission Form' },
  { value: 'pre_onboarding', label: 'Pre-Onboarding Employee Form' },
]

export default function CandidateFormsWorkspace() {
  const [kind, setKind] = useState('cv')
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')
  const create = async () => {
    setBusy(true); setError(''); setCopied(false)
    try {
      const result = await service.createPublicLink({ kind, opening: null })
      setLink(result.link)
      setExpiresAt(result.expires_at || '')
    } catch (failure) { setError(failure?.response?.data?.detail || 'The invitation link could not be created. Please retry.') }
    finally { setBusy(false) }
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setError('') }
    catch { setError('Select the link and copy it manually.') }
  }
  return <div className="ta-invitation-link-dialog">
    <p>Links for both forms expire after 3 days.{expiresAt && <> Expires: {new Date(expiresAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}.</>}</p>
    <fieldset><legend>Choose form</legend>{forms.map(form => <label key={form.value} className={kind === form.value ? 'is-selected' : ''}><input type="radio" name="invitation-form" value={form.value} checked={kind === form.value} disabled={busy} onChange={() => { setKind(form.value); setLink(''); setExpiresAt(''); setCopied(false); setError('') }} /><span>{form.label}</span></label>)}</fieldset>
    {!link ? <button className="ta-button ta-primary ta-create-link" disabled={busy} onClick={create}>{busy ? 'Creating…' : 'Create link'}</button> : <div className="ta-created-invitation"><label>Invitation link<input readOnly value={link} onFocus={event => event.target.select()} /></label><button className="ta-button ta-primary" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>{copied && <p role="status">Link copied.</p>}</div>}
    {error && <p className="ta-error" role="alert">{error}</p>}
  </div>
}
