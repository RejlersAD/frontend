import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { XMarkIcon } from '@heroicons/react/24/outline';
import invoiceTrackerService from '../../services/invoiceTracker.service';
import { CURRENCIES } from '../../config/invoiceTracker.config';
import { outgoingToday } from './outgoingInvoicePresentation';

const initial = () => ({ invoice_number: '', category: 'external', account: '', company: '', rad_project_no: '', project_name: '', invoice_date: outgoingToday(), due_date: '', payment_terms: '', currency: '', invoice_amount: '', remarks: '' });
export function trapOutgoingDialogFocus(event) {
  if (event.key !== 'Tab') return;
  const fields = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]')].filter(element => element.getClientRects().length > 0);
  const first = fields[0]; const last = fields[fields.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}
export default function OutgoingInvoiceCreate({ open, onClose, onCreated }) {
  const dialog = useRef(null);
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) { setValues(initial()); setError(''); dialog.current?.showModal(); }
    else dialog.current?.close();
  }, [open]);
  const change = event => setValues(current => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async event => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const payload = { ...values, invoice_number: values.invoice_number.trim(), account: values.account.trim(), invoice_amount: values.invoice_amount, grand_total: values.invoice_amount, actual_payment_received: '0.00', payment_status: 'pending' };
      if (!payload.invoice_number || !payload.account) throw new Error('Enter an invoice number and customer.');
      const invoice = await invoiceTrackerService.create(payload);
      if (invoice?.id == null) throw new Error('The invoice was submitted but its reference was not returned. Check the register before retrying.');
      onCreated(invoice);
    } catch (requestError) {
      const data = requestError?.response?.data;
      setError(data && typeof data === 'object' ? Object.entries(data).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${Array.isArray(value) ? value.join(' ') : value}`).join(' · ') : requestError.message || 'The invoice could not be created.');
    } finally { setBusy(false); }
  };
  const field = (label, name, type = 'text', required = false, extra = {}) => <label>{label}<input name={name} aria-label={label} type={type} value={values[name]} onChange={change} required={required} {...extra} /></label>;
  return <dialog ref={dialog} className="oc-dialog oc-create-dialog" aria-labelledby="oc-create-title" onKeyDown={trapOutgoingDialogFocus} onCancel={event => { if (busy) event.preventDefault(); else onClose(); }}>
    <header><h2 id="oc-create-title">Create customer invoice</h2><button type="button" aria-label="Close create invoice" disabled={busy} onClick={onClose}><XMarkIcon /></button></header>
    <p>Create a receivable in the invoice register. The invoice total includes applicable tax; no customer email is sent.</p>
    <form onSubmit={submit}><fieldset disabled={busy}>
      {field('Invoice number', 'invoice_number', 'text', true, { maxLength: 64 })}{field('Customer / account', 'account', 'text', true, { maxLength: 256 })}
      <label>Category<select aria-label="Invoice category" name="category" value={values.category} onChange={change}><option value="external">External (Customer)</option><option value="internal">Internal (Rejlers Group)</option></select></label>
      {field('Company', 'company', 'text', false, { maxLength: 256 })}{field('Project reference', 'rad_project_no', 'text', false, { maxLength: 64 })}{field('Project name', 'project_name')}
      {field('Invoice date', 'invoice_date', 'date', true)}{field('Due date', 'due_date', 'date', true)}{field('Payment terms', 'payment_terms', 'text', false, { maxLength: 64 })}
      <label>Currency<select aria-label="Invoice currency" name="currency" value={values.currency} onChange={change} required><option value="">Select currency</option>{CURRENCIES.filter(item => item.value).map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      {field('Invoice total (including tax)', 'invoice_amount', 'number', true, { min: '0.01', step: '0.01', max: '9999999999999999.99' })}
      <label className="oc-create-wide">Notes<textarea aria-label="Invoice notes" name="remarks" value={values.remarks} onChange={change} rows={2} /></label>
    </fieldset>{error && <p className="oc-form-error" role="alert">{error}</p>}<footer><button type="button" className="oc-button" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="oc-button oc-primary" disabled={busy}>{busy ? 'Creating…' : 'Create invoice'}</button></footer></form>
  </dialog>;
}
OutgoingInvoiceCreate.propTypes = { open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, onCreated: PropTypes.func.isRequired };
