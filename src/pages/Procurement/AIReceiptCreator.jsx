import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { XMarkIcon, CheckIcon, CheckCircleIcon, InformationCircleIcon, ArrowTopRightOnSquareIcon, DocumentDuplicateIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import goodsReceiptsService from '../../services/goodsReceipts.service';
import { PurchaseOrderSelector, handoffError } from '../../components/Procurement/PurchaseOrderHandoff';
import { buildReceivingLines, localReceiptDate, receivingLinePreview, receiptOperation } from './receiptHandoff';
import { receiptReviewDate } from '../../components/Procurement/goodsReceiptReviewPresentation';
import { receiptEntrySummary } from './receiptEntryPresentation';
import ReceiptDeliveryInformation from './ReceiptDeliveryInformation';
import './AIReceiptCreator.css';

const availableOrders = params => goodsReceiptsService.availableOrders({ ...params, queue: 'awaiting' });
const emptyForm = () => ({ delivery_note_number: '', receipt_date: localReceiptDate(), notes: '', reason: '', delivery_location: '', supplier_reference: '', condition: '', exception_reason: '' });
const orderText = value => typeof value === 'string' && value.trim() ? value : '—';

export default function AIReceiptCreator({ isOpen, onClose, onReceiptCreated, initialOrder = null, reconciliation = false }) {
  const dialogRef = useRef(null);
  const anchorRef = useRef(null);
  const itemsRef = useRef(null);
  const reviewRef = useRef(null);
  const busyRef = useRef(false);
  const operation = useRef(null);
  const [order, setOrder] = useState(initialOrder);
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const [retry, setRetry] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const [bounds, setBounds] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [actor, setActor] = useState({ data: null, loading: false });
  const [statusChoice, setStatusChoice] = useState('');
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const close = useCallback(() => { if (!busyRef.current) onCloseRef.current(); }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    let active = true;
    setActor({ data: null, loading: true });
    apiClient.get('/rbac/users/me/', { params: { view: 'profile' } }).then(({ data }) => {
      if (active) setActor({ data, loading: false });
    }).catch(() => { if (active) setActor({ data: null, loading: false }); });
    return () => { active = false; };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return undefined;
    const main = anchorRef.current?.closest('main') || document.querySelector('#application-content main');
    const measure = () => {
      const rect = main?.getBoundingClientRect();
      const left = Math.max(0, rect?.left || 0);
      const top = Math.max(0, rect?.top || 0);
      const next = { left, top, width: Math.max(0, Math.min(rect?.right ?? window.innerWidth, window.innerWidth) - left), height: Math.max(0, Math.min(rect?.bottom ?? window.innerHeight, window.innerHeight) - top) };
      setBounds(current => current && Object.keys(next).every(key => current[key] === next[key]) ? current : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (main) observer.observe(main);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [isOpen]);

  useEffect(() => {
    setOrderDetails(null);
    if (!isOpen || !order?.id) return undefined;
    let active = true;
    // The receiving summary remains the authority for eligibility and balances.
    // This optional read supplies display-only order dates and commercial terms.
    apiClient.get(`/procurement/orders/${encodeURIComponent(order.id)}/`).then(({ data }) => {
      if (active && String(data?.id) === String(order.id)) setOrderDetails(data);
    }).catch(() => { /* Keep known queue metadata when order details are unavailable. */ });
    return () => { active = false; };
  }, [isOpen, order?.id]);

  useEffect(() => {
    if (!isOpen) return;
    setOrder(initialOrder); setSummary(null); setForm(emptyForm()); setDrafts({}); setStatusChoice(''); setError(''); setStale(false); setReviewed(false); operation.current = null;
  }, [isOpen, initialOrder]);
  useEffect(() => {
    if (!isOpen || !order?.id) return undefined;
    let active = true;
    setLoading(true); setSummary(null);
    goodsReceiptsService.receivingSummary(order.id).then(data => {
      if (!active) return;
      if (!Array.isArray(data?.lines) || !data.po_updated_at) throw new Error('Receipt balances are unavailable.');
      setSummary(data); setStale(false);
    }).catch(requestError => { if (active) setError(handoffError(requestError)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOpen, order?.id, retry]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const elements = () => [...(dialogRef.current?.querySelectorAll('button,a[href],summary,input,select,textarea,[tabindex="0"]') || [])].filter(element => !element.matches(':disabled') && element.getClientRects().length);
    const frame = requestAnimationFrame(() => elements()[0]?.focus());
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
      if (event.key !== 'Tab') return;
      const controls = elements();
      if (!controls.length) { event.preventDefault(); dialogRef.current?.focus(); }
      else if (event.shiftKey && (document.activeElement === controls[0] || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); controls.at(-1).focus(); }
      else if (!event.shiftKey && (document.activeElement === controls.at(-1) || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); controls[0].focus(); }
    };
    document.addEventListener('keydown', keydown, true);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', keydown, true); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, [isOpen, close]);

  const change = (name, value) => { setForm(current => ({ ...current, [name]: value })); setReviewed(false); };
  const submit = async event => {
    event.preventDefault();
    if (busyRef.current || loading || stale) return;
    setError('');
    try {
      if (!order?.id || !summary?.po_updated_at || (reconciliation ? summary.can_reconcile !== true : summary.can_record !== true)) throw new Error('This purchase order is not available for receipt.');
      if (!form.receipt_date) throw new Error('Enter a receipt date.');
      const items = buildReceivingLines(summary, drafts);
      const currentProjection = receiptEntrySummary(summary, drafts, orderDetails?.currency || order.currency || summary.currency || '');
      if (!currentProjection.valid) throw new Error(currentProjection.validationMessage);
      const recordedStatus = statusChoice || currentProjection.deliveryStatus;
      if (recordedStatus !== currentProjection.deliveryStatus) throw new Error('Adjust the received quantities to match the selected delivery status.');
      if (!form.delivery_location.trim()) throw new Error('Enter the delivery location.');
      if (!form.condition) throw new Error('Select the delivery condition.');
      if (['partial', 'rejected'].includes(recordedStatus) && !form.exception_reason.trim()) throw new Error('Enter an exception reason for the partial or rejected delivery.');
      if (reconciliation && !form.reason.trim()) throw new Error('Enter a reconciliation reason.');
      if (reconciliation && !reviewed) throw new Error('Review and confirm this receipt reconciliation.');
      const payload = { ...form, delivery_status: recordedStatus, purchase_order: order.id, status: 'pending', expected_po_updated_at: summary.po_updated_at, items_received: items };
      for (const key of ['dimensional_check_passed', 'visual_inspection_passed', 'material_verification_passed', 'quality_check_passed']) payload[key] = null;
      if (!reconciliation) delete payload.reason;
      operation.current = receiptOperation(operation.current, payload);
      busyRef.current = true; setBusy(true);
      const receipt = await goodsReceiptsService.create({ ...payload, operation_key: operation.current.key }, reconciliation);
      if (!receipt?.id || String(receipt.purchase_order) !== String(order.id) || receipt.operation_key !== operation.current.key || !['pending', 'accepted', 'partial', 'rejected'].includes(receipt.status)) throw new Error('The receipt response could not be verified. Refresh before recording again.');
      onReceiptCreated(receipt); onClose();
    } catch (requestError) { setError(handoffError(requestError)); if (requestError?.response?.status === 409) setStale(true); }
    finally { busyRef.current = false; setBusy(false); }
  };
  if (!isOpen) return null;
  const service = summary?.basis === 'service_value';
  const title = reconciliation ? 'Reconcile receipt evidence' : service ? 'Record service acceptance' : 'Record goods receipt';
  const allowed = reconciliation ? summary?.can_reconcile === true : summary?.can_record === true;
  const po = { ...order, ...orderDetails };
  const currency = po.currency || summary?.currency || '';
  const projection = receiptEntrySummary(summary, drafts, currency);
  const deliveryStatus = statusChoice || projection.deliveryStatus || '';
  const deliveryFieldsComplete = !!form.receipt_date && !!form.delivery_location.trim() && !!form.condition && (!['partial', 'rejected'].includes(deliveryStatus) || !!form.exception_reason.trim());
  const deliveryComplete = deliveryFieldsComplete && !!deliveryStatus && deliveryStatus === projection.deliveryStatus;
  const canCopy = allowed && !loading && !stale && summary?.lines.length > 0 && projection.groups.every(group => group.ordered !== null && group.previouslyReceived !== null);
  const ready = allowed && !loading && !stale && deliveryComplete && projection.valid && (!reconciliation || (form.reason.trim() && reviewed));
  const checks = [
    ['Purchase order available', !!order?.id && allowed && !stale && !loading],
    ['Delivery details complete', deliveryComplete],
    ['Quantities within remaining balance', projection.valid],
    ...(reconciliation ? [['Reconciliation reviewed', !!form.reason.trim() && reviewed]] : []),
  ];
  const copyRemaining = () => {
    if (!canCopy) return;
    setDrafts(Object.fromEntries(summary.lines.map(line => [line.line_id, { received: String(line.available) }])));
    setStatusChoice(''); setReviewed(false); setError('');
  };
  const chooseDeliveryStatus = value => {
    if (!canCopy || busy) return;
    if (value === 'full') { copyRemaining(); return; }
    setStatusChoice(value);
    setDrafts(current => Object.fromEntries(Object.entries(current).map(([key, draft]) => [key, { ...draft, rejected: value === 'rejected' ? draft.received : '0' }])));
    setReviewed(false); setError('');
  };
  const focusPanel = ref => { ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); ref.current?.focus({ preventScroll: true }); };
  const status = String(po.status || '').replaceAll('_', ' ');
  return <><span ref={anchorRef} hidden />{createPortal(<><div className="receipt-entry-backdrop" aria-hidden="true" />
    <div ref={dialogRef} tabIndex={-1} className="receipt-entry" style={bounds || undefined} role="dialog" aria-modal="true" aria-labelledby="receipt-create-title" aria-busy={busy}>
      <form onSubmit={submit} className="receipt-entry__form">
        <div className="receipt-entry__body">
          <header className="receipt-entry__header">
            <div><div className="receipt-entry__breadcrumb"><span>Procurement</span><span>/</span><span>Goods Receipts</span><span>/</span><strong>New</strong></div>
              <h1 id="receipt-create-title">{title}</h1><p>Verify the purchase order, delivery details and received {service ? 'service value' : 'quantities'}.</p></div>
            <button type="button" className="receipt-entry__icon-button" aria-label="Close receipt creator" onClick={close} disabled={busy}><XMarkIcon /></button>
          </header>
          <ol className="receipt-entry__steps" aria-label="Receipt progress">
            {['Select purchase order', 'Delivery information', 'Items received', 'Review receipt'].map((label, index) => {
              const done = index === 0 ? !!order && allowed && !stale : index === 1 ? !!order && deliveryFieldsComplete : index === 2 ? projection.valid : false;
              const active = index === (!order ? 0 : !deliveryFieldsComplete ? 1 : !projection.valid || !deliveryComplete ? 2 : 3);
              return <li key={label} className={done ? 'is-complete' : active ? 'is-current' : ''} aria-current={active ? 'step' : undefined}><span className="receipt-entry__step-number">{done ? <CheckIcon /> : index + 1}</span><span>{label}</span></li>;
            })}
          </ol>
          <div className="receipt-entry__info"><InformationCircleIcon /><span>{loading ? 'Loading receipt balances…' : stale ? 'Refresh balances before recording' : order ? 'Purchase order linked' : 'Select a purchase order to begin'}</span><i aria-hidden="true" /> <span>Required fields are marked <b>*</b></span></div>
          {error && <div role="alert" className="receipt-entry__error">{error}</div>}
          {order && (stale || (!summary && !loading)) && <button type="button" className="receipt-entry__button receipt-entry__refresh" disabled={busy} onClick={() => { setError(''); setReviewed(false); setRetry(value => value + 1); }}>Refresh receipt balances</button>}
          {summary && !allowed && <p role="status" className="receipt-entry__error">{summary.blocked_reason || 'This purchase order is not available for receipt.'}</p>}
          <fieldset disabled={busy} className="receipt-entry__grid">
            <section className="receipt-entry__panel receipt-entry__order" aria-labelledby="receipt-order-title">
              <h2 id="receipt-order-title">Purchase order</h2>
              {initialOrder || reconciliation ? <div className="receipt-entry__selected-order"><strong>{order?.po_number || 'Select a purchase order'}</strong></div> : <PurchaseOrderSelector label="Purchase Order" fetchPage={availableOrders} value={order?.id} onChange={selected => { setOrder(selected); setDrafts({}); setStatusChoice(''); setSummary(null); setError(''); setStale(false); setReviewed(false); }} disabled={busy} />}
              {order && <>
                {status && <span className="receipt-entry__badge receipt-entry__order-status">{status}</span>}
                <details className="receipt-entry__order-details" open={(bounds?.width ?? window.innerWidth) > 720}><summary>Purchase order details</summary><dl className="receipt-entry__facts">
                  <div><dt>Supplier</dt><dd>{orderText(po.vendor_name)}</dd></div>
                  <div><dt>Project</dt><dd>{orderText(po.project_display || po.project_number || po.rad_project_no)}</dd></div>
                  <div><dt>PO date</dt><dd>{po.po_date ? receiptReviewDate(po.po_date) : '—'}</dd></div>
                  <div><dt>Expected delivery</dt><dd>{po.expected_delivery ? receiptReviewDate(po.expected_delivery) : '—'}</dd></div>
                  <div><dt>Currency</dt><dd>{currency || '—'}</dd></div>
                  <div><dt>Order value</dt><dd>{typeof po.total_amount === 'string' || typeof po.total_amount === 'number' ? po.total_amount : '—'}</dd></div>
                  <div><dt>Delivery terms</dt><dd>{orderText(po.delivery_terms)}</dd></div>
                  <div><dt>Payment terms</dt><dd>{orderText(po.payment_terms)}</dd></div>
                </dl>
                {summary && <div className="receipt-entry__progress"><h3>Order progress</h3>{projection.groups.map(group => <div key={group.key} className="receipt-entry__progress-group"><span>{group.label}</span><dl><div><dt>Ordered</dt><dd>{group.ordered ?? '—'}</dd></div><div><dt>Previously received</dt><dd>{group.previouslyReceived ?? '—'}</dd></div><div><dt>Remaining</dt><dd>{group.balance ?? '—'}</dd></div></dl></div>)}</div>}
                </details>
                <a className="receipt-entry__link" href={`/procurement/orders/${encodeURIComponent(order.id)}`} target="_blank" rel="noopener noreferrer"><ArrowTopRightOnSquareIcon />Open purchase order</a>
              </>}
            </section>
            <div className="receipt-entry__centre">
              <ReceiptDeliveryInformation form={form} basis={summary?.basis} actor={actor} deliveryStatus={deliveryStatus} onChange={change} onStatusChange={chooseDeliveryStatus} disabled={busy || !canCopy} />
              <section ref={itemsRef} tabIndex={-1} className="receipt-entry__panel receipt-entry__items" aria-labelledby="receipt-items-title">
                <div className="receipt-entry__panel-heading"><h2 id="receipt-items-title">{service ? `Service value (${currency})` : 'Items received'}</h2><button type="button" className="receipt-entry__button" disabled={busy || !canCopy} onClick={copyRemaining}><DocumentDuplicateIcon />{service ? 'Copy remaining value' : 'Copy remaining quantities'}</button></div>
                {loading ? <p role="status" className="receipt-entry__empty">Loading receipt balances…</p> : !order ? <p className="receipt-entry__empty">Select a purchase order to view its items.</p> : summary?.lines.length ? <div className="receipt-entry__table-scroll"><table>
                  <caption className="sr-only">{service ? 'Service value lines' : 'Purchase order lines'}</caption>
                  <thead><tr>{['Description', 'Ordered', 'Previously Received', service ? 'Received Value' : 'Received Quantity', 'Balance Remaining', 'Line Status'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
                  <tbody>{summary.lines.map(line => {
                    const received = drafts[line.line_id]?.received ?? '';
                    const preview = receivingLinePreview(line, received, drafts[line.line_id]?.rejected);
                    const invalid = received !== '' && preview.balance === null;
                    return <tr key={line.line_id}>
                      <th scope="row">{line.description}<small>{service ? currency : line.uom}</small></th>
                      <td>{line.ordered}</td>
                      <td>{preview.previouslyReceived ?? '—'}{Number(line.pending) > 0 && <small>{line.pending} awaiting confirmation</small>}</td>
                      <td><input aria-label={`Received ${service ? 'value' : 'quantity'} for ${line.description}`} aria-invalid={invalid || undefined} disabled={!allowed || stale} type="number" min="0" max={line.available} step="any" placeholder="0" value={received} onChange={event => { const value = event.target.value; setDrafts(current => ({ ...current, [line.line_id]: { received: value, rejected: statusChoice === 'rejected' ? value : '0' } })); setReviewed(false); }} /></td>
                      <td>{preview.balance ?? '—'}</td>
                      <td><span className={`receipt-entry__badge receipt-entry__badge--${preview.status === 'Complete' ? 'complete' : preview.status === 'Partial' ? 'partial' : invalid ? 'invalid' : 'neutral'}`}>{preview.status === 'Complete' && <CheckCircleIcon />}{preview.status || 'Check quantity'}</span>{preview.awaitingConfirmation && <small>Awaiting confirmation</small>}</td>
                    </tr>;
                  })}</tbody>
                  <tfoot>{projection.groups.map(group => <tr key={group.key}><th scope="row">Total · {group.label}</th><td>{group.ordered ?? '—'}</td><td>{group.previouslyReceived ?? '—'}</td><td>{group.received ?? '—'}</td><td>{group.balance ?? '—'}</td><td /></tr>)}</tfoot>
                </table></div> : summary ? <p role="status" className="receipt-entry__empty">No receivable lines are available for this purchase order.</p> : <p className="receipt-entry__empty">Receipt balances are unavailable.</p>}
                {allowed && !loading && !stale && !projection.valid && Object.values(drafts).some(draft => draft.received !== '') && <p className="receipt-entry__validation">{projection.validationMessage}</p>}
              </section>
              <section className="receipt-entry__panel receipt-entry__notes" aria-labelledby="receipt-notes-title"><h2 id="receipt-notes-title">Notes</h2><label>Remarks<textarea rows={3} placeholder="Add delivery remarks…" value={form.notes} onChange={event => change('notes', event.target.value)} /></label>
                {reconciliation && <div className="receipt-entry__reconciliation"><label>Reconciliation reason<textarea required rows={2} value={form.reason} onChange={event => change('reason', event.target.value)} /></label><label className="receipt-entry__checkbox"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />I reviewed the quantities or service value and confirm this receipt evidence.</label></div>}
              </section>
            </div>
            <section ref={reviewRef} tabIndex={-1} className="receipt-entry__panel receipt-entry__review" aria-labelledby="receipt-review-title">
              <h2 id="receipt-review-title">Receipt review</h2>
              <div className={`receipt-entry__readiness ${ready ? 'is-ready' : ''}`} aria-live="polite">{ready ? <CheckCircleIcon /> : <InformationCircleIcon />}<strong>{ready ? 'Ready to record' : stale ? 'Balance refresh required' : 'Complete receipt details'}</strong></div>
              <h3>Validation checklist</h3><ul className="receipt-entry__checklist">{checks.map(([label, passed]) => <li key={label}><span className={passed ? 'is-passed' : ''} aria-hidden="true">{passed ? <CheckIcon /> : null}</span><span className="sr-only">{passed ? 'Complete: ' : 'Required: '}</span>{label}</li>)}</ul>
              <h3>Receipt outcome</h3><div className="receipt-entry__outcome"><span className="receipt-entry__outcome-dot" /><div><strong>{projection.valid ? projection.deliveryStatus === 'rejected' ? 'Rejected delivery recorded for review' : projection.complete ? 'Remaining balance entered' : 'Partial receipt' : 'Awaiting quantities'}</strong><p>{projection.valid ? projection.deliveryStatus === 'rejected' ? 'Awaiting authorized rejection review.' : 'Awaiting confirmation after recording.' : 'Enter received quantities to review.'}</p></div></div>
              <h3>Summary</h3><dl className="receipt-entry__facts receipt-entry__summary">
                <div><dt>Receipt number</dt><dd>Auto-generated</dd></div>
                <div><dt>PO number</dt><dd>{order?.po_number || '—'}</dd></div>
                <div><dt>Supplier</dt><dd>{orderText(po.vendor_name)}</dd></div>
                <div><dt>Receipt date</dt><dd>{form.receipt_date ? receiptReviewDate(form.receipt_date) : '—'}</dd></div>
                <div><dt>Lines entered</dt><dd>{projection.enteredLineCount}</dd></div>
                {projection.groups.map(group => <div key={group.key}><dt>Received ({group.label})</dt><dd>{group.received ?? '—'}</dd></div>)}
              </dl>
              <button type="button" className="receipt-entry__button receipt-entry__review-button" onClick={() => focusPanel(itemsRef)}>Review quantities<ChevronRightIcon /></button>
            </section>
          </fieldset>
        </div>
        <footer className="receipt-entry__footer"><button type="button" disabled={busy} onClick={close} className="receipt-entry__button">Cancel</button><span className={`receipt-entry__footer-status ${ready ? 'is-ready' : ''}`}>{ready ? <CheckCircleIcon /> : <InformationCircleIcon />}{ready ? 'All required information complete' : stale ? 'Refresh receipt balances' : 'Complete the required information'}</span><button type="submit" disabled={busy || loading || stale || !allowed || !summary?.lines.length || (reconciliation && !reviewed)} className="receipt-entry__button receipt-entry__submit"><CheckIcon />{busy ? 'Recording…' : reconciliation ? 'Record reconciliation' : 'Record receipt'}</button></footer>
      </form>
    </div></>, document.body)}</>;
}
AIReceiptCreator.propTypes = { isOpen: PropTypes.bool, onClose: PropTypes.func.isRequired, onReceiptCreated: PropTypes.func.isRequired, initialOrder: PropTypes.object, reconciliation: PropTypes.bool };
