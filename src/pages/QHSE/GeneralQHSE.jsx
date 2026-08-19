import React, { useState, useMemo, useEffect } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { 
  ShieldCheckIcon, 
  ChartBarIcon, 
  DocumentTextIcon, 
  PresentationChartLineIcon,
  TableCellsIcon,
  Bars3Icon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import { IconButton, Tooltip } from '@mui/material';

// QHSE Components
import DashSummaryCard from './components/Dashboard/DashSummaryCard';
import QHSEOverviewChart from './components/Dashboard/OverviewChart';
import ProjectStatus from './components/Dashboard/ProjectStatus';
import SummaryView from './components/SummayView/Page';
import DetailedView from './components/DetailedView/DetailedView';
import QualityManagement from './QualityManagement';
import HealthSafety from './HealthSafety';
import Environmental from './Environmental';
import Energy from './Energy';
import Projects from './Projects';
import QHSEAIDashboard from '../../components/qhse/QHSEAIDashboard';

// Common Components
import { LoadingState } from './components/Common/LoadingState';
import { ErrorState } from './components/Common/ErrorState';
import { EmptyDataState } from './components/Common/EmptyDataState';
import { MainHeader } from './components/Common/MainHeader';

// Hooks and Utils
import { useQHSERunningProjects } from './hooks/useQHSEProjects';
import { getMonthlyOverviewData, getYearlyOverviewData } from './utils';
import { generateQHSETimelineData } from './utils/chartUtils';

const GeneralQHSE = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50">
      <Routes>
        <Route index element={<QHSEDashboard />} />
        <Route path="/" element={<QHSEDashboard />} />
        <Route path="/summary" element={<SummaryViewWrapper />} />
        <Route path="/detailed" element={<DetailedViewWrapper />} />
        <Route path="/projects" element={<ProjectsWrapper />} />
        <Route path="/quality" element={<QualityManagement />} />
        <Route path="/health-safety" element={<HealthSafety />} />
        {/* SOFT-CODED: Environmental and Energy routes disabled - not related to project quality */}
        {/* <Route path="/environmental" element={<Environmental />} /> */}
        {/* <Route path="/energy" element={<Energy />} /> */}
        <Route path="/ai-dashboard" element={<QHSEAIDashboard />} />
      </Routes>
    </div>
  );
};

// Main Dashboard Component
const QHSEDashboard = () => {
  const navigate = useNavigate();
  const { 
    data: projectsData, 
    loading, 
    isRefreshing, 
    error, 
    refetch, 
    lastUpdated,
    dataLastChanged 
  } = useQHSERunningProjects();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [sidebarVisible, setSidebarVisible] = useState(true);

  // Auto-refresh every 30 seconds when enabled
  useEffect(() => {
    if (!autoRefreshEnabled) return;
    
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing QHSE data...');
      refetch();
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, [autoRefreshEnabled, refetch]);

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const chartData = useMemo(() => {
    if (!projectsData || projectsData.length === 0) {
      return { monthlyData: [], yearlyData: [], timelineData: [] };
    }
    const qhseTimelineData = generateQHSETimelineData(projectsData);

    return {
      monthlyData: getMonthlyOverviewData(projectsData),
      yearlyData: getYearlyOverviewData(projectsData),
      timelineData: qhseTimelineData
    };
  }, [projectsData]);

  // Loading state
  if (loading) {
    return (
      <div className="p-6">
        <MainHeader />
        <LoadingState message="Loading QHSE data from database..." />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <MainHeader />
        <ErrorState error={error} onRetry={refetch} />
      </div>
    );
  }

  // Empty state
  console.log('🔍 QHSE Dashboard Debug:', {
    projectsData,
    projectsDataType: typeof projectsData,
    isArray: Array.isArray(projectsData),
    length: projectsData?.length,
    hasData: !!(projectsData && projectsData.length > 0)
  });
  
  if (!projectsData || projectsData.length === 0) {
    console.warn('⚠️ Showing EmptyDataState - projectsData:', projectsData);
    return (
      <div className="p-6">
        <MainHeader />
        <EmptyDataState onRetry={refetch} />
      </div>
    );
  }

  // Navigation cards
  const navCards = [
    {
      title: 'Summary View',
      description: 'Overview of all projects with filtering options',
      icon: ChartBarIcon,
      path: '/qhse/general/summary',
      color: 'from-blue-500 to-blue-600',
      iconColor: 'text-blue-500'
    },
    {
      title: 'Detailed View',
      description: 'Comprehensive project data table',
      icon: TableCellsIcon,
      path: '/qhse/general/detailed',
      color: 'from-indigo-500 to-indigo-600',
      iconColor: 'text-indigo-500'
    },
    {
      title: 'Project Management',
      description: 'Create and manage QHSE projects',
      icon: DocumentTextIcon,
      path: '/qhse/general/projects',
      color: 'from-purple-500 to-purple-600',
      iconColor: 'text-purple-500'
    },
    {
      title: 'AI Insights Dashboard',
      description: 'AI-powered predictions and analytics',
      icon: SparklesIcon,
      path: '/qhse/general/ai-dashboard',
      color: 'from-purple-500 to-pink-600',
      iconColor: 'text-purple-500',
      badge: 'NEW'
    }
  ];

  return (
    <>
      <style>{`
        :fullscreen aside,
        :fullscreen header,
        :fullscreen footer {
          display: none !important;
        }
        :fullscreen {
          background: linear-gradient(to bottom right, rgb(239 246 255), white, rgb(248 250 252)) !important;
          padding: 2rem !important;
        }
        :fullscreen main {
          margin-left: 0 !important;
        }
        ${!sidebarVisible ? `
          aside {
            display: none !important;
          }
          main {
            margin-left: 0 !important;
          }
        ` : ''}
      `}</style>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto">
        {/* Header */}
        <MainHeader 
        title="QHSE Dashboard"
        subtitle={`Monitoring ${projectsData.length} Active Projects`}
        lastUpdated={lastUpdated}
        dataLastChanged={dataLastChanged}
        isRefreshing={isRefreshing}
        className="mb-6"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Sidebar toggle */}
          <Tooltip title={sidebarVisible ? 'Hide Sidebar' : 'Show Sidebar'}>
            <IconButton
              size="small"
              onClick={() => setSidebarVisible(!sidebarVisible)}
              sx={{ color: sidebarVisible ? 'primary.main' : 'text.secondary' }}
            >
              <Bars3Icon className="w-4 h-4" />
            </IconButton>
          </Tooltip>
          
          {/* Auto-refresh indicator */}
          <Tooltip title={autoRefreshEnabled ? 'Auto-refresh ON (30s)' : 'Auto-refresh OFF'}>
            <IconButton
              size="small"
              onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
              sx={{ color: autoRefreshEnabled ? 'success.main' : 'text.secondary' }}
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            </IconButton>
          </Tooltip>
          
          {/* Fullscreen toggle */}
          <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}>
            <IconButton
              size="small"
              onClick={toggleFullscreen}
              sx={{ color: 'text.secondary' }}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </IconButton>
          </Tooltip>
        </div>
      </MainHeader>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {navCards.map((card) => (
          <button
            key={card.path}
            onClick={() => navigate(card.path)}
            className="group relative overflow-hidden rounded-xl bg-white p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-200 hover:border-gray-300"
          >
            {card.badge && (
              <div className="absolute top-3 right-3 px-2 py-1 text-xs font-bold text-white bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse">
                {card.badge}
              </div>
            )}
            <div className="flex items-start space-x-4">
              <div className={`flex-shrink-0 p-3 rounded-lg bg-gradient-to-br ${card.color} text-white group-hover:scale-110 transition-transform duration-300`}>
                <card.icon className="h-6 w-6" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                  {card.title}
                </h3>
                <p className="text-sm text-gray-600">
                  {card.description}
                </p>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r from-blue-500 to-purple-500 group-hover:w-full transition-all duration-500"></div>
          </button>
        ))}
      </div>

      {/* Dashboard Content */}
      <div className="space-y-6">
        {/* Summary Cards */}
        <section className="w-full">
          <DashSummaryCard projectsData={projectsData} />
        </section>

        {/* Charts */}
        <section className="w-full">
          <div className="grid grid-cols-1 gap-6">
            <div className="w-full min-h-[400px]">
              <QHSEOverviewChart 
                monthlyData={chartData.monthlyData} 
                yearlyData={chartData.yearlyData} 
                className="w-full h-full"
              />
            </div>
          </div>
        </section>

        {/* Project Status Table */}
        <section className="w-full">
          <ProjectStatus 
            projectsData={projectsData} 
            loading={loading}
            onRefresh={refetch}
            className="w-full"
          />
        </section>
      </div>
    </div>
    </>
  );
};

// Wrapper components for sub-pages
const SummaryViewWrapper = () => {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto">
      <SummaryView />
    </div>
  );
};

const DetailedViewWrapper = () => {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto">
      <DetailedView />
    </div>
  );
};

const ProjectsWrapper = () => {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1920px] mx-auto">
      <Projects />
    </div>
  );
};

export default GeneralQHSE;
