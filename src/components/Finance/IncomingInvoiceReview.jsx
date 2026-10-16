import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import {
  ArrowPathIcon, ArrowRightIcon, CheckCircleIcon, ClockIcon, DocumentTextIcon,
  ExclamationTriangleIcon, InformationCircleIcon, LinkIcon, PaperClipIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import financeService from '../../services/finance.service';
import InvoicePurchaseOrderMatch from './InvoicePurchaseOrderMatch';
import ConfirmedPurchaseOrderLinks from './ConfirmedPurchaseOrderLinks';
import {
  incomingActivity, incomingAllocationEvaluated, incomingCanResolveMatch, incomingDate,
  incomingMatching, incomingMoney, incomingNumber, incomingOutstanding, incomingStatusLabel, incomingStatusTone,
} from './incomingReviewPresentation';
import './IncomingInvoiceReview.css';

const errorMessage = error => {
  if (error?.response?.status === 403) return 'You do not have access to this invoice.';
  if (error?.response?.status === 404) return 'This invoice is no longer available.';
  const response = error?.response?.data;
  return typeof response?.detail === 'string' ? response.detail : typeof response?.error === 'string' ? response.error
    : 'Invoice details could not be loaded. Please try again.';
};

const Pill = ({ value }) => <span className="incoming-review-pill" data-tone={incomingStatusTone(value)}>{incomingStatusLabel(value)}</span>;
Pill.propTypes = { value: PropTypes.string };

const Field = ({ label, children, emphasis = false, note }) => <div className={`incoming-review-field${emphasis ? ' incoming-review-field--emphasis' : ''}`}>
  <dt>{label}{note && <span title={note} tabIndex={0} role="img" aria-label={note}><InformationCircleIcon aria-hidden="true" /></span>}</dt>
  <dd title={typeof children === 'string' ? children : undefined}>{children ?? 'Not recorded'}</dd>
</div>;
Field.propTypes = { label: PropTypes.string.isRequired, children: PropTypes.node, emphasis: PropTypes.bool, note: PropTypes.string };

const MatchingEvidence = ({ allocations }) => <details className="incoming-review-evidence">
  <summary>View matching evidence <span>{allocations.length} {allocations.length === 1 ? 'allocation' : 'allocations'}</span></summary>
  <div>{allocations.map((allocation, index) => <article key={allocation.id ?? index}>
    <div className="incoming-review-evidence-heading"><strong>{allocation.purchase_order_number || 'Purchase order reference not recorded'}</strong><Pill value={allocation.match_status} /></div>
    <dl>
      <Field label="Allocated">{incomingMoney(allocation.allocated_amount, allocation.currency)}</Field>
      <Field label="Remaining PO value" note="PO value available when this match was evaluated, after other invoice allocations.">{incomingMoney(allocation.match_evidence?.available_po_value, allocation.currency)}</Field>
      <Field label="Allocation variance" note="Allocated amount minus the remaining available PO value at the match check.">{incomingMoney(allocation.amount_variance, allocation.currency)}</Field>
      <Field label="Evaluated">{incomingAllocationEvaluated(allocation) ? incomingDate(allocation.match_evidence?.evaluated_at || allocation.verified_at || allocation.matched_at, true) : 'Not checked'}</Field>
    </dl>
    {incomingAllocationEvaluated(allocation) && Array.isArray(allocation.exception_codes) && allocation.exception_codes.length > 0
      && <ul className="incoming-review-exceptions">{allocation.exception_codes.filter(code => typeof code === 'string').map((code, codeIndex) => <li key={`${code}-${codeIndex}`}>{code.replaceAll('_', ' ')}</li>)}</ul>}
    {allocation.review_notes && typeof allocation.review_notes === 'string' && <p className="incoming-review-note">{allocation.review_notes}</p>}
  </article>)}</div>
</details>;
MatchingEvidence.propTypes = { allocations: PropTypes.array.isRequired };

export default function IncomingInvoiceReview({ invoice, onClose, onRefresh }) {
  const [request, setRequest] = useState({ source: null, status: 'idle', data: null, error: '' });
  const [retry, setRetry] = useState(0);
  const [matchingId, setMatchingId] = useState(null);

  useEffect(() => {
    if (!invoice?.id) return undefined;
    let active = true;
    setRequest({ source: invoice, status: 'loading', data: null, error: '' });
    financeService.getInvoice(invoice.id).then(data => {
      if (!active) return;
      if (!data || String(data.id) !== String(invoice.id)) throw new Error('Unexpected invoice response.');
      setRequest({ source: invoice, status: 'ready', data, error: '' });
    }).catch(error => {
      if (active) setRequest({ source: invoice, status: 'error', data: null, error: errorMessage(error) });
    });
    return () => { active = false; };
  }, [invoice, retry]);

  const current = request.source === invoice ? request : { status: 'loading', data: null, error: '' };
  const ready = current.status === 'ready';
  const data = ready ? current.data : null;
  const identity = data || invoice;
  const fullPath = invoice?.id ? `/finance/incoming-invoices/${encodeURIComponent(invoice.id)}` : null;
  const matching = incomingMatching(data);
  const activity = incomingActivity(data);
  const paid = incomingNumber(data?.paid_amount);
  const outstanding = incomingOutstanding(data);
  const refresh = () => { setRetry(value => value + 1); onRefresh?.(); };

  return <aside className={`incoming-review${!invoice ? ' incoming-review--empty' : ''}`} aria-label="Invoice review" data-testid="incoming-invoice-review">
    <header className="incoming-review-header"><h2><DocumentTextIcon aria-hidden="true" />Invoice review</h2>
      {invoice && <button type="button" className="incoming-review-icon-button" onClick={onClose} aria-label="Close invoice review"><XMarkIcon aria-hidden="true" /></button>}
    </header>
    {!invoice ? <div className="incoming-review-empty"><DocumentTextIcon aria-hidden="true" /><h3>Select an invoice</h3><p>Review its matching evidence, financial details and activity.</p></div>
      : <>
        <div className="incoming-review-identity"><div><h3>{identity.invoice_number || 'Invoice number not recorded'}</h3>
          <p title={identity.vendor_master_name || identity.vendor_name || undefined}>{identity.vendor_master_name || identity.vendor_name || 'Vendor not recorded'}</p></div>
          <Pill value={identity.procurement_status} />
        </div>
        <div className="incoming-review-body" role="region" aria-label="Invoice review details" tabIndex={0} aria-busy={current.status === 'loading'}>
          {current.status === 'loading' ? <div className="incoming-review-state" role="status"><ArrowPathIcon className="incoming-review-spinner" aria-hidden="true" /><p>Loading invoice details…</p></div>
            : current.status === 'error' ? <div className="incoming-review-state incoming-review-state--error" role="alert"><ExclamationTriangleIcon aria-hidden="true" /><h3>Invoice could not be loaded</h3><p>{current.error}</p>
              <button type="button" className="incoming-review-button" onClick={() => setRetry(value => value + 1)}>Retry invoice details</button></div>
              : ready && <>
                <div className="incoming-review-total"><span>Invoice total</span><strong data-testid="incoming-review-total">{incomingMoney(data.total_amount, data.currency)}</strong>
                  <p>Due {incomingDate(data.due_date)}<span aria-hidden="true"> · </span><span>{data.currency?.trim() || 'Currency not recorded'}</span></p>
                </div>
                <section className="incoming-review-section"><div className="incoming-review-section-heading"><h3>Three-way matching</h3><Pill value={data.match_status} /></div>
                  <ul className="incoming-review-match-list">{matching.rows.map(row => {
                    const Icon = row.tone === 'success' ? CheckCircleIcon : row.tone === 'warning' ? ExclamationTriangleIcon : InformationCircleIcon;
                    return <li key={row.id} data-tone={row.tone} data-testid={`incoming-review-match-${row.id}`}><Icon aria-hidden="true" />
                      <div><strong>{row.label}</strong><span title={row.detail}>{row.detail}</span></div><span className="incoming-review-match-status">{row.status}</span></li>;
                  })}</ul>
                  {matching.allocations.length > 0 && <MatchingEvidence allocations={matching.allocations} />}
                  {data.capabilities?.can_allocate_purchase_order === true && <button type="button" className="incoming-review-button" onClick={() => setMatchingId(current => current === data.id ? null : data.id)}>{matchingId === data.id ? 'Cancel PO matching' : 'Match purchase order'}</button>}
                  {matchingId === data.id && <InvoicePurchaseOrderMatch key={data.id} invoice={data} onSaved={() => { setMatchingId(null); refresh(); }} />}
                </section>
                <section className="incoming-review-section"><div className="incoming-review-section-heading"><h3>Financial summary</h3><Pill value={data.payment_status} /></div>
                  <dl><Field label="Net amount">{incomingMoney(data.amount, data.currency)}</Field><Field label="Tax / VAT">{incomingMoney(data.tax_amount, data.currency)}</Field>
                    <Field label="Total amount" emphasis>{incomingMoney(data.total_amount, data.currency)}</Field>
                    <Field label="Due date">{incomingDate(data.due_date)}</Field>
                  </dl>
                  {(paid !== null || outstanding !== null || data.scheduled_payment_date) && <details className="incoming-review-payment-details"><summary>Payment details</summary>
                    <dl className="incoming-review-financial-secondary">
                      {paid !== null && <Field label="Paid">{incomingMoney(paid, data.currency)}</Field>}
                      {outstanding !== null && <Field label="Outstanding" note="Invoice total less recorded paid amount, with a minimum of zero.">{incomingMoney(outstanding, data.currency)}</Field>}
                      {data.scheduled_payment_date && <Field label="Scheduled payment">{incomingDate(data.scheduled_payment_date)}</Field>}
                    </dl>
                  </details>}
                </section>
                <section className="incoming-review-section"><div className="incoming-review-section-heading"><h3>Coding &amp; attachments</h3><PaperClipIcon aria-hidden="true" /></div>
                  <dl className="incoming-review-coding-grid"><Field label="Invoice category">{data.invoice_type_display || incomingStatusLabel(data.invoice_type)}</Field>
                    <Field label="PO reference"><ConfirmedPurchaseOrderLinks invoice={data} fallback="Not recorded" /></Field>
                    <Field label="Currency">{data.currency?.trim() || 'Not recorded'}</Field>
                    <Field label="Cost centre" note="Cost centre coding is not recorded on this invoice.">Not recorded</Field></dl>
                  <div className="incoming-review-attachment" data-testid="incoming-review-source-file"><DocumentTextIcon aria-hidden="true" /><div>
                    {data.source_file_available === true ? <Link to={fullPath}>{data.original_filename || 'Original invoice'}</Link> : <strong>{data.original_filename || 'Original invoice'}</strong>}
                    <span>{data.source_file_available === true ? 'Source invoice available' : data.source_file_available === false ? 'Original file unavailable' : 'File availability not reported'}</span>
                  </div>{data.source_file_available === true && <ArrowRightIcon aria-hidden="true" />}</div>
                </section>
                <section className="incoming-review-section incoming-review-section--activity"><div className="incoming-review-section-heading"><h3>Activity</h3><ClockIcon aria-hidden="true" /></div>
                  {activity.length ? <ol className="incoming-review-timeline" data-testid="incoming-review-activity">{activity.slice(0, 3).map((entry, index) => <li key={`${entry.id}-${index}`}>
                    <span className="incoming-review-timeline-dot" aria-hidden="true" /><div><strong title={entry.title}>{entry.title}</strong><span>{incomingDate(entry.timestamp, true)}</span></div>
                  </li>)}</ol> : <p className="incoming-review-note">{Array.isArray(data.audit_logs) ? 'No activity entries recorded.' : 'Activity is not available.'}</p>}
                  {activity.length > 3 && <Link className="incoming-review-text-link" to={fullPath}>View all {activity.length} activity entries<ArrowRightIcon aria-hidden="true" /></Link>}
                </section>
              </>}
        </div>
        <footer className="incoming-review-footer">
          <button type="button" className="incoming-review-icon-button" onClick={refresh} disabled={current.status === 'loading'} aria-label="Refresh invoice review"><ArrowPathIcon aria-hidden="true" /></button>
          {ready && <div>{incomingCanResolveMatch(data) && <Link className="incoming-review-button" to={fullPath}><LinkIcon aria-hidden="true" />Resolve match</Link>}
            <Link className="incoming-review-button incoming-review-button--primary" to={fullPath}>Review &amp; continue<ArrowRightIcon aria-hidden="true" /></Link></div>}
        </footer>
      </>}
  </aside>;
}

IncomingInvoiceReview.propTypes = { invoice: PropTypes.object, onClose: PropTypes.func.isRequired, onRefresh: PropTypes.func };
