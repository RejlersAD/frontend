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
