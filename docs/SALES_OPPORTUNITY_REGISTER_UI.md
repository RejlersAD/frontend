# Opportunity Register UI

Local reference redesign, 30 September 2026.

`/sales/opportunities` now uses a dedicated register presentation with the existing
Sales lifecycle controller and canonical Deal API. The sidebar and shared header
are unchanged. This route uses the established viewport workspace layout without
the shared footer. Small screens stack the register and details; table overflow
stays inside its own region.

## Behavior

- Header, four cards, attention strip, compact filters and table follow the user
  reference. The example's values/identifiers are not production defaults.
- Existing Q-102101-onward registration, full-record edit form and governed
  lifecycle dialogs are retained. A selected opportunity also has a persistent
  Overview / Commercial / Activity panel.
- Data rows stay 48px high (36px in Compact). Long names and other cell labels
  truncate with CSS ellipsis; title/client retain one line each. Deadlines use
  one date line with urgency color and full hover/accessibility context. Full
  values remain available in the details, underlying records and exports.
- The legibility follow-up uses 12px/600/#344054 table headers, 13px/500/#101828
  cells and 13px/600 opportunity names. Secondary information is 12px/400 in
  #475467; muted helpers use #667085. Page titles use weight 700. These scoped
  sizes remain at narrow widths, with semantic link/status/urgency colors and
  fixed row heights preserved. Control font inheritance does not override the
  explicit component weights.
- One table toolbar contains search, Status / Go/No-Go / Service / Owner /
  Deadline / Saved View, and the table tools. Saved View no longer has a separate
  row. Active filters, selection count and the conditional save-name form stay
  inside that toolbar. Controls align at 32px; six filters share one medium/wide
  row and a three-column group on narrow screens. Search/tools move to their
  own line when needed. Saved views still use the existing browser-local storage
  and filtering logic.
- Open means active lead/qualified/proposal/negotiation/award_pending stages.
  Pending Go/No-Go means qualified with a pending bid decision. Seven-day dates
  are calendar dates in Dubai and include today. Missing deadlines stay unknown.
- Weighted pipeline sums stored decimal values independently per currency and
  states the number missing a value or currency. No exchange rate is inferred.
- All scoped API pages load before metrics/search/filters. Duplicate IDs or
  changed/incomplete counts fail visibly. Rapid selections ignore late responses.
- CSV downloads use the backend read+export-authorized endpoint and explicit
  filtered/checked IDs; failure retains the selection for retry. Max 10,000 rows
  per export. Column visibility/density are presentation controls; CSV uses its
  documented full field set. Saved custom views are browser preferences only.
- Missing service lines are not inferred from scope. No folders, SharePoint
  links, decision authority or exact email deadlines are fabricated.

## Checks

See `playwright.sales-register.config.js` for isolated browser fixtures and
`tests/sales-opportunity-register.test.js` for data calculations. Existing
`playwright.sales-vf.config.js` retains manual/email registration and full-record
history regressions. Use Node 20 per package.json. Completion evidence is recorded
in the workspace brief `docs/features/sales-opportunity-register-reference-ux.md`.

No new frontend dependency or production deployment.

Verified: 17 register browser cases, 18 existing VF/history browser cases, 12
helper tests, scoped ESLint and the production build. Targeted application-scope
typography/controls/responsive checks also passed; the final desktop WCAG A/AA
scan had zero violations. Existing build chunk-size/Browserslist warnings remain.

Typography follow-up: the four affected existing responsive/control cases passed
with the new 13px cell / 12px header expectations. Temporary computed-style checks
verified header 12px/600/#344054, cell/owner 13px/500/#101828, opportunity name
13px/600/#101828 and client 12px/400/#475467. Rows remained exactly 48px/36px at
1366px and 390px, with ellipsis, hover context, full details and controls fitting.
Selected/hovered table and whole-workspace desktop accessibility scans reported
zero violations. Scoped test lint passed and the desktop screenshot was inspected.
The typography production build passed with the existing nonfatal warnings.

Unified-toolbar follow-up: five existing filter/control/responsive cases passed
with zero desktop accessibility violations. Temporary probes confirmed a single
wide-desktop row for the six filters, 32px controls, and popup containment at
1920/1366/390px. Preset/custom views, save/cancel, reload restore, Escape focus
and outside-close checks passed. Exact font values and 48px/36px row geometry
remain correct. Scoped JSX lint passed; no sidebar/header changes were made.
The final responsive adjustment also passed the four affected existing cases:
all six filters stay on one row at 1366px/1920px and form a three-column/two-row
group at 390px. Saved View opens immediately beneath its trigger at all three
widths. Font values and fixed row heights remain correct; final screenshots were
inspected.
The final Vite/PWA production build passed with existing nonfatal bundle-size and
Browserslist warnings. This update is served locally and has not been deployed.
