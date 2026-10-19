# Go / No-Go display terminology

Scope SAL-TERM-01: the user requests replacing user-facing Bid / No-Bid with
Go / No-Go throughout decision UI, dashboards, help, notifications, AI wording,
letter/PDF/DOCX labels, CSV and Analysis exports, and audit display names.
Conditional Bid is displayed as Conditional Go.

Preserve `bid`, `conditional_bid`, `no_bid`, endpoint names, keys, model choices,
permissions, workflow gates, calculations and integrations. No migrations.
Historical decisions use a presentation formatter; stored audit events, customer
source excerpts, original emails and authored documents remain unmodified.
AI prompts request the new prose while retaining JSON enum codes and exact
evidence. The existing contradiction safeguards compare the equivalent legacy
wording so their decision policy remains the same.

Frontend scope includes Sales, Executive commercial reports, Planning proposal
workspace labels and notification display. Backend scope includes Sales validation
messages, AI instructions, display contexts and generated export/template labels.

Verification artifacts: `artifacts/go-terminology-*`. All 26 selected frontend
helper tests pass. Scoped lint has no errors; it reports existing warnings in
the broader Planning/notification files. Production-profile build passes.
Decision submission browser checks retain `bid` and `no_bid` payloads; the
late-response case verifies old No-bid AI wording displays/saves as No-Go.
Across the final browser runs, 16 unique decision/history checks and three
proposal-preparation checks pass. The history check was rerun after updating its
loaded legacy label assertion (`go-terminology-history-verified.log`); workspace
creation passed after allowing for the cold application import
(`go-terminology-preparation-retry.log`). The remaining dialog Axe failure is
the unchanged baseline contrast issue described below.

Known baseline checks: the backend foreign-owner/client-organization test fails
identically when the previous justification module is loaded (baseline log:
`artifacts/go-baseline-scope.log`). Current `visible_deals` permits module-visible
Sales opportunities, unlike that older test's 404 expectation. No access policy
is changed. The dialog Axe check also exposes existing summary text contrast
(`#6b7a90`); its CSS is unchanged in this terminology patch.

## Push preparation

Aligned with fetched development and main, including concurrent remote Equipment
List updates; merges completed without conflicts. The main-base PR contains the
terminology work and Analysis test-selector correction, retaining current Radai
UI naming. The orphaned backend ignore-file merge marker is removed.

Release checks: 36 selected helper tests pass, including Forecast. Seven additional
Analysis browser journeys pass after correcting stale Copilot selectors; its Axe
case reports existing contrast (selected Brief text `#6366f1` on white). This is
separate from the existing dialog contrast failure above. Build evidence after
remote alignment: `artifacts/go-release-production-build.log`.

Local `manage.py migrate --check --noinput` exits 0. `radai_dev` contains 629
applied migrations, including all 32 Sales migrations through
`0032_letter_fingerprints`. No migration or model changes are introduced here.
Production database state is not covered by this local verification.
