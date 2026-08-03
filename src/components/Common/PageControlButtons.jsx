/**
 * Reusable Page Control Buttons Component
 * Provides Hide Sidebar, Auto-Refresh, and Fullscreen controls
 */

import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { Maximize2, Minimize2, RefreshCw } from 'lucide-react';

export const PageControlButtons = ({
  sidebarVisible,
  setSidebarVisible,
  autoRefreshEnabled,
  setAutoRefreshEnabled,
  isFullscreen,
  toggleFullscreen,
  isRefreshing = false,
  enableSidebar = true,
  enableAutoRefresh = true,
  enableFullscreen = true,
  autoRefreshInterval = 30,
}) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      {/* Sidebar toggle */}
      {enableSidebar && (
        <Tooltip title={sidebarVisible ? 'Hide Sidebar' : 'Show Sidebar'}>
          <IconButton
            size="small"
            onClick={() => setSidebarVisible(!sidebarVisible)}
            sx={{ color: sidebarVisible ? 'primary.main' : 'text.secondary' }}
          >
            <Bars3Icon className="w-4 h-4" />
          </IconButton>
        </Tooltip>
      )}
      
      {/* Auto-refresh toggle */}
      {enableAutoRefresh && (
        <Tooltip title={autoRefreshEnabled ? `Auto-refresh ON (${autoRefreshInterval}s)` : 'Auto-refresh OFF'}>
          <IconButton
            size="small"
            onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
            sx={{ color: autoRefreshEnabled ? 'success.main' : 'text.secondary' }}
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </IconButton>
        </Tooltip>
      )}
      
      {/* Fullscreen toggle */}
      {enableFullscreen && (
        <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}>
          <IconButton
            size="small"
            onClick={toggleFullscreen}
            sx={{ color: 'text.secondary' }}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </IconButton>
        </Tooltip>
      )}
    </div>
  );
};
