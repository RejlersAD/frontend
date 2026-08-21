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

import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../../services/api.service';
import PurchaseOrderLivePreview from './PurchaseOrderLivePreview';
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

const PROJECT_FINAL_APPROVER = 'Jarmo Suominen';
const FINAL_APPROVER_TITLE = 'General Manager, VP';
const DEFAULT_INVOICE_CONTACT = 'Aneef Thadikkarantavida';
const DEFAULT_INVOICE_EMAIL = 'Aneef.Thadikkarantavida@rejlers.ae';
const DEFAULT_BUYER_REFERENCE = 'Richa Hannah Thomas';
const DEFAULT_ITEMS_TABLE_HEADERS = {
  line_code: 'Line Code',
  description: 'Item Description',
  specification: 'Specification / API/ASME Standard Tag',
  comment: 'Comment',
  quantity: 'Qty',
  uom: 'UOM',
  unit_price: 'Unit Price',
  discount: 'Discount',
  total_price: 'Total Price',
};

const employeeDesignation = (employee) => (
  employee?.designation
  || employee?.job_title
  || employee?.title
  || employee?.position
  || FINAL_APPROVER_TITLE
);

const defaultApprovalLog = () => [{
  stage: 'Final Management Sign-off',
  user_id: '',
  approver: PROJECT_FINAL_APPROVER,
  approver_email: '',
  status: 'Pending',
  date: '',
  comments: '',
}];

const mergeApprovalLog = (approvalLog) => defaultApprovalLog().map((defaultEntry) => ({
  ...defaultEntry,
  ...(Array.isArray(approvalLog)
    ? approvalLog.find((entry) => entry.stage === defaultEntry.stage)
    : null),
}));

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

const READ_ONLY_PO_FIELDS = new Set([
  'id',
  'po_date',
  'created_at',
  'updated_at',
  'status_display',
  'vendor_name',
  'pr_number',
  'project_name',
  'project_display',
]);

const buildPurchaseOrderPayload = (formData, status) => Object.fromEntries(
  Object.entries({ ...formData, status }).filter(([key, value]) => (
    !READ_ONLY_PO_FIELDS.has(key)
    && value !== null
    && value !== undefined
    && value !== ''
  ))
);

const normalizeRequisitionItems = (requisition) => {
  const title = requisition?.product_service || requisition?.title || requisition?.price_description || 'Purchase requisition item';
  const requisitionAmount = Number(
    requisition?.total_price
    || requisition?.net_total_excl_vat
    || requisition?.estimated_budget
    || 0
  );
  const sourceItems = Array.isArray(requisition?.items) ? requisition.items : [];

  if (!sourceItems.length) {
    return requisitionAmount > 0 ? [{
      line_code: '001',
      description: title,
      specification: '',
      comment: 'Pre-filled from PR amount',
      quantity: 1,
      uom: 'LOT',
      unit_price: requisitionAmount,
      discount: 0,
    }] : [];
  }

  return sourceItems.map((item, index) => {
    const quantity = Math.max(1, Number(item.quantity ?? item.qty ?? 1) || 1);
    const discount = Number(item.discount ?? item.discount_amount ?? 0) || 0;
    const explicitTotal = Number(item.total ?? item.total_price ?? item.amount ?? 0) || 0;
    const suppliedUnitPrice = Number(item.unit_price ?? item.unitPrice ?? item.rate ?? 0) || 0;
    const unitPrice = suppliedUnitPrice || (explicitTotal > 0 ? (explicitTotal + discount) / quantity : 0);

    return {
      ...item,
      line_code: item.line_code || item.code || String(index + 1).padStart(3, '0'),
      description: item.description || item.name || item.item || title,
      specification: item.specification || item.spec || '',
      comment: item.comment || item.remarks || '',
      quantity,
      uom: item.uom || item.unit || 'LOT',
      unit_price: Number(unitPrice.toFixed(2)),
      discount,
    };
  });
};

const PurchaseOrderForm = ({ isOpen, onClose, onSuccess, editData = null, prReference = null }) => {
  const savedInvoiceEmails = Array.isArray(editData?.invoicing_emails)
    ? editData.invoicing_emails
    : [DEFAULT_INVOICE_EMAIL];
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectLoadError, setProjectLoadError] = useState('');
  const [projectSearch, setProjectSearch] = useState(editData?.project_number || '');
  const [showProjectChoices, setShowProjectChoices] = useState(false);
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [newProject, setNewProject] = useState({ project_number: '', project_name: '' });
  const [projectCreating, setProjectCreating] = useState(false);
  const [projectLinking, setProjectLinking] = useState(false);
  const [projectCreateError, setProjectCreateError] = useState('');
  const [availableRequisitions, setAvailableRequisitions] = useState([]);
  const [selectedRequisition, setSelectedRequisition] = useState(prReference || null);
  const [prSearch, setPrSearch] = useState(prReference?.pr_number || editData?.pr_number || '');
  const [showPRChoices, setShowPRChoices] = useState(false);
  const [requisitionsLoading, setRequisitionsLoading] = useState(false);
  const [requisitionLoadError, setRequisitionLoadError] = useState('');
  const [poNumberLoading, setPONumberLoading] = useState(false);
  const poNumberRequestRef = useRef(0);
  const initiallyReservedPRRef = useRef(null);
  const autoSaveRequestRef = useRef(false);
  const persistedOrderIdRef = useRef(editData?.id || null);
  
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
    invoicing_attn: editData?.invoicing_attn || DEFAULT_INVOICE_CONTACT,
    invoicing_emails: savedInvoiceEmails,
    company_fax: editData?.company_fax || '+971 2 639 7448',
    
    // Buyer Reference
    buyer_reference_pm: editData?.buyer_reference_pm || DEFAULT_BUYER_REFERENCE,
    buyer_reference_email: editData?.buyer_reference_email || '',
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
    items: prReference ? normalizeRequisitionItems(prReference) : (editData?.items || []),
    items_table_headers: {
      ...DEFAULT_ITEMS_TABLE_HEADERS,
      ...(editData?.items_table_headers || {}),
    },
    
    // Approval Section
    approved_by_name: editData?.approved_by_name || PROJECT_FINAL_APPROVER,
    approved_by_title: editData?.approved_by_title || FINAL_APPROVER_TITLE,
    approved_date: editData?.approved_date || '',
    approved_at: editData?.approved_at || '',
    approval_signature: editData?.approval_signature || '',
    
    // Vendor Confirmation
    confirmation_date: editData?.confirmation_date || '',
    seller_contact_person: editData?.seller_contact_person || '',
    seller_phone: editData?.seller_phone || '',
    seller_email: editData?.seller_email || '',
    seller_address: editData?.seller_address || '',
    
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
    management_approver: editData?.management_approver || PROJECT_FINAL_APPROVER,
    approval_log: mergeApprovalLog(editData?.approval_log),
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
  const [approvalEmployees, setApprovalEmployees] = useState([]);
  const [approversLoading, setApproversLoading] = useState(false);
  const [approverLoadError, setApproverLoadError] = useState('');

  useEffect(() => {
    if (approvalEmployees.length === 0) return;
    const jarmo = approvalEmployees.find((employee) =>
      String(employee.full_name || '').trim().toLowerCase() === 'jarmo suominen'
    );
    setFormData((previous) => {
      const buyer = approvalEmployees.find((employee) =>
        String(employee.full_name || '').trim().toLowerCase()
          === String(previous.buyer_reference_pm || DEFAULT_BUYER_REFERENCE).trim().toLowerCase()
      ) || approvalEmployees.find((employee) =>
        String(employee.full_name || '').trim().toLowerCase() === DEFAULT_BUYER_REFERENCE.toLowerCase()
      );
      return {
        ...previous,
        buyer_reference_pm: buyer?.full_name || previous.buyer_reference_pm,
        buyer_reference_email: buyer?.email || previous.buyer_reference_email,
        ...(jarmo ? {
          management_approver: jarmo.full_name || jarmo.email,
          approved_by_name: jarmo.full_name || jarmo.email,
          approved_by_title: employeeDesignation(jarmo),
          approval_log: previous.approval_log.map((entry) => entry.stage === 'Final Management Sign-off'
            ? {
                ...entry,
                user_id: jarmo.id,
                approver: jarmo.full_name || jarmo.email,
                approver_email: jarmo.email,
                designation: employeeDesignation(jarmo),
                status: 'Pending',
                date: '',
              }
            : entry),
        } : {}),
      };
    });
  }, [approvalEmployees]);

  // Fetch the master data required to create a PO whenever the form is opened.
  useEffect(() => {
    if (isOpen) {
      fetchVendors();
      fetchProjects();
      fetchPOApprovers();
      if (!editData) fetchAvailableRequisitions();
    }
  }, [isOpen, editData]);

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
          formData.pr_reference &&
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
    setProjectsLoading(true);
    setProjectLoadError('');
    try {
      const response = await apiClient.get('/procurement/orders/available-projects/');
      const data = response.data;
      setProjects(normalizeApiArray(data));
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]);
      setProjectLoadError(error.response?.data?.detail || 'Existing projects could not be loaded.');
    } finally {
      setProjectsLoading(false);
    }
  };

  const fetchPOApprovers = async () => {
    setApproversLoading(true);
    setApproverLoadError('');
    try {
      const employeeResponse = await apiClient.get('/procurement/requisitions/get_approvers/', { params: { role: 'any_active' } });
      const usersFrom = (response) => {
        const payload = response?.data?.data || response?.data || {};
        return Array.isArray(payload.users) ? payload.users : [];
      };
      setApprovalEmployees(usersFrom(employeeResponse));
    } catch (error) {
      console.error('Error fetching PO approvers:', error);
      setApprovalEmployees([]);
      setApproverLoadError('Active employee approvers could not be loaded. Please retry.');
    } finally {
      setApproversLoading(false);
    }
  };

  const handleProjectSelect = async (project) => {
    if (!project) return;
    let selectedProject = project;
    if (project.source === 'core') {
      setProjectLinking(true);
      setProjectCreateError('');
      try {
        const response = await apiClient.post('/procurement/orders/create-project/', {
          source_project_id: project.source_project_id,
        });
        selectedProject = response.data;
        setProjects((prev) => [
          ...prev.filter((item) => item.id !== project.id && item.id !== selectedProject.id),
          selectedProject,
        ].sort((a, b) => String(a.project_number).localeCompare(
          String(b.project_number),
          undefined,
          { numeric: true }
        )));
      } catch (error) {
        const responseData = error.response?.data || {};
        setProjectCreateError(
          responseData.source_project_id
          || responseData.project_number
          || responseData.detail
          || 'The company project could not be linked to Procurement.'
        );
        setShowNewProjectForm(true);
        return;
      } finally {
        setProjectLinking(false);
      }
    }

    setProjectSearch(`${selectedProject.project_number} — ${selectedProject.project_name}`);
    setShowProjectChoices(false);
    setShowNewProjectForm(false);
    setProjectCreateError('');
    setFormData((prev) => ({
      ...prev,
      project: selectedProject.id,
      project_number: selectedProject.project_number,
    }));
  };

  const handleProjectSearch = (event) => {
    const value = event.target.value;
    setProjectSearch(value);
    setShowProjectChoices(true);
    const normalizedValue = value.trim().toLowerCase();
    const exactProject = projects.find((project) => (
      String(project.project_number || '').toLowerCase() === normalizedValue
      || `${project.project_number} — ${project.project_name}`.toLowerCase() === normalizedValue
    ));
    if (exactProject) {
      handleProjectSelect(exactProject);
      return;
    }
    setFormData((prev) => ({ ...prev, project: '' }));
  };

  const handleCreateProject = async () => {
    const projectNumber = newProject.project_number.trim();
    const projectName = newProject.project_name.trim();
    if (!projectNumber || !projectName) {
      setProjectCreateError('Project number and project title are required.');
      return;
    }

    setProjectCreating(true);
    setProjectCreateError('');
    try {
      const response = await apiClient.post('/procurement/orders/create-project/', {
        project_number: projectNumber,
        project_name: projectName,
      });
      const createdProject = response.data;
      setProjects((prev) => [...prev, createdProject].sort((a, b) => (
        String(a.project_number).localeCompare(String(b.project_number), undefined, { numeric: true })
      )));
      setNewProject({ project_number: '', project_name: '' });
      handleProjectSelect(createdProject);
    } catch (error) {
      const responseData = error.response?.data || {};
      setProjectCreateError(
        responseData.project_number
        || responseData.project_name
        || responseData.detail
        || 'The project could not be created.'
      );
    } finally {
      setProjectCreating(false);
    }
  };

  const fetchAvailableRequisitions = async () => {
    setRequisitionsLoading(true);
    setRequisitionLoadError('');
    try {
      const response = await apiClient.get('/procurement/orders/available-requisitions/');
      setAvailableRequisitions(normalizeApiArray(response.data));
    } catch (error) {
      console.error('Error fetching available requisitions:', error);
      setAvailableRequisitions([]);
      setRequisitionLoadError(
        error.response?.data?.detail || 'Existing Purchase Recommendations could not be loaded.'
      );
    } finally {
      setRequisitionsLoading(false);
    }
  };

  useEffect(() => {
    if (formData.vendor && vendors.length) {
      const vendor = vendors.find((v) => String(v.id) === String(formData.vendor));
      if (vendor) setSelectedVendor(vendor);
    }
  }, [vendors, formData.vendor]);

  const handleAutoSave = async () => {
    const persistedOrderId = editData?.id || draftId || persistedOrderIdRef.current;
    // Do not race the user's first explicit Create request with a background
    // POST. Auto-save starts after the PO has a server-side draft ID.
    if (!persistedOrderId) return;
    if (autoSaveRequestRef.current) return;
    autoSaveRequestRef.current = true;
    setAutoSaving(true);
    try {
      const payload = buildPurchaseOrderPayload(formData, 'draft');
      await apiClient.patch(`/procurement/orders/${persistedOrderId}/`, payload);
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      autoSaveRequestRef.current = false;
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
      seller_address: vendor?.address || prev.seller_address,
      seller_license_no: vendor?.trade_license_number || prev.seller_license_no,
      category: vendor?.categories?.[0] || prev.category,
    }));

    if (errors.vendor) {
      setErrors((prev) => ({ ...prev, vendor: null }));
    }
  };

  const reservePONumber = async (requisition) => {
    const requestId = ++poNumberRequestRef.current;
    setPONumberLoading(true);
    setFormData((prev) => ({ ...prev, po_number: '' }));
    try {
      const response = await apiClient.post('/procurement/orders/reserve-number/', {
        pr_reference: requisition.id,
      });
      if (requestId !== poNumberRequestRef.current) return;
      setFormData((prev) => ({ ...prev, po_number: response.data.po_number || '' }));
      setErrors((prev) => ({ ...prev, po_number: null }));
    } catch (error) {
      if (requestId !== poNumberRequestRef.current) return;
      const message = error.response?.data?.pr_reference
        || error.response?.data?.po_number
        || 'RADAI could not generate the PO number.';
      setErrors((prev) => ({ ...prev, po_number: message }));
      setPopupError(message);
    } finally {
      if (requestId === poNumberRequestRef.current) setPONumberLoading(false);
    }
  };

  const handleRequisitionSelect = (requisition) => {
    if (!requisition) return;
    const totalAmount = requisition.total_price
      || requisition.net_total_excl_vat
      || requisition.estimated_budget
      || '';
    const title = requisition.product_service || requisition.title || '';
    const normalizedItems = normalizeRequisitionItems(requisition);
    const requisitionProject = Array.isArray(requisition.project_details)
      ? requisition.project_details[0]
      : null;
    const projectReference = requisitionProject?.project_number
      || requisitionProject?.project_name
      || requisition.project_department
      || requisition.project
      || '';
    const linkedProject = projects.find((project) => (
      String(project.id) === String(requisitionProject?.project_id || '')
      || String(project.project_number || '').toLowerCase() === String(projectReference).trim().toLowerCase()
      || String(projectReference).toLowerCase().includes(String(project.project_number || '').toLowerCase())
    ));

    setSelectedRequisition(requisition);
    setPrSearch(requisition.pr_number || '');
    setProjectSearch(linkedProject
      ? `${linkedProject.project_number} — ${linkedProject.project_name}`
      : String(projectReference));
    setShowPRChoices(false);
    setCurrentSection(1);
    setFormData((prev) => ({
      ...prev,
      pr_reference: requisition.id,
      pr_requester_name: requisition.issued_by_name || requisition.requested_by_name || '',
      vendor: requisition.vendor || '',
      title,
      description: requisition.description_reason || prev.description,
      summary: prev.summary || title,
      category: requisition.category || prev.category,
      total_amount: totalAmount,
      currency: requisition.currency || prev.currency,
      project: linkedProject?.id || '',
      project_number: linkedProject?.project_number || projectReference || prev.project_number,
      expected_delivery: requisition.required_date || prev.expected_delivery,
      items: normalizedItems,
      scope_of_services: requisition.description_reason || prev.scope_of_services,
      final_approver_notes: requisition.purchase_recommendation || prev.final_approver_notes,
      management_approver: PROJECT_FINAL_APPROVER,
      approved_by_name: PROJECT_FINAL_APPROVER,
      approved_by_title: FINAL_APPROVER_TITLE,
      approval_log: (Array.isArray(prev.approval_log) && prev.approval_log.length
        ? prev.approval_log
        : defaultApprovalLog()
      ).map((entry) => entry.stage === 'Final Management Sign-off'
        ? {
            ...entry,
            approver: PROJECT_FINAL_APPROVER,
          }
        : entry),
    }));
    setErrors((prev) => ({ ...prev, pr_reference: null }));
    setPopupError('');
    reservePONumber(requisition);
  };

  const handlePONumberChange = (event) => {
    poNumberRequestRef.current += 1;
    setPONumberLoading(false);
    const value = event.target.value.toUpperCase().replaceAll(' ', '');
    setFormData((prev) => ({ ...prev, po_number: value }));
    setErrors((prev) => ({ ...prev, po_number: null }));
  };

  useEffect(() => {
    if (
      isOpen
      && !editData
      && prReference?.id
      && !formData.po_number
      && initiallyReservedPRRef.current !== prReference.id
    ) {
      initiallyReservedPRRef.current = prReference.id;
      reservePONumber(prReference);
    }
  }, [isOpen, editData, prReference?.id]);

  const handleRequisitionSearch = (event) => {
    const value = event.target.value;
    setPrSearch(value);
    setShowPRChoices(true);

    const exactMatch = availableRequisitions.find(
      (requisition) => String(requisition.pr_number || '').toLowerCase() === value.trim().toLowerCase()
    );
    if (exactMatch) {
      handleRequisitionSelect(exactMatch);
      return;
    }

    setSelectedRequisition(null);
    setCurrentSection(1);
    poNumberRequestRef.current += 1;
    setPONumberLoading(false);
    setFormData((prev) => ({ ...prev, pr_reference: null, po_number: '' }));
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

  const handleApprovalSelection = (index, userId) => {
    const employee = approvalEmployees.find((candidate) => String(candidate.id) === String(userId));
    setFormData((previous) => {
      const approvalLog = [...previous.approval_log];
      approvalLog[index] = {
        ...approvalLog[index],
        user_id: employee?.id || '',
        approver: employee?.full_name || employee?.email || '',
        approver_email: employee?.email || '',
        status: 'Pending',
        date: '',
      };
      return {
        ...previous,
        approval_log: approvalLog,
        management_approver: employee?.full_name || employee?.email || '',
        approved_by_name: employee?.full_name || employee?.email || '',
        approved_by_title: employeeDesignation(employee),
      };
    });
    if (errors.approval_log) setErrors((previous) => ({ ...previous, approval_log: null }));
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

  const handleBuyerReferenceSelection = (employeeId) => {
    const employee = approvalEmployees.find((candidate) => String(candidate.id) === String(employeeId));
    setFormData((previous) => ({
      ...previous,
      buyer_reference_pm: employee?.full_name || employee?.email || '',
      buyer_reference_email: employee?.email || '',
    }));
  };

  const updateItemsTableHeader = (field, value) => {
    setFormData(prev => ({
      ...prev,
      items_table_headers: {
        ...DEFAULT_ITEMS_TABLE_HEADERS,
        ...prev.items_table_headers,
        [field]: value,
      },
    }));
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

  const requiredApprovalStages = ['Final Management Sign-off'];
  const assignedApprovalStages = new Set(
    formData.approval_log.filter((entry) => entry.user_id || entry.approver).map((entry) => entry.stage)
  );
  const missingApprovalStages = requiredApprovalStages.filter((stage) => !assignedApprovalStages.has(stage));

  const validateForm = (requireSummary = false) => {
    const newErrors = {};
    
    if (!formData.pr_reference) newErrors.pr_reference = 'An existing Purchase Requisition is required';
    if (!formData.po_number?.trim()) {
      newErrors.po_number = 'PO number is required';
    } else if (!/^RAD-(GEN|PRJ)-PUR-\d{4,}_\d{4}$/.test(formData.po_number.trim())) {
      newErrors.po_number = 'Use RAD-{GEN|PRJ}-PUR-####_YYYY format';
    }
    if (!formData.vendor) newErrors.vendor = 'Vendor is required';
    if (!formData.title?.trim()) newErrors.title = 'Title is required';
    if (!formData.total_amount || parseFloat(formData.total_amount) <= 0) {
      newErrors.total_amount = 'Valid total amount is required';
    }
    if (!formData.payment_terms?.trim()) newErrors.payment_terms = 'Payment terms are required';
    if (requireSummary && !formData.summary?.trim()) newErrors.summary = 'Summary is required before sending to vendor';
    if (requireSummary && missingApprovalStages.length) {
      newErrors.approval_log = `Select an active employee for: ${missingApprovalStages.join(', ')}`;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e, sendToVendor = false) => {
    e.preventDefault();

    if (!validateForm(sendToVendor)) {
      const validationMessage = !formData.pr_reference
        ? 'Please select an existing Purchase Requisition.'
        : !/^RAD-(GEN|PRJ)-PUR-\d{4,}_\d{4}$/.test(formData.po_number?.trim() || '')
          ? 'Please use a valid RAD Purchase Order number.'
        : !formData.vendor
          ? 'Please select a vendor.'
        : !formData.title?.trim()
          ? 'Please enter a purchase order title.'
          : !formData.total_amount || Number(formData.total_amount) <= 0
            ? 'Please add at least one priced line item.'
            : !formData.payment_terms?.trim()
              ? 'Please enter the payment terms.'
              : missingApprovalStages.length
                ? `Please select: ${missingApprovalStages.join(', ')}.`
                : 'Please add a short summary before sending to the vendor.';
      setPopupError(validationMessage);
      setCurrentSection(missingApprovalStages.length ? 6
        : !formData.pr_reference || !formData.po_number?.trim() || !formData.vendor || !formData.title?.trim() || (sendToVendor && !formData.summary?.trim()) ? 1 : 2);
      setTimeout(() => setPopupError(''), 6000);
      return;
    }

    setSubmitLoading(true);
    
    try {
      const payload = buildPurchaseOrderPayload(
        formData,
        sendToVendor ? 'sent' : (editData?.status || 'draft')
      );
      let submitData = payload;
      let config;

      // Use the normal JSON API for ordinary PO creation. Multipart is only
      // required when the user actually attaches files.
      if (files.length) {
        submitData = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          submitData.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
        });
        files.forEach((file) => submitData.append('attachments_files', file));
        config = {
          onUploadProgress: (progressEvent) => {
            if (!progressEvent.total) return;
            setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
          },
        };
      }
      
      let response;
      const persistedOrderId = editData?.id || draftId || persistedOrderIdRef.current;
      if (persistedOrderId) {
        response = await apiClient.patch(`/procurement/orders/${persistedOrderId}/`, submitData, config);
      } else {
        response = await apiClient.post('/procurement/orders/', submitData, config);
        persistedOrderIdRef.current = response.data.id;
        setDraftId(response.data.id);
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

  const isNewOrder = !editData;
  const hasRequiredRequisition = !isNewOrder || Boolean(formData.pr_reference && selectedRequisition);
  const effectiveRequisition = selectedRequisition || prReference || (
    editData?.pr_reference ? { id: editData.pr_reference, pr_number: editData.pr_number } : null
  );
  const normalizedPRSearch = prSearch.trim().toLowerCase();
  const filteredRequisitions = availableRequisitions.filter((requisition) => {
    if (!normalizedPRSearch) return true;
    return [
      requisition.pr_number,
      requisition.product_service,
      requisition.title,
      requisition.vendor_name,
      requisition.supplier_name,
      requisition.project_department,
    ].some((value) => String(value || '').toLowerCase().includes(normalizedPRSearch));
  }).slice(0, normalizedPRSearch ? 50 : undefined);
  const normalizedProjectSearch = projectSearch.trim().toLowerCase();
  const filteredProjects = projects.filter((project) => {
    if (!normalizedProjectSearch) return true;
    if (String(project.id) === String(formData.project)) return true;
    return [project.project_number, project.project_name].some((value) => (
      String(value || '').toLowerCase().includes(normalizedProjectSearch)
    ));
  }).slice(0, 15);

  const selectedBuyerEmployee = approvalEmployees.find((employee) =>
    String(employee.full_name || employee.email || '').trim().toLowerCase()
      === String(formData.buyer_reference_pm || '').trim().toLowerCase()
  );

  const sections = [
    { id: 1, name: 'Header & Seller', icon: BuildingOfficeIcon },
    { id: 2, name: 'Buyer & Payment', icon: CurrencyDollarIcon },
    { id: 3, name: 'Project Details', icon: DocumentCheckIcon },
    { id: 4, name: 'POD/Scope', icon: DocumentTextIcon },
    { id: 5, name: 'Items & Pricing', icon: CurrencyDollarIcon },
    { id: 6, name: 'Contract Terms', icon: DocumentTextIcon },
    { id: 7, name: 'Contacts & Approval', icon: UserGroupIcon },
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
      <div className="flex h-[94vh] w-full max-w-[96vw] flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
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
                  {effectiveRequisition && ` • From PR: ${effectiveRequisition.pr_number}`}
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
                disabled={isNewOrder && !hasRequiredRequisition && section.id !== 1}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                  currentSection === section.id
                    ? 'bg-blue-100 text-blue-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent'
                }`}
              >
                <section.icon className="h-5 w-5" />
                <span className="text-sm">{section.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="grid min-h-0 flex-1 overflow-y-auto xl:grid-cols-[minmax(0,1.25fr)_minmax(400px,0.75fr)] xl:overflow-hidden">
          <div className="min-w-0 px-8 py-6 xl:overflow-y-auto">
          
          {/* Section 1: Header & Seller */}
          {currentSection === 1 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Header & Seller Information</h3>
                  <p className="text-sm text-gray-500">Capture the purchase order header and supplier details needed for PO creation.</p>
                </div>
              </div>

              <div className="rounded-2xl border-2 border-blue-200 bg-blue-50/60 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <label htmlFor="po-pr-search" className="block text-sm font-bold text-gray-900">
                      Existing PR Number <span className="text-red-600">*</span>
                    </label>
                    <p className="mt-1 text-xs text-gray-600">All PRs created in RADAI are available, including PRs already used by another PO.</p>
                  </div>
                  {selectedRequisition && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                      <CheckCircleIcon className="h-4 w-4" /> PR linked
                    </span>
                  )}
                </div>

                {isNewOrder ? (
                  <div className="relative mt-3">
                    <input
                      id="po-pr-search"
                      type="search"
                      value={prSearch}
                      onChange={handleRequisitionSearch}
                      onFocus={() => setShowPRChoices(true)}
                      onBlur={() => window.setTimeout(() => setShowPRChoices(false), 150)}
                      autoComplete="off"
                      placeholder={requisitionsLoading ? 'Loading existing PRs…' : 'Type or select an existing PR number…'}
                      disabled={requisitionsLoading}
                      aria-autocomplete="list"
                      aria-expanded={showPRChoices}
                      aria-controls="available-pr-options"
                      className={`block w-full rounded-xl border bg-white px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 ${errors.pr_reference ? 'border-red-500' : 'border-gray-300'}`}
                    />

                    {showPRChoices && !requisitionsLoading && !requisitionLoadError && (
                      <div id="available-pr-options" role="listbox" className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl">
                        {filteredRequisitions.length ? filteredRequisitions.map((requisition) => (
                          <button
                            key={requisition.id}
                            type="button"
                            role="option"
                            aria-selected={String(requisition.id) === String(formData.pr_reference)}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleRequisitionSelect(requisition)}
                            className="block w-full rounded-lg px-3 py-3 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                          >
                            <span className="block text-sm font-bold text-blue-700">{requisition.pr_number}</span>
                            <span className="mt-0.5 block truncate text-xs text-gray-700">{requisition.product_service || requisition.title || 'No purchase description'}</span>
                            <span className="mt-1 block text-[11px] text-gray-500">
                              {[requisition.status_display || requisition.status, requisition.vendor_name || requisition.supplier_name, requisition.project_department].filter(Boolean).join(' • ')}
                            </span>
                          </button>
                        )) : (
                          <p className="px-3 py-5 text-center text-sm text-gray-500">No available existing PR matches your search.</p>
                        )}
                      </div>
                    )}

                    {requisitionLoadError && (
                      <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        <span>{requisitionLoadError}</span>
                        <button type="button" onClick={fetchAvailableRequisitions} className="font-bold underline">Retry</button>
                      </div>
                    )}
                    {errors.pr_reference && <p className="mt-1 text-xs font-medium text-red-600">{errors.pr_reference}</p>}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-blue-700">
                    {effectiveRequisition?.pr_number || 'Legacy PO — no linked PR'}
                  </div>
                )}

                {selectedRequisition && (
                  <div className="mt-3 grid gap-2 rounded-xl border border-blue-100 bg-white/80 p-3 text-xs text-gray-700 sm:grid-cols-3">
                    <div><span className="font-semibold text-gray-500">Purchase:</span><br />{selectedRequisition.product_service || selectedRequisition.title || '—'}</div>
                    <div><span className="font-semibold text-gray-500">Supplier:</span><br />{selectedRequisition.vendor_name || selectedRequisition.supplier_name || '—'}</div>
                    <div><span className="font-semibold text-gray-500">PR Amount:</span><br />{selectedRequisition.currency || 'AED'} {Number(selectedRequisition.total_price || selectedRequisition.net_total_excl_vat || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                  </div>
                )}
              </div>

              {!hasRequiredRequisition ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-center">
                  <DocumentCheckIcon className="mx-auto h-10 w-10 text-amber-500" />
                  <h4 className="mt-3 font-bold text-amber-900">Select an existing PR to continue</h4>
                  <p className="mt-1 text-sm text-amber-700">RADAI will link the PO to that requisition and prefill the available supplier, scope, project, pricing, and delivery data.</p>
                </div>
              ) : (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">PO Number *</label>
                    <input
                      type="text"
                      value={formData.po_number}
                      onChange={handlePONumberChange}
                      readOnly={poNumberLoading}
                      className={`mt-1 block w-full rounded-md border bg-white px-3 py-2 text-sm font-semibold uppercase text-gray-900 focus:border-blue-500 focus:ring-blue-500 ${errors.po_number ? 'border-red-500' : 'border-gray-300'} ${poNumberLoading ? 'cursor-wait bg-gray-100' : ''}`}
                      placeholder={poNumberLoading ? 'Generating PO number…' : 'RAD-PRJ-PUR-####_YYYY'}
                    />
                    {poNumberLoading && <p className="mt-1 text-xs text-blue-600">Generating the next PO number from the selected PR…</p>}
                    {!poNumberLoading && !errors.po_number && <p className="mt-1 text-xs text-gray-500">Auto-generated after PR selection. You may edit it while keeping the RAD format.</p>}
                    {errors.po_number && <p className="mt-1 text-xs font-medium text-red-600">{errors.po_number}</p>}
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
                    <label className="block text-sm font-medium text-gray-700">Contact Person Name</label>
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
                    <label className="block text-sm font-medium text-gray-700">Email</label>
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
                    <label className="block text-sm font-medium text-gray-700">Phone Number</label>
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
                    <label className="block text-sm font-medium text-gray-700">Address</label>
                    <textarea
                      name="seller_address"
                      value={formData.seller_address}
                      onChange={handleChange}
                      rows={2}
                      className="mt-1 block w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Seller office or registered address"
                    />
                  </div>
                </div>
              </div>
              )}
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
                      readOnly
                      className="mt-1 block w-full cursor-not-allowed rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Default PO invoicing contact · {DEFAULT_INVOICE_EMAIL}
                    </p>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700">Buyer Reference</label>
                  <select
                    value={selectedBuyerEmployee?.id || ''}
                    onChange={(event) => handleBuyerReferenceSelection(event.target.value)}
                    disabled={approversLoading}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">{approversLoading ? 'Loading RADAI employees...' : '-- Select existing employee --'}</option>
                    {approvalEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name || employee.email}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">{formData.buyer_reference_email || `Default: ${DEFAULT_BUYER_REFERENCE}. Email is fetched from RADAI.`}</p>
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
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <label htmlFor="po-project-search" className="block text-sm font-medium text-gray-700">Project Name and Number</label>
                      <p className="mt-1 text-xs text-gray-500">Search by project number or project title.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewProjectForm((current) => !current);
                        setProjectCreateError('');
                      }}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
                    >
                      {showNewProjectForm ? 'Cancel New Project' : '+ Create New Project'}
                    </button>
                  </div>

                  <div className="relative mt-3">
                    <input
                      id="po-project-search"
                      type="search"
                      value={projectSearch}
                      onChange={handleProjectSearch}
                      onFocus={() => setShowProjectChoices(true)}
                      onBlur={() => window.setTimeout(() => setShowProjectChoices(false), 150)}
                      autoComplete="off"
                      placeholder={projectsLoading ? 'Loading existing projects…' : projectLinking ? 'Linking project to Procurement…' : 'Type a project number or name…'}
                      disabled={projectsLoading || projectLinking}
                      aria-autocomplete="list"
                      aria-expanded={showProjectChoices}
                      aria-controls="project-options"
                      className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />

                    {showProjectChoices && !projectsLoading && !projectLoadError && (
                      <div id="project-options" role="listbox" className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl">
                        {filteredProjects.length ? filteredProjects.map((project) => (
                          <button
                            key={project.id}
                            type="button"
                            role="option"
                            aria-selected={String(project.id) === String(formData.project)}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleProjectSelect(project)}
                            className="block w-full rounded-lg px-3 py-3 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                          >
                            <span className="block text-sm font-bold text-blue-700">{project.project_number}</span>
                            <span className="mt-0.5 block text-xs text-gray-700">{project.project_name}</span>
                            <span className="mt-1 block text-[11px] text-gray-500">{project.status_display || project.status}</span>
                          </button>
                        )) : (
                          <div className="px-3 py-5 text-center">
                            <p className="text-sm text-gray-500">No existing project matches this search.</p>
                            <button
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                setNewProject((prev) => ({ ...prev, project_number: projectSearch.trim() }));
                                setShowNewProjectForm(true);
                                setShowProjectChoices(false);
                              }}
                              className="mt-2 text-xs font-bold text-blue-700 underline"
                            >
                              Create it as a new project
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {projectLoadError && (
                    <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      <span>{projectLoadError}</span>
                      <button type="button" onClick={fetchProjects} className="font-bold underline">Retry</button>
                    </div>
                  )}

                  {showNewProjectForm && (
                    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
                      <h4 className="text-sm font-bold text-gray-900">Create New Project</h4>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700">Project Number *</label>
                          <input
                            type="text"
                            value={newProject.project_number}
                            onChange={(event) => setNewProject((prev) => ({ ...prev, project_number: event.target.value }))}
                            placeholder="e.g. 5901055"
                            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700">Project Title *</label>
                          <input
                            type="text"
                            value={newProject.project_name}
                            onChange={(event) => setNewProject((prev) => ({ ...prev, project_name: event.target.value }))}
                            placeholder="Enter the project title"
                            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      {projectCreateError && <p className="mt-2 text-xs font-medium text-red-600">{projectCreateError}</p>}
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={handleCreateProject}
                          disabled={projectCreating}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {projectCreating ? 'Creating…' : 'Create and Select Project'}
                        </button>
                      </div>
                    </div>
                  )}
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

          {/* Section 4: PO Description and Scope */}
          {currentSection === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="border-b pb-2 text-lg font-semibold text-gray-900">PO Description &amp; Scope</h3>
                <p className="text-sm text-gray-500">Edit the PO narrative and detailed scope. Changes appear immediately in the live preview.</p>
              </div>
              <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div>
                  <label className="block text-sm font-medium text-gray-700">PO Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={8}
                    className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Enter the editable purchase order description or paste formatted Word text here."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Scope</label>
                  <textarea
                    name="scope_of_services"
                    value={formData.scope_of_services}
                    onChange={handleChange}
                    rows={10}
                    className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Enter the complete PO scope. Long content automatically creates additional preview pages."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section 5: Items & Pricing */}
          {currentSection === 5 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Items & Pricing</h3>
                  <p className="text-sm text-gray-500">Edit any column heading directly. Clear a heading to hide that column from the live and printed PO preview.</p>
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
                      {Object.entries(DEFAULT_ITEMS_TABLE_HEADERS).map(([field, defaultLabel]) => (
                        <th key={field} className="px-2 py-2 text-left">
                          <input
                            type="text"
                            value={formData.items_table_headers?.[field] ?? defaultLabel}
                            onChange={(event) => updateItemsTableHeader(field, event.target.value)}
                            aria-label={`Edit ${defaultLabel} column heading`}
                            title="Editable table heading"
                            className="min-w-24 w-full rounded border border-blue-200 bg-white px-2 py-1.5 text-xs font-semibold uppercase text-gray-600 focus:border-blue-500 focus:ring-blue-500"
                          />
                        </th>
                      ))}
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

          {/* Section 6: Contract Terms */}
          {currentSection === 6 && (
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

          {/* Section 7: Contacts & Approval */}
          {currentSection === 7 && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Final Approval Notes</h3>
                  <p className="text-sm text-gray-500">Use this field for any final instructions, exceptions, or handover comments from approvers.</p>
                </div>
                <textarea
                  name="final_approver_notes"
                  value={formData.final_approver_notes}
                  onChange={handleChange}
                  rows={5}
                  className="mt-4 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Final sign-off notes, approval comments, or routing remarks..."
                />
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Final Signatory</h3>
                    <p className="text-sm text-gray-500">The final signatory and designation are fetched from the RADAI employee directory.</p>
                  </div>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Signatory</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Approver</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Routing Comments</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {formData.approval_log.map((entry, index) => (
                        <tr key={entry.stage}>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-gray-900">{entry.approver || PROJECT_FINAL_APPROVER}</td>
                          <td className="px-4 py-3">
                            <select
                              value={entry.user_id || ''}
                              onChange={(e) => handleApprovalSelection(index, e.target.value)}
                              disabled
                              className="block w-full rounded-md border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                            >
                              <option value="">{approversLoading ? 'Loading active employees...' : '-- Select active employee --'}</option>
                              {approvalEmployees.map((employee) => (
                                <option key={employee.id} value={employee.id}>
                                  {employee.full_name || employee.email}{employee.job_title ? ` — ${employee.job_title}` : ''}{employee.department ? ` (${employee.department})` : ''}
                                </option>
                              ))}
                            </select>
                            <p className="mt-1 text-xs text-gray-500">{formData.approved_by_title || FINAL_APPROVER_TITLE}</p>
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
                {approverLoadError && (
                  <div className="mt-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <span>{approverLoadError}</span>
                    <button type="button" onClick={fetchPOApprovers} className="font-semibold underline">Retry</button>
                  </div>
                )}
                {errors.approval_log && <p className="mt-3 text-sm font-medium text-red-600">{errors.approval_log}</p>}
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

          </div>
          <aside className="min-h-[760px] overflow-hidden border-t border-slate-300 xl:min-h-0 xl:border-l xl:border-t-0" aria-label="Live purchase order preview">
            <PurchaseOrderLivePreview formData={formData} vendor={selectedVendor} files={files} />
          </aside>
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
              onClick={() => setCurrentSection(Math.min(7, currentSection + 1))}
              disabled={currentSection === 7 || !hasRequiredRequisition}
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
              disabled={submitLoading || !hasRequiredRequisition}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {submitLoading ? 'Saving...' : editData ? 'Save Changes' : 'Save Draft'}
            </button>
            {(!editData || editData.status === 'draft') && (
              <button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={submitLoading || !hasRequiredRequisition}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {submitLoading ? 'Sending...' : 'Send to Vendor'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderForm;
