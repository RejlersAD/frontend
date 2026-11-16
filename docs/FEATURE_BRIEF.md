# Feature Implementation Brief

Status: Draft / Ready / In Progress / Verified

## 1. Outcome

- Feature title:
- Primary user and business problem:
- Observable improvement:
- Accountable product/domain owner:

## 2. Scope

- Included pages, routes, actions, and records:
- Explicitly protected screens/regions and behavior:
- Dependencies and existing capabilities to reuse:
- Design/reference evidence:

## 3. Grounding

| Item | Evidence / decision | Status |
|---|---|---|
| Existing implementation | Actual files, routes, schema and behavior | Inspected / unknown |
| Business policy | Policy reference or decision ID | Confirmed / proposed / open |
| Relevant context | Specific context file sections | Current / needs update |

## 4. Data and contracts

- Canonical records and accountable owners:
- New/changed fields and validation:
- Required source/evidence/revision links:
- API commands, errors, concurrency and idempotency:
- Migration/backfill and compatibility:
- External system authority and side effects, if any:

## 5. Workflow and permissions

| Action | From → to | Actor and scope | Preconditions | Effects and audit |
|---|---|---|---|---|
| Fill for each consequential action | | | | |

- Sensitive fields and exports:
- Delegation / separation of duties:
- Return, rejection, cancellation, amendment, and retry behavior:
- Decisions that block this feature:

## 6. UI contract

- Existing components/tokens to reuse:
- Required fields and sections:
- Primary/secondary actions:
- Table columns, filters, detail behavior where relevant:
- Loading, empty, denied, validation, stale version, failure, and success states:
- Keyboard/focus and responsive behavior:

## 7. Acceptance criteria

Write testable outcomes, not vague phrases such as “works correctly.”

| ID | Given | When | Then |
|---|---|---|---|
| AC-01 | Valid authorized context | Intended action | Expected persisted and visible result |
| AC-02 | Invalid or unauthorized context | Attempted action | Specific denial with no prohibited effect |
| AC-03 | Retry/concurrency/dependency failure relevant to this feature | Action repeats or races | Defined consistent result and recovery |

## 8. Verification and delivery

- Actual repository commands:
- Targeted test scenarios and visual checks:
- Migration/reconciliation evidence:
- Rollout/recovery needs:
- Context/contracts to update:
- Result report: changed behavior, passed checks, limitations, remaining policy decisions.

Build only after the feature's consequential business rules are established. Continue independent work when another unrelated decision is open.
