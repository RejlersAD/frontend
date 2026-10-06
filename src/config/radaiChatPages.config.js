/**
 * radaiChatPages.config.js — SOFT-CODED per-application profiles for the
 * global RADAI Assistant chat widget.
 *
 * Each profile tells the assistant WHAT application the user is working in,
 * WHAT the published rows represent, and HOW to verify/validate them — so the
 * same widget answers strictly within the current tool's data and rules.
 *
 * Wiring a new page = one profile entry here + one `useRadaiChatPage(key, …)`
 * call in the page component. No widget or backend changes required.
 *
 * Profile fields:
 *   page          — label shown in the widget context banner
 *   rowName       — what one row represents ('issue', 'stream property', …)
 *   notes         — describes the dataset (columns/units/origin)
 *   domainPrompt  — verification & validation rules injected into the answer
 *                   grounding (backend appends it to the system prompt)
 */

export const CHAT_PAGE_PROFILES = {
  // ── 1.1 Process — Line List (/engineering/process/line-list) ─────────────
  line_list: {
    page: 'Line List',
    rowName: 'line-list row',
    notes:
      'Rows are line-list entries extracted from a P&ID. Columns include ' +
      'size, service/fluid code, sequence number, piping spec/class, ' +
      'department deviation, insulation, and FROM→TO routing.',
    domainPrompt:
      'You are assisting with LINE LIST extraction review. Verify and ' +
      'validate ONLY against the published rows: cite line numbers exactly; ' +
      'count/group by size, fluid code, spec or insulation when asked; flag ' +
      'duplicate line numbers and missing FROM/TO endpoints as gaps; never ' +
      'invent line numbers that are not in the context.',
  },

  // ── 1.1 Process — P&ID QC (/engineering/process/pid-verification) ────────
  pid_qc: {
    page: 'P&ID QC',
    rowName: 'QC finding / issue',
    notes:
      'Rows are QC findings from automated P&ID verification. Each finding has ' +
      'a severity, category/check name, message, the drawing it belongs to and ' +
      'the affected tag(s). Comparison findings cross-check P&ID content ' +
      'against project reference data (line list, equipment list, legend).',
    domainPrompt:
      'You are assisting with P&ID QUALITY CONTROL. Verify and validate ONLY ' +
      'against the published findings: cite severity and the affected tag/' +
      'drawing exactly; group or count by severity/category when asked; ' +
      'distinguish open findings from overridden ones; never invent new ' +
      'issues that are not in the context. When asked "is this P&ID OK", ' +
      'base the verdict on the severity mix of the findings.',
  },

  // ── 1.1 Process — HMB Consolidator (/engineering/process/hmb-stream-table-consolidator)
  hmb_consolidator: {
    page: 'HMB Consolidator',
    rowName: 'stream property (per case)',
    notes:
      'Rows are flattened HYSYS stream-table properties across loaded cases: ' +
      'one row per (case, stream, property) with value, unit and an "edited" ' +
      'flag for manual overrides. Cases are alternative simulation scenarios ' +
      'being compared.',
    domainPrompt:
      'You are assisting with HEAT & MASS BALANCE stream comparison. Verify ' +
      'and validate ONLY against the published stream properties: compare ' +
      'values for the same stream/property ACROSS cases and report deltas; ' +
      'flag properties marked edited=true as manual overrides; always state ' +
      'the unit shown in the row; never estimate thermodynamic values that ' +
      'are not present in the context.',
  },

  // ── 1.1 Process — Equipment List (/engineering/process/equipment-list) ────
  equipment_list: {
    page: 'Equipment List',
    rowName: 'equipment item',
    notes:
      'Rows are equipment items extracted from a P&ID (tag, type/classification ' +
      'such as Vessel/Pump/Heat Exchanger/Reactor, service/description, size, ' +
      'operating conditions, connected lines, source page).',
    domainPrompt:
      'You are assisting with EQUIPMENT LIST extraction review. Verify and ' +
      'validate ONLY against the published equipment rows: cite equipment ' +
      'tags exactly; classify/count by equipment type when asked; flag ' +
      'duplicate tags, missing types or missing operating data as gaps; ' +
      'never invent equipment that is not in the context.',
  },
}

export default CHAT_PAGE_PROFILES
