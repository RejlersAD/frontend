import React, { useState, useEffect, useCallback, useRef } from "react";
import { ClipboardList, Clock3, AlertCircle } from "lucide-react";
import "./AuditLogsTab.css";
import rbacService from "../../services/rbac.service";

/**
 * Audit Logs Tab - Comprehensive system audit trail viewer
 * Displays all user actions, system events, and changes with filtering
 */
const AuditLogsTab = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const [selectedLog, setSelectedLog] = useState(null);
  const selectedResourceId = selectedLog?.resource_id ?? selectedLog?.metadata?.target_id;
  const hasResourceId = selectedResourceId !== null && selectedResourceId !== undefined && selectedResourceId !== "";
  const detailsRef = useRef(null);
  const detailsTrigger = useRef(null);
  useEffect(() => {
    if (selectedLog) detailsRef.current?.showModal();
  }, [selectedLog]);
  const [filters, setFilters] = useState({
    action: "all",
    resource_type: "all",
    success: "all",
    search: "",
    scope: "all",
    page: 1,
    page_size: 20,
  });
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    failed: 0,
  });

  const [total, setTotal] = useState(0);
  const [auditTimezone, setAuditTimezone] = useState("");
  const totalPages = Math.max(1, Math.ceil(total / filters.page_size));
  const pageNumbers = [...new Set([1, ...Array.from({ length: 5 }, (_, i) => filters.page + i - 2), totalPages])].filter(page => page >= 1 && page <= totalPages).sort((a, b) => a - b);

  // Soft-coded action types configuration
  const ACTION_TYPES = [
    { value: "all", label: "All Actions", icon: "📋", color: "gray" },
    { value: "login", label: "Login", icon: "🔐", color: "blue" },
    { value: "logout", label: "Logout", icon: "🚪", color: "indigo" },
    { value: "create", label: "Create", icon: "➕", color: "green" },
    { value: "read", label: "Read", icon: "👁️", color: "cyan" },
    { value: "update", label: "Update", icon: "✏️", color: "yellow" },
    { value: "delete", label: "Delete", icon: "🗑️", color: "red" },
    { value: "file_upload", label: "File Upload", icon: "📤", color: "purple" },
    {
      value: "file_download",
      label: "File Download",
      icon: "📥",
      color: "teal",
    },
    { value: "role_assign", label: "Role Assign", icon: "👤", color: "pink" },
    {
      value: "permission_grant",
      label: "Permission Grant",
      icon: "✅",
      color: "emerald",
    },
  ];

  const RESOURCE_TYPES = [
    { value: "all", label: "All Resources" },
    { value: "UserProfile", label: "User Profile" },
    { value: "Role", label: "Roles" },
    { value: "Permission", label: "Permissions" },
    { value: "Module", label: "Modules" },
    { value: "Invoice", label: "Invoices" },
    { value: "PIDDrawing", label: "P&ID Drawings" },
    { value: "UserStorage", label: "Files" },
  ];

  const loadAuditLogs = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      // "all" is a UI option, not an API filter value.
      const params = {
        page: filters.page,
        page_size: filters.page_size,
        ...(filters.scope !== "all" && { scope: filters.scope }),
        ...(filters.search.trim() && { search: filters.search.trim() }),
        ...(filters.action !== "all" && { action: filters.action }),
        ...(filters.resource_type !== "all" && {
          resource_type: filters.resource_type,
        }),
        ...(filters.success !== "all" && {
          success: filters.success === "true",
        }),
      };
      const response = await rbacService.getAuditLogs(params);
      if (id !== requestId.current) return;
      const payload = response.data;
      const rows = Array.isArray(payload) ? payload : payload?.results;
      if (!Array.isArray(rows)) throw new Error("Invalid audit log response");
      setLogs(rows);
      setTotal(payload.count ?? rows.length);
      if (!payload.summary || !["total", "today", "failed"].every(key => Number.isFinite(payload.summary[key]))) {
        throw new Error("Audit summary unavailable. The backend needs the latest Audit update.");
      }
      setStats(payload.summary);
      setAuditTimezone(payload.timezone || "");
    } catch (loadError) {
      if (id !== requestId.current) return;
      console.error("Failed to load audit logs:", loadError);
      setLogs([]);
      setTotal(0);
      setStats({ total: 0, today: 0, failed: 0 });
      setError(loadError.message.startsWith("Audit summary unavailable") ? loadError.message : "Could not load audit logs. Change a filter or reopen this tab to try again.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadAuditLogs();
    return () => {
      requestId.current += 1;
    };
  }, [loadAuditLogs]);

  const getActionBadge = (action) => {
    const actionType = ACTION_TYPES.find((a) => a.value === action) || {
      label: action?.replaceAll("_", " ") || "Unknown action",
      icon: "",
      color: "gray",
    };
    const colorMap = {
      gray: "bg-gray-100 text-gray-800",
      blue: "bg-blue-100 text-blue-800",
      indigo: "bg-indigo-100 text-indigo-800",
      green: "bg-green-100 text-green-800",
      cyan: "bg-cyan-100 text-cyan-800",
      yellow: "bg-yellow-100 text-yellow-800",
      red: "bg-red-100 text-red-800",
      purple: "bg-purple-100 text-purple-800",
      teal: "bg-teal-100 text-teal-800",
      pink: "bg-pink-100 text-pink-800",
      emerald: "bg-emerald-100 text-emerald-800",
    };

    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-semibold ${colorMap[actionType.color]}`}
      >
        {actionType.icon} {actionType.label}
      </span>
    );
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

    return date.toLocaleString();
  };

  return (
    <div className="audit-tab">
      {error && (
        <div
          role="alert"
          className="p-4 border border-red-200 rounded-lg text-red-700 bg-red-50"
        >
          {error}
        </div>
      )}

      <div className="audit-cards" aria-label="Audit quick filters" aria-busy={loading}>
        {[
          { scope: "all", label: "Total Logs", key: "total", Icon: ClipboardList, tone: "blue" },
          { scope: "today", label: "Today", key: "today", Icon: Clock3, tone: "green" },
          { scope: "failed", label: "Failed Actions", key: "failed", Icon: AlertCircle, tone: "red" },
        ].map(({ scope, label, key, Icon, tone }) => (
          <button key={scope} type="button" className={`audit-card ${tone}`} aria-pressed={filters.scope === scope}
            onClick={() => setFilters({ ...filters, scope, page: 1 })}>
            <span className="audit-card-icon"><Icon size={24} aria-hidden="true" /></span>
            <span className="audit-card-copy"><span className="audit-card-label">{label}</span>
              <strong className="audit-card-value">{loading ? "Loading?" : error ? "Unavailable" : stats[key].toLocaleString()}</strong>
              <span className="audit-card-hint">{scope === filters.scope ? "Selected" : "View logs"}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="audit-filter-summary">
        <p aria-live="polite">{filters.scope === "today" ? `Today's logs${auditTimezone ? ` (${auditTimezone})` : ""}` : filters.scope === "failed" ? "Failed actions" : "All logs"}<span aria-hidden="true"> / </span>Counts include all matching results.</p>
        <button type="button" onClick={() => setFilters({ action: "all", resource_type: "all", success: "all", search: "", scope: "all", page: 1, page_size: filters.page_size })}>Clear filters</button>
      </div>
      {/* Filters */}
      <div className="audit-filter-panel">
                <div className="audit-filter-grid">
          {/* Action Filter */}
          <div>
            <label
              htmlFor="audit-action"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Action Type
            </label>
            <select
              id="audit-action"
              value={filters.action}
              onChange={(e) =>
                setFilters({ ...filters, action: e.target.value, page: 1 })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {ACTION_TYPES.map((action) => (
                <option key={action.value} value={action.value}>
                  {action.icon} {action.label}
                </option>
              ))}
            </select>
          </div>

          {/* Resource Type Filter */}
          <div>
            <label
              htmlFor="audit-resource_type"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Resource Type
            </label>
            <select
              id="audit-resource_type"
              value={filters.resource_type}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  resource_type: e.target.value,
                  page: 1,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {RESOURCE_TYPES.map((resource) => (
                <option key={resource.value} value={resource.value}>
                  {resource.label}
                </option>
              ))}
            </select>
          </div>

          {/* Success Filter */}
          <div>
            <label
              htmlFor="audit-success"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Status
            </label>
            <select
              id="audit-success"
              value={filters.success}
              onChange={(e) =>
                setFilters({ ...filters, success: e.target.value, page: 1 })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="true">✅ Success</option>
              <option value="false">❌ Failed</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <label htmlFor="audit-search" className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <input
              id="audit-search"
              type="text"
              placeholder="User, action, resource..."
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value, page: 1 })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <p className="mt-4 text-gray-600">Loading audit logs...</p>
          </div>
        ) : error ? null : logs.length === 0 ? (
          <div className="p-12 text-center">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-lg font-semibold text-gray-900">
              No Audit Logs Found
            </p>
            <p className="text-gray-600 mt-2">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Resource
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log, index) => (
                  <tr
                    key={log.id || index}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatTimestamp(log.timestamp)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {log.user_email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {log.resource_type}
                      </div>
                      {(log.resource_repr || log.resource_name) && (
                        <div className="text-xs text-gray-500">
                          {log.resource_repr || log.resource_name}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600 font-mono">
                        {log.ip_address || "N/A"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.success ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          ✅ Success
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          ❌ Failed
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {(
                        <button type="button" aria-label={`View details for ${log.user_email}`} onClick={(event) => { detailsTrigger.current = event.currentTarget; setSelectedLog(log); }} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                          View →
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <dialog ref={detailsRef} aria-labelledby="audit-details-title" onClose={() => { setSelectedLog(null); detailsTrigger.current?.focus(); }}
        onClick={event => { if (event.target === event.currentTarget) detailsRef.current.close(); }}
        className="w-[calc(100%-32px)] max-w-xl max-h-[85vh] overflow-y-auto rounded-lg border border-gray-200 p-4 shadow-sm backdrop:bg-slate-900/30">
        {selectedLog && <>
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 id="audit-details-title" className="text-base font-semibold text-gray-900">Audit details</h2>
            <button type="button" autoFocus onClick={() => detailsRef.current.close()} className="px-3 py-2 border rounded-md text-sm font-semibold">Close</button>
          </div>
          <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm text-gray-700">
            {[
              ["Actor", selectedLog.user_email || "Unknown"],
              ["Action", selectedLog.action?.replaceAll("_", " ") || "Unknown"],
              ["Target", selectedLog.resource_repr || selectedLog.resource_name || selectedLog.resource_type || "Not recorded"],
              ["Resource ID", hasResourceId ? String(selectedResourceId) : "No target ID saved for this event"],
              ["Time", new Date(selectedLog.timestamp).toLocaleString()],
              ["Outcome", selectedLog.success ? "Success" : "Failed"],
              ["IP address", selectedLog.ip_address || "Not recorded"],
              ...(selectedLog.error_message ? [["Error", selectedLog.error_message]] : []),
            ].map(([label, value]) => <React.Fragment key={label}><dt className="font-semibold">{label}</dt><dd className="break-words">{value}</dd></React.Fragment>)}
          </dl>
          {!hasResourceId && <p className="mt-3 text-xs text-gray-500">This audit entry does not contain a target ID. Some events apply to a session or multiple resources; older entries may not have captured an ID.</p>}
          {[ ["Changes", selectedLog.changes], ["Metadata", selectedLog.metadata] ].map(([label, value]) => (
            <details key={label} className="mt-4 border rounded-md p-3">
              <summary className="cursor-pointer text-sm font-semibold">{label}</summary>
              <pre className="mt-2 text-xs whitespace-pre-wrap break-words max-h-60 overflow-auto">{value && Object.keys(value).length ? JSON.stringify(value, null, 2) : "Not recorded"}</pre>
            </details>
          ))}
        </>}
      </dialog>

      {/* Pagination */}
      {!error && (
        <nav aria-label="Audit log pagination" className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-sm text-gray-700" aria-live="polite">
              Showing {total ? (filters.page - 1) * filters.page_size + 1 : 0} to {Math.min(filters.page * filters.page_size, total)} of {total} results
            </p>
            <label className="text-sm text-gray-700">Rows per page
              <select className="ml-2 border border-gray-300 rounded-md px-2 py-2" value={filters.page_size} disabled={loading}
                onChange={e => setFilters({ ...filters, page_size: Number(e.target.value), page: 1 })}>
                {[10, 20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setFilters({ ...filters, page: filters.page - 1 })} disabled={loading || filters.page === 1}
              className="px-3 py-2 border rounded-md text-sm disabled:opacity-50">Previous</button>
            {pageNumbers.map((page, index) => <React.Fragment key={page}>
              {index > 0 && page - pageNumbers[index - 1] > 1 && <span aria-hidden="true">?</span>}
              <button type="button" aria-label={`Page ${page}`} aria-current={filters.page === page ? "page" : undefined}
                disabled={loading} onClick={() => setFilters({ ...filters, page })}
                className={`px-3 py-2 border rounded-md text-sm ${filters.page === page ? "bg-blue-600 text-white border-blue-600" : "text-gray-700"}`}>{page}</button>
            </React.Fragment>)}
            <button type="button" onClick={() => setFilters({ ...filters, page: filters.page + 1 })} disabled={loading || filters.page >= totalPages}
              className="px-3 py-2 border rounded-md text-sm disabled:opacity-50">Next</button>
          </div>
        </nav>
      )}
    </div>
  );
};

export default AuditLogsTab;
