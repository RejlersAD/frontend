/**
 * Usage Live Stream Hook
 * ======================
 *
 * Subscribes the Usage Dashboard to the backend's `ws/usage/` WebSocket
 * (Django Channels). All knobs are SOFT-CODED at the top.
 *
 * Design principles
 * -----------------
 *  • ADDITIVE — never replaces existing polling; the dashboard merges
 *    snapshots from either source.
 *  • RESILIENT — auto-reconnects with exponential back-off. If the WS
 *    layer is disabled or the server is unreachable the hook simply
 *    stays "disconnected" and the page falls back to polling.
 *  • AUTH-AWARE — appends `?token=<JWT>` for the Channels middleware
 *    that authenticates query-string tokens (matches existing
 *    AuthMiddlewareStack pattern in backend/config/asgi.py).
 *  • ZERO LOGS unless `import.meta.env.DEV` (or VITE_USAGE_WS_DEBUG=1).
 */
import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../config/api.config';
import { STORAGE_KEYS } from '../config/app.config';

// ── Soft-coded constants ────────────────────────────────────────────────
const USAGE_WS_PATH               = '/ws/usage/';
const RECONNECT_INITIAL_DELAY_MS  = 1_500;
const RECONNECT_MAX_DELAY_MS      = 30_000;
const RECONNECT_BACKOFF_FACTOR    = 1.7;
const STALE_THRESHOLD_MS          = 60_000;       // mark "stale" if no tick for 60s
const ENABLE_DEBUG_LOG            = (import.meta?.env?.DEV ?? false) ||
                                    (import.meta?.env?.VITE_USAGE_WS_DEBUG === '1');

const log = (...args) => { if (ENABLE_DEBUG_LOG) console.log('[UsageWS]', ...args); };

/**
 * Convert the configured HTTP API base into a WebSocket origin.
 *   https://api.example.com/api/v1  →  wss://api.example.com/ws/usage/
 *   http://localhost:8000/api/v1     →  ws://localhost:8000/ws/usage/
 */
function buildWsUrl() {
  try {
    const url = new URL(API_BASE_URL, window.location.origin);
    const wsProto = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || '';
    const qs = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${wsProto}//${url.host}${USAGE_WS_PATH}${qs}`;
  } catch (err) {
    log('buildWsUrl failed:', err);
    return null;
  }
}

/**
 * Returns:
 *   {
 *     liveSnapshot: latest tick payload (null until first message)
 *     status: 'connecting' | 'connected' | 'disconnected' | 'disabled'
 *     stale: boolean (no message for STALE_THRESHOLD_MS)
 *     requestRefresh(): force the server to push a fresh snapshot
 *   }
 *
 * @param {boolean} enabled — caller can disable the hook entirely
 *                            (e.g. when the user toggles "Live" off).
 */
export default function useUsageLiveStream(enabled = true) {
  const [liveSnapshot, setLiveSnapshot] = useState(null);
  const [status, setStatus]             = useState('connecting');
  const [stale, setStale]               = useState(false);

  const socketRef        = useRef(null);
  const reconnectTimerRef = useRef(null);
  const staleTimerRef    = useRef(null);
  const backoffRef       = useRef(RECONNECT_INITIAL_DELAY_MS);
  const closedByUserRef  = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setStatus('disabled');
      return;
    }
    closedByUserRef.current = false;

    const armStaleTimer = () => {
      clearTimeout(staleTimerRef.current);
      staleTimerRef.current = setTimeout(() => setStale(true), STALE_THRESHOLD_MS);
    };

    const connect = () => {
      const wsUrl = buildWsUrl();
      if (!wsUrl) {
        setStatus('disconnected');
        return;
      }
      log('connecting →', wsUrl);
      setStatus('connecting');

      let socket;
      try {
        socket = new WebSocket(wsUrl);
      } catch (err) {
        log('ctor failed:', err);
        scheduleReconnect();
        return;
      }
      socketRef.current = socket;

      socket.onopen = () => {
        log('open');
        backoffRef.current = RECONNECT_INITIAL_DELAY_MS;
        setStatus('connected');
        setStale(false);
        armStaleTimer();
      };

      socket.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (!data || typeof data !== 'object') return;
          // Ignore irrelevant control messages but keep the connection
          // marked alive (server writes connection_established etc.).
          if (data.type === 'usage_tick' || data.type === 'usage_initial') {
            setLiveSnapshot(data);
          }
          setStale(false);
          armStaleTimer();
        } catch (err) {
          log('parse error:', err);
        }
      };

      socket.onerror = (err) => {
        log('error:', err?.message || err);
      };

      socket.onclose = (evt) => {
        log('close', evt.code, evt.reason);
        clearTimeout(staleTimerRef.current);
        // 4030 = explicitly disabled by env on server.
        if (evt.code === 4030) {
          setStatus('disabled');
          return;
        }
        if (closedByUserRef.current) return;
        setStatus('disconnected');
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      clearTimeout(reconnectTimerRef.current);
      const delay = Math.min(backoffRef.current, RECONNECT_MAX_DELAY_MS);
      log(`reconnecting in ${delay}ms`);
      reconnectTimerRef.current = setTimeout(() => {
        backoffRef.current = Math.min(
          backoffRef.current * RECONNECT_BACKOFF_FACTOR,
          RECONNECT_MAX_DELAY_MS,
        );
        connect();
      }, delay);
    };

    connect();

    return () => {
      closedByUserRef.current = true;
      clearTimeout(reconnectTimerRef.current);
      clearTimeout(staleTimerRef.current);
      try { socketRef.current?.close(); } catch (_) { /* ignore */ }
    };
  }, [enabled]);

  const requestRefresh = () => {
    try {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'request_refresh' }));
      }
    } catch (err) {
      log('requestRefresh failed:', err);
    }
  };

  return { liveSnapshot, status, stale, requestRefresh };
}
