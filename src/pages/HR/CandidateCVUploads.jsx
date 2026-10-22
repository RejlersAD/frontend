import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { candidateFormRequest as request } from '../../services/candidateFormsPublic.service'

export default function CandidateCVUploads({ session, attachments, onUpload, onExtract, disabled, preview, readonly }) {
  const [photoUrl, setPhotoUrl] = useState('')
  const [localName, setLocalName] = useState('')
  const [error, setError] = useState('')
  const photo = attachments.find(file => file.kind === 'photo')
  const cv = attachments.find(file => file.kind === 'cv')
  useEffect(() => {
    if (!photo?.id || !session) return
    let active = true, objectUrl
    request(`uploads/${photo.id}`, null, session, true).then(blob => {
      if (active) { objectUrl = URL.createObjectURL(blob); setPhotoUrl(objectUrl) }
    }).catch(() => { if (active) setError('Your saved photo could not be displayed. Please retry opening the form.') })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [photo?.id, session])
  useEffect(() => () => { if (photoUrl.startsWith('blob:')) URL.revokeObjectURL(photoUrl) }, [photoUrl])
  const choose = async (event, kind) => {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) return
    setError('')
    const max = (kind === 'photo' ? 5 : 8) * 1024 * 1024
    if (file.size > max) { setError(`Choose a file under ${kind === 'photo' ? 5 : 8} MB.`); return }
    if (preview) {
      if (kind === 'photo' && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) setPhotoUrl(URL.createObjectURL(file))
      setLocalName(file.name)
      return
    }
    try { await onUpload(file, kind) } catch (failure) { setError(failure.message) }
  }
  return <section className="cf-cv-uploads" aria-label="CV uploads">
    <div className="cf-photo-upload">{photoUrl ? <img src={photoUrl} alt="Your professional photo" /> : <div className="cf-photo-empty" aria-hidden="true">◎</div>}<div><label className="cf-upload-label">Upload Professional Photo *{!readonly && <input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={event => choose(event, 'photo')} />}</label><p>JPG, PNG or WebP · Up to 5 MB</p>{photo && <span className="cf-upload-success">Photo saved</span>}</div></div>
    <div className="cf-cv-upload"><label className="cf-upload-label">Upload CV{!readonly && <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={disabled} onChange={event => choose(event, 'cv')} />}</label><p>PDF or Word · Up to 8 MB</p><p>Auto-fill reads Word and PDF files locally, using OCR for scanned pages. Review and correct every section before submitting.</p>{cv && <span className="cf-upload-success">{cv.name}{cv.extracted ? ' · Extracted' : ' · Uploaded'}</span>}{cv && !readonly && !preview && <button className="cf-text-button" disabled={disabled} onClick={async () => { setError(''); try { await onExtract(cv.id) } catch (failure) { setError(failure.message) } }}>Retry auto-fill</button>}{preview && <small>{localName ? `${localName} selected. ` : ''}Open an invitation to save uploads and use CV auto-fill.</small>}</div>
    {error && <p role="alert" className="cf-error">{error}</p>}
  </section>
}
CandidateCVUploads.propTypes = { session: PropTypes.string.isRequired, attachments: PropTypes.array.isRequired, onUpload: PropTypes.func.isRequired, onExtract: PropTypes.func.isRequired, disabled: PropTypes.bool, preview: PropTypes.bool, readonly: PropTypes.bool }
