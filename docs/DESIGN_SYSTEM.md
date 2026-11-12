# Enterprise Design System

Version 0.1 · Proposed tokens and interaction standards

## Design intent

RADAI should feel like a coherent professional operations console: readable, restrained, predictable, and efficient for frequent users. Optimize for finding records, understanding exceptions, completing forms, and making correct decisions.

Preserve the existing shared UI library when suitable. Map these proposed values into its token system; do not install a second component framework or redesign unrelated screens as part of a feature request. No brand specification was supplied, so all visual values below are proposed.

## Application shell

Keep the supplied top-level order: Workspace, Engineering, Shared tools, Finances, Human Resources, Sales, Project Control, Procurement, QHSE, Admin. Workspace contains Executive overview, Dashboard, and Approvals.

- A persistent desktop sidebar groups related pages and shows one clear active item. Use progressive disclosure for the nine module groups.
- Show a contextual page title and optional breadcrumb; keep module navigation separate from record-level tabs.
- Display a global organization/project selector only if it matches the actual access/data model. Do not add a decorative selector with no filtering effect.
- Main content gets one primary action where appropriate, followed by relevant filters and work content.
- Approvals, My Requests, and notifications reference source records. They should not create parallel edit experiences with inconsistent validation.
- Smaller screens use a navigation drawer and deliberate table overflow/detail views; do not compress every column until unreadable.

## Proposed visual tokens

| Token | Value | Usage |
|---|---|---|
| Font family | Existing approved enterprise font; fallback `Inter, Segoe UI, system-ui, sans-serif` | Use locally available/approved assets; an external font download is not required |
| Page title | 24px / 32px, weight 600 | One per page |
| Section title | 18px / 26px, weight 600 | Clear grouping |
| Body/control | 14px / 20px, weight 400 | Forms, tables, descriptions |
| Label/table header | 13px / 18px, weight 600 | Field labels and column names |
| Metadata | 12px / 18px, weight 400 | Secondary timestamps and identifiers; avoid for core values |
| Page background | `#F5F7FA` | Neutral workspace |
| Surface | `#FFFFFF` | Forms, tables, panels |
| Primary text | `#172B4D` | Main content |
| Secondary text | `#526176` | Supporting information |
| Border | `#D7DFE8` | Structural separators; strengthen where needed for control visibility |
| Action | `#175CD3` | Primary action and active links |
| Action hover | `#124BAA` | Hover state |
| Success | `#16703C` on `#ECFDF3` | Text/icon plus status label |
| Warning | `#854D0E` on `#FFF7DB` | Text/icon plus status label |
| Danger | `#B42318` on `#FEF3F2` | Errors and destructive actions |
| Focus | 2px visible outline with 2px offset | Choose contrast against adjacent surfaces |
| Spacing scale | 4, 8, 12, 16, 24, 32px | Shared spacing tokens |
| Radius | 6px controls, 8px panels | Consistent modest rounding |
| Shadow | None for ordinary cards; subtle for overlays | Hierarchy mostly comes from layout and borders |

Treat these as implementation defaults to validate in actual combinations. Test text contrast, control boundaries, focus, zoom, and disabled/error states; the palette alone does not demonstrate accessibility compliance.

## Layout dimensions

| Element | Proposed desktop value | Responsive rule |
|---|---|---|
| Sidebar | 240px expanded | Collapse to drawer when content becomes constrained |
| Top bar | 56px minimum | Can grow for content/zoom |
| Page padding | 24px | 16px on narrow screens |
| Section gap | 24px | Keep related fields closer than unrelated groups |
| Panel padding | 20–24px | 16px on narrow screens |
| Field gap | 16px vertical, 16–24px horizontal | One-column form on narrow screens |
| Standard control | 40px minimum height | Larger hit targets where touch interaction is primary |
| Table row | 44px default, optional 36px density mode | Content wrapping may increase height; preserve accessible targets |
| Detail drawer | 480–640px | Full-screen dialog/page on narrow screens |
| Form reading width | Roughly 800–960px | Avoid fields stretching across a wide monitor without purpose |

## Reusable page patterns

| Pattern | Structure | Examples |
|---|---|---|
| Operational list | Title/action → compact key signals if useful → filters/search → table → pagination | Opportunities, employees, invoices, orders |
| Dashboard | Scope/date/freshness → 3–5 decision-relevant measures → exceptions → supporting detail | Procurement, Sales, HR, Finance |
| Record detail | Identity/status → primary actions → summary → relevant tabs/sections → history | Client, project, employee, purchase order |
| Form | Title → clear sections → inline validation → persistent action area when needed | Recommendation, leave, invoice draft |
| Review | Submitted revision → evidence/changes → approval steps → decision controls/reason | Approvals, proposal review, baseline review |
| Portfolio/planning | Scope and filters → portfolio/table/timeline view → contextual selected-item detail | Portfolio, Plan & Baseline |
| Tool job | Source selection → configuration → progress → evidence-based result → review/export | Multi-Revision, Data Mining, PFD to P&ID |

Use full pages for complex documents, planning, and long forms. Use a drawer for quick inspection or a bounded task. Do not force an entire approval-heavy form into a narrow drawer.

## Component behavior

- Tables: meaningful default columns, server-backed search/filter/sort, stable row identity, pagination, persisted user preferences where supported, clear selection scope, and explicit bulk-action eligibility.
- Forms: visible labels, required indicators, examples only where helpful, grouped fields, input-preserving errors, and a distinction between Save Draft and Submit.
- Money/date fields: show currency and unit; use locale-aware display without ambiguity; validate on the server.
- Statuses: label plus visual cue; avoid color-only meaning and decorative status gradients.
- Approval workflow table: Step, Reviewer/Role, Scope or rule summary, Status, Decision time, Comment. Expand details only when needed.
- Detail panels: retain list/filter context when opened and closed; deep links should resolve to the same record.
- Dangerous actions: explain the specific consequence and use appropriate confirmation for irreversible effects. Ordinary saves should not trigger repetitive confirmation dialogs.

## Required states

| State | User experience |
|---|---|
| Loading | Stable structure with an appropriate progress/skeleton treatment |
| Empty | Explain why there are no records and offer the permitted next action |
| No filter results | Preserve filters and provide a reset action |
| Validation failure | Field messages plus a navigable summary for long forms; input remains intact |
| Access denied | Safe explanation and route back; no confidential record preview |
| Stale version | Explain that the record changed and offer refresh/compare before retry |
| Failed operation | Actionable error and correlation reference where useful; no false success |
| Success | Clear saved/submitted/approved state and next relevant action |
| Partial job failure | Show successful and failed items separately and eligible retry options |

## Screen-change boundary

Before a UI task, identify the exact screen, region, existing fields, and protected surrounding areas. A request to redesign one form is not permission to add fields, change the sidebar, alter adjacent panels, or redesign other tabs.

Verify keyboard navigation, focus return after drawers/dialogs, descriptive names, readable contrast, responsive overflow, and the actual requested screen boundary. Use realistic labeled demo data only in development previews.
