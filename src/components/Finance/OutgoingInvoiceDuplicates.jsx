import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { XMarkIcon } from '@heroicons/react/24/outline';
import invoiceTrackerService from '../../services/invoiceTracker.service';
import { trapOutgoingDialogFocus } from './OutgoingInvoiceCreate';
import { outgoingDate, outgoingMoney } from './outgoingInvoicePresentation';
import './OutgoingInvoiceDuplicates.css';

const text = value => value === null || value === undefined || value === '' ? 'Not recorded' : String(value);
const errorText = error => typeof error?.response?.data?.detail === 'string' ? error.response.data.detail : error?.message || 'Duplicate invoices could not be loaded.';
const FIELDS = [
  ['Invoice number', row => text(row.invoice_number)], ['Customer / account', row => text(row.account)],
  ['Company', row => text(row.company)], ['Project reference', row => text(row.rad_project_no)], ['Project name', row => text(row.project_name)],
  ['Payment status', row => text(row.payment_status).replaceAll('_', ' ')], ['Currency', row => text(row.currency)],
  ['Invoice amount', row => outgoingMoney(row.invoice_amount, row.currency)], ['Recorded amount AED', row => outgoingMoney(row.invoice_amount_aed, 'AED')],
  ['Outstanding balance', row => outgoingMoney(row.balance_to_be_received, row.currency)], ['Amount received', row => outgoingMoney(row.actual_payment_received, row.currency)],
  ['Invoice date', row => outgoingDate(row.invoice_date)], ['Due date', row => outgoingDate(row.due_date)],
  ['Created', row => outgoingDate(row.created_at, true)], ['Updated', row => outgoingDate(row.updated_at, true)],
];
const validGroups = data => data?.schema_version === '1.0' && Array.isArray(data.groups) && Number.isInteger(data.pagination?.total_groups) && data.groups.every(group =>
  typeof group.group_token === 'string' && group.group_token && Number.isInteger(group.record_count) && group.record_count > 1 && Array.isArray(group.records) && group.records.length === group.record_count && group.records.every(record => typeof record.record_token === 'string' && record.record_token));

export default function OutgoingInvoiceDuplicates({ initialInvoiceId = '', onClose, onResolved }) {
  const dialog = useRef(null);
  const confirmationRef = useRef(null);
  const deleteTriggers = useRef(new Map());
  const sequence = useRef(0);
  const [input, setInput] = useState(initialInvoiceId);
  const [invoiceId, setInvoiceId] = useState(initialInvoiceId);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selection, setSelection] = useState({});
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => { sequence.current += 1; element.close(); };
  }, []);
  useEffect(() => { if (confirmation) confirmationRef.current?.focus(); }, [confirmation]);
  useEffect(() => {
    const request = ++sequence.current;
    setLoading(true); setData(null); setSelection({}); setConfirmation(null); setError(''); setStale(false);
    invoiceTrackerService.duplicates({ invoice_id: invoiceId, page, page_size: 20 }).then(result => {
      if (request !== sequence.current) return;
      if (!validGroups(result)) throw new Error('Duplicate invoices returned an incomplete response. Reload before continuing.');
      if (!result.groups.length && page > 1 && result.pagination.total_groups <= (page - 1) * 20) { setPage(page - 1); return; }
      setData(result);
    }).catch(requestError => { if (request === sequence.current) setError(errorText(requestError)); })
      .finally(() => { if (request === sequence.current) setLoading(false); });
    return () => { sequence.current += 1; };
  }, [invoiceId, page, reload]);

  const refresh = () => { if (!busy) { setSelection({}); setConfirmation(null); setReload(value => value + 1); } };
  const filter = event => {
    event.preventDefault();
    const value = input.trim();
    if (value && !/^[1-9]\d*$/.test(value)) { setError('Enter a positive invoice ID, or leave the filter empty.'); return; }
    setMessage(''); setPage(1); setInvoiceId(value); setReload(current => current + 1);
  };
  const cancelConfirmation = () => { const token = confirmation?.group.group_token; setConfirmation(null); requestAnimationFrame(() => deleteTriggers.current.get(token)?.focus()); };
  const resolve = async () => {
    if (busy || stale || data?.capabilities?.resolve !== true || !confirmation) return;
    const { group, keepToken } = confirmation;
    setBusy(true); setError('');
    let resolved = false;
    try {
      const result = await invoiceTrackerService.resolveDuplicates({ group_token: group.group_token, keep_token: keepToken });
      if (String(result?.invoice_id) !== String(group.invoice_id) || !Number.isInteger(result.removed_count) || result.removed_count !== group.record_count - 1) {
        setStale(true); setSelection({}); setConfirmation(null);
        throw new Error('The deletion response could not be confirmed. Reload duplicates before continuing.');
      }
      setMessage(`${result.removed_count} duplicate ${result.removed_count === 1 ? 'record' : 'records'} deleted. Kept ${result.kept_invoice_number || 'invoice'} (ID ${result.invoice_id}).`);
      setSelection({}); setConfirmation(null); setReload(value => value + 1); resolved = true;
    } catch (requestError) {
      setError(errorText(requestError));
      setConfirmation(null);
      if (requestError?.response?.status === 409) { setSelection({}); setStale(true); }
      if (requestError?.response?.status === 403) { setSelection({}); setData(current => current ? { ...current, capabilities: { ...current.capabilities, resolve: false } } : current); }
    } finally { setBusy(false); }
    if (resolved) onResolved();
  };
  const canResolve = data?.capabilities?.resolve === true;
  const locked = busy || !!confirmation;

  return <dialog ref={dialog} className="oc-dialog oc-duplicates-dialog" aria-labelledby="oc-duplicates-title" aria-describedby="oc-duplicates-intro" onKeyDown={trapOutgoingDialogFocus} onCancel={event => { event.preventDefault(); if (busy) return; if (confirmation) cancelConfirmation(); else onClose(); }}>
    <header><h2 id="oc-duplicates-title">Review duplicate invoices</h2><button type="button" aria-label="Close duplicate review" onClick={onClose} disabled={busy}><XMarkIcon /></button></header>
    <p id="oc-duplicates-intro">Compare records sharing an invoice ID, then choose the copy to keep. Attachments and history stay with the retained invoice ID.</p>
    <form className="oc-duplicates-filter" onSubmit={filter}><label>Invoice ID<input aria-label="Duplicate invoice ID" inputMode="numeric" value={input} onChange={event => setInput(event.target.value)} placeholder="All duplicate IDs" disabled={locked || loading} /></label><button type="submit" className="oc-button" disabled={locked || loading}>Find duplicates</button><button type="button" className="oc-button" onClick={refresh} disabled={locked || loading}>Reload duplicates</button></form>
    {message && <p className="oc-duplicates-success" role="status">{message}</p>}
    {error && <div className="oc-form-error" role="alert"><p>{error}</p>{stale && <p>The records changed. Reload duplicates, review the current copies and choose again.</p>}</div>}
    {loading && <p role="status">Loading duplicate invoices…</p>}
    {!loading && data && !canResolve && <p className="oc-duplicates-notice">You can review duplicates. Your access does not allow deleting extra copies.</p>}
    {!loading && data?.groups.length === 0 && <p className="oc-duplicates-empty">No duplicate invoice IDs {invoiceId ? `match ${invoiceId}` : 'were found'}.</p>}
    {!loading && data?.groups.map(group => {
      const selected = selection[group.group_token];
      const count = group.record_count - 1;
      const confirming = confirmation?.group.group_token === group.group_token;
      const keepIndex = group.records.findIndex(record => record.record_token === confirmation?.keepToken);
      return <section className="oc-duplicate-group" key={group.group_token} aria-label={`Duplicate invoice ID ${group.invoice_id}`}>
        <header><h3>Invoice ID {group.invoice_id}</h3><span>{group.record_count} copies · {group.identical ? 'Identical invoice values' : 'Invoice values differ'}</span></header>
        <p>{group.attachments_count ?? 0} attachments will remain with the retained invoice.</p>
        <div className="oc-duplicate-table" role="region" aria-label={`Compare copies for invoice ID ${group.invoice_id}`} tabIndex={0}><table><thead><tr><th scope="col">Invoice field</th>{group.records.map((record, index) => <th scope="col" key={record.record_token}><label><input type="radio" name={`keep-invoice-${group.invoice_id}`} aria-label={`Keep copy ${index + 1} of invoice ID ${group.invoice_id}`} checked={selected === record.record_token} disabled={!canResolve || locked || stale} onChange={() => { setSelection(current => ({ ...current, [group.group_token]: record.record_token })); setError(''); }} />Keep copy {index + 1}</label></th>)}</tr></thead><tbody>{FIELDS.map(([label, display]) => <tr key={label}><th scope="row">{label}</th>{group.records.map(record => <td key={record.record_token} className={selected === record.record_token ? 'is-kept' : ''}>{display(record)}</td>)}</tr>)}</tbody></table></div>
        {confirming ? <div className="oc-duplicate-confirm" ref={confirmationRef} tabIndex={-1} role="group" aria-label="Confirm duplicate deletion"><h4>Delete {count} extra {count === 1 ? 'copy' : 'copies'}?</h4><p>Keep copy {keepIndex + 1}: <strong>{text(group.records[keepIndex]?.invoice_number)}</strong>, invoice ID {group.invoice_id}. The other {count} {count === 1 ? 'record will' : 'records will'} be deleted.</p><p>Attachments and history stay with invoice ID {group.invoice_id}.</p><p>Deleted copies are saved in a recovery archive.</p><div><button type="button" className="oc-button" disabled={busy} onClick={cancelConfirmation}>Cancel deletion</button><button type="button" className="oc-button oc-duplicate-delete" disabled={busy} onClick={resolve}>{busy ? 'Deleting…' : `Confirm delete ${count} ${count === 1 ? 'duplicate' : 'duplicates'}`}</button></div></div> : <footer><span>{!selected && canResolve ? 'Choose the copy to keep before deleting extras.' : selected ? 'The selected copy will be kept.' : 'Review only'}</span><button ref={element => deleteTriggers.current.set(group.group_token, element)} type="button" className="oc-button oc-duplicate-delete" disabled={!canResolve || !selected || stale || locked} onClick={() => setConfirmation({ group, keepToken: selected })}>Delete {count} {count === 1 ? 'duplicate' : 'duplicates'}</button></footer>}
      </section>;
    })}
    <footer className="oc-duplicates-footer"><span>{data ? `${data.pagination.total_groups} duplicate groups · Page ${page}` : `Page ${page}`}</span><div><button type="button" className="oc-button" disabled={loading || locked || page <= 1} onClick={() => setPage(value => value - 1)}>Previous duplicate page</button><button type="button" className="oc-button" disabled={loading || locked || !data?.pagination.has_next} onClick={() => setPage(value => value + 1)}>Next duplicate page</button><button type="button" className="oc-button" disabled={busy} onClick={onClose}>Close</button></div></footer>
  </dialog>;
}
OutgoingInvoiceDuplicates.propTypes = { initialInvoiceId: PropTypes.string, onClose: PropTypes.func.isRequired, onResolved: PropTypes.func.isRequired };
