import React, { useState, useEffect } from 'react';
import { useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ShoppingCartIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  SparklesIcon,
  PaperAirplaneIcon,
  DocumentCheckIcon,
  TruckIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  Squares2X2Icon,
  ListBulletIcon,
  EyeIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ChevronUpDownIcon,
  PrinterIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import * as XLSX from 'xlsx';
import { usePageControls } from '../../hooks/usePageControls';
import { getStatusConfig, getOrderTabs } from '../../config/procurement.config';
import AIPurchaseOrderCreator from './AIPurchaseOrderCreator';
import PurchaseRequisitionApproval from './PurchaseRequisitionApproval';
import PurchaseRequisitionExcelImport from './PurchaseRequisitionExcelImport';
import PurchaseRequisitionPdfImport from './PurchaseRequisitionPdfImport';
import PurchaseOrderExcelImport from './PurchaseOrderExcelImport';
import PurchaseOrderPdfImport from './PurchaseOrderPdfImport';
import PurchaseOrderForm from './PurchaseOrderForm';
import { buildProcurementPdfFilename } from '../../utils/procurementPdfFilename';

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

const OrderManagement = () => {
  // Navigation hook for soft-coded routing
  const navigate = useNavigate();
  const location = useLocation();
  const { id: requisitionRouteId } = useParams();
  
  // The route is the source of truth so both entry points render one experience.
  const activeTab = location.pathname.startsWith('/procurement/requisitions')
    ? 'purchaseRequisitions'
    : 'purchaseOrders';
  const orderTabs = getOrderTabs();
  
  // View mode state - soft-coded toggle between card and list view
  const [viewMode, setViewMode] = useState('list');
  
  // Purchase Orders state
  const [orders, setOrders] = useState([]);
  
  // Purchase Requisitions state
  const [requisitions, setRequisitions] = useState([]);
  
  // Shared state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterVendor, setFilterVendor] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [activeOrderCard, setActiveOrderCard] = useState('total');
  const [activeRequisitionCard, setActiveRequisitionCard] = useState('total');
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(25);
  const [requisitionSort, setRequisitionSort] = useState({ key: 'created_at', direction: 'desc' });
  const [requisitionPage, setRequisitionPage] = useState(1);
  const [requisitionPageSize, setRequisitionPageSize] = useState(25);
  const [selectedRequisitionIds, setSelectedRequisitionIds] = useState([]);
  const [batchActionLoading, setBatchActionLoading] = useState(false);
  const [showAICreator, setShowAICreator] = useState(false);
  const [showPOForm, setShowPOForm] = useState(false);
  const [showPRExcelImport, setShowPRExcelImport] = useState(false);
  const [showPRPdfImport, setShowPRPdfImport] = useState(false);
  const [showPOExcelImport, setShowPOExcelImport] = useState(false);
  const [showPOPdfImport, setShowPOPdfImport] = useState(false);
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

  const APPROVED_REQUISITION_STATUSES = ['approved'];
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
    requisition?.status === 'draft'
    && (isCurrentUserAdmin || (currentUserId && String(requisition.issued_by) === String(currentUserId)))
  );
  const canDeleteRequisition = (requisition) => Boolean(
    ['draft', 'rejected', 'cancelled'].includes(requisition?.status)
    && (isCurrentUserAdmin || (currentUserId && String(requisition.issued_by) === String(currentUserId)))
  );

  /**
   * Reset all search and filter values when switching tabs
   * Prevents search filter persistence bugs across tabs
   */
  const handleTabChange = (newTab) => {
    setSearchTerm('');
    setFilterStatus('all');
    setFilterVendor('all');
    setFilterPriority('all');
    setFilterType('all');
    setActiveOrderCard('total');
    setActiveRequisitionCard('total');
    setViewMode('list');
    setRequisitionPage(1);
    navigate(
      newTab === 'purchaseRequisitions'
        ? '/procurement/requisitions'
        : '/procurement/orders'
    );
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.get('/procurement/orders/?page_size=10000');
      
      // Soft-coded data normalization - ensure array
      let normalizedData = [];
      const data = response.data;
      if (Array.isArray(data)) {
        normalizedData = data;
      } else if (data && Array.isArray(data.results)) {
        normalizedData = data.results;
      } else if (data && typeof data === 'object') {
        normalizedData = [data];
      }
      
      normalizedData.sort((a, b) => {
        const aCreated = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const bCreated = b?.created_at ? new Date(b.created_at).getTime() : 0;
        if (aCreated !== bCreated) return bCreated - aCreated;
        return (b.po_number || '').localeCompare(a.po_number || '', undefined, { numeric: true, sensitivity: 'base' });
      });
      
      setOrders(normalizedData);
      
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

      const response = await apiClient.get('/procurement/requisitions/');
      const data = response.data;
      
      // Soft-coded data normalization - ensure array
      let normalizedData = [];
      if (Array.isArray(data)) {
        normalizedData = data;
      } else if (data && Array.isArray(data.results)) {
        normalizedData = data.results;
      } else if (data && typeof data === 'object') {
        normalizedData = [data];
      }
      
      setRequisitions(normalizedData);
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

  const handleOpenApproval = async (requisition) => {
    try {
      const response = await apiClient.get(`/procurement/requisitions/${requisition.id}/`, {
        params: { _fresh: Date.now() },
      });
      setSelectedRequisition(response.data);
    } catch (approvalLoadError) {
      console.error('Failed to refresh requisition review details:', approvalLoadError);
      setSelectedRequisition(requisition);
    }
    setShowApprovalModal(true);
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

  // Soft-coded filter logic with safe array handling
  const filteredOrders = Array.isArray(orders) ? orders.filter(order => {
    // Soft-coded field access with fallbacks
    const poNumber = order?.po_number || '';
    const vendorName = order?.vendor_name || '';
    const status = order?.status || '';
    const vendorId = order?.vendor?.toString() || '';
    const deliveryDate = order?.delivery_date || order?.expected_delivery;
    const isOverdue = Boolean(deliveryDate && status !== 'completed' && new Date(deliveryDate) < new Date());
    
    const matchesSearch = poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendorName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || (filterStatus === 'overdue' ? isOverdue : status === filterStatus);
    const matchesVendor = filterVendor === 'all' || vendorId === filterVendor;
    return matchesSearch && matchesStatus && matchesVendor;
  }).sort((a, b) => {
    const aCreated = a?.created_at ? new Date(a.created_at).getTime() : 0;
    const bCreated = b?.created_at ? new Date(b.created_at).getTime() : 0;
    if (aCreated !== bCreated) return bCreated - aCreated;
    return (b.po_number || '').localeCompare(
      a.po_number || '',
      undefined,
      { numeric: true, sensitivity: 'base' }
    );
  }) : [];

  const orderTotalPages = Math.max(1, Math.ceil(filteredOrders.length / orderPageSize));
  const currentOrderPage = Math.min(orderPage, orderTotalPages);
  const orderPageStart = (currentOrderPage - 1) * orderPageSize;
  const paginatedOrders = filteredOrders.slice(orderPageStart, orderPageStart + orderPageSize);

  useEffect(() => {
    setOrderPage(1);
  }, [searchTerm, filterStatus, filterVendor, orderPageSize]);

  // Soft-coded filter logic for requisitions
  const filteredRequisitions = Array.isArray(requisitions) ? requisitions.filter(req => {
    // Soft-coded field access with fallbacks
    const title = req?.title || '';
    const prNumber = req?.pr_number || '';
    const status = req?.status || '';
    const priority = req?.priority || '';
    const requisitionType = req?.requisition_type || 'general';
    
    const searchText = [title, prNumber, req?.po_number_reference, req?.product_service, req?.project_department, req?.supplier_name]
      .filter(Boolean).join(' ').toLowerCase();
    const matchesSearch = searchText.includes(searchTerm.toLowerCase());
    const approvalSummary = req?.approval_status_summary || status;
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'approved'
        ? APPROVED_REQUISITION_STATUSES.includes(status)
        : ['overdue', 'under_review'].includes(filterStatus)
          ? approvalSummary === filterStatus
          : status === filterStatus);
    const matchesPriority = filterPriority === 'all' || priority === filterPriority;
    const matchesType = filterType === 'all' || requisitionType === filterType;
    return matchesSearch && matchesStatus && matchesPriority && matchesType;
  }).sort((left, right) => {
    const getValue = (item) => {
      if (requisitionSort.key === 'pr_value') return Number(item.total_price || 0);
      if (requisitionSort.key === 'approval_status') return item.approval_status_summary || item.status || '';
      if (PR_REGISTER_COLUMNS.some(([column]) => column === requisitionSort.key)) {
        return getPRRegisterValue(item, requisitionSort.key);
      }
      return item[requisitionSort.key] || '';
    };
    const a = getValue(left);
    const b = getValue(right);
    const comparison = typeof a === 'number'
      ? a - b
      : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
    return requisitionSort.direction === 'asc' ? comparison : -comparison;
  }) : [];

  const toggleRequisitionSort = (key) => {
    setRequisitionSort(previous => ({
      key,
      direction: previous.key === key && previous.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const requisitionTotalPages = Math.max(1, Math.ceil(filteredRequisitions.length / requisitionPageSize));
  const currentRequisitionPage = Math.min(requisitionPage, requisitionTotalPages);
  const requisitionPageStart = (currentRequisitionPage - 1) * requisitionPageSize;
  const paginatedRequisitions = filteredRequisitions.slice(
    requisitionPageStart,
    requisitionPageStart + requisitionPageSize,
  );

  const selectedRequisitions = requisitions.filter(req => selectedRequisitionIds.includes(String(req.id)));
  const visibleRequisitionIds = paginatedRequisitions.map(req => String(req.id));
  const allVisibleRequisitionsSelected = visibleRequisitionIds.length > 0
    && visibleRequisitionIds.every(id => selectedRequisitionIds.includes(id));

  const toggleRequisitionSelection = (requisitionId) => {
    const id = String(requisitionId);
    setSelectedRequisitionIds(current => (
      current.includes(id) ? current.filter(item => item !== id) : [...current, id]
    ));
  };

  const toggleVisibleRequisitionSelection = () => {
    setSelectedRequisitionIds(current => {
      if (allVisibleRequisitionsSelected) {
        return current.filter(id => !visibleRequisitionIds.includes(id));
      }
      return [...new Set([...current, ...visibleRequisitionIds])];
    });
  };

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

  const batchApprovableRequisitions = selectedRequisitions.filter(req => (
    !['draft', 'approved', 'rejected', 'converted', 'cancelled'].includes(req.status)
    && activeAssignedStage(req)
  ));

  useEffect(() => {
    setRequisitionPage(1);
  }, [searchTerm, filterStatus, filterPriority, filterType, requisitionPageSize]);

  useEffect(() => {
    setViewMode('list');
  }, [activeTab]);

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

  const exportRequisitionsToExcel = () => exportRequisitionRowsToExcel(filteredRequisitions);

  const exportOrdersToExcel = () => {
    const rows = filteredOrders.map(order => Object.fromEntries(
      PO_REGISTER_COLUMNS.map(([column]) => [column, getPORegisterValue(order, column)]),
    ));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = PO_REGISTER_COLUMNS.map(([, width]) => ({ width }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Purchase Orders');
    XLSX.writeFile(workbook, `RADAI_Purchase_Orders_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportSelectedRequisitions = () => {
    if (!selectedRequisitions.length) return;
    exportRequisitionRowsToExcel(selectedRequisitions, '_Selected');
  };

  const approveSelectedRequisitions = async () => {
    if (!batchApprovableRequisitions.length || batchActionLoading) return;
    const confirmed = window.confirm(
      `Approve ${batchApprovableRequisitions.length} selected Purchase Recommendation${batchApprovableRequisitions.length === 1 ? '' : 's'} assigned to your active stage?`
    );
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
    setSelectedRequisitionIds(current => current.filter(id => !succeededIds.includes(id)));
    await fetchRequisitions();
    setBatchActionLoading(false);
    alert(`${succeededIds.length} approved${failedCount ? `; ${failedCount} could not be approved and remain selected.` : '.'}`);
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
      const confirmed = window.confirm(
        `Send Purchase Order ${order.po_number || order.id} to ${order.vendor_name || 'vendor'}?`
      );
      
      if (!confirmed) return;

      // Soft-coded API endpoint
      await apiClient.post(`/procurement/orders/${order.id}/send_to_vendor/`);

      // Update local state - soft-coded state management
      setOrders(prevOrders => 
        prevOrders.map(o => o.id === order.id ? { ...o, status: 'sent' } : o)
      );

      // Soft-coded success notification
      alert(`Γ£à Purchase Order ${order.po_number || order.id} sent successfully!`);
      
      // Refresh orders to get latest data
      await fetchOrders();
    } catch (error) {
      console.error('Error sending order:', error);
      // Soft-coded error handling
      alert(`Γ¥î Failed to send order: ${error.response?.data?.detail || error.message}`);
    }
  };

  /**
   * Soft-coded handler: Edit Purchase Order
   * Opens PO form with existing data for editing
   */
  const handleEditOrder = (order) => {
    if (!order) {
      console.error('Invalid order data');
      return;
    }
    if (order.status === 'completed') {
      alert('Completed purchase orders are read-only and cannot be edited.');
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
   * Only allows deletion of draft/pending orders
   */
  const handleDeleteOrder = async (order) => {
    if (!order || !order.id) {
      console.error('Invalid order data');
      return;
    }

    // Soft-coded permission check - only allow delete for certain statuses
    const DELETABLE_STATUSES = ['draft', 'pending', 'cancelled'];
    if (!DELETABLE_STATUSES.includes(order.status)) {
      alert(`Cannot delete order with status '${order.status}'. Only ${DELETABLE_STATUSES.join(', ')} orders can be deleted.`);
      return;
    }

    // Confirmation dialog with detailed information
    const confirmed = window.confirm(
      `Are you sure you want to delete this Purchase Order?\n\n` +
      `PO Number: ${order.po_number || 'N/A'}\n` +
      `Supplier: ${order.supplier_name || 'N/A'}\n` +
      `Total: ${order.currency || ''} ${order.total_amount?.toLocaleString() || '0'}\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      await apiClient.delete(`/procurement/orders/${order.id}/`);
      
      // Refresh orders list
      await fetchOrders();
      
      alert(`Purchase Order ${order.po_number || order.id} deleted successfully.`);
    } catch (error) {
      console.error('Error deleting order:', error);
      const errorMsg = error.response?.data?.detail || 
                       error.response?.data?.error || 
                       'Failed to delete purchase order. Please try again.';
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Soft-coded handler: Delete Purchase Requisition
   * Permission-based delete with confirmation dialog
   * Only allows deletion of draft/rejected requisitions
   */
  const handleDeleteRequisition = async (requisition) => {
    if (!requisition || !requisition.id) {
      console.error('Invalid requisition data');
      return;
    }

    // Soft-coded permission check - only allow delete for certain statuses
    const DELETABLE_STATUSES = ['draft', 'rejected', 'withdrawn'];
    if (!DELETABLE_STATUSES.includes(requisition.status)) {
      alert(`Cannot delete requisition with status '${requisition.status}'. Only ${DELETABLE_STATUSES.join(', ')} requisitions can be deleted.`);
      return;
    }

    // Confirmation dialog with detailed information
    const confirmed = window.confirm(
      `Are you sure you want to delete this Purchase Requisition?\n\n` +
      `PR Number: ${requisition.pr_number || 'N/A'}\n` +
      `Description: ${requisition.product_service || 'N/A'}\n` +
      `Status: ${requisition.status}\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      await apiClient.delete(`/procurement/requisitions/${requisition.id}/`);
      
      // Refresh requisitions list
      await fetchRequisitions();
      
      alert(`Purchase Requisition ${requisition.pr_number || requisition.id} deleted successfully.`);
    } catch (error) {
      console.error('Error deleting requisition:', error);
      const errorMsg = error.response?.data?.detail || 
                       error.response?.data?.error || 
                       'Failed to delete purchase requisition. Please try again.';
      alert(errorMsg);
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
      const confirmed = window.confirm(
        `Convert Requisition ${requisition.pr_number || requisition.id} to Purchase Order?`
      );
      
      if (!confirmed) return;

      // Soft-coded API endpoint for conversion
      const response = await apiClient.post(`/procurement/requisitions/${requisition.id}/convert_to_po/`);
      const createdPoNumber = response.data?.purchase_order?.po_number;

      // Update requisition status - soft-coded state update
      setRequisitions(prevReqs => 
        prevReqs.map(r => r.id === requisition.id ? { ...r, status: 'converted' } : r)
      );

      // Soft-coded success notification
      alert(`Γ£à Requisition ${requisition.pr_number || requisition.id} converted to ${createdPoNumber || 'a Purchase Order'} successfully!`);
      
      // Refresh data
      await fetchRequisitions();
      await fetchOrders();
    } catch (error) {
      console.error('Error converting requisition:', error);
      // Soft-coded error handling
      alert(`Γ¥î Failed to convert: ${error.response?.data?.error || error.response?.data?.detail || error.message}`);
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
      alert(errorMsg);
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

  const getStatusBadge = (status) => {
    // Soft-coded status configuration based on active tab
    const statusType = activeTab === 'purchaseOrders' ? 'purchaseOrder' : 'requisition';
    const config = getStatusConfig(statusType, status);
    const colorClasses = {
      green: 'bg-green-100 text-green-800 border-green-200',
      red: 'bg-red-100 text-red-800 border-red-200',
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      blue: 'bg-blue-100 text-blue-800 border-blue-200',
      indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      cyan: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      amber: 'bg-amber-100 text-amber-800 border-amber-200',
      gray: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return (
      <span className={`inline-flex shrink-0 items-center px-2 py-0.5 rounded-full text-[11px] leading-4 font-medium border ${colorClasses[config.color]}`}>
        {config.label}
      </span>
    );
  };

  const getPriorityBadge = (priority = 'normal') => {
    const normalized = String(priority || 'normal').toLowerCase();
    const styles = {
      urgent: 'border-rose-200 bg-rose-50 text-rose-700',
      high: 'border-amber-200 bg-amber-50 text-amber-700',
      normal: 'border-sky-200 bg-sky-50 text-sky-700',
      low: 'border-slate-200 bg-slate-50 text-slate-600',
    };
    return (
      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${styles[normalized] || styles.normal}`}>
        {normalized}
      </span>
    );
  };

  const formatCurrency = (amount, currency = 'USD') => {
    if (amount === null || amount === undefined || amount === '') return '—';
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount)) return '—';
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency || 'USD',
        maximumFractionDigits: 2,
      }).format(numericAmount);
    } catch {
      return `${currency || 'USD'} ${numericAmount.toLocaleString()}`;
    }
  };

  const OrderStats = () => {
    // Soft-coded stats calculation with safe array handling - conditional based on tab
    if (activeTab === 'purchaseOrders') {
      const safeOrders = Array.isArray(orders) ? orders : [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const vendorCounts = safeOrders.reduce((counts, order) => {
        const vendorName = order?.vendor_name || 'Unknown vendor';
        counts[vendorName] = (counts[vendorName] || 0) + 1;
        return counts;
      }, {});
      const topVendor = Object.entries(vendorCounts).sort((a, b) => b[1] - a[1])[0];
      const stats = {
        total: safeOrders.length,
        draft: safeOrders.filter(o => o?.status === 'draft').length,
        awaitingAction: safeOrders.filter(o => o?.status === 'draft' || o?.status === 'pending').length,
        sent: safeOrders.filter(o => o?.status === 'sent').length,
        acknowledged: safeOrders.filter(o => o?.status === 'acknowledged').length,
        completed: safeOrders.filter(o => o?.status === 'completed').length,
        overdue: safeOrders.filter((order) => {
          const deliveryDate = order?.delivery_date || order?.expected_delivery;
          return deliveryDate && order?.status !== 'completed' && new Date(deliveryDate) < today;
        }).length,
        totalValue: safeOrders.reduce((sum, o) => sum + (parseFloat(o?.total_amount) || 0), 0),
        topVendorName: topVendor?.[0] || 'No vendor data',
        topVendorOrders: topVendor?.[1] || 0,
      };
      const applyCardFilter = (cardKey, statusValue) => {
        setActiveOrderCard(cardKey);
        setFilterStatus(statusValue);
        setSearchTerm('');
        setFilterVendor('all');
        setOrderPage(1);
      };
      const percentage = (value, total) => total > 0 ? Math.round((value / total) * 100) : 0;
      const orderShares = {
        draft: percentage(stats.draft, stats.total),
        sent: percentage(stats.sent, stats.total),
        acknowledged: percentage(stats.acknowledged, stats.total),
        overdue: percentage(stats.overdue, stats.total),
        completed: percentage(stats.completed, stats.total),
        topVendor: percentage(stats.topVendorOrders, stats.total),
      };
      const metrics = [
        { key: 'total', status: 'all', label: 'All Purchase Orders', value: stats.total, context: `${orderShares.topVendor}% top vendor share`, icon: ShoppingCartIcon, surfaceClass: 'border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white', contextClass: 'bg-white/15 text-slate-100' },
        { key: 'draft', status: 'draft', label: 'Draft', value: stats.draft, context: `${orderShares.draft}% of total`, icon: ClockIcon, surfaceClass: 'border-slate-600 bg-gradient-to-br from-slate-500 to-slate-700 text-white', contextClass: 'bg-white/15 text-slate-50' },
        { key: 'sent', status: 'sent', label: 'Sent', value: stats.sent, context: `${orderShares.sent}% of total`, icon: PaperAirplaneIcon, surfaceClass: 'border-blue-600 bg-gradient-to-br from-blue-500 to-indigo-700 text-white', contextClass: 'bg-white/15 text-blue-50' },
        { key: 'acknowledged', status: 'acknowledged', label: 'Acknowledged', value: stats.acknowledged, context: `${orderShares.acknowledged}% acknowledged`, icon: DocumentCheckIcon, surfaceClass: 'border-cyan-600 bg-gradient-to-br from-cyan-500 to-sky-700 text-white', contextClass: 'bg-white/15 text-cyan-50' },
        { key: 'overdue', status: 'overdue', label: 'Overdue', value: stats.overdue, context: `${orderShares.overdue}% require attention`, icon: ExclamationTriangleIcon, surfaceClass: 'border-orange-500 bg-gradient-to-br from-amber-400 to-orange-600 text-white', contextClass: 'bg-black/15 text-white' },
        { key: 'completed', status: 'completed', label: 'Completed', value: stats.completed, context: `${orderShares.completed}% completed`, icon: CheckCircleIcon, surfaceClass: 'border-emerald-600 bg-gradient-to-br from-emerald-500 to-teal-700 text-white', contextClass: 'bg-white/15 text-emerald-50' },
        { key: 'value', status: 'all', label: 'Total Order Value', value: formatCurrency(stats.totalValue, 'AED'), context: `${stats.total} orders`, icon: CurrencyDollarIcon, surfaceClass: 'border-violet-600 bg-gradient-to-br from-violet-500 to-purple-700 text-white', contextClass: 'bg-white/15 text-violet-50', compactValue: true },
      ];

      return (
        <div className="mb-4 overflow-x-auto pb-1" aria-label="Purchase order status filters">
          <div className="grid min-w-[1120px] grid-cols-7 gap-3">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              const isSelected = activeOrderCard === metric.key;
              return (
                <button
                  key={metric.key}
                  type="button"
                  onClick={() => applyCardFilter(metric.key, metric.status)}
                  aria-pressed={isSelected}
                  className={`group relative h-[112px] min-w-[148px] overflow-hidden rounded-xl border p-3 text-left shadow-sm transition duration-200 focus:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 ${metric.surfaceClass} ${
                    isSelected
                      ? 'z-[1] shadow-lg ring-2 ring-slate-950 ring-offset-2'
                      : 'hover:-translate-y-0.5 hover:brightness-105 hover:shadow-md'
                  }`}
                >
                  <Icon className="pointer-events-none absolute -right-2 -top-2 h-[72px] w-[72px] opacity-[0.14] transition-transform duration-200 group-hover:scale-105" aria-hidden="true" />
                  <div className="relative z-[1] flex h-full flex-col">
                    <p className={`${metric.compactValue ? 'text-[17px]' : 'text-[25px]'} truncate font-semibold leading-none tabular-nums`} title={String(metric.value)}>{metric.value}</p>
                    <p className="mt-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.065em] opacity-90">{metric.label}</p>
                    <div className="mt-auto min-w-0">
                      <span className={`inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-semibold ${metric.contextClass}`}>{metric.context}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      );
    } else {
      // Requisitions stats
      const safeReqs = Array.isArray(requisitions) ? requisitions : [];
      const stats = {
        total: safeReqs.length,
        draft: safeReqs.filter(r => r?.status === 'draft').length,
        underReview: safeReqs.filter(r => r?.approval_status_summary === 'under_review').length,
        overdue: safeReqs.filter(r => r?.approval_status_summary === 'overdue').length,
        approved: safeReqs.filter(r => APPROVED_REQUISITION_STATUSES.includes(r?.status)).length,
        rejected: safeReqs.filter(r => r?.status === 'rejected').length,
        converted: safeReqs.filter(r => r?.status === 'converted').length
      };
      const applyCardFilter = (cardKey, statusValue) => {
        setActiveRequisitionCard(cardKey);
        setFilterStatus(statusValue);
        setSearchTerm('');
        setFilterPriority('all');
        setFilterType('all');
        setRequisitionPage(1);
      };
      const percentage = (value, total) => total > 0 ? Math.round((value / total) * 100) : 0;
      const draftShare = percentage(stats.draft, stats.total);
      const reviewEntryRatio = percentage(stats.underReview, Math.max(0, stats.total - stats.draft));
      const approvalYield = percentage(stats.approved + stats.converted, stats.approved + stats.converted + stats.rejected);
      const overdueShare = percentage(stats.overdue, stats.total);
      const rejectedShare = percentage(stats.rejected, stats.total);
      const convertedShare = percentage(stats.converted, stats.total);
      const metrics = [
        { key: 'total', status: 'all', label: 'All Recommendations', value: stats.total, context: 'Current portfolio', icon: DocumentTextIcon, surfaceClass: 'border-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white', contextClass: 'bg-white/15 text-slate-100' },
        { key: 'draft', status: 'draft', label: 'Draft', value: stats.draft, context: `${draftShare}% of total`, icon: ClockIcon, surfaceClass: 'border-slate-600 bg-gradient-to-br from-slate-500 to-slate-700 text-white', contextClass: 'bg-white/15 text-slate-50' },
        { key: 'under_review', status: 'under_review', label: 'Under Review', value: stats.underReview, context: `${reviewEntryRatio}% entered review`, icon: PaperAirplaneIcon, surfaceClass: 'border-blue-600 bg-gradient-to-br from-blue-500 to-indigo-700 text-white', contextClass: 'bg-white/15 text-blue-50' },
        { key: 'approved', status: 'approved', label: 'Approved', value: stats.approved, context: `${approvalYield}% approval yield`, icon: CheckCircleIcon, surfaceClass: 'border-emerald-600 bg-gradient-to-br from-emerald-500 to-teal-700 text-white', contextClass: 'bg-white/15 text-emerald-50' },
        { key: 'overdue', status: 'overdue', label: 'Overdue', value: stats.overdue, context: `${overdueShare}% require attention`, icon: ExclamationTriangleIcon, surfaceClass: 'border-orange-500 bg-gradient-to-br from-amber-400 to-orange-600 text-white', contextClass: 'bg-black/15 text-white' },
        { key: 'rejected', status: 'rejected', label: 'Rejected', value: stats.rejected, context: `${rejectedShare}% of total`, icon: XCircleIcon, surfaceClass: 'border-rose-600 bg-gradient-to-br from-rose-500 to-red-700 text-white', contextClass: 'bg-white/15 text-rose-50' },
        { key: 'converted', status: 'converted', label: 'Converted to PO', value: stats.converted, context: `${convertedShare}% converted`, icon: ShoppingCartIcon, surfaceClass: 'border-violet-600 bg-gradient-to-br from-violet-500 to-purple-700 text-white', contextClass: 'bg-white/15 text-violet-50' },
      ];

      return (
        <div className="mb-4 overflow-x-auto pb-1" aria-label="Purchase recommendation status filters">
          <div className="grid min-w-[1120px] grid-cols-7 gap-3">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              const isSelected = activeRequisitionCard === metric.key;
              return (
                <button
                  key={metric.key}
                  type="button"
                  onClick={() => applyCardFilter(metric.key, metric.status)}
                  aria-pressed={isSelected}
                  className={`group relative h-[112px] min-w-[148px] overflow-hidden rounded-xl border p-3 text-left shadow-sm transition duration-200 focus:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 ${metric.surfaceClass} ${
                    isSelected
                      ? 'z-[1] shadow-lg ring-2 ring-slate-950 ring-offset-2'
                      : 'hover:-translate-y-0.5 hover:brightness-105 hover:shadow-md'
                  }`}
                >
                  <Icon className="pointer-events-none absolute -right-2 -top-2 h-[72px] w-[72px] opacity-[0.14] transition-transform duration-200 group-hover:scale-105" aria-hidden="true" />
                  <div className="relative z-[1] flex h-full flex-col">
                    <p className="text-[25px] font-semibold leading-none tabular-nums">{metric.value}</p>
                    <p className="mt-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.065em] opacity-90">{metric.label}</p>
                    <span className={`mt-auto inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${metric.contextClass}`}>{metric.context}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" style={pageControls.styles.container}>
      <div className="py-3" style={pageControls.styles.content}>
        {/* Header and workspace navigation */}
        <div className="w-full px-3 sm:px-4 lg:px-6">
          <div className="mb-4 flex flex-col gap-4 border-b border-slate-200 lg:flex-row lg:items-end lg:justify-between">
            <div className="pb-1">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-600">Procurement workspace</p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                {activeTab === 'purchaseOrders' ? 'Purchase Order Management' : 'Purchase Recommendations'}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {activeTab === 'purchaseOrders'
                  ? 'Manage vendor selection, purchase orders, and delivery tracking'
                  : 'Create, review, approve, and track purchase recommendations in one workspace'}
              </p>
            </div>
            <div className="flex shrink-0 gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Procurement workspace">
              {orderTabs.map((tab) => {
                const isActive = activeTab === tab.key;
                const Icon = tab.icon === 'ShoppingCartIcon' ? ShoppingCartIcon : DocumentTextIcon;
                const totalCount = tab.key === 'purchaseOrders' ? (Array.isArray(orders) ? orders.length : 0) : (Array.isArray(requisitions) ? requisitions.length : 0);

                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleTabChange(tab.key)}
                    className={`group relative flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm hover:from-blue-700 hover:to-indigo-700'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} aria-hidden="true" />
                    <span className="whitespace-nowrap">{tab.label}</span>
                    <span className={`inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                      isActive ? 'bg-white/20 text-white ring-1 ring-white/20' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {totalCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="w-full px-3 sm:px-4 lg:px-6">
          <OrderStats />
        </div>

        {/* Error Message */}
        {error && (
          <div className="w-full px-3 sm:px-4 lg:px-6 mt-6">
            <div className={`rounded-md p-4 ${error.type === 'auth' ? 'bg-yellow-50 border-l-4 border-yellow-400' : 'bg-red-50 border-l-4 border-red-400'}`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {error.type === 'auth' ? (
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                  ) : (
                    <XCircleIcon className="h-5 w-5 text-red-400" />
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <p className={`text-sm font-medium ${error.type === 'auth' ? 'text-yellow-800' : 'text-red-800'}`}>
                    {error.message}
                  </p>
                </div>
                <div className="ml-auto pl-3">
                  <div className="-mx-1.5 -my-1.5 flex">
                    {error.action && (
                      <button
                        type="button"
                        onClick={error.action}
                        className={`inline-flex rounded-md p-1.5 ${error.type === 'auth' ? 'text-yellow-800 hover:bg-yellow-100' : 'text-red-800 hover:bg-red-100'} focus:outline-none`}
                      >
                        <ArrowPathIcon className="h-5 w-5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setError(null)}
                      className={`inline-flex rounded-md p-1.5 ml-2 ${error.type === 'auth' ? 'text-yellow-800 hover:bg-yellow-100' : 'text-red-800 hover:bg-red-100'} focus:outline-none`}
                    >
                      <XCircleIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters and Search - Soft-coded based on active tab */}
        <div className="sticky top-[4.75rem] z-20 mt-3 w-full px-3 sm:px-4 lg:px-6">
          <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm lg:flex-row lg:items-end lg:gap-2 lg:overflow-x-auto">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4 lg:contents">
              {/* Search */}
              <div className="min-w-0 md:col-span-2 lg:min-w-[300px] lg:flex-1">
                <label htmlFor="search" className="block text-xs font-semibold text-gray-700 mb-1.5">
                  {activeTab === 'purchaseOrders' ? 'Search Purchase Orders' : 'Search Purchase Recommendations'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block h-10 w-full pl-9 pr-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm"
                    placeholder={
                      activeTab === 'purchaseOrders' 
                        ? 'Search by PO number or vendor...' 
                        : 'Search PR, PO, description, project, or supplier...'
                    }
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div className="lg:w-[150px] lg:shrink-0">
                <label htmlFor="status" className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Status
                </label>
                <select
                  id="status"
                  value={filterStatus}
                  onChange={(e) => {
                    const nextStatus = e.target.value;
                    setFilterStatus(nextStatus);
                    if (activeTab === 'purchaseOrders') {
                      setActiveOrderCard(nextStatus === 'all' ? 'total' : nextStatus);
                    } else {
                      setActiveRequisitionCard(nextStatus === 'all' ? 'total' : nextStatus);
                    }
                  }}
                  className="block h-10 w-full px-3 border border-gray-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="all">All Statuses</option>
                  {activeTab === 'purchaseOrders' ? (
                    <>
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="acknowledged">Acknowledged</option>
                      <option value="in_progress">In Progress</option>
                      <option value="overdue">Overdue</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </>
                  ) : (
                    <>
                      <option value="draft">Draft</option>
                      <option value="submitted">Submitted</option>
                      <option value="in_review">In Review</option>
                      <option value="under_review">Under Review (summary)</option>
                      <option value="overdue">Overdue</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="converted">Converted to PO</option>
                    </>
                  )}
                </select>
              </div>

              {/* Conditional Filters - Soft-coded based on tab */}
              {activeTab === 'purchaseOrders' ? (
                <div className="lg:w-[170px] lg:shrink-0">
                  <label htmlFor="vendor" className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Vendor
                  </label>
                  <select
                    id="vendor"
                    value={filterVendor}
                    onChange={(e) => setFilterVendor(e.target.value)}
                    className="block h-10 w-full px-3 border border-gray-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="all">All Vendors</option>
                    {vendors.map(vendor => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="lg:w-[150px] lg:shrink-0">
                  <label htmlFor="priority" className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Priority
                  </label>
                  <select
                    id="priority"
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    className="block h-10 w-full px-3 border border-gray-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="all">All Priorities</option>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="normal">Normal</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between lg:contents">
              <div className="flex flex-wrap items-center gap-2 lg:ml-auto lg:shrink-0 lg:flex-nowrap">
                {activeTab === 'purchaseOrders' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowPOPdfImport(true)}
                      className="inline-flex h-9 items-center rounded-lg border border-purple-300 bg-purple-50 px-3 text-xs font-semibold text-purple-700 hover:bg-purple-100"
                    >
                      <DocumentTextIcon className="mr-1.5 h-3.5 w-3.5" /> Import Signed PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPOExcelImport(true)}
                      className="inline-flex h-9 items-center rounded-lg border border-indigo-300 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                    >
                      <ArrowUpTrayIcon className="mr-1.5 h-3.5 w-3.5" /> Import Excel
                    </button>
                    <button
                      type="button"
                      onClick={exportOrdersToExcel}
                      className="inline-flex h-9 items-center rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      <ArrowDownTrayIcon className="mr-1.5 h-3.5 w-3.5" /> Export Excel
                    </button>
                  </>
                )}
                {activeTab === 'purchaseRequisitions' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowPRPdfImport(true)}
                      className="inline-flex h-9 items-center rounded-lg border border-purple-300 bg-purple-50 px-3 text-xs font-semibold text-purple-700 hover:bg-purple-100"
                    >
                      <DocumentTextIcon className="mr-1.5 h-3.5 w-3.5" /> Import Signed PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPRExcelImport(true)}
                      className="inline-flex h-9 items-center rounded-lg border border-indigo-300 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                    >
                      <ArrowUpTrayIcon className="mr-1.5 h-3.5 w-3.5" /> Import Excel
                    </button>
                    <button
                      type="button"
                      onClick={exportRequisitionsToExcel}
                      className="inline-flex h-9 items-center rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      <ArrowDownTrayIcon className="mr-1.5 h-3.5 w-3.5" /> Export Excel
                    </button>
                  </>
                )}
                {/* View Toggle - Soft-coded */}
                <div className="order-last inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode('card')}
                    className={`inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      viewMode === 'card'
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                    title="Card View"
                  >
                    <Squares2X2Icon className="h-3.5 w-3.5 mr-1.5" />
                    Cards
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      viewMode === 'list'
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                    title="List View"
                  >
                    <ListBulletIcon className="h-3.5 w-3.5 mr-1.5" />
                    List
                  </button>
                </div>
                
                <button
                  type="button"
                  onClick={() => activeTab === 'purchaseOrders' ? setShowPOForm(true) : navigate('/procurement/requisitions/new')}
                  className="inline-flex h-9 items-center px-3.5 border border-transparent text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <PlusIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  {activeTab === 'purchaseOrders' ? 'Create Purchase Order' : 'Create Purchase Recommendation'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {activeTab === 'purchaseRequisitions' && selectedRequisitions.length > 0 && (
          <div className="sticky bottom-4 z-30 mt-3 w-full px-3 sm:px-4 lg:px-6">
            <div className="mx-auto flex max-w-4xl flex-col gap-3 rounded-2xl border border-indigo-300 bg-slate-900 px-4 py-3 text-white shadow-2xl sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-8 min-w-8 place-items-center rounded-lg bg-indigo-500 px-2 text-sm font-bold">{selectedRequisitions.length}</span>
                <div>
                  <p className="text-sm font-semibold">Purchase Recommendations selected</p>
                  <p className="text-[11px] text-slate-300">{batchApprovableRequisitions.length} assigned to your active approval stage</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button type="button" onClick={exportSelectedRequisitions} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 text-xs font-semibold hover:bg-white/20">
                  <ArrowDownTrayIcon className="h-4 w-4" /> Export selected
                </button>
                <button type="button" onClick={approveSelectedRequisitions} disabled={!batchApprovableRequisitions.length || batchActionLoading} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 text-xs font-bold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40">
                  <CheckCircleIcon className="h-4 w-4" /> {batchActionLoading ? 'Approving…' : `Approve assigned (${batchApprovableRequisitions.length})`}
                </button>
                <button type="button" onClick={() => setSelectedRequisitionIds([])} className="h-9 rounded-lg px-3 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white">Clear</button>
              </div>
            </div>
          </div>
        )}

        {/* Content - Conditional based on active tab */}
        <div className="mt-4 w-full px-3 sm:px-4 lg:px-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              <p className="mt-4 text-sm text-gray-500">
                {activeTab === 'purchaseOrders' ? 'Loading purchase orders...' : 'Loading requisitions...'}
              </p>
            </div>
          ) : activeTab === 'purchaseOrders' ? (
            // Purchase Orders Tab Content
            filteredOrders.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <ShoppingCartIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No purchase orders found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || filterStatus !== 'all' || filterVendor !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Get started by creating a new purchase order.'}
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setShowPOForm(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                  Create Purchase Order
                </button>
              </div>
            </div>
          ) : viewMode === 'card' ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedOrders.map((order) => {
                const isOverdue = order.delivery_date && new Date(order.delivery_date) < new Date() && order.status !== 'completed';
                const completionRate = order.items_count ? ((order.received_items || 0) / order.items_count) * 100 : 0;
                
                return (
                <article key={order.id} className="group flex min-h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-colors hover:border-indigo-300 hover:shadow-md">
                  {/* Status Bar */}
                  <div className={`h-1 ${
                    order.status === 'completed' ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                    order.status === 'sent' ? 'bg-gradient-to-r from-blue-400 to-blue-500' :
                    order.status === 'draft' ? 'bg-gradient-to-r from-gray-300 to-gray-400' :
                    'bg-gradient-to-r from-yellow-400 to-amber-500'
                  }`} />
                  
                  <div className="flex flex-1 flex-col p-5">
                    {/* Order Header */}
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600">
                            <ShoppingCartIcon className="h-4 w-4 text-white" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="break-words text-base font-semibold leading-5 text-gray-950 group-hover:text-indigo-700">
                              {order.po_number || `PO-${order.id}`}
                            </h3>
                            <p className="mt-1 line-clamp-2 text-xs leading-4 text-gray-500">
                              {order.vendor_name || 'No vendor assigned'}
                            </p>
                          </div>
                        </div>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>

                    {/* Order Details Grid */}
                    <div className="mb-4 space-y-2.5">
                      {order.delivery_date && (
                        <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                          isOverdue ? 'bg-red-50' : 'bg-gray-50'
                        }`}>
                          <div className="flex items-center">
                            <CalendarIcon className={`h-3.5 w-3.5 mr-1.5 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`} />
                            <span className={isOverdue ? 'text-red-700 font-medium' : 'text-gray-600'}>
                              Delivery: {new Date(order.delivery_date).toLocaleDateString()}
                            </span>
                          </div>
                          {isOverdue && (
                            <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-1 rounded-full">
                              Overdue
                            </span>
                          )}
                        </div>
                      )}
                      
                      {order.total_amount && (
                        <div className="flex items-center justify-between rounded-lg border border-teal-100 bg-teal-50 px-3 py-2.5">
                          <div className="flex items-center">
                            <CurrencyDollarIcon className="h-3.5 w-3.5 mr-1.5 text-teal-600" />
                            <span className="text-xs font-medium text-gray-600">Order value</span>
                          </div>
                          <span className="text-base font-semibold tabular-nums text-teal-800">
                            {formatCurrency(order.total_amount, order.currency)}
                          </span>
                        </div>
                      )}
                      
                      {order.shipping_address && (
                        <div className="flex items-start rounded-lg bg-gray-50 px-3 py-2 text-xs">
                          <TruckIcon className="h-3.5 w-3.5 mr-1.5 text-gray-400 flex-shrink-0 mt-0.5" />
                          <span className="line-clamp-2 leading-4 text-gray-600">{order.shipping_address}</span>
                        </div>
                      )}

                      {/* Progress Bar for Partial Receipts */}
                      {completionRate > 0 && completionRate < 100 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-gray-600">
                            <span>Received Items</span>
                            <span className="font-semibold">{Math.round(completionRate)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${completionRate}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions - Soft-coded button handlers */}
                    <div className="mt-auto flex items-center gap-2 border-t border-gray-100 pt-3">
                      <button 
                        type="button"
                        onClick={() => handleViewOrderDetails(order.id)}
                        className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                        <EyeIcon className="mr-1.5 h-3.5 w-3.5" />
                        <span>View</span>
                      </button>
                      {order.status !== 'completed' && (
                        <button
                          type="button"
                          onClick={() => handleEditOrder(order)}
                          className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                          <PencilIcon className="h-3.5 w-3.5 mr-1.5" />
                          <span>Edit</span>
                        </button>
                      )}
                      {order.status === 'draft' && (
                        <button 
                          type="button"
                          onClick={() => handleSendOrder(order)}
                          className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                          <PaperAirplaneIcon className="h-3.5 w-3.5 mr-1.5" />
                          <span>Send</span>
                        </button>
                      )}
                      {['draft', 'pending', 'cancelled'].includes(order.status) && (
                        <button 
                          type="button"
                          onClick={() => handleDeleteOrder(order)}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                          title="Delete purchase order"
                          aria-label={`Delete purchase order ${order.po_number || order.id}`}>
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
              })}
            </div>
          ) : (
            // List View for Purchase Orders
            <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-slate-300 bg-slate-50 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-indigo-700 text-white shadow-sm">
                    <ShoppingCartIcon className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold uppercase tracking-wide text-slate-900">Purchase Orders Register</h3>
                    <p className="text-[11px] text-slate-500">Corporate spreadsheet view</p>
                  </div>
                </div>
                <span className="inline-flex w-fit items-center rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold tabular-nums text-slate-600">
                  {filteredOrders.length} record{filteredOrders.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="max-h-[72vh] overflow-auto bg-slate-100">
              <table className="w-full min-w-[1840px] table-fixed border-separate border-spacing-0 bg-white font-['Segoe_UI',Inter,Arial,sans-serif] text-[13px] font-medium text-slate-700">
                <colgroup>
                  <col className="w-[48px]" />
                  <col className="w-[160px]" />
                  <col className="w-[150px]" />
                  <col className="w-[190px]" />
                  <col className="w-[260px]" />
                  <col className="w-[200px]" />
                  <col className="w-[120px]" />
                  <col className="w-[130px]" />
                  <col className="w-[145px]" />
                  <col className="w-[120px]" />
                  <col className="w-[155px]" />
                </colgroup>
                <thead className="text-slate-700">
                  <tr className="h-6 bg-slate-100 text-xs font-semibold text-slate-500">
                    <th className="sticky left-0 top-0 z-50 border-b border-r border-slate-300 bg-slate-200" aria-label="Row number" />
                    {['A','B','C','D','E','F','G','H','I','J'].map((letter, index) => (
                      <th key={letter} className={`sticky top-0 z-30 border-b border-r border-slate-300 bg-slate-100 text-center ${index === 0 ? 'left-[48px] z-40' : index === 9 ? 'right-0 z-40 border-l shadow-[-4px_0_8px_rgba(15,23,42,0.08)]' : ''}`}>{letter}</th>
                    ))}
                  </tr>
                  <tr className="h-11">
                    <th scope="col" className="sticky left-0 top-6 z-50 border-b border-r border-slate-300 bg-slate-200 px-1 py-3 text-center text-sm font-bold text-slate-800">#</th>
                    {['PO Number', 'PR Number', 'Supplier', 'Summary', 'Project / Department', 'Order Date', 'Delivery Date', 'Amount', 'Status'].map((column) => (
                      <th key={column} scope="col" className={`sticky top-6 z-30 border-b border-r border-slate-300 bg-slate-200 px-3 py-3 text-left text-sm font-bold tracking-normal text-slate-800 ${column === 'PO Number' ? 'left-[48px] z-40' : ''}`}>
                        {column}
                      </th>
                    ))}
                    <th scope="col" className="sticky right-0 top-6 z-40 border-b border-l border-slate-300 bg-slate-200 px-3 py-3 text-center text-sm font-bold tracking-normal text-slate-800 shadow-[-4px_0_8px_rgba(15,23,42,0.08)]">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {paginatedOrders.map((order, rowIndex) => {
                    const summary = order.description || order.title || 'Untitled order';
                    const projectDepartment = order.project_number || order.project_display || '—';
                    const orderDate = order.po_date || order.created_at;
                    const deliveryDate = order.expected_delivery || order.delivery_date;
                    return (
                      <tr key={order.id} className={`group h-12 transition-colors hover:bg-blue-50 ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}`}>
                        <td className="sticky left-0 z-20 border-b border-r border-slate-300 bg-slate-100 px-1 text-center text-xs font-semibold tabular-nums text-slate-600 group-hover:bg-blue-100">{orderPageStart + rowIndex + 1}</td>
                        <td className={`sticky left-[48px] z-20 border-b border-r border-slate-300 px-2.5 py-2 align-middle group-hover:bg-blue-50 ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                          <button type="button" onClick={() => handleViewOrderDetails(order.id)} className="whitespace-nowrap text-[13px] font-semibold text-indigo-700 hover:text-indigo-900 hover:underline">
                            {order.po_number || `PO-${order.id}`}
                          </button>
                        </td>
                        <td className="border-b border-r border-slate-300 px-3 py-2.5 text-[13px] font-medium text-slate-700">
                          <p className="truncate" title={order.pr_number || ''}>{order.pr_number || '—'}</p>
                        </td>
                        <td className="border-b border-r border-slate-300 px-3 py-2.5 text-[13px] font-medium text-slate-700">
                          <p className="truncate" title={order.vendor_name || ''}>{order.vendor_name || 'No supplier assigned'}</p>
                        </td>
                        <td className="border-b border-r border-slate-300 px-2.5 py-2">
                          <p className="truncate text-[13px] font-semibold text-slate-800" title={summary}>{summary}</p>
                        </td>
                        <td className="border-b border-r border-slate-300 px-3 py-2.5 text-[13px] font-medium text-slate-700">
                          <p className="truncate" title={projectDepartment}>{projectDepartment}</p>
                        </td>
                        <td className="border-b border-r border-slate-300 px-3 py-2.5 text-[13px] font-medium tabular-nums text-slate-700">
                          {orderDate ? new Date(orderDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="border-b border-r border-slate-300 px-3 py-2.5 text-[13px] font-medium tabular-nums text-slate-700">
                          {deliveryDate ? new Date(deliveryDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="border-b border-r border-slate-300 px-3 py-2.5 text-right text-[13px] font-semibold tabular-nums text-slate-900">
                          {formatCurrency(order.total_amount, order.currency || 'AED')}
                        </td>
                        <td className="border-b border-r border-slate-300 px-2 py-1.5">{getStatusBadge(order.status)}</td>
                        <td className={`sticky right-0 border-b border-l border-slate-300 px-2 py-1.5 shadow-[-4px_0_8px_rgba(15,23,42,0.08)] group-hover:bg-blue-50 ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleViewOrderDetails(order.id)}
                              className="grid h-7 w-7 place-items-center rounded border border-sky-300 bg-white text-sky-700 transition hover:bg-sky-100"
                              title="View"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </button>
                            {order.status !== 'completed' && (
                              <button
                                type="button"
                                onClick={() => handleEditOrder(order)}
                                className="grid h-7 w-7 place-items-center rounded border border-amber-300 bg-white text-amber-700 transition hover:bg-amber-100"
                                title="Edit"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                            )}
                            {order.status === 'draft' && (
                              <button
                                type="button"
                                onClick={() => handleSendOrder(order)}
                                className="grid h-7 w-7 place-items-center rounded border border-emerald-300 bg-white text-emerald-700 transition hover:bg-emerald-100"
                                title="Send"
                              >
                                <PaperAirplaneIcon className="h-4 w-4" />
                              </button>
                            )}
                            {['draft', 'pending', 'cancelled'].includes(order.status) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteOrder(order)}
                                className="grid h-7 w-7 place-items-center rounded border border-rose-300 bg-white text-rose-700 transition hover:bg-rose-100"
                                title="Delete purchase order"
                                aria-label={`Delete purchase order ${order.po_number || order.id}`}
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )) : (
            // Purchase Requisitions Tab Content
            filteredRequisitions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No requisitions found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || filterStatus !== 'all' || filterPriority !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Get started by creating a new requisition.'}
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => navigate('/procurement/requisitions/new')}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <SparklesIcon className="-ml-1 mr-2 h-5 w-5" />
                  Create Requisition
                </button>
              </div>
            </div>
          ) : viewMode === 'card' ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedRequisitions.map((req) => {
                const daysSinceCreation = req.created_date 
                  ? Math.floor((new Date() - new Date(req.created_date)) / (1000 * 60 * 60 * 24))
                  : 0;
                const isUrgent = req.priority === 'urgent' || req.priority === 'high';
                const approvalStages = Array.isArray(req.approval_workflow_config)
                  ? req.approval_workflow_config
                  : (Array.isArray(req.approval_hierarchy) ? req.approval_hierarchy : []);
                const supplierTag = req.supplier_name || req.vendor_name || req.vendor_details?.name;
                const isSelected = selectedRequisitionIds.includes(String(req.id));
                
                return (
                <div key={req.id} className={`group overflow-hidden rounded-2xl border-2 bg-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-purple-400 hover:shadow-2xl ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-100'}`}>
                  {/* Status Bar */}
                  <div className={`h-2 ${
                    req.status === 'converted' ? 'bg-gradient-to-r from-purple-400 to-indigo-500' :
                    APPROVED_REQUISITION_STATUSES.includes(req.status) ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                    req.status === 'in_review' ? 'bg-gradient-to-r from-yellow-400 to-amber-500' :
                    req.status === 'submitted' ? 'bg-gradient-to-r from-blue-400 to-blue-500' :
                    req.status === 'rejected' ? 'bg-gradient-to-r from-red-400 to-red-500' :
                    'bg-gradient-to-r from-gray-300 to-gray-400'
                  }`} />
                  
                  <div className="p-6">
                    {/* Requisition Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-2 rounded-lg">
                            <DocumentTextIcon className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900 group-hover:text-purple-600 transition-colors">
                              {req.pr_number || `PR-${req.id}`}
                            </h3>
                            <p className="text-xs text-gray-500 line-clamp-1">
                              {req.title || 'No title'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-slate-200 bg-white shadow-sm" title="Select recommendation">
                          <input type="checkbox" checked={isSelected} onChange={() => toggleRequisitionSelection(req.id)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        </label>
                        {getStatusBadge(req.status)}
                      </div>
                    </div>

                    {/* Requisition Details Grid */}
                    <div className="space-y-3 mb-4">
                      {req.created_date && (
                        <div className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded-lg">
                          <div className="flex items-center">
                            <CalendarIcon className="h-4 w-4 mr-2 text-gray-400" />
                            <span className="text-gray-600">
                              Created {daysSinceCreation === 0 ? 'today' : `${daysSinceCreation}d ago`}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">
                            {new Date(req.created_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      
                      {(req.total_price || req.estimated_value) && (
                        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg">
                          <div className="flex items-center">
                            <CurrencyDollarIcon className="h-5 w-5 mr-2 text-purple-600" />
                            <span className="text-sm text-gray-600">Estimated Value</span>
                          </div>
                          <span className="text-lg font-bold text-purple-700">
                            ~${parseFloat(req.total_price || req.estimated_value).toLocaleString()}
                          </span>
                        </div>
                      )}
                      
                      {req.priority && (
                        <div className="flex items-center justify-between p-2 rounded-lg">
                          <span className="text-sm text-gray-600 font-medium">Priority Level</span>
                          <div className="flex items-center space-x-2">
                            {isUrgent && (
                              <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                              </span>
                            )}
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              req.priority === 'urgent' ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md' :
                              req.priority === 'high' ? 'bg-gradient-to-r from-orange-400 to-orange-500 text-white shadow-md' :
                              req.priority === 'normal' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {req.priority.charAt(0).toUpperCase() + req.priority.slice(1)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Requester Info */}
                      {req.requester_name && (
                        <div className="flex items-center text-sm p-2 bg-gray-50 rounded-lg">
                          <UserGroupIcon className="h-4 w-4 mr-2 text-gray-400" />
                          <span className="text-gray-600">Requested by <span className="font-semibold text-gray-900">{req.requester_name}</span></span>
                        </div>
                      )}
                    </div>

                    <div className="mb-4 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                      {supplierTag && <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold text-cyan-800">Supplier · {supplierTag}</span>}
                      {approvalStages.slice(0, 4).map((stage, index) => {
                        const stageStatus = String(stage?.status || 'pending').toLowerCase();
                        const stageLabel = stage?.approval_label || stage?.role || `L${stage?.level ?? index + 1}`;
                        return <span key={`${stageLabel}-${index}`} className={`rounded-full px-2 py-1 text-[10px] font-semibold ${stageStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' : stageStatus === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{stageLabel} · {stageStatus === 'approved' ? 'Done' : stageStatus === 'rejected' ? 'Rejected' : 'Pending'}</span>;
                      })}
                      {approvalStages.length > 4 && <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">+{approvalStages.length - 4} stages</span>}
                    </div>

                    {/* Actions - Soft-coded button handlers */}
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => handleOpenApproval(req)}
                        className="inline-flex justify-center items-center px-2.5 py-2 border border-gray-200 shadow-sm text-xs font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:border-purple-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-200">
                        <EyeIcon className="h-3.5 w-3.5 mr-1" />
                        <span>View Details</span>
                      </button>
                      {canModifyRequisition(req) && (
                        <button
                          onClick={() => handleEditRequisition(req)}
                          className="inline-flex justify-center items-center px-2.5 py-2 border border-amber-300 shadow-sm text-xs font-medium rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-all duration-200">
                          <PencilIcon className="h-3.5 w-3.5 mr-1" />
                          <span>Edit</span>
                        </button>
                      )}
                      {APPROVED_REQUISITION_STATUSES.includes(req.status) && hasPurchaseOrderAccess && (
                        <button 
                          onClick={() => handleConvertToPO(req)}
                          className="inline-flex justify-center items-center px-2.5 py-2 border border-transparent text-xs font-semibold rounded-lg text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 shadow-sm hover:shadow-md transition-all duration-200">
                          <ShoppingCartIcon className="h-3.5 w-3.5 mr-1" />
                          <span>Convert to PO</span>
                        </button>
                      )}
                      {APPROVED_REQUISITION_STATUSES.includes(req.status) && (
                        <button 
                          onClick={() => handlePrintPreviewPR(req)}
                          disabled={prPrintPreviewLoadingId === req.id}
                          className="inline-flex justify-center items-center px-2.5 py-2 border border-purple-300 shadow-sm text-xs font-medium rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100 hover:border-purple-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-200 disabled:opacity-50">
                          <DocumentTextIcon className="h-3.5 w-3.5 mr-1" />
                          <span>{prPrintPreviewLoadingId === req.id ? 'Loading...' : 'Print Preview'}</span>
                        </button>
                      )}
                      {canDeleteRequisition(req) && (
                        <button 
                          onClick={() => handleDeleteRequisition(req)}
                          className="col-span-2 inline-flex justify-center items-center px-2.5 py-2 border border-red-300 shadow-sm text-xs font-medium rounded-lg text-red-700 bg-red-50 hover:bg-red-100 hover:border-red-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200"
                          title="Delete this purchase requisition">
                          <TrashIcon className="h-3.5 w-3.5 mr-1" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          ) : (
            // List View for Purchase Requisitions
            <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-slate-300 bg-slate-50 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-emerald-700 text-white shadow-sm">
                    <Squares2X2Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold uppercase tracking-wide text-slate-900">Purchase Recommendations Register</h3>
                    <p className="text-[11px] text-slate-500">Ready Procurement view  </p>
                  </div>
                </div>
                <span className="inline-flex w-fit items-center rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold tabular-nums text-slate-600">
                  {filteredRequisitions.length} record{filteredRequisitions.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="max-h-[72vh] overflow-auto bg-slate-100">
              <table className="w-full min-w-[1940px] table-fixed border-separate border-spacing-0 bg-white font-['Segoe_UI',Inter,Arial,sans-serif] text-[13px] font-medium text-slate-700">
                <colgroup>
                  <col className="w-[48px]" />
                  <col className="w-[165px]" />
                  <col className="w-[112px]" />
                  <col className="w-[165px]" />
                  <col className="w-[255px]" />
                  <col className="w-[150px]" />
                  <col className="w-[190px]" />
                  <col className="w-[185px]" />
                  <col className="w-[135px]" />
                  <col className="w-[100px]" />
                  <col className="w-[120px]" />
                  <col className="w-[155px]" />
                </colgroup>
                <thead className="text-slate-700">
                  <tr className="h-6 bg-slate-100 text-xs font-semibold text-slate-500">
                    <th className="sticky left-0 top-0 z-50 border-b border-r border-slate-300 bg-slate-200" aria-label="Row number" />
                    {['A','B','C','D','E','F','G','H','I','J','K'].map((letter, index) => (
                      <th key={letter} className={`sticky top-0 z-30 border-b border-r border-slate-300 bg-slate-100 text-center ${index === 0 ? 'left-[48px] z-40' : index === 10 ? 'right-0 z-40 border-l shadow-[-4px_0_8px_rgba(15,23,42,0.08)]' : ''}`}>{letter}</th>
                    ))}
                  </tr>
                  <tr className="h-11">
                    <th scope="col" className="sticky left-0 top-6 z-50 border-b border-r border-slate-300 bg-slate-200 px-1 py-3 text-center text-sm font-bold text-slate-800">
                      <label className="flex cursor-pointer items-center justify-center gap-1" title="Select visible rows">
                        <input type="checkbox" checked={allVisibleRequisitionsSelected} onChange={toggleVisibleRequisitionSelection} className="h-3.5 w-3.5 rounded border-slate-400 text-indigo-600 focus:ring-indigo-500" />
                        <span>#</span>
                      </label>
                    </th>
                    {[
                      ['PR number', 'PR Number'],
                      ['Date', 'PR Accepted Date'],
                      ['PO reference', 'PO Number'],
                      ['Request', 'Summary of Purchase /Activity'],
                      ['Requester', 'issued_by_name'],
                      ['Project / Department', 'Project short name/ Code'],
                      ['Supplier', 'Suppl.Name'],
                      ['Amount', 'PO Amount w/o VAT'],
                      ['Priority', 'priority'],
                      ['Status', 'PO Status'],
                    ].map(([label, sortKey], index) => (
                      <th key={label} scope="col" className={`sticky top-6 z-30 border-b border-r border-slate-300 bg-slate-200 px-3 py-3 text-left text-sm font-bold tracking-normal text-slate-800 ${index === 0 ? 'left-[48px] z-40' : ''}`}>
                        <button type="button" onClick={() => toggleRequisitionSort(sortKey)} className="inline-flex w-full items-center justify-between gap-1 whitespace-nowrap hover:text-indigo-700">
                          {label}<ChevronUpDownIcon className="h-4 w-4 shrink-0 text-slate-400" />
                        </button>
                      </th>
                    ))}
                    <th scope="col" className="sticky right-0 top-6 z-40 border-b border-l border-slate-300 bg-slate-200 px-3 py-3 text-center text-sm font-bold tracking-normal text-slate-800 shadow-[-4px_0_8px_rgba(15,23,42,0.08)]">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {paginatedRequisitions.map((req, rowIndex) => {
                    const requestSummary = req.product_service || req.title || 'Untitled request';
                    const projectDepartment = req.project_department || req.project || '—';
                    const supplier = req.supplier_name || req.vendor_name || 'Not selected';
                    const requestDate = req.issued_date || req.created_date;
                    return (
                      <tr key={req.id} className={`group h-12 transition-colors hover:bg-blue-50 ${selectedRequisitionIds.includes(String(req.id)) ? 'bg-indigo-50' : rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}`}>
                        <td className="sticky left-0 z-20 border-b border-r border-slate-300 bg-slate-100 px-1 text-center text-xs font-semibold tabular-nums text-slate-600 group-hover:bg-blue-100">
                          <label className="flex cursor-pointer items-center justify-center gap-1" title="Select row">
                            <input type="checkbox" checked={selectedRequisitionIds.includes(String(req.id))} onChange={() => toggleRequisitionSelection(req.id)} className="h-3.5 w-3.5 rounded border-slate-400 text-indigo-600 focus:ring-indigo-500" />
                            <span>{requisitionPageStart + rowIndex + 1}</span>
                          </label>
                        </td>
                        <td className={`sticky left-[48px] z-20 border-b border-r border-slate-300 px-2 py-2 align-middle group-hover:bg-blue-50 ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                          <button type="button" onClick={() => handleOpenApproval(req)} className="whitespace-nowrap text-[13px] font-semibold text-indigo-700 hover:text-indigo-900 hover:underline">
                            {req.pr_number || `PR-${req.id}`}
                          </button>
                        </td>
                        <td className="border-b border-r border-slate-300 px-3 py-2.5 text-[13px] font-medium tabular-nums text-slate-700">
                          {requestDate ? new Date(requestDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="border-b border-r border-slate-300 px-3 py-2.5 text-[13px] font-medium text-slate-700">
                          <p className="truncate" title={req.po_number_reference || ''}>{req.po_number_reference || '—'}</p>
                        </td>
                        <td className="border-b border-r border-slate-300 px-2.5 py-2 align-middle">
                          <p className="truncate text-[13px] font-semibold text-slate-800" title={requestSummary}>{requestSummary}</p>
                        </td>
                        <td className="border-b border-r border-slate-300 px-3 py-2.5 text-[13px] font-medium text-slate-700">
                          <p className="truncate" title={req.requester_name || req.issued_by_name || ''}>{req.requester_name || req.issued_by_name || '—'}</p>
                        </td>
                        <td className="border-b border-r border-slate-300 px-3 py-2.5 text-[13px] font-medium text-slate-700">
                          <p className="truncate" title={projectDepartment}>{projectDepartment}</p>
                        </td>
                        <td className="border-b border-r border-slate-300 px-3 py-2.5 text-[13px] font-medium text-slate-700">
                          <p className="truncate" title={supplier}>{supplier}</p>
                        </td>
                        <td className="border-b border-r border-slate-300 px-3 py-2.5 text-right text-[13px] font-semibold tabular-nums text-slate-900">
                          {formatCurrency(req.total_price || req.estimated_value, req.currency || 'AED')}
                        </td>
                        <td className="border-b border-r border-slate-300 px-2 py-1.5">{getPriorityBadge(req.priority)}</td>
                        <td className="border-b border-r border-slate-300 px-2 py-1.5">{getStatusBadge(req.status)}</td>
                        <td className={`sticky right-0 border-b border-l border-slate-300 px-2 py-1.5 shadow-[-4px_0_8px_rgba(15,23,42,0.08)] group-hover:bg-blue-50 ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => handleOpenApproval(req)} className="grid h-7 w-7 place-items-center rounded border border-sky-300 bg-white text-sky-700 transition hover:bg-sky-100" title="View"><EyeIcon className="h-3.5 w-3.5" /></button>
                            {canModifyRequisition(req) && <button onClick={() => handleEditRequisition(req)} className="grid h-7 w-7 place-items-center rounded border border-amber-300 bg-white text-amber-700 transition hover:bg-amber-100" title="Edit"><PencilIcon className="h-3.5 w-3.5" /></button>}
                            {APPROVED_REQUISITION_STATUSES.includes(req.status) && hasPurchaseOrderAccess && <button onClick={() => handleConvertToPO(req)} className="grid h-7 w-7 place-items-center rounded border border-indigo-600 bg-indigo-600 text-white transition hover:bg-indigo-700" title="Convert to PO"><ShoppingCartIcon className="h-3.5 w-3.5" /></button>}
                            {APPROVED_REQUISITION_STATUSES.includes(req.status) && <button onClick={() => handlePrintPreviewPR(req)} disabled={prPrintPreviewLoadingId === req.id} className="grid h-7 w-7 place-items-center rounded border border-violet-300 bg-white text-violet-700 transition hover:bg-violet-100 disabled:opacity-50" title="Print Preview"><DocumentTextIcon className="h-3.5 w-3.5" /></button>}
                            {canDeleteRequisition(req) && <button onClick={() => handleDeleteRequisition(req)} className="grid h-7 w-7 place-items-center rounded border border-rose-300 bg-white text-rose-700 transition hover:bg-rose-100" title="Delete"><TrashIcon className="h-3.5 w-3.5" /></button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          ))}

          {activeTab === 'purchaseOrders' && filteredOrders.length > 0 && (
            <div className="mt-4 flex flex-col gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <label htmlFor="order-page-size" className="font-medium">Rows per page</label>
                <select
                  id="order-page-size"
                  value={orderPageSize}
                  onChange={(event) => setOrderPageSize(Number(event.target.value))}
                  className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {[10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
                </select>
                <span>
                  {orderPageStart + 1}-{Math.min(orderPageStart + orderPageSize, filteredOrders.length)} of {filteredOrders.length}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => setOrderPage(1)} disabled={currentOrderPage === 1} className="h-8 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">First</button>
                <button type="button" onClick={() => setOrderPage(page => Math.max(1, page - 1))} disabled={currentOrderPage === 1} className="h-8 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                <span className="min-w-[90px] text-center text-xs font-semibold text-gray-700">Page {currentOrderPage} of {orderTotalPages}</span>
                <button type="button" onClick={() => setOrderPage(page => Math.min(orderTotalPages, page + 1))} disabled={currentOrderPage === orderTotalPages} className="h-8 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
                <button type="button" onClick={() => setOrderPage(orderTotalPages)} disabled={currentOrderPage === orderTotalPages} className="h-8 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">Last</button>
              </div>
            </div>
          )}

          {activeTab === 'purchaseRequisitions' && filteredRequisitions.length > 0 && (
            <div className="mt-4 flex flex-col gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <label htmlFor="requisition-page-size" className="font-medium">Rows per page</label>
                <select
                  id="requisition-page-size"
                  value={requisitionPageSize}
                  onChange={(event) => setRequisitionPageSize(Number(event.target.value))}
                  className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {[10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
                </select>
                <span>
                  {requisitionPageStart + 1}-{Math.min(requisitionPageStart + requisitionPageSize, filteredRequisitions.length)} of {filteredRequisitions.length}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRequisitionPage(1)}
                  disabled={currentRequisitionPage === 1}
                  className="h-8 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  First
                </button>
                <button
                  type="button"
                  onClick={() => setRequisitionPage(page => Math.max(1, page - 1))}
                  disabled={currentRequisitionPage === 1}
                  className="h-8 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="min-w-[90px] text-center text-xs font-semibold text-gray-700">
                  Page {currentRequisitionPage} of {requisitionTotalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setRequisitionPage(page => Math.min(requisitionTotalPages, page + 1))}
                  disabled={currentRequisitionPage === requisitionTotalPages}
                  className="h-8 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
                <button
                  type="button"
                  onClick={() => setRequisitionPage(requisitionTotalPages)}
                  disabled={currentRequisitionPage === requisitionTotalPages}
                  className="h-8 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </div>

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
      />

      <PurchaseRequisitionPdfImport
        isOpen={showPRPdfImport}
        onClose={() => setShowPRPdfImport(false)}
        onImported={() => fetchRequisitions()}
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
