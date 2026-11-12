# RADAI — Structured Vibe Coding Context Pack

Version 0.1 · 23 September 2026 · Draft for adoption

RADAI is the working product name used in the supplied project context. This pack prepares an engineering consultancy platform for disciplined AI-assisted development. It covers all **51 supplied pages across the workspace and nine module groups**.

The navigation inventory is confirmed by the user. Architecture, ownership assignments, workflows, entities, permissions, and design values below are **proposed requirements**, not claims about the existing application or approved Rejlers policies. No repository, database, integration contract, or company policy was inspected to prepare this pack.

## What matters most

1. Give every business record one accountable domain owner.
2. Define allowed actions and state transitions before building screens.
3. Enforce permissions, validation, and approval rules on the server.
4. Preserve source evidence, revisions, approvals, and audit history.
5. Reuse a consistent design system and existing architecture.
6. Build small, complete features with observable acceptance criteria.

Documentation states the intended rules. Application code, database constraints, tests, and operational controls enforce them.

## Context files

| File | Question it answers |
|---|---|
| [PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md) | Why does RADAI exist, for whom, and within what boundaries? |
| [PRD.md](docs/PRD.md) | What behavior must the product support, and what comes first? |
| [MODULE_CATALOG.md](docs/MODULE_CATALOG.md) | What does every supplied page own, show, and allow? |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | How do modules, shared services, integrations, and AI connect? |
| [DATA_MODEL.md](docs/DATA_MODEL.md) | Which records exist, and how are they related? |
| [WORKFLOWS.md](docs/WORKFLOWS.md) | Who may move a record to its next state, and under which conditions? |
| [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | How should screens look and behave consistently? |
| [API_CONTRACTS.md](docs/API_CONTRACTS.md) | How should clients, servers, jobs, and integrations communicate? |
| [SECURITY.md](docs/SECURITY.md) | Who can access each record, field, action, and export? |
| [METRICS.md](docs/METRICS.md) | How are dashboard numbers calculated and traced? |
| [DECISIONS.md](docs/DECISIONS.md) | What is confirmed, proposed, or still unresolved? |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How should developers build, verify, release, and maintain changes? |
| [AGENTS.md](AGENTS.md) | How should an AI coding assistant work in the repository? |
| [FEATURE_BRIEF.md](templates/FEATURE_BRIEF.md) | What must be specified for one implementation task? |
| [EXAMPLE_PURCHASE_RECOMMENDATION_BRIEF.md](templates/EXAMPLE_PURCHASE_RECOMMENDATION_BRIEF.md) | What does a useful completed feature brief look like? |
| [PROJECT_BOOTSTRAP_PROMPT.md](prompts/PROJECT_BOOTSTRAP_PROMPT.md) | What should be given to Codex before feature development? |

## How to adopt this pack

1. Place these files in the target repository, merging their guidance with existing documentation. Do not overwrite an existing `AGENTS.md` without reconciling its instructions.
2. Give Codex the bootstrap prompt. Its first job is to inspect the real implementation and produce an evidence-backed gap report.
3. Resolve only the decisions that block the first feature. Unresolved approval thresholds, financial policies, or payroll rules must not be fabricated.
4. Select a small feature and complete the feature brief. Include both a successful path and meaningful denial/failure cases.
5. Implement and verify that feature, then update the affected context files with the established behavior.

The folder layout is a documentation layout; it does not prescribe a replacement source-code structure.

## Source-of-truth rules

| Subject | Authoritative evidence after adoption |
|---|---|
| Business policy | Current approved policy and recorded product decisions |
| Existing behavior | Inspected implementation and verified behavior; existing behavior can contain defects |
| Database shape | Versioned migrations and schema definitions |
| API behavior | Executable contracts and contract tests |
| UI implementation | Shared components, tokens, and accepted screen specifications |
| New feature scope | The current user instruction and accepted feature brief |

When sources disagree, record the conflict and its impact. Do not silently let an outdated document override a current requirement, or treat an existing defect as an approved policy.

## Start with a foundation and one complete workflow

Recommended dependency order: inspect the repository → clarify organization and permission scope → establish canonical employees, clients, projects, and vendors → implement approval and audit primitives → deliver one complete workflow → expand by business value. This is a proposed sequence, not a direction to rebuild working systems.

A suitable first slice, if the necessary records already exist, is **Purchase Recommendation: draft → submit → review → decision**, with project access, validation, one versioned approval route, audit history, and a clear My Requests/Approvals experience.
