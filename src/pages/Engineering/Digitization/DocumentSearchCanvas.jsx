/**
 * DocumentSearchCanvas
 * --------------------------------------------------------------------------
 * Search across every bulk-batch metadata record AND visualise where the
 * matched value lives inside the source PDF — analogous to the P&ID QC
 * overlay markers, but driven from the stored PDF on demand (no schema
 * change, no precomputed coordinates).
 *
 * Soft-coded surface in `SEARCH_CFG`:
 *   • endpoints  : 3 backend routes (search / locate / page-image)
 *   • debounceMs : input debounce
 *   • overlay    : marker box appearance
 *   • columns    : result-row columns
 *
 * Pure additive component — no external feature is touched.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  XMarkIcon,
  DocumentTextIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../../services/api.service';
import { getApiBaseUrl } from '../../../config/environment.config';

// ---------------------------------------------------------------------------
// Soft-coded configuration
// ---------------------------------------------------------------------------
const SEARCH_CFG = {
  endpoints: {
    search:    '/non-teff/search/',
    locate:    (batchId, itemId) => `/non-teff/batch/${batchId}/items/${itemId}/locate/`,
    pageImage: (batchId, itemId, page) => `/non-teff/batch/${batchId}/items/${itemId}/page/${page}/image/`,
    recommend: (batchId, itemId) => `/non-teff/batch/${batchId}/items/${itemId}/recommend/`,
    yellow:    (batchId, itemId) => `/non-teff/batch/${batchId}/items/${itemId}/yellow/`,
    // Batch items listing — drives the "Files in batch" folder tree.
    batchItems: (batchId) => `/non-teff/batch/${batchId}/items/`,
  },
  // Debounce keystrokes before firing /search.
  debounceMs: 350,
  // Minimum chars before search is triggered.
  minQueryLen: 2,
  // Max results displayed in the left list.
  maxResults: 200,
  // Overlay rectangle styling (mirrors PIDVerification DUP_HIGHLIGHT_*).
  overlay: {
    borderColor: '#dc2626',
    fillColor:   'rgba(220, 38, 38, 0.18)',
    borderWidth: 2,
    pulseMs:     1800,
    activeBorder:'#7c3aed',
    activeFill:  'rgba(124, 58, 237, 0.22)',
  },
  columns: [
    { key: 'file_name',     label: 'Document',      flex: 1.4 },
    { key: 'matched_field', label: 'Field',         flex: 0.8 },
    { key: 'matched_value', label: 'Match',         flex: 1.2 },
    { key: 'status',        label: 'Status',        flex: 0.6 },
  ],
  statusColors: {
    ready:      { bg: 'rgba(5,150,105,0.12)',  fg: '#047857' },
    extracting: { bg: 'rgba(8,145,178,0.12)',  fg: '#0e7490' },
    failed:     { bg: 'rgba(220,38,38,0.10)',  fg: '#b91c1c' },
    uploaded:   { bg: 'rgba(124,58,237,0.10)', fg: '#6d28d9' },
    pending:    { bg: 'rgba(107,114,128,0.10)',fg: '#374151' },
  },
  // Smart hover recommendations (AI advisor) ------------------------------
  reco: {
    enabled: true,
    // Dwell time before AI fetch fires (ms). Prevents accidental hover spam.
    hoverDwellMs: 450,
    // Minimum hover-card delay so the card does not flash as the mouse moves.
    showAfterMs: 200,
    // Tooltip dimensions (clamped to viewport in render).
    cardWidthPx: 320,
    cardOffsetPx: 14,
    // Max bullets shown per section (server already caps to 5).
    maxBullets: 5,
    // Confidence colour mapping.
    confidenceColors: {
      high:   { bg: 'rgba(5,150,105,0.10)', fg: '#047857' },
      medium: { bg: 'rgba(217,119,6,0.10)', fg: '#b45309' },
      low:    { bg: 'rgba(107,114,128,0.10)',fg: '#374151' },
    },
  },
  // Yellow-highlight detection overlay ------------------------------------
  yellow: {
    enabled: true,
    // Rect outline + fill for detected highlight regions.
    borderColor: '#ca8a04',
    fillColor:   'rgba(250,204,21,0.18)',
    activeBorder:'#a16207',
    activeFill:  'rgba(250,204,21,0.35)',
    borderWidth: 2,
    // Toggle button visibility on the toolbar.
    showToggle:  true,
  },
  // Page browser ----------------------------------------------------------
  // Lets the user step through EVERY page of the PDF, not only the pages
  // that contain a hit. Hit pages are flagged with a coloured dot so they
  // stay easy to find.
  browser: {
    enabled:        true,
    defaultMode:    'all',          // 'all' | 'hits'
    stripMaxButtons: 40,            // cap so a 2000-page PDF cannot blow the DOM
    hitDotColor:    '#dc2626',
    hitDotSize:     6,
    activePageBg:   'rgba(124,58,237,0.18)',
    activePageFg:   '#6d28d9',
  },
  // Files-in-batch tree --------------------------------------------------
  // Lists every file in the currently-selected item's batch, grouped by
  // folder (derived from `relative_path`). Clicking a file switches the
  // canvas to that item without losing the search context.
  filesTree: {
    enabled:           true,
    pageSize:          500,
    showStatusBadge:   true,
    autoCollapseAbove: 6,            // when there are more than N folders
    rootLabel:         'Top level',
    fileNameMaxChars:  38,
    activeBg:          'rgba(5,150,105,0.10)',
    activeFg:          '#047857',
  },
};

// Pulse keyframe is local to this component to avoid global CSS pollution.
const SEARCH_KEYFRAMES = `
  @keyframes dscPulse {
    0%   { box-shadow: 0 0 0 0 rgba(220,38,38,0.55); }
    70%  { box-shadow: 0 0 0 10px rgba(220,38,38,0); }
    100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); }
  }
  @keyframes dscSpin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
`;

// ---------------------------------------------------------------------------
// Small UI helpers
// ---------------------------------------------------------------------------
const StatusPill = ({ status }) => {
  const palette = SEARCH_CFG.statusColors[status] || SEARCH_CFG.statusColors.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 999,
      fontSize: 11, fontWeight: 600,
      background: palette.bg, color: palette.fg,
      textTransform: 'uppercase', letterSpacing: 0.4,
    }}>{status}</span>
  );
};

const Spinner = () => (
  <ArrowPathIcon style={{ width: 16, height: 16, animation: 'dscSpin 1s linear infinite' }} />
);

// ---------------------------------------------------------------------------
// Smart Recommendations hover card
// ---------------------------------------------------------------------------
const RecoHoverCard = ({ pos, loading, error, data }) => {
  const cfg = SEARCH_CFG.reco;
  // Position the card near the cursor but clamp to keep it on-screen.
  const left = Math.max(8, pos.x + cfg.cardOffsetPx);
  const top  = Math.max(8, pos.y + cfg.cardOffsetPx);

  const confKey = (data?.confidence || 'medium').toLowerCase();
  const confPalette = cfg.confidenceColors[confKey] || cfg.confidenceColors.medium;

  const renderList = (items, color) => (
    <ul style={{ margin: '4px 0 0 0', paddingLeft: 16 }}>
      {(items || []).slice(0, cfg.maxBullets).map((it, i) => (
        <li key={i} style={{ fontSize: 11.5, color, marginBottom: 2 }}>{it}</li>
      ))}
    </ul>
  );

  return (
    <div
      style={{
        position: 'absolute',
        left, top,
        width: cfg.cardWidthPx,
        maxWidth: '92%',
        background: 'white',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 10,
        boxShadow: '0 12px 32px rgba(15,23,42,0.18)',
        padding: 12,
        zIndex: 50,
        pointerEvents: 'none',
        fontSize: 12,
        color: '#0f172a',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
            color: 'white', fontWeight: 700, fontSize: 10,
            padding: '2px 8px', borderRadius: 999, letterSpacing: 0.4,
          }}
        >AI</span>
        <span style={{ fontWeight: 700, fontSize: 12.5 }}>Smart Recommendations</span>
        <span style={{ marginLeft: 'auto' }}>
          {loading && <Spinner />}
        </span>
      </div>

      {error && !loading && (
        <div style={{ color: '#b91c1c', fontSize: 11.5 }}>{error}</div>
      )}

      {!loading && !error && !data && (
        <div style={{ color: '#6b7280', fontSize: 11.5 }}>Hold to load suggestions…</div>
      )}

      {data && (
        <>
          {data.summary && (
            <div style={{ fontSize: 12, color: '#1f2937', marginBottom: 6, lineHeight: 1.4 }}>
              {data.summary}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
            {data.inferred_type && (
              <span style={{
                fontSize: 10.5, padding: '2px 7px', borderRadius: 999,
                background: 'rgba(8,145,178,0.10)', color: '#0e7490', fontWeight: 600,
              }}>{data.inferred_type}</span>
            )}
            {data.discipline && data.discipline !== 'other' && (
              <span style={{
                fontSize: 10.5, padding: '2px 7px', borderRadius: 999,
                background: 'rgba(124,58,237,0.10)', color: '#6d28d9', fontWeight: 600,
                textTransform: 'capitalize',
              }}>{data.discipline}</span>
            )}
            <span style={{
              fontSize: 10.5, padding: '2px 7px', borderRadius: 999,
              background: confPalette.bg, color: confPalette.fg, fontWeight: 600,
            }}>confidence: {confKey}</span>
          </div>

          {(data.missing_fields || []).length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: '#b45309' }}>Likely missing</div>
              {renderList(data.missing_fields, '#92400e')}
            </div>
          )}

          {(data.quality_flags || []).length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: '#b91c1c' }}>Quality flags</div>
              {renderList(data.quality_flags, '#991b1b')}
            </div>
          )}

          {(data.next_actions || []).length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: '#047857' }}>Next actions</div>
              {renderList(data.next_actions, '#065f46')}
            </div>
          )}

          {data.provider && (
            <div style={{ marginTop: 8, fontSize: 10, color: '#9ca3af' }}>
              via {data.provider}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const DocumentSearchCanvas = ({ preselect = null } = {}) => {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [searchError, setSearchError] = useState(null);
  const [batchFilter, setBatchFilter] = useState('');

  const [selected, setSelected] = useState(null);     // active result row
  const [locateData, setLocateData] = useState(null); // /locate/ payload
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState(null);
  const [activePage, setActivePage] = useState(1);
  const [pageImageUrl, setPageImageUrl] = useState(null);
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);

  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

  // ── Smart hover recommendations (AI advisor) ──────────────────────────
  const [reco, setReco] = useState(null);          // { provider, summary, ... }
  const [recoLoading, setRecoLoading] = useState(false);
  const [recoError, setRecoError] = useState(null);
  const [hoverPos, setHoverPos] = useState(null);  // { x, y }
  const [showCard, setShowCard] = useState(false);
  const recoCacheRef = useRef(new Map());          // item_id → reco payload
  const hoverTimerRef = useRef(null);
  const fetchTimerRef = useRef(null);

  // ── Yellow-region detection (highlight stamps) ──────────────────────────
  const [yellowRegions, setYellowRegions] = useState([]);
  const [yellowLoading, setYellowLoading] = useState(false);
  const [yellowError, setYellowError] = useState(null);
  const [showYellow, setShowYellow] = useState(true);
  const [activeYellowIdx, setActiveYellowIdx] = useState(-1);
  const yellowCacheRef = useRef(new Map());

  // ── Files-in-batch tree (left-pane companion view) ──────────────────────
  // Items belonging to the currently-selected item's batch, grouped by folder.
  // Soft-coded — disable by flipping SEARCH_CFG.filesTree.enabled.
  const [batchItems, setBatchItems]   = useState([]);
  const [batchItemsBatchId, setBatchItemsBatchId] = useState(null);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError]   = useState(null);
  const [leftTab, setLeftTab] = useState('search');       // 'search' | 'files'
  const [collapsedFolders, setCollapsedFolders] = useState(() => new Set());
  // Page browser mode: 'hits' or 'all'. Soft-coded default.
  const [pageBrowserMode, setPageBrowserMode] = useState(
    SEARCH_CFG.browser.defaultMode,
  );

  // ── Auto-select when parent passes a preselect target (row-click bridge) ─
  useEffect(() => {
    if (!preselect || !preselect.batch_id || !preselect.item_id) return;
    // Build a synthetic "search result" so the canvas pipeline triggers.
    const synthetic = {
      kind: 'batch',
      batch_id: preselect.batch_id,
      item_id:  preselect.item_id,
      file_name: preselect.file_name || '',
      matched_field: 'tag',
      matched_value: preselect.query || preselect.file_name || '',
      status: 'ready',
      batch_name: '',
      fields: preselect.fields || {},
    };
    setSelected(synthetic);
    if (preselect.query) setQuery(preselect.query);
  }, [preselect?.batch_id, preselect?.item_id, preselect?.query]);  // eslint-disable-line

  // ── Debounce input ──────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), SEARCH_CFG.debounceMs);
    return () => clearTimeout(t);
  }, [query]);

  // ── Run search whenever debounced query changes ─────────────────────────
  useEffect(() => {
    if (debounced.length < SEARCH_CFG.minQueryLen) {
      setResults([]); setSearchError(null); return;
    }
    let cancelled = false;
    setSearching(true);
    setSearchError(null);
    apiClient
      .get(SEARCH_CFG.endpoints.search, {
        params: { q: debounced, batch_id: batchFilter || undefined },
      })
      .then((res) => {
        if (cancelled) return;
        setResults(res.data?.results || []);
      })
      .catch((e) => {
        if (cancelled) return;
        setSearchError(e?.response?.data?.error || e.message || 'Search failed.');
        setResults([]);
      })
      .finally(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; };
  }, [debounced, batchFilter]);

  // ── Group matches by page for nav ───────────────────────────────────────
  const matchesByPage = useMemo(() => {
    const map = new Map();
    (locateData?.matches || []).forEach((m, i) => {
      if (!map.has(m.page)) map.set(m.page, []);
      map.get(m.page).push({ ...m, _idx: i });
    });
    return map;
  }, [locateData]);

  const pagesWithHits = useMemo(
    () => Array.from(matchesByPage.keys()).sort((a, b) => a - b),
    [matchesByPage],
  );

  // ── Run /locate/ when a row is selected ─────────────────────────────────
  useEffect(() => {
    if (!selected || selected.kind !== 'batch') {
      setLocateData(null); setPageImageUrl(null); return;
    }
    let cancelled = false;
    setLocating(true);
    setLocateError(null);
    setLocateData(null);
    setPageImageUrl(null);
    setActiveMatchIdx(0);
    apiClient
      .get(SEARCH_CFG.endpoints.locate(selected.batch_id, selected.item_id), {
        params: { q: selected.matched_value || debounced },
      })
      .then((res) => {
        if (cancelled) return;
        setLocateData(res.data || { matches: [], page_count: 0 });
        const firstPage = (res.data?.matches?.[0]?.page) || 1;
        setActivePage(firstPage);
      })
      .catch((e) => {
        if (cancelled) return;
        setLocateError(e?.response?.data?.error || e.message || 'Locate failed.');
      })
      .finally(() => { if (!cancelled) setLocating(false); });
    return () => { cancelled = true; };
  }, [selected, debounced]);

  // ── Build page image URL (auth header lives on apiClient → use baseUrl) ─
  useEffect(() => {
    if (!selected || selected.kind !== 'batch' || !activePage) {
      setPageImageUrl(null); return;
    }
    let cancelled = false;
    // Fetch the binary so axios injects auth headers, then create blob URL.
    apiClient
      .get(SEARCH_CFG.endpoints.pageImage(selected.batch_id, selected.item_id, activePage), {
        responseType: 'blob',
      })
      .then((res) => {
        if (cancelled) return;
        const url = URL.createObjectURL(res.data);
        setPageImageUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      })
      .catch(() => {
        if (cancelled) return;
        setPageImageUrl(null);
      });
    return () => { cancelled = true; };
  }, [selected, activePage]);

  // ── Smart Recommendations: fetch lazily on first hover (cached) ─────────
  const ensureRecommendations = useCallback(() => {
    if (!SEARCH_CFG.reco.enabled) return;
    if (!selected || selected.kind !== 'batch') return;
    const cacheKey = `${selected.batch_id}:${selected.item_id}`;
    const cached = recoCacheRef.current.get(cacheKey);
    if (cached) {
      setReco(cached); setRecoError(null); setRecoLoading(false);
      return;
    }
    if (recoLoading) return;
    setRecoLoading(true);
    setRecoError(null);
    apiClient
      .get(SEARCH_CFG.endpoints.recommend(selected.batch_id, selected.item_id))
      .then((res) => {
        const payload = res?.data?.recommendations || null;
        if (payload) recoCacheRef.current.set(cacheKey, payload);
        setReco(payload);
      })
      .catch((err) => {
        setRecoError(err?.response?.data?.detail || 'Recommendations unavailable');
        setReco(null);
      })
      .finally(() => setRecoLoading(false));
  }, [selected, recoLoading]);

  // Reset hover + reco state when selection changes.
  useEffect(() => {
    setReco(null); setRecoError(null); setShowCard(false);
    setHoverPos(null);
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
  }, [selected?.batch_id, selected?.item_id]);

  // Hover handlers on the rendered diagram.
  const handleDiagramMouseMove = useCallback((e) => {
    if (!SEARCH_CFG.reco.enabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    // Debounced "dwell" detection — fetch once dwell threshold passes.
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(() => {
      ensureRecommendations();
    }, SEARCH_CFG.reco.hoverDwellMs);
    // Show card after a tiny delay so flicker is suppressed.
    if (!showCard) {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => setShowCard(true), SEARCH_CFG.reco.showAfterMs);
    }
  }, [ensureRecommendations, showCard]);

  const handleDiagramMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    setShowCard(false);
  }, []);

  useEffect(() => () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
  }, []);

  // ── Fetch yellow-region detections lazily once selection changes ────────
  useEffect(() => {
    if (!SEARCH_CFG.yellow.enabled) return;
    if (!selected || selected.kind !== 'batch') {
      setYellowRegions([]); setActiveYellowIdx(-1); return;
    }
    const cacheKey = `${selected.batch_id}:${selected.item_id}`;
    const cached = yellowCacheRef.current.get(cacheKey);
    if (cached) {
      setYellowRegions(cached); setYellowError(null); setYellowLoading(false);
      return;
    }
    let cancelled = false;
    setYellowLoading(true); setYellowError(null);
    apiClient
      .get(SEARCH_CFG.endpoints.yellow(selected.batch_id, selected.item_id))
      .then((res) => {
        if (cancelled) return;
        const regs = res?.data?.regions || [];
        yellowCacheRef.current.set(cacheKey, regs);
        setYellowRegions(regs);
      })
      .catch((err) => {
        if (cancelled) return;
        setYellowError(err?.response?.data?.detail || 'Yellow detection unavailable');
        setYellowRegions([]);
      })
      .finally(() => { if (!cancelled) setYellowLoading(false); });
    return () => { cancelled = true; };
  }, [selected?.batch_id, selected?.item_id]);  // eslint-disable-line

  // Cleanup blob URLs on unmount.
  useEffect(() => () => { if (pageImageUrl) URL.revokeObjectURL(pageImageUrl); }, []); // eslint-disable-line

  // ── Load all items in the active batch (for the folder tree) ───────────
  useEffect(() => {
    if (!SEARCH_CFG.filesTree.enabled) return;
    const bid = selected?.batch_id;
    if (!bid || selected?.kind !== 'batch') {
      setBatchItems([]); setBatchItemsBatchId(null); return;
    }
    // Avoid re-fetching if we already have items for this batch.
    if (batchItemsBatchId === bid && batchItems.length > 0) return;
    let cancelled = false;
    setFilesLoading(true);
    setFilesError(null);
    apiClient
      .get(SEARCH_CFG.endpoints.batchItems(bid), {
        params: { page: 1, page_size: SEARCH_CFG.filesTree.pageSize },
      })
      .then((res) => {
        if (cancelled) return;
        setBatchItems(res.data?.items || []);
        setBatchItemsBatchId(bid);
      })
      .catch((err) => {
        if (cancelled) return;
        setFilesError(err?.response?.data?.error || err.message || 'Files unavailable');
        setBatchItems([]);
      })
      .finally(() => { if (!cancelled) setFilesLoading(false); });
    return () => { cancelled = true; };
  }, [selected?.batch_id, selected?.kind]);  // eslint-disable-line

  // ── Folder tree: derive { folder → items[] } from batchItems ───────────
  const filesTree = useMemo(() => {
    const groups = new Map();
    const root = SEARCH_CFG.filesTree.rootLabel;
    (batchItems || []).forEach((it) => {
      const rp = (it.relative_path || it.file_name || '').replace(/\\/g, '/');
      const lastSlash = rp.lastIndexOf('/');
      const folder = lastSlash > 0 ? rp.slice(0, lastSlash) : root;
      if (!groups.has(folder)) groups.set(folder, []);
      groups.get(folder).push(it);
    });
    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([folder, items]) => ({ folder, items }));
  }, [batchItems]);

  // Auto-collapse all folders once tree grows large (one-shot per batch).
  useEffect(() => {
    if (!filesTree.length) return;
    if (filesTree.length > SEARCH_CFG.filesTree.autoCollapseAbove) {
      const initial = new Set(filesTree.map(g => g.folder));
      // Keep the folder containing the active file open.
      const activeRp = (selected?.relative_path || '').replace(/\\/g, '/');
      const idx = activeRp.lastIndexOf('/');
      const activeFolder = idx > 0 ? activeRp.slice(0, idx) : SEARCH_CFG.filesTree.rootLabel;
      initial.delete(activeFolder);
      setCollapsedFolders(initial);
    } else {
      setCollapsedFolders(new Set());
    }
  }, [batchItemsBatchId]);  // eslint-disable-line

  // Switch the canvas to a sibling file from the folder tree.
  const selectBatchItem = useCallback((it) => {
    if (!it || !it.item_id) return;
    setSelected({
      kind: 'batch',
      batch_id: it.batch_id || selected?.batch_id,
      item_id:  it.item_id,
      file_name: it.file_name,
      relative_path: it.relative_path,
      matched_field: 'file_name',
      matched_value: (it.fields?.tag || it.fields?.document_number || it.file_name || '').trim(),
      status: it.status,
      batch_name: selected?.batch_name || '',
      fields: it.fields || {},
    });
    // Keep the Files tab active so the user can keep hopping between siblings.
    setLeftTab('files');
  }, [selected?.batch_id, selected?.batch_name]);

  const toggleFolder = useCallback((folder) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else                  next.add(folder);
      return next;
    });
  }, []);


  // ── Image natural size for overlay scaling (we render scaled-to-fit) ───
  const handleImgLoad = useCallback(() => {
    if (imgRef.current) {
      setImgSize({
        w: imgRef.current.clientWidth,
        h: imgRef.current.clientHeight,
      });
    }
  }, []);

  const matchesOnActivePage = matchesByPage.get(activePage) || [];
  const yellowOnActivePage = (yellowRegions || []).filter((r) => r.page === activePage);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{
      display: 'grid',
      gridTemplateColumns: '380px 1fr',
      gap: 16,
      minHeight: 600,
      background: 'rgba(255,255,255,0.78)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(5,150,105,0.18)',
      borderRadius: 16,
      padding: 16,
      boxShadow: '0 10px 40px -16px rgba(15,23,42,0.18)',
    }}>
      <style>{SEARCH_KEYFRAMES}</style>

      {/* ── Left pane: search + result list ─────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 600 }}>
        {/* Left-pane tabs: switch between Search results and Files in this batch.
            Files tab only enabled when a batch item is selected (so we know
            which batch's items to load). Soft-coded via SEARCH_CFG.filesTree. */}
        {SEARCH_CFG.filesTree.enabled && (
          <div style={{
            display: 'inline-flex', marginBottom: 10,
            border: '1px solid rgba(5,150,105,0.20)', borderRadius: 10,
            overflow: 'hidden', background: 'white',
            alignSelf: 'flex-start',
          }}>
            {[
              { id: 'search', label: 'Search', count: results.length },
              { id: 'files',  label: 'Files in batch', count: batchItems.length, disabled: !selected || selected.kind !== 'batch' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => !t.disabled && setLeftTab(t.id)}
                disabled={t.disabled}
                style={{
                  padding: '6px 12px', fontSize: 12, fontWeight: 600,
                  border: 'none', cursor: t.disabled ? 'not-allowed' : 'pointer',
                  background: leftTab === t.id ? 'rgba(5,150,105,0.10)' : 'white',
                  color: t.disabled ? '#9ca3af' : (leftTab === t.id ? '#047857' : '#374151'),
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
                title={t.disabled ? 'Select a batch document first' : t.label}
              >
                {t.label}
                {(t.count > 0) && (
                  <span style={{
                    minWidth: 18, padding: '0 5px', borderRadius: 999,
                    background: leftTab === t.id ? '#047857' : 'rgba(0,0,0,0.08)',
                    color: leftTab === t.id ? 'white' : '#374151',
                    fontSize: 10, lineHeight: '16px',
                  }}>{t.count}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {leftTab === 'search' && (
        <>
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <MagnifyingGlassIcon style={{
            width: 18, height: 18,
            position: 'absolute', left: 12, top: '50%',
            transform: 'translateY(-50%)', color: '#6b7280',
          }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tag, doc number, equipment, line…"
            style={{
              width: '100%', padding: '10px 36px 10px 38px',
              borderRadius: 10,
              border: '1px solid rgba(5,150,105,0.25)',
              fontSize: 14, outline: 'none',
              background: 'white',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
                position: 'absolute', right: 8, top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent', border: 'none',
                cursor: 'pointer', color: '#6b7280', padding: 4,
              }}
              title="Clear"
            >
              <XMarkIcon style={{ width: 18, height: 18 }} />
            </button>
          )}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, color: '#374151', marginBottom: 10,
        }}>
          {searching ? <><Spinner /><span>Searching…</span></>
            : <span>{results.length} match{results.length === 1 ? '' : 'es'}</span>}
          {searchError && <span style={{ color: '#b91c1c' }}>· {searchError}</span>}
        </div>

        <div style={{
          flex: 1, overflowY: 'auto',
          border: '1px solid rgba(0,0,0,0.06)',
          borderRadius: 10,
          background: 'white',
        }}>
          {results.length === 0 && !searching && (
            <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              {debounced.length < SEARCH_CFG.minQueryLen
                ? 'Type at least 2 characters to search'
                : 'No documents matched'}
            </div>
          )}
          {results.map((r, i) => {
            const id = r.kind === 'batch' ? `${r.batch_id}:${r.item_id}` : `${r.kind}:${r.job_id}:${r.row_index}`;
            const isSel = selected && (selected.kind === 'batch'
              ? selected.batch_id === r.batch_id && selected.item_id === r.item_id
              : selected.job_id === r.job_id && selected.row_index === r.row_index);
            return (
              <button
                key={id + i}
                onClick={() => setSelected(r)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '10px 12px',
                  border: 'none',
                  borderBottom: '1px solid rgba(0,0,0,0.05)',
                  background: isSel ? 'rgba(124,58,237,0.08)' : 'transparent',
                  cursor: r.kind === 'batch' ? 'pointer' : 'not-allowed',
                  opacity: r.kind === 'batch' ? 1 : 0.55,
                }}
                disabled={r.kind !== 'batch'}
                title={r.kind === 'batch' ? 'Click to locate on canvas' : 'Single-file jobs are not visualisable yet'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <DocumentTextIcon style={{ width: 14, height: 14, color: '#0891b2' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a',
                                 overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.file_name}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#374151', marginBottom: 4 }}>
                  <span style={{ color: '#7c3aed', fontWeight: 600 }}>{r.matched_field}</span>
                  <span style={{ color: '#0f172a' }}>{r.matched_value}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: '#6b7280' }}>{r.batch_name}</span>
                  <StatusPill status={r.status} />
                </div>
              </button>
            );
          })}
        </div>
        </>
        )}

        {leftTab === 'files' && SEARCH_CFG.filesTree.enabled && (
          <div style={{
            flex: 1, overflowY: 'auto',
            border: '1px solid rgba(0,0,0,0.06)',
            borderRadius: 10,
            background: 'white',
          }}>
            {filesLoading && (
              <div style={{ padding: 16, color: '#374151', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Spinner /> Loading files…
              </div>
            )}
            {!filesLoading && filesError && (
              <div style={{ padding: 16, color: '#b91c1c', fontSize: 12 }}>{filesError}</div>
            )}
            {!filesLoading && !filesError && batchItems.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                No files in this batch.
              </div>
            )}
            {!filesLoading && !filesError && filesTree.map((grp) => {
              const collapsed = collapsedFolders.has(grp.folder);
              return (
                <div key={grp.folder} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  <button
                    onClick={() => toggleFolder(grp.folder)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      width: '100%', textAlign: 'left',
                      padding: '8px 10px',
                      border: 'none', background: 'rgba(5,150,105,0.04)',
                      cursor: 'pointer',
                      fontSize: 12, fontWeight: 700, color: '#065f46',
                    }}
                    title={grp.folder}
                  >
                    <span style={{ width: 12, fontSize: 10 }}>{collapsed ? '▶' : '▼'}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {grp.folder}
                    </span>
                    <span style={{
                      background: '#047857', color: 'white',
                      padding: '0 6px', borderRadius: 999,
                      fontSize: 10, fontWeight: 700,
                    }}>{grp.items.length}</span>
                  </button>
                  {!collapsed && grp.items.map((it) => {
                    const isActive = selected?.item_id === it.item_id;
                    const display  = it.file_name || '';
                    const max = SEARCH_CFG.filesTree.fileNameMaxChars;
                    const shown = display.length > max
                      ? display.slice(0, max - 1) + '…'
                      : display;
                    const clickable = it.status === 'ready';
                    return (
                      <button
                        key={it.item_id}
                        onClick={() => clickable && selectBatchItem(it)}
                        disabled={!clickable}
                        title={clickable
                          ? `${it.relative_path || it.file_name} — click to locate`
                          : `${it.status} — not browsable yet`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          width: '100%', textAlign: 'left',
                          padding: '6px 12px 6px 28px',
                          border: 'none',
                          borderTop: '1px solid rgba(0,0,0,0.03)',
                          background: isActive ? SEARCH_CFG.filesTree.activeBg : 'transparent',
                          color:      isActive ? SEARCH_CFG.filesTree.activeFg : '#1f2937',
                          cursor: clickable ? 'pointer' : 'not-allowed',
                          opacity: clickable ? 1 : 0.55,
                          fontSize: 12,
                        }}
                      >
                        <DocumentTextIcon style={{ width: 12, height: 12, flexShrink: 0, color: isActive ? '#047857' : '#0891b2' }} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {shown}
                        </span>
                        {SEARCH_CFG.filesTree.showStatusBadge && (
                          <StatusPill status={it.status} />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Right pane: canvas ─────────────────────────────────────────── */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 600 }}>
        {!selected && (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(5,150,105,0.04), rgba(124,58,237,0.04))',
            border: '1px dashed rgba(5,150,105,0.25)', borderRadius: 12,
            color: '#6b7280', fontSize: 14, padding: 32, textAlign: 'center',
          }}>
            <div>
              <MapPinIcon style={{ width: 36, height: 36, color: '#0891b2', margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 600, color: '#0f172a' }}>Search and select a document</div>
              <div style={{ marginTop: 4 }}>The canvas will highlight the location of the matched value inside the source PDF.</div>
            </div>
          </div>
        )}

        {selected && (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selected.file_name}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  Locating <span style={{ color: '#7c3aed', fontWeight: 600 }}>"{selected.matched_value}"</span>
                  {locateData?.page_count ? ` · ${locateData.matches?.length || 0} hit(s) across ${pagesWithHits.length} page(s)` : ''}
                </div>
              </div>

              {/* Yellow-stamps toggle */}
              {SEARCH_CFG.yellow.enabled && SEARCH_CFG.yellow.showToggle && (
                <button
                  onClick={() => setShowYellow((v) => !v)}
                  title={showYellow ? 'Hide yellow stamps' : 'Show yellow stamps'}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', borderRadius: 999,
                    fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
                    border: `1px solid ${showYellow ? '#ca8a04' : 'rgba(0,0,0,0.10)'}`,
                    background: showYellow ? 'rgba(250,204,21,0.18)' : 'white',
                    color: showYellow ? '#854d0e' : '#374151',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{
                    width: 10, height: 10, borderRadius: 2,
                    background: '#facc15', border: '1px solid #ca8a04',
                  }} />
                  Yellow stamps
                  {yellowLoading
                    ? <Spinner />
                    : (yellowRegions.length > 0
                        ? <span style={{
                            background: '#ca8a04', color: 'white',
                            borderRadius: 999, padding: '0 6px', fontSize: 10,
                          }}>{yellowRegions.length}</span>
                        : null)
                  }
                </button>
              )}

              {/* Page browser — full multi-page navigation, soft-coded.
                   Shows even when there are zero/one hit pages so the user
                   can step through the WHOLE PDF (was previously hidden
                   unless ≥2 hit pages, leaving users stuck on the title
                   page when no hit was found). */}
              {SEARCH_CFG.browser.enabled && (locateData?.page_count || 0) > 1 && (() => {
                const pageCount = locateData.page_count;
                const allPages  = Array.from({ length: pageCount }, (_, i) => i + 1);
                const stripPages = pageBrowserMode === 'hits' ? pagesWithHits : allPages;
                const cap = SEARCH_CFG.browser.stripMaxButtons;
                // Window the strip around the active page when over the cap.
                let windowed = stripPages;
                if (stripPages.length > cap) {
                  const half = Math.floor(cap / 2);
                  const idx  = stripPages.indexOf(activePage);
                  const start = Math.max(0, (idx >= 0 ? idx : 0) - half);
                  windowed = stripPages.slice(start, start + cap);
                }
                const hitSet = new Set(pagesWithHits);
                const goTo = (p) => {
                  if (p < 1 || p > pageCount) return;
                  setActivePage(p);
                };
                const stepPrev = () => {
                  if (pageBrowserMode === 'hits') {
                    const i = pagesWithHits.indexOf(activePage);
                    if (i > 0) goTo(pagesWithHits[i - 1]);
                    else if (i < 0 && pagesWithHits.length) goTo(pagesWithHits[0]);
                  } else {
                    goTo(activePage - 1);
                  }
                };
                const stepNext = () => {
                  if (pageBrowserMode === 'hits') {
                    const i = pagesWithHits.indexOf(activePage);
                    if (i >= 0 && i < pagesWithHits.length - 1) goTo(pagesWithHits[i + 1]);
                    else if (i < 0 && pagesWithHits.length) goTo(pagesWithHits[0]);
                  } else {
                    goTo(activePage + 1);
                  }
                };
                const prevDisabled = pageBrowserMode === 'hits'
                  ? (pagesWithHits.indexOf(activePage) <= 0)
                  : activePage <= 1;
                const nextDisabled = pageBrowserMode === 'hits'
                  ? (pagesWithHits.indexOf(activePage) >= pagesWithHits.length - 1)
                  : activePage >= pageCount;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {/* Mode toggle: hits-only vs all pages */}
                    {pagesWithHits.length > 0 && (
                      <div style={{
                        display: 'inline-flex', border: '1px solid rgba(0,0,0,0.10)',
                        borderRadius: 8, overflow: 'hidden',
                      }}>
                        {['hits', 'all'].map((m) => (
                          <button
                            key={m}
                            onClick={() => setPageBrowserMode(m)}
                            style={{
                              padding: '4px 10px', fontSize: 11, fontWeight: 600,
                              border: 'none', cursor: 'pointer',
                              background: pageBrowserMode === m ? SEARCH_CFG.browser.activePageBg : 'white',
                              color:      pageBrowserMode === m ? SEARCH_CFG.browser.activePageFg : '#374151',
                            }}
                            title={m === 'hits' ? `Pages with hits (${pagesWithHits.length})` : `All pages (${pageCount})`}
                          >
                            {m === 'hits' ? `Hits (${pagesWithHits.length})` : `All (${pageCount})`}
                          </button>
                        ))}
                      </div>
                    )}
                    <button onClick={() => goTo(1)} disabled={activePage <= 1} style={navBtn} title="First page">«</button>
                    <button onClick={stepPrev} disabled={prevDisabled} style={navBtn} title="Previous">
                      <ChevronLeftIcon style={{ width: 16, height: 16 }} />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={pageCount}
                      value={activePage}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isNaN(v)) goTo(Math.min(pageCount, Math.max(1, v)));
                      }}
                      style={{
                        width: 56, padding: '4px 6px', borderRadius: 6,
                        border: '1px solid rgba(0,0,0,0.12)', fontSize: 12,
                        textAlign: 'center',
                      }}
                      title="Jump to page"
                    />
                    <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>
                      / {pageCount}
                    </span>
                    <button onClick={stepNext} disabled={nextDisabled} style={navBtn} title="Next">
                      <ChevronRightIcon style={{ width: 16, height: 16 }} />
                    </button>
                    <button onClick={() => goTo(pageCount)} disabled={activePage >= pageCount} style={navBtn} title="Last page">»</button>

                    {/* Page strip — dots flag hit pages */}
                    {windowed.length > 1 && (
                      <div style={{
                        display: 'flex', flexWrap: 'wrap', gap: 2,
                        marginLeft: 8, maxWidth: 360,
                      }}>
                        {windowed.map((p) => {
                          const isActive = p === activePage;
                          const hasHit = hitSet.has(p);
                          return (
                            <button
                              key={p}
                              onClick={() => goTo(p)}
                              title={hasHit ? `Page ${p} · contains hit(s)` : `Page ${p}`}
                              style={{
                                position: 'relative',
                                minWidth: 26, height: 22, padding: '0 4px',
                                borderRadius: 4,
                                border: '1px solid rgba(0,0,0,0.10)',
                                background: isActive ? SEARCH_CFG.browser.activePageBg : 'white',
                                color:      isActive ? SEARCH_CFG.browser.activePageFg : '#374151',
                                fontSize: 10, fontWeight: 600, cursor: 'pointer',
                              }}
                            >
                              {p}
                              {hasHit && (
                                <span style={{
                                  position: 'absolute',
                                  top: -2, right: -2,
                                  width: SEARCH_CFG.browser.hitDotSize,
                                  height: SEARCH_CFG.browser.hitDotSize,
                                  borderRadius: '50%',
                                  background: SEARCH_CFG.browser.hitDotColor,
                                }} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Canvas area */}
            <div style={{
              flex: 1, position: 'relative', overflow: 'auto',
              background: '#f1f5f9', borderRadius: 10,
              border: '1px solid rgba(0,0,0,0.06)',
              minHeight: 500,
              display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
              padding: 16,
            }}>
              {locating && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#374151', fontSize: 13 }}>
                  <Spinner /> Locating in PDF…
                </div>
              )}
              {locateError && !locating && (
                <div style={{ color: '#b91c1c', fontSize: 13, padding: 24 }}>{locateError}</div>
              )}
              {!locating && !locateError && locateData && (locateData.matches?.length === 0) && (
                <div style={{ color: '#6b7280', fontSize: 13, padding: 24, textAlign: 'center' }}>
                  No visual location found in this PDF.<br />
                  <span style={{ fontSize: 11 }}>The value may be in a non-text layer (image-only PDF / CAD).</span>
                </div>
              )}

              {!locating && pageImageUrl && (
                <div
                  style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}
                  onMouseMove={handleDiagramMouseMove}
                  onMouseLeave={handleDiagramMouseLeave}
                >
                  <img
                    ref={imgRef}
                    src={pageImageUrl}
                    alt={`Page ${activePage}`}
                    onLoad={handleImgLoad}
                    style={{ display: 'block', maxWidth: '100%', height: 'auto', userSelect: 'none' }}
                  />
                  {/* Overlay rectangles for all matches on the active page */}
                  {imgSize.w > 0 && matchesOnActivePage.map((m, i) => {
                    const isActive = m._idx === activeMatchIdx;
                    return (
                      <div
                        key={i}
                        onClick={() => setActiveMatchIdx(m._idx)}
                        style={{
                          position: 'absolute',
                          left:   `${m.rect_pct.x * 100}%`,
                          top:    `${m.rect_pct.y * 100}%`,
                          width:  `${m.rect_pct.w * 100}%`,
                          height: `${m.rect_pct.h * 100}%`,
                          border: `${SEARCH_CFG.overlay.borderWidth}px solid ${
                            isActive ? SEARCH_CFG.overlay.activeBorder : SEARCH_CFG.overlay.borderColor
                          }`,
                          background: isActive ? SEARCH_CFG.overlay.activeFill : SEARCH_CFG.overlay.fillColor,
                          borderRadius: 3,
                          cursor: 'pointer',
                          animation: isActive ? `dscPulse ${SEARCH_CFG.overlay.pulseMs}ms ease-out infinite` : 'none',
                          boxSizing: 'border-box',
                        }}
                        title={`Match #${m._idx + 1} (page ${m.page})`}
                      />
                    );
                  })}

                  {/* Yellow-highlight overlay (revision/approval/hold stamps) */}
                  {SEARCH_CFG.yellow.enabled && showYellow && imgSize.w > 0 &&
                    yellowOnActivePage.map((r, i) => {
                      const isActive = i === activeYellowIdx;
                      const [x, y, w, h] = r.rect_pct || [0, 0, 0, 0];
                      return (
                        <div
                          key={`y-${i}`}
                          onClick={(e) => { e.stopPropagation(); setActiveYellowIdx(isActive ? -1 : i); }}
                          style={{
                            position: 'absolute',
                            left:   `${x * 100}%`,
                            top:    `${y * 100}%`,
                            width:  `${w * 100}%`,
                            height: `${h * 100}%`,
                            border: `${SEARCH_CFG.yellow.borderWidth}px dashed ${
                              isActive ? SEARCH_CFG.yellow.activeBorder : SEARCH_CFG.yellow.borderColor
                            }`,
                            background: isActive ? SEARCH_CFG.yellow.activeFill : SEARCH_CFG.yellow.fillColor,
                            borderRadius: 3,
                            cursor: 'pointer',
                            boxSizing: 'border-box',
                          }}
                          title={r.text || 'Yellow stamp'}
                        >
                          {isActive && r.text && (
                            <div style={{
                              position: 'absolute',
                              left: 0, top: '100%',
                              marginTop: 4,
                              background: 'white',
                              border: '1px solid rgba(0,0,0,0.08)',
                              boxShadow: '0 8px 18px rgba(15,23,42,0.18)',
                              borderRadius: 8, padding: '6px 10px',
                              fontSize: 11.5, color: '#1f2937',
                              maxWidth: 360, zIndex: 60,
                              whiteSpace: 'pre-wrap',
                              pointerEvents: 'none',
                            }}>
                              <div style={{ fontWeight: 700, color: '#a16207', marginBottom: 2 }}>
                                Yellow stamp{r.label ? ` · ${r.label}` : ''}
                              </div>
                              {r.text}
                            </div>
                          )}
                        </div>
                      );
                    })
                  }

                  {/* Smart Recommendation hover card */}
                  {SEARCH_CFG.reco.enabled && showCard && hoverPos && (
                    <RecoHoverCard
                      pos={hoverPos}
                      loading={recoLoading}
                      error={recoError}
                      data={reco}
                    />
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const navBtn = {
  width: 28, height: 28,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid rgba(5,150,105,0.25)',
  borderRadius: 8,
  background: 'white',
  cursor: 'pointer',
};

export default DocumentSearchCanvas;
