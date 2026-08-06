/**
 * Purchase Order Form Component
 * Aligned with RAD-PRJ-PUR-0014 Template (7-page format)
 * 
 * Features:
 * - All 56 fields from company PO template
 * - Multi-file upload to S3
 * - Auto-save to draft
 * - Form validation
 * - Professional approval section
 * - Vendor confirmation tracking
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import apiClient from '../../services/api.service';
import {
  DocumentTextIcon,
  PaperClipIcon,
  CheckCircleIcon,
  XCircleIcon,
  CloudArrowUpIcon,
  InformationCircleIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  DocumentCheckIcon,
} from '@heroicons/react/24/outline';

const TERMS_TEMPLATES = {
  standard: `1. This Purchase Order is governed by applicable laws and the goods/services shall conform to the agreed specifications.
2. Vendor shall provide all deliverables in accordance with the schedule and approved quality standards.
3. All invoices shall include the PO number and be submitted at the agreed stages.
4. Any disputes shall be settled through amicable negotiation and, failing that, arbitration in the agreed jurisdiction.`,
  oilAndGas: `1. Supplier shall comply with all O&G industry standards, including API, ASME, and NORSOK as applicable.
2. Material Test Reports (MTR) and Non-Destructive Testing (NDT) certificates must accompany all deliveries.
3. Third-party inspection shall be allowed at the purchaser's discretion, with inspection reports submitted before dispatch.
4. The vendor warrants that all materials and workmanship meet project-specific performance requirements and applicable codes.`,
  custom: '',
};

const APPROVER_OPTIONS = [
  'Select approver',
  'Technical Lead - Engineering',
  'Finance Lead - Procurement',
  'Contract Manager',
  'Project Director',
  'Managing Director',
];

const APPROVAL_STATUSES = ['Pending', 'Approved', 'Rejected', 'Clarification Required'];

const normalizeApiErrors = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};

  return Object.fromEntries(
    Object.entries(data).map(([field, value]) => {
      const message = Array.isArray(value)
        ? value.map(String).join(' ')
        : typeof value === 'object' && value !== null
          ? Object.values(value).flat().map(String).join(' ')
          : String(value);
      return [field, message];
    })
  );
};

const getApiErrorMessage = (error, fieldErrors) => {
  const responseData = error.response?.data;
  if (typeof responseData === 'string' && !responseData.trim().startsWith('<')) {
    return responseData;
  }

  const preferredMessage = fieldErrors.detail || fieldErrors.error || fieldErrors.message;
  if (preferredMessage) return preferredMessage;

  const firstFieldError = Object.entries(fieldErrors).find(
    ([field]) => !['detail', 'error', 'message'].includes(field)
  );
  if (firstFieldError) {
    const [field, message] = firstFieldError;
    return `${field.replaceAll('_', ' ')}: ${message}`;
  }

  if (!error.response) return 'Unable to reach the server. Check your connection and try again.';
  if (error.response.status >= 500) {
    return 'The server could not create the purchase order. Please try again or contact support.';
  }
  return 'The purchase order could not be submitted. Review the required fields and try again.';
};

const PurchaseOrderForm = ({ isOpen, onClose, onSuccess, editData = null, prReference = null }) => {
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [projects, setProjects] = useState([]);
  
  // Form state - all 56 fields from PDF template
  const [formData, setFormData] = useState({
    // Header Section
    po_number: editData?.po_number || '', // Auto-generated
    po_date: editData?.po_date || new Date().toISOString().split('T')[0],
    form_note: editData?.form_note || '(PO no. to be used in all documents)',
    
    // PR Reference (if converting from PR)
    pr_reference: prReference?.id || editData?.pr_reference || null,
    pr_requester_name: prReference?.issued_by_name || editData?.pr_requester_name || '',
    
    // Seller/Vendor Section
    vendor: prReference?.vendor || editData?.vendor || '',
    seller_reference: editData?.seller_reference || '',
    quote_ref: editData?.quote_ref || '',
    seller_license_no: editData?.seller_license_no || '',
    
    // Buyer/Invoicing Information
    invoicing_attn: editData?.invoicing_attn || 'Attn. Mr. Aneef Thadikkarantavida',
    invoicing_emails: editData?.invoicing_emails || ['aneef.thadikkarantavida@rejlers.ae', 'uae.procurement@rejlers.ae'],
    company_fax: editData?.company_fax || '+971 2 639 7448',
    
    // Buyer Reference
    buyer_reference_pm: editData?.buyer_reference_pm || '',
    buyer_reference_pe: editData?.buyer_reference_pe || '',
    
    // Purchase Details
    title: prReference?.product_service || editData?.title || '',
    description: prReference?.description_reason || editData?.description || '',
    category: editData?.category || 'engineering_services',
    
    // Financial
    total_amount: prReference?.total_price || editData?.total_amount || '',
    currency: prReference?.currency || editData?.currency || 'USD',
    vat_percentage: editData?.vat_percentage || 5.00,
    tax_amount: editData?.tax_amount || 0,
    discount_amount: editData?.discount_amount || 0,
    
    // Payment Terms
    payment_terms: editData?.payment_terms || '45 days net for agreed payment milestones',
    payment_mode: editData?.payment_mode || 'Bank Transfer',
    delivery_terms: editData?.delivery_terms || 'Services completed and accepted',
    marking: editData?.marking || '',
    payment_milestones: editData?.payment_milestones || [],
    workshop_rates: editData?.workshop_rates || {},
    
    // Project Information
    project: editData?.project || '',
    project_number: editData?.project_number || '',
    project_manager: editData?.project_manager || '',
    end_client: editData?.end_client || '',
    contractor: editData?.contractor || 'Rejlers International Engineering Solutions AB',
    subcontractor: editData?.subcontractor || '',
    company_agreement_no: editData?.company_agreement_no || '',
    rad_project_no: editData?.rad_project_no || '',
    
    // Dates
    start_date: prReference?.start_date || editData?.start_date || '',
    end_date: editData?.end_date || '',
    expected_delivery: editData?.expected_delivery || '',
    
    // Pricing Items
    items: prReference?.items || editData?.items || [],
    
    // Approval Section
    approved_by_name: editData?.approved_by_name || '',
    approved_by_title: editData?.approved_by_title || '',
    approved_date: editData?.approved_date || '',
    approval_signature: editData?.approval_signature || '',
    
    // Vendor Confirmation
    confirmation_date: editData?.confirmation_date || '',
    seller_contact_person: editData?.seller_contact_person || '',
    seller_phone: editData?.seller_phone || '',
    seller_fax: editData?.seller_fax || '',
    seller_email: editData?.seller_email || '',
    
    // Contract Sections
    scope_of_services: editData?.scope_of_services || '',
    safety_requirements: editData?.safety_requirements || '',
    variations_clause: editData?.variations_clause || '',
    time_schedule: editData?.time_schedule || '',
    reporting_meetings: editData?.reporting_meetings || '',
    performance_requirements: editData?.performance_requirements || '',
    contact_persons: editData?.contact_persons || {
      technical: [],
      project_team: [],
      commercial: []
    },
    
    // Additional
    terms_and_conditions: editData?.terms_and_conditions || '',
    terms_template: editData?.terms_template || 'standard',
    warranty_period: editData?.warranty_period || '',
    guarantee_period: editData?.guarantee_period || '',
    inspection_requirements: editData?.inspection_requirements || '',
    liquidated_damages: editData?.liquidated_damages || '',
    technical_approver: editData?.technical_approver || '',
    financial_approver: editData?.financial_approver || '',
    management_approver: editData?.management_approver || '',
    approval_log: editData?.approval_log || [
      { stage: 'Technical Approval', approver: '', status: 'Pending', date: '', comments: '' },
      { stage: 'Financial Approval', approver: '', status: 'Pending', date: '', comments: '' },
      { stage: 'Final Management Sign-off', approver: '', status: 'Pending', date: '', comments: '' },
    ],
    final_approver_notes: editData?.final_approver_notes || '',
    notes: editData?.notes || '',
    // Short summary that is sent to vendor with the PO
    summary: editData?.summary || '',
    status: editData?.status || 'draft',
  });
  
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [popupError, setPopupError] = useState('');
  const [autoSaving, setAutoSaving] = useState(false);
  const [draftId, setDraftId] = useState(editData?.id || null);
  const [currentSection, setCurrentSection] = useState(1);

  // Fetch vendors and projects whenever the form is opened
  useEffect(() => {
    if (isOpen) {
      fetchVendors();
      fetchProjects();
    }
  }, [isOpen]);

  // Auto-calculate tax when total amount or VAT% changes
  useEffect(() => {
    if (formData.total_amount && formData.vat_percentage) {
      const amount = parseFloat(formData.total_amount) || 0;
      const vatPct = parseFloat(formData.vat_percentage) || 0;
      const taxAmount = (amount * vatPct) / 100;
      setFormData(prev => ({ ...prev, tax_amount: taxAmount.toFixed(2) }));
    }
  }, [formData.total_amount, formData.vat_percentage]);

  // Auto-save draft every 30 seconds
  useEffect(() => {
    if (!editData) {
      const autoSaveInterval = setInterval(() => {
        const canPersistDraft = Boolean(
          formData.vendor &&
          formData.title?.trim() &&
          formData.category &&
          Number(formData.total_amount) > 0
        );
        if (canPersistDraft) {
          handleAutoSave();
        }
      }, 30000);
      return () => clearInterval(autoSaveInterval);
    }
  }, [formData, editData, draftId]);

  const normalizeApiArray = (data) => {
    if (Array.isArray(data)) return data;
    if (data?.results && Array.isArray(data.results)) return data.results;
    if (data?.data && Array.isArray(data.data)) return data.data;
    if (data?.data?.results && Array.isArray(data.data.results)) return data.data.results;
    if (data?.vendors && Array.isArray(data.vendors)) return data.vendors;
    if (data && typeof data === 'object') {
      const firstArray = Object.values(data).find((value) => Array.isArray(value));
      if (Array.isArray(firstArray)) return firstArray;
    }
    return [];
  };

  const fetchVendors = async () => {
    try {
      const response = await apiClient.get('/procurement/vendors/', {
        params: {
          page_size: 1000,
        },
      });
      const data = response.data;
      const normalizedVendors = normalizeApiArray(data);
      setVendors(normalizedVendors);
      if (!normalizedVendors.length) {
        console.warn('Vendor API returned no vendors:', data);
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
      setVendors([]); // Ensure vendors is always an array
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await apiClient.get('/procurement/projects/');
      const data = response.data;
      // Handle both paginated (data.results) and direct array responses
      setProjects(Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]); // Ensure projects is always an array
    }
  };

  useEffect(() => {
    if (formData.vendor && vendors.length) {
      const vendor = vendors.find((v) => String(v.id) === String(formData.vendor));
      if (vendor) setSelectedVendor(vendor);
    }
  }, [vendors, formData.vendor]);

  const handleAutoSave = async () => {
    setAutoSaving(true);
    try {
      const persistedOrderId = editData?.id || draftId;
      if (persistedOrderId) {
        await apiClient.patch(`/procurement/orders/${persistedOrderId}/`, formData);
      } else {
        const response = await apiClient.post('/procurement/orders/', {
          ...formData,
          status: 'draft'
        });
        setDraftId(response.data.id);
        if (response.data.po_number) {
          setFormData(prev => ({ ...prev, po_number: response.data.po_number }));
        }
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setAutoSaving(false);
    }
  };

  const handleVendorChange = (e) => {
    const vendorId = e.target.value;
    const vendor = vendors.find((v) => String(v.id) === String(vendorId));

    setSelectedVendor(vendor || null);
    setFormData((prev) => ({
      ...prev,
      vendor: vendorId,
      seller_contact_person: vendor?.contact_person || prev.seller_contact_person,
      seller_email: vendor?.email || prev.seller_email,
      seller_phone: vendor?.phone || prev.seller_phone,
      seller_license_no: vendor?.trade_license_number || prev.seller_license_no,
      category: vendor?.categories?.[0] || prev.category,
    }));

    if (errors.vendor) {
      setErrors((prev) => ({ ...prev, vendor: null }));
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
    if (name === 'summary' && popupError) {
      setPopupError('');
    }
  };

  const updateApprovalLog = (index, field, value) => {
    setFormData(prev => {
      const approval_log = [...prev.approval_log];
      approval_log[index] = {
        ...approval_log[index],
        [field]: value,
      };
      return { ...prev, approval_log };
    });
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(prevFiles => [...prevFiles, ...selectedFiles]);
  };

  const removeFile = (index) => {
    setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  const addPaymentMilestone = () => {
    setFormData(prev => ({
      ...prev,
      payment_milestones: [...prev.payment_milestones, {
        milestone: '',
        percentage: 0,
        amount: 0,
        due_date: ''
      }]
    }));
  };

  const updatePaymentMilestone = (index, field, value) => {
    const updated = [...formData.payment_milestones];
    updated[index][field] = value;
    setFormData(prev => ({ ...prev, payment_milestones: updated }));
  };

  const removePaymentMilestone = (index) => {
    setFormData(prev => ({
      ...prev,
      payment_milestones: prev.payment_milestones.filter((_, i) => i !== index)
    }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          line_code: '',
          description: '',
          specification: '',
          comment: '',
          quantity: 1,
          uom: '',
          unit_price: 0,
          discount: 0,
        }
      ]
    }));
  };

  const updateItem = (index, field, value) => {
    setFormData(prev => {
      const items = [...prev.items];
      items[index] = {
        ...items[index],
        [field]: field === 'quantity' || field === 'unit_price' || field === 'discount'
          ? Number(value || 0)
          : value,
      };
      return { ...prev, items };
    });
  };

  const removeItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const calculateItemTotal = (item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unit_price || 0);
    const discount = Number(item.discount || 0);
    return Math.max(0, quantity * unitPrice - discount);
  };

  const calculateSubtotal = () => {
    return (formData.items || []).reduce((sum, item) => sum + calculateItemTotal(item), 0);
  };

  const calculateTaxAmount = (subtotal) => {
    const vatPct = Number(formData.vat_percentage || 0);
    return Number(((subtotal * vatPct) / 100).toFixed(2));
  };

  const calculateGrandTotal = (subtotal, taxAmount) => {
    return Number((subtotal + taxAmount).toFixed(2));
  };

  useEffect(() => {
    const subtotal = calculateSubtotal();
    const taxAmount = calculateTaxAmount(subtotal);
    const totalAmount = calculateGrandTotal(subtotal, taxAmount);
    setFormData(prev => {
      if (prev.total_amount === totalAmount && prev.tax_amount === taxAmount) {
        return prev;
      }
      return {
        ...prev,
        total_amount: totalAmount,
        tax_amount: taxAmount,
      };
    });
  }, [formData.items, formData.vat_percentage]);

  const validateForm = (requireSummary = false) => {
    const newErrors = {};
    
    if (!formData.vendor) newErrors.vendor = 'Vendor is required';
    if (!formData.title?.trim()) newErrors.title = 'Title is required';
    if (!formData.total_amount || parseFloat(formData.total_amount) <= 0) {
      newErrors.total_amount = 'Valid total amount is required';
    }
    if (!formData.payment_terms?.trim()) newErrors.payment_terms = 'Payment terms are required';
    if (requireSummary && !formData.summary?.trim()) newErrors.summary = 'Summary is required before sending to vendor';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e, sendToVendor = false) => {
    e.preventDefault();

    if (!validateForm(sendToVendor)) {
      const validationMessage = !formData.vendor
        ? 'Please select a vendor.'
        : !formData.title?.trim()
          ? 'Please enter a purchase order title.'
          : !formData.total_amount || Number(formData.total_amount) <= 0
            ? 'Please add at least one priced line item.'
            : !formData.payment_terms?.trim()
              ? 'Please enter the payment terms.'
              : 'Please add a short summary before sending to the vendor.';
      setPopupError(validationMessage);
      setCurrentSection(
        !formData.vendor || !formData.title?.trim() || (sendToVendor && !formData.summary?.trim()) ? 1 : 2
      );
      setTimeout(() => setPopupError(''), 6000);
      return;
    }

    setSubmitLoading(true);
    
    try {
      const submitData = new FormData();
      
      // Append all form fields
      Object.keys(formData).forEach(key => {
        // PO number is immutable and comes from the authoritative backend sequence.
        if (key === 'po_number') return;
        const value = formData[key];
        if (value !== null && value !== undefined && value !== '') {
          if (typeof value === 'object') {
            submitData.append(key, JSON.stringify(value));
          } else {
            submitData.append(key, value);
          }
        }
      });
      
      // Set status
      submitData.set('status', sendToVendor ? 'sent' : 'draft');
      
      // Append files
      files.forEach((file) => {
        submitData.append('attachments_files', file);
      });
      
      const config = {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
      };
      
      let response;
      const persistedOrderId = editData?.id || draftId;
      if (persistedOrderId) {
        response = await apiClient.patch(`/procurement/orders/${persistedOrderId}/`, submitData, config);
      } else {
        response = await apiClient.post('/procurement/orders/', submitData, config);
      }
      
      if (onSuccess) onSuccess(response.data);
      if (onClose) onClose();
    } catch (error) {
      console.error('Error submitting PO:', error);
      const fieldErrors = normalizeApiErrors(error.response?.data);
      setErrors(fieldErrors);
      setPopupError(getApiErrorMessage(error, fieldErrors));
      setTimeout(() => setPopupError(''), 8000);
    } finally {
      setSubmitLoading(false);
      setUploadProgress(0);
    }
  };

  // Don't render if not open - check AFTER all hooks
  if (!isOpen) return null;

  const sections = [
    { id: 1, name: 'Header & Seller', icon: BuildingOfficeIcon },
    { id: 2, name: 'Buyer & Payment', icon: CurrencyDollarIcon },
    { id: 3, name: 'Project Details', icon: DocumentCheckIcon },
    { id: 4, name: 'Items & Pricing', icon: CurrencyDollarIcon },
    { id: 5, name: 'Contract Terms', icon: DocumentTextIcon },
    { id: 6, name: 'Contacts & Approval', icon: UserGroupIcon },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
      {popupError && (
        <div className="fixed top-6 right-6 z-60">
          <div className="flex items-start space-x-3 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg max-w-sm">
            <div className="flex-1">
              <div className="font-semibold">Error</div>
              <div className="text-sm mt-1">{popupError}</div>
            </div>
            <button onClick={() => setPopupError('')} className="text-white opacity-90 hover:opacity-100 ml-2">×</button>
          </div>
        </div>
      )}
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <DocumentTextIcon className="h-8 w-8" />
              <div>
                <h2 className="text-2xl font-bold">
                  {editData ? 'Edit Purchase Order' : 'New Purchase Order'}
                </h2>
                <p className="text-blue-100 text-sm mt-1">
                  {formData.po_number ? `PO No: ${formData.po_number}` : 'RAD-PRJ-PUR Template'}
                  {prReference && ` • From PR: ${prReference.pr_number}`}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-white hover:text-blue-200 transition-colors">
              <XCircleIcon className="h-7 w-7" />
            </button>
          </div>
          
          {autoSaving && (
            <div className="mt-3 flex items-center space-x-2 text-blue-100 text-sm">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Auto-saving draft...</span>
            </div>
          )}
        </div>

        {/* Section Navigation */}
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
          <div className="flex space-x-4 overflow-x-auto">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setCurrentSection(section.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  currentSection === section.id
                    ? 'bg-blue-100 text-blue-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                <section.icon className="h-5 w-5" />
                <span className="text-sm">{section.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="px-8 py-6 max-h-[600px] overflow-y-auto">
          
          {/* Section 1: Header & Seller */}
          {currentSection === 1 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Header & Seller Information</h3>
                  <p className="text-sm text-gray-500">Capture the purchase order header and supplier details needed for PO creation.</p>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">PO Number *</label>
                    <input
                      type="text"
                      value={formData.po_number}
                      disabled
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-900"
                      placeholder="Auto-generated"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">PO Date</label>
                    <input
                      type="date"
                      name="po_date"
                      value={formData.po_date}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Currency *</label>
                    <select
                      name="currency"
                      value={formData.currency}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="USD">USD</option>
                      <option value="AED">AED</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Vendor / Seller *</label>
                  <select
                    name="vendor"
                    value={formData.vendor}
                    onChange={handleVendorChange}
                    className={`mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 ${
                      errors.vendor ? 'border-red-500' : ''
                    }`}
                  >
                    <option value="">Select Vendor</option>
                    {Array.isArray(vendors) && vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name} ({vendor.vendor_code})
                      </option>
                    ))}
                  </select>
                  {errors.vendor && <p className="mt-1 text-xs text-red-600">{errors.vendor}</p>}

                  {selectedVendor && (
                    <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-gray-700">
                      <div className="font-semibold text-blue-700 mb-2">Selected vendor details</div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <span className="font-medium">Contact Person:</span> {selectedVendor.contact_person || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Email:</span> {selectedVendor.email || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Phone:</span> {selectedVendor.phone || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Country:</span> {selectedVendor.country || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Trade License:</span> {selectedVendor.trade_license_number || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">VAT Number:</span> {selectedVendor.vat_number || 'N/A'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Seller Reference</label>
                    <input
                      type="text"
                      name="seller_reference"
                      value={formData.seller_reference}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Attn: Mr. Abdul Muneem"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Quote Reference</label>
                    <input
                      type="text"
                      name="quote_ref"
                      value={formData.quote_ref}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="E-mail dt 27.12.2024"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">License No.</label>
                    <input
                      type="text"
                      name="seller_license_no"
                      value={formData.seller_license_no}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="CN-3362215"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Title / Description *</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    className={`mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 ${
                      errors.title ? 'border-red-500' : ''
                    }`}
                    placeholder="Value Engineering Services for STP & GTG Demolition Project"
                  />
                  {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Detailed Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={4}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Detailed scope of work..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Vendor Summary (included when sending to vendor) *</label>
                  <textarea
                    name="summary"
                    value={formData.summary}
                    onChange={handleChange}
                    rows={3}
                    className={`mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 ${errors.summary ? 'border-red-500' : ''}`}
                    placeholder="Short summary to appear in vendor notification..."
                  />
                  {errors.summary && <p className="mt-1 text-xs text-red-600">{errors.summary}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Seller Contact Person</label>
                    <input
                      type="text"
                      name="seller_contact_person"
                      value={formData.seller_contact_person}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Name of seller contact"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Seller Email</label>
                    <input
                      type="email"
                      name="seller_email"
                      value={formData.seller_email}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="seller@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Seller Phone</label>
                    <input
                      type="text"
                      name="seller_phone"
                      value={formData.seller_phone}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="+971 4 123 4567"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Seller Fax</label>
                    <input
                      type="text"
                      name="seller_fax"
                      value={formData.seller_fax}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="+971 4 765 4321"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Buyer & Payment */}
          {currentSection === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Buyer & Payment Information</h3>
                  <p className="text-sm text-gray-500">Enter the buyer billing and payment terms for this purchase order.</p>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Invoicing Attention</label>
                    <input
                      type="text"
                      name="invoicing_attn"
                      value={formData.invoicing_attn}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Company Fax</label>
                    <input
                      type="text"
                      name="company_fax"
                      value={formData.company_fax}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Procurement Manager</label>
                    <input
                      type="text"
                      name="buyer_reference_pm"
                      value={formData.buyer_reference_pm}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Ms.Richa Thomas - Procurement Manager"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Procurement Engineer</label>
                    <input
                      type="text"
                      name="buyer_reference_pe"
                      value={formData.buyer_reference_pe}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Ms.Sukanya Ravichandran"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Total Amount *</label>
                    <input
                      type="number"
                      step="0.01"
                      name="total_amount"
                      value={formData.total_amount}
                      onChange={handleChange}
                      className={`mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 ${
                        errors.total_amount ? 'border-red-500' : ''
                      }`}
                    />
                    {errors.total_amount && <p className="mt-1 text-xs text-red-600">{errors.total_amount}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">VAT %</label>
                    <input
                      type="number"
                      step="0.01"
                      name="vat_percentage"
                      value={formData.vat_percentage}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tax Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      name="tax_amount"
                      value={formData.tax_amount}
                      disabled
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Payment Terms *</label>
                    <input
                      type="text"
                      name="payment_terms"
                      value={formData.payment_terms}
                      onChange={handleChange}
                      className={`mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 ${
                        errors.payment_terms ? 'border-red-500' : ''
                      }`}
                    />
                    {errors.payment_terms && <p className="mt-1 text-xs text-red-600">{errors.payment_terms}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Payment Mode</label>
                    <select
                      name="payment_mode"
                      value={formData.payment_mode}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Letter of Credit">Letter of Credit</option>
                      <option value="Cash">Cash</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Delivery Terms</label>
                    <input
                      type="text"
                      name="delivery_terms"
                      value={formData.delivery_terms}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Shipment Marking</label>
                    <input
                      type="text"
                      name="marking"
                      value={formData.marking}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="RAD-PRJ-PUR-0014"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Payment Milestones</label>
                    <button
                      type="button"
                      onClick={addPaymentMilestone}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      + Add Milestone
                    </button>
                  </div>
                  
                  {Array.isArray(formData.payment_milestones) && formData.payment_milestones.map((milestone, index) => (
                    <div key={index} className="grid grid-cols-5 gap-2 mb-2">
                      <input
                        type="text"
                        value={milestone.milestone}
                        onChange={(e) => updatePaymentMilestone(index, 'milestone', e.target.value)}
                        placeholder="Draft Report"
                        className="col-span-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                      />
                      <input
                        type="number"
                        value={milestone.percentage}
                        onChange={(e) => updatePaymentMilestone(index, 'percentage', e.target.value)}
                        placeholder="%"
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                      />
                      <input
                        type="number"
                        value={milestone.amount}
                        onChange={(e) => updatePaymentMilestone(index, 'amount', e.target.value)}
                        placeholder="Amount"
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => removePaymentMilestone(index)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Project Details */}
          {currentSection === 3 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Project Details</h3>
                  <p className="text-sm text-gray-500">Enter project and contract details for this purchase order.</p>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Project</label>
                  <select
                    name="project"
                    value={formData.project}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">Select Project</option>
                    {Array.isArray(projects) && projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.project_number} - {project.project_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Project Number</label>
                    <input
                      type="text"
                      name="project_number"
                      value={formData.project_number}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="5900927"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">RAD Project No.</label>
                    <input
                      type="text"
                      name="rad_project_no"
                      value={formData.rad_project_no}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Agreement No.</label>
                    <input
                      type="text"
                      name="company_agreement_no"
                      value={formData.company_agreement_no}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="4700024202"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">End Client</label>
                    <input
                      type="text"
                      name="end_client"
                      value={formData.end_client}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="ADNOC Gas"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Project Manager</label>
                    <input
                      type="text"
                      name="project_manager"
                      value={formData.project_manager}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Contractor</label>
                    <input
                      type="text"
                      name="contractor"
                      value={formData.contractor}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Subcontractor</label>
                    <input
                      type="text"
                      name="subcontractor"
                      value={formData.subcontractor}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Start Date</label>
                    <input
                      type="date"
                      name="start_date"
                      value={formData.start_date}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">End Date</label>
                    <input
                      type="date"
                      name="end_date"
                      value={formData.end_date}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Expected Delivery</label>
                    <input
                      type="date"
                      name="expected_delivery"
                      value={formData.expected_delivery}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Items & Pricing */}
          {currentSection === 4 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Items & Pricing</h3>
                  <p className="text-sm text-gray-500">Add line items, apply discounts, and review subtotal, tax, and grand total.</p>
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
                >
                  + Add Item
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Line Code</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Item Description</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Specification / API/ASME Standard Tag</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Comment</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">UOM</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Unit Price</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Discount</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Total Price</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {Array.isArray(formData.items) && formData.items.length > 0 ? (
                      formData.items.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={item.line_code || ''}
                              onChange={(e) => updateItem(index, 'line_code', e.target.value)}
                              placeholder="e.g. 001"
                              className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateItem(index, 'description', e.target.value)}
                              placeholder="Description"
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={item.specification}
                              onChange={(e) => updateItem(index, 'specification', e.target.value)}
                              placeholder="API/ASME Standard Tag"
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={item.comment || ''}
                              onChange={(e) => updateItem(index, 'comment', e.target.value)}
                              placeholder="Line comment"
                              className="min-w-40 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                              className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm text-right focus:border-blue-500 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={item.uom}
                              onChange={(e) => updateItem(index, 'uom', e.target.value)}
                              placeholder="UOM"
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => updateItem(index, 'unit_price', e.target.value)}
                              className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm text-right focus:border-blue-500 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.discount}
                              onChange={(e) => updateItem(index, 'discount', e.target.value)}
                              className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm text-right focus:border-blue-500 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">
                            {calculateItemTotal(item).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="10" className="px-4 py-8 text-center text-sm text-gray-500">
                          No items added yet. Click “+ Add Item” to begin.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-sm text-gray-600">Pricing details are calculated automatically as you update quantities, unit prices, and discounts.</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Subtotal</span>
                      <span>${calculateSubtotal().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>VAT ({formData.vat_percentage}%)</span>
                      <span>${calculateTaxAmount(calculateSubtotal()).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Discount (line items only)</span>
                      <span>${(formData.items || []).reduce((sum, item) => sum + Number(item.discount || 0), 0).toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-3 flex justify-between text-base font-semibold text-gray-900">
                      <span>Grand Total</span>
                      <span>${calculateGrandTotal(calculateSubtotal(), calculateTaxAmount(calculateSubtotal())).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section 5: Contract Terms */}
          {currentSection === 5 && (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Contract Terms</h3>
                  <p className="text-sm text-gray-500">Add O&amp;G contract clauses, warranty and inspection requirements, and penalty terms.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 w-full md:w-auto">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Preset Template</label>
                    <select
                      name="terms_template"
                      value={formData.terms_template}
                      onChange={(e) => {
                        const templateKey = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          terms_template: templateKey,
                          terms_and_conditions: TERMS_TEMPLATES[templateKey] || '',
                        }));
                      }}
                      className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="standard">Standard Terms</option>
                      <option value="oilAndGas">O&amp;G Standard Terms</option>
                      <option value="custom">Custom Terms</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      terms_and_conditions: TERMS_TEMPLATES[prev.terms_template] || '',
                    }))}
                    className="inline-flex items-center justify-center rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                  >
                    Load Template
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Terms &amp; Conditions</label>
                  <textarea
                    name="terms_and_conditions"
                    value={formData.terms_and_conditions}
                    onChange={handleChange}
                    rows={8}
                    className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Enter detailed terms and conditions here..."
                  />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Warranty Period</label>
                    <input
                      type="text"
                      name="warranty_period"
                      value={formData.warranty_period}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="e.g. 12 months from acceptance"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Guarantee Period</label>
                    <input
                      type="text"
                      name="guarantee_period"
                      value={formData.guarantee_period}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                      placeholder="e.g. 18 months workmanship guarantee"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Inspection &amp; Testing Requirements</label>
                  <textarea
                    name="inspection_requirements"
                    value={formData.inspection_requirements}
                    onChange={handleChange}
                    rows={5}
                    className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Include third-party inspection, MTR, NDT, and test requirements here..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Liquidated Damages &amp; Penalty Clauses</label>
                  <textarea
                    name="liquidated_damages"
                    value={formData.liquidated_damages}
                    onChange={handleChange}
                    rows={5}
                    className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Specify liquidated damages, penalty terms, and delay charges here..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section 6: Contacts & Approval */}
          {currentSection === 6 && (
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Approval Routing Matrix</h3>
                    <p className="text-sm text-gray-500">Select the approvers for each review stage before final dispatch.</p>
                  </div>

                  <div className="grid gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Technical Approver</label>
                      <select
                        name="technical_approver"
                        value={formData.technical_approver}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        {APPROVER_OPTIONS.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Financial Approver</label>
                      <select
                        name="financial_approver"
                        value={formData.financial_approver}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        {APPROVER_OPTIONS.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Final Management Sign-off</label>
                      <select
                        name="management_approver"
                        value={formData.management_approver}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        {APPROVER_OPTIONS.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Final Approval Notes</h3>
                    <p className="text-sm text-gray-500">Use this field for any final instructions, exceptions, or handover comments from approvers.</p>
                  </div>
                  <textarea
                    name="final_approver_notes"
                    value={formData.final_approver_notes}
                    onChange={handleChange}
                    rows={8}
                    className="mt-4 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Final sign-off notes, approval comments, or routing remarks..."
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Approval Status Log</h3>
                    <p className="text-sm text-gray-500">Track the sign-off hierarchy, current status, and comments for each approval stage.</p>
                  </div>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Stage</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Approver</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Comments</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {formData.approval_log.map((entry, index) => (
                        <tr key={entry.stage}>
                          <td className="whitespace-nowrap px-4 py-3 text-gray-900">{entry.stage}</td>
                          <td className="px-4 py-3">
                            <select
                              value={entry.approver}
                              onChange={(e) => updateApprovalLog(index, 'approver', e.target.value)}
                              className="block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                            >
                              {APPROVER_OPTIONS.map(option => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={entry.status}
                              onChange={(e) => updateApprovalLog(index, 'status', e.target.value)}
                              className="block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                            >
                              {APPROVAL_STATUSES.map(status => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="date"
                              value={entry.date}
                              onChange={(e) => updateApprovalLog(index, 'date', e.target.value)}
                              className="block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={entry.comments}
                              onChange={(e) => updateApprovalLog(index, 'comments', e.target.value)}
                              placeholder="Optional comments"
                              className="block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* File Attachments */}
          <div className="mt-8 border-t pt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Attachments</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">Click to upload or drag and drop</p>
              </label>
            </div>
            
            {Array.isArray(files) && files.length > 0 && (
              <div className="mt-4 space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <PaperClipIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-700">{file.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* Footer Actions */}
        <div className="bg-gray-50 px-8 py-4 rounded-b-xl border-t flex items-center justify-between">
          <div className="flex space-x-2 text-sm text-gray-600">
            <button
              onClick={() => setCurrentSection(Math.max(1, currentSection - 1))}
              disabled={currentSection === 1}
              className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50"
            >
              ← Previous
            </button>
            <button
              onClick={() => setCurrentSection(Math.min(6, currentSection + 1))}
              disabled={currentSection === 6}
              className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50"
            >
              Next →
            </button>
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e, false)}
              disabled={submitLoading}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {submitLoading ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              disabled={submitLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {submitLoading ? 'Sending...' : 'Send to Vendor'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderForm;
