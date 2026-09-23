import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  Shield, 
  AlertCircle, 
  UserCheck, 
  Activity,
  TrendingUp,
  Calendar,
  AlertTriangle,
  FileText,
  BarChart3,
  RefreshCw,
  Download,
  Target
} from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend, Line, LineChart, ComposedChart, PieChart, Pie, Cell } from 'recharts';
import { MainHeader } from './components/Common/MainHeader';
import { LoadingState } from './components/Common/LoadingState';
import { ErrorState } from './components/Common/ErrorState';
import { useQHSERunningProjects } from './hooks/useQHSEProjects';
import { withDashboardControls } from '../../hoc/withPageControls';
import { PageControlButtons } from '../../components/PageControlButtons';
import { QHSE_MODULE_LABELS } from '../../config/qhseModules.config';
import {
  calculateHealthSafetyMetrics,
  getSafetyPerformance,
  generateIncidentTrend,
  generateSafetyKPIDistribution,
  getHighRiskProjects,
  generateSafetyByManager,
  generateSafetyChecklist,
  generateMonthlySafetyTrend,
  HEALTH_SAFETY_FEATURES
} from './utils/healthSafetyMetrics';
import {
  SafetyMetricCard,
  RiskLevelBadge,
  SafetyScoreDisplay,
  HighRiskProjectCard,
  SafetyChecklistItem,
  ManagerSafetyCard,
  SafetyEmptyState
} from './components/HealthSafety/SafetyComponents';

const HealthSafety = ({ pageControls }) => {
  const { data: projectsData, loading, error, refetch, isRefreshing } = useQHSERunningProjects();
  const [selectedView, setSelectedView] = useState('overview'); // overview, incidents, risk, performance

  // Calculate all health and safety metrics
  const safetyMetrics = useMemo(() => {
    if (!projectsData || projectsData.length === 0) return null;
    return calculateHealthSafetyMetrics(projectsData);
  }, [projectsData]);

  const incidentTrend = useMemo(() => {
    if (!projectsData || projectsData.length === 0) return [];
    return generateIncidentTrend(projectsData);
  }, [projectsData]);

  const safetyKPIDistribution = useMemo(() => {
    if (!projectsData || projectsData.length === 0) return [];
    return generateSafetyKPIDistribution(projectsData);
  }, [projectsData]);

  const highRiskProjects = useMemo(() => {
    if (!projectsData || projectsData.length === 0) return [];
    return getHighRiskProjects(projectsData, 5);
  }, [projectsData]);

  const managerSafety = useMemo(() => {
    if (!projectsData || projectsData.length === 0) return [];
    return generateSafetyByManager(projectsData);
  }, [projectsData]);

  const safetyChecklist = useMemo(() => {
    if (!projectsData || projectsData.length === 0) return [];
    return generateSafetyChecklist(projectsData);
  }, [projectsData]);

  const monthlySafetyTrend = useMemo(() => {
    if (!projectsData || projectsData.length === 0) return [];
    return generateMonthlySafetyTrend(projectsData);
  }, [projectsData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 p-6">
        <MainHeader 
          title={QHSE_MODULE_LABELS.healthSafety.shortTitle}
          subtitle={QHSE_MODULE_LABELS.healthSafety.description}
        />
        <LoadingState message="Loading occupational health and safety data..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 p-6">
        <MainHeader 
          title={QHSE_MODULE_LABELS.healthSafety.shortTitle}
          subtitle={QHSE_MODULE_LABELS.healthSafety.description}
        />
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }

  if (!projectsData || projectsData.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 p-6">
        <MainHeader 
          title={QHSE_MODULE_LABELS.healthSafety.shortTitle}
          subtitle={QHSE_MODULE_LABELS.healthSafety.description}
        />
        <SafetyEmptyState message="No safety data available. Start by adding projects to the system." />
      </div>
    );
  }

  const safetyPerformance = safetyMetrics.safetyPerformance;
  const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <MainHeader 
        title={QHSE_MODULE_LABELS.healthSafety.shortTitle}
        subtitle={`${projectsData.length} projects • ${safetyMetrics.totalIncidents} incidents • ${safetyMetrics.daysWithoutIncident} days incident-free`}
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

      {/* View Selector */}
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

      {/* Key Metrics */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 ${
        HEALTH_SAFETY_FEATURES.enableHighRiskProjects ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
      }`}>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 flex items-center justify-center">
          <SafetyScoreDisplay score={safetyMetrics.safetyScore} size="md" />
        </div>
        <SafetyMetricCard
          title="Incident Rate"
          value={safetyMetrics.incidentRate.toFixed(2)}
          subtitle="per 200k work hours"
          icon={AlertCircle}
          color={safetyMetrics.incidentRate < 1 ? 'green' : safetyMetrics.incidentRate < 3 ? 'orange' : 'red'}
          description="OSHA recordable rate"
        />
        <SafetyMetricCard
          title="Open Incidents"
          value={safetyMetrics.totalIncidents}
          subtitle={`${safetyMetrics.nearMissCount} near misses`}
          icon={AlertTriangle}
          color={safetyMetrics.totalIncidents === 0 ? 'green' : safetyMetrics.totalIncidents < 5 ? 'orange' : 'red'}
          description="Requiring attention"
        />
        <SafetyMetricCard
          title="Days Without Incident"
          value={safetyMetrics.daysWithoutIncident}
          subtitle="Incident-free days"
          icon={Calendar}
          color="green"
          badge="🏆"
          description={`${safetyMetrics.projectsIncidentFree} projects incident-free`}
        />
        {/* High Risk Projects Card - Soft-coded feature flag */}
        {HEALTH_SAFETY_FEATURES.enableHighRiskProjects && (
          <SafetyMetricCard
            title="High Risk Projects"
            value={highRiskProjects.length}
            subtitle="Need immediate attention"
            icon={Target}
            color={highRiskProjects.length === 0 ? 'green' : highRiskProjects.length < 3 ? 'orange' : 'red'}
            description="Priority monitoring"
          />
        )}
      </div>

      {/* Dynamic Content Based on Selected View */}
      {selectedView === 'overview' && (
        <OverviewView 
          safetyMetrics={safetyMetrics}
          highRiskProjects={highRiskProjects}
          incidentTrend={incidentTrend}
          safetyChecklist={safetyChecklist}
          monthlySafetyTrend={monthlySafetyTrend}
        />
      )}

      {selectedView === 'incidents' && (
        <IncidentsView 
          incidentTrend={incidentTrend}
          safetyMetrics={safetyMetrics}
          highRiskProjects={highRiskProjects}
        />
      )}

      {selectedView === 'risk' && (
        <RiskAssessmentView 
          highRiskProjects={highRiskProjects}
          safetyChecklist={safetyChecklist}
          safetyMetrics={safetyMetrics}
        />
      )}

      {selectedView === 'performance' && (
        <PerformanceView 
          managerSafety={managerSafety}
          safetyKPIDistribution={safetyKPIDistribution}
          monthlySafetyTrend={monthlySafetyTrend}
          safetyMetrics={safetyMetrics}
        />
      )}
    </div>
  );
};

// Overview View Component
const OverviewView = ({ safetyMetrics, highRiskProjects, incidentTrend, safetyChecklist, monthlySafetyTrend }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column - High Risk Projects (Soft-coded: Only show if enabled) */}
      {HEALTH_SAFETY_FEATURES.enableHighRiskProjects && (
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="text-orange-500" size={20} />
              High Risk Projects
            </h3>
            {highRiskProjects.length > 0 ? (
              <div className="space-y-3">
                {highRiskProjects.map((project, idx) => (
                  <HighRiskProjectCard key={project.projectNo} project={project} rank={idx + 1} />
                ))}
              </div>
            ) : (
              <SafetyEmptyState message="No high-risk projects identified" icon={Shield} />
            )}
          </div>
        </div>
      )}

      {/* Middle & Right Columns */}
      <div className={`space-y-6 ${
        HEALTH_SAFETY_FEATURES.enableHighRiskProjects ? 'lg:col-span-2' : 'lg:col-span-3'
      }`}>
        {/* Monthly Safety Trend */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="text-green-500" size={20} />
            Monthly Safety Trend
          </h3>
          {monthlySafetyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={monthlySafetyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis yAxisId="left" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="Incidents" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="Near Misses" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="Safety Score" stroke="#10b981" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <SafetyEmptyState message="No monthly trend data available" />
          )}
        </div>

        {/* Incident Distribution */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="text-blue-500" size={20} />
            Incident Distribution by Project Phase
          </h3>
          {incidentTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={incidentTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Open Incidents" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Near Misses" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Resolved" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <SafetyEmptyState message="No incident data available" />
          )}
        </div>

        {/* Safety Checklist */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="text-purple-500" size={20} />
            Safety Compliance Checklist
          </h3>
          <div className="space-y-3">
            {safetyChecklist.map((item, idx) => (
              <SafetyChecklistItem key={idx} item={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Incidents View Component
const IncidentsView = ({ incidentTrend, safetyMetrics, highRiskProjects }) => {
  return (
    <div className="space-y-6">
      <div className={`grid grid-cols-1 gap-6 ${
        HEALTH_SAFETY_FEATURES.enableHighRiskProjects ? 'lg:grid-cols-2' : ''
      }`}>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Incident Trend Analysis</h3>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={incidentTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Open Incidents" stroke="#ef4444" strokeWidth={2} />
              <Line type="monotone" dataKey="Near Misses" stroke="#f59e0b" strokeWidth={2} />
              <Line type="monotone" dataKey="Resolved" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* High Risk Projects - Soft-coded: Only show if enabled */}
        {HEALTH_SAFETY_FEATURES.enableHighRiskProjects && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Projects Requiring Investigation</h3>
            <div className="space-y-3">
              {highRiskProjects.length > 0 ? (
                highRiskProjects.map((project, idx) => (
                  <HighRiskProjectCard key={project.projectNo} project={project} rank={idx + 1} />
                ))
              ) : (
                <SafetyEmptyState message="No projects require investigation" icon={Shield} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Risk Assessment View Component
const RiskAssessmentView = ({ highRiskProjects, safetyChecklist, safetyMetrics }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* High Risk Projects - Soft-coded: Only show if enabled */}
        {HEALTH_SAFETY_FEATURES.enableHighRiskProjects && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">High Risk Projects</h3>
            <div className="space-y-3">
              {highRiskProjects.map((project, idx) => (
                <HighRiskProjectCard key={project.projectNo} project={project} rank={idx + 1} />
              ))}
            </div>
          </div>
        )}

        <div className={`bg-white rounded-xl shadow-sm p-6 border border-gray-200 ${
          HEALTH_SAFETY_FEATURES.enableHighRiskProjects ? '' : 'lg:col-span-2'
        }`}>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Mitigation Checklist</h3>
          <div className="space-y-3">
            {safetyChecklist.map((item, idx) => (
              <SafetyChecklistItem key={idx} item={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Animated radial safety-score gauge (unique visual identity for Performance tab)
const SafetyScoreGauge = ({ score, performanceInfo }) => {
  const [displayScore, setDisplayScore] = useState(0);
  const clamped = Math.min(100, Math.max(0, Number(score) || 0));

  useEffect(() => {
    let raf;
    const start = window.performance.now();
    const duration = 1200;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayScore(Math.round(clamped * eased * 10) / 10);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clamped]);

  const size = 280;
  const stroke = 20;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const progress = (displayScore / 100) * circumference;

  // Gradient stops by score
  const hue = clamped >= 80 ? '#10b981' : clamped >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative flex flex-col items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={hue} stopOpacity="1" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="1" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
        {/* Progress */}
        <circle
          cx={cx} cy={cy} r={r}
          stroke="url(#gaugeGrad)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          style={{ transition: 'stroke-dashoffset 0.1s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-5xl font-black text-gray-900 tracking-tight">{displayScore}</div>
        <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 mt-1">Safety Score</div>
        {performanceInfo?.label && (
          <div className={`mt-2 px-3 py-1 rounded-full text-xs font-bold ${
            clamped >= 80 ? 'bg-emerald-50 text-emerald-700' : clamped >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
          }`}>
            {performanceInfo.label}
          </div>
        )}
      </div>
    </div>
  );
};

// Donut with center total + soft-coded legend
const KPIDonut = ({ data, colors }) => {
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  return (
    <div className="flex flex-col lg:flex-row items-center gap-6">
      <div className="relative" style={{ width: 240, height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%" cy="50%"
              innerRadius={70}
              outerRadius={100}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-3xl font-black text-gray-900">{total}</div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Projects</div>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 gap-2 w-full">
        {data.map((entry, i) => (
          <div key={entry.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: colors[i % colors.length] }} />
            <span className="text-sm font-medium text-gray-700 flex-1">{entry.name}</span>
            <span className="text-sm font-bold text-gray-900">{entry.value}</span>
            <span className="text-xs text-gray-400 w-12 text-right">
              {total ? `${Math.round((entry.value / total) * 100)}%` : '0%'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Performance View Component
const PerformanceView = ({ managerSafety, safetyKPIDistribution, monthlySafetyTrend, safetyMetrics }) => {
  const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
  const performance = safetyMetrics?.safetyPerformance;

  return (
    <div className="space-y-6">
      {/* Hero: animated radial gauge + key stats */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-8 text-white shadow-xl">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          <div className="flex justify-center lg:justify-start">
            <div className="bg-white/95 rounded-2xl p-4 shadow-2xl">
              <SafetyScoreGauge score={safetyMetrics?.safetyScore} performanceInfo={performance} />
            </div>
          </div>
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Incident Rate', value: safetyMetrics?.incidentRate, sub: 'per 200k hrs', tone: 'text-emerald-300' },
              { label: 'Open Incidents', value: safetyMetrics?.totalIncidents, sub: `${safetyMetrics?.nearMissCount ?? 0} near misses`, tone: 'text-rose-300' },
              { label: 'Days Incident-Free', value: safetyMetrics?.daysWithoutIncident, sub: `${safetyMetrics?.projectsIncidentFree ?? 0} projects`, tone: 'text-sky-300' },
              { label: 'Avg Project Safety', value: `${safetyMetrics?.avgProjectSafety ?? 0}%`, sub: 'KPI achieved', tone: 'text-amber-300' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-white/5 border border-white/10 p-4 backdrop-blur-sm">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-white/60">{s.label}</div>
                <div className={`text-3xl font-black mt-1 ${s.tone}`}>{s.value ?? 0}</div>
                <div className="text-xs text-white/50 mt-1">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-6 ${HEALTH_SAFETY_FEATURES.enableManagerSafetyPerformance ? 'lg:grid-cols-2' : ''}`}>
        {HEALTH_SAFETY_FEATURES.enableManagerSafetyPerformance && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Manager Safety Performance</h3>
            <div className="space-y-3">
              {managerSafety.map((manager, idx) => (
                <ManagerSafetyCard key={manager.name} manager={manager} rank={idx + 1} />
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Safety KPI Distribution</h3>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Donut</span>
          </div>
          <KPIDonut data={safetyKPIDistribution} colors={CHART_COLORS} />
        </div>

        {/* Monthly safety score trend strip */}
        {monthlySafetyTrend?.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Safety Score Trend</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlySafetyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip />
                <Line type="monotone" dataKey="Safety Score" stroke="#10b981" strokeWidth={3} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

// Wrapper component to provide refetch functionality
const HealthSafetyWithRefresh = (props) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const refetch = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);
  
  return <HealthSafety {...props} refetch={refetch} key={refreshTrigger} />;
};

export default withDashboardControls(HealthSafetyWithRefresh, {
  autoRefreshInterval: 30000, // 30 seconds
  storageKey: 'qhseHealthSafetyPageControls',
});
