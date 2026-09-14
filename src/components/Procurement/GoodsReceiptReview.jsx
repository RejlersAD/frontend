import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { ArchiveBoxIcon, ArrowPathIcon, ArrowRightIcon, ArrowTopRightOnSquareIcon, ClipboardDocumentCheckIcon, ClockIcon, DocumentTextIcon, ExclamationTriangleIcon, InformationCircleIcon, PaperClipIcon, PrinterIcon, ShieldCheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import { RECEIPT_QUANTITY_FIELDS, receiptReviewAttachment, receiptReviewChecklist, receiptReviewDate, receiptReviewDeclarations, receiptReviewQuantities, receiptReviewQuantity, receiptReviewStatus, receiptReviewText, receiptReviewTimeline } from './goodsReceiptReviewPresentation';
import './GoodsReceiptReview.css';

const failureMessage = error => error?.response?.status === 403 ? 'You do not have access to this receipt.' : error?.response?.status === 404 ? 'This receipt is no longer available.' : 'Receipt details could not be loaded. Please try again.';
const Field = ({ label, value }) => <div className="goods-receipt-review-field"><dt>{label}</dt><dd title={receiptReviewText(value) || undefined}>{receiptReviewText(value) || 'Not recorded'}</dd></div>;
Field.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.string };
const Heading = ({ children, icon: Icon }) => <div className="goods-receipt-review-section-heading"><h3>{children}</h3><Icon aria-hidden="true" /></div>;
Heading.propTypes = { children: PropTypes.node.isRequired, icon: PropTypes.elementType.isRequired };

export default function GoodsReceiptReview({ receipt, onClose, onOpen, onPrint, onChanged, capabilities, asOfDate }) {
  const [request, setRequest] = useState({ source: null, state: 'idle', data: null, error: '' });
  const [retry, setRetry] = useState(0);
  const [unitSelection, setUnitSelection] = useState({ source: null, id: '' });
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
  const context = data || {};
  const quantities = receiptReviewQuantities(data);
  const selectedGroup = quantities.groups.find(group => unitSelection.source === receipt && group.id === unitSelection.id) || quantities.groups[0];
  const checklist = receiptReviewChecklist(data);
  const timeline = receiptReviewTimeline(data);
  const heatNumbers = receiptReviewDeclarations(data?.heat_numbers);
  const certificates = receiptReviewDeclarations(data?.certificates_received);
  const attachmentsKnown = Array.isArray(data?.attachments);
  const attachments = attachmentsKnown ? data.attachments.map(receiptReviewAttachment).filter(Boolean) : [];
  const access = { ...capabilities, ...data?.capabilities };
  const open = () => { if (ready) onOpen(data); };
  const refresh = () => { setRetry(value => value + 1); onChanged?.(); };

  return <aside className="goods-receipt-review" aria-label="Goods receipt review" data-testid="goods-receipt-review">
    <header className="goods-receipt-review-header"><h2><ClipboardDocumentCheckIcon aria-hidden="true" />Receipt review</h2>{receipt && <button type="button" className="goods-receipt-review-icon-button" aria-label="Close receipt review" onClick={onClose}><XMarkIcon aria-hidden="true" /></button>}</header>
    {!receipt ? <div className="goods-receipt-review-state"><ArchiveBoxIcon aria-hidden="true" /><h3>Select a receipt</h3><p>Review receiving quantities, inspection records and supporting documents.</p></div> : <>
      <div className="goods-receipt-review-identity"><div><h3>{identity.receipt_number || 'Receipt number not recorded'}</h3><p>{data ? receiptReviewText(context.vendor_name) || 'Vendor not recorded' : 'Loading receipt details…'}</p></div><span className="goods-receipt-review-status" data-tone={status.tone}>{status.label}</span></div>
      <div className="goods-receipt-review-body" role="region" aria-label="Receipt review details" tabIndex={0} aria-busy={current.state === 'loading'}>
        {current.state === 'loading' ? <div className="goods-receipt-review-state" role="status"><ArrowPathIcon className="goods-receipt-review-spinner" aria-hidden="true" /><p>Loading receipt details…</p></div> : current.state === 'error' ? <div className="goods-receipt-review-state" role="alert"><ExclamationTriangleIcon aria-hidden="true" /><h3>Receipt could not be loaded</h3><p>{current.error}</p><button type="button" className="goods-receipt-review-button" onClick={() => setRetry(value => value + 1)}>Retry receipt details</button></div> : ready && <>
          <section className="goods-receipt-review-section goods-receipt-review-summary"><dl>
            <Field label="Purchase order" value={data.po_number} />
            <Field label="Project" value={[context.project_number, context.project_name].map(receiptReviewText).filter(Boolean).join(' · ')} />
            <Field label="Receipt date" value={receiptReviewDate(data.receipt_date)} /><Field label="Received by" value={data.received_by_name} />
            <Field label="Inspector" value={data.inspector_name} /><Field label="Inspection agency" value={data.inspection_agency} />
          </dl></section>
          <section className="goods-receipt-review-section"><Heading icon={ArchiveBoxIcon}>Quantity reconciliation</Heading>
            {quantities.groups.length > 1 && <label className="goods-receipt-review-unit">Recorded unit<select aria-label="Quantity unit" value={selectedGroup?.id || ''} onChange={event => setUnitSelection({ source: receipt, id: event.target.value })}>{quantities.groups.map(group => <option key={group.id} value={group.id}>{group.label}</option>)}</select></label>}
            <div className="goods-receipt-review-quantities" data-testid="receipt-quantity-tiles">{RECEIPT_QUANTITY_FIELDS.map(([id, label]) => <div key={id} data-quantity={id}><span>{label}</span><strong>{receiptReviewQuantity(selectedGroup?.values[id])}</strong><small>{selectedGroup?.unit || 'Unit not recorded'}</small></div>)}</div>
            <p className="goods-receipt-review-note">{quantities.rows.length ? 'Recorded receipt lines, grouped by unit. Incomplete quantities stay unreported.' : 'No item quantities are recorded.'}</p>
            {quantities.rows.length > 0 && <details className="goods-receipt-review-disclosure"><summary>View {quantities.rows.length} receipt {quantities.rows.length === 1 ? 'line' : 'lines'}</summary><div className="goods-receipt-review-table-scroll" tabIndex={0} role="region" aria-label="Receipt line quantities"><table><thead><tr><th>Item</th><th>Unit</th>{RECEIPT_QUANTITY_FIELDS.map(([id, label]) => <th key={id}>{label}</th>)}</tr></thead><tbody>{quantities.rows.map((row, index) => <tr key={row.po_line_id || index}><td data-table-text="primary">{receiptReviewText(row.item) || receiptReviewText(row.description) || `Line ${index + 1}`}</td><td>{receiptReviewText(row.uom) || 'Not recorded'}</td>{RECEIPT_QUANTITY_FIELDS.map(([id]) => <td key={id}>{receiptReviewQuantity(row[id])}</td>)}</tr>)}</tbody></table></div></details>}
          </section>
          <section className="goods-receipt-review-section"><Heading icon={ShieldCheckIcon}>Inspection checklist</Heading><ul className="goods-receipt-review-checklist" data-testid="receipt-inspection-checklist">{checklist.map(row => <li key={row.id} data-check={row.id}><span>{row.label}</span><span className="goods-receipt-review-evidence" data-tone={row.tone}>{row.value}<span tabIndex={0} role="img" title={row.detail} aria-label={row.detail}><InformationCircleIcon aria-hidden="true" /></span></span></li>)}</ul>
            <p className="goods-receipt-review-note">Recorded check flags do not establish verified inspection results.</p>
            {(receiptReviewText(data.inspection_notes) || receiptReviewText(data.ndt_results)) && <details className="goods-receipt-review-disclosure"><summary>Inspection notes and results</summary>{receiptReviewText(data.inspection_notes) && <p>{data.inspection_notes}</p>}{receiptReviewText(data.ndt_results) && <p><strong>NDT: </strong>{data.ndt_results}</p>}</details>}
          </section>
          <section className="goods-receipt-review-section"><Heading icon={DocumentTextIcon}>Traceability &amp; certificates</Heading><dl><Field label="Delivery note" value={data.delivery_note_number} /><Field label="Inspection report" value={data.inspection_report_number} /><Field label="Heat numbers" value={heatNumbers.join(', ')} /><Field label="Certificates declared" value={certificates.join(', ')} /></dl>
            {data.evidence?.traceability?.status === 'missing' && <p className="goods-receipt-review-attention">{receiptReviewText(data.evidence.traceability.reason) || 'Required heat-number declarations are missing.'}</p>}
          </section>
          <section className="goods-receipt-review-section goods-receipt-review-ncr"><div><h3>Nonconformance records</h3><p>No linked NCR register is available for this receipt.</p></div><span>Not available</span></section>
          <section className="goods-receipt-review-section"><Heading icon={PaperClipIcon}>Attachments{attachmentsKnown ? ` (${data.attachments.length})` : ''}</Heading>
            {attachments.length > 0 ? <ul className="goods-receipt-review-attachments" data-testid="receipt-attachments">{attachments.slice(0, 2).map(attachment => <li key={attachment.id}><DocumentTextIcon aria-hidden="true" />{attachment.url ? <a href={attachment.url} target="_blank" rel="noopener noreferrer" title={attachment.name}>{attachment.name}<ArrowTopRightOnSquareIcon aria-hidden="true" /></a> : <span>{attachment.name}<small>Document link not recorded</small></span>}</li>)}</ul> : <p className="goods-receipt-review-note">{attachmentsKnown && data.attachments.length === 0 ? 'No attachments recorded.' : 'Attachment details are unavailable.'}</p>}
            {attachments.length > 2 && <button type="button" className="goods-receipt-review-text-button" onClick={open}>View all attachments<ArrowRightIcon aria-hidden="true" /></button>}
          </section>
          <section className="goods-receipt-review-section"><Heading icon={ClockIcon}>Receipt timeline</Heading>{timeline.length ? <ol className="goods-receipt-review-timeline" data-testid="receipt-timeline">{timeline.map(row => <li key={row.id} data-event={row.id}><span aria-hidden="true" /><strong>{row.label}</strong><time>{receiptReviewDate(row.date, row.time)}</time></li>)}</ol> : <p className="goods-receipt-review-note">No receipt dates are recorded.</p>}{receiptReviewText(data.notes) && <details className="goods-receipt-review-disclosure"><summary>Receipt notes</summary><p>{data.notes}</p></details>}</section>
        </>}
      </div>
      <footer className="goods-receipt-review-footer"><button type="button" className="goods-receipt-review-icon-button" aria-label="Refresh receipt review" title={asOfDate ? `Reporting date: ${receiptReviewDate(asOfDate)}` : 'Refresh receipt review'} onClick={refresh} disabled={current.state === 'loading'}><ArrowPathIcon aria-hidden="true" /></button><div>{ready && <>{access.export === true && onPrint && <button type="button" className="goods-receipt-review-button" onClick={() => onPrint(data)}><PrinterIcon aria-hidden="true" />Print receipt</button>}<button type="button" className="goods-receipt-review-button goods-receipt-review-button--primary" onClick={open}>Open receipt<ArrowRightIcon aria-hidden="true" /></button></>}</div></footer>
    </>}
  </aside>;
}
GoodsReceiptReview.propTypes = { receipt: PropTypes.object, onClose: PropTypes.func.isRequired, onOpen: PropTypes.func.isRequired, onPrint: PropTypes.func, onChanged: PropTypes.func, capabilities: PropTypes.object, asOfDate: PropTypes.string };
