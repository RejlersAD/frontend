/**
 * Purchase Requisition Form Component
 * Aligned with RAD-OM-PRC-0001 FRM -1 Rev 0 template
 * 
 * Features:
 * - All 23 fields from company template
 * - Multi-file upload to S3
 * - Auto-save to draft
 * - Form validation
 * - Modern, professional UI
 */

import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api.service';
import {
  DocumentTextIcon,
  PaperClipIcon,
  CheckCircleIcon,
  XCircleIcon,
  CloudArrowUpIcon,
  InformationCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

const PurchaseRequisitionForm = ({ isOpen, onClose, onSuccess, editData = null }) => {
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Form state - all 23 fields from PDF template
  const [formData, setFormData] = useState({
    // Header Section (Fields 1-3)
    pr_number: editData?.pr_number || '', // Auto-generated
    issued_date: editData?.issued_date || new Date().toISOString().split('T')[0],
    
    // Supplier Section (Fields 4-5)
    supplier_name: editData?.supplier_name || '',
    supplier_business_id: editData?.supplier_business_id || '',
    
    // Project/Product Section (Fields 6-7)
    product_service: editData?.product_service || '',
    project_department: editData?.project_department || '',
    
    // Description Section (Field 8)
    description_reason: editData?.description_reason || '',
    
    // Preferred Supplier Section (Field 9)
    preferred_supplier_if_any: editData?.preferred_supplier_if_any || '',
    
    // Pricing Section (Fields 10-13)
    price_description: editData?.price_description || '',
    total_price: editData?.total_price || '',
    currency: editData?.currency || 'USD',
    price_remarks: editData?.price_remarks || '',
    net_total_excl_vat: editData?.net_total_excl_vat || '',
    
    // Reference Section (Field 14)
    po_number_reference: editData?.po_number_reference || '',
    
    // Purchase Recommendation Section (Field 15) - RENAMED from special_notes
    purchase_recommendation: editData?.purchase_recommendation || editData?.special_notes || '',
    
    // Vendor Integration
    vendor: editData?.vendor || null,
    vendor_selection_reason: editData?.vendor_selection_reason || '',
    
    // Dynamic Approval Workflow
    approval_workflow_config: editData?.approval_workflow_config || [],
    
    // Price Remarks Data (Advanced)
    price_remarks_data: editData?.price_remarks_data || {},
    
    // Additional fields
    requisition_type: editData?.requisition_type || 'project',
    priority: editData?.priority || 'normal',
    status: editData?.status || 'draft',
  });
  
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [autoSaving, setAutoSaving] = useState(false);
  
  // New state for dynamic features
  const [vendors, setVendors] = useState([]);
  const [vendorRecommendations, setVendorRecommendations] = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  
  // Approval workflow state
  const [projectManagers, setProjectManagers] = useState([]);
  const [engineeringManagers, setEngineeringManagers] = useState([]);
  const [managerProjects, setManagerProjects] = useState([]);
  const [vpOperations, setVpOperations] = useState([]);
  const [selectedApprovers, setSelectedApprovers] = useState({
    project_manager: null,
    engineering_manager: null,
    manager_projects: null,
    vp_operations: null,
  });
  
  // Price Remarks Advanced Fields
  const [showAdvancedPricing, setShowAdvancedPricing] = useState(false);
  
  // Autocomplete suggestions state
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [projectSuggestions, setProjectSuggestions] = useState([]);
  const [supplierSuggestions, setSupplierSuggestions] = useState([]);
  const [poNumberSuggestions, setPoNumberSuggestions] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [showPoDropdown, setShowPoDropdown] = useState(false);

  // Auto-save draft every 30 seconds
  useEffect(() => {
    if (!editData) {
      const autoSaveInterval = setInterval(() => {
        if (formData.product_service || formData.description_reason) {
          handleAutoSave();
        }
      }, 30000); // 30 seconds

      return () => clearInterval(autoSaveInterval);
    }
  }, [formData, editData]);
  
  // Fetch vendors on mount
  useEffect(() => {
    fetchVendors();
    fetchApprovers();
  }, []);

  // Auto-calculate net total when total price changes
  useEffect(() => {
    if (formData.total_price) {
      // Assume VAT = 0 for now (can be made configurable)
      setFormData(prev => ({
        ...prev,
        net_total_excl_vat: prev.total_price
      }));
    }
  }, [formData.total_price]);
  
  const fetchVendors = async () => {
    try {
      setLoadingVendors(true);
      const response = await apiClient.get('/procurement/vendors/', {
        params: { page_size: 1000, status: 'active' }
      });
      const vendorData = response.data.results || response.data || [];
      // Ensure vendorData is always an array
      setVendors(Array.isArray(vendorData) ? vendorData : []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      setVendors([]); // Set empty array on error
    } finally {
      setLoadingVendors(false);
    }
  };
  
  const fetchApprovers = async () => {
    try {
      // Fetch approvers for each role
      const [pmResponse, emResponse, mpResponse, vpResponse] = await Promise.all([
        apiClient.get('/procurement/requisitions/get_approvers/', { params: { role: 'project_manager' } }),
        apiClient.get('/procurement/requisitions/get_approvers/', { params: { role: 'engineering_manager' } }),
        apiClient.get('/procurement/requisitions/get_approvers/', { params: { role: 'manager_projects' } }),
        apiClient.get('/procurement/requisitions/get_approvers/', { params: { role: 'vp_operations' } }),
      ]);
      
      setProjectManagers(pmResponse.data.users || []);
      setEngineeringManagers(emResponse.data.users || []);
      setManagerProjects(mpResponse.data.users || []);
      setVpOperations(vpResponse.data.users || []);
    } catch (error) {
      console.error('Error fetching approvers:', error);
    }
  };
  
  const getVendorRecommendations = async () => {
    if (!formData.product_service && !formData.description_reason) {
      alert('Please fill in product/service description first');
      return;
    }
    
    try {
      // Create a draft PR first if doesn't exist
      if (!editData) {
        await handleAutoSave();
      }
      
      const prId = editData?.id || formData.id;
      if (prId) {
        const response = await apiClient.post(`/procurement/requisitions/${prId}/recommend_vendors/`);
        setVendorRecommendations(response.data.recommendations || []);
      }
    } catch (error) {
      console.error('Error getting vendor recommendations:', error);
    }
  };
  
  // Autocomplete fetch functions
  const fetchProductSuggestions = async (query) => {
    if (!query || query.length < 2) {
      setProductSuggestions([]);
      return;
    }
    
    try {
      const response = await apiClient.get('/procurement/requisitions/get_product_services/', {
        params: { q: query, limit: 20 }
      });
      setProductSuggestions(response.data.suggestions || []);
    } catch (error) {
      console.error('Error fetching product suggestions:', error);
    }
  };
  
  const fetchProjectSuggestions = async (query) => {
    if (!query || query.length < 2) {
      setProjectSuggestions([]);
      return;
    }
    
    try {
      const response = await apiClient.get('/procurement/requisitions/get_projects_departments/', {
        params: { q: query, limit: 20 }
      });
      setProjectSuggestions(response.data.suggestions || []);
    } catch (error) {
      console.error('Error fetching project suggestions:', error);
    }
  };
  
  const fetchSupplierSuggestions = async (query) => {
    if (!query || query.length < 2) {
      setSupplierSuggestions([]);
      return;
    }
    
    try {
      const response = await apiClient.get('/procurement/requisitions/get_suppliers/', {
        params: { q: query, limit: 20 }
      });
      setSupplierSuggestions(response.data.suggestions || []);
    } catch (error) {
      console.error('Error fetching supplier suggestions:', error);
    }
  };
  
  const fetchPoNumberSuggestions = async (query) => {
    try {
      const response = await apiClient.get('/procurement/requisitions/get_po_numbers/', {
        params: { q: query || '', limit: 20 }
      });
      setPoNumberSuggestions(response.data.suggestions || []);
    } catch (error) {
      console.error('Error fetching PO number suggestions:', error);
    }
  };

  // Auto-save draft every 30 seconds
  useEffect(() => {
    if (!editData) {
      const autoSaveInterval = setInterval(() => {
        if (formData.product_service || formData.description_reason) {
          handleAutoSave();
        }
      }, 30000); // 30 seconds

      return () => clearInterval(autoSaveInterval);
    }
  }, [formData, editData]);

  // Auto-calculate net total when total price changes
  useEffect(() => {
    if (formData.total_price) {
      // Assume VAT = 0 for now (can be made configurable)
      setFormData(prev => ({
        ...prev,
        net_total_excl_vat: prev.total_price
      }));
    }
  }, [formData.total_price]);

  const handleAutoSave = async () => {
    setAutoSaving(true);
    try {
      if (editData) {
        // Update existing draft
        await apiClient.patch(`/procurement/requisitions/${editData.id}/`, formData);
      } else {
        // Create new draft
        const response = await apiClient.post('/procurement/requisitions/', {
          ...formData,
          status: 'draft'
        });
        // Update form with returned PR number
        if (response.data.pr_number) {
          setFormData(prev => ({ ...prev, pr_number: response.data.pr_number }));
        }
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setAutoSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field
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

  const validateForm = () => {
    const newErrors = {};
    
    // Required fields validation
    if (!formData.product_service?.trim()) {
      newErrors.product_service = 'Product/Service description is required';
    }
    
    if (!formData.project_department?.trim()) {
      newErrors.project_department = 'Project/Department is required';
    }
    
    if (!formData.description_reason?.trim()) {
      newErrors.description_reason = 'Description and reason is required';
    }
    
    if (!formData.price_description?.trim()) {
      newErrors.price_description = 'Price description is required';
    }
    
    if (!formData.total_price || parseFloat(formData.total_price) <= 0) {
      newErrors.total_price = 'Valid total price is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e, submitForApproval = false) => {
    e.preventDefault();
    
    if (submitForApproval && !validateForm()) {
      return;
    }
    
    setSubmitLoading(true);
    
    try {
      const submitData = new FormData();
      
      // Build approval workflow from selected approvers
      const approvalWorkflow = [];
      let step = 1;
      
      if (selectedApprovers.project_manager) {
        const user = projectManagers.find(u => u.id === selectedApprovers.project_manager);
        approvalWorkflow.push({
          step: step++,
          role: 'Project Manager',
          user_id: selectedApprovers.project_manager,
          user_name: user?.full_name || '',
          status: 'pending',
          approved_at: null
        });
      }
      
      if (selectedApprovers.engineering_manager) {
        const user = engineeringManagers.find(u => u.id === selectedApprovers.engineering_manager);
        approvalWorkflow.push({
          step: step++,
          role: 'Engineering Manager',
          user_id: selectedApprovers.engineering_manager,
          user_name: user?.full_name || '',
          status: 'pending',
          approved_at: null
        });
      }
      
      if (selectedApprovers.manager_projects) {
        const user = managerProjects.find(u => u.id === selectedApprovers.manager_projects);
        approvalWorkflow.push({
          step: step++,
          role: 'Manager of Projects',
          user_id: selectedApprovers.manager_projects,
          user_name: user?.full_name || '',
          status: 'pending',
          approved_at: null
        });
      }
      
      if (selectedApprovers.vp_operations) {
        const user = vpOperations.find(u => u.id === selectedApprovers.vp_operations);
        approvalWorkflow.push({
          step: step++,
          role: 'Vice President of Operations',
          user_id: selectedApprovers.vp_operations,
          user_name: user?.full_name || '',
          status: 'pending',
          approved_at: null
        });
      }
      
      // Add approval workflow to form data
      const formDataWithWorkflow = {
        ...formData,
        approval_workflow_config: approvalWorkflow
      };
      
      // Append all form fields
      Object.keys(formDataWithWorkflow).forEach(key => {
        if (formDataWithWorkflow[key] !== null && formDataWithWorkflow[key] !== undefined && formDataWithWorkflow[key] !== '') {
          // Handle JSON fields
          if (typeof formDataWithWorkflow[key] === 'object') {
            submitData.append(key, JSON.stringify(formDataWithWorkflow[key]));
          } else {
            submitData.append(key, formDataWithWorkflow[key]);
          }
        }
      });
      
      // Set status based on action
      submitData.set('status', submitForApproval ? 'submitted' : 'draft');
      
      // Append files
      files.forEach((file) => {
        submitData.append('attachments_files', file);
      });
      
      const config = {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
      };
      
      let response;
      if (editData) {
        // Update existing PR
        response = await apiClient.patch(`/procurement/requisitions/${editData.id}/`, submitData, config);
        
        // If submitting for approval, call submit endpoint
        if (submitForApproval && response.data.status === 'draft') {
          response = await apiClient.post(`/procurement/requisitions/${editData.id}/submit/`);
        }
      } else {
        // Create new PR
        response = await apiClient.post('/procurement/requisitions/', submitData, config);
        
        // If submitting for approval, call submit endpoint
        if (submitForApproval && response.data.id) {
          response = await apiClient.post(`/procurement/requisitions/${response.data.id}/submit/`);
        }
      }
      
      // Success
      if (onSuccess) {
        onSuccess(response.data);
      }
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error submitting PR:', error);
      if (error.response?.data) {
        setErrors(error.response.data);
      }
      alert(submitForApproval ? 
        'Failed to submit requisition. Please check all required fields.' :
        'Failed to save draft. Please try again.'
      );
    } finally {
      setSubmitLoading(false);
      setUploadProgress(0);
    }
  };

  // Don't render if not open - check AFTER all hooks
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 py-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <DocumentTextIcon className="h-8 w-8" />
              <div>
                <h2 className="text-2xl font-bold">
                  {editData ? 'Edit Purchase Requisition' : 'New Purchase Requisition'}
                </h2>
                <p className="text-purple-100 text-sm mt-1">
                  RAD-OM-PRC-0001 FRM -1 Rev 0
                  {formData.pr_number && ` • PR No: ${formData.pr_number}`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-purple-200 transition-colors"
            >
              <XCircleIcon className="h-7 w-7" />
            </button>
          </div>
          
          {autoSaving && (
            <div className="mt-3 flex items-center space-x-2 text-purple-100 text-sm">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Auto-saving draft...</span>
            </div>
          )}
        </div>

        {/* Form Content */}
        <form onSubmit={(e) => handleSubmit(e, true)} className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
          {/* Header Section */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="bg-purple-100 text-purple-700 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">1</span>
              Header Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PR Number
                </label>
                <input
                  type="text"
                  name="pr_number"
                  value={formData.pr_number}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  placeholder="Auto-generated"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Issued Date
                </label>
                <input
                  type="date"
                  name="issued_date"
                  value={formData.issued_date}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
          </div>

          {/* Supplier Section */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="bg-purple-100 text-purple-700 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">2</span>
              Supplier Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supplier Name
                  <span className="ml-2 text-xs text-gray-500">(Auto-suggests from database)</span>
                </label>
                <input
                  type="text"
                  name="supplier_name"
                  value={formData.supplier_name}
                  onChange={(e) => {
                    handleChange(e);
                    fetchSupplierSuggestions(e.target.value);
                    setShowSupplierDropdown(true);
                  }}
                  onFocus={() => {
                    if (formData.supplier_name) {
                      fetchSupplierSuggestions(formData.supplier_name);
                    }
                    setShowSupplierDropdown(true);
                  }}
                  onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 200)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Start typing to see suggestions..."
                />
                {showSupplierDropdown && supplierSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {supplierSuggestions.map((supplier, index) => (
                      <div
                        key={index}
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            supplier_name: supplier.supplier_name,
                            supplier_business_id: supplier.supplier_business_id || ''
                          }));
                          setShowSupplierDropdown(false);
                        }}
                        className="px-4 py-3 hover:bg-purple-50 cursor-pointer border-b border-gray-100 last:border-0"
                      >
                        <div className="font-medium text-gray-900">{supplier.supplier_name}</div>
                        {supplier.supplier_business_id && (
                          <div className="text-sm text-gray-600">ID: {supplier.supplier_business_id}</div>
                        )}
                        {supplier.rating && (
                          <div className="text-xs text-yellow-600">★ {supplier.rating}/5</div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          {supplier.source === 'master' ? '📁 Vendor Database' : '📝 Historical Data'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supplier Business ID No
                  <span className="ml-2 text-xs text-gray-500">(Auto-filled)</span>
                </label>
                <input
                  type="text"
                  name="supplier_business_id"
                  value={formData.supplier_business_id}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-gray-50"
                  placeholder="Auto-filled from supplier selection"
                />
              </div>
            </div>
          </div>

          {/* Project/Product Section */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="bg-purple-100 text-purple-700 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">3</span>
              Project & Product Details
            </h3>
            <div className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product/Service <span className="text-red-500">*</span>
                  <span className="ml-2 text-xs text-gray-500">(Auto-suggests from past PRs)</span>
                </label>
                <textarea
                  name="product_service"
                  value={formData.product_service}
                  onChange={(e) => {
                    handleChange(e);
                    fetchProductSuggestions(e.target.value);
                    setShowProductDropdown(true);
                  }}
                  onFocus={() => {
                    if (formData.product_service) {
                      fetchProductSuggestions(formData.product_service);
                    }
                    setShowProductDropdown(true);
                  }}
                  onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                  rows={2}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    errors.product_service ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Start typing... e.g., Value Engineering Services"
                />
                {showProductDropdown && productSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {productSuggestions.map((product, index) => (
                      <div
                        key={index}
                        onClick={() => {
                          setFormData(prev => ({ ...prev, product_service: product }));
                          setShowProductDropdown(false);
                        }}
                        className="px-4 py-2 hover:bg-purple-50 cursor-pointer border-b border-gray-100 last:border-0 text-sm"
                      >
                        {product}
                      </div>
                    ))}
                  </div>
                )}
                {errors.product_service && (
                  <p className="mt-1 text-sm text-red-600">{errors.product_service}</p>
                )}
              </div>
              
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project/Department <span className="text-red-500">*</span>
                  <span className="ml-2 text-xs text-gray-500">(Auto-suggests from projects)</span>
                </label>
                <textarea
                  name="project_department"
                  value={formData.project_department}
                  onChange={(e) => {
                    handleChange(e);
                    fetchProjectSuggestions(e.target.value);
                    setShowProjectDropdown(true);
                  }}
                  onFocus={() => {
                    if (formData.project_department) {
                      fetchProjectSuggestions(formData.project_department);
                    }
                    setShowProjectDropdown(true);
                  }}
                  onBlur={() => setTimeout(() => setShowProjectDropdown(false), 200)}
                  rows={3}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    errors.project_department ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Start typing to see project suggestions..."
                />
                {showProjectDropdown && projectSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {projectSuggestions.map((project, index) => (
                      <div
                        key={index}
                        onClick={() => {
                          setFormData(prev => ({ ...prev, project_department: project.value }));
                          setShowProjectDropdown(false);
                        }}
                        className="px-4 py-3 hover:bg-purple-50 cursor-pointer border-b border-gray-100 last:border-0"
                      >
                        <div className="font-medium text-gray-900 text-sm">{project.label}</div>
                        {project.department && (
                          <div className="text-xs text-gray-600 mt-1">Dept: {project.department}</div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          {project.source === 'master' ? '📁 Project Database' : '📝 Historical Data'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {errors.project_department && (
                  <p className="mt-1 text-sm text-red-600">{errors.project_department}</p>
                )}
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="bg-purple-100 text-purple-700 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">4</span>
              Description and Reason
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description and Reason for Purchase <span className="text-red-500">*</span>
              </label>
              <textarea
                name="description_reason"
                value={formData.description_reason}
                onChange={handleChange}
                rows={4}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                  errors.description_reason ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Value Engineering Services -Package 1 &2 for 5900927 project"
              />
              {errors.description_reason && (
                <p className="mt-1 text-sm text-red-600">{errors.description_reason}</p>
              )}
            </div>
          </div>

          {/* Preferred Supplier Section */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="bg-purple-100 text-purple-700 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">5</span>
              Vendor Selection
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Vendor from Database
                </label>
                <div className="flex space-x-2">
                  <select
                    name="vendor"
                    value={formData.vendor || ''}
                    onChange={(e) => {
                      const vendorId = e.target.value;
                      const selectedVendor = vendors.find(v => v.id === vendorId);
                      setFormData(prev => ({
                        ...prev,
                        vendor: vendorId,
                        supplier_name: selectedVendor?.name || '',
                        supplier_business_id: selectedVendor?.trade_license_number || '',
                      }));
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">-- Select Vendor --</option>
                    {Array.isArray(vendors) && vendors.map(vendor => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name} ({vendor.vendor_code}) - Rating: {vendor.rating || 'N/A'}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={getVendorRecommendations}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                  >
                    <SparklesIcon className="h-5 w-5" />
                    <span>AI Recommend</span>
                  </button>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Select from vendor master database or get AI-powered recommendations
                </p>
              </div>
              
              {vendorRecommendations.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-900 mb-3">AI Vendor Recommendations</h4>
                  <div className="space-y-2">
                    {vendorRecommendations.map((rec, idx) => (
                      <div key={idx} className="bg-white p-3 rounded border border-blue-100 flex justify-between items-center">
                        <div>
                          <p className="font-medium text-gray-900">{rec.vendor_name}</p>
                          <p className="text-xs text-gray-600">
                            Score: {rec.score} | {rec.reasons.join(' • ')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              vendor: rec.vendor_id,
                              supplier_name: rec.vendor_name,
                              vendor_selection_reason: `AI recommended (score: ${rec.score}): ${rec.reasons.join(', ')}`,
                            }));
                          }}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                          Select
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preferred Supplier (if any)
                </label>
                <input
                  type="text"
                  name="preferred_supplier_if_any"
                  value={formData.preferred_supplier_if_any}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Velimor Middle East Consultancy LLC"
                />
              </div>
              
              {formData.vendor_selection_reason && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vendor Selection Reason
                  </label>
                  <textarea
                    name="vendor_selection_reason"
                    value={formData.vendor_selection_reason}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Reason for selecting this vendor..."
                  />
                </div>
              )}
            </div>
          </div>

          {/* Pricing Section */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="bg-purple-100 text-purple-700 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">6</span>
              Pricing Details
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="price_description"
                  value={formData.price_description}
                  onChange={handleChange}
                  rows={2}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    errors.price_description ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Value Engineering Services -Package 1 &2 for 5900927 project"
                />
                {errors.price_description && (
                  <p className="mt-1 text-sm text-red-600">{errors.price_description}</p>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Currency
                  </label>
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="USD">USD</option>
                    <option value="AED">AED</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="SAR">SAR</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Price <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="total_price"
                    value={formData.total_price}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                      errors.total_price ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="4000.00"
                  />
                  {errors.total_price && (
                    <p className="mt-1 text-sm text-red-600">{errors.total_price}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Net Total (excl VAT)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="net_total_excl_vat"
                    value={formData.net_total_excl_vat}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-gray-50"
                    placeholder="4000.00"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price Remarks
                </label>
                <textarea
                  name="price_remarks"
                  value={formData.price_remarks}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Included in HSE budget"
                />
              </div>
              
              {/* Advanced Price Remarks */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedPricing(!showAdvancedPricing)}
                  className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center space-x-1"
                >
                  <SparklesIcon className="h-4 w-4" />
                  <span>{showAdvancedPricing ? 'Hide' : 'Show'} Advanced Pricing Details</span>
                </button>
              </div>
              
              {showAdvancedPricing && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
                  <h4 className="text-sm font-semibold text-gray-900">Advanced Pricing Information</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Budget Allocation
                      </label>
                      <input
                        type="text"
                        value={formData.price_remarks_data?.budget_allocation || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          price_remarks_data: {
                            ...prev.price_remarks_data,
                            budget_allocation: e.target.value
                          }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="e.g., HSE Budget"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cost Center
                      </label>
                      <input
                        type="text"
                        value={formData.price_remarks_data?.cost_center || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          price_remarks_data: {
                            ...prev.price_remarks_data,
                            cost_center: e.target.value
                          }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="e.g., CC-001"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Terms
                      </label>
                      <input
                        type="text"
                        value={formData.price_remarks_data?.payment_terms || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          price_remarks_data: {
                            ...prev.price_remarks_data,
                            payment_terms: e.target.value
                          }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="e.g., Net 45 days"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Discount %
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.price_remarks_data?.discount_percentage || ''}
                        onChange={(e) => {
                          const discount = parseFloat(e.target.value) || 0;
                          const totalPrice = parseFloat(formData.total_price) || 0;
                          const discountAmount = (totalPrice * discount) / 100;
                          
                          setFormData(prev => ({
                            ...prev,
                            price_remarks_data: {
                              ...prev.price_remarks_data,
                              discount_percentage: discount,
                              discount_amount: discountAmount.toFixed(2)
                            }
                          }));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Dynamic Approval Workflow Section */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="bg-purple-100 text-purple-700 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">9</span>
              Approval Workflow
            </h3>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Select approvers for each tier. The workflow will follow the order you configure.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Manager
                  </label>
                  <select
                    value={selectedApprovers.project_manager || ''}
                    onChange={(e) => setSelectedApprovers(prev => ({
                      ...prev,
                      project_manager: e.target.value
                    }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">-- Select Project Manager --</option>
                    {projectManagers.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.job_title_match ? '★ ' : ''}{user.full_name}{user.job_title ? ` - ${user.job_title}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Engineering Manager
                  </label>
                  <select
                    value={selectedApprovers.engineering_manager || ''}
                    onChange={(e) => setSelectedApprovers(prev => ({
                      ...prev,
                      engineering_manager: e.target.value
                    }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">-- Select Engineering Manager --</option>
                    {engineeringManagers.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.job_title_match ? '★ ' : ''}{user.full_name}{user.job_title ? ` - ${user.job_title}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Manager of Projects
                  </label>
                  <select
                    value={selectedApprovers.manager_projects || ''}
                    onChange={(e) => setSelectedApprovers(prev => ({
                      ...prev,
                      manager_projects: e.target.value
                    }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">-- Select Manager of Projects --</option>
                    {managerProjects.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.job_title_match ? '★ ' : ''}{user.full_name}{user.job_title ? ` - ${user.job_title}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vice President of Operations
                  </label>
                  <select
                    value={selectedApprovers.vp_operations || ''}
                    onChange={(e) => setSelectedApprovers(prev => ({
                      ...prev,
                      vp_operations: e.target.value
                    }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">-- Select VP Operations --</option>
                    {vpOperations.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.job_title_match ? '★ ' : ''}{user.full_name}{user.job_title ? ` - ${user.job_title}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  <strong>Note:</strong> The approval workflow will be built based on the approvers you select. 
                  Empty fields will be skipped automatically.
                </p>
              </div>
            </div>
          </div>

          {/* Reference Section */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="bg-purple-100 text-purple-700 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">7</span>
              Reference
            </h3>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PO Number (if applicable)
                <span className="ml-2 text-xs text-gray-500">(Auto-suggests from existing POs)</span>
              </label>
              <input
                type="text"
                name="po_number_reference"
                value={formData.po_number_reference}
                onChange={(e) => {
                  handleChange(e);
                  fetchPoNumberSuggestions(e.target.value);
                  setShowPoDropdown(true);
                }}
                onFocus={() => {
                  fetchPoNumberSuggestions(formData.po_number_reference);
                  setShowPoDropdown(true);
                }}
                onBlur={() => setTimeout(() => setShowPoDropdown(false), 200)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Start typing PO number..."
              />
              {showPoDropdown && poNumberSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {poNumberSuggestions.map((po, index) => (
                    <div
                      key={index}
                      onClick={() => {
                        setFormData(prev => ({ ...prev, po_number_reference: po.po_number }));
                        setShowPoDropdown(false);
                      }}
                      className="px-4 py-3 hover:bg-purple-50 cursor-pointer border-b border-gray-100 last:border-0"
                    >
                      <div className="font-medium text-gray-900">{po.po_number}</div>
                      {po.supplier_name && (
                        <div className="text-sm text-gray-600">Supplier: {po.supplier_name}</div>
                      )}
                      {po.total_amount && (
                        <div className="text-sm text-green-600">
                          {po.currency} {parseFloat(po.total_amount).toLocaleString()}
                        </div>
                      )}
                      {po.status && (
                        <div className="text-xs text-gray-500 mt-1">
                          Status: <span className="capitalize">{po.status.replace('_', ' ')}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Special Notes Section */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="bg-purple-100 text-purple-700 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">8</span>
              Purchase Recommendation
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Purchase Recommendation (if any)
              </label>
              <textarea
                name="purchase_recommendation"
                value={formData.purchase_recommendation}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Any special requirements or notes..."
              />
            </div>
          </div>

          {/* File Attachments Section */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="bg-purple-100 text-purple-700 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">10</span>
              Attachments (Multiple Files Supported)
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <CloudArrowUpIcon className="h-10 w-10 text-gray-400 mb-2" />
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">PDF, DOC, DOCX, XLS, XLSX, Images (MAX. 10MB each)</p>
                    <p className="text-xs text-purple-600 font-medium mt-1">Stored securely in AWS S3</p>
                  </div>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  />
                </label>
              </div>
              
              {files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Selected Files:</p>
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <PaperClipIcon className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{file.name}</p>
                          <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-red-500 hover:text-red-700 transition-colors"
                      >
                        <XCircleIcon className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              )}
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
            <InformationCircleIcon className="h-6 w-6 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Approval Workflow</p>
              <p>After submission, this requisition will be sent to the Project Manager for approval, followed by VP Operations approval before conversion to a Purchase Order.</p>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="bg-gray-50 px-8 py-5 rounded-b-xl border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            <span className="text-red-500">*</span> Required fields
          </div>
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e, false)}
              disabled={submitLoading}
              className="px-6 py-2.5 border border-purple-300 rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors font-medium disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              disabled={submitLoading}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all font-medium disabled:opacity-50 shadow-lg flex items-center space-x-2"
            >
              {submitLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-5 w-5" />
                  <span>Submit for Approval</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseRequisitionForm;

