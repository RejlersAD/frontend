import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import {
  ArchiveBoxIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  SparklesIcon,
  BeakerIcon,
  ShieldCheckIcon,
  DocumentCheckIcon,
  CalendarIcon,
  UserGroupIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  PrinterIcon
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import { PageControlButtons } from '../../components/Common/PageControlButtons';
import { usePageControls } from '../../hooks/usePageControls';
import { getStatusConfig } from '../../config/procurement.config';
import { BRANDING_CONFIG } from '../../config/branding.config';
import AIReceiptCreator from './AIReceiptCreator';

class ReceiptCreatorErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Goods Receipt creator failed to render:', error, info);
  }

  componentDidUpdate(previousProps) {
    if (!previousProps.isOpen && this.props.isOpen && this.state.error) {
      this.setState({ error: null });
    }
  }

  handleClose = () => {
    this.setState({ error: null });
    this.props.onClose();
  };

  render() {
    if (!this.props.isOpen) return this.props.children;
    if (!this.state.error) return this.props.children;
    return createPortal(
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-900/70 p-4">
        <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
          <h2 className="text-lg font-semibold text-red-700">Unable to open Goods Receipt form</h2>
          <p className="mt-2 text-sm text-gray-600">The form encountered invalid receipt or purchase-order data. Close it and refresh the receipt list.</p>
          <pre className="mt-4 max-h-32 overflow-auto rounded bg-gray-100 p-3 text-xs text-gray-700">{this.state.error.message}</pre>
          <button type="button" onClick={this.handleClose} className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Close</button>
        </div>
      </div>,
      document.body
    );
  }
}

ReceiptCreatorErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

const receiptText = (value) => (
  value === null || value === undefined || value === '' ? '—' : String(value)
);

const receiptDate = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString('en-GB');
};

const listText = (value) => {
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  return receiptText(value);
};

const inspectionResult = (value) => value === true ? 'PASS' : value === false ? 'FAIL' : 'PENDING';

const ReceiptPrintContent = ({ receipt, printDate }) => {
  const items = Array.isArray(receipt?.items_received) ? receipt.items_received : [];
  const status = (receipt?.status_display || receipt?.status || '—').toUpperCase();

  return (
    <div className="gr-paper bg-white text-gray-950">
      <header className="flex items-start justify-between gap-6 border-b-2 border-gray-900 pb-3">
        <div>
          <img src={BRANDING_CONFIG.logo.primary.path} alt={BRANDING_CONFIG.logo.primary.alt} className="h-10 w-auto object-contain" />
          <p className="mt-2 max-w-[360px] text-[8px] leading-3 text-gray-600">
            {BRANDING_CONFIG.brand.companyFull}<br />
            {BRANDING_CONFIG.contact.address.full}<br />
            Tel: {BRANDING_CONFIG.contact.phone.display}
          </p>
        </div>
        <div className="text-right">
          <h1 className="text-[21px] font-bold tracking-[0.12em]">GOODS RECEIPT NOTE</h1>
          <p className="mt-1 text-[9px] font-semibold text-gray-600">Receiving & Quality Inspection Record</p>
          <p className="mt-2 text-[11px] font-bold">{receiptText(receipt?.receipt_number)}</p>
        </div>
      </header>

      <table className="mt-3 w-full border-collapse text-[8.5px]">
        <tbody>
          <tr>
            <th className="w-[17%] border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">GRN Number</th>
            <td className="w-[33%] border border-gray-400 px-2 py-1.5 font-bold">{receiptText(receipt?.receipt_number)}</td>
            <th className="w-[17%] border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">Receipt Date</th>
            <td className="w-[33%] border border-gray-400 px-2 py-1.5">{receiptDate(receipt?.receipt_date)}</td>
          </tr>
          <tr>
            <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">PO Number</th>
            <td className="border border-gray-400 px-2 py-1.5">{receiptText(receipt?.po_number)}</td>
            <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">Delivery Note</th>
            <td className="border border-gray-400 px-2 py-1.5">{receiptText(receipt?.delivery_note_number)}</td>
          </tr>
          <tr>
            <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">Received By</th>
            <td className="border border-gray-400 px-2 py-1.5">{receiptText(receipt?.received_by_name)}</td>
            <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">Receipt Status</th>
            <td className="border border-gray-400 px-2 py-1.5 font-bold">{status}</td>
          </tr>
          <tr>
            <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">Inspector</th>
            <td className="border border-gray-400 px-2 py-1.5">{receiptText(receipt?.inspector_name)}</td>
            <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">Inspection Agency</th>
            <td className="border border-gray-400 px-2 py-1.5">{receiptText(receipt?.inspection_agency)}</td>
          </tr>
          <tr>
            <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">Module</th>
            <td className="border border-gray-400 px-2 py-1.5">Procurement · Goods Receipt</td>
            <th className="border border-gray-400 bg-gray-100 px-2 py-1.5 text-left">Print Date</th>
            <td className="border border-gray-400 px-2 py-1.5">{receiptDate(printDate)}</td>
          </tr>
        </tbody>
      </table>

      <section className="gr-print-block mt-3">
        <h2 className="bg-gray-900 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wide text-white">Items Received</h2>
        <table className="w-full border-collapse text-[8px]">
          <thead>
            <tr className="bg-gray-100">
              <th className="w-[6%] border border-gray-400 px-1 py-1.5 text-center">No.</th>
              <th className="w-[43%] border border-gray-400 px-2 py-1.5 text-left">Description</th>
              <th className="w-[10%] border border-gray-400 px-1 py-1.5 text-center">UOM</th>
              <th className="w-[11%] border border-gray-400 px-1 py-1.5 text-right">Ordered</th>
              <th className="w-[11%] border border-gray-400 px-1 py-1.5 text-right">Received</th>
              <th className="w-[11%] border border-gray-400 px-1 py-1.5 text-right">Accepted</th>
              <th className="w-[8%] border border-gray-400 px-1 py-1.5 text-right">Rejected</th>
            </tr>
          </thead>
          <tbody>
            {items.length ? items.map((item, index) => (
              <tr key={item.po_line_id || index}>
                <td className="border border-gray-400 px-1 py-2 text-center align-top">{item.line_number || index + 1}</td>
                <td className="border border-gray-400 px-2 py-2 align-top">{receiptText(item.item || item.description)}</td>
                <td className="border border-gray-400 px-1 py-2 text-center align-top">{receiptText(item.uom || item.unit)}</td>
                <td className="border border-gray-400 px-1 py-2 text-right align-top">{receiptText(item.ordered_qty)}</td>
                <td className="border border-gray-400 px-1 py-2 text-right align-top">{receiptText(item.received_qty ?? item.quantity)}</td>
                <td className="border border-gray-400 px-1 py-2 text-right align-top">{receiptText(item.accepted_qty)}</td>
                <td className="border border-gray-400 px-1 py-2 text-right align-top">{receiptText(item.rejected_qty)}</td>
              </tr>
            )) : (
              <tr><td colSpan="7" className="border border-gray-400 px-2 py-5 text-center text-gray-500">No item breakdown recorded.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="gr-print-block mt-3">
        <h2 className="bg-gray-900 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wide text-white">Quality Inspection Results</h2>
        <table className="w-full border-collapse text-[8.5px]">
          <thead><tr className="bg-gray-100"><th className="border border-gray-400 px-2 py-1.5 text-left">Inspection</th><th className="border border-gray-400 px-2 py-1.5 text-center">Result</th><th className="border border-gray-400 px-2 py-1.5 text-left">Reference / Remarks</th></tr></thead>
          <tbody>
            <tr><td className="border border-gray-400 px-2 py-1.5">Visual inspection</td><td className="border border-gray-400 px-2 py-1.5 text-center font-bold">{inspectionResult(receipt?.visual_inspection_passed)}</td><td className="border border-gray-400 px-2 py-1.5">{receiptText(receipt?.inspection_report_number)}</td></tr>
            <tr><td className="border border-gray-400 px-2 py-1.5">Dimensional inspection</td><td className="border border-gray-400 px-2 py-1.5 text-center font-bold">{inspectionResult(receipt?.dimensional_check_passed)}</td><td className="border border-gray-400 px-2 py-1.5">—</td></tr>
            <tr><td className="border border-gray-400 px-2 py-1.5">Material verification / PMI</td><td className="border border-gray-400 px-2 py-1.5 text-center font-bold">{inspectionResult(receipt?.material_verification_passed)}</td><td className="border border-gray-400 px-2 py-1.5">Heat No(s): {listText(receipt?.heat_numbers)}</td></tr>
            <tr><td className="border border-gray-400 px-2 py-1.5">Non-destructive testing (NDT)</td><td className="border border-gray-400 px-2 py-1.5 text-center font-bold">{receipt?.ndt_performed ? 'PERFORMED' : 'NOT PERFORMED'}</td><td className="border border-gray-400 px-2 py-1.5">{receiptText(receipt?.ndt_results)}</td></tr>
            <tr><td className="border border-gray-400 px-2 py-1.5">Overall quality disposition</td><td className="border border-gray-400 px-2 py-1.5 text-center font-bold">{inspectionResult(receipt?.quality_check_passed)}</td><td className="border border-gray-400 px-2 py-1.5">{receiptText(receipt?.inspection_notes)}</td></tr>
          </tbody>
        </table>
      </section>

      <section className="gr-print-block mt-3 grid grid-cols-2 gap-3 text-[8.5px]">
        <div className="border border-gray-400">
          <h2 className="bg-gray-100 px-2 py-1.5 font-bold uppercase">Documents & Traceability</h2>
          <div className="space-y-1 border-t border-gray-400 px-3 py-2">
            <p><span className="font-semibold">Certificates:</span> {listText(receipt?.certificates_received)}</p>
            <p><span className="font-semibold">Heat numbers:</span> {listText(receipt?.heat_numbers)}</p>
            <p><span className="font-semibold">Attachments:</span> {Array.isArray(receipt?.attachments) ? receipt.attachments.length : 0}</p>
          </div>
        </div>
        <div className="border border-gray-400">
          <h2 className="bg-gray-100 px-2 py-1.5 font-bold uppercase">Remarks</h2>
          <p className="min-h-[56px] whitespace-pre-wrap border-t border-gray-400 px-3 py-2">{receiptText(receipt?.notes || receipt?.inspection_notes)}</p>
        </div>
      </section>

      <section className="gr-print-block mt-7 grid grid-cols-3 gap-6 text-[8.5px]">
        <div className="border-t border-gray-600 pt-2"><p className="font-bold">Received By</p><p>{receiptText(receipt?.received_by_name)}</p><p className="mt-3">Date: {receiptDate(receipt?.receipt_date)}</p></div>
        <div className="border-t border-gray-600 pt-2"><p className="font-bold">Inspected By</p><p>{receiptText(receipt?.inspector_name)}</p><p>{receiptText(receipt?.inspection_agency)}</p><p className="mt-3">Signature / Date:</p></div>
        <div className="border-t border-gray-600 pt-2"><p className="font-bold">Approved By</p><p>Procurement / Project Representative</p><p className="mt-3">Signature / Date:</p></div>
      </section>

      <footer className="gr-print-footer mt-6 flex justify-between border-t border-gray-400 pt-1 text-[7px] text-gray-500">
        <span>Controlled document · Procurement / Goods Receipt · Printed {receiptDate(printDate)}</span>
        <span>GRN: {receiptText(receipt?.receipt_number)} · Page <span className="gr-page-number" /></span>
      </footer>
    </div>
  );
};

ReceiptPrintContent.propTypes = {
  receipt: PropTypes.object.isRequired,
  printDate: PropTypes.string.isRequired,
};

const ReceiptManagement = () => {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterQuality, setFilterQuality] = useState('all');
  const [showAICreator, setShowAICreator] = useState(false);
  const [orders, setOrders] = useState([]);
  const [aiInsights, setAiInsights] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printDate, setPrintDate] = useState(() => new Date().toISOString());

  const pageControls = usePageControls({
    autoRefreshInterval: 60,
    features: { autoRefresh: true, fullscreen: true, sidebar: true }
  });

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get('/procurement/receipts/');
      const data = response.data;
      
      // Soft-coded data normalization - ensure array
      let normalizedData = [];
      if (Array.isArray(data)) {
        normalizedData = data;
      } else if (data && Array.isArray(data.results)) {
        normalizedData = data.results;
      } else if (data && typeof data === 'object') {
        normalizedData = [data];
      }
      
      setReceipts(normalizedData);
      
      // AI-powered receipt analytics
      generateAIInsights(normalizedData);
    } catch (error) {
      console.error('Error fetching receipts:', error);
      setError({ 
        type: 'network', 
        message: `Failed to load goods receipts: ${error.message}`,
        action: () => fetchReceipts()
      });
      setReceipts([]); // Ensure array even on error
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await apiClient.get('/procurement/orders/');
      const data = response.data;
      // Filter only sent/acknowledged orders (ready for receipt)
      const readyOrders = (Array.isArray(data.results) ? data.results : [])
        .filter(o => o.status === 'sent' || o.status === 'acknowledged');
      setOrders(readyOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  useEffect(() => {
    fetchReceipts();
    fetchOrders();
  }, [pageControls.isRefreshing]);

  /**
   * AI Feature: Generate receipt insights and quality alerts
   */
  const generateAIInsights = (receiptList) => {
    if (!Array.isArray(receiptList) || receiptList.length === 0) return;

    // Soft-coded AI analytics
    const insights = [];
    
    // Quality inspection alerts
    const pendingInspection = receiptList.filter(r => 
      r.status === 'pending' || !r.quality_check_passed
    );
    
    if (pendingInspection.length > 0) {
      insights.push({
        type: 'quality_pending',
        title: '🔍 Quality Inspections Pending',
        count: pendingInspection.length,
        message: `${pendingInspection.length} receipt${pendingInspection.length > 1 ? 's' : ''} awaiting quality inspection`,
        priority: 'high'
      });
    }

    // Failed quality checks
    const qualityFailed = receiptList.filter(r => 
      r.dimensional_check_passed === false || 
      r.visual_inspection_passed === false || 
      r.material_verification_passed === false
    );
    
    if (qualityFailed.length > 0) {
      insights.push({
        type: 'quality_failed',
        title: '❌ Quality Issues Detected',
        count: qualityFailed.length,
        message: `${qualityFailed.length} receipt${qualityFailed.length > 1 ? 's' : ''} failed quality checks - immediate action required`,
        priority: 'urgent'
      });
    }

    // NDT requirements
    const ndtPending = receiptList.filter(r => 
      r.ndt_required && (!r.ndt_performed || !r.ndt_results)
    );
    
    if (ndtPending.length > 0) {
      insights.push({
        type: 'ndt_pending',
        title: '🧪 NDT Testing Required',
        count: ndtPending.length,
        message: `${ndtPending.length} item${ndtPending.length > 1 ? 's' : ''} pending Non-Destructive Testing`,
        priority: 'high'
      });
    }

    // Certification compliance
    const certMissing = receiptList.filter(r => 
      !r.certificates_received || (r.certificates_received && r.certificates_received.length === 0)
    );
    
    if (certMissing.length > 0) {
      insights.push({
        type: 'cert_missing',
        title: '📋 Certifications Missing',
        count: certMissing.length,
        message: `${certMissing.length} receipt${certMissing.length > 1 ? 's' : ''} missing required material certificates`,
        priority: 'high'
      });
    }

    // Material traceability
    const traceabilityIssues = receiptList.filter(r => 
      !r.heat_numbers || (Array.isArray(r.heat_numbers) && r.heat_numbers.length === 0)
    );
    
    if (traceabilityIssues.length > 0) {
      insights.push({
        type: 'traceability',
        title: '🔢 Material Traceability Gaps',
        count: traceabilityIssues.length,
        message: `${traceabilityIssues.length} item${traceabilityIssues.length > 1 ? 's' : ''} missing heat numbers for traceability`,
        priority: 'medium'
      });
    }

    // Acceptance rate
    const accepted = receiptList.filter(r => r.status === 'accepted').length;
    const acceptanceRate = receiptList.length > 0 ? ((accepted / receiptList.length) * 100).toFixed(1) : 0;
    
    insights.push({
      type: 'acceptance_rate',
      title: '✅ Acceptance Rate',
      percentage: acceptanceRate,
      message: `${acceptanceRate}% of receipts accepted (${accepted} out of ${receiptList.length})`,
      priority: acceptanceRate < 80 ? 'medium' : 'info'
    });

    setAiInsights(insights);
  };

  // Soft-coded filter logic with safe array handling
  const filteredReceipts = Array.isArray(receipts) ? receipts.filter(receipt => {
    // Soft-coded field access with fallbacks
    const grNumber = receipt?.receipt_number || receipt?.gr_number || '';
    const poNumber = receipt?.po_number || '';
    const status = receipt?.status || '';
    const qualityPassed = receipt?.quality_check_passed;
    
    const matchesSearch = grNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         poNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || status === filterStatus;
    const matchesQuality = filterQuality === 'all' || 
                          (filterQuality === 'passed' && qualityPassed === true) ||
                          (filterQuality === 'failed' && qualityPassed === false) ||
                          (filterQuality === 'pending' && qualityPassed === null);
    return matchesSearch && matchesStatus && matchesQuality;
  }) : [];

  const handleReceiptCreated = async (receiptData) => {
    console.log('Creating receipt with AI data:', receiptData);
    // After successful creation, refresh receipt list
    await fetchReceipts();
  };

  const openReceiptDetails = async (receipt) => {
    setShowPrintPreview(false);
    setSelectedReceipt(receipt);
    setDetailLoading(true);
    try {
      const response = await apiClient.get(`/procurement/receipts/${receipt.id}/`);
      setSelectedReceipt(response.data);
    } catch (detailError) {
      console.error('Error fetching receipt details:', detailError);
      setError({ type: 'network', message: 'Failed to load the receipt details.' });
    } finally {
      setDetailLoading(false);
    }
  };

  const acceptReceipt = async (receipt) => {
    setAcceptingId(receipt.id);
    try {
      const response = await apiClient.post(`/procurement/receipts/${receipt.id}/accept/`);
      setReceipts(current => current.map(item => (
        item.id === receipt.id ? { ...item, ...response.data } : item
      )));
      setSelectedReceipt(current => current?.id === receipt.id ? response.data : current);
    } catch (acceptError) {
      console.error('Error accepting receipt:', acceptError);
      setError({
        type: 'network',
        message: acceptError.response?.data?.error || 'Failed to accept the goods receipt.'
      });
    } finally {
      setAcceptingId(null);
    }
  };

  const openPrintPreview = () => {
    setPrintDate(new Date().toISOString());
    setShowPrintPreview(true);
  };

  const printReceipt = () => {
    const originalTitle = document.title;
    const poNumber = String(selectedReceipt?.po_number || 'PO-Not-Recorded')
      .replace(/[^a-zA-Z0-9_-]+/g, '-');
    const printedOn = new Date(printDate);
    const datePart = Number.isNaN(printedOn.getTime())
      ? new Date().toISOString().slice(0, 10)
      : printedOn.toISOString().slice(0, 10);
    document.title = `${poNumber}_Procurement-Goods-Receipt_${datePart}`;

    const restoreTitle = () => {
      document.title = originalTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);
    window.print();
    // Fallback for browsers that do not emit afterprint.
    window.setTimeout(restoreTitle, 60000);
  };

  const getStatusBadge = (status) => {
    const config = getStatusConfig('receipt', status);
    const colorClasses = {
      green: 'bg-green-100 text-green-800 border-green-200',
      red: 'bg-red-100 text-red-800 border-red-200',
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      blue: 'bg-blue-100 text-blue-800 border-blue-200',
      gray: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClasses[config.color]}`}>
        {config.label}
      </span>
    );
  };

  const getQualityBadge = (receipt) => {
    if (receipt?.quality_check_passed === true) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-300">
          <CheckCircleIcon className="h-3 w-3 mr-1" />
          Quality Passed
        </span>
      );
    } else if (receipt?.quality_check_passed === false) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 border border-red-300">
          <XCircleIcon className="h-3 w-3 mr-1" />
          Quality Failed
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
          <ClockIcon className="h-3 w-3 mr-1" />
          Inspection Pending
        </span>
      );
    }
  };

  const ReceiptStats = () => {
    // Soft-coded stats calculation with safe array handling
    const safeReceipts = Array.isArray(receipts) ? receipts : [];
    const stats = {
      total: safeReceipts.length,
      pending: safeReceipts.filter(r => r?.status === 'pending').length,
      accepted: safeReceipts.filter(r => r?.status === 'accepted').length,
      rejected: safeReceipts.filter(r => r?.status === 'rejected').length,
      qualityPassed: safeReceipts.filter(r => r?.quality_check_passed === true).length,
      qualityFailed: safeReceipts.filter(r => r?.quality_check_passed === false).length,
      ndtPending: safeReceipts.filter(r => r?.ndt_required && !r?.ndt_performed).length
    };

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 mb-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-indigo-500 rounded-md p-3">
                <ArchiveBoxIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total GRs</dt>
                  <dd className="text-2xl font-semibold text-gray-900">{stats.total}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                <ClockIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Pending</dt>
                  <dd className="text-2xl font-semibold text-gray-900">{stats.pending}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                <CheckCircleIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Accepted</dt>
                  <dd className="text-2xl font-semibold text-gray-900">{stats.accepted}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-red-500 rounded-md p-3">
                <XCircleIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Rejected</dt>
                  <dd className="text-2xl font-semibold text-gray-900">{stats.rejected}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-[#00a896] rounded-md p-3">
                <ShieldCheckIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">QC Passed</dt>
                  <dd className="text-2xl font-semibold text-gray-900">{stats.qualityPassed}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-orange-500 rounded-md p-3">
                <ExclamationTriangleIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">QC Failed</dt>
                  <dd className="text-2xl font-semibold text-gray-900">{stats.qualityFailed}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                <BeakerIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">NDT Pending</dt>
                  <dd className="text-2xl font-semibold text-gray-900">{stats.ndtPending}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50" style={pageControls.styles.container}>
      {selectedReceipt && createPortal(
        <>
          <style>{`
            .gr-print-document { display: none; }
            @page { size: A4 portrait; margin: 10mm 10mm 12mm; }
            @media print {
              html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
              body { margin: 0 !important; padding: 0 !important; font-family: Arial, Helvetica, sans-serif; }
              body > * { display: none !important; }
              body > .gr-print-document {
                display: block !important;
                position: static !important;
                width: 100% !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
              }
              .gr-print-document, .gr-print-document * {
                visibility: visible !important;
                box-sizing: border-box;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .gr-print-document table { width: 100%; border-collapse: collapse; }
              .gr-print-document thead { display: table-header-group; }
              .gr-print-document tr, .gr-print-block { break-inside: avoid; page-break-inside: avoid; }
              .gr-print-footer { break-inside: avoid; page-break-inside: avoid; }
              .gr-page-number::after { content: counter(page); }
            }
          `}</style>
          <section className="gr-print-document" aria-label="Printable goods receipt note">
            <ReceiptPrintContent receipt={selectedReceipt} printDate={printDate} />
          </section>
        </>,
        document.body
      )}
      <div className="py-6" style={pageControls.styles.content}>
        {/* Header */}
        <div className="w-full px-3 sm:px-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <ArchiveBoxIcon className="h-8 w-8 mr-3 text-indigo-600" />
                Goods Receipts
              </h1>
              <p className="mt-2 text-sm text-gray-600 flex items-center">
                <SparklesIcon className="h-4 w-4 mr-1 text-purple-500" />
                AI-powered receipt management with quality inspection and material traceability
              </p>
            </div>
            
            <PageControlButtons 
              isFullscreen={pageControls.isFullscreen}
              toggleFullscreen={pageControls.toggleFullscreen}
              sidebarVisible={pageControls.sidebarVisible}
              toggleSidebar={pageControls.toggleSidebar}
              autoRefreshEnabled={pageControls.autoRefreshEnabled}
              toggleAutoRefresh={pageControls.toggleAutoRefresh}
              isRefreshing={pageControls.isRefreshing}
              manualRefresh={pageControls.manualRefresh}
            />
          </div>
        </div>

        {/* Statistics */}
        <div className="w-full px-3 sm:px-4 mt-8">
          <ReceiptStats />
        </div>

        {/* AI Insights */}
        {aiInsights && aiInsights.length > 0 && (
          <div className="w-full px-3 sm:px-4 mt-6">
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-6 border-2 border-purple-200">
              <div className="flex items-center space-x-2 mb-4">
                <SparklesIcon className="h-6 w-6 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-900">AI Quality Insights & Alerts</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {aiInsights.map((insight, idx) => (
                  <div key={idx} className={`bg-white rounded-lg p-4 border-2 hover:shadow-md transition-shadow ${
                    insight.priority === 'urgent' ? 'border-red-300' : 
                    insight.priority === 'high' ? 'border-yellow-300' : 
                    insight.priority === 'medium' ? 'border-orange-300' :
                    'border-purple-200'
                  }`}>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">{insight.title}</h4>
                    <p className="text-sm text-gray-600">{insight.message}</p>
                    {insight.percentage && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Target: 90%</span>
                          <span className="font-semibold text-indigo-600">{insight.percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${parseFloat(insight.percentage) >= 90 ? 'bg-green-500' : parseFloat(insight.percentage) >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(parseFloat(insight.percentage), 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="w-full px-3 sm:px-4 mt-6">
            <div className={`rounded-md p-4 ${error.type === 'auth' ? 'bg-yellow-50 border-l-4 border-yellow-400' : 'bg-red-50 border-l-4 border-red-400'}`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {error.type === 'auth' ? (
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                  ) : (
                    <XCircleIcon className="h-5 w-5 text-red-400" />
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <p className={`text-sm font-medium ${error.type === 'auth' ? 'text-yellow-800' : 'text-red-800'}`}>
                    {error.message}
                  </p>
                </div>
                <div className="ml-auto pl-3">
                  <div className="-mx-1.5 -my-1.5 flex">
                    {error.action && (
                      <button
                        type="button"
                        onClick={error.action}
                        className={`inline-flex rounded-md p-1.5 ${error.type === 'auth' ? 'text-yellow-800 hover:bg-yellow-100' : 'text-red-800 hover:bg-red-100'} focus:outline-none`}
                      >
                        <ArrowPathIcon className="h-5 w-5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setError(null)}
                      className={`inline-flex rounded-md p-1.5 ml-2 ${error.type === 'auth' ? 'text-yellow-800 hover:bg-yellow-100' : 'text-red-800 hover:bg-red-100'} focus:outline-none`}
                    >
                      <XCircleIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters and Search */}
        <div className="w-full px-3 sm:px-4 mt-8">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {/* Search */}
              <div className="md:col-span-2">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                  Search Goods Receipts
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Search by GR or PO number..."
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  id="status"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                  <option value="partial">Partial</option>
                </select>
              </div>

              {/* Quality Filter */}
              <div>
                <label htmlFor="quality" className="block text-sm font-medium text-gray-700 mb-2">
                  Quality Check
                </label>
                <select
                  id="quality"
                  value={filterQuality}
                  onChange={(e) => setFilterQuality(e.target.value)}
                  className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="all">All Quality</option>
                  <option value="passed">✓ Passed</option>
                  <option value="failed">✗ Failed</option>
                  <option value="pending">⏱ Pending</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-between items-center">
              <p className="text-sm text-gray-500">
                Showing {filteredReceipts.length} of {Array.isArray(receipts) ? receipts.length : 0} goods receipts
              </p>
              <button
                type="button"
                onClick={() => setShowAICreator(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <SparklesIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                Record with AI Quality Check
              </button>
            </div>
          </div>
        </div>

        {/* Receipts List */}
        <div className="w-full px-3 sm:px-4 mt-8">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              <p className="mt-4 text-sm text-gray-500">Loading goods receipts...</p>
            </div>
          ) : filteredReceipts.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <ArchiveBoxIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No goods receipts found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || filterStatus !== 'all' || filterQuality !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Get started by recording a new goods receipt.'}
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setShowAICreator(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <SparklesIcon className="-ml-1 mr-2 h-5 w-5" />
                  Record with AI Quality Check
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredReceipts.map((receipt) => (
                <div key={receipt.id} className="bg-white overflow-hidden shadow-lg rounded-lg hover:shadow-xl transition-shadow duration-200 border-2 border-transparent hover:border-indigo-500">
                  <div className="p-6">
                    {/* Receipt Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <ArchiveBoxIcon className="h-5 w-5 text-indigo-600" />
                          <h3 className="text-lg font-semibold text-gray-900">
                            {receipt.receipt_number || receipt.gr_number || `GR-${receipt.id}`}
                          </h3>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                          PO: {receipt.po_number || 'N/A'}
                        </p>
                      </div>
                      {getStatusBadge(receipt.status)}
                    </div>

                    {/* Quality Badge */}
                    <div className="mb-4">
                      {getQualityBadge(receipt)}
                    </div>

                    {/* Receipt Details */}
                    <div className="space-y-3">
                      {(receipt.receipt_date || receipt.received_date) && (
                        <div className="flex items-center text-sm text-gray-600">
                          <CalendarIcon className="h-4 w-4 mr-2 text-gray-400" />
                          <span>Received: {new Date(receipt.receipt_date || receipt.received_date).toLocaleDateString()}</span>
                        </div>
                      )}
                      {receipt.inspector_name && (
                        <div className="flex items-center text-sm text-gray-600">
                          <UserGroupIcon className="h-4 w-4 mr-2 text-gray-400" />
                          <span>Inspector: {receipt.inspector_name}</span>
                        </div>
                      )}
                      {receipt.certificates_received && receipt.certificates_received.length > 0 && (
                        <div className="flex items-start text-sm text-gray-600">
                          <DocumentCheckIcon className="h-4 w-4 mr-2 text-gray-400 mt-0.5" />
                          <span className="text-xs">
                            {receipt.certificates_received.length} Certificate{receipt.certificates_received.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Quality Indicators */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className={`text-center p-2 rounded ${receipt.dimensional_check_passed ? 'bg-green-50 text-green-700' : receipt.dimensional_check_passed === false ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'}`}>
                          <div className="font-medium">Dimensional</div>
                          <div>{receipt.dimensional_check_passed === true ? '✓' : receipt.dimensional_check_passed === false ? '✗' : '—'}</div>
                        </div>
                        <div className={`text-center p-2 rounded ${receipt.visual_inspection_passed ? 'bg-green-50 text-green-700' : receipt.visual_inspection_passed === false ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'}`}>
                          <div className="font-medium">Visual</div>
                          <div>{receipt.visual_inspection_passed === true ? '✓' : receipt.visual_inspection_passed === false ? '✗' : '—'}</div>
                        </div>
                        <div className={`text-center p-2 rounded ${receipt.material_verification_passed ? 'bg-green-50 text-green-700' : receipt.material_verification_passed === false ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'}`}>
                          <div className="font-medium">Material</div>
                          <div>{receipt.material_verification_passed === true ? '✓' : receipt.material_verification_passed === false ? '✗' : '—'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-6 flex space-x-3">
                      <button
                        type="button"
                        onClick={() => openReceiptDetails(receipt)}
                        className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        View Details
                      </button>
                      {receipt.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => acceptReceipt(receipt)}
                          disabled={acceptingId === receipt.id}
                          className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                        >
                          <CheckCircleIcon className="h-4 w-4 mr-1" />
                          {acceptingId === receipt.id ? 'Accepting...' : 'Accept'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Receipt Detail Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="receipt-detail-title">
          <div className="flex min-h-screen items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close receipt details"
              className="fixed inset-0 bg-gray-900/60"
              onClick={() => { setShowPrintPreview(false); setSelectedReceipt(null); }}
            />
            <div className="relative w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-white">
                <div>
                  <h2 id="receipt-detail-title" className="text-xl font-semibold">Goods Receipt Details</h2>
                  <p className="mt-1 text-sm text-indigo-100">
                    {selectedReceipt.receipt_number || `GR-${selectedReceipt.id}`}
                  </p>
                </div>
                <button type="button" onClick={() => { setShowPrintPreview(false); setSelectedReceipt(null); }} className="rounded-lg p-1 hover:bg-white/20" aria-label="Close">
                  <XCircleIcon className="h-7 w-7" />
                </button>
              </div>

              {detailLoading ? (
                <div className="py-16 text-center">
                  <div className="inline-block h-10 w-10 animate-spin rounded-full border-b-2 border-indigo-600" />
                  <p className="mt-3 text-sm text-gray-500">Loading receipt details...</p>
                </div>
              ) : (
                <div className="max-h-[75vh] overflow-y-auto p-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      ['PO Number', selectedReceipt.po_number],
                      ['Receipt Date', selectedReceipt.receipt_date ? new Date(selectedReceipt.receipt_date).toLocaleDateString() : null],
                      ['Received By', selectedReceipt.received_by_name],
                      ['Delivery Note', selectedReceipt.delivery_note_number],
                      ['Inspector', selectedReceipt.inspector_name],
                      ['Inspection Agency', selectedReceipt.inspection_agency],
                      ['Inspection Report', selectedReceipt.inspection_report_number],
                      ['Status', selectedReceipt.status_display || selectedReceipt.status],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
                        <p className="mt-1 text-sm font-medium text-gray-900">{value || 'Not recorded'}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-gray-900">Quality inspection</h3>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
                      {[
                        ['Overall', selectedReceipt.quality_check_passed],
                        ['Dimensional', selectedReceipt.dimensional_check_passed],
                        ['Visual', selectedReceipt.visual_inspection_passed],
                        ['Material', selectedReceipt.material_verification_passed],
                      ].map(([label, passed]) => (
                        <div key={label} className={`rounded-lg border p-3 text-center ${passed ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                          <p className="text-xs font-medium">{label}</p>
                          <p className="mt-1 font-semibold">{passed ? 'Passed' : 'Failed'}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-gray-200 p-4">
                      <h3 className="text-sm font-semibold text-gray-900">Items received</h3>
                      {Array.isArray(selectedReceipt.items_received) && selectedReceipt.items_received.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {selectedReceipt.items_received.map((item, index) => (
                            <div key={index} className="rounded bg-gray-50 p-3 text-sm text-gray-700">
                              <p className="font-medium text-gray-900">{item.item || item.description || `Item ${index + 1}`}</p>
                              <p className="mt-1">Ordered: {item.ordered_qty ?? '—'} · Received: {item.received_qty ?? item.quantity ?? '—'} · Accepted: {item.accepted_qty ?? '—'}</p>
                            </div>
                          ))}
                        </div>
                      ) : <p className="mt-2 text-sm text-gray-500">No item breakdown recorded.</p>}
                    </div>
                    <div className="rounded-lg border border-gray-200 p-4">
                      <h3 className="text-sm font-semibold text-gray-900">Compliance and traceability</h3>
                      <dl className="mt-3 space-y-2 text-sm">
                        <div><dt className="font-medium text-gray-700">Certificates</dt><dd className="text-gray-600">{Array.isArray(selectedReceipt.certificates_received) && selectedReceipt.certificates_received.length ? selectedReceipt.certificates_received.join(', ') : 'Not recorded'}</dd></div>
                        <div><dt className="font-medium text-gray-700">Heat numbers</dt><dd className="text-gray-600">{Array.isArray(selectedReceipt.heat_numbers) && selectedReceipt.heat_numbers.length ? selectedReceipt.heat_numbers.join(', ') : (selectedReceipt.heat_numbers || 'Not recorded')}</dd></div>
                        <div><dt className="font-medium text-gray-700">NDT performed</dt><dd className="text-gray-600">{selectedReceipt.ndt_performed ? 'Yes' : 'No'}</dd></div>
                        {selectedReceipt.ndt_results && <div><dt className="font-medium text-gray-700">NDT results</dt><dd className="text-gray-600">{selectedReceipt.ndt_results}</dd></div>}
                      </dl>
                    </div>
                  </div>

                  {(selectedReceipt.inspection_notes || selectedReceipt.notes) && (
                    <div className="mt-6 rounded-lg border border-gray-200 p-4">
                      <h3 className="text-sm font-semibold text-gray-900">Notes</h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{selectedReceipt.inspection_notes || selectedReceipt.notes}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
                <button type="button" onClick={openPrintPreview} className="inline-flex items-center rounded-md border border-indigo-300 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50">
                  <PrinterIcon className="mr-2 h-4 w-4" />
                  Print Preview
                </button>
                {selectedReceipt.status === 'pending' && (
                  <button type="button" onClick={() => acceptReceipt(selectedReceipt)} disabled={acceptingId === selectedReceipt.id} className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                    {acceptingId === selectedReceipt.id ? 'Accepting...' : 'Accept Receipt'}
                  </button>
                )}
                <button type="button" onClick={() => { setShowPrintPreview(false); setSelectedReceipt(null); }} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* A4 Print Preview */}
      {selectedReceipt && showPrintPreview && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-gray-900/80" role="dialog" aria-modal="true" aria-labelledby="gr-print-preview-title">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-700 bg-gray-900 px-4 py-3 text-white shadow-lg sm:px-6">
            <div>
              <h2 id="gr-print-preview-title" className="font-semibold">Print Preview · Goods Receipt Note</h2>
              <p className="text-xs text-gray-300">A4 portrait · {selectedReceipt.po_number} · Printed {receiptDate(printDate)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={printReceipt} className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
                <PrinterIcon className="mr-2 h-4 w-4" />
                Print / Save PDF
              </button>
              <button type="button" onClick={() => setShowPrintPreview(false)} className="rounded-md border border-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-800">Close Preview</button>
            </div>
          </div>
          <div className="mx-auto my-6 w-[210mm] min-h-[297mm] bg-white p-[10mm] shadow-2xl">
            <ReceiptPrintContent receipt={selectedReceipt} printDate={printDate} />
          </div>
        </div>
      )}

      {/* AI Receipt Creator Modal */}
      <ReceiptCreatorErrorBoundary isOpen={showAICreator} onClose={() => setShowAICreator(false)}>
        <AIReceiptCreator
          isOpen={showAICreator}
          onClose={() => setShowAICreator(false)}
          onReceiptCreated={handleReceiptCreated}
          orders={orders}
        />
      </ReceiptCreatorErrorBoundary>
    </div>
  );
};

export default ReceiptManagement;
