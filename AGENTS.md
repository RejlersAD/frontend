# RADAI frontend instructions

These instructions apply throughout this repository. Read and follow the shared workspace instructions in [../AGENTS.md](../AGENTS.md), including the existing release workflow and implementation guidance, together with any more specific applicable instructions. This file supplements those instructions.

## Mandatory context consultation before any edit

1. Before any edit, Codex must consult **RADAI Project Context — Structured Vibe Coding**, using the adopted documents listed below. Read the project overview ([../README.md](../README.md) and [../docs/PROJECT_BRIEF.md](../docs/PROJECT_BRIEF.md)), the gap report, the decision register, and the context sections and feature brief relevant to the requested change. Read applicable instructions and inspect the current implementation before selecting application changes.
2. Before editing, briefly identify the actual document paths and relevant sections consulted, the applicable requirements and their status, and the intended change boundaries. Keep this summary proportionate to the task; it is not a request for routine approval.
3. Follow the documented architecture, module ownership, workflows, permissions, data contracts and design standards applicable to the task, using the repository-grounded sections and approved decisions. Reuse established implementations and keep the work within the requested scope.
4. Keep inspected behavior, approved requirements, proposed rules and unresolved decisions distinct. Adoption of the context documents does not approve every draft policy, illustrative contract, target architecture or example prompt. Surface material conflicts between the request, context and implementation with source paths and consequences instead of guessing. Seek clarification only when a consequential unresolved decision blocks the affected work; continue independent authorized work.
5. Before declaring completion, verify the change against the consulted requirements and scope, run relevant documented checks, and report the evidence and any gaps. When established behavior changes, update affected context, contracts, feature briefs and decisions accurately. Never rewrite context merely to justify an unrelated implementation.

## Adopted context locations

Verified on 24 September 2026: **RADAI Project Context — Structured Vibe Coding** is adopted at the parent workspace `C:/Users/firaolak/RAD-PROJEC/`. These paths are relative to this repository's `AGENTS.md`, not to the current shell directory. They point to the same shared documents identified by the workspace overview and decision I-10; this repository's own documentation remains relevant to its implemented contracts.

| Context | Actual path relative to this instruction file |
| --- | --- |
| Project overview and context index | [../README.md](../README.md), [../docs/PROJECT_BRIEF.md](../docs/PROJECT_BRIEF.md) |
| Inspected coverage and gaps | [../docs/REPOSITORY_GAP_REPORT.md](../docs/REPOSITORY_GAP_REPORT.md) |
| Requirement status and decisions | [../docs/DECISIONS.md](../docs/DECISIONS.md) |
| Product scope | [../docs/PRD.md](../docs/PRD.md) |
| Architecture and module ownership | [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md), [../docs/MODULE_CATALOG.md](../docs/MODULE_CATALOG.md) |
| Data ownership and API contracts | [../docs/DATA_MODEL.md](../docs/DATA_MODEL.md), [../docs/API_CONTRACTS.md](../docs/API_CONTRACTS.md) |
| Workflows and permissions | [../docs/WORKFLOWS.md](../docs/WORKFLOWS.md), [../docs/SECURITY.md](../docs/SECURITY.md) |
| Design standards and metrics | [../docs/DESIGN_SYSTEM.md](../docs/DESIGN_SYSTEM.md), [../docs/METRICS.md](../docs/METRICS.md) |
| Verification guidance | [../CONTRIBUTING.md](../CONTRIBUTING.md) |
| Existing scoped feature brief (when relevant) | [../docs/features/purchase-recommendation-concurrency.md](../docs/features/purchase-recommendation-concurrency.md) |
| Brief templates (reference only) | [../templates/FEATURE_BRIEF.md](../templates/FEATURE_BRIEF.md), [../templates/EXAMPLE_PURCHASE_RECOMMENDATION_BRIEF.md](../templates/EXAMPLE_PURCHASE_RECOMMENDATION_BRIEF.md) |
| Bootstrap prompt (reference only, not a new task) | [../prompts/PROJECT_BOOTSTRAP_PROMPT.md](../prompts/PROJECT_BOOTSTRAP_PROMPT.md) |

The shared context is outside this Git repository and is not automatically included in a standalone clone. If a required context file or the shared instructions are unavailable, locate the current adopted copy and report its actual path before editing dependent work. If it cannot be located, surface the missing context as a blocker for that work; do not silently substitute repository-local files or archives, invent requirements or recreate context to fit an implementation.
