/**
 * Energy Management Page
 * Comprehensive energy monitoring, optimization, and sustainability
 */

import React, { useState, useMemo, useCallback } from 'react';
import { PageLayout } from '@/layouts/PageLayout';
import { MainHeader } from './components/Common/MainHeader';
import { withDashboardControls } from '@/hoc/withPageControls';
import { PageControlButtons } from '@/components/PageControlButtons';
import { Card, CardContent } from './components/ui/Card';
import { 
  Zap, 
  TrendingUp, 
  Battery, 
  DollarSign, 
  Leaf, 
  Sun,
  BarChart3,
  Target,
  Award,
  AlertTriangle
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

// Hooks and utilities
import { useQHSERunningProjects } from './hooks/useQHSEProjects';
import {
  calculateEnergyMetrics,
  generateConsumptionBreakdown,
  generateEnergySourceDistribution,
  generateEfficiencyInitiatives,
  generateSmartTechnologies,
  generateConsumptionTrend,
  generateCostOptimization,
  generateCarbonReductionRoadmap
} from './utils/energyMetrics';

// Components
import {
  EnergyMetricCard,
  EnergyScoreDisplay,
  EnergySourceBadge,
  EfficiencyInitiativeCard,
  SmartTechnologyCard,
  CostOptimizationCard,
  CarbonReductionMilestone,
  RenewableEnergyProgress,
  EnergyEmptyState,
  PeakDemandIndicator
} from './components/Energy/EnergyComponents';

// SectionCard wrapper component
const SectionCard = ({ title, children, className = "" }) => (
  <Card className={className}>
    <CardContent className="p-6">
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      {children}
    </CardContent>
  </Card>
);

const Energy = ({ pageControls }) => {
  const [activeView, setActiveView] = useState('overview');
  const { data: projectsData, loading, error } = useQHSERunningProjects();

  // Calculate all energy metrics
  const energyData = useMemo(() => {
    if (!projectsData || projectsData.length === 0) return null;
    return calculateEnergyMetrics(projectsData);
  }, [projectsData]);

  // Generate view-specific data
  const consumptionBreakdown = useMemo(() => 
    energyData ? generateConsumptionBreakdown(energyData.totalEnergyConsumption) : [],
    [energyData]
  );

  const energySources = useMemo(() => 
    energyData ? generateEnergySourceDistribution(projectsData, energyData) : [],
    [projectsData, energyData]
  );

  const efficiencyInitiatives = useMemo(() => 
    energyData ? generateEfficiencyInitiatives(energyData) : [],
    [energyData]
  );

  const smartTechnologies = useMemo(() => 
    generateSmartTechnologies(),
    []
  );

  const consumptionTrend = useMemo(() => 
    energyData ? generateConsumptionTrend(projectsData, energyData) : [],
    [projectsData, energyData]
  );

  const costOptimization = useMemo(() => 
    energyData ? generateCostOptimization(energyData) : [],
    [energyData]
  );

  const carbonRoadmap = useMemo(() => 
    energyData ? generateCarbonReductionRoadmap(energyData) : [],
    [energyData]
  );

  // Loading state
  if (loading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Zap className="w-12 h-12 text-blue-500 animate-pulse mx-auto mb-4" />
            <p className="text-gray-600">Loading energy data...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <PageLayout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800">Error loading energy data: {error}</p>
        </div>
      </PageLayout>
    );
  }

  // Check if energy data is unavailable (not in uploaded projects)
  if (energyData && energyData.dataAvailable === false) {
    return (
      <PageLayout>
        <MainHeader 
          title="Energy Management"
          subtitle="Comprehensive energy monitoring, optimization, and sustainability"
        >
          <PageControlButtons {...pageControls} />
        </MainHeader>

        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl border-2 border-amber-200 p-8 shadow-sm">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0 p-4 bg-amber-100 rounded-full">
              <Zap className="text-amber-600" size={32} />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                Energy Data Not Available
              </h3>
              <p className="text-gray-700 text-lg mb-4">
                {energyData.detailedMessage || energyData.message}
              </p>
              
              <div className="bg-white rounded-lg p-5 border border-gray-200 mb-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Target className="text-green-600" size={20} />
                  Available Project Data
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-gray-700">
                      <strong>{energyData.totalProjects}</strong> Total Projects
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-gray-700">
                      <strong>{energyData.activeProjects}</strong> Active Projects
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-gray-700">Quality & KPI Metrics</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-gray-700">Audit & Compliance Data</span>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 rounded-lg p-5 border border-amber-200">
                <h4 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
                  <AlertTriangle className="text-amber-600" size={20} />
                  Missing Energy Data
                </h4>
                <ul className="space-y-2 text-sm text-amber-900">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>Energy consumption measurements</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>Energy source breakdown</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>Renewable energy usage data</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>Energy efficiency metrics</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>Cost per kWh tracking</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>Smart meter readings</span>
                  </li>
                </ul>
              </div>

              <div className="mt-5 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900">
                  <strong>Note:</strong> To track energy metrics, please add energy consumption, source distribution, 
                  and cost data fields to your QHSE project records, or use a dedicated energy management module.
                </p>
              </div>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  // No data state
  if (!energyData || !projectsData || projectsData.length === 0) {
    return (
      <PageLayout>
        <MainHeader 
          title="Energy Management" 
          subtitle="No projects available for energy analysis"
        />
        <EnergyEmptyState message="Start by adding projects to track energy consumption and efficiency" />
      </PageLayout>
    );
  }

  // View navigation tabs
  const views = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'consumption', label: 'Consumption & Efficiency', icon: Zap },
    { id: 'renewable', label: 'Renewable Energy', icon: Sun },
    { id: 'optimization', label: 'Optimization & Savings', icon: Target }
  ];

  return (
    <PageLayout>
      <MainHeader 
        title="Energy Management" 
        subtitle={`Monitoring energy across ${energyData.totalProjects} projects`}
      >
        <PageControlButtons {...pageControls} />
      </MainHeader>

      {/* View Navigation */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {views.map(view => {
            const Icon = view.icon;
            return (
              <button
                key={view.id}
                onClick={() => setActiveView(view.id)}
                className={`
                  flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeView === view.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span>{view.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Overview View */}
      {activeView === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <EnergyMetricCard
              title="Total Energy Consumption"
              value={energyData.totalEnergyConsumption}
              unit="kWh"
              change={energyData.consumptionTrend}
              icon={Zap}
              color="blue"
              subtext={`${energyData.energyPerProject.toLocaleString()} kWh per project`}
            />
            <EnergyMetricCard
              title="Renewable Energy"
              value={energyData.renewablePercentage}
              unit="%"
              change={5}
              icon={Leaf}
              color="green"
              subtext={`${energyData.totalRenewableEnergy.toLocaleString()} kWh renewable`}
            />
            <EnergyMetricCard
              title="Total Energy Cost"
              value={energyData.totalEnergyCost}
              unit="$"
              change={-3}
              icon={DollarSign}
              color="yellow"
              subtext={`$${energyData.avgCostPerKwh} per kWh`}
            />
            <EnergyMetricCard
              title="Efficiency Score"
              value={energyData.efficiencyScore}
              unit="/100"
              change={8}
              icon={Award}
              color="purple"
              subtext={`${energyData.efficientProjects} efficient projects`}
            />
          </div>

          {/* Energy Score and Project Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SectionCard title="Energy Performance Score">
              <div className="flex justify-center py-4">
                <EnergyScoreDisplay 
                  score={energyData.overallEnergyScore} 
                  size="large"
                  label="Overall Energy Score"
                />
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Active Projects</span>
                  <span className="font-semibold">{energyData.activeProjects}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">High Consumers</span>
                  <span className="font-semibold text-red-600">{energyData.highConsumers}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Efficient Projects</span>
                  <span className="font-semibold text-green-600">{energyData.efficientProjects}</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Smart Building Technologies" className="lg:col-span-2">
              <div className="grid grid-cols-2 gap-4">
                {smartTechnologies.slice(0, 4).map(tech => (
                  <SmartTechnologyCard key={tech.key} technology={tech} />
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Technology Adoption</span>
                  <span className="text-2xl font-bold text-blue-600">{energyData.smartTechAdoption}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${energyData.smartTechAdoption}%` }}
                  />
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Consumption Trend */}
          <SectionCard title="Energy Consumption Trend (12 Months)">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={consumptionTrend}>
                <defs>
                  <linearGradient id="colorConsumption" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="colorRenewable" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="consumption" 
                  stroke="#3b82f6" 
                  fillOpacity={1} 
                  fill="url(#colorConsumption)"
                  name="Total Consumption (kWh)"
                />
                <Area 
                  type="monotone" 
                  dataKey="renewable" 
                  stroke="#10b981" 
                  fillOpacity={1} 
                  fill="url(#colorRenewable)"
                  name="Renewable Energy (kWh)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </SectionCard>

          {/* Consumption Breakdown */}
          <SectionCard title="Energy Consumption by Category">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={consumptionBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({name, percentage}) => `${name} ${percentage}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {consumptionBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>

              <div className="space-y-3">
                {consumptionBreakdown.map(category => (
                  <div key={category.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="font-medium text-gray-900">{category.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{category.value.toLocaleString()} kWh</p>
                      <p className="text-sm text-gray-600">{category.percentage}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Consumption & Efficiency View */}
      {activeView === 'consumption' && (
        <div className="space-y-6">
          {/* Efficiency Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SectionCard title="Efficiency Score">
              <div className="flex justify-center py-4">
                <EnergyScoreDisplay 
                  score={energyData.efficiencyScore} 
                  size="large"
                  label="Efficiency Score"
                />
              </div>
            </SectionCard>

            <SectionCard title="Peak Demand">
              <PeakDemandIndicator
                current={energyData.peakDemand * 0.8}
                peak={energyData.peakDemand}
                threshold={energyData.peakDemand * 0.9}
              />
            </SectionCard>

            <SectionCard title="Automation Level">
              <div className="flex flex-col items-center justify-center py-4">
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  {energyData.automationLevel}%
                </div>
                <p className="text-sm text-gray-600 text-center">Building Automation Coverage</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${energyData.automationLevel}%` }}
                  />
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Efficiency Initiatives */}
          <SectionCard title="Energy Efficiency Initiatives">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {efficiencyInitiatives.map(initiative => (
                <EfficiencyInitiativeCard 
                  key={initiative.key} 
                  initiative={initiative}
                />
              ))}
            </div>
          </SectionCard>

          {/* Monthly Efficiency Trend */}
          <SectionCard title="Monthly Efficiency Trend">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={consumptionTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="efficiency" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  name="Efficiency Score"
                />
              </LineChart>
            </ResponsiveContainer>
          </SectionCard>

          {/* Consumption by Category Detail */}
          <SectionCard title="Detailed Consumption Analysis">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={consumptionBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#3b82f6" name="Energy Consumption (kWh)">
                  {consumptionBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        </div>
      )}

      {/* Renewable Energy View */}
      {activeView === 'renewable' && (
        <div className="space-y-6">
          {/* Renewable Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <EnergyMetricCard
              title="Renewable Energy"
              value={energyData.totalRenewableEnergy}
              unit="kWh"
              icon={Leaf}
              color="green"
            />
            <EnergyMetricCard
              title="Renewable Percentage"
              value={energyData.renewablePercentage}
              unit="%"
              icon={Sun}
              color="yellow"
            />
            <EnergyMetricCard
              title="Carbon Avoided"
              value={energyData.carbonAvoided}
              unit="tons CO2e"
              icon={Leaf}
              color="green"
            />
            <EnergyMetricCard
              title="Carbon Reduction"
              value={energyData.carbonReduction}
              unit="%"
              icon={TrendingUp}
              color="blue"
            />
          </div>

          {/* Energy Sources Distribution */}
          <SectionCard title="Energy Sources Breakdown">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {energySources.map(source => (
                <EnergySourceBadge
                  key={source.key}
                  source={source.name}
                  value={source.value}
                  percentage={source.percentage}
                  color={source.color}
                  icon={source.icon}
                  isRenewable={source.isRenewable}
                />
              ))}
            </div>
          </SectionCard>

          {/* Energy Mix Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title="Current Energy Mix">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={energySources}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({name, percentage}) => `${name} ${percentage}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {energySources.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </SectionCard>

            <SectionCard title="Renewable Energy Progress">
              <div className="space-y-4">
                <RenewableEnergyProgress
                  current={energyData.renewablePercentage}
                  target={60}
                  label="Target: 60% Renewable by 2026"
                />
                <RenewableEnergyProgress
                  current={energyData.carbonReduction}
                  target={80}
                  label="Target: 80% Carbon Reduction by 2028"
                />
                <RenewableEnergyProgress
                  current={energyData.smartTechAdoption}
                  target={100}
                  label="Target: 100% Smart Tech Adoption"
                />
              </div>
            </SectionCard>
          </div>

          {/* Carbon Reduction Roadmap */}
          <SectionCard title="Carbon Reduction Roadmap">
            <div className="max-w-4xl mx-auto">
              {carbonRoadmap.map((milestone, index) => (
                <CarbonReductionMilestone
                  key={milestone.year}
                  milestone={milestone}
                  isLast={index === carbonRoadmap.length - 1}
                />
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* Optimization & Savings View */}
      {activeView === 'optimization' && (
        <div className="space-y-6">
          {/* Cost Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <EnergyMetricCard
              title="Total Energy Cost"
              value={energyData.totalEnergyCost}
              unit="$"
              icon={DollarSign}
              color="yellow"
            />
            <EnergyMetricCard
              title="Cost per Project"
              value={energyData.costPerProject}
              unit="$"
              icon={BarChart3}
              color="blue"
            />
            <EnergyMetricCard
              title="Potential Savings"
              value={energyData.potentialSavings}
              unit="$"
              icon={TrendingUp}
              color="green"
            />
            <EnergyMetricCard
              title="Savings Achieved"
              value={energyData.totalSavingsAchieved}
              unit="$"
              icon={Award}
              color="purple"
            />
          </div>

          {/* Cost Optimization Opportunities */}
          <SectionCard title="Cost Optimization Opportunities">
            <div className="space-y-4">
              {costOptimization.map((opportunity, index) => (
                <CostOptimizationCard
                  key={index}
                  opportunity={opportunity}
                  rank={index + 1}
                />
              ))}
            </div>
          </SectionCard>

          {/* Monthly Cost Trend */}
          <SectionCard title="Monthly Energy Costs">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={consumptionTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="cost" fill="#f59e0b" name="Energy Cost ($)" />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          {/* Implemented Initiatives Impact */}
          <SectionCard title="Implemented Efficiency Initiatives">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {efficiencyInitiatives
                .filter(init => init.status === 'implemented')
                .map(initiative => (
                  <EfficiencyInitiativeCard 
                    key={initiative.key} 
                    initiative={initiative}
                  />
                ))}
            </div>
            {efficiencyInitiatives.filter(init => init.status === 'implemented').length === 0 && (
              <EnergyEmptyState message="No initiatives implemented yet" />
            )}
          </SectionCard>

          {/* ROI Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title="Implementation Status">
              <div className="space-y-3">
                {['implemented', 'in_progress', 'planned'].map(status => {
                  const count = efficiencyInitiatives.filter(i => i.status === status).length;
                  const percentage = (count / efficiencyInitiatives.length) * 100;
                  const config = {
                    implemented: { label: 'Implemented', color: 'green' },
                    in_progress: { label: 'In Progress', color: 'blue' },
                    planned: { label: 'Planned', color: 'gray' }
                  };
                  return (
                    <div key={status}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700">{config[status].label}</span>
                        <span className="font-semibold">{count} initiatives ({percentage.toFixed(0)}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`bg-${config[status].color}-500 h-2 rounded-full transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title="Total Potential Impact">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Annual Cost Savings</p>
                  <p className="text-3xl font-bold text-green-600">
                    ${efficiencyInitiatives.reduce((sum, i) => sum + i.annualSavings, 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-2">Total Investment Required</p>
                  <p className="text-3xl font-bold text-gray-900">
                    ${efficiencyInitiatives.reduce((sum, i) => sum + i.implementationCost, 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-2">Average Payback Period</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {Math.round(efficiencyInitiatives.reduce((sum, i) => sum + i.paybackMonths, 0) / efficiencyInitiatives.length)} months
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      )}
    </PageLayout>
  );
};

export default withDashboardControls(Energy, {
  autoRefreshInterval: 30000,
  storageKey: 'qhseEnergyPageControls'
});
