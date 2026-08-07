import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArchiveBoxIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  SparklesIcon,
  BeakerIcon,
  ShieldCheckIcon,
  DocumentCheckIcon,
  CubeIcon,
  CalendarIcon,
  UserGroupIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline";
import apiClient from "../../services/api.service";
import { PageControlButtons } from "../../components/Common/PageControlButtons";
import { usePageControls } from "../../hooks/usePageControls";
import {
  PROCUREMENT_CONFIG,
  getCategoryByCode,
  getStatusConfig,
} from "../../config/procurement.config";
import AIReceiptCreator from "./AIReceiptCreator";
import GoodsReceiptPrintPreview from "./GoodsReceiptPrintPreview";
/**
 * =============================================================================
 * MODULE INSTRUCTIONS & ARCHITECTURE GUIDELINES
 * =============================================================================
 *
 * 1. LAYOUT & CONTAINER WIDTHS:
 *    - Always use the shared layout configuration (`LAYOUT_CONFIG.maxWidthDefault` set to 'max-w-full') for top-level page containers.
 *    - Avoid hardcoding fixed max-width constraints (like max-w-7xl) that create unwanted whitespace on widescreen displays.
 *
 * 2. DATA SAFETY & NORMALIZATION:
 *    - Always validate backend responses before rendering:
 *      - Ensure incoming API data is safely normalized into a valid array, whether it arrives as a direct list or wrapped inside a paginated results object.
 *      - Prevent application crashes from missing or undefined data by using optional chaining and providing clean default fallback text (such as a dash).
 *
 * 3. PAGINATION & DATA VIEWS:
 *    - Provide both a structured Table View and a responsive Grid/Card View where applicable.
 *    - Implement standard corporate pagination controls (allowing selection of 10, 25, 50, or 100 rows per page with page number navigation).
 *    - Omit informal UI/UX instructions or hint banners (such as "Scroll horizontally to view").
 *
 * 4. PROCUREMENT DOMAIN CONNECTIONS:
 *    - Connect Purchase Orders and Goods Receipts directly through purchase order IDs and individual line-item references.
 *    - Maintain automated status tracking throughout the procurement lifecycle: Draft -> Approved -> Sent -> Partial -> Completed.
 * =============================================================================
 */
// Soft-coded layout configuration
const LAYOUT_CONFIG = {
  maxWidthDefault: "max-w-full", // Updated from max-w-7xl to fill available screen width
  cardGridCols: {
    sm: "sm:grid-cols-2",
    lg: "lg:grid-cols-3",
    xl: "xl:grid-cols-4",
  },
};

const ReceiptManagement = () => {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterQuality, setFilterQuality] = useState("all");
  const [showAICreator, setShowAICreator] = useState(false);
  const [orders, setOrders] = useState([]);
  const [aiInsights, setAiInsights] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [actionReceiptId, setActionReceiptId] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [printReceipt, setPrintReceipt] = useState(null);

  const pageControls = usePageControls({
    autoRefreshInterval: 60,
    features: { autoRefresh: true, fullscreen: true, sidebar: true },
  });

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get("/procurement/receipts/");
      const data = response.data;

      // Soft-coded data normalization - ensure array
      let normalizedData = [];
      if (Array.isArray(data)) {
        normalizedData = data;
      } else if (data && Array.isArray(data.results)) {
        normalizedData = data.results;
      } else if (data && typeof data === "object") {
        normalizedData = [data];
      }

      setReceipts(normalizedData);

      // AI-powered receipt analytics
      generateAIInsights(normalizedData);
    } catch (error) {
      console.error("Error fetching receipts:", error);
      setError({
        type: "network",
        message: `Failed to load goods receipts: ${error.message}`,
        action: () => fetchReceipts(),
      });
      setReceipts([]); // Ensure array even on error
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await apiClient.get("/procurement/orders/");
      const data = response.data;
      // Filter only sent/acknowledged orders (ready for receipt)
      const orderList = Array.isArray(data)
        ? data
        : Array.isArray(data.results)
          ? data.results
          : [];
      const readyOrders = orderList.filter((order) =>
        ["sent", "acknowledged", "in_progress", "partially_received"].includes(
          order.status,
        ),
      );
      setOrders(readyOrders);
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  };

  useEffect(() => {
    fetchReceipts();
    fetchOrders();
  }, [pageControls.isRefreshing]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timer = window.setTimeout(() => setSuccessMessage(""), 8000);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  /**
   * AI Feature: Generate receipt insights and quality alerts
   */
  const generateAIInsights = (receiptList) => {
    if (!Array.isArray(receiptList) || receiptList.length === 0) return;

    // Soft-coded AI analytics
    const insights = [];

    // Quality inspection alerts
    const pendingInspection = receiptList.filter(
      (r) => r.status === "pending" || !r.quality_check_passed,
    );

    if (pendingInspection.length > 0) {
      insights.push({
        type: "quality_pending",
        title: "🔍 Quality Inspections Pending",
        count: pendingInspection.length,
        message: `${pendingInspection.length} receipt${pendingInspection.length > 1 ? "s" : ""} awaiting quality inspection`,
        priority: "high",
      });
    }

    // Failed quality checks
    const qualityFailed = receiptList.filter(
      (r) =>
        r.dimensional_check_passed === false ||
        r.visual_inspection_passed === false ||
        r.material_verification_passed === false,
    );

    if (qualityFailed.length > 0) {
      insights.push({
        type: "quality_failed",
        title: "❌ Quality Issues Detected",
        count: qualityFailed.length,
        message: `${qualityFailed.length} receipt${qualityFailed.length > 1 ? "s" : ""} failed quality checks - immediate action required`,
        priority: "urgent",
      });
    }

    // NDT requirements
    const ndtPending = receiptList.filter(
      (r) => r.ndt_required && (!r.ndt_performed || !r.ndt_results),
    );

    if (ndtPending.length > 0) {
      insights.push({
        type: "ndt_pending",
        title: "🧪 NDT Testing Required",
        count: ndtPending.length,
        message: `${ndtPending.length} item${ndtPending.length > 1 ? "s" : ""} pending Non-Destructive Testing`,
        priority: "high",
      });
    }

    // Certification compliance
    const certMissing = receiptList.filter(
      (r) =>
        !r.certificates_received ||
        (r.certificates_received && r.certificates_received.length === 0),
    );

    if (certMissing.length > 0) {
      insights.push({
        type: "cert_missing",
        title: "📋 Certifications Missing",
        count: certMissing.length,
        message: `${certMissing.length} receipt${certMissing.length > 1 ? "s" : ""} missing required material certificates`,
        priority: "high",
      });
    }

    // Material traceability
    const traceabilityIssues = receiptList.filter(
      (r) =>
        !r.heat_numbers ||
        (Array.isArray(r.heat_numbers) && r.heat_numbers.length === 0),
    );

    if (traceabilityIssues.length > 0) {
      insights.push({
        type: "traceability",
        title: "🔢 Material Traceability Gaps",
        count: traceabilityIssues.length,
        message: `${traceabilityIssues.length} item${traceabilityIssues.length > 1 ? "s" : ""} missing heat numbers for traceability`,
        priority: "medium",
      });
    }

    // Acceptance rate
    const accepted = receiptList.filter((r) => r.status === "accepted").length;
    const acceptanceRate =
      receiptList.length > 0
        ? ((accepted / receiptList.length) * 100).toFixed(1)
        : 0;

    insights.push({
      type: "acceptance_rate",
      title: "✅ Acceptance Rate",
      percentage: acceptanceRate,
      message: `${acceptanceRate}% of receipts accepted (${accepted} out of ${receiptList.length})`,
      priority: acceptanceRate < 80 ? "medium" : "info",
    });

    setAiInsights(insights);
  };

  // Soft-coded filter logic with safe array handling
  const filteredReceipts = Array.isArray(receipts)
    ? receipts.filter((receipt) => {
        // Soft-coded field access with fallbacks
        const grNumber = receipt?.receipt_number || "";
        const poNumber = receipt?.po_number || "";
        const status = receipt?.status || "";
        const qualityPassed = receipt?.quality_check_passed;

        const matchesSearch =
          grNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          poNumber.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === "all" || status === filterStatus;
        const matchesQuality =
          filterQuality === "all" ||
          (filterQuality === "passed" && qualityPassed === true) ||
          (filterQuality === "failed" && qualityPassed === false) ||
          (filterQuality === "pending" && qualityPassed === null);
        return matchesSearch && matchesStatus && matchesQuality;
      })
    : [];

  const totalPages = Math.max(1, Math.ceil(filteredReceipts.length / pageSize));
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedReceipts = filteredReceipts.slice(
    pageStart,
    pageStart + pageSize,
  );
  const visiblePageNumbers = [
    ...new Set(
      [1, currentPage - 1, currentPage, currentPage + 1, totalPages].filter(
        (page) => page >= 1 && page <= totalPages,
      ),
    ),
  ].sort((a, b) => a - b);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterQuality, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const handleReceiptCreated = async (receiptData) => {
    // Show the committed receipt immediately, even while the server list is
    // refreshing, and clear filters that could otherwise hide the new record.
    setReceipts((current) => [
      receiptData,
      ...current.filter((receipt) => receipt.id !== receiptData.id),
    ]);
    setSearchTerm("");
    setFilterStatus("all");
    setFilterQuality("all");
    setSuccessMessage(
      receiptData.message ||
        `Goods Receipt ${receiptData.receipt_number} was saved in the database and submitted successfully.`,
    );
    await Promise.all([fetchReceipts(), fetchOrders()]);
  };

  const runReceiptAction = async (receipt, action, payload = {}) => {
    setActionReceiptId(receipt.id);
    setError(null);
    try {
      await apiClient.post(
        `/procurement/receipts/${receipt.id}/${action}/`,
        payload,
      );
      await Promise.all([fetchReceipts(), fetchOrders()]);
      setSelectedReceipt(null);
    } catch (requestError) {
      const data = requestError.response?.data;
      setError({
        type: "validation",
        message:
          data?.detail ||
          data?.error ||
          Object.values(data || {})[0] ||
          requestError.message,
        action: null,
      });
    } finally {
      setActionReceiptId(null);
    }
  };

  const handleRejectReceipt = (receipt) => {
    const reason = window.prompt(
      "Enter the delivery rejection reason (minimum 10 characters):",
    );
    if (reason === null) return;
    runReceiptAction(receipt, "reject_delivery", { reason });
  };

  const getStatusBadge = (status) => {
    const config = getStatusConfig("receipt", status);
    const colorClasses = {
      green: "bg-green-100 text-green-800 border-green-200",
      red: "bg-red-100 text-red-800 border-red-200",
      yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
      blue: "bg-blue-100 text-blue-800 border-blue-200",
      gray: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClasses[config.color]}`}
      >
        {config.label}
      </span>
    );
  };

  const getQualityBadge = (receipt) => {
    if (receipt?.quality_check_passed === true) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-300">
          <CheckCircleIcon className="h-3 w-3 mr-1" />
          Quality Passed
        </span>
      );
    } else if (receipt?.quality_check_passed === false) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 border border-red-300">
          <XCircleIcon className="h-3 w-3 mr-1" />
          Quality Failed
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
          <ClockIcon className="h-3 w-3 mr-1" />
          Inspection Pending
        </span>
      );
    }
  };

  const ReceiptStats = () => {
    // Soft-coded stats calculation with safe array handling
    const safeReceipts = Array.isArray(receipts) ? receipts : [];
    const stats = {
      total: safeReceipts.length,
      pending: safeReceipts.filter((r) => r?.status === "pending").length,
      accepted: safeReceipts.filter((r) => r?.status === "accepted").length,
      rejected: safeReceipts.filter((r) => r?.status === "rejected").length,
      qualityPassed: safeReceipts.filter(
        (r) => r?.quality_check_passed === true,
      ).length,
      qualityFailed: safeReceipts.filter(
        (r) => r?.quality_check_passed === false,
      ).length,
      ndtPending: safeReceipts.filter(
        (r) => r?.ndt_required && !r?.ndt_performed,
      ).length,
    };

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 mb-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-indigo-500 rounded-md p-3">
                <ArchiveBoxIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total GRs
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {stats.total}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                <ClockIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Pending
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {stats.pending}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                <CheckCircleIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Accepted
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {stats.accepted}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-red-500 rounded-md p-3">
                <XCircleIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Rejected
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {stats.rejected}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-[#00a896] rounded-md p-3">
                <ShieldCheckIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    QC Passed
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {stats.qualityPassed}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-orange-500 rounded-md p-3">
                <ExclamationTriangleIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    QC Failed
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {stats.qualityFailed}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                <BeakerIcon className="h-6 w-6 text-white" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    NDT Pending
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {stats.ndtPending}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={pageControls.styles.container}
    >
      <div className="py-6" style={pageControls.styles.content}>
        {/* Header */}
        <div
          className={`${LAYOUT_CONFIG.maxWidthDefault} mx-auto px-4 sm:px-6 lg:px-8`}
        >
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <ArchiveBoxIcon className="h-8 w-8 mr-3 text-indigo-600" />
                Goods Receipts
              </h1>
              <p className="mt-2 text-sm text-gray-600 flex items-center">
                <SparklesIcon className="h-4 w-4 mr-1 text-purple-500" />
                AI-powered receipt management with quality inspection and
                material traceability
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

        {/* Statistics */}
        <div
          className={`${LAYOUT_CONFIG.maxWidthDefault} mx-auto px-4 sm:px-6 lg:px-8 mt-8`}
        >
          <ReceiptStats />
        </div>

        {/* AI Insights */}
        {aiInsights && aiInsights.length > 0 && (
          <div
            className={`${LAYOUT_CONFIG.maxWidthDefault} mx-auto px-4 sm:px-6 lg:px-8 mt-6`}
          >
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-6 border-2 border-purple-200">
              <div className="flex items-center space-x-2 mb-4">
                <SparklesIcon className="h-6 w-6 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  AI Quality Insights & Alerts
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {aiInsights.map((insight, idx) => (
                  <div
                    key={idx}
                    className={`bg-white rounded-lg p-4 border-2 hover:shadow-md transition-shadow ${
                      insight.priority === "urgent"
                        ? "border-red-300"
                        : insight.priority === "high"
                          ? "border-yellow-300"
                          : insight.priority === "medium"
                            ? "border-orange-300"
                            : "border-purple-200"
                    }`}
                  >
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">
                      {insight.title}
                    </h4>
                    <p className="text-sm text-gray-600">{insight.message}</p>
                    {insight.percentage && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Target: 90%</span>
                          <span className="font-semibold text-indigo-600">
                            {insight.percentage}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${parseFloat(insight.percentage) >= 90 ? "bg-green-500" : parseFloat(insight.percentage) >= 80 ? "bg-yellow-500" : "bg-red-500"}`}
                            style={{
                              width: `${Math.min(parseFloat(insight.percentage), 100)}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Database confirmation */}
        {successMessage && (
          <div
            className={`${LAYOUT_CONFIG.maxWidthDefault} mx-auto mt-6 px-4 sm:px-6 lg:px-8`}
          >
            <div
              className="flex items-start rounded-md border-l-4 border-green-500 bg-green-50 p-4 text-green-800 shadow-sm"
              role="status"
              aria-live="polite"
            >
              <CheckCircleIcon className="mr-3 h-5 w-5 shrink-0 text-green-600" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Database confirmation</p>
                <p className="mt-1 text-sm">{successMessage}</p>
              </div>
              <button
                type="button"
                onClick={() => setSuccessMessage("")}
                className="ml-3 rounded p-1 hover:bg-green-100"
                aria-label="Dismiss confirmation"
              >
                <XCircleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div
            className={`${LAYOUT_CONFIG.maxWidthDefault} mx-auto px-4 sm:px-6 lg:px-8 mt-6`}
          >
            <div
              className={`rounded-md p-4 ${error.type === "auth" ? "bg-yellow-50 border-l-4 border-yellow-400" : "bg-red-50 border-l-4 border-red-400"}`}
            >
              <div className="flex">
                <div className="flex-shrink-0">
                  {error.type === "auth" ? (
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                  ) : (
                    <XCircleIcon className="h-5 w-5 text-red-400" />
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <p
                    className={`text-sm font-medium ${error.type === "auth" ? "text-yellow-800" : "text-red-800"}`}
                  >
                    {error.message}
                  </p>
                </div>
                <div className="ml-auto pl-3">
                  <div className="-mx-1.5 -my-1.5 flex">
                    {error.action && (
                      <button
                        type="button"
                        onClick={error.action}
                        className={`inline-flex rounded-md p-1.5 ${error.type === "auth" ? "text-yellow-800 hover:bg-yellow-100" : "text-red-800 hover:bg-red-100"} focus:outline-none`}
                      >
                        <ArrowPathIcon className="h-5 w-5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setError(null)}
                      className={`inline-flex rounded-md p-1.5 ml-2 ${error.type === "auth" ? "text-yellow-800 hover:bg-yellow-100" : "text-red-800 hover:bg-red-100"} focus:outline-none`}
                    >
                      <XCircleIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters and Search */}
        <div
          className={`${LAYOUT_CONFIG.maxWidthDefault} mx-auto px-4 sm:px-6 lg:px-8 mt-8`}
        >
          <div className="bg-white shadow rounded-lg p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {/* Search */}
              <div className="md:col-span-2">
                <label
                  htmlFor="search"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Search Goods Receipts
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
                    placeholder="Search by GR or PO number..."
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <label
                  htmlFor="status"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Status
                </label>
                <select
                  id="status"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                  <option value="partial">Partial</option>
                </select>
              </div>

              {/* Quality Filter */}
              <div>
                <label
                  htmlFor="quality"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Quality Check
                </label>
                <select
                  id="quality"
                  value={filterQuality}
                  onChange={(e) => setFilterQuality(e.target.value)}
                  className="block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="all">All Quality</option>
                  <option value="passed">✓ Passed</option>
                  <option value="failed">✗ Failed</option>
                  <option value="pending">⏱ Pending</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-500">
                {filteredReceipts.length > 0
                  ? `Showing ${pageStart + 1}-${Math.min(pageStart + pageSize, filteredReceipts.length)} of ${filteredReceipts.length}`
                  : "Showing 0"}{" "}
                goods receipts
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="inline-flex rounded-lg border border-gray-300 bg-white p-1"
                  aria-label="Receipt view"
                >
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm ${viewMode === "grid" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                    aria-pressed={viewMode === "grid"}
                  >
                    <Squares2X2Icon className="h-4 w-4" /> Grid
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm ${viewMode === "list" ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                    aria-pressed={viewMode === "list"}
                  >
                    <ListBulletIcon className="h-4 w-4" /> List
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAICreator(true)}
                  className="inline-flex items-center rounded-md bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:from-indigo-700 hover:to-purple-700"
                >
                  <SparklesIcon className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Record Goods Receipt
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Receipts List */}
        <div
          className={`${LAYOUT_CONFIG.maxWidthDefault} mx-auto px-4 sm:px-6 lg:px-8 mt-8`}
        >
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              <p className="mt-4 text-sm text-gray-500">
                Loading goods receipts...
              </p>
            </div>
          ) : filteredReceipts.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <ArchiveBoxIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No goods receipts found
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || filterStatus !== "all" || filterQuality !== "all"
                  ? "Try adjusting your search or filter criteria."
                  : "Get started by recording a new goods receipt."}
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setShowAICreator(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <SparklesIcon className="-ml-1 mr-2 h-5 w-5" />
                  Record with AI Quality Check
                </button>
              </div>
            </div>
          ) : viewMode === "grid" ? (
            <div
              className={`grid grid-cols-1 gap-6 ${LAYOUT_CONFIG.cardGridCols.sm} ${LAYOUT_CONFIG.cardGridCols.lg} ${LAYOUT_CONFIG.cardGridCols.xl}`}
            >
              {paginatedReceipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className="bg-white overflow-hidden shadow-lg rounded-lg hover:shadow-xl transition-shadow duration-200 border-2 border-transparent hover:border-indigo-500"
                >
                  <div className="p-6">
                    {/* Receipt Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <ArchiveBoxIcon className="h-5 w-5 text-indigo-600" />
                          <h3 className="text-lg font-semibold text-gray-900">
                            {receipt.receipt_number || `GR-${receipt.id}`}
                          </h3>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                          PO: {receipt.po_number || "N/A"}
                        </p>
                      </div>
                      {getStatusBadge(receipt.status)}
                    </div>

                    {/* Quality Badge */}
                    <div className="mb-4">{getQualityBadge(receipt)}</div>

                    {/* Receipt Details */}
                    <div className="space-y-3">
                      {receipt.receipt_date && (
                        <div className="flex items-center text-sm text-gray-600">
                          <CalendarIcon className="h-4 w-4 mr-2 text-gray-400" />
                          <span>
                            Received:{" "}
                            {new Date(
                              receipt.receipt_date,
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {receipt.inspector_name && (
                        <div className="flex items-center text-sm text-gray-600">
                          <UserGroupIcon className="h-4 w-4 mr-2 text-gray-400" />
                          <span>Inspector: {receipt.inspector_name}</span>
                        </div>
                      )}
                      {receipt.certificates_received &&
                        receipt.certificates_received.length > 0 && (
                          <div className="flex items-start text-sm text-gray-600">
                            <DocumentCheckIcon className="h-4 w-4 mr-2 text-gray-400 mt-0.5" />
                            <span className="text-xs">
                              {receipt.certificates_received.length} Certificate
                              {receipt.certificates_received.length > 1
                                ? "s"
                                : ""}
                            </span>
                          </div>
                        )}
                    </div>

                    {/* Quality Indicators */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div
                          className={`text-center p-2 rounded ${receipt.dimensional_check_passed ? "bg-green-50 text-green-700" : receipt.dimensional_check_passed === false ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-600"}`}
                        >
                          <div className="font-medium">Dimensional</div>
                          <div>
                            {receipt.dimensional_check_passed === true
                              ? "✓"
                              : receipt.dimensional_check_passed === false
                                ? "✗"
                                : "—"}
                          </div>
                        </div>
                        <div
                          className={`text-center p-2 rounded ${receipt.visual_inspection_passed ? "bg-green-50 text-green-700" : receipt.visual_inspection_passed === false ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-600"}`}
                        >
                          <div className="font-medium">Visual</div>
                          <div>
                            {receipt.visual_inspection_passed === true
                              ? "✓"
                              : receipt.visual_inspection_passed === false
                                ? "✗"
                                : "—"}
                          </div>
                        </div>
                        <div
                          className={`text-center p-2 rounded ${receipt.material_verification_passed ? "bg-green-50 text-green-700" : receipt.material_verification_passed === false ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-600"}`}
                        >
                          <div className="font-medium">Material</div>
                          <div>
                            {receipt.material_verification_passed === true
                              ? "✓"
                              : receipt.material_verification_passed === false
                                ? "✗"
                                : "—"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-6 flex space-x-3">
                      <button
                        onClick={() => setSelectedReceipt(receipt)}
                        className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        View Details
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrintReceipt(receipt)}
                        className="rounded-md border border-gray-300 p-2 text-gray-600 hover:bg-gray-50"
                        title="Print preview"
                        aria-label={`Print ${receipt.receipt_number}`}
                      >
                        <PrinterIcon className="h-4 w-4" />
                      </button>
                      {receipt.status === "draft" && (
                        <button
                          disabled={actionReceiptId === receipt.id}
                          onClick={() => runReceiptAction(receipt, "submit")}
                          className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                          Submit
                        </button>
                      )}
                      {receipt.status === "pending" && (
                        <button
                          disabled={actionReceiptId === receipt.id}
                          onClick={() => runReceiptAction(receipt, "accept")}
                          className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                          <CheckCircleIcon className="h-4 w-4 mr-1" />
                          Accept
                        </button>
                      )}
                      {receipt.status === "pending" && (
                        <button
                          disabled={actionReceiptId === receipt.id}
                          onClick={() => handleRejectReceipt(receipt)}
                          className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                          title="Reject delivery"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    <tr>
                      <th className="px-4 py-3">GR Number</th>
                      <th className="px-4 py-3">Purchase Order</th>
                      <th className="px-4 py-3">Receipt Date</th>
                      <th className="px-4 py-3">Delivery Note</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Quality</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {paginatedReceipts.map((receipt) => (
                      <tr key={receipt.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-gray-900">
                          <button
                            type="button"
                            onClick={() => setSelectedReceipt(receipt)}
                            className="inline-flex items-center gap-2 text-left hover:text-indigo-700"
                          >
                            <ArchiveBoxIcon className="h-4 w-4 text-indigo-600" />
                            {receipt.receipt_number || `GR-${receipt.id}`}
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                          {receipt.po_number || "N/A"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                          {receipt.receipt_date
                            ? new Date(
                                receipt.receipt_date,
                              ).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {receipt.delivery_note_number || "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {getStatusBadge(receipt.status)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {getQualityBadge(receipt)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedReceipt(receipt)}
                              className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => setPrintReceipt(receipt)}
                              className="rounded-md border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50"
                              title="Print preview"
                              aria-label={`Print ${receipt.receipt_number}`}
                            >
                              <PrinterIcon className="h-4 w-4" />
                            </button>
                            {receipt.status === "draft" && (
                              <button
                                type="button"
                                disabled={actionReceiptId === receipt.id}
                                onClick={() =>
                                  runReceiptAction(receipt, "submit")
                                }
                                className="rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                              >
                                Submit
                              </button>
                            )}
                            {receipt.status === "pending" && (
                              <button
                                type="button"
                                disabled={actionReceiptId === receipt.id}
                                onClick={() =>
                                  runReceiptAction(receipt, "accept")
                                }
                                className="rounded-md bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                              >
                                Accept
                              </button>
                            )}
                            {receipt.status === "pending" && (
                              <button
                                type="button"
                                disabled={actionReceiptId === receipt.id}
                                onClick={() => handleRejectReceipt(receipt)}
                                className="rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && filteredReceipts.length > 0 && (
            <div className="mt-6 flex flex-col gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <label htmlFor="receipt-page-size">Rows per page</label>
                <select
                  id="receipt-page-size"
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                  <option value={48}>48</option>
                </select>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="inline-flex gap-1">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                    className="rounded-md border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                  </button>
                  {visiblePageNumbers.map((page, index) => (
                    <React.Fragment key={page}>
                      {index > 0 &&
                        page - visiblePageNumbers[index - 1] > 1 && (
                          <span className="px-1 py-2 text-sm text-gray-400">
                            …
                          </span>
                        )}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`min-w-9 rounded-md border px-2 py-1.5 text-sm ${currentPage === page ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
                        aria-label={`Go to page ${page}`}
                        aria-current={currentPage === page ? "page" : undefined}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  ))}
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                    }
                    className="rounded-md border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Next page"
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Receipt Creator Modal */}
      <AIReceiptCreator
        isOpen={showAICreator}
        onClose={() => setShowAICreator(false)}
        onReceiptCreated={handleReceiptCreated}
        orders={orders}
      />

      {selectedReceipt && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedReceipt.receipt_number}
                </h2>
                <p className="text-sm text-gray-500">
                  PO {selectedReceipt.po_number}
                </p>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="rounded p-1 hover:bg-gray-100"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="mt-5 overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="p-3">PO line</th>
                    <th className="p-3 text-right">Delivered</th>
                    <th className="p-3 text-right">Accepted</th>
                    <th className="p-3 text-right">Rejected</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedReceipt.lines || []).map((line) => (
                    <tr key={line.id} className="border-t border-gray-100">
                      <td className="p-3">
                        <span className="font-medium">
                          {line.line_number}. {line.description}
                        </span>
                        <span className="ml-2 text-xs text-gray-500">
                          {line.unit_of_measure}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {line.delivered_quantity}
                      </td>
                      <td className="p-3 text-right text-green-700">
                        {line.accepted_quantity}
                      </td>
                      <td className="p-3 text-right text-red-700">
                        {line.rejected_quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-gray-500">Delivery note</dt>
                <dd className="font-medium">
                  {selectedReceipt.delivery_note_number || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Inspector</dt>
                <dd className="font-medium">
                  {selectedReceipt.inspector_name || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Status</dt>
                <dd className="font-medium">
                  {selectedReceipt.status_display || selectedReceipt.status}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Receipt date</dt>
                <dd className="font-medium">{selectedReceipt.receipt_date}</dd>
              </div>
            </dl>
            <div className="mt-6 flex justify-end gap-2 border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => setPrintReceipt(selectedReceipt)}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <PrinterIcon className="h-4 w-4" />
                Print Preview
              </button>
            </div>
          </div>
        </div>
      )}
      <GoodsReceiptPrintPreview
        receipt={printReceipt}
        onClose={() => setPrintReceipt(null)}
      />
    </div>
  );
};

export default ReceiptManagement;
