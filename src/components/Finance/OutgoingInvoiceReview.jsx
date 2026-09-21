import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  ArrowPathIcon, ArrowRightIcon, ArrowTopRightOnSquareIcon, ClockIcon, DocumentTextIcon,
  EnvelopeIcon, ExclamationTriangleIcon, InformationCircleIcon, PaperClipIcon, UserCircleIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import invoiceTrackerService from '../../services/invoiceTracker.service';
import { outgoingState, outgoingToday } from './outgoingInvoicePresentation';
import {
  outgoingReviewAttachmentUrl, outgoingReviewBalance, outgoingReviewCurrency, outgoingReviewDate, outgoingReviewDateValue, outgoingReviewEmail, outgoingReviewMoney,
  outgoingReviewNumber, outgoingReviewStatus, outgoingReviewSuggestion, outgoingReviewTimeline, outgoingReviewTotal,
} from './outgoingReviewPresentation';
import './OutgoingInvoiceReview.css';

const reviewError = error => {
  if (error?.response?.status === 403) return 'You do not have access to this invoice.';
  if (error?.response?.status === 404) return 'This invoice is no longer available.';
  const detail = error?.response?.data?.detail;
  return typeof detail === 'string' ? detail : 'Invoice details could not be loaded. Please try again.';
};

const Field = ({ label, children, note }) => <div className="outgoing-review-field"><dt>{label}{note && <span tabIndex={0} role="img" aria-label={note} title={note}><InformationCircleIcon aria-hidden="true" /></span>}</dt>
  <dd title={typeof children === 'string' ? children : undefined}>{children ?? 'Not recorded'}</dd>
</div>;
Field.propTypes = { label: PropTypes.string.isRequired, children: PropTypes.node, note: PropTypes.string };

export default function OutgoingInvoiceReview({ invoice, onClose, onOpen, onChanged, asOfDate }) {
  const [request, setRequest] = useState({ source: null, status: 'idle', data: null, error: '' });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!invoice?.id) return undefined;
    let active = true;
    setRequest({ source: invoice, status: 'loading', data: null, error: '' });
    invoiceTrackerService.retrieve(invoice.id).then(data => {
      if (!active) return;
      if (!data || String(data.id) !== String(invoice.id)) throw new Error('Unexpected invoice response.');
      setRequest({ source: invoice, status: 'ready', data, error: '' });
    }).catch(error => {
      if (active) setRequest({ source: invoice, status: 'error', data: null, error: reviewError(error) });
    });
    return () => { active = false; };
  }, [invoice, retry]);

  const current = request.source === invoice ? request : { status: 'loading', data: null, error: '' };
  const ready = current.status === 'ready';
  const data = ready ? current.data : null;
  const identity = data || invoice;
  const reportingDate = asOfDate || outgoingToday();
  const collectionState = identity ? outgoingState(identity, reportingDate) : null;
  const collectionTone = { green: 'success', red: 'danger', amber: 'warning', blue: 'pending', muted: 'neutral' }[collectionState?.tone] || 'neutral';
  const total = outgoingReviewTotal(data);
  const timeline = outgoingReviewTimeline(data);
  const suggestion = outgoingReviewSuggestion(data, outgoingReviewDateValue(reportingDate) || new Date());
  const emailLink = outgoingReviewEmail(data?.finance_pm_email, data?.invoice_number);
  const attachmentsKnown = Array.isArray(data?.attachments);
  const attachments = attachmentsKnown ? data.attachments.filter(item => item && typeof item === 'object' && !Array.isArray(item)) : [];
  const recordedCount = outgoingReviewNumber(data?.attachments_count);
  const attachmentCount = recordedCount !== null && recordedCount >= 0 && Number.isInteger(recordedCount) ? recordedCount : attachmentsKnown ? attachments.length : null;
  const open = () => { if (ready) onOpen(data); };
  const refresh = () => { setRetry(value => value + 1); onChanged?.(); };

  return <aside className="outgoing-review" aria-label="Collection review" data-testid="outgoing-invoice-review">
    <header className="outgoing-review-header"><h2><DocumentTextIcon aria-hidden="true" />Collection review</h2>
      {invoice && <button type="button" className="outgoing-review-icon-button" onClick={onClose} aria-label="Close collection review"><XMarkIcon aria-hidden="true" /></button>}
    </header>
    {!invoice ? <div className="outgoing-review-state"><DocumentTextIcon aria-hidden="true" /><h3>Select an invoice</h3><p>Review its balance, collection dates and supporting documents.</p></div>
      : <>
        <div className="outgoing-review-identity"><div><h3>{identity.invoice_number || 'Invoice number not recorded'}</h3><p title={identity.account || undefined}>{identity.account || 'Customer account not recorded'}</p></div>
          <span className="outgoing-review-status" data-tone={collectionTone} title={`Collection status as at ${outgoingReviewDate(reportingDate)}. Recorded payment status: ${outgoingReviewStatus(identity.payment_status)}.`}>{collectionState.label}</span>
        </div>
        <div className="outgoing-review-body" role="region" aria-label="Collection review details" tabIndex={0} aria-busy={current.status === 'loading'}>
          {current.status === 'loading' ? <div className="outgoing-review-state" role="status"><ArrowPathIcon className="outgoing-review-spinner" aria-hidden="true" /><p>Loading invoice details…</p></div>
            : current.status === 'error' ? <div className="outgoing-review-state outgoing-review-state--error" role="alert"><ExclamationTriangleIcon aria-hidden="true" /><h3>Invoice could not be loaded</h3><p>{current.error}</p>
              <button type="button" className="outgoing-review-button" onClick={() => setRetry(value => value + 1)}>Retry invoice details</button></div>
              : ready && <>
                <section className="outgoing-review-summary"><div><h3>Invoice details</h3><dl><Field label="Invoice date">{outgoingReviewDate(data.invoice_date)}</Field><Field label="Sent date">{outgoingReviewDate(data.invoice_sent_date)}</Field>
                  <Field label="Due date">{outgoingReviewDate(data.due_date)}</Field><Field label="Payment terms">{data.payment_terms || 'Not recorded'}</Field></dl></div>
                  <div className="outgoing-review-payment"><h3>Payment summary</h3><span className="outgoing-review-balance-label">Outstanding</span>
                    <strong className="outgoing-review-balance" data-testid="outgoing-review-outstanding" data-tone={outgoingReviewCurrency(data.currency) && outgoingReviewNumber(outgoingReviewBalance(data)) > 0 && collectionTone === 'danger' ? 'danger' : 'neutral'}>{outgoingReviewMoney(outgoingReviewBalance(data), data.currency)}</strong>
                    {!outgoingReviewCurrency(data.currency) && <p className="outgoing-review-note">Currency not recorded</p>}
                    <dl><Field label={total.label}>{outgoingReviewMoney(total.value, data.currency)}</Field>
                      <Field label="Total received" note="Aggregate amount received on this invoice.">{outgoingReviewMoney(data.actual_payment_received, data.currency)}</Field>
                      {outgoingReviewNumber(data.retention) !== null && <Field label="Retention">{outgoingReviewMoney(data.retention, data.currency)}</Field>}
                    </dl>
                  </div>
                </section>
                <section className="outgoing-review-section"><div className="outgoing-review-section-heading"><h3>Invoice timeline</h3><ClockIcon aria-hidden="true" /></div>
                  {timeline.length ? <ol className="outgoing-review-timeline" data-testid="outgoing-review-timeline">{timeline.map(entry => <li key={entry.id} data-event={entry.id}>
                    <span className="outgoing-review-timeline-dot" aria-hidden="true" /><strong>{entry.label}</strong><span>{outgoingReviewDate(entry.date)}</span>
                  </li>)}</ol> : <p className="outgoing-review-note">No invoice, sent or payment date recorded.</p>}
                  <p className="outgoing-review-audit">Record created {outgoingReviewDate(data.created_at, true)}<br />Updated {outgoingReviewDate(data.updated_at, true)}</p>
                </section>
                <section className="outgoing-review-suggestion" aria-label="Suggested next action" data-testid="outgoing-review-suggestion"><div><InformationCircleIcon aria-hidden="true" /><h3>Suggested next action</h3>
                  <button type="button" onClick={open}>Review details<ArrowRightIcon aria-hidden="true" /></button></div><strong>{suggestion.title}</strong><p>{suggestion.detail}</p>
                </section>
                <section className="outgoing-review-section"><div className="outgoing-review-section-heading"><h3>Project / finance contact</h3><UserCircleIcon aria-hidden="true" /></div>
                  <div className="outgoing-review-contact"><span className="outgoing-review-contact-icon"><UserCircleIcon aria-hidden="true" /></span><div>
                    <p><span>Project manager</span><strong title={data.pm || undefined}>{data.pm || 'Not recorded'}</strong></p>
                    <p><span>Finance / project contact</span>{emailLink ? <a href={emailLink} title={data.finance_pm_email}>{data.finance_pm_email}</a> : <strong>{data.finance_pm_email || 'Not recorded'}</strong>}</p>
                  </div></div>
                </section>
                <section className="outgoing-review-section"><div className="outgoing-review-section-heading"><h3>Invoice remarks</h3><DocumentTextIcon aria-hidden="true" /></div>
                  <div className="outgoing-review-remarks" role="region" aria-label="Invoice remarks" tabIndex={0}><p>{data.remarks || 'No remarks recorded.'}</p></div>
                  {data.details && typeof data.details === 'string' && <details className="outgoing-review-description"><summary>Invoice description</summary><p>{data.details}</p></details>}
                </section>
                <section className="outgoing-review-section outgoing-review-section--attachments"><div className="outgoing-review-section-heading"><h3>Attachments{attachmentCount !== null ? ` (${attachmentCount})` : ''}</h3><PaperClipIcon aria-hidden="true" /></div>
                  {attachments.length ? <ul className="outgoing-review-attachments" data-testid="outgoing-review-attachments">{attachments.slice(0, 2).map((attachment, index) => {
                    const url = outgoingReviewAttachmentUrl(attachment);
                    const filename = attachment.original_filename || 'Attachment';
                    return <li key={attachment.id ?? index}><DocumentTextIcon aria-hidden="true" /><div>{url ? <a href={url} target="_blank" rel="noopener noreferrer" title={filename}>{filename}<ArrowTopRightOnSquareIcon aria-hidden="true" /></a> : <strong title={filename}>{filename}</strong>}
                      <span>{url ? `Uploaded ${outgoingReviewDate(attachment.uploaded_at)}` : 'Document link unavailable'}</span></div></li>;
                  })}</ul> : <p className="outgoing-review-note">{attachmentsKnown && attachmentCount === 0 ? 'No attachments recorded.' : 'Attachment details are unavailable.'}</p>}
                  {(attachments.length > 2 || (attachmentCount !== null && attachmentCount > attachments.length)) && <button type="button" className="outgoing-review-text-button" onClick={open}>View all attachments<ArrowRightIcon aria-hidden="true" /></button>}
                </section>
              </>}
        </div>
        <footer className="outgoing-review-footer"><button type="button" className="outgoing-review-icon-button" onClick={refresh} disabled={current.status === 'loading'} aria-label="Refresh collection review"><ArrowPathIcon aria-hidden="true" /></button>
          {ready && <div>{emailLink && <a className="outgoing-review-button" href={emailLink} title="Email the recorded finance / project contact"><EnvelopeIcon aria-hidden="true" />Email contact</a>}
            <button type="button" className="outgoing-review-button outgoing-review-button--primary" onClick={open}>Open invoice<ArrowRightIcon aria-hidden="true" /></button></div>}
        </footer>
      </>}
  </aside>;
}

OutgoingInvoiceReview.propTypes = { invoice: PropTypes.object, onClose: PropTypes.func.isRequired, onOpen: PropTypes.func.isRequired, onChanged: PropTypes.func, asOfDate: PropTypes.string };
