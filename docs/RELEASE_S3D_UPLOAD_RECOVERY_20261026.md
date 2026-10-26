# S3D upload recovery and profile identity - 26 October 2026

Authority: user requests the local extraction, incorrect profile label and export
fixes, followed by alignment/push of all pending work and review PRs. Reuse the
existing components/API contracts; no frontend grant or extraction-rule changes.

Remote Development's ten commits merged without conflicts after a local checkpoint.
The incoming I/O-list workspace, authenticated downloads and export fixes remain.

## Behavior

- A timed-out/network-failed upload queries existing jobs with `mine=1`. A single
  caller-owned recent filename/size match in queued/processing/completed state
  resumes that run. There is no automatic second POST. An uncertain lookup keeps
  the file selection and directs the user to History.
- Whole SPEC/CAT preview consumers share only pending reads by login token, job
  and workbook. Completed/error responses are not cached; mutations invalidate
  pending reads, and a new login cannot receive an older account's response.
  Hub counts use the workspace's existing preview instead of another full GET.
- Raw combined XLSX/JSON downloads use `export_format` to avoid DRF renderer
  interception. SPEC/CAT continue to request explicit drafts and retain backend
  completeness/release rules. Partial PMS coverage still returns 409 for those
  two formats; available raw exports do not imply engineering acceptance.
- Both header variants pass the loaded RBAC profile to the shared role formatter.
  Actual Django superuser flags, RBAC roles/primary role and staff identity drive
  the displayed label; this display change grants no access.

Backend-first compatibility: `mine=1` and `export_format` are additive query
parameters in the paired backend change; JSON response shapes remain unchanged.
Backend migration verification is documented in its release note. No production
database or deployment is certified by local checks.

## Verification

Node 24: all 553 Node tests pass, including actual API in-flight sharing/session/
mutation behavior. Three Chromium component tests pass for processing, completed
and missing upload recovery, asserting exactly one POST. Scoped source lint has
zero errors/four existing prop-validation warnings. Production Vite/PWA build
passes with 124 precache entries. Existing bundle-size/Browserslist warnings remain.
The browser checks use synthetic API/identity fixtures and do not start extraction.

Real local backend HTTP confirmed raw XLSX/JSON downloads and compressed preview
(439,624,698 decoded bytes, 7,226,629 wire bytes, 75.95 seconds). This retains the
whole-workbook contract; browser-memory/pagination improvements remain separate.
No force push/main merge or engineering release is performed. Private source PDFs,
raw candidates, database backups and workspace logs are excluded from these commits.
