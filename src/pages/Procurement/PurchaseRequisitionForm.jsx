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
import { uploadSignedRequisitionPdf, validateSignedRequisitionPdf } from './PurchaseRequisitionPdfImport';
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

const normalizeApiErrors = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  return Object.fromEntries(Object.entries(payload).map(([field, value]) => {
    if (Array.isArray(value)) return [field, value.map(String).join(' ')];
    if (value && typeof value === 'object') {
      return [field, Object.values(value).flat(Infinity).map(String).join(' ')];
    }
    return [field, String(value)];
  }));
};

const firstApiError = (errors) => {
  const labels = {
    po_number_reference: 'PO Number',
    approval_workflow_config: 'Approval Workflow',
    management_approval_evidence_file: 'Evidence of Approval',
    non_field_errors: 'Submission',
  };
  const entry = Object.entries(errors)[0];
  return entry ? `${labels[entry[0]] || entry[0].replaceAll('_', ' ')}: ${entry[1]}` : '';
};

const newLineItem = () => ({
  description: '',
  quantity: '1',
  unit: 'EA',
  unit_price: '',
  budget: '',
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
  price_description: editData?.description_reason || editData?.price_description || '',
  total_price: editData?.total_price || '',
  currency: editData?.currency || 'USD',
  price_remarks: editData?.price_remarks || editData?.price_remarks_data?.negotiation_remarks || '',
  net_total_excl_vat: editData?.net_total_excl_vat || '',
  po_number_reference: editData?.po_number_reference || '',
  purchase_recommendation: editData?.purchase_recommendation || editData?.special_notes || '',
  vendor: editData?.vendor || null,
  vendor_selection_reason: editData?.vendor_selection_reason || '',
  selected_vendors: Array.isArray(editData?.selected_vendors) ? editData.selected_vendors : [],
  single_source_justification: editData?.single_source_justification || '',
  project_details: Array.isArray(editData?.project_details) ? editData.project_details : [],
  approval_workflow_config: editData?.approval_workflow_config || [],
  price_remarks_data: editData?.price_remarks_data || {},
  items: Array.isArray(editData?.items) ? editData.items : [],
  requisition_type: editData?.requisition_type || 'project',
  priority: editData?.priority || 'normal',
  po_applicable: Boolean(editData?.po_applicable),
  management_approval: editData?.management_approval ?? null,
  management_approval_remarks: editData?.management_approval_remarks || '',
  management_approval_evidence: Array.isArray(editData?.management_approval_evidence) ? editData.management_approval_evidence : [],
});

const selectedApproversFromWorkflow = (workflow = []) => {
  const selection = {
    level_one: [],
    project_manager: null,
    engineering_manager: null,
    manager_projects: null,
    vp_operations: null,
  };

  workflow.forEach((stage) => {
    const role = `${stage?.role || ''} ${stage?.stage || ''}`.toLowerCase();
    const userId = stage?.user_id || stage?.approver_id || null;
    const level = Number(stage?.level);
    if (level === 1 || role.includes('level 1 approver')) {
      if (userId && !selection.level_one.includes(userId)) selection.level_one.push(userId);
      selection.project_manager ||= userId;
    }
    else if (role.includes('engineering manager')) selection.engineering_manager = userId;
    else if (role.includes('manager of projects') || role.includes('projects manager')) selection.manager_projects = userId;
    else if (role.includes('vice president') || role.includes('vp operations') || role.includes('procurement manager')) selection.vp_operations = userId;
    else if (role.includes('project manager') || role.includes('department manager') || role.includes('technical review')) {
      selection.project_manager = userId;
      if (userId && !selection.level_one.includes(userId)) selection.level_one.push(userId);
    }
  });

  return selection;
};

const PurchaseRequisitionForm = ({ isOpen, onClose, onSuccess, editData = null }) => {
  const [submitLoading, setSubmitLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Form state - all 23 fields from PDF template
  const [formData, setFormData] = useState(() => buildInitialFormData(editData));
  
  const [files, setFiles] = useState([]);
  const [approvedPdfFile, setApprovedPdfFile] = useState(null);
  const [approvedPdfDate, setApprovedPdfDate] = useState('');
  const [managementEvidenceFile, setManagementEvidenceFile] = useState(null);
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorOptions, setShowVendorOptions] = useState(false);
  const [vendorLoadError, setVendorLoadError] = useState('');
  const [prNumberStatus, setPrNumberStatus] = useState({ checking: false, available: null, message: '' });
  const [errors, setErrors] = useState({});
  const [autoSaving, setAutoSaving] = useState(false);
  const draftIdRef = useRef(editData?.id || null);
  const autoSaveInFlightRef = useRef(null);
  const formDataRef = useRef(formData);
  const submissionInFlightRef = useRef(false);
  const lastAutoSaveFingerprintRef = useRef('');
  
  // New state for dynamic features
  const [vendors, setVendors] = useState([]);
  const [vendorRecommendations, setVendorRecommendations] = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  
  // Approval workflow state
  const [projectManagers, setProjectManagers] = useState([]);
  const [engineeringManagers, setEngineeringManagers] = useState([]);
  const [managerProjects, setManagerProjects] = useState([]);
  const [vpOperations, setVpOperations] = useState([]);
  const [loadingApprovers, setLoadingApprovers] = useState(false);
  const [approverLoadError, setApproverLoadError] = useState('');
  const [levelOneApproverCount, setLevelOneApproverCount] = useState(1);
  const [levelOneSearch, setLevelOneSearch] = useState('');
  const [selectedApprovers, setSelectedApprovers] = useState({
    level_one: [],
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
    submissionInFlightRef.current = false;
    const { approval_workflow_config: _workflow, ...initialAutoSavePayload } = initialData;
    lastAutoSaveFingerprintRef.current = JSON.stringify(initialAutoSavePayload);
    const initialApprovers = selectedApproversFromWorkflow(editData?.approval_workflow_config || []);
    setSelectedApprovers(initialApprovers);
    setLevelOneApproverCount(Math.max(1, initialApprovers.level_one.length));
    setLevelOneSearch('');
    setFiles([]);
    setApprovedPdfFile(null);
    setApprovedPdfDate('');
    setManagementEvidenceFile(null);
    setVendorSearch('');
    setShowVendorOptions(false);
    setVendorLoadError('');
    setPrNumberStatus({ checking: false, available: null, message: '' });
    setErrors({});
    setUploadProgress(0);
    setProductSuggestions([]);
    setProjectSuggestions([]);
    setSupplierSuggestions([]);
    setPoNumberSuggestions([]);
    setSuggestionStatus({});
    setShowProductDropdown(false);
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
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [showPoDropdown, setShowPoDropdown] = useState(false);
  const suggestionTimersRef = useRef({});
  const suggestionRequestIdsRef = useRef({});
  const [suggestionStatus, setSuggestionStatus] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    fetchVendors();
    fetchApprovers();
    fetchProjectSuggestions('', true);
  }, [isOpen]);

  const fetchVendors = async (query = '', vendorId = '') => {
    const requestId = (suggestionRequestIdsRef.current.vendorOption || 0) + 1;
    suggestionRequestIdsRef.current.vendorOption = requestId;
    try {
      setLoadingVendors(true);
      setVendorLoadError('');
      const response = await apiClient.get('/procurement/requisitions/vendor-options/', {
        params: { q: query.trim(), id: vendorId || undefined, limit: vendorId ? 1 : 30 }
      });
      if (suggestionRequestIdsRef.current.vendorOption !== requestId) return [];
      const vendorData = response.data?.suggestions || [];
      if (!vendorId) setVendors(Array.isArray(vendorData) ? vendorData : []);
      return Array.isArray(vendorData) ? vendorData : [];
    } catch (error) {
      console.error('Error fetching vendors:', error);
      if (suggestionRequestIdsRef.current.vendorOption === requestId) {
        if (!vendorId) setVendors([]);
        setVendorLoadError('Vendors could not be loaded. Select Retry to try again.');
      }
      return [];
    } finally {
      if (suggestionRequestIdsRef.current.vendorOption === requestId) setLoadingVendors(false);
    }
  };

  const searchVendors = (query) => {
    clearTimeout(suggestionTimersRef.current.vendorOption);
    suggestionTimersRef.current.vendorOption = setTimeout(() => fetchVendors(query), 200);
  };
  
  const fetchApprovers = async () => {
    setLoadingApprovers(true);
    setApproverLoadError('');
    try {
      const [pmResponse, emResponse, mpResponse, vpResponse] = await Promise.all([
        apiClient.get('/procurement/requisitions/get_approvers/', { params: { role: 'any_active' } }),
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
      const vpCandidates = usersFrom(vpResponse);
      setVpOperations(vpCandidates.some(user => user.job_title_match)
        ? vpCandidates.filter(user => user.job_title_match)
        : vpCandidates);
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

  const addLevelOneApprover = (userId) => {
    setSelectedApprovers(prev => {
      const selected = prev.level_one || [];
      if (!userId || selected.includes(userId) || selected.length >= levelOneApproverCount) return prev;
      const next = [...selected, userId];
      return { ...prev, level_one: next, project_manager: next[0] || null };
    });
    setLevelOneSearch('');
    if (errors.approval_workflow_config) setErrors(prev => ({ ...prev, approval_workflow_config: null }));
  };

  const removeLevelOneApprover = (userId) => {
    setSelectedApprovers(prev => {
      const next = (prev.level_one || []).filter(id => id !== userId);
      return { ...prev, level_one: next, project_manager: next[0] || null };
    });
  };

  const changeLevelOneCount = (rawValue) => {
    const count = Math.max(1, Math.min(20, Number(rawValue) || 1));
    setLevelOneApproverCount(count);
    setSelectedApprovers(prev => {
      const next = (prev.level_one || []).slice(0, count);
      return { ...prev, level_one: next, project_manager: next[0] || null };
    });
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

  const toggleProject = (project) => {
    setFormData(prev => {
      const current = Array.isArray(prev.project_details) ? prev.project_details : [];
      const identity = project.project_id || project.value;
      const isSelected = current.some(item => (item.project_id || item.value) === identity);
      const projectDetails = isSelected
        ? current.filter(item => (item.project_id || item.value) !== identity)
        : [...current, project];
      return {
        ...prev,
        project_details: projectDetails,
        project_department: projectDetails.map(item => item.value || item.label).join('; '),
      };
    });
    setErrors(prev => ({ ...prev, project_department: null }));
  };

  const addInternalProject = () => {
    const internal = { value: 'Internal / General', label: 'Internal / General', source: 'internal' };
    toggleProject(internal);
  };

  const removeProjectDetail = (index) => {
    setFormData(prev => {
      const projectDetails = (prev.project_details || []).filter((_, itemIndex) => itemIndex !== index);
      return {
        ...prev,
        project_details: projectDetails,
        project_department: projectDetails.map(item => item.value || item.label).join('; '),
      };
    });
  };

  const addVendorToShortlist = async (vendorId) => {
    let selected = vendors.find(vendor => String(vendor.id) === String(vendorId));
    if (!selected && vendorId) {
      const matches = await fetchVendors('', vendorId);
      selected = matches[0];
    }
    if (!selected) {
      setErrors(prev => ({ ...prev, selected_vendors: 'The selected vendor could not be loaded. Please search again.' }));
      return;
    }
    setFormData(prev => {
      const shortlist = Array.isArray(prev.selected_vendors) ? prev.selected_vendors : [];
      if (shortlist.some(vendor => String(vendor.vendor_id || vendor.id) === String(selected.id))) return prev;
      return {
        ...prev,
        selected_vendors: [...shortlist, {
          vendor_id: selected.id,
          name: selected.name,
          vendor_code: selected.vendor_code,
          icv_percentage: selected.icv_percentage,
          icv_expiry_date: selected.icv_expiry_date,
          is_icv_certified: selected.is_icv_certified,
        }],
      };
    });
    setVendorSearch('');
    setShowVendorOptions(false);
    setErrors(prev => ({ ...prev, selected_vendors: null }));
  };

  const removeVendorFromShortlist = (vendorId) => {
    setFormData(prev => {
      const selectedVendors = (prev.selected_vendors || []).filter(
        vendor => String(vendor.vendor_id || vendor.id) !== String(vendorId)
      );
      const selectedWasRemoved = String(prev.vendor || '') === String(vendorId);
      return {
        ...prev,
        selected_vendors: selectedVendors,
        ...(selectedWasRemoved ? {
          vendor: null,
          supplier_name: '',
          supplier_business_id: '',
          preferred_supplier_if_any: '',
        } : {}),
      };
    });
  };

  const selectPreferredVendor = (vendorId) => {
    const shortlistEntry = (formData.selected_vendors || []).find(
      vendor => String(vendor.vendor_id || vendor.id) === String(vendorId)
    );
    const masterVendor = vendors.find(vendor => String(vendor.id) === String(vendorId));
    setFormData(prev => ({
      ...prev,
      vendor: vendorId || null,
      supplier_name: shortlistEntry?.name || masterVendor?.name || '',
      supplier_business_id: masterVendor?.trade_license_number || masterVendor?.tax_id || masterVendor?.vendor_code || '',
      preferred_supplier_if_any: shortlistEntry?.name || masterVendor?.name || '',
    }));
  };

  const checkPrNumber = (number) => {
    clearTimeout(suggestionTimersRef.current.prNumber);
    const normalized = String(number || '').trim().toUpperCase();
    if (normalized.length < 3) {
      setPrNumberStatus({ checking: false, available: null, message: '' });
      return;
    }
    setPrNumberStatus({ checking: true, available: null, message: 'Checking availability...' });
    suggestionTimersRef.current.prNumber = setTimeout(async () => {
      try {
        const response = await apiClient.get('/procurement/requisitions/check-pr-number/', {
          params: { number: normalized, exclude_id: editData?.id || draftIdRef.current || undefined },
        });
        setPrNumberStatus({
          checking: false,
          available: Boolean(response.data.available),
          message: response.data.available ? 'PR number is available.' : (response.data.message || 'PR number already exists.'),
        });
      } catch (error) {
        setPrNumberStatus({ checking: false, available: null, message: 'Could not verify PR number.' });
      }
    }, 350);
  };

  const selectPoNumber = (po) => {
    setFormData(prev => ({ ...prev, po_number_reference: po.po_number }));
    setErrors(prev => ({ ...prev, po_number_reference: null }));
    closeSuggestions('po', setPoNumberSuggestions);
    setShowPoDropdown(false);
  };

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      net_total_excl_vat: prev.total_price || ''
    }));
  }, [formData.total_price]);

  useEffect(() => {
    setFormData(prev => {
      const purchaseDescription = prev.description_reason || '';
      if (prev.price_description === purchaseDescription) return prev;
      return { ...prev, price_description: purchaseDescription };
    });
  }, [formData.description_reason]);

  useEffect(() => {
    if (!formData.items?.length) return;
    const itemsTotal = formData.items.reduce(
      (sum, item) => sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)),
      0
    ).toFixed(2);
    const itemsBudget = formData.items.reduce(
      (sum, item) => sum + (parseFloat(item.budget) || 0),
      0
    ).toFixed(2);
    setFormData(prev => ({ ...prev, total_price: itemsTotal, estimated_budget: itemsBudget }));
  }, [formData.items]);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  const handleAutoSave = useCallback(async () => {
    if (submissionInFlightRef.current) return null;
    if (autoSaveInFlightRef.current) {
      return autoSaveInFlightRef.current;
    }

    // Approver selections live in separate UI state and are persisted only by
    // explicit Save/Submit actions. Auto-save must never erase them with [].
    const { approval_workflow_config: _workflow, ...autoSavePayload } = formDataRef.current;
    const fingerprint = JSON.stringify(autoSavePayload);
    if (fingerprint === lastAutoSaveFingerprintRef.current) return null;

    const saveOperation = (async () => {
      setAutoSaving(true);
      try {
        const targetDraftId = editData?.id || draftIdRef.current;
        const response = targetDraftId
          ? await apiClient.patch(`/procurement/requisitions/${targetDraftId}/`, autoSavePayload)
          : await apiClient.post('/procurement/requisitions/', autoSavePayload);

        draftIdRef.current = response.data.id;
        lastAutoSaveFingerprintRef.current = fingerprint;
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
      if (latestForm.pr_number && (latestForm.product_service || latestForm.description_reason)) {
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
    if (!formData.pr_number?.trim()) {
      newErrors.pr_number = 'Enter the PR number manually';
    } else if (prNumberStatus.available === false) {
      newErrors.pr_number = 'This PR number already exists';
    }
    if (!formData.product_service?.trim()) {
      newErrors.product_service = 'Product/Service description is required';
    }
    if (!(formData.project_details || []).length) {
      newErrors.project_department = 'Select at least one project or Internal / General';
    }
    if (!formData.description_reason?.trim()) {
      newErrors.description_reason = 'Purchase description is required';
    }
    if (!formData.price_description?.trim()) {
      newErrors.price_description = 'Purchase description is required';
    }
    if (!formData.total_price || parseFloat(formData.total_price) <= 0) {
      newErrors.total_price = 'Valid total price is required';
    }
    if (!(formData.selected_vendors || []).length) {
      newErrors.selected_vendors = 'Select at least one vendor';
    }
    if (!formData.vendor) {
      newErrors.vendor = 'Select the supplier from the shortlisted vendors';
    }
    if ((formData.selected_vendors || []).length === 1 && !formData.single_source_justification?.trim()) {
      newErrors.single_source_justification = 'Single source justification is required';
    }
    if (!formData.purchase_recommendation?.trim()) {
      newErrors.purchase_recommendation = 'Purchase recommendation is mandatory';
    }
    if (formData.po_applicable && !formData.po_number_reference?.trim()) {
      newErrors.po_number_reference = 'Enter a completed PO number';
    }
    if (formData.currency === 'AED' && parseFloat(formData.total_price) > 100000) {
      if (formData.management_approval !== true) newErrors.management_approval = 'Management Approval must be Yes';
      if (!formData.management_approval_remarks?.trim()) newErrors.management_approval_remarks = 'Approval remarks are required';
      if (!managementEvidenceFile && !(formData.management_approval_evidence || []).length) {
        newErrors.management_approval_evidence = 'Attach evidence of management approval';
      }
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
    if (submissionInFlightRef.current) return;
    if (!formData.pr_number?.trim() || prNumberStatus.available === false) {
      setErrors(prev => ({ ...prev, pr_number: prNumberStatus.available === false ? 'This PR number already exists' : 'Enter the PR number manually' }));
      return;
    }
    if (submitForApproval && !validateForm()) {
      return;
    }
    
    setSubmitLoading(true);
    submissionInFlightRef.current = true;
    
    try {
      // Signed PDFs are authoritative and use the exact same atomic pipeline
      // as the standalone Import Signed PDF action.
      if (approvedPdfFile) {
        const approvedPdfResult = await uploadSignedRequisitionPdf(
          approvedPdfFile,
          formData.pr_number,
          approvedPdfDate,
        );
        toast.success(`Success full Recorded [${approvedPdfResult.pr_number || formData.pr_number}]!`);
        if (onSuccess) onSuccess(approvedPdfResult);
        if (onClose) onClose();
        return;
      }

      const submitData = new FormData();
      const approvalWorkflow = [];
      let step = 1;
      
      (selectedApprovers.level_one || []).forEach((userId, index) => {
        const user = projectManagers.find(u => u.id === userId);
        approvalWorkflow.push({
          step: step++,
          level: 1,
          stage: `Level 1 - Approver ${index + 1} of ${levelOneApproverCount}`,
          role: 'Level 1 Approver',
          approval_group: 'level_1',
          group_mode: 'all',
          user_id: userId,
          user_name: user?.full_name || '',
          status: 'pending',
          approved_at: null
        });
      });
      
      if (formData.requisition_type === 'project' && selectedApprovers.engineering_manager) {
        const user = engineeringManagers.find(u => u.id === selectedApprovers.engineering_manager);
        approvalWorkflow.push({
          step: step++,
          level: 2,
          stage: 'Level 2 - Manager of Engineering (Optional)',
          role: 'Manager of Engineering (MoE)',
          user_id: selectedApprovers.engineering_manager,
          user_name: user?.full_name || '',
          status: 'pending',
          approved_at: null
        });
      }
      
      if (formData.requisition_type === 'project' && selectedApprovers.manager_projects) {
        const user = managerProjects.find(u => u.id === selectedApprovers.manager_projects);
        approvalWorkflow.push({
          step: step++,
          level: 3,
          stage: 'Level 3 - Manager of Projects',
          role: 'Manager of Projects (MoP)',
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
          level: formData.requisition_type === 'general' ? 2 : 4,
          stage: formData.requisition_type === 'general' ? 'Level 2 - Vice President' : 'Level 4 - VP Delivery',
          role: formData.requisition_type === 'general' ? 'Vice President' : 'VP Delivery',
          user_id: selectedApprovers.vp_operations,
          user_name: user?.full_name || '',
          status: 'pending',
          approved_at: null
        });
      }

      const levelOneComplete = (selectedApprovers.level_one || []).length === levelOneApproverCount;
      const requiredApproversMissing = formData.requisition_type === 'general'
        ? (!levelOneComplete || !selectedApprovers.vp_operations)
        : (!levelOneComplete || !selectedApprovers.manager_projects || !selectedApprovers.vp_operations);
      if (submitForApproval && requiredApproversMissing) {
        setErrors(prev => ({
          ...prev,
          approval_workflow_config: formData.requisition_type === 'general'
            ? `Select exactly ${levelOneApproverCount} Level 1 approver(s) and the Level 2 Vice President.`
            : `Select exactly ${levelOneApproverCount} Level 1 approver(s), Level 3 (MoP), and Level 4 (VP Delivery). Level 2 (MoE) is optional.`
        }));
        alert('Complete the required approval levels before submitting.');
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
      if (managementEvidenceFile) {
        submitData.append('management_approval_evidence_file', managementEvidenceFile);
      }
      
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
      const { approval_workflow_config: _workflow, ...savedAutoSavePayload } = formDataRef.current;
      lastAutoSaveFingerprintRef.current = JSON.stringify(savedAutoSavePayload);

      if (submitForApproval) {
        if (response.data.status !== 'draft') {
          throw new Error(`Requisition cannot be submitted from status ${response.data.status}.`);
        }
        response = await apiClient.post(`/procurement/requisitions/${response.data.id}/submit/`, {
          approval_workflow_config: approvalWorkflow,
        });
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
      const apiErrors = normalizeApiErrors(error.response?.data);
      if (Object.keys(apiErrors).length) {
        setErrors(prev => ({ ...prev, ...apiErrors }));
      }
      const apiMessage = apiErrors.error || apiErrors.detail || firstApiError(apiErrors);
      alert(apiMessage || error.message || (submitForApproval
        ? 'Failed to submit requisition. Please check all required fields.'
        : 'Failed to save draft. Please try again.'));
    } finally {
      submissionInFlightRef.current = false;
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
                  {editData ? 'Edit Purchase Recommendation' : 'New Purchase Recommendation'}
                </h2>
                <p className="text-purple-100 text-xs mt-0.5">
                  RAD-OM-PRC-0001 FRM -1 Rev 0
                  {formData.pr_number && (
                    <> <span aria-hidden="true">&middot;</span> PR No: {formData.pr_number}</>
                  )}
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
          className="flex flex-1 flex-col gap-8 overflow-y-auto overflow-x-hidden p-8"
        >
          {/* Signed approval PDF is intentionally first when editing. */}
          {editData && (
            <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-base font-bold text-emerald-900">Attach Signed / Approved PR PDF</p>
                  <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                    The PDF must match PR {formData.pr_number}. RADAI captures its details, verifies the approval table, attaches the signed source, and records approval only when validation succeeds.
                  </p>
                </div>
                <label className="inline-flex h-10 shrink-0 cursor-pointer items-center rounded-lg border border-emerald-400 bg-white px-4 text-xs font-bold text-emerald-700 hover:bg-emerald-100">
                  <CheckCircleIcon className="mr-1.5 h-4 w-4" /> {approvedPdfFile ? 'Change Signed PDF' : 'Choose Signed PDF'}
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(event) => {
                      const selected = event.target.files?.[0] || null;
                      try {
                        validateSignedRequisitionPdf(selected);
                        setErrors(previous => ({ ...previous, approved_pdf: null }));
                        setApprovedPdfFile(selected);
                      } catch (validationError) {
                        setErrors(previous => ({ ...previous, approved_pdf: validationError.message }));
                        setApprovedPdfFile(null);
                      }
                      event.target.value = '';
                    }}
                  />
                </label>
              </div>
              {approvedPdfFile && (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-white p-3">
                  <p className="text-xs font-semibold text-emerald-800">Selected signed PDF: {approvedPdfFile.name}</p>
                  <label className="mt-3 block text-xs font-semibold text-gray-700">
                    Approval date override (only when visible handwriting cannot be read by OCR)
                    <input type="date" value={approvedPdfDate} onChange={(event) => setApprovedPdfDate(event.target.value)} className="mt-1 block h-9 w-full rounded-lg border border-emerald-300 bg-white px-3 font-normal text-gray-800" />
                  </label>
                </div>
              )}
              {(editData.attachments || []).filter((attachment) => (
                attachment?.type === 'signed_purchase_requisition_pdf'
                || attachment?.document_type === 'signed_purchase_requisition_pdf'
              )).map((attachment) => (
                <a
                  key={attachment.sha256 || attachment.url || attachment.filename}
                  href={attachment.url || attachment.s3_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  <PaperClipIcon className="h-4 w-4" /> Currently recorded: {attachment.filename || 'Signed PR PDF'}
                </a>
              ))}
              {errors.approved_pdf && <p className="mt-2 text-xs font-medium text-red-600">{errors.approved_pdf}</p>}
            </div>
          )}

          {/* Section 1: Header Section */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="bg-purple-100 text-purple-700 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">1</span>
              Header Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">Recommendation Type</label>
                <div className="inline-flex rounded-lg border border-gray-300 bg-gray-50 p-1">
                  {['project', 'general'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        requisition_type: type,
                        ...(type === 'project'
                          ? (() => {
                              const projectDetails = (prev.project_details || []).filter(project => project.source !== 'internal');
                              return {
                                project_details: projectDetails,
                                project_department: projectDetails.map(project => project.value || project.label).join('; '),
                              };
                            })()
                          : {}),
                      }))}
                      className={`rounded-md px-5 py-2 text-sm font-semibold ${formData.requisition_type === type ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:bg-white'}`}
                    >
                      {type === 'project' ? 'Project' : 'General / Internal'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PR Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="pr_number"
                  value={formData.pr_number}
                  onChange={(event) => {
                    const value = event.target.value.toUpperCase();
                    setFormData(prev => ({ ...prev, pr_number: value }));
                    setErrors(prev => ({ ...prev, pr_number: null }));
                    checkPrNumber(value);
                  }}
                  className={`w-full rounded-lg border px-4 py-2 uppercase focus:ring-2 focus:ring-purple-500 ${errors.pr_number || prNumberStatus.available === false ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Enter company PR number"
                />
                {(errors.pr_number || prNumberStatus.message) && (
                  <p className={`mt-1 text-xs ${errors.pr_number || prNumberStatus.available === false ? 'text-red-600' : prNumberStatus.available ? 'text-emerald-600' : 'text-gray-500'}`}>
                    {errors.pr_number || prNumberStatus.message}
                  </p>
                )}
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
                  <option value="normal">Normal - 2-day review</option>
                  <option value="high">High - 1-day review</option>
                  <option value="urgent">Urgent - same-day review</option>
                </select>
              </div>
            </div>
          </div>

          {/* Supplier information is derived from the selected vendor shortlist. */}
          {false && <div className="border-b border-gray-200 pb-6">
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
                          <div className="text-xs text-yellow-600">Rating: {supplier.rating}/5</div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          {supplier.source === 'master' ? 'Vendor Database' : 'Historical Data'}
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
          </div>}

          {/* Section 3: Project/Product Section */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="bg-purple-100 text-purple-700 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">2</span>
              Product / Service & Project Details
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
                  Project / Department <span className="text-red-500">*</span>
                  <span className="ml-2 text-xs text-gray-500">(Current ongoing projects; multiple selections allowed)</span>
                </label>
                <select
                  name="project_department"
                  value=""
                  onChange={(event) => {
                    if (event.target.value === '__internal__') {
                      addInternalProject();
                      return;
                    }
                    const project = projectSuggestions.find(item => String(item.project_id || item.value) === event.target.value);
                    if (project) toggleProject(project);
                  }}
                  onFocus={() => {
                    fetchProjectSuggestions('', true);
                  }}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    errors.project_department ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">-- Select an ongoing project --</option>
                  {formData.requisition_type === 'general' && (
                    <option
                      value="__internal__"
                      disabled={(formData.project_details || []).some(project => project.source === 'internal')}
                    >
                      Internal{(formData.project_details || []).some(project => project.source === 'internal') ? ' (Selected)' : ''}
                    </option>
                  )}
                  {projectSuggestions.map((project, index) => {
                    const identity = String(project.project_id || project.value);
                    const selected = (formData.project_details || []).some(item => String(item.project_id || item.value) === identity);
                    return (
                      <option key={`${identity}-${index}`} value={identity} disabled={selected}>
                        {project.label}{project.department ? ` - ${project.department}` : ''}{selected ? ' (Selected)' : ''}
                      </option>
                    );
                  })}
                </select>
                {suggestionStatus.project?.loading && (
                  <p className="mt-1 text-xs text-gray-500">Loading projects...</p>
                )}
                {suggestionStatus.project?.error && (
                  <p className="mt-1 text-xs text-red-600">{suggestionStatus.project.error}</p>
                )}
                {suggestionStatus.project?.loaded && !suggestionStatus.project?.error && projectSuggestions.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">No current ongoing projects found.</p>
                )}
                {errors.project_department && (
                  <p className="mt-1 text-sm text-red-600">{errors.project_department}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {(formData.project_details || []).map((project, index) => (
                    <span key={`${project.project_id || project.value}-${index}`} className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-800 ring-1 ring-purple-200">
                      {project.source === 'internal' ? 'Internal' : (project.label || project.value)}
                      <button type="button" onClick={() => removeProjectDetail(index)} className="text-purple-500 hover:text-red-600" aria-label="Remove project">
                        <XCircleIcon className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Description Section */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="bg-purple-100 text-purple-700 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">3</span>
              Purchase Description
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Purchase Description <span className="text-red-500">*</span>
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
              <span className="bg-purple-100 text-purple-700 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">4</span>
              Vendor Selection
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                   Vendor Shortlist <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="search"
                      value={vendorSearch}
                      onChange={(event) => {
                        const query = event.target.value;
                        setVendorSearch(query);
                        setShowVendorOptions(true);
                        searchVendors(query);
                      }}
                      onFocus={() => {
                        setShowVendorOptions(true);
                        if (!vendors.length) fetchVendors(vendorSearch);
                      }}
                      onBlur={() => setTimeout(() => setShowVendorOptions(false), 200)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500"
                      placeholder="Search vendor name or code..."
                      autoComplete="off"
                    />
                    {showVendorOptions && (
                      <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {loadingVendors && <p className="px-4 py-3 text-sm text-gray-500">Loading vendors...</p>}
                        {!loadingVendors && vendorLoadError && (
                          <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-red-600">
                            <span>{vendorLoadError}</span>
                            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => fetchVendors(vendorSearch)} className="font-semibold text-purple-700">Retry</button>
                          </div>
                        )}
                        {!loadingVendors && !vendorLoadError && vendors.length === 0 && (
                          <p className="px-4 py-3 text-sm text-gray-500">No active vendors found.</p>
                        )}
                        {!loadingVendors && !vendorLoadError && vendors.map(vendor => {
                          const alreadySelected = (formData.selected_vendors || []).some(item => String(item.vendor_id || item.id) === String(vendor.id));
                          return (
                            <button
                              type="button"
                              key={vendor.id}
                              disabled={alreadySelected}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => addVendorToShortlist(vendor.id)}
                              className="block w-full border-b border-gray-100 px-4 py-3 text-left last:border-0 hover:bg-purple-50 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60"
                            >
                              <span className="block text-sm font-medium text-gray-900">{vendor.name}</span>
                              <span className="block text-xs text-gray-500">{vendor.vendor_code} · Rating: {vendor.rating || 'N/A'}{alreadySelected ? ' · Already shortlisted' : ''}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
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
                  Select a vendor from the dropdown to add it automatically. ICV values and validity are copied from the vendor portal.
                </p>
                {errors.selected_vendors && <p className="mt-1 text-sm text-red-600">{errors.selected_vendors}</p>}
                {(formData.selected_vendors || []).length > 0 && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
                    {(formData.selected_vendors || []).map(shortlisted => (
                      <div key={shortlisted.vendor_id || shortlisted.id} className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 last:border-0">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{shortlisted.name}</p>
                          <p className="text-xs text-gray-500">
                            {shortlisted.vendor_code || 'No vendor code'} · ICV {shortlisted.icv_percentage ?? 'N/A'}%
                            {shortlisted.icv_expiry_date ? ` · Valid until ${shortlisted.icv_expiry_date}` : ' · Validity not recorded'}
                          </p>
                        </div>
                        <button type="button" onClick={() => removeVendorFromShortlist(shortlisted.vendor_id || shortlisted.id)} className="rounded p-1 text-red-500 hover:bg-red-50" aria-label="Remove vendor">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
                            Score: {rec.score} | {rec.reasons.join(' | ')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              vendor_selection_reason: `AI recommended (score: ${rec.score}): ${rec.reasons.join(', ')}`,
                            }));
                            addVendorToShortlist(rec.vendor_id);
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
                   Selected Supplier <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.vendor || ''}
                  onChange={(event) => selectPreferredVendor(event.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">-- Select from shortlisted vendors --</option>
                  {(formData.selected_vendors || []).map(shortlisted => (
                    <option key={shortlisted.vendor_id || shortlisted.id} value={shortlisted.vendor_id || shortlisted.id}>{shortlisted.name}</option>
                  ))}
                </select>
                {errors.vendor && <p className="mt-1 text-sm text-red-600">{errors.vendor}</p>}
              </div>

              {(formData.selected_vendors || []).length === 1 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <label className="block text-sm font-semibold text-amber-900 mb-2">
                    Single Source Justification <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="single_source_justification"
                    value={formData.single_source_justification}
                    onChange={handleChange}
                    rows={3}
                    className="w-full rounded-lg border border-amber-300 px-4 py-2 focus:ring-2 focus:ring-amber-500"
                    placeholder="Explain why this purchase recommendation uses only one supplier..."
                  />
                  {errors.single_source_justification && <p className="mt-1 text-sm text-red-600">{errors.single_source_justification}</p>}
                </div>
              )}
              
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
              <span className="bg-purple-100 text-purple-700 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">5</span>
              Pricing Details
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                   Purchase Description <span className="text-red-500">*</span>
                   <span className="ml-2 text-xs font-normal text-gray-500">(From Purchase Description section)</span>
                </label>
                <textarea
                  name="price_description"
                  value={formData.price_description}
                  readOnly
                  rows={2}
                  className={`w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-700 ${
                    errors.price_description ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter the Purchase Description above; it will appear here automatically."
                />
                <p className="mt-1 text-xs text-gray-500">Automatically synchronized to prevent duplicate or conflicting descriptions.</p>
                {errors.price_description && (
                  <p className="mt-1 text-sm text-red-600">{errors.price_description}</p>
                )}
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">Line Items</h4>
                    <p className="text-xs text-gray-500">Quantity, unit price, line budget, and total are captured together.</p>
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
                          className="col-span-12 md:col-span-4 px-2 py-2 text-sm border border-gray-300 rounded"
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
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.budget ?? ''}
                          onChange={(e) => updateLineItem(index, 'budget', e.target.value)}
                          placeholder="Budget"
                          aria-label={`Line item ${index + 1} budget`}
                          className="col-span-4 md:col-span-2 px-2 py-2 text-sm border border-gray-300 rounded"
                        />
                        <div className="col-span-6 md:col-span-1 px-2 py-2 text-sm text-right font-medium">
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
                    <option value="INR">INR</option>
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
                    Net Total (excl. VAT)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="net_total_excl_vat"
                    value={formData.net_total_excl_vat}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                    placeholder="4000.00"
                  />
                  <p className="mt-1 text-xs text-gray-500">Calculated from the pricing total before VAT.</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Negotiation Remarks
                </label>
                <textarea
                  name="price_remarks"
                  value={formData.price_remarks}
                  onChange={handleChange}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Record negotiation outcome, agreed savings, commercial clarifications, or final terms"
                />
                <p className="mt-1 text-xs text-gray-500">Replaces the former Discount % field.</p>
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
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 6: Reference Section */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="bg-purple-100 text-purple-700 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">6</span>
              Reference
            </h3>
            <div className="relative">
              <fieldset>
                <legend className="block text-sm font-semibold text-gray-800 mb-2">PO Applicable?</legend>
                <div className="flex gap-6">
                  {[true, false].map(value => (
                    <label key={String(value)} className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="radio"
                        name="po_applicable_choice"
                        checked={formData.po_applicable === value}
                        onChange={() => setFormData(prev => ({ ...prev, po_applicable: value, ...(value ? {} : { po_number_reference: '' }) }))}
                      />
                      {value ? 'Yes' : 'No'}
                    </label>
                  ))}
                </div>
              </fieldset>
              {formData.po_applicable && <div className="relative mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PO Number <span className="text-red-500">*</span>
                <span className="ml-2 text-xs text-gray-500">(Only completed POs can be linked)</span>
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
                <p className={`mt-1 text-xs ${formData.po_number_reference.trim() ? 'text-red-600' : 'text-gray-500'}`}>
                  {formData.po_number_reference.trim()
                    ? 'No completed PO matches this number. Select an existing completed PO or choose No.'
                    : 'No completed purchase orders are available.'}
                </p>
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
              {errors.po_number_reference && <p className="mt-1 text-sm text-red-600">{errors.po_number_reference}</p>}
              </div>}
            </div>
          </div>

          {formData.currency === 'AED' && parseFloat(formData.total_price || 0) > 100000 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-4">
              <div>
                <h4 className="text-sm font-bold text-amber-900">Management Approval Required</h4>
                <p className="text-xs text-amber-800">PR value exceeds AED 100,000. Complete this before the approval workflow.</p>
              </div>
              <div className="flex gap-6">
                {[true, false].map(value => (
                  <label key={String(value)} className="inline-flex items-center gap-2 text-sm font-medium text-gray-800">
                    <input type="radio" name="management_approval" checked={formData.management_approval === value} onChange={() => setFormData(prev => ({ ...prev, management_approval: value }))} />
                    {value ? 'Yes' : 'No'}
                  </label>
                ))}
              </div>
              {errors.management_approval && <p className="text-sm text-red-600">{errors.management_approval}</p>}
              <textarea name="management_approval_remarks" value={formData.management_approval_remarks} onChange={handleChange} rows={2} className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm" placeholder="Management approval remarks" />
              {errors.management_approval_remarks && <p className="text-sm text-red-600">{errors.management_approval_remarks}</p>}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Evidence of Approval</label>
                <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={(event) => setManagementEvidenceFile(event.target.files?.[0] || null)} className="block w-full text-sm" />
                {(managementEvidenceFile || (formData.management_approval_evidence || []).length > 0) && <p className="mt-1 text-xs text-emerald-700">{managementEvidenceFile?.name || 'Existing evidence attached'}</p>}
                {errors.management_approval_evidence && <p className="mt-1 text-sm text-red-600">{errors.management_approval_evidence}</p>}
              </div>
            </div>
          )}

          {/* Section 7: Purchase Recommendation Section */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="bg-purple-100 text-purple-700 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">7</span>
              Purchase Recommendation
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Purchase Recommendation <span className="text-red-500">*</span>
              </label>
              <textarea
                name="purchase_recommendation"
                value={formData.purchase_recommendation}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Any special requirements or notes..."
              />
              {errors.purchase_recommendation && <p className="mt-1 text-sm text-red-600">{errors.purchase_recommendation}</p>}
            </div>
          </div>

          {/* Section 9: Approval Workflow Section */}
          <div className="order-last border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="bg-purple-100 text-purple-700 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">9</span>
              Approval Workflow
            </h3>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                {formData.requisition_type === 'project'
                  ? 'Project workflow: Level 1 \u2192 optional Level 2 \u2192 Level 3 \u2192 Level 4.'
                  : 'General workflow: Level 1 Department Manager \u2192 Level 2 Vice President.'}
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 rounded-lg border border-purple-200 bg-purple-50/40 p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Level 1 - Multiple Approvers (all must approve) <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr]">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-600">Number of approvers</label>
                      <input type="number" min="1" max="20" value={levelOneApproverCount} onChange={(e) => changeLevelOneCount(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                    </div>
                    <div className="relative">
                      <label className="mb-1 block text-xs font-semibold text-gray-600">Search any active employee</label>
                      <input value={levelOneSearch} onChange={(e) => setLevelOneSearch(e.target.value)} disabled={loadingApprovers || (selectedApprovers.level_one || []).length >= levelOneApproverCount} placeholder="Type employee name, email, ID, title, or department" className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                      {levelOneSearch.trim() && (selectedApprovers.level_one || []).length < levelOneApproverCount && (
                        <div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                          {projectManagers.filter(user => {
                            const haystack = `${user.full_name || ''} ${user.email || ''} ${user.employee_id || ''} ${user.job_title || ''} ${user.department || ''}`.toLowerCase();
                            return haystack.includes(levelOneSearch.trim().toLowerCase()) && !(selectedApprovers.level_one || []).includes(user.id);
                          }).slice(0, 20).map(user => (
                            <button key={user.id} type="button" onClick={() => addLevelOneApprover(user.id)} className="block w-full border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-purple-50 last:border-0">
                              <span className="font-semibold text-gray-900">{user.full_name || user.email}</span>
                              <span className="ml-2 text-xs text-gray-500">{user.job_title || user.department || user.employee_id}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(selectedApprovers.level_one || []).map(userId => {
                      const user = projectManagers.find(candidate => candidate.id === userId);
                      return <span key={userId} className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1.5 text-sm text-purple-800">{user?.full_name || userId}<button type="button" onClick={() => removeLevelOneApprover(userId)} className="font-bold hover:text-red-600" aria-label="Remove approver">&times;</button></span>;
                    })}
                    <span className={`px-2 py-1.5 text-xs font-semibold ${(selectedApprovers.level_one || []).length === levelOneApproverCount ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {(selectedApprovers.level_one || []).length} of {levelOneApproverCount} selected
                    </span>
                  </div>
                </div>
                
                <div className={formData.requisition_type === 'general' ? 'hidden' : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Level 2 - Manager of Engineering (MoE) <span className="text-gray-400">(Optional)</span>
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
                          ? '-- Select MoE (Optional) --'
                          : 'No eligible approvers available'}
                    </option>
                    {engineeringManagers.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.job_title_match ? '\u2605 ' : ''}{user.full_name}{user.job_title ? ` - ${user.job_title}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className={formData.requisition_type === 'general' ? 'hidden' : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Level 3 - Manager of Projects (MoP) <span className="text-red-500">*</span>
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
                          ? '-- Select MoP --'
                          : 'No eligible approvers available'}
                    </option>
                    {managerProjects.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.job_title_match ? '\u2605 ' : ''}{user.full_name}{user.job_title ? ` - ${user.job_title}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Level {formData.requisition_type === 'general' ? '2' : '4'} - {formData.requisition_type === 'general' ? 'Vice President' : 'VP Delivery'} <span className="text-red-500">*</span>
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
                          ? `-- Select ${formData.requisition_type === 'general' ? 'Vice President' : 'VP Delivery'} --`
                          : 'No eligible approvers available'}
                    </option>
                    {vpOperations.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.job_title_match ? '\u2605 ' : ''}{user.full_name}{user.job_title ? ` - ${user.job_title}` : ''}
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
                  <strong>Sequential routing:</strong> each level becomes active only after the previous level is approved.
                </p>
              </div>
            </div>
          </div>

          {/* Section 8: Attachments Section */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <span className="bg-purple-100 text-purple-700 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">8</span>
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
              {approvedPdfFile ? 'Record Signed PDF' : 'Save Draft'}
            </button>
            {!approvedPdfFile && <button
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
            </button>}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PurchaseRequisitionForm;
