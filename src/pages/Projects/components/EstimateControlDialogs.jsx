/* eslint-disable react/prop-types */
import React, { useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle, Lock, X } from 'lucide-react'
import * as PC from '../../../services/projectControl.service'
import { ESTIMATE_KIND_OPTIONS } from '../../../config/projectControl.config'
import { calculateEstimateLineTotal } from '../useEstimateControl'

const today = () => new Date().toISOString().slice(0, 10)
const titleCase = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
const readableDate = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Not recorded'
const money = (value, currency) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? `${currency || 'Currency unknown'} ${Number(value).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Not recorded'
const errorMessage = error => {
  const data = error?.response?.data
  if (typeof data === 'string') return data
  if (typeof data?.detail === 'string') return data.detail
  if (typeof data?.error === 'string') return data.error
  if (data && typeof data === 'object') return Object.entries(data).map(([key, value]) => `${titleCase(key)}: ${Array.isArray(value) ? value.join(' ') : typeof value === 'object' ? JSON.stringify(value) : String(value)}`).join(' ')
  return error?.message || 'The estimate could not be saved. Try again.'
}
const sourceId = estimate => estimate?.sourceDocumentId ?? estimate?.raw?.source_document ?? null
const editable = model => model?.canEdit === true && model.selected?.status === 'draft'
const estimateLabel = estimate => estimate?.label || `${estimate?.title || estimate?.kindLabel || 'Estimate'} · v${estimate?.version || '—'}`

function EstimateModal({ title, children, footer, busy = false, onClose }) {
  const id = useId(), ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current, opener = document.activeElement
    dialog.showModal()
    return () => { dialog.close(); if (opener?.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true }) }
  }, [])
  return <dialog ref={ref} className="ec-dialog" aria-labelledby={id} onCancel={event => { event.preventDefault(); if (!busy) onClose() }} onClick={event => { if (!busy && event.target === event.currentTarget) onClose() }}>
    <div className="ec-dialog-header"><h2 id={id}>{title}</h2><button type="button" className="pp-button pp-icon-button" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={18} /></button></div>
    <div className="ec-dialog-body">{children}</div>{footer && <div className="ec-dialog-footer">{footer}</div>}
  </dialog>
}
const ErrorMessage = ({ error }) => error ? <p className="ec-form-error ec-form-wide" role="alert"><AlertTriangle size={15} aria-hidden="true" />{error}</p> : null
const CloseButton = ({ onClose, busy, label = 'Cancel' }) => <button type="button" className="pp-button" disabled={busy} onClick={onClose}>{label}</button>
const KindField = ({ value, onChange, disabled = false }) => <label>Estimate kind<select value={value} onChange={event => onChange(event.target.value)} disabled={disabled}>{ESTIMATE_KIND_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.value === 'baseline' ? 'Baseline' : option.label}</option>)}</select></label>
function Facts({ rows }) { return <dl className="ec-detail-grid">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? 'Not recorded'}</dd></div>)}</dl> }
function ReadOnly({ title, onClose, children }) { return <EstimateModal title={title} onClose={onClose} footer={<CloseButton label="Close" onClose={onClose} />}><p className="ec-note"><Lock size={15} aria-hidden="true" />{children || 'This version is read only. Copy it to create an editable draft.'}</p></EstimateModal> }

function EstimateEditor({ type, project, model, onClose, onSaved }) {
  const selected = model.selected, isNew = type === 'create', id = useId()
  const [form, setForm] = useState(() => ({ title: isNew ? '' : selected?.title || '', kind: isNew ? 'estimate' : selected?.kind || 'estimate', currency: isNew ? project.currency || project.budget_currency || 'AED' : selected?.currency || '', snapshot_date: isNew ? today() : selected?.snapshotDate || '', notes: isNew ? '' : selected?.notes || '' }))
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const set = (key, value) => setForm(previous => ({ ...previous, [key]: value }))
  const allowed = isNew ? model.canCreate : editable(model)
  const title = isNew ? 'Blank estimate' : 'Edit estimate'
  const submit = async event => {
    event.preventDefault(); if (busy || !allowed) return
    setBusy(true); setError('')
    try {
      const body = { title: form.title.trim(), currency: form.currency.trim().toUpperCase(), snapshot_date: form.snapshot_date || null, notes: form.notes }
      const result = isNew ? await PC.createEstimate({ ...body, project: project.id, kind: form.kind }) : await PC.updateEstimate(selected.id, body)
      onSaved(result)
    } catch (failure) { setError(errorMessage(failure)); setBusy(false) }
  }
  if (!allowed) return <ReadOnly title={title} onClose={onClose}>{isNew ? 'You do not have access to create estimates for this project.' : undefined}</ReadOnly>
  return <EstimateModal title={title} busy={busy} onClose={onClose} footer={<><CloseButton onClose={onClose} busy={busy} /><button type="submit" form={id} className="pp-button pp-primary" disabled={busy}>{busy ? 'Saving…' : isNew ? 'Create estimate' : 'Save estimate'}</button></>}>
    <form id={id} className="ec-form-grid" onSubmit={submit}><ErrorMessage error={error} />
      <label className="ec-form-wide">Estimate title<input autoFocus maxLength={255} value={form.title} onChange={event => set('title', event.target.value)} /></label>
      <KindField value={form.kind} onChange={value => set('kind', value)} disabled={!isNew} />
      <label>Currency<input required pattern="[A-Za-z]{3}" maxLength={3} value={form.currency} onChange={event => set('currency', event.target.value)} /></label>
      <label>Snapshot date<input type="date" value={form.snapshot_date} onChange={event => set('snapshot_date', event.target.value)} /></label>
      {!isNew && <p className="ec-note">Source document: {sourceId(selected) || 'Not linked'}</p>}
      <label className="ec-form-wide">Notes<textarea rows={4} value={form.notes} onChange={event => set('notes', event.target.value)} /></label>
      <p className="ec-form-hint ec-form-wide">{isNew ? 'A new draft version is allocated when you save. Add cost items before approving it.' : 'Currency labels are stored with this version. Changing the code does not convert its amounts.'}</p>
    </form>
  </EstimateModal>
}

function CopyVersion({ model, onClose, onSaved }) {
  const selected = model.selected, id = useId()
  const [title, setTitle] = useState(selected?.title || ''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const submit = async event => {
    event.preventDefault(); if (busy || !model.canCopy || !selected) return
    setBusy(true); setError('')
    try { onSaved(await PC.copyEstimateVersion(selected.id, { title: title.trim() })) } catch (failure) { setError(errorMessage(failure)); setBusy(false) }
  }
  if (!model.canCopy || !selected) return <ReadOnly title="Copy version" onClose={onClose}>You do not have access to copy this estimate.</ReadOnly>
  return <EstimateModal title="Copy version" busy={busy} onClose={onClose} footer={<><CloseButton onClose={onClose} busy={busy} /><button type="submit" form={id} className="pp-button pp-primary" disabled={busy}>{busy ? 'Copying…' : 'Copy version'}</button></>}>
    <p>{estimateLabel(selected)}</p><form id={id} className="ec-form-grid" onSubmit={submit}><ErrorMessage error={error} /><label className="ec-form-wide">Version title<input autoFocus maxLength={255} value={title} onChange={event => setTitle(event.target.value)} /></label></form>
    <Facts rows={[[ 'Estimate kind', selected.kindLabel || titleCase(selected.kind)], ['Currency', selected.currency], ['Cost items', selected.lineCount ?? model.lines?.length ?? 0], ['Recorded total', money(selected.totalAmount, selected.currency)], ['Source document', sourceId(selected) || 'Not linked']]} />
    {!model.reconciled && <p className="ec-warning-note"><AlertTriangle size={15} aria-hidden="true" />The copy preserves the recorded total. Its cost items do not reconcile to that amount; editing cost items will recalculate the total.</p>}
    <p className="ec-note">The new draft keeps this version’s kind, currency, notes, source document, and cost items, including explicit imported totals.</p>
  </EstimateModal>
}

function ImportWorkbook({ project, model, onClose, onSaved }) {
  const id = useId(), [file, setFile] = useState(null), [title, setTitle] = useState(''), [kind, setKind] = useState('estimate'), [currency, setCurrency] = useState(project.currency || project.budget_currency || 'AED'), [notes, setNotes] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const submit = async event => {
    event.preventDefault(); if (busy || !file || !model.canCreate) return
    setBusy(true); setError('')
    try {
      const result = await PC.importBoqExcel(project.id, file, { kind, title: title.trim(), currency: currency.trim().toUpperCase(), notes })
      onSaved({ ...result, id: result.summary?.estimate_id ?? result.estimate?.id ?? result.estimate_id ?? result.id })
    } catch (failure) { setError(errorMessage(failure)); setBusy(false) }
  }
  if (!model.canCreate) return <ReadOnly title="Import Excel" onClose={onClose}>You do not have access to import estimates for this project.</ReadOnly>
  return <EstimateModal title="Import Excel" busy={busy} onClose={onClose} footer={<><CloseButton onClose={onClose} busy={busy} /><button type="submit" form={id} className="pp-button pp-primary" disabled={busy || !file}>{busy ? 'Importing…' : 'Import workbook'}</button></>}>
    <form id={id} className="ec-form-grid" onSubmit={submit}><ErrorMessage error={error} />
      <label className="ec-form-wide">Excel file<input autoFocus type="file" required accept=".xlsx,.xlsm" onChange={event => setFile(event.target.files?.[0] || null)} /></label>
      <label className="ec-form-wide">Estimate title<input maxLength={255} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <KindField value={kind} onChange={setKind} /><label>Currency<input required pattern="[A-Za-z]{3}" maxLength={3} value={currency} onChange={event => setCurrency(event.target.value)} /></label>
      <label className="ec-form-wide">Notes<textarea rows={3} value={notes} onChange={event => setNotes(event.target.value)} /></label>
      <p className="ec-form-hint ec-form-wide">Import a BOQ workbook as a new draft estimate. The source document and original row values are retained for review.</p>
    </form>
  </EstimateModal>
}

function CostItemEditor({ model, line, onClose, onSaved }) {
  const selected = model.selected, id = useId(), original = line?.raw || {}
  const [form, setForm] = useState(() => ({ wbs_code: original.wbs_code ?? line?.wbsCode ?? '', description: original.description ?? line?.description ?? '', discipline: original.discipline ?? line?.discipline ?? '', category: original.category ?? line?.category ?? '', unit: original.unit ?? line?.unit ?? '', quantity: String(original.quantity ?? line?.quantity ?? '1'), unit_rate: String(original.unit_rate ?? line?.unitRate ?? '0'), line_total: String(original.line_total ?? line?.lineTotal ?? '0') }))
  const [override, setOverride] = useState(() => Boolean(line?.isOverride))
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [confirmRemove, setConfirmRemove] = useState(false)
  const set = (key, value) => setForm(previous => ({ ...previous, [key]: value }))
  const title = line ? 'Edit cost item' : 'Add cost item', allowed = editable(model)
  const submit = async event => {
    event.preventDefault(); if (busy || !allowed) return
    setBusy(true); setError('')
    try {
      const payload = { wbs_code: form.wbs_code.trim(), description: form.description.trim(), discipline: form.discipline.trim(), category: form.category.trim(), unit: form.unit.trim(), quantity: form.quantity, unit_rate: form.unit_rate }
      if (override) payload.line_total = form.line_total
      const result = line ? await PC.updateEstimateLine(line.id, payload) : await PC.createEstimateLine({ ...payload, estimate: selected.id, sort_order: Math.max(0, ...(model.lines || []).map(item => Number(item.sortOrder) || 0)) + 1 })
      onSaved({ id: selected.id, line: result })
    } catch (failure) { setError(errorMessage(failure)); setBusy(false) }
  }
  const remove = async () => {
    if (busy || !allowed || !line) return
    setBusy(true); setError('')
    try { await PC.deleteEstimateLine(line.id); onSaved({ id: selected.id, removedLineId: line.id }) } catch (failure) { setError(errorMessage(failure)); setBusy(false) }
  }
  if (!allowed) return <ReadOnly title={title} onClose={onClose} />
  const sourceRow = line?.sourceRow ?? original.source_row
  return <><EstimateModal title={title} busy={busy} onClose={onClose} footer={<>{line && <button type="button" className="pp-button" disabled={busy} onClick={() => { setError(''); setConfirmRemove(true) }}>Remove cost item</button>}<CloseButton onClose={onClose} busy={busy} /><button type="submit" form={id} className="pp-button pp-primary" disabled={busy}>{busy ? 'Saving…' : line ? 'Save cost item' : 'Add cost item'}</button></>}>
    <form id={id} className="ec-form-grid" onSubmit={submit}><ErrorMessage error={!confirmRemove ? error : ''} />
      <label>WBS code<input maxLength={64} value={form.wbs_code} onChange={event => set('wbs_code', event.target.value)} /></label>
      <label>Discipline<input maxLength={64} value={form.discipline} onChange={event => set('discipline', event.target.value)} /></label>
      <label className="ec-form-wide">Description<textarea autoFocus required rows={2} value={form.description} onChange={event => set('description', event.target.value)} /></label>
      <label>Category<input list={`${id}-categories`} maxLength={64} value={form.category} onChange={event => set('category', event.target.value)} /></label>
      <datalist id={`${id}-categories`}><option value="Direct" /><option value="Indirect" /><option value="Contingency" /></datalist><label>Unit<input maxLength={32} value={form.unit} onChange={event => set('unit', event.target.value)} /></label>
      <label>Quantity<input type="number" required step="0.0001" value={form.quantity} onChange={event => set('quantity', event.target.value)} /></label>
      <label>Unit rate<input type="number" required step="0.0001" value={form.unit_rate} onChange={event => set('unit_rate', event.target.value)} /></label>
      <label className="ec-form-check ec-form-wide"><input type="checkbox" checked={override} onChange={event => setOverride(event.target.checked)} />Use explicit line total</label>
      {override && <label>Explicit line total<input type="number" required step="0.01" value={form.line_total} onChange={event => set('line_total', event.target.value)} /></label>}
      <p className="ec-form-hint ec-form-wide">Use Direct, Indirect or Contingency for cost classification; other categories remain available in the breakdown.</p><p className="ec-form-hint ec-form-wide">Calculated quantity × rate: {money(calculateEstimateLineTotal(form.quantity, form.unit_rate), selected.currency)}. {override ? 'The explicit amount is preserved when you save. Uncheck to recalculate from quantity and rate.' : 'The server calculates the line total from quantity and rate.'}</p>
      {sourceRow && Object.keys(sourceRow).length > 0 && <details className="ec-form-wide"><summary>Imported source row (read only)</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 11 }}>{JSON.stringify(sourceRow, null, 2)}</pre></details>}
    </form>
  </EstimateModal>{confirmRemove && <EstimateModal title="Remove cost item" busy={busy} onClose={() => { setConfirmRemove(false); setError('') }} footer={<><CloseButton onClose={() => { setConfirmRemove(false); setError('') }} busy={busy} /><button type="button" className="pp-button pp-primary" disabled={busy} onClick={remove}>{busy ? 'Removing…' : 'Confirm removal'}</button></>}><ErrorMessage error={error} /><p>Remove <strong>{line.description || line.wbsCode || 'this cost item'}</strong> from this draft estimate? The estimate total will be recalculated.</p></EstimateModal>}</>
}

function BasisEditor({ model, onClose, onSaved }) {
  const id = useId(), [notes, setNotes] = useState(model.selected?.notes || ''), [busy, setBusy] = useState(false), [error, setError] = useState(''), allowed = editable(model)
  const submit = async event => {
    event.preventDefault(); if (busy || !allowed) return
    setBusy(true); setError('')
    try { onSaved(await PC.updateEstimate(model.selected.id, { notes })) } catch (failure) { setError(errorMessage(failure)); setBusy(false) }
  }
  return <EstimateModal title="Estimate basis" busy={busy} onClose={onClose} footer={<><CloseButton label={allowed ? 'Cancel' : 'Close'} onClose={onClose} busy={busy} />{allowed && <button type="submit" form={id} className="pp-button pp-primary" disabled={busy}>{busy ? 'Saving…' : 'Save basis'}</button>}</>}>
    <form id={id} className="ec-form-grid" onSubmit={submit}><ErrorMessage error={error} /><label className="ec-form-wide">Estimate basis notes<textarea autoFocus rows={9} value={notes} onChange={event => setNotes(event.target.value)} readOnly={!allowed} /></label><p className="ec-form-hint ec-form-wide">Record assumptions, exclusions, qualifications, and source references in the estimate notes. These notes are stored as free text.</p></form>
    <p className="ec-note">Source document: {sourceId(model.selected) || 'Not linked'}. {!allowed && 'This estimate is read only.'}</p>
  </EstimateModal>
}

function ApproveVersion({ model, onClose, onSaved }) {
  const selected = model.selected, [busy, setBusy] = useState(false), [error, setError] = useState('')
  const lineCount = selected?.lineCount ?? model.lines?.length ?? 0
  const allowed = model.canApprove === true && selected?.status === 'draft' && lineCount > 0
  const approve = async () => {
    if (busy || !allowed) return
    setBusy(true); setError('')
    try { onSaved(await PC.approveEstimate(selected.id)) } catch (failure) { setError(errorMessage(failure)); setBusy(false) }
  }
  return <EstimateModal title="Approve estimate" busy={busy} onClose={onClose} footer={<><CloseButton label="Close" onClose={onClose} busy={busy} /><button type="button" className="pp-button pp-primary" disabled={busy || !allowed} onClick={approve}>{busy ? 'Approving…' : 'Approve estimate'}</button></>}>
    <ErrorMessage error={error} /><p>{estimateLabel(selected)}</p><Facts rows={[[ 'Recorded status', selected?.statusLabel || titleCase(selected?.status)], ['Cost items', lineCount], ['Total amount', money(selected?.totalAmount, selected?.currency)], ['Snapshot date', readableDate(selected?.snapshotDate)]]} />
    <p className="ec-note">Approval records this version as approved and locks its cost items and notes. Copy the version to make subsequent revisions.</p>
    {!lineCount && <p className="ec-warning-note">Add at least one cost item before approving this version.</p>}{selected?.status !== 'draft' && <p className="ec-note">This version is already {titleCase(selected?.status).toLowerCase() || 'read only'}.</p>}
  </EstimateModal>
}

function EstimateChecks({ model, onClose }) {
  const selected = model.selected, lines = model.lines || []
  const fallback = [
    { label: 'Cost items', status: lines.length ? `${lines.length} recorded` : 'Missing', detail: 'An estimate needs at least one cost item before approval.' },
    { label: 'Unallocated WBS', status: `${lines.filter(line => !line.wbsCode).length} items`, detail: 'Review cost items without a recorded WBS code.' },
    { label: 'Missing descriptions', status: `${lines.filter(line => !line.description?.trim()).length} items`, detail: 'Descriptions identify the scope included in each cost item.' },
    { label: 'Explicit line totals', status: `${lines.filter(line => line.isOverride).length} items`, detail: 'These recorded amounts differ from quantity × rate; inspect their source before changing them.' },
    { label: 'Estimate basis', status: selected?.notes?.trim() ? 'Notes recorded' : 'Missing', detail: 'Assumptions, exclusions, and qualifications are recorded in the version notes.' },
  ]
  const checks = model.quality?.length ? model.quality : fallback
  return <EstimateModal title="Estimate checks" onClose={onClose} footer={<CloseButton label="Close" onClose={onClose} />}><p>Review the recorded estimate data before using or approving this version.</p><div className="ec-table-wrap" role="region" aria-label="Estimate data checks" tabIndex={0}><table className="ec-table"><thead><tr><th>Check</th><th>Status</th><th>Details</th></tr></thead><tbody>{checks.map((check, index) => <tr key={check.id || check.label || index}><td>{check.label || check.title}</td><td>{check.status || (check.ready ? 'Recorded' : 'Review required')}</td><td>{check.detail || check.description || 'Review this estimate record.'}</td></tr>)}</tbody></table></div></EstimateModal>
}

function VersionWorkflow({ model, onClose }) {
  return <EstimateModal title="Version workflow" onClose={onClose} footer={<CloseButton label="Close" onClose={onClose} />}><p>Draft versions can be edited. Approval locks the recorded version; create a copy to continue estimating. Additional approval levels and reviewer assignments are not recorded here.</p><div className="ec-table-wrap" role="region" aria-label="Estimate version records" tabIndex={0}><table className="ec-table"><thead><tr><th>Version</th><th>Kind</th><th>Recorded status</th><th>Total</th><th>Snapshot date</th></tr></thead><tbody>{(model.estimates || []).map(estimate => <tr key={estimate.id}><td>{estimateLabel(estimate)}</td><td>{estimate.kindLabel || titleCase(estimate.kind)}</td><td>{estimate.statusLabel || titleCase(estimate.status)}</td><td>{money(estimate.totalAmount ?? estimate.total_amount, estimate.currency)}</td><td>{readableDate(estimate.snapshotDate ?? estimate.snapshot_date)}</td></tr>)}</tbody></table></div></EstimateModal>
}

export default function EstimateControlDialogs({ dialog, onClose, onSaved, project, model }) {
  if (!dialog) return null
  const props = { model, project, onClose, onSaved }, key = `${dialog.type}:${model.selected?.id || 'new'}:${dialog.line?.id || ''}`
  if (dialog.type === 'create' || dialog.type === 'edit-estimate') return <EstimateEditor key={key} type={dialog.type} {...props} />
  if (dialog.type === 'copy') return <CopyVersion key={key} {...props} />
  if (dialog.type === 'import') return <ImportWorkbook key={key} {...props} />
  if (dialog.type === 'line') return <CostItemEditor key={key} line={dialog.line} {...props} />
  if (dialog.type === 'basis') return <BasisEditor key={key} {...props} />
  if (dialog.type === 'approve') return <ApproveVersion key={key} {...props} />
  if (dialog.type === 'checks') return <EstimateChecks key={key} {...props} />
  return <VersionWorkflow key={key} {...props} />
}
