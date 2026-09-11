import { radaiAlert, radaiConfirm } from '../../services/radaiDialog'
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ArrowLeftIcon,
  ShoppingCartIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  UserIcon,
  TruckIcon,
  DocumentTextIcon,
  PencilIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  XMarkIcon,
  PrinterIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import { getStatusConfig } from '../../config/procurement.config';
import { BRANDING_CONFIG } from '../../config/branding.config';
import PurchaseOrderLivePreview from './PurchaseOrderLivePreview';
import PurchaseOrderForm from './PurchaseOrderForm';
import { buildProcurementPdfFilename } from '../../utils/procurementPdfFilename';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTimestamp = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return `${parsed.toLocaleString('en-GB', {
    timeZone: 'Asia/Dubai',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })} GST`;
};

const formatMoney = (value, currency = 'USD') => {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || 'USD'} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  }
};

const textOrDash = (value) => String(value || '').trim() || '—';
const purchaseOrderPdfRequests = new Map();

const requestPurchaseOrderPdf = (id) => {
  if (!purchaseOrderPdfRequests.has(id)) {
    const request = apiClient.get(`/procurement/orders/${id}/export-pdf/`, {
      responseType: 'blob',
      timeout: 120000,
      suppressErrorToast: true,
    }).finally(() => purchaseOrderPdfRequests.delete(id));
    purchaseOrderPdfRequests.set(id, request);
  }
  return purchaseOrderPdfRequests.get(id);
};

/**
 * Purchase Order Detail Page - Soft-Coded Design
 * Displays comprehensive PO information with status tracking
 */
const PurchaseOrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Soft-coded state management
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState('');
  const [printPreviewLoading, setPrintPreviewLoading] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [pdfPreviewFilename, setPdfPreviewFilename] = useState('');
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [pdfPreviewError, setPdfPreviewError] = useState('');
  const [pdfPreviewRetryKey, setPdfPreviewRetryKey] = useState(0);

  const handlePrintPurchaseOrder = async () => {
    try {
      setPrintPreviewLoading(true);
      const response = await apiClient.get(`/procurement/orders/${id}/export-pdf/`, {
        responseType: 'blob',
        timeout: 120000,
      });
      const fallbackPreviewFilename = buildProcurementPdfFilename(
        order?.po_number || 'Purchase_Order',
        'po',
        order?.po_date,
      );
      const disposition = response.headers?.['content-disposition'] || '';
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
      const previewFilename = filenameMatch?.[1] || fallbackPreviewFilename;
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      // Open the preview tab only after the PDF is fully generated.
      const previewWindow = window.open('', '_blank');
      if (!previewWindow) {
        URL.revokeObjectURL(url);
        toast.error('Popup blocked. Please allow popups to open print preview.');
        return;
      }

      const previewHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${previewFilename}</title>
  <style>
    html, body { height: 100%; margin: 0; background: #0f172a; }
    .shell { height: 100%; display: flex; flex-direction: column; }
    .bar { color: #e2e8f0; font: 600 13px/1.4 Arial, sans-serif; padding: 10px 14px; border-bottom: 1px solid #334155; background: #111827; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .download { flex: none; border-radius: 6px; background: #0870aa; color: #fff; padding: 6px 10px; text-decoration: none; }
    .download:hover { background: #0b82c4; }
    embed { flex: 1; width: 100%; border: 0; background: #fff; }
    .fallback { padding: 12px 14px; background: #0b1220; color: #cbd5e1; font: 500 12px/1.4 Arial, sans-serif; }
    .fallback a { color: #93c5fd; }
  </style>
</head>
<body>
  <div class="shell">
    <div class="bar"><span>${previewFilename}</span><a class="download" href="${url}" download="${previewFilename}">Download PDF</a></div>
    <embed src="${url}#toolbar=1&navpanes=0&scrollbar=1" type="application/pdf" />
    <div class="fallback">If preview is not visible, <a href="${url}" target="_self">open the PDF directly</a>.</div>
  </div>
</body>
</html>`;

      previewWindow.document.open();
      previewWindow.document.write(previewHtml);
      previewWindow.document.close();

      window.setTimeout(() => URL.revokeObjectURL(url), 600000);
    } catch (previewError) {
      console.error('Failed to prepare the Purchase Order print preview:', previewError);
      toast.error('Failed to prepare the Purchase Order print preview.');
    } finally {
      setPrintPreviewLoading(false);
    }
  };

  const handleExportPurchaseOrder = async (format) => {
    try {
      setExportLoading(format);
      const response = await apiClient.get(`/procurement/orders/${id}/export-${format}/`, {
        responseType: 'blob',
        timeout: 120000,
      });
      const fallbackPdfName = buildProcurementPdfFilename(
        order?.po_number || `PO-${id}`,
        'po',
        order?.po_date,
      );
      const fallbackName = format === 'word'
        ? fallbackPdfName.replace(/\.pdf$/i, '.docx')
        : fallbackPdfName;
      const disposition = response.headers?.['content-disposition'] || '';
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
      const filename = filenameMatch?.[1] || fallbackName;
      const downloadUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (exportError) {
      console.error(`Failed to export Purchase Order as ${format}:`, exportError);
      await radaiAlert(`Failed to export the Purchase Order as ${format === 'word' ? 'Word' : 'PDF'}.`);
    } finally {
      setExportLoading('');
    }
  };

  /**
   * Soft-coded data fetching with error handling
   */
  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await apiClient.get(`/procurement/orders/${id}/`);
        setOrder(response.data);
      } catch (error) {
        console.error('Error fetching order details:', error);
        const statusCode = error.response?.status;
        const backendMessage =
          error.response?.data?.detail ||
          error.response?.data?.error ||
          error.response?.data?.message;

        const defaultMessage = statusCode === 500
          ? 'Failed to load purchase order details (server error). Please ensure backend migrations are up to date.'
          : 'Failed to load purchase order details';

        setError({
          message: backendMessage || defaultMessage,
          action: () => navigate('/procurement/orders')
        });
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchOrderDetails();
    }
  }, [id, navigate]);

  useEffect(() => {
    if (!id || !order) return undefined;

    let active = true;
    let objectUrl = '';
    setPdfPreviewLoading(true);
    setPdfPreviewError('');
    setPdfPreviewUrl('');

    requestPurchaseOrderPdf(id)
      .then((response) => {
        if (!active) return;
        const fallbackFilename = buildProcurementPdfFilename(
          order.po_number || `PO-${id}`,
          'po',
          order.po_date,
        );
        const disposition = response.headers?.['content-disposition'] || '';
        const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
        objectUrl = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
        setPdfPreviewFilename(filenameMatch?.[1] || fallbackFilename);
        setPdfPreviewUrl(objectUrl);
      })
      .catch((previewError) => {
        if (!active) return;
        console.error('Failed to load the embedded Purchase Order PDF:', previewError);
        setPdfPreviewError('The Purchase Order PDF could not be generated.');
      })
      .finally(() => {
        if (active) setPdfPreviewLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, order, pdfPreviewRetryKey]);

  /**
   * Soft-coded action handler: Send Order
   */
  const handleSendOrder = async () => {
    const confirmed = (await radaiConfirm(`Send Purchase Order ${order.po_number} to vendor?`));
    if (!confirmed) return;

    try {
      setActionLoading(true);
      await apiClient.patch(`/procurement/orders/${id}/`, { status: 'sent' });
      
      // Update local state
      setOrder(prev => ({ ...prev, status: 'sent' }));
      toast.success('Purchase Order sent successfully.');
    } catch (error) {
      console.error('Error sending order:', error);
      toast.error(`Failed to send order: ${error.response?.data?.detail || error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Soft-coded action handler: Mark as Completed
   */
  const handleMarkComplete = async () => {
    const confirmed = (await radaiConfirm(`Mark Purchase Order ${order.po_number} as completed?`));
    if (!confirmed) return;

    try {
      setActionLoading(true);
      await apiClient.patch(`/procurement/orders/${id}/`, { status: 'completed' });
      
      setOrder(prev => ({ ...prev, status: 'completed' }));
      toast.success('Purchase Order marked as completed.');
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error(`Failed to update order: ${error.response?.data?.detail || error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprovalDecision = async (decision) => {
    if (decision === 'reject' && approvalComment.trim().length < 3) {
      toast.error('Please enter a rejection reason.');
      return;
    }
    try {
      setActionLoading(true);
      const response = await apiClient.post(`/procurement/orders/${id}/${decision}/`, {
        approval_stage: order.current_approval?.stage,
        note: approvalComment.trim(),
      });
      setOrder(response.data.purchase_order);
      setApprovalComment('');
      window.dispatchEvent(new Event('procurement-approval-updated'));
      toast.success(`Purchase Order ${decision === 'approve' ? 'approved' : 'rejected'} successfully.`);
    } catch (decisionError) {
      toast.error(decisionError.response?.data?.detail || decisionError.response?.data?.error || `Failed to ${decision} Purchase Order.`);
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Soft-coded status badge renderer
   */
  const getStatusBadge = (status) => {
    const config = getStatusConfig('purchaseOrder', status);
    const colorClasses = {
      green: 'bg-green-100 text-green-800 border-green-300',
      red: 'bg-red-100 text-red-800 border-red-300',
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      blue: 'bg-blue-100 text-blue-800 border-blue-300',
      gray: 'bg-gray-100 text-gray-800 border-gray-300'
    };
    
    return (
      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${colorClasses[config.color]}`}>
        {config.label}
      </span>
    );
  };

  // Loading state - soft-coded
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-sm text-gray-600">Loading purchase order...</p>
        </div>
      </div>
    );
  }

  // Error state - soft-coded
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <XMarkIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Order</h3>
          <p className="text-sm text-gray-600 mb-4">{error.message}</p>
          <button
            onClick={error.action}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  // No order found - soft-coded
  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ShoppingCartIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Order Not Found</h3>
          <Link
            to="/procurement/orders"
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  const currency = order.currency || 'USD';
  const fallbackSubtotal = Number(order.total_amount || 0)
    - Number(order.tax_amount || 0)
    + Number(order.discount_amount || 0);
  const printableItems = Array.isArray(order.items) && order.items.length > 0
    ? order.items.map((item, index) => {
        const quantity = Number(item.quantity ?? item.qty ?? 1) || 0;
        const unitPrice = Number(item.unit_price ?? item.price ?? 0) || 0;
        return {
          id: item.id || index + 1,
          lineCode: item.line_code || item.lineCode || item.item_code || item.code || '',
          description: item.description || item.item || item.name || order.title || 'Purchase order item',
          comment: item.comment || item.comments || item.remarks || item.notes || '',
          quantity,
          unit: item.unit || item.uom || item.unit_of_measure || 'EA',
          unitPrice,
          total: Number(item.total ?? item.line_total ?? quantity * unitPrice) || 0,
        };
      })
    : [{
        id: 1,
        lineCode: '',
        description: order.title || order.description || 'Purchase order scope',
        comment: '',
        quantity: 1,
        unit: 'LOT',
        unitPrice: fallbackSubtotal,
        total: fallbackSubtotal,
      }];
  const itemSubtotal = printableItems.reduce((sum, item) => sum + item.total, 0);
  const discountAmount = Number(order.discount_amount || 0);
  const taxAmount = Number(order.tax_amount || 0);
  const grandTotal = Number(order.total_amount || itemSubtotal - discountAmount + taxAmount);
  const invoicingEmails = Array.isArray(order.invoicing_emails)
    ? order.invoicing_emails.join(', ')
    : order.invoicing_emails;
  const approvalSignatureSource = /^(data:image\/|https?:\/\/|\/)/i.test(order.approval_signature || '')
    ? order.approval_signature
    : null;
  const printableAttachments = (Array.isArray(order.attachments) ? order.attachments : [])
    .map((attachment) => {
      if (typeof attachment === 'string') {
        return { name: attachment.split('/').pop() || attachment };
      }
      return {
        ...attachment,
        name: attachment.name || attachment.file_name || attachment.filename || 'Attachment',
      };
    });
  const printableVendor = {
    name: order.vendor_name,
    address: order.vendor_address || order.seller_address,
    country: order.vendor_country || order.country,
  };
  return (
    <>
      {createPortal(
        <section className="po-print-document" aria-label="Printable purchase order">
          <style>{`
            .po-print-document { display: none; }
            @page { size: A4 portrait; margin: 0; }
            @media print {
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #fff !important;
                color: #111827 !important;
                height: auto !important;
                overflow: visible !important;
              }
              body > * { display: none !important; }
              body > .po-print-document {
                display: block !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
              }
              .po-print-document, .po-print-document * {
                box-sizing: border-box;
                visibility: visible !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .po-template-document, .po-template-pages { margin: 0 !important; padding: 0 !important; }
              .po-template-page {
                width: 210mm !important;
                max-width: none !important;
                min-height: 297mm !important;
                height: 297mm !important;
                margin: 0 !important;
                padding: 14mm 16mm 10mm !important;
                border: 0 !important;
                box-shadow: none !important;
                break-after: page;
                page-break-after: always;
                overflow: hidden !important;
              }
              .po-template-page:last-child {
                break-after: auto;
                page-break-after: auto;
              }
              .po-template-page table { border-collapse: collapse; }
              .po-template-page tr { break-inside: avoid; page-break-inside: avoid; }
              a { color: inherit !important; text-decoration: none !important; }
            }
          `}</style>
          <PurchaseOrderLivePreview
            formData={order}
            vendor={printableVendor}
            files={printableAttachments}
            documentOnly
          />
        </section>,
        document.body
      )}

      {false && createPortal(
        <>
          <style>{`
        .po-print-document { display: none; }
        @page { size: A4 portrait; margin: 11mm 10mm 12mm; }
        @media print {
          html, body {
            background: #fff !important;
            color: #111827 !important;
            height: auto !important;
            overflow: visible !important;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 9pt;
          }
          body > * { display: none !important; }
          body > .po-print-document {
            display: block !important;
            position: static !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          .po-print-document, .po-print-document * {
            visibility: visible !important;
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .po-print-document table { width: 100%; border-collapse: collapse; }
          .po-print-document thead { display: table-header-group; }
          .po-print-document tr, .po-print-block { break-inside: avoid; page-break-inside: avoid; }
          .po-print-footer {
            position: static !important;
            margin-top: 4mm;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .po-page-number::after { content: counter(page); }
          a { color: inherit !important; text-decoration: none !important; }
        }
          `}</style>

          <section className="po-print-document" aria-label="Printable purchase order">
        <header className="border-b-2 border-gray-900 pb-3">
          <div className="flex items-start justify-between gap-6">
            <div>
              <img
                src={BRANDING_CONFIG.logo.primary.path}
                alt={BRANDING_CONFIG.logo.primary.alt}
                className="h-9 w-auto object-contain"
              />
              <p className="mt-2 text-[8px] leading-3 text-gray-600">
                {BRANDING_CONFIG.contact.address.full}<br />
                Tel: {BRANDING_CONFIG.contact.phone.display}
              </p>
            </div>
            <div className="text-right">
              <h1 className="text-[22px] font-bold tracking-[0.14em] text-gray-950">PURCHASE ORDER</h1>
              <p className="mt-1 text-[9px] font-semibold text-gray-600">Original / Vendor Copy</p>
            </div>
          </div>
        </header>

        <table className="mt-3 border border-gray-400 text-[8.5px]">
          <tbody>
            <tr>
              <th className="w-[16%] border border-gray-400 bg-gray-100 px-2 py-1.5 text-left font-semibold">PO Number</th>
              <td className="w-[34%] border border-gray-400 px-2 py-1.5 font-bold">{textOrDash(order.po_number)}</td>
              <th className="w-[16%] border border-gray-400 bg-gray-100 px-2 py-1.5 text-left font-semibold">PO Date</th>
              <td className="w-[34%] border border-gray-400 px-2 py-1.5">{formatDate(order.po_date)}</td>
            </tr>
            <tr>
              <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left font-semibold">Project</th>
              <td className="border border-gray-400 px-2 py-1.5">{textOrDash(order.project_display || order.project_number || order.rad_project_no)}</td>
              <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left font-semibold">PR / Quote Ref.</th>
              <td className="border border-gray-400 px-2 py-1.5">{textOrDash(order.pr_number || order.quote_ref || order.marking)}</td>
            </tr>
            <tr>
              <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left font-semibold">Status</th>
              <td className="border border-gray-400 px-2 py-1.5 uppercase">{textOrDash(order.status_display || order.status)}</td>
              <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left font-semibold">Required Delivery</th>
              <td className="border border-gray-400 px-2 py-1.5">{formatDate(order.expected_delivery)}</td>
            </tr>
          </tbody>
        </table>

        <div className="po-print-block mt-3 grid grid-cols-2 gap-3">
          <section className="border border-gray-400">
            <h2 className="bg-gray-900 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wide text-white">Buyer / Invoice To</h2>
            <div className="min-h-[94px] px-3 py-2 text-[8.5px] leading-4">
              <p className="font-bold">{BRANDING_CONFIG.brand.companyFull}</p>
              <p>{BRANDING_CONFIG.contact.address.full}</p>
              <p className="mt-1"><span className="font-semibold">Attention:</span> {textOrDash(order.invoicing_attn)}</p>
              <p><span className="font-semibold">Email:</span> {textOrDash(invoicingEmails)}</p>
              <p><span className="font-semibold">Fax:</span> {textOrDash(order.company_fax)}</p>
            </div>
          </section>
          <section className="border border-gray-400">
            <h2 className="bg-gray-900 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wide text-white">Supplier / Vendor</h2>
            <div className="min-h-[94px] px-3 py-2 text-[8.5px] leading-4">
              <p className="font-bold">{textOrDash(order.vendor_name)}</p>
              <p><span className="font-semibold">Contact:</span> {textOrDash(order.seller_contact_person || order.seller_reference)}</p>
              <p><span className="font-semibold">Email:</span> {textOrDash(order.seller_email)}</p>
              <p><span className="font-semibold">Phone:</span> {textOrDash(order.seller_phone)}</p>
              <p><span className="font-semibold">Address:</span> {textOrDash(order.seller_address)}</p>
              <p><span className="font-semibold">License / Registration:</span> {textOrDash(order.seller_license_no)}</p>
            </div>
          </section>
        </div>

        <section className="po-print-block mt-3 border border-gray-400">
          <div className="grid grid-cols-[90px_1fr] text-[8.5px]">
            <div className="border-r border-gray-400 bg-gray-100 px-2 py-1.5 font-semibold">Subject</div>
            <div className="px-2 py-1.5 font-semibold">{textOrDash(order.title)}</div>
          </div>
          {order.description && (
            <div className="grid grid-cols-[90px_1fr] border-t border-gray-400 text-[8.5px]">
              <div className="border-r border-gray-400 bg-gray-100 px-2 py-1.5 font-semibold">Description</div>
              <div className="whitespace-pre-wrap px-2 py-1.5">{order.description}</div>
            </div>
          )}
        </section>

        <table className="mt-3 text-[8.5px]">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="w-[5%] border border-gray-500 px-1 py-2 text-center">No.</th>
              <th className="w-[10%] border border-gray-500 px-1.5 py-2 text-left">Line Code</th>
              <th className="w-[27%] border border-gray-500 px-2 py-2 text-left">Description of Goods / Services</th>
              <th className="w-[15%] border border-gray-500 px-1.5 py-2 text-left">Comment</th>
              <th className="w-[8%] border border-gray-500 px-1 py-2 text-right">Qty</th>
              <th className="w-[7%] border border-gray-500 px-1 py-2 text-center">Unit</th>
              <th className="w-[13%] border border-gray-500 px-1.5 py-2 text-right">Unit Price</th>
              <th className="w-[15%] border border-gray-500 px-1.5 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {printableItems.map((item, index) => (
              <tr key={item.id}>
                <td className="border border-gray-400 px-1.5 py-2 text-center align-top">{index + 1}</td>
                <td className="border border-gray-400 px-1.5 py-2 align-top">{textOrDash(item.lineCode)}</td>
                <td className="border border-gray-400 px-2 py-2 align-top">{item.description}</td>
                <td className="border border-gray-400 px-1.5 py-2 align-top">{textOrDash(item.comment)}</td>
                <td className="border border-gray-400 px-1.5 py-2 text-right align-top">{item.quantity.toLocaleString()}</td>
                <td className="border border-gray-400 px-1.5 py-2 text-center align-top">{item.unit}</td>
                <td className="border border-gray-400 px-2 py-2 text-right align-top">{formatMoney(item.unitPrice, currency)}</td>
                <td className="border border-gray-400 px-2 py-2 text-right align-top font-medium">{formatMoney(item.total, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="po-print-block mt-2 flex justify-end">
          <table className="w-[46%] text-[8.5px]">
            <tbody>
              <tr><th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">Subtotal</th><td className="border border-gray-400 px-2 py-1.5 text-right">{formatMoney(itemSubtotal, currency)}</td></tr>
              {discountAmount > 0 && <tr><th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">Discount</th><td className="border border-gray-400 px-2 py-1.5 text-right">− {formatMoney(discountAmount, currency)}</td></tr>}
              <tr><th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">VAT / Tax ({Number(order.vat_percentage || 0)}%)</th><td className="border border-gray-400 px-2 py-1.5 text-right">{formatMoney(taxAmount, currency)}</td></tr>
              <tr className="font-bold"><th className="border border-gray-900 bg-gray-900 px-2 py-2 text-left text-white">Grand Total</th><td className="border border-gray-900 px-2 py-2 text-right text-[10px]">{formatMoney(grandTotal, currency)}</td></tr>
            </tbody>
          </table>
        </div>

        <section className="po-print-block mt-3 border border-gray-400 text-[8.5px]">
          <h2 className="bg-gray-100 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wide">Commercial & Delivery Terms</h2>
          <div className="grid grid-cols-2">
            <div className="border-r border-t border-gray-400 px-2 py-1.5"><span className="font-semibold">Payment terms:</span> {textOrDash(order.payment_terms)}</div>
            <div className="border-t border-gray-400 px-2 py-1.5"><span className="font-semibold">Payment mode:</span> {textOrDash(order.payment_mode)}</div>
            <div className="border-r border-t border-gray-400 px-2 py-1.5"><span className="font-semibold">Delivery terms:</span> {textOrDash(order.delivery_terms)}</div>
            <div className="border-t border-gray-400 px-2 py-1.5"><span className="font-semibold">Delivery date:</span> {formatDate(order.expected_delivery)}</div>
          </div>
        </section>

        {(order.scope_of_services || order.terms_and_conditions || order.notes) && (
          <section className="mt-3 border border-gray-400 text-[8.5px]">
            <h2 className="bg-gray-100 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wide">Scope, Terms & Notes</h2>
            <div className="space-y-2 border-t border-gray-400 px-3 py-2 leading-4">
              {order.scope_of_services && <div><span className="font-semibold">Scope:</span> <span className="whitespace-pre-wrap">{order.scope_of_services}</span></div>}
              {order.terms_and_conditions && <div><span className="font-semibold">Terms and conditions:</span> <span className="whitespace-pre-wrap">{order.terms_and_conditions}</span></div>}
              {order.notes && <div><span className="font-semibold">Notes:</span> <span className="whitespace-pre-wrap">{order.notes}</span></div>}
            </div>
          </section>
        )}

        <section className="po-print-block mt-4 grid grid-cols-2 gap-8 text-[8.5px]">
          <div className="min-h-[74px] border-t border-gray-500 pt-2">
            <p className="font-bold">Prepared / Buyer Reference</p>
            <p>{textOrDash(order.buyer_reference_pe || order.created_by_name)}</p>
            <p className="text-gray-600">Procurement</p>
          </div>
          <div className="min-h-[74px] border-t border-gray-500 pt-2">
            <p className="font-bold">Approved By</p>
            <p>{textOrDash(order.approved_by_name || order.approved_by_user_name)}</p>
            <p>{textOrDash(order.approved_by_title)}</p>
            <p>Timestamp: {formatTimestamp(order.approved_at || order.approval_log?.find((entry) => String(entry.status).toLowerCase() === 'approved')?.approved_at || order.approval_log?.find((entry) => String(entry.status).toLowerCase() === 'approved')?.date || order.approved_date)}</p>
            {approvalSignatureSource && (
              <img src={approvalSignatureSource} alt="Approval signature" className="mt-1 max-h-9 max-w-[150px] object-contain object-left" />
            )}
          </div>
        </section>

        <footer className="po-print-footer flex items-center justify-between border-t border-gray-400 pt-1 text-[7px] text-gray-500">
          <span>{textOrDash(order.form_note)}</span>
          <span>PO: {textOrDash(order.po_number)} · Page <span className="po-page-number" /></span>
        </footer>
          </section>
        </>,
        document.body
      )}

    <div className="po-screen-view min-h-screen bg-slate-50">
      <div className="py-4 sm:py-6">
        <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-8">
          <header className="mb-5 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-start gap-3">
              <button
                onClick={() => navigate('/procurement/orders')}
                  aria-label="Back to purchase orders"
                  title="Back to purchase orders"
                  className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </button>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                      {order.po_number || `PO-${order.id}`}
                    </h1>
                    {getStatusBadge(order.status)}
                    {typeof order.po_number_verified === 'boolean' && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          order.po_number_verified
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                        title={order.po_number_verification_message}
                      >
                        {order.po_number_verified ? 'Number verified' : 'Number requires correction'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2" aria-label="Purchase order actions">
              <button
                type="button"
                onClick={handlePrintPurchaseOrder}
                disabled={printPreviewLoading}
                  aria-label={printPreviewLoading ? 'Preparing print preview' : 'Print preview'}
                  title={printPreviewLoading ? 'Preparing print preview' : 'Print preview'}
                  className="inline-grid h-9 w-9 place-items-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                <PrinterIcon className={`h-4 w-4 ${printPreviewLoading ? 'animate-pulse' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => handleExportPurchaseOrder('word')}
                disabled={Boolean(exportLoading)}
                  aria-label={exportLoading === 'word' ? 'Preparing Word document' : 'Export Word document'}
                  title={exportLoading === 'word' ? 'Preparing Word document' : 'Export Word document'}
                  className="inline-grid h-9 w-9 place-items-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                <ArrowDownTrayIcon className={`h-4 w-4 ${exportLoading === 'word' ? 'animate-pulse' : ''}`} />
              </button>
              
              {order.status === 'draft' && (
                <button
                  onClick={handleSendOrder}
                  disabled={actionLoading}
                    className="inline-flex h-9 items-center rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                  {actionLoading ? 'Sending...' : 'Send to Vendor'}
                </button>
              )}
              
              {(order.status === 'sent' || order.status === 'acknowledged' || order.status === 'in_progress') && (
                <button
                  onClick={handleMarkComplete}
                  disabled={actionLoading}
                    className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  <CheckCircleIcon className="h-4 w-4 mr-2" />
                  {actionLoading ? 'Updating...' : 'Mark Complete'}
                </button>
              )}
              
              {order.status !== 'completed' && (
                <button
                  onClick={() => setShowEditForm(true)}
                    className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                >
                  <PencilIcon className="h-4 w-4 mr-2" />
                  Edit
                </button>
              )}
              </div>
            </div>
          </header>

          {order.can_approve && (
            <section className="mb-6 rounded-xl border-2 border-amber-300 bg-amber-50 p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Decision required</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-950">
                    Level {order.current_approval?.level ?? '—'} · {order.current_approval?.stage || 'Purchase Order approval'}
                  </h2>
                  <label className="mt-3 block text-xs font-semibold text-slate-700" htmlFor="po-approval-comment">Comment / rejection reason</label>
                  <textarea
                    id="po-approval-comment"
                    value={approvalComment}
                    onChange={(event) => setApprovalComment(event.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                    placeholder="Optional for approval; required for rejection"
                  />
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" disabled={actionLoading} onClick={() => handleApprovalDecision('reject')} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50">
                    <XMarkIcon className="h-5 w-5" /> Reject
                  </button>
                  <button type="button" disabled={actionLoading} onClick={() => handleApprovalDecision('approve')} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                    <CheckCircleIcon className="h-5 w-5" /> Approve
                  </button>
                </div>
              </div>
            </section>
          )}

          {showEditForm && order.status !== 'completed' && (
            <PurchaseOrderForm
              isOpen={showEditForm}
              editData={order}
              onClose={() => setShowEditForm(false)}
              onSuccess={(updatedOrder) => {
                setOrder(updatedOrder);
                setShowEditForm(false);
              }}
            />
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            {/* Left Column - Order Information */}
            <div className="space-y-6 xl:col-span-3">
              {/* Basic Information Card */}
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="mb-5 flex items-center text-base font-semibold text-slate-900">
                  <DocumentTextIcon className="h-5 w-5 mr-2 text-indigo-600" />
                  Order Information
                </h2>

                <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">PO Number</dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-950">{order.po_number || '-'}</dd>
                  </div>
                  
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Order Date</dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {order.po_date ? new Date(order.po_date).toLocaleDateString() : '-'}
                    </dd>
                  </div>
                  
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expected Delivery</dt>
                    <dd className="mt-1 text-sm text-slate-900">
                      {order.expected_delivery ? new Date(order.expected_delivery).toLocaleDateString() : '-'}
                    </dd>
                  </div>
                  
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project</dt>
                    <dd className="mt-1 text-sm text-slate-900">{order.project_number || '-'}</dd>
                  </div>
                  
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Title / Description</dt>
                    <dd className="mt-1 text-sm leading-6 text-slate-900">{order.title || order.description || '-'}</dd>
                  </div>
                  
                  {order.notes && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</dt>
                      <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-900">{order.notes}</dd>
                    </div>
                  )}
                </dl>
              </section>

              {/* Financial Information Card */}
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="mb-5 flex items-center text-base font-semibold text-slate-900">
                  <CurrencyDollarIcon className="h-5 w-5 mr-2 text-green-600" />
                  Financial Details
                </h2>

                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-slate-50 p-4">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Net Amount</dt>
                    <dd className="mt-1 text-lg font-bold text-slate-900">{formatMoney(itemSubtotal, currency)}</dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-4">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">VAT / Tax</dt>
                    <dd className="mt-1 text-lg font-bold text-slate-900">{formatMoney(taxAmount, currency)}</dd>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Total Amount</dt>
                    <dd className="mt-1 text-xl font-bold text-emerald-800">{formatMoney(grandTotal, currency)}</dd>
                  </div>
                </dl>
                <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
                  <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Currency</dt><dd className="mt-1 text-sm font-semibold text-slate-900">{currency}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Terms</dt><dd className="mt-1 text-sm text-slate-900">{order.payment_terms || 'Not specified'}</dd></div>
                </dl>
              </section>

              <div className="grid gap-4 sm:grid-cols-2">
                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="mb-4 flex items-center text-base font-semibold text-slate-900">
                    <UserIcon className="mr-2 h-5 w-5 text-purple-600" />
                    Vendor Details
                  </h2>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vendor Name</dt>
                      <dd className="mt-1 text-sm font-semibold text-slate-950">{order.vendor_name || 'Not assigned'}</dd>
                    </div>
                    {(order.seller_contact_person || order.seller_reference) && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</dt>
                        <dd className="mt-1 text-sm text-slate-900">{order.seller_contact_person || order.seller_reference}</dd>
                      </div>
                    )}
                    {order.seller_email && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</dt>
                        <dd className="mt-1 break-all text-sm text-slate-900">{order.seller_email}</dd>
                      </div>
                    )}
                  </dl>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="mb-4 flex items-center text-base font-semibold text-slate-900">
                    <CalendarIcon className="mr-2 h-5 w-5 text-indigo-600" />
                    Timeline
                  </h2>
                  <div className="space-y-3">
                    <div className="flex items-start">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100">
                        <CheckCircleIcon className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-slate-900">Order Created</p>
                        <p className="text-xs text-slate-500">{order.created_at ? new Date(order.created_at).toLocaleString() : '-'}</p>
                      </div>
                    </div>
                    {order.updated_at && order.updated_at !== order.created_at && (
                      <div className="flex items-start">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
                          <PencilIcon className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-slate-900">Last Updated</p>
                          <p className="text-xs text-slate-500">{new Date(order.updated_at).toLocaleString()}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* Shipping Information */}
              {order.shipping_address && (
                <div className="bg-white shadow rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <TruckIcon className="h-5 w-5 mr-2 text-blue-600" />
                    Shipping Information
                  </h2>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{order.shipping_address}</p>
                </div>
              )}
            </div>

            {/* Right Column - PDF Preview */}
            <div className="space-y-6 xl:col-span-2">
              <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
                <header className="flex min-h-14 items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
                  <div className="min-w-0">
                    <h2 className="flex items-center text-base font-semibold text-gray-900">
                      <DocumentTextIcon className="mr-2 h-5 w-5 shrink-0 text-indigo-600" />
                      PDF Preview
                    </h2>
                    {pdfPreviewFilename && (
                      <p className="mt-0.5 truncate text-xs text-gray-500" title={pdfPreviewFilename}>{pdfPreviewFilename}</p>
                    )}
                  </div>
                  {pdfPreviewUrl && (
                    <a
                      href={pdfPreviewUrl}
                      download={pdfPreviewFilename}
                      aria-label="Download Purchase Order PDF"
                      title="Download Purchase Order PDF"
                      className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm hover:border-indigo-300 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4" />
                    </a>
                  )}
                </header>

                {pdfPreviewLoading && (
                  <div className="flex h-[800px] items-center justify-center gap-2 bg-slate-50 text-sm text-gray-500">
                    <ArrowPathIcon className="h-5 w-5 animate-spin" /> Generating PDF preview…
                  </div>
                )}

                {!pdfPreviewLoading && pdfPreviewError && (
                  <div className="flex h-[800px] flex-col items-center justify-center bg-slate-50 px-8 text-center">
                    <DocumentTextIcon className="h-12 w-12 text-gray-300" />
                    <p className="mt-4 text-sm font-semibold text-gray-800">PDF preview unavailable</p>
                    <p className="mt-1 text-xs text-gray-500">{pdfPreviewError}</p>
                    <button
                      type="button"
                      onClick={() => setPdfPreviewRetryKey((value) => value + 1)}
                      className="mt-4 inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm hover:border-indigo-300 hover:text-indigo-700"
                    >
                      <ArrowPathIcon className="mr-1.5 h-4 w-4" /> Retry preview
                    </button>
                  </div>
                )}

                {!pdfPreviewLoading && pdfPreviewUrl && (
                  <iframe
                    title={`Purchase Order ${order.po_number || order.id} PDF preview`}
                    src={`${pdfPreviewUrl}#page=1&view=FitH&toolbar=1&navpanes=0`}
                    className="h-[800px] w-full bg-slate-100"
                  />
                )}
              </section>

            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default PurchaseOrderDetail;
