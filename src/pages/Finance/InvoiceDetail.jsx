/**
 * Invoice Detail Page
 * View invoice details, PDF preview, and approval workflow
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import financeService from '../../services/finance.service';

const InvoiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const fetchInvoice = async () => {
    try {
      const data = await financeService.getInvoice(id);
      setInvoice(data);
    } catch (error) {
      console.error('Failed to fetch invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    setProcessing(true);
    try {
      await financeService.processInvoice(id);
      await fetchInvoice();
    } catch (error) {
      alert('Failed to process invoice');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-xl text-gray-600">Invoice not found</p>
          <button onClick={() => navigate('/finance/invoices')} className="mt-4 text-blue-600">
            ← Back to Invoices
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4">
        <button
          onClick={() => navigate('/finance/invoices')}
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to Invoices
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Invoice Details */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Invoice Details</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Invoice Number</dt>
                <dd className="text-lg font-semibold">{invoice.invoice_number || `INV-${invoice.id}`}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Vendor</dt>
                <dd className="text-lg">{invoice.vendor_name || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Amount</dt>
                <dd className="text-lg font-semibold text-green-600">
                  {invoice.currency} {parseFloat(invoice.total_amount || 0).toFixed(2)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Type</dt>
                <dd className="text-lg">{invoice.invoice_type?.replace(/_/g, ' ') || 'Unclassified'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                    invoice.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    invoice.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                    invoice.status === 'PENDING_APPROVAL' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {invoice.status?.replace(/_/g, ' ')}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Uploaded</dt>
                <dd className="text-lg">{new Date(invoice.created_at).toLocaleString()}</dd>
              </div>
            </dl>

            {invoice.status === 'UPLOADED' && (
              <button
                onClick={handleProcess}
                disabled={processing}
                className="mt-6 w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {processing ? 'Processing...' : '🤖 Process with AI'}
              </button>
            )}
          </div>

          {/* Approval Workflow */}
          {invoice.approvals && invoice.approvals.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-bold mb-4">Approval Workflow</h3>
              <div className="space-y-3">
                {invoice.approvals.map((approval, idx) => (
                  <div key={approval.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      approval.status === 'APPROVED' ? 'bg-green-500 text-white' :
                      approval.status === 'REJECTED' ? 'bg-red-500 text-white' :
                      'bg-yellow-500 text-white'
                    }`}>
                      {approval.approval_level}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{approval.approver_name}</p>
                      <p className="text-sm text-gray-600">{approval.approver_email}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      approval.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                      approval.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {approval.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: PDF Preview */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold mb-4">Invoice Preview</h3>
          <iframe
            src={financeService.getInvoicePreviewUrl(id)}
            className="w-full h-[800px] border border-gray-300 rounded"
            title="Invoice PDF"
          />
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetail;
