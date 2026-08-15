import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../../../config/api.config';
import { ROUTES } from '../../../config/routes.config';
import {
  ArrowLeft, Download, Loader, RefreshCw, Search,
  CheckCircle2, XCircle, PlusCircle, AlertTriangle, FileSpreadsheet, FileText,
} from 'lucide-react';

// ═════════════════════════════════════════════════════════════════════════════
// P&ID Verification V2 — Comparison Report
// Simple, standalone 5-tab results page: General + one tab per reference-data
// comparison pair (Legend / Line List / Equipment List / Instrument Index).
// Reuses the existing GET /results/<document_id>/ endpoint — no new backend
// read endpoint needed. Export buttons hit the existing export endpoints with
// a new `?view=` query param (see backend export_service.COMPARISON_VIEWS).
// ═════════════════════════════════════════════════════════════════════════════

const getV2ApiBase = () => {
  if (API_BASE_URL.includes('/v1')) return API_BASE_URL.replace('/v1', '/v2');
  return `${API_BASE_URL}/v2`;
};
const API_PREFIX = `${getV2ApiBase()}/pid-verification`;

const authHeader = () => {
  const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Soft-coded: one entry per report page/tab. `categories` maps 1:1 to the
// PIDVFinding.category values persisted by the comparison engine and to the
// backend's export_service.COMPARISON_VIEWS keys — keep these in sync.
const REPORT_TABS = [
  {
    key: 'general', label: 'General Summary', shortLabel: 'General',
    categories: ['legend', 'linelist', 'equipment', 'instrument'],
    description: 'Combined cross-reference results across all four comparisons: Legend, Line List, Equipment List and Instrument Index.',
  },
  {
    key: 'legend', label: 'P&ID vs Legend', shortLabel: 'Legend',
    categories: ['legend'],
    description: 'Symbols and tags found on the P&ID compared against the uploaded Legend sheet.',
  },
  {
    key: 'linelist', label: 'P&ID vs Line List', shortLabel: 'Line List',
    categories: ['linelist'],
    description: 'Piping line numbers found on the P&ID compared against the uploaded Line List.',
  },
  {
    key: 'equipment', label: 'P&ID vs Equipment List', shortLabel: 'Equipment List',
    categories: ['equipment'],
    description: 'Equipment tags found on the P&ID compared against the uploaded Equipment List.',
  },
  {
    key: 'instrument', label: 'P&ID vs Instrument Index', shortLabel: 'Instrument Index',
    categories: ['instrument'],
    description: 'Instrument tags found on the P&ID compared against the uploaded Instrument Index.',
  },
];

const CATEGORY_LABELS = {
  legend: 'Legend', linelist: 'Line List', equipment: 'Equipment', instrument: 'Instrument',
};

// Discrepancy type is soft-coded via the rule_id suffix convention used by the
// comparison engine: 001 = missing, 002 = extra, 003 = mismatch (tasks.py).
const DISCREPANCY_SUFFIX = { missing: '001', extra: '002', mismatch: '003' };

const STAT_CARDS = [
  { key: 'matched', label: 'Matched', icon: CheckCircle2, color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
  { key: 'missing', label: 'Missing (in ref, not on P&ID)', icon: XCircle, color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  { key: 'extra', label: 'Extra (on P&ID, not in ref)', icon: PlusCircle, color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { key: 'mismatch', label: 'Mismatch', icon: AlertTriangle, color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA' },
];

const SEVERITY_STYLES = {
  critical: { bg: '#FEE2E2', text: '#991B1B', dot: '#DC2626' },
  major: { bg: '#FFEDD5', text: '#9A3412', dot: '#EA580C' },
  minor: { bg: '#FEF9C3', text: '#854D0E', dot: '#CA8A04' },
  info: { bg: '#DBEAFE', text: '#1E40AF', dot: '#2563EB' },
};

export default function PIDVerificationV2Report() {
  const { documentId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [doc, setDoc] = useState(null);
  const [activeTab, setActiveTab] = useState('general');
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [downloading, setDownloading] = useState({ excel: false, pdf: false });

  const fetchResults = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_PREFIX}/results/${documentId}/`, { headers: authHeader() });
      setDoc(res.data);
    } catch (e) {
      if (e.response?.status === 202) {
        setError('Processing is still in progress. Please check back once the document has completed.');
      } else {
        setError(e.response?.data?.error || e.message || 'Failed to load report');
      }
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  const drawings = doc?.drawings || [];
  const activeConfig = REPORT_TABS.find(t => t.key === activeTab) || REPORT_TABS[0];

  // Flatten findings across all drawings, scoped to the active tab's categories.
  const tabFindings = useMemo(() => {
    const cats = activeConfig.categories;
    const rows = [];
    drawings.forEach(d => {
      (d.issues || []).forEach(f => {
        if (cats.includes(f.category)) {
          rows.push({ ...f, drawing_id: d.drawing_id, drawing_title: d.title });
        }
      });
    });
    return rows;
  }, [drawings, activeConfig]);

  // Aggregate matched/total counts from drawing.metadata.comparison_results.
  // Comparison results are stored per comparison-type per drawing; use MAX
  // across drawings per category (defensive against duplicated aggregate
  // metadata) then SUM across the tab's categories.
  const stats = useMemo(() => {
    const perCategoryMax = {};
    activeConfig.categories.forEach(cat => { perCategoryMax[cat] = { matched: 0, totalPid: 0, totalRef: 0 }; });

    drawings.forEach(d => {
      const cr = d.metadata?.comparison_results || {};
      activeConfig.categories.forEach(cat => {
        const r = cr[cat];
        if (!r) return;
        perCategoryMax[cat].matched = Math.max(perCategoryMax[cat].matched, r.matched_count || 0);
        perCategoryMax[cat].totalPid = Math.max(perCategoryMax[cat].totalPid, r.total_pid_items || 0);
        perCategoryMax[cat].totalRef = Math.max(perCategoryMax[cat].totalRef, r.total_ref_items || 0);
      });
    });

    let matched = 0, totalPid = 0, totalRef = 0;
    activeConfig.categories.forEach(cat => {
      matched += perCategoryMax[cat].matched;
      totalPid += perCategoryMax[cat].totalPid;
      totalRef += perCategoryMax[cat].totalRef;
    });

    const missing = tabFindings.filter(f => (f.rule_id || '').endsWith(`-${DISCREPANCY_SUFFIX.missing}`)).length;
    const extra = tabFindings.filter(f => (f.rule_id || '').endsWith(`-${DISCREPANCY_SUFFIX.extra}`)).length;
    const mismatch = tabFindings.filter(f => (f.rule_id || '').endsWith(`-${DISCREPANCY_SUFFIX.mismatch}`)).length;

    return { matched, missing, extra, mismatch, totalPid, totalRef };
  }, [drawings, activeConfig, tabFindings]);

  const visibleFindings = useMemo(() => {
    let rows = tabFindings;
    if (severityFilter !== 'all') rows = rows.filter(f => f.severity === severityFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(f =>
        (f.issue_observed || '').toLowerCase().includes(q) ||
        (f.evidence || '').toLowerCase().includes(q) ||
        (f.rule_id || '').toLowerCase().includes(q) ||
        (f.drawing_id || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [tabFindings, severityFilter, search]);

  const availableSeverities = useMemo(
    () => Array.from(new Set(tabFindings.map(f => f.severity))).filter(Boolean),
    [tabFindings]
  );

  const download = async (kind) => {
    if (downloading[kind]) return;
    setDownloading(prev => ({ ...prev, [kind]: true }));
    try {
      const ext = kind === 'excel' ? 'xlsx' : 'pdf';
      const res = await axios.get(`${API_PREFIX}/export/${kind}/${documentId}/`, {
        headers: authHeader(),
        params: { view: activeTab },
        responseType: 'blob',
        timeout: 120000,
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      const safeName = (doc?.file_name || documentId).replace(/\.[^.]+$/, '').replace(/\s+/g, '_');
      const suffix = activeTab === 'general' ? '_general' : `_${activeTab}`;
      a.href = url;
      a.download = `pidv_${kind === 'excel' ? 'findings' : 'report'}_${safeName}${suffix}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`${kind === 'excel' ? 'Excel' : 'PDF'} export failed — ${e.response?.data?.error || e.message}`);
    } finally {
      setDownloading(prev => ({ ...prev, [kind]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(ROUTES.PID_VERIFICATION)} // SOFT-CODED: Navigate back to V1 (primary route)
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <div className="min-w-0">
            <h1 className="text-lg font-black text-slate-900 truncate">Comparison Report</h1>
            <p className="text-xs text-slate-500 truncate">{doc?.file_name || documentId}</p>
          </div>
          <button
            onClick={fetchResults}
            disabled={loading}
            title="Refresh"
            className="ml-auto flex items-center gap-1.5 text-xs font-medium px-3 py-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Tabs */}
        {!loading && !error && (
          <div className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto">
            {REPORT_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); setSearch(''); setSeverityFilter('all'); }}
                className={`flex-shrink-0 px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${
                  activeTab === t.key
                    ? 'text-indigo-600 border-indigo-500'
                    : 'text-slate-400 border-transparent hover:text-slate-600'
                }`}
              >
                {t.shortLabel}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Loader className="w-8 h-8 animate-spin mb-3" />
            <p className="text-sm">Loading report…</p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-5 py-4 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && doc && (
          <>
            {/* Tab description + export buttons */}
            <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
              <div>
                <h2 className="text-xl font-black text-slate-900">{activeConfig.label}</h2>
                <p className="text-sm text-slate-500 mt-0.5 max-w-2xl">{activeConfig.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => download('excel')}
                  disabled={downloading.excel}
                  className="flex items-center gap-1.5 text-xs font-bold text-white px-3 py-2 rounded-xl transition-all hover:-translate-y-px disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#059669,#10b981)', boxShadow: '0 3px 10px rgba(16,185,129,0.25)' }}
                >
                  {downloading.excel ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                  Excel
                </button>
                <button
                  onClick={() => download('pdf')}
                  disabled={downloading.pdf}
                  className="flex items-center gap-1.5 text-xs font-bold text-white px-3 py-2 rounded-xl transition-all hover:-translate-y-px disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#dc2626,#ef4444)', boxShadow: '0 3px 10px rgba(239,68,68,0.25)' }}
                >
                  {downloading.pdf ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                  PDF
                </button>
              </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {STAT_CARDS.map(c => (
                <div key={c.key} className="rounded-xl px-4 py-3 border" style={{ background: c.bg, borderColor: c.border }}>
                  <div className="flex items-center gap-2">
                    <c.icon className="w-4 h-4" style={{ color: c.color }} />
                    <span className="text-2xl font-black" style={{ color: c.color }}>{stats[c.key]}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium mt-1">{c.label}</p>
                </div>
              ))}
            </div>

            {/* Empty state */}
            {tabFindings.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl px-6 py-10 text-center text-slate-500">
                {stats.totalRef === 0
                  ? <p className="text-sm">No reference data has been uploaded for this comparison yet, or the file could not be parsed.</p>
                  : <p className="text-sm">No discrepancies found — every item matched between the P&ID and the reference data. ✅</p>
                }
              </div>
            )}

            {tabFindings.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {/* Toolbar */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 flex-wrap">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search issue, evidence, rule ID, drawing…"
                      className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  </div>
                  <select
                    value={severityFilter}
                    onChange={e => setSeverityFilter(e.target.value)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="all">All severities</option>
                    {availableSeverities.map(s => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                  <span className="text-xs text-slate-400 ml-auto">{visibleFindings.length} of {tabFindings.length} shown</span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto max-h-[65vh]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-bold text-slate-600 text-xs">SL No</th>
                        <th className="text-left px-4 py-2.5 font-bold text-slate-600 text-xs">Drawing</th>
                        {activeTab === 'general' && (
                          <th className="text-left px-4 py-2.5 font-bold text-slate-600 text-xs">Category</th>
                        )}
                        <th className="text-left px-4 py-2.5 font-bold text-slate-600 text-xs">Rule ID</th>
                        <th className="text-left px-4 py-2.5 font-bold text-slate-600 text-xs">Issue Observed</th>
                        <th className="text-left px-4 py-2.5 font-bold text-slate-600 text-xs">Action Required</th>
                        <th className="text-left px-4 py-2.5 font-bold text-slate-600 text-xs">Evidence</th>
                        <th className="text-left px-4 py-2.5 font-bold text-slate-600 text-xs">Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleFindings.map(f => {
                        const sev = SEVERITY_STYLES[f.severity] || SEVERITY_STYLES.minor;
                        return (
                          <tr key={f.id} className="border-b border-slate-50 hover:bg-slate-50/70">
                            <td className="px-4 py-2.5 text-slate-500">{f.sl_no}</td>
                            <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{f.drawing_id}</td>
                            {activeTab === 'general' && (
                              <td className="px-4 py-2.5 text-slate-600 font-medium">{CATEGORY_LABELS[f.category] || f.category}</td>
                            )}
                            <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{f.rule_id}</td>
                            <td className="px-4 py-2.5 text-slate-800 max-w-md">{f.issue_observed}</td>
                            <td className="px-4 py-2.5 text-slate-600 max-w-xs">{f.action_required}</td>
                            <td className="px-4 py-2.5 text-slate-500 max-w-xs truncate" title={f.evidence}>{f.evidence}</td>
                            <td className="px-4 py-2.5">
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
                                style={{ background: sev.bg, color: sev.text }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: sev.dot }} />
                                {f.severity}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
