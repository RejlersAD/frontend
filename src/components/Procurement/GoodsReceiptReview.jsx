import { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { ArchiveBoxIcon, ArrowPathIcon, ArrowRightIcon, ArrowTopRightOnSquareIcon, CheckCircleIcon, ClockIcon, DocumentTextIcon, ExclamationTriangleIcon, InformationCircleIcon, PaperClipIcon, PrinterIcon, ShieldCheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import GoodsReceiptActions from './GoodsReceiptActions';
import { RECEIPT_QUANTITY_FIELDS, receiptReviewAttachment, receiptReviewChecklist, receiptReviewDate, receiptReviewDeclarations, receiptReviewQuantities, receiptReviewQuantity, receiptReviewStatus, receiptReviewText, receiptReviewTimeline } from './goodsReceiptReviewPresentation';
import './GoodsReceiptReview.css';

const failureMessage = error => error?.response?.status === 403 ? 'You do not have access to this receipt.' : error?.response?.status === 404 ? 'This receipt is no longer available.' : 'Receipt details could not be loaded. Please try again.';
const Field = ({ label, value }) => <div className="goods-receipt-review-field"><dt>{label}</dt><dd title={receiptReviewText(value) || undefined}>{receiptReviewText(value) || 'Not recorded'}</dd></div>;
Field.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.string };
const Heading = ({ children, icon: Icon }) => <div className="goods-receipt-review-section-heading"><h3>{children}</h3><Icon aria-hidden="true" /></div>;
Heading.propTypes = { children: PropTypes.node.isRequired, icon: PropTypes.elementType.isRequired };
const SECTIONS = [['delivery', 'Delivery details'], ['items', 'Items & evidence'], ['acceptance', 'Review & confirm']];
const DELIVERY_CONDITIONS = new Map([['good', 'Accepted with no damage'], ['damaged', 'Damage observed'], ['not_inspected', 'Not inspected']]);
const DELIVERY_STATUSES = new Map([['full', 'Full'], ['partial', 'Partial'], ['rejected', 'Rejected']]);
const deliveryFields = receipt => [
  ['Delivery location', receiptReviewText(receipt?.delivery_location)],
  ['Supplier reference', receiptReviewText(receipt?.supplier_reference)],
  ['Condition (delivery)', DELIVERY_CONDITIONS.get(receiptReviewText(receipt?.condition)) || receiptReviewText(receipt?.condition)],
  ['Delivery status (declared)', DELIVERY_STATUSES.get(receiptReviewText(receipt?.delivery_status)) || receiptReviewText(receipt?.delivery_status)],
  ['Exception reason', receiptReviewText(receipt?.exception_reason)],
].filter(([, value]) => value);

export default function GoodsReceiptReview({ receipt, onClose, onOpen, onDelete, onPrint, onChanged, capabilities, asOfDate }) {
  const [request, setRequest] = useState({ source: null, state: 'idle', data: null, error: '' });
  const [retry, setRetry] = useState(0);
  const [unitSelection, setUnitSelection] = useState({ source: null, id: '' });
  const [sectionSelection, setSectionSelection] = useState({ source: null, id: 'delivery' });
  const sectionRefs = useRef({});
  const sectionPrefix = useId();
  useEffect(() => {
    if (!receipt?.id) return undefined;
    let active = true;
    const controller = new AbortController();
    setRequest({ source: receipt, state: 'loading', data: null, error: '' });
    apiClient.get(`/procurement/receipts/${encodeURIComponent(receipt.id)}/`, { signal: controller.signal, timeout: 30000 }).then(response => {
      if (!active) return;
      if (!response.data || String(response.data.id) !== String(receipt.id)) throw new Error('Unexpected receipt response.');
      setRequest({ source: receipt, state: 'ready', data: response.data, error: '' });
    }).catch(error => { if (active) setRequest({ source: receipt, state: 'error', data: null, error: failureMessage(error) }); });
    return () => { active = false; controller.abort(); };
  }, [receipt, retry]);
  const current = request.source === receipt ? request : { state: 'loading', data: null, error: '' };
  const ready = current.state === 'ready';
  const data = ready ? current.data : null;
  const identity = data || receipt;
  const status = receiptReviewStatus(identity);
  const quantities = receiptReviewQuantities(data);
  const selectedGroup = quantities.groups.find(group => unitSelection.source === receipt && group.id === unitSelection.id) || quantities.groups[0];
  const serviceValues = quantities.rows.some(row => row.basis === 'service_value');
  const bases = [...new Set(quantities.rows.map(row => row.basis))];
  const receiptBasis = bases.length === 1 ? ({ quantity: 'Quantity', service_value: 'Service value' })[bases[0]] : bases.length > 1 && bases.every(basis => ['quantity', 'service_value'].includes(basis)) ? 'Mixed basis' : null;
  const checklist = receiptReviewChecklist(data);
  const timeline = receiptReviewTimeline(data);
  const heatNumbers = receiptReviewDeclarations(data?.heat_numbers);
  const certificates = receiptReviewDeclarations(data?.certificates_received);
  const attachmentsKnown = Array.isArray(data?.attachments);
  const attachments = attachmentsKnown ? data.attachments.map(receiptReviewAttachment).filter(Boolean) : [];
  const access = { ...capabilities, ...data?.capabilities };
  const activeSection = sectionSelection.source === receipt ? sectionSelection.id : 'delivery';
  const open = () => { if (ready) onOpen(data); };
  const refresh = () => { setRetry(value => value + 1); onChanged?.(); };
  const navigate = id => {
    setSectionSelection({ source: receipt, id });
    sectionRefs.current[id]?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    sectionRefs.current[id]?.focus({ preventScroll: true });
  };

  return <aside className="goods-receipt-review" aria-label="Goods receipt review" data-testid="goods-receipt-review">
    <header className="goods-receipt-review-header">
      <h2>Delivery confirmation</h2>
      {receipt && <button type="button" className="goods-receipt-review-icon-button" aria-label="Close receipt review" onClick={onClose}><XMarkIcon aria-hidden="true" /></button>}
    </header>
    {!receipt ? <div className="goods-receipt-review-state"><ArchiveBoxIcon aria-hidden="true" /><h3>Select a receipt</h3><p>Review delivery details, received items and supporting evidence.</p></div> : <>
      <dl className="goods-receipt-review-identity">
        <div><dt>PO Number</dt><dd>{identity.purchase_order ? <a href={`/procurement/orders/${encodeURIComponent(identity.purchase_order)}`}>{receiptReviewText(identity.po_number) || 'Open purchase order'}</a> : receiptReviewText(identity.po_number) || 'Not recorded'}</dd></div>
        <div><dt>Supplier</dt><dd title={receiptReviewText(identity.vendor_name) || undefined}>{receiptReviewText(identity.vendor_name) || 'Not recorded'}</dd></div>
        <div><dt>Status</dt><dd><span className="goods-receipt-review-status" data-tone={status.tone}>{status.tone === 'accepted' ? <CheckCircleIcon aria-hidden="true" /> : status.tone === 'rejected' ? <ExclamationTriangleIcon aria-hidden="true" /> : <ClockIcon aria-hidden="true" />}{status.label}</span></dd></div>
      </dl>
      <nav className="goods-receipt-review-steps" aria-label="Receipt sections">
        {SECTIONS.map(([id, label], index) => <button type="button" key={id} disabled={!ready} aria-controls={`${sectionPrefix}-${id}`} aria-current={activeSection === id ? 'location' : undefined} onClick={() => navigate(id)}><span aria-hidden="true">{index + 1}</span>{label}</button>)}
      </nav>
      <div className="goods-receipt-review-body" role="region" aria-label="Receipt review details" tabIndex={0} aria-busy={current.state === 'loading'}>
        {current.state === 'loading' ? <div className="goods-receipt-review-state" role="status"><ArrowPathIcon className="goods-receipt-review-spinner" aria-hidden="true" /><p>Loading receipt details…</p></div> : current.state === 'error' ? <div className="goods-receipt-review-state" role="alert"><ExclamationTriangleIcon aria-hidden="true" /><h3>Receipt could not be loaded</h3><p>{current.error}</p><button type="button" className="goods-receipt-review-button" onClick={() => setRetry(value => value + 1)}>Retry receipt details</button></div> : ready && <>
          <section id={`${sectionPrefix}-delivery`} ref={element => { sectionRefs.current.delivery = element; }} tabIndex={-1} className="goods-receipt-review-section goods-receipt-review-summary">
            <Heading icon={ArchiveBoxIcon}>Delivery details</Heading>
            <dl className="goods-receipt-review-delivery-fields">
              <Field label="Receipt basis" value={receiptBasis} />
              <Field label="Receipt date" value={receiptReviewDate(data.receipt_date)} />
              <Field label="Received by" value={data.received_by_name} />
              <Field label="Delivery note" value={data.delivery_note_number} />
              {deliveryFields(data).map(([label, value]) => <Field key={label} label={label} value={value} />)}
              <Field label="Project" value={[data.project_number, data.project_name].map(receiptReviewText).filter(Boolean).join(' · ')} />
              <Field label="Receipt number" value={data.receipt_number} />
            </dl>
          </section>
          <section id={`${sectionPrefix}-items`} ref={element => { sectionRefs.current.items = element; }} tabIndex={-1} className="goods-receipt-review-section">
            <Heading icon={ArchiveBoxIcon}>{serviceValues ? 'Service acceptance value' : 'Receipt summary'}</Heading>
            {quantities.groups.length > 1 && <label className="goods-receipt-review-unit">Recorded unit<select aria-label="Quantity unit" value={selectedGroup?.id || ''} onChange={event => setUnitSelection({ source: receipt, id: event.target.value })}>{quantities.groups.map(group => <option key={group.id} value={group.id}>{group.label}</option>)}</select></label>}
            <div className="goods-receipt-review-quantities" data-testid="receipt-quantity-tiles">{RECEIPT_QUANTITY_FIELDS.slice(0, 3).map(([id, label]) => <div key={id} data-quantity={id}><span>{label}</span><strong>{receiptReviewQuantity(selectedGroup?.values[id])}<small>{selectedGroup?.unit || 'Unit not recorded'}</small></strong></div>)}</div>
            {quantities.rows.length > 0 ? <div className="goods-receipt-review-table-scroll" tabIndex={0} role="region" aria-label="Receipt line quantities"><table><thead><tr><th>Item / Service</th><th>Unit</th>{RECEIPT_QUANTITY_FIELDS.map(([id, label]) => <th key={id}>{label}</th>)}</tr></thead><tbody>{quantities.rows.map((row, index) => <tr key={row.po_line_id || index}><td data-table-text="primary">{receiptReviewText(row.item) || receiptReviewText(row.description) || `Line ${index + 1}`}</td><td>{receiptReviewText(row.uom) || 'Not recorded'}</td>{RECEIPT_QUANTITY_FIELDS.map(([id]) => <td key={id}>{receiptReviewQuantity(row[id])}</td>)}</tr>)}</tbody></table></div> : <p className="goods-receipt-review-note">No item quantities are recorded.</p>}
            <p className="goods-receipt-review-note">{data.status === 'pending' ? 'Received quantities await confirmation. Accepted quantities are not yet recorded.' : 'Values cover this receipt only. Quantities with different units are shown separately.'}</p>
          </section>
          <section className="goods-receipt-review-section">
            <Heading icon={PaperClipIcon}>Evidence{attachmentsKnown ? ` (${data.attachments.length})` : ''}</Heading>
            {attachments.length > 0 ? <ul className="goods-receipt-review-attachments" data-testid="receipt-attachments">{attachments.slice(0, 2).map(attachment => <li key={attachment.id}><DocumentTextIcon aria-hidden="true" />{attachment.url ? <a href={attachment.url} target="_blank" rel="noopener noreferrer" title={attachment.name}>{attachment.name}<ArrowTopRightOnSquareIcon aria-hidden="true" /></a> : <span>{attachment.name}<small>Document link not recorded</small></span>}</li>)}</ul> : <div className="goods-receipt-review-evidence-empty"><PaperClipIcon aria-hidden="true" /><p>{attachmentsKnown && data.attachments.length === 0 ? 'No attachments recorded.' : 'Attachment details are unavailable.'}<small>Delivery note: {receiptReviewText(data.delivery_note_number) || 'Not recorded'}</small></p></div>}
            {attachments.length > 2 && <button type="button" className="goods-receipt-review-text-button" onClick={open}>View all attachments<ArrowRightIcon aria-hidden="true" /></button>}
          </section>
          <section id={`${sectionPrefix}-acceptance`} ref={element => { sectionRefs.current.acceptance = element; }} tabIndex={-1} className="goods-receipt-review-section goods-receipt-review-acceptance">
            <Heading icon={CheckCircleIcon}>Acceptance</Heading>
            <dl className="goods-receipt-review-acceptance-fields">
              <Field label="Receipt result" value={status.label} />
              <Field label="Delivery confirmation by" value={data.confirmation?.responsible_user_name} />
              {data.confirmation?.confirmed_at && <><Field label="Confirmed by" value={data.confirmation.confirmed_by_name} /><Field label="Confirmed at" value={receiptReviewDate(data.confirmation.confirmed_at, true)} /></>}
              {receiptReviewText(data.notes) && <Field label="Remarks" value={data.notes} />}
              {receiptReviewText(data.rejection_reason) && <Field label="Rejection reason" value={data.rejection_reason} />}
            </dl>
            <p className="goods-receipt-review-confirmation-note"><InformationCircleIcon aria-hidden="true" /><span>{data.confirmation?.confirmed_at ? 'Delivery confirmation is recorded against this receipt and its purchase order.' : 'The saved receipt recorder confirms delivery. Technical inspection is assessed separately.'}</span></p>
            <GoodsReceiptActions receipt={data} onOpen={open} onDelete={onDelete} />
          </section>
          <details className="goods-receipt-review-advanced">
            <summary>Technical checks &amp; receipt history</summary>
            <section className="goods-receipt-review-section">
              <Heading icon={ShieldCheckIcon}>Inspection checklist</Heading>
              <dl><Field label="Technical inspector" value={data.inspector_name} /><Field label="Inspection agency" value={data.inspection_agency} /></dl>
              <ul className="goods-receipt-review-checklist" data-testid="receipt-inspection-checklist">{checklist.map(row => <li key={row.id} data-check={row.id}><span>{row.label}</span><span className="goods-receipt-review-evidence" data-tone={row.tone}>{row.value}<span tabIndex={0} role="img" title={row.detail} aria-label={row.detail}><InformationCircleIcon aria-hidden="true" /></span></span></li>)}</ul>
              <p className="goods-receipt-review-note">Recorded check flags do not establish verified inspection results.</p>
              {(receiptReviewText(data.inspection_notes) || receiptReviewText(data.ndt_results)) && <div className="goods-receipt-review-recorded-notes">{receiptReviewText(data.inspection_notes) && <p>{data.inspection_notes}</p>}{receiptReviewText(data.ndt_results) && <p><strong>NDT: </strong>{data.ndt_results}</p>}</div>}
            </section>
            <section className="goods-receipt-review-section">
              <Heading icon={DocumentTextIcon}>Traceability &amp; certificates</Heading>
              <dl><Field label="Inspection report" value={data.inspection_report_number} /><Field label="Heat numbers" value={heatNumbers.join(', ')} /><Field label="Certificates declared" value={certificates.join(', ')} /></dl>
              {data.evidence?.traceability?.status === 'missing' && <p className="goods-receipt-review-attention">{receiptReviewText(data.evidence.traceability.reason) || 'Required heat-number declarations are missing.'}</p>}
              <p className="goods-receipt-review-note">No linked NCR register is available for this receipt.</p>
            </section>
            <section className="goods-receipt-review-section">
              <Heading icon={ClockIcon}>Receipt timeline</Heading>
              {timeline.length ? <ol className="goods-receipt-review-timeline" data-testid="receipt-timeline">{timeline.map(row => <li key={row.id} data-event={row.id}><span aria-hidden="true" /><strong>{row.label}</strong><time>{receiptReviewDate(row.date, row.time)}</time></li>)}</ol> : <p className="goods-receipt-review-note">No receipt dates are recorded.</p>}
            </section>
          </details>
        </>}
      </div>
      <footer className="goods-receipt-review-footer"><button type="button" className="goods-receipt-review-icon-button" aria-label="Refresh receipt review" title={asOfDate ? `Reporting date: ${receiptReviewDate(asOfDate)}` : 'Refresh receipt review'} onClick={refresh} disabled={current.state === 'loading'}><ArrowPathIcon aria-hidden="true" /></button><div>{ready && <>{access.export === true && onPrint && <button type="button" className="goods-receipt-review-button" onClick={() => onPrint(data)}><PrinterIcon aria-hidden="true" />Print receipt</button>}<button type="button" className="goods-receipt-review-button goods-receipt-review-button--primary" onClick={open}>Open receipt<ArrowRightIcon aria-hidden="true" /></button></>}</div></footer>
    </>}
  </aside>;
}
GoodsReceiptReview.propTypes = { receipt: PropTypes.object, onClose: PropTypes.func.isRequired, onOpen: PropTypes.func.isRequired, onDelete: PropTypes.func.isRequired, onPrint: PropTypes.func, onChanged: PropTypes.func, capabilities: PropTypes.object, asOfDate: PropTypes.string };
