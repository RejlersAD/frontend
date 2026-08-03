/**
 * ===================================================================
 * PAGE CONTROL BUTTONS COMPONENT
 * ===================================================================
 * 
 * Purpose: Reusable UI controls for Hide Sidebar, Auto-Refresh, Fullscreen
 * Usage: Import and place in any page header
 * 
 * Features:
 * - Material-UI IconButtons with Tooltips
 * - Responsive design
 * - Visual feedback (colors, animations)
 * - Accessible (ARIA labels, keyboard support)
 * 
 * Soft-coded Design:
 * - All icons and labels configurable
 * - Conditional rendering based on enabled features
 * - Customizable styling via props
 * 
 * @example
 * <PageControlButtons controls={pageControls} />
 */

import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { 
  Bars3Icon, 
  Bars3BottomLeftIcon 
} from '@heroicons/react/24/outline';
import { 
  RefreshCw, 
  Maximize2, 
  Minimize2 
} from 'lucide-react';

/**
 * Soft-coded configuration for button appearance
 */
const BUTTON_CONFIG = {
  size: 'small',
  sx: {
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
      transform: 'scale(1.1)',
    },
  },
};

const ICON_SIZE = {
  heroicon: 'w-4 h-4',
  lucide: 16,
};

/**
 * PageControlButtons Component
 * 
 * @param {Object} props
 * @param {Object} props.controls - Page controls object from usePageControls hook
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.buttonProps - Additional props for IconButtons
 * @param {boolean} props.showLabels - Show text labels (for larger screens)
 * 
 * @returns {JSX.Element} Rendered control buttons
 */
export const PageControlButtons = ({ 
  controls, 
  className = '', 
  buttonProps = {},
  showLabels = false 
}) => {
  if (!controls) {
    console.warn('[PageControlButtons] No controls provided');
    return null;
  }

  const {
    isFullscreen,
    autoRefreshEnabled,
    sidebarVisible,
    isRefreshing,
    toggleFullscreen,
    toggleSidebar,
    toggleAutoRefresh,
    manualRefresh,
    features,
  } = controls;

  return (
    <div 
      className={`flex items-center gap-2 ${className}`}
      role="toolbar"
      aria-label="Page Controls"
    >
      {/* Sidebar Toggle Button */}
      {features.sidebarToggle && (
        <Tooltip 
          title={sidebarVisible ? 'Hide Sidebar' : 'Show Sidebar'}
          arrow
          placement="bottom"
        >
          <IconButton
            {...BUTTON_CONFIG}
            {...buttonProps}
            onClick={toggleSidebar}
            aria-label={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
            sx={{
              ...BUTTON_CONFIG.sx,
              ...buttonProps.sx,
              color: sidebarVisible ? 'primary.main' : 'text.secondary',
            }}
          >
            {sidebarVisible ? (
              <Bars3Icon className={ICON_SIZE.heroicon} />
            ) : (
              <Bars3BottomLeftIcon className={ICON_SIZE.heroicon} />
            )}
          </IconButton>
        </Tooltip>
      )}

      {/* Auto-Refresh Toggle Button */}
      {features.autoRefresh && (
        <Tooltip 
          title={autoRefreshEnabled ? 'Auto-refresh ON (30s)' : 'Auto-refresh OFF (Click to enable)'}
          arrow
          placement="bottom"
        >
          <IconButton
            {...BUTTON_CONFIG}
            {...buttonProps}
            onClick={toggleAutoRefresh}
            onDoubleClick={manualRefresh}
            aria-label={autoRefreshEnabled ? 'Disable auto-refresh' : 'Enable auto-refresh'}
            sx={{
              ...BUTTON_CONFIG.sx,
              ...buttonProps.sx,
              color: autoRefreshEnabled ? 'success.main' : 'text.secondary',
            }}
          >
            <RefreshCw 
              size={ICON_SIZE.lucide} 
              className={isRefreshing ? 'animate-spin' : ''} 
            />
          </IconButton>
        </Tooltip>
      )}

      {/* Fullscreen Toggle Button */}
      {features.fullscreen && (
        <Tooltip 
          title={isFullscreen ? 'Exit Fullscreen (ESC)' : 'Enter Fullscreen (F11)'}
          arrow
          placement="bottom"
        >
          <IconButton
            {...BUTTON_CONFIG}
            {...buttonProps}
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen mode' : 'Enter fullscreen mode'}
            sx={{
              ...BUTTON_CONFIG.sx,
              ...buttonProps.sx,
              color: isFullscreen ? 'primary.main' : 'text.secondary',
            }}
          >
            {isFullscreen ? (
              <Minimize2 size={ICON_SIZE.lucide} />
            ) : (
              <Maximize2 size={ICON_SIZE.lucide} />
            )}
          </IconButton>
        </Tooltip>
      )}

      {/* Optional: Text Labels for larger screens */}
      {showLabels && (
        <div className="hidden lg:flex items-center gap-2 ml-2 text-xs text-gray-600">
          {features.sidebarToggle && (
            <span className={sidebarVisible ? 'text-blue-600' : 'text-gray-400'}>
              Sidebar
            </span>
          )}
          {features.autoRefresh && (
            <span className={autoRefreshEnabled ? 'text-green-600' : 'text-gray-400'}>
              Auto-refresh
            </span>
          )}
          {features.fullscreen && (
            <span className={isFullscreen ? 'text-blue-600' : 'text-gray-400'}>
              Fullscreen
            </span>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Compact variant for smaller headers
 */
export const PageControlButtonsCompact = (props) => (
  <PageControlButtons
    {...props}
    buttonProps={{ size: 'small', ...props.buttonProps }}
    className={`gap-1 ${props.className || ''}`}
  />
);

/**
 * Variant with labels for desktop
 */
export const PageControlButtonsWithLabels = (props) => (
  <PageControlButtons
    {...props}
    showLabels={true}
  />
);

export default PageControlButtons;
