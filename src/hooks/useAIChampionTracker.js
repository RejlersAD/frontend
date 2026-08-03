/**
 * useAIChampionTracker — client-side telemetry for the AI Champion leaderboard
 * ===========================================================================
 *
 * Fires `analyticsService.trackActivity` on every authenticated route change so
 * the AI Champion dashboard at /admin/ai-champion receives LIVE engagement
 * data. The backend middleware ALSO captures every API request, so this hook
 * primarily provides richer client-side context (route, dwell time) and
 * captures pure-frontend page views that don't hit the API.
 *
 * All thresholds and the URL→application/feature mapping are SOFT-CODED below
 * so admins can rebalance without touching component code.
 *
 * Failure semantics: NEVER throws. Tracking errors are logged at debug level.
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import analyticsService from '../services/analyticsService';

// ---------------------------------------------------------------------------
// Soft-coded configuration
// ---------------------------------------------------------------------------

// Telemetry transport tuning. The route-view track is fire-and-forget, so we
// cap its request timeout aggressively — otherwise this background POST can
// queue behind a long synchronous extraction (e.g. ADNOC P&ID instrument
// index) and hang for the global 120 s default, surfacing a noisy
// `ECONNABORTED` error in DevTools. Tweak via env without code changes:
//   VITE_TRACKER_TIMEOUT_MS — axios timeout for telemetry POST (default 10s)
const TRACKER_TIMEOUT_MS = Number(import.meta.env?.VITE_TRACKER_TIMEOUT_MS ?? 10000);

// ---------------------------------------------------------------------------
// Soft-coded configuration
// ---------------------------------------------------------------------------

// Skip tracking for these route prefixes (auth pages, error pages, public pages)
const EXCLUDE_PREFIXES = [
  '/login',
  '/register',
  '/setup-password',
  '/change-password',
  '/request-password-reset',
  '/terms',
  '/privacy',
  '/about',
  '/solutions',
  '/enquiry',
  '/contact-support',
  '/documentation',
];

// Min dwell-time (ms) before we consider a page "viewed" — avoids spam from
// brief redirects.
const MIN_DWELL_MS = 750;

// Throttle: don't fire more than one event per route per this window
const THROTTLE_WINDOW_MS = 2000;

// Route segment → application code mapping. Order matters: first hit wins.
const APPLICATION_MAP = [
  // [substring, application, module]
  ['/admin/ai-champion',         'ai-champion',         'admin'],
  ['/admin/predictive',          'predictive-insights', 'admin'],
  ['/admin/advanced-analytics',  'advanced-analytics',  'admin'],
  ['/admin',                     'admin-dashboard',     'admin'],
  ['/users',                     'user-management',     'admin'],
  ['/dashboard',                 'dashboard',           'platform'],
  ['/engineering/process/pid',   'pid-verification',    'process'],
  ['/engineering/process/pfd',   'pfd-quality',         'process'],
  ['/engineering/process/equipment', 'equipment-list',  'process'],
  ['/engineering/process/line',  'line-list',           'process'],
  ['/engineering/process',       'process-datasheet',   'process'],
  ['/engineering/electrical',    'electrical',          'electrical'],
  ['/engineering/instrument',    'instrument',          'instrument'],
  ['/engineering/mechanical',    'mechanical',          'mechanical'],
  ['/engineering/piping',        'piping',              'piping'],
  ['/engineering/civil',         'civil',               'civil'],
  ['/engineering/digitization',  'digitization',        'digitization'],
  ['/qhse',                      'qhse',                'qhse'],
  ['/crs',                       'crs',                 'documents'],
  ['/finance',                   'finance',             'finance'],
  ['/procurement',               'procurement',         'procurement'],
  ['/sales',                     'sales',               'sales'],
  ['/wrench',                    'wrench-integration',  'integrations'],
  ['/designiq',                  'designiq',            'designiq'],
  ['/notifications',             'notifications',       'platform'],
  ['/profile',                   'profile',             'platform'],
];

// Stable per-tab session id so the backend can correlate events
const SESSION_KEY = 'radai_ai_champion_session';

const getSessionId = () => {
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return '';
  }
};

const resolveAppFeature = (pathname) => {
  for (const [needle, app, module] of APPLICATION_MAP) {
    if (pathname.startsWith(needle)) {
      const tail = pathname.slice(needle.length).replace(/^\/+/, '');
      const feature = (tail.split('/')[0] || 'index').slice(0, 64);
      return { application: app, module, feature };
    }
  }
  // Fallback: use first path segment as the application code
  const segs = pathname.split('/').filter(Boolean);
  return {
    application: segs[0] || 'platform',
    module: 'platform',
    feature: segs[1] || 'index',
  };
};

const isExcluded = (pathname) =>
  EXCLUDE_PREFIXES.some((p) => pathname.startsWith(p));

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
const useAIChampionTracker = () => {
  const location = useLocation();
  const { isAuthenticated } = useSelector((s) => s.auth || {});
  const lastTrackRef = useRef({ path: '', at: 0 });
  const dwellStartRef = useRef({ path: '', at: 0 });

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const pathname = location.pathname || '/';
    if (isExcluded(pathname)) return undefined;

    // Throttle identical-path events
    const now = Date.now();
    if (
      lastTrackRef.current.path === pathname &&
      now - lastTrackRef.current.at < THROTTLE_WINDOW_MS
    ) {
      return undefined;
    }

    // Record dwell on the previous route, if any
    const prev = dwellStartRef.current;
    dwellStartRef.current = { path: pathname, at: now };

    // Schedule the track — only fires if the user stays on the page
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const { application, module, feature } = resolveAppFeature(pathname);
      const dwellMs = prev.path && prev.at ? now - prev.at : 0;

      const payload = {
        application,
        module,
        feature,
        action_type: 'view',
        session_id: getSessionId(),
        duration_ms: Math.max(0, dwellMs),
        success: true,
        metadata: {
          source: 'frontend-route',
          path: pathname,
          referrer: prev.path || '',
        },
      };

      // Fire-and-forget telemetry. We pass an aggressive soft-coded
      // timeout so this background POST can never block the UI for the
      // 120 s global default, even when a worker is busy with a long
      // synchronous extraction. Errors are silenced — the global axios
      // interceptor also treats `/rbac/ai-champion/track/` as a silent
      // endpoint to avoid noisy `[API Error]` logs / toasts.
      analyticsService.trackActivity(payload, {
        timeout: TRACKER_TIMEOUT_MS,
        signal: controller.signal,
      }).then(() => {
        lastTrackRef.current = { path: pathname, at: now };
      }).catch((err) => {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.debug('[AIChampionTracker] track failed:', err?.message);
        }
      });
    }, MIN_DWELL_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [location.pathname, isAuthenticated]);
};

export default useAIChampionTracker;
