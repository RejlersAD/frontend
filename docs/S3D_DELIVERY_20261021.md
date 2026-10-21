# S3D Database Builder delivery — 21 October 2026

Authority: the user's S3D reference/release, BUHASA matching and field-review
requests, followed by explicit authorization to align/push Development and
create PRs. I-06 requires incremental reuse; existing shared navigation and the
three-pane review layout are preserved.

This delivery includes resilient upload/preview, pinned reference matching,
review and controlled release/pilot UI, the generated BUHASA dictionaries and
parser, canonical property comboboxes, candidate differences, atomic source
linking and detail-pane shortcuts. Matching/release APIs are additive and the
backend must include migrations 0014–0016 before using these features.

Use Project dictionary → BUHASA codelists → Run Matching for this project.
Canonical edits persist through match review and re-evaluate eligibility.
Search text cannot be saved as a standard property. `1`/`2`/`3` select catalog
rows; Enter/Ctrl+Enter confirms and advances after success; Escape closes or
clears. Available page/table/box evidence is linked on confirmation. Missing
coordinates are not invented. No engineering release authority, approved pack
or successful real SP3D import is inferred from synthetic verification.

Parser usage is in [BUHASA_CODELISTS](../scripts/BUHASA_CODELISTS.md). Backend
contracts, migrations and release checks are delivered in the companion backend
PR. Workspace authority/verification notes are also maintained under the
parent workspace's `docs/features/s3d-*.md` files, which are not part of this
standalone repository.

Alignment, final checks and PR evidence are recorded below before publication.

Verification on 21 October 2026:

- Merged current `origin/development` and the equipment/help fixes on
  `origin/main`, preserving the S3D help entry. No conflicts remain.
- Dedicated S3D Playwright suite: 26 passed, including responsive layout,
  canonical selectors, evidence linking, keyboard review and release guards.
- BUHASA parser unit suite: 7 passed.
- Production Vite build: passed. Existing large-chunk/dependency warnings
  remain; no build errors.
- ESLint on changed JavaScript: zero errors; 78 existing warnings remain.
  The subsequently aligned help registry also passes ESLint.
- Backend verification is recorded in its companion delivery document;
  migration success is local/disposable PostgreSQL evidence, not production.

Test/runtime import fixes do not change application behavior. Generated
dictionary content and sidebar implementation remain unchanged by alignment.

## Release follow-up

Fetched origin/development and origin/main explicitly. Development already
matched its remote; the latest main merge commit was integrated by
fast-forward without conflicts. The pending specCustomizationAPI.js and
planning-package-restoration.spec.js edits are formatting only: Acorn parsing
confirms identical syntax trees against their committed versions after
excluding source positions and raw literal spelling. Both files pass ESLint.
The production Vite/PWA build passes with the existing bundle-size and
Browserslist-age warnings.

The companion backend change repairs missing physical PostgreSQL FK target
keys before migration 0014 runs. Local PostgreSQL has 0014-0016 applied, no
pending migrations, consistent history and no S3D model-state drift. This
does not establish production migration or deployment success.

Current S3D browser verification: 25 tests passed in the initial suite; the
first upload test exceeded its 90-second initial-load timeout. That test passed
on a focused rerun with the documented S3D_TEST_TIMEOUT_MS=240000 setting
(1.4 minutes total). All 26 scenarios therefore have passing results; this is
not a claim of a single uninterrupted 26-test pass. Parent workspace logs:
artifacts/release-20261021-playwright.log and
artifacts/release-20261021-playwright-retry.log. git diff --check also passes.
