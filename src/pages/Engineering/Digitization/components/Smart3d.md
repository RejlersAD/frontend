# RADAI SmartPlant 3D Strategic Roadmap & Product Assessment
**Version:** 1.0\
**Date:** October 2026\
**Status:** Internal Architecture & Execution Guidance

---

# Executive Summary

SmartPlant 3D within RADAI is no longer merely an AI extraction tool. It is evolving into a controlled engineering-data transformation platform that converts project documents into validated, auditable, and SmartPlant-ready specifications.

The current platform already delivers significant value through AI-powered extraction, project persistence, workflow resilience, and specification processing. However, the next stage is not about adding more AI models or user interfaces.

The primary objective is to establish a **trust chain**:

> Source Evidence → Extraction Completeness → Reference Validation → Match Decision → Human Review → Deterministic Validation → Frozen Release → Verified SmartPlant Import

This trust chain becomes the foundation for engineering confidence, auditability, and future scale.

---

# Current State of SmartPlant 3D

## Platform Scope

The SmartPlant 3D module (`/engineering/digitization/smart-plant-3d`) currently serves as RADAI's engineering digitization hub.

### Available Today

#### Valve Standards Reference
- ASME B16.34 pressure ratings
- Engineering reference lookup

#### Paper Specification Processing
Workflow:

```text
Upload
 ↓
AI Extraction
 ↓
Extracted Data Review
 ↓
Save Extracted Data
```

#### Planned Features

- 3D Model Import
- Piping Data Synchronization
- 3D Model Analytics

These remain future capabilities.

---

# Three-Pillar Architecture

## Pillar 1 – AI Document Extraction

### Status
✅ Operational and production-ready for controlled use

### Implemented Capabilities

- Chunked document extraction
- Text-layer parsing
- AI provider failover
- Persistent jobs
- Progress monitoring
- Cost tracking
- SHA-based document identity
- Automatic project creation
- Browser refresh recovery
- Retry support
- History logs
- Appendix-A pipe class extraction
- Low-confidence review workflows

### Strengths

The extraction pipeline is no longer the primary bottleneck.

The system successfully handles:

- Long documents
- Large specifications
- Processing interruptions
- Partial extraction scenarios

### Remaining Improvements

#### Document Revision Management

Introduce:

```text
DocumentRevision
```

to separate:

- File identity
- Document identity
- Revision identity

A filename must never be treated as the system of record.

Required metadata:

- Client
- Plant
- Document Number
- Revision Number
- Verification Status
- Source Evidence

---

## Pillar 2 – Reference Intelligence

### Status

⚠ Stabilized but not fully integrated

This is the most important next investment area.

---

### Current Capabilities

Reference workbook support:

- MATCH
- SPEC
- CAT

Component processing includes:

- Deterministic matching
- Validation checks
- Advisory ASME validation
- Cell overrides
- Approval tracking

---

### Why This Matters

Pillar 2 forms the bridge between:

```text
Extracted Data
        ↓
Reference Standards
        ↓
Generated SmartPlant Deliverables
```

Without this layer, generated outputs cannot be trusted.

---

### Required Next Step

## Immutable Reference Pack Revisions

Create:

```text
ReferencePackRevision
```

Characteristics:

- Content hashes
- Versioning
- Effective dates
- Standard editions
- Units
- Ownership
- Approval state

Once approved:

```text
Immutable
```

No edits allowed.

---

### Revision Pinning

Every processing job must be permanently linked to the exact reference revision used.

```text
Job
  ↓
ReferencePackRevision
```

Benefits:

- Reproducibility
- Auditability
- Compliance
- Change tracking

---

### SPEC Eligibility Before Matching

Current behavior risks allowing unsupported components to reach CAT matching.

Required flow:

```text
Component
    ↓
SPEC Eligibility
    ↓
CAT Matching
```

If not eligible:

```text
Ineligible
```

instead of silently continuing.

---

### Component Match Decisions

Persist decisions via:

```text
ComponentMatchDecision
```

States:

- Unique
- Ambiguous
- Unmatched
- Ineligible

Each state must include:

- Supporting evidence
- Candidate records
- Reviewer notes
- Approval history

---

### Human-in-the-Loop Review

Ambiguous matches should never automatically resolve.

Workflow:

```text
Ambiguous Match
        ↓
Reviewer Queue
        ↓
Engineering Decision
        ↓
Reusable Approved Mapping
```

Principle:

> AI may recommend. Engineers approve.

---

# Pillar 3 – Generation & Release Management

## Status

⚠ Foundations exist

Current tools:

- Export generators
- Workbook Canvas
- Reviewer editing
- XLSX export
- JSON export
- Draft specification generation

What is missing is controlled release governance.

---

## Provenance Tracking

Every generated value should identify its origin.

Example:

| Source Type | Meaning |
|------------|-----------|
| Extracted Fact | Direct document extraction |
| Reference Value | Reference workbook value |
| Approved Default | Organization-approved default |
| AI Suggestion | Requires review |
| Manual Override | Engineer modification |

Users should immediately understand:

```text
Where did this value come from?
```

---

## Validation Framework

Introduce:

```text
ValidationRun
```

Checks include:

- Missing required fields
- Units verification
- Standard compliance
- Sheet relationships
- Routing validity
- Duplicate identifiers

Results become auditable records.

---

## Draft vs Released

Current readiness should not depend on UI actions.

Release control must be server-enforced.

### Draft

Editable

### Released

Frozen

No modification permitted

---

## Release Gate Requirements

Before release:

- Extraction complete
- Validation passed
- Reference revision pinned
- Templates pinned
- Overrides approved
- Match decisions resolved

Only then:

```text
Release Approved
```

---

## Frozen Release Manifest

Create:

```text
SpecRelease
```

or

```text
ReleaseManifest
```

The manifest must hash:

### Inputs

- Source document revision
- Extraction job
- Reference pack
- Templates
- Mapping decisions
- Overrides

### Outputs

- Generated SPEC
- Generated CAT
- Export packages

---

### Reproducibility Rule

The same inputs must always generate:

```text
Identical Output
```

Any change to:

- Workbook
- Reference data
- Overrides
- Templates

must invalidate approval status.

---

# Verified SmartPlant Import

## Status

❌ Not yet completed

The platform currently generates SmartPlant-oriented output.

It does not yet prove SmartPlant import readiness.

---

## Required Pilot

Process:

```text
Frozen Release
        ↓
Disposable SP3D Target
        ↓
Bulk Import
        ↓
Rejection Report
        ↓
Correction Loop
        ↓
Acceptance
```

Only after successful imports should the system claim:

```text
Bulk-load ready
```

---

# Recommended Architecture Additions

## New Domain Entities

### DocumentRevision

Tracks:

- Client
- Plant
- Revision
- Verification State

---

### ReferencePackRevision

Tracks:

- Immutable references
- Approval status
- Hashes
- Ownership

---

### JobReferenceBinding

Tracks:

- Which job used which reference revision

---

### ComponentMatchDecision

Tracks:

- Matching outcomes
- Evidence
- Reviewer approvals

---

### ValidationRun

Tracks:

- Validation execution
- Errors
- Warnings

---

### SpecRelease / ReleaseManifest

Tracks:

- Frozen release packages
- Hashes
- Version history

---

### AuditEvent

Append-only audit trail for:

- Decisions
- Releases
- Overrides
- Approvals

---

# Release Orchestration Service

Introduce a dedicated service:

```text
Validate
   ↓
Freeze
   ↓
Release
```

Benefits:

- Centralized governance
- Testability
- Consistency
- Easier compliance audits

---

# Frontend Direction

## Do Not Create New Workflow Chains

Keep:

```text
Upload
 ↓
Preview
 ↓
Review
 ↓
Release
```

inside the existing experience.

Add integrated panels:

### Ambiguous Match Queue

Reviewer resolution workflow.

### Validation Queue

Quality issues requiring action.

### Release Approval Queue

Governed release process.

---

# Recommended Sequencing

## Phase 2 – Reference Intelligence

Deliver:

- Reference revisioning
- Revision pinning
- SPEC eligibility enforcement
- Match decisions
- Review queues

### Success Gate

A pilot specification