import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { Download, Loader2 } from 'lucide-react'
import { planningIntelligenceService as service } from '../../services/planningIntelligence.service'

const list = value => Array.isArray(value) ? value : []
const label = value => String(value || '').replaceAll('_', ' ')
const errorMessage = data => [typeof data?.error === 'string' ? data.error : typeof data?.detail === 'string' ? data.detail : '', ...list(data?.issues).map(issue => issue.message || issue.code)].filter(Boolean).join(' ') || 'The export could not be prepared.'
const downloadName = (header, versionId, format) => {
  const encoded = header?.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  const quoted = header?.match(/filename="([^"]+)"/i)?.[1] || header?.match(/filename=([^;]+)/i)?.[1]
  let filename = encoded || quoted
  try { if (encoded) filename = decodeURIComponent(encoded) } catch { /* Retain the server filename when percent encoding is invalid. */ }
  return (filename || `schedule-${versionId}.${({ mspdi: 'xml', mspdi_zip: 'zip' })[format] || format}`).split(/[\\/]/).at(-1).trim()
}

export default function PlanningExportPanel({ versionId }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    setData(null); setError(''); setNotice('')
    if (versionId) service.getScheduleExportCapabilities(versionId, controller.signal).then(result => { if (!controller.signal.aborted) setData(result) }).catch(caught => { if (!controller.signal.aborted) setError(caught.message || 'Export support could not be checked.') })
    return () => controller.abort()
  }, [versionId])
  const download = async adapter => {
    if (busy) return
    setBusy(adapter.format); setError(''); setNotice('')
    try {
      const response = await service.downloadScheduleExport(versionId, adapter.format)
      const filename = downloadName(response.headers?.['content-disposition'], versionId, adapter.format)
      const url = URL.createObjectURL(response.data)
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice(`Download prepared: ${filename}. ${adapter.format === 'mspdi_zip' ? 'The package includes provenance and verification results.' : 'Review the format limitations before importing into another scheduling application.'}`)
    } catch (caught) {
      let body = caught.response?.data
      if (body instanceof Blob) { try { body = JSON.parse(await body.text()) } catch { body = null } }
      setError(body ? errorMessage(body) : caught.message || 'The export could not be prepared.')
    } finally { setBusy('') }
  }
  if (!versionId) return <p>No saved schedule version is selected. Review the evidence and prepare an approved schedule before baseline export.</p>
  if (!data && error) return <p role="alert">Export support could not be checked: {error}</p>
  if (!data) return <p role="status">Checking export support…</p>
  return <section aria-label="Schedule exports"><p>Format support does not establish that this schedule is ready for approval or export. The MSPDI ZIP package includes the XML schedule, provenance and verification results.</p>
    {error && <p className="per-message is-error" role="alert">{error}</p>}{notice && <p className="per-message" role="status">{notice}</p>}
    <div className="per-export-table"><table><thead><tr><th>Format</th><th>Support status</th><th>Baseline support</th><th>Limitations and verification</th><th>Download</th></tr></thead><tbody>{list(data.adapters).filter(adapter => !adapter.canonical_format || adapter.canonical_format === adapter.format).map(adapter => <tr key={adapter.format}><td>{adapter.name || adapter.format}{adapter.format === 'mspdi_zip' && <small>Includes provenance</small>}</td><td>{label(adapter.status) || 'Not assessed'}</td><td>{adapter.baseline === true ? 'Supported by format' : 'Not supported'}</td><td>{list(adapter.limitations).join(' ')}{adapter.traceability && <small>Evidence: {adapter.traceability}</small>}{adapter.verification && <details><summary>Verification boundary</summary><dl>{Object.entries(adapter.verification).map(([key, value]) => <div key={key}><dt>{label(key)}</dt><dd>{label(value)}</dd></div>)}</dl></details>}</td><td>{['implemented', 'implemented_subset', 'legacy_unvalidated'].includes(adapter.status) ? <button type="button" disabled={Boolean(busy) || data.permissions?.can_export === false} onClick={() => download(adapter)}>{busy === adapter.format ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}{adapter.status === 'legacy_unvalidated' ? 'Download unvalidated' : 'Download'} {adapter.name || adapter.format}</button> : 'Unavailable'}</td></tr>)}</tbody></table></div>
  </section>
}
PlanningExportPanel.propTypes = { versionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]) }
