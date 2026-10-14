# RADAI Workspace Instructions — Structured Vibe Coding

This is the shared root workspace instruction file for the RADAI project context, adopted across all sub-modules and repositories.

## 1. Core Principles
* **Context Over Intuition:** Every implementation must strictly align with the established specifications in the `docs/` folder (PRD, Architecture, Data Model, and API Contracts).
* **Incremental Evolution:** Do not overwrite functional code unless explicitly addressing a gap outlined in the repository gap report or decision register.
* **Traceability:** All major structural or logic changes must map back to an authorized decision ID or open feature brief.

## 2. Shared Workflows & Release Management
* All development work must maintain the integrity of existing API contracts and database schema boundaries.
* Before any module or frontend integration is declared complete, it must be verified against the rules outlined in the individual repository `AGENTS.md` file.
* If a conflict arises between a local module implementation and the global architecture guidelines, development must stop until the conflict is surfaced and resolved.
