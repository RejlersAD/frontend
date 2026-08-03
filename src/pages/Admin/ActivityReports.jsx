/**
 * Activity Reports — Admin dashboard for user engagement analytics
 * ==============================================================
 *
 * SuperAdmin (tanzeem.agra@rejlers.ae) can view:
 * - Summary: aggregate platform metrics
 * - By User: per-user activity ranking
 * - By Feature: feature adoption heatmap
 * - Daily: activity trend by day
 * - Export: CSV download in all formats
 *
 * All time windows, metrics, and UI configs are soft-coded.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  ChartBarIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  SparklesIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import analyticsService from '../../services/analyticsService';
import { isUserAdmin } from '../../utils/rbac.utils';

// ---------------------------------------------------------------------------
// Soft-coded UI config
// ---------------------------------------------------------------------------
const REPORT_TYPES = [
  { id: 'summary', label: 'Summary', icon: ChartBarIcon, description: 'Aggregate platform metrics' },
  { id: 'by-user', label: 'By User', icon: UserGroupIcon, description: 'Per-user activity ranking' },
  { id: 'by-feature', label: 'By Feature', icon: SparklesIcon, description: 'Feature adoption' },
  { id: 'daily', label: 'Daily', icon: CalendarDaysIcon, description: 'Daily trend' },
];

const TIME_WINDOWS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'quarter', label: 'This Quarter' },
  { id: 'ytd', label: 'Year to Date' },
];

const REFRESH_INTERVAL_MS = 300_000;  // 5 min
const REPORT_LIMIT = 100;

// Metric color coding (USD / actions / pct)
const metricColor = (key, value) => {
  if (key.includes('cost') && value >= 100) return 'text-rose-600 font-semibold';
  if (key.includes('cost') && value > 0) return 'text-amber-600';
  if (key.includes('rate') && value < 80) return 'text-orange-600';
  if (key.includes('rate')) return 'text-emerald-600';
  return 'text-slate-700';
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const ActivityReports = () => {
  const navigate = useNavigate();
  const authUser = useSelector((s) => s.auth?.user);
  const rbacRoles = useSelector((s) => s.rbac?.userRoles || []);

  const [reportType, setReportType] = useState('summary');
  const [window, setWindow] = useState('month');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [limit, setLimit] = useState(50);

  const isAdmin = useMemo(() => {
    if (isUserAdmin && isUserAdmin(authUser)) return true;
    const adminRoles = ['super_admin', 'admin'];
    return Array.isArray(rbacRoles) && rbacRoles.some((r) => adminRoles.includes(r?.role_code || r?.code || r));
  }, [authUser, rbacRoles]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      let data;
      switch (reportType) {
        case 'by-user':
          data = await analyticsService.getActivityByUser(window, limit);
          break;
        case 'by-feature':
          data = await analyticsService.getActivityByFeature(window);
          break;
        case 'daily':
          data = await analyticsService.getActivityDaily(window);
          break;
        case 'summary':
        default:
          data = await analyticsService.getActivitySummary(window);
      }
      setReport(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [reportType, window, limit]);

  useEffect(() => {
    if (!isAdmin) return;
    load(false);
    const id = setInterval(() => load(true), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isAdmin, load]);

  const handleExport = async () => {
    try {
      const format = reportType === 'summary' ? 'user' : reportType.replace('by-', '');
      const blob = await analyticsService.exportActivityReportCSV(window, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-report-${format}-${window}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Export failed: ' + (err?.message || 'unknown'));
    }
  };

  // Guard
  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md">
          <ChartBarIcon className="w-12 h-12 mx-auto text-slate-400 mb-3" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Admin Access Required</h2>
          <p className="text-slate-600 mb-4">Activity reports are restricted to administrators.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentType = REPORT_TYPES.find((t) => t.id === reportType) || REPORT_TYPES[0];
  const CurrentIcon = currentType.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center shadow-lg">
                <ChartBarIcon className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Activity Reports
              </h1>
            </div>
            <p className="text-slate-600 text-sm">
              Comprehensive user engagement analytics · Weekly & monthly breakdowns
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {TIME_WINDOWS.map((w) => (
              <button
                key={w.id}
                onClick={() => setWindow(w.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                  window === w.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Report Type Selector */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {REPORT_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.id}
                onClick={() => setReportType(type.id)}
                className={`p-4 rounded-xl border-2 transition flex flex-col items-start gap-2 ${
                  reportType === type.id
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <Icon className={`w-6 h-6 ${reportType === type.id ? 'text-blue-600' : 'text-slate-400'}`} />
                <div className="text-left">
                  <div className="font-semibold text-slate-900 text-sm">{type.label}</div>
                  <div className="text-xs text-slate-500">{type.description}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap bg-white rounded-lg p-4 shadow-sm border border-slate-200">
          {reportType === 'by-user' && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Limit:</label>
              <input
                type="number"
                min="1"
                max="500"
                value={limit}
                onChange={(e) => setLimit(Math.max(1, Math.min(500, parseInt(e.target.value) || 50)))}
                className="w-16 px-2 py-1 border border-slate-300 rounded text-sm"
              />
            </div>
          )}
          <div className="flex-1"></div>
          <button
            onClick={() => load(true)}
            disabled={loading}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 hover:border-slate-400 flex items-center gap-1.5 disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1.5"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {/* Report Content */}
        {loading && !report && (
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
              <p className="text-slate-600">Loading report...</p>
            </div>
          </div>
        )}

        {report && !loading && (
          <>
            {/* Summary Report */}
            {reportType === 'summary' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.metrics && (
                  <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <h3 className="font-semibold text-slate-900 mb-4">Platform Metrics</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Total Actions</span>
                        <span className="font-semibold text-slate-900">{report.metrics.total_actions?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">AI Requests</span>
                        <span className="font-semibold text-slate-900">{report.metrics.total_ai_requests?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">AI Cost</span>
                        <span className={`font-semibold ${metricColor('cost', report.metrics.total_ai_cost_usd)}`}>
                          ${report.metrics.total_ai_cost_usd?.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Features Used</span>
                        <span className="font-semibold text-slate-900">{report.metrics.distinct_features}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Session Time</span>
                        <span className="font-semibold text-slate-900">{report.metrics.session_minutes?.toLocaleString()} min</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Success Rate</span>
                        <span className={`font-semibold ${metricColor('rate', report.metrics.success_rate_pct)}`}>
                          {report.metrics.success_rate_pct?.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {report.cohort && (
                  <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <h3 className="font-semibold text-slate-900 mb-4">Cohort Stats</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Active Users</span>
                        <span className="font-semibold text-slate-900">{report.cohort.active_users?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Avg Actions/User</span>
                        <span className="font-semibold text-slate-900">{report.cohort.avg_actions_per_user?.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">AI Adoption Rate</span>
                        <span className="font-semibold text-emerald-600">{report.cohort.ai_adoption_rate_pct?.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* User Report Table */}
            {reportType === 'by-user' && report.results && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">#</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">User</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Actions</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">AI Requests</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">AI Cost</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Features</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Success %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {report.results.slice(0, limit).map((row) => (
                        <tr key={row.user.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2 text-sm font-semibold text-slate-700">{row.rank}</td>
                          <td className="px-4 py-2 text-sm">
                            <div className="font-medium text-slate-900">{row.user.name}</div>
                            <div className="text-xs text-slate-500">{row.user.email}</div>
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-slate-900 font-medium">
                            {row.metrics.total_actions?.toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-slate-900">
                            {row.metrics.total_ai_requests?.toLocaleString()}
                          </td>
                          <td className={`px-4 py-2 text-sm text-right font-semibold ${metricColor('cost', row.metrics.total_ai_cost_usd)}`}>
                            ${row.metrics.total_ai_cost_usd?.toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-slate-900">
                            {row.metrics.distinct_features}
                          </td>
                          <td className={`px-4 py-2 text-sm text-right font-semibold ${metricColor('rate', row.metrics.success_rate_pct)}`}>
                            {row.metrics.success_rate_pct?.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Feature Report Table */}
            {reportType === 'by-feature' && report.results && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Feature</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Module</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Actions</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Users</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Session (min)</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Success %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {report.results.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-2 text-sm font-medium text-slate-900">{row.feature}</td>
                          <td className="px-4 py-2 text-sm text-slate-600">{row.module}</td>
                          <td className="px-4 py-2 text-sm text-right text-slate-900 font-medium">
                            {row.metrics.total_actions?.toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-slate-900">
                            {row.metrics.distinct_users}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-slate-900">
                            {row.metrics.session_minutes}
                          </td>
                          <td className={`px-4 py-2 text-sm text-right font-semibold ${metricColor('rate', row.metrics.success_rate_pct)}`}>
                            {row.metrics.success_rate_pct?.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Daily Report Chart (simple table) */}
            {reportType === 'daily' && report.results && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Date</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Actions</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">AI Requests</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">AI Cost</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Features</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Success %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {report.results.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-2 text-sm font-medium text-slate-900">{row.date}</td>
                          <td className="px-4 py-2 text-sm text-right text-slate-900">
                            {row.metrics.total_actions?.toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-slate-900">
                            {row.metrics.total_ai_requests?.toLocaleString()}
                          </td>
                          <td className={`px-4 py-2 text-sm text-right font-semibold ${metricColor('cost', row.metrics.total_ai_cost_usd)}`}>
                            ${row.metrics.total_ai_cost_usd?.toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-sm text-right text-slate-900">
                            {row.metrics.distinct_features}
                          </td>
                          <td className={`px-4 py-2 text-sm text-right font-semibold ${metricColor('rate', row.metrics.success_rate_pct)}`}>
                            {row.metrics.success_rate_pct?.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Last Updated */}
            {lastUpdated && (
              <div className="text-xs text-slate-500 text-right">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ActivityReports;
