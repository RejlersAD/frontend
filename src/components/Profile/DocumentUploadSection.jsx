import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import {
  FileText, Upload, X, Edit2, Check, Trash2, Calendar,
  AlertCircle, CheckCircle, Clock, XCircle, Eye, Download
} from 'lucide-react';
import { API_BASE_URL } from '../../config/api.config';
import { DOCUMENT_UPLOAD_CONFIG, validateDocument, formatFileSize } from '../../config/s3Upload.config';

/**
 * Document Upload Section — Emirates ID, Driving License, Country ID, etc.
 * Soft-coded document types fetched from backend
 */
const DocumentUploadSection = () => {
  const [documents, setDocuments] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingType, setUploadingType] = useState(null);
  const [editingDoc, setEditingDoc] = useState(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false); // ✅ SOFT-CODED: Track if editing details only
  const fileInputRef = useRef(null);
  
  // Form state
  const [formData, setFormData] = useState({
    document_type: '',
    document_file: null,
    document_number: '',
    issue_date: '',
    expiry_date: '',
    issuing_authority: '',
    notes: ''
  });

  useEffect(() => {
    fetchDocuments();
    fetchDocumentTypes();
  }, []);

  const fetchDocuments = async () => {
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
      const res = await fetch(`${API_BASE_URL}/rbac/profile-documents/my_documents/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch documents');
      const data = await res.json();
      setDocuments(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load documents');
    }
  };

  const fetchDocumentTypes = async () => {
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
      // ✅ USE FILTERED ENDPOINT: Only fetch document types shown in profile page (identity + health)
      const res = await fetch(`${API_BASE_URL}/rbac/profile-documents/document-types/profile/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDocumentTypes(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileSelect = (e, documentType) => {
    const file = e.target.files[0];
    if (!file) return;

    const validation = validateDocument(file);
    if (!validation.isValid) {
      toast.error(validation.errors.join(', '));
      return;
    }

    setFormData(prev => ({
      ...prev,
      document_type: documentType,
      document_file: file
    }));
    setUploadingType(documentType);
  };

  const handleUpload = async () => {
    // ✅ SOFT-CODED: Allow saving details without file for edit mode
    if (!isEditingDetails && (!formData.document_file || !formData.document_type)) {
      toast.error('Please select a file');
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
      
      const formDataToSend = new FormData();
      formDataToSend.append('document_type', formData.document_type);
      
      // ✅ SOFT-CODED: Only append file if provided (for replace) or if new upload
      if (formData.document_file) {
        formDataToSend.append('document_file', formData.document_file);
      }
      
      if (formData.document_number) formDataToSend.append('document_number', formData.document_number);
      if (formData.issue_date) formDataToSend.append('issue_date', formData.issue_date);
      if (formData.expiry_date) formDataToSend.append('expiry_date', formData.expiry_date);
      if (formData.issuing_authority) formDataToSend.append('issuing_authority', formData.issuing_authority);
      if (formData.notes) formDataToSend.append('notes', formData.notes);

      const url = editingDoc
        ? `${API_BASE_URL}/rbac/profile-documents/${editingDoc.id}/`
        : `${API_BASE_URL}/rbac/profile-documents/`;

      const res = await fetch(url, {
        method: editingDoc ? 'PATCH' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formDataToSend,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Upload failed');
      }

      const actionMessage = isEditingDetails 
        ? 'Document details updated successfully' 
        : DOCUMENT_UPLOAD_CONFIG.messages.uploadSuccess;
      
      toast.success(actionMessage);
      resetForm();
      fetchDocuments();
    } catch (err) {
      console.error(err);
      toast.error(err.message || DOCUMENT_UPLOAD_CONFIG.messages.uploadFailed);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
      const res = await fetch(`${API_BASE_URL}/rbac/profile-documents/${docId}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Delete failed');

      toast.success(DOCUMENT_UPLOAD_CONFIG.messages.deleteSuccess);
      fetchDocuments();
    } catch (err) {
      console.error(err);
      toast.error(DOCUMENT_UPLOAD_CONFIG.messages.deleteFailed);
    }
  };

  const resetForm = () => {
    setFormData({
      document_type: '',
      document_file: null,
      document_number: '',
      issue_date: '',
      expiry_date: '',
      issuing_authority: '',
      notes: ''
    });
    setUploadingType(null);
    setEditingDoc(null);
    setIsEditingDetails(false); // ✅ SOFT-CODED: Reset edit mode
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ✅ SOFT-CODED: Handle Edit Details action (no file upload required)
  const handleEditDetails = (doc, type) => {
    setEditingDoc(doc);
    setIsEditingDetails(true);
    setUploadingType(type.code);
    setFormData({
      document_type: type.code,
      document_file: null, // No file required for details edit
      document_number: doc.document_number || '',
      issue_date: doc.issue_date || '',
      expiry_date: doc.expiry_date || '',
      issuing_authority: doc.issuing_authority || '',
      notes: doc.notes || ''
    });
  };

  // ✅ SOFT-CODED: Handle Replace File action (requires new file)
  const handleReplaceFile = (doc, type) => {
    const actions = DOCUMENT_UPLOAD_CONFIG.actions;
    if (actions.replace.requiresConfirmation && 
        !window.confirm(actions.replace.confirmMessage)) {
      return;
    }
    
    setEditingDoc(doc);
    setIsEditingDetails(false);
    setUploadingType(type.code);
    setFormData({
      document_type: type.code,
      document_file: null,
      document_number: doc.document_number || '',
      issue_date: doc.issue_date || '',
      expiry_date: doc.expiry_date || '',
      issuing_authority: doc.issuing_authority || '',
      notes: doc.notes || ''
    });
  };

  // ✅ SOFT-CODED: Handle Download action
  const handleDownload = (doc) => {
    if (doc.document_file_url) {
      window.open(doc.document_file_url, '_blank');
    } else {
      toast.error('Document file not available');
    }
  };

  // ✅ SOFT-CODED: Handle View action
  const handleView = (doc) => {
    if (doc.document_file_url) {
      window.open(doc.document_file_url, '_blank');
    } else {
      toast.error('Document file not available');
    }
  };

  const getVerificationBadge = (status) => {
    const badges = {
      pending: { icon: Clock, text: 'Pending', color: 'yellow' },
      verified: { icon: CheckCircle, text: 'Verified', color: 'green' },
      rejected: { icon: XCircle, text: 'Rejected', color: 'red' },
      expired: { icon: AlertCircle, text: 'Expired', color: 'gray' }
    };

    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-${badge.color}-100 text-${badge.color}-700`}>
        <Icon size={14} />
        {badge.text}
      </span>
    );
  };

  const renderDocumentCard = (type) => {
    // ✅ SOFT-CODED: Backend returns single object per type, not array
    const latestDoc = documents[type.code];
    const hasDoc = latestDoc && typeof latestDoc === 'object' && latestDoc.id;

    return (
      <div key={type.code} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-all">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${type.bg_color}`}>
              <span className="text-2xl">{type.icon}</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{type.label}</h3>
              <p className="text-xs text-gray-500">{type.description}</p>
              {type.required && (
                <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
                  Required
                </span>
              )}
            </div>
          </div>
          {hasDoc && getVerificationBadge(latestDoc.verification_status)}
        </div>

        {/* Document Info */}
        {hasDoc && latestDoc ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <FileText size={16} className="text-gray-400" />
              <a 
                href={latestDoc.document_file_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline flex-1 truncate"
              >
                {latestDoc.document_file_name}
              </a>
              <a
                href={latestDoc.document_file_url}
                download
                className="text-gray-600 hover:text-gray-900"
              >
                <Download size={16} />
              </a>
            </div>

            {latestDoc.document_number && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">Number:</span> {latestDoc.document_number}
              </div>
            )}

            {latestDoc.expiry_date && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar size={14} className="text-gray-400" />
                <span className={latestDoc.is_expired ? 'text-red-600 font-medium' : latestDoc.expires_soon ? 'text-orange-600 font-medium' : 'text-gray-600'}>
                  Expires: {new Date(latestDoc.expiry_date).toLocaleDateString()}
                  {latestDoc.is_expired && ' (Expired)'}
                  {latestDoc.expires_soon && !latestDoc.is_expired && ' (Expiring Soon)'}
                </span>
              </div>
            )}

            {latestDoc.rejection_reason && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <span className="font-medium">Rejection Reason:</span> {latestDoc.rejection_reason}
              </div>
            )}

            {/* ✅ SOFT-CODED: Action buttons from configuration */}
            <div className="flex flex-wrap gap-2 pt-2">
              {/* View Button */}
              {DOCUMENT_UPLOAD_CONFIG.actions.view.enabled && 
               DOCUMENT_UPLOAD_CONFIG.actions.view.showInCard && (
                <button
                  onClick={() => handleView(latestDoc)}
                  className={`flex items-center justify-center gap-2 px-3 py-2 ${DOCUMENT_UPLOAD_CONFIG.actions.view.bgColor} ${DOCUMENT_UPLOAD_CONFIG.actions.view.textColor} rounded-lg ${DOCUMENT_UPLOAD_CONFIG.actions.view.hoverColor} transition-colors text-sm font-medium`}
                  title={DOCUMENT_UPLOAD_CONFIG.actions.view.label}
                >
                  <Eye size={16} />
                  <span className="hidden sm:inline">{DOCUMENT_UPLOAD_CONFIG.actions.view.label}</span>
                </button>
              )}

              {/* Download Button */}
              {DOCUMENT_UPLOAD_CONFIG.actions.download.enabled && 
               DOCUMENT_UPLOAD_CONFIG.actions.download.showInCard && (
                <button
                  onClick={() => handleDownload(latestDoc)}
                  className={`flex items-center justify-center gap-2 px-3 py-2 ${DOCUMENT_UPLOAD_CONFIG.actions.download.bgColor} ${DOCUMENT_UPLOAD_CONFIG.actions.download.textColor} rounded-lg ${DOCUMENT_UPLOAD_CONFIG.actions.download.hoverColor} transition-colors text-sm font-medium`}
                  title={DOCUMENT_UPLOAD_CONFIG.actions.download.label}
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">{DOCUMENT_UPLOAD_CONFIG.actions.download.label}</span>
                </button>
              )}

              {/* Edit Details Button */}
              {DOCUMENT_UPLOAD_CONFIG.actions.edit.enabled && 
               DOCUMENT_UPLOAD_CONFIG.actions.edit.showInCard && (
                <button
                  onClick={() => handleEditDetails(latestDoc, type)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 ${DOCUMENT_UPLOAD_CONFIG.actions.edit.bgColor} ${DOCUMENT_UPLOAD_CONFIG.actions.edit.textColor} rounded-lg ${DOCUMENT_UPLOAD_CONFIG.actions.edit.hoverColor} transition-colors text-sm font-medium`}
                  title={DOCUMENT_UPLOAD_CONFIG.actions.edit.description}
                >
                  <Edit2 size={16} />
                  <span>{DOCUMENT_UPLOAD_CONFIG.actions.edit.label}</span>
                </button>
              )}

              {/* Replace File Button */}
              {DOCUMENT_UPLOAD_CONFIG.actions.replace.enabled && 
               DOCUMENT_UPLOAD_CONFIG.actions.replace.showInCard && (
                <button
                  onClick={() => handleReplaceFile(latestDoc, type)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 ${DOCUMENT_UPLOAD_CONFIG.actions.replace.bgColor} ${DOCUMENT_UPLOAD_CONFIG.actions.replace.textColor} rounded-lg ${DOCUMENT_UPLOAD_CONFIG.actions.replace.hoverColor} transition-colors text-sm font-medium`}
                  title={DOCUMENT_UPLOAD_CONFIG.actions.replace.description}
                >
                  <Upload size={16} />
                  <span>{DOCUMENT_UPLOAD_CONFIG.actions.replace.label}</span>
                </button>
              )}

              {/* Delete Button */}
              {DOCUMENT_UPLOAD_CONFIG.actions.delete.enabled && 
               DOCUMENT_UPLOAD_CONFIG.actions.delete.showInCard && (
                <button
                  onClick={() => {
                    if (DOCUMENT_UPLOAD_CONFIG.actions.delete.requiresConfirmation) {
                      if (window.confirm(DOCUMENT_UPLOAD_CONFIG.actions.delete.confirmMessage)) {
                        handleDelete(latestDoc.id);
                      }
                    } else {
                      handleDelete(latestDoc.id);
                    }
                  }}
                  className={`flex items-center justify-center gap-2 px-3 py-2 ${DOCUMENT_UPLOAD_CONFIG.actions.delete.bgColor} ${DOCUMENT_UPLOAD_CONFIG.actions.delete.textColor} rounded-lg ${DOCUMENT_UPLOAD_CONFIG.actions.delete.hoverColor} transition-colors text-sm font-medium`}
                  title={DOCUMENT_UPLOAD_CONFIG.actions.delete.label}
                >
                  <Trash2 size={16} />
                  <span className="hidden sm:inline">{DOCUMENT_UPLOAD_CONFIG.actions.delete.label}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              ref={uploadingType === type.code ? fileInputRef : null}
              type="file"
              accept={DOCUMENT_UPLOAD_CONFIG.allowedExtensions.join(',')}
              onChange={(e) => handleFileSelect(e, type.code)}
              className="hidden"
              id={`file-${type.code}`}
            />
            <label
              htmlFor={`file-${type.code}`}
              className="flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
            >
              <Upload size={32} className="text-gray-400" />
              <span className="text-sm text-gray-600">Click to upload {type.label}</span>
              <span className="text-xs text-gray-400">PDF, JPG, JPEG, PNG (max {formatFileSize(type.max_file_size_mb * 1024 * 1024)})</span>
            </label>
          </div>
        )}
      </div>
    );
  };

  const renderUploadForm = () => {
    if (!uploadingType) return null;

    const type = documentTypes.find(t => t.code === uploadingType);
    if (!type) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              {/* ✅ SOFT-CODED: Dynamic title based on action */}
              {isEditingDetails 
                ? `${DOCUMENT_UPLOAD_CONFIG.actions.edit.label} — ${type.label}`
                : editingDoc 
                  ? `${DOCUMENT_UPLOAD_CONFIG.actions.replace.label} — ${type.label}`
                  : `Upload ${type.label}`
              }
            </h2>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          {/* Form */}
          <div className="p-6 space-y-4">
            {/* ✅ SOFT-CODED: Show file upload section only if not in edit-details-only mode */}
            {!isEditingDetails && (
              <>
                {/* File Info */}
                {formData.document_file && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-3">
                      <FileText size={24} className="text-blue-600" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{formData.document_file.name}</p>
                        <p className="text-sm text-gray-600">{formatFileSize(formData.document_file.size)}</p>
                      </div>
                      <button
                        onClick={() => {
                          setFormData(prev => ({ ...prev, document_file: null }));
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>
                )}

                {!formData.document_file && (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={DOCUMENT_UPLOAD_CONFIG.allowedExtensions.join(',')}
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const validation = validateDocument(file);
                        if (!validation.isValid) {
                          toast.error(validation.errors.join(', '));
                          e.target.value = '';
                          return;
                        }
                        setFormData(prev => ({ ...prev, document_file: file }));
                      }}
                      className="hidden"
                      id="upload-file"
                    />
                    <label
                      htmlFor="upload-file"
                      className="flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
                    >
                      <Upload size={48} className="text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {editingDoc ? 'Click to select new file' : 'Click to select file'}
                      </span>
                      <span className="text-xs text-gray-400">PDF, JPG, JPEG, PNG (max {formatFileSize(type.max_file_size_mb * 1024 * 1024)})</span>
                    </label>
                  </div>
                )}
              </>
            )}

            {/* ✅ SOFT-CODED: Info message for edit details mode */}
            {isEditingDetails && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle size={20} className="text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-orange-900">Editing Document Details</p>
                    <p className="text-xs text-orange-700 mt-1">
                      You are updating the document information only. To replace the file, use the "Replace File" button.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Document Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Document Number <span className="text-gray-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.document_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, document_number: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 784-1234-5678-9"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Issuing Authority <span className="text-gray-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.issuing_authority}
                  onChange={(e) => setFormData(prev => ({ ...prev, issuing_authority: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., UAE Government"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Issue Date <span className="text-gray-400">(Optional)</span>
                </label>
                <input
                  type="date"
                  value={formData.issue_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, issue_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiry Date <span className="text-gray-400">(Optional)</span>
                </label>
                <input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes <span className="text-gray-400">(Optional)</span>
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Any additional information..."
              />
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3">
            <button
              onClick={resetForm}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={(!isEditingDetails && !formData.document_file) || isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isEditingDetails ? 'Saving...' : 'Uploading...'}
                </>
              ) : (
                <>
                  {isEditingDetails ? (
                    <>
                      <Check size={16} />
                      Save Changes
                    </>
                  ) : editingDoc ? (
                    <>
                      <Upload size={16} />
                      Replace Document
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      Upload Document
                    </>
                  )}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Documents</h2>
          <p className="text-gray-600 mt-1">
            Upload your identification documents for verification
          </p>
        </div>
      </div>

      {/* Document Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {documentTypes
          .sort((a, b) => a.display_order - b.display_order)
          .map(type => renderDocumentCard(type))}
      </div>

      {/* Upload Form Modal */}
      {renderUploadForm()}
    </div>
  );
};

export default DocumentUploadSection;
