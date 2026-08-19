/**
 * ===================================================================
 * REUSABLE PAGE CONTROLS HOOK
 * ===================================================================
 * 
 * Purpose: Provide Hide Sidebar, Auto-Refresh, and Fullscreen controls
 * Usage: Can be added to any page without modifying core logic
 * 
 * Features:
 * - 🔄 Auto-refresh with configurable interval
 * - 📱 Sidebar toggle (hide/show)
 * - 🖥️ Fullscreen mode
 * - 💾 State persistence in localStorage
 * 
 * Soft-coded Configuration:
 * - Auto-refresh interval (default: 30s)
 * - Initial states (configurable per page)
 * - Refresh callback (custom data fetching)
 * 
 * @example
 * const pageControls = usePageControls({
 *   refreshCallback: refetch,
 *   autoRefreshInterval: 30000,
 *   storageKey: 'myPage'
 * });
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Configuration object for page controls
 * Soft-coded: All settings can be customized per page
 */
const DEFAULT_CONFIG = {
  autoRefreshInterval: 30000, // 30 seconds
  enablePersistence: true, // Save state to localStorage
  initialAutoRefresh: true,
  initialSidebarVisible: true,
  initialFullscreen: false,
};

/**
 * Custom hook for page control features
 * 
 * @param {Object} options - Configuration options
 * @param {Function} options.refreshCallback - Function to call when auto-refreshing
 * @param {number} options.autoRefreshInterval - Refresh interval in milliseconds
 * @param {string} options.storageKey - Unique key for localStorage persistence
 * @param {boolean} options.enableAutoRefresh - Enable/disable auto-refresh feature
 * @param {boolean} options.enableSidebarToggle - Enable/disable sidebar toggle
 * @param {boolean} options.enableFullscreen - Enable/disable fullscreen
 * 
 * @returns {Object} Page control state and methods
 */
export const usePageControls = (options = {}) => {
  const {
    refreshCallback = null,
    autoRefreshInterval = DEFAULT_CONFIG.autoRefreshInterval,
    storageKey = 'pageControls',
    enableAutoRefresh = true,
    enableSidebarToggle = true,
    enableFullscreen = true,
    enablePersistence = DEFAULT_CONFIG.enablePersistence,
  } = options;

  // Get persisted state from localStorage
  const getPersistedState = useCallback((key, defaultValue) => {
    if (!enablePersistence) return defaultValue;
    
    try {
      const stored = localStorage.getItem(`${storageKey}_${key}`);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch (error) {
      console.warn(`[PageControls] Failed to load ${key} from localStorage:`, error);
      return defaultValue;
    }
  }, [storageKey, enablePersistence]);

  // Save state to localStorage
  const persistState = useCallback((key, value) => {
    if (!enablePersistence) return;
    
    try {
      localStorage.setItem(`${storageKey}_${key}`, JSON.stringify(value));
    } catch (error) {
      console.warn(`[PageControls] Failed to save ${key} to localStorage:`, error);
    }
  }, [storageKey, enablePersistence]);

  // State management with persistence
  const [isFullscreen, setIsFullscreen] = useState(() => 
    getPersistedState('fullscreen', DEFAULT_CONFIG.initialFullscreen)
  );
  
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(() => 
    getPersistedState('autoRefresh', DEFAULT_CONFIG.initialAutoRefresh)
  );
  
  const [sidebarVisible, setSidebarVisible] = useState(() => 
    getPersistedState('sidebar', DEFAULT_CONFIG.initialSidebarVisible)
  );

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-refresh effect
  useEffect(() => {
    if (!enableAutoRefresh || !autoRefreshEnabled || !refreshCallback) return;
    
    console.log(`🔄 [PageControls] Auto-refresh enabled (${autoRefreshInterval}ms)`);
    
    const interval = setInterval(async () => {
      console.log('🔄 [PageControls] Auto-refreshing data...');
      setIsRefreshing(true);
      
      try {
        await refreshCallback();
      } catch (error) {
        console.error('[PageControls] Auto-refresh failed:', error);
      } finally {
        // Keep refreshing indicator for at least 500ms for visual feedback
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }, autoRefreshInterval);
    
    return () => {
      console.log('🛑 [PageControls] Auto-refresh disabled');
      clearInterval(interval);
    };
  }, [autoRefreshEnabled, refreshCallback, autoRefreshInterval, enableAutoRefresh]);

  // Fullscreen toggle handler
  const toggleFullscreen = useCallback(() => {
    if (!enableFullscreen) {
      console.warn('[PageControls] Fullscreen is disabled');
      return;
    }

    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
        .then(() => {
          setIsFullscreen(true);
          persistState('fullscreen', true);
          console.log('✅ [PageControls] Entered fullscreen mode');
        })
        .catch((error) => {
          console.error('[PageControls] Failed to enter fullscreen:', error);
        });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
          .then(() => {
            setIsFullscreen(false);
            persistState('fullscreen', false);
            console.log('✅ [PageControls] Exited fullscreen mode');
          })
          .catch((error) => {
            console.error('[PageControls] Failed to exit fullscreen:', error);
          });
      }
    }
  }, [enableFullscreen, persistState]);

  // Sidebar toggle handler
  const toggleSidebar = useCallback(() => {
    if (!enableSidebarToggle) {
      console.warn('[PageControls] Sidebar toggle is disabled');
      return;
    }

    setSidebarVisible((prev) => {
      const newValue = !prev;
      persistState('sidebar', newValue);
      console.log(`✅ [PageControls] Sidebar ${newValue ? 'shown' : 'hidden'}`);
      return newValue;
    });
  }, [enableSidebarToggle, persistState]);

  // Auto-refresh toggle handler
  const toggleAutoRefresh = useCallback(() => {
    if (!enableAutoRefresh) {
      console.warn('[PageControls] Auto-refresh is disabled');
      return;
    }

    setAutoRefreshEnabled((prev) => {
      const newValue = !prev;
      persistState('autoRefresh', newValue);
      console.log(`✅ [PageControls] Auto-refresh ${newValue ? 'enabled' : 'disabled'}`);
      return newValue;
    });
  }, [enableAutoRefresh, persistState]);

  // Manual refresh handler
  const manualRefresh = useCallback(async () => {
    if (!refreshCallback) return;
    
    console.log('🔄 [PageControls] Manual refresh triggered');
    setIsRefreshing(true);
    
    try {
      await refreshCallback();
    } catch (error) {
      console.error('[PageControls] Manual refresh failed:', error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [refreshCallback]);

  // Listen for fullscreen changes (ESC key, F11, etc.)
  useEffect(() => {
    if (!enableFullscreen) return;

    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      persistState('fullscreen', isNowFullscreen);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [enableFullscreen, persistState]);

  // Generate dynamic styles for sidebar and fullscreen
  const styles = `
    ${!sidebarVisible ? `
      aside, [role="navigation"] {
        display: none !important;
      }
      main {
        margin-left: 0 !important;
        width: 100% !important;
      }
    ` : ''}
    
    :fullscreen aside,
    :fullscreen header:not(.page-header),
    :fullscreen footer,
    :fullscreen [role="navigation"] {
      display: none !important;
    }
    
    :fullscreen {
      background: linear-gradient(to bottom right, rgb(239 246 255), white, rgb(248 250 252)) !important;
      padding: 2rem !important;
      overflow-y: auto !important;
    }
    
    :fullscreen main {
      margin-left: 0 !important;
      width: 100% !important;
    }
  `;

  return {
    // State
    isFullscreen,
    autoRefreshEnabled,
    sidebarVisible,
    isRefreshing,
    
    // Actions
    toggleFullscreen,
    toggleSidebar,
    toggleAutoRefresh,
    manualRefresh,
    
    // Helpers
    styles,
    
    // Feature flags (for conditional rendering)
    features: {
      fullscreen: enableFullscreen,
      autoRefresh: enableAutoRefresh,
      sidebarToggle: enableSidebarToggle,
    },
  };
};

export default usePageControls;
