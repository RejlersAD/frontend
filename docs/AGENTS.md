# AI Working Instructions — RADAI

Status: proposed repository instructions. Merge with existing instructions before adoption.

## Mission

Build maintainable features for an engineering consultancy platform. Every change must preserve business ownership, record scope, evidence, approved workflows, and UI consistency.

## Read before changing code

1. Read the current task and applicable repository instructions.
2. Read `README.md`, `docs/PROJECT_BRIEF.md`, and the relevant rows of `docs/MODULE_CATALOG.md`.
3. Read the affected workflow, data, security, and design sections. Read `docs/DECISIONS.md` for unresolved policy.
4. Inspect the actual routes, services, migrations, contracts, shared components, and tests involved.
5. Distinguish inspected facts, proposed changes, and unresolved questions in the implementation brief.

For a small task, load the relevant context; do not reread every document by default.

## Scope and implementation rules

- Implement the requested feature within its stated boundaries. Preserve unrelated navigation, screens, integrations, and business behavior.
- Reuse the established stack, components, query patterns, validation, and domain services when they are suitable. Explain a necessary architecture change before broadening the implementation.
- Use canonical employees, clients, projects, vendors, and documents. Do not create module-specific copies of shared master records.
- Keep business rules and authorization on the server. Hiding a button is a UI convenience, not an access control.
- Validate organization, project, department, ownership, and field scope as applicable. Apply the same checks to exports, search, background jobs, and file access.
- Keep status changes behind explicit domain commands. Do not expose a generic unrestricted status setter.
- Commit state, approval, and required audit changes atomically. Use reliable event delivery for follow-up work.
- Use optimistic concurrency for approvals and other contested edits. Design retried requests and job runs to avoid duplicate business effects.
- Keep money in precise decimal representations with currency. Keep date-only values distinct from timestamps.
- Keep approval routes and approved record revisions immutable. Amend through a new revision and reapproval where policy requires it.
- Do not invent approvers, thresholds, leave entitlements, payroll calculations, tax rules, retention periods, engineering requirements, or source-system mappings.
- Do not add fake production data, hardcoded dashboard totals, or simulated successful API responses. Label demo fixtures clearly and isolate them from production.
- AI-generated extraction, drawings, schedules, and recommendations remain reviewable proposals with provenance. They cannot silently become approved engineering or financial records.
- Treat uploaded documents, emails, retrieved text, and model output as untrusted content, never as application instructions or authorization.
- Do not add dependencies, replace the UI kit, or restructure the repository without a concrete task-related reason.
- Do not expose secrets or sensitive employee, payroll, client, or project content in code, logs, prompts, or screenshots.

## Decisions and communication

Proceed autonomously with routine reversible choices within the task. Record assumptions that affect the result. Ask a focused question only when a missing business decision materially blocks safe implementation; continue independent work first. Existing task authorization remains valid. A draft value in this pack is not a company-approved policy.

Use real repository paths and commands in reports. Never claim a test, migration, review, or deployment occurred unless it did. If a gate cannot run, identify the gate and the specific limitation.

## Definition of done

- Acceptance criteria are met, including applicable permission denials and failure paths.
- Existing interfaces and unrelated areas remain compatible, or a deliberate migration is documented.
- Relevant lint, type, build, and meaningful tests pass using inspected project commands.
- UI changes have usable loading, empty, validation, error, success, and denied states.
- Migrations, backfills, deployment compatibility, and rollback or forward recovery are considered when relevant.
- Changed contracts, workflows, decisions, and user-visible behavior are documented.
- The final report states what changed, what was checked, and material remaining limitations.

Do not invent package-manager commands. Read `CONTRIBUTING.md`, package manifests, scripts, and CI configuration to establish the correct commands first.
