import { useCallback, useEffect, useRef, useState } from 'react';
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
const validGroups = data => data?.schema_version === '1.0' && Array.isArray(data.groups) && Number.isInteger(data.pagination?.total_groups) && new Set(data.groups.map(group => String(group.invoice_id))).size === data.groups.length && data.groups.every(group =>
  Number.isInteger(group.invoice_id) && group.invoice_id > 0 && typeof group.group_token === 'string' && group.group_token && typeof group.review_key === 'string' && group.review_key && Number.isInteger(group.record_count) && group.record_count > 1 && Array.isArray(group.records) && group.records.length === group.record_count && new Set(group.records.map(record => record.record_key)).size === group.record_count && group.records.every(record => typeof record.record_token === 'string' && record.record_token && typeof record.record_key === 'string' && record.record_key));
const makeChoice = (group, record, index) => ({ invoiceId: group.invoice_id, reviewKey: group.review_key, recordKey: record.record_key, groupToken: group.group_token, keepToken: record.record_token, record, copy: index + 1, extras: group.record_count - 1 });
const omitChoices = (choices, ids) => Object.fromEntries(Object.entries(choices).filter(([id]) => !ids.has(id)));

export default function OutgoingInvoiceDuplicates({ initialInvoiceId = '', onClose, onResolved }) {
  const dialog = useRef(null);
  const confirmationRef = useRef(null);
  const deleteTriggers = useRef(new Map());
  const bulkTrigger = useRef(null);
  const bulkConfirmationRef = useRef(null);
  const basketRef = useRef({});
  const sequence = useRef(0);
  const [input, setInput] = useState(initialInvoiceId);
  const [invoiceId, setInvoiceId] = useState(initialInvoiceId);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [basket, setBasket] = useState({});
  const [bulkConfirmation, setBulkConfirmation] = useState(null);
  const [notice, setNotice] = useState('');
  const [staleIds, setStaleIds] = useState([]);
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const updateBasket = useCallback(update => { const next = typeof update === 'function' ? update(basketRef.current) : update; basketRef.current = next; setBasket(next); }, []);
  const selection = Object.fromEntries(Object.values(basket).map(choice => [choice.groupToken, choice.keepToken]));

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => { sequence.current += 1; element.close(); };
  }, []);
  useEffect(() => { if (confirmation) confirmationRef.current?.focus(); }, [confirmation]);
  useEffect(() => { if (bulkConfirmation) bulkConfirmationRef.current?.focus(); }, [bulkConfirmation]);
  useEffect(() => {
    const request = ++sequence.current;
    setLoading(true); setData(null); setConfirmation(null); setBulkConfirmation(null); setError('');
    invoiceTrackerService.duplicates({ invoice_id: invoiceId, page, page_size: 20 }).then(result => {
      if (request !== sequence.current) return;
      if (!validGroups(result)) throw new Error('Duplicate invoices returned an incomplete response. Reload before continuing.');
      if (!result.groups.length && page > 1 && result.pagination.total_groups <= (page - 1) * 20) { setPage(page - 1); return; }
      const next = { ...basketRef.current }, changed = [];
      for (const group of result.groups) {
        const id = String(group.invoice_id), saved = next[id];
        if (!saved) continue;
        const index = group.records.findIndex(record => record.record_key === saved.recordKey);
        if (saved.reviewKey !== group.review_key || index < 0) { delete next[id]; changed.push(id); }
        else next[id] = makeChoice(group, group.records[index], index);
      }
      if (invoiceId && !result.groups.length && next[invoiceId]) { delete next[invoiceId]; changed.push(invoiceId); }
      if (!invoiceId && result.pagination.total_groups === 0 && !result.groups.length) { for (const id of Object.keys(next)) { delete next[id]; changed.push(id); } }
      updateBasket(result.capabilities?.resolve === true ? next : {});
      if (changed.length) setNotice(`Invoice IDs ${changed.join(', ')} changed. Their choices were cleared; review the current copies again.`);
      setStale(false); setStaleIds(current => current.filter(id => !result.groups.some(group => String(group.invoice_id) === id)));
      setData(result);
    }).catch(requestError => { if (request === sequence.current) setError(errorText(requestError)); })
      .finally(() => { if (request === sequence.current) setLoading(false); });
    return () => { sequence.current += 1; };
  }, [invoiceId, page, reload, updateBasket]);

  const refresh = () => { if (!busy) { setConfirmation(null); setBulkConfirmation(null); setReload(value => value + 1); } };
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
        setStale(true); updateBasket(current => omitChoices(current, new Set([String(group.invoice_id)]))); setConfirmation(null);
        throw new Error('The deletion response could not be confirmed. Reload duplicates before continuing.');
      }
      setMessage(`${result.removed_count} duplicate ${result.removed_count === 1 ? 'record' : 'records'} deleted. Kept ${result.kept_invoice_number || 'invoice'} (ID ${result.invoice_id}).`);
      updateBasket(current => omitChoices(current, new Set([String(group.invoice_id)]))); setConfirmation(null); setReload(value => value + 1); resolved = true;
    } catch (requestError) {
      setError(errorText(requestError));
      setConfirmation(null);
      if (requestError?.response?.status === 409) { updateBasket(current => omitChoices(current, new Set([String(group.invoice_id)]))); setStale(true); }
      if (requestError?.response?.status === 403) { updateBasket({}); setData(current => current ? { ...current, capabilities: { ...current.capabilities, resolve: false, bulk_resolve: false } } : current); }
      if (!requestError?.response?.status || requestError.response.status >= 500) {
        updateBasket(current => omitChoices(current, new Set([String(group.invoice_id)]))); setStale(true);
        setNotice('The request outcome could not be confirmed. Reload duplicates and review the current records before trying again.');
      }
    } finally { setBusy(false); }
    if (resolved) onResolved();
  };
  const canResolve = data?.capabilities?.resolve === true;
  const canBulk = canResolve && data?.capabilities?.bulk_resolve === true;
  const choices = Object.values(basket);
  const extraCount = choices.reduce((sum, choice) => sum + choice.extras, 0);
  const limit = Number.isInteger(data?.limits?.bulk_groups) && data.limits.bulk_groups > 0 ? Math.min(50, data.limits.bulk_groups) : 50;
  const locked = busy || !!confirmation || !!bulkConfirmation;
  const choose = (group, record, index) => {
    if (!canResolve || locked || stale || staleIds.includes(String(group.invoice_id))) return;
    if (!basket[String(group.invoice_id)] && choices.length >= limit) return;
    updateBasket(current => ({ ...current, [String(group.invoice_id)]: makeChoice(group, record, index) }));
  };
  const cancelBatch = () => { setBulkConfirmation(null); requestAnimationFrame(() => { if (bulkTrigger.current && !bulkTrigger.current.disabled) bulkTrigger.current.focus(); else dialog.current?.querySelector('input[aria-label="Duplicate invoice ID"]')?.focus(); }); };
  const removeChoice = id => {
    updateBasket(current => omitChoices(current, new Set([String(id)])));
    if (bulkConfirmation) {
      const remaining = bulkConfirmation.filter(choice => String(choice.invoiceId) !== String(id));
      if (remaining.length) setBulkConfirmation(remaining); else cancelBatch();
    }
  };
  const resolveBatch = async () => {
    if (busy || stale || !canBulk || !bulkConfirmation?.length || bulkConfirmation.length > limit || bulkConfirmation.some(choice => staleIds.includes(String(choice.invoiceId)))) return;
    const planned = bulkConfirmation, expectedExtras = planned.reduce((sum, choice) => sum + choice.extras, 0);
    setBusy(true); setError(''); setNotice('');
    let resolved = false;
    try {
      const result = await invoiceTrackerService.resolveDuplicateBatch(planned.map(choice => ({ group_token: choice.groupToken, keep_token: choice.keepToken })));
      const valid = result?.resolved_count === planned.length && result?.removed_count === expectedExtras && Array.isArray(result.results) && result.results.length === planned.length && new Set(result.results.map(item => String(item?.invoice_id))).size === planned.length && planned.every(choice => result.results.some(item => String(item?.invoice_id) === String(choice.invoiceId) && item.removed_count === choice.extras));
      if (!valid) throw new Error('The deletion response could not be confirmed. Reload duplicates before continuing.');
      setMessage(`${expectedExtras} duplicate records deleted across ${planned.length} invoice IDs. Each selected copy was kept.`);
      updateBasket(current => omitChoices(current, new Set(planned.map(choice => String(choice.invoiceId)))));
      setBulkConfirmation(null); setReload(value => value + 1); resolved = true;
    } catch (requestError) {
      setError(errorText(requestError)); setBulkConfirmation(null);
      const status = requestError?.response?.status;
      if (status === 409) {
        const supplied = requestError.response.data?.stale_invoice_ids;
        const ids = Array.isArray(supplied) ? supplied.map(String).filter(id => planned.some(choice => String(choice.invoiceId) === id)) : [];
        if (ids.length) {
          updateBasket(current => omitChoices(current, new Set(ids)));
          setStaleIds(current => [...new Set([...current, ...ids])]);
          setNotice(`Invoice IDs ${ids.join(', ')} changed. Their choices were cleared; other reviewed choices are retained.`);
        } else { updateBasket({}); setStale(true); }
      } else if (status === 403) {
        updateBasket({}); setData(current => current ? { ...current, capabilities: { ...current.capabilities, resolve: false, bulk_resolve: false } } : current);
      } else {
        updateBasket(current => omitChoices(current, new Set(planned.map(choice => String(choice.invoiceId))))); setStale(true);
        setNotice('The request outcome could not be confirmed. Reload duplicates and review the current records before trying again.');
      }
    } finally { setBusy(false); }
    if (resolved) onResolved();
  };
  const batchExtras = bulkConfirmation?.reduce((sum, choice) => sum + choice.extras, 0) || 0;

  return <dialog ref={dialog} className="oc-dialog oc-duplicates-dialog" aria-labelledby="oc-duplicates-title" aria-describedby="oc-duplicates-intro" onKeyDown={trapOutgoingDialogFocus} onCancel={event => { event.preventDefault(); if (busy) return; if (bulkConfirmation) cancelBatch(); else if (confirmation) cancelConfirmation(); else onClose(); }}>
    <header><h2 id="oc-duplicates-title">Review duplicate invoices</h2><button type="button" aria-label="Close duplicate review" onClick={onClose} disabled={busy}><XMarkIcon /></button></header>
    <p id="oc-duplicates-intro">Compare records sharing an invoice ID, then choose the copy to keep. Attachments and history stay with the retained invoice ID.</p>
    <form className="oc-duplicates-filter" onSubmit={filter}><label>Invoice ID<input aria-label="Duplicate invoice ID" inputMode="numeric" value={input} onChange={event => setInput(event.target.value)} placeholder="All duplicate IDs" disabled={locked || loading} /></label><button type="submit" className="oc-button" disabled={locked || loading}>Find duplicates</button><button type="button" className="oc-button" onClick={refresh} disabled={locked || loading}>Reload duplicates</button></form>
    <section className="oc-duplicate-basket" aria-label="Selected duplicate groups"><div><strong>{choices.length} invoice IDs selected across all pages</strong><span>{extraCount} extra copies · Up to {limit} invoice IDs per batch</span></div><div><button type="button" className="oc-button" disabled={locked || !choices.length} onClick={() => updateBasket({})}>Clear choices</button><button ref={bulkTrigger} type="button" className="oc-button oc-primary" disabled={locked || loading || !canBulk || !choices.length || choices.length > limit || stale} onClick={() => setBulkConfirmation(choices)}>Review selected ({choices.length})</button></div></section>
    {message && <p className="oc-duplicates-success" role="status">{message}</p>}
    {notice && <p className="oc-duplicates-notice" role="status">{notice}</p>}
    {error && <div className="oc-form-error" role="alert"><p>{error}</p>{(stale || staleIds.length > 0) && <p>Reload duplicates, review the current copies and choose again.</p>}</div>}
    {loading && <p role="status">Loading duplicate invoices…</p>}
    {!loading && data && !canResolve && <p className="oc-duplicates-notice">You can review duplicates. Your access does not allow deleting extra copies.</p>}
    {!loading && data && canResolve && !canBulk && <p className="oc-duplicates-notice">Your access allows cleanup one invoice ID at a time. Bulk cleanup is unavailable.</p>}
    {bulkConfirmation && <section ref={bulkConfirmationRef} tabIndex={-1} className="oc-duplicate-confirm oc-duplicate-bulk-confirm" role="group" aria-label="Confirm selected duplicate cleanup"><h3>Delete {batchExtras} extra copies across {bulkConfirmation.length} invoice IDs?</h3><p>Keep the selected copy for each invoice ID, including its recorded amounts. Attachments and history stay with each retained invoice ID. Deleted copies are saved in a recovery archive.</p><div className="oc-duplicate-table" role="region" aria-label="Selected duplicate cleanup table" tabIndex={0}><table><thead><tr><th scope="col">Invoice ID</th><th scope="col">Copy to keep</th><th scope="col">Invoice amount</th><th scope="col">Extra copies to delete</th><th scope="col">Selection</th></tr></thead><tbody>{bulkConfirmation.map(choice => <tr key={choice.invoiceId}><th scope="row">{choice.invoiceId}</th><td>Copy {choice.copy}: {text(choice.record.invoice_number)}</td><td>{outgoingMoney(choice.record.invoice_amount, choice.record.currency)}</td><td>{choice.extras}</td><td><button type="button" className="oc-button" disabled={busy} aria-label={`Remove invoice ID ${choice.invoiceId} from batch`} onClick={() => removeChoice(choice.invoiceId)}>Remove</button></td></tr>)}</tbody></table></div><p>All selected groups are checked again before any copies are deleted.</p><div><button type="button" className="oc-button" disabled={busy} onClick={cancelBatch}>Cancel batch</button><button type="button" className="oc-button oc-duplicate-delete" disabled={busy} onClick={resolveBatch}>{busy ? 'Deleting…' : `Confirm delete ${batchExtras} extra copies`}</button></div></section>}
    {!loading && !bulkConfirmation && data?.groups.length === 0 && <p className="oc-duplicates-empty">No duplicate invoice IDs {invoiceId ? `match ${invoiceId}` : 'were found'}.</p>}
    {!loading && !bulkConfirmation && data?.groups.map(group => {
      const selected = selection[group.group_token];
      const count = group.record_count - 1;
      const confirming = confirmation?.group.group_token === group.group_token;
      const keepIndex = group.records.findIndex(record => record.record_token === confirmation?.keepToken);
      const blocked = stale || staleIds.includes(String(group.invoice_id));
      return <section className="oc-duplicate-group" key={group.review_key} aria-label={`Duplicate invoice ID ${group.invoice_id}`}>
        <header><h3>Invoice ID {group.invoice_id}</h3><span>{group.record_count} copies · {group.identical ? 'Identical invoice values' : 'Invoice values differ'}</span></header>
        <p>{group.attachments_count ?? 0} attachments will remain with the retained invoice.</p>
        <div className="oc-duplicate-table" role="region" aria-label={`Compare copies for invoice ID ${group.invoice_id}`} tabIndex={0}><table><thead><tr><th scope="col">Invoice field</th>{group.records.map((record, index) => <th scope="col" key={record.record_key}><label><input type="radio" name={`keep-invoice-${group.invoice_id}`} aria-label={`Keep copy ${index + 1} of invoice ID ${group.invoice_id}`} checked={selected === record.record_token} disabled={!canResolve || locked || blocked || (!selected && choices.length >= limit)} onChange={() => choose(group, record, index)} />Keep copy {index + 1}</label></th>)}</tr></thead><tbody>{FIELDS.map(([label, display]) => <tr key={label}><th scope="row">{label}</th>{group.records.map(record => <td key={record.record_key} className={selected === record.record_token ? 'is-kept' : ''}>{display(record)}</td>)}</tr>)}</tbody></table></div>
        {confirming ? <div className="oc-duplicate-confirm" ref={confirmationRef} tabIndex={-1} role="group" aria-label="Confirm duplicate deletion"><h4>Delete {count} extra {count === 1 ? 'copy' : 'copies'}?</h4><p>Keep copy {keepIndex + 1}: <strong>{text(group.records[keepIndex]?.invoice_number)}</strong>, invoice ID {group.invoice_id}. The other {count} {count === 1 ? 'record will' : 'records will'} be deleted.</p><p>Attachments and history stay with invoice ID {group.invoice_id}.</p><p>Deleted copies are saved in a recovery archive.</p><div><button type="button" className="oc-button" disabled={busy} onClick={cancelConfirmation}>Cancel deletion</button><button type="button" className="oc-button oc-duplicate-delete" disabled={busy} onClick={resolve}>{busy ? 'Deleting…' : `Confirm delete ${count} ${count === 1 ? 'duplicate' : 'duplicates'}`}</button></div></div> : <footer><span>{!selected && canResolve ? 'Choose the copy to keep before deleting extras.' : selected ? 'The selected copy will be kept.' : 'Review only'}</span><div>{selected && <button type="button" className="oc-button" disabled={locked} aria-label={`Clear choice for invoice ID ${group.invoice_id}`} onClick={() => removeChoice(group.invoice_id)}>Clear choice</button>}<button ref={element => deleteTriggers.current.set(group.group_token, element)} type="button" className="oc-button oc-duplicate-delete" disabled={!canResolve || !selected || blocked || locked} onClick={() => setConfirmation({ group, keepToken: selected })}>Delete {count} {count === 1 ? 'duplicate' : 'duplicates'}</button></div></footer>}
      </section>;
    })}
    <footer className="oc-duplicates-footer"><span>{data ? `${data.pagination.total_groups} duplicate groups · Page ${page}` : `Page ${page}`}</span><div><button type="button" className="oc-button" disabled={loading || locked || page <= 1} onClick={() => setPage(value => value - 1)}>Previous duplicate page</button><button type="button" className="oc-button" disabled={loading || locked || !data?.pagination.has_next} onClick={() => setPage(value => value + 1)}>Next duplicate page</button><button type="button" className="oc-button" disabled={busy} onClick={onClose}>Close</button></div></footer>
  </dialog>;
}
OutgoingInvoiceDuplicates.propTypes = { initialInvoiceId: PropTypes.string, onClose: PropTypes.func.isRequired, onResolved: PropTypes.func.isRequired };
