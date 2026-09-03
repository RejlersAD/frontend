import PropTypes from 'prop-types';
import { BRANDING_CONFIG } from '../../config/branding.config';
import { PROCUREMENT_DOCUMENT_BRANDING } from '../../config/procurementDocumentBranding.config';
import { nameOnly } from '../../utils/employeeDisplayName';

const text = (value, fallback = '—') => String(value ?? '').trim() || fallback;
const date = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? text(value) : parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
const dateTime = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return text(value);
  const hasTime = String(value).includes('T') || String(value).includes(':');
  return hasTime
    ? parsed.toLocaleString('en-GB', { timeZone: 'Asia/Dubai', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : date(value);
};
const money = (value, currency) => {
  const amount = Number(value || 0);
  try { return new Intl.NumberFormat('en-AE', { style: 'currency', currency: currency || 'AED', minimumFractionDigits: 2 }).format(amount); }
  catch { return `${currency || 'AED'} ${amount.toFixed(2)}`; }
};
const amountWithCurrency = (value, currency) => `${Number(value || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || 'AED'}`;
const itemTotal = (item) => Math.max(0, Number(item.quantity || 0) * Number(item.unit_price || 0) - Number(item.discount || 0));
const sanitizeRichHtml = (value) => {
  if (typeof window === 'undefined') return String(value || '').replace(/<[^>]+>/g, ' ');
  const documentValue = new DOMParser().parseFromString(String(value || ''), 'text/html');
  documentValue.querySelectorAll('script, style, iframe, object, embed, link, meta').forEach((node) => node.remove());
  documentValue.querySelectorAll('*').forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const unsafeUrl = ['src', 'href'].includes(name) && /^\s*javascript:/i.test(attribute.value);
      if (name.startsWith('on') || unsafeUrl) node.removeAttribute(attribute.name);
    });
    if (node.tagName.toLowerCase() === 'font') {
      node.removeAttribute('face');
      node.removeAttribute('size');
    }
    node.style.removeProperty('font-family');
    node.style.removeProperty('font-size');
    node.style.removeProperty('line-height');
  });
  return documentValue.body.innerHTML;
};
const APPROVAL_STAMP_PATH = '/assets/procurement/commercial-license-stamp.png';
const FINAL_MANAGEMENT_STAGE = 'Final Management Sign-off';
const DEFAULT_INVOICE_ADDRESS = `Attn. Mr. Aneef Thadikkarantavida
aneef.thadikkarantavida@rejlers.ae
cc. uae.finance@rejlers.ae
uae.procurement@rejlers.ae
Rejlers International Engineering
Solutions AB
PO Box 39317
Abu Dhabi, UAE.
Tel: +971 2 639 7449
Fax: +971 2 639 7448`;
const DEFAULT_BUYER_REFERENCE = 'Richa Hannah Thomas';
const FINAL_APPROVER = 'Jarmo Suominen';
const FINAL_APPROVER_TITLE = 'Sr. Vice President, Middle East\nCEO, Rejlers Abu Dhabi';
const FINAL_APPROVER_COMPANY = 'Rejlers International Engineering Solutions AB';
const USD_TO_AED_RATE = 3.6725;
const DEFAULT_ITEMS_TABLE_HEADERS = {
  line_code: 'Line Code', description: 'Item Description', specification: 'Specification',
  comment: 'Comments', quantity: 'Qty.', uom: 'UOM', unit_price: 'Rate',
  discount: 'Discount', total_price: 'Total Price',
};
const isApprovalComplete = (approval) => String(approval?.status || '').trim().toLowerCase() === 'approved';
const FIRST_NARRATIVE_PAGE_CAPACITY = 4200;
const CONTINUATION_NARRATIVE_PAGE_CAPACITY = 4600;
const MANUAL_PAGE_BREAK_TOKEN = '__RADAI_PO_MANUAL_PAGE_BREAK__';

const chunkArray = (values, size) => values.length ? Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, (index + 1) * size)) : [[]];
const chunkText = (value, maxLength = 2600) => {
  const source = String(value || '').trim();
  if (!source) return [''];
  const chunks = [];
  let remaining = source;
  while (remaining.length > maxLength) {
    let splitAt = remaining.lastIndexOf('\n', maxLength);
    if (splitAt < maxLength * 0.55) splitAt = remaining.lastIndexOf(' ', maxLength);
    if (splitAt < maxLength * 0.55) splitAt = maxLength;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining || !chunks.length) chunks.push(remaining);
  return chunks;
};

const richBlockSize = (node) => {
  const textSize = String(node.textContent || '').trim().length;
  const images = node.querySelectorAll?.('img').length || 0;
  const tableRows = node.querySelectorAll?.('tr').length || 0;
  const listItems = node.querySelectorAll?.('li').length || 0;
  const lineBreaks = node.querySelectorAll?.('br').length || 0;
  return Math.max(80, textSize + (images * 1150) + (tableRows * 220) + (listItems * 60) + (lineBreaks * 70));
};

const hasRenderableRichContent = (html) => {
  const contentDocument = new DOMParser().parseFromString(String(html || ''), 'text/html');
  return Boolean(
    contentDocument.body.textContent.trim()
    || contentDocument.body.querySelector('img, table, hr, svg, video, iframe, [data-po-manual-page-start]')
  );
};

const isManualPageBreakNode = (node) => node.nodeType === Node.ELEMENT_NODE && (
  node.matches('[data-po-page-break="true"]')
  || node.style.pageBreakAfter === 'always'
  || node.style.breakAfter === 'page'
);

const tokenizeRichNode = (node) => {
  if (isManualPageBreakNode(node)) return [MANUAL_PAGE_BREAK_TOKEN];
  if (node.nodeType !== Node.ELEMENT_NODE || !node.querySelector('[data-po-page-break="true"], [style*="page-break-after"], [style*="break-after"]')) {
    return [node.cloneNode(true)];
  }

  const tokens = [];
  let currentWrapper = node.cloneNode(false);
  [...node.childNodes].forEach((child) => {
    tokenizeRichNode(child).forEach((token) => {
      if (token === MANUAL_PAGE_BREAK_TOKEN) {
        if (currentWrapper.childNodes.length) tokens.push(currentWrapper);
        tokens.push(MANUAL_PAGE_BREAK_TOKEN);
        currentWrapper = node.cloneNode(false);
      } else currentWrapper.appendChild(token);
    });
  });
  if (currentWrapper.childNodes.length) tokens.push(currentWrapper);
  return tokens;
};

const splitOversizedRichBlock = (node, capacity) => {
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return chunkText(node.textContent, capacity).map((content) => {
      const paragraph = node.ownerDocument.createElement('p');
      paragraph.textContent = content;
      return paragraph.outerHTML;
    });
  }
  const tagName = node.tagName?.toLowerCase();
  if (tagName === 'table') {
    const rows = [...node.querySelectorAll('tbody > tr')];
    if (!rows.length) return [node.outerHTML];
    const fragments = [];
    let rowGroup = [];
    const renderTable = (selectedRows) => {
      const table = node.cloneNode(true);
      const body = table.querySelector('tbody') || table.appendChild(table.ownerDocument.createElement('tbody'));
      body.replaceChildren(...selectedRows.map((row) => row.cloneNode(true)));
      return table.outerHTML;
    };
    rows.forEach((row) => {
      const candidate = [...rowGroup, row];
      const candidateHtml = renderTable(candidate);
      const candidateDocument = new DOMParser().parseFromString(candidateHtml, 'text/html');
      if (rowGroup.length && richBlockSize(candidateDocument.body) > capacity) {
        fragments.push(renderTable(rowGroup));
        rowGroup = [row];
      } else rowGroup = candidate;
    });
    if (rowGroup.length) fragments.push(renderTable(rowGroup));
    return fragments;
  }

  if (tagName === 'ul' || tagName === 'ol') {
    const items = [...node.children].filter((child) => child.tagName?.toLowerCase() === 'li');
    if (!items.length) return [node.outerHTML];
    const fragments = [];
    let itemGroup = [];
    const renderList = (selectedItems, startIndex) => {
      const list = node.cloneNode(false);
      if (tagName === 'ol' && startIndex > 0) list.setAttribute('start', String(startIndex + 1));
      selectedItems.forEach((item) => list.appendChild(item.cloneNode(true)));
      return list.outerHTML;
    };
    items.forEach((item, index) => {
      const candidate = [...itemGroup, item];
      const candidateHtml = renderList(candidate, index - itemGroup.length);
      const candidateDocument = new DOMParser().parseFromString(candidateHtml, 'text/html');
      if (itemGroup.length && richBlockSize(candidateDocument.body) > capacity) {
        fragments.push(renderList(itemGroup, index - itemGroup.length));
        itemGroup = [item];
      } else itemGroup = candidate;
    });
    if (itemGroup.length) fragments.push(renderList(itemGroup, items.length - itemGroup.length));
    return fragments;
  }

  const rawText = String(node.textContent || '');
  if (!rawText.trim() || node.querySelector?.('img')) return [node.outerHTML];
  const textNodes = [];
  const walker = node.ownerDocument.createTreeWalker(node, 4);
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  const locateTextOffset = (targetOffset) => {
    let traversed = 0;
    for (const textNode of textNodes) {
      const nextOffset = traversed + textNode.textContent.length;
      if (targetOffset <= nextOffset) return { textNode, offset: Math.max(0, targetOffset - traversed) };
      traversed = nextOffset;
    }
    const lastNode = textNodes[textNodes.length - 1];
    return { textNode: lastNode, offset: lastNode?.textContent.length || 0 };
  };
  const fragments = [];
  let start = 0;
  while (start < rawText.length) {
    while (/\s/.test(rawText[start] || '')) start += 1;
    if (start >= rawText.length) break;
    let end = Math.min(rawText.length, start + capacity);
    if (end < rawText.length) {
      const preferredBreak = Math.max(rawText.lastIndexOf('\n', end), rawText.lastIndexOf(' ', end));
      if (preferredBreak > start + (capacity * 0.55)) end = preferredBreak;
    }
    const startPosition = locateTextOffset(start);
    const endPosition = locateTextOffset(end);
    if (!startPosition.textNode || !endPosition.textNode) break;
    const range = node.ownerDocument.createRange();
    range.setStart(startPosition.textNode, startPosition.offset);
    range.setEnd(endPosition.textNode, endPosition.offset);
    const fragment = node.cloneNode(false);
    fragment.appendChild(range.cloneContents());
    fragments.push(fragment.outerHTML);
    start = end;
  }
  return fragments.length ? fragments : [node.outerHTML];
};

const paginateRichHtml = (value) => {
  const sanitized = sanitizeRichHtml(value);
  if (!sanitized) return [];
  if (typeof window === 'undefined') return chunkText(sanitized, 2400);

  const parsed = new DOMParser().parseFromString(sanitized, 'text/html');
  const blocks = [...parsed.body.childNodes]
    .filter((node) => node.nodeType === Node.ELEMENT_NODE || String(node.textContent || '').trim())
    .flatMap(tokenizeRichNode)
    .flatMap((node) => {
      if (node === MANUAL_PAGE_BREAK_TOKEN) return [node];
      return richBlockSize(node) > CONTINUATION_NARRATIVE_PAGE_CAPACITY
        ? splitOversizedRichBlock(node, CONTINUATION_NARRATIVE_PAGE_CAPACITY)
        : [node.outerHTML || node.textContent];
    });
  const pages = [];
  let currentPage = [];
  let currentSize = 0;
  const pendingBlocks = [...blocks];
  const flushPage = () => {
    if (currentPage.length) pages.push(currentPage.join(''));
    currentPage = [];
    currentSize = 0;
  };

  while (pendingBlocks.length) {
    const html = pendingBlocks.shift();
    if (html === MANUAL_PAGE_BREAK_TOKEN) {
      flushPage();
      currentPage.push('<div data-po-manual-page-start="true"></div>');
      continue;
    }
    const blockDocument = new DOMParser().parseFromString(html, 'text/html');
    const blockSize = richBlockSize(blockDocument.body);
    const pageCapacity = pages.length === 0
      ? FIRST_NARRATIVE_PAGE_CAPACITY
      : CONTINUATION_NARRATIVE_PAGE_CAPACITY;
    const remainingCapacity = pageCapacity - currentSize;

    if (blockSize <= remainingCapacity || (!currentPage.length && blockSize <= pageCapacity)) {
      currentPage.push(html);
      currentSize += blockSize;
      continue;
    }

    if (currentPage.length && remainingCapacity >= 500) {
      const sourceNode = blockDocument.body.firstChild;
      const splitCapacity = Math.max(300, Math.floor(remainingCapacity * 0.8));
      const fragments = sourceNode
        ? splitOversizedRichBlock(sourceNode, splitCapacity).filter(hasRenderableRichContent)
        : [];
      if (fragments.length > 1) {
        const firstFragmentDocument = new DOMParser().parseFromString(fragments[0], 'text/html');
        const firstFragmentSize = richBlockSize(firstFragmentDocument.body);
        if (firstFragmentSize <= remainingCapacity * 1.15) {
          currentPage.push(fragments[0]);
          flushPage();
          pendingBlocks.unshift(...fragments.slice(1));
          continue;
        }
      }
    }

    if (currentPage.length) {
      flushPage();
      pendingBlocks.unshift(html);
      continue;
    }

    currentPage.push(html);
    currentSize += blockSize;
  }
  flushPage();
  const visiblePages = pages.filter(hasRenderableRichContent);
  return visiblePages.length ? visiblePages : [];
};

const ApprovalStamp = ({ approval, placement = 'page' }) => {
  const approved = isApprovalComplete(approval);
  const placementClass = placement === 'approved-by'
    ? approved ? 'relative mt-3 h-[42mm] w-[42mm] opacity-100' : 'absolute left-1/2 top-7 h-[42mm] w-[42mm] -translate-x-1/2 opacity-0'
    : approved ? 'bottom-20 right-8 h-[42mm] w-[42mm] opacity-100' : 'inset-0 m-auto h-[42mm] w-[42mm] opacity-0';
  return <img src={APPROVAL_STAMP_PATH} alt={approved ? 'Final management approval stamp' : 'Final management approval stamp watermark'} className={`pointer-events-none object-contain mix-blend-multiply ${placement === 'page' ? 'absolute z-0' : ''} ${placementClass}`} />;
};
ApprovalStamp.propTypes = { approval: PropTypes.object, placement: PropTypes.oneOf(['page', 'approved-by']) };

const FinalSignatory = ({ name, designation, signedDate }) => <div className="max-w-[250px]"><div className="mb-2 border-t border-slate-600" /><p className="text-[11px] font-bold">{text(nameOnly(name), FINAL_APPROVER)}</p><p className="whitespace-pre-line">{text(designation, FINAL_APPROVER_TITLE)}</p><p>{FINAL_APPROVER_COMPANY}</p><p className="mt-1"><b>Date:</b> {signedDate ? dateTime(signedDate).split(',')[0] : ''}</p></div>;
FinalSignatory.propTypes = { name: PropTypes.string, designation: PropTypes.string, signedDate: PropTypes.string };

const DocumentHeader = ({ data }) => <header className="flex items-start justify-between px-1 pb-5"><div className="text-[#3275b6]"><h1 className="text-[11px] font-black uppercase tracking-wide">Purchase Order</h1><p className="mt-0.5 text-[9px] font-black">{text(data.po_number, 'PO NUMBER PENDING')}</p><p className="text-[7px] text-slate-500">{text(data.form_note, '(PO no. to be used in all documents)')}</p><p className="mt-2 text-[9px] font-bold">{date(data.po_date)}</p></div><div className="w-[100px] text-right"><img src={PROCUREMENT_DOCUMENT_BRANDING.logo.path} alt={PROCUREMENT_DOCUMENT_BRANDING.logo.alt} className="ml-auto h-auto w-full object-contain" /><p className="mt-1 text-[9px] font-bold leading-[10px] tracking-tight text-[#3275b6]">HOME OF THE<br />LEARNING MINDS</p></div></header>;
DocumentHeader.propTypes = { data: PropTypes.object.isRequired };

const DocumentFooter = ({ page }) => <footer className="mt-auto pt-5"><div className="flex h-7 items-center justify-around bg-[#0870aa] px-2 text-[6px] font-bold text-white"><img src={PROCUREMENT_DOCUMENT_BRANDING.logo.path} alt="" className="h-3 w-auto brightness-0 invert" /><span className="text-center leading-2">HOME of the<br />LEARNING MINDS</span><img src={PROCUREMENT_DOCUMENT_BRANDING.logo.path} alt="" className="h-3 w-auto brightness-0 invert" /><span className="text-center leading-2">HOME of the<br />LEARNING MINDS</span><img src={PROCUREMENT_DOCUMENT_BRANDING.logo.path} alt="" className="h-3 w-auto brightness-0 invert" /></div><div className="flex justify-between px-8 pt-1 text-[6px] leading-2 text-[#4e83ad]"><span>{BRANDING_CONFIG.brand.companyFull}<br />{BRANDING_CONFIG.contact.address.full}<br />Tel: {BRANDING_CONFIG.contact.phone.display} | {BRANDING_CONFIG.contact.website?.display || 'www.rejlers.ae'}</span><span className="self-end">Page {page}</span></div></footer>;
DocumentFooter.propTypes = { page: PropTypes.number.isRequired };

const Page = ({ data, page, children, finalApproval, showPageStamp = true }) => <section className="po-template-page relative mx-auto flex min-h-[760px] max-w-[560px] flex-col overflow-hidden border border-slate-400 bg-white px-10 py-6 text-[9px] leading-[1.35] text-slate-700 shadow-xl">{showPageStamp && <ApprovalStamp approval={finalApproval} />}<div className="relative z-[1]"><DocumentHeader data={data} /></div><div className="relative z-[1] flex-1">{children}</div><div className="relative z-[1]"><DocumentFooter data={data} page={page} /></div></section>;
Page.propTypes = { data: PropTypes.object.isRequired, page: PropTypes.number.isRequired, children: PropTypes.node.isRequired, finalApproval: PropTypes.object, showPageStamp: PropTypes.bool };
const Pair = ({ label, value, strong = false }) => <div className="grid grid-cols-[82px_1fr] gap-2"><b className="text-slate-600">{label}:</b><span className={`whitespace-pre-line ${strong ? 'font-bold text-slate-800' : ''}`}>{text(value)}</span></div>;
Pair.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.node, strong: PropTypes.bool };
const SectionTitle = ({ children }) => <h2 className="mb-2 mt-4 text-[10px] font-black uppercase tracking-wide text-slate-800">{children}</h2>;
SectionTitle.propTypes = { children: PropTypes.node.isRequired };

const PurchaseOrderLivePreview = ({ formData, vendor, files = [], documentOnly = false }) => {
  const recordedItems = Array.isArray(formData.items) ? formData.items : [];
  const fallbackSubtotal = Math.max(0, Number(formData.total_amount || 0) - Number(formData.tax_amount || 0) + Number(formData.discount_amount || 0));
  const sourceItems = recordedItems.length ? recordedItems : fallbackSubtotal > 0 ? [{ description: formData.title || formData.description, quantity: 1, unit_price: fallbackSubtotal, uom: 'LOT' }] : [];
  const items = sourceItems.map((item, index) => {
    const quantity = Number(item.quantity ?? item.qty ?? 1) || 0;
    const recordedTotal = Number(item.total ?? item.line_total ?? 0) || 0;
    return { ...item, line_code: item.line_code || item.lineCode || item.item_code || item.code || String(index + 1), description: item.description || item.item || item.name || formData.title, specification: item.specification, comments: item.comment || item.comments || item.remarks || item.notes, quantity, uom: item.uom || item.unit || item.unit_of_measure || 'EA', unit_price: Number(item.unit_price ?? item.price ?? (quantity ? recordedTotal / quantity : 0)) || 0, discount: Number(item.discount || 0) || 0 };
  });
  const subtotal = items.reduce((sum, item) => sum + itemTotal(item), 0);
  const lineDiscount = items.reduce((sum, item) => sum + Number(item.discount || 0), 0);
  const tax = Number(formData.tax_amount || (subtotal * Number(formData.vat_percentage || 0)) / 100);
  const total = Number(formData.total_amount || subtotal + tax);
  const approvals = Array.isArray(formData.approval_log) ? formData.approval_log : [];
  const finalApproval = approvals.find((approval) => approval.stage === FINAL_MANAGEMENT_STAGE);
  const finalApprovalDisplay = finalApproval || { stage: FINAL_MANAGEMENT_STAGE, approver: formData.approved_by_name || FINAL_APPROVER, status: 'Pending' };
  const finalApproverName = nameOnly(finalApprovalDisplay.approver || formData.approved_by_name) || FINAL_APPROVER;
  const finalDesignation = String(finalApproverName).trim().toLowerCase() === FINAL_APPROVER.toLowerCase()
    ? FINAL_APPROVER_TITLE
    : finalApprovalDisplay.designation || formData.approved_by_title || FINAL_APPROVER_TITLE;
  const project = formData.project_number || formData.rad_project_no || 'Multiple Projects';
  const buyerReferences = formData.contact_persons?.buyer_references?.filter((reference) => reference?.name)?.length
    ? formData.contact_persons.buyer_references.filter((reference) => reference?.name)
    : [{ name: formData.buyer_reference_pm || DEFAULT_BUYER_REFERENCE, email: formData.buyer_reference_email, designation: '' }];
  const buyerReference = buyerReferences.map((reference) => [reference.name, reference.designation, reference.email].filter(Boolean).join(' · ')).join('\n');
  const contacts = [];
  const headers = formData.items_table_headers && Object.keys(formData.items_table_headers).length
    ? formData.items_table_headers
    : DEFAULT_ITEMS_TABLE_HEADERS;
  const columnDefinitions = {
    line_code: { render: (item, index) => item.line_code || index + 1 },
    description: { render: (item) => text(item.description) },
    specification: { render: (item) => text(item.specification) },
    comment: { render: (item) => text(item.comments) },
    quantity: { numeric: true, render: (item) => Number(item.quantity || 0) },
    uom: { render: (item) => text(item.uom, '') },
    unit_price: { numeric: true, render: (item) => money(item.unit_price, formData.currency) },
    discount: { numeric: true, render: (item) => money(item.discount, formData.currency) },
    total_price: { numeric: true, render: (item) => money(itemTotal(item), formData.currency) },
  };
  const columnOrder = Array.isArray(headers.__column_order)
    ? headers.__column_order
    : Object.keys(headers).filter((key) => !key.startsWith('__'));
  const itemColumns = columnOrder.filter((key) => Object.hasOwn(headers, key)).map((key) => ({
    key,
    ...(columnDefinitions[key] || { render: (item) => text(item[key]) }),
  })).filter((column) => String(headers[column.key] || '').trim());
  const narrativePages = paginateRichHtml(formData.description);
  const itemChunks = [];
  const termsChunks = [];
  const summaryChunks = chunkArray(items, 9);
  const middlePageCount = narrativePages.length;
  const attachments = files.map((entry, index) => {
    const saved = entry.existingAttachment || entry;
    return {
      title: entry.title || saved.title || `Attachment ${index + 1}`,
      description: entry.description || saved.description || saved.filename || saved.name || entry.file?.name || `Attachment ${index + 1}`,
      filename: saved.filename || saved.name || entry.file?.name || '',
    };
  });

  return <div className={documentOnly ? 'po-template-document' : 'h-full overflow-y-auto bg-slate-200 p-4'}>
    {!documentOnly && <div className="sticky top-0 z-10 mb-3 flex items-center justify-between rounded-lg bg-slate-200/95 py-1 backdrop-blur"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#3275b6]">Live PO preview</p><p className="text-xs text-slate-500">Dynamic document · header and footer on every page</p></div><span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live</span></div>}
    <div className={documentOnly ? 'po-template-pages' : 'space-y-5'}>
      <Page data={formData} page={1} finalApproval={finalApproval} showPageStamp={false}>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 pt-2"><div className="space-y-1.5"><Pair label="Seller information" value={[vendor?.name, formData.seller_address || vendor?.address || vendor?.country].filter(Boolean).join('\n')} /><Pair label="Invoicing Address" value={DEFAULT_INVOICE_ADDRESS} /></div><div className="space-y-1.5"><Pair label="Seller Reference" value={formData.seller_reference} /><Pair label="Quote Ref." value={formData.quote_ref} /><Pair label="License No." value={formData.seller_license_no} /><Pair label="Buyer Reference" value={buyerReference} /></div></div>
        <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-1.5"><div className="space-y-1.5"><Pair label="Payment Terms" value={formData.payment_terms} /><Pair label="Payment Mode" value={formData.payment_mode} /><Pair label="Project" value={project} strong /></div><div className="space-y-1.5"><Pair label="Delivery terms" value={formData.delivery_terms} />{formData.contact_persons?.delivery_date_type === 'start' ? <><Pair label="Start date" value={date(formData.start_date)} /><Pair label="End date" value={date(formData.end_date)} /></> : <Pair label="Delivery date" value={date(formData.expected_delivery)} />}<Pair label="Marking" value={formData.marking || formData.po_number} strong /></div></div>
        <div className="mt-5 grid grid-cols-[1.15fr_1fr] gap-6 border-y-2 border-slate-600 py-2">
          <div><b>Purchase Summary:</b><p className="mt-1 font-bold">{text(formData.summary || formData.title)}</p></div>
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_auto] gap-3"><b>Total Purchase Price:</b><span>{amountWithCurrency(subtotal, formData.currency)}</span></div>
            <div className="grid grid-cols-[1fr_auto] gap-3"><b>VAT ({Number(formData.vat_percentage || 0)}%):</b><span>{amountWithCurrency(tax, formData.currency)}</span></div>
            <div className="grid grid-cols-[1fr_auto] gap-3 font-bold"><b>Total Sum:</b><span>{amountWithCurrency(total, formData.currency)}</span></div>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-5"><section className="relative min-h-[160px]"><b className="text-[10px]">Approved by:</b><ApprovalStamp approval={finalApproval} placement="approved-by" />{formData.approval_signature && <img src={formData.approval_signature} alt="Approval signature" className="mt-2 max-h-12 max-w-[150px] object-contain object-left" />}<div className={isApprovalComplete(finalApproval) ? 'mt-1' : formData.approval_signature ? 'mt-3' : 'mt-20'}><FinalSignatory name={finalApproval?.approver || formData.approved_by_name} designation={finalDesignation} signedDate={finalApproval?.approved_at || finalApproval?.date || formData.approved_at || formData.approved_date} /></div></section><section className="min-h-[160px] border-l border-slate-500 pl-3"><b className="text-[10px]">Order Confirmation:</b><p>We acknowledge receipt of your documents and will perform according to this PO.</p><div className="mt-4 space-y-2"><div className="grid grid-cols-[82px_1fr] items-end gap-2"><b className="text-slate-600">Seller Signature:</b><span className="h-5 border-b border-slate-600" /></div><Pair label="Date" value={date(formData.confirmation_date)} /><Pair label="Seller information" value={[vendor?.name, formData.seller_address || vendor?.address].filter(Boolean).join('\n')} /><Pair label="Phone / Email" value={[formData.seller_phone, formData.seller_email].filter(Boolean).join(' / ')} /></div></section></div>
      </Page>

      {narrativePages.map((pageContent, index) => <Page key={`pod-scope-${index}`} data={formData} page={2 + index} finalApproval={finalApproval}>{index === 0 && <p className="border-b border-slate-500 pb-2 text-[11px] font-bold"><u>PURCHASE ORDER:</u> &nbsp;{text(formData.title)}</p>}{index === 0 && <p className="mt-3">We, {BRANDING_CONFIG.brand.companyFull} (Buyer), issue this purchase order to <b>{text(vendor?.name)}</b> (Seller){formData.quote_ref ? ` according to quotation/reference ${formData.quote_ref}` : ''}.</p>}{index === 0 && <SectionTitle>PO Description &amp; Scope</SectionTitle>}<div className="po-rich-narrative font-normal [&_img]:my-2 [&_img]:max-h-[440px] [&_img]:max-w-full [&_img]:object-contain [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_table]:my-2 [&_table]:w-full [&_td]:border [&_td]:border-slate-500 [&_td]:p-1 [&_ul]:list-disc [&_ul]:pl-6" dangerouslySetInnerHTML={{ __html: pageContent }} /></Page>)}

      {itemChunks.map((pageItems, pageIndex) => {
        const offset = pageIndex * 7;
        return <Page key={`items-${pageIndex}`} data={formData} page={2 + narrativePages.length + pageIndex} finalApproval={finalApproval}>
          <SectionTitle>PO Description - Items {itemChunks.length > 1 ? `(${pageIndex + 1}/${itemChunks.length})` : ''}</SectionTitle>
          {itemColumns.length > 0 && <table className="mt-4 w-full border-collapse">
            <thead><tr className="bg-slate-100">{itemColumns.map((column) => <th key={column.key} className={`border border-slate-500 p-1 ${column.numeric ? 'text-right' : 'text-left'}`}>{headers[column.key]}</th>)}</tr></thead>
            <tbody>{pageItems.length ? pageItems.map((item, index) => <tr key={`${item.line_code}-${offset + index}`}>{itemColumns.map((column) => <td key={column.key} className={`border border-slate-500 p-1 ${column.numeric ? 'text-right' : 'text-left'}`}>{column.render(item, offset + index)}</td>)}</tr>) : <tr><td colSpan={itemColumns.length} className="border border-slate-500 p-5 text-center italic text-slate-400">Add items to populate this table.</td></tr>}</tbody>
          </table>}
          <SectionTitle>Prices</SectionTitle><p>The total purchase price excluding VAT is <b>{money(subtotal, formData.currency)}</b>.</p>
        </Page>;
      })}

      {false && <Page data={formData} page={2 + narrativePages.length + itemChunks.length} finalApproval={finalApproval}>
        <SectionTitle>Delivery & Commercial Details</SectionTitle><Pair label="Delivery Place" value={`${text(formData.contractor || BRANDING_CONFIG.brand.companyFull)}\n${BRANDING_CONFIG.contact.address.full}`} /><div className="mt-2"><Pair label="Delivery Terms" value={formData.delivery_terms} /><Pair label="Schedule" value={formData.time_schedule} /><Pair label="Payment Terms" value={formData.payment_terms} /><Pair label="Payment Mode" value={formData.payment_mode} /></div>
        {Array.isArray(formData.payment_milestones) && formData.payment_milestones.length > 0 && <><SectionTitle>Payment Milestones</SectionTitle><table className="w-full border-collapse"><thead><tr className="bg-slate-100"><th className="border border-slate-500 p-1 text-left">Milestone</th><th className="border border-slate-500 p-1 text-right">%</th><th className="border border-slate-500 p-1 text-right">Amount</th></tr></thead><tbody>{formData.payment_milestones.map((milestone, index) => <tr key={`milestone-${index}`}><td className="border border-slate-500 p-1">{text(milestone.milestone)}</td><td className="border border-slate-500 p-1 text-right">{text(milestone.percentage, '0')}%</td><td className="border border-slate-500 p-1 text-right">{money(milestone.amount, formData.currency)}</td></tr>)}</tbody></table></>}
        {(formData.inspection_requirements || formData.safety_requirements || formData.warranty_period || formData.performance_requirements) && <><SectionTitle>Requirements</SectionTitle><p className="whitespace-pre-wrap">{[formData.inspection_requirements, formData.safety_requirements, formData.warranty_period, formData.performance_requirements].filter(Boolean).join('\n')}</p></>}
        <SectionTitle>Focal Point</SectionTitle><div className="space-y-2">{contacts.length ? contacts.map((contact, index) => <div key={`${contact.name || 'contact'}-${index}`}><b>{text(contact.name || contact.role)}</b><p>{[contact.email, contact.phone].filter(Boolean).join(' · ')}</p></div>) : <><p><u>Seller:</u> {text(formData.seller_contact_person)} · {text(formData.seller_email)}</p><p><u>Buyer:</u> {text(formData.buyer_reference_pm || DEFAULT_BUYER_REFERENCE)}</p></>}</div>
      </Page>}

      {termsChunks.map((content, index) => <Page key={`terms-${index}`} data={formData} page={2 + narrativePages.length + itemChunks.length + 1 + index} finalApproval={finalApproval}><SectionTitle>Terms & Conditions {termsChunks.length > 1 ? `(${index + 1}/${termsChunks.length})` : ''}</SectionTitle><p className="whitespace-pre-wrap">{text(content)}</p></Page>)}

      {summaryChunks.map((pageItems, pageIndex) => {
        const last = pageIndex === summaryChunks.length - 1;
        const offset = pageIndex * 9;
        return <Page key={`summary-${pageIndex}`} data={formData} page={2 + middlePageCount + pageIndex} finalApproval={finalApproval}>
          <SectionTitle>Summary of Prices {summaryChunks.length > 1 ? `(${pageIndex + 1}/${summaryChunks.length})` : ''}</SectionTitle>
          {itemColumns.length > 0 && <table className="mt-4 w-full border-collapse"><thead><tr className="border-y-2 border-slate-600">{itemColumns.map((column) => <th key={column.key} className={`p-1 ${column.numeric ? 'text-right' : 'text-left'}`}>{headers[column.key]}</th>)}</tr></thead><tbody>{pageItems.length ? pageItems.map((item, index) => <tr key={`summary-${offset + index}`} className="align-top">{itemColumns.map((column) => <td key={column.key} className={`px-2 py-3 ${column.numeric ? 'text-right' : 'text-left'} ${column.key === 'description' || column.key === 'total_price' ? 'font-bold' : ''}`}>{column.render(item, offset + index)}</td>)}</tr>) : <tr><td colSpan={itemColumns.length} className="py-16 text-center italic text-slate-400">Price summary will appear when items are added.</td></tr>}</tbody></table>}
          {last && <div className="mt-8 ml-auto w-[230px] border-2 border-slate-600 p-2 text-[10px]"><div className="flex justify-between"><b>Total Price:</b><b>{money(subtotal, formData.currency)}</b></div>{lineDiscount > 0 && <div className="flex justify-between"><b>Discount:</b><span>{money(lineDiscount, formData.currency)}</span></div>}<div className="flex justify-between"><b>VAT ({Number(formData.vat_percentage || 0)}%):</b><b>{money(tax, formData.currency)}</b></div><div className="flex justify-between"><b>Total Sum:</b><b>{money(total, formData.currency)}</b></div>{String(formData.currency || '').toUpperCase() === 'USD' && <div className="mt-1 flex justify-between border-t border-slate-400 pt-1"><b>Grand Total USD in AED:</b><b>{money(total * USD_TO_AED_RATE, 'AED')}</b></div>}</div>}
        </Page>;
      })}

      {attachments.map((attachment, index) => <Page key={`attachment-${index}`} data={formData} page={2 + middlePageCount + summaryChunks.length + index} finalApproval={finalApproval} showPageStamp={false}>
        <div className="flex h-full min-h-[560px] flex-col items-center justify-center text-center">
          <h2 className="text-[22px] font-black uppercase tracking-wide text-[#3275b6]">ATTACHMENT - {index + 1}</h2>
          <p className="mt-8 max-w-[420px] whitespace-pre-wrap text-[12px] leading-5 text-slate-700">{text(attachment.description)}</p>
          {attachment.filename && <p className="mt-5 text-[8px] text-slate-400">{attachment.filename}</p>}
        </div>
      </Page>)}
    </div>
  </div>;
};

PurchaseOrderLivePreview.propTypes = { formData: PropTypes.object.isRequired, vendor: PropTypes.object, files: PropTypes.arrayOf(PropTypes.object), documentOnly: PropTypes.bool };
export default PurchaseOrderLivePreview;
