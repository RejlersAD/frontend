/**
 * Invoice Upload Page
 * Upload invoices for AI classification and approval workflow
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import financeService from '../../services/finance.service';

const InvoiceUpload = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (selectedFile) => {
    const fileName = selectedFile.name.toLowerCase();
    const fileType = selectedFile.type.toLowerCase();

    const isPDF = fileName.endsWith('.pdf') || fileType === 'application/pdf';

    if (!isPDF) {
      setError(`Only PDF invoices are accepted. Received: ${selectedFile.name}`);
      return;
    }

    if (selectedFile.size > 20 * 1024 * 1024) {
      setError('File size cannot exceed 20MB');
      return;
    }

    setFile(selectedFile);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      setError('Please select an invoice PDF to upload');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const result = await financeService.uploadInvoice(file);
      
      // Navigate to invoice detail page
      const invoiceId = result.id || result.invoice?.id || result.data?.id;
      if (invoiceId) {
        navigate(`/finance/invoices/${invoiceId}`);
      } else {
        navigate('/finance/invoices');
      }
    } catch (err) {
      setError(err.message || 'Failed to upload invoice');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Upload Invoice
        </h1>

        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit}>
            {/* Drag & Drop Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                dragActive
                  ? 'border-blue-500 bg-blue-50'
                  : file
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept=".pdf,application/pdf"
                onChange={(e) => handleFileSelect(e.target.files[0])}
                disabled={uploading}
              />

              <label htmlFor="file-upload" className="cursor-pointer">
                {file ? (
                  <div>
                    <svg className="mx-auto h-16 w-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="mt-4 text-lg font-medium text-gray-900">{file.name}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div>
                    <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="mt-4 text-lg font-medium text-gray-900">
                      Drop your invoice PDF here
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      or click to browse (Max 20MB)
                    </p>
                  </div>
                )}
              </label>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            {/* Upload Button */}
            <div className="mt-6 flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => navigate('/finance/invoices')}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={!file || uploading}
              >
                {uploading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </span>
                ) : (
                  'Upload & Process'
                )}
              </button>
            </div>

            {/* Info Box */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">What happens next?</h3>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Invoice will be extracted and analyzed using AI</li>
                <li>Automatically classified by type (Finance, IT, Project, Admin)</li>
                <li>Routed to appropriate approval chain based on type and amount</li>
                <li>Email notifications sent to approvers at each level</li>
              </ul>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default InvoiceUpload;


