// The current QHSE project feed contains quality counters, not incident evidence.
// Safety measures stay unavailable until their sources and definitions are established.

export const HEALTH_SAFETY_FEATURES = {
  enablePPECompliance: false,
  enableSafetyTraining: false,
  enableRiskAssessment: false,
  enableIncidentTracking: false,
  enableHighRiskProjects: false,
  enableManagerSafetyPerformance: false
};

export const HEALTH_SAFETY_UNAVAILABLE_REASONS = Object.freeze({
  totalIncidents: 'Incident records and approved classifications are not connected.',
  nearMissCount: 'Near-miss records are not connected; quality observations are not near misses.',
  incidentRate: 'Classified incidents, recorded work hours and an approved reporting basis are not connected.',
  lostTimeInjuryRate: 'Lost-time injury records, recorded work hours and an approved reporting basis are not connected.',
  projectsWithIncidents: 'Project-linked incident records are not connected.',
  projectsIncidentFree: 'Project-linked incident history and reporting coverage are not connected.',
  daysWithoutIncident: 'Dated incident history and a verified reporting period are not connected.',
  safetyScore: 'An evidence-backed safety score definition and its source records are not established.',
  avgProjectSafety: 'An evidence-backed project safety score definition and its source records are not established.',
  riskScore: 'Recorded safety assessments and an approved risk definition are not connected.',
  incidentTrend: 'Dated incident and near-miss records are not connected.',
  monthlyTrend: 'Dated incident history and a verified reporting period are not connected.',
  safetyKPIDistribution: 'Project quality KPIs do not establish safety performance.',
  checklist: 'Safety checklist evidence and approved compliance criteria are not connected.',
  managerPerformance: 'Attributed safety evidence and an approved performance definition are not connected.',
  highRiskProjects: 'Recorded safety assessments and approved risk classifications are not connected.'
});

export const HEALTH_SAFETY_DATA_SOURCES = {
  incidents: { field: null, description: HEALTH_SAFETY_UNAVAILABLE_REASONS.totalIncidents, available: false },
  nearMiss: { field: null, description: HEALTH_SAFETY_UNAVAILABLE_REASONS.nearMissCount, available: false },
  safetyScore: { fields: [], description: HEALTH_SAFETY_UNAVAILABLE_REASONS.safetyScore, available: false },
  riskAssessment: { fields: [], description: HEALTH_SAFETY_UNAVAILABLE_REASONS.riskScore, available: false },
  ppeCompliance: { field: null, description: 'PPE compliance evidence is not connected.', available: false },
  safetyTraining: { field: null, description: 'Safety training records are not connected.', available: false },
  quality: {
    fields: ['carsOpen', 'carsClosed', 'obsOpen', 'obsClosed'],
    description: 'Recorded project quality corrective-action and observation counts only.',
    available: true
  }
};

const QUALITY_FIELDS = {
  openCARs: 'carsOpen',
  closedCARs: 'carsClosed',
  openObservations: 'obsOpen',
  closedObservations: 'obsClosed'
};

const recordedCount = (value) => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
};

/**
 * Summarize only the quality counts supplied by the current project feed.
 * A missing/invalid value makes that aggregate unavailable, rather than a partial
 * sum presented as a total. Explicit recorded zero remains zero. No input changes.
 */
export const calculateHealthSafetyMetrics = (projects) => {
  const records = Array.isArray(projects) ? projects : [];
  const totalProjects = Array.isArray(projects) ? projects.length : null;
  const qualityCounts = {};
  const qualityCoverage = {};

  for (const [key, field] of Object.entries(QUALITY_FIELDS)) {
    const counts = records.map(project => recordedCount(project?.[field]));
    const knownCounts = counts.filter(count => count !== null);
    const total = knownCounts.reduce((sum, count) => sum + count, 0);
    qualityCounts[key] = records.length > 0 && knownCounts.length === records.length && Number.isSafeInteger(total)
      ? total
      : null;
    qualityCoverage[key] = { knownRecords: knownCounts.length, totalRecords: totalProjects };
  }

  return {
    totalProjects,
    qualityCounts,
    qualityCoverage,
    totalIncidents: null,
    nearMissCount: null,
    incidentRate: null,
    lostTimeInjuryRate: null,
    projectsWithIncidents: null,
    projectsIncidentFree: null,
    daysWithoutIncident: null,
    safetyScore: null,
    avgProjectSafety: null,
    riskScore: null,
    safetyPerformance: getSafetyPerformance(),
    unavailableReasons: HEALTH_SAFETY_UNAVAILABLE_REASONS
  };
};

/** No score thresholds are retained: the current feed has no established score. */
export const getSafetyPerformance = () => ({
  key: 'UNAVAILABLE',
  label: 'Unavailable',
  color: '#64748b',
  description: HEALTH_SAFETY_UNAVAILABLE_REASONS.safetyScore
});

// Explicit null prevents unavailable charts/rankings from masquerading as an
// empty incident series, zero risk, compliant checklist or successful safety score.
// Keep these existing entry points unavailable even if a display flag is toggled.
export const generateIncidentTrend = () => null;
export const generateSafetyKPIDistribution = () => null;
export const getHighRiskProjects = () => null;
export const generateSafetyByManager = () => null;
export const generateSafetyChecklist = () => null;
export const calculateIncidentSeverity = () => null;
export const generateMonthlySafetyTrend = () => null;
