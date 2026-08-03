import React, { useState } from 'react'
import { useQHSERunningProjects } from '../../hooks/useQHSEProjects';
import { BarChart3, Eye } from 'lucide-react'

// Import reusable components
import { MainHeader } from "../Common/MainHeader"
import { LoadingState } from "../Common/LoadingState"
import { ErrorState } from "../Common/ErrorState"
import { EmptyDataState } from "../Common/EmptyDataState"
import { PageLayout } from '@/layouts/PageLayout'
import { Card, CardContent } from '../ui/Card'
import { ManhoursChart } from '../charts/ChartComponents/ManhoursChart'
import BillabilityCard from './BillabilityCard'
// import Filters from '../SummayView/Filters' // ✅ Commented out for future use

import {
  getUniqueYears,
  getUniqueClients,
  createProjectFilters,
  generateManhoursData
} from '../../utils'

const BillabilityPage = () => {
  const { data: projectsData, loading, error, lastUpdated, refetch, isRefreshing, dataLastChanged } = useQHSERunningProjects();

  // ✅ FUTURE: Filter states (commented for now)
  // const [selectedYear, setSelectedYear] = useState("all")
  // const [selectedMonth, setSelectedMonth] = useState("all")
  // const [selectedClient, setSelectedClient] = useState("all")
  // const [selectedKPIStatus, setSelectedKPIStatus] = useState("all")

  // ✅ SIMPLIFIED: Use all projects for now (no filtering)
  const filteredProjects = projectsData || [];

  // Generate manhours data using utility function
  const manhoursData = generateManhoursData(filteredProjects);

  // Loading state
  if (loading) {
    return (
      <PageLayout>
        <MainHeader />
        <LoadingState message="Loading Google Sheets data..." />
      </PageLayout>
    )
  }

  // Error state
  if (error) {
    return (
      <PageLayout>
        <MainHeader 
          title="Billability Overview"
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
        <MainHeader />
        <EmptyDataState />
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <MainHeader 
        title="Billability Overview"
        subtitle="Manhours utilization analysis across all projects"
        lastUpdated={lastUpdated}
        dataLastChanged={dataLastChanged}
        isRefreshing={isRefreshing}
      >
        <div className="text-xs text-green-600 dark:text-green-400">
          • Live data ({projectsData.length} projects)
        </div>
      </MainHeader>
      
      <BillabilityContent 
        manhoursData={manhoursData}
        filteredProjects={filteredProjects}
      />
    </PageLayout>
  )
}

const BillabilityContent = ({ 
  manhoursData,
  filteredProjects
}) => {
  
  // Handle empty state
  if (filteredProjects.length === 0) {
    return (
      <EmptyDataState 
        title="No projects found"
        message="No project data available for manhours analysis."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-3 flex items-center">
          <Eye className="w-5 h-5 mr-2" />
          BILLABILITY OVERVIEW
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <BillabilityCard filteredProjects={filteredProjects} />
        </div>
      </div>

      {/* ✅ FUTURE: Filters Section (commented for now) */}
      {/* <FiltersSection ... /> */}

      {/* Manhours Chart Section - Main Content */}
      <ManhoursChartSection manhoursData={manhoursData} />
    </div>
  )
}

const ManhoursChartSection = ({ manhoursData }) => (
  <div>
    <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-3 flex items-center">
      <BarChart3 className="w-5 h-5 mr-2" />
      MANHOURS ANALYSIS
    </h3>
    <Card className="border border-gray-200 dark:border-slate-700">
      <CardContent className="p-6">
        <div className="min-h-[600px]">
          <ManhoursChart data={manhoursData} />
        </div>
      </CardContent>
    </Card>
  </div>
);

export default BillabilityPage;