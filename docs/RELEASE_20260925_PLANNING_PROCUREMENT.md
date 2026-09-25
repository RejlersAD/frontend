# Procurement and planning release - 25 September 2026

## Behavior

PR/PO/vendor upload review uses the reference layout in a centered, resizable
window inside the main content. Source PDF and extracted values remain visible.
Saved PRs display Additional Approver, Level labels, correction notes and all
explicit project numbers. Unknown source approvers can be corrected with a
required note. Richa appears at Level 0 with her actual recorded evidence status.
CSV project references retain canonical selections. These display annotations
do not grant live approval authority.

Project Control uses the retained Master Schedule with shared version selection
and Performance, alongside the Document Intelligence workflow and generation
wizard. Analysis and preview jobs show real progress and support scoped recovery.
Planning evidence and restored generation editing retain source and approval
boundaries. Eligible project deletion requires explicit confirmation and preserves
protected dependencies; failed actions retain input and recorded state.

The existing sidebar and application shell remain unchanged. Notification recovery
and shared typography changes already present on remote main are retained.

## Alignment

The initial development revision was `a8a7bc8`, matching origin/development.
Local source/tests/docs were checkpointed at `3d2c4bb`; origin/main `7647860`
was merged into development at `64c0c79` without conflicts. This release uses
development as its source and main as its review target.

## Verification

Application checks use Node 20.20.2, as required by package.json:

- All 311 root-level Node tests passed on the aligned application revision.
- ESLint over 30 changed JavaScript/JSX source files passed with zero errors
  and 11 existing warnings.
- `npm run build` passed, including PWA generation with 111 precache entries.
  Existing stale Browserslist and large-chunk warnings remain.
- Full browser release verification is in progress. This section must be
  finalized before release handoff.

Local command logs and manifests are under the parent workspace's
`artifacts/release-development-20260925/`. Browser checks use an isolated checkout
and synthetic intercepted APIs; they do not modify live business records or prove
backend authorization, migration state or real-provider OCR. Backend verification
is recorded separately in its release document.
