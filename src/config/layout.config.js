/**
 * Layout dimensions — single source of truth for the app shell.
 *
 * Sidebar width and the corresponding main-content offset MUST come from the
 * same constants; otherwise the two components drift and the content overlaps
 * the sidebar (or leaves a visible gap).
 *
 * When adding a new sidebar variant (mini, drawer, etc.), extend the SIDEBAR
 * dict here and both Layout.jsx and Sidebar.jsx pick it up automatically.
 */

// ── Sidebar widths (Tailwind class names must match the rem values) ─────────
export const SIDEBAR = {
  expanded: {
    widthClass:  'w-72',       // 18rem  → 288px
    marginClass: 'lg:ml-72',   // match on lg+ screens
  },
  collapsed: {
    widthClass:  'w-20',       // 5rem   → 80px
    marginClass: 'lg:ml-20',
  },
  hidden: {
    widthClass:  'w-0',
    marginClass: '',           // no offset when no sidebar is rendered
  },
}

// Header offset — matches the fixed Header height (h-16 → 4rem)
export const HEADER_HEIGHT_CLASS = 'pt-16'

// Main content horizontal breathing room so cards never touch sidebar / edge
export const MAIN_PADDING_CLASS = 'px-4 sm:px-6 lg:px-8 py-4 sm:py-6'

/**
 * Resolve the main-content margin class based on sidebar visibility + state.
 * @param {boolean} showSidebar - whether the sidebar is rendered at all
 * @param {boolean} sidebarOpen - mobile drawer / lg visibility toggle
 * @param {boolean} isCollapsed - lg-only mini vs full variant
 */
export function getMainMarginClass(showSidebar, sidebarOpen, isCollapsed) {
  if (!showSidebar) return SIDEBAR.hidden.marginClass
  if (!sidebarOpen) return SIDEBAR.hidden.marginClass  // mobile: drawer over content
  return (isCollapsed ? SIDEBAR.collapsed : SIDEBAR.expanded).marginClass
}
