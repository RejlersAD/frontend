import React from 'react';
import { Card, CardContent } from '../ui/Card';
import { ManhoursChart } from './ChartComponents/ManhoursChart';
import { AuditStatusChart } from './ChartComponents/AuditStatusChart';
import { KPIStatusChart } from './ChartComponents/KPIStatusChart';
import { CarsObsChart } from './ChartComponents/CarsObsChart';
import { TimelineChart } from './ChartComponents/TimelineChart';
import { QualityPlanChart } from './ChartComponents/QualityPlanChart';
import { BarChart3 } from 'lucide-react';
import GrowthChart from './ChartComponents/GrowthChart';
import { generateGrowthChartData } from '../../utils/chartUtils';

/**
 * MAIN CHARTS COMPONENT - PARENT ORCHESTRATOR
 * 
 * This component manages the layout and coordination of all individual chart components
 * Each chart is imported from its own separate file for better maintainability
 */
const Charts = ({
  kpiStatusData,
  manhoursData,
  auditStatusData,
  carsObsData,
  timelineData,
  qualityPlanStatusData,
  getKPIBadgeVariant,
  filteredProjects // <-- Add this prop if needed
}) => {
  
  // Debug logging
  console.log('📊 Charts Component - Received Data:', {
    kpiStatusData: kpiStatusData?.length || 0,
    auditStatusData: auditStatusData?.length || 0,
    carsObsData: carsObsData?.length || 0,
    timelineData: timelineData?.length || 0,
    qualityPlanStatusData: qualityPlanStatusData?.length || 0,
    filteredProjectsCount: filteredProjects?.length || 0
  });
  
  // Chart configuration with individual components
  const chartConfigs = [
    {
      id: 'growth',
      component:
          <GrowthChart data={generateGrowthChartData(filteredProjects)} />,
      fullWidth: true
    },
    {
      id: 'cars-obs',
      component: <CarsObsChart data={carsObsData} />,
      fullWidth: true
    },
    {
      id: 'audit-status',
      component: <AuditStatusChart data={auditStatusData} />,
      fullWidth: false
    },
    {
      id: 'kpi-status',
      component: <KPIStatusChart data={kpiStatusData} />,
      fullWidth: false
    },
    
    {
      id: 'timeline',
      component: <TimelineChart data={timelineData} getKPIBadgeVariant={getKPIBadgeVariant} />,
      fullWidth: false
    },
    {
      id: 'quality-plan',
      component: <QualityPlanChart data={qualityPlanStatusData} />,
      fullWidth: false
    }
  ];

  return (
    <div className="space-y-6">
      {/* ✅ SIMPLE: Clean main heading */}
      <div className="mb-6">
      <h3 className=" uppercase text-sm font-semibold text-blue-600 dark:text-blue-400 mb-3 flex items-center">
           <BarChart3 className="w-5 h-5 mr-2" />
           Analytics & Performance Charts
          </h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Visual insights from project performance data
        </p>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {chartConfigs.map((chart) => (
          <div
            key={chart.id}
            className={chart.fullWidth ? "md:col-span-2" : ""}
          >
            <Card className="h-full min-h-[400px] flex flex-col hover:shadow-lg transition-all duration-300 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <CardContent className="p-6 flex flex-col h-full bg-white dark:bg-slate-900">
                {chart.component}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* No Data State */}
      {chartConfigs.length === 0 && (
        <Card className="shadow-sm dark:bg-gray-900 dark:border-gray-800">
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center text-gray-500 dark:text-gray-400">
              <div className="w-16 h-16 mb-4 opacity-50">📊</div>
              <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100">
                No chart data available
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Charts will appear when data is available in Google Sheets
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Charts;