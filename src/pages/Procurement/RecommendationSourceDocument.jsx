import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { Download, ExternalLink, RefreshCw } from 'lucide-react'
import apiClient from '../../services/api.service'
import { getOriginalRecommendationDocuments, getOriginalRecommendationUrl } from './recommendationSourceDocuments'
import './RecommendationSourceDocument.css'

export default function RecommendationSourceDocument({ requisitionId, attachments, loading, error, embedded = false }) {
  const [selectedKey, setSelectedKey] = useState('')
  const [retry, setRetry] = useState(0)
  const [content, setContent] = useState({ key: '', url: '', loading: false, error: '' })
  const documents = getOriginalRecommendationDocuments(attachments)
    .map((item, index) => ({
      key: `${item.sha256 || item.id || item.filename || 'source'}-${index}`,
      filename: typeof item.filename === 'string' && item.filename.trim() ? item.filename : 'Uploaded PR.pdf',
      url: getOriginalRecommendationUrl(item),
      contentPath: typeof item.content_url === 'string' ? item.content_url.replace(/^\/api\/v1(?=\/)/, '') : '',
    }))
  const selected = documents.find(item => item.key === selectedKey) || documents[0]
  const candidatePath = selected?.contentPath || ''
  const contentPrefix = `/procurement/requisitions/${requisitionId}/uploaded-documents/`
  const contentPath = requisitionId && candidatePath.startsWith(contentPrefix)
    && /^\d+\/content\/$/.test(candidatePath.slice(contentPrefix.length)) ? candidatePath : ''
  const source = contentPath || selected?.url || ''
  const contentKey = `${requisitionId || ''}:${selected?.key || ''}:${source}`
  const current = content.key === contentKey ? content : { url: '', loading: Boolean(source), error: '' }

  useEffect(() => {
    if (!embedded || !source) return undefined
    const controller = new AbortController()
    let objectUrl
    setContent({ key: contentKey, url: '', loading: true, error: '' })
    const load = async () => {
      try {
        let blob
        if (contentPath) {
          const response = await apiClient.get(contentPath, {
            signal: controller.signal, responseType: 'blob', timeout: 60000, suppressErrorToast: true,
          })
          blob = response.data instanceof Blob ? response.data : new Blob([response.data])
        } else {
          // Legacy media links may forbid framing. Fetch the bytes without
          // sending API credentials to a storage host, then preview locally.
          const response = await fetch(source, { signal: controller.signal, credentials: 'same-origin' })
          if (!response.ok) throw Object.assign(new Error('Source unavailable'), { status: response.status })
          blob = await response.blob()
        }
        if (!(await blob.slice(0, 1024).text()).trimStart().startsWith('%PDF-')) throw new Error('Invalid PDF')
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
        setContent({ key: contentKey, url: objectUrl, loading: false, error: '' })
      } catch (loadError) {
        if (controller.signal.aborted) return
        const status = loadError.response?.status || loadError.status
        const message = status === 404 ? 'The original PR PDF is no longer available.'
          : status === 403 ? 'You do not have access to this original PR.' : 'The original PR PDF could not be loaded.'
        setContent({ key: contentKey, url: '', loading: false, error: message })
      }
    }
    load()
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [embedded, source, contentPath, contentKey, retry])

  return <section className={`prr-source-document${embedded ? ' is-embedded' : ''}`} aria-label="Original uploaded PR">
    {!selected ? <div className="prr-source-state"><p>{loading ? 'Loading original PR...' : error ? 'The original PR could not be checked.' : 'No original PR uploaded.'}</p></div> : <>
      <div className="prr-source-controls">
        {documents.length > 1 && <label className="prr-source-select"><span className="prr-source-sr-only">Uploaded PR file</span><select value={selected.key} onChange={event => setSelectedKey(event.target.value)}>{documents.map(item => <option value={item.key} key={item.key}>{item.filename}</option>)}</select></label>}
        {(current.url || selected.url) && <a href={current.url || selected.url} target="_blank" rel="noopener noreferrer" aria-label="Open original PDF" title="Open original PDF"><ExternalLink size={17} aria-hidden="true" /></a>}
        {current.url && <a href={current.url} download={selected.filename} aria-label="Download original PDF" title="Download original PDF"><Download size={17} aria-hidden="true" /></a>}
      </div>
      {!source ? <div className="prr-source-state"><p>The original file link is unavailable.</p></div>
        : embedded && (current.loading ? <div className="prr-source-state" role="status"><RefreshCw size={22} aria-hidden="true" /><p>Loading original PDF...</p></div>
          : current.error ? <div className="prr-source-state" role="alert"><p>{current.error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Retry original PDF</button></div>
            : current.url && <iframe src={`${current.url}#page=1&zoom=page-width&view=FitH&toolbar=0&navpanes=0`} title={`Original uploaded PR: ${selected.filename}`} />)}
    </>}
  </section>
}

RecommendationSourceDocument.propTypes = {
  requisitionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  attachments: PropTypes.array,
  loading: PropTypes.bool,
  error: PropTypes.string,
  embedded: PropTypes.bool,
}
