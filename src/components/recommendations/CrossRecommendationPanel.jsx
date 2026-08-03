import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api.config';
import { Link2, Search, ExternalLink, Database, Loader, Sparkles } from 'lucide-react';

const API_PREFIX = `${API_BASE_URL}/cross-recommendation`;

const authHeader = () => {
  const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const routeByType = {
  pid: '/engineering/process/pid-verification',
  pfd: '/engineering/process/pfd-quality-checker',
};

const displayByType = {
  pid: 'P&ID QC',
  pfd: 'PFD QC',
};

const CrossRecommendationPanel = ({ sourceType, documentId, projectId, fileName }) => {
  const [loading, setLoading] = useState(false);
  const [linkingId, setLinkingId] = useState(null);
  const [query, setQuery] = useState('');
  const [data, setData] = useState({ recommendations: [], suggestion: null });
  const [notice, setNotice] = useState({ type: '', text: '' });

  const targetType = sourceType === 'pid' ? 'pfd' : 'pid';

  const title = useMemo(() => {
    if (sourceType === 'pid') {
      return 'Need matching PFD for this P&ID?';
    }
    return 'Need matching P&ID for this PFD?';
  }, [sourceType]);

  const fetchRecommendations = async (searchQuery = '') => {
    setLoading(true);
    try {
      const params = {
        source_type: sourceType,
        limit: 8,
      };
      if (documentId) params.document_id = documentId;
      if (projectId) params.project_id = projectId;
      if (searchQuery) params.query = searchQuery;

      const res = await axios.get(`${API_PREFIX}/recommendations/`, {
        headers: authHeader(),
        params,
        timeout: 30000,
      });
      setData({
        recommendations: res.data.recommendations || [],
        suggestion: res.data.suggestion || null,
      });
      setNotice({ type: '', text: '' });
    } catch (err) {
      setNotice({ type: 'error', text: err?.response?.data?.error || 'Failed to load recommendations' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sourceType) return;
    fetchRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceType, documentId, projectId]);

  const linkRecommendation = async (item) => {
    if (!documentId) {
      setNotice({ type: 'info', text: 'Run analysis first, then link this recommendation.' });
      return;
    }

    setLinkingId(item.target_document_id);
    try {
      await axios.post(
        `${API_PREFIX}/links/`,
        {
          source_type: sourceType,
          source_document_id: documentId,
          target_type: item.target_type,
          target_document_id: item.target_document_id,
          project_id: item.project_id || projectId || null,
          score: item.score || 0,
          reason: item.reason || 'user accepted recommendation',
          decision: 'accepted',
        },
        {
          headers: authHeader(),
          timeout: 30000,
        }
      );
      setNotice({ type: 'success', text: `Linked with ${displayByType[item.target_type]} document.` });
    } catch (err) {
      setNotice({ type: 'error', text: err?.response?.data?.error || 'Failed to save link' });
    } finally {
      setLinkingId(null);
    }
  };

  return (
    <div className="rounded-2xl p-5 border border-slate-200 bg-white/90" style={{ backdropFilter: 'blur(8px)' }}>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-cyan-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">
              Smart cross-check from database, or jump to {displayByType[targetType]} upload.
            </p>
          </div>
        </div>
        <a
          href={routeByType[targetType]}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
        >
          Open {displayByType[targetType]}
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${displayByType[targetType]} by file name...`}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-300 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => fetchRecommendations(query)}
          disabled={loading}
          className="px-4 py-2 text-xs font-bold rounded-xl text-white disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg,#0d9488,#0891b2)' }}
        >
          {loading ? 'Searching...' : 'Search DB'}
        </button>
      </div>

      {fileName && (
        <div className="mb-3 text-xs text-slate-500">
          Source file: <span className="font-semibold text-slate-700">{fileName}</span>
        </div>
      )}

      {notice.text && (
        <div className={`mb-3 p-3 rounded-xl text-xs border ${
          notice.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : notice.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
          {notice.text}
        </div>
      )}

      {loading ? (
        <div className="py-6 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
          <Loader className="w-4 h-4 animate-spin" /> Loading recommendations...
        </div>
      ) : data.recommendations.length > 0 ? (
        <div className="space-y-2">
          {data.recommendations.map((item) => (
            <div key={item.target_document_id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">{item.file_name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Score: {(item.score * 100).toFixed(0)}% • {item.reason}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Issues: {item.total_issues} (Critical: {item.critical_count}, Major: {item.major_count})
                  </div>
                </div>
                <button
                  onClick={() => linkRecommendation(item)}
                  disabled={linkingId === item.target_document_id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#0284c7,#0ea5e9)' }}
                >
                  {linkingId === item.target_document_id ? (
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5" />
                  )}
                  Link
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-sm">
          <div className="flex items-start gap-2">
            <Database className="w-4 h-4 mt-0.5" />
            <div>
              <p className="font-semibold">No matching {displayByType[targetType]} found in database.</p>
              <p className="text-xs mt-1">{data.suggestion?.message || 'Upload a new file to continue cross-verification.'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrossRecommendationPanel;
