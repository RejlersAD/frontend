/* eslint-disable react/prop-types */
import React, { useEffect, useId, useRef, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'
import { downloadProjectDocument } from '../../../services/projectControl.service'

export const documentPreviewKind = row => {
  const type = String(row?.contentType || '').split(';')[0].toLowerCase()
  if (type === 'application/pdf') return 'pdf'
  if (['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'].includes(type)) return 'image'
  if (['text/plain', 'text/csv', 'application/json'].includes(type)) return 'text'
  return null
}
export async function documentFileError(error) {
  let data = error?.response?.data
  if (data instanceof Blob) { try { data = JSON.parse(await data.text()) } catch { data = null } }
  return (typeof data?.detail === 'string' ? data.detail : typeof data?.error === 'string' ? data.error : null) || 'The file could not be loaded. Check your access and try again.'
}
export function saveDocumentBlob(blob, row) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a')
  anchor.href = url; anchor.download = row.filename || row.title || 'document'
  document.body.appendChild(anchor); anchor.click(); anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export default function DocumentPreviewDialog({ document: row, onClose }) {
  const titleId = useId(), ref = useRef(null), [retry, setRetry] = useState(0)
  const [state, setState] = useState({ loading: true, blob: null, url: null, text: '', error: '' })
  const kind = documentPreviewKind(row)
  useEffect(() => {
    const dialog = ref.current, opener = document.activeElement
    dialog.showModal()
    return () => { dialog.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  useEffect(() => {
    const controller = new AbortController(); let url = null
    setState({ loading: true, blob: null, url: null, text: '', error: '' })
    downloadProjectDocument(row.id, { signal: controller.signal }).then(async blob => {
      if (controller.signal.aborted) return
      const text = kind === 'text' ? await blob.slice(0, 200000).text() : ''
      if (controller.signal.aborted) return
      if (kind === 'image' || kind === 'pdf') url = URL.createObjectURL(new Blob([blob], { type: row.contentType.split(';')[0] }))
      setState({ loading: false, blob, url, text, error: '' })
    }).catch(async error => { const message = await documentFileError(error); if (!controller.signal.aborted) setState({ loading: false, blob: null, url: null, text: '', error: message }) })
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url) }
  }, [row.id, row.contentType, kind, retry])
  return <dialog ref={ref} className="dc-dialog dc-preview-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="dc-dialog-header"><h2 id={titleId}>Document preview</h2><button type="button" className="pp-button pp-icon-button" aria-label="Close preview" onClick={onClose}><X size={18} aria-hidden="true" /></button></div>
    <div className="dc-dialog-body"><h3 className="dc-preview-name">{row.filename || row.title}</h3>
      {state.loading ? <p role="status">Loading document…</p> : state.error ? <div role="alert"><p>{state.error}</p><button type="button" className="pp-button" onClick={() => setRetry(value => value + 1)}><RefreshCw size={14} aria-hidden="true" />Retry preview</button></div> : <>
        {kind === 'text' ? <><pre className="dc-text-preview" tabIndex={0} role="region" aria-label="Document text preview">{state.text}</pre>{state.blob.size > 200000 && <p className="dc-note">Preview shows the first 200 KB. Download the file to read the complete document.</p>}</> : kind === 'image' ? <img className="dc-image-preview" src={state.url} alt={row.title || row.filename} /> : kind === 'pdf' ? <iframe className="dc-pdf-preview" title={`PDF preview: ${row.filename || row.title}`} src={state.url} /> : <p>Preview is unavailable for this file type. Download it to open in a compatible application.</p>}
      </>}
    </div><div className="dc-dialog-footer"><button type="button" className="pp-button" onClick={onClose}>Close</button><button type="button" className="pp-button pp-primary" disabled={!state.blob || state.loading} onClick={() => saveDocumentBlob(state.blob, row)}><Download size={14} aria-hidden="true" />Download file</button></div>
  </dialog>
}
