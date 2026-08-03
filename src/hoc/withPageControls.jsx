/**
 * ===================================================================
 * WITH PAGE CONTROLS HOC (Higher-Order Component)
 * ===================================================================
 * 
 * Purpose: Automatically add Hide Sidebar, Auto-Refresh, Fullscreen to any page
 * Usage: Wrap any page component to instantly add page controls
 * 
 * Features:
 * - Zero code modification to existing pages
 * - Injects page controls as props
 * - Automatically applies styles
 * - Configurable per-page settings
 * 
 * Soft-coded Design:
 * - All features optional and configurable
 * - No breaking changes to existing code
 * - Backward compatible
 * 
 * @example
 * // Simple usage
 * export default withPageControls(MyPage);
 * 
 * @example
 * // With configuration
 * export default withPageControls(MyPage, {
 *   autoRefreshInterval: 60000,
 *   enableSidebarToggle: true,
 *   storageKey: 'myCustomPage'
 * });
 * 
 * @example
 * // Inside component
 * function MyPage({ pageControls }) {
 *   return (
 *     <div>
 *       <PageControlButtons controls={pageControls} />
 *       // Your page content here
 *     </div>
 *   );
 * }
 */

import React from 'react';
import usePageControls from '../hooks/usePageControls';

/**
 * HOC that wraps a component with page controls functionality
 * 
 * @param {React.Component} WrappedComponent - Component to wrap
 * @param {Object} config - Configuration for page controls
 * @param {boolean} config.autoInjectStyles - Automatically inject control styles (default: true)
 * @param {boolean} config.enableAutoRefresh - Enable auto-refresh (default: true)
 * @param {boolean} config.enableSidebarToggle - Enable sidebar toggle (default: true)
 * @param {boolean} config.enableFullscreen - Enable fullscreen (default: true)
 * @param {number} config.autoRefreshInterval - Refresh interval in ms (default: 30000)
 * @param {string} config.storageKey - localStorage key (default: component name)
 * @param {Function} config.getRefreshCallback - Function to get refresh callback from props
 * 
 * @returns {React.Component} Enhanced component with page controls
 */
export const withPageControls = (WrappedComponent, config = {}) => {
  const {
    autoInjectStyles = true,
    enableAutoRefresh = true,
    enableSidebarToggle = true,
    enableFullscreen = true,
    autoRefreshInterval = 30000,
    storageKey = WrappedComponent.name || 'page',
    getRefreshCallback = (props) => props.refetch || props.refresh || null,
  } = config;

  const EnhancedComponent = (props) => {
    // Get refresh callback from props (if available)
    const refreshCallback = getRefreshCallback(props);

    // Initialize page controls
    const pageControls = usePageControls({
      refreshCallback,
      autoRefreshInterval,
      storageKey,
      enableAutoRefresh,
      enableSidebarToggle,
      enableFullscreen,
    });

    return (
      <>
        {/* Inject styles if enabled */}
        {autoInjectStyles && <style>{pageControls.styles}</style>}
        
        {/* Render wrapped component with page controls */}
        <WrappedComponent
          {...props}
          pageControls={pageControls}
        />
      </>
    );
  };

  // Preserve component name for debugging
  EnhancedComponent.displayName = `withPageControls(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return EnhancedComponent;
};

/**
 * Preset: Minimal page controls (only fullscreen)
 */
export const withMinimalControls = (Component) =>
  withPageControls(Component, {
    enableAutoRefresh: false,
    enableSidebarToggle: false,
    enableFullscreen: true,
  });

/**
 * Preset: Dashboard page controls (all features + fast refresh)
 */
export const withDashboardControls = (Component) =>
  withPageControls(Component, {
    enableAutoRefresh: true,
    enableSidebarToggle: true,
    enableFullscreen: true,
    autoRefreshInterval: 30000, // 30 seconds
  });

/**
 * Preset: Report page controls (no auto-refresh)
 */
export const withReportControls = (Component) =>
  withPageControls(Component, {
    enableAutoRefresh: false,
    enableSidebarToggle: true,
    enableFullscreen: true,
  });

/**
 * Preset: Monitoring page controls (fast refresh)
 */
export const withMonitoringControls = (Component) =>
  withPageControls(Component, {
    enableAutoRefresh: true,
    enableSidebarToggle: true,
    enableFullscreen: true,
    autoRefreshInterval: 10000, // 10 seconds
  });

export default withPageControls;
