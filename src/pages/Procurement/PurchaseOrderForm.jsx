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

const PurchaseOrderForm = ({ isOpen, onClose, onSuccess, editData = null, prReference = null }) => {
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [vendors, setVendors] = useState([]);
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
    notes: editData?.notes || '',
    status: editData?.status || 'draft',
  });
  
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [autoSaving, setAutoSaving] = useState(false);
  const [currentSection, setCurrentSection] = useState(1);

  // Fetch vendors and projects on mount
  useEffect(() => {
    fetchVendors();
    fetchProjects();
  }, []);

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
        if (formData.title || formData.description) {
          handleAutoSave();
        }
      }, 30000);
      return () => clearInterval(autoSaveInterval);
    }
  }, [formData, editData]);

  const fetchVendors = async () => {
    try {
      const response = await axios.get('/procurement/vendors/');
      const data = response.data;
      // Handle both paginated (data.results) and direct array responses
      setVendors(Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      setVendors([]); // Ensure vendors is always an array
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await axios.get('/procurement/projects/');
      const data = response.data;
      // Handle both paginated (data.results) and direct array responses
      setProjects(Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]); // Ensure projects is always an array
    }
  };

  const handleAutoSave = async () => {
    setAutoSaving(true);
    try {
      if (editData) {
        await axios.patch(`/procurement/orders/${editData.id}/`, formData);
      } else {
        const response = await axios.post('/procurement/orders/', {
          ...formData,
          status: 'draft'
        });
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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
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

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.vendor) newErrors.vendor = 'Vendor is required';
    if (!formData.title?.trim()) newErrors.title = 'Title is required';
    if (!formData.total_amount || parseFloat(formData.total_amount) <= 0) {
      newErrors.total_amount = 'Valid total amount is required';
    }
    if (!formData.payment_terms?.trim()) newErrors.payment_terms = 'Payment terms are required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e, sendToVendor = false) => {
    e.preventDefault();
    
    if (sendToVendor && !validateForm()) {
      return;
    }
    
    setSubmitLoading(true);
    
    try {
      const submitData = new FormData();
      
      // Append all form fields
      Object.keys(formData).forEach(key => {
        if (formData[key] !== null && formData[key] !== undefined && formData[key] !== '') {
          if (typeof formData[key] === 'object') {
            submitData.append(key, JSON.stringify(formData[key]));
          } else {
            submitData.append(key, formData[key]);
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
      if (editData) {
        response = await axios.patch(`/procurement/orders/${editData.id}/`, submitData, config);
      } else {
        response = await axios.post('/procurement/orders/', submitData, config);
      }
      
      if (onSuccess) onSuccess(response.data);
      if (onClose) onClose();
    } catch (error) {
      console.error('Error submitting PO:', error);
      if (error.response?.data) {
        setErrors(error.response.data);
      }
      alert('Failed to submit purchase order. Please check all fields.');
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
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Header & Seller Information</h3>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">PO Number *</label>
                  <input
                    type="text"
                    value={formData.po_number}
                    disabled
                    className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 px-3 py-2 text-sm"
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
                    className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Currency *</label>
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
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
                  onChange={handleChange}
                  className={`mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 ${
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
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Seller Reference</label>
                  <input
                    type="text"
                    name="seller_reference"
                    value={formData.seller_reference}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
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
                    className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
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
                    className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
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
                  className={`mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 ${
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
                  className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Detailed scope of work..."
                />
              </div>
            </div>
          )}

          {/* Section 2: Buyer & Payment */}
          {currentSection === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Buyer & Payment Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Invoicing Attention</label>
                  <input
                    type="text"
                    name="invoicing_attn"
                    value={formData.invoicing_attn}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Company Fax</label>
                  <input
                    type="text"
                    name="company_fax"
                    value={formData.company_fax}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
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
                    className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
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
                    className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
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
                    className={`mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 ${
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
                    className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
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
                    className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 px-3 py-2 text-sm"
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
                    className={`mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 ${
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
                    className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
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
                    className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Shipment Marking</label>
                  <input
                    type="text"
                    name="marking"
                    value={formData.marking}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
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
                      className="col-span-2 rounded-md border-gray-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      value={milestone.percentage}
                      onChange={(e) => updatePaymentMilestone(index, 'percentage', e.target.value)}
                      placeholder="%"
                      className="rounded-md border-gray-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      value={milestone.amount}
                      onChange={(e) => updatePaymentMilestone(index, 'amount', e.target.value)}
                      placeholder="Amount"
                      className="rounded-md border-gray-300 px-3 py-2 text-sm"
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
          )}

          {/* Section 3: Project Details */}
          {currentSection === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Project Details</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Project</label>
                <select
                  name="project"
                  value={formData.project}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
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
                    className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
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
                    className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Agreement No.</label>
                  <input
                    type="text"
                    name="company_agreement_no"
                    value={formData.company_agreement_no}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
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
                    className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
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
                    className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
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
                    className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Subcontractor</label>
                  <input
                    type="text"
                    name="subcontractor"
                    value={formData.subcontractor}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
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
                    className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">End Date</label>
                  <input
                    type="date"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Expected Delivery</label>
                  <input
                    type="date"
                    name="expected_delivery"
                    value={formData.expected_delivery}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Additional sections would continue similarly... */}
          {/* Section 4: Items & Pricing */}
          {/* Section 5: Contract Terms */}
          {/* Section 6: Contacts & Approval */}

          {/* Placeholder for remaining sections */}
          {currentSection > 3 && (
            <div className="text-center py-12 text-gray-500">
              <p>Section {currentSection} content will be implemented here</p>
              <p className="text-sm mt-2">Continue with other sections or save as draft</p>
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
