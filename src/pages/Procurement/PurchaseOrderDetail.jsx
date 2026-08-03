import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ShoppingCartIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  UserIcon,
  TruckIcon,
  DocumentTextIcon,
  PencilIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  XMarkIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import { getStatusConfig } from '../../config/procurement.config';

/**
 * Purchase Order Detail Page - Soft-Coded Design
 * Displays comprehensive PO information with status tracking
 */
const PurchaseOrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Soft-coded state management
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  /**
   * Soft-coded data fetching with error handling
   */
  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await apiClient.get(`/procurement/orders/${id}/`);
        setOrder(response.data);
      } catch (error) {
        console.error('Error fetching order details:', error);
        setError({
          message: error.response?.data?.detail || 'Failed to load purchase order details',
          action: () => navigate('/procurement/orders')
        });
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchOrderDetails();
    }
  }, [id, navigate]);

  /**
   * Soft-coded action handler: Send Order
   */
  const handleSendOrder = async () => {
    const confirmed = window.confirm(`Send Purchase Order ${order.po_number} to vendor?`);
    if (!confirmed) return;

    try {
      setActionLoading(true);
      await apiClient.patch(`/procurement/orders/${id}/`, { status: 'sent' });
      
      // Update local state
      setOrder(prev => ({ ...prev, status: 'sent' }));
      alert('✅ Purchase Order sent successfully!');
    } catch (error) {
      console.error('Error sending order:', error);
      alert(`❌ Failed to send order: ${error.response?.data?.detail || error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Soft-coded action handler: Mark as Completed
   */
  const handleMarkComplete = async () => {
    const confirmed = window.confirm(`Mark Purchase Order ${order.po_number} as completed?`);
    if (!confirmed) return;

    try {
      setActionLoading(true);
      await apiClient.patch(`/procurement/orders/${id}/`, { status: 'completed' });
      
      setOrder(prev => ({ ...prev, status: 'completed' }));
      alert('✅ Purchase Order marked as completed!');
    } catch (error) {
      console.error('Error updating order:', error);
      alert(`❌ Failed to update order: ${error.response?.data?.detail || error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Soft-coded status badge renderer
   */
  const getStatusBadge = (status) => {
    const config = getStatusConfig('purchaseOrder', status);
    const colorClasses = {
      green: 'bg-green-100 text-green-800 border-green-300',
      red: 'bg-red-100 text-red-800 border-red-300',
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      blue: 'bg-blue-100 text-blue-800 border-blue-300',
      gray: 'bg-gray-100 text-gray-800 border-gray-300'
    };
    
    return (
      <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold border-2 ${colorClasses[config.color]}`}>
        {config.label}
      </span>
    );
  };

  // Loading state - soft-coded
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-sm text-gray-600">Loading purchase order...</p>
        </div>
      </div>
    );
  }

  // Error state - soft-coded
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <XMarkIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Order</h3>
          <p className="text-sm text-gray-600 mb-4">{error.message}</p>
          <button
            onClick={error.action}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  // No order found - soft-coded
  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ShoppingCartIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Order Not Found</h3>
          <Link
            to="/procurement/orders"
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="py-6">
        {/* Header - Soft-coded */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/procurement/orders')}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Back
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                  <ShoppingCartIcon className="h-8 w-8 mr-3 text-indigo-600" />
                  {order.po_number || `PO-${order.id}`}
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  Purchase Order Details
                </p>
              </div>
            </div>
            
            {/* Action Buttons - Soft-coded based on status */}
            <div className="flex space-x-3">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <PrinterIcon className="h-4 w-4 mr-2" />
                Print
              </button>
              
              {order.status === 'draft' && (
                <button
                  onClick={handleSendOrder}
                  disabled={actionLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
                >
                  <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                  {actionLoading ? 'Sending...' : 'Send to Vendor'}
                </button>
              )}
              
              {(order.status === 'sent' || order.status === 'acknowledged' || order.status === 'in_progress') && (
                <button
                  onClick={handleMarkComplete}
                  disabled={actionLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50"
                >
                  <CheckCircleIcon className="h-4 w-4 mr-2" />
                  {actionLoading ? 'Updating...' : 'Mark Complete'}
                </button>
              )}
              
              <button
                onClick={() => navigate(`/procurement/orders/${order.id}/edit`)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <PencilIcon className="h-4 w-4 mr-2" />
                Edit
              </button>
            </div>
          </div>

          {/* Status Badge */}
          <div className="mb-6">
            {getStatusBadge(order.status)}
          </div>

          {/* Main Content Grid - Soft-coded layout */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left Column - Order Information */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Information Card */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <DocumentTextIcon className="h-5 w-5 mr-2 text-indigo-600" />
                  Order Information
                </h2>
                
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">PO Number</dt>
                    <dd className="mt-1 text-sm text-gray-900 font-semibold">{order.po_number || '-'}</dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Order Date</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {order.po_date ? new Date(order.po_date).toLocaleDateString() : '-'}
                    </dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Expected Delivery</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {order.expected_delivery ? new Date(order.expected_delivery).toLocaleDateString() : '-'}
                    </dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Project</dt>
                    <dd className="mt-1 text-sm text-gray-900">{order.project_number || '-'}</dd>
                  </div>
                  
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Title/Description</dt>
                    <dd className="mt-1 text-sm text-gray-900">{order.title || order.description || '-'}</dd>
                  </div>
                  
                  {order.notes && (
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-gray-500">Notes</dt>
                      <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{order.notes}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Financial Information Card */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <CurrencyDollarIcon className="h-5 w-5 mr-2 text-green-600" />
                  Financial Details
                </h2>
                
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2 bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border-2 border-green-200">
                    <dt className="text-sm font-medium text-gray-600">Total Amount</dt>
                    <dd className="mt-1 text-3xl font-bold text-green-700">
                      {order.currency || 'USD'} {parseFloat(order.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Currency</dt>
                    <dd className="mt-1 text-sm text-gray-900 font-semibold">{order.currency || 'USD'}</dd>
                  </div>
                  
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Payment Terms</dt>
                    <dd className="mt-1 text-sm text-gray-900">{order.payment_terms || 'Not specified'}</dd>
                  </div>
                </dl>
              </div>

              {/* Shipping Information */}
              {order.shipping_address && (
                <div className="bg-white shadow rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <TruckIcon className="h-5 w-5 mr-2 text-blue-600" />
                    Shipping Information
                  </h2>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{order.shipping_address}</p>
                </div>
              )}
            </div>

            {/* Right Column - Vendor & Additional Info */}
            <div className="space-y-6">
              {/* Vendor Information Card */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <UserIcon className="h-5 w-5 mr-2 text-purple-600" />
                  Vendor Details
                </h2>
                
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Vendor Name</dt>
                    <dd className="mt-1 text-sm text-gray-900 font-semibold">{order.vendor_name || 'Not assigned'}</dd>
                  </div>
                </dl>
              </div>

              {/* Timeline Card - Soft-coded status history */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <CalendarIcon className="h-5 w-5 mr-2 text-indigo-600" />
                  Timeline
                </h2>
                
                <div className="space-y-3">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                        <CheckCircleIcon className="h-5 w-5 text-indigo-600" />
                      </div>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">Order Created</p>
                      <p className="text-xs text-gray-500">
                        {order.created_at ? new Date(order.created_at).toLocaleString() : '-'}
                      </p>
                    </div>
                  </div>
                  
                  {order.updated_at && order.updated_at !== order.created_at && (
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                          <PencilIcon className="h-5 w-5 text-yellow-600" />
                        </div>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">Last Updated</p>
                        <p className="text-xs text-gray-500">
                          {new Date(order.updated_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderDetail;
