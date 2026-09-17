import { radaiConfirm, radaiAlert } from '../../services/radaiDialog'
import React, { useState, useEffect, useCallback } from 'react';
import { useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiClient from '../../services/api.service';
import { downloadPurchaseOrderDocument, fetchPurchaseOrderDocument, purchaseOrderDocumentError } from '../../services/purchaseOrderDocuments';
import * as XLSX from 'xlsx';
import PurchaseRequisitionApproval from './PurchaseRequisitionApproval';
import PurchaseRequisitionExcelImport from './PurchaseRequisitionExcelImport';
import PurchaseRequisitionPdfImport from './PurchaseRequisitionPdfImport';
import PurchaseOrderExcelImport from './PurchaseOrderExcelImport';
import PurchaseOrderPdfImport from './PurchaseOrderPdfImport';
import PurchaseOrderForm from './PurchaseOrderForm';
import { buildProcurementPdfFilename } from '../../utils/procurementPdfFilename';
import { employeeDisplayName } from '../../utils/employeeDisplayName';
import { canDecideProcurement } from '../../utils/procurementApproval';
import ProcurementRegister from './ProcurementRegister';
import { pendingPurchaseOrderDocument } from './procurementRegisterModel';
import PurchaseRecommendations from './PurchaseRecommendations';
import { getOriginalRecommendationDocuments, getOriginalRecommendationUrl } from './recommendationSourceDocuments';
import { procurementVatExportValue } from './procurementVatExport';

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
  const reviewedValue = procurementVatExportValue(order, column, 'po');
  if (reviewedValue !== undefined) return reviewedValue;
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
  const reviewedValue = procurementVatExportValue(requisition, column, 'pr');
  if (reviewedValue !== undefined) return reviewedValue;
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
  const [pendingUploadLoading, setPendingUploadLoading] = useState(false);
  const [orderPdfBusy, setOrderPdfBusy] = useState(false);
  const [recommendationCount, setRecommendationCount] = useState(null);
  const [purchaseOrderCount, setPurchaseOrderCount] = useState(null);
  
  // Purchase Requisitions state
  const [requisitions, setRequisitions] = useState([]);
  
  // Shared state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [batchActionLoading, setBatchActionLoading] = useState(false);
  const [showPOForm, setShowPOForm] = useState(false);
  const [showPRExcelImport, setShowPRExcelImport] = useState(false);
  const [showPRPdfImport, setShowPRPdfImport] = useState(false);
  const [pdfAttachmentPrNumber, setPdfAttachmentPrNumber] = useState('');
  const [pdfAttachmentPrId, setPdfAttachmentPrId] = useState(null);
  const [showPOExcelImport, setShowPOExcelImport] = useState(false);
  const [showPOPdfImport, setShowPOPdfImport] = useState(false);
  const [poPreviewDocumentId, setPoPreviewDocumentId] = useState(null);
  const [poDocumentEditMode, setPoDocumentEditMode] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedRequisition, setSelectedRequisition] = useState(null);
  const [prPrintPreviewLoadingId, setPrPrintPreviewLoadingId] = useState(null);
  const prPreviewRequest = useRef(0);
  const [currentUser, setCurrentUser] = useState(null);
  // Soft-coded edit state - track which record is being edited
  const [editingOrder, setEditingOrder] = useState(null);
  const editOrderRequest = useRef(0);
  const orderRegisterRequest = useRef(null);
  const requisitionRegisterRequest = useRef(null);

  const currentUserData = currentUser?.user || currentUser || {};
  const currentUserId = currentUserData.id || currentUser?.user_id;
  const currentUserRolesRaw = currentUser?.roles || currentUserData.roles;
  const currentUserRoles = Array.isArray(currentUserRolesRaw) ? currentUserRolesRaw : [];
  const isCurrentUserAdmin = Boolean(
    currentUserData.is_superuser
    || currentUserRoles.some(role => role?.code === 'super_admin' || role?.code === 'admin')
  );
  const moduleAction = useCallback((module, action) => {
    if (isCurrentUserAdmin) return true;
    const actions = currentUser?.module_actions || currentUser?.user?.module_actions;
    return Boolean(actions?.[module]?.includes(action));
  }, [currentUser, isCurrentUserAdmin]);
  const canModifyRequisition = () => {
    const actions = currentUser?.module_actions || currentUser?.user?.module_actions;
    return actions
      ? Boolean(actions.procurement_requisitions?.includes('update'))
      : moduleAction('procurement_requisitions', 'update');
  };
  const canDeleteRequisition = (requisition) => Boolean(
    moduleAction('procurement_requisitions', 'delete')
    && (isCurrentUserAdmin || (currentUserId && String(requisition?.issued_by) === String(currentUserId)))
  );

  const fetchOrders = useCallback(async () => {
    orderRegisterRequest.current?.abort();
    const controller = new AbortController();
    orderRegisterRequest.current = controller;
    const isCurrent = () => orderRegisterRequest.current === controller && !controller.signal.aborted;
    const requestConfig = { signal: controller.signal, suppressErrorToast: true };
    setLoading(true);
    setError(null);
    setPendingUploadError('');
    setOrders([]);

    const urlFilters = new URLSearchParams(window.location.search);
    const requestParams = {
      page_size: 10000,
      enterprise_project: urlFilters.get('enterprise_project') || undefined,
      legacy_project: urlFilters.get('legacy_project') || undefined,
    };
    const includePendingDocuments = !requestParams.enterprise_project && !requestParams.legacy_project;
    setPendingUploadLoading(includePendingDocuments);
    let orderRows = [];
    let pendingRows = [];
    const publishRows = () => {
      if (isCurrent()) setOrders([...orderRows, ...pendingRows]);
    };

    const loadOrders = async () => {
      try {
        const response = await apiClient.get('/procurement/orders/', { ...requestConfig, params: requestParams });
        const data = response.data;
        const normalizedData = Array.isArray(data) ? [...data] : Array.isArray(data?.results) ? [...data.results] : null;
        if (!normalizedData) throw new Error('The purchase order register returned an unexpected response.');
        let next = data?.next;
        const visitedPages = new Set(['1']);
        while (next && isCurrent()) {
          const nextPage = new URL(next, window.location.origin).searchParams.get('page');
          if (!nextPage || visitedPages.has(nextPage)) throw new Error('The purchase order register pagination could not be completed.');
          visitedPages.add(nextPage);
          const following = await apiClient.get('/procurement/orders/', { ...requestConfig, params: { ...requestParams, page: nextPage } });
          if (!Array.isArray(following.data?.results)) throw new Error('The purchase order register returned an incomplete page.');
          normalizedData.push(...following.data.results);
          next = following.data.next;
        }
        if (!isCurrent()) return;
        normalizedData.sort((a, b) => {
          const aCreated = a?.created_at ? new Date(a.created_at).getTime() : 0;
          const bCreated = b?.created_at ? new Date(b.created_at).getTime() : 0;
          if (aCreated !== bCreated) return bCreated - aCreated;
          return (b.po_number || '').localeCompare(a.po_number || '', undefined, { numeric: true, sensitivity: 'base' });
        });
        orderRows = normalizedData;
        setPurchaseOrderCount(orderRows.length);
        publishRows();
      } catch (problem) {
        if (!isCurrent()) return;
        console.error('Error fetching orders:', problem);
        setError({
          type: 'network',
          message: `Failed to load purchase orders: ${problem.response?.data?.detail || problem.message}`,
          action: () => fetchOrders(),
        });
        setPurchaseOrderCount(null);
      } finally {
        // Orders become usable as soon as their own listing finishes.
        if (isCurrent()) setLoading(false);
      }
    };

    const loadPendingDocuments = async () => {
      // Unreconciled PDFs do not yet have a verified project association.
      if (includePendingDocuments) {
        try {
          const documentParams = { pending_reconciliation: true, page_size: 10000 };
          const pending = await apiClient.get('/procurement/po-documents/', { ...requestConfig, params: documentParams });
          const payload = pending.data;
          if (!Array.isArray(payload) && !Array.isArray(payload?.results)) throw new Error('Unexpected uploaded document response.');
          const pendingDocuments = [...(Array.isArray(payload) ? payload : payload.results)];
          let nextDocumentPage = payload?.next;
          const documentPages = new Set(['1']);
          while (nextDocumentPage && isCurrent()) {
            const page = new URL(nextDocumentPage, window.location.origin).searchParams.get('page');
            if (!page || documentPages.has(page)) throw new Error('Uploaded document pagination could not be completed.');
            documentPages.add(page);
            const following = await apiClient.get('/procurement/po-documents/', { ...requestConfig, params: { ...documentParams, page } });
            if (!Array.isArray(following.data?.results)) throw new Error('Uploaded document response was incomplete.');
            pendingDocuments.push(...following.data.results);
            nextDocumentPage = following.data.next;
          }
          if (!isCurrent()) return;
          pendingRows = [...new Map(pendingDocuments.filter(document => !document.confirmed_po).map(document => [document.id, document])).values()]
            .map(pendingPurchaseOrderDocument);
          publishRows();
        } catch (problem) {
          if (!isCurrent()) return;
          setPendingUploadError(problem.response?.data?.detail || problem.message || 'Uploaded PDFs could not be loaded.');
        } finally {
          if (isCurrent()) setPendingUploadLoading(false);
        }
      }
    };

    await Promise.all([loadOrders(), loadPendingDocuments()]);
  }, []);

  const fetchRequisitions = useCallback(async () => {
    requisitionRegisterRequest.current?.abort();
    const controller = new AbortController();
    requisitionRegisterRequest.current = controller;
    const isCurrent = () => requisitionRegisterRequest.current === controller && !controller.signal.aborted;
    const requestConfig = { signal: controller.signal, suppressErrorToast: true };
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get('/procurement/requisitions/', {
        ...requestConfig, params: { _fresh: Date.now(), page_size: 10000 },
      });
      if (!isCurrent()) return;
      const data = response.data;
      
      let normalizedData = Array.isArray(data) ? data : data?.results;
      if (!Array.isArray(normalizedData)) throw new Error('The recommendation register response was invalid.');
      let nextPage = Array.isArray(data) ? null : data.next;
      const visitedPages = new Set(['1']);
      while (nextPage && isCurrent()) {
        const nextNumber = new URL(nextPage, window.location.origin).searchParams.get('page');
        if (!nextNumber || visitedPages.has(nextNumber)) throw new Error('The recommendation register could not be loaded completely.');
        visitedPages.add(nextNumber);
        const nextResponse = await apiClient.get('/procurement/requisitions/', { ...requestConfig, params: { page: nextNumber, page_size: 10000, _fresh: Date.now() } });
        if (!Array.isArray(nextResponse.data?.results)) throw new Error('The recommendation register response was invalid.');
        normalizedData = [...normalizedData, ...nextResponse.data.results];
        nextPage = nextResponse.data.next;
      }

      if (!isCurrent()) return;
      // Current serializers include display names. Resolve employees only for
      // older records that still have an account ID without any supplied name.
      const employeesById = new Map();
      if (normalizedData.some(row => !resolveRequesterName(row, employeesById) && (row.requested_by || row.issued_by))) {
        const employeeResponse = await apiClient.get('/procurement/requisitions/get_approvers/', {
          ...requestConfig, params: { role: 'any_active' }, silentTimeout: true,
        }).catch(() => null);
        if (!isCurrent()) return;
        approverUsersFromResponse(employeeResponse).forEach(employee => employeesById.set(String(employee.id), employee));
      }
      setRequisitions(normalizedData.map(requisition => ({
        ...requisition,
        requester_name: resolveRequesterName(requisition, employeesById),
      })));
    } catch (error) {
      if (!isCurrent()) return;
      console.error('Error fetching requisitions:', error);
      setError({ 
        type: 'network', 
        message: `Failed to load requisitions: ${error.message}`,
        action: () => fetchRequisitions()
      });
      setRequisitions([]); // Ensure array even on error
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  const refreshAfterMutation = async () => {
    const orderRegisterActive = activeTab === 'purchaseOrders';
    const tasks = [orderRegisterActive ? fetchOrders() : fetchRequisitions()];
    const otherModule = orderRegisterActive ? 'procurement_requisitions' : 'procurement_orders';
    if (moduleAction(otherModule, 'read')) {
      const endpoint = orderRegisterActive ? '/procurement/requisitions/' : '/procurement/orders/';
      const updateCount = orderRegisterActive ? setRecommendationCount : setPurchaseOrderCount;
      tasks.push(apiClient.get(endpoint, { params: { page_size: 1 }, suppressErrorToast: true })
        .then(({ data }) => updateCount(Array.isArray(data) ? data.length : data?.count ?? null))
        .catch(() => updateCount(null)));
    }
    await Promise.all(tasks);
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

  const handleApprovalSourceUploaded = async () => {
    const requisitionId = selectedRequisition?.id;
    await Promise.all([
      refreshAfterMutation(),
      requisitionId ? apiClient.get(`/procurement/requisitions/${requisitionId}/`, { suppressErrorToast: true })
        .then(({ data }) => {
          setSelectedRequisition(current => current?.id === requisitionId ? data : current);
        })
        .catch(() => {
          toast.error('The documents were saved, but the approval record could not be refreshed. Reopen the record to view them.');
        }) : Promise.resolve(),
    ]);
  };

  useEffect(() => {
    // Fetch data based on active tab - soft-coded
    if (activeTab === 'purchaseOrders') {
      fetchOrders();
    } else if (activeTab === 'purchaseRequisitions') {
      fetchRequisitions();
    }
    
    return () => {
      orderRegisterRequest.current?.abort();
      requisitionRegisterRequest.current?.abort();
    };
  }, [activeTab, location.search, fetchOrders, fetchRequisitions]);

  useEffect(() => {
    const controller = new AbortController();
    apiClient.get('/rbac/users/me/', { signal: controller.signal, suppressErrorToast: true })
      .then(({ data }) => { if (!controller.signal.aborted) setCurrentUser(data); })
      .catch(error => { if (!controller.signal.aborted) console.error('Error fetching current user:', error); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const otherModule = activeTab === 'purchaseOrders' ? 'procurement_requisitions' : 'procurement_orders';
    if (!currentUser || !moduleAction(otherModule, 'read')) return undefined;
    let current = true;
    const controller = new AbortController();
    const otherEndpoint = activeTab === 'purchaseOrders' ? '/procurement/requisitions/' : '/procurement/orders/';
    const updateCount = activeTab === 'purchaseOrders' ? setRecommendationCount : setPurchaseOrderCount;
    apiClient.get(otherEndpoint, { params: { page_size: 1 }, signal: controller.signal, suppressErrorToast: true })
      .then(response => {
        if (current) updateCount(Array.isArray(response.data) ? response.data.length : response.data?.count ?? null);
      }).catch(() => { if (current) updateCount(null); });
    return () => { current = false; controller.abort(); };
  }, [activeTab, currentUser, moduleAction]);

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
    return canDecideProcurement(requisition, currentUser);
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
      downloadPurchaseOrderDocument(await fetchPurchaseOrderDocument(order));
    } catch (problem) {
      toast.error(await purchaseOrderDocumentError(problem));
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
    
    const request = ++editOrderRequest.current;
    try {
      const { data } = await apiClient.get(`/procurement/orders/${order.id}/`);
      if (request !== editOrderRequest.current) return;
      if (String(data?.id) !== String(order.id)) throw new Error('The selected purchase order could not be loaded.');
      if (data.status === 'completed') { toast.info('Completed purchase orders are read-only.'); return; }
      setEditingOrder(data);
      setShowPOForm(true);
    } catch (problem) {
      if (request === editOrderRequest.current) toast.error(problem.response?.data?.detail || problem.message || 'The purchase order could not be loaded for editing.');
    }
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
    if (!await radaiConfirm(`Delete uploaded purchase order ${document.po_number || document.source_filename}?\n\nThis permanently deletes the uploaded document and its saved PDF. This cannot be undone.`)) return;
    try {
      setLoading(true);
      await apiClient.delete(`/procurement/po-documents/${document.po_document_id}/`, { suppressErrorToast: true });
      await fetchOrders();
      toast.success('Uploaded purchase order deleted.');
    } catch (problem) {
      toast.error(problem.response?.data?.detail || problem.response?.data?.error || 'The uploaded PDF could not be deleted.');
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
      `Supplier: ${order.vendor_name || order.supplier_name || 'N/A'}\n` +
      `Total: ${order.currency || ''} ${order.total_amount?.toLocaleString() || '0'}\n\n` +
      `This permanently deletes the order and its uploaded source documents. The linked purchase recommendation is retained. This cannot be undone.`
    ));

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      await apiClient.delete(`/procurement/orders/${order.id}/`, { suppressErrorToast: true });
      
      // Refresh orders list
      await refreshAfterMutation();
      toast.success(`Purchase Order ${order.po_number || order.id} deleted successfully.`);
    } catch (error) {
      console.error('Error deleting order:', error);
      const errorMsg = error.response?.data?.detail || 
                       error.response?.data?.error || 
                       'Failed to delete purchase order. Please try again.';
      toast.error(errorMsg);
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
      await apiClient.delete(`/procurement/requisitions/${requisition.id}/`, { suppressErrorToast: true });
      
      // Refresh requisitions list
      await refreshAfterMutation();
      toast.success(`Purchase Requisition ${requisition.pr_number || requisition.id} deleted successfully.`);
    } catch (error) {
      console.error('Error deleting requisition:', error);
      const errorMsg = error.response?.data?.detail || 
                       error.response?.data?.error || 
                       'Failed to delete purchase requisition. Please try again.';
      toast.error(errorMsg);
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
      toast.success(`Requisition ${requisition.pr_number || requisition.id} converted to ${createdPoNumber || 'a Purchase Order'} successfully.`);
      
      // Refresh data
      await refreshAfterMutation();
    } catch (error) {
      console.error('Error converting requisition:', error);
      // Soft-coded error handling
      toast.error(`Failed to convert: ${error.response?.data?.error || error.response?.data?.detail || error.message}`);
    }
  };

  useEffect(() => () => { prPreviewRequest.current += 1; }, []);

  const handlePrintPreviewPR = async (requisition) => {
    if (!requisition?.id) return;
    const request = ++prPreviewRequest.current;
    setPrPrintPreviewLoadingId(requisition.id);
    try {
      const { data: current } = await apiClient.get(`/procurement/requisitions/${requisition.id}/`, { params: { _fresh: Date.now() } });
      if (request !== prPreviewRequest.current) return;
      if (String(current?.id) !== String(requisition.id)) throw new Error('The recommendation could not be loaded.');
      const original = getOriginalRecommendationDocuments(current.attachments, current.price_remarks_data?.signed_document_verification?.document_sha256)[0];
      let blob;
      let filename;
      if (original) {
        const path = String(original.content_url || '').replace(/^\/api\/v1(?=\/)/, '');
        const prefix = `/procurement/requisitions/${requisition.id}/uploaded-documents/`;
        if (path.startsWith(prefix) && /^\d+\/content\/$/.test(path.slice(prefix.length))) {
          const response = await apiClient.get(path, { responseType: 'blob', timeout: 60000 });
          blob = response.data;
        } else {
          const url = getOriginalRecommendationUrl(original);
          if (!url) throw new Error('The original PR PDF is unavailable.');
          const response = await fetch(url, { credentials: 'same-origin' });
          if (!response.ok) throw new Error('The original PR PDF could not be downloaded.');
          blob = await response.blob();
        }
        filename = original.filename || `${current.pr_number}.pdf`;
      } else {
        const response = await apiClient.get(`/procurement/requisitions/${requisition.id}/export_pdf/`, { responseType: 'blob' });
        blob = response.data;
        filename = response.headers?.['content-disposition']?.match(/filename="?([^";]+)"?/i)?.[1]
          || buildProcurementPdfFilename(current.pr_number, 'pr', current.issued_date || current.created_at);
      }
      if (request !== prPreviewRequest.current) return;
      if (!(blob instanceof Blob)) blob = new Blob([blob]);
      if (!(await blob.slice(0, 1024).text()).trimStart().startsWith('%PDF-')) throw new Error('The downloaded file is not a PDF.');
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (problem) {
      if (request === prPreviewRequest.current) toast.error(problem.response?.data?.detail || problem.message || 'The PR PDF could not be downloaded.');
    } finally {
      if (request === prPreviewRequest.current) setPrPrintPreviewLoadingId(null);
    }
  };

  if (activeTab === 'purchaseOrders' && showPOForm && editingOrder) {
    return <PurchaseOrderForm key={editingOrder.id} isOpen pageMode editData={editingOrder}
      onClose={() => { setShowPOForm(false); setEditingOrder(null); }}
      onSuccess={() => { setShowPOForm(false); setEditingOrder(null); refreshAfterMutation(); }} />;
  }

  if (activeTab === 'purchaseOrders' && showPOPdfImport && poPreviewDocumentId && poDocumentEditMode) {
    return <PurchaseOrderPdfImport key={poPreviewDocumentId} isOpen pageMode documentId={poPreviewDocumentId} editMode
      canReconcile={moduleAction('procurement_orders', 'create')}
      onClose={() => { setShowPOPdfImport(false); setPoPreviewDocumentId(null); }}
      onImported={refreshAfterMutation} />;
  }

  return (
    <div className={activeTab === 'purchaseRequisitions' ? 'prr-page-container' : 'pow-page-container bg-gray-50'}>
      <div className={activeTab === 'purchaseRequisitions' ? 'prr-page-content' : 'pow-page-content'}>
        {activeTab === 'purchaseOrders' ? <ProcurementRegister
          orders={orders} loading={loading} error={error} pendingUploadError={pendingUploadError} pendingUploadLoading={pendingUploadLoading} currentUserId={currentUserId}
          requisitionCount={recommendationCount} onRefresh={fetchOrders}
          onCreate={() => navigate('/procurement/orders/new')}
          onImportPdf={() => { setPoPreviewDocumentId(null); setPoDocumentEditMode(false); setShowPOPdfImport(true); }} onImportExcel={() => setShowPOExcelImport(true)}
          onPreviewDocument={documentId => { setPoPreviewDocumentId(documentId); setPoDocumentEditMode(false); setShowPOPdfImport(true); }}
          onEditDocument={documentId => { setPoPreviewDocumentId(documentId); setPoDocumentEditMode(true); setShowPOPdfImport(true); }}
          onDeleteDocument={handleDeletePendingDocument}
          onExport={exportOrdersToExcel} onOpen={handleViewOrderDetails} onEdit={handleEditOrder}
          onDelete={handleDeleteOrder} onIssue={handleSendOrder} onPdf={handleOrderPdf}
          canCreate={moduleAction('procurement_orders', 'create')}
          canEdit={moduleAction('procurement_orders', 'update')}
          canDelete={moduleAction('procurement_orders', 'delete')}
          onAcknowledge={handleAcknowledgeOrder} pdfBusy={orderPdfBusy}
        /> : <PurchaseRecommendations
          requisitions={requisitions} loading={loading} error={error} currentUserId={currentUserId}
          orderCount={purchaseOrderCount} onRefresh={fetchRequisitions}
          onCreate={() => navigate('/procurement/requisitions/new')}
          onImportPdf={() => { setPdfAttachmentPrNumber(''); setPdfAttachmentPrId(null); setShowPRPdfImport(true); }} onImportExcel={() => setShowPRExcelImport(true)}
          onAttachPdf={requisition => { setPdfAttachmentPrNumber(requisition.pr_number); setPdfAttachmentPrId(requisition.id || requisition.requisition_id || null); setShowPRPdfImport(true); }}
          onExport={exportRequisitionRowsToExcel} onOpen={id => handleOpenApproval({ id })}
          onEdit={handleEditRequisition} onDelete={handleDeleteRequisition}
          onConvert={handleConvertToPO} onPdf={handlePrintPreviewPR}
          canLinkPurchaseOrder={moduleAction('procurement_orders', 'update')}
          canUploadPurchaseOrder={moduleAction('procurement_orders', 'create')}
          canCreate={moduleAction('procurement_requisitions', 'create')}
          canModify={canModifyRequisition} canDelete={canDeleteRequisition}
          canConvert={requisition => moduleAction('procurement_orders', 'create') && requisition.status === 'approved' && !requisition.linked_po_id}
          canApprove={requisition => !['draft', 'approved', 'rejected', 'converted', 'cancelled'].includes(requisition.status) && Boolean(activeAssignedStage(requisition))}
          onApproveSelected={approveSelectedRequisitions} pdfBusyId={prPrintPreviewLoadingId} batchBusy={batchActionLoading}
        />}
      <PurchaseRequisitionExcelImport
        isOpen={showPRExcelImport}
        onClose={() => setShowPRExcelImport(false)}
        onImported={refreshAfterMutation}
        onAttachPdf={requisition => { setPdfAttachmentPrNumber(requisition.pr_number); setPdfAttachmentPrId(requisition.id || requisition.requisition_id || null); setShowPRPdfImport(true); }}
        canLinkPurchaseOrder={moduleAction('procurement_orders', 'update')}
        canUploadPurchaseOrder={moduleAction('procurement_orders', 'create')}
        canImportRequisition={moduleAction('procurement_requisitions', 'create')}
      />

      <PurchaseRequisitionPdfImport
        isOpen={showPRPdfImport}
        onClose={() => setShowPRPdfImport(false)}
        onImported={refreshAfterMutation}
        expectedPrNumber={pdfAttachmentPrNumber}
        requisitionId={pdfAttachmentPrId}
        canLinkPurchaseOrder={moduleAction('procurement_orders', 'update')}
        canUploadPurchaseOrder={moduleAction('procurement_orders', 'create')}
      />

      <PurchaseOrderExcelImport
        isOpen={showPOExcelImport}
        onClose={() => setShowPOExcelImport(false)}
        onImported={refreshAfterMutation}
      />

      <PurchaseOrderPdfImport
        isOpen={showPOPdfImport}
        documentId={poPreviewDocumentId}
        editMode={poDocumentEditMode}
        canEditDocument={moduleAction('procurement_orders', 'update')}
        canUploadPurchaseOrder={moduleAction('procurement_orders', 'create')}
        canImportRequisition={moduleAction('procurement_requisitions', 'create')}
        onClose={() => setShowPOPdfImport(false)}
        onImported={refreshAfterMutation}
      />

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
        onSourceUploaded={handleApprovalSourceUploaded}
      />
      </div>
    </div>
  );
};

export default OrderManagement;
