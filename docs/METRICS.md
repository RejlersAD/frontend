# Metrics and Reporting Definitions

Version 0.1 · Proposed reporting dictionary

Every displayed metric needs a business owner, formula, source fields/events, scope, date basis, timezone, currency/unit, refresh time, exclusions, and drill-through. Values below are definitions to adopt or revise, not computed results.

| Metric | Proposed definition | Important limitation |
|---|---|---|
| My pending approvals | Count of actionable pending assignments for the current user/delegation | Exclude superseded, withdrawn, expired, or no-longer-eligible assignments |
| Approval turnaround | Decision time minus submission time, for completed review rounds | State calendar/business-time basis; report median and sample size; exclude or label cancellations |
| Overdue tasks/actions | Open applicable work with due date before reporting cutoff | Missing due date is Unknown, not Overdue or On Time |
| On-time milestone completion | Completed milestones on/before the selected baseline date ÷ eligible completed milestones | Show baseline version and period; do not hide unfinished overdue milestones |
| Current project progress | Rollup of accepted progress using the approved weighting method | Do not average arbitrary status percentages; keep effort/quantity/physical methods explicit |
| Planned vs actual effort | Approved planned effort compared with approved recorded effort | Requires authoritative effort/time records; attendance alone is insufficient |
| Billable utilization | Approved billable hours ÷ agreed available-capacity hours | Timesheet/capacity source and exclusions unresolved in D-10; hide or label unavailable until supplied |
| PM delivery view | Milestone delivery, variance, overdue actions, changes, and relevant quality indicators | Present separate indicators with scope/complexity context; no invented composite employee score |
| Sales pipeline | Sum of eligible opportunity values by stage and currency | State inclusion stages and snapshot date; this is not revenue |
| Weighted sales forecast | Sum of eligible opportunity value × approved probability at snapshot | Probabilities/overrides need a defined owner and basis; no invented stage percentages |
| Open PO commitment | Sum of remaining commitment under Finance's approved policy | Whether relieved by receipt, invoice, or closure is unresolved; retain original and amendment basis |
| Receipt completion | Accepted net quantity/value ÷ ordered quantity/value per compatible line | Returns/reversals included; service and goods bases may differ |
| Receivables/payables outstanding | Issued/posted eligible invoice amount less applied settlements/credits per finance policy | Do not count draft/duplicate records; due-date aging and accounting source must be explicit |
| Cash received/paid | Reconciled settlement amounts in the reporting period | Invoice issue, approval, and export are not cash movement |
| Project margin | Approved revenue basis minus approved cost basis, divided by that revenue basis | Revenue recognition, actual cost feeds, FX and zero-revenue handling require Finance definition |
| Leave pending | Open submitted/review requests within authorized scope | Separate requests from leave-day totals and balances |
| Payroll reconciliation exceptions | Unresolved differences for a defined run/period | Restricted to payroll-authorized users; no salary detail in general dashboards |
| QHSE overdue actions | Unclosed required actions past agreed due date | Closure means verified under workflow; sensitive details remain scoped |
| AI executions | Server-recorded provider attempts, grouped into logical user jobs where needed | Show both attempts and logical jobs; retries may consume real tokens/cost |
| AI accepted outcomes | Human-accepted or workflow-accepted outputs linked to source runs | A page view or successful response is not an accepted outcome |
| AI cost | Sum of known billed amounts, or separately labeled estimates | Keep unknown cost unknown; distinguish billed from estimated, rate/currency/date basis |

## AI usage event contract

Capture logical job ID, unique provider attempt/request ID where available, user/service identity, organization/project scope, module/action, provider/model, prompt/configuration version, start/end time, outcome, token counts where reported, cost value/currency/basis, and source revision references where permitted.

Deduplicate repeated telemetry for the same attempt. Do not deduplicate away real retried provider calls that incurred cost. Link retries to their logical job. Page views use a separate browsing event stream.

## Dashboard presentation rules

- Show scope, reporting period, data freshness, and currency/units close to the values.
- Use a small set of useful metrics; prioritize exception queues with direct actions.
- Make every count drill into records using the same filter and permission logic.
- State when a number is provisional, incomplete, estimated, stale, or unavailable.
- Never substitute zero for missing data. Do not use fake trends or arbitrary green/red thresholds.
- Consolidated multi-currency reporting requires a named rate source, rate date, conversion method, and reconciliation policy.

Define targets and status thresholds with the responsible business owner after establishing a baseline. No targets are assumed in this pack.
