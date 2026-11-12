# Quality and Delivery

Version 0.1 · Repository-specific commands must be filled from inspection

## Working sequence

1. **Understand:** inspect the current implementation, task boundaries, relevant context, and dependencies.
2. **Specify:** complete a small feature brief with data ownership, workflow, permissions, and observable acceptance criteria.
3. **Plan:** identify affected files/contracts/migrations and blockers. Preserve unrelated work.
4. **Build:** implement one complete useful path with the relevant failure behavior.
5. **Verify:** run the actual project gates and targeted checks that establish the acceptance criteria.
6. **Maintain:** update changed contracts, established rules, and decisions; record material limitations.

## Repository command register

No repository was inspected while preparing this pack. Replace the values below with commands found in the actual manifests, scripts, README, and CI configuration. Do not execute the placeholders.

| Purpose | Command | Evidence to record |
|---|---|---|
| Install | `TO_BE_DISCOVERED` | Package manager and lockfile |
| Local application | `TO_BE_DISCOVERED` | Dev script and required services |
| Lint | `TO_BE_DISCOVERED` | Manifest/CI definition |
| Type check | `TO_BE_DISCOVERED` | Compiler/project configuration |
| Unit/integration tests | `TO_BE_DISCOVERED` | Test runner configuration |
| UI/end-to-end tests | `TO_BE_DISCOVERED` | Existing test framework and supported environment |
| Production build | `TO_BE_DISCOVERED` | Build script and environment needs |
| Migration validation | `TO_BE_DISCOVERED` | Migration framework and test database workflow |
| Deploy/rollback | `TO_BE_DISCOVERED` | Existing runbook and authorization |

Document required environment-variable names without including secret values. Keep fixtures synthetic and clearly labeled.

## Meaningful verification

Choose checks proportional to the change. A text or spacing correction may need visual inspection and the standard build gates; it does not need tests that merely mirror the edited text.

Workflow, authorization, finance-related state, and integration changes need meaningful evidence:

- Valid action by an authorized actor succeeds with the correct persisted state.
- Invalid transition or insufficient authority is rejected without partial business changes.
- Concurrent/stale requests cannot overwrite another decision.
- Repeated requests/events do not duplicate the intended business effect.
- A downstream delivery failure remains recoverable and visible.
- Relevant data/field scope is preserved across API, UI, files, exports, jobs, and search.
- Controlled revisions, audit records, and event references remain consistent.

For document/planning intelligence, validate with varied source structures, ambiguous/conflicting evidence, missing inputs, and reviewed expected outcomes. Example documents are evaluation cases, not templates to hardcode into production logic.

## Database and deployment changes

- Review backward compatibility with running application versions and workers.
- Prefer staged schema expansion, backfill, validation, then removal when needed.
- Reconcile migrated record counts, references, totals where applicable, and exceptional rows.
- A schema change that loses information may require backup restoration or forward recovery rather than a simplistic down migration.
- Define rollout, health indicators, stop conditions, and recovery for the affected feature.
- Use feature flags when a new workflow/policy is not ready for all users; flags do not replace authorization.

## Review standard

A change description explains the user problem, changed behavior, scope, important implementation choices, migration/configuration requirements, and verification evidence. Separate completed checks from unavailable checks. Do not claim compliance, production readiness, or policy approval merely because tests pass.

## Documentation maintenance

Update only the documents affected by a change. Keep implementation detail authoritative in schema/contracts/components rather than duplicating whole code definitions into prose. Use the decision log when changing ownership, workflow, access, calculation, integration authority, or UI conventions.

## Ready for release

The feature meets its accepted criteria, required project gates pass, relevant risks have evidence-based controls, migration/recovery is understood, required configuration exists, and the release follows the repository's actual authorized process. A context-writing task by itself does not request a production deployment.
