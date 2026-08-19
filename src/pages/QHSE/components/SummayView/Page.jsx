import React, { useState, useEffect } from 'react'
import SummaryCards from './SummayCards'
import Charts from '../charts/Charts'
import CriticalIssues from './CriticalIssues'
import Filters from './Filters'
import { Card, CardContent } from '../ui/Card'
import { useQHSERunningProjects } from '../../hooks/useQHSEProjects'
import { SearchX, BarChart2, Upload, Maximize2, Minimize2, RefreshCw, Plus } from 'lucide-react'
import { Button, IconButton, Tooltip } from '@mui/material'

// Import reusable components (same as DashboardPage)
import {  MainHeader } from "../Common/MainHeader"
import { LoadingState } from "../Common/LoadingState"
import { ErrorState } from "../Common/ErrorState"
import { EmptyDataState } from "../Common/EmptyDataState"
import { PageLayout } from '@/layouts/PageLayout'
import BulkUploadModal from '../Common/BulkUploadModal'
import { ProjectEditModal } from '../Common/ProjectEditModal'

import {
  getUniqueYears,
  getUniqueClients,
  createProjectFilters,
  calculateProjectMetrics,
  generateKPIStatusData,
  // generateManhoursData, // ✅ COMMENTED: Moved to BillabilityPage
  generateAuditStatusData,
  generateCarsObsData,
  generateTimelineData,
  generateQualityPlanStatusData,
  getKPIBadgeVariant
} from '../../utils'

const SummaryView = () => {
  const { data: projectsData, loading, error, lastUpdated, refetch, isRefreshing } = useQHSERunningProjects();

  const [selectedYear, setSelectedYear] = useState("all")
  const [selectedMonth, setSelectedMonth] = useState("all")
  const [selectedClient, setSelectedClient] = useState("all")
  const [selectedKPIStatus, setSelectedKPIStatus] = useState("all")
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)

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
  }, [])

  
  // Filter projects using utility function
  const filteredProjects = projectsData ? projectsData.filter(
    createProjectFilters(selectedYear, selectedMonth, selectedClient, selectedKPIStatus)
  ) : [];

  // Reset filters function
  const resetFilters = () => {
    setSelectedYear("all");
    setSelectedMonth("all");
    setSelectedClient("all");
    setSelectedKPIStatus("all");
  };

  // Calculate metrics using utility functions
  const projectMetrics = calculateProjectMetrics(filteredProjects);

  const chartData = {
    kpiStatus: generateKPIStatusData(filteredProjects),
    // manhours: generateManhoursData(filteredProjects), // ✅ COMMENTED: Now available in BillabilityPage
    auditStatus: generateAuditStatusData(filteredProjects),
    carsObs: generateCarsObsData(filteredProjects),
    timeline: generateTimelineData(filteredProjects),
    qualityPlanStatus: generateQualityPlanStatusData(filteredProjects)
  };

  // Debug: Log chart data
  console.log('📊 Chart Data Generated:', {
    kpiStatus: chartData.kpiStatus?.length || 0,
    auditStatus: chartData.auditStatus?.length || 0,
    carsObs: chartData.carsObs?.length || 0,
    timeline: chartData.timeline?.length || 0,
    qualityPlanStatus: chartData.qualityPlanStatus?.length || 0,
    filteredProjectsCount: filteredProjects.length
  });


  // Loading state
  if (loading) {
    return (
      <PageLayout>
        <MainHeader/>
        <LoadingState message="Loading Google Sheets data..." />
      </PageLayout>
    )
  }

  // Error state
  if (error) {
    return (
      <PageLayout>
        <MainHeader 
          title="Dashboard Summary"
          subtitle="Error loading data from Google Sheets"
        />
        <ErrorState error={error} onRetry={refetch} />
      </PageLayout>
    )
  }

  // Empty state (no data at all)
  if (!projectsData || projectsData.length === 0) {
    return (
      <PageLayout>
        <MainHeader/>
        <EmptyDataState />
      </PageLayout>
    )
  }

  
  return (
    <PageLayout>
      {/* Fullscreen mode: hide sidebar CSS */}
      <style>{`
        :fullscreen .sidebar,
        :-webkit-full-screen .sidebar,
        :-moz-full-screen .sidebar,
        :-ms-fullscreen .sidebar {
          display: none !important;
        }
        :fullscreen .main-content,
        :-webkit-full-screen .main-content,
        :-moz-full-screen .main-content,
        :-ms-fullscreen .main-content {
          margin-left: 0 !important;
          width: 100% !important;
        }
      `}</style>
      
      <MainHeader 
        title="Dashboard Summary"
        subtitle="Get a quick overview of all QHSE Activities"
        lastUpdated={lastUpdated}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="text-xs text-green-600 dark:text-green-400">
            • Live data ({projectsData.length} projects)
          </div>
          
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
          
          <Button
            variant="outlined"
            size="small"
            startIcon={<Plus size={16} />}
            onClick={() => setCreateModalOpen(true)}
            sx={{
              textTransform: 'none',
              fontSize: '0.75rem',
              px: 2,
              py: 0.5
            }}
          >
            New Project
          </Button>
          
          <Button
            variant="contained"
            size="small"
            startIcon={<Upload size={16} />}
            onClick={() => setUploadModalOpen(true)}
            sx={{
              textTransform: 'none',
              fontSize: '0.75rem',
              px: 2,
              py: 0.5
            }}
          >
            Bulk Upload
          </Button>
        </div>
      </MainHeader>
      
      <SummaryContent 
        projectsData={projectsData}
        filteredProjects={filteredProjects}
        projectMetrics={projectMetrics}
        chartData={chartData}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        selectedClient={selectedClient}
        setSelectedClient={setSelectedClient}
        selectedKPIStatus={selectedKPIStatus}
        setSelectedKPIStatus={setSelectedKPIStatus}
        resetFilters={resetFilters}
      />

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={() => {
          setUploadModalOpen(false);
          refetch(); // Refresh data after upload
        }}
      />

      {/* Create New Project Modal */}
      <ProjectEditModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        mode="create"
        onUpdate={() => {
          setCreateModalOpen(false);
          refetch(); // Refresh data after creating
        }}
      />
    </PageLayout>
  )
}


const SummaryContent = ({ 
  projectsData,
  filteredProjects, 
  projectMetrics, 
  chartData,
  selectedYear,
  setSelectedYear,
  selectedMonth,
  setSelectedMonth,
  selectedClient,
  setSelectedClient,
  selectedKPIStatus,
  setSelectedKPIStatus,
  resetFilters
}) => {
  
  // Handle filtered empty state
  if (filteredProjects.length === 0) {
    return (
      <>
        <FiltersSection 
          projectsData={projectsData}
          filteredProjects={filteredProjects}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          selectedClient={selectedClient}
          setSelectedClient={setSelectedClient}
          selectedKPIStatus={selectedKPIStatus}
          setSelectedKPIStatus={setSelectedKPIStatus}
          resetFilters={resetFilters}
        />
        <EmptyDataState 
          title="No projects found"
          message="Try adjusting your filters to see more results."
          troubleshootingSteps={[
            "Check if your filter criteria are too restrictive",
            "Try resetting all filters to see all projects",
            "Verify that projects exist for the selected time period"
          ]}
        />
      </>
    )
  }

  return (
    <>
      <FiltersSection 
        projectsData={projectsData}
        filteredProjects={filteredProjects}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        selectedClient={selectedClient}
        setSelectedClient={setSelectedClient}
        selectedKPIStatus={selectedKPIStatus}
        setSelectedKPIStatus={setSelectedKPIStatus}
        resetFilters={resetFilters}
      />
      
      <SummaryCards
        totalProjects={projectMetrics.totalProjects}
        extendedProjects={projectMetrics.extendedProjects}
        totalOpenCARs={projectMetrics.totalOpenCARs}
        totalOpenObs={projectMetrics.totalOpenObs}
        avgProgress={projectMetrics.avgProgress}
        filteredProjects={filteredProjects}
      />

      <ChartsSection chartData={chartData} filteredProjects={filteredProjects} />

      {/* <CriticalIssues filteredProjects={filteredProjects} /> */}
    </>
  )
}

const FiltersSection = ({ 
  projectsData,
  filteredProjects,
  selectedYear,
  setSelectedYear,
  selectedMonth,
  setSelectedMonth,
  selectedClient,
  setSelectedClient,
  selectedKPIStatus,
  setSelectedKPIStatus,
  resetFilters
}) => (
  <Filters
    selectedYear={selectedYear}
    setSelectedYear={setSelectedYear}
    selectedMonth={selectedMonth}
    setSelectedMonth={setSelectedMonth}
    selectedClient={selectedClient}
    setSelectedClient={setSelectedClient}
    selectedKPIStatus={selectedKPIStatus}
    setSelectedKPIStatus={setSelectedKPIStatus}
    resetFilters={resetFilters}
    filteredProjects={filteredProjects}
    getUniqueYears={() => getUniqueYears(projectsData)}
    getUniqueClients={() => getUniqueClients(projectsData)}
  />
)

// ✅ UPDATED: ChartsSection now receives filteredProjects
const ChartsSection = ({ chartData, filteredProjects }) => (
  <Charts
    kpiStatusData={chartData.kpiStatus}
    auditStatusData={chartData.auditStatus}
    carsObsData={chartData.carsObs}
    timelineData={chartData.timeline}
    qualityPlanStatusData={chartData.qualityPlanStatus}
    getKPIBadgeVariant={getKPIBadgeVariant}
    filteredProjects={filteredProjects} // <-- Pass filteredProjects here
  />
)

export default SummaryView