import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHealthSafetyMetrics,
  getSafetyPerformance,
  generateIncidentTrend,
  generateSafetyKPIDistribution,
  getHighRiskProjects,
  generateSafetyByManager,
  generateSafetyChecklist,
  calculateIncidentSeverity,
  generateMonthlySafetyTrend,
  HEALTH_SAFETY_DATA_SOURCES,
  HEALTH_SAFETY_FEATURES
} from '../src/pages/QHSE/utils/healthSafetyMetrics.js';

const safetyFields = [
  'totalIncidents', 'nearMissCount', 'incidentRate', 'lostTimeInjuryRate',
  'projectsWithIncidents', 'projectsIncidentFree', 'daysWithoutIncident',
  'safetyScore', 'avgProjectSafety', 'riskScore'
];

const assertSafetyUnavailable = (metrics) => {
  for (const key of safetyFields) {
    assert.equal(metrics[key], null, key);
    assert.ok(metrics.unavailableReasons[key], `${key} explains missing evidence`);
  }
  assert.equal(metrics.safetyPerformance.key, 'UNAVAILABLE');
  assert.equal(metrics.safetyPerformance.label, 'Unavailable');
};

test('missing or invalid project input does not become a zero count or safety score', () => {
  for (const projects of [undefined, null, {}, '', false, 0]) {
    const metrics = calculateHealthSafetyMetrics(projects);
    assertSafetyUnavailable(metrics);
    assert.equal(metrics.totalProjects, null);
    assert.ok(Object.values(metrics.qualityCounts).every(value => value === null));
  }
});

test('an empty successful project collection has zero projects but no safety evidence', () => {
  const metrics = calculateHealthSafetyMetrics([]);
  assertSafetyUnavailable(metrics);
  assert.equal(metrics.totalProjects, 0);
  assert.ok(Object.values(metrics.qualityCounts).every(value => value === null));
});

test('quality-only records retain their own labels without becoming incidents or injuries', () => {
  const metrics = calculateHealthSafetyMetrics([
    { carsOpen: 2, carsClosed: 4, obsOpen: 3, obsClosed: 1 },
    { carsOpen: '1', carsClosed: '0', obsOpen: '2', obsClosed: '5' }
  ]);
  assertSafetyUnavailable(metrics);
  assert.deepEqual(metrics.qualityCounts, {
    openCARs: 3, closedCARs: 4, openObservations: 5, closedObservations: 6
  });
  assert.deepEqual(metrics.qualityCoverage.openCARs, { knownRecords: 2, totalRecords: 2 });
});

test('explicit numeric and string zero values remain legitimate quality zeros', () => {
  const metrics = calculateHealthSafetyMetrics([
    { carsOpen: 0, carsClosed: '0', obsOpen: ' 0 ', obsClosed: 0 }
  ]);
  assertSafetyUnavailable(metrics);
  assert.deepEqual(metrics.qualityCounts, {
    openCARs: 0, closedCARs: 0, openObservations: 0, closedObservations: 0
  });
});

test('missing fields remain unavailable independently of known quality fields', () => {
  const metrics = calculateHealthSafetyMetrics([{ carsOpen: 0, obsOpen: 3 }]);
  assertSafetyUnavailable(metrics);
  assert.deepEqual(metrics.qualityCounts, {
    openCARs: 0, closedCARs: null, openObservations: 3, closedObservations: null
  });
  assert.deepEqual(metrics.qualityCoverage.closedCARs, { knownRecords: 0, totalRecords: 1 });
});

test('incomplete project coverage never presents the known partial sum as a total', () => {
  const metrics = calculateHealthSafetyMetrics([{ carsOpen: 3 }, {}]);
  assert.equal(metrics.qualityCounts.openCARs, null);
  assert.deepEqual(metrics.qualityCoverage.openCARs, { knownRecords: 1, totalRecords: 2 });
  assertSafetyUnavailable(metrics);
});

test('blank, malformed, negative, fractional and unsafe counters do not coerce to zero', () => {
  for (const value of [undefined, null, '', ' ', 'N/A', 'invalid', -1, '-1', 1.5, '1.5', Infinity, NaN, true, false, [], {}, '0x10', Number.MAX_SAFE_INTEGER + 1]) {
    const metrics = calculateHealthSafetyMetrics([{ carsOpen: value }]);
    assert.equal(metrics.qualityCounts.openCARs, null, String(value));
    assert.equal(metrics.qualityCoverage.openCARs.knownRecords, 0);
    assertSafetyUnavailable(metrics);
  }
});

test('unsafe summed counters are unavailable rather than rounded into a displayed total', () => {
  const metrics = calculateHealthSafetyMetrics([{ carsOpen: Number.MAX_SAFE_INTEGER }, { carsOpen: 1 }]);
  assert.equal(metrics.qualityCounts.openCARs, null);
});

test('null records preserve missing coverage without throwing or inventing values', () => {
  const metrics = calculateHealthSafetyMetrics([null, undefined, {}]);
  assert.equal(metrics.totalProjects, 3);
  assert.ok(Object.values(metrics.qualityCounts).every(value => value === null));
  assertSafetyUnavailable(metrics);
});

test('project dates, KPI, completion, audit delays and guessed safety fields cannot establish a score', () => {
  const project = Object.freeze({
    carsOpen: 0, obsOpen: 0, projectKPIsAchievedPercent: '100%', projectCompletionPercent: '100%',
    projectStartingDate: '2026-01-01', projectClosingDate: '2026-12-31', delayInAuditsNoDays: 0,
    incidentCount: 0, workHours: 200000, lastIncidentDate: '2025-01-01', safetyScore: 100
  });
  const projects = Object.freeze([project]);
  const before = JSON.stringify(projects);
  assertSafetyUnavailable(calculateHealthSafetyMetrics(projects));
  assert.equal(JSON.stringify(projects), before);
});

test('no arbitrary number including the old 100 boundary can produce a safety classification', () => {
  for (const score of [undefined, null, NaN, -1, 0, 39, 60, 95, 100, 101]) {
    assert.equal(getSafetyPerformance(score).label, 'Unavailable');
  }
});

test('charts, checklist, severity and rankings carry explicit unavailable results', () => {
  const projects = [{ carsOpen: 2, carsClosed: 1, obsOpen: 3, projectKPIsAchievedPercent: '100%', projectCompletionPercent: '100%' }];
  for (const generate of [generateIncidentTrend, generateSafetyKPIDistribution, getHighRiskProjects, generateSafetyByManager, generateSafetyChecklist, generateMonthlySafetyTrend]) {
    for (const input of [undefined, [], projects]) assert.equal(generate(input), null);
  }
  assert.equal(calculateIncidentSeverity(projects[0]), null);
});

test('source metadata and feature flags cannot describe quality data as a supported safety source', () => {
  for (const key of ['incidents', 'nearMiss', 'safetyScore', 'riskAssessment', 'ppeCompliance', 'safetyTraining']) {
    assert.equal(HEALTH_SAFETY_DATA_SOURCES[key].available, false);
  }
  assert.equal(HEALTH_SAFETY_DATA_SOURCES.quality.available, true);
  assert.ok(Object.values(HEALTH_SAFETY_FEATURES).every(enabled => enabled === false));
});
