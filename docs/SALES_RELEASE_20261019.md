# Sales release alignment — 19 October 2026

User-authorized scope: prepare all pending frontend/backend changes, align with
remote development, push development and open main-base PRs. Remote development
and current main were merged without conflicts. Existing local Sales Copilot,
Bid Decision and service formatting changes are included.

The release preserves the supplied Copilot/Bid layouts and existing backend
contracts. Qualification scores and suggestions remain advisory. Record-based
justification drafts are labelled separately from validated backend AI output;
only Save Decision records a business decision. CEO and proposal gates remain
server-controlled.

Readiness corrections:

- Stabilize the bid dialog's readiness callback and avoid repeated state updates.
- Fence AI responses by opportunity, selected decision and request generation;
  remount when the selected opportunity changes and prevent saving while busy.
- Keep absent commercial values unknown and retain genuine zero values.
- Preserve cited document relationships in Brief, alongside source evidence.
- Correct bid summary and Analysis confidence text contrast while retaining
  the existing palette.
- Update browser journeys for the full-record drawer, redesigned decision radios
  and Copilot/Brief navigation. Keep explicit writes, denial/retry, stale response
  and desktop/mobile accessibility checks.

Validation artifacts are under `artifacts/sales-release-*`: 49 helper tests pass
(`unit-final.log`) and all 16 Chromium browser checks pass (`browser-complete.log`),
including desktop/mobile Axe checks. Scoped ESLint has no errors (two existing
unused-variable warnings). The production-profile Vite/PWA build passes
(`production-final.log`), retaining existing bundle-size/Browserslist warnings.

Backend migration check after alignment: `manage.py migrate --check --noinput`
exited 0. Local PostgreSQL has 629 migration records, including all 32 Sales
migrations through 0032_letter_fingerprints. This release introduces no migration.
Production database state was not queried or changed.

Backend release notes: `backend/docs/SALES_OPPORTUNITY_PROPOSAL_RELEASE.md` in the
parent workspace. Push targets are origin/development; PRs target main. Opening
a PR does not merge it or certify production account assignments.
