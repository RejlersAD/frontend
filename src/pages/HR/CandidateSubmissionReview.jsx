import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { talentAcquisitionService as service } from '../../services/talentAcquisition.service'
import CandidateFormView from './CandidateFormView'
import './CandidateOnlineForm.css'
import './CandidateFormsWorkspace.css'

const titles = { cv: 'Candidate CV Submission Form', pre_onboarding: 'Pre-Onboarding Employee Form' }
const message = error => error?.response?.data?.detail || error?.message || 'The form could not be loaded.'

export default function CandidateSubmissionReview({ candidateId }) {
  const [invitations, setInvitations] = useState([])
  const [review, setReview] = useState(null)
  const [version, setVersion] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    let active = true
    service.invitations(candidateId).then(rows => { if (active) setInvitations(rows.filter(row => row.versions.length)) }).catch(failure => { if (active) setError(message(failure)) }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [candidateId])
  const run = async action => {
    setBusy(true); setError(''); setNotice('')
    try { await action() } catch (failure) { setError(message(failure)) }
    finally { setBusy(false) }
  }
  const open = item => run(async () => {
    const result = await service.formReview(item.id)
    setReview(result); setVersion(String(result.submissions[0]?.version || '')); setNote('')
  })
  const submission = review?.submissions.find(item => String(item.version) === version)
  const reviewAction = action => run(async () => {
    await service.reviewForm(review.id, { action, version: Number(version), ...(action === 'correction' ? { note } : {}) })
    setReview(await service.formReview(review.id))
    setNotice(action === 'verify' ? 'Submission verified.' : 'Correction requested.')
  })
  return <div className="ta-online-forms">
    {!review && <div className="tof-invitations">{invitations.map(item => <article key={item.id}><div><strong>{titles[item.kind]}</strong><p>{item.position} · {item.state.replaceAll('_', ' ')}</p></div><button className="ta-button" disabled={busy} onClick={() => open(item)}>View submission</button></article>)}{!invitations.length && <p>{busy ? 'Loading submissions…' : 'No submitted forms for this candidate yet.'}</p>}</div>}
    {review && <section className="tof-review"><h3>{titles[review.kind]}</h3><div className="tof-review-controls"><label>Submission version<select aria-label="Submission version" value={version} onChange={event => setVersion(event.target.value)}>{review.submissions.map(item => <option key={item.id} value={item.version}>Version {item.version} · {new Date(item.created_at).toLocaleString()}</option>)}</select></label><button className="ta-button" disabled={busy} onClick={() => run(async () => { const blob = await service.exportForm(review.id, Number(version)); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `RAD-${review.kind}-v${version}.docx`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) })}>Download Word</button></div>{submission?.attachments?.length > 0 && <div className="tof-review-controls">{submission.attachments.map(file => <button className="ta-button" key={file.id} disabled={busy} onClick={() => run(async () => { const blob = await service.formAttachment(review.id, file.id); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = file.name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) })}>Download {file.kind === 'photo' ? 'professional photo' : file.name}</button>)}</div>}{submission && <CandidateFormView schema={review.schema} data={submission.data} />}<label>Correction note<textarea maxLength={4000} value={note} onChange={event => setNote(event.target.value)} /></label><div className="tof-review-actions"><button className="ta-button" disabled={busy || !note.trim() || Number(version) !== review.submissions[0]?.version || !['submitted', 'verified'].includes(review.state)} onClick={() => reviewAction('correction')}>Request correction</button><button className="ta-button ta-primary" disabled={busy || Number(version) !== review.submissions[0]?.version || review.state !== 'submitted'} onClick={() => reviewAction('verify')}>Verify submission</button><button className="ta-button" onClick={() => setReview(null)}>Back to forms</button></div></section>}
    {error && <p role="alert" className="ta-error">{error}</p>}{notice && <p role="status" className="tof-notice">{notice}</p>}
  </div>
}
CandidateSubmissionReview.propTypes = { candidateId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired }
