import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  TrophyIcon,
  SparklesIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  CurrencyDollarIcon,
  CpuChipIcon,
  BoltIcon,
  ChartBarIcon,
  UsersIcon,
  PencilSquareIcon,
  TrashIcon,
  PlusCircleIcon,
  XMarkIcon,
  LightBulbIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline';
import analyticsService from '../../services/analyticsService';
import { isUserAdmin, isUserSuperuser } from '../../utils/rbac.utils';

/**
 * AI Champion of the Month — gamified leaderboard, real-time activity tracking,
 * AI cost analytics, and historical winners. All thresholds and weights are
 * soft-coded so SuperAdmin can rebalance scoring without touching code.
 *
 * Backend: /rbac/ai-champion/* (Django + DRF + Celery)
 * AWS reference architecture documented in apps/rbac/ai_champion_models.py.
 */

// ---------------------------------------------------------------------------
// Soft-coded UI configuration
// ---------------------------------------------------------------------------
const TIME_WINDOWS = [
  { id: 'today',   label: 'Today',     days: 1 },
  { id: 'week',    label: 'This Week', days: 7 },
  { id: 'month',   label: 'This Month',days: 30 },
  { id: 'quarter', label: 'Quarter',   days: 90 },
];

const REFRESH_INTERVAL_MS = 60_000;
const LEADERBOARD_LIMIT = 20;

// Tier visual styling (matches backend BADGE_TIERS thresholds)
const TIER_STYLES = {
  diamond:  { ring: 'from-cyan-400 via-blue-500 to-indigo-600',  pill: 'bg-gradient-to-r from-cyan-100 to-blue-100 text-blue-700 border-blue-200',     emoji: '💎' },
  platinum: { ring: 'from-slate-300 via-slate-400 to-slate-600', pill: 'bg-slate-100 text-slate-700 border-slate-300',                                emoji: '🏆' },
  gold:     { ring: 'from-yellow-300 via-amber-400 to-orange-500', pill: 'bg-yellow-50 text-yellow-700 border-yellow-200',                            emoji: '🥇' },
  silver:   { ring: 'from-gray-200 via-gray-300 to-gray-500',    pill: 'bg-gray-100 text-gray-700 border-gray-300',                                  emoji: '🥈' },
  bronze:   { ring: 'from-amber-300 via-amber-500 to-orange-700', pill: 'bg-amber-50 text-amber-700 border-amber-200',                               emoji: '🥉' },
  rookie:   { ring: 'from-emerald-200 via-emerald-300 to-teal-500', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',                       emoji: '🌱' },
  // Honorary tiers — for permanent contributors (founders, architects, lead devs).
  founder:    { ring: 'from-fuchsia-400 via-purple-500 to-indigo-700', pill: 'bg-gradient-to-r from-fuchsia-100 to-purple-100 text-purple-700 border-purple-300', emoji: '👑' },
  architect:  { ring: 'from-sky-400 via-blue-500 to-indigo-700',     pill: 'bg-gradient-to-r from-sky-100 to-blue-100 text-blue-700 border-blue-300',           emoji: '🏛️' },
};

// ---------------------------------------------------------------------------
// Honorary Hall of Fame — soft-coded permanent entries.
//
// Members are now fully manageable from the UI (add / edit / delete) by
// SuperAdmins. The list is persisted in browser localStorage so changes
// survive reloads without any backend migration. The default list ships
// EMPTY — administrators curate their own founders & architects via the
// "Manage Honorary Members" panel.
//
// Each entry supports the following (soft-coded) fields:
//   - id             : stable client id (auto-generated)
//   - email          : unique identifier (matched case-insensitively)
//   - name           : display name
//   - title          : short role label (rendered in the badge)
//   - tier           : 'founder' | 'architect' | any TIER_STYLES key
//   - since          : ISO date — formatted as the contribution start
//   - achievements   : 1..N short bullets shown in the spotlight card
//   - links          : optional [{ label, href }] (LinkedIn, GitHub, etc.)
//   - avatar         : optional override avatar URL
//   - tagline        : optional short quote
// ---------------------------------------------------------------------------
const DEFAULT_HONORARY_HALL_OF_FAME = [];

// Persistence (soft-coded keys — bump version to invalidate stored data)
const HOF_STORAGE_KEY = 'radai.aiChampion.honoraryHallOfFame.v1';
const HOF_STORAGE_VERSION = 1;

// Tier choices exposed in the add/edit form (subset of TIER_STYLES)
const HOF_TIER_OPTIONS = [
  { id: 'founder',   label: 'Founder 👑' },
  { id: 'architect', label: 'Architect 🏛️' },
  { id: 'diamond',   label: 'Diamond 💎' },
  { id: 'platinum',  label: 'Platinum 🏆' },
  { id: 'gold',      label: 'Gold 🥇' },
];

// Soft-coded AI-style nomination recommender thresholds.
// A leaderboard row is recommended as honorary if it satisfies ALL gates
// AND the composite signal exceeds MIN_SIGNAL. Tune freely — no logic
// changes required.
const HOF_RECOMMENDATION_CONFIG = {
  // Minimum gates (all must pass)
  minChampionScore: 60,
  minDistinctFeatures: 3,
  minAiRequests: 25,
  minSuccessRate: 80,
  // Composite signal weights (must sum ~1.0)
  weights: {
    score:    0.45,
    features: 0.20,
    requests: 0.20,
    success:  0.15,
  },
  // Normalisation caps used when computing the 0..1 composite signal
  caps: {
    score:    100,
    features: 20,
    requests: 500,
    success:  100,
  },
  minSignal: 0.55,
  maxSuggestions: 5,
  // Default tier proposed when nominating from a recommendation
  defaultTier: 'architect',
};


// ---------------------------------------------------------------------------
// Multi-period Hall of Fame — soft-coded recognition windows.
//
// Each entry drives one tab in the "Top RADAI Users · Hall of Fame" panel.
// Adding a new window (e.g. yearly, sprint) is a single object append.
//   - id        : stable key
//   - label     : tab label
//   - days      : window passed to /rbac/ai-champion/leaderboard
//   - icon      : emoji rendered in the tab + section header
//   - accent    : gradient classes used for the tab pill + ribbon
//   - hint      : sub-title rendered under the tab when active
//   - liveTag   : optional pulsing dot (used for realtime)
// ---------------------------------------------------------------------------
const HOF_PERIODS = [
  { id: 'realtime', label: 'Realtime',  days: 1,  icon: '⚡', accent: 'from-emerald-400 to-teal-600',   hint: 'Last 24 hours · live engagement', liveTag: true  },
  { id: 'week',     label: 'Weekly',    days: 7,  icon: '📅', accent: 'from-sky-400 to-blue-600',       hint: 'Rolling 7-day window',            liveTag: false },
  { id: 'month',    label: 'Monthly',   days: 30, icon: '🏆', accent: 'from-amber-400 to-orange-600',   hint: 'Last 30 days · the headline race', liveTag: false },
  { id: 'quarter',  label: 'Quarterly', days: 90, icon: '💎', accent: 'from-fuchsia-400 to-purple-600', hint: 'Last 90 days · sustained impact',  liveTag: false },
];

const HOF_TOP_N = 5;
const HOF_RANK_BADGES = ['🥇', '🥈', '🥉', '🏅', '🏅'];

// Cost-card colour ramp (USD/day)
const COST_TONE = (cost) => {
  if (cost >= 100) return 'text-rose-600';
  if (cost >= 25)  return 'text-amber-600';
  if (cost >  0)   return 'text-emerald-600';
  return 'text-slate-400';
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const getInitials = (name = '', email = '') => {
  const src = (name || email || '?').trim();
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
};

const fmtUSD = (n) => `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtNum = (n) => (Number(n) || 0).toLocaleString();
const tierStyle = (id) => TIER_STYLES[id] || TIER_STYLES.rookie;

// ---------------------------------------------------------------------------
// Honorary HoF persistence helpers (soft-coded, localStorage backed)
// ---------------------------------------------------------------------------
const makeHofId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `hof_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const sanitizeHofEntry = (raw = {}) => {
  const achievements = Array.isArray(raw.achievements)
    ? raw.achievements.map((a) => String(a || '').trim()).filter(Boolean)
    : String(raw.achievements || '')
        .split('\n')
        .map((a) => a.trim())
        .filter(Boolean);
  const links = Array.isArray(raw.links)
    ? raw.links
        .map((l) => ({ label: String(l?.label || '').trim(), href: String(l?.href || '').trim() }))
        .filter((l) => l.label && l.href)
    : [];
  return {
    id: raw.id || makeHofId(),
    email: String(raw.email || '').trim().toLowerCase(),
    name: String(raw.name || '').trim(),
    title: String(raw.title || '').trim(),
    tier: HOF_TIER_OPTIONS.some((t) => t.id === raw.tier) ? raw.tier : 'architect',
    since: String(raw.since || '').trim(),
    achievements,
    links,
    avatar: String(raw.avatar || '').trim(),
    tagline: String(raw.tagline || '').trim(),
  };
};

const loadHofFromStorage = () => {
  try {
    const raw = localStorage.getItem(HOF_STORAGE_KEY);
    if (!raw) return [...DEFAULT_HONORARY_HALL_OF_FAME];
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== HOF_STORAGE_VERSION || !Array.isArray(parsed.entries)) {
      return [...DEFAULT_HONORARY_HALL_OF_FAME];
    }
    return parsed.entries.map(sanitizeHofEntry);
  } catch {
    return [...DEFAULT_HONORARY_HALL_OF_FAME];
  }
};

const saveHofToStorage = (entries) => {
  try {
    localStorage.setItem(
      HOF_STORAGE_KEY,
      JSON.stringify({ version: HOF_STORAGE_VERSION, entries })
    );
  } catch {
    /* quota exceeded or storage disabled — silently ignore */
  }
};

// Compute a 0..1 composite "honorary candidate" signal from a leaderboard row
const computeHofRecommendationSignal = (row) => {
  const { weights, caps } = HOF_RECOMMENDATION_CONFIG;
  const clamp01 = (n) => Math.max(0, Math.min(1, Number(n) || 0));
  const score    = clamp01((row?.champion_score || 0)         / caps.score);
  const features = clamp01((row?.stats?.distinct_features_used || 0) / caps.features);
  const requests = clamp01((row?.stats?.total_ai_requests || 0)      / caps.requests);
  const success  = clamp01((row?.stats?.success_rate || 0)           / caps.success);
  return (
    score * weights.score +
    features * weights.features +
    requests * weights.requests +
    success * weights.success
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const AIChampion = () => {
  const navigate = useNavigate();
  const authUser = useSelector((s) => s.auth?.user);
  const rbacRoles = useSelector((s) => s.rbac?.userRoles || []);

  const [windowId, setWindowId] = useState('month');
  const [leaderboard, setLeaderboard] = useState(null);
  const [champion, setChampion] = useState(null);
  const [costReport, setCostReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  // Multi-period Hall of Fame (Realtime / Weekly / Monthly / Quarterly)
  const [hofPeriod, setHofPeriod] = useState('month');
  const [hofData, setHofData] = useState({});       // { periodId: [rows] }
  const [hofLoading, setHofLoading] = useState(false);
  const [hofUpdatedAt, setHofUpdatedAt] = useState(null);

  // -----------------------------------------------------------------------
  // Honorary Hall of Fame — CRUD state (super-admin only)
  // -----------------------------------------------------------------------
  const [honoraryList, setHonoraryList] = useState(() => loadHofFromStorage());
  const [hofEditor, setHofEditor] = useState({ open: false, mode: 'add', draft: null });
  const [hofToast, setHofToast] = useState(null); // { type, message }

  const isSuperAdmin = useMemo(() => {
    if (isUserSuperuser && isUserSuperuser(authUser)) return true;
    return Array.isArray(rbacRoles)
      && rbacRoles.some((r) => (r?.role_code || r?.code || r) === 'super_admin');
  }, [authUser, rbacRoles]);

  // Derived: emails to exclude from gamified leaderboards
  const honoraryEmails = useMemo(
    () => new Set(honoraryList.map((h) => (h.email || '').trim().toLowerCase()).filter(Boolean)),
    [honoraryList]
  );

  // Persist whenever the list changes
  useEffect(() => {
    saveHofToStorage(honoraryList);
  }, [honoraryList]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!hofToast) return undefined;
    const id = setTimeout(() => setHofToast(null), 3500);
    return () => clearTimeout(id);
  }, [hofToast]);

  // ---- CRUD handlers ----
  const openHofAdd = useCallback((prefill = {}) => {
    setHofEditor({
      open: true,
      mode: 'add',
      draft: sanitizeHofEntry({ tier: HOF_RECOMMENDATION_CONFIG.defaultTier, ...prefill }),
    });
  }, []);

  const openHofEdit = useCallback((entry) => {
    setHofEditor({ open: true, mode: 'edit', draft: sanitizeHofEntry(entry) });
  }, []);

  const closeHofEditor = useCallback(() => {
    setHofEditor({ open: false, mode: 'add', draft: null });
  }, []);

  const saveHofEntry = useCallback((draft) => {
    const entry = sanitizeHofEntry(draft);
    if (!entry.email || !entry.name) {
      setHofToast({ type: 'error', message: 'Name and email are required.' });
      return;
    }
    setHonoraryList((prev) => {
      const idx = prev.findIndex((p) => p.id === entry.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = entry;
        return next;
      }
      // Prevent duplicate emails
      if (prev.some((p) => p.email === entry.email)) {
        setHofToast({ type: 'error', message: `Email ${entry.email} is already honorary.` });
        return prev;
      }
      return [...prev, entry];
    });
    setHofToast({ type: 'success', message: `Saved "${entry.name}".` });
    closeHofEditor();
  }, [closeHofEditor]);

  const deleteHofEntry = useCallback((entry) => {
    if (!entry) return;
    if (!confirm(`Remove "${entry.name || entry.email}" from the Hall of Fame?`)) return;
    setHonoraryList((prev) => prev.filter((p) => p.id !== entry.id));
    setHofToast({ type: 'success', message: `Removed "${entry.name || entry.email}".` });
  }, []);


  const isAdmin = useMemo(() => {
    if (isUserAdmin && isUserAdmin(authUser)) return true;
    const adminRoles = ['super_admin', 'admin'];
    return Array.isArray(rbacRoles) && rbacRoles.some((r) => adminRoles.includes(r?.role_code || r?.code || r));
  }, [authUser, rbacRoles]);

  const days = useMemo(
    () => (TIME_WINDOWS.find((w) => w.id === windowId) || TIME_WINDOWS[2]).days,
    [windowId]
  );

  // ------------------------------ Data loading ------------------------------
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [lb, ch, cost, hist] = await Promise.all([
        analyticsService.getChampionLeaderboard(days, LEADERBOARD_LIMIT).catch(() => null),
        analyticsService.getCurrentChampion().catch(() => null),
        analyticsService.getCostReport(days).catch(() => null),
        analyticsService.getChampionHistory(12).catch(() => ({ results: [] })),
      ]);
      setLeaderboard(lb);
      setChampion(ch);
      setCostReport(cost);
      setHistory(hist?.results || []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err?.message || 'Failed to load AI Champion data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days]);

  useEffect(() => {
    if (!isAdmin) return;
    load(false);
    const id = setInterval(() => load(true), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isAdmin, load]);

  // ------------------------------ Multi-period Hall of Fame ------------------------------
  const loadHallOfFame = useCallback(async () => {
    setHofLoading(true);
    try {
      const results = await Promise.all(
        HOF_PERIODS.map((p) =>
          analyticsService
            .getChampionLeaderboard(p.days, LEADERBOARD_LIMIT)
            .catch(() => null)
        )
      );
      const next = {};
      HOF_PERIODS.forEach((p, idx) => {
        const rows = results[idx]?.results || [];
        next[p.id] = rows
          .filter((r) => !honoraryEmails.has((r.user?.email || '').trim().toLowerCase()))
          .slice(0, HOF_TOP_N);
      });
      setHofData(next);
      setHofUpdatedAt(new Date());
    } finally {
      setHofLoading(false);
    }
  }, [honoraryEmails]);

  useEffect(() => {
    if (!isAdmin) return;
    loadHallOfFame();
    const id = setInterval(loadHallOfFame, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isAdmin, loadHallOfFame]);

  // ------------------------------ CSV export ------------------------------
  const handleExport = async () => {
    try {
      const blob = await analyticsService.exportLeaderboardCSV(days);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-champion-leaderboard-${days}d.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Export failed: ' + (err?.message || 'unknown error'));
    }
  };

  // ------------------------------ Recompute (admin) ------------------------------
  const handleRecompute = async () => {
    const now = new Date();
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const month = now.getMonth() === 0 ? 12 : now.getMonth(); // previous month
    if (!confirm(`Recompute AI Champion for ${year}-${String(month).padStart(2, '0')}?`)) return;
    try {
      await analyticsService.recomputeChampion(year, month);
      await load(false);
    } catch (err) {
      setError('Recompute failed: ' + (err?.message || 'unknown error'));
    }
  };

  // ------------------------------ Guard ------------------------------
  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md">
          <TrophyIcon className="w-12 h-12 mx-auto text-amber-400 mb-3" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Admin Access Required</h2>
          <p className="text-slate-600 mb-4">AI Champion analytics are restricted to administrators.</p>
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

  const podium = champion?.podium || [];
  const top = champion?.champion;
  const ranked = leaderboard?.results || [];
  const totals = costReport?.totals || {};
  const byProvider = costReport?.by_provider || [];
  const byApp = costReport?.by_application || [];

  // -----------------------------------------------------------------------
  // AI-style recommendations — suggest nominees for honorary status by
  // scanning leaderboard rows against the soft-coded thresholds. Excludes
  // anyone already pinned in the Hall of Fame.
  // -----------------------------------------------------------------------
  const hofRecommendations = useMemo(() => {
    const cfg = HOF_RECOMMENDATION_CONFIG;
    const candidates = [];
    for (const r of ranked) {
      const email = (r.user?.email || '').trim().toLowerCase();
      if (!email || honoraryEmails.has(email)) continue;
      const stats = r.stats || {};
      if (
        (r.champion_score || 0)        < cfg.minChampionScore   ||
        (stats.distinct_features_used || 0) < cfg.minDistinctFeatures ||
        (stats.total_ai_requests || 0)      < cfg.minAiRequests       ||
        (stats.success_rate || 0)           < cfg.minSuccessRate
      ) continue;
      const signal = computeHofRecommendationSignal(r);
      if (signal < cfg.minSignal) continue;
      candidates.push({
        row: r,
        signal,
        reasons: [
          `Score ${Number(r.champion_score).toFixed(1)}/100`,
          `${fmtNum(stats.distinct_features_used)} distinct features`,
          `${fmtNum(stats.total_ai_requests)} AI requests`,
          `${Number(stats.success_rate || 0).toFixed(1)}% success`,
        ],
      });
    }
    candidates.sort((a, b) => b.signal - a.signal);
    return candidates.slice(0, cfg.maxSuggestions);
  }, [ranked, honoraryEmails]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ------------------------------ Header ------------------------------ */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                <TrophyIcon className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 bg-clip-text text-transparent">
                AI Champion of the Month
              </h1>
            </div>
            <p className="text-slate-600 text-sm">
              Real-time engagement leaderboard · AI cost analytics · gamified recognition
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {TIME_WINDOWS.map((w) => (
              <button
                key={w.id}
                onClick={() => setWindowId(w.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                  windowId === w.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                }`}
              >
                {w.label}
              </button>
            ))}
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 hover:border-slate-400 flex items-center gap-1.5 disabled:opacity-50"
              title="Refresh"
            >
              <ArrowPathIcon className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing' : 'Refresh'}
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 hover:border-slate-400 flex items-center gap-1.5"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={handleRecompute}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 flex items-center gap-1.5"
              title="Recompute previous month champion"
            >
              <SparklesIcon className="w-4 h-4" />
              Recompute
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* ------------------------------ Champion banner ------------------------------ */}
        {top ? (
          <div className="rounded-3xl p-6 md:p-8 bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-2xl text-white relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -left-12 -bottom-12 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
            <div className="relative grid md:grid-cols-3 gap-6 items-center">
              <div className="md:col-span-2 flex items-center gap-5">
                <div className={`p-1 rounded-full bg-gradient-to-br ${tierStyle(top.tier).ring} shadow-xl`}>
                  <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-white text-amber-600 text-3xl md:text-4xl font-black flex items-center justify-center">
                    {getInitials(top.user?.name, top.user?.email)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-widest opacity-80 mb-1">
                    {champion.live ? 'Live · current month-to-date' : `Champion · ${champion.period?.year}-${String(champion.period?.month).padStart(2, '0')}`}
                  </div>
                  <div className="text-2xl md:text-3xl font-black">{top.user?.name || top.user?.email}</div>
                  <div className="text-sm opacity-90 mt-0.5">{top.user?.email}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur text-xs font-bold">
                      {tierStyle(top.tier).emoji} {top.tier_label || top.tier}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur text-xs font-bold">
                      Score {Number(top.champion_score).toFixed(1)}/100
                    </span>
                  </div>
                  {top.citation && (
                    <p className="mt-3 text-sm opacity-95 max-w-xl">{top.citation}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <Stat label="AI Requests" value={fmtNum(top.stats?.total_ai_requests)} />
                <Stat label="Actions"     value={fmtNum(top.stats?.total_actions)} />
                <Stat label="Features"    value={fmtNum(top.stats?.distinct_features_used)} />
                <Stat label="AI Spend"    value={fmtUSD(top.stats?.total_ai_cost_usd)} />
              </div>
            </div>
          </div>
        ) : !loading && (
          <div className="rounded-3xl p-8 bg-slate-100 text-slate-500 text-center">
            No champion data yet. Once users start interacting with AI features, the leaderboard will populate.
          </div>
        )}

        {/* ------------------------------ Cost analytics ------------------------------ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            icon={<CurrencyDollarIcon className="w-5 h-5" />}
            label={`Total AI Spend (${days}d)`}
            value={fmtUSD(totals.cost_usd)}
            tone={COST_TONE(totals.cost_usd)}
          />
          <KPICard
            icon={<BoltIcon className="w-5 h-5" />}
            label="AI Requests"
            value={fmtNum(totals.requests)}
            tone="text-blue-600"
          />
          <KPICard
            icon={<CpuChipIcon className="w-5 h-5" />}
            label="Total Tokens"
            value={fmtNum(totals.tokens)}
            tone="text-indigo-600"
          />
          <KPICard
            icon={<ChartBarIcon className="w-5 h-5" />}
            label="Avg Latency"
            value={`${Math.round(totals.avg_latency_ms || 0)} ms`}
            tone="text-slate-700"
          />
        </div>

        {/* ------------------------------ Cost breakdown rows ------------------------------ */}
        <div className="grid md:grid-cols-2 gap-4">
          <Panel title="Cost by Provider" icon={<CurrencyDollarIcon className="w-5 h-5 text-emerald-600" />}>
            {byProvider.length === 0 ? (
              <Empty text="No AI usage in this window." />
            ) : (
              <div className="space-y-2">
                {byProvider.map((r) => (
                  <BreakdownRow
                    key={r.provider}
                    label={r.provider}
                    cost={r.cost}
                    requests={r.requests}
                    max={byProvider[0]?.cost || 1}
                  />
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Cost by Application" icon={<ChartBarIcon className="w-5 h-5 text-blue-600" />}>
            {byApp.length === 0 ? (
              <Empty text="No application-attributed AI usage yet." />
            ) : (
              <div className="space-y-2">
                {byApp.map((r) => (
                  <BreakdownRow
                    key={r.application}
                    label={r.application}
                    cost={r.cost}
                    requests={r.requests}
                    max={byApp[0]?.cost || 1}
                  />
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* ------------------------------ Podium ------------------------------ */}
        {podium.length > 0 && (
          <Panel title="Podium" icon={<TrophyIcon className="w-5 h-5 text-amber-500" />}>
            <div className="grid md:grid-cols-3 gap-4">
              {podium.slice(0, 3).map((p) => {
                const ts = tierStyle(p.tier);
                return (
                  <div key={p.rank} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={`p-0.5 rounded-full bg-gradient-to-br ${ts.ring}`}>
                        <div className="w-12 h-12 rounded-full bg-white text-slate-700 font-bold flex items-center justify-center">
                          {getInitials(p.user?.name, p.user?.email)}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-800 truncate">{p.user?.name || p.user?.email}</div>
                        <div className="text-xs text-slate-500 truncate">{p.user?.email}</div>
                      </div>
                      <div className="ml-auto text-2xl">{p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : '🥉'}</div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className={`px-2 py-0.5 rounded-full border font-medium ${ts.pill}`}>{p.tier_label || p.tier}</span>
                      <span className="font-bold text-slate-700">{Number(p.champion_score).toFixed(1)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        {/* ------------------------------ Leaderboard table ------------------------------ */}
        <Panel
          title={`Leaderboard · top ${ranked.length}`}
          icon={<UsersIcon className="w-5 h-5 text-blue-600" />}
          right={<span className="text-xs text-slate-500">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : ''}</span>}
        >
          {loading ? (
            <Empty text="Loading…" />
          ) : ranked.length === 0 ? (
            <Empty text="No engaged users yet for this window." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">User</th>
                    <th className="py-2 pr-3">Tier</th>
                    <th className="py-2 pr-3 text-right">Actions</th>
                    <th className="py-2 pr-3 text-right">AI Reqs</th>
                    <th className="py-2 pr-3 text-right">Tokens</th>
                    <th className="py-2 pr-3 text-right">Spend</th>
                    <th className="py-2 pr-3 text-right">Features</th>
                    <th className="py-2 pr-3 text-right">Success%</th>
                    <th className="py-2 pr-3 text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((r) => {
                    const ts = tierStyle(r.tier);
                    return (
                      <tr key={r.user_id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2 pr-3 font-bold text-slate-500">{r.rank}</td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2">
                            <div className={`p-0.5 rounded-full bg-gradient-to-br ${ts.ring}`}>
                              <div className="w-7 h-7 rounded-full bg-white text-[11px] font-bold text-slate-700 flex items-center justify-center">
                                {getInitials(r.user?.name, r.user?.email)}
                              </div>
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-slate-800 truncate max-w-[180px]">{r.user?.name || r.user?.email}</div>
                              <div className="text-[11px] text-slate-500 truncate max-w-[180px]">{r.user?.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${ts.pill}`}>
                            {ts.emoji} {r.tier_label || r.tier}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{fmtNum(r.stats?.total_actions)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{fmtNum(r.stats?.total_ai_requests)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{fmtNum(r.stats?.total_tokens)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{fmtUSD(r.stats?.total_ai_cost_usd)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{fmtNum(r.stats?.distinct_features_used)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{Number(r.stats?.success_rate || 0).toFixed(1)}</td>
                        <td className="py-2 pr-3 text-right font-bold text-slate-800 tabular-nums">{Number(r.champion_score).toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {/* ------------------------------ Founders & Architects spotlight ------------------------------ */}
        {honoraryList.length > 0 && (
          <Panel
            title="Founders & Architects"
            icon={<SparklesIcon className="w-5 h-5 text-fuchsia-500" />}
            right={
              isSuperAdmin && (
                <button
                  onClick={() => openHofAdd()}
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1"
                >
                  <PlusCircleIcon className="w-3.5 h-3.5" /> Add Member
                </button>
              )
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {honoraryList.map((h) => {
                const ts = tierStyle(h.tier);
                const sinceLabel = h.since
                  ? new Date(h.since).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
                  : null;
                return (
                  <div
                    key={h.id || h.email}
                    className="relative overflow-hidden rounded-2xl border border-purple-200 bg-gradient-to-br from-white via-purple-50 to-fuchsia-50 p-5 shadow-sm hover:shadow-md transition-shadow"
                  >
                    {/* Decorative ribbon */}
                    <div
                      aria-hidden="true"
                      className={`absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20 bg-gradient-to-br ${ts.ring}`}
                    />
                    {isSuperAdmin && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                        <button
                          onClick={() => openHofEdit(h)}
                          className="p-1 rounded-md bg-white/80 border border-purple-200 text-purple-700 hover:bg-purple-100"
                          title="Edit"
                        >
                          <PencilSquareIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteHofEntry(h)}
                          className="p-1 rounded-md bg-white/80 border border-rose-200 text-rose-600 hover:bg-rose-100"
                          title="Delete"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <div className="relative flex items-start gap-4">
                      {/* Avatar */}
                      <div className={`flex-shrink-0 p-1 rounded-full bg-gradient-to-br ${ts.ring}`}>
                        <div className="w-16 h-16 rounded-full bg-white text-purple-700 text-xl font-extrabold flex items-center justify-center shadow-inner">
                          {h.avatar ? (
                            <img src={h.avatar} alt={h.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            getInitials(h.name, h.email)
                          )}
                        </div>
                      </div>

                      {/* Identity + achievements */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-base font-bold text-slate-900 truncate">{h.name}</h4>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${ts.pill}`}>
                            <span aria-hidden="true">{ts.emoji}</span>
                            {h.tier?.charAt(0).toUpperCase() + h.tier?.slice(1)}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 truncate">{h.title}</div>
                        <a
                          href={`mailto:${h.email}`}
                          className="text-xs text-purple-700 hover:underline truncate block"
                          title={h.email}
                        >
                          {h.email}
                        </a>
                        {sinceLabel && (
                          <div className="mt-1 text-[11px] text-slate-500">
                            Contributing since <span className="font-semibold text-slate-700">{sinceLabel}</span>
                          </div>
                        )}
                        {h.tagline && (
                          <p className="mt-2 text-xs italic text-purple-700">"{h.tagline}"</p>
                        )}
                        {Array.isArray(h.achievements) && h.achievements.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {h.achievements.map((a, i) => (
                              <li
                                key={`${h.email}-ach-${i}`}
                                className="flex items-start gap-1.5 text-xs text-slate-700"
                              >
                                <span aria-hidden="true" className="text-amber-500 leading-4">★</span>
                                <span>{a}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {Array.isArray(h.links) && h.links.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {h.links.map((lnk) => (
                              <a
                                key={lnk.href}
                                href={lnk.href}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 py-0.5 rounded-full bg-white border border-purple-200 text-[11px] text-purple-700 hover:bg-purple-100"
                              >
                                {lnk.label}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        {/* ------------------------------ Manage Honorary Members (SuperAdmin) ------------------------------ */}
        {isSuperAdmin && (
          <Panel
            title="Manage Honorary Members"
            icon={<CheckBadgeIcon className="w-5 h-5 text-purple-600" />}
            right={
              <button
                onClick={() => openHofAdd()}
                className="px-2.5 py-1 rounded-md text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1"
              >
                <PlusCircleIcon className="w-3.5 h-3.5" /> Add Member
              </button>
            }
          >
            {honoraryList.length === 0 ? (
              <Empty text="No honorary members yet. Click 'Add Member' or accept an AI recommendation below." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-3">Email</th>
                      <th className="py-2 pr-3">Title</th>
                      <th className="py-2 pr-3">Tier</th>
                      <th className="py-2 pr-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {honoraryList.map((h) => {
                      const ts = tierStyle(h.tier);
                      return (
                        <tr key={h.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 pr-3 font-medium text-slate-800">{h.name}</td>
                          <td className="py-2 pr-3 text-slate-600">{h.email}</td>
                          <td className="py-2 pr-3 text-slate-600">{h.title}</td>
                          <td className="py-2 pr-3">
                            <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${ts.pill}`}>
                              {ts.emoji} {h.tier}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => openHofEdit(h)}
                                className="px-2 py-1 rounded-md text-xs bg-white border border-slate-200 hover:border-purple-400 text-purple-700 flex items-center gap-1"
                              >
                                <PencilSquareIcon className="w-3.5 h-3.5" /> Edit
                              </button>
                              <button
                                onClick={() => deleteHofEntry(h)}
                                className="px-2 py-1 rounded-md text-xs bg-white border border-slate-200 hover:border-rose-400 text-rose-600 flex items-center gap-1"
                              >
                                <TrashIcon className="w-3.5 h-3.5" /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-3 text-[11px] text-slate-500">
              Changes persist in your browser via localStorage (key{' '}
              <code>{HOF_STORAGE_KEY}</code>). Soft-coded thresholds &amp; tiers live at the top of
              this file — no backend migration required.
            </div>
          </Panel>
        )}

        {/* ------------------------------ AI Recommendations (SuperAdmin) ------------------------------ */}
        {isSuperAdmin && (
          <Panel
            title="AI Recommendations · Honorary Nominees"
            icon={<LightBulbIcon className="w-5 h-5 text-amber-500" />}
            right={
              <span className="text-[11px] text-slate-500">
                Threshold ≥ {(HOF_RECOMMENDATION_CONFIG.minSignal * 100).toFixed(0)}% signal
              </span>
            }
          >
            {hofRecommendations.length === 0 ? (
              <Empty text="No qualifying nominees in the current window. Adjust the time window or wait for more engagement." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {hofRecommendations.map(({ row, signal, reasons }) => {
                  const ts = tierStyle(row.tier);
                  const pct = Math.round(signal * 100);
                  return (
                    <div
                      key={`rec-${row.user_id || row.user?.email}`}
                      className="relative rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-0.5 rounded-full bg-gradient-to-br ${ts.ring}`}>
                          <div className="w-11 h-11 rounded-full bg-white text-slate-700 text-sm font-bold flex items-center justify-center">
                            {getInitials(row.user?.name, row.user?.email)}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-slate-900 truncate">
                            {row.user?.name || row.user?.email}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">{row.user?.email}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold">
                            Signal
                          </div>
                          <div className="text-lg font-extrabold text-amber-600 tabular-nums">{pct}%</div>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-amber-100 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <ul className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1">
                        {reasons.map((rsn, i) => (
                          <li key={i} className="text-[11px] text-slate-600 flex items-center gap-1">
                            <span className="text-emerald-500">✓</span> {rsn}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 flex items-center justify-end">
                        <button
                          onClick={() =>
                            openHofAdd({
                              email: row.user?.email,
                              name: row.user?.name || row.user?.email,
                              title: `${row.tier_label || row.tier || 'Top performer'} · auto-nominated`,
                              tier: HOF_RECOMMENDATION_CONFIG.defaultTier,
                              since: new Date().toISOString().slice(0, 10),
                              achievements: reasons,
                              tagline: 'Recommended by RAD AI based on platform engagement.',
                            })
                          }
                          className="px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 flex items-center gap-1"
                        >
                          <SparklesIcon className="w-3.5 h-3.5" /> Nominate
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        )}


        {/* ------------------------------ Top RADAI Users · multi-period Hall of Fame ------------------------------ */}
        <Panel
          title="Top RADAI Users · Hall of Fame"
          icon={<TrophyIcon className="w-5 h-5 text-amber-500" />}
          right={
            <span className="text-xs text-slate-500">
              {hofLoading
                ? 'Refreshing…'
                : hofUpdatedAt
                ? `Updated ${hofUpdatedAt.toLocaleTimeString()}`
                : ''}
            </span>
          }
        >
          {/* Period tabs */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {HOF_PERIODS.map((p) => {
              const active = hofPeriod === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setHofPeriod(p.id)}
                  className={`relative px-3 py-1.5 rounded-full text-xs font-semibold border transition flex items-center gap-1.5 ${
                    active
                      ? `text-white border-transparent bg-gradient-to-r ${p.accent} shadow`
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                  }`}
                  title={p.hint}
                >
                  <span aria-hidden="true">{p.icon}</span>
                  {p.label}
                  {p.liveTag && (
                    <span
                      className={`ml-1 inline-block w-1.5 h-1.5 rounded-full ${
                        active ? 'bg-white animate-pulse' : 'bg-emerald-500 animate-pulse'
                      }`}
                    />
                  )}
                </button>
              );
            })}
            <span className="text-[11px] text-slate-500 ml-1">
              {HOF_PERIODS.find((p) => p.id === hofPeriod)?.hint}
            </span>
            <button
              onClick={loadHallOfFame}
              disabled={hofLoading}
              className="ml-auto px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-slate-200 hover:border-slate-400 flex items-center gap-1 disabled:opacity-50"
              title="Refresh Hall of Fame"
            >
              <ArrowPathIcon className={`w-3.5 h-3.5 ${hofLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Period content */}
          {(() => {
            const period = HOF_PERIODS.find((p) => p.id === hofPeriod) || HOF_PERIODS[2];
            const rows = hofData[period.id] || [];
            if (hofLoading && rows.length === 0) {
              return <Empty text="Loading top RADAI users…" />;
            }
            if (rows.length === 0) {
              return (
                <Empty
                  text={`No qualifying users for the ${period.label.toLowerCase()} window yet — keep using RAD AI features to get on the board.`}
                />
              );
            }
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {rows.map((r, idx) => {
                  const ts = tierStyle(r.tier);
                  const isFirst = idx === 0;
                  return (
                    <div
                      key={`${period.id}-${r.user_id || r.user?.email || idx}`}
                      className={`relative overflow-hidden rounded-2xl border p-4 shadow-sm bg-white transition hover:shadow-md ${
                        isFirst ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'
                      }`}
                    >
                      {/* Period accent ribbon */}
                      <div
                        aria-hidden="true"
                        className={`absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 bg-gradient-to-br ${period.accent}`}
                      />
                      {/* Rank chip */}
                      <div className="relative flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white bg-gradient-to-r ${period.accent}`}
                        >
                          <span aria-hidden="true">{period.icon}</span>
                          {period.label}
                        </span>
                        <span className="text-lg" aria-hidden="true">
                          {HOF_RANK_BADGES[idx] || `#${idx + 1}`}
                        </span>
                      </div>

                      {/* Identity */}
                      <div className="relative mt-3 flex items-center gap-3">
                        <div className={`p-0.5 rounded-full bg-gradient-to-br ${ts.ring}`}>
                          <div className="w-12 h-12 rounded-full bg-white text-slate-700 text-sm font-bold flex items-center justify-center">
                            {getInitials(r.user?.name, r.user?.email)}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate" title={r.user?.name || r.user?.email}>
                            {r.user?.name || r.user?.email}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate" title={r.user?.email}>
                            {r.user?.email}
                          </div>
                        </div>
                      </div>

                      {/* Tier + score */}
                      <div className="relative mt-3 flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${ts.pill}`}>
                          {ts.emoji} {r.tier_label || r.tier}
                        </span>
                        <span className="text-sm font-extrabold text-slate-800 tabular-nums">
                          {Number(r.champion_score || 0).toFixed(1)}
                          <span className="text-[10px] text-slate-400 font-medium ml-0.5">pts</span>
                        </span>
                      </div>

                      {/* Mini stats */}
                      <div className="relative mt-3 grid grid-cols-3 gap-1 text-center">
                        <MiniStat label="Actions"  value={fmtNum(r.stats?.total_actions)} />
                        <MiniStat label="AI Reqs"  value={fmtNum(r.stats?.total_ai_requests)} />
                        <MiniStat label="Features" value={fmtNum(r.stats?.distinct_features_used)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          <div className="mt-3 text-[11px] text-slate-500">
            Pinned founders &amp; architects are shown above and excluded from these competitive rankings.
            Auto-refreshes every {Math.round(REFRESH_INTERVAL_MS / 1000)}s.
          </div>
        </Panel>

        {/* ------------------------------ Hall of Fame ------------------------------ */}
        <Panel title="Hall of Fame" icon={<TrophyIcon className="w-5 h-5 text-amber-500" />}>
          {history.length === 0 && honoraryList.length === 0 ? (
            <Empty text="No prior champions yet — first month will be selected automatically on the 1st of next month." />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {/* Honorary entries — always pinned at the top */}
              {honoraryList.map((h) => {
                const ts = tierStyle(h.tier);
                return (
                  <div
                    key={`honorary-${h.id || h.email}`}
                    className="relative bg-gradient-to-br from-purple-50 to-fuchsia-50 border-2 border-purple-200 rounded-xl p-3 text-center shadow-sm"
                    title={`${h.name} — ${h.title}`}
                  >
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white text-[9px] font-bold uppercase tracking-wider shadow">
                      Honorary
                    </div>
                    <div className="text-[11px] text-purple-700 font-semibold mb-1 mt-1">
                      {ts.emoji} {h.tier?.toUpperCase()}
                    </div>
                    <div className={`mx-auto p-0.5 rounded-full bg-gradient-to-br ${ts.ring} w-12 h-12`}>
                      <div className="w-full h-full rounded-full bg-white text-slate-700 text-xs font-bold flex items-center justify-center">
                        {getInitials(h.name, h.email)}
                      </div>
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-800 truncate">{h.name}</div>
                    <div className="text-[11px] text-purple-600 truncate" title={h.title}>{h.title}</div>
                  </div>
                );
              })}

              {/* Historical monthly winners */}
              {history.map((h) => {
                const ts = tierStyle(h.tier);
                return (
                  <div key={`${h.period.year}-${h.period.month}`} className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                    <div className="text-[11px] text-slate-500 mb-1">
                      {h.period.year}-{String(h.period.month).padStart(2, '0')}
                    </div>
                    <div className={`mx-auto p-0.5 rounded-full bg-gradient-to-br ${ts.ring} w-12 h-12`}>
                      <div className="w-full h-full rounded-full bg-white text-slate-700 text-xs font-bold flex items-center justify-center">
                        {getInitials(h.user?.name, h.user?.email)}
                      </div>
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-800 truncate">{h.user?.name || h.user?.email}</div>
                    <div className="text-[11px] text-slate-500">{Number(h.champion_score).toFixed(0)} pts</div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* ------------------------------ Scoring transparency ------------------------------ */}
        {leaderboard?.weights && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Scoring formula:</span>{' '}
            {Object.entries(leaderboard.weights).map(([k, v], i, arr) => (
              <span key={k}>
                <span className="text-slate-700 font-medium">{k}</span> × {(v * 100).toFixed(0)}%
                {i < arr.length - 1 ? ' + ' : ''}
              </span>
            ))}
            <span className="mx-2">·</span>
            All weights and badge tiers are soft-coded in <code>apps/rbac/ai_champion_service.py</code>.
          </div>
        )}
      </div>

      {/* ------------------------------ Toast ------------------------------ */}
      {hofToast && (
        <div
          className={`fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium border ${
            hofToast.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}
        >
          {hofToast.message}
        </div>
      )}

      {/* ------------------------------ Add/Edit Honorary Member Modal ------------------------------ */}
      {hofEditor.open && (
        <HonoraryEditorModal
          mode={hofEditor.mode}
          draft={hofEditor.draft}
          onCancel={closeHofEditor}
          onSave={saveHofEntry}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
const Stat = ({ label, value }) => (
  <div className="bg-white/15 backdrop-blur rounded-xl p-3">
    <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
    <div className="text-xl font-bold tabular-nums">{value}</div>
  </div>
);

const KPICard = ({ icon, label, value, tone = 'text-slate-700' }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
    <div className="flex items-center gap-2 text-slate-500 text-xs">
      {icon}
      <span>{label}</span>
    </div>
    <div className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</div>
  </div>
);

const MiniStat = ({ label, value }) => (
  <div className="bg-slate-50 rounded-md py-1.5 px-1">
    <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
    <div className="text-xs font-bold tabular-nums text-slate-800">{value}</div>
  </div>
);

const Panel = ({ title, icon, right, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
    <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
      {icon}
      <h3 className="font-semibold text-slate-800">{title}</h3>
      <div className="ml-auto">{right}</div>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const Empty = ({ text }) => (
  <div className="text-sm text-slate-400 text-center py-6">{text}</div>
);

const BreakdownRow = ({ label, cost, requests, max }) => {
  const pct = max > 0 ? Math.max(2, Math.round((Number(cost) / Number(max)) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs mb-0.5">
        <span className="font-medium text-slate-700 capitalize">{label}</span>
        <span className="text-slate-500">
          <span className="tabular-nums">{fmtNum(requests)}</span> reqs ·{' '}
          <span className="tabular-nums font-semibold text-slate-700">{fmtUSD(cost)}</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// HonoraryEditorModal — soft-coded add/edit form.
// Field list is driven by EDITOR_FIELDS so adding a new attribute is a
// single line change.
// ---------------------------------------------------------------------------
const EDITOR_FIELDS = [
  { key: 'name',    label: 'Full name *',  type: 'text',     placeholder: 'e.g. Tanzeem Agra' },
  { key: 'email',   label: 'Email *',      type: 'email',    placeholder: 'user@company.com' },
  { key: 'title',   label: 'Title / Role', type: 'text',     placeholder: 'e.g. Lead Developer' },
  { key: 'since',   label: 'Contributing since', type: 'date' },
  { key: 'avatar',  label: 'Avatar URL',   type: 'url',      placeholder: 'https://…' },
  { key: 'tagline', label: 'Tagline',      type: 'text',     placeholder: 'One-line motto' },
];

const HonoraryEditorModal = ({ mode, draft, onCancel, onSave }) => {
  const [form, setForm] = useState(draft || {});

  useEffect(() => {
    setForm(draft || {});
  }, [draft]);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const achievementsText = Array.isArray(form.achievements)
    ? form.achievements.join('\n')
    : (form.achievements || '');

  const linksText = Array.isArray(form.links)
    ? form.links.map((l) => `${l.label} | ${l.href}`).join('\n')
    : '';

  const handleSubmit = (e) => {
    e.preventDefault();
    const links = linksText
      .split('\n')
      .map((line) => {
        const [label, href] = line.split('|').map((s) => (s || '').trim());
        return label && href ? { label, href } : null;
      })
      .filter(Boolean);
    onSave({
      ...form,
      achievements: achievementsText.split('\n').map((a) => a.trim()).filter(Boolean),
      links,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-slate-800">
            {mode === 'edit' ? 'Edit Honorary Member' : 'Add Honorary Member'}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="ml-auto p-1 rounded-md text-slate-500 hover:bg-slate-100"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {EDITOR_FIELDS.map((f) => (
            <label key={f.key} className="text-xs font-medium text-slate-600 block">
              {f.label}
              <input
                type={f.type}
                placeholder={f.placeholder || ''}
                value={form[f.key] || ''}
                onChange={(e) => update(f.key, e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 text-sm text-slate-800"
              />
            </label>
          ))}

          <label className="text-xs font-medium text-slate-600 block">
            Tier
            <select
              value={form.tier || HOF_TIER_OPTIONS[0].id}
              onChange={(e) => update('tier', e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 text-sm text-slate-800"
            >
              {HOF_TIER_OPTIONS.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-slate-600 block md:col-span-2">
            Achievements (one per line)
            <textarea
              rows={4}
              value={achievementsText}
              onChange={(e) => update('achievements', e.target.value)}
              placeholder={'e.g. Founded the platform\nDesigned the RBAC system'}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 text-sm text-slate-800"
            />
          </label>

          <label className="text-xs font-medium text-slate-600 block md:col-span-2">
            Links (one per line — format: <code>Label | https://url</code>)
            <textarea
              rows={2}
              defaultValue={linksText}
              onChange={(e) => update('_linksRaw', e.target.value)}
              placeholder={'LinkedIn | https://linkedin.com/in/user'}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 text-sm text-slate-800"
              onBlur={(e) => {
                const links = e.target.value
                  .split('\n')
                  .map((line) => {
                    const [label, href] = line.split('|').map((s) => (s || '').trim());
                    return label && href ? { label, href } : null;
                  })
                  .filter(Boolean);
                update('links', links);
              }}
            />
          </label>
        </div>
        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1"
          >
            <CheckBadgeIcon className="w-4 h-4" />
            {mode === 'edit' ? 'Save Changes' : 'Add Member'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AIChampion;
