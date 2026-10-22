/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react'
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react'
import rbacService from '../../services/rbac.service'
import './EmployeeRegisterImport.css'

const fields = [['first_name', 'First name'], ['last_name', 'Last name'], ['department', 'Department'], ['job_title', 'Job title'], ['phone', 'Phone'], ['employee_id', 'Employee ID'], ['location', 'Location']]
const items = response => { const data = response?.data ?? response; return Array.isArray(data) ? data : data?.results || [] }
const dataOf = response => response?.data ?? response

export default function EmployeeRegisterImport({ onClose, onCompleted }) {
  const dialog = useRef(null)
  const inFlight = useRef(false)
  const [file, setFile] = useState(null)
  const [mode, setMode] = useState('upsert')
  const [organization, setOrganization] = useState('')
  const [role, setRole] = useState('')
  const [organizations, setOrganizations] = useState([])
  const [roles, setRoles] = useState([])
  const [selectedFields, setSelectedFields] = useState(fields.map(([id]) => id))
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [optionsError, setOptionsError] = useState('')
  const [optionsRetry, setOptionsRetry] = useState(0)
  const [resultPage, setResultPage] = useState(0)
  useEffect(() => { dialog.current?.showModal() }, [])
  useEffect(() => {
    let current = true
    setOptionsError('')
    const config = { timeout: 30000, params: { page_size: 1000 } }
    Promise.all([rbacService.getOrganizations(config), rbacService.getRoles(config)]).then(([orgs, availableRoles]) => {
      if (current) { setOrganizations(items(orgs)); setRoles(items(availableRoles).filter(item => item.is_active !== false)) }
    }).catch(() => { if (current) setOptionsError('Unable to load organizations and roles.') })
    return () => { current = false }
  }, [optionsRetry])
  const resetReview = () => { setPreview(null); setResult(null); setError(''); setResultPage(0) }
  const selectFile = event => {
    resetReview()
    const incoming = event.target.files?.[0]
    setFile(null)
    if (!incoming) return
    if (!/\.(csv|xlsx|xlsm)$/i.test(incoming.name)) { setError('Choose CSV or Excel (.xlsx/.xlsm).'); return }
    if (incoming.size > 5 * 1024 * 1024) { setError('Maximum file size is 5 MB.'); return }
    setFile(incoming)
  }
  const submit = async previewOnly => {
    if (inFlight.current || !file) return
    if (mode === 'upsert' && (!organization || !role)) { setError('Select an organization and role for new employees.'); return }
    if (!previewOnly && !preview) return
    inFlight.current = true; setBusy(true); setError('')
    const form = new FormData()
    form.append('file', file); form.append('import_mode', mode)
    form.append('preview_only', String(previewOnly)); form.append('update_fields', JSON.stringify(selectedFields))
    if (mode === 'upsert') { form.append('organization_id', organization); form.append('role_id', role) }
    try {
      const payload = dataOf(await rbacService.bulkUploadUsers(form))
      if (previewOnly) setPreview(payload)
      else {
        setResult(payload); setPreview(null)
        try { await onCompleted?.(payload) } catch { setError('Import completed, but the directory could not refresh. Refresh the directory before making further changes.') }
      }
      setResultPage(0)
    } catch (failure) { setError(failure.response?.data?.error || failure.response?.data?.detail || 'Import request failed. Your file is retained; retry the preview before importing.'); setPreview(null) }
    finally { inFlight.current = false; setBusy(false) }
  }
  const downloadTemplate = async () => {
    try {
      const response = await rbacService.downloadBulkUploadTemplate()
      const blob = response?.data ?? response
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a'); link.href = url; link.download = 'employee_import_template.xlsx'; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setError('Unable to download the template. Please try again.') }
  }
  const summary = result?.summary || preview?.summary
  const rows = result ? [...(result.details?.failed || []), ...(result.details?.skipped || []), ...(result.details?.updated || []), ...(result.details?.success || []), ...(result.details?.unchanged || [])] : preview?.rows || []
  const valid = preview && (preview.summary.existing + preview.summary.new > 0)
  return <dialog className="employee-import-dialog" ref={dialog} onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <header><div><h2>Import master employees</h2><p>Update matched employees and create new employees without duplicate accounts.</p></div><button aria-label="Close employee import" disabled={busy} onClick={onClose}><X size={20} /></button></header>
    <div className="ei-body"><div className="ei-file-heading"><h3><FileSpreadsheet size={19} />Employee register</h3><button className="ei-button" disabled={busy} onClick={downloadTemplate}><Download size={15} />Download Excel template</button></div><label className="ei-file"><Upload size={23} /><span>Choose CSV or Excel file <small>CSV, XLSX or XLSM · maximum 5 MB</small></span><input aria-label="Employee register file" type="file" accept=".csv,.xlsx,.xlsm" disabled={busy} onChange={selectFile} /></label>{file && <p className="ei-file-name">{file.name}</p>}
      <label className="ei-mode">Import behavior<select aria-label="Import behavior" value={mode} disabled={busy} onChange={event => { setMode(event.target.value); resetReview() }}><option value="upsert">Update existing employees and create unmatched employees</option><option value="update_existing">Update existing employees only</option></select></label>
      {mode === 'upsert' && <div className="ei-mapping"><label>Organization for new employees<select aria-label="Organization for new employees" value={organization} disabled={busy} onChange={event => { setOrganization(event.target.value); resetReview() }}><option value="">Select organization</option>{organizations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Role for new employees<select aria-label="Role for new employees" value={role} disabled={busy} onChange={event => { setRole(event.target.value); resetReview() }}><option value="">Select role</option>{roles.map(item => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select></label></div>}
      {optionsError && <p className="ei-error" role="alert">{optionsError}<button onClick={() => setOptionsRetry(value => value + 1)}>Retry options</button></p>}
      <fieldset disabled={busy}><legend>Fields to update on existing employees</legend><div className="ei-fields">{fields.map(([id, label]) => <label key={id}><input type="checkbox" checked={selectedFields.includes(id)} onChange={event => { setSelectedFields(current => event.target.checked ? [...current, id] : current.filter(field => field !== id)); resetReview() }} />{label}</label>)}</div></fieldset>
      <p className="ei-info">Matches use email, employee ID and username. Blank rows are ignored; blank cells keep existing values. Existing email, username, organization, roles, account status and passwords are preserved. New accounts receive the organization and role selected above. This import sends no welcome emails.</p>
      {error && <p className="ei-error" role="alert">{error}</p>}
      {summary && <section className="ei-review" aria-label={result ? 'Import results' : 'Import preview'}><h3>{result ? 'Import results' : 'Review before import'}</h3><div className="ei-summary">{(result ? [['created', 'Created'], ['updated', 'Updated'], ['unchanged', 'Unchanged'], ['failed', 'Failed'], ['skipped', 'Skipped']] : [['existing', 'Existing matches'], ['new', 'New employees'], ['invalid', 'Needs correction'], ['skipped', 'Skipped']]).map(([id, label]) => <span key={id}><strong>{summary[id] || 0}</strong>{label}</span>)}</div><p>{summary.ignored_blank || 0} blank rows ignored.</p><p>Rows needing correction are excluded from this import.</p><div className="ei-table"><table><thead><tr><th>File row</th><th>Employee</th><th>Employee ID</th><th>Result</th><th>Details</th></tr></thead><tbody>{rows.slice(resultPage * 25, (resultPage + 1) * 25).map(row => <tr key={row.row}><td>{row.row}</td><td>{row.name || row.email || '—'}</td><td>{row.employee_id || '—'}</td><td>{row.state}</td><td>{row.error || row.reason || (row.changed_fields?.length ? `Fields: ${row.changed_fields.join(', ')}` : 'No field changes')}</td></tr>)}</tbody></table></div><div className="ei-result-pages"><span>{rows.length} employee rows</span><button disabled={resultPage === 0} onClick={() => setResultPage(value => value - 1)}>Previous</button><span>Page {resultPage + 1}</span><button disabled={(resultPage + 1) * 25 >= rows.length} onClick={() => setResultPage(value => value + 1)}>Next</button></div></section>}
    </div><footer><button className="ei-button" disabled={busy} onClick={onClose}>{result ? 'Done' : 'Cancel'}</button>{!result && <button className="ei-button" disabled={busy || !file} onClick={() => submit(true)}>{busy ? 'Processing…' : 'Preview import'}</button>}{!result && <button className="ei-button ei-primary" disabled={busy || !valid} onClick={() => submit(false)}>{busy ? 'Processing…' : 'Import valid rows'}</button>}</footer>
  </dialog>
}
