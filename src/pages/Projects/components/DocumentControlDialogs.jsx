/* eslint-disable react/prop-types */
import React, { useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle, FileText, Info, Lock, X } from 'lucide-react'
import * as PC from '../../../services/projectControl.service'
import { DOCUMENT_KIND_OPTIONS } from '../../../config/projectControl.config'

const titleCase = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
const readableDate = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not recorded'
const fileSize = value => {
  const size = Number(value)
  if (value === null || value === undefined || !Number.isFinite(size) || size < 0) return 'Not recorded'
  if (!size) return '0 B'
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), 3)
  return `${(size / 1024 ** index).toLocaleString('en-GB', { maximumFractionDigits: 1 })} ${['B', 'KB', 'MB', 'GB'][index]}`
}
const errorMessage = error => {
  const data = error?.response?.data
  if (typeof data === 'string') return data
  if (typeof data?.detail === 'string') return data.detail
  if (typeof data?.error === 'string') return data.error
  if (data && typeof data === 'object') return Object.entries(data).map(([key, value]) => `${titleCase(key)}: ${Array.isArray(value) ? value.join(' ') : typeof value === 'object' ? JSON.stringify(value) : String(value)}`).join(' ')
  return error?.message || 'The document could not be saved. Try again.'
}
const documentName = document => document?.title || document?.filename || document?.originalFilename || document?.raw?.original_filename || 'Untitled document'
const filename = document => document?.filename || document?.originalFilename || document?.raw?.original_filename || 'Not recorded'
const kindName = document => document?.kindLabel || document?.kindDisplay || document?.raw?.kind_display || DOCUMENT_KIND_OPTIONS.find(item => item.value === document?.kind)?.label || titleCase(document?.kind) || 'Not recorded'

function DocumentModal({ title, children, footer, busy = false, onClose }) {
  const id = useId(), ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current, opener = document.activeElement
    dialog.showModal()
    return () => { dialog.close(); if (opener?.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true }) }
  }, [])
  return <dialog ref={ref} className="dc-dialog" aria-labelledby={id} onCancel={event => { event.preventDefault(); if (!busy) onClose() }} onClick={event => { if (!busy && event.target === event.currentTarget) onClose() }}>
    <div className="dc-dialog-header"><h2 id={id}>{title}</h2><button type="button" className="pp-button pp-icon-button" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={18} aria-hidden="true" /></button></div>
    <div className="dc-dialog-body">{children}</div>{footer && <div className="dc-dialog-footer">{footer}</div>}
  </dialog>
}
const CloseButton = ({ onClose, busy = false, label = 'Cancel' }) => <button type="button" className="pp-button" disabled={busy} onClick={onClose}>{label}</button>
const ErrorMessage = ({ error }) => error ? <p className="dc-form-error dc-form-wide" role="alert"><AlertTriangle size={15} aria-hidden="true" />{error}</p> : null
function Facts({ rows }) { return <dl className="dc-detail-grid">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? 'Not recorded'}</dd></div>)}</dl> }
function ReadOnly({ title, children, onClose }) { return <DocumentModal title={title} onClose={onClose} footer={<CloseButton label="Close" onClose={onClose} />}><p className="dc-note"><Lock size={15} aria-hidden="true" />{children}</p></DocumentModal> }

function DocumentEditor({ type, document, project, model, onClose, onSaved }) {
  const isNew = type === 'create', formId = useId()
  const [title, setTitle] = useState(isNew ? '' : document?.title || ''), [kind, setKind] = useState(isNew ? 'other' : document?.kind || 'other'), [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const allowed = isNew ? model.canUpload === true : document?.canEdit === true
  const kinds = model.kinds?.length ? model.kinds : DOCUMENT_KIND_OPTIONS
  const dialogTitle = isNew ? 'New document' : 'Edit document'
  const submit = async event => {
    event.preventDefault()
    if (busy || !allowed || (isNew && !file)) return
    if (isNew && model.maxDocumentBytes > 0 && file.size > model.maxDocumentBytes) { setError(`The file exceeds the ${fileSize(model.maxDocumentBytes)} upload limit.`); return }
    setBusy(true); setError('')
    try {
      const payload = { kind, title: title.trim() || (isNew ? file.name : '') }
      onSaved(isNew ? await PC.uploadDocument(project.id, file, payload) : await PC.updateDocument(document.id, payload))
    } catch (failure) { setError(errorMessage(failure)); setBusy(false) }
  }
  if (!allowed) return <ReadOnly title={dialogTitle} onClose={onClose}>{isNew ? 'Document upload is unavailable for this project.' : document ? 'You do not have access to edit this document.' : 'Select a document to edit its title and type.'}</ReadOnly>
  return <DocumentModal title={dialogTitle} busy={busy} onClose={onClose} footer={<><CloseButton onClose={onClose} busy={busy} /><button type="submit" form={formId} className="pp-button pp-primary" disabled={busy || (isNew && !file)}>{busy ? isNew ? 'Uploading…' : 'Saving…' : isNew ? 'Upload document' : 'Save document'}</button></>}>
    <form id={formId} className="dc-form-grid" onSubmit={submit}><ErrorMessage error={error} />
      {isNew && <label className="dc-form-wide">Document file<input autoFocus type="file" required onChange={event => setFile(event.target.files?.[0] || null)} /></label>}
      <label className="dc-form-wide">Document title<input autoFocus={!isNew} maxLength={255} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label>Document type<select value={kind} onChange={event => setKind(event.target.value)}>{kinds.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <p className="dc-form-hint dc-form-wide">{isNew ? 'Upload a file to this project. If the title is blank, its filename is used.' : 'Changes update the document title and type. The uploaded file is retained.'}</p>
      {isNew && file && <p className="dc-note dc-form-wide"><FileText size={15} aria-hidden="true" />{file.name} · {fileSize(file.size)}</p>}
      {isNew && model.maxDocumentBytes > 0 && <p className="dc-form-hint dc-form-wide">Maximum file size: {fileSize(model.maxDocumentBytes)}.</p>}
    </form>
    {!isNew && <Facts rows={[[ 'Filename', filename(document)], ['Uploaded by', document.uploadedBy || document.raw?.uploaded_by_name || 'Not recorded'], ['Uploaded', readableDate(document.createdAt || document.raw?.created_at)], ['File size', fileSize(document.sizeBytes ?? document.raw?.size_bytes)]]} />}
  </DocumentModal>
}

function DeleteDocument({ document, model, onClose, onSaved }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const allowed = document?.canDelete === true && model.availability?.list !== false
  const remove = async () => {
    if (busy || !allowed) return
    setBusy(true); setError('')
    try { await PC.deleteDocument(document.id); onSaved({ deletedDocumentId: document.id }) } catch (failure) { setError(errorMessage(failure)); setBusy(false) }
  }
  if (!allowed) return <ReadOnly title="Delete document" onClose={onClose}>{document ? 'You do not have access to delete this document.' : 'Select a document to delete.'}</ReadOnly>
  return <DocumentModal title="Delete document" busy={busy} onClose={onClose} footer={<><CloseButton onClose={onClose} busy={busy} /><button type="button" className="pp-button pp-primary" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Confirm deletion'}</button></>}>
    <ErrorMessage error={error} /><p>Remove <strong>{documentName(document)}</strong> from the active document register? Existing estimate and change records retain their source reference. This action cannot be undone here.</p>
    <Facts rows={[[ 'Filename', filename(document)], ['Document type', kindName(document)], ['Uploaded', readableDate(document.createdAt || document.raw?.created_at)], ['Uploaded by', document.uploadedBy || document.raw?.uploaded_by_name || 'Not recorded']]} />
  </DocumentModal>
}

function DocumentQuality({ model, onClose }) {
  const documents = model.rows || []
  const fallback = [
    { label: 'Uploaded documents', status: `${documents.length} recorded`, detail: 'The register contains files uploaded to this project.' },
    { label: 'Document titles', status: `${documents.filter(document => document.title?.trim()).length}/${documents.length} recorded`, detail: 'Titles make project documents easier to identify.' },
    { label: 'Document types', status: `${documents.filter(document => document.kind && document.kind !== 'other').length}/${documents.length} classified`, detail: 'Review files classified as Other.' },
    { label: 'Revisions and approvals', status: 'Not tracked', detail: 'Revision numbers, approvals and review assignments are not recorded by this document register.' },
  ]
  const checks = model.quality?.length ? model.quality : fallback
  return <DocumentModal title="Document quality" onClose={onClose} footer={<CloseButton label="Close" onClose={onClose} />}><p>Quality checks describe the recorded document metadata. Review assignments and approval decisions are not tracked.</p><div className="dc-table-wrap" role="region" aria-label="Document quality checks" tabIndex={0}><table className="dc-table"><thead><tr><th>Check</th><th>Status</th><th>Details</th></tr></thead><tbody>{checks.map((check, index) => <tr key={check.id || check.label || check.title || index}><td>{check.label || check.title}</td><td>{check.status || check.text || (check.ready ? 'Recorded' : 'Review required')}</td><td>{check.detail || check.description || 'Review the recorded project documents.'}</td></tr>)}</tbody></table></div></DocumentModal>
}

function RevisionHistory({ document, onClose }) {
  return <DocumentModal title="Revision history" onClose={onClose} footer={<CloseButton label="Close" onClose={onClose} />}><p>Revision numbers and superseded files are not tracked. The timestamps below describe this document record.</p>{document ? <><p><strong>{documentName(document)}</strong></p><Facts rows={[[ 'Filename', filename(document)], ['Document type', kindName(document)], ['Uploaded', readableDate(document.createdAt || document.raw?.created_at)], ['Last record update', readableDate(document.updatedAt || document.raw?.updated_at)], ['Uploaded by', document.uploadedBy || document.raw?.uploaded_by_name || 'Not recorded'], ['Revision', 'Not tracked']]} /></> : <p className="dc-note">Select a document to view its recorded timestamps.</p>}</DocumentModal>
}

function DocumentActions({ model, onClose }) {
  const actions = model.actions || model.exceptions || []
  return <DocumentModal title="Document actions" onClose={onClose} footer={<CloseButton label="Close" onClose={onClose} />}><p>Actions identify missing or incomplete document metadata. They are not assigned review tasks.</p>{actions.length ? <div className="dc-table-wrap" role="region" aria-label="Document metadata actions" tabIndex={0}><table className="dc-table"><thead><tr><th>Priority</th><th>Action</th><th>Details</th></tr></thead><tbody>{actions.map((action, index) => <tr key={action.id || index}><td>{titleCase(action.priority) || 'Review'}</td><td>{action.title || action.label}</td><td>{action.detail || action.description || 'Review the relevant document metadata.'}</td></tr>)}</tbody></table></div> : <p className="dc-note"><Info size={15} aria-hidden="true" />No metadata actions are recorded for the current documents.</p>}</DocumentModal>
}

function WorkflowInformation({ type, document, model, onClose }) {
  const count = (model.rows || []).length
  const content = {
    reviews: { title: 'Document reviews', intro: 'Review assignments, due dates, comments and approval decisions are not recorded in this document register.', rows: [[ 'Selected document', document ? documentName(document) : 'None selected'], ['Review assignments', 'Not tracked'], ['Review due dates', 'Not tracked'], ['Approval decisions', 'Not tracked']] },
    transmittals: { title: 'Transmittals', intro: 'Transmittal numbers, recipients and issue dates are not recorded. An uploaded file does not establish that it has been issued to a recipient.', rows: [[ 'Uploaded documents', count], ['Transmittal register', 'Not connected'], ['Recipients', 'Not tracked'], ['Issue acknowledgements', 'Not tracked']] },
    deliverables: { title: 'Deliverable plan', intro: 'Planned deliverables and baseline issue dates are not recorded. Document upload dates show when files were added to RADAI.', rows: [[ 'Uploaded documents', count], ['Planned deliverables', 'Not recorded'], ['Planned issue dates', 'Not recorded'], ['Deliverable progress', 'Not assessed']] },
  }[type]
  return <DocumentModal title={content.title} onClose={onClose} footer={<CloseButton label="Close" onClose={onClose} />}><p>{content.intro}</p><Facts rows={content.rows} /></DocumentModal>
}

export default function DocumentControlDialogs({ dialog, onClose, onSaved, project, model }) {
  if (!dialog) return null
  const selected = dialog.document || model.selected, props = { document: selected, model, project, onClose, onSaved }, key = `${dialog.type}:${selected?.id || 'new'}`
  if (dialog.type === 'create' || dialog.type === 'edit') return <DocumentEditor key={key} type={dialog.type} {...props} />
  if (dialog.type === 'delete') return <DeleteDocument key={key} {...props} />
  if (dialog.type === 'quality') return <DocumentQuality key={key} {...props} />
  if (dialog.type === 'history') return <RevisionHistory key={key} {...props} />
  if (dialog.type === 'actions') return <DocumentActions key={key} {...props} />
  if (['reviews', 'transmittals', 'deliverables'].includes(dialog.type)) return <WorkflowInformation key={key} type={dialog.type} {...props} />
  return null
}
