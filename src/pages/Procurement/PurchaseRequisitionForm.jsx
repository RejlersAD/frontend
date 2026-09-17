import { radaiAlert } from '../../services/radaiDialog'
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
import PropTypes from 'prop-types';
import { Save as SaveIcon } from 'lucide-react';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';
import apiClient from '../../services/api.service';
import { uploadSignedRequisitionPdf, validateSignedRequisitionPdf } from './PurchaseRequisitionPdfImport';
import RecommendationPreviewPane from './RecommendationPreviewPane';
import RecommendationSupplierPricing from './RecommendationSupplierPricing';
import RecordedApprovalHistory from './RecordedApprovalHistory';
import PendingApprovalAssignments, { approvalReassignmentCommands, retainCurrentApprovalAssignments } from './PendingApprovalAssignments';
import { prepareRecommendationPayload } from './recommendationFormPayload';
import { hydrateRecommendationReferences, preserveRecordedApprovalWorkflow, recommendationLineError } from './recommendationFormState';
import { confirmedRecommendationVat, hasCompleteRecommendationPricing, recommendationVat, recommendationLineDiscount } from './recommendationVat';
import { calculateProcurementVat, procurementLineNet, sumProcurementMoney } from '../../utils/procurementVat';
import './PurchaseRequisitionForm.css';
import useOrganizationCatalog from '../../hooks/useOrganizationCatalog';
import { vicePresidentPositionFromWorkflow } from './recommendationApprovalPositions';
import { AED_EXCHANGE_RATES, convertToAed } from '../../config/procurement.config';
import { employeeDisplayName, nameOnly } from '../../utils/employeeDisplayName';
import {
  PaperClipIcon,
  CheckCircleIcon,
  XCircleIcon,
  CloudArrowUpIcon,
  PlusIcon,
  XMarkIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  PencilSquareIcon,
  CheckIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 10;
const registrationWarningsFrom = record => Array.isArray(record?.registration_warnings)
  ? record.registration_warnings.filter(message => typeof message === 'string' && message.trim()) : [];
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg'
]);


const normalizeApiErrors = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  const message = value => Array.isArray(value) ? value.map(message).join(' ')
    : value && typeof value === 'object' ? Object.entries(value).map(([key, detail]) => `${key}: ${message(detail)}`).join(' ')
      : String(value);
  return Object.fromEntries(Object.entries(payload).map(([field, value]) => [field, message(value)]));
};

const firstApiError = (errors) => {
  const labels = {
    po_number_reference: 'PO Number',
    items: 'Line items',
    approval_workflow_config: 'Approval Workflow',
    approval_reassignments: 'Pending approvers',
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

const employeeSearchText = (employee) => [
  employee.full_name,
  employee.username,
  employee.email,
  employee.employee_id,
  employee.job_title,
  employee.department,
].filter(Boolean).join(' ').toLowerCase();

const findEmployeeById = (employees = [], userId) => employees.find(
  employee => String(employee?.id) === String(userId),
);

const normalizeUserId = (userId) => (
  userId === null || userId === undefined || userId === '' ? null : String(userId)
);

const savedApproverById = (workflow = [], userId) => workflow.find((stage) => (
  String(stage?.user_id ?? stage?.approver_id ?? '') === String(userId)
));

const savedApproverName = (workflow = [], userId) => {
  const stage = savedApproverById(workflow, userId);
  return nameOnly(stage?.user_name || stage?.approver_name || stage?.approver || '') || 'Selected employee';
};

const ActiveEmployeePicker = ({
  label,
  value,
  employees,
  onChange,
  required = false,
  disabled = false,
  helperText = '',
  tableSuffix = '',
  onTableSuffixChange = null,
  hideLabel = false,
}) => {
  const [search, setSearch] = useState('');
  const selected = employees.find(employee => String(employee.id) === String(value));
  const matches = employees.filter(employee => employeeSearchText(employee).includes(search.trim().toLowerCase())).slice(0, 20);

  return (
    <div>
      {!hideLabel && <label className="mb-2 block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>}
      {selected ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{employeeDisplayName(selected)}</p>
            {selected.job_title && <p className="truncate text-xs text-gray-600">{selected.job_title}</p>}
          </div>
          {!disabled && <button type="button" onClick={() => { onChange(''); setSearch(''); }} className="shrink-0 text-xs font-semibold text-purple-700 hover:text-red-600">Edit</button>}
        </div>
      ) : (
        <div className="relative">
          <input
            value={search}
            aria-label={label}
            onChange={(event) => setSearch(event.target.value)}
            disabled={disabled}
            placeholder="Search active employee by name, email, ID, title, or department"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
          />
          {search.trim() && !disabled && (
            <div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {matches.length ? matches.map(employee => (
                <button key={employee.id} type="button" onClick={() => { onChange(employee.id); setSearch(''); }} className="block w-full border-b border-gray-100 px-3 py-2 text-left hover:bg-purple-50 last:border-0">
                  <span className="block text-sm font-semibold text-gray-900">{employeeDisplayName(employee)}</span>
                  <span className="block text-xs text-gray-500">{[employee.job_title, employee.department].filter(Boolean).join(' · ') || 'Active employee'}</span>
                </button>
              )) : <p className="px-3 py-2 text-xs text-gray-500">No active employee matches this search.</p>}
            </div>
          )}
        </div>
      )}
      {helperText && <p className="mt-1 text-xs text-gray-500">{helperText}</p>}
      {onTableSuffixChange && (
        <div className="mt-3">
          <label className="mb-1 block text-xs font-semibold text-gray-600">Approval table suffix</label>
          <input
            value={tableSuffix}
            aria-label={`${label} table suffix`}
            onChange={(event) => onTableSuffixChange(event.target.value.slice(0, 20))}
            maxLength={20}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-purple-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            placeholder="e.g., L0- PRO"
          />
        </div>
      )}
    </div>
  );
};
ActiveEmployeePicker.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  employees: PropTypes.arrayOf(PropTypes.object).isRequired,
  onChange: PropTypes.func.isRequired,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  helperText: PropTypes.string,
  tableSuffix: PropTypes.string,
  onTableSuffixChange: PropTypes.func,
  hideLabel: PropTypes.bool,
};

const buildInitialFormData = (editData) => {
  const references = hydrateRecommendationReferences(editData || {});
  return ({
  pr_number: editData?.pr_number || '',
  issued_date: editData ? editData.issued_date || '' : new Date().toISOString().split('T')[0],
  supplier_name: editData?.supplier_name || '',
  supplier_business_id: editData?.supplier_business_id || '',
  product_service: editData?.product_service || '',
  project_department: editData?.project_department || '',
  description_reason: editData?.description_reason || '',
  preferred_supplier_if_any: editData?.preferred_supplier_if_any || '',
  price_description: editData?.price_description || editData?.description_reason || '',
  total_price: editData?.total_price ?? '',
  vat_basis: confirmedRecommendationVat(editData?.vat_basis) ? editData.vat_basis : 'unconfirmed',
  _vatPricingChanged: false,
  currency: editData?.currency || 'AED',
  estimated_budget: editData?.estimated_budget ?? '',
  price_remarks: editData?.price_remarks ?? editData?.price_remarks_data?.negotiation_remarks ?? '',
  net_total_excl_vat: editData?.net_total_excl_vat ?? '',
  po_number_reference: editData?.po_number_reference || '',
  purchase_recommendation: editData?.purchase_recommendation ?? editData?.special_notes ?? '',
  vendor: editData?.vendor || null,
  vendor_selection_reason: editData?.vendor_selection_reason || '',
  selected_vendors: references.selected_vendors,
  single_source_justification: editData?.single_source_justification || '',
  project_details: references.project_details,
  approval_workflow_config: editData?.approval_workflow_config || [],
  price_remarks_data: editData?.price_remarks_data || {},
  items: references.items.map((item, index) => ({
    ...item,
    ...Object.fromEntries(['vat_rate', 'vendor_id', 'budget'].flatMap(key => {
      const value = editData?.price_remarks_data?.line_details?.[index]?.[key];
      return value === undefined ? [] : [[key, value]];
    })),
  })),
  requisition_type: editData?.requisition_type || 'project',
  priority: editData?.priority || 'normal',
  po_applicable: Boolean(editData?.po_applicable),
  management_approval: editData?.management_approval ?? null,
  management_approval_remarks: editData?.management_approval_remarks || '',
  management_approval_evidence: Array.isArray(editData?.management_approval_evidence) ? editData.management_approval_evidence : [],
  });
};

const selectedApproversFromWorkflow = (workflow = []) => {
  const selection = {
    procurement: null,
    level_one: [],
    project_manager: null,
    engineering_manager: null,
    manager_projects: null,
    vp_operations: null,
    general_manager: null,
  };

  workflow.forEach((stage) => {
    const role = `${stage?.role || ''} ${stage?.stage || ''}`.toLowerCase();
    const rawUserId = stage?.user_id || stage?.approver_id || null;
    const userId = rawUserId === null || rawUserId === '' ? null : String(rawUserId);
    const level = Number(stage?.level);
    if (level === 0 || role.includes('procurement department')) {
      selection.procurement = userId;
    }
    else if (level === 1 || role.includes('level 1 approver')) {
      if (userId && !selection.level_one.includes(userId)) selection.level_one.push(userId);
      selection.project_manager ||= userId;
    }
    else if (role.includes('engineering manager') || role.includes('manager of engineering')) selection.engineering_manager = userId;
    else if (role.includes('manager of projects') || role.includes('projects manager')) selection.manager_projects = userId;
    else if (role.includes('vice president') || role.includes('vp delivery') || role.includes('vp operations') || role.includes('procurement manager')) selection.vp_operations = userId;
    else if (level === 5 || role.includes('general manager') || role.includes('ceo')) selection.general_manager = userId;
    else if (role.includes('project manager') || role.includes('department manager') || role.includes('technical review')) {
      selection.project_manager = userId;
      if (userId && !selection.level_one.includes(userId)) selection.level_one.push(userId);
    }
  });

  return selection;
};

const stageLabelsFromWorkflow = (workflow = [], savedLabels = {}) => {
  const labels = {
    procurement: 'L0- PRO',
    engineering_manager: 'L2 MoE',
    manager_projects: 'L3 MoP',
    vp_operations: 'L4 VOP/VP',
    general_manager: 'CEO',
  };

  workflow.forEach((stage) => {
    const userId = stage?.user_id || stage?.approver_id;
    const approvalLabel = stage?.approval_label || savedLabels?.[userId];
    if (!approvalLabel) return;
    const role = `${stage.role || ''} ${stage.stage || ''}`.toLowerCase();
    const level = Number(stage.level);
    if (level === 0 || role.includes('procurement department')) labels.procurement = approvalLabel;
    else if (level === 5 || role.includes('general manager') || role.includes('ceo')) labels.general_manager = approvalLabel;
    else if (role.includes('engineering manager') || role.includes('manager of engineering')) labels.engineering_manager = approvalLabel;
    else if (role.includes('manager of projects') || role.includes('projects manager')) labels.manager_projects = approvalLabel;
    else if (role.includes('vice president') || role.includes('vp delivery') || role.includes('vp operations')) labels.vp_operations = approvalLabel;
  });

  return labels;
};

const buildApprovalWorkflow = ({
  selectedApprovers,
  levelOneApproverCount,
  requisitionType,
  projectManagers,
  engineeringManagers,
  managerProjects,
  vpOperations,
  activeEmployees,
  levelOneLabels,
  vicePresidentPosition,
  poApplicable,
  stageLabels,
  savedWorkflow = [],
}) => {
  const workflow = [];
  let step = 1;

  if (selectedApprovers.procurement) {
    const user = findEmployeeById(activeEmployees, selectedApprovers.procurement);
    workflow.push({
      step: step++, level: 0, stage: 'Level 0 - Procurement Department Approval',
      role: 'Procurement Department', approval_label: stageLabels?.procurement || 'L0- PRO', user_id: selectedApprovers.procurement,
      user_name: employeeDisplayName(user, savedApproverName(savedWorkflow, selectedApprovers.procurement)),
      username: user?.username || '', user_email: user?.email || '', status: 'pending', approved_at: null,
    });
  }

  (selectedApprovers.level_one || []).forEach((userId, index) => {
    const user = findEmployeeById(projectManagers, userId);
    workflow.push({
      step: step++, level: 1, stage: `Level 1 - Approver ${index + 1} of ${levelOneApproverCount}`,
      role: 'Level 1 Approver', approval_label: levelOneLabels?.[userId] || `L1-${index + 1}`,
      approval_group: 'level_1', group_mode: 'all', user_id: userId,
      user_name: employeeDisplayName(user, savedApproverName(savedWorkflow, userId)), status: 'pending', approved_at: null,
    });
  });

  if (requisitionType === 'project' && selectedApprovers.engineering_manager) {
    const user = findEmployeeById(engineeringManagers, selectedApprovers.engineering_manager);
    workflow.push({
      step: step++, level: 2, stage: 'Level 2 - Manager of Engineering (Optional)',
      role: 'Manager of Engineering (MoE)', approval_label: stageLabels?.engineering_manager || 'L2 MoE', user_id: selectedApprovers.engineering_manager,
      user_name: employeeDisplayName(user, savedApproverName(savedWorkflow, selectedApprovers.engineering_manager)), status: 'pending', approved_at: null,
    });
  }

  if (requisitionType === 'project' && selectedApprovers.manager_projects) {
    const user = findEmployeeById(managerProjects, selectedApprovers.manager_projects);
    workflow.push({
      step: step++, level: 3, stage: 'Level 3 - Manager of Projects', role: 'Manager of Projects (MoP)',
      approval_label: stageLabels?.manager_projects || 'L3 MoP',
      user_id: selectedApprovers.manager_projects, user_name: employeeDisplayName(user, savedApproverName(savedWorkflow, selectedApprovers.manager_projects)),
      status: 'pending', approved_at: null,
    });
  }

  if (selectedApprovers.vp_operations) {
    const user = findEmployeeById(vpOperations, selectedApprovers.vp_operations);
    workflow.push({
      step: step++, level: requisitionType === 'general' ? 2 : 4,
      stage: requisitionType === 'general' ? 'Level 2 - Vice President' : 'Level 4 - VP Delivery',
      role: requisitionType === 'general' ? 'Vice President' : 'VP Delivery',
      ...(requisitionType === 'general' ? { business_position: vicePresidentPosition || '' } : {}),
      approval_label: stageLabels?.vp_operations || 'L4 VOP/VP',
      user_id: selectedApprovers.vp_operations, user_name: employeeDisplayName(user, savedApproverName(savedWorkflow, selectedApprovers.vp_operations)),
      status: 'pending', approved_at: null,
    });
  }

  if (!poApplicable && selectedApprovers.general_manager) {
    const user = findEmployeeById(activeEmployees, selectedApprovers.general_manager);
    workflow.push({
      step: step++, level: 5, stage: 'Level 5 - CEO Approval',
      role: 'CEO', approval_label: stageLabels?.general_manager || 'CEO', user_id: selectedApprovers.general_manager,
      user_name: employeeDisplayName(user, savedApproverName(savedWorkflow, selectedApprovers.general_manager)),
      username: user?.username || '', user_email: user?.email || '', status: 'pending', approved_at: null,
    });
  }

  return workflow;
};

const DEFAULT_LEVEL_ZERO_PROCUREMENT_NAME = 'richa hannah thomas';
const DEFAULT_LEVEL_FOUR_VP_EMAIL = 'moghawanmeh@rejlers.ae';
const DEFAULT_LEVEL_FIVE_GENERAL_MANAGER_NAME = 'jarmo suominen';

const normalizeEmployeeName = (employee) => String(
  employee?.full_name
    || [employee?.first_name, employee?.last_name].filter(Boolean).join(' ')
    || '',
).trim().toLowerCase().replace(/\s+/g, ' ');

const PurchaseRequisitionForm = ({ isOpen, onClose, onSuccess, editData = null, pageMode = false }) => {
  const authUser = useSelector((state) => state.auth?.user);
  const sessionUser = authUser?.user || authUser || {};
  const sessionUserName = String(
    sessionUser.full_name
      || sessionUser.name
      || [sessionUser.first_name, sessionUser.last_name].filter(Boolean).join(' ')
      || sessionUser.username
      || '',
  ).trim();
  const [submitLoading, setSubmitLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Form state - all 23 fields from PDF template
  const [formData, setFormDataState] = useState(() => buildInitialFormData(editData));
  const [savedApprovalRecord, setSavedApprovalRecord] = useState(null);
  const [approvalRecordEditing, setApprovalRecordEditing] = useState(false);
  const [pendingAssignments, setPendingAssignments] = useState({});
  const [assignmentNotice, setAssignmentNotice] = useState('');
  const approvalRecord = savedApprovalRecord?.id === editData?.id ? savedApprovalRecord : editData;
  const userEditedRef = useRef(false);
  const linePricingEditedRef = useRef(false);
  const preserveApprovalWorkflow = preserveRecordedApprovalWorkflow(approvalRecord);
  const editingRegisteredPr = Boolean(editData && String(approvalRecord?.status || 'draft').toLowerCase() !== 'draft');
  const setFormData = useCallback(update => {
    userEditedRef.current = true;
    setFormDataState(update);
  }, []);

  const [files, setFiles] = useState([]);
  const [approvedPdfFile, setApprovedPdfFile] = useState(null);
  const [approvedPdfDate, setApprovedPdfDate] = useState('');
  const [managementEvidenceFile, setManagementEvidenceFile] = useState(null);
  const [vendorSearch, setVendorSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [showProjectOptions, setShowProjectOptions] = useState(false);
  const [showProjectCreator, setShowProjectCreator] = useState(false);
  const [newProjectReference, setNewProjectReference] = useState({ number: '', name: '' });
  const [projectCreatorError, setProjectCreatorError] = useState('');
  const [vendorLoadError, setVendorLoadError] = useState('');
  const [manualIcv, setManualIcv] = useState({ vendorId: null, value: '', expiryDate: '', saving: false, error: '' });
  const [prNumberStatus, setPrNumberStatus] = useState({ checking: false, available: null, message: '' });
  const [errors, setErrors] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const [serverWarnings, setServerWarnings] = useState(() => registrationWarningsFrom(editData));
  const [autoSaving, setAutoSaving] = useState(false);
  const draftIdRef = useRef(editData?.id || null);
  const autoSaveInFlightRef = useRef(null);
  const formDataRef = useRef(formData);
  const approvalWorkflowRef = useRef(editData?.approval_workflow_config || []);
  const editedApproverRolesRef = useRef(new Set());
  const submissionInFlightRef = useRef(false);
  const lastAutoSaveFingerprintRef = useRef('');
  const failedAutoSaveFingerprintRef = useRef('');
  const priceDescriptionEditedRef = useRef(Boolean(editData?.price_description));
  const workspaceRef = useRef(null);
  const [formPanePercent, setFormPanePercent] = useState(58);
  const [activeStep, setActiveStep] = useState(0);
  const [visitedSteps, setVisitedSteps] = useState([0]);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [savedAttachments, setSavedAttachments] = useState(editData?.attachments || []);
  const formScrollRef = useRef(null);
  const [isPaneResizing, setIsPaneResizing] = useState(false);

  // New state for dynamic features
  const [vendors, setVendors] = useState([]);
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
  const [approvalDefaults, setApprovalDefaults] = useState({ procurement: null, vp_operations: null, general_manager: null });
  const [levelOneLabels, setLevelOneLabels] = useState({});
  const [vicePresidentPosition, setVicePresidentPosition] = useState('');
  const { catalog, error: catalogError, reload: reloadCatalog } = useOrganizationCatalog({ enabled: isOpen && !preserveApprovalWorkflow && formData.requisition_type === 'general' });
  const [stageLabels, setStageLabels] = useState(() => stageLabelsFromWorkflow(
    editData?.approval_workflow_config || [],
    editData?.price_remarks_data?.approval_table_labels || {},
  ));
  const [selectedApprovers, setSelectedApprovers] = useState({
    procurement: null,
    level_one: [],
    project_manager: null,
    engineering_manager: null,
    manager_projects: null,
    vp_operations: null,
    general_manager: null,
  });

  const resizeFormPane = useCallback((clientX) => {
    const bounds = workspaceRef.current?.getBoundingClientRect();
    if (!bounds?.width) return;
    const nextPercent = ((clientX - bounds.left) / bounds.width) * 100;
    setFormPanePercent(Math.min(75, Math.max(35, nextPercent)));
  }, []);

  useEffect(() => {
    if (!isPaneResizing || !pageMode) return undefined;

    const handlePointerMove = (event) => resizeFormPane(event.clientX);
    const stopResizing = () => setIsPaneResizing(false);
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResizing);
    window.addEventListener('pointercancel', stopResizing);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResizing);
      window.removeEventListener('pointercancel', stopResizing);
    };
  }, [isPaneResizing, pageMode, resizeFormPane]);

  const handlePaneResizeKeyDown = (event) => {
    const keyAdjustments = { ArrowLeft: -2, ArrowRight: 2 };
    if (keyAdjustments[event.key]) {
      event.preventDefault();
      setFormPanePercent(current => Math.min(75, Math.max(35, current + keyAdjustments[event.key])));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setFormPanePercent(35);
    } else if (event.key === 'End') {
      event.preventDefault();
      setFormPanePercent(75);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const initialData = buildInitialFormData(editData);
    setSavedApprovalRecord(null);
    setApprovalRecordEditing(false);
    setPendingAssignments({});
    setAssignmentNotice('');
    setFormDataState(initialData);
    userEditedRef.current = false;
    linePricingEditedRef.current = false;
    priceDescriptionEditedRef.current = Boolean(editData?.price_description);
    formDataRef.current = initialData;
    approvalWorkflowRef.current = editData?.approval_workflow_config || [];
    editedApproverRolesRef.current = new Set();
    draftIdRef.current = editData?.id || null;
    autoSaveInFlightRef.current = null;
    submissionInFlightRef.current = false;
    lastAutoSaveFingerprintRef.current = JSON.stringify(initialData);
    failedAutoSaveFingerprintRef.current = '';
    const initialApprovers = selectedApproversFromWorkflow(editData?.approval_workflow_config || []);
    const savedApprovalLabels = editData?.price_remarks_data?.approval_table_labels || {};
    setSelectedApprovers(initialApprovers);
    setVicePresidentPosition(vicePresidentPositionFromWorkflow(editData?.approval_workflow_config || []));
    setLevelOneLabels(Object.fromEntries(
      (editData?.approval_workflow_config || [])
        .filter(stage => Number(stage?.level) === 1 && (stage?.user_id || stage?.approver_id))
        .map((stage, index) => [
          stage.user_id || stage.approver_id,
          stage.approval_label || savedApprovalLabels[stage.user_id || stage.approver_id] || `L1-${index + 1}`,
        ]),
    ));
    setStageLabels(stageLabelsFromWorkflow(editData?.approval_workflow_config || [], savedApprovalLabels));
    setLevelOneApproverCount(Math.max(1, initialApprovers.level_one.length));
    setLevelOneSearch('');
    setFiles([]);
    setApprovedPdfFile(null);
    setApprovedPdfDate('');
    setManagementEvidenceFile(null);
    setVendorSearch('');
    setProjectSearch('');
    setShowProjectOptions(false);
    setShowProjectCreator(false);
    setNewProjectReference({ number: '', name: '' });
    setProjectCreatorError('');
    setVendorLoadError('');
    setPrNumberStatus({ checking: false, available: null, message: '' });
    setErrors({});
    setServerErrors({});
    setServerWarnings(registrationWarningsFrom(editData));
    setUploadProgress(0);
    setActiveStep(0);
    setVisitedSteps([0]);
    setLastSavedAt(null);
    setSaveError('');
    setSavedAttachments(editData?.attachments || []);
    setProductSuggestions([]);
    setProjectSuggestions([]);
    setPoNumberSuggestions([]);
    setSuggestionStatus({});
    setShowProductDropdown(false);
    setShowPoDropdown(false);
  }, [isOpen, editData]);

  // Price Remarks Advanced Fields
  const [showAdvancedPricing, setShowAdvancedPricing] = useState(false);

  // Autocomplete suggestions state
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [projectSuggestions, setProjectSuggestions] = useState([]);
  const [poNumberSuggestions, setPoNumberSuggestions] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
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
    setVendorSearch(query);
    clearTimeout(suggestionTimersRef.current.vendorOption);
    suggestionTimersRef.current.vendorOption = setTimeout(() => fetchVendors(query), 200);
  };

  const fetchApprovers = async () => {
    setLoadingApprovers(true);
    setApproverLoadError('');
    try {
      const [employeeResponse, vpResponse, procurementResponse] = await Promise.all([
        apiClient.get('/procurement/requisitions/get_approvers/', { params: { role: 'any_active' } }),
        ...(!preserveApprovalWorkflow ? [
          apiClient.get('/procurement/requisitions/get_approvers/', { params: { role: 'vp_operations' } }),
          apiClient.get('/procurement/requisitions/get_approvers/', { params: { role: 'procurement_head' } }),
        ] : []),
      ]);

      const usersFrom = (response) => {
        const payload = response?.data?.data || response?.data || {};
        return Array.isArray(payload.users) ? payload.users : [];
      };

      const activeEmployees = usersFrom(employeeResponse);
      const vpCandidates = usersFrom(vpResponse);
      const matchedVpCandidates = vpCandidates.filter(user => user.job_title_match);
      const procurementCandidates = usersFrom(procurementResponse);
      const richaProcurementManager = activeEmployees.find(user => (
        normalizeEmployeeName(user) === DEFAULT_LEVEL_ZERO_PROCUREMENT_NAME
      ));
      // Level 0 belongs to Procurement. Never substitute the current admin if
      // the configured Procurement approver cannot be resolved; leaving it
      // empty exposes the configuration problem instead of assigning the PR
      // creator to the wrong approval stage.
      const procurementDefault = richaProcurementManager || procurementCandidates[0] || null;
      // The approved Level 4 default is a named employee. Resolve by the
      // employee's stable email first because the source record spells the
      // first name "Mohamad" while it is sometimes entered as "Mohamed".
      const vpDefault = activeEmployees.find(user => (
        String(user.email || '').trim().toLowerCase() === DEFAULT_LEVEL_FOUR_VP_EMAIL
      )) || matchedVpCandidates[0] || null;
      const generalManagerDefault = activeEmployees.find(user => (
        normalizeEmployeeName(user) === DEFAULT_LEVEL_FIVE_GENERAL_MANAGER_NAME
      )) || null;

      setProjectManagers(activeEmployees);
      setEngineeringManagers(activeEmployees);
      setManagerProjects(activeEmployees);
      setVpOperations(activeEmployees);
      setApprovalDefaults({
        procurement: procurementDefault?.id || null,
        vp_operations: vpDefault?.id || null,
        general_manager: generalManagerDefault?.id || null,
      });
      if (!preserveApprovalWorkflow && !editData) setSelectedApprovers(previous => ({
        ...previous,
        procurement: editedApproverRolesRef.current.has('procurement') ? previous.procurement : previous.procurement || procurementDefault?.id || null,
        vp_operations: formDataRef.current.requisition_type === 'project' && !editedApproverRolesRef.current.has('vp_operations')
          ? previous.vp_operations || vpDefault?.id || null : previous.vp_operations,
        general_manager: !formDataRef.current.po_applicable && !editedApproverRolesRef.current.has('general_manager')
          ? previous.general_manager || generalManagerDefault?.id || null : previous.general_manager,
      }));
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
    userEditedRef.current = true;
    editedApproverRolesRef.current.add(role);
    setSelectedApprovers(prev => ({ ...prev, [role]: normalizeUserId(userId) }));
    if (errors.approval_workflow_config) {
      setErrors(prev => ({ ...prev, approval_workflow_config: null }));
    }
  };

  const addLevelOneApprover = (userId) => {
    userEditedRef.current = true;
    const normalizedUserId = normalizeUserId(userId);
    setSelectedApprovers(prev => {
      const selected = prev.level_one || [];
      if (!normalizedUserId || selected.some(id => String(id) === normalizedUserId) || selected.length >= levelOneApproverCount) return prev;
      const next = [...selected, normalizedUserId];
      return { ...prev, level_one: next, project_manager: next[0] || null };
    });
    setLevelOneLabels(previous => ({
      ...previous,
      [normalizedUserId]: previous[normalizedUserId] || `L1-${(selectedApprovers.level_one || []).length + 1}`,
    }));
    setLevelOneSearch('');
    if (errors.approval_workflow_config) setErrors(prev => ({ ...prev, approval_workflow_config: null }));
  };

  const removeLevelOneApprover = (userId) => {
    userEditedRef.current = true;
    setSelectedApprovers(prev => {
      const next = (prev.level_one || []).filter(id => String(id) !== String(userId));
      return { ...prev, level_one: next, project_manager: next[0] || null };
    });
    setLevelOneLabels(previous => {
      const next = { ...previous };
      delete next[userId];
      return next;
    });
  };

  const changeLevelOneLabel = (userId, value) => {
    userEditedRef.current = true;
    setLevelOneLabels(previous => ({ ...previous, [userId]: value.slice(0, 20) }));
  };

  const changeStageLabel = (stage, value) => {
    userEditedRef.current = true;
    setStageLabels(previous => ({ ...previous, [stage]: value.slice(0, 20) }));
  };

  const changeLevelOneCount = (rawValue) => {
    userEditedRef.current = true;
    const count = Math.max(1, Math.min(20, Number(rawValue) || 1));
    setLevelOneApproverCount(count);
    setSelectedApprovers(prev => {
      const next = (prev.level_one || []).slice(0, count);
      return { ...prev, level_one: next, project_manager: next[0] || null };
    });
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

  const selectProject = (project) => {
    toggleProject(project);
    setProjectSearch('');
    setShowProjectOptions(false);
  };

  const openProjectDepartmentCreator = () => {
    setNewProjectReference(previous => ({
      number: previous.number,
      name: previous.name || projectSearch.trim(),
    }));
    setProjectCreatorError('');
    setShowProjectCreator(true);
    setShowProjectOptions(false);
  };

  const createProjectDepartment = () => {
    const projectNumber = newProjectReference.number.trim();
    const projectName = newProjectReference.name.trim();
    if (!projectNumber || !projectName) {
      setProjectCreatorError('Enter both the project / department number and name.');
      return;
    }
    const duplicate = (formData.project_details || []).some(project => (
      String(project.project_number || '').trim().toLowerCase() === projectNumber.toLowerCase()
      || String(project.value || '').trim().toLowerCase() === `${projectName} (${projectNumber})`.toLowerCase()
    ));
    if (duplicate) {
      setProjectCreatorError('This project / department number is already selected.');
      return;
    }
    toggleProject({
      project_number: projectNumber,
      project_name: projectName,
      value: `${projectName} (${projectNumber})`,
      label: `${projectNumber} - ${projectName}`,
      type: formData.requisition_type === 'general' ? 'department' : 'project',
      source: 'custom',
    });
    setProjectSearch('');
    setNewProjectReference({ number: '', name: '' });
    setProjectCreatorError('');
    setShowProjectCreator(false);
    setShowProjectOptions(false);
  };

  const updateCustomProjectDetail = (index, field, value) => {
    setFormData(previous => {
      const projectDetails = (previous.project_details || []).map((project, projectIndex) => {
        if (projectIndex !== index) return project;
        const updated = { ...project, [field]: value, source: 'custom' };
        const projectNumber = String(updated.project_number || '').trim();
        const projectName = String(updated.project_name || '').trim();
        return {
          ...updated,
          value: projectName && projectNumber ? `${projectName} (${projectNumber})` : projectName || projectNumber,
          label: [projectNumber, projectName].filter(Boolean).join(' - '),
        };
      });
      return {
        ...previous,
        project_details: projectDetails,
        project_department: projectDetails.map(project => project.value || project.label).filter(Boolean).join('; '),
      };
    });
    setErrors(previous => ({ ...previous, project_department: null }));
  };

  const updateProjectDetail = (index, value) => {
    setFormData(previous => {
      const projectDetails = (previous.project_details || []).map((project, projectIndex) => (
        projectIndex === index ? { ...project, value, label: value, source: project.source === 'internal' ? 'internal' : 'edited' } : project
      ));
      return {
        ...previous,
        project_details: projectDetails,
        project_department: projectDetails.map(project => project.value || project.label).filter(Boolean).join('; '),
      };
    });
    setErrors(previous => ({ ...previous, project_department: null }));
  };

  const handleRequisitionTypeChange = (type) => {
    setFormData(previous => {
      const projectDetails = type === 'project'
        ? (previous.project_details || []).filter(project => project.source !== 'internal')
        : previous.project_details || [];
      return {
        ...previous,
        requisition_type: type,
        project_details: projectDetails,
        project_department: projectDetails.map(project => project.value || project.label).filter(Boolean).join('; '),
      };
    });
    setSelectedApprovers(previous => ({
      ...previous,
      engineering_manager: type === 'project' ? previous.engineering_manager : null,
      manager_projects: type === 'project' ? previous.manager_projects : null,
      vp_operations: previous.vp_operations || (!editedApproverRolesRef.current.has('vp_operations') && type === 'project' ? approvalDefaults.vp_operations : null),
      general_manager: previous.general_manager || (!editedApproverRolesRef.current.has('general_manager') && !formDataRef.current.po_applicable ? approvalDefaults.general_manager : null),
    }));
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
    const selectedVendor = shortlistEntry || masterVendor;
    const hasIcv = selectedVendor?.icv_percentage !== null
      && selectedVendor?.icv_percentage !== undefined
      && selectedVendor?.icv_percentage !== '';
    setManualIcv(hasIcv || !vendorId
      ? { vendorId: null, value: '', expiryDate: '', saving: false, error: '' }
      : { vendorId, value: '', expiryDate: selectedVendor?.icv_expiry_date || '', saving: false, error: '' });
  };

  const saveManualIcv = async () => {
    const numericValue = Number(manualIcv.value);
    if (manualIcv.value === '' || !Number.isFinite(numericValue) || numericValue < 0 || numericValue > 100) {
      setManualIcv(previous => ({ ...previous, error: 'Enter an ICV percentage from 0 to 100.' }));
      return;
    }
    setManualIcv(previous => ({ ...previous, saving: true, error: '' }));
    try {
      const response = await apiClient.patch('/procurement/requisitions/vendor-icv/', {
        vendor_id: manualIcv.vendorId,
        icv_percentage: numericValue,
        icv_expiry_date: manualIcv.expiryDate || null,
      });
      const savedVendor = response.data;
      setVendors(previous => previous.map(vendor => String(vendor.id) === String(savedVendor.id) ? savedVendor : vendor));
      setFormData(previous => ({
        ...previous,
        selected_vendors: (previous.selected_vendors || []).map(vendor => (
          String(vendor.vendor_id || vendor.id) === String(savedVendor.id)
            ? { ...vendor, icv_percentage: savedVendor.icv_percentage, icv_expiry_date: savedVendor.icv_expiry_date, is_icv_certified: true }
            : vendor
        )),
      }));
      setManualIcv({ vendorId: null, value: '', expiryDate: '', saving: false, error: '' });
      toast.success(`ICV saved for ${savedVendor.name}.`);
    } catch (error) {
      const percentageError = error.response?.data?.icv_percentage;
      const message = (Array.isArray(percentageError) ? percentageError[0] : percentageError)
        || error.response?.data?.detail
        || 'Could not save the vendor ICV. Please try again.';
      setManualIcv(previous => ({ ...previous, saving: false, error: message }));
    }
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
    if (!userEditedRef.current) return;
    const convertedTotal = convertToAed(formData.net_total_excl_vat, formData.currency);
    const exchangeRate = AED_EXCHANGE_RATES[formData.currency];
    setFormDataState(prev => {
      const priceRemarksData = prev.price_remarks_data || {};
      const nextTotal = convertedTotal === null ? '' : convertedTotal.toFixed(2);
      if (
        String(priceRemarksData.net_total_aed ?? '') === nextTotal
        && Number(priceRemarksData.aed_exchange_rate) === Number(exchangeRate)
      ) return prev;
      return {
        ...prev,
        price_remarks_data: {
          ...priceRemarksData,
          net_total_aed: nextTotal,
          aed_exchange_rate: exchangeRate || null,
          aed_rate_currency: formData.currency,
        },
      };
    });
  }, [formData.currency, formData.net_total_excl_vat]);

  useEffect(() => {
    if (priceDescriptionEditedRef.current) return;
    setFormDataState(prev => {
      const purchaseDescription = prev.description_reason || '';
      if (prev.price_description === purchaseDescription) return prev;
      return { ...prev, price_description: purchaseDescription };
    });
  }, [formData.description_reason]);

  useEffect(() => {
    if (!linePricingEditedRef.current || !formData.items?.length) return;
    const savedItems = prepareRecommendationPayload({
      items: formData.items,
      price_remarks_data: { line_details: formData.price_remarks_data?.line_details },
    }).items;
    if (!savedItems.length || !savedItems.every(hasCompleteRecommendationPricing) || recommendationLineError(savedItems)) return;
    const itemsTotal = sumProcurementMoney(savedItems.map(item => procurementLineNet(item.quantity, item.unit_price, recommendationLineDiscount(item))));
    const amounts = confirmedRecommendationVat(formData.vat_basis)
      ? calculateProcurementVat(itemsTotal, formData.price_remarks_data?.discount_amount ?? 0, { basis: formData.vat_basis })
      : { netAmount: itemsTotal, totalAmount: itemsTotal };
    const itemsBudget = formData.items.reduce(
      (sum, item) => sum + (parseFloat(item.budget) || 0),
      0
    ).toFixed(2);
    const hasLineBudgets = formData.items.some(item => item.budget !== '' && item.budget != null);
    setFormDataState(prev => ({ ...prev, _vatPricingChanged: true, _vatEnteredAmount: itemsTotal, net_total_excl_vat: amounts.netAmount.toFixed(2), total_price: amounts.totalAmount.toFixed(2), ...(hasLineBudgets ? { estimated_budget: itemsBudget } : {}) }));
  }, [formData.items, formData.vat_basis, formData.price_remarks_data?.discount_amount, formData.price_remarks_data?.line_details]);

  useEffect(() => {
    formDataRef.current = formData;
    setServerErrors(previous => Object.keys(previous).length ? {} : previous);
  }, [formData]);

  const handleAutoSave = useCallback(async () => {
    if (submissionInFlightRef.current || !userEditedRef.current || preserveApprovalWorkflow || formDataRef.current._vatPricingChanged) return null;
    if (autoSaveInFlightRef.current) {
      return autoSaveInFlightRef.current;
    }

    const currentDraft = {
      ...formDataRef.current,
      approval_workflow_config: approvalWorkflowRef.current,
    };
    const fingerprint = JSON.stringify(currentDraft);
    if (fingerprint === lastAutoSaveFingerprintRef.current || fingerprint === failedAutoSaveFingerprintRef.current) return null;
    const autoSavePayload = prepareRecommendationPayload(currentDraft, approvalWorkflowRef.current);
    const lineError = recommendationLineError(autoSavePayload.items);
    if (lineError) {
      setErrors(previous => ({ ...previous, items: lineError }));
      setSaveError(lineError);
      return null;
    }

    const saveOperation = (async () => {
      setAutoSaving(true);
      try {
        const targetDraftId = editData?.id || draftIdRef.current;
        const response = targetDraftId
          ? await apiClient.patch(`/procurement/requisitions/${targetDraftId}/`, autoSavePayload)
          : await apiClient.post('/procurement/requisitions/', autoSavePayload);

        draftIdRef.current = response.data.id;
        lastAutoSaveFingerprintRef.current = fingerprint;
        failedAutoSaveFingerprintRef.current = '';
        if (response.data.pr_number) {
          setFormDataState(prev => (
            prev.pr_number
              ? prev
              : { ...prev, pr_number: response.data.pr_number }
          ));
        }
        setLastSavedAt(new Date());
        setSaveError('');
        setServerWarnings(registrationWarningsFrom(response.data));
        return response.data;
      } catch (error) {
        // A rejected payload needs an edit, not another identical timed PATCH.
        // Explicit Save remains available to retry after an external correction.
        if (error.response?.status === 400) failedAutoSaveFingerprintRef.current = fingerprint;
        const apiErrors = normalizeApiErrors(error.response?.data);
        setServerErrors(apiErrors);
        setErrors(previous => ({ ...previous, ...apiErrors }));
        setSaveError(apiErrors.error || apiErrors.detail || firstApiError(apiErrors) || 'Draft could not be saved. Please retry.');
        console.error('Auto-save failed:', error);
        throw error;
      } finally {
        setAutoSaving(false);
        autoSaveInFlightRef.current = null;
      }
    })();

    autoSaveInFlightRef.current = saveOperation;
    return saveOperation;
  }, [editData, preserveApprovalWorkflow]);

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

  useEffect(() => {
    if (!isOpen || !editData?.id) return undefined;
    const timer = setTimeout(() => {
      const latestForm = formDataRef.current;
      if (latestForm.pr_number && (latestForm.product_service || latestForm.description_reason)) {
        handleAutoSave().catch(() => {});
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [
    editData?.id,
    formData,
    handleAutoSave,
    isOpen,
    levelOneApproverCount,
    levelOneLabels,
    vicePresidentPosition,
    selectedApprovers,
    stageLabels,
  ]);

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
    setFormData(prev => ({ ...prev, items: [...(prev.items || []), newLineItem()],
      price_remarks_data: { ...prev.price_remarks_data, line_details: [
        ...(prev.items || []).map((item, index) => prev.price_remarks_data?.line_details?.[index] ||
          Object.fromEntries(['vat_rate', 'vendor_id', 'budget'].filter(key => item[key] !== undefined).map(key => [key, item[key]]))),
        {},
      ] },
    }));
  };

  const updateLineItem = (index, field, value) => {
    if (['quantity', 'unit_price'].includes(field)) linePricingEditedRef.current = true;
    setFormData(prev => {
      const items = prev.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const updated = { ...item, [field]: value };
        if ((field === 'quantity' || field === 'unit_price') && hasCompleteRecommendationPricing(updated)) {
          updated.total = procurementLineNet(updated.quantity, updated.unit_price, recommendationLineDiscount(updated)).toFixed(2);
        }
        return updated;
      });
      return { ...prev, items, ...(['quantity', 'unit_price'].includes(field) ? { _vatPricingChanged: true, _vatEnteredAmount: '' } : {}), ...(field === 'budget' ? { estimated_budget: items.some(item => item.budget !== '' && item.budget != null) ? sumProcurementMoney(items.map(item => item.budget || 0)).toFixed(2) : '' } : {}), price_remarks_data: { ...prev.price_remarks_data,
        line_details: items.map((item, itemIndex) => ({
          ...(prev.price_remarks_data?.line_details?.[itemIndex] || {}),
          ...Object.fromEntries(['vat_rate', 'vendor_id', 'budget'].filter(key => item[key] !== undefined).map(key => [key, item[key]])),
        })),
      } };
    });
    setErrors(prev => ({ ...prev, items: null }));
  };

  const removeLineItem = (index) => {
    linePricingEditedRef.current = true;
    setFormData(prev => {
      const items = prev.items.filter((_, itemIndex) => itemIndex !== index);
      const removedBudget = prev.items[index]?.budget;
      const clearedLastBudget = removedBudget !== '' && removedBudget != null
        && !items.some(item => item.budget !== '' && item.budget != null);
      return {
        ...prev, items, _vatPricingChanged: true,
        ...(clearedLastBudget ? { estimated_budget: '' } : {}),
        ...(items.length === 0 ? { total_price: '', net_total_excl_vat: '', estimated_budget: '', _vatEnteredAmount: '' } : {}),
        price_remarks_data: { ...prev.price_remarks_data,
          line_details: prev.items.flatMap((item, itemIndex) => itemIndex === index ? [] : [
            prev.price_remarks_data?.line_details?.[itemIndex] || Object.fromEntries(['vat_rate', 'vendor_id', 'budget'].filter(key => item[key] !== undefined).map(key => [key, item[key]])),
          ]),
        },
      };
    });
  };

  const reassignmentKeepsPricing = () => {
    if (!preserveApprovalWorkflow || !Object.keys(pendingAssignments).length || formData._vatPricingChanged) return false;
    const current = prepareRecommendationPayload(formData);
    const saved = prepareRecommendationPayload(buildInitialFormData(approvalRecord));
    return ['items', 'total_price', 'net_total_excl_vat', 'estimated_budget', 'currency']
      .every(key => JSON.stringify(current[key]) === JSON.stringify(saved[key]));
  };

  const getValidationErrors = () => {
    const newErrors = {};
    if (!formData.pr_number?.trim()) {
      newErrors.pr_number = 'Enter the PR number manually';
    } else if (prNumberStatus.available === false) {
      newErrors.pr_number = 'This PR number already exists';
    }
    const lineError = reassignmentKeepsPricing() ? '' : recommendationLineError(prepareRecommendationPayload(formData).items);
    if (lineError) newErrors.items = lineError;
    if (formData._vatPricingChanged && !confirmedRecommendationVat(formData.vat_basis)) {
      newErrors.vat_basis = 'Confirm whether the entered price includes VAT, excludes VAT, or has no VAT.';
    }
    return newErrors;
  };

  const getRegistrationWarnings = () => {
    const warnings = {};
    // Signed evidence and completed workflows are historical records. Editing
    // their descriptive fields must not demand a new draft's routing/shortlist.
    if (preserveApprovalWorkflow) return warnings;
    if (!formData.product_service?.trim()) {
      warnings.product_service = 'Product/service description is missing.';
    }
    if (!(formData.project_details || []).length) {
      warnings.project_department = 'No project or Internal / General department is selected.';
    } else if ((formData.project_details || []).some(project => (
      project.source === 'custom'
      && (!String(project.project_number || '').trim() || !String(project.project_name || '').trim())
    ))) {
      warnings.project_department = 'A custom project / department is missing its number or name.';
    }
    if (!formData.description_reason?.trim()) {
      warnings.description_reason = 'Purchase description is missing.';
    }
    if (!formData.price_description?.trim()) {
      warnings.price_description = 'Pricing description is missing.';
    }
    if (!formData.total_price || parseFloat(formData.total_price) <= 0) {
      warnings.total_price = 'A positive total price has not been entered.';
    }
    if (!(formData.selected_vendors || []).length) {
      warnings.selected_vendors = 'No vendors are shortlisted.';
    }
    if (!formData.vendor) {
      warnings.vendor = 'No supplier is selected from the shortlisted vendors.';
    }
    if ((formData.selected_vendors || []).length === 1 && !formData.single_source_justification?.trim()) {
      warnings.single_source_justification = 'Single source justification is missing.';
    }
    if (!formData.purchase_recommendation?.trim()) {
      warnings.purchase_recommendation = 'Purchase recommendation is missing.';
    }
    if (formData.po_applicable && !formData.po_number_reference?.trim()) {
      warnings.po_number_reference = 'A completed PO number has not been entered.';
    }
    if (formData.currency === 'AED' && recommendationVat(formData).netAmount > 100000) {
      if (formData.management_approval !== true) warnings.management_approval = 'Management approval is not confirmed for a PR above AED 100,000.';
      if (!formData.management_approval_remarks?.trim()) warnings.management_approval_remarks = 'Management approval remarks are missing.';
      if (!managementEvidenceFile && !(formData.management_approval_evidence || []).length) {
        warnings.management_approval_evidence = 'Management approval evidence is missing.';
      }
    }

    const levelOneComplete = (selectedApprovers.level_one || []).length === levelOneApproverCount;
    if ((formData.requisition_type === 'general' && !vicePresidentPosition) || !selectedApprovers.procurement || !levelOneComplete || !selectedApprovers.vp_operations
      || (formData.requisition_type === 'project' && !selectedApprovers.manager_projects)
      || (!formData.po_applicable && !selectedApprovers.general_manager)) {
      warnings.approval_workflow_config = 'The approval route is incomplete. You can save or submit with this warning.';
    }
    if (formData.requisition_type === 'general' && selectedApprovers.vp_operations && !vicePresidentPosition) {
      warnings.approval_position = 'The Vice President approval stage has no designated business position.';
    }
    return warnings;
  };

  const validateForm = () => {
    const validation = getValidationErrors();
    setErrors(validation);
    return Object.keys(validation).length === 0;
  };

  const handleSubmit = async (e, submitForApproval = false, stayOnPage = false) => {
    e.preventDefault();
    if (submissionInFlightRef.current || approvalRecordEditing) return;
    if (!formData.pr_number?.trim() || prNumberStatus.available === false) {
      setErrors(prev => ({ ...prev, pr_number: prNumberStatus.available === false ? 'This PR number already exists' : 'Enter the PR number manually' }));
      setActiveStep(0);
      return;
    }
    if (submitForApproval && !validateForm()) {
      return;
    }
    if (!approvedPdfFile && formData._vatPricingChanged && !confirmedRecommendationVat(formData.vat_basis)) {
      const message = 'Confirm whether the entered price includes VAT, excludes VAT, or has no VAT.';
      setErrors(previous => ({ ...previous, vat_basis: message }));
      setSaveError(message);
      setActiveStep(1);
      return;
    }
    const lineError = reassignmentKeepsPricing() ? '' : recommendationLineError(prepareRecommendationPayload(formData).items);
    if (!approvedPdfFile && lineError) {
      setErrors(previous => ({ ...previous, items: lineError }));
      setSaveError(lineError);
      setActiveStep(1);
      return;
    }

    setSubmitLoading(true);
    setSaveError('');
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
        else if (onClose) onClose();
        return;
      }

      const submitData = new FormData();
      const approvalWorkflow = preserveApprovalWorkflow ? (approvalRecord?.approval_workflow_config || []) : buildApprovalWorkflow({
        selectedApprovers,
        levelOneApproverCount,
        requisitionType: formData.requisition_type,
        projectManagers,
        engineeringManagers,
        managerProjects,
        vpOperations,
        activeEmployees: projectManagers,
        levelOneLabels,
        vicePresidentPosition,
        poApplicable: formData.po_applicable,
        stageLabels,
        savedWorkflow: editData?.approval_workflow_config || [],
      });

      let formDataWithWorkflow = prepareRecommendationPayload(formData, preserveApprovalWorkflow ? undefined : approvalWorkflow);
      // Even resending an unchanged historic workflow invokes assignment
      // validation. Leave it entirely out of an ordinary edit to its record.
      if (preserveApprovalWorkflow) delete formDataWithWorkflow.approval_workflow_config;
      const reassignmentCommands = approvalReassignmentCommands(pendingAssignments);
      if (preserveApprovalWorkflow && reassignmentCommands.length) {
        const baseline = prepareRecommendationPayload(buildInitialFormData(approvalRecord));
        // Reassignment-only saves must not resend unchanged source evidence or
        // commercial fields. Concurrent changes are checked by each snapshot.
        formDataWithWorkflow = Object.fromEntries(Object.entries(formDataWithWorkflow)
          .filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(baseline[key])));
        formDataWithWorkflow.approval_reassignments = reassignmentCommands;
      }
      Object.keys(formDataWithWorkflow).forEach(key => {
        if (formDataWithWorkflow[key] !== undefined) {
          if (formDataWithWorkflow[key] === null) {
            submitData.append(key, '');
          } else if (typeof formDataWithWorkflow[key] === 'object') {
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
      lastAutoSaveFingerprintRef.current = JSON.stringify({ ...formDataRef.current, approval_workflow_config: approvalWorkflow });
      failedAutoSaveFingerprintRef.current = '';

      const responseStatus = String(response.data.status || '').toLowerCase();
      setServerWarnings(registrationWarningsFrom(response.data));
      const shouldSubmitForApproval = submitForApproval && responseStatus === 'draft';
      if (shouldSubmitForApproval) {
        response = await apiClient.post(`/procurement/requisitions/${response.data.id}/submit/`, {
          approval_workflow_config: approvalWorkflow,
        });
      }

      const requisitionLabel = response.data.pr_number
        ? `PR ${response.data.pr_number}`
        : 'Purchase requisition';
      toast.success(shouldSubmitForApproval
          ? `${requisitionLabel} successfully created and submitted for approval.`
          : `${requisitionLabel} changes saved successfully.`);

      const savedWarnings = registrationWarningsFrom(response.data);
      setServerWarnings(savedWarnings);
      if (savedWarnings.length) {
        toast.warn(`${requisitionLabel} saved with ${savedWarnings.length} warning${savedWarnings.length === 1 ? '' : 's'}. ${savedWarnings[0]}${savedWarnings.length > 1 ? ' Open the PR to review all warnings.' : ''}`, { autoClose: false });
      }

      setLastSavedAt(new Date());
      setSavedAttachments(response.data.attachments || savedAttachments);
      setPendingAssignments({});
      setAssignmentNotice('');
      if (preserveApprovalWorkflow) handleApprovalRecordSaved(response.data);
      setFiles([]);
      if (response.data.management_approval_evidence) {
        setFormDataState(previous => ({ ...previous, management_approval_evidence: response.data.management_approval_evidence }));
        setManagementEvidenceFile(null);
      }
      if (!stayOnPage || shouldSubmitForApproval) {
        if (onSuccess) onSuccess(response.data);
        else if (onClose) onClose();
      }
    } catch (error) {
      console.error('Error submitting PR:', error);
      const apiErrors = normalizeApiErrors(error.response?.data);
      if (Object.keys(apiErrors).length) {
        setServerErrors(apiErrors);
        setErrors(prev => ({ ...prev, ...apiErrors }));
      }
      const apiMessage = apiErrors.error || apiErrors.detail || firstApiError(apiErrors);
      setSaveError(apiMessage || 'Draft could not be saved. Please retry.');
      (await radaiAlert(apiMessage || error.message || (submitForApproval
        ? 'Failed to submit requisition. Please check all required fields.'
        : 'Failed to save draft. Please try again.')));
    } finally {
      submissionInFlightRef.current = false;
      setSubmitLoading(false);
      setUploadProgress(0);
    }
  };

  const handleApprovalRecordSaved = updated => {
    if (String(updated?.id) !== String(draftIdRef.current)) return;
    const retainedAssignments = retainCurrentApprovalAssignments(pendingAssignments, updated);
    if (!submissionInFlightRef.current) {
      setPendingAssignments(retainedAssignments);
      if (Object.keys(retainedAssignments).length < Object.keys(pendingAssignments).length) {
        setAssignmentNotice('Queued reassignment changes were cleared because the approval record changed. Review the current approvers before saving.');
      }
    }
    const sourceKeys = ['signed_document_verification', 'signed_approval_evidence', 'manual_ocr_review', 'source_approval_reviews', 'approval_reassignment_history'];
    const mergeEvidence = previous => ({
      ...previous,
      approval_workflow_config: updated.approval_workflow_config || [],
      price_remarks_data: {
        ...previous.price_remarks_data,
        ...Object.fromEntries(sourceKeys.filter(key => Object.prototype.hasOwnProperty.call(updated.price_remarks_data || {}, key))
          .map(key => [key, updated.price_remarks_data[key]])),
      },
    });
    // Updating editData would remount/reset the editor and discard unsaved
    // commercial fields. Merge only the independently saved source evidence.
    setSavedApprovalRecord(updated);
    const merged = mergeEvidence(formDataRef.current);
    formDataRef.current = merged;
    approvalWorkflowRef.current = updated.approval_workflow_config || [];
    setFormDataState(merged);
    setSavedAttachments(updated.attachments || savedAttachments);
    if (lastAutoSaveFingerprintRef.current) {
      lastAutoSaveFingerprintRef.current = JSON.stringify(mergeEvidence(JSON.parse(lastAutoSaveFingerprintRef.current)));
    }
  };

  if (!isOpen) return null;

  const normalizedProjectSearch = projectSearch.trim().toLowerCase();
  const hasExactProjectMatch = Boolean(normalizedProjectSearch) && projectSuggestions.some(project => (
    [project.label, project.value, project.project_name, project.department]
      .filter(Boolean)
      .some(value => String(value).trim().toLowerCase() === normalizedProjectSearch)
  ));

  const liveApprovalWorkflow = preserveApprovalWorkflow ? (approvalRecord?.approval_workflow_config || []) : buildApprovalWorkflow({
    selectedApprovers,
    levelOneApproverCount,
    requisitionType: formData.requisition_type,
    projectManagers,
    engineeringManagers,
    managerProjects,
    vpOperations,
    activeEmployees: projectManagers,
    levelOneLabels,
    vicePresidentPosition,
    poApplicable: formData.po_applicable,
    stageLabels,
    savedWorkflow: editData?.approval_workflow_config || [],
  });
  approvalWorkflowRef.current = liveApprovalWorkflow;
  const canSubmitForApproval = !preserveApprovalWorkflow && (!editData
    || String(approvalRecord?.status || 'draft').toLowerCase() === 'draft');
  const livePreviewRequisition = {
    ...(preserveApprovalWorkflow ? approvalRecord : {}),
    ...formData,
    tax_amount: formData._vatPricingChanged ? recommendationVat(formData).taxAmount : editData?.tax_amount,
    id: editData?.id || draftIdRef.current,
    issued_by_name: editData?.issued_by_name || sessionUserName,
    approval_workflow_config: liveApprovalWorkflow,
    attachments: [
      ...savedAttachments,
      ...files.map((file) => ({ filename: file.name })),
    ],
    form_reference: editData?.form_reference || 'RAD-OM-PRC-0001 FRM -1 Rev 0',
    page_number: 'Page 1 of 1',
  };


  const stepLabels = ['Request', 'Supplier & pricing', 'Business justification', 'Documents', 'Approval & submit'];
  const fieldSteps = {
    pr_number: 0, product_service: 0, project_department: 0, issued_date: 0,
    total_price: 1, vat_basis: 1, selected_vendors: 1, vendor: 1, vendor_selection_reason: 1,
    single_source_justification: 1, items: 1, price_description: 2,
    description_reason: 2, purchase_recommendation: 2, po_number_reference: 2,
    management_approval: 4, management_approval_remarks: 4, management_approval_evidence: 4,
    approval_workflow_config: 4, approval_reassignments: 4, approval_position: 4, attachments: 3, approved_pdf: 3,
  };
  const validationErrors = getValidationErrors();
  const registrationWarnings = getRegistrationWarnings();
  const unsavedChanges = Object.keys(pendingAssignments).length > 0 || files.length > 0 || Boolean(managementEvidenceFile) || (userEditedRef.current && JSON.stringify({ ...formData, approval_workflow_config: liveApprovalWorkflow }) !== lastAutoSaveFingerprintRef.current);
  const blockingIssues = Object.entries({ ...validationErrors, ...serverErrors, ...Object.fromEntries(Object.entries(errors).filter(([field, message]) => message && (fieldSteps[field] === undefined || ['attachments', 'approved_pdf'].includes(field)))) })
    .map(([field, message]) => ({ field, message, step: fieldSteps[field] ?? 4 }));
  const warningIssues = [
    ...Object.entries(registrationWarnings).map(([field, message]) => ({ field, message, step: fieldSteps[field] ?? 4, severity: 'warning' })),
    ...serverWarnings.filter(message => !Object.values(registrationWarnings).includes(message))
      .map((message, index) => ({ field: `registration_warning_${index}`, message, step: 4, severity: 'warning' })),
  ];
  const issues = [...blockingIssues, ...warningIssues];
  const goToStep = (step) => {
    setActiveStep(step);
    setVisitedSteps(previous => [...new Set([...previous, step])]);
    formScrollRef.current?.scrollTo({ top: 0 });
  };
  const revealIssue = (issue) => {
    if (issue.severity !== 'warning') setErrors(previous => ({ ...previous, [issue.field]: issue.message }));
    if (issue.field === 'price_description') setShowAdvancedPricing(true);
    goToStep(issue.field === 'price_description' ? 1 : issue.step ?? 4);
    requestAnimationFrame(() => {
      const field = issue.field === 'project_department' ? 'project_department_search' : issue.field;
      const input = document.getElementById('pr-modal-form')?.querySelector(`[name="${field}"]`);
      input?.focus();
      input?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  };
  const continueStep = () => {
    const stepIssues = Object.entries(validationErrors).filter(([field]) => fieldSteps[field] === activeStep);
    if (stepIssues.length) {
      setErrors(previous => ({ ...previous, ...Object.fromEntries(stepIssues) }));
      revealIssue({ field: stepIssues[0][0], message: stepIssues[0][1], step: activeStep });
      return;
    }
    goToStep(Math.min(4, activeStep + 1));
  };
  const reviewSubmission = () => { setErrors(validationErrors); goToStep(4); };
  const displayDate = formData.issued_date ? new Date(`${formData.issued_date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const requiredMessage = blockingIssues.length ? `${blockingIssues.length} error${blockingIssues.length === 1 ? '' : 's'} to correct`
    : warningIssues.length ? `${warningIssues.length} warning${warningIssues.length === 1 ? '' : 's'} · You can submit` : 'Ready for review';
  return (
    <div className={`recommendation-form-workspace ${pageMode ? 'prf-page' : 'prf-modal'}`}>
      <div ref={workspaceRef} className="prf-workspace-grid" style={{ '--form-pane-width': `${formPanePercent}%` }}>
        <section className="prf-editor" aria-label="Purchase recommendation form">
          <header className="prf-header">
            <nav aria-label="Breadcrumb" className="prf-breadcrumb"><button type="button" onClick={onClose}>Procurement</button><span>/</span><button type="button" onClick={onClose}>Purchase Recommendations</button><span>/</span><strong>{editData ? 'Edit' : 'New'}</strong></nav>
            <div className="prf-title-row">
              <div><h1>{editData ? 'Edit purchase recommendation' : 'Create purchase recommendation'}</h1><p>Define the requirement, compare suppliers and route the recommendation for approval.</p></div>
              <div className="prf-header-actions">
                <span role="status" className={`prf-save-state ${saveError ? 'prf-save-error' : ''}`}><CheckCircleIcon />{autoSaving || submitLoading ? 'Saving changes...' : saveError ? 'Changes not saved' : unsavedChanges ? (editData || lastSavedAt ? 'Unsaved changes' : 'Unsaved draft') : lastSavedAt ? (preserveApprovalWorkflow ? 'Changes saved' : 'Draft saved') : editData ? (preserveApprovalWorkflow ? 'Existing recommendation' : 'Existing draft') : 'Unsaved draft'}</span>
                <button type="button" className="prf-button" onClick={event => handleSubmit(event, false, true)} disabled={submitLoading || autoSaving || approvalRecordEditing}><SaveIcon />{preserveApprovalWorkflow || editingRegisteredPr ? 'Save changes' : 'Save draft'}</button>
                {canSubmitForApproval && <button type="button" className="prf-button prf-primary" onClick={reviewSubmission}>Review & submit<ArrowRightIcon /></button>}
              </div>
            </div>
            <nav aria-label="Recommendation steps" className="prf-steps">
              {stepLabels.map((label, index) => {
                const complete = visitedSteps.includes(index) && !issues.some(issue => issue.step === index) && activeStep !== index;
                return <button key={label} type="button" aria-current={activeStep === index ? 'step' : undefined} onClick={() => goToStep(index)} className={`${activeStep === index ? 'is-active' : ''} ${complete ? 'is-complete' : ''}`}><span className="prf-step-circle">{complete ? <CheckIcon /> : index + 1}</span><span className="prf-step-copy"><strong>{label}</strong><small>{activeStep === index ? 'In progress' : complete ? 'Complete' : visitedSteps.includes(index) ? 'Needs attention' : 'Not started'}</small></span></button>;
              })}
            </nav>
          </header>
          <form id="pr-modal-form" className="prf-form" onSubmit={event => { event.preventDefault(); if (activeStep < 4) continueStep(); else handleSubmit(event, canSubmitForApproval); }} noValidate>
            <div ref={formScrollRef} className="prf-form-scroll">
              {saveError && <div role="alert" className="prf-error-banner"><ExclamationCircleIcon />{saveError}</div>}
              {activeStep > 0 && <section className="prf-card prf-request-summary" aria-label="Request summary">
                <div className="prf-card-heading"><h2>Request summary</h2><button type="button" className="prf-button prf-small" onClick={() => goToStep(0)}><PencilSquareIcon />Edit request</button></div>
                <dl>{[['Type', formData.requisition_type === 'general' ? 'General / Internal' : 'Project'], ['PR number', formData.pr_number || 'Draft'], ['Issued date', displayDate], ['Priority', {normal: 'Normal · 2-day review', high: 'High · 1-day review', urgent: 'Urgent · same-day review'}[formData.priority]], ['Product / service', formData.product_service || '—'], ['Project', formData.project_department || '—']].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
              </section>}
              {activeStep === 0 && <div className="prf-step-panel" aria-label="Request">{/* Section 1: Header Section */}
          <div className="prf-card prf-legacy-card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
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
                      onClick={() => handleRequisitionTypeChange(type)}
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
                  name="pr_number" aria-label="PR number"
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
                  name="issued_date" aria-label="Issued date"
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
                  name="priority" aria-label="Priority"
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
          </div>{/* Section 3: Project/Product Section */}
          <div className="prf-card prf-legacy-card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              Product / Service & Project Details
            </h3>
            <div className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product/Service
                  <span className="ml-2 text-xs text-gray-500">(Auto-suggests from past PRs)</span>
                </label>
                <textarea
                  name="product_service" aria-label="Product / service"
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
                  Project / Department
                  <span className="ml-2 text-xs text-gray-500">(Current ongoing projects; multiple selections allowed)</span>
                </label>
                <input
                  name="project_department_search" aria-label="Project / Department"
                  value={projectSearch}
                  onChange={(event) => {
                    setProjectSearch(event.target.value);
                    setShowProjectOptions(true);
                    fetchProjectSuggestions(event.target.value, event.target.value.length < 2);
                  }}
                  onFocus={() => {
                    setShowProjectOptions(true);
                    fetchProjectSuggestions(projectSearch, true);
                  }}
                  onBlur={() => setTimeout(() => setShowProjectOptions(false), 200)}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter'
                      && normalizedProjectSearch
                      && !hasExactProjectMatch
                      && !suggestionStatus.project?.loading
                    ) {
                      event.preventDefault();
                      openProjectDepartmentCreator();
                    }
                  }}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                    errors.project_department ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Search by project / department name or number"
                  autoComplete="off"
                />
                {showProjectOptions && (
                  <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {formData.requisition_type === 'general' && !(formData.project_details || []).some(project => project.source === 'internal') && (
                      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { addInternalProject(); setProjectSearch(''); setShowProjectOptions(false); }} className="block w-full border-b border-gray-100 px-4 py-2 text-left text-sm font-semibold text-purple-700 hover:bg-purple-50">
                        Internal / General
                      </button>
                    )}
                    {projectSuggestions.map((project, index) => {
                      const identity = String(project.project_id || project.value);
                      const selected = (formData.project_details || []).some(item => String(item.project_id || item.value) === identity);
                      return (
                        <button key={`${identity}-${index}`} type="button" disabled={selected} onMouseDown={(event) => event.preventDefault()} onClick={() => selectProject(project)} className="block w-full border-b border-gray-100 px-4 py-2 text-left text-sm hover:bg-purple-50 disabled:bg-gray-50 disabled:text-gray-400">
                          <span className="font-semibold">{project.label}</span>{project.department ? <span className="ml-2 text-xs text-gray-500">{project.department}</span> : null}{selected ? <span className="ml-2 text-xs">Selected</span> : null}
                        </button>
                      );
                    })}
                    {normalizedProjectSearch && !hasExactProjectMatch && !suggestionStatus.project?.loading && (
                      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={openProjectDepartmentCreator} className="block w-full px-4 py-2 text-left text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
                        <PlusIcon className="mr-1 inline h-4 w-4" /> No match found — Create New “{projectSearch.trim()}”
                      </button>
                    )}
                  </div>
                )}
                {suggestionStatus.project?.loading && (
                  <p className="mt-1 text-xs text-gray-500">Loading projects...</p>
                )}
                {suggestionStatus.project?.error && (
                  <p className="mt-1 text-xs text-red-600">{suggestionStatus.project.error}</p>
                )}
                {suggestionStatus.project?.loaded && !suggestionStatus.project?.error && projectSuggestions.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">No matching project or department found. Create one here with its name and number.</p>
                )}
                <button type="button" onClick={openProjectDepartmentCreator} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800">
                  <PlusIcon className="h-4 w-4" /> Create project / department with name and number
                </button>
                {showProjectCreator && (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-emerald-900">New project / department</p>
                        <p className="mt-0.5 text-xs text-emerald-700">This reference will be added to the current Purchase Recommendation.</p>
                      </div>
                      <button type="button" onClick={() => { setShowProjectCreator(false); setProjectCreatorError(''); }} className="rounded-md p-1 text-emerald-700 hover:bg-emerald-100" aria-label="Close project creator"><XMarkIcon className="h-4 w-4" /></button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-semibold text-slate-700">Project / Department Number <span className="text-red-500">*</span>
                        <input value={newProjectReference.number} onChange={(event) => { setNewProjectReference(previous => ({ ...previous, number: event.target.value })); setProjectCreatorError(''); }} maxLength={100} placeholder="e.g. 5900927 or DEPT-HSE" className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" autoFocus />
                      </label>
                      <label className="text-xs font-semibold text-slate-700">Project / Department Name <span className="text-red-500">*</span>
                        <input value={newProjectReference.name} onChange={(event) => { setNewProjectReference(previous => ({ ...previous, name: event.target.value })); setProjectCreatorError(''); }} maxLength={300} placeholder="e.g. Value Engineering Package 1" className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); createProjectDepartment(); } }} />
                      </label>
                    </div>
                    {projectCreatorError && <p className="mt-2 text-xs font-semibold text-red-600">{projectCreatorError}</p>}
                    <div className="mt-3 flex justify-end gap-2">
                      <button type="button" onClick={() => { setShowProjectCreator(false); setProjectCreatorError(''); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                      <button type="button" onClick={createProjectDepartment} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"><PlusIcon className="h-4 w-4" /> Add to recommendation</button>
                    </div>
                  </div>
                )}
                {errors.project_department && (
                  <p className="mt-1 text-sm text-red-600">{errors.project_department}</p>
                )}
                <div className="mt-3 space-y-2">
                  {(formData.project_details || []).map((project, index) => (
                    <div key={`${project.project_id || project.value}-${index}`} className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 p-2">
                      {project.source === 'custom' ? (
                        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(130px,0.35fr)_minmax(180px,0.65fr)]">
                          <input value={project.project_number || ''} onChange={(event) => updateCustomProjectDetail(index, 'project_number', event.target.value)} className="min-w-0 rounded border border-purple-200 bg-white px-3 py-1.5 text-sm text-purple-900" aria-label="Project or department number" placeholder="Number" />
                          <input value={project.project_name || ''} onChange={(event) => updateCustomProjectDetail(index, 'project_name', event.target.value)} className="min-w-0 rounded border border-purple-200 bg-white px-3 py-1.5 text-sm text-purple-900" aria-label="Project or department name" placeholder="Name" />
                        </div>
                      ) : (
                        <input value={project.source === 'internal' ? 'Internal / General' : (project.label || project.value || '')} onChange={(event) => updateProjectDetail(index, event.target.value)} readOnly={project.source === 'internal'} className="min-w-0 flex-1 rounded border border-purple-200 bg-white px-3 py-1.5 text-sm text-purple-900 read-only:bg-purple-50" aria-label="Edit selected project or department" />
                      )}
                      <button type="button" onClick={() => removeProjectDetail(index)} className="text-purple-500 hover:text-red-600" aria-label="Remove project or department">
                        <XCircleIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div></div>}
              {activeStep === 1 && <RecommendationSupplierPricing formData={formData} setFormData={setFormData} errors={{ ...Object.fromEntries(Object.entries(errors).filter(([field]) => validationErrors[field])), ...serverErrors }} vendors={vendors} vendorSearch={vendorSearch} onVendorSearch={searchVendors} loadingVendors={loadingVendors} vendorLoadError={vendorLoadError} onAddVendor={addVendorToShortlist} onRemoveVendor={removeVendorFromShortlist} onPreferredVendor={selectPreferredVendor} onAddLineItem={addLineItem} onUpdateLineItem={updateLineItem} onRemoveLineItem={removeLineItem} showAdvancedPricing={showAdvancedPricing} setShowAdvancedPricing={setShowAdvancedPricing} manualIcv={manualIcv} setManualIcv={setManualIcv} onSaveManualIcv={saveManualIcv} onPriceDescriptionChange={value => { priceDescriptionEditedRef.current = true; setFormData(previous => ({ ...previous, price_description: value })); }} />}
              {activeStep === 2 && <div className="prf-step-panel" aria-label="Business justification">{/* Section 4: Description Section */}
          <div className="prf-card prf-legacy-card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              Purchase Description
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Purchase Description
                <span className="ml-2 text-xs font-normal text-gray-500">Describe the scope and purchase reason</span>
              </label>
              <textarea
                name="description_reason" aria-label="Purchase description"
                value={formData.description_reason}
                onChange={handleChange}
                rows={3}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                  errors.description_reason ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Value Engineering Services -Package 1 &2 for 5900927 project"
              />
              {errors.description_reason && (
                <p className="mt-1 text-sm text-red-600">{errors.description_reason}</p>
              )}
            </div>
          </div>{/* Section 7: Purchase Recommendation Section */}
          <div className="prf-card prf-legacy-card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              Purchase Recommendation
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Purchase Recommendation
              </label>
              <textarea
                name="purchase_recommendation" aria-label="Purchase recommendation"
                value={formData.purchase_recommendation}
                onChange={handleChange}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Any special requirements or notes..."
              />
              {errors.purchase_recommendation && <p className="mt-1 text-sm text-red-600">{errors.purchase_recommendation}</p>}
            </div>
          </div>{/* Section 6: Reference Section */}
          <div className="prf-card prf-legacy-card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
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
                        onChange={() => {
                          setFormData(prev => ({ ...prev, po_applicable: value, ...(value ? {} : { po_number_reference: '' }) }));
                          setSelectedApprovers(prev => ({
                            ...prev,
                            general_manager: prev.general_manager || (!editedApproverRolesRef.current.has('general_manager') && !value ? approvalDefaults.general_manager : null),
                          }));
                        }}
                      />
                      {value ? 'Yes' : 'No'}
                    </label>
                  ))}
                </div>
              </fieldset>
              {formData.po_applicable && <div className="relative mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PO Number
                <span className="ml-2 text-xs text-gray-500">(Only completed POs can be linked)</span>
              </label>
              <input
                type="text"
                name="po_number_reference" aria-label="PO number"
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

          </div>}
              {activeStep === 3 && <div className="prf-step-panel" aria-label="Documents">{/* Signed approval PDF is intentionally first when editing. */}
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
              {savedAttachments.filter((attachment) => (
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
          )}{/* Section 8: Attachments Section */}
          <div className="prf-card prf-legacy-card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              Attachments (Multiple Files Supported)
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <CloudArrowUpIcon className="h-10 w-10 text-gray-400 mb-2" />
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Choose files</span> to attach
                    </p>
                    <p className="text-xs text-gray-500">PDF, DOC, DOCX, XLS, XLSX, Images (MAX. 10MB each)</p>

                  </div>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange} aria-label="Attach supporting documents"
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
                        onClick={() => removeFile(index)} aria-label={`Remove ${file.name}`}
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
          </div>{savedAttachments.length > 0 && <section className="prf-card"><h2>Attached documents</h2>{savedAttachments.map((file,index) => <a className="prf-file-link" key={file.id || index} href={file.url || file.s3_url} target="_blank" rel="noreferrer"><PaperClipIcon />{file.filename || file.name || 'Document'}</a>)}</section>}</div>}
              {activeStep === 4 && <div className="prf-step-panel" aria-label="Approval and submit">
                <section className="prf-card prf-review-checks"><h2>{preserveApprovalWorkflow ? 'Review changes' : 'Review before submission'}</h2><p>{preserveApprovalWorkflow ? 'Save edits to this recommendation. Recorded approval evidence remains part of its history.' : blockingIssues.length ? 'Correct the errors below. Registration warnings do not prevent saving or submitting.' : warningIssues.length ? 'Review the warnings below. You can save or submit this PR with warnings.' : 'Review the document and approval route, then submit.'}</p>{issues.map(issue => <button key={issue.field} type="button" className={issue.severity === 'warning' ? 'prf-warning' : ''} onClick={() => revealIssue(issue)}><ExclamationCircleIcon /><span>{issue.severity === 'warning' && <strong>Warning: </strong>}{issue.message}</span><ArrowRightIcon /></button>)}</section>
                {formData.currency === 'AED' && recommendationVat(formData).netAmount > 100000 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-4">
              <div>
                <h4 className="text-sm font-bold text-amber-900">Management approval</h4>
                <p className="text-xs text-amber-800">PR value exceeds AED 100,000. Missing approval details are warnings and do not prevent registration.</p>
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
              <textarea name="management_approval_remarks" aria-label="Management approval remarks" value={formData.management_approval_remarks} onChange={handleChange} rows={2} className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm" placeholder="Management approval remarks" />
              {errors.management_approval_remarks && <p className="text-sm text-red-600">{errors.management_approval_remarks}</p>}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Evidence of Approval</label>
                <input type="file" aria-label="Evidence of management approval" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={(event) => setManagementEvidenceFile(event.target.files?.[0] || null)} className="block w-full text-sm" />
                {(managementEvidenceFile || (formData.management_approval_evidence || []).length > 0) && <p className="mt-1 text-xs text-emerald-700">{managementEvidenceFile?.name || 'Existing evidence attached'}</p>}
                {errors.management_approval_evidence && <p className="mt-1 text-sm text-red-600">{errors.management_approval_evidence}</p>}
              </div>
            </div>
          )}{/* Section 9: Approval Workflow Section */}
          <div className="prf-card prf-legacy-card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              {preserveApprovalWorkflow ? 'Recorded approval history' : 'Approval Workflow'}
            </h3>
            {preserveApprovalWorkflow ? <><RecordedApprovalHistory
              key={approvalRecord.id}
              requisition={{ ...approvalRecord, price_remarks_data: formData.price_remarks_data, attachments: savedAttachments }}
              disabled={submitLoading || autoSaving}
              onSaved={handleApprovalRecordSaved}
              onEditingChange={setApprovalRecordEditing}
              hidePendingAssignments={Boolean(approvalRecord.can_reassign_approvers)}
            />{assignmentNotice && <p role="status" className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{assignmentNotice}</p>}
            <PendingApprovalAssignments requisition={approvalRecord} assignments={pendingAssignments} employees={projectManagers}
              loading={loadingApprovers} error={approverLoadError} disabled={submitLoading || autoSaving || approvalRecordEditing}
              onRetry={fetchApprovers} onChange={(index, assignment) => {
                userEditedRef.current = true;
                setAssignmentNotice('');
                setPendingAssignments(previous => { const next = { ...previous }; if (assignment) next[index] = assignment; else delete next[index]; return next; });
              }} /></> : <div className="space-y-4">
              {formData.requisition_type === 'general' && catalogError && <p className="text-sm text-amber-700">{catalogError} <button type="button" onClick={reloadCatalog} className="underline">Retry positions</button></p>}
              <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4">
                <p className="mb-3 text-xs text-amber-800">Missing approvers or business positions generate warnings. You can save or submit and update this route before any approval decision is recorded.</p>
                <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)_100px] md:items-end">
                  <div><label className="mb-1 block text-xs font-bold uppercase tracking-wide text-purple-700">Level 1 required</label><input type="number" min="1" max="20" value={levelOneApproverCount} aria-label="Level 1 required" onChange={(event) => changeLevelOneCount(event.target.value)} className="w-full rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm" /></div>
                  <div className="relative"><label className="mb-1 block text-xs font-bold uppercase tracking-wide text-purple-700">Add Level 1 approver</label><input value={levelOneSearch} aria-label="Add Level 1 approver" onChange={(event) => setLevelOneSearch(event.target.value)} disabled={loadingApprovers || (selectedApprovers.level_one || []).length >= levelOneApproverCount} placeholder="Search employee by name, ID, title, or department" className="w-full rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm" />{levelOneSearch.trim() && (selectedApprovers.level_one || []).length < levelOneApproverCount && <div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">{projectManagers.filter(user => employeeSearchText(user).includes(levelOneSearch.trim().toLowerCase()) && !(selectedApprovers.level_one || []).some(id => String(id) === String(user.id))).slice(0, 20).map(user => <button key={user.id} type="button" onClick={() => addLevelOneApprover(user.id)} className="block w-full border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-purple-50 last:border-0"><span className="block font-semibold text-gray-900">{employeeDisplayName(user)}</span><span className="block text-xs text-gray-500">{user.job_title || user.department || user.employee_id || 'Active employee'}</span></button>)}</div>}</div>
                  <div className={`rounded-full px-3 py-2 text-center text-xs font-bold ${(selectedApprovers.level_one || []).length === levelOneApproverCount ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{(selectedApprovers.level_one || []).length} of {levelOneApproverCount}</div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-300 bg-white shadow-sm">
                <table className="min-w-[900px] w-full table-fixed border-collapse text-sm">
                  <thead className="bg-slate-800 text-left text-xs font-semibold uppercase tracking-wide text-white"><tr><th className="w-[150px] px-4 py-3">Level label</th><th className="w-[230px] px-4 py-3">Approval role</th><th className="px-4 py-3">Selected approver</th><th className="w-[110px] px-4 py-3 text-center">Status / Action</th></tr></thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr className="bg-blue-50/50"><td className="p-3 align-top"><input aria-label="procurement approval label" value={stageLabels.procurement} onChange={(event) => changeStageLabel('procurement', event.target.value)} maxLength={20} className="w-full rounded-lg border border-gray-300 px-3 py-2 font-semibold text-purple-800" /></td><td className="p-3 align-top"><p className="font-semibold text-gray-900">Procurement Department</p><p className="mt-1 text-xs text-gray-500">Level 0 · Expected</p></td><td className="p-3 align-top"><ActiveEmployeePicker hideLabel label="Procurement Department Approval" value={selectedApprovers.procurement || ''} employees={projectManagers} onChange={(value) => handleApproverChange('procurement', value)} disabled={loadingApprovers} /></td><td className="p-3 text-center align-middle"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">Default</span></td></tr>

                    {(selectedApprovers.level_one || []).length ? (selectedApprovers.level_one || []).map((userId, index) => { const user = findEmployeeById(projectManagers, userId); const displayName = employeeDisplayName(user, savedApproverName(editData?.approval_workflow_config, userId)); return <tr key={userId}><td className="p-3"><input value={levelOneLabels[userId] ?? `L1-${index + 1}`} onChange={(event) => changeLevelOneLabel(userId, event.target.value)} maxLength={20} aria-label={`Approval table level for ${displayName}`} className="w-full rounded-lg border border-gray-300 px-3 py-2 font-semibold text-purple-800" /></td><td className="p-3"><p className="font-semibold text-gray-900">Level 1 Approver {index + 1}</p><p className="mt-1 text-xs text-gray-500">All Level 1 approvers must approve</p></td><td className="p-3"><p className="font-semibold text-gray-900">{displayName}</p><p className="text-xs text-gray-500">{user?.job_title || user?.department || savedApproverById(editData?.approval_workflow_config, userId)?.job_title || 'Active employee'}</p></td><td className="p-3 text-center"><button type="button" onClick={() => removeLevelOneApprover(userId)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">Remove</button></td></tr>; }) : <tr><td className="p-3 text-center font-semibold text-purple-700">L1</td><td className="p-3"><p className="font-semibold">Level 1 Approvers</p><p className="text-xs text-gray-500">Expected</p></td><td className="p-3 text-gray-500">Use the search box above to add approvers.</td><td className="p-3 text-center text-xs font-semibold text-amber-700">0 selected</td></tr>}

                    {formData.requisition_type === 'project' && <tr><td className="p-3 align-top"><input aria-label="engineering manager approval label" value={stageLabels.engineering_manager} onChange={(event) => changeStageLabel('engineering_manager', event.target.value)} maxLength={20} className="w-full rounded-lg border border-gray-300 px-3 py-2 font-semibold text-purple-800" /></td><td className="p-3 align-top"><p className="font-semibold text-gray-900">Manager of Engineering (MoE)</p><p className="mt-1 text-xs text-gray-500">Level 2 · Optional</p></td><td className="p-3 align-top"><ActiveEmployeePicker hideLabel label="Manager of Engineering (MoE)" value={selectedApprovers.engineering_manager || ''} employees={engineeringManagers} onChange={(value) => handleApproverChange('engineering_manager', value)} disabled={loadingApprovers} /></td><td className="p-3 text-center align-middle"><span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">Optional</span></td></tr>}

                    {formData.requisition_type === 'project' && <tr><td className="p-3 align-top"><input aria-label="manager projects approval label" value={stageLabels.manager_projects} onChange={(event) => changeStageLabel('manager_projects', event.target.value)} maxLength={20} className="w-full rounded-lg border border-gray-300 px-3 py-2 font-semibold text-purple-800" /></td><td className="p-3 align-top"><p className="font-semibold text-gray-900">Manager of Projects (MoP)</p><p className="mt-1 text-xs text-gray-500">Level 3 · Expected</p></td><td className="p-3 align-top"><ActiveEmployeePicker hideLabel label="Manager of Projects (MoP)" value={selectedApprovers.manager_projects || ''} employees={managerProjects} onChange={(value) => handleApproverChange('manager_projects', value)} disabled={loadingApprovers} /></td><td className="p-3 text-center align-middle"><span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Expected</span></td></tr>}

                    <tr><td className="p-3 align-top"><input aria-label="vp operations approval label" value={stageLabels.vp_operations} onChange={(event) => changeStageLabel('vp_operations', event.target.value)} maxLength={20} className="w-full rounded-lg border border-gray-300 px-3 py-2 font-semibold text-purple-800" /></td><td className="p-3 align-top"><p className="font-semibold text-gray-900">{formData.requisition_type === 'general' ? 'Vice President' : 'VP Delivery'}</p><p className="mt-1 text-xs text-gray-500">{formData.requisition_type === 'general' ? 'Level 2 · Expected' : 'Level 4 · Expected'}</p>{formData.requisition_type === 'general' && <label className="mt-2 block text-xs font-semibold text-gray-600">Designated business position<select aria-label="Business position for Vice President stage" value={vicePresidentPosition} onChange={event => { userEditedRef.current = true; setVicePresidentPosition(event.target.value); setErrors(previous => ({ ...previous, approval_workflow_config: null })); }} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs"><option value="">Select position</option>{vicePresidentPosition && !(catalog?.organizational_roles || []).some(role => role.code === vicePresidentPosition) && <option value={vicePresidentPosition}>{vicePresidentPosition} (saved position)</option>}{(catalog?.organizational_roles || []).map(role => <option key={role.code} value={role.code}>{role.label}</option>)}</select></label>}</td><td className="p-3 align-top"><ActiveEmployeePicker hideLabel label="Vice President / Delivery Approver" value={selectedApprovers.vp_operations || ''} employees={vpOperations} onChange={(value) => handleApproverChange('vp_operations', value)} disabled={loadingApprovers} />{!loadingApprovers && !selectedApprovers.vp_operations && <p className="mt-2 text-xs font-medium text-amber-700">{formData.requisition_type === 'project' ? 'No VP Delivery approver is selected.' : 'Select the authorized Vice President approver.'}</p>}</td><td className="p-3 text-center align-middle"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${formData.requisition_type === 'project' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'}`}>{formData.requisition_type === 'project' ? 'Default' : 'Expected'}</span></td></tr>

                    {!formData.po_applicable && <tr className="bg-emerald-50/50"><td className="p-3 align-top"><input aria-label="general manager approval label" value={stageLabels.general_manager} onChange={(event) => changeStageLabel('general_manager', event.target.value)} maxLength={20} className="w-full rounded-lg border border-gray-300 px-3 py-2 font-semibold text-purple-800" /></td><td className="p-3 align-top"><p className="font-semibold text-gray-900">CEO</p><p className="mt-1 text-xs text-gray-500">Level 5 · Expected when PO is not applicable</p></td><td className="p-3 align-top"><ActiveEmployeePicker hideLabel label="CEO Approval" value={selectedApprovers.general_manager || ''} employees={projectManagers} onChange={(value) => handleApproverChange('general_manager', value)} disabled={loadingApprovers} />{!loadingApprovers && !selectedApprovers.general_manager && <p className="mt-2 text-sm font-medium text-red-600">No CEO approver is selected.</p>}</td><td className="p-3 text-center align-middle"><span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Default</span></td></tr>}
                  </tbody>
                </table>
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
                  {projectManagers.length} active employees loaded. Select one or more people from the lists above.
                </p>
              )}

              {errors.approval_workflow_config && (
                <p className="text-sm font-medium text-red-600">{errors.approval_workflow_config}</p>
              )}
              {registrationWarnings.approval_workflow_config && (
                <p className="text-sm font-medium text-amber-700">Warning: {registrationWarnings.approval_workflow_config}</p>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  <strong>Sequential routing:</strong> each level becomes active only after the previous level is approved.
                </p>
              </div>
            </div>}
          </div>
              </div>}
            </div>
            <footer className="prf-action-bar">
              <button type="button" className="prf-button prf-cancel" onClick={onClose}>Cancel</button>
              <button type="button" className={`prf-required ${issues.length ? '' : 'is-ready'}`} onClick={reviewSubmission}><ExclamationCircleIcon />{requiredMessage}</button>
              <div className="prf-bottom-actions">{activeStep > 0 && activeStep !== 1 && <button type="button" className="prf-button prf-back" onClick={() => goToStep(activeStep - 1)}><ArrowLeftIcon />Back</button>}<button type="button" className="prf-button" disabled={submitLoading || autoSaving || approvalRecordEditing} onClick={event => handleSubmit(event, false, true)}>{approvedPdfFile ? 'Record signed PDF' : preserveApprovalWorkflow || editingRegisteredPr ? 'Save changes' : 'Save draft'}</button>
              {activeStep < 4 ? <button type="button" className="prf-button prf-primary" onClick={continueStep}>Continue to {['supplier & pricing', 'business justification', 'documents', 'approval'][activeStep]}<ArrowRightIcon /></button> : !approvedPdfFile && canSubmitForApproval && <button type="submit" className="prf-button prf-primary" disabled={submitLoading || autoSaving}>{submitLoading ? 'Submitting...' : 'Submit for approval'}<ArrowRightIcon /></button>}</div>
            </footer>
          </form>
        </section>
        <div role="separator" aria-label="Resize form and preview panes" aria-orientation="vertical" aria-valuemin={35} aria-valuemax={75} aria-valuenow={Math.round(formPanePercent)} tabIndex={0} onPointerDown={event => { event.preventDefault(); resizeFormPane(event.clientX); setIsPaneResizing(true); }} onDoubleClick={() => setFormPanePercent(58)} onKeyDown={handlePaneResizeKeyDown} className="prf-pane-divider" title="Drag to resize; double-click to reset" />
        <RecommendationPreviewPane requisition={livePreviewRequisition} issues={issues} onIssueClick={revealIssue} />
      </div>
    </div>
  );
};

PurchaseRequisitionForm.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
  editData: PropTypes.object,
  pageMode: PropTypes.bool,
};

export default PurchaseRequisitionForm;
