import React, { useState, useMemo, useCallback } from 'react';
import {
  AlertCircle, TrendingUp, Calendar, AlertTriangle, FileText,
  BarChart3, RefreshCw, Download, Target
} from 'lucide-react';
import { MainHeader } from './components/Common/MainHeader';
import { LoadingState } from './components/Common/LoadingState';
import { ErrorState } from './components/Common/ErrorState';
import { useQHSERunningProjects } from './hooks/useQHSEProjects';
import { withDashboardControls } from '../../hoc/withPageControls';
import { PageControlButtons } from '../../components/PageControlButtons';
import { QHSE_MODULE_LABELS } from '../../config/qhseModules.config';
import {
  calculateHealthSafetyMetrics,
  HEALTH_SAFETY_FEATURES,
  HEALTH_SAFETY_UNAVAILABLE_REASONS as UNAVAILABLE
} from './utils/healthSafetyMetrics';
import {
  SafetyMetricCard, SafetyScoreDisplay, SafetyEmptyState
} from './components/HealthSafety/SafetyComponents';

const HealthSafety = ({ pageControls }) => {
  const { data: projectsData, loading, error, refetch, isRefreshing } = useQHSERunningProjects({
    preserveMissingQualityCounts: true
  });
  const [selectedView, setSelectedView] = useState('overview');
  const safetyMetrics = useMemo(() => calculateHealthSafetyMetrics(projectsData), [projectsData]);

  if (loading || error || !projectsData?.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 p-6">
        <MainHeader
          title={QHSE_MODULE_LABELS.healthSafety.shortTitle}
          subtitle={QHSE_MODULE_LABELS.healthSafety.description}
          showLiveStatus={false}
        />
        {loading ? <LoadingState message="Loading occupational health and safety data..." />
          : error ? <ErrorState error={error} onRetry={refetch} />
            : <SafetyEmptyState title="Unavailable" message="No project quality records were returned. Safety measures also require incident, injury and exposure evidence; an empty source does not establish zero incidents." />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 p-4 sm:p-6 lg:p-8">
      <MainHeader
        title={QHSE_MODULE_LABELS.healthSafety.shortTitle}
        subtitle={`${projectsData.length} project quality records • Safety metrics unavailable`}
        showLiveStatus={false}
      >
        <div className="flex items-center gap-3">
          <PageControlButtons controls={pageControls} />
          <button
            onClick={refetch}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            <Download size={16} />
            Export Report
          </button>
        </div>
      </MainHeader>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'incidents', label: 'Incidents', icon: AlertCircle },
          { id: 'risk', label: 'Risk Assessment', icon: AlertTriangle },
          { id: 'performance', label: 'Performance', icon: TrendingUp }
        ].map(view => (
          <button
            key={view.id}
            onClick={() => setSelectedView(view.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              selectedView === view.id
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            <view.icon size={16} />
            {view.label}
          </button>
        ))}
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 ${
        HEALTH_SAFETY_FEATURES.enableHighRiskProjects ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
      }`}>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 flex items-center justify-center">
          <SafetyScoreDisplay size="md" />
        </div>
        <SafetyMetricCard title="Incident Rate" value={safetyMetrics.incidentRate}
          icon={AlertCircle} color="slate" description={UNAVAILABLE.incidentRate} />
        <SafetyMetricCard title="Open Incidents" value={safetyMetrics.totalIncidents}
          icon={AlertTriangle} color="slate" description={UNAVAILABLE.totalIncidents}
          subtitle="Near misses: Unavailable (records not connected)" />
        <SafetyMetricCard title="Days Without Incident" value={safetyMetrics.daysWithoutIncident}
          icon={Calendar} color="slate" description={UNAVAILABLE.daysWithoutIncident} />
        {HEALTH_SAFETY_FEATURES.enableHighRiskProjects && (
          <SafetyMetricCard title="High Risk Projects" value={null}
            icon={Target} color="slate" description={UNAVAILABLE.highRiskProjects} />
        )}
      </div>

      {selectedView === 'overview' && <OverviewView safetyMetrics={safetyMetrics} />}
      {selectedView === 'incidents' && <IncidentsView />}
      {selectedView === 'risk' && <RiskAssessmentView />}
      {selectedView === 'performance' && <PerformanceView />}
    </div>
  );
};

// Current sources cannot populate safety charts. Keep the panels explicit rather
// than plotting null as zero, or presenting an empty series as a clean record.
const UnavailablePanel = ({ title, reason, icon: Icon, className = '' }) => (
  <section aria-label={title} className={`bg-white rounded-xl shadow-sm p-6 border border-gray-200 ${className}`}>
    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
      {Icon && <Icon className="text-slate-500" size={20} />}
      {title}
    </h3>
    <SafetyEmptyState title="Unavailable" message={reason} />
  </section>
);

const QualityCounts = ({ safetyMetrics }) => (
  <section aria-label="Recorded quality counts" className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
    <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
      <BarChart3 className="text-blue-500" size={20} />
      Recorded quality counts
    </h3>
    <p className="text-sm text-gray-600 mb-4">
      Totals from the {safetyMetrics.totalProjects} loaded project quality records. Corrective actions and observations are not incidents, near misses or injuries. Recorded counts do not certify historical completeness.
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {[
        ['openCARs', 'Open corrective actions'],
        ['closedCARs', 'Closed corrective actions'],
        ['openObservations', 'Open observations'],
        ['closedObservations', 'Closed observations']
      ].map(([key, title]) => {
        const value = safetyMetrics.qualityCounts[key];
        const { knownRecords, totalRecords } = safetyMetrics.qualityCoverage[key];
        return (
          <SafetyMetricCard key={key} title={title} value={value} icon={FileText} color="blue"
            description={value === null
              ? `A complete total is unavailable. Valid counts: ${knownRecords} of ${totalRecords} records.`
              : `Recorded count supplied by ${knownRecords} of ${totalRecords} records.`} />
        );
      })}
    </div>
  </section>
);

const OverviewView = ({ safetyMetrics }) => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    {HEALTH_SAFETY_FEATURES.enableHighRiskProjects && (
      <UnavailablePanel title="High Risk Projects" reason={UNAVAILABLE.highRiskProjects} icon={AlertTriangle} className="lg:col-span-1" />
    )}
    <div className={`space-y-6 ${HEALTH_SAFETY_FEATURES.enableHighRiskProjects ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
      <UnavailablePanel title="Monthly Safety Trend" reason={UNAVAILABLE.monthlyTrend} icon={TrendingUp} />
      <QualityCounts safetyMetrics={safetyMetrics} />
      <UnavailablePanel title="Safety Compliance Checklist" reason={UNAVAILABLE.checklist} icon={FileText} />
    </div>
  </div>
);

const IncidentsView = () => (
  <div className="space-y-6">
    <div className={`grid grid-cols-1 gap-6 ${HEALTH_SAFETY_FEATURES.enableHighRiskProjects ? 'lg:grid-cols-2' : ''}`}>
      <UnavailablePanel title="Incident Trend Analysis" reason={UNAVAILABLE.incidentTrend} />
      {HEALTH_SAFETY_FEATURES.enableHighRiskProjects && (
        <UnavailablePanel title="Projects Requiring Investigation" reason={UNAVAILABLE.highRiskProjects} />
      )}
    </div>
  </div>
);

const RiskAssessmentView = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {HEALTH_SAFETY_FEATURES.enableHighRiskProjects && (
        <UnavailablePanel title="High Risk Projects" reason={UNAVAILABLE.highRiskProjects} />
      )}
      <UnavailablePanel title="Risk Mitigation Checklist" reason={UNAVAILABLE.checklist}
        className={HEALTH_SAFETY_FEATURES.enableHighRiskProjects ? '' : 'lg:col-span-2'} />
    </div>
  </div>
);

const PerformanceView = () => (
  <div className="space-y-6">
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
        <div className="flex justify-center lg:justify-start">
          <div className="bg-white/95 rounded-2xl p-4 shadow-2xl w-full max-w-[280px] min-h-[280px] flex items-center justify-center">
            <SafetyScoreDisplay size="lg" />
          </div>
        </div>
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            ['Incident Rate', UNAVAILABLE.incidentRate],
            ['Open Incidents', `${UNAVAILABLE.totalIncidents} Near misses: Unavailable.`],
            ['Days Incident-Free', UNAVAILABLE.daysWithoutIncident],
            ['Avg Project Safety', UNAVAILABLE.avgProjectSafety]
          ].map(([label, reason]) => (
            <div key={label} className="min-w-0 rounded-xl bg-white/5 border border-white/10 p-4 backdrop-blur-sm">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-300">{label}</div>
              <div className="text-base font-bold mt-1 text-slate-100 break-words">Unavailable</div>
              <div className="text-xs text-slate-300 mt-1 break-words">{reason}</div>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className={`grid grid-cols-1 gap-6 ${HEALTH_SAFETY_FEATURES.enableManagerSafetyPerformance ? 'lg:grid-cols-2' : ''}`}>
      {HEALTH_SAFETY_FEATURES.enableManagerSafetyPerformance && (
        <UnavailablePanel title="Manager Safety Performance" reason={UNAVAILABLE.managerPerformance} />
      )}
      <UnavailablePanel title="Safety KPI Distribution" reason={UNAVAILABLE.safetyKPIDistribution} />
      <UnavailablePanel title="Safety Score Trend" reason={UNAVAILABLE.safetyScore} />
    </div>
  </div>
);

const HealthSafetyWithRefresh = (props) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const refetch = useCallback(() => setRefreshTrigger(prev => prev + 1), []);
  return <HealthSafety {...props} refetch={refetch} key={refreshTrigger} />;
};

export default withDashboardControls(HealthSafetyWithRefresh, {
  autoRefreshInterval: 30000,
  storageKey: 'qhseHealthSafetyPageControls',
});
