import { radaiAlert, radaiConfirm } from '../../services/radaiDialog'
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
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
  ArrowTopRightOnSquareIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import PdfDocumentPreview from '../../components/Common/PdfDocumentPreview';
import { getStatusConfig } from '../../config/procurement.config';
import { BRANDING_CONFIG } from '../../config/branding.config';
import PurchaseOrderForm from './PurchaseOrderForm';
import UploadedPurchaseOrderPreview from './UploadedPurchaseOrderPreview';
import useUploadedPurchaseOrderSources from './useUploadedPurchaseOrderSources';
import { downloadPurchaseOrderDocument, fetchPurchaseOrderDocument, purchaseOrderDocumentError } from '../../services/purchaseOrderDocuments';
import { purchaseOrderLineNet, purchaseOrderVat } from './purchaseOrderVat';
import { canDecideProcurement, purchaseOrderSignatureEvidence, purchaseOrderLifecycleBlockReason } from '../../utils/procurementApproval';

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
  if (value === null || value === undefined || value === '') return 'Not recorded';
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
const purchaseOrderRevision = order => `${order.id}:${order.updated_at || JSON.stringify(order)}`;

const requestPurchaseOrderPdf = (order) => {
  const key = purchaseOrderRevision(order);
  if (!purchaseOrderPdfRequests.has(key)) {
    const request = fetchPurchaseOrderDocument(order).finally(() => purchaseOrderPdfRequests.delete(key));
    purchaseOrderPdfRequests.set(key, request);
  }
  return purchaseOrderPdfRequests.get(key);
};

/**
 * Purchase Order Detail Page - Soft-Coded Design
 * Displays comprehensive PO information with status tracking
 */
const PurchaseOrderDetail = () => {
  const accessProfile = useSelector(state => state.rbac.currentUser || state.auth.user);
  const accessUser = accessProfile?.user || accessProfile;
  const canUpdate = Boolean(accessUser?.is_superuser
    || accessProfile?.roles?.some(role => ['super_admin', 'admin'].includes(role.code))
    || (accessProfile?.module_actions || accessUser?.module_actions)?.procurement_orders?.includes('update'));
  const { id } = useParams();
  const activeOrderId = useRef(id);
  activeOrderId.current = id;
  const exportAttempt = useRef(0);
  const navigate = useNavigate();
  
  // Soft-coded state management
  const [order, setOrder] = useState(null);
  const currentOrder = useRef(order);
  currentOrder.current = order;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState('');
  const [showEditForm, setShowEditForm] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [pdfDocument, setPdfDocument] = useState(null);
  const [pdfPreviewFilename, setPdfPreviewFilename] = useState('');
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [pdfPreviewError, setPdfPreviewError] = useState('');
  const [pdfPreviewRetryKey, setPdfPreviewRetryKey] = useState(0);
  const [previewSelection, setPreviewSelection] = useState({ id, tab: 'document' });
  const previewTab = previewSelection.id === id ? previewSelection.tab : 'document';
  const uploadedSources = useUploadedPurchaseOrderSources(id, previewTab === 'original');
  const useGeneratedPreview = previewTab === 'document';

  const handlePrintPurchaseOrder = () => {
    try {
      if (!pdfPreviewUrl) return;
      window.open(pdfPreviewUrl, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('The PDF could not be printed. Download it and print from your PDF viewer.');
    }
  };

  const handleExportPurchaseOrder = async (format) => {
    const attempt = ++exportAttempt.current;
    const revision = purchaseOrderRevision(order);
    try {
      setExportLoading(format);
      const result = format === 'pdf'
        ? pdfDocument?.revision === purchaseOrderRevision(order) ? pdfDocument : await requestPurchaseOrderPdf(order)
        : await fetchPurchaseOrderDocument(order, format);
      if (activeOrderId.current !== id || exportAttempt.current !== attempt) return;
      if (!currentOrder.current || purchaseOrderRevision(currentOrder.current) !== revision) {
        toast.info('The purchase order changed while the document was being prepared. Download the updated document.');
        return;
      }
      downloadPurchaseOrderDocument(result);
    } catch (exportError) {
      if (activeOrderId.current !== id || exportAttempt.current !== attempt) return;
      console.error(`Failed to export Purchase Order as ${format}:`, exportError);
      const message = await purchaseOrderDocumentError(exportError);
      if (activeOrderId.current === id && exportAttempt.current === attempt) await radaiAlert(message);
    } finally {
      if (activeOrderId.current === id && exportAttempt.current === attempt) setExportLoading('');
    }
  };

  /**
   * Soft-coded data fetching with error handling
   */
  useEffect(() => {
    const controller = new AbortController();
    exportAttempt.current += 1;
    const fetchOrderDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        setActionLoading(false);
        setExportLoading('');
        
        const response = await apiClient.get(`/procurement/orders/${id}/`, { signal: controller.signal });
        if (controller.signal.aborted || activeOrderId.current !== id) return;
        if (String(response.data?.id) !== String(id)) throw new Error('The returned purchase order does not match this page. Reload the record.');
        setOrder(response.data);
      } catch (error) {
        if (controller.signal.aborted || activeOrderId.current !== id) return;
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
        if (!controller.signal.aborted && activeOrderId.current === id) setLoading(false);
      }
    };

    if (id) {
      fetchOrderDetails();
    }
    return () => {
      controller.abort();
      exportAttempt.current += 1;
    };
  }, [id, navigate]);

  useEffect(() => {
    if (!id || !order || String(order.id) !== String(id)) return undefined;

    let active = true;
    let objectUrl = '';
    setPdfPreviewLoading(true);
    setPdfPreviewError('');
    setPdfPreviewUrl('');
    setPdfDocument(null);

    requestPurchaseOrderPdf(order)
      .then((response) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(response.blob);
        setPdfPreviewFilename(response.filename);
        setPdfPreviewUrl(objectUrl);
        setPdfDocument({ ...response, revision: purchaseOrderRevision(order) });
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
    if (!canUpdate || currentOrder.current?.can_send_to_vendor !== true) return;
    const confirmed = (await radaiConfirm(`Send Purchase Order ${order.po_number} to vendor?`));
    if (!confirmed || activeOrderId.current !== id || currentOrder.current?.can_send_to_vendor !== true) return;

    try {
      setActionLoading(true);
      const response = await apiClient.patch(`/procurement/orders/${id}/`, { status: 'sent' });
      if (activeOrderId.current !== id) return;
      if (String(response.data?.id) !== String(id)) throw new Error('The saved purchase order could not be confirmed. Reload the record.');
      setOrder(response.data);
      toast.success('Purchase Order sent successfully.');
    } catch (error) {
      if (activeOrderId.current !== id) return;
      console.error('Error sending order:', error);
      toast.error(`Failed to send order: ${error.response?.data?.detail || error.response?.data?.status || error.message}`);
    } finally {
      if (activeOrderId.current === id) setActionLoading(false);
    }
  };

  /**
   * Soft-coded action handler: Mark as Completed
   */
  const handleMarkComplete = async () => {
    if (!canUpdate || currentOrder.current?.can_complete !== true) return;
    const confirmed = (await radaiConfirm(`Mark Purchase Order ${order.po_number} as completed?`));
    if (!confirmed || activeOrderId.current !== id || currentOrder.current?.can_complete !== true) return;

    try {
      setActionLoading(true);
      const response = await apiClient.patch(`/procurement/orders/${id}/`, { status: 'completed' });
      if (activeOrderId.current !== id) return;
      if (String(response.data?.id) !== String(id)) throw new Error('The saved purchase order could not be confirmed. Reload the record.');
      setOrder(response.data);
      toast.success('Purchase Order marked as completed.');
    } catch (error) {
      if (activeOrderId.current !== id) return;
      console.error('Error updating order:', error);
      toast.error(`Failed to update order: ${error.response?.data?.detail || error.response?.data?.status || error.message}`);
    } finally {
      if (activeOrderId.current === id) setActionLoading(false);
    }
  };

  const handleApprovalDecision = async (decision) => {
    if (!canDecideProcurement(order, accessProfile, 'po')) return;
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
      if (activeOrderId.current !== id) return;
      if (String(response.data?.purchase_order?.id) !== String(id)) throw new Error('The saved purchase order could not be confirmed. Reload the record.');
      setOrder(response.data.purchase_order);
      setApprovalComment('');
      window.dispatchEvent(new Event('procurement-approval-updated'));
      toast.success(`Purchase Order ${decision === 'approve' ? 'approved' : 'rejected'} successfully.`);
    } catch (decisionError) {
      if (activeOrderId.current !== id) return;
      toast.error(decisionError.response?.data?.detail || decisionError.response?.data?.error || `Failed to ${decision} Purchase Order.`);
    } finally {
      if (activeOrderId.current === id) setActionLoading(false);
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
  if (loading || (!error && order && String(order.id) !== String(id))) {
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

  if (canUpdate && showEditForm && order.status !== 'completed') {
    return <PurchaseOrderForm isOpen pageMode editData={order}
      onClose={() => setShowEditForm(false)}
      onSuccess={updatedOrder => { setOrder(updatedOrder); setShowEditForm(false); }} />;
  }

  const currency = order.currency || 'USD';
  const pricing = purchaseOrderVat(order);
  const fallbackSubtotal = pricing.subtotal ?? 0;
  const printableItems = Array.isArray(order.items) && order.items.length > 0
    ? order.items.map((item, index) => {
        const quantity = Number(item.quantity ?? item.qty ?? 1) || 0;
        const lineNet = purchaseOrderLineNet(item) ?? 0;
        const unitPrice = Number(item.unit_price ?? item.price ?? (quantity ? (lineNet + Number(item.discount || 0)) / quantity : 0)) || 0;
        return {
          id: item.id || index + 1,
          lineCode: item.line_code || item.lineCode || item.item_code || item.code || '',
          description: item.description || item.item || item.name || order.title || 'Purchase order item',
          comment: item.comment || item.comments || item.remarks || item.notes || '',
          quantity,
          unit: item.unit || item.uom || item.unit_of_measure || 'EA',
          unitPrice,
          total: Number(item.total ?? item.line_total ?? purchaseOrderLineNet(item) ?? 0),
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
  const itemSubtotal = pricing.netAmount;
  const discountAmount = pricing.discountAmount ?? 0;
  const taxAmount = pricing.taxAmount;
  const grandTotal = pricing.totalAmount;
  const invoicingEmails = Array.isArray(order.invoicing_emails)
    ? order.invoicing_emails.join(', ')
    : order.invoicing_emails;
  const signatureEvidence = purchaseOrderSignatureEvidence(order);
  const approvalSignatureSource = /^(data:image\/|https?:\/\/|\/)/i.test(signatureEvidence.signature)
    ? signatureEvidence.signature
    : null;
  return (
    <>


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
              <p><span className="font-semibold">Contact:</span> {textOrDash(order.seller_contact_person)}</p>
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
              <tr><th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">Net amount after discounts</th><td className="border border-gray-400 px-2 py-1.5 text-right">{formatMoney(itemSubtotal, currency)}</td></tr>
              {discountAmount > 0 && <tr><th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">Order discount (included)</th><td className="border border-gray-400 px-2 py-1.5 text-right">{formatMoney(discountAmount, currency)}</td></tr>}
              <tr><th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">VAT / Tax{pricing.vatRate == null ? '' : ` (${pricing.vatRate}%)`}</th><td className="border border-gray-400 px-2 py-1.5 text-right">{formatMoney(taxAmount, currency)}</td></tr>
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
            <p>{textOrDash(signatureEvidence.recordedName || order.approved_by_name || order.approved_by_user_name)}</p>
            <p>{textOrDash(order.approved_by_title)}</p>
            {signatureEvidence.mismatch && <p className="font-semibold text-amber-800">Signature needs review. Assigned approver: {textOrDash(signatureEvidence.stage?.approver || signatureEvidence.stage?.user_name)}</p>}
            {!signatureEvidence.mismatch && order.approval_signature && !signatureEvidence.verified && <p className="text-amber-800">Signer not verified</p>}
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
              {useGeneratedPreview && <button
                type="button"
                onClick={handlePrintPurchaseOrder}
                disabled={actionLoading || pdfPreviewLoading || !pdfPreviewUrl}
                  aria-label="Print PDF"
                  title="Print PDF"
                  className="inline-grid h-9 w-9 place-items-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                <PrinterIcon className="h-4 w-4" />
              </button>}

              <button
                type="button"
                onClick={() => handleExportPurchaseOrder('pdf')}
                disabled={actionLoading || Boolean(exportLoading)}
                aria-label={exportLoading === 'pdf' ? 'Preparing PDF document' : 'Download PDF'}
                title="Download PDF"
                className="inline-grid h-9 w-9 place-items-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleExportPurchaseOrder('word')}
                disabled={actionLoading || Boolean(exportLoading)}
                  aria-label={exportLoading === 'word' ? 'Preparing Word document' : 'Export Word document'}
                  title={exportLoading === 'word' ? 'Preparing Word document' : 'Export Word document'}
                  className="inline-grid h-9 w-9 place-items-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                <ArrowDownTrayIcon className={`h-4 w-4 ${exportLoading === 'word' ? 'animate-pulse' : ''}`} />
              </button>
              
              {canUpdate && order.status === 'draft' && (
                <button
                  onClick={handleSendOrder}
                  disabled={actionLoading || order.can_send_to_vendor !== true}
                  aria-describedby={order.can_send_to_vendor !== true ? 'po-lifecycle-block-reason' : undefined}
                    className="inline-flex h-9 items-center rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                  {actionLoading ? 'Sending...' : 'Send to Vendor'}
                </button>
              )}
              
              {canUpdate && (order.status === 'sent' || order.status === 'acknowledged' || order.status === 'in_progress') && (
                <button
                  onClick={handleMarkComplete}
                  disabled={actionLoading || order.can_complete !== true}
                  aria-describedby={order.can_complete !== true ? 'po-lifecycle-block-reason' : undefined}
                    className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  <CheckCircleIcon className="h-4 w-4 mr-2" />
                  {actionLoading ? 'Updating...' : 'Mark Complete'}
                </button>
              )}
              
              {canUpdate && order.status !== 'completed' && (
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

          {canUpdate && ((order.status === 'draft' && order.can_send_to_vendor !== true)
            || (['sent', 'acknowledged', 'in_progress'].includes(order.status) && order.can_complete !== true)) && (
            <p id="po-lifecycle-block-reason" role="status" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              {purchaseOrderLifecycleBlockReason(order)}
            </p>
          )}

          {canDecideProcurement(order, accessProfile, 'po') && (
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
                    <dd className="mt-1 text-sm text-slate-900">{order.project_display || order.project_number || '-'}</dd>
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
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">VAT / Tax{pricing.vatRate == null ? '' : ` (${pricing.vatRate}%)`}</dt>
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
                    {order.seller_contact_person && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</dt>
                        <dd className="mt-1 text-sm text-slate-900">{order.seller_contact_person}</dd>
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
              <section aria-label="Purchase order PDF preview" className="po-detail-pdf-preview relative flex min-h-[360px] h-[calc(100dvh-240px)] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
                <div className="pop-tabs" role="tablist" aria-label="Purchase order PDF source">
                  {['document', 'original'].map(tab => <button key={tab} id={`po-${tab}-tab`} type="button" role="tab" aria-selected={previewTab === tab} aria-controls={previewTab === tab ? `po-${tab}-panel` : undefined} onClick={() => setPreviewSelection({ id, tab })}>{tab === 'document' ? 'Document' : 'Original source'}</button>)}
                </div>
                <div id={`po-${previewTab}-panel`} role="tabpanel" aria-labelledby={`po-${previewTab}-tab`} className="flex min-h-0 flex-1 flex-col">
                {useGeneratedPreview ? <>
                  {pdfPreviewLoading && (
                    <div className="flex h-full items-center justify-center gap-2 bg-slate-50 text-sm text-gray-500">
                      <ArrowPathIcon className="h-5 w-5 animate-spin" /> Generating PDF preview…
                    </div>
                  )}

                  {!pdfPreviewLoading && pdfPreviewError && (
                    <div className="flex h-full flex-col items-center justify-center bg-slate-50 px-8 text-center">
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
                    <PdfDocumentPreview
                      continuous
                      title={`Purchase Order ${order.po_number || order.id} PDF preview`}
                      url={pdfPreviewUrl}
                      className="min-h-0 flex-1"
                      actions={<div className="upo-actions">
                        <a href={pdfPreviewUrl} download={pdfPreviewFilename} aria-label="Download Purchase Order PDF" title="Download Purchase Order PDF"><ArrowDownTrayIcon aria-hidden="true" /></a>
                        <a href={pdfPreviewUrl} target="_blank" rel="noopener noreferrer" aria-label="Open Purchase Order PDF" title="Open Purchase Order PDF"><ArrowTopRightOnSquareIcon aria-hidden="true" /></a>
                      </div>}
                    />
                  )}
                </> : <UploadedPurchaseOrderPreview orderId={id} sourceState={uploadedSources} />}
                </div>
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
