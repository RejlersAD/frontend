/**
 * Real-time Detection Hook
 * WebSocket integration for live ML detection updates
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../config/api.config';

const WS_BASE_URL = API_BASE_URL.replace('http', 'ws').replace('https', 'wss');

export const useRealTimeDetection = (options = {}) => {
  const {
    autoConnect = true,
    reconnectInterval = 5000,
    onAlert = null,
    onAnomaly = null,
    onMetrics = null
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(`${WS_BASE_URL}/ws/detection/`);

      ws.onopen = () => {
        console.log('🟢 Real-time detection WebSocket connected');
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleMessage(data);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('❌ WebSocket error:', err);
        setError('WebSocket connection error');
      };

      ws.onclose = () => {
        console.log('🔴 WebSocket disconnected');
        setIsConnected(false);

        // Auto-reconnect
        if (autoConnect) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Attempting to reconnect...');
            connect();
          }, reconnectInterval);
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setError('Failed to establish connection');
    }
  }, [autoConnect, reconnectInterval]);

  const handleMessage = (data) => {
    setLastUpdate(new Date().toISOString());

    switch (data.type) {
      case 'connection_established':
        console.log('✅ Connection established:', data.message);
        break;

      case 'new_alert':
        console.log('🚨 New alert:', data.alert);
        setAlerts((prev) => [data.alert, ...prev].slice(0, 50)); // Keep last 50
        if (onAlert) onAlert(data.alert);
        break;

      case 'alerts_update':
        setAlerts(data.alerts);
        break;

      case 'periodic_update':
        if (data.alerts) {
          setAlerts(data.alerts);
        }
        if (data.metrics) {
          setMetrics(data.metrics);
          if (onMetrics) onMetrics(data.metrics);
        }
        break;

      case 'metrics_update':
        setMetrics(data.metrics);
        if (onMetrics) onMetrics(data.metrics);
        break;

      case 'anomaly_detected':
        console.log('⚠️ Anomaly detected:', data.anomaly);
        if (onAnomaly) onAnomaly(data.anomaly);
        break;

      case 'alert_broadcast':
        console.log('📢 Alert broadcast:', data.alert);
        setAlerts((prev) => {
          const exists = prev.find((a) => a.id === data.alert.id);
          if (exists) {
            return prev.map((a) => (a.id === data.alert.id ? data.alert : a));
          }
          return [data.alert, ...prev].slice(0, 50);
        });
        if (onAlert) onAlert(data.alert);
        break;

      case 'error':
        console.error('❌ Server error:', data.message);
        setError(data.message);
        break;

      default:
        console.log('📨 Unknown message type:', data.type);
    }
  };

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const requestAlerts = useCallback(() => {
    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify({ type: 'request_alerts' }));
    }
  }, [isConnected]);

  const requestMetrics = useCallback(() => {
    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify({ type: 'request_metrics' }));
    }
  }, [isConnected]);

  const acknowledgeAlert = useCallback((alertId) => {
    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify({
        type: 'acknowledge_alert',
        alert_id: alertId
      }));
    }
  }, [isConnected]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    isConnected,
    alerts,
    metrics,
    lastUpdate,
    error,
    connect,
    disconnect,
    requestAlerts,
    requestMetrics,
    acknowledgeAlert
  };
};


/**
 * System Metrics Hook
 * Real-time system performance metrics
 */
export const useSystemMetrics = (options = {}) => {
  const { autoConnect = true } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [history, setHistory] = useState([]);

  const wsRef = useRef(null);

  useEffect(() => {
    if (!autoConnect) return;

    const ws = new WebSocket(`${WS_BASE_URL}/ws/metrics/`);

    ws.onopen = () => {
      console.log('🟢 System metrics WebSocket connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'metrics_update') {
          setMetrics(data.metrics);
          setHistory((prev) => [...prev, data.metrics].slice(-100)); // Keep last 100
        }
      } catch (err) {
        console.error('Failed to parse metrics:', err);
      }
    };

    ws.onclose = () => {
      console.log('🔴 Metrics WebSocket disconnected');
      setIsConnected(false);
    };

    wsRef.current = ws;

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [autoConnect]);

  return {
    isConnected,
    metrics,
    history
  };
};
