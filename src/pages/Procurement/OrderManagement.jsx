import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCartIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
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
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import { PageControlButtons } from '../../components/Common/PageControlButtons';
import { usePageControls } from '../../hooks/usePageControls';
import { PROCUREMENT_CONFIG, getCategoryByCode, getStatusConfig, getPriorityConfig, getOrderTabs } from '../../config/procurement.config';
import AIPurchaseOrderCreator from './AIPurchaseOrderCreator';
import PurchaseRequisitionForm from './PurchaseRequisitionForm';
import PurchaseRequisitionApproval from './PurchaseRequisitionApproval';
import PurchaseOrderForm from './PurchaseOrderForm';

const OrderManagement = () => {
  // Navigation hook for soft-coded routing
  const navigate = useNavigate();
  
  // Soft-coded tabs from configuration
  const [activeTab, setActiveTab] = useState('purchaseOrders');
  const orderTabs = getOrderTabs();
  
  // View mode state - soft-coded toggle between card and list view
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'list'
  
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
  const [showAICreator, setShowAICreator] = useState(false);
  const [showPOForm, setShowPOForm] = useState(false);
  const [showPRForm, setShowPRForm] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedRequisition, setSelectedRequisition] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [projects, setProjects] = useState([]);  // Smart project lookup for PO creation
  const [aiInsights, setAiInsights] = useState(null);
  
  // Soft-coded edit state - track which record is being edited
  const [editingOrder, setEditingOrder] = useState(null);
  const [editingRequisition, setEditingRequisition] = useState(null);

  const pageControls = usePageControls({
    autoRefreshInterval: 60,
    features: { autoRefresh: true, fullscreen: true, sidebar: true }
  });

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.get('/procurement/orders/');
      
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
      
      setOrders(normalizedData);
      
      // AI-powered order analytics
      generateAIInsights(normalizedData);
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
        title: '⚠️ Orders Awaiting Action',
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
        title: '🏢 Top Vendor',
        vendor: topVendor[0],
        count: topVendor[1],
        message: `${topVendor[1]} orders with ${topVendor[0]}`,
        priority: 'info'
      });
    }

    setAiInsights(insights);
  };

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
  }) : [];

  // Soft-coded filter logic for requisitions
  const filteredRequisitions = Array.isArray(requisitions) ? requisitions.filter(req => {
    // Soft-coded field access with fallbacks
    const title = req?.title || '';
    const prNumber = req?.pr_number || '';
    const status = req?.status || '';
    const priority = req?.priority || '';
    const requisitionType = req?.requisition_type || 'general';
    
    const matchesSearch = title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         prNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || status === filterStatus;
    const matchesPriority = filterPriority === 'all' || priority === filterPriority;
    const matchesType = filterType === 'all' || requisitionType === filterType;
    return matchesSearch && matchesStatus && matchesPriority && matchesType;
  }) : [];

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
      const response = await apiClient.patch(`/procurement/orders/${order.id}/`, {
        status: 'sent'
      });

      // Update local state - soft-coded state management
      setOrders(prevOrders => 
        prevOrders.map(o => o.id === order.id ? { ...o, status: 'sent' } : o)
      );

      // Soft-coded success notification
      alert(`✅ Purchase Order ${order.po_number || order.id} sent successfully!`);
      
      // Refresh orders to get latest data
      await fetchOrders();
    } catch (error) {
      console.error('Error sending order:', error);
      // Soft-coded error handling
      alert(`❌ Failed to send order: ${error.response?.data?.detail || error.message}`);
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

      // Update requisition status - soft-coded state update
      setRequisitions(prevReqs => 
        prevReqs.map(r => r.id === requisition.id ? { ...r, status: 'converted' } : r)
      );

      // Soft-coded success notification
      alert(`✅ Requisition ${requisition.pr_number || requisition.id} converted to Purchase Order successfully!`);
      
      // Refresh data
      await fetchRequisitions();
      await fetchOrders();
    } catch (error) {
      console.error('Error converting requisition:', error);
      // Soft-coded error handling
      alert(`❌ Failed to convert: ${error.response?.data?.detail || error.message}`);
    }
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
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClasses[config.color]}`}>
        {config.label}
      </span>
    );
  };

  const OrderStats = () => {
    // Soft-coded stats calculation with safe array handling - conditional based on tab
    if (activeTab === 'purchaseOrders') {
      const safeOrders = Array.isArray(orders) ? orders : [];
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
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow-lg rounded-2xl border-2 border-gray-100 hover:border-indigo-200 hover:shadow-xl transition-all duration-300">
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
        </div>

        <div className="bg-white overflow-hidden shadow-lg rounded-2xl border-2 border-gray-100 hover:border-blue-200 hover:shadow-xl transition-all duration-300">
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
        </div>

        <div className="bg-white overflow-hidden shadow-lg rounded-2xl border-2 border-gray-100 hover:border-yellow-200 hover:shadow-xl transition-all duration-300">
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
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow-lg rounded-2xl border-2 border-gray-100 hover:border-green-200 hover:shadow-xl transition-all duration-300">
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
        </div>

        <div className="bg-gradient-to-br from-teal-400 via-cyan-500 to-blue-500 overflow-hidden shadow-xl rounded-2xl transform hover:scale-105 transition-all duration-300">
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
            </div>
          </div>
        </div>
      </div>
      );
    } else {
      // Requisitions stats
      const safeReqs = Array.isArray(requisitions) ? requisitions : [];
      const stats = {
        total: safeReqs.length,
        draft: safeReqs.filter(r => r?.status === 'draft').length,
        submitted: safeReqs.filter(r => r?.status === 'submitted').length,
        approved: safeReqs.filter(r => r?.status === 'approved').length,
        rejected: safeReqs.filter(r => r?.status === 'rejected').length,
        converted: safeReqs.filter(r => r?.status === 'converted').length
      };

      return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6 mb-6">
          <div className="bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600 overflow-hidden shadow-xl rounded-2xl transform hover:scale-105 transition-all duration-300">
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
          </div>

          <div className="bg-white overflow-hidden shadow-lg rounded-2xl border-2 border-gray-100 hover:border-purple-200 hover:shadow-xl transition-all duration-300">
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
          </div>

          <div className="bg-white overflow-hidden shadow-lg rounded-2xl border-2 border-gray-100 hover:border-blue-200 hover:shadow-xl transition-all duration-300">
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-shrink-0 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl p-3 shadow-md">
                  <PaperAirplaneIcon className="h-6 w-6 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900">{stats.submitted}</div>
                  <div className="text-xs text-blue-600 font-medium mt-1">Submitted</div>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${stats.total > 0 ? (stats.submitted / stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow-lg rounded-2xl border-2 border-gray-100 hover:border-green-200 hover:shadow-xl transition-all duration-300">
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
          </div>

          <div className="bg-white overflow-hidden shadow-lg rounded-2xl border-2 border-gray-100 hover:border-red-200 hover:shadow-xl transition-all duration-300">
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
          </div>

          <div className="bg-gradient-to-br from-purple-400 via-purple-500 to-indigo-500 overflow-hidden shadow-xl rounded-2xl transform hover:scale-105 transition-all duration-300">
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
          </div>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" style={pageControls.styles.container}>
      <div className="py-6" style={pageControls.styles.content}>
        {/* Header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <ShoppingCartIcon className="h-8 w-8 mr-3 text-indigo-600" />
                Order Management
              </h1>
              <p className="mt-2 text-sm text-gray-600 flex items-center">
                <SparklesIcon className="h-4 w-4 mr-1 text-purple-500" />
                AI-powered procurement with smart vendor selection and approval workflows
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <div className="bg-white rounded-2xl shadow-sm p-2 inline-flex space-x-2">
            {orderTabs.map((tab) => {
              const isActive = activeTab === tab.key;
              const Icon = tab.icon === 'ShoppingCartIcon' ? ShoppingCartIcon : DocumentTextIcon;
              const count = tab.key === 'purchaseOrders' ? filteredOrders.length : filteredRequisitions.length;
              const totalCount = tab.key === 'purchaseOrders' ? orders.length : requisitions.length;
              
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <OrderStats />
        </div>

        {/* AI Insights */}
        {aiInsights && aiInsights.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
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

        {/* Error Message */}
        {error && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {/* Search */}
              <div className="md:col-span-2">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                  {activeTab === 'purchaseOrders' ? 'Search Purchase Orders' : 'Search Requisitions'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    id="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder={
                      activeTab === 'purchaseOrders' 
                        ? 'Search by PO number or vendor...' 
                        : 'Search by PR number or title...'
                    }
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  id="status"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                  <label htmlFor="vendor" className="block text-sm font-medium text-gray-700 mb-2">
                    Vendor
                  </label>
                  <select
                    id="vendor"
                    value={filterVendor}
                    onChange={(e) => setFilterVendor(e.target.value)}
                    className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                  <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    id="priority"
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="all">All Priorities</option>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-between items-center">
              <p className="text-sm text-gray-500">
                {activeTab === 'purchaseOrders' 
                  ? `Showing ${filteredOrders.length} of ${Array.isArray(orders) ? orders.length : 0} purchase orders`
                  : `Showing ${filteredRequisitions.length} of ${Array.isArray(requisitions) ? requisitions.length : 0} requisitions`
                }
              </p>
              <div className="flex items-center space-x-3">
                {/* View Toggle - Soft-coded */}
                <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setViewMode('card')}
                    className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                      viewMode === 'card'
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                    title="Card View"
                  >
                    <Squares2X2Icon className="h-4 w-4 mr-1.5" />
                    Cards
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                      viewMode === 'list'
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                    title="List View"
                  >
                    <ListBulletIcon className="h-4 w-4 mr-1.5" />
                    List
                  </button>
                </div>
                
                <button
                  type="button"
                  onClick={() => activeTab === 'purchaseOrders' ? setShowPOForm(true) : setShowPRForm(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <SparklesIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                  {activeTab === 'purchaseOrders' ? 'Create Purchase Order' : 'Create Requisition'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content - Conditional based on active tab */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
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
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredOrders.map((order) => {
                const isOverdue = order.delivery_date && new Date(order.delivery_date) < new Date() && order.status !== 'completed';
                const completionRate = order.items_count ? ((order.received_items || 0) / order.items_count) * 100 : 0;
                
                return (
                <div key={order.id} className="group bg-white overflow-hidden shadow-lg rounded-2xl hover:shadow-2xl transition-all duration-300 border-2 border-gray-100 hover:border-indigo-400 transform hover:-translate-y-1">
                  {/* Status Bar */}
                  <div className={`h-2 ${
                    order.status === 'completed' ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                    order.status === 'sent' ? 'bg-gradient-to-r from-blue-400 to-blue-500' :
                    order.status === 'draft' ? 'bg-gradient-to-r from-gray-300 to-gray-400' :
                    'bg-gradient-to-r from-yellow-400 to-amber-500'
                  }`} />
                  
                  <div className="p-6">
                    {/* Order Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg">
                            <ShoppingCartIcon className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                              {order.po_number || `PO-${order.id}`}
                            </h3>
                            <p className="text-xs text-gray-500">
                              {order.vendor_name || 'No vendor assigned'}
                            </p>
                          </div>
                        </div>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>

                    {/* Order Details Grid */}
                    <div className="space-y-3 mb-4">
                      {order.delivery_date && (
                        <div className={`flex items-center justify-between text-sm p-2 rounded-lg ${
                          isOverdue ? 'bg-red-50' : 'bg-gray-50'
                        }`}>
                          <div className="flex items-center">
                            <CalendarIcon className={`h-4 w-4 mr-2 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`} />
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
                        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg">
                          <div className="flex items-center">
                            <CurrencyDollarIcon className="h-5 w-5 mr-2 text-teal-600" />
                            <span className="text-sm text-gray-600">Order Value</span>
                          </div>
                          <span className="text-lg font-bold text-teal-700">
                            ${parseFloat(order.total_amount).toLocaleString()}
                          </span>
                        </div>
                      )}
                      
                      {order.shipping_address && (
                        <div className="flex items-start text-sm p-2 bg-gray-50 rounded-lg">
                          <TruckIcon className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-600 line-clamp-2">{order.shipping_address}</span>
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
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleViewOrderDetails(order.id)}
                        className="flex-1 inline-flex justify-center items-center px-3 py-2.5 border-2 border-gray-200 shadow-sm text-sm font-semibold rounded-xl text-gray-700 bg-white hover:bg-gray-50 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200">
                        <span>View Details</span>
                      </button>
                      <button 
                        onClick={() => handleEditOrder(order)}
                        className="flex-1 inline-flex justify-center items-center px-3 py-2.5 border-2 border-yellow-300 shadow-sm text-sm font-semibold rounded-xl text-yellow-700 bg-yellow-50 hover:bg-yellow-100 hover:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-all duration-200">
                        <PencilIcon className="h-4 w-4 mr-1.5" />
                        <span>Edit</span>
                      </button>
                      {order.status === 'draft' && (
                        <button 
                          onClick={() => handleSendOrder(order)}
                          className="flex-1 inline-flex justify-center items-center px-3 py-2.5 border-2 border-transparent text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-md hover:shadow-lg transition-all duration-200">
                          <PaperAirplaneIcon className="h-4 w-4 mr-1.5" />
                          <span>Send</span>
                        </button>
                      )}
                      {['draft', 'pending', 'cancelled'].includes(order.status) && (
                        <button 
                          onClick={() => handleDeleteOrder(order)}
                          className="inline-flex justify-center items-center px-3 py-2.5 border-2 border-red-300 shadow-sm text-sm font-semibold rounded-xl text-red-700 bg-red-50 hover:bg-red-100 hover:border-red-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200"
                          title="Delete this purchase order">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          ) : (
            // List View for Purchase Orders
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      PO Number
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vendor
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Delivery Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrders.map((order) => {
                    const isOverdue = order.delivery_date && new Date(order.delivery_date) < new Date() && order.status !== 'completed';
                    return (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                              <ShoppingCartIcon className="h-5 w-5 text-white" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-semibold text-gray-900">{order.po_number || `PO-${order.id}`}</div>
                              <div className="text-xs text-gray-500">{order.project || 'No project'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{order.vendor_name || 'N/A'}</div>
                          <div className="text-xs text-gray-500">{order.shipping_address ? order.shipping_address.substring(0, 30) + '...' : ''}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {order.delivery_date ? (
                            <div className={`text-sm ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                              {new Date(order.delivery_date).toLocaleDateString()}
                              {isOverdue && <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Overdue</span>}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">Not set</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-teal-700">
                            {order.total_amount ? `$${parseFloat(order.total_amount).toLocaleString()}` : 'N/A'}
                          </div>
                          {order.currency && <div className="text-xs text-gray-500">{order.currency}</div>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(order.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => handleViewOrderDetails(order.id)}
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                              <EyeIcon className="h-4 w-4 mr-1" />
                              View
                            </button>
                            <button
                              onClick={() => handleEditOrder(order)}
                              className="inline-flex items-center px-3 py-1.5 border border-yellow-300 shadow-sm text-xs font-medium rounded-md text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                            >
                              <PencilIcon className="h-4 w-4 mr-1" />
                              Edit
                            </button>
                            {order.status === 'draft' && (
                              <button
                                onClick={() => handleSendOrder(order)}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                              >
                                <PaperAirplaneIcon className="h-4 w-4 mr-1" />
                                Send
                              </button>
                            )}
                            {['draft', 'pending', 'cancelled'].includes(order.status) && (
                              <button
                                onClick={() => handleDeleteOrder(order)}
                                className="inline-flex items-center px-3 py-1.5 border border-red-300 shadow-sm text-xs font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                title="Delete this purchase order"
                              >
                                <TrashIcon className="h-4 w-4 mr-1" />
                                Delete
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
              {filteredRequisitions.map((req) => {
                const daysSinceCreation = req.created_date 
                  ? Math.floor((new Date() - new Date(req.created_date)) / (1000 * 60 * 60 * 24))
                  : 0;
                const isUrgent = req.priority === 'urgent' || req.priority === 'high';
                
                return (
                <div key={req.id} className="group bg-white overflow-hidden shadow-lg rounded-2xl hover:shadow-2xl transition-all duration-300 border-2 border-gray-100 hover:border-purple-400 transform hover:-translate-y-1">
                  {/* Status Bar */}
                  <div className={`h-2 ${
                    req.status === 'converted' ? 'bg-gradient-to-r from-purple-400 to-indigo-500' :
                    req.status === 'approved' ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
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
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleOpenApproval(req)}
                        className="flex-1 inline-flex justify-center items-center px-3 py-2.5 border-2 border-gray-200 shadow-sm text-sm font-semibold rounded-xl text-gray-700 bg-white hover:bg-gray-50 hover:border-purple-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-200">
                        <span>View Details</span>
                      </button>
                      <button 
                        onClick={() => handleEditRequisition(req)}
                        className="flex-1 inline-flex justify-center items-center px-3 py-2.5 border-2 border-yellow-300 shadow-sm text-sm font-semibold rounded-xl text-yellow-700 bg-yellow-50 hover:bg-yellow-100 hover:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-all duration-200">
                        <PencilIcon className="h-4 w-4 mr-1.5" />
                        <span>Edit</span>
                      </button>
                      {req.status === 'approved' && (
                        <button 
                          onClick={() => handleConvertToPO(req)}
                          className="flex-1 inline-flex justify-center items-center px-3 py-2.5 border-2 border-transparent text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 shadow-md hover:shadow-lg transition-all duration-200">
                          <ShoppingCartIcon className="h-4 w-4 mr-1.5" />
                          <span>Convert to PO</span>
                        </button>
                      )}
                      {['draft', 'rejected', 'withdrawn'].includes(req.status) && (
                        <button 
                          onClick={() => handleDeleteRequisition(req)}
                          className="inline-flex justify-center items-center px-3 py-2.5 border-2 border-red-300 shadow-sm text-sm font-semibold rounded-xl text-red-700 bg-red-50 hover:bg-red-100 hover:border-red-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200"
                          title="Delete this purchase requisition">
                          <TrashIcon className="h-4 w-4" />
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
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      PR Number
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Title
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estimated Value
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRequisitions.map((req) => {
                    const daysSinceCreation = req.created_date 
                      ? Math.floor((new Date() - new Date(req.created_date)) / (1000 * 60 * 60 * 24))
                      : 0;
                    const isUrgent = req.priority === 'urgent' || req.priority === 'high';
                    return (
                      <tr key={req.id} className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                              <DocumentTextIcon className="h-5 w-5 text-white" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-semibold text-gray-900">{req.pr_number || `PR-${req.id}`}</div>
                              <div className="text-xs text-gray-500">{req.requester_name || 'N/A'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate">{req.title || 'No title'}</div>
                          <div className="text-xs text-gray-500">{req.supplier_name || 'Supplier TBD'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {isUrgent && (
                              <span className="flex h-2 w-2 relative mr-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                              </span>
                            )}
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              req.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                              req.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                              req.priority === 'normal' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {req.priority ? req.priority.charAt(0).toUpperCase() + req.priority.slice(1) : 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-purple-700">
                            {(req.total_price || req.estimated_value) ? `~$${parseFloat(req.total_price || req.estimated_value).toLocaleString()}` : 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(req.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {req.created_date ? (
                            <div>
                              <div>{new Date(req.created_date).toLocaleDateString()}</div>
                              <div className="text-xs text-gray-400">
                                {daysSinceCreation === 0 ? 'Today' : `${daysSinceCreation}d ago`}
                              </div>
                            </div>
                          ) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => handleOpenApproval(req)}
                              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                            >
                              <EyeIcon className="h-4 w-4 mr-1" />
                              View
                            </button>
                            <button
                              onClick={() => handleEditRequisition(req)}
                              className="inline-flex items-center px-3 py-1.5 border border-yellow-300 shadow-sm text-xs font-medium rounded-md text-yellow-700 bg-yellow-50 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                            >
                              <PencilIcon className="h-4 w-4 mr-1" />
                              Edit
                            </button>
                            {req.status === 'approved' && (
                              <button
                                onClick={() => handleConvertToPO(req)}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                              >
                                <ShoppingCartIcon className="h-4 w-4 mr-1" />
                                Convert
                              </button>
                            )}
                            {['draft', 'rejected', 'withdrawn'].includes(req.status) && (
                              <button
                                onClick={() => handleDeleteRequisition(req)}
                                className="inline-flex items-center px-3 py-1.5 border border-red-300 shadow-sm text-xs font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                title="Delete this purchase requisition"
                              >
                                <TrashIcon className="h-4 w-4 mr-1" />
                                Delete
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
          ))}
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
          onSuccess={(newOrder) => {
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
          onSuccess={(newRequisition) => {
            setShowPRForm(false);
            setEditingRequisition(null);  // Clear editing state on success
            fetchRequisitions();  // Refresh requisitions to show updated data
          }}
          editData={editingRequisition}  // Pass the requisition being edited
        />
      )}

      {/* Purchase Requisition Approval Modal */}
      <PurchaseRequisitionApproval
        isOpen={showApprovalModal}
        onClose={() => {
          setShowApprovalModal(false);
          setSelectedRequisition(null);
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
