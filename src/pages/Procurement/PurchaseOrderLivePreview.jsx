import PropTypes from 'prop-types';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { useSelector } from 'react-redux';
import { BRANDING_CONFIG } from '../../config/branding.config';
import { PROCUREMENT_DOCUMENT_BRANDING } from '../../config/procurementDocumentBranding.config';

const text = (value, fallback = '—') => String(value ?? '').trim() || fallback;
const date = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? text(value) : parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
const money = (value, currency) => {
  const amount = Number(value || 0);
  try { return new Intl.NumberFormat('en-AE', { style: 'currency', currency: currency || 'AED', minimumFractionDigits: 2 }).format(amount); }
  catch { return `${currency || 'AED'} ${amount.toFixed(2)}`; }
};
const itemTotal = (item) => Math.max(0, Number(item.quantity || 0) * Number(item.unit_price || 0) - Number(item.discount || 0));
const APPROVAL_STAMP_PATH = '/assets/procurement/commercial-license-stamp.png';
const FINAL_MANAGEMENT_STAGE = 'Final Management Sign-off';
const isApprovalComplete = (approval) => String(approval?.status || '').trim().toLowerCase() === 'approved';

const ApprovalStamp = ({ approval, placement = 'page' }) => {
  const isApproved = isApprovalComplete(approval);
  const placementClass = placement === 'approved-by'
    ? isApproved
      ? 'relative mt-3 h-[42mm] w-[42mm] opacity-100'
      : 'absolute left-1/2 top-7 h-[42mm] w-[42mm] -translate-x-1/2 opacity-[0.12]'
    : isApproved
      ? 'bottom-20 right-8 h-[42mm] w-[42mm] opacity-100'
      : 'inset-0 m-auto h-[42mm] w-[42mm] opacity-[0.10]';

  return (
    <img
      src={APPROVAL_STAMP_PATH}
      alt={isApproved ? 'Final management approval stamp' : 'Final management approval stamp watermark'}
      className={`pointer-events-none object-contain mix-blend-multiply ${placement === 'page' ? 'absolute z-0' : ''} ${placementClass}`}
    />
  );
};
ApprovalStamp.propTypes = { approval: PropTypes.object, placement: PropTypes.oneOf(['page', 'approved-by']) };

const ApprovalEntry = ({ approval }) => {
  const isApproved = isApprovalComplete(approval);

  return (
    <div className="relative min-h-[92px] overflow-hidden border-t border-slate-500 pt-1">
      <div className="relative z-[1]">
        <p className="font-bold">{approval.stage}</p>
        <p>{text(approval.approver)}</p>
        <p className="inline-flex items-center gap-1 text-slate-500">
          {isApproved && <CheckCircleIcon className="h-3 w-3 text-emerald-600" />}
          {text(approval.status, 'Pending')}
        </p>
      </div>
    </div>
  );
};
ApprovalEntry.propTypes = { approval: PropTypes.object.isRequired };

const sessionIdentity = (authUser) => {
  const user = authUser?.user || authUser || {};
  const name = user.full_name
    || user.name
    || [user.first_name, user.last_name].filter(Boolean).join(' ')
    || user.username
    || '';
  return { name: String(name).trim(), email: String(user.email || '').trim() };
};

const DocumentHeader = ({ data }) => (
  <header className="flex items-start justify-between px-1 pb-5">
    <div className="text-[#3275b6]">
      <h1 className="text-[15px] font-black uppercase tracking-wide">Purchase Order</h1>
      <p className="mt-0.5 text-[12px] font-black">{text(data.po_number, 'PO NUMBER PENDING')}</p>
      <p className="text-[7px] text-slate-500">{text(data.form_note, '(PO no. to be used in all documents)')}</p>
      <p className="mt-2 text-[10px] font-bold">{date(data.po_date)}</p>
    </div>
    <div className="text-right">
      <div className="ml-auto h-8 w-fit">
        <img src={PROCUREMENT_DOCUMENT_BRANDING.logo.path} alt={PROCUREMENT_DOCUMENT_BRANDING.logo.alt} className="h-full w-auto object-contain" />
      </div>
      <p className="mt-2 text-[12px] font-bold leading-3 text-[#3275b6]">HOME OF THE<br />LEARNING MINDS</p>
    </div>
  </header>
);
DocumentHeader.propTypes = { data: PropTypes.object.isRequired };

const DocumentFooter = ({ data, page }) => (
  <footer className="mt-auto pt-5">
    <div className="flex h-7 items-center justify-around bg-[#0870aa] px-2 text-[6px] font-bold text-white">
      <img src={PROCUREMENT_DOCUMENT_BRANDING.logo.path} alt="" className="h-3 w-auto brightness-0 invert" /><span className="text-center leading-2">HOME of the<br />LEARNING MINDS</span><img src={PROCUREMENT_DOCUMENT_BRANDING.logo.path} alt="" className="h-3 w-auto brightness-0 invert" /><span className="text-center leading-2">HOME of the<br />LEARNING MINDS</span><img src={PROCUREMENT_DOCUMENT_BRANDING.logo.path} alt="" className="h-3 w-auto brightness-0 invert" />
    </div>
    <div className="flex justify-between px-8 pt-1 text-[6px] leading-2 text-[#4e83ad]"><span>{BRANDING_CONFIG.brand.companyFull}<br />{BRANDING_CONFIG.contact.address.full}<br />Tel: {BRANDING_CONFIG.contact.phone.display} | {BRANDING_CONFIG.contact.website?.display || 'www.rejlers.ae'}</span><span className="self-end">{text(data.po_number, 'Draft')} · {page}</span></div>
  </footer>
);
DocumentFooter.propTypes = { data: PropTypes.object.isRequired, page: PropTypes.number.isRequired };

const Page = ({ data, page, children, finalApproval, showPageStamp = true }) => <section className="po-template-page relative mx-auto flex min-h-[760px] max-w-[560px] flex-col overflow-hidden border border-slate-400 bg-white px-10 py-6 text-[9px] leading-[1.35] text-slate-700 shadow-xl">{showPageStamp && <ApprovalStamp approval={finalApproval} />}<div className="relative z-[1]"><DocumentHeader data={data} /></div><div className="relative z-[1] flex-1">{children}</div><div className="relative z-[1]"><DocumentFooter data={data} page={page} /></div></section>;
Page.propTypes = { data: PropTypes.object.isRequired, page: PropTypes.number.isRequired, children: PropTypes.node.isRequired, finalApproval: PropTypes.object, showPageStamp: PropTypes.bool };

const Pair = ({ label, value, strong = false }) => <div className="grid grid-cols-[82px_1fr] gap-2"><b className="text-slate-600">{label}:</b><span className={`whitespace-pre-line ${strong ? 'font-bold text-slate-800' : ''}`}>{text(value)}</span></div>;
Pair.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.node, strong: PropTypes.bool };

const SectionTitle = ({ children }) => <h2 className="mb-2 mt-4 text-[10px] font-black uppercase tracking-wide text-slate-800">{children}</h2>;
SectionTitle.propTypes = { children: PropTypes.node.isRequired };

const PurchaseOrderLivePreview = ({ formData, vendor, prReference, files = [], documentOnly = false }) => {
  const authUser = useSelector((state) => state.auth?.user);
  const loggedInUser = sessionIdentity(authUser);
  const recordedItems = Array.isArray(formData.items) ? formData.items : [];
  const fallbackSubtotal = Math.max(
    0,
    Number(formData.total_amount || 0)
      - Number(formData.tax_amount || 0)
      + Number(formData.discount_amount || 0),
  );
  const sourceItems = recordedItems.length > 0
    ? recordedItems
    : fallbackSubtotal > 0
      ? [{ description: formData.title || formData.description, quantity: 1, unit_price: fallbackSubtotal, uom: 'LOT' }]
      : [];
  const items = sourceItems.map((item, index) => {
    const quantity = Number(item.quantity ?? item.qty ?? 1) || 0;
    const recordedTotal = Number(item.total ?? item.line_total ?? 0) || 0;
    return {
      ...item,
      line_code: item.line_code || item.lineCode || item.item_code || item.code || String(index + 1),
      description: item.description || item.item || item.name || formData.title,
      specification: item.specification || item.comment || item.comments || item.remarks || item.notes,
      quantity,
      uom: item.uom || item.unit || item.unit_of_measure || 'EA',
      unit_price: Number(item.unit_price ?? item.price ?? (quantity ? recordedTotal / quantity : 0)) || 0,
      discount: Number(item.discount || 0) || 0,
    };
  });
  const subtotal = items.reduce((sum, item) => sum + itemTotal(item), 0);
  const lineDiscount = items.reduce((sum, item) => sum + Number(item.discount || 0), 0);
  const tax = Number(formData.tax_amount || (subtotal * Number(formData.vat_percentage || 0)) / 100);
  const total = Number(formData.total_amount || subtotal + tax);
  const approvals = Array.isArray(formData.approval_log) ? formData.approval_log : [];
  const finalApproval = approvals.find((approval) => approval.stage === FINAL_MANAGEMENT_STAGE);
  const finalApprovalComplete = isApprovalComplete(finalApproval);
  const storedInvoiceEmails = Array.isArray(formData.invoicing_emails)
    ? formData.invoicing_emails
    : String(formData.invoicing_emails || '').split(',').map((email) => email.trim()).filter(Boolean);
  const invoiceEmails = (loggedInUser.email
    ? [loggedInUser.email, ...storedInvoiceEmails.slice(1)]
    : storedInvoiceEmails
  ).join(', ');
  const invoicingAttention = loggedInUser.name ? `Attn. ${loggedInUser.name}` : formData.invoicing_attn;
  const project = formData.project_number || formData.rad_project_no || 'Multiple Projects';
  const contacts = Object.values(formData.contact_persons || {}).flat().filter(Boolean);

  return (
    <div className={documentOnly ? 'po-template-document' : 'h-full overflow-y-auto bg-slate-200 p-4'}>
      {!documentOnly && <div className="sticky top-0 z-10 mb-3 flex items-center justify-between rounded-lg bg-slate-200/95 py-1 backdrop-blur">
        <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#3275b6]">Live PO preview</p><p className="text-xs text-slate-500">Reference-aligned four-page document</p></div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live</span>
      </div>}

      <div className={documentOnly ? 'po-template-pages' : 'space-y-5'}>
        <Page data={formData} page={1} finalApproval={finalApproval} showPageStamp={false}>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 pt-2">
            <div className="space-y-1.5"><Pair label="Seller" value={vendor?.name} /><Pair label="Seller Address" value={formData.seller_address || vendor?.address || vendor?.country} /><Pair label="Invoicing Address" value={`${text(invoicingAttention, '')}${invoiceEmails ? `\n${invoiceEmails}` : ''}\n${BRANDING_CONFIG.brand.companyFull}\n${BRANDING_CONFIG.contact.address.full}`} /></div>
            <div className="space-y-1.5"><Pair label="Seller Reference" value={formData.seller_reference || formData.seller_contact_person} /><Pair label="Quote Ref." value={formData.quote_ref} /><Pair label="PR Reference" value={prReference?.pr_number} /><Pair label="License No." value={formData.seller_license_no} /><Pair label="Buyer Reference" value={[formData.buyer_reference_pm, formData.buyer_reference_pe].filter(Boolean).join('\n')} /></div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1.5"><div className="space-y-1.5"><Pair label="Payment Terms" value={formData.payment_terms} /><Pair label="Payment Mode" value={formData.payment_mode} /><Pair label="Project" value={project} strong /></div><div className="space-y-1.5"><Pair label="Delivery terms" value={formData.delivery_terms} /><Pair label="Delivery date" value={date(formData.expected_delivery)} /><Pair label="Marking" value={formData.marking || formData.po_number} strong /></div></div>
          <div className="mt-5 grid grid-cols-[1fr_205px] border-y-2 border-slate-600 py-1.5"><div><b>Purchase Summary:</b><p className="mt-1 font-bold">{text(formData.summary || formData.title)}</p></div><div className="space-y-1"><div className="flex justify-between"><b>Total Purchase Price:</b><span>{money(subtotal, formData.currency)}</span></div><div className="flex justify-between"><b>VAT ({Number(formData.vat_percentage || 0)}%):</b><span>{money(tax, formData.currency)}</span></div><div className="flex justify-between text-[10px]"><b>Total Sum:</b><b>{money(total, formData.currency)}</b></div></div></div>
          <div className="mt-8 grid grid-cols-2 gap-5">
            <section className="relative min-h-[160px]"><b className="text-[10px]">Approved by:</b><ApprovalStamp approval={finalApproval} placement="approved-by" />{formData.approval_signature && <img src={formData.approval_signature} alt="Approval signature" className="mt-2 max-h-12 max-w-[150px] object-contain object-left" />}<div className={`${finalApprovalComplete ? 'mt-1' : formData.approval_signature ? 'mt-3' : 'mt-20'} border-t border-slate-500 pt-1`}><p className="font-bold">{text(finalApproval?.approver || formData.approved_by_name)}</p><p>{text(formData.approved_by_title || FINAL_MANAGEMENT_STAGE)}</p><p>Date: {date(finalApproval?.date || formData.approved_date)}</p></div></section>
            <section className="min-h-[160px] border-l border-slate-500 pl-3"><b className="text-[10px]">Order Confirmation:</b><p>We acknowledge the receipt of your documents, and we perform according to this PO.</p><div className="mt-4 space-y-2"><Pair label="Date" value={date(formData.confirmation_date)} /><Pair label="Seller Name" value={vendor?.name} /><Pair label="Contact Person" value={formData.seller_contact_person} /><Pair label="Phone / Email" value={[formData.seller_phone, formData.seller_email].filter(Boolean).join(' / ')} /></div></section>
          </div>
        </Page>

        <Page data={formData} page={2} finalApproval={finalApproval}>
          <p className="border-b border-slate-500 pb-2 text-[11px] font-bold"><u>PURCHASE ORDER:</u> &nbsp;{text(formData.title)}</p>
          <p className="mt-3">We, {BRANDING_CONFIG.brand.companyFull} (Buyer), are pleased to issue this purchase order to <b>{text(vendor?.name)}</b> (Seller) for <b>{text(formData.title)}</b>{formData.quote_ref ? ` according to quotation/reference ${formData.quote_ref}` : ''}.</p>
          <SectionTitle>Scope</SectionTitle><p className="whitespace-pre-wrap font-medium">{text(formData.scope_of_services || formData.description || formData.summary)}</p>
          <table className="mt-4 w-full border-collapse"><thead><tr className="bg-slate-100"><th className="border border-slate-500 p-1">SL No.</th><th className="border border-slate-500 p-1 text-left">Goods / Services</th><th className="border border-slate-500 p-1">Specification</th><th className="border border-slate-500 p-1">Quantity</th><th className="border border-slate-500 p-1">Rate</th><th className="border border-slate-500 p-1">Amount</th></tr></thead><tbody>{items.length ? items.map((item, index) => <tr key={`${item.line_code}-${index}`}><td className="border border-slate-500 p-1 text-center">{index + 1}</td><td className="border border-slate-500 p-1 font-medium">{text(item.description)}</td><td className="border border-slate-500 p-1">{text(item.specification)}</td><td className="border border-slate-500 p-1 text-center">{Number(item.quantity || 0)} {text(item.uom, '')}</td><td className="border border-slate-500 p-1 text-right">{money(item.unit_price, formData.currency)}</td><td className="border border-slate-500 p-1 text-right">{money(itemTotal(item), formData.currency)}</td></tr>) : <tr><td colSpan="6" className="border border-slate-500 p-5 text-center italic text-slate-400">Add items to populate the scope table.</td></tr>}</tbody></table>
          <SectionTitle>Prices</SectionTitle><p>The total purchase price for <b>{text(formData.title)}</b> excluding VAT is <b>{money(subtotal, formData.currency)}</b>. Prices are provided in {text(formData.currency)}.</p>
          <SectionTitle>Delivery & Installation</SectionTitle><p className="whitespace-pre-wrap">{text(formData.delivery_terms)}{formData.time_schedule ? `\n${formData.time_schedule}` : ''}</p>
          {formData.warranty_period && <><SectionTitle>Warranty / Support</SectionTitle><p>{formData.warranty_period}{formData.performance_requirements ? ` — ${formData.performance_requirements}` : ''}</p></>}
        </Page>

        <Page data={formData} page={3} finalApproval={finalApproval}>
          <SectionTitle>Delivery Place</SectionTitle><p className="whitespace-pre-wrap">{text(formData.contractor || BRANDING_CONFIG.brand.companyFull)}<br />{BRANDING_CONFIG.contact.address.full}</p>
          <SectionTitle>Payment</SectionTitle><p><b>Payment term:</b> {text(formData.payment_terms)}</p><p className="mt-2"><b>Payment mode:</b> {text(formData.payment_mode)}</p>
          <SectionTitle>Terms & Conditions</SectionTitle><p className="whitespace-pre-wrap">{text(formData.terms_and_conditions)}</p>
          {(formData.inspection_requirements || formData.safety_requirements) && <><SectionTitle>Inspection & Safety Requirements</SectionTitle><p className="whitespace-pre-wrap">{[formData.inspection_requirements, formData.safety_requirements].filter(Boolean).join('\n')}</p></>}
          <SectionTitle>Focal Point</SectionTitle><div className="space-y-2">{contacts.length ? contacts.map((contact, index) => <div key={`${contact.name || 'contact'}-${index}`}><b>{text(contact.name || contact.role)}</b><p>{[contact.email, contact.phone].filter(Boolean).join(' · ')}</p></div>) : <><p><u>Seller:</u> {text(formData.seller_contact_person)} · {text(formData.seller_email)}</p><p><u>Buyer:</u> {text(formData.buyer_reference_pm || formData.buyer_reference_pe)}</p></>}</div>
          <SectionTitle>Attachment</SectionTitle>{files.length ? <ul className="list-disc pl-5">{files.map((file) => <li key={file.name}>{file.name}</li>)}</ul> : <p>{text(formData.notes, 'Supporting documents will be listed here when attached.')}</p>}
        </Page>

        <Page data={formData} page={4} finalApproval={finalApproval}>
          <SectionTitle>Summary of Prices</SectionTitle>
          <table className="mt-4 w-full border-collapse"><thead><tr className="border-y-2 border-slate-600"><th className="p-1 text-left">Pos.<br />Part</th><th className="p-1 text-left">Description</th><th className="p-1 text-left">Delivery</th><th className="p-1 text-right">Qty.</th><th className="p-1 text-right">Unit Price</th><th className="p-1 text-right">Discount</th><th className="p-1 text-right">Total Price</th></tr></thead><tbody>{items.length ? items.map((item, index) => <tr key={`summary-${index}`} className="align-top"><td className="px-2 py-3 font-bold">{item.line_code || index + 1}</td><td className="px-2 py-3 font-bold">{text(item.description)}</td><td className="px-2 py-3">{date(formData.expected_delivery)}</td><td className="px-2 py-3 text-right">{Number(item.quantity || 0)} {text(item.uom, '')}</td><td className="px-2 py-3 text-right">{money(item.unit_price, formData.currency)}</td><td className="px-2 py-3 text-right">{money(item.discount, formData.currency)}</td><td className="px-2 py-3 text-right font-bold">{money(itemTotal(item), formData.currency)}</td></tr>) : <tr><td colSpan="7" className="py-16 text-center italic text-slate-400">Price summary will appear when items are added.</td></tr>}</tbody></table>
          <div className="mt-12 ml-auto w-[230px] border-2 border-slate-600 p-2 text-[10px]"><div className="flex justify-between"><b>Total Price:</b><b>{money(subtotal, formData.currency)}</b></div>{lineDiscount > 0 && <div className="flex justify-between"><b>Discount:</b><span>{money(lineDiscount, formData.currency)}</span></div>}<div className="flex justify-between"><b>VAT ({Number(formData.vat_percentage || 0)}%):</b><b>{money(tax, formData.currency)}</b></div><div className="flex justify-between"><b>Total Sum:</b><b>{money(total, formData.currency)}</b></div></div>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {approvals.map((approval) => <ApprovalEntry key={approval.stage} approval={approval} />)}
          </div>
        </Page>
      </div>
    </div>
  );
};

PurchaseOrderLivePreview.propTypes = { formData: PropTypes.object.isRequired, vendor: PropTypes.object, prReference: PropTypes.object, files: PropTypes.arrayOf(PropTypes.object), documentOnly: PropTypes.bool };
export default PurchaseOrderLivePreview;
