import { useState, useEffect, useRef, useCallback } from 'react';
import { ACTIVITY_CONFIG } from '../config/activity.config';

const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

/**
 * Custom hook for real-time activity stream
 * Manages WebSocket connection and activity data
 */
export const useActivityStream = () => {
  const [activities, setActivities] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [statistics, setStatistics] = useState({
    total_last_hour: 0,
    total_last_24h: 0,
    by_category: {},
    by_severity: {},
    success_rate: 100,
    average_duration: 0,
  });
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [error, setError] = useState(null);
  
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const pingIntervalRef = useRef(null);

  /**
   * Send message to WebSocket
   */
  const sendMessage = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  /**
   * Request filtered activities
   */
  const requestActivities = useCallback((filters = {}) => {
    sendMessage({
      type: 'get_activities',
      category: filters.category || 'all',
      limit: filters.limit || ACTIVITY_CONFIG.display.defaultLimit,
    });
  }, [sendMessage]);

  /**
   * Request activity statistics
   */
  const requestStatistics = useCallback(() => {
    sendMessage({ type: 'get_statistics' });
  }, [sendMessage]);

  /**
   * Request active users
   */
  const requestActiveUsers = useCallback(() => {
    sendMessage({ type: 'get_active_users' });
  }, [sendMessage]);

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'initial_data':
          setActivities(data.activities || []);
          setActiveUsers(data.active_users || []);
          break;
          
        case 'new_activity':
          setActivities(prev => {
            const newActivities = [data.activity, ...prev];
            // Keep only recent activities to prevent memory issues
            return newActivities.slice(0, ACTIVITY_CONFIG.display.defaultLimit);
          });
          break;
          
        case 'activity_update':
          setActivities(prev => 
            prev.map(activity => 
              activity.id === data.activity.id ? data.activity : activity
            )
          );
          break;
          
        case 'activities':
          setActivities(data.activities || []);
          break;
          
        case 'active_users':
          setActiveUsers(data.users || []);
          break;
          
        case 'statistics':
          setStatistics(data.stats || {});
          break;
          
        case 'periodic_update':
          if (data.new_activities?.length > 0) {
            setActivities(prev => {
              const newActivities = [...data.new_activities, ...prev];
              return newActivities.slice(0, ACTIVITY_CONFIG.display.defaultLimit);
            });
          }
          if (data.active_users) {
            setActiveUsers(data.active_users);
          }
          if (data.statistics) {
            setStatistics(data.statistics);
          }
          break;
          
        case 'pong':
          // Keep-alive response
          break;
          
        case 'error':
          console.error('Activity stream error:', data.message);
          setError(data.message);
          break;
          
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (err) {
      console.error('Error parsing WebSocket message:', err);
    }
  }, []);

  /**
   * Start ping interval for keep-alive
   */
  const startPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, ACTIVITY_CONFIG.websocket.pingInterval);
  }, []);

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    try {
      setConnectionStatus('connecting');
      setError(null);
      
      const ws = new WebSocket(`${WS_BASE_URL}/ws/activity/`);
      
      ws.onopen = () => {
        console.log('Activity stream connected');
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        startPingInterval();
        
        // Request initial data
        requestStatistics();
        requestActiveUsers();
      };
      
      ws.onmessage = handleMessage;
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Connection error');
        setConnectionStatus('error');
      };
      
      ws.onclose = (event) => {
        console.log('Activity stream disconnected:', event.code, event.reason);
        setConnectionStatus('disconnected');
        
        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        
        // Attempt to reconnect
        if (reconnectAttemptsRef.current < ACTIVITY_CONFIG.websocket.maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          console.log(`Reconnecting... Attempt ${reconnectAttemptsRef.current}`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, ACTIVITY_CONFIG.websocket.reconnectDelay);
        } else {
          setError('Max reconnection attempts reached');
        }
      };
      
      wsRef.current = ws;
    } catch (err) {
      console.error('Error creating WebSocket:', err);
      setError(err.message);
      setConnectionStatus('error');
    }
  }, [handleMessage, startPingInterval, requestStatistics, requestActiveUsers]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    
    setConnectionStatus('disconnected');
  }, []);

  /**
   * Initialize connection on mount
   */
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, []);

  /**
   * Get filtered activities
   */
  const getFilteredActivities = useCallback((filters = {}) => {
    let filtered = [...activities];
    
    // Filter by category
    if (filters.category && filters.category !== 'all') {
      filtered = filtered.filter(a => a.category === filters.category);
    }
    
    // Filter by severity
    if (filters.severity && filters.severity !== 'all') {
      filtered = filtered.filter(a => a.severity === filters.severity);
    }
    
    // Filter by time range
    if (filters.minutes) {
      const cutoffTime = new Date(Date.now() - filters.minutes * 60 * 1000);
      filtered = filtered.filter(a => new Date(a.timestamp) >= cutoffTime);
    }
    
    // Filter by search term
    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(a => 
        a.description?.toLowerCase().includes(search) ||
        a.user_name?.toLowerCase().includes(search) ||
        a.user_email?.toLowerCase().includes(search)
      );
    }
    
    return filtered;
  }, [activities]);

  return {
    // Data
    activities,
    activeUsers,
    statistics,
    
    // State
    connectionStatus,
    isConnected: connectionStatus === 'connected',
    error,
    
    // Actions
    requestActivities,
    requestStatistics,
    requestActiveUsers,
    getFilteredActivities,
    reconnect: connect,
    disconnect,
  };
};
