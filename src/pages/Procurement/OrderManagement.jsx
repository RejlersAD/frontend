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
import { PageControlButtons } from '../../components/Common/PageControlButtons';
import { usePageControls } from '../../hooks/usePageControls';
import { getStatusConfig, getOrderTabs } from '../../config/procurement.config';
import AIPurchaseOrderCreator from './AIPurchaseOrderCreator';
import PurchaseRequisitionForm from './PurchaseRequisitionForm';
import PurchaseRequisitionApproval from './PurchaseRequisitionApproval';
import PurchaseRequisitionExcelImport from './PurchaseRequisitionExcelImport';
import PurchaseRequisitionPdfImport from './PurchaseRequisitionPdfImport';
import PurchaseOrderExcelImport from './PurchaseOrderExcelImport';
import PurchaseOrderPdfImport from './PurchaseOrderPdfImport';
import PurchaseOrderForm from './PurchaseOrderForm';
<<<<<<< HEAD
import { buildProcurementPdfFilename } from '../../utils/procurementPdfFilename';
=======
>>>>>>> origin/main

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
<<<<<<< HEAD
  const [activeOrderCard, setActiveOrderCard] = useState('total');
  const [activeRequisitionCard, setActiveRequisitionCard] = useState('total');
=======
>>>>>>> origin/main
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(25);
  const [requisitionSort, setRequisitionSort] = useState({ key: 'created_at', direction: 'desc' });
  const [requisitionPage, setRequisitionPage] = useState(1);
  const [requisitionPageSize, setRequisitionPageSize] = useState(25);
  const [showAICreator, setShowAICreator] = useState(false);
  const [showPOForm, setShowPOForm] = useState(false);
  const [showPRForm, setShowPRForm] = useState(false);
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
<<<<<<< HEAD
=======
  const [aiInsights, setAiInsights] = useState(null);
  
>>>>>>> origin/main
  // Soft-coded edit state - track which record is being edited
  const [editingOrder, setEditingOrder] = useState(null);
  const [editingRequisition, setEditingRequisition] = useState(null);

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
<<<<<<< HEAD
    setActiveOrderCard('total');
    setActiveRequisitionCard('total');
=======
>>>>>>> origin/main
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
      
<<<<<<< HEAD
=======
      // AI-powered order analytics
      generateAIInsights(normalizedData);
>>>>>>> origin/main
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

  const handleOpenApproval = (requisition) => {
    setSelectedRequisition(requisition);
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

<<<<<<< HEAD
=======
  /**
   * AI Feature: Generate order insights and recommendations
   */
  const generateAIInsights = (orderList) => {
    if (!Array.isArray(orderList) || orderList.length === 0) return;

    // Soft-coded AI analytics
    const insights = [];
    
    // Analyze pending orders
    const pendingOrders = orderList.filter(o => o.status === 'draft' || o.status === 'pending');
    if (pendingOrders.length > 0) {
      insights.push({
        type: 'action_required',
        title: '🔔 Orders Awaiting Action',
        count: pendingOrders.length,
        message: `${pendingOrders.length} order${pendingOrders.length > 1 ? 's' : ''} pending approval or submission`,
        priority: 'high'
      });
    }

    // Check delivery delays
    const today = new Date();
    const overdueOrders = orderList.filter(o => {
      if (!o.delivery_date || o.status === 'completed') return false;
      const deliveryDate = new Date(o.delivery_date);
      return deliveryDate < today;
    });
    
    if (overdueOrders.length > 0) {
      insights.push({
        type: 'delivery_alert',
        title: '🚚 Delivery Delays',
        count: overdueOrders.length,
        message: `${overdueOrders.length} order${overdueOrders.length > 1 ? 's' : ''} past expected delivery date`,
        priority: 'urgent'
      });
    }

    // Calculate total order value
    const totalValue = orderList.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
    if (totalValue > 0) {
      insights.push({
        type: 'financial',
        title: '💰 Total Order Value',
        value: `$${totalValue.toLocaleString()}`,
        message: `Total value of ${orderList.length} purchase orders`,
        priority: 'info'
      });
    }

    // Vendor concentration analysis
    const vendorCounts = orderList.reduce((acc, o) => {
      const vendor = o.vendor_name || 'Unknown';
      acc[vendor] = (acc[vendor] || 0) + 1;
      return acc;
    }, {});
    
    const topVendor = Object.entries(vendorCounts).sort((a, b) => b[1] - a[1])[0];
    if (topVendor) {
      insights.push({
        type: 'vendor_analysis',
        title: '🏆 Top Vendor',
        vendor: topVendor[0],
        count: topVendor[1],
        message: `${topVendor[1]} orders with ${topVendor[0]}`,
        priority: 'info'
      });
    }

    setAiInsights(insights);
  };

>>>>>>> origin/main
  // Soft-coded filter logic with safe array handling
  const filteredOrders = Array.isArray(orders) ? orders.filter(order => {
    // Soft-coded field access with fallbacks
    const poNumber = order?.po_number || '';
    const vendorName = order?.vendor_name || '';
    const status = order?.status || '';
    const vendorId = order?.vendor?.toString() || '';
    
    const matchesSearch = poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendorName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || status === filterStatus;
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

  useEffect(() => {
    setRequisitionPage(1);
  }, [searchTerm, filterStatus, filterPriority, filterType, requisitionPageSize]);

  useEffect(() => {
    setViewMode('list');
  }, [activeTab]);

  const exportRequisitionsToExcel = () => {
    const rows = filteredRequisitions.map((req, rowIndex) => Object.fromEntries(
      PR_REGISTER_COLUMNS.map(([column]) => [column, getPRRegisterValue(req, column, rowIndex)]),
    ));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = PR_REGISTER_COLUMNS.map(([, width]) => ({ width }));
    const workbook = XLSX.utils.book_new();
<<<<<<< HEAD
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Purchase Recommendations');
=======
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Purchase Requisitions');
>>>>>>> origin/main
    XLSX.writeFile(workbook, `RADAI_Purchase_Requisitions_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleOrderCreated = async (orderData) => {
    console.log('Creating order with AI data:', orderData);
    // After successful creation, refresh order list
    await fetchOrders();
  };

  const handleRequisitionCreated = async (reqData) => {
    console.log('Creating requisition with AI data:', reqData);
    // After successful creation, refresh requisition list
    await fetchRequisitions();
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
    
    // Set the requisition to edit and open the form
    setEditingRequisition(requisition);
    setShowPRForm(true);
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
<<<<<<< HEAD
      const fallbackName = buildProcurementPdfFilename(
        requisition.pr_number || `PR-${requisition.id}`,
        'pr',
        requisition.issued_date || requisition.created_at,
      );
=======
      const fallbackName = `${requisition.pr_number || `PR-${requisition.id}`}_Approved.pdf`;
>>>>>>> origin/main
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

<<<<<<< HEAD
  const downloadRequisitionPreview = () => {
    if (!prPrintPreview?.url) return;
    const link = document.createElement('a');
    link.href = prPrintPreview.url;
    link.download = prPrintPreview.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

=======
>>>>>>> origin/main
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
<<<<<<< HEAD
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
      const selectedCardClass = (cardKey) => activeOrderCard === cardKey
        ? 'ring-4 ring-indigo-300 ring-offset-2'
        : '';

      return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6 mb-6">
        <button type="button" onClick={() => applyCardFilter('total', 'all')} aria-pressed={activeOrderCard === 'total'} className={`w-full text-left bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 overflow-hidden shadow-xl rounded-2xl transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-indigo-300 focus:ring-offset-2 transition-all duration-300 ${selectedCardClass('total')}`}>
=======
      const stats = {
        total: safeOrders.length,
        draft: safeOrders.filter(o => o?.status === 'draft').length,
        sent: safeOrders.filter(o => o?.status === 'sent').length,
        acknowledged: safeOrders.filter(o => o?.status === 'acknowledged').length,
        completed: safeOrders.filter(o => o?.status === 'completed').length,
        totalValue: safeOrders.reduce((sum, o) => sum + (parseFloat(o?.total_amount) || 0), 0)
      };

      return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6 mb-6">
        <div className="bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 overflow-hidden shadow-xl rounded-2xl transform hover:scale-105 transition-all duration-300">
>>>>>>> origin/main
          <div className="p-6 relative">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <ShoppingCartIcon className="h-8 w-8 text-white/80" />
                <div className="text-xs font-semibold text-white/60 bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
                  Total
                </div>
              </div>
              <div className="text-4xl font-bold text-white mb-1">{stats.total}</div>
              <div className="text-sm text-white/80 font-medium">Purchase Orders</div>
<<<<<<< HEAD
              <div className="mt-3 border-t border-white/20 pt-3">
                <div className="text-xs font-semibold text-white">Top Vendor</div>
                <div className="mt-1 truncate text-xs text-white/75" title={stats.topVendorName}>
                  {stats.topVendorOrders} order{stats.topVendorOrders === 1 ? '' : 's'} with {stats.topVendorName}
                </div>
              </div>
            </div>
          </div>
        </button>

        <button type="button" onClick={() => applyCardFilter('draft', 'draft')} aria-pressed={activeOrderCard === 'draft'} className={`w-full text-left bg-white overflow-hidden shadow-lg rounded-2xl border-2 hover:border-indigo-200 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-indigo-300 focus:ring-offset-2 transition-all duration-300 ${activeOrderCard === 'draft' ? 'border-indigo-300' : 'border-gray-100'} ${selectedCardClass('draft')}`}>
=======
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow-lg rounded-2xl border-2 border-gray-100 hover:border-indigo-200 hover:shadow-xl transition-all duration-300">
>>>>>>> origin/main
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex-shrink-0 bg-gradient-to-br from-gray-400 to-gray-500 rounded-xl p-3 shadow-md">
                <ClockIcon className="h-6 w-6 text-white" />
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900">{stats.draft}</div>
                <div className="text-xs text-gray-500 font-medium mt-1">Draft</div>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-gray-400 to-gray-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${stats.total > 0 ? (stats.draft / stats.total) * 100 : 0}%` }}
              />
            </div>
<<<<<<< HEAD
            <div className="mt-3 border-t border-gray-100 pt-3">
              <div className="text-xs font-semibold text-amber-700">Orders Awaiting Action</div>
              <div className="mt-1 text-xs leading-4 text-gray-500">
                {stats.awaitingAction} order{stats.awaitingAction === 1 ? '' : 's'} pending approval or submission
              </div>
            </div>
          </div>
        </button>

        <button type="button" onClick={() => applyCardFilter('sent', 'sent')} aria-pressed={activeOrderCard === 'sent'} className={`w-full text-left bg-white overflow-hidden shadow-lg rounded-2xl border-2 hover:border-blue-200 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-indigo-300 focus:ring-offset-2 transition-all duration-300 ${activeOrderCard === 'sent' ? 'border-blue-300' : 'border-gray-100'} ${selectedCardClass('sent')}`}>
=======
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow-lg rounded-2xl border-2 border-gray-100 hover:border-blue-200 hover:shadow-xl transition-all duration-300">
>>>>>>> origin/main
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex-shrink-0 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl p-3 shadow-md">
                <PaperAirplaneIcon className="h-6 w-6 text-white" />
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900">{stats.sent}</div>
                <div className="text-xs text-blue-600 font-medium mt-1">Sent</div>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${stats.total > 0 ? (stats.sent / stats.total) * 100 : 0}%` }}
              />
            </div>
          </div>
<<<<<<< HEAD
        </button>

        <button type="button" onClick={() => applyCardFilter('acknowledged', 'acknowledged')} aria-pressed={activeOrderCard === 'acknowledged'} className={`w-full text-left bg-white overflow-hidden shadow-lg rounded-2xl border-2 hover:border-yellow-200 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-indigo-300 focus:ring-offset-2 transition-all duration-300 ${activeOrderCard === 'acknowledged' ? 'border-yellow-300' : 'border-gray-100'} ${selectedCardClass('acknowledged')}`}>
=======
        </div>

        <div className="bg-white overflow-hidden shadow-lg rounded-2xl border-2 border-gray-100 hover:border-yellow-200 hover:shadow-xl transition-all duration-300">
>>>>>>> origin/main
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex-shrink-0 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-xl p-3 shadow-md">
                <DocumentCheckIcon className="h-6 w-6 text-white" />
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900">{stats.acknowledged}</div>
                <div className="text-xs text-yellow-600 font-medium mt-1">Acknowledged</div>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-yellow-400 to-amber-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${stats.total > 0 ? (stats.acknowledged / stats.total) * 100 : 0}%` }}
              />
            </div>
<<<<<<< HEAD
            <div className="mt-3 border-t border-gray-100 pt-3">
              <div className={`text-xs font-semibold ${stats.overdue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {stats.overdue > 0 ? 'Delivery Delays' : 'Delivery Status'}
              </div>
              <div className="mt-1 text-xs leading-4 text-gray-500">
                {stats.overdue > 0
                  ? `${stats.overdue} order${stats.overdue === 1 ? '' : 's'} past expected delivery date`
                  : 'No orders past the expected delivery date'}
              </div>
            </div>
          </div>
        </button>

        <button type="button" onClick={() => applyCardFilter('completed', 'completed')} aria-pressed={activeOrderCard === 'completed'} className={`w-full text-left bg-white overflow-hidden shadow-lg rounded-2xl border-2 hover:border-green-200 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-indigo-300 focus:ring-offset-2 transition-all duration-300 ${activeOrderCard === 'completed' ? 'border-green-300' : 'border-gray-100'} ${selectedCardClass('completed')}`}>
=======
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow-lg rounded-2xl border-2 border-gray-100 hover:border-green-200 hover:shadow-xl transition-all duration-300">
>>>>>>> origin/main
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex-shrink-0 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl p-3 shadow-md">
                <CheckCircleIcon className="h-6 w-6 text-white" />
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900">{stats.completed}</div>
                <div className="text-xs text-green-600 font-medium mt-1">Completed</div>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-green-400 to-emerald-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}
              />
            </div>
          </div>
<<<<<<< HEAD
        </button>

        <button type="button" onClick={() => applyCardFilter('value', 'all')} aria-pressed={activeOrderCard === 'value'} className={`w-full text-left bg-gradient-to-br from-teal-400 via-cyan-500 to-blue-500 overflow-hidden shadow-xl rounded-2xl transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-indigo-300 focus:ring-offset-2 transition-all duration-300 ${selectedCardClass('value')}`}>
=======
        </div>

        <div className="bg-gradient-to-br from-teal-400 via-cyan-500 to-blue-500 overflow-hidden shadow-xl rounded-2xl transform hover:scale-105 transition-all duration-300">
>>>>>>> origin/main
          <div className="p-6 relative">
            <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <CurrencyDollarIcon className="h-8 w-8 text-white/80" />
                <div className="text-xs font-semibold text-white/60 bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
                  Value
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                ${(stats.totalValue / 1000).toFixed(0)}K
              </div>
              <div className="text-sm text-white/80 font-medium">Total Order Value</div>
<<<<<<< HEAD
              <div className="mt-3 border-t border-white/20 pt-3 text-xs text-white/75">
                Total value across {stats.total} purchase order{stats.total === 1 ? '' : 's'}
              </div>
            </div>
          </div>
        </button>
=======
            </div>
          </div>
        </div>
>>>>>>> origin/main
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
<<<<<<< HEAD
      const applyCardFilter = (cardKey, statusValue) => {
        setActiveRequisitionCard(cardKey);
        setFilterStatus(statusValue);
        setSearchTerm('');
        setFilterPriority('all');
        setFilterType('all');
        setRequisitionPage(1);
      };
      const selectedCardClass = (cardKey) => activeRequisitionCard === cardKey
        ? 'ring-4 ring-purple-300 ring-offset-2'
        : '';

      return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-7 mb-6">
          <button type="button" onClick={() => applyCardFilter('total', 'all')} aria-pressed={activeRequisitionCard === 'total'} className={`w-full text-left bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600 overflow-hidden shadow-xl rounded-2xl transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-purple-300 focus:ring-offset-2 transition-all duration-300 ${selectedCardClass('total')}`}>
=======

      return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-7 mb-6">
          <div className="bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600 overflow-hidden shadow-xl rounded-2xl transform hover:scale-105 transition-all duration-300">
>>>>>>> origin/main
            <div className="p-6 relative">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <DocumentTextIcon className="h-8 w-8 text-white/80" />
                  <div className="text-xs font-semibold text-white/60 bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
                    Total
                  </div>
                </div>
                <div className="text-4xl font-bold text-white mb-1">{stats.total}</div>
                <div className="text-sm text-white/80 font-medium">Requisitions</div>
              </div>
            </div>
<<<<<<< HEAD
          </button>

          <button type="button" onClick={() => applyCardFilter('draft', 'draft')} aria-pressed={activeRequisitionCard === 'draft'} className={`w-full text-left bg-white overflow-hidden shadow-lg rounded-2xl border-2 hover:border-purple-200 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-purple-300 focus:ring-offset-2 transition-all duration-300 ${activeRequisitionCard === 'draft' ? 'border-purple-300' : 'border-gray-100'} ${selectedCardClass('draft')}`}>
=======
          </div>

          <div className="bg-white overflow-hidden shadow-lg rounded-2xl border-2 border-gray-100 hover:border-purple-200 hover:shadow-xl transition-all duration-300">
>>>>>>> origin/main
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-shrink-0 bg-gradient-to-br from-gray-400 to-gray-500 rounded-xl p-3 shadow-md">
                  <ClockIcon className="h-6 w-6 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900">{stats.draft}</div>
                  <div className="text-xs text-gray-500 font-medium mt-1">Draft</div>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-gray-400 to-gray-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${stats.total > 0 ? (stats.draft / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
<<<<<<< HEAD
          </button>

          <button type="button" onClick={() => applyCardFilter('under_review', 'under_review')} aria-pressed={activeRequisitionCard === 'under_review'} className={`w-full text-left bg-white overflow-hidden shadow-lg rounded-2xl border-2 hover:border-blue-200 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-purple-300 focus:ring-offset-2 transition-all duration-300 ${activeRequisitionCard === 'under_review' ? 'border-blue-300' : 'border-gray-100'} ${selectedCardClass('under_review')}`}>
=======
          </div>

          <div className="bg-white overflow-hidden shadow-lg rounded-2xl border-2 border-gray-100 hover:border-blue-200 hover:shadow-xl transition-all duration-300">
>>>>>>> origin/main
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-shrink-0 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl p-3 shadow-md">
                  <PaperAirplaneIcon className="h-6 w-6 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900">{stats.underReview}</div>
                  <div className="text-xs text-blue-600 font-medium mt-1">Under Review</div>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${stats.total > 0 ? (stats.underReview / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
<<<<<<< HEAD
          </button>

          <button type="button" onClick={() => applyCardFilter('approved', 'approved')} aria-pressed={activeRequisitionCard === 'approved'} className={`w-full text-left bg-white overflow-hidden shadow-lg rounded-2xl border-2 hover:border-green-200 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-purple-300 focus:ring-offset-2 transition-all duration-300 ${activeRequisitionCard === 'approved' ? 'border-green-300' : 'border-gray-100'} ${selectedCardClass('approved')}`}>
=======
          </div>

          <div className="bg-white overflow-hidden shadow-lg rounded-2xl border-2 border-gray-100 hover:border-green-200 hover:shadow-xl transition-all duration-300">
>>>>>>> origin/main
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-shrink-0 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl p-3 shadow-md">
                  <CheckCircleIcon className="h-6 w-6 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900">{stats.approved}</div>
                  <div className="text-xs text-green-600 font-medium mt-1">Approved</div>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-green-400 to-emerald-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${stats.total > 0 ? (stats.approved / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
<<<<<<< HEAD
          </button>

          <button type="button" onClick={() => applyCardFilter('overdue', 'overdue')} aria-pressed={activeRequisitionCard === 'overdue'} className={`w-full text-left bg-white overflow-hidden shadow-lg rounded-2xl border-2 hover:border-yellow-200 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-purple-300 focus:ring-offset-2 transition-all duration-300 ${activeRequisitionCard === 'overdue' ? 'border-yellow-300' : 'border-gray-100'} ${selectedCardClass('overdue')}`}>
=======
          </div>

          <div className="bg-white overflow-hidden shadow-lg rounded-2xl border-2 border-gray-100 hover:border-yellow-200 hover:shadow-xl transition-all duration-300">
>>>>>>> origin/main
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-shrink-0 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-xl p-3 shadow-md">
                  <ClockIcon className="h-6 w-6 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900">{stats.overdue}</div>
                  <div className="text-xs text-red-600 font-medium mt-1">Overdue</div>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-yellow-400 to-amber-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${stats.total > 0 ? (stats.overdue / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
<<<<<<< HEAD
          </button>

          <button type="button" onClick={() => applyCardFilter('rejected', 'rejected')} aria-pressed={activeRequisitionCard === 'rejected'} className={`w-full text-left bg-white overflow-hidden shadow-lg rounded-2xl border-2 hover:border-red-200 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-purple-300 focus:ring-offset-2 transition-all duration-300 ${activeRequisitionCard === 'rejected' ? 'border-red-300' : 'border-gray-100'} ${selectedCardClass('rejected')}`}>
=======
          </div>

          <div className="bg-white overflow-hidden shadow-lg rounded-2xl border-2 border-gray-100 hover:border-red-200 hover:shadow-xl transition-all duration-300">
>>>>>>> origin/main
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-shrink-0 bg-gradient-to-br from-red-400 to-red-600 rounded-xl p-3 shadow-md">
                  <XCircleIcon className="h-6 w-6 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900">{stats.rejected}</div>
                  <div className="text-xs text-red-600 font-medium mt-1">Rejected</div>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-red-400 to-red-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${stats.total > 0 ? (stats.rejected / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
<<<<<<< HEAD
          </button>

          <button type="button" onClick={() => applyCardFilter('converted', 'converted')} aria-pressed={activeRequisitionCard === 'converted'} className={`w-full text-left bg-gradient-to-br from-purple-400 via-purple-500 to-indigo-500 overflow-hidden shadow-xl rounded-2xl transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-purple-300 focus:ring-offset-2 transition-all duration-300 ${selectedCardClass('converted')}`}>
=======
          </div>

          <div className="bg-gradient-to-br from-purple-400 via-purple-500 to-indigo-500 overflow-hidden shadow-xl rounded-2xl transform hover:scale-105 transition-all duration-300">
>>>>>>> origin/main
            <div className="p-6 relative">
              <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <ShoppingCartIcon className="h-8 w-8 text-white/80" />
                  <div className="text-xs font-semibold text-white/60 bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
                    Success
                  </div>
                </div>
                <div className="text-4xl font-bold text-white mb-1">{stats.converted}</div>
                <div className="text-sm text-white/80 font-medium">Converted to PO</div>
              </div>
            </div>
<<<<<<< HEAD
          </button>
=======
          </div>
>>>>>>> origin/main
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" style={pageControls.styles.container}>
      <div className="py-6" style={pageControls.styles.content}>
        {/* Header */}
        <div className="w-full px-3 sm:px-4 lg:px-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                {activeTab === 'purchaseOrders' ? (
                  <ShoppingCartIcon className="h-8 w-8 mr-3 text-indigo-600" />
                ) : (
                  <DocumentTextIcon className="h-8 w-8 mr-3 text-purple-600" />
                )}
<<<<<<< HEAD
                {activeTab === 'purchaseOrders' ? 'Purchase Order Management' : 'Purchase Recommendations'}
=======
                {activeTab === 'purchaseOrders' ? 'Purchase Order Management' : 'Purchase Requisitions'}
>>>>>>> origin/main
              </h1>
              <p className="mt-2 text-sm text-gray-600 flex items-center">
                <SparklesIcon className="h-4 w-4 mr-1 text-purple-500" />
                {activeTab === 'purchaseOrders'
                  ? 'AI-powered procurement with smart vendor selection and order tracking'
                  : 'Create, review, approve, and track purchase recommendations in one workspace'}
              </p>
            </div>
            
            <PageControlButtons 
              isFullscreen={pageControls.isFullscreen}
              toggleFullscreen={pageControls.toggleFullscreen}
              sidebarVisible={pageControls.sidebarVisible}
              toggleSidebar={pageControls.toggleSidebar}
              autoRefreshEnabled={pageControls.autoRefreshEnabled}
              toggleAutoRefresh={pageControls.toggleAutoRefresh}
              isRefreshing={pageControls.isRefreshing}
              manualRefresh={pageControls.manualRefresh}
            />
          </div>
        </div>

        {/* Tab Navigation - Modern Pill Design */}
        <div className="w-full px-3 sm:px-4 lg:px-6 mt-8">
          <div className="bg-white rounded-2xl shadow-sm p-2 inline-flex space-x-2">
            {orderTabs.map((tab) => {
              const isActive = activeTab === tab.key;
              const Icon = tab.icon === 'ShoppingCartIcon' ? ShoppingCartIcon : DocumentTextIcon;
              
              // Properly reference counts based on tab key to prevent cross-tab mismatch
              const count = tab.key === 'purchaseOrders' ? filteredOrders.length : filteredRequisitions.length;
              const totalCount = tab.key === 'purchaseOrders' ? (Array.isArray(orders) ? orders.length : 0) : (Array.isArray(requisitions) ? requisitions.length : 0);
              
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`
                    relative group flex items-center px-6 py-3 rounded-xl font-medium text-sm transition-all duration-300 transform
                    ${isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg scale-105'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <Icon className={`
                    h-5 w-5 mr-2 transition-transform duration-300
                    ${isActive ? 'text-white animate-pulse' : 'text-gray-400 group-hover:text-gray-600'}
                  `} />
                  <span className="font-semibold">{tab.label}</span>
                  <div className={`
                    ml-3 flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full text-xs font-bold transition-all duration-300
                    ${isActive 
                      ? 'bg-white/20 text-white backdrop-blur-sm' 
                      : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700 group-hover:from-indigo-50 group-hover:to-purple-50 group-hover:text-indigo-700'
                    }
                  `}>
                    {count}
                  </div>
                  {totalCount > count && (
                    <div className={`
                      ml-1 text-xs font-normal transition-opacity duration-300
                      ${isActive ? 'text-white/70' : 'text-gray-400 group-hover:text-gray-600'}
                    `}>
                      / {totalCount}
                    </div>
                  )}
                  {isActive && (
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-white rounded-full shadow-lg" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Statistics */}
        <div className="w-full px-3 sm:px-4 lg:px-6 mt-8">
          <OrderStats />
        </div>

<<<<<<< HEAD
=======
        {/* AI Insights */}
        {aiInsights && aiInsights.length > 0 && (
          <div className="w-full px-3 sm:px-4 lg:px-6 mt-6">
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-6 border-2 border-purple-200">
              <div className="flex items-center space-x-2 mb-4">
                <SparklesIcon className="h-6 w-6 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-900">AI Insights & Alerts</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {aiInsights.map((insight, idx) => (
                  <div key={idx} className={`bg-white rounded-lg p-4 border-2 hover:shadow-md transition-shadow ${
                    insight.priority === 'urgent' ? 'border-red-300' : 
                    insight.priority === 'high' ? 'border-yellow-300' : 
                    'border-purple-200'
                  }`}>
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">{insight.title}</h4>
                    <p className="text-sm text-gray-600">{insight.message}</p>
                    {insight.vendor && (
                      <p className="text-xs text-indigo-600 font-medium mt-2">→ {insight.vendor}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

>>>>>>> origin/main
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
        <div className="w-full px-3 sm:px-4 lg:px-6 mt-8">
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {/* Search */}
              <div className="md:col-span-2">
                <label htmlFor="search" className="block text-xs font-semibold text-gray-700 mb-1.5">
<<<<<<< HEAD
                  {activeTab === 'purchaseOrders' ? 'Search Purchase Orders' : 'Search Purchase Recommendations'}
=======
                  {activeTab === 'purchaseOrders' ? 'Search Purchase Orders' : 'Search Purchase Requisitions'}
>>>>>>> origin/main
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
              <div>
                <label htmlFor="status" className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Status
                </label>
                <select
                  id="status"
                  value={filterStatus}
<<<<<<< HEAD
                  onChange={(e) => {
                    const nextStatus = e.target.value;
                    setFilterStatus(nextStatus);
                    if (activeTab === 'purchaseOrders') {
                      setActiveOrderCard(nextStatus === 'all' ? 'total' : nextStatus);
                    } else {
                      setActiveRequisitionCard(nextStatus === 'all' ? 'total' : nextStatus);
                    }
                  }}
=======
                  onChange={(e) => setFilterStatus(e.target.value)}
>>>>>>> origin/main
                  className="block h-10 w-full px-3 border border-gray-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="all">All Statuses</option>
                  {activeTab === 'purchaseOrders' ? (
                    <>
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="acknowledged">Acknowledged</option>
                      <option value="in_progress">In Progress</option>
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
                <div>
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
                <div>
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

            <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-500">
                {activeTab === 'purchaseOrders' 
                  ? `Showing ${filteredOrders.length} of ${Array.isArray(orders) ? orders.length : 0} purchase orders`
                  : filteredRequisitions.length > 0
                    ? `Showing ${requisitionPageStart + 1}-${Math.min(requisitionPageStart + requisitionPageSize, filteredRequisitions.length)} of ${filteredRequisitions.length} filtered requisitions (${Array.isArray(requisitions) ? requisitions.length : 0} total)`
                    : `Showing 0 of ${Array.isArray(requisitions) ? requisitions.length : 0} requisitions`
                }
              </p>
              <div className="flex flex-wrap items-center gap-2">
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
                <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
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
                  onClick={() => activeTab === 'purchaseOrders' ? setShowPOForm(true) : setShowPRForm(true)}
                  className="inline-flex h-9 items-center px-3.5 border border-transparent text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <PlusIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  {activeTab === 'purchaseOrders' ? 'Create Purchase Order' : 'Create Purchase Recommendation'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content - Conditional based on active tab */}
        <div className="w-full px-3 sm:px-4 lg:px-6 mt-8">
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
                  onClick={() => setShowAICreator(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <SparklesIcon className="-ml-1 mr-2 h-5 w-5" />
                  Create with AI Assistant
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
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-slate-900">Purchase Orders</h3>
                  <p className="mt-1 text-xs text-slate-500">Track suppliers, order values, delivery dates, and fulfilment status.</p>
                </div>
                <span className="inline-flex w-fit items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {filteredOrders.length} record{filteredOrders.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="max-h-[68vh] overflow-auto">
              <table className="w-full min-w-[1280px] table-fixed border-separate border-spacing-0">
                <colgroup>
                  <col className="w-[145px]" />
                  <col className="w-[130px]" />
                  <col className="w-[170px]" />
                  <col className="w-[220px]" />
                  <col className="w-[165px]" />
                  <col className="w-[115px]" />
                  <col className="w-[120px]" />
                  <col className="w-[135px]" />
                  <col className="w-[115px]" />
                  <col className="w-[170px]" />
                </colgroup>
                <thead className="sticky top-0 z-20 bg-slate-200/95 backdrop-blur">
                  <tr>
                    {['PO Number', 'PR Number', 'Supplier', 'Summary', 'Project / Department', 'Order Date', 'Delivery Date', 'Amount', 'Status'].map((column) => (
                      <th key={column} scope="col" className="border-b border-r border-slate-300 bg-slate-200 px-4 py-3.5 text-left text-sm font-bold uppercase tracking-wide text-slate-700">
                        {column}
                      </th>
                    ))}
                    <th scope="col" className="sticky right-0 z-30 border-b border-l border-indigo-200 bg-indigo-50 px-4 py-3.5 text-right text-sm font-bold uppercase tracking-wide text-indigo-700 shadow-[-6px_0_12px_rgba(15,23,42,0.04)]">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {paginatedOrders.map((order) => {
                    const summary = order.description || order.title || 'Untitled order';
                    const projectDepartment = order.project_number || order.project_display || '—';
                    const orderDate = order.po_date || order.created_at;
                    const deliveryDate = order.expected_delivery || order.delivery_date;
                    return (
                      <tr key={order.id} className="group transition-colors hover:bg-slate-50">
                        <td className="border-b border-r border-slate-200 px-4 py-3.5">
                          <button type="button" onClick={() => handleViewOrderDetails(order.id)} className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 hover:underline">
                            {order.po_number || `PO-${order.id}`}
                          </button>
                        </td>
                        <td className="border-b border-r border-slate-200 px-4 py-3.5 text-xs text-slate-600">
                          <p className="truncate" title={order.pr_number || ''}>{order.pr_number || '—'}</p>
                        </td>
                        <td className="border-b border-r border-slate-200 px-4 py-3.5 text-xs text-slate-600">
                          <p className="truncate" title={order.vendor_name || ''}>{order.vendor_name || 'No supplier assigned'}</p>
                        </td>
                        <td className="border-b border-r border-slate-200 px-4 py-3.5">
                          <p className="truncate text-sm font-medium text-slate-800" title={summary}>{summary}</p>
                        </td>
                        <td className="border-b border-r border-slate-200 px-4 py-3.5 text-xs text-slate-600">
                          <p className="line-clamp-2" title={projectDepartment}>{projectDepartment}</p>
                        </td>
                        <td className="border-b border-r border-slate-200 px-4 py-3.5 text-xs text-slate-600">
                          {orderDate ? new Date(orderDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="border-b border-r border-slate-200 px-4 py-3.5 text-xs text-slate-600">
                          {deliveryDate ? new Date(deliveryDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="border-b border-r border-slate-200 px-4 py-3.5 text-sm font-semibold tabular-nums text-slate-800">
                          {formatCurrency(order.total_amount, order.currency || 'AED')}
                        </td>
                        <td className="border-b border-r border-slate-200 px-4 py-3.5">{getStatusBadge(order.status)}</td>
                        <td className="sticky right-0 border-b border-l border-slate-200 bg-white px-3 py-3.5 shadow-[-6px_0_12px_rgba(15,23,42,0.04)] group-hover:bg-slate-50">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleViewOrderDetails(order.id)}
                              className="inline-flex items-center rounded-lg border border-sky-200 bg-sky-50 p-1.5 text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-100"
                              title="View"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </button>
                            {order.status !== 'completed' && (
                              <button
                                type="button"
                                onClick={() => handleEditOrder(order)}
                                className="inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 p-1.5 text-amber-700 shadow-sm transition hover:border-amber-300 hover:bg-amber-100"
                                title="Edit"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                            )}
                            {order.status === 'draft' && (
                              <button
                                type="button"
                                onClick={() => handleSendOrder(order)}
                                className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100"
                                title="Send"
                              >
                                <PaperAirplaneIcon className="h-4 w-4" />
                              </button>
                            )}
                            {['draft', 'pending', 'cancelled'].includes(order.status) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteOrder(order)}
                                className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-100"
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
                  onClick={() => setShowAICreator(true)}
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
                
                return (
                <div key={req.id} className="group bg-white overflow-hidden shadow-lg rounded-2xl hover:shadow-2xl transition-all duration-300 border-2 border-gray-100 hover:border-purple-400 transform hover:-translate-y-1">
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
                      {getStatusBadge(req.status)}
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
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
<<<<<<< HEAD
                  <h3 className="text-xl font-bold tracking-tight text-slate-900">Purchase Recommendations</h3>
=======
                  <h3 className="text-xl font-bold tracking-tight text-slate-900">Purchase Requisitions</h3>
>>>>>>> origin/main
                  <p className="mt-1 text-xs text-slate-500">Review requests, approval status, suppliers, and values.</p>
                </div>
                <span className="inline-flex w-fit items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {filteredRequisitions.length} record{filteredRequisitions.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="max-h-[68vh] overflow-auto">
              <table className="w-full min-w-[1180px] table-fixed border-separate border-spacing-0">
                <colgroup>
                  <col className="w-[135px]" />
                  <col className="w-[105px]" />
                  <col className="w-[220px]" />
                  <col className="w-[165px]" />
                  <col className="w-[150px]" />
                  <col className="w-[125px]" />
                  <col className="w-[90px]" />
                  <col className="w-[115px]" />
                  <col className="w-[150px]" />
                </colgroup>
                <thead className="sticky top-0 z-20 bg-slate-200/95 backdrop-blur">
                  <tr>
                    {[
                      ['PR number', 'PR Number'],
                      ['Date', 'PR Accepted Date'],
                      ['Request', 'Summary of Purchase /Activity'],
                      ['Project / Department', 'Project short name/ Code'],
                      ['Supplier', 'Suppl.Name'],
                      ['Amount', 'PO Amount w/o VAT'],
                      ['Priority', 'priority'],
                      ['Status', 'PO Status'],
                    ].map(([label, sortKey]) => (
                      <th key={label} scope="col" className="border-b border-r border-slate-300 bg-slate-200 px-4 py-3.5 text-left text-sm font-bold uppercase tracking-wide text-slate-700 last:border-r-0">
                        <button type="button" onClick={() => toggleRequisitionSort(sortKey)} className="inline-flex items-center gap-1 hover:text-indigo-700">
                          {label}<ChevronUpDownIcon className="h-3.5 w-3.5" />
                        </button>
                      </th>
                    ))}
                    <th scope="col" className="sticky right-0 z-30 border-b border-l border-indigo-200 bg-indigo-50 px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-indigo-700 shadow-[-6px_0_12px_rgba(15,23,42,0.04)]">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {paginatedRequisitions.map((req) => {
                    const requestSummary = req.product_service || req.title || 'Untitled request';
                    const projectDepartment = req.project_department || req.project || '—';
                    const supplier = req.supplier_name || req.vendor_name || 'Not selected';
                    const requestDate = req.issued_date || req.created_date;
                    return (
                      <tr key={req.id} className="group transition-colors hover:bg-slate-50">
                        <td className="border-b border-r border-slate-200 px-4 py-3.5 align-middle">
                          <button type="button" onClick={() => handleOpenApproval(req)} className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 hover:underline">
                            {req.pr_number || `PR-${req.id}`}
                          </button>
                          {req.po_number_reference && <p className="mt-1 truncate text-[11px] text-slate-400">PO: {req.po_number_reference}</p>}
                        </td>
                        <td className="border-b border-r border-slate-200 px-4 py-3.5 text-xs text-slate-600">
                          {requestDate ? new Date(requestDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="border-b border-r border-slate-200 px-4 py-3.5 align-middle">
                          <p className="truncate text-sm font-medium text-slate-800" title={requestSummary}>{requestSummary}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">{req.requester_name || req.issued_by_name || 'Requester not specified'}</p>
                        </td>
                        <td className="border-b border-r border-slate-200 px-4 py-3.5 text-xs text-slate-600">
                          <p className="line-clamp-2" title={projectDepartment}>{projectDepartment}</p>
                        </td>
                        <td className="border-b border-r border-slate-200 px-4 py-3.5 text-xs text-slate-600">
                          <p className="truncate" title={supplier}>{supplier}</p>
                        </td>
                        <td className="border-b border-r border-slate-200 px-4 py-3.5 text-sm font-semibold tabular-nums text-slate-800">
                          {formatCurrency(req.total_price || req.estimated_value, req.currency || 'AED')}
                        </td>
                        <td className="border-b border-r border-slate-200 px-4 py-3.5">{getPriorityBadge(req.priority)}</td>
                        <td className="border-b border-r border-slate-200 px-4 py-3.5">{getStatusBadge(req.status)}</td>
                        <td className="sticky right-0 border-b border-l border-slate-200 bg-white px-3 py-3.5 shadow-[-6px_0_12px_rgba(15,23,42,0.04)] group-hover:bg-slate-50">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => handleOpenApproval(req)} className="rounded-lg border border-sky-200 bg-sky-50 p-1.5 text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-100" title="View"><EyeIcon className="h-4 w-4" /></button>
                            {canModifyRequisition(req) && <button onClick={() => handleEditRequisition(req)} className="rounded-lg border border-amber-200 bg-amber-50 p-1.5 text-amber-700 shadow-sm transition hover:border-amber-300 hover:bg-amber-100" title="Edit"><PencilIcon className="h-4 w-4" /></button>}
                            {APPROVED_REQUISITION_STATUSES.includes(req.status) && hasPurchaseOrderAccess && <button onClick={() => handleConvertToPO(req)} className="rounded-lg bg-indigo-600 p-1.5 text-white shadow-sm transition hover:bg-indigo-700" title="Convert to PO"><ShoppingCartIcon className="h-4 w-4" /></button>}
                            {APPROVED_REQUISITION_STATUSES.includes(req.status) && <button onClick={() => handlePrintPreviewPR(req)} disabled={prPrintPreviewLoadingId === req.id} className="rounded-lg border border-violet-200 bg-violet-50 p-1.5 text-violet-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-100 disabled:opacity-50" title="Print Preview"><DocumentTextIcon className="h-4 w-4" /></button>}
                            {canDeleteRequisition(req) && <button onClick={() => handleDeleteRequisition(req)} className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-100" title="Delete"><TrashIcon className="h-4 w-4" /></button>}
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
      {activeTab === 'purchaseOrders' ? (
        <AIPurchaseOrderCreator
          isOpen={showAICreator}
          onClose={() => setShowAICreator(false)}
          onOrderCreated={handleOrderCreated}
          vendors={vendors}
          projects={projects}
        />
      ) : (
        <PurchaseRequisitionForm
          isOpen={showAICreator}
          onClose={() => setShowAICreator(false)}
          onSuccess={handleRequisitionCreated}
          editData={null}
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

      {/* Purchase Requisition Form Modal */}
      {showPRForm && (
        <PurchaseRequisitionForm
          isOpen={showPRForm}
          onClose={() => {
            setShowPRForm(false);
            setEditingRequisition(null);  // Clear editing state on close
          }}
          onSuccess={() => {
            setShowPRForm(false);
            setEditingRequisition(null);  // Clear editing state on success
            fetchRequisitions();  // Refresh requisitions to show updated data
          }}
          editData={editingRequisition}  // Pass the requisition being edited
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
<<<<<<< HEAD
              <button type="button" onClick={downloadRequisitionPreview} className="inline-flex items-center gap-2 rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600">
                <ArrowDownTrayIcon className="h-4 w-4" /> Download PDF
              </button>
=======
>>>>>>> origin/main
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
