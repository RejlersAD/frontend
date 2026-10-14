# Health & Safety availability and configuration

Last updated: 24 September 2026, bounded correction of audit F03.

## Current evidence boundary

The QHSE running-project feed contains quality corrective-action and observation counts. It does not establish incidents, near misses, injuries, safety exposure, incident-free days, safety compliance or a safety score. General project KPIs and quality hours cannot supply that evidence.

`utils/healthSafetyMetrics.js` returns `null` for unsupported safety values and datasets, with `HEALTH_SAFETY_UNAVAILABLE_REASONS`. `HealthSafety.jsx` and `components/HealthSafety/SafetyComponents.jsx` display neutral **Unavailable** states. They do not plot null as zero, classify missing evidence or show a numeric safety gauge.

The Overview panel retains **Recorded quality counts** under their correct labels. Each total requires a valid nonnegative integer for every loaded record; incomplete data withholds the total and shows coverage. Explicit zero is retained. Empty sources do not establish zero. This screen opts into raw quality-counter preservation in `hooks/useQHSEProjects.js`; the default behavior for other screens is unchanged. Existing backend defaults can obscure whether historical zero counts were supplied, so the UI does not certify completeness.

## Feature flags

Current flags in `utils/healthSafetyMetrics.js`:

```javascript
export const HEALTH_SAFETY_FEATURES = {
  enablePPECompliance: false,
  enableSafetyTraining: false,
  enableRiskAssessment: false,
  enableIncidentTracking: false,
  enableHighRiskProjects: false,
  enableManagerSafetyPerformance: false
};
```

The existing Overview, Incidents, Risk Assessment and Performance view buttons remain. Flags do not authorize a formula or create source evidence. High-risk and manager sections remain hidden; toggling their visibility still produces an unavailable panel. Re-enabling operational measures requires authoritative sources, an established definition and corresponding verification, beyond this correction.

Earlier configuration guidance described CAR-based risk, quality-based safety compliance and flag-only restoration. Those descriptions are superseded by this availability contract; unsupported calculations have been removed. The older guide's `enableProjectScheduleCheck` and `enableRiskAssessmentView` examples are not present in the inspected current helper and must not be treated as implemented controls.

## Change history

| Date | Record |
| --- | --- |
| 2026-07-11 | Earlier guide recorded high-risk project highlighting disabled. |
| 2026-08-19 | Earlier guide documented schedule-check and risk-view flags; those examples do not describe the current implementation. |
| 2026-09-23 | Earlier guide recorded manager safety section hidden. This visibility is preserved. |
| 2026-09-24 | F03: removed unsupported safety calculations and displays; retained separately labeled quality counts and explicit missing-data states. |

The adopted [metrics context](../../../../docs/METRICS.md#qhse-safety-availability-correction--24-september-2026), [correction brief](../../../../docs/features/qhse-safety-metric-availability.md) and [audit](../../../../docs/DESIGN_INTENT_AUDIT.md) record authority, verification and remaining decisions. No company safety formula was approved by this change.
