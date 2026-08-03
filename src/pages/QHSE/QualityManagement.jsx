import React, { useState, useMemo, useCallback } from 'react';
import { 
  FileCheck, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp,
  Award,
  Target,
  BarChart3,
  ClipboardCheck,
  Filter,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  X,
  Eye
} from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend, Line, LineChart, ComposedChart } from 'recharts';
import { MainHeader } from './components/Common/MainHeader';
import { LoadingState } from './components/Common/LoadingState';
import { ErrorState } from './components/Common/ErrorState';
import { useQHSERunningProjects } from './hooks/useQHSEProjects';
import { withDashboardControls } from '../../hoc/withPageControls';
import { PageControlButtons } from '../../components/PageControlButtons';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton } from '@mui/material';
import {
  calculateQualityMetrics,
  getQualityPerformance,
  getComplianceStatus,
  generateAuditTimeline,
  generateNCTrend,
  getProjectsNeedingAttention,
  generateComplianceMatrix
} from './utils/qualityMetrics';
import {
  QualityMetricCard,
  QualityStatusBadge,
  QualityProgressBar,
  AuditTimelineItem,
  ProjectAttentionCard,
  ComplianceMatrixRow,
  QualityEmptyState
} from './components/Quality/QualityComponents';

// ✅ Import soft-coded configuration
import { QUALITY_MANAGEMENT_CONFIG, isFeatureEnabled, getConfig } from '../../config/qualityManagement.config';

const QualityManagement = ({ pageControls }) => {
  const { data: projectsData, loading, error, refetch, isRefreshing } = useQHSERunningProjects();
  const [selectedView, setSelectedView] = useState('overview'); // overview, audits, compliance, trends
  
  // ✅ Modal state for detailed metric views
  const [activeDetailModal, setActiveDetailModal] = useState(null); // 'qualityScore', 'complianceRate', 'openIssues', 'qualityAudits'

  // Calculate all quality metrics
  const qualityMetrics = useMemo(() => {
    if (!projectsData || projectsData.length === 0) return null;
    return calculateQualityMetrics(projectsData);
  }, [projectsData]);

  const auditTimeline = useMemo(() => {
    if (!projectsData || projectsData.length === 0) return [];
    return generateAuditTimeline(projectsData);
  }, [projectsData]);

  const ncTrend = useMemo(() => {
    if (!projectsData || projectsData.length === 0) return [];
    return generateNCTrend(projectsData);
  }, [projectsData]);

  const projectsNeedingAttention = useMemo(() => {
    if (!projectsData || projectsData.length === 0) return [];
    return getProjectsNeedingAttention(projectsData, 5);
  }, [projectsData]);

  const complianceMatrix = useMemo(() => {
    if (!projectsData || projectsData.length === 0) return [];
    return generateComplianceMatrix(projectsData);
  }, [projectsData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 p-6">
        <MainHeader 
          title="Quality Management"
          subtitle="Comprehensive quality management system"
        />
        <LoadingState message="Loading quality management data..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 p-6">
        <MainHeader 
          title="Quality Management"
          subtitle="Comprehensive quality management system"
        />
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }

  if (!projectsData || projectsData.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 p-6">
        <MainHeader 
          title="Quality Management"
          subtitle="Comprehensive quality management system"
        />
        <QualityEmptyState message="No quality data available. Start by adding projects to the system." />
      </div>
    );
  }

  const qualityPerformance = getQualityPerformance(qualityMetrics.qualityScore);
  const complianceStatus = getComplianceStatus(qualityMetrics.complianceRate);
  const upcomingAudits = auditTimeline.filter(a => !a.isPast).slice(0, 5);
  const recentAudits = auditTimeline.filter(a => a.isPast).slice(-5).reverse();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <MainHeader 
        title="Quality Management"
        subtitle={`Monitoring ${projectsData.length} projects • ${qualityMetrics.totalAudits} audits • ${qualityMetrics.openCARs + qualityMetrics.openObs} open issues`}
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
          { id: 'audits', label: 'Audits', icon: ClipboardCheck },
          { id: 'compliance', label: 'Compliance', icon: CheckCircle },
          { id: 'trends', label: 'Trends', icon: TrendingUp }
        ].map(view => (
          <button
            key={view.id}
            onClick={() => setSelectedView(view.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
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

      {/* ✅ Key Metrics - Now Clickable with Detail Modals */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <QualityMetricCard
          title="Quality Score"
          value={`${qualityMetrics.qualityScore}/100`}
          subtitle={qualityPerformance.label}
          icon={Award}
          color={qualityPerformance.label === 'Excellent' ? 'green' : qualityPerformance.label === 'Good' ? 'blue' : 'orange'}
          description={`${qualityPerformance.icon} Overall quality performance`}
          onClick={() => isFeatureEnabled('enableDetailedMetricViews') && setActiveDetailModal('qualityScore')}
          showDetailButton={getConfig('metricCards.qualityScore.showDetailButton')}
        />
        <QualityMetricCard
          title="Compliance Rate"
          value={`${qualityMetrics.complianceRate}%`}
          subtitle={complianceStatus.label}
          icon={CheckCircle}
          color={qualityMetrics.complianceRate >= 90 ? 'green' : qualityMetrics.complianceRate >= 75 ? 'blue' : 'orange'}
          description={`${qualityMetrics.closedCARs + qualityMetrics.closedObs} of ${qualityMetrics.totalCARs + qualityMetrics.totalObs} issues resolved`}
          onClick={() => isFeatureEnabled('enableDetailedMetricViews') && setActiveDetailModal('complianceRate')}
          showDetailButton={getConfig('metricCards.complianceRate.showDetailButton')}
        />
        <QualityMetricCard
          title="Open Issues"
          value={qualityMetrics.openCARs + qualityMetrics.openObs}
          subtitle={`${qualityMetrics.openCARs} CARs • ${qualityMetrics.openObs} Obs`}
          icon={AlertTriangle}
          color={qualityMetrics.openCARs + qualityMetrics.openObs > 20 ? 'red' : qualityMetrics.openCARs + qualityMetrics.openObs > 10 ? 'orange' : 'green'}
          description="Requiring attention"
          onClick={() => isFeatureEnabled('enableDetailedMetricViews') && setActiveDetailModal('openIssues')}
          showDetailButton={getConfig('metricCards.openIssues.showDetailButton')}
        />
        <QualityMetricCard
          title="Quality Audits"
          value={qualityMetrics.completedAudits}
          subtitle={`of ${qualityMetrics.totalAudits} total`}
          icon={FileCheck}
          color="purple"
          description={qualityMetrics.delayedAudits > 0 ? `${qualityMetrics.delayedAudits} delayed` : 'All on schedule'}
          onClick={() => isFeatureEnabled('enableDetailedMetricViews') && setActiveDetailModal('qualityAudits')}
          showDetailButton={getConfig('metricCards.qualityAudits.showDetailButton')}
        />
      </div>

      {/* Dynamic Content Based on Selected View */}
      {selectedView === 'overview' && (
        <OverviewView 
          qualityMetrics={qualityMetrics}
          projectsNeedingAttention={projectsNeedingAttention}
          upcomingAudits={upcomingAudits}
          ncTrend={ncTrend}
        />
      )}

      {selectedView === 'audits' && (
        <AuditsView 
          upcomingAudits={upcomingAudits}
          recentAudits={recentAudits}
          qualityMetrics={qualityMetrics}
        />
      )}

      {selectedView === 'compliance' && (
        <ComplianceView 
          complianceMatrix={complianceMatrix}
          qualityMetrics={qualityMetrics}
        />
      )}

      {selectedView === 'trends' && (
        <TrendsView 
          ncTrend={ncTrend}
          projectsData={projectsData}
        />
      )}

      {/* ✅ Detail Modals for Metric Cards */}
      <MetricDetailModal
        open={activeDetailModal === 'qualityScore'}
        onClose={() => setActiveDetailModal(null)}
        title={getConfig('metricCards.qualityScore.title')}
        description={getConfig('metricCards.qualityScore.description')}
        content={<QualityScoreDetails qualityMetrics={qualityMetrics} projectsData={projectsData} />}
      />
      
      <MetricDetailModal
        open={activeDetailModal === 'complianceRate'}
        onClose={() => setActiveDetailModal(null)}
        title={getConfig('metricCards.complianceRate.title')}
        description={getConfig('metricCards.complianceRate.description')}
        content={<ComplianceRateDetails qualityMetrics={qualityMetrics} projectsData={projectsData} />}
      />
      
      <MetricDetailModal
        open={activeDetailModal === 'openIssues'}
        onClose={() => setActiveDetailModal(null)}
        title={getConfig('metricCards.openIssues.title')}
        description={getConfig('metricCards.openIssues.description')}
        content={<OpenIssuesDetails qualityMetrics={qualityMetrics} projectsData={projectsData} />}
      />
      
      <MetricDetailModal
        open={activeDetailModal === 'qualityAudits'}
        onClose={() => setActiveDetailModal(null)}
        title={getConfig('metricCards.qualityAudits.title')}
        description={getConfig('metricCards.qualityAudits.description')}
        content={<QualityAuditsDetails qualityMetrics={qualityMetrics} auditTimeline={auditTimeline} />}
      />
    </div>
  );
};

// ✅ Overview View Component - Updated without Projects Needing Attention
const OverviewView = ({ qualityMetrics, projectsNeedingAttention, upcomingAudits, ncTrend }) => {
  // ✅ Check if Projects Needing Attention feature is enabled
  const showProjects = isFeatureEnabled('showProjectsNeedingAttention');
  
  return (
    <div className={showProjects ? "grid grid-cols-1 lg:grid-cols-3 gap-6" : "space-y-6"}>
      {/* ✅ SOFT-CODED: Only show Projects Needing Attention if enabled in config */}
      {showProjects && (
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Target className="text-red-500" size={20} />
              Projects Needing Attention
            </h3>
            {projectsNeedingAttention.length > 0 ? (
              <div className="space-y-3">
                {projectsNeedingAttention.map((project, idx) => (
                  <ProjectAttentionCard key={project.projectNo} project={project} rank={idx + 1} />
                ))}
              </div>
            ) : (
              <QualityEmptyState message="All projects are performing well" icon={CheckCircle} />
            )}
          </div>
        </div>
      )}

      {/* Main Content - Expands to full width when projects are hidden */}
      <div className={showProjects ? "lg:col-span-2 space-y-6" : "space-y-6"}>
        {/* Non-Conformance Trend Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="text-blue-500" size={20} />
            Non-Conformance Distribution
          </h3>
          {ncTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ncTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="CARs" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Observations" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <QualityEmptyState message="No non-conformance data available" />
          )}
        </div>

        {/* Upcoming Audits */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ClipboardCheck className="text-purple-500" size={20} />
            Upcoming Audits
          </h3>
          {upcomingAudits.length > 0 ? (
            <div className="space-y-3">
              {upcomingAudits.map((audit, idx) => (
                <AuditTimelineItem key={`${audit.projectNo}-${audit.auditType}-${idx}`} audit={audit} />
              ))}
            </div>
          ) : (
            <QualityEmptyState message="No upcoming audits scheduled" icon={FileCheck} />
          )}
        </div>
      </div>
    </div>
  );
};

// ✅ Audits View Component - Now with Expandable Sections
const AuditsView = ({ upcomingAudits, recentAudits, qualityMetrics }) => {
  const [upcomingExpanded, setUpcomingExpanded] = useState(true);
  const [recentExpanded, setRecentExpanded] = useState(true);
  const enableExpand = getConfig('auditSettings.allowExpand', true);
  const defaultVisible = getConfig('auditSettings.defaultVisibleCount', 3);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Upcoming Audits */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardCheck className="text-purple-500" size={20} />
            Upcoming Audits
            <span className="text-sm font-normal text-gray-500">({upcomingAudits.length})</span>
          </h3>
          {enableExpand && upcomingAudits.length > defaultVisible && (
            <button
              onClick={() => setUpcomingExpanded(!upcomingExpanded)}
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {upcomingExpanded ? (
                <>
                  <ChevronUp size={16} />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown size={16} />
                  Show All ({upcomingAudits.length})
                </>
              )}
            </button>
          )}
        </div>
        {upcomingAudits.length > 0 ? (
          <div className="space-y-3">
            {(upcomingExpanded ? upcomingAudits : upcomingAudits.slice(0, defaultVisible)).map((audit, idx) => (
              <AuditTimelineItem key={`upcoming-${idx}`} audit={audit} />
            ))}
          </div>
        ) : (
          <QualityEmptyState message="No upcoming audits" />
        )}
      </div>

      {/* Recent Audits */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileCheck className="text-green-500" size={20} />
            Recent Audits
            <span className="text-sm font-normal text-gray-500">({recentAudits.length})</span>
          </h3>
          {enableExpand && recentAudits.length > defaultVisible && (
            <button
              onClick={() => setRecentExpanded(!recentExpanded)}
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {recentExpanded ? (
                <>
                  <ChevronUp size={16} />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown size={16} />
                  Show All ({recentAudits.length})
                </>
              )}
            </button>
          )}
        </div>
        {recentAudits.length > 0 ? (
          <div className="space-y-3">
            {(recentExpanded ? recentAudits : recentAudits.slice(0, defaultVisible)).map((audit, idx) => (
              <AuditTimelineItem key={`recent-${idx}`} audit={audit} />
            ))}
          </div>
        ) : (
          <QualityEmptyState message="No recent audits" />
        )}
      </div>
    </div>
  );
};

// ✅ Compliance View Component - Now with Expandable Sections
const ComplianceView = ({ complianceMatrix, qualityMetrics }) => {
  const [expanded, setExpanded] = useState(true);
  const enableExpand = getConfig('complianceSettings.allowExpand', true);
  const defaultVisible = getConfig('complianceSettings.defaultVisibleCount', 5);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <CheckCircle className="text-green-500" size={20} />
            Compliance Matrix
            <span className="text-sm font-normal text-gray-500">({complianceMatrix.length} categories)</span>
          </h3>
          {enableExpand && complianceMatrix.length > defaultVisible && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {expanded ? (
                <>
                  <ChevronUp size={16} />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown size={16} />
                  Show All ({complianceMatrix.length})
                </>
              )}
            </button>
          )}
        </div>
        <div className="space-y-3">
          {(expanded ? complianceMatrix : complianceMatrix.slice(0, defaultVisible)).map((category, idx) => (
            <ComplianceMatrixRow key={idx} category={category} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h4 className="text-sm font-medium text-gray-600 mb-2">CARs Resolution</h4>
          <QualityProgressBar 
            value={qualityMetrics.closedCARs} 
            max={qualityMetrics.totalCARs || 1}
            color="green"
            label={`${qualityMetrics.closedCARs} of ${qualityMetrics.totalCARs} closed`}
          />
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Observations Resolution</h4>
          <QualityProgressBar 
            value={qualityMetrics.closedObs} 
            max={qualityMetrics.totalObs || 1}
            color="blue"
            label={`${qualityMetrics.closedObs} of ${qualityMetrics.totalObs} closed`}
          />
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Overall KPI Achievement</h4>
          <QualityProgressBar 
            value={qualityMetrics.avgKPI} 
            max={100}
            color="purple"
            label={`${qualityMetrics.avgKPI}% average`}
          />
        </div>
      </div>
    </div>
  );
};

// Trends View Component
const TrendsView = ({ ncTrend, projectsData }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Non-Conformance Trends</h3>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={ncTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Legend />
            <Bar dataKey="CARs" fill="#ef4444" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Observations" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="Total" stroke="#8b5cf6" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ========================================================================
// ✅ MODAL COMPONENTS AND DETAIL VIEWS
// ========================================================================

// Generic Modal Component for Metric Details
const MetricDetailModal = ({ open, onClose, title, description, content }) => {
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        borderBottom: '1px solid #e5e7eb',
        pb: 2
      }}>
        <div>
          <div className="text-xl font-semibold text-gray-900">{title}</div>
          <div className="text-sm text-gray-600 mt-1">{description}</div>
        </div>
        <IconButton onClick={onClose} size="small">
          <X size={20} />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        {content}
      </DialogContent>
      <DialogActions sx={{ borderTop: '1px solid #e5e7eb', p: 2 }}>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Quality Score Detail View
const QualityScoreDetails = ({ qualityMetrics, projectsData }) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-600 mb-1">Overall Score</div>
          <div className="text-3xl font-bold text-blue-600">{qualityMetrics.qualityScore}/100</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-600 mb-1">Performance</div>
          <div className="text-xl font-semibold text-green-600">
            {getQualityPerformance(qualityMetrics.qualityScore).label}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-semibold text-gray-900">Score Breakdown</h4>
        
        <div className="border border-gray-200 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">KPI Achievement</span>
            <span className="text-sm font-semibold text-gray-900">{qualityMetrics.avgKPI}%</span>
          </div>
          <QualityProgressBar value={qualityMetrics.avgKPI} max={100} color="purple" />
        </div>

        <div className="border border-gray-200 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Compliance Rate</span>
            <span className="text-sm font-semibold text-gray-900">{qualityMetrics.complianceRate}%</span>
          </div>
          <QualityProgressBar value={qualityMetrics.complianceRate} max={100} color="green" />
        </div>

        <div className="border border-gray-200 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Audit Completion</span>
            <span className="text-sm font-semibold text-gray-900">
              {qualityMetrics.completedAudits} / {qualityMetrics.totalAudits}
            </span>
          </div>
          <QualityProgressBar 
            value={qualityMetrics.completedAudits} 
            max={qualityMetrics.totalAudits || 1} 
            color="blue" 
          />
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 mt-4">
        <h4 className="font-semibold text-gray-900 mb-2">Summary Statistics</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-600">Total Projects:</span>
            <span className="font-semibold text-gray-900 ml-2">{projectsData.length}</span>
          </div>
          <div>
            <span className="text-gray-600">Avg Completion:</span>
            <span className="font-semibold text-gray-900 ml-2">{qualityMetrics.avgCompletion}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Compliance Rate Detail View
const ComplianceRateDetails = ({ qualityMetrics, projectsData }) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-sm font-medium text-gray-600 mb-1">Compliance Rate</div>
          <div className="text-3xl font-bold text-green-600">{qualityMetrics.complianceRate}%</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="text-sm font-medium text-gray-600 mb-1">Resolved</div>
          <div className="text-3xl font-bold text-blue-600">
            {qualityMetrics.closedCARs + qualityMetrics.closedObs}
          </div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 text-center">
          <div className="text-sm font-medium text-gray-600 mb-1">Total Issues</div>
          <div className="text-3xl font-bold text-orange-600">
            {qualityMetrics.totalCARs + qualityMetrics.totalObs}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-semibold text-gray-900">Resolution Details</h4>
        
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium text-gray-700">CARs (Corrective Action Requests)</span>
            <span className="text-sm font-semibold text-gray-900">
              {qualityMetrics.closedCARs} / {qualityMetrics.totalCARs} closed
            </span>
          </div>
          <QualityProgressBar 
            value={qualityMetrics.closedCARs} 
            max={qualityMetrics.totalCARs || 1} 
            color="green"
          />
          <div className="mt-2 text-sm text-gray-600">
            Open: {qualityMetrics.openCARs} • Closed: {qualityMetrics.closedCARs}
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium text-gray-700">Observations</span>
            <span className="text-sm font-semibold text-gray-900">
              {qualityMetrics.closedObs} / {qualityMetrics.totalObs} closed
            </span>
          </div>
          <QualityProgressBar 
            value={qualityMetrics.closedObs} 
            max={qualityMetrics.totalObs || 1} 
            color="blue"
          />
          <div className="mt-2 text-sm text-gray-600">
            Open: {qualityMetrics.openObs} • Closed: {qualityMetrics.closedObs}
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-2">Status</h4>
        <div className="text-lg font-semibold" style={{ 
          color: qualityMetrics.complianceRate >= 90 ? '#10b981' : 
                 qualityMetrics.complianceRate >= 75 ? '#3b82f6' : '#f59e0b'
        }}>
          {getComplianceStatus(qualityMetrics.complianceRate).label}
        </div>
        <div className="text-sm text-gray-600 mt-1">
          {getComplianceStatus(qualityMetrics.complianceRate).message}
        </div>
      </div>
    </div>
  );
};

// Open Issues Detail View
const OpenIssuesDetails = ({ qualityMetrics, projectsData }) => {
  const totalOpen = qualityMetrics.openCARs + qualityMetrics.openObs;
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className={`rounded-lg p-4 text-center ${
          totalOpen > 20 ? 'bg-red-50' : totalOpen > 10 ? 'bg-orange-50' : 'bg-green-50'
        }`}>
          <div className="text-sm font-medium text-gray-600 mb-1">Total Open</div>
          <div className={`text-3xl font-bold ${
            totalOpen > 20 ? 'text-red-600' : totalOpen > 10 ? 'text-orange-600' : 'text-green-600'
          }`}>
            {totalOpen}
          </div>
        </div>
        <div className="bg-red-50 rounded-lg p-4 text-center">
          <div className="text-sm font-medium text-gray-600 mb-1">Open CARs</div>
          <div className="text-3xl font-bold text-red-600">{qualityMetrics.openCARs}</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 text-center">
          <div className="text-sm font-medium text-gray-600 mb-1">Open Observations</div>
          <div className="text-3xl font-bold text-orange-600">{qualityMetrics.openObs}</div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-semibold text-gray-900">Issue Breakdown</h4>
        
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Critical Issues (CARs)</span>
            <AlertTriangle className="text-red-500" size={20} />
          </div>
          <div className="text-2xl font-bold text-red-600 mb-2">{qualityMetrics.openCARs}</div>
          <div className="text-sm text-gray-600">
            Require immediate corrective action
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Observations</span>
            <Eye className="text-orange-500" size={20} />
          </div>
          <div className="text-2xl font-bold text-orange-600 mb-2">{qualityMetrics.openObs}</div>
          <div className="text-sm text-gray-600">
            Minor issues for improvement
          </div>
        </div>
      </div>

      {qualityMetrics.delayedCARs > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="text-red-600" size={20} />
            <span className="font-semibold text-red-900">Delayed Closures</span>
          </div>
          <div className="text-sm text-red-700">
            {qualityMetrics.delayedCARs} CARs are overdue for closure
          </div>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-2">Resolution Progress</h4>
        <QualityProgressBar 
          value={qualityMetrics.closedCARs + qualityMetrics.closedObs} 
          max={qualityMetrics.totalCARs + qualityMetrics.totalObs || 1}
          color="green"
          label={`${qualityMetrics.closedCARs + qualityMetrics.closedObs} of ${qualityMetrics.totalCARs + qualityMetrics.totalObs} resolved`}
        />
      </div>
    </div>
  );
};

// Quality Audits Detail View
const QualityAuditsDetails = ({ qualityMetrics, auditTimeline }) => {
  const upcomingAudits = auditTimeline.filter(a => !a.isPast);
  const completedAudits = auditTimeline.filter(a => a.isPast);
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-purple-50 rounded-lg p-4 text-center">
          <div className="text-sm font-medium text-gray-600 mb-1">Total Audits</div>
          <div className="text-3xl font-bold text-purple-600">{qualityMetrics.totalAudits}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-sm font-medium text-gray-600 mb-1">Completed</div>
          <div className="text-3xl font-bold text-green-600">{qualityMetrics.completedAudits}</div>
        </div>
        <div className={`rounded-lg p-4 text-center ${
          qualityMetrics.delayedAudits > 0 ? 'bg-red-50' : 'bg-green-50'
        }`}>
          <div className="text-sm font-medium text-gray-600 mb-1">Delayed</div>
          <div className={`text-3xl font-bold ${
            qualityMetrics.delayedAudits > 0 ? 'text-red-600' : 'text-green-600'
          }`}>
            {qualityMetrics.delayedAudits}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Upcoming Audits */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <ClipboardCheck className="text-purple-500" size={18} />
            Upcoming Audits ({upcomingAudits.length})
          </h4>
          {upcomingAudits.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {upcomingAudits.slice(0, 10).map((audit, idx) => (
                <div key={idx} className="text-sm border-l-2 border-purple-500 pl-3 py-1">
                  <div className="font-medium text-gray-900">{audit.projectNo}</div>
                  <div className="text-gray-600">{audit.auditType} - {audit.date}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 italic">No upcoming audits</div>
          )}
        </div>

        {/* Completed Audits */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <CheckCircle className="text-green-500" size={18} />
            Recent Completions ({completedAudits.length})
          </h4>
          {completedAudits.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {completedAudits.slice(-10).reverse().map((audit, idx) => (
                <div key={idx} className="text-sm border-l-2 border-green-500 pl-3 py-1">
                  <div className="font-medium text-gray-900">{audit.projectNo}</div>
                  <div className="text-gray-600">{audit.auditType} - {audit.date}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500 italic">No completed audits</div>
          )}
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-2">Audit Performance</h4>
        <QualityProgressBar 
          value={qualityMetrics.completedAudits} 
          max={qualityMetrics.totalAudits || 1}
          color="purple"
          label={`${Math.round((qualityMetrics.completedAudits / (qualityMetrics.totalAudits || 1)) * 100)}% completion rate`}
        />
      </div>
    </div>
  );
};

// ========================================================================
// END OF MODAL COMPONENTS
// ========================================================================


// Wrapper component to provide refetch functionality
const QualityManagementWithRefresh = (props) => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const refetch = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);
  
  return <QualityManagement {...props} refetch={refetch} key={refreshTrigger} />;
};

export default withDashboardControls(QualityManagementWithRefresh, {
  autoRefreshInterval: 30000, // 30 seconds
  storageKey: 'qhseQualityManagementPageControls',
});
