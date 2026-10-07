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
 *   actions       — optional EDIT CONTROL the assistant may propose and the
 *                   user applies from the chat (requires the page to register
 *                   a handler via registerChatActionHandler):
 *                     { rowKey: '<column key identifying a row>',
 *                       ops: ['update_row', 'delete_row'] }
 *   quickActions  — optional one-tap chips rendered in the chat; each sends
 *                   its `prompt` as the user's message:
 *                     [{ id, label, prompt }]
 *   upload        — optional chat file upload (📎 button); requires the page
 *                   to register a handler via registerChatUploadHandler:
 *                     { enabled, accept: '.pdf', note }
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
    actions: {
      rowKey: 'tag',                        // rows are identified by equipment tag
      ops: ['update_row', 'delete_row'],    // assistant may propose these edits
    },
    // One-tap chat chips (soft-coded): default verification pass over every
    // row/column against the source document + an engineering recommendation
    // pass.  Corrections arrive as radai_action blocks the user applies.
    quickActions: [
      {
        id: 'verify_source',
        label: '🔍 Verify vs source',
        prompt:
          'VERIFY AGAINST SOURCE — compare EVERY row and EVERY column of the ' +
          'extracted equipment list against the document_excerpt (the uploaded ' +
          'source file). For each cell that contradicts or is missing from the ' +
          'source, propose the correction as an update_row action (match by ' +
          'exact tag). List a compact table of what you checked (rows × ' +
          'columns), what matched, and what you propose to change. If no ' +
          'excerpt is available, say so and verify internal consistency only ' +
          '(duplicates, blank mandatory fields, implausible values).',
      },
      {
        id: 'recommend',
        label: '💡 Recommendations',
        prompt:
          'RECOMMEND — analyse this equipment list as a senior process ' +
          'engineer: missing or blank fields that block procurement, duplicate ' +
          'or inconsistent tags, implausible operating/design conditions, ' +
          'type-classification gaps, and MOC/insulation concerns. Rank each ' +
          'recommendation by impact (high/medium/low) with the affected tag. ' +
          'Where a fix is a simple data correction, also propose it as an ' +
          'update_row action.',
      },
    ],
    // 📎 upload a P&ID straight from the chat — the page runs its own
    // extraction pipeline on it (handler registered by EquipmentList).
    upload: { enabled: true, accept: '.pdf', note: 'P&ID PDF' },
  },
}

export default CHAT_PAGE_PROFILES
