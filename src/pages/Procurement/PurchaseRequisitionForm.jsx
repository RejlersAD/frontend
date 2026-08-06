/**
 * Purchase Requisition Form Component
 * Aligned with RAD-OM-PRC-0001 FRM -1 Rev 0 template
 * 
 * Features:
 * - All 23 fields from company template
 * - Multi-file upload to S3
 * - Auto-save to draft
 * - Form validation
 * - Modern, responsive UI with corrected section flow
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import apiClient from '../../services/api.service';
import {
  DocumentTextIcon,
  PaperClipIcon,
  CheckCircleIcon,
  XCircleIcon,
  CloudArrowUpIcon,
  InformationCircleIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 10;
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg'
]);

const newLineItem = () => ({
  description: '',
  quantity: '1',
  unit: 'EA',
  unit_price: '',
  total: '0.00',
});

const buildInitialFormData = (editData) => ({
  pr_number: editData?.pr_number || '',
  issued_date: editData?.issued_date || new Date().toISOString().split('T')[0],
  supplier_name: editData?.supplier_name || '',
  supplier_business_id: editData?.supplier_business_id || '',
  product_service: editData?.product_service || '',
  project_department: editData?.project_department || '',
  description_reason: editData?.description_reason || '',
  preferred_supplier_if_any: editData?.preferred_supplier_if_any || '',
  price_description: editData?.price_description || '',
  total_price: editData?.total_price || '',
  currency: editData?.currency || 'USD',
  price_remarks: editData?.price_remarks || '',
  net_total_excl_vat: editData?.net_total_excl_vat || '',
  po_number_reference: editData?.po_number_reference || '',
  purchase_recommendation: editData?.purchase_recommendation || editData?.special_notes || '',
  vendor: editData?.vendor || null,
  vendor_selection_reason: editData?.vendor_selection_reason || '',
  approval_workflow_config: editData?.approval_workflow_config || [],
  price_remarks_data: editData?.price_remarks_data || {},
  items: Array.isArray(editData?.items) ? editData.items : [],
  requisition_type: editData?.requisition_type || 'project',
  priority: editData?.priority || 'normal',
});

const selectedApproversFromWorkflow = (workflow = []) => {
  const selection = {
    project_manager: null,
    engineering_manager: null,
    manager_projects: null,
    vp_operations: null,
  };

  workflow.forEach((stage) => {
    const role = `${stage?.role || ''} ${stage?.stage || ''}`.toLowerCase();
    const userId = stage?.user_id || stage?.approver_id || null;
    if (role.includes('engineering manager')) selection.engineering_manager = userId;
    else if (role.includes('manager of projects') || role.includes('projects manager')) selection.manager_projects = userId;
    else if (role.includes('vice president') || role.includes('vp operations') || role.includes('procurement manager')) selection.vp_operations = userId;
    else if (role.includes('project manager') || role.includes('technical review')) selection.project_manager = userId;
  });

  return selection;
};

const PurchaseRequisitionForm = ({ isOpen, onClose, onSuccess, editData = null }) => {
  const [submitLoading, setSubmitLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Form state - all 23 fields from PDF template
  const [formData, setFormData] = useState(() => buildInitialFormData(editData));
  
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [autoSaving, setAutoSaving] = useState(false);
  const draftIdRef = useRef(editData?.id || null);
  const autoSaveInFlightRef = useRef(null);
  const formDataRef = useRef(formData);
  
  // New state for dynamic features
  const [vendors, setVendors] = useState([]);
  const [vendorRecommendations, setVendorRecommendations] = useState([]);
  const [, setLoadingVendors] = useState(false);
  
  // Approval workflow state
  const [projectManagers, setProjectManagers] = useState([]);
  const [engineeringManagers, setEngineeringManagers] = useState([]);
  const [managerProjects, setManagerProjects] = useState([]);
  const [vpOperations, setVpOperations] = useState([]);
  const [loadingApprovers, setLoadingApprovers] = useState(false);
  const [approverLoadError, setApproverLoadError] = useState('');
  const [selectedApprovers, setSelectedApprovers] = useState({
    project_manager: null,
    engineering_manager: null,
    manager_projects: null,
    vp_operations: null,
  });

  useEffect(() => {
    if (!isOpen) return;

    const initialData = buildInitialFormData(editData);
    setFormData(initialData);
    formDataRef.current = initialData;
    draftIdRef.current = editData?.id || null;
    autoSaveInFlightRef.current = null;
    setSelectedApprovers(selectedApproversFromWorkflow(editData?.approval_workflow_config || []));
    setFiles([]);
    setErrors({});
    setUploadProgress(0);
    setProductSuggestions([]);
    setProjectSuggestions([]);
    setSupplierSuggestions([]);
    setPoNumberSuggestions([]);
    setSuggestionStatus({});
    setShowProductDropdown(false);
    setShowProjectDropdown(false);
    setShowSupplierDropdown(false);
    setShowPoDropdown(false);
  }, [isOpen, editData]);
  
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
  const suggestionTimersRef = useRef({});
  const suggestionRequestIdsRef = useRef({});
  const [suggestionStatus, setSuggestionStatus] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    fetchVendors();
    fetchApprovers();
  }, [isOpen]);

  const fetchVendors = async () => {
    try {
      setLoadingVendors(true);
      const response = await apiClient.get('/procurement/vendors/', {
        params: { page_size: 1000, status: 'active' }
      });
      const vendorData = response.data.results || response.data || [];
      setVendors(Array.isArray(vendorData) ? vendorData : []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      setVendors([]);
    } finally {
      setLoadingVendors(false);
    }
  };
  
  const fetchApprovers = async () => {
    setLoadingApprovers(true);
    setApproverLoadError('');
    try {
      const [pmResponse, emResponse, mpResponse, vpResponse] = await Promise.all([
        apiClient.get('/procurement/requisitions/get_approvers/', { params: { role: 'project_manager' } }),
        apiClient.get('/procurement/requisitions/get_approvers/', { params: { role: 'engineering_manager' } }),
        apiClient.get('/procurement/requisitions/get_approvers/', { params: { role: 'manager_projects' } }),
        apiClient.get('/procurement/requisitions/get_approvers/', { params: { role: 'vp_operations' } }),
      ]);
      
      const usersFrom = (response) => {
        const payload = response?.data?.data || response?.data || {};
        return Array.isArray(payload.users) ? payload.users : [];
      };

      setProjectManagers(usersFrom(pmResponse));
      setEngineeringManagers(usersFrom(emResponse));
      setManagerProjects(usersFrom(mpResponse));
      setVpOperations(usersFrom(vpResponse));
    } catch (error) {
      console.error('Error fetching approvers:', error);
      setProjectManagers([]);
      setEngineeringManagers([]);
      setManagerProjects([]);
      setVpOperations([]);
      setApproverLoadError('Approvers could not be loaded. Please retry.');
    } finally {
      setLoadingApprovers(false);
    }
  };

  const handleApproverChange = (role, userId) => {
    setSelectedApprovers(prev => ({ ...prev, [role]: userId || null }));
    if (errors.approval_workflow_config) {
      setErrors(prev => ({ ...prev, approval_workflow_config: null }));
    }
  };
  
  const getVendorRecommendations = async () => {
    if (!formData.product_service && !formData.description_reason) {
      alert('Please fill in product/service description first');
      return;
    }
    
    try {
      let savedDraft = null;
      if (!editData) {
        savedDraft = await handleAutoSave();
      }
      
      const prId = editData?.id || draftIdRef.current || savedDraft?.id;
      if (prId) {
        const response = await apiClient.post(`/procurement/requisitions/${prId}/recommend_vendors/`);
        setVendorRecommendations(response.data.recommendations || []);
      }
    } catch (error) {
      console.error('Error getting vendor recommendations:', error);
    }
  };
  
  const queueSuggestionFetch = (key, endpoint, rawQuery, setter, force = false) => {
    const query = String(rawQuery || '').trim();
    clearTimeout(suggestionTimersRef.current[key]);
    const requestId = (suggestionRequestIdsRef.current[key] || 0) + 1;
    suggestionRequestIdsRef.current[key] = requestId;

    if (!force && query.length < 2) {
      setter([]);
      setSuggestionStatus(prev => ({
        ...prev,
        [key]: { loading: false, loaded: false, error: '' }
      }));
      return;
    }

    setSuggestionStatus(prev => ({
      ...prev,
      [key]: { loading: true, loaded: false, error: '' }
    }));

    suggestionTimersRef.current[key] = setTimeout(async () => {
      try {
        const response = await apiClient.get(endpoint, { params: { q: query, limit: 20 } });
        if (suggestionRequestIdsRef.current[key] !== requestId) return;
        const payload = response?.data?.data || response?.data || {};
        setter(Array.isArray(payload.suggestions) ? payload.suggestions : []);
        setSuggestionStatus(prev => ({
          ...prev,
          [key]: { loading: false, loaded: true, error: '' }
        }));
      } catch (error) {
        if (suggestionRequestIdsRef.current[key] !== requestId) return;
        console.error(`Error fetching ${key} suggestions:`, error);
        setter([]);
        setSuggestionStatus(prev => ({
          ...prev,
          [key]: { loading: false, loaded: true, error: 'Suggestions could not be loaded.' }
        }));
      }
    }, force && !query ? 0 : 250);
  };

  const fetchProductSuggestions = (query, force = false) => queueSuggestionFetch(
    'product', '/procurement/requisitions/get_product_services/', query, setProductSuggestions, force
  );

  const fetchProjectSuggestions = (query, force = false) => queueSuggestionFetch(
    'project', '/procurement/requisitions/get_projects_departments/', query, setProjectSuggestions, force
  );

  const fetchSupplierSuggestions = (query, force = false) => queueSuggestionFetch(
    'supplier', '/procurement/requisitions/get_suppliers/', query, setSupplierSuggestions, force
  );

  const fetchPoNumberSuggestions = (query, force = false) => queueSuggestionFetch(
    'po', '/procurement/requisitions/get_po_numbers/', query, setPoNumberSuggestions, force
  );

  const closeSuggestions = (key, setter) => {
    clearTimeout(suggestionTimersRef.current[key]);
    suggestionRequestIdsRef.current[key] = (suggestionRequestIdsRef.current[key] || 0) + 1;
    setter([]);
  };

  useEffect(() => () => {
    Object.values(suggestionTimersRef.current).forEach(clearTimeout);
  }, []);

  const selectSupplier = (supplier) => {
    setFormData(prev => ({
      ...prev,
      supplier_name: supplier.supplier_name,
      supplier_business_id: supplier.supplier_business_id || '',
      vendor: supplier.vendor_id || null,
    }));
    setErrors(prev => ({ ...prev, supplier_name: null, supplier_business_id: null }));
    closeSuggestions('supplier', setSupplierSuggestions);
    setShowSupplierDropdown(false);
  };

  const selectProduct = (product) => {
    setFormData(prev => ({ ...prev, product_service: product }));
    setErrors(prev => ({ ...prev, product_service: null }));
    closeSuggestions('product', setProductSuggestions);
    setShowProductDropdown(false);
  };

  const selectProject = (project) => {
    setFormData(prev => ({ ...prev, project_department: project.value }));
    setErrors(prev => ({ ...prev, project_department: null }));
    closeSuggestions('project', setProjectSuggestions);
    setShowProjectDropdown(false);
  };

  const selectPoNumber = (po) => {
    setFormData(prev => ({ ...prev, po_number_reference: po.po_number }));
    closeSuggestions('po', setPoNumberSuggestions);
    setShowPoDropdown(false);
  };

  useEffect(() => {
    if (formData.total_price) {
      setFormData(prev => ({
        ...prev,
        net_total_excl_vat: prev.total_price
      }));
    }
  }, [formData.total_price]);

  useEffect(() => {
    if (!formData.items?.length) return;
    const itemsTotal = formData.items.reduce(
      (sum, item) => sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)),
      0
    ).toFixed(2);
    setFormData(prev => ({ ...prev, total_price: itemsTotal }));
  }, [formData.items]);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  const handleAutoSave = useCallback(async () => {
    if (autoSaveInFlightRef.current) {
      return autoSaveInFlightRef.current;
    }

    const saveOperation = (async () => {
      setAutoSaving(true);
      try {
        const targetDraftId = editData?.id || draftIdRef.current;
        const response = targetDraftId
          ? await apiClient.patch(`/procurement/requisitions/${targetDraftId}/`, formDataRef.current)
          : await apiClient.post('/procurement/requisitions/', formDataRef.current);

        draftIdRef.current = response.data.id;
        if (response.data.pr_number) {
          setFormData(prev => ({ ...prev, pr_number: response.data.pr_number }));
        }
        return response.data;
      } catch (error) {
        console.error('Auto-save failed:', error);
        throw error;
      } finally {
        setAutoSaving(false);
        autoSaveInFlightRef.current = null;
      }
    })();

    autoSaveInFlightRef.current = saveOperation;
    return saveOperation;
  }, [editData]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const autoSaveInterval = setInterval(() => {
      const latestForm = formDataRef.current;
      if (latestForm.product_service || latestForm.description_reason) {
        handleAutoSave().catch(() => {});
      }
    }, 30000);

    return () => clearInterval(autoSaveInterval);
  }, [handleAutoSave, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const invalidFile = selectedFiles.find(file => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      return !ALLOWED_ATTACHMENT_EXTENSIONS.has(extension) || file.size <= 0 || file.size > MAX_ATTACHMENT_SIZE;
    });
    if (invalidFile) {
      setErrors(prev => ({
        ...prev,
        attachments: `${invalidFile.name} must be an allowed, non-empty file no larger than 10 MB.`
      }));
      e.target.value = '';
      return;
    }
    if (files.length + selectedFiles.length > MAX_ATTACHMENT_COUNT) {
      setErrors(prev => ({ ...prev, attachments: 'Upload no more than 10 files at once.' }));
      e.target.value = '';
      return;
    }
    setErrors(prev => ({ ...prev, attachments: null }));
    setFiles(prevFiles => [...prevFiles, ...selectedFiles]);
    e.target.value = '';
  };

  const removeFile = (index) => {
    setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  const addLineItem = () => {
    setFormData(prev => ({ ...prev, items: [...(prev.items || []), newLineItem()] }));
  };

  const updateLineItem = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const updated = { ...item, [field]: value };
        updated.total = (
          (parseFloat(updated.quantity) || 0) * (parseFloat(updated.unit_price) || 0)
        ).toFixed(2);
        return updated;
      })
    }));
    setErrors(prev => ({ ...prev, items: null }));
  };

  const removeLineItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, itemIndex) => itemIndex !== index)
    }));
  };

  const validateForm = () => {
    const newErrors = {};
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

    const invalidItemIndex = (formData.items || []).findIndex(item => (
      !item.description?.trim()
      || !(parseFloat(item.quantity) > 0)
      || parseFloat(item.unit_price) < 0
      || Number.isNaN(parseFloat(item.unit_price))
    ));
    if (invalidItemIndex >= 0) {
      newErrors.items = `Line item ${invalidItemIndex + 1} requires a description, positive quantity, and valid unit price.`;
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

      if (submitForApproval && approvalWorkflow.length === 0) {
        setErrors(prev => ({
          ...prev,
          approval_workflow_config: 'Select at least one approver before submission.'
        }));
        alert('Select at least one approver before submitting the requisition.');
        return;
      }
      
      const formDataWithWorkflow = {
        ...formData,
        approval_workflow_config: approvalWorkflow
      };
      
      Object.keys(formDataWithWorkflow).forEach(key => {
        if (formDataWithWorkflow[key] !== null && formDataWithWorkflow[key] !== undefined && formDataWithWorkflow[key] !== '') {
          if (typeof formDataWithWorkflow[key] === 'object') {
            submitData.append(key, JSON.stringify(formDataWithWorkflow[key]));
          } else {
            submitData.append(key, formDataWithWorkflow[key]);
          }
        }
      });
      
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
      
      if (autoSaveInFlightRef.current) {
        await autoSaveInFlightRef.current;
      }

      const targetDraftId = editData?.id || draftIdRef.current;
      let response = targetDraftId
        ? await apiClient.patch(`/procurement/requisitions/${targetDraftId}/`, submitData, config)
        : await apiClient.post('/procurement/requisitions/', submitData, config);

      draftIdRef.current = response.data.id;

      if (submitForApproval) {
        if (response.data.status !== 'draft') {
          throw new Error(`Requisition cannot be submitted from status ${response.data.status}.`);
        }
        response = await apiClient.post(`/procurement/requisitions/${response.data.id}/submit/`);
      }

      const requisitionLabel = response.data.pr_number
        ? `PR ${response.data.pr_number}`
        : 'Purchase requisition';
      toast.success(submitForApproval
        ? `${requisitionLabel} successfully created and submitted for approval.`
        : `${requisitionLabel} saved as draft.`);
      
      if (onSuccess) onSuccess(response.data);
      if (onClose) onClose();
    } catch (error) {
      console.error('Error submitting PR:', error);
      if (error.response?.data) {
        setErrors(error.response.data);
      }
      const apiMessage = error.response?.data?.error || error.response?.data?.detail;
      alert(apiMessage || error.message || (submitForApproval
        ? 'Failed to submit requisition. Please check all required fields.'
        : 'Failed to save draft. Please try again.'));
    } finally {
      setSubmitLoading(false);
      setUploadProgress(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 py-5 rounded-t-xl flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <DocumentTextIcon className="h-8 w-8 text-purple-200" />
              <div>
                <h2 className="text-xl font-bold">
                  {editData ? 'Edit Purchase Requisition' : 'New Purchase Requisition'}
                </h2>
                <p className="text-purple-100 text-xs mt-0.5">
                  RAD-OM-PRC-0001 FRM -1 Rev 0
                  {formData.pr_number && ` • PR No: ${formData.pr_number}`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-purple-200 transition-colors p-1"
            >
              <XCircleIcon className="h-7 w-7" />
            </button>
          </div>
          
          {autoSaving && (
            <div className="mt-2 flex items-center space-x-2 text-purple-100 text-xs">
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
              <span>Auto-saving draft...</span>
            </div>
          )}
        </div>

        {/* Form Body - Single Scroll Container with overflow-x-hidden */}
        <form
          id="pr-modal-form"
          onSubmit={(e) => handleSubmit(e, true)}
          className="flex-1 overflow-y-auto overflow-x-hidden p-8 space-y-8"
        >
          {/* Section 1: Header Section */}
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

          {/* Section 2: Supplier Section */}
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
                    const supplierName = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      supplier_name: supplierName,
                      supplier_business_id: '',
                      vendor: null,
                    }));
                    fetchSupplierSuggestions(supplierName);
                    setShowSupplierDropdown(true);
                  }}
                  onFocus={() => {
                    fetchSupplierSuggestions(formData.supplier_name, true);
                    setShowSupplierDropdown(true);
                  }}
                  onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 200)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Start typing to see suggestions..."
                />
                {showSupplierDropdown && suggestionStatus.supplier?.loading && (
                  <p className="mt-1 text-xs text-gray-500">Loading suppliers...</p>
                )}
                {showSupplierDropdown && suggestionStatus.supplier?.error && (
                  <p className="mt-1 text-xs text-red-600">{suggestionStatus.supplier.error}</p>
                )}
                {showSupplierDropdown && suggestionStatus.supplier?.loaded && !suggestionStatus.supplier?.error && supplierSuggestions.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">No matching suppliers found.</p>
                )}
                {showSupplierDropdown && supplierSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {supplierSuggestions.map((supplier, index) => (
                      <button
                        type="button"
                        key={supplier.vendor_id || `${supplier.supplier_name}-${index}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectSupplier(supplier)}
                        className="block w-full px-4 py-3 text-left hover:bg-purple-50 border-b border-gray-100 last:border-0"
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
                      </button>
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
                  readOnly
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-gray-50"
                  placeholder="Auto-filled from supplier selection"
                  title="Select a supplier name to populate this identifier"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Project/Product Section */}
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
                    fetchProductSuggestions(formData.product_service, true);
                    setShowProductDropdown(true);
                  }}
                  onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                  rows={2}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    errors.product_service ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Start typing... e.g., Value Engineering Services"
                />
                {showProductDropdown && suggestionStatus.product?.loading && (
                  <p className="mt-1 text-xs text-gray-500">Loading products and services...</p>
                )}
                {showProductDropdown && suggestionStatus.product?.error && (
                  <p className="mt-1 text-xs text-red-600">{suggestionStatus.product.error}</p>
                )}
                {showProductDropdown && suggestionStatus.product?.loaded && !suggestionStatus.product?.error && productSuggestions.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">No matching products or services found.</p>
                )}
                {showProductDropdown && productSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {productSuggestions.map((product, index) => (
                      <button
                        type="button"
                        key={`${product}-${index}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectProduct(product)}
                        className="block w-full px-4 py-2 text-left hover:bg-purple-50 border-b border-gray-100 last:border-0 text-sm"
                      >
                        {product}
                      </button>
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
                    fetchProjectSuggestions(formData.project_department, true);
                    setShowProjectDropdown(true);
                  }}
                  onBlur={() => setTimeout(() => setShowProjectDropdown(false), 200)}
                  rows={3}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    errors.project_department ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Start typing to see project suggestions..."
                />
                {showProjectDropdown && suggestionStatus.project?.loading && (
                  <p className="mt-1 text-xs text-gray-500">Loading projects...</p>
                )}
                {showProjectDropdown && suggestionStatus.project?.error && (
                  <p className="mt-1 text-xs text-red-600">{suggestionStatus.project.error}</p>
                )}
                {showProjectDropdown && suggestionStatus.project?.loaded && !suggestionStatus.project?.error && projectSuggestions.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">No matching projects or departments found.</p>
                )}
                {showProjectDropdown && projectSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {projectSuggestions.map((project, index) => (
                      <button
                        type="button"
                        key={`${project.source}-${project.project_number || project.value}-${index}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectProject(project)}
                        className="block w-full px-4 py-3 text-left hover:bg-purple-50 border-b border-gray-100 last:border-0"
                      >
                        <div className="font-medium text-gray-900 text-sm">{project.label}</div>
                        {project.department && (
                          <div className="text-xs text-gray-600 mt-1">Dept: {project.department}</div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          {project.source === 'master' ? '📁 Project Database' : '📝 Historical Data'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {errors.project_department && (
                  <p className="mt-1 text-sm text-red-600">{errors.project_department}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Description Section */}
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

          {/* Section 5: Vendor Selection Section */}
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
                <div className="flex items-center gap-2">
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
                    className="flex-shrink-0 whitespace-nowrap px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 text-sm font-semibold shadow-sm"
                  >
                    <SparklesIcon className="h-4 w-4" />
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

          {/* Section 6: Pricing Section */}
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

              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">Line Items</h4>
                    <p className="text-xs text-gray-500">Optional for legacy requests; totals are calculated automatically.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="inline-flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-800"
                  >
                    <PlusIcon className="h-4 w-4" /> Add Item
                  </button>
                </div>

                {formData.items?.length > 0 ? (
                  <div className="space-y-3">
                    {formData.items.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-start">
                        <input
                          value={item.description || ''}
                          onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                          placeholder="Description"
                          className="col-span-12 md:col-span-5 px-2 py-2 text-sm border border-gray-300 rounded"
                        />
                        <input
                          type="number"
                          min="0.0001"
                          step="0.0001"
                          value={item.quantity ?? ''}
                          onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                          aria-label={`Line item ${index + 1} quantity`}
                          className="col-span-3 md:col-span-1 px-2 py-2 text-sm border border-gray-300 rounded"
                        />
                        <input
                          value={item.unit || ''}
                          onChange={(e) => updateLineItem(index, 'unit', e.target.value)}
                          placeholder="Unit"
                          aria-label={`Line item ${index + 1} unit`}
                          className="col-span-3 md:col-span-1 px-2 py-2 text-sm border border-gray-300 rounded"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price ?? ''}
                          onChange={(e) => updateLineItem(index, 'unit_price', e.target.value)}
                          placeholder="Unit price"
                          aria-label={`Line item ${index + 1} unit price`}
                          className="col-span-4 md:col-span-2 px-2 py-2 text-sm border border-gray-300 rounded"
                        />
                        <div className="col-span-10 md:col-span-2 px-2 py-2 text-sm text-right font-medium">
                          {formData.currency} {item.total || '0.00'}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLineItem(index)}
                          aria-label={`Remove line item ${index + 1}`}
                          className="col-span-2 md:col-span-1 p-2 text-red-500 hover:text-red-700"
                        >
                          <TrashIcon className="h-5 w-5 mx-auto" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <button type="button" onClick={addLineItem} className="w-full py-4 text-sm text-gray-500 border border-dashed border-gray-300 rounded">
                    Add structured quantities and unit prices
                  </button>
                )}
                {errors.items && <p className="mt-2 text-sm text-red-600">{errors.items}</p>}
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
                    readOnly={formData.items?.length > 0}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                      errors.total_price ? 'border-red-500' : 'border-gray-300'
                    } ${formData.items?.length > 0 ? 'bg-gray-50' : ''}`}
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

          {/* Section 7: Reference Section */}
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
                  fetchPoNumberSuggestions(formData.po_number_reference, true);
                  setShowPoDropdown(true);
                }}
                onBlur={() => setTimeout(() => setShowPoDropdown(false), 200)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Start typing PO number..."
              />
              {showPoDropdown && suggestionStatus.po?.loading && (
                <p className="mt-1 text-xs text-gray-500">Loading purchase orders...</p>
              )}
              {showPoDropdown && suggestionStatus.po?.error && (
                <p className="mt-1 text-xs text-red-600">{suggestionStatus.po.error}</p>
              )}
              {showPoDropdown && suggestionStatus.po?.loaded && !suggestionStatus.po?.error && poNumberSuggestions.length === 0 && (
                <p className="mt-1 text-xs text-gray-500">No matching purchase orders found.</p>
              )}
              {showPoDropdown && poNumberSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {poNumberSuggestions.map((po, index) => (
                    <button
                      type="button"
                      key={`${po.po_number}-${index}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectPoNumber(po)}
                      className="block w-full px-4 py-3 text-left hover:bg-purple-50 border-b border-gray-100 last:border-0"
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
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 8: Purchase Recommendation Section */}
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

          {/* Section 9: Approval Workflow Section */}
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
                    onChange={(e) => handleApproverChange('project_manager', e.target.value)}
                    disabled={loadingApprovers || projectManagers.length === 0}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">
                      {loadingApprovers
                        ? 'Loading approvers...'
                        : projectManagers.length
                          ? '-- Select Project Manager --'
                          : 'No eligible approvers available'}
                    </option>
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
                    onChange={(e) => handleApproverChange('engineering_manager', e.target.value)}
                    disabled={loadingApprovers || engineeringManagers.length === 0}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">
                      {loadingApprovers
                        ? 'Loading approvers...'
                        : engineeringManagers.length
                          ? '-- Select Engineering Manager --'
                          : 'No eligible approvers available'}
                    </option>
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
                    onChange={(e) => handleApproverChange('manager_projects', e.target.value)}
                    disabled={loadingApprovers || managerProjects.length === 0}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">
                      {loadingApprovers
                        ? 'Loading approvers...'
                        : managerProjects.length
                          ? '-- Select Manager of Projects --'
                          : 'No eligible approvers available'}
                    </option>
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
                    onChange={(e) => handleApproverChange('vp_operations', e.target.value)}
                    disabled={loadingApprovers || vpOperations.length === 0}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">
                      {loadingApprovers
                        ? 'Loading approvers...'
                        : vpOperations.length
                          ? '-- Select VP Operations --'
                          : 'No eligible approvers available'}
                    </option>
                    {vpOperations.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.job_title_match ? '★ ' : ''}{user.full_name}{user.job_title ? ` - ${user.job_title}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {approverLoadError && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <span>{approverLoadError}</span>
                  <button
                    type="button"
                    onClick={fetchApprovers}
                    className="shrink-0 font-semibold text-red-700 underline hover:text-red-900"
                  >
                    Retry
                  </button>
                </div>
              )}

              {!loadingApprovers && !approverLoadError && projectManagers.length > 0 && (
                <p className="text-xs text-emerald-700">
                  {projectManagers.length} eligible approvers loaded. Select one or more people from the lists above.
                </p>
              )}

              {errors.approval_workflow_config && (
                <p className="text-sm font-medium text-red-600">{errors.approval_workflow_config}</p>
              )}
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  <strong>Note:</strong> The approval workflow will be built based on the approvers you select. 
                  Empty fields will be skipped automatically.
                </p>
              </div>
            </div>
          </div>

          {/* Section 10: Attachments Section */}
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

              {errors.attachments && (
                <p className="text-sm text-red-600">{errors.attachments}</p>
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

        {/* Modal Footer Actions - Fixed Bottom Bar */}
        <div className="bg-gray-50 px-8 py-4 rounded-b-xl border-t border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="text-sm text-gray-500">
            <span className="text-red-500">*</span> Required fields
          </div>
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors font-medium text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e, false)}
              disabled={submitLoading}
              className="px-6 py-2.5 border border-purple-300 rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors font-medium text-sm disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              type="submit"
              form="pr-modal-form"
              disabled={submitLoading}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all font-medium text-sm disabled:opacity-50 shadow-md flex items-center space-x-2"
            >
              {submitLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
