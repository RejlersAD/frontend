/**
 * Purchase Requisition Approval Component
 * Dynamic multi-tier approval workflow (PM -> Engineering Manager -> Manager of Projects -> VP Operations)
 * 
 * Features:
 * - Dynamic Approval History mapping over all configured workflow stages
 * - Super Admin & assigned approver permission validation
 * - Soft-coded rejection validation
 * - Digital signature support
 */

import React, { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../services/api.service';
import PurchaseRequisitionDocumentPreview from './PurchaseRequisitionDocumentPreview';
import { displayApprovalWorkflow, nameOnly } from '../../utils/employeeDisplayName';
import { buildProcurementPdfFilename } from '../../utils/procurementPdfFilename';
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  ClockIcon,
  UserCircleIcon,
  PencilSquareIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  LockClosedIcon,
  PaperAirplaneIcon,
  PrinterIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';

const linkedPurchaseOrderPdfRequests = new Map();

const requestLinkedPurchaseOrderPdf = (id) => {
  if (!linkedPurchaseOrderPdfRequests.has(id)) {
    const request = apiClient.get(`/procurement/orders/${id}/export-pdf/`, {
      responseType: 'blob',
      timeout: 120000,
      suppressErrorToast: true,
    }).finally(() => linkedPurchaseOrderPdfRequests.delete(id));
    linkedPurchaseOrderPdfRequests.set(id, request);
  }
  return linkedPurchaseOrderPdfRequests.get(id);
};

const REJECTION_CONFIG = {
  MIN_REASON_LENGTH: 10,
  MAX_REASON_LENGTH: 1000,
  ERROR_MESSAGES: {
    missing: 'Please provide a reason for rejection.',
    too_short: 'Rejection reason must be at least 10 characters long.',
    too_long: 'Rejection reason cannot exceed 1000 characters.',
    empty: 'Rejection reason cannot be empty or contain only whitespace.',
  }
};

const PurchaseRequisitionApproval = ({ isOpen, onClose, requisition, currentUser, onApprovalComplete, pageMode = false }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [currentApproverType, setCurrentApproverType] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState('');
  const [signature, setSignature] = useState('');
  const [referralTarget, setReferralTarget] = useState('moe');
  const [referralRemarks, setReferralRemarks] = useState('');
  const [referralError, setReferralError] = useState('');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [pdfPreviewFilename, setPdfPreviewFilename] = useState('');
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [pdfPreviewError, setPdfPreviewError] = useState('');
  const [pdfPreviewRetryKey, setPdfPreviewRetryKey] = useState(0);
  const [activePreview, setActivePreview] = useState('pr');
  const [linkedOrder, setLinkedOrder] = useState(null);
  const [linkedPoPreviewUrl, setLinkedPoPreviewUrl] = useState('');
  const [linkedPoPreviewFilename, setLinkedPoPreviewFilename] = useState('');
  const [linkedPoPreviewLoading, setLinkedPoPreviewLoading] = useState(false);
  const [linkedPoPreviewError, setLinkedPoPreviewError] = useState('');
  const [linkedPoPreviewRetryKey, setLinkedPoPreviewRetryKey] = useState(0);
  const pdfFrameRef = useRef(null);
  const pdfSourceRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !requisition?.linked_po_id) {
      setLinkedOrder(null);
      setActivePreview('pr');
      return undefined;
    }

    let active = true;
    apiClient.get(`/procurement/orders/${requisition.linked_po_id}/`, {
      params: { _fresh: Date.now() },
      suppressErrorToast: true,
    })
      .then((response) => { if (active) setLinkedOrder(response.data); })
      .catch((error) => {
        if (!active) return;
        console.error('Failed to load linked Purchase Order details:', error);
        setLinkedOrder(null);
      });
    return () => { active = false; };
  }, [isOpen, requisition?.linked_po_id]);

  useEffect(() => {
    if (!isOpen || !requisition?.id) return undefined;

    let active = true;
    let objectUrl = '';
    const generatePreviewPdf = async () => {
      setPdfPreviewLoading(true);
      setPdfPreviewError('');
      setPdfPreviewUrl('');
      try {
        const source = pdfSourceRef.current;
        if (!source) throw new Error('The live preview source is not ready.');

        await document.fonts?.ready;
        await Promise.all(Array.from(source.querySelectorAll('img')).map((image) => (
          image.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
              image.addEventListener('load', resolve, { once: true });
              image.addEventListener('error', resolve, { once: true });
            })
        )));

        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
          import('html2canvas'),
          import('jspdf'),
        ]);
        const canvas = await html2canvas(source, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          logging: false,
          windowWidth: 1200,
        });
        if (!active) return;

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
        const pageWidth = 210;
        const pageHeight = 297;
        const margin = 6;
        const printableWidth = pageWidth - (margin * 2);
        const printableHeight = pageHeight - (margin * 2);
        const imageHeight = (canvas.height * printableWidth) / canvas.width;
        const imageData = canvas.toDataURL('image/jpeg', 0.96);
        let remainingHeight = imageHeight;
        let yPosition = margin;

        pdf.addImage(imageData, 'JPEG', margin, yPosition, printableWidth, imageHeight, undefined, 'FAST');
        remainingHeight -= printableHeight;
        while (remainingHeight > 0) {
          pdf.addPage();
          yPosition = margin - (imageHeight - remainingHeight);
          pdf.addImage(imageData, 'JPEG', margin, yPosition, printableWidth, imageHeight, undefined, 'FAST');
          remainingHeight -= printableHeight;
        }

        objectUrl = URL.createObjectURL(pdf.output('blob'));
        setPdfPreviewFilename(buildProcurementPdfFilename(
          requisition.pr_number || `PR-${requisition.id}`,
          'pr',
          requisition.issued_date || requisition.created_at,
        ));
        setPdfPreviewUrl(objectUrl);
      } catch (previewError) {
        if (!active) return;
        console.error('Failed to generate the Live Purchase Recommendation PDF:', previewError);
        setPdfPreviewError(previewError.message || 'The Live Purchase Recommendation PDF could not be generated.');
      } finally {
        if (active) setPdfPreviewLoading(false);
      }
    };

    const generationTimer = window.setTimeout(generatePreviewPdf, 100);

    return () => {
      active = false;
      window.clearTimeout(generationTimer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isOpen, requisition?.id, requisition?.pr_number, requisition?.issued_date, requisition?.created_at, pdfPreviewRetryKey]);

  useEffect(() => {
    const linkedOrderId = requisition?.linked_po_id;
    if (!isOpen || activePreview !== 'po' || !linkedOrderId) return undefined;

    let active = true;
    let objectUrl = '';
    setLinkedPoPreviewLoading(true);
    setLinkedPoPreviewError('');
    setLinkedPoPreviewUrl('');

    requestLinkedPurchaseOrderPdf(linkedOrderId)
      .then((response) => {
        if (!active) return;
        const disposition = response.headers?.['content-disposition'] || '';
        const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
        objectUrl = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
        setLinkedPoPreviewFilename(filenameMatch?.[1] || buildProcurementPdfFilename(
          linkedOrder?.po_number || requisition.po_number_reference || `PO-${linkedOrderId}`,
          'po',
          linkedOrder?.po_date || linkedOrder?.created_at,
        ));
        setLinkedPoPreviewUrl(objectUrl);
      })
      .catch(async (previewError) => {
        if (!active) return;
        console.error('Failed to load linked Purchase Order PDF:', previewError);
        let serviceMessage = previewError.response?.data?.detail || previewError.response?.data?.error;
        if (previewError.response?.data instanceof Blob) {
          try {
            const errorPayload = JSON.parse(await previewError.response.data.text());
            serviceMessage = errorPayload.detail || errorPayload.error;
          } catch {
            // Preserve the safe fallback for non-JSON upstream responses.
          }
        }
        setLinkedPoPreviewError(serviceMessage || 'The linked Purchase Order PDF is unavailable.');
      })
      .finally(() => { if (active) setLinkedPoPreviewLoading(false); });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [activePreview, isOpen, requisition?.linked_po_id, requisition?.po_number_reference, linkedPoPreviewRetryKey]);

  if (!isOpen || !requisition) return null;

  const normalizedRequisitionStatus = (requisition.status || '').toString().trim().toLowerCase();
  const isDraft = normalizedRequisitionStatus === 'draft';
  const isRejected = normalizedRequisitionStatus === 'rejected';
  const isConverted = normalizedRequisitionStatus === 'converted';
  const isStandardApprovalInProgress = ['submitted', 'in_review'].includes(
    normalizedRequisitionStatus
  );

  const normalizeApprovalStatus = (rawStatus) => {
    const normalized = (rawStatus || '').toString().trim().toLowerCase();
    if (['approved', 'complete', 'completed'].includes(normalized)) return 'approved';
    if (['not_approved', 'rejected', 'declined'].includes(normalized)) return 'not_approved';
    if (['not_recorded', 'not recorded', 'unknown'].includes(normalized)) return 'not_recorded';
    return 'pending';
  };

  const approvalDisplayStatus = (stageOrStatus) => {
    const stage = typeof stageOrStatus === 'object' && stageOrStatus !== null
      ? stageOrStatus
      : null;
    const rawStatus = stage ? stage.status : stageOrStatus;
    const normalized = normalizeApprovalStatus(rawStatus);
    return isConverted && normalized === 'pending' && !stage?.evidence_requested_at
      ? 'not_recorded'
      : normalized;
  };

  const approvalStatusLabel = (stageOrStatus) => {
    const normalized = approvalDisplayStatus(stageOrStatus);
    if (normalized === 'approved') return 'Approved';
    if (normalized === 'not_approved') return 'Rejected';
    if (normalized === 'not_recorded') return 'Not recorded';
    return 'Pending';
  };

  // Dynamic Workflow Hierarchy Array
  const rawApprovalHierarchy = Array.isArray(requisition.approval_workflow_config) && requisition.approval_workflow_config.length > 0
    ? requisition.approval_workflow_config
    : Array.isArray(requisition.approval_hierarchy)
      ? requisition.approval_hierarchy
      : [];
  const approvalHierarchy = displayApprovalWorkflow(
    rawApprovalHierarchy,
    requisition.po_number_reference,
  );

  // Active stage determination
  const pendingStages = approvalHierarchy.filter((entry) => {
    const status = (entry?.status || 'pending').toString().trim().toLowerCase();
    return (status === 'pending' || status === 'in_review')
      && (!isConverted || Boolean(entry?.evidence_requested_at));
  });
  const isEvidenceRecoveryActive = isConverted && pendingStages.length > 0;
  const isApprovalInProgress = isStandardApprovalInProgress || isEvidenceRecoveryActive;
  const hasMissingApprovalEvidence = isConverted && approvalHierarchy.some(
    stage => approvalDisplayStatus(stage) === 'not_recorded'
  );
  const workflowLevel = (entry, fallbackIndex = 0) => {
    const explicitLevel = Number(entry?.level);
    return Number.isFinite(explicitLevel) ? Math.max(0, explicitLevel) : fallbackIndex + 1;
  };
  const activeLevel = pendingStages.length
    ? Math.min(...pendingStages.map((entry, index) => workflowLevel(entry, approvalHierarchy.indexOf(entry) >= 0 ? approvalHierarchy.indexOf(entry) : index)))
    : null;
  const activeLevelStages = pendingStages.filter((entry, index) => (
    workflowLevel(entry, approvalHierarchy.indexOf(entry) >= 0 ? approvalHierarchy.indexOf(entry) : index) === activeLevel
  ));

  const currentUserData = currentUser?.user || currentUser || {};
  const currentUserId = currentUserData?.id || currentUser?.user_id || currentUser?.id;
  const currentStage = activeLevelStages.find(entry => String(entry?.user_id || entry?.approver_id) === String(currentUserId))
    || activeLevelStages[0]
    || null;

  const currentStageLabel = currentStage?.stage || currentStage?.role || 'the current approver';
  const currentStageRole = `${currentStage?.role || ''} ${currentStage?.stage || ''}`.toLowerCase();
  
  const currentStageKey = currentStageRole.includes('procurement department')
    ? 'procurement'
    : currentStageRole.includes('engineering manager') || currentStageRole.includes('manager of engineering') || currentStageRole.includes('moe') || currentStageRole.includes('engineering review')
    ? 'eng_manager'
    : currentStageRole.includes('manager of projects') || currentStageRole.includes('projects manager')
      ? 'manager_projects'
      : currentStageRole.includes('vp operations') || currentStageRole.includes('vice president') || currentStageRole.includes('procurement manager')
        ? 'vp'
        : currentStageRole.includes('level 1 approver') || currentStageRole.includes('project manager') || currentStageRole.includes('department manager') || currentStageRole.includes('technical review')
          ? 'pm'
          : currentStageRole.includes('general manager') || currentStageRole.includes('ceo')
            ? 'general_manager'
            : null;

  // Authorization Evaluation
  const issuedByValue = requisition.issued_by?.id || requisition.issued_by_id || requisition.issued_by;
  const isCurrentUserIssuer = Boolean(
    currentUserId && issuedByValue && String(currentUserId) === String(issuedByValue)
  );
  const currentUserRolesRaw = currentUser?.roles || currentUserData?.roles;
  const currentUserRoles = Array.isArray(currentUserRolesRaw) ? currentUserRolesRaw : [];
  
  const isSuperAdmin = currentUserData?.is_superuser === true || currentUserRoles.some(
    (role) => role?.code === 'super_admin' || role?.name === 'Super Administrator'
  );

  const assignedCurrentUserId = currentStage?.user_id || currentStage?.approver_id;
  const isAssignedCurrentApprover = Boolean(
    currentUserId && assignedCurrentUserId && String(currentUserId) === String(assignedCurrentUserId)
  );

  // Employment position is authoritative here. RBAC roles grant module access,
  // but they do not prove that the logged-in user holds the VP Operations post.
  const currentUserJobTitle = (currentUser?.job_title || currentUserData?.job_title || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
  const holdsVpOperationsPosition = [
    'vice president of operations',
    'vice president operations',
    'vp operations',
    'vp of operations',
  ].includes(currentUserJobTitle);

  // VP Operations has no administrator bypass: both assignment and position
  // are required. Other stages retain the existing Super Admin override.
  const canActOnCurrentStage = Boolean(
    currentStage && (
      currentStageKey === 'vp'
        ? isAssignedCurrentApprover && holdsVpOperationsPosition
        : isSuperAdmin || isAssignedCurrentApprover
    )
  );

  const APPROVER_CONFIG = {
    procurement: {
      label: 'Procurement Department',
      approveEndpoint: 'process_dynamic_approval',
      rejectEndpoint: 'process_dynamic_rejection',
      canApprove: isApprovalInProgress && currentStageKey === 'procurement' && canActOnCurrentStage
    },
    pm: {
      label: activeLevel === 1 ? 'Level 1 Approver' : 'Project Manager',
      approveEndpoint: 'pm_approve',
      rejectEndpoint: 'pm_reject',
      canApprove: isApprovalInProgress && currentStageKey === 'pm' && canActOnCurrentStage
    },
    eng_manager: {
      label: 'Engineering Manager',
      approveEndpoint: 'eng_manager_approve',
      rejectEndpoint: 'eng_manager_reject',
      canApprove: isApprovalInProgress && currentStageKey === 'eng_manager' && canActOnCurrentStage
    },
    manager_projects: {
      label: 'Manager of Projects',
      approveEndpoint: 'manager_projects_approve',
      rejectEndpoint: 'manager_projects_reject',
      canApprove: isApprovalInProgress && currentStageKey === 'manager_projects' && canActOnCurrentStage
    },
    vp: {
      label: 'Vice President of Operations',
      approveEndpoint: 'vp_approve',
      rejectEndpoint: 'vp_reject',
      canApprove: isApprovalInProgress && currentStageKey === 'vp' && canActOnCurrentStage
    },
    general_manager: {
      label: 'CEO',
      approveEndpoint: 'process_dynamic_approval',
      rejectEndpoint: 'process_dynamic_rejection',
      canApprove: isApprovalInProgress && currentStageKey === 'general_manager' && canActOnCurrentStage
    }
  };

  const hasAnyApprovalCapability = Object.values(APPROVER_CONFIG).some(config => config.canApprove);

  const handleSubmitForApproval = async () => {
    if (!isDraft || (!isCurrentUserIssuer && !isSuperAdmin)) return;
    setLoading(true);
    try {
      const response = await apiClient.post(`/procurement/requisitions/${requisition.id}/submit/`);
      alert(`PR ${response.data.pr_number || requisition.pr_number} submitted for approval. The assigned Project Manager can now approve or reject it.`);
      onApprovalComplete?.(response.data);
      onClose();
    } catch (error) {
      alert(error.response?.data?.error || error.response?.data?.detail || 'Failed to submit requisition for approval.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendMissingApprovals = async () => {
    if (!isConverted) return;
    const confirmed = window.confirm(
      'Resend the missing approval requests? Approvers will be notified and must record their own decisions.'
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await apiClient.post(
        `/procurement/requisitions/${requisition.id}/resend-missing-approvals/`
      );
      alert(response.data?.message || 'Missing approval requests were resent.');
      onApprovalComplete?.(response.data);
    } catch (error) {
      alert(
        error.response?.data?.error
        || error.response?.data?.detail
        || 'Failed to resend missing approval requests.'
      );
    } finally {
      setLoading(false);
    }
  };

  const validateRejectionReason = (reason) => {
    if (!reason || !reason.trim()) {
      return { valid: false, error: REJECTION_CONFIG.ERROR_MESSAGES.missing };
    }
    const trimmed = reason.trim();
    if (trimmed.length < REJECTION_CONFIG.MIN_REASON_LENGTH) {
      return { valid: false, error: REJECTION_CONFIG.ERROR_MESSAGES.too_short };
    }
    if (trimmed.length > REJECTION_CONFIG.MAX_REASON_LENGTH) {
      return { valid: false, error: REJECTION_CONFIG.ERROR_MESSAGES.too_long };
    }
    return { valid: true, error: null };
  };

  const handleApprove = async (approverType) => {
    const config = APPROVER_CONFIG[approverType];
    if (!config || !config.canApprove) {
      alert(`Action Locked: Awaiting review by ${currentStageLabel}`);
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post(
        `/procurement/requisitions/${requisition.id}/${config.approveEndpoint}/`,
        { signature: signature || '' }
      );

      alert(`Requisition approved by ${config.label}!`);
      window.dispatchEvent(new Event('procurement-approval-updated'));
      if (onApprovalComplete) onApprovalComplete(response.data);
      onClose();
    } catch (error) {
      console.error('Approval error:', error);
      alert(error.response?.data?.error || error.response?.data?.detail || 'Failed to approve requisition.');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectClick = (approverType) => {
    const config = APPROVER_CONFIG[approverType];
    if (!config?.canApprove) {
      alert(`Action Locked: Awaiting review by ${currentStageLabel}`);
      return;
    }
    setCurrentApproverType(approverType);
    setRejectionReason('');
    setRejectionError('');
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async () => {
    const config = APPROVER_CONFIG[currentApproverType];
    if (!config) return;

    const validation = validateRejectionReason(rejectionReason);
    if (!validation.valid) {
      setRejectionError(validation.error);
      return;
    }

    setLoading(true);
    setRejectionError('');
    
    try {
      const response = await apiClient.post(
        `/procurement/requisitions/${requisition.id}/${config.rejectEndpoint}/`,
        { reason: rejectionReason.trim() }
      );

      alert(`Requisition rejected by ${config.label}`);
      window.dispatchEvent(new Event('procurement-approval-updated'));
      if (onApprovalComplete) onApprovalComplete(response.data);
      onClose();
      setShowRejectModal(false);
    } catch (error) {
      console.error('Rejection error:', error);
      setRejectionError(error.response?.data?.error || error.response?.data?.detail || 'Failed to reject requisition.');
    } finally {
      setLoading(false);
    }
  };

  const handleReferral = async () => {
    if (referralRemarks.trim().length < 10) {
      setReferralError('Add at least 10 characters explaining the discussion required.');
      return;
    }
    setLoading(true);
    setReferralError('');
    try {
      const response = await apiClient.post(
        `/procurement/requisitions/${requisition.id}/refer-rejection/`,
        { target: referralTarget, remarks: referralRemarks.trim() }
      );
      alert(`Rejected PR referred to ${referralTarget === 'moe' ? 'Manager of Engineering' : 'Manager of Projects'} for discussion.`);
      onApprovalComplete?.(response.data);
    } catch (error) {
      setReferralError(error.response?.data?.error || error.response?.data?.remarks || 'Failed to create referral.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount, currency = 'USD') => {
    const numericAmount = Number(amount || 0);
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(numericAmount);
    } catch {
      return `${currency || 'USD'} ${numericAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });
  };

  const formatTimestamp = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const showingLinkedPo = activePreview === 'po' && Boolean(requisition.linked_po_id);
  const activePdfUrl = showingLinkedPo ? linkedPoPreviewUrl : pdfPreviewUrl;
  const activePdfFilename = showingLinkedPo ? linkedPoPreviewFilename : pdfPreviewFilename;
  const activePdfLoading = showingLinkedPo ? linkedPoPreviewLoading : pdfPreviewLoading;
  const activePdfError = showingLinkedPo ? linkedPoPreviewError : pdfPreviewError;

  const downloadPdf = () => {
    if (!activePdfUrl) return;
    const link = document.createElement('a');
    link.href = activePdfUrl;
    link.download = activePdfFilename || (showingLinkedPo ? 'Purchase_Order.pdf' : 'Purchase_Recommendation.pdf');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const printPdf = () => {
    if (pdfFrameRef.current?.contentWindow) {
      pdfFrameRef.current.contentWindow.focus();
      pdfFrameRef.current.contentWindow.print();
    }
  };

  const totalPrice = Number(requisition.total_price || 0);
  const hasExplicitNetPrice = requisition.net_total_excl_vat !== null
    && requisition.net_total_excl_vat !== undefined
    && requisition.net_total_excl_vat !== '';
  const netPrice = hasExplicitNetPrice ? Number(requisition.net_total_excl_vat) : totalPrice;
  const taxAmount = Math.max(0, totalPrice - netPrice);
  const vendor = requisition.vendor_details || {};
  const selectedVendor = (requisition.selected_vendors || [])[0] || {};
  const vendorName = requisition.vendor_name || requisition.supplier_name || selectedVendor.name || '—';
  const vendorContact = vendor.contact_person || selectedVendor.contact_person || '—';
  const vendorEmail = vendor.email || selectedVendor.email || '—';

  const getStatusColor = (stageOrStatus) => {
    const normalized = approvalDisplayStatus(stageOrStatus);
    if (normalized === 'approved') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (normalized === 'not_approved') return 'bg-red-100 text-red-800 border-red-300';
    if (normalized === 'not_recorded') return 'bg-slate-100 text-slate-700 border-slate-300';
    return 'bg-amber-100 text-amber-800 border-amber-300';
  };

  const getRecordStatusColor = () => {
    if (normalizedRequisitionStatus === 'converted') return 'border-slate-300 bg-slate-100 text-slate-700';
    if (normalizedRequisitionStatus === 'approved') return 'border-emerald-300 bg-emerald-100 text-emerald-800';
    if (normalizedRequisitionStatus === 'rejected') return 'border-red-300 bg-red-100 text-red-800';
    if (['submitted', 'in_review'].includes(normalizedRequisitionStatus)) return 'border-blue-300 bg-blue-100 text-blue-800';
    return 'border-slate-300 bg-white text-slate-700';
  };

  return (
    <>
      <div className="pointer-events-none fixed left-[-10000px] top-0 w-[794px] bg-white p-4" aria-hidden="true">
        <div ref={pdfSourceRef} className="bg-white p-3">
          <PurchaseRequisitionDocumentPreview requisition={requisition} live documentOnly />
        </div>
      </div>
      <div className={pageMode ? 'min-h-[calc(100vh-4rem)] bg-slate-50' : 'fixed inset-0 z-50 overflow-y-auto bg-slate-50'}>
        <div className="mx-auto min-h-full w-full max-w-[1680px] px-4 py-5 sm:px-6 lg:px-8">
          
          {/* Modal Header */}
          <header className="mb-5 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
              <div className="flex min-w-0 items-start gap-3">
                <button type="button" onClick={onClose} aria-label="Back to Purchase Recommendations" title="Back to Purchase Recommendations" className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">
                  <ArrowLeftIcon className="h-4 w-4" />
                </button>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{requisition.pr_number || `PR-${requisition.id}`}</h1>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getRecordStatusColor()}`}>{requisition.status_display || requisition.status || 'Draft'}</span>
                    {requisition.linked_po_id && <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700" title={linkedOrder?.po_number || requisition.po_number_reference || 'Linked Purchase Order'}><LinkIcon className="h-3.5 w-3.5" /> Linked PO</span>}
                  </div>
                </div>
              </div>
              <section className="min-w-0 flex-1 xl:mx-6" aria-label="Approval history">
                <div className="flex min-w-0 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50" role="list" aria-label="Approval workflow progress">
                  {approvalHierarchy.length > 0 ? approvalHierarchy.map((stage, index) => {
                    const stageStatus = approvalDisplayStatus(stage);
                    const stageTimestamp = stage.approved_at || stage.rejected_at || stage.evidence_requested_at;
                    return (
                      <div key={`${stage.role || stage.stage}-${index}`} className="flex min-w-[170px] flex-1 items-center gap-2.5 border-r border-slate-200 px-3 py-2 last:border-r-0" role="listitem" title={[stage.role || stage.stage, stage.user_name, approvalStatusLabel(stage), stageTimestamp && formatTimestamp(stageTimestamp)].filter(Boolean).join(' · ')}>
                          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${getStatusColor(stage)}`}>
                            {stageStatus === 'approved' ? <CheckCircleIcon className="h-4 w-4" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                          </span>
                          <div className="min-w-0"><p className="truncate text-[11px] font-bold text-slate-800">{stage.role || stage.stage || `Stage ${index + 1}`}</p><p className="truncate text-[10px] text-slate-500">{nameOnly(stage.user_name) || approvalStatusLabel(stage)}</p><p className="mt-0.5 truncate text-[9px] font-medium text-slate-400">{stageTimestamp ? formatTimestamp(stageTimestamp) : 'Pending'}</p></div>
                      </div>
                    );
                  }) : <p className="text-xs text-slate-500">Approval workflow has not been configured.</p>}
                </div>
              </section>
              <div className="flex shrink-0 flex-wrap items-center gap-2" aria-label="Purchase Recommendation actions">
                <button type="button" onClick={printPdf} disabled={!activePdfUrl} aria-label={`Print ${showingLinkedPo ? 'linked Purchase Order' : 'Purchase Recommendation'} preview`} title={`Print ${showingLinkedPo ? 'linked Purchase Order' : 'Purchase Recommendation'} preview`} className="inline-grid h-9 w-9 place-items-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50">
                  <PrinterIcon className="h-4 w-4" />
                </button>
                <button type="button" onClick={downloadPdf} disabled={!activePdfUrl} aria-label={`Download ${showingLinkedPo ? 'linked Purchase Order' : 'Purchase Recommendation'} PDF`} title={`Download ${showingLinkedPo ? 'linked Purchase Order' : 'Purchase Recommendation'} PDF`} className="inline-grid h-9 w-9 place-items-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50">
                  <ArrowDownTrayIcon className="h-4 w-4" />
                </button>
                {isDraft && (isCurrentUserIssuer || isSuperAdmin) && (
                  <button type="button" onClick={() => navigate(`/procurement/requisitions/${requisition.id}/edit`)} className="inline-flex h-9 items-center rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">
                    <PencilSquareIcon className="mr-2 h-4 w-4" /> Edit
                  </button>
                )}
              </div>
            </div>
          </header>

          {/* Modal Content Body */}
          <main>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
              
              {/* Left Column - PR Form Information */}
              <div className="space-y-6 xl:col-span-3">
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="mb-5 flex items-center text-base font-semibold text-slate-900"><DocumentTextIcon className="mr-2 h-5 w-5 text-indigo-600" /> Recommendation Information</h2>
                  <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                    <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">PR Number</dt><dd className="mt-1 text-sm font-semibold text-slate-950">{requisition.pr_number || '—'}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Issued Date</dt><dd className="mt-1 text-sm text-slate-900">{formatDate(requisition.issued_date)}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Issued By</dt><dd className="mt-1 text-sm text-slate-900">{requisition.issued_by_name || '—'}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project / Department</dt><dd className="mt-1 text-sm text-slate-900">{requisition.project_department || requisition.enterprise_project_name || '—'}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Type</dt><dd className="mt-1 text-sm text-slate-900">{requisition.requisition_type_display || requisition.requisition_type || '—'}</dd></div>
                    <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</dt><dd className="mt-1 text-sm text-slate-900">{requisition.priority_display || requisition.priority || '—'}</dd></div>
                    <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Product / Service</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{requisition.product_service || requisition.description_reason || '—'}</dd></div>
                  </dl>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="mb-5 text-base font-semibold text-slate-900">Financial Details</h2>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Net Amount</p><p className="mt-2 text-lg font-bold text-slate-950">{formatCurrency(netPrice, requisition.currency)}</p></div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">VAT / Tax</p><p className="mt-2 text-lg font-bold text-slate-950">{formatCurrency(taxAmount, requisition.currency)}</p></div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Total Price</p><p className="mt-2 text-xl font-bold text-emerald-700">{formatCurrency(totalPrice, requisition.currency)}</p></div>
                  </div>
                </section>

                <div className="grid gap-6 md:grid-cols-2">
                  <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-4 flex items-center text-base font-semibold text-slate-900"><UserCircleIcon className="mr-2 h-5 w-5 text-purple-600" /> Vendor Details</h2>
                    <dl className="space-y-3"><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vendor Name</dt><dd className="mt-1 text-sm font-semibold text-slate-950">{vendorName}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</dt><dd className="mt-1 text-sm text-slate-900">{vendorContact}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</dt><dd className="mt-1 break-all text-sm text-indigo-700">{vendorEmail}</dd></div></dl>
                  </section>
                  <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-4 flex items-center text-base font-semibold text-slate-900"><ClockIcon className="mr-2 h-5 w-5 text-indigo-600" /> Timeline</h2>
                    <div className="space-y-4"><div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-100"><CheckCircleIcon className="h-5 w-5 text-indigo-600" /></span><div><p className="text-sm font-semibold text-slate-900">Recommendation Created</p><p className="text-xs text-slate-500">{formatTimestamp(requisition.created_at)}</p></div></div><div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-100"><PencilSquareIcon className="h-5 w-5 text-amber-600" /></span><div><p className="text-sm font-semibold text-slate-900">Last Updated</p><p className="text-xs text-slate-500">{formatTimestamp(requisition.updated_at)}</p></div></div></div>
                  </section>
                </div>

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-base font-semibold text-slate-900">Purchase Recommendation</h2>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{requisition.purchase_recommendation || requisition.description_reason || 'No recommendation notes recorded.'}</p>
                </section>
                <div className="hidden">
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <InformationCircleIcon className="h-5 w-5 mr-2 text-indigo-600" />
                    Header Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Issued By</p>
                      <p className="text-sm font-medium text-gray-900">{requisition.issued_by_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Issued Date</p>
                      <p className="text-sm font-medium text-gray-900">{formatDate(requisition.issued_date)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Priority</p>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        requisition.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                        requisition.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                        requisition.priority === 'normal' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {requisition.priority_display || requisition.priority}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Requisition Type</p>
                      <p className="text-sm font-medium text-gray-900">{requisition.requisition_type_display || requisition.requisition_type}</p>
                    </div>
                  </div>
                </div>

                {(requisition.supplier_name || (requisition.selected_vendors || []).length > 0) && (
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Vendor Selection</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Selected Supplier</p>
                        <p className="text-sm font-medium text-gray-900">{requisition.supplier_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Business ID</p>
                        <p className="text-sm font-medium text-gray-900">{requisition.supplier_business_id || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Product/Service Details</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Product/Service</p>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{requisition.product_service}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Project/Department</p>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{requisition.project_department}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Purchase Description</p>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{requisition.description_reason}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-6 border border-indigo-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing Details</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Purchase Description</p>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{requisition.price_description}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Currency</p>
                        <p className="text-lg font-bold text-indigo-600">{requisition.currency}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total Price</p>
                        <p className="text-lg font-bold text-indigo-600">{formatCurrency(requisition.total_price, requisition.currency)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Net Total (excl VAT)</p>
                        <p className="text-lg font-bold text-indigo-600">{formatCurrency(requisition.net_total_excl_vat, requisition.currency)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Reference & Recommendation</h3>
                  <div className="space-y-4 text-sm">
                    <div>
                      <p className="text-gray-500">PO Applicable</p>
                      <p className="font-medium text-gray-900">{requisition.po_applicable ? 'Yes' : 'No'}</p>
                      {requisition.po_applicable && requisition.po_number_reference && (
                        requisition.linked_po_id
                          ? <button type="button" onClick={() => setActivePreview('po')} className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 hover:text-indigo-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><LinkIcon className="h-4 w-4" />{requisition.po_number_reference} · View in preview</button>
                          : <p className="font-semibold text-gray-900">{requisition.po_number_reference}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-gray-500">Purchase Recommendation</p>
                      <p className="whitespace-pre-wrap text-gray-900">{requisition.purchase_recommendation || '—'}</p>
                    </div>
                    {requisition.requires_management_approval && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="font-semibold text-amber-900">Management Approval: {requisition.management_approval ? 'Yes' : 'No'}</p>
                        <p className="mt-1 text-amber-800">{requisition.management_approval_remarks || 'No remarks'}</p>
                        <p className="mt-1 text-xs text-amber-700">Evidence: {(requisition.management_approval_evidence || []).length ? 'Attached' : 'Missing'}</p>
                      </div>
                    )}
                  </div>
                </div>
                </div>
              </div>
              {/* Right Column - Dynamic Approval History & Action Controls */}
              <aside className="space-y-6 xl:col-span-2">
                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Procurement document preview">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2.5">
                    <div className="inline-flex min-w-0 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Available documents">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activePreview === 'pr'}
                        aria-controls="procurement-document-preview"
                        onClick={() => setActivePreview('pr')}
                        className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${activePreview === 'pr' ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'}`}
                      >
                        <DocumentTextIcon className="h-4 w-4 shrink-0" />
                        <span>PR Preview</span>
                      </button>
                      {requisition.linked_po_id && (
                        <button
                          type="button"
                          role="tab"
                          aria-selected={activePreview === 'po'}
                          aria-controls="procurement-document-preview"
                          onClick={() => setActivePreview('po')}
                          className={`inline-flex h-9 min-w-0 items-center gap-2 rounded-md px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${activePreview === 'po' ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'}`}
                          title={linkedOrder?.po_number || requisition.po_number_reference || 'Linked Purchase Order'}
                        >
                          <LinkIcon className="h-4 w-4 shrink-0" />
                          <span className="min-w-0 text-left">
                            <span className="block">Linked PO</span>
                            <span className="block max-w-32 truncate text-[10px] font-medium text-slate-500">{linkedOrder?.po_number || requisition.po_number_reference || 'Purchase Order'}</span>
                          </span>
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={downloadPdf}
                      disabled={!activePdfUrl}
                      aria-label={`Download ${showingLinkedPo ? 'linked Purchase Order' : 'Purchase Recommendation'} PDF`}
                      title={`Download ${showingLinkedPo ? 'linked Purchase Order' : 'Purchase Recommendation'} PDF`}
                      className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4" />
                    </button>
                  </div>
                  <div id="procurement-document-preview" className="grid h-[800px] place-items-center bg-slate-800" role="tabpanel">
                    {activePdfLoading && <div className="text-center text-white"><div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-500 border-t-white" /><p className="mt-3 text-sm">{showingLinkedPo ? 'Loading linked Purchase Order…' : 'Creating PDF from the live preview…'}</p></div>}
                    {!activePdfLoading && activePdfError && <div className="max-w-sm px-6 text-center text-white"><ExclamationTriangleIcon className="mx-auto h-9 w-9 text-amber-300" /><p className="mt-3 text-sm">{activePdfError}</p><button type="button" onClick={() => showingLinkedPo ? setLinkedPoPreviewRetryKey((key) => key + 1) : setPdfPreviewRetryKey((key) => key + 1)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-800"><ArrowPathIcon className="h-4 w-4" /> Retry preview</button></div>}
                    {!activePdfLoading && activePdfUrl && <iframe key={`${activePreview}-${activePdfUrl}`} ref={pdfFrameRef} src={`${activePdfUrl}#page=1&zoom=page-width&view=FitH&toolbar=0&navpanes=0&scrollbar=1`} title={`${activePdfFilename || (showingLinkedPo ? 'Linked Purchase Order' : 'Purchase Recommendation')} preview`} className="h-full w-full bg-white" />}
                  </div>
                </section>
                
                {(hasMissingApprovalEvidence || isEvidenceRecoveryActive || (isRejected && requisition.rejection_reason) || (isRejected && (isCurrentUserIssuer || isSuperAdmin))) && (
                <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Approval notices">
                    {hasMissingApprovalEvidence && (
                      <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-xs text-slate-700">
                        <p>
                          This PR is linked to a converted PO, but internal approval evidence was not recorded for the stages marked below.
                        </p>
                        <button
                          type="button"
                          onClick={handleResendMissingApprovals}
                          disabled={loading}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                          {loading ? 'Resending...' : 'Resend approval requests'}
                        </button>
                      </div>
                    )}
                    {isEvidenceRecoveryActive && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                        Approval recovery is active. The current approver has been notified and can record a decision from the Approvals tab.
                      </div>
                    )}
                  {isRejected && requisition.rejection_reason && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-sm font-medium text-red-800 mb-1">Rejection Reason:</p>
                      <p className="text-sm text-red-700">{requisition.rejection_reason}</p>
                    </div>
                  )}
                  {isRejected && (isCurrentUserIssuer || isSuperAdmin) && (
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                      <p className="text-sm font-semibold text-indigo-900">Discussion / Resolution Referral</p>
                      {requisition.resolution_referral?.status === 'open' ? (
                        <div className="mt-2 text-xs text-indigo-800">
                          Referred to {requisition.resolution_referral.target_label}: {requisition.resolution_referral.remarks}
                        </div>
                      ) : (
                        <div className="mt-3 space-y-3">
                          <select value={referralTarget} onChange={event => setReferralTarget(event.target.value)} className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm">
                            <option value="moe">Manager of Engineering (MoE)</option>
                            <option value="mop">Manager of Projects (MoP)</option>
                          </select>
                          <textarea value={referralRemarks} onChange={event => { setReferralRemarks(event.target.value); setReferralError(''); }} rows={3} className="w-full rounded-lg border border-indigo-300 px-3 py-2 text-sm" placeholder="Explain the discussion or resolution required..." />
                          {referralError && <p className="text-xs text-red-600">{referralError}</p>}
                          <button type="button" onClick={handleReferral} disabled={loading} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">Send for Discussion</button>
                        </div>
                      )}
                    </div>
                  )}
                </section>
                )}

                {/* Interactive Action Controls */}
                {isDraft && currentStage && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <InformationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-blue-900">Approval has not started</h3>
                        <p className="mt-1 text-xs leading-relaxed text-blue-800">
                          {nameOnly(currentStage.user_name) || currentStageLabel} is assigned and pending, but this requisition is still a draft. Approve and Reject become available only after submission.
                        </p>
                        {(isCurrentUserIssuer || isSuperAdmin) ? (
                          <button type="button" onClick={handleSubmitForApproval} disabled={loading} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                            <PaperAirplaneIcon className="h-4 w-4" />
                            {loading ? 'Submitting...' : 'Submit for Approval'}
                          </button>
                        ) : (
                          <p className="mt-3 text-xs font-semibold text-blue-900">The requisition issuer must submit this draft.</p>
                        )}
                      </div>
                    </div>
                    {(requisition.selected_vendors || []).length > 0 && (
                      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
                        {(requisition.selected_vendors || []).map(vendor => (
                          <div key={vendor.vendor_id} className="flex justify-between gap-4 border-b border-gray-100 px-3 py-2 text-xs last:border-0">
                            <span className="font-medium text-gray-800">{vendor.name}</span>
                            <span className="text-gray-500">ICV {vendor.icv_percentage ?? 'N/A'}% ┬╖ {vendor.icv_expiry_date ? `valid to ${vendor.icv_expiry_date}` : 'validity not recorded'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {(requisition.selected_vendors || []).length === 1 && requisition.single_source_justification && (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-semibold text-amber-900">Single Source Justification</p>
                        <p className="mt-1 text-xs text-amber-800">{requisition.single_source_justification}</p>
                      </div>
                    )}
                  </div>
                )}

                {hasAnyApprovalCapability && (
                  <div className="bg-white rounded-lg border-2 border-indigo-200 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <PencilSquareIcon className="h-5 w-5 mr-2 text-indigo-600" />
                      Your Action Required
                    </h3>

                    <div className="mb-4">
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Digital Signature (Optional)
                      </label>
                      <input
                        type="text"
                        value={signature}
                        onChange={(e) => setSignature(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Enter your name or signature"
                      />
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {currentStageLabel} Review
                      </h4>

                      {Object.keys(APPROVER_CONFIG).map((key) => {
                        const config = APPROVER_CONFIG[key];
                        if (!config.canApprove) return null;

                        return (
                          <div key={key} className="flex gap-2">
                            <button
                              onClick={() => handleApprove(key)}
                              disabled={loading}
                              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all font-semibold text-sm disabled:opacity-50"
                            >
                              <CheckCircleIcon className="h-5 w-5" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => handleRejectClick(key)}
                              disabled={loading}
                              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-semibold text-sm disabled:opacity-50"
                            >
                              <XCircleIcon className="h-5 w-5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Locked Action Banner */}
                {currentStage && isApprovalInProgress && !hasAnyApprovalCapability && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
                    <div className="flex items-start space-x-3">
                      <LockClosedIcon className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-bold text-sm text-amber-900">
                          Action Locked: Awaiting review by {currentStageLabel}
                        </h3>
                        <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                          {currentStageKey === 'vp'
                            ? 'Only the assigned user with the Vice President of Operations job title can approve or reject this requisition.'
                            : 'Only the approver assigned to this stage can approve or reject this requisition.'}
                        </p>
                        {currentStage?.user_name && (
                          <p className="mt-2 text-xs font-semibold text-amber-900">
                            Assigned approver: {currentStage.user_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              </aside>
            </div>
          </main>

          {/* Modal Footer */}
          {!pageMode && <div className="mt-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs text-gray-500">
              Form Reference: {requisition.form_reference || 'RAD-OM-PRC-0001'}
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors text-sm font-medium"
            >
              Close
            </button>
          </div>}
        </div>
      </div>

      {/* Mandatory Rejection Reason Modal */}
      {showRejectModal && currentApproverType && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4">
              <div className="flex items-center space-x-3">
                <ExclamationTriangleIcon className="h-6 w-6" />
                <h3 className="text-xl font-bold">Reject Purchase Requisition</h3>
              </div>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => {
                  setRejectionReason(e.target.value);
                  setRejectionError('');
                }}
                rows={4}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none text-sm ${
                  rejectionError ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter a detailed reason for rejecting this purchase requisition..."
              />
              
              <div className="flex justify-between items-center mt-2 text-xs">
                <p className={rejectionReason.trim().length < REJECTION_CONFIG.MIN_REASON_LENGTH ? 'text-red-500' : 'text-emerald-600'}>
                  {rejectionReason.trim().length} / {REJECTION_CONFIG.MIN_REASON_LENGTH} chars minimum
                </p>
              </div>

              {rejectionError && (
                <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  <span>{rejectionError}</span>
                </p>
              )}

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowRejectModal(false)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectSubmit}
                  disabled={loading || rejectionReason.trim().length < REJECTION_CONFIG.MIN_REASON_LENGTH}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50"
                >
                  {loading ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

PurchaseRequisitionApproval.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  requisition: PropTypes.object,
  currentUser: PropTypes.object,
  onApprovalComplete: PropTypes.func,
  pageMode: PropTypes.bool,
};

export default PurchaseRequisitionApproval;
