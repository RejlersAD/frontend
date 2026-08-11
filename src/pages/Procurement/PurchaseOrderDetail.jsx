import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import { getStatusConfig } from '../../config/procurement.config';
import { BRANDING_CONFIG } from '../../config/branding.config';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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

  /**
   * Soft-coded action handler: Send Order
   */
  const handleSendOrder = async () => {
    const confirmed = window.confirm(`Send Purchase Order ${order.po_number} to vendor?`);
    if (!confirmed) return;

    try {
      setActionLoading(true);
      await apiClient.patch(`/procurement/orders/${id}/`, { status: 'sent' });
      
      // Update local state
      setOrder(prev => ({ ...prev, status: 'sent' }));
      alert('✅ Purchase Order sent successfully!');
    } catch (error) {
      console.error('Error sending order:', error);
      alert(`❌ Failed to send order: ${error.response?.data?.detail || error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Soft-coded action handler: Mark as Completed
   */
  const handleMarkComplete = async () => {
    const confirmed = window.confirm(`Mark Purchase Order ${order.po_number} as completed?`);
    if (!confirmed) return;

    try {
      setActionLoading(true);
      await apiClient.patch(`/procurement/orders/${id}/`, { status: 'completed' });
      
      setOrder(prev => ({ ...prev, status: 'completed' }));
      alert('✅ Purchase Order marked as completed!');
    } catch (error) {
      console.error('Error updating order:', error);
      alert(`❌ Failed to update order: ${error.response?.data?.detail || error.message}`);
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
      <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold border-2 ${colorClasses[config.color]}`}>
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

  return (
    <>
      {createPortal(
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
            <p>Date: {formatDate(order.approved_date)}</p>
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

    <div className="po-screen-view min-h-screen bg-gray-50">
      <div className="py-6">
        {/* Header - Soft-coded */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/procurement/orders')}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Back
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                  <ShoppingCartIcon className="h-8 w-8 mr-3 text-indigo-600" />
                  {order.po_number || `PO-${order.id}`}
                </h1>
                {typeof order.po_number_verified === 'boolean' && (
                  <span
                    className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      order.po_number_verified
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                    title={order.po_number_verification_message}
                  >
                    {order.po_number_verified ? 'PO number verified' : 'PO number requires correction'}
                  </span>
                )}
                <p className="mt-1 text-sm text-gray-600">
                  Purchase Order Details
                </p>
              </div>
            </div>
            
            {/* Action Buttons - Soft-coded based on status */}
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <PrinterIcon className="h-4 w-4 mr-2" />
                Print / Save PDF
              </button>
              
              {order.status === 'draft' && (
                <button
                  onClick={handleSendOrder}
                  disabled={actionLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
                >
                  <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                  {actionLoading ? 'Sending...' : 'Send to Vendor'}
                </button>
              )}
              
              {(order.status === 'sent' || order.status === 'acknowledged' || order.status === 'in_progress') && (
                <button
                  onClick={handleMarkComplete}
                  disabled={actionLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50"
                >
                  <CheckCircleIcon className="h-4 w-4 mr-2" />
                  {actionLoading ? 'Updating...' : 'Mark Complete'}
                </button>
              )}
              
              <button
                onClick={() => navigate(`/procurement/orders/${order.id}/edit`)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <PencilIcon className="h-4 w-4 mr-2" />
                Edit
              </button>
            </div>
          </div>

          {/* Status Badge */}
          <div className="mb-6">
            {getStatusBadge(order.status)}
          </div>

          {/* Main Content Grid - Soft-coded layout */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left Column - Order Information */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Information Card */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <DocumentTextIcon className="h-5 w-5 mr-2 text-indigo-600" />
                  Order Information
                </h2>
                
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">PO Number</dt>
                    <dd className="mt-1 text-sm text-gray-900 font-semibold">{order.po_number || '-'}</dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Order Date</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {order.po_date ? new Date(order.po_date).toLocaleDateString() : '-'}
                    </dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Expected Delivery</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {order.expected_delivery ? new Date(order.expected_delivery).toLocaleDateString() : '-'}
                    </dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Project</dt>
                    <dd className="mt-1 text-sm text-gray-900">{order.project_number || '-'}</dd>
                  </div>
                  
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Title/Description</dt>
                    <dd className="mt-1 text-sm text-gray-900">{order.title || order.description || '-'}</dd>
                  </div>
                  
                  {order.notes && (
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-gray-500">Notes</dt>
                      <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{order.notes}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Financial Information Card */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <CurrencyDollarIcon className="h-5 w-5 mr-2 text-green-600" />
                  Financial Details
                </h2>
                
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2 bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border-2 border-green-200">
                    <dt className="text-sm font-medium text-gray-600">Total Amount</dt>
                    <dd className="mt-1 text-3xl font-bold text-green-700">
                      {order.currency || 'USD'} {parseFloat(order.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Currency</dt>
                    <dd className="mt-1 text-sm text-gray-900 font-semibold">{order.currency || 'USD'}</dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Payment Terms</dt>
                    <dd className="mt-1 text-sm text-gray-900">{order.payment_terms || 'Not specified'}</dd>
                  </div>
                </dl>
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

            {/* Right Column - Vendor & Additional Info */}
            <div className="space-y-6">
              {/* Vendor Information Card */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <UserIcon className="h-5 w-5 mr-2 text-purple-600" />
                  Vendor Details
                </h2>
                
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Vendor Name</dt>
                    <dd className="mt-1 text-sm text-gray-900 font-semibold">{order.vendor_name || 'Not assigned'}</dd>
                  </div>
                </dl>
              </div>

              {/* Timeline Card - Soft-coded status history */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <CalendarIcon className="h-5 w-5 mr-2 text-indigo-600" />
                  Timeline
                </h2>
                
                <div className="space-y-3">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                        <CheckCircleIcon className="h-5 w-5 text-indigo-600" />
                      </div>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">Order Created</p>
                      <p className="text-xs text-gray-500">
                        {order.created_at ? new Date(order.created_at).toLocaleString() : '-'}
                      </p>
                    </div>
                  </div>
                  
                  {order.updated_at && order.updated_at !== order.created_at && (
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                          <PencilIcon className="h-5 w-5 text-yellow-600" />
                        </div>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">Last Updated</p>
                        <p className="text-xs text-gray-500">
                          {new Date(order.updated_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default PurchaseOrderDetail;
