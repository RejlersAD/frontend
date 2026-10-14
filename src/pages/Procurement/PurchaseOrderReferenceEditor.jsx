import { useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { AlertCircle, ArrowLeft, ArrowRight, Building2, CheckCircle2, ClipboardCheck, FileText, Folder, Lock, Save, X } from 'lucide-react';
import PurchaseOrderPreviewPane from './PurchaseOrderPreviewPane';
import { purchaseOrderVat } from './purchaseOrderVat';
import { procurementVatLabel } from '../../utils/procurementVat';
import { purchaseOrderSignatureEvidence } from '../../utils/procurementApproval';
import './PurchaseOrderForm.css';
import './PurchaseOrderReferenceEditor.css';

const steps = ['Order & parties', 'Scope & pricing', 'Projects & delivery', 'Approval'];
const text = value => value == null ? '' : String(value);
const narrativeText = value => {
  const template = document.createElement('template');
  template.innerHTML = text(value).replace(/<\/(?:p|div|li|h[1-6])>|<br\s*\/?\s*>/gi, '$& ');
  template.content.querySelectorAll('script, style').forEach(node => node.remove());
  return template.content.textContent.trim();
};

function Field({ label, value, wide = false, money = false }) {
  return <label className={`pof-field-row pof-ref-field${wide ? ' pof-ref-wide' : ''}${money ? ' pof-ref-money' : ''}`}>
    <span>{label}</span>
    <span className="pof-ref-value"><input aria-label={label} readOnly value={text(value)} placeholder="—" />{money && <Lock aria-hidden="true" />}</span>
  </label>;
}
Field.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), wide: PropTypes.bool, money: PropTypes.bool };

function Card({ title, icon: Icon, children, className = '' }) {
  return <section className={`pof-card ${className}`} aria-label={title}>
    <div className="pof-card-heading"><span className="pof-card-icon"><Icon aria-hidden="true" /></span><h3>{title}</h3></div>
    <div className="pof-card-body">{children}</div>
  </section>;
}
Card.propTypes = { title: PropTypes.string.isRequired, icon: PropTypes.elementType.isRequired, children: PropTypes.node.isRequired, className: PropTypes.string };

export default function PurchaseOrderReferenceEditor({ order, editor }) {
  const [step, setStep] = useState(0);
  const instanceId = useId();
  const formId = `${instanceId}-number-form`;
  const errorId = `${instanceId}-number-error`;
  const numberInput = useRef(null);
  const scroll = useRef(null);
  useEffect(() => { numberInput.current?.focus(); }, []);
  const { number, setNumber, saving, error, save, close } = editor;
  const contacts = order.contact_persons || {};
  const buyerReferences = Array.isArray(contacts.buyer_references) ? contacts.buyer_references : [];
  const approvalRows = (order.approval_log || []).filter(row => row && !['purchase_requisition', 'signed_purchase_requisition_pdf'].includes(row.source));
  const signatureEvidence = purchaseOrderSignatureEvidence(order);
  const signatory = signatureEvidence.stage || {};
  const approver = signatory.approver || signatory.user_name || order.approved_by_name || order.approved_by_user_name || '';
  const approvalStatus = signatureEvidence.mismatch ? 'Review required' : signatory.status;
  const pricing = purchaseOrderVat(order);
  const validNumber = /^RAD-(GEN|PRJ)-PUR-\d{4,}_(?:(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)?\d{4})$/.test(number.replace(/\s/g, '').toUpperCase());
  const issues = error ? [{ field: 'po_number', message: error }] : validNumber ? [] : [{ field: 'po_number', message: 'Enter a valid PO number.' }];
  const openStep = next => { setStep(next); scroll.current?.scrollTo({ top: 0 }); };
  const focusNumber = () => { openStep(0); window.requestAnimationFrame(() => numberInput.current?.focus()); };
  const cancel = () => { if (!saving) close(); };
  const saveButton = <button type="submit" form={formId} className="pof-button" disabled={saving}><Save aria-hidden="true" />{saving ? 'Saving…' : 'Save changes'}</button>;
  const projects = <Card title="Scope & projects" icon={Folder} className="pof-ref-wide">
    <div className="pof-ref-fields pof-ref-projects">
      <Field label="Title / Description" value={order.title} />
      <Field label="Vendor Summary" value={order.summary || contacts.purchase_summary} />
      <Field label="Project Name and Number" value={[order.enterprise_project_code || order.project_number, order.enterprise_project_name || order.project_name].filter(Boolean).join('  ')} wide />
      <div className="pof-ref-project-numbers pof-ref-wide">
        <Field label="Project Number" value={order.project_number} />
        <Field label="RAD Project No." value={order.rad_project_no} />
        <Field label="Agreement No." value={order.company_agreement_no} />
      </div>
      <Field label="End Client" value={order.end_client} />
      <Field label="Project Manager" value={order.project_manager} />
      <Field label="Contractor" value={order.contractor} />
      <Field label="Subcontractor" value={order.subcontractor} />
      <Field label={contacts.delivery_date_type === 'start' ? 'Start date' : 'Delivery date'} value={contacts.delivery_date_type === 'start' ? order.start_date : order.expected_delivery} wide />
    </div>
  </Card>;
  const approvals = <>
    <Card title="Approval notes" icon={ClipboardCheck}>
      <label className="pof-field-row pof-ref-field"><span>Final Approval Notes</span><textarea aria-label="Final Approval Notes" readOnly value={order.final_approver_notes || ''} placeholder="—" rows={2} /></label>
    </Card>
    <Card title="Final signatory" icon={ClipboardCheck}>
      <div className="pof-ref-fields">
        <Field label="Approval Stage" value={signatory.stage || signatory.role} />
        <Field label="Approver" value={approver} />
        <Field label="Approved By" value={String(signatory.status).toLowerCase() === 'approved' && !signatureEvidence.mismatch ? [signatory.approved_by_name || signatureEvidence.recordedName || approver, approvalStatus].filter(Boolean).join(' - ') : approvalStatus} />
        <Field label="Routing Comments" value={signatory.comments} />
      </div>
    </Card>
  </>;

  return <div className="purchase-order-form-workspace pof-page pof-reference" data-table-typography="preserve">
    <div className="pof-workspace-grid">
      <section className="pof-editor" aria-label="Purchase order editor">
        <header className="pof-header">
          <nav className="pof-breadcrumb" aria-label="Breadcrumb"><span>Procurement</span><span>/</span><button type="button" onClick={cancel} disabled={saving}>Purchase Orders</button><span>/</span><strong>Edit</strong></nav>
          <div className="pof-title-row"><h1>Edit purchase order</h1><button type="button" className="pof-close" onClick={cancel} disabled={saving} aria-label="Close purchase order"><X aria-hidden="true" size={18} /></button></div>
          <div className="pof-header-bottom"><span className="pof-draft-state"><FileText aria-hidden="true" />{order.po_number}</span><div className="pof-header-actions">{saveButton}</div></div>
          <div className="pof-tabs" role="tablist" aria-label="Purchase order sections">
            {steps.map((label, index) => <button key={label} type="button" role="tab" id={`${instanceId}-step-${index}`} aria-controls={`${instanceId}-panel`} aria-selected={step === index} tabIndex={step === index ? 0 : -1} onClick={() => openStep(index)} onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (index + (event.key === 'ArrowRight' ? 1 : 3)) % 4;
              openStep(next); document.getElementById(`${instanceId}-step-${next}`)?.focus();
            }}><span className="pof-step-number" aria-hidden="true">{index + 1}</span><span>{label}</span></button>)}
          </div>
        </header>
        <form id={formId} className="pof-form" aria-label="Edit PO number" onSubmit={save} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); cancel(); } }}>
          {error && <div id={errorId} className="pof-error" role="alert">{error}</div>}
          <div className="pof-form-scroll" ref={scroll}>
            <div id={`${instanceId}-panel`} className="pof-section-panel" role="tabpanel" aria-labelledby={`${instanceId}-step-${step}`}>
              <div className="pof-overview-grid">
                {step === 0 && <>
                  <Card title="Order & seller" icon={FileText}>
                    <div className="pof-ref-fields">
                      <div className="pof-ref-identity pof-ref-wide">
                      <Field label="PR Number" value={order.pr_number} />
                      <label className="pof-field-row pof-ref-field"><span>PO Number <b aria-hidden="true">*</b></span><input ref={numberInput} aria-label="PO number" value={number} maxLength={50} disabled={saving} aria-invalid={Boolean(error) || !validNumber} aria-describedby={error ? errorId : undefined} onChange={event => setNumber(event.target.value)} /></label>
                      </div>
                      <Field label="PO Date" value={order.po_date} /><Field label="Currency" value={order.currency} />
                      <Field label="Seller" value={order.vendor_name} wide />
                      <Field label="Seller Reference" value={order.seller_reference} wide />
                      <Field label="Quote Reference" value={order.quote_ref} /><Field label="License No." value={order.seller_license_no} />
                      <Field label="Seller Email" value={order.seller_email} /><Field label="Seller Phone" value={order.seller_phone} />
                      <Field label="Seller Address" value={order.seller_address} wide />
                    </div>
                    <details className="pof-ref-vendor"><summary>Vendor details <span>{order.seller_license_no}</span></summary><dl><dt>Contact person</dt><dd>{order.seller_contact_person || '—'}</dd><dt>License No.</dt><dd>{order.seller_license_no || '—'}</dd></dl></details>
                  </Card>
                  <Card title="Buyer & commercial" icon={Building2}>
                    <div className="pof-ref-fields">
                      <Field label="Primary Buyer" value={buyerReferences[0]?.name || buyerReferences[0]?.full_name || order.buyer_reference_pm} wide />
                      <Field label="Reference 2" value={buyerReferences[1]?.name || buyerReferences[1]?.full_name} wide />
                      <Field label="Reference 3" value={buyerReferences[2]?.name || buyerReferences[2]?.full_name || order.buyer_reference_pe} wide />
                      <Field label="Price Before Discount" value={pricing.subtotal} money /><Field label="Price Basis" value={procurementVatLabel(order.vat_basis)} />
                      <Field label="Total Amount" value={order.total_amount} money /><Field label="VAT %" value={order.vat_percentage} money />
                      <Field label="Tax Amount" value={order.tax_amount} money />
                      <Field label="Payment Terms" value={order.payment_terms} wide /><Field label="Payment Mode" value={order.payment_mode} wide />
                      <Field label="Shipment Marking" value={order.marking} wide />
                    </div>
                  </Card>
                  {projects}{approvals}
                </>}
                {step === 1 && <>
                  <Card title="Scope & pricing" icon={FileText} className="pof-ref-wide">
                    <div className="pof-ref-fields"><Field label="Title / Description" value={order.title} wide /><Field label="Scope of services" value={narrativeText(order.scope_of_services)} wide /><Field label="Currency" value={order.currency} /><Field label="Total Amount" value={order.total_amount} money /><Field label="Net Amount" value={order.net_amount} money /><Field label="Tax Amount" value={order.tax_amount} money /></div>
                  </Card>
                  <Card title="Line items" icon={ClipboardCheck} className="pof-ref-wide"><div className="pof-ref-table-wrap"><table><thead><tr><th>Description</th><th>Quantity</th><th>Unit</th><th>Unit price</th></tr></thead><tbody>{(order.items || []).map((item, index) => <tr key={item.id || index}><td>{item.description || item.item_description || item.item || item.name || '—'}</td><td>{item.quantity ?? item.qty ?? '—'}</td><td>{item.unit || item.uom || '—'}</td><td>{item.unit_price ?? item.unitPrice ?? item.price ?? item.rate ?? '—'}</td></tr>)}</tbody></table>{!order.items?.length && <p className="pof-ref-helper">No line items recorded.</p>}</div></Card>
                </>}
                {step === 2 && <>{projects}<Card title="Delivery" icon={Folder} className="pof-ref-wide"><div className="pof-ref-fields"><Field label="Delivery Terms" value={order.delivery_terms} wide /><Field label="Start date" value={order.start_date} /><Field label="End date" value={order.end_date} /></div></Card></>}
                {step === 3 && <>{approvals}<Card title="Approval record" icon={ClipboardCheck} className="pof-ref-wide"><div className="pof-ref-table-wrap"><table><thead><tr><th>Stage</th><th>Approver</th><th>Status</th></tr></thead><tbody>{approvalRows.map((row, index) => <tr key={index}><td>{row.stage || row.role || 'Recorded approval'}</td><td>{row.approver || row.user_name || '—'}</td><td><span className="pof-ref-badge">{row.status || '—'}</span></td></tr>)}</tbody></table>{!approvalRows.length && <p className="pof-ref-helper">No separate PO approval record.</p>}</div></Card></>}
              </div>
            </div>
          </div>
          <footer className="pof-actionbar">
            <button type="button" className="pof-button pof-cancel" onClick={cancel} disabled={saving}>Cancel</button>
            <span className={`pof-validation-state${issues.length ? ' has-issues' : ''}`} role="status">{issues.length ? <AlertCircle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}{issues.length ? 'Check PO number' : 'Required fields complete'}</span>
            <div className="pof-footer-actions">{step > 0 && <button type="button" className="pof-button" onClick={() => openStep(step - 1)}><ArrowLeft aria-hidden="true" />Back</button>}{saveButton}{step < 3 && <button type="button" className="pof-button pof-primary" onClick={() => openStep(step + 1)}>Continue<ArrowRight aria-hidden="true" /></button>}</div>
          </footer>
        </form>
      </section>
      <PurchaseOrderPreviewPane formData={order} orderId={order.id} savedOnly issues={issues} onIssueClick={focusNumber} />
    </div>
  </div>;
}

PurchaseOrderReferenceEditor.propTypes = {
  order: PropTypes.object.isRequired,
  editor: PropTypes.shape({ number: PropTypes.string.isRequired, setNumber: PropTypes.func.isRequired, saving: PropTypes.bool.isRequired, error: PropTypes.string.isRequired, save: PropTypes.func.isRequired, close: PropTypes.func.isRequired }).isRequired,
};
