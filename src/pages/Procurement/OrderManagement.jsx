import { radaiConfirm, radaiAlert } from '../../services/radaiDialog'
import React, { useState, useEffect } from 'react';
import { useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ArrowDownTrayIcon, PrinterIcon, XMarkIcon } from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import * as XLSX from 'xlsx';
import { usePageControls } from '../../hooks/usePageControls';
import AIPurchaseOrderCreator from './AIPurchaseOrderCreator';
import PurchaseRequisitionApproval from './PurchaseRequisitionApproval';
import PurchaseRequisitionExcelImport from './PurchaseRequisitionExcelImport';
import PurchaseRequisitionPdfImport from './PurchaseRequisitionPdfImport';
import PurchaseOrderExcelImport from './PurchaseOrderExcelImport';
import PurchaseOrderPdfImport from './PurchaseOrderPdfImport';
import PurchaseOrderForm from './PurchaseOrderForm';
import { buildProcurementPdfFilename } from '../../utils/procurementPdfFilename';
import { employeeDisplayName } from '../../utils/employeeDisplayName';
import ProcurementRegister from './ProcurementRegister';
import { pendingPurchaseOrderDocument } from './procurementRegisterModel';
import PurchaseRecommendations from './PurchaseRecommendations';

const PR_REGISTER_COLUMNS = [
  ['SN', 8],
  ['PR Number', 24],
  ['PR Accepted Date', 18],
  ['PO Number', 28],
  ['Ord.Date', 16],
  ['Suppl.Name', 34],
  ['Summary of Purchase /Activity', 48],
  ['Project short name/ Code', 25],
  ['OA date', 16],
  ['Delivery/ Completion Date', 22],
  ['Payment terms', 36],
  ['PO Amount w/o VAT', 20],
  ['PO Currency', 14],
  ['PO Amount including VAT', 22],
  ['Amount Excl VAT in AED', 22],
  ['Budget in AED', 18],
  ['Initial Proposal in AED', 22],
  ['Final Negotiated price in AED', 25],
  ['%Savings from Budget', 20],
  ['% Negotiated', 16],
  ['Country (of Vendor/SC)', 24],
  ['PO Status', 16],
  ['ICV', 14],
  ['Remarks', 48],
];

const PO_REGISTER_COLUMNS = [
  ['PO Number', 28],
  ['PR Number', 26],
  ['PR Accepted Date', 18],
  ['Suppl.Name', 34],
  ['Summary of Purchase', 48],
  ['Project short name/ Code', 26],
  ['Ord.Date', 16],
  ['OA date', 16],
  ['Delivery Date', 20],
  ['Payment terms', 36],
  ['Amount Curr.', 18],
  ['Curr.', 10],
  ['Amount including VAT', 22],
  ['Amount Inc VAT in AED', 23],
  ['Country', 16],
  ['Remarks', 42],
];

const getPORegisterValue = (order, column) => {
  const attachments = order?.attachments || [];
  const source = (
    attachments.find(item => item?.type === 'signed_purchase_order_pdf' && item?.procurement_register)
    || attachments.find(item => item?.procurement_register)
  )?.procurement_register || {};
  if (source[column] !== undefined && source[column] !== null && source[column] !== '') {
    return source[column];
  }
  const netAmount = Number(order?.total_amount || 0);
  const taxAmount = Number(order?.tax_amount || 0);
  const amountWithVat = netAmount + taxAmount;
  const fallbacks = {
    'PO Number': order?.po_number,
    'PR Number': order?.pr_number,
    'Suppl.Name': order?.vendor_name,
    'Summary of Purchase': order?.description || order?.title,
    'Project short name/ Code': order?.project_number || order?.project_display,
    'Ord.Date': order?.po_date,
    'Delivery Date': order?.expected_delivery,
    'Payment terms': order?.payment_terms,
    'Amount Curr.': order?.total_amount,
    'Curr.': order?.currency,
    'Amount including VAT': amountWithVat || '',
    'Amount Inc VAT in AED': order?.currency === 'AED' ? (amountWithVat || '') : '',
    Remarks: order?.notes,
  };
  return fallbacks[column] ?? '';
};

const getPRRegisterValue = (requisition, column, rowIndex = 0) => {
  const register = requisition?.price_remarks_data?.procurement_register || {};
  if (register[column] !== undefined && register[column] !== null && register[column] !== '') {
    return register[column];
  }
  const fallbacks = {
    SN: rowIndex + 1,
    'PR Number': requisition?.pr_number,
    'PR Accepted Date': requisition?.issued_date,
    'PO Number': requisition?.po_number_reference,
    'Suppl.Name': requisition?.supplier_name || requisition?.vendor_name,
    'Summary of Purchase /Activity': requisition?.product_service || requisition?.title,
    'Project short name/ Code': requisition?.project_department || requisition?.project,
    'Delivery/ Completion Date': requisition?.required_date,
    'Payment terms': requisition?.price_remarks_data?.payment_terms,
    'PO Amount w/o VAT': requisition?.total_price,
    'PO Currency': requisition?.currency,
    'Amount Excl VAT in AED': requisition?.price_remarks_data?.amount_excl_vat_aed,
    'Budget in AED': requisition?.estimated_budget || requisition?.price_remarks_data?.budget_in_aed,
    'Country (of Vendor/SC)': requisition?.price_remarks_data?.vendor_country,
    'PO Status': requisition?.price_remarks_data?.source_po_status || requisition?.status,
    ICV: requisition?.price_remarks_data?.icv,
    Remarks: requisition?.notes || requisition?.price_remarks,
  };
  return fallbacks[column] ?? '';
};

const approverUsersFromResponse = (response) => {
  const payload = response?.data?.data || response?.data || {};
  return Array.isArray(payload.users) ? payload.users : [];
};

const resolveRequesterName = (requisition, employeesById) => {
  const suppliedName = requisition?.requester_name
    || requisition?.issued_by_name
    || requisition?.requested_by_name;
  if (String(suppliedName || '').trim()) return suppliedName;

  const requesterId = requisition?.requested_by || requisition?.issued_by;
  const employee = employeesById.get(String(requesterId ?? ''));
  return employee ? employeeDisplayName(employee, '') : '';
};

const OrderManagement = () => {
  // Navigation hook for soft-coded routing
  const navigate = useNavigate();
  const location = useLocation();
  const { id: requisitionRouteId } = useParams();
  
  // The route is the source of truth so both entry points render one experience.
  const activeTab = location.pathname.startsWith('/procurement/requisitions')
    ? 'purchaseRequisitions'
    : 'purchaseOrders';
  
  // View mode state - soft-coded toggle between card and list view
  
  // Purchase Orders state
  const [orders, setOrders] = useState([]);
  const [pendingUploadError, setPendingUploadError] = useState('');
  const [orderPdfBusy, setOrderPdfBusy] = useState(false);
  const [recommendationCount, setRecommendationCount] = useState(null);
  const [purchaseOrderCount, setPurchaseOrderCount] = useState(null);
  
  // Purchase Requisitions state
  const [requisitions, setRequisitions] = useState([]);
  
  // Shared state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [batchActionLoading, setBatchActionLoading] = useState(false);
  const [showAICreator, setShowAICreator] = useState(false);
  const [showPOForm, setShowPOForm] = useState(false);
  const [showPRExcelImport, setShowPRExcelImport] = useState(false);
  const [showPRPdfImport, setShowPRPdfImport] = useState(false);
  const [pdfAttachmentPrNumber, setPdfAttachmentPrNumber] = useState('');
  const [showPOExcelImport, setShowPOExcelImport] = useState(false);
  const [showPOPdfImport, setShowPOPdfImport] = useState(false);
  const [poPreviewDocumentId, setPoPreviewDocumentId] = useState(null);
  const [poDocumentEditMode, setPoDocumentEditMode] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedRequisition, setSelectedRequisition] = useState(null);
  const [prPrintPreview, setPrPrintPreview] = useState(null);
  const [prPrintPreviewLoadingId, setPrPrintPreviewLoadingId] = useState(null);
  const prPdfFrameRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [projects, setProjects] = useState([]);  // Smart project lookup for PO creation
  // Soft-coded edit state - track which record is being edited
  const [editingOrder, setEditingOrder] = useState(null);

  const pageControls = usePageControls({
    autoRefreshInterval: 60,
    features: { autoRefresh: true, fullscreen: true, sidebar: true }
  });

  const currentUserData = currentUser?.user || currentUser || {};
  const currentUserId = currentUserData.id || currentUser?.user_id;
  const currentUserRolesRaw = currentUser?.roles || currentUserData.roles;
  const currentUserModulesRaw = currentUser?.modules || currentUserData.modules;
  const currentUserRoles = Array.isArray(currentUserRolesRaw) ? currentUserRolesRaw : [];
  const currentUserModules = Array.isArray(currentUserModulesRaw) ? currentUserModulesRaw : [];
  const isCurrentUserAdmin = Boolean(
    currentUserData.is_superuser
    || currentUserRoles.some(role => role?.code === 'super_admin' || role?.code === 'admin')
  );
  const hasPurchaseOrderAccess = isCurrentUserAdmin || currentUserModules.some(
    module => (typeof module === 'string' ? module : module?.code) === 'procurement_orders'
  );
  const canModifyRequisition = (requisition) => Boolean(
    isCurrentUserAdmin || (currentUserId && String(requisition?.issued_by) === String(currentUserId))
  );
  const canDeleteRequisition = (requisition) => Boolean(
    isCurrentUserAdmin || (currentUserId && String(requisition?.issued_by) === String(currentUserId))
  );

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const urlFilters = new URLSearchParams(window.location.search);
      const requestParams = {
        page_size: 10000,
        enterprise_project: urlFilters.get('enterprise_project') || undefined,
        legacy_project: urlFilters.get('legacy_project') || undefined,
      };
      const response = await apiClient.get('/procurement/orders/', { params: requestParams });
      
      // Soft-coded data normalization - ensure array
      let normalizedData = [];
      const data = response.data;
      if (Array.isArray(data)) {
        normalizedData = data;
      } else if (data && Array.isArray(data.results)) {
        normalizedData = data.results;
      } else if (data && typeof data === 'object') {
        throw new Error('The purchase order register returned an unexpected response.');
      }
      let next = data?.next;
      const visitedPages = new Set(['1']);
      while (next) {
        const nextPage = new URL(next, window.location.origin).searchParams.get('page');
        if (!nextPage || visitedPages.has(nextPage)) throw new Error('The purchase order register pagination could not be completed.');
        visitedPages.add(nextPage);
        const following = await apiClient.get('/procurement/orders/', { params: { ...requestParams, page: nextPage } });
        if (!Array.isArray(following.data?.results)) throw new Error('The purchase order register returned an incomplete page.');
        normalizedData.push(...following.data.results);
        next = following.data.next;
      }
      
      normalizedData.sort((a, b) => {
        const aCreated = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const bCreated = b?.created_at ? new Date(b.created_at).getTime() : 0;
        if (aCreated !== bCreated) return bCreated - aCreated;
        return (b.po_number || '').localeCompare(a.po_number || '', undefined, { numeric: true, sensitivity: 'base' });
      });
      
      setPurchaseOrderCount(normalizedData.length);
      setPendingUploadError('');
      let pendingDocuments = [];
      // Unreconciled PDFs do not yet have a verified project association.
      if (!requestParams.enterprise_project && !requestParams.legacy_project) {
        try {
          const documentParams = { pending_reconciliation: true, page_size: 10000 };
          const pending = await apiClient.get('/procurement/po-documents/', { params: documentParams });
          const payload = pending.data;
          if (!Array.isArray(payload) && !Array.isArray(payload?.results)) throw new Error('Unexpected uploaded document response.');
          pendingDocuments = Array.isArray(payload) ? payload : payload.results;
          let nextDocumentPage = payload?.next;
          const documentPages = new Set(['1']);
          while (nextDocumentPage) {
            const page = new URL(nextDocumentPage, window.location.origin).searchParams.get('page');
            if (!page || documentPages.has(page)) throw new Error('Uploaded document pagination could not be completed.');
            documentPages.add(page);
            const following = await apiClient.get('/procurement/po-documents/', { params: { ...documentParams, page } });
            if (!Array.isArray(following.data?.results)) throw new Error('Uploaded document response was incomplete.');
            pendingDocuments.push(...following.data.results);
            nextDocumentPage = following.data.next;
          }
        } catch (problem) {
          setPendingUploadError(problem.response?.data?.detail || problem.message || 'Uploaded PDFs could not be loaded.');
        }
      }
      const pendingRows = [...new Map(pendingDocuments.filter(document => !document.confirmed_po).map(document => [document.id, document])).values()]
        .map(pendingPurchaseOrderDocument);
      setOrders([...normalizedData, ...pendingRows]);
      
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError({ 
        type: 'network', 
        message: `Failed to load purchase orders: ${error.response?.data?.detail || error.message}`,
        action: () => fetchOrders()
      });
      setOrders([]); // Ensure array even on error
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await apiClient.get('/procurement/vendors/');
      const data = response.data;
      setVendors(Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      setVendors([]);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await apiClient.get('/procurement/projects/');
      const data = response.data;
      setProjects(Array.isArray(data.results) ? data.results : Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]);
    }
  };

  const fetchRequisitions = async () => {
    try {
      setLoading(true);
      setError(null);

      const [response, employeeResponse] = await Promise.all([
        apiClient.get('/procurement/requisitions/', { params: { _fresh: Date.now(), page_size: 10000 } }),
        apiClient.get('/procurement/requisitions/get_approvers/', {
          params: { role: 'any_active', _fresh: Date.now() },
          silentTimeout: true,
        }).catch(() => ({ data: { users: [] } })),
      ]);
      const data = response.data;
      
      let normalizedData = Array.isArray(data) ? data : data?.results;
      if (!Array.isArray(normalizedData)) throw new Error('The recommendation register response was invalid.');
      let nextPage = Array.isArray(data) ? null : data.next;
      const visitedPages = new Set(['1']);
      while (nextPage) {
        const nextNumber = new URL(nextPage, window.location.origin).searchParams.get('page');
        if (!nextNumber || visitedPages.has(nextNumber)) throw new Error('The recommendation register could not be loaded completely.');
        visitedPages.add(nextNumber);
        const nextResponse = await apiClient.get('/procurement/requisitions/', { params: { page: nextNumber, page_size: 10000, _fresh: Date.now() } });
        if (!Array.isArray(nextResponse.data?.results)) throw new Error('The recommendation register response was invalid.');
        normalizedData = [...normalizedData, ...nextResponse.data.results];
        nextPage = nextResponse.data.next;
      }

      const employeesById = new Map(
        approverUsersFromResponse(employeeResponse).map(employee => [String(employee.id), employee]),
      );
      setRequisitions(normalizedData.map(requisition => ({
        ...requisition,
        requester_name: resolveRequesterName(requisition, employeesById),
      })));
    } catch (error) {
      console.error('Error fetching requisitions:', error);
      setError({ 
        type: 'network', 
        message: `Failed to load requisitions: ${error.message}`,
        action: () => fetchRequisitions()
      });
      setRequisitions([]); // Ensure array even on error
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const response = await apiClient.get('/rbac/users/me/');
      setCurrentUser(response.data);
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const handleOpenApproval = (requisition) => {
    if (!requisition?.id) return;
    navigate(`/procurement/requisitions/${requisition.id}`, {
      state: { from: '/procurement/requisitions' },
    });
  };

  const handleApprovalComplete = (updatedRequisition) => {
    // Update the requisition in the list
    setRequisitions(prevReqs => 
      prevReqs.map(req => req.id === updatedRequisition.id ? updatedRequisition : req)
    );
    setShowApprovalModal(false);
    setSelectedRequisition(null);
    if (requisitionRouteId) navigate('/procurement/requisitions', { replace: true });
  };

  useEffect(() => {
    // Fetch data based on active tab - soft-coded
    if (activeTab === 'purchaseOrders') {
      fetchOrders();
    } else if (activeTab === 'purchaseRequisitions') {
      fetchRequisitions();
    }
    
    // Always fetch vendors, projects, and current user for both tabs
    fetchVendors();
    fetchProjects();
    fetchCurrentUser();
  }, [pageControls.isRefreshing, activeTab]);

  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    const otherEndpoint = activeTab === 'purchaseOrders' ? '/procurement/requisitions/' : '/procurement/orders/';
    const updateCount = activeTab === 'purchaseOrders' ? setRecommendationCount : setPurchaseOrderCount;
    apiClient.get(otherEndpoint, { params: { page_size: 1 }, signal: controller.signal })
      .then(response => {
        if (current) updateCount(Array.isArray(response.data) ? response.data.length : response.data?.count ?? null);
      }).catch(() => { if (current) updateCount(null); });
    return () => { current = false; controller.abort(); };
  }, [activeTab]);

  useEffect(() => {
    if (!requisitionRouteId || activeTab !== 'purchaseRequisitions') return undefined;

    let cancelled = false;
    const openAssignedRequisition = async () => {
      try {
        const response = await apiClient.get(`/procurement/requisitions/${requisitionRouteId}/`);
        if (cancelled) return;
        setSelectedRequisition(response.data);
        setShowApprovalModal(true);
      } catch (routeError) {
        if (cancelled) return;
        console.error('Failed to open requisition from notification:', routeError);
        const message = routeError.response?.status === 404
          ? 'The assigned Purchase Requisition could not be found or is no longer available.'
          : routeError.response?.data?.detail || 'Failed to open the assigned Purchase Requisition.';
        setError({ type: 'record', message, action: () => navigate('/procurement/requisitions') });
      }
    };

    openAssignedRequisition();
    return () => { cancelled = true; };
  }, [activeTab, navigate, requisitionRouteId]);

  const activeAssignedStage = (requisition) => {
    const workflow = Array.isArray(requisition?.approval_workflow_config)
      ? requisition.approval_workflow_config
      : (Array.isArray(requisition?.approval_hierarchy) ? requisition.approval_hierarchy : []);
    const pending = workflow.filter(stage => ['pending', 'in_review', 'under_review'].includes(String(stage?.status || 'pending').toLowerCase()));
    if (!pending.length || !currentUserId) return null;
    const levelOf = (stage, index) => Number.isFinite(Number(stage?.level)) ? Number(stage.level) : index + 1;
    const activeLevel = Math.min(...pending.map((stage, index) => levelOf(stage, index)));
    return pending.find((stage, index) => (
      levelOf(stage, index) === activeLevel
      && String(stage?.user_id || stage?.approver_id) === String(currentUserId)
    )) || null;
  };

  const exportRequisitionRowsToExcel = (requisitionRows, filenameSuffix = '') => {
    const rows = requisitionRows.map((req, rowIndex) => Object.fromEntries(
      PR_REGISTER_COLUMNS.map(([column]) => [column, getPRRegisterValue(req, column, rowIndex)]),
    ));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = PR_REGISTER_COLUMNS.map(([, width]) => ({ width }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Purchase Recommendations');
    XLSX.writeFile(workbook, `RADAI_Purchase_Requisitions${filenameSuffix}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };


  const exportOrdersToExcel = (orderRows = orders) => {
    const rows = (Array.isArray(orderRows) ? orderRows : orders).map(order => Object.fromEntries(
      PO_REGISTER_COLUMNS.map(([column]) => [column, getPORegisterValue(order, column)]),
    ));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = PO_REGISTER_COLUMNS.map(([, width]) => ({ width }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Purchase Orders');
    XLSX.writeFile(workbook, `RADAI_Purchase_Orders_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const approveSelectedRequisitions = async (rows = []) => {
    const batchApprovableRequisitions = (Array.isArray(rows) ? rows : []).filter(req => (
      !['draft', 'approved', 'rejected', 'converted', 'cancelled'].includes(req.status) && activeAssignedStage(req)
    ));
    if (!batchApprovableRequisitions.length || batchActionLoading) return [];
    const confirmed = (await radaiConfirm(
      `Approve ${batchApprovableRequisitions.length} selected Purchase Recommendation${batchApprovableRequisitions.length === 1 ? '' : 's'} assigned to your active stage?`
    ));
    if (!confirmed) return;

    setBatchActionLoading(true);
    const results = await Promise.allSettled(batchApprovableRequisitions.map(req => (
      apiClient.post(`/procurement/requisitions/${req.id}/process_dynamic_approval/`, { signature: '' })
    )));
    const succeededIds = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') succeededIds.push(String(batchApprovableRequisitions[index].id));
    });
    const failedCount = results.length - succeededIds.length;
    await fetchRequisitions();
    setBatchActionLoading(false);
    await radaiAlert(`${succeededIds.length} approved${failedCount ? `; ${failedCount} could not be approved and remain selected.` : '.'}`);
    return succeededIds;
  };

  const handleOrderCreated = async (orderData) => {
    console.log('Creating order with AI data:', orderData);
    // After successful creation, refresh order list
    await fetchOrders();
  };

  /**
   * Soft-coded handler: View Purchase Order Details
   * Navigates to PO detail page with order ID
   */
  const handleViewOrderDetails = (orderId) => {
    // Soft-coded navigation - can be configured to modal or separate page
    navigate(`/procurement/orders/${orderId}`);
  };

  const handleOrderPdf = async (order) => {
    if (!order?.id || orderPdfBusy) return;
    setOrderPdfBusy(true);
    try {
      const response = await apiClient.get(`/procurement/orders/${order.id}/export-pdf/`, { responseType: 'blob', timeout: 120000 });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = buildProcurementPdfFilename(order.po_number || `PO-${order.id}`, 'po', order.po_date);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (problem) {
      toast.error(problem.response?.data?.detail || 'The purchase order PDF could not be prepared.');
    } finally {
      setOrderPdfBusy(false);
    }
  };

  const handleAcknowledgeOrder = async (order) => {
    if (!order?.id || order.status !== 'sent') return;
    if (!await radaiConfirm(`Confirm the supplier accepted Purchase Order ${order.po_number}. Mark this order acknowledged?`)) return;
    try {
      await apiClient.post(`/procurement/orders/${order.id}/acknowledge/`, {});
      toast.success('Supplier acknowledgement status recorded.');
      await fetchOrders();
    } catch (problem) {
      toast.error(problem.response?.data?.detail || problem.response?.data?.error || 'The acknowledgement could not be recorded.');
    }
  };

  /**
   * Soft-coded handler: Send Purchase Order to Vendor
   * Updates PO status from draft to sent via API
   */
  const handleSendOrder = async (order) => {
    if (!order || !order.id) {
      console.error('Invalid order data');
      return;
    }

    try {
      // Soft-coded confirmation dialog
      const confirmed = (await radaiConfirm(
        `Send Purchase Order ${order.po_number || order.id} to ${order.vendor_name || 'vendor'}?`
      ));
      
      if (!confirmed) return;

      // Soft-coded API endpoint
      await apiClient.post(`/procurement/orders/${order.id}/send_to_vendor/`);

      // Update local state - soft-coded state management
      setOrders(prevOrders => 
        prevOrders.map(o => o.id === order.id ? { ...o, status: 'sent' } : o)
      );

      // Soft-coded success notification
      toast.success(`Purchase Order ${order.po_number || order.id} sent successfully.`);
      
      // Refresh orders to get latest data
      await fetchOrders();
    } catch (error) {
      console.error('Error sending order:', error);
      // Soft-coded error handling
      toast.error(`Failed to send order: ${error.response?.data?.detail || error.message}`);
    }
  };

  /**
   * Soft-coded handler: Edit Purchase Order
   * Opens PO form with existing data for editing
   */
  const handleEditOrder = async (order) => {
    if (!order) {
      console.error('Invalid order data');
      return;
    }
    if (order.status === 'completed') {
      await radaiAlert('Completed purchase orders are read-only and cannot be edited.');
      return;
    }
    
    // Set the order to edit and open the form
    setEditingOrder(order);
    setShowPOForm(true);
  };

  /**
   * Soft-coded handler: Edit Purchase Requisition
   * Opens PR form with existing data for editing
   */
  const handleEditRequisition = (requisition) => {
    if (!requisition) {
      console.error('Invalid requisition data');
      return;
    }
    
    navigate(`/procurement/requisitions/${requisition.id}/edit`);
  };

  /**
   * Soft-coded handler: Delete Purchase Order
   * Permission-based delete with confirmation dialog
   * Available for every PO status; API permissions still apply.
   */
  const handleDeletePendingDocument = async (document) => {
    if (!document?.is_pending_document || !document.po_document_id) return;
    if (!await radaiConfirm(`Delete uploaded purchase order ${document.po_number || document.source_filename}?\n\nThis removes the saved PDF entry from this register.`)) return;
    try {
      setLoading(true);
      await apiClient.delete(`/procurement/po-documents/${document.po_document_id}/`);
      await fetchOrders();
    } catch (problem) {
      await radaiAlert(problem.response?.data?.detail || problem.response?.data?.error || 'The uploaded PDF could not be deleted.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOrder = async (order) => {
    if (!order || !order.id) {
      console.error('Invalid order data');
      return;
    }

    // Confirmation dialog with detailed information
    const confirmed = (await radaiConfirm(
      `Are you sure you want to delete this Purchase Order?\n\n` +
      `PO Number: ${order.po_number || 'N/A'}\n` +
      `Supplier: ${order.supplier_name || 'N/A'}\n` +
      `Total: ${order.currency || ''} ${order.total_amount?.toLocaleString() || '0'}\n\n` +
      `This action cannot be undone.`
    ));

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      await apiClient.delete(`/procurement/orders/${order.id}/`);
      
      // Refresh orders list
      await fetchOrders();
      
      await radaiAlert(`Purchase Order ${order.po_number || order.id} deleted successfully.`);
    } catch (error) {
      console.error('Error deleting order:', error);
      const errorMsg = error.response?.data?.detail || 
                       error.response?.data?.error || 
                       'Failed to delete purchase order. Please try again.';
      await radaiAlert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Soft-coded handler: Delete Purchase Requisition
   * Permission-based delete with confirmation dialog
   * Available for every PR status to the issuer or an administrator.
   */
  const handleDeleteRequisition = async (requisition) => {
    if (!requisition || !requisition.id) {
      console.error('Invalid requisition data');
      return;
    }

    // Confirmation dialog with detailed information
    const confirmed = (await radaiConfirm(
      `Are you sure you want to delete this Purchase Requisition?\n\n` +
      `PR Number: ${requisition.pr_number || 'N/A'}\n` +
      `Description: ${requisition.product_service || 'N/A'}\n` +
      `Status: ${requisition.status}\n\n` +
      `This action cannot be undone.`
    ));

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      await apiClient.delete(`/procurement/requisitions/${requisition.id}/`);
      
      // Refresh requisitions list
      await fetchRequisitions();
      
      await radaiAlert(`Purchase Requisition ${requisition.pr_number || requisition.id} deleted successfully.`);
    } catch (error) {
      console.error('Error deleting requisition:', error);
      const errorMsg = error.response?.data?.detail || 
                       error.response?.data?.error || 
                       'Failed to delete purchase requisition. Please try again.';
      await radaiAlert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Soft-coded handler: Convert Requisition to Purchase Order
   * Creates new PO from approved requisition
   */
  const handleConvertToPO = async (requisition) => {
    if (!requisition || !requisition.id) {
      console.error('Invalid requisition data');
      return;
    }

    try {
      // Soft-coded confirmation
      const confirmed = (await radaiConfirm(
        `Convert Requisition ${requisition.pr_number || requisition.id} to Purchase Order?`
      ));
      
      if (!confirmed) return;

      // Soft-coded API endpoint for conversion
      const response = await apiClient.post(`/procurement/requisitions/${requisition.id}/convert_to_po/`);
      const createdPoNumber = response.data?.purchase_order?.po_number;

      // Update requisition status - soft-coded state update
      setRequisitions(prevReqs => 
        prevReqs.map(r => r.id === requisition.id ? { ...r, status: 'converted' } : r)
      );

      // Soft-coded success notification
      await radaiAlert(`Γ£à Requisition ${requisition.pr_number || requisition.id} converted to ${createdPoNumber || 'a Purchase Order'} successfully!`);
      
      // Refresh data
      await fetchRequisitions();
      await fetchOrders();
    } catch (error) {
      console.error('Error converting requisition:', error);
      // Soft-coded error handling
      await radaiAlert(`Γ¥î Failed to convert: ${error.response?.data?.error || error.response?.data?.detail || error.message}`);
    }
  };

  useEffect(() => () => {
    if (prPrintPreview?.url) window.URL.revokeObjectURL(prPrintPreview.url);
  }, [prPrintPreview?.url]);

  const closePRPrintPreview = () => setPrPrintPreview(null);

  const handlePrintPreviewPR = async (requisition) => {
    if (!requisition || !requisition.id) {
      console.error('Invalid requisition data for print preview');
      return;
    }

    setPrPrintPreviewLoadingId(requisition.id);
    try {
      const response = await apiClient.get(`/procurement/requisitions/${requisition.id}/export_pdf/`, {
        responseType: 'blob',
      });

      const headerValue = response.headers?.['content-disposition'] || '';
      const match = headerValue.match(/filename="?([^";]+)"?/i);
      const fallbackName = buildProcurementPdfFilename(
        requisition.pr_number || `PR-${requisition.id}`,
        'pr',
        requisition.issued_date || requisition.created_at,
      );
      const filename = (match && match[1]) ? match[1] : fallbackName;

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      setPrPrintPreview({
        url,
        filename,
        prNumber: requisition.pr_number || `PR-${requisition.id}`,
      });
    } catch (error) {
      console.error('Error loading requisition print preview:', error);
      const errorMsg =
        error.response?.data?.error ||
        error.response?.data?.detail ||
        'Failed to load requisition print preview.';
      await radaiAlert(errorMsg);
    } finally {
      setPrPrintPreviewLoadingId(null);
    }
  };

  const printRequisitionPreview = () => {
    const frameWindow = prPdfFrameRef.current?.contentWindow;
    if (!frameWindow) return;
    frameWindow.focus();
    frameWindow.print();
  };

  const downloadRequisitionPreview = () => {
    if (!prPrintPreview?.url) return;
    const link = document.createElement('a');
    link.href = prPrintPreview.url;
    link.download = prPrintPreview.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className={activeTab === 'purchaseRequisitions' ? 'prr-page-container' : 'min-h-screen bg-gray-50'} style={pageControls.styles.container}>
      <div className={activeTab === 'purchaseRequisitions' ? 'prr-page-content' : 'pb-3'} style={pageControls.styles.content}>
        {activeTab === 'purchaseOrders' ? <ProcurementRegister
          orders={orders} loading={loading} error={error} pendingUploadError={pendingUploadError} currentUserId={currentUserId}
          requisitionCount={recommendationCount} onRefresh={fetchOrders}
          onCreate={() => navigate('/procurement/orders/new')}
          onImportPdf={() => { setPoPreviewDocumentId(null); setPoDocumentEditMode(false); setShowPOPdfImport(true); }} onImportExcel={() => setShowPOExcelImport(true)}
          onPreviewDocument={documentId => { setPoPreviewDocumentId(documentId); setPoDocumentEditMode(false); setShowPOPdfImport(true); }}
          onEditDocument={documentId => { setPoPreviewDocumentId(documentId); setPoDocumentEditMode(true); setShowPOPdfImport(true); }}
          onDeleteDocument={handleDeletePendingDocument}
          onExport={exportOrdersToExcel} onOpen={handleViewOrderDetails} onEdit={handleEditOrder}
          onDelete={handleDeleteOrder} onIssue={handleSendOrder} onPdf={handleOrderPdf}
          onAcknowledge={handleAcknowledgeOrder} pdfBusy={orderPdfBusy}
        /> : <PurchaseRecommendations
          requisitions={requisitions} loading={loading} error={error} currentUserId={currentUserId}
          orderCount={purchaseOrderCount} onRefresh={fetchRequisitions}
          onCreate={() => navigate('/procurement/requisitions/new')}
          onImportPdf={() => { setPdfAttachmentPrNumber(''); setShowPRPdfImport(true); }} onImportExcel={() => setShowPRExcelImport(true)}
          onAttachPdf={requisition => { setPdfAttachmentPrNumber(requisition.pr_number); setShowPRPdfImport(true); }}
          onExport={exportRequisitionRowsToExcel} onOpen={id => handleOpenApproval({ id })}
          onEdit={handleEditRequisition} onDelete={handleDeleteRequisition}
          onConvert={handleConvertToPO} onPdf={handlePrintPreviewPR}
          canLinkPurchaseOrder={hasPurchaseOrderAccess}
          canModify={canModifyRequisition} canDelete={canDeleteRequisition}
          canConvert={requisition => hasPurchaseOrderAccess && requisition.status === 'approved' && !requisition.linked_po_id}
          canApprove={requisition => !['draft', 'approved', 'rejected', 'converted', 'cancelled'].includes(requisition.status) && Boolean(activeAssignedStage(requisition))}
          onApproveSelected={approveSelectedRequisitions} pdfBusyId={prPrintPreviewLoadingId} batchBusy={batchActionLoading}
        />}
      {/* AI Creator Modals - Conditional based on active tab */}
      {activeTab === 'purchaseOrders' && (
        <AIPurchaseOrderCreator
          isOpen={showAICreator}
          onClose={() => setShowAICreator(false)}
          onOrderCreated={handleOrderCreated}
          vendors={vendors}
          projects={projects}
        />
      )}

      {/* Purchase Order Form Modal */}
      {showPOForm && (
        <PurchaseOrderForm
          isOpen={showPOForm}
          onClose={() => {
            setShowPOForm(false);
            setEditingOrder(null);  // Clear editing state on close
          }}
          onSuccess={() => {
            setShowPOForm(false);
            setEditingOrder(null);  // Clear editing state on success
            fetchOrders();  // Refresh orders to show updated data
          }}
          editData={editingOrder}  // Pass the order being edited
        />
      )}

      <PurchaseRequisitionExcelImport
        isOpen={showPRExcelImport}
        onClose={() => setShowPRExcelImport(false)}
        onImported={() => fetchRequisitions()}
        onAttachPdf={requisition => { setPdfAttachmentPrNumber(requisition.pr_number); setShowPRPdfImport(true); }}
        canLinkPurchaseOrder={hasPurchaseOrderAccess}
      />

      <PurchaseRequisitionPdfImport
        isOpen={showPRPdfImport}
        onClose={() => setShowPRPdfImport(false)}
        onImported={() => fetchRequisitions()}
        expectedPrNumber={pdfAttachmentPrNumber}
        canLinkPurchaseOrder={hasPurchaseOrderAccess}
      />

      <PurchaseOrderExcelImport
        isOpen={showPOExcelImport}
        onClose={() => setShowPOExcelImport(false)}
        onImported={() => {
          fetchOrders();
          fetchRequisitions();
        }}
      />

      <PurchaseOrderPdfImport
        isOpen={showPOPdfImport}
        documentId={poPreviewDocumentId}
        editMode={poDocumentEditMode}
        onClose={() => setShowPOPdfImport(false)}
        onImported={() => {
          fetchOrders();
          fetchRequisitions();
        }}
      />

      {prPrintPreview && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-slate-950/90" role="dialog" aria-modal="true" aria-labelledby="pr-print-preview-title">
          <div className="flex items-center justify-between border-b border-white/10 bg-slate-900 px-5 py-3 text-white">
            <div>
              <h2 id="pr-print-preview-title" className="font-semibold">Print Preview · {prPrintPreview.prNumber}</h2>
              <p className="text-xs text-slate-300">Preview only — no file is downloaded automatically.</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={printRequisitionPreview} className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500">
                <PrinterIcon className="h-4 w-4" /> Print
              </button>
              <button type="button" onClick={downloadRequisitionPreview} className="inline-flex items-center gap-2 rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600">
                <ArrowDownTrayIcon className="h-4 w-4" /> Download PDF
              </button>
              <button type="button" onClick={closePRPrintPreview} className="rounded-md border border-white/20 p-2 text-slate-200 hover:bg-white/10" aria-label="Close print preview">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 p-4">
            <iframe ref={prPdfFrameRef} src={`${prPrintPreview.url}#toolbar=0&navpanes=0&scrollbar=1`} title={`${prPrintPreview.filename} print preview`} className="h-full w-full rounded-lg bg-white shadow-2xl" />
          </div>
        </div>
      )}

      {/* Purchase Requisition Approval Modal */}
      <PurchaseRequisitionApproval
        isOpen={showApprovalModal}
        onClose={() => {
          setShowApprovalModal(false);
          setSelectedRequisition(null);
          if (requisitionRouteId) navigate('/procurement/requisitions', { replace: true });
        }}
        requisition={selectedRequisition}
        currentUser={currentUser}
        onApprovalComplete={handleApprovalComplete}
      />
      </div>
    </div>
  );
};

export default OrderManagement;
