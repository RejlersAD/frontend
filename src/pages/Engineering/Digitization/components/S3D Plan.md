# S3D Reference Intelligence & Controlled Release
## Implementation Plan

### Objective

Connect RADAI's three SmartPlant pillars into a single verified trust chain:

```text
Extraction Completeness
        ↓
Pinned Reference Pack
        ↓
Explicit Match Decisions
        ↓
Provenance-Marked Preview
        ↓
Persisted Validation
        ↓
Frozen Release
        ↓
Import Pilot
```

**Execution Order**

1. Phase 2 – Reference Intelligence (Keystone)
2. Phase 3 – Controlled Release
3. Phase 4 – Import Pilot & Measurement

All changes are **additive only** and follow workspace decision **I-06: Context Over Intuition / Incremental Evolution**.

---

# Repository Scope

## Backend

```text
C:/Users/firaolak/RAD-PROJEC/backend
```

Application:

```text
apps/spec_customization
```

Current migration:

```text
0013
```

Next migrations:

```text
0014_reference_intelligence
0015_controlled_release
```

---

## Frontend

```text
C:/Users/firaolak/RAD-PROJEC/frontend
```

---

## Workspace Documentation

```text
C:/Users/firaolak/RAD-PROJEC/docs/features
```

---

# Step 0 — Traceability Brief

## Deliverables

Create:

```text
docs/features/s3d-reference-intelligence-release.md
```

Following the structure used by:

```text
docs/features/s3d-database-builder-reference.md
```

---

## Required Sections

### Purpose

Defines the controlled engineering trust chain required for SmartPlant readiness.

---

### Authorized Scope

#### In Scope

- Reference-pack governance
- Match review workflows
- Match decision persistence
- Validation persistence
- Release governance
- Release manifests
- Import readiness controls

#### Out of Scope

- 3D model import
- Piping synchronization
- Analytics dashboards
- Instrument discipline generation
- Equipment discipline generation
- Production deployment

---

### Implementation Boundaries

- Preserve current Upload → Preview workflow.
- Preserve all existing APIs.
- Preserve backward compatibility.
- Additive schema only.
- No destructive migrations.

---

### Required Business Decisions

The following block remains open and tracked:

#### Reference Governance

- Approved reference pack
- Reference owner
- Approval authority

#### SmartPlant Target

- Supported SP3D version
- Bulk-load profile
- Import validation requirements

#### Engineering Governance

- Standards editions
- Unit conventions
- Document identity rules

#### Release Governance

- Release authority
- Approval delegation
- Exception policy

---

### Verification

Each implementation slice must include:

- Backend test execution
- Playwright execution
- ESLint validation
- Build validation
- PostgreSQL verification notes

---

## Update Existing Three-Pillar Plan

Append a new implementation-status section to:

```text
docs/features/smartplant-three-pillar-analysis-plan.md
```

No existing content should be removed.

---

# Phase 2 — Reference Intelligence

## Architectural Decision

Extend:

```text
MatchingWorkbookSet
```

rather than introducing a new Reference Pack model.

### Rationale

The model already provides:

- Project ownership
- Workbook grouping
- Active status
- Transactional activation
- Existing matcher linkage

Introducing another container would duplicate ownership and activation concerns.

---

# 2.1 Backend Migration

## Migration

```text
0014_reference_intelligence.py
```

---

## MatchingWorkbookSet Extensions

Add:

```python
match_file_hash
spec_file_hash
cat_file_hash
```

Type:

```python
CharField(max_length=64)
```

Purpose:

```text
SHA-256 integrity validation
```

---

Add:

```python
schema_valid
schema_errors
```

Purpose:

```text
Workbook structural validation
```

---

Add:

```python
standard_edition
units
effective_date
review_status
```

Purpose:

```text
Reference governance tracking
```

---

Add:

```python
frozen_at
frozen_by
```

Purpose:

```text
Immutable approved reference packs
```

Frozen workbooks cannot be replaced or reparsed.

---

## PaperSpecExtractionJob Extension

Add:

```python
reference_workbook_set
```

Relationship:

```python
FK(MatchingWorkbookSet)
```

Purpose:

```text
Reference revision pinning
```

Pinning occurs during matching, not upload.

---

## New Model: ComponentMatchDecision

### Relationships

```python
workbook_set
job
```

---

### Match Criteria

```python
pdf_component_name
nominal_size
pressure_rating
material_grade
sub_type
end_connection
```

---

### State Values

```text
unique_match
ambiguous
unmatched
ineligible
invalid_reference
```

---

### Review Fields

```python
reviewed_by
reviewed_at
review_decision
final_commodity_code
```

Review decisions:

```text
approved
rejected
remapped
```

---

### JSON Fields

```python
candidates
discriminators_matched
```

---

### Indexes

```python
(job, state)
(workbook_set, state)
```

---

### Unique Constraint

```python
(
 job,
 workbook_set,
 pdf_component_name,
 nominal_size,
 pressure_rating,
 material_grade
)
```

Purpose:

```text
Update existing decisions during reruns instead of creating duplicates.
```

---

# 2.2 Matcher Wiring

File:

```text
services/component_matcher.py
```

---

## SPEC Eligibility Gate

Current:

```text
load_spec_sheet() exists but is unused.
```

Required:

```text
SPEC Eligibility
        ↓
CAT Matching
```

---

If SPEC eligibility fails:

```text
State = ineligible
```

With supporting evidence.

---

## Explicit Match States

Every match operation must return:

```text
unique_match
ambiguous
unmatched
ineligible
invalid_reference
```

---

## Ambiguous Matching Evidence

Include candidate-level discriminator details:

- Size
- Pressure
- Material
- End Connection
- Sub Type

---

## Match Score Normalization

Replace:

```python
match_score = 1.0
```

With:

```text
Discriminator-match ranking score
```

Explicitly documented as:

```text
Ranking aid only
Not calibrated probability
```

---

## Batch Matching Service

Add:

```python
run_job_matching(job, workbook_set)
```

Responsibilities:

1. Load extracted components.
2. Execute matching.
3. Persist decisions.
4. Preserve existing matching results.
5. Return summary metrics.

---

# 2.3 Matching Endpoints

## Existing Endpoint Enhancement

### upload_matching_workbooks

Add:

- SHA-256 hashing
- Schema validation
- Reference metadata persistence

---

Schema failures return:

```http
422 Unprocessable Entity
```

with explicit validation errors.

---

## New Endpoint

### Freeze Reference Set

```http
POST /matching-set-freeze
```

Behavior:

```text
Frozen sets reject replacement and reparse actions.
```

Returns:

```http
409 Conflict
```

for disallowed modifications.

---

## New Endpoint

### Run Matching

```http
POST /matching-run
```

Request:

```json
{
  "job_id": 123,
  "workbook_set_id": 8
}
```

Behavior:

- Resolve active workbook set.
- Pin workbook reference.
- Execute matching.
- Return summaries.

---

## New Endpoint

### Match Decisions

```http
GET /matching-decisions
```

Filters:

```text
job
workbook_set
state
```

---

## New Endpoint

### Review Decision

```http
POST /matching-decision-review
```

Actions:

```text
approved
rejected
remapped
```

Remap requires:

```text
final_commodity_code
```

---

# 2.4 Ingest & Export Touchpoints

## No Phase 2 Change

```text
_ingest_paper_spec_file()
```

remains untouched.

---

## Export Traceability Enhancement

Files:

```text
export_smartplant_spec()
export_smartplant_cat()
```

Add metadata:

```json
{
  "reference_set_id": 21,
  "reference_hash": "abc123..."
}
```

Completeness validation remains unchanged.

---

# 2.5 Test Coverage

## Matcher Tests

### SPEC Eligibility

Verify:

```text
Component outside spec range
        ↓
Ineligible
```

CAT matching must never run.

---

### Ambiguous Match Persistence

Verify:

- Decision creation
- Candidate persistence
- Review workflow

---

### Schema Validation

Verify:

```text
Invalid workbook
        ↓
422
```

---

### Freeze Protection

Verify:

```text
Frozen
        ↓
Cannot Replace
```

---

### Reference Pinning

Verify:

```text
Run Matching
        ↓
Job References Stored
```

---

### Security

Verify:

```text
Unauthorized Review
        ↓
403 / 404
```

---

## Backend Test Command

```bash
DATABASE_URL=sqlite:///:memory: \
USE_S3=false \
AIFLOW_ENVIRONMENT=testing \
..\.venv\Scripts\python.exe manage.py test apps.spec_customization \
--settings=config.settings_release_test \
--noinput
```

---

# 2.6 Frontend

## API Layer

File:

```text
services/specCustomizationAPI.js
```

Add:

```javascript
runJobMatching()
listMatchDecisions()
reviewMatchDecision()
freezeMatchingSet()
getMatchingSetDetail()
```

---

## Match Review Queue

New Component:

```text
MatchReviewQueue.jsx
```

Purpose:

```text
Human review workflow
```

Displays:

- Ambiguous
- Unmatched
- Ineligible
- Invalid Reference

---

### Actions

```text
Approve
Reject
Remap
```

Remap opens:

```text
Commodity-selection dialog
```

---

## Hub Integration

File:

```text
S3DDataExtractionHub.jsx
```

Add tab:

```text
Matching
```

Tabs become:

```text
Classes
Canvas
Matching
```

---

### Run Matching Button

Displayed when:

```text
Active workbook set exists
```

Behavior:

```text
Run Matching
        ↓
Navigate to Matching Queue
```

---

## Workbook Manager Enhancements

File:

```text
ComponentMatchingWorkbookManager.jsx
```

Add:

- Hash display
- Schema-valid badge
- Freeze status
- Freeze action

---

## Help Context

Add S3D-specific rule to:

```text
src/config/helpContextRegistry.js
```

Insert before generic:

```text
engineering
```

context rule.

---

## Playwright Coverage

Scenario:

```text
Matching Run
        ↓
