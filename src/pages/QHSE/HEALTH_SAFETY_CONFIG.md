# Health & Safety Configuration Guide

## Overview
The Health & Safety module uses feature flags for soft-coded configuration, allowing you to enable or disable sections without modifying core logic.

## Configuration Location
All feature flags are defined in:
```
frontend/src/pages/QHSE/utils/healthSafetyMetrics.js
```

## Feature Flags

### Current Configuration (2026-08-19)

```javascript
export const HEALTH_SAFETY_FEATURES = {
  enablePPECompliance: false,           // PPE compliance tracking
  enableSafetyTraining: false,          // Training records management
  enableRiskAssessment: true,           // Risk calculation (CARs + Observations)
  enableIncidentTracking: true,         // Incident monitoring
  enableHighRiskProjects: false,        // High-risk project highlighting
  enableProjectScheduleCheck: false,    // "Project On Schedule" in checklist
  enableRiskAssessmentView: false       // Risk Assessment tab/view
};
```

## What Was Changed (2026-08-19)

### 1. Removed "Project On Schedule" from Overview Checklist
- **Feature Flag:** `enableProjectScheduleCheck`
- **Default:** `false` (disabled)
- **Impact:** The "Project On Schedule" item no longer appears in the Safety Compliance Checklist in the Overview section
- **Location:** Used in `generateSafetyChecklist()` function

### 2. Removed "Risk Assessment" Tab/View
- **Feature Flag:** `enableRiskAssessmentView`
- **Default:** `false` (disabled)
- **Impact:** 
  - The "Risk Assessment" tab is hidden from the view selector
  - The Risk Assessment view content is not rendered
- **Location:** Used in `HealthSafety.jsx` component

## How to Re-enable Features

If you need to restore these features in the future:

### Re-enable "Project On Schedule" Checklist Item:
```javascript
enableProjectScheduleCheck: true
```

### Re-enable "Risk Assessment" Tab:
```javascript
enableRiskAssessmentView: true
```

## Benefits of Soft Coding

✅ **No Code Changes Required:** Simply change the flag value from `false` to `true`  
✅ **Maintainable:** Easy to understand what each flag controls  
✅ **Documented:** Clear comments explain why features are disabled  
✅ **Reversible:** Can easily re-enable features without restoring code  
✅ **Safe:** Core logic remains intact, reducing risk of bugs  

## Technical Implementation

### Checklist Filtering (healthSafetyMetrics.js)
```javascript
const checklist = [
  { name: 'Quality Plans Approved', ... },
  { name: 'Audits Up to Date', ... },
  { name: 'No Open Incidents', ... },
  { name: 'KPI Above 80%', ... },
  // Conditionally include based on flag
  ...(HEALTH_SAFETY_FEATURES.enableProjectScheduleCheck ? [{
    name: 'Project On Schedule',
    check: (p) => { /* logic */ },
    weight: 1
  }] : [])
];
```

### Tab Visibility (HealthSafety.jsx)
```javascript
const tabs = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'incidents', label: 'Incidents', icon: AlertCircle },
  // Conditionally include Risk Assessment tab
  ...(HEALTH_SAFETY_FEATURES.enableRiskAssessmentView ? [
    { id: 'risk', label: 'Risk Assessment', icon: AlertTriangle }
  ] : []),
  { id: 'performance', label: 'Performance', icon: TrendingUp }
];
```

### View Rendering (HealthSafety.jsx)
```javascript
{selectedView === 'risk' && HEALTH_SAFETY_FEATURES.enableRiskAssessmentView && (
  <RiskAssessmentView {...props} />
)}
```

## Related Files

- **Configuration:** `frontend/src/pages/QHSE/utils/healthSafetyMetrics.js`
- **Component:** `frontend/src/pages/QHSE/HealthSafety.jsx`
- **This Guide:** `frontend/src/pages/QHSE/HEALTH_SAFETY_CONFIG.md`

## Change History

| Date | Change | Reason |
|------|--------|--------|
| 2026-08-19 | Added `enableProjectScheduleCheck` (false) | Remove "Project On Schedule" from checklist |
| 2026-08-19 | Added `enableRiskAssessmentView` (false) | Hide Risk Assessment tab and view |
| 2026-07-11 | Set `enableHighRiskProjects` to false | QHSE Expert requested removal |

---

**Last Updated:** 2026-08-19  
**Maintainer:** Development Team
