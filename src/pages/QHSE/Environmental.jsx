import React, { useState, useMemo, useCallback } from 'react';
import { PageLayout } from '@/layouts/PageLayout';
import { MainHeader } from './components/Common/MainHeader';
import { withDashboardControls } from '@/hoc/withPageControls';
import { PageControlButtons } from '@/components/PageControlButtons';
import { Card, CardContent } from './components/ui/Card';
import { Leaf, Droplets, Zap, Trash2, Wind, TreePine, Globe, TrendingDown, Award, AlertTriangle, Target, Activity } from 'lucide-react';
import { useQHSERunningProjects } from './hooks/useQHSEProjects';
import { 
  calculateEnvironmentalMetrics,
  generateCarbonTrend,
  generateWasteBreakdown,
  getHighImpactProjects,
  generateSustainabilityProgress,
  generateComplianceMatrix,
  ENVIRONMENTAL_PERFORMANCE,
  ENVIRONMENTAL_DATA_SOURCES
} from './utils/environmentalMetrics';
import {
  EnvironmentalMetricCard,
  EnvironmentalScoreDisplay,
  HighImpactProjectCard,
  SustainabilityGoalCard,
  ComplianceStandardRow,
  WasteCategoryCard,
  ResourceBadge,
  EnvironmentalEmptyState,
  CarbonFootprintIndicator
} from './components/Environmental/EnvironmentalComponents';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';

const Environmental = ({ pageControls }) => {
  const [activeView, setActiveView] = useState('overview');
  const { data: projectsData, loading, error } = useQHSERunningProjects();

  const projects = projectsData || [];

  // Calculate comprehensive environmental metrics
  const environmentalData = useMemo(() => {
    if (!projects.length) return null;
    return calculateEnvironmentalMetrics(projects);
  }, [projects]);

  const carbonTrend = useMemo(() => {
    if (!projects.length) return [];
    return generateCarbonTrend(projects);
  }, [projects]);

  const wasteBreakdown = useMemo(() => {
    if (!projects.length) return [];
    return generateWasteBreakdown(projects);
  }, [projects]);

  const highImpactProjects = useMemo(() => {
    if (!projects.length) return [];
    return getHighImpactProjects(projects);
  }, [projects]);

  const sustainabilityProgress = useMemo(() => {
    if (!projects.length || !environmentalData) return [];
    return generateSustainabilityProgress(projects, environmentalData);
  }, [projects, environmentalData]);

  const complianceMatrix = useMemo(() => {
    if (!projects.length || !environmentalData) return [];
    return generateComplianceMatrix(projects, environmentalData);
  }, [projects, environmentalData]);

  if (loading) {
    return (
      <PageLayout>
        <MainHeader 
          title="Environmental Management"
          subtitle="Carbon emissions monitoring, waste management, and sustainability initiatives"
        />
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading environmental data...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error || !environmentalData) {
    return (
      <PageLayout>
        <MainHeader 
          title="Environmental Management"
          subtitle="Carbon emissions monitoring, waste management, and sustainability initiatives"
        />
        <EnvironmentalEmptyState message="Unable to load environmental data. Please try again later." />
      </PageLayout>
    );
  }

  // Check if environmental data is unavailable (not in uploaded projects)
  if (environmentalData.dataAvailable === false) {
    return (
      <PageLayout>
        <MainHeader 
          title="Environmental Management"
          subtitle="Carbon emissions monitoring, waste management, and sustainability initiatives"
        >
          <PageControlButtons {...pageControls} />
        </MainHeader>

        <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-xl border-2 border-blue-200 p-8 shadow-sm">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0 p-4 bg-blue-100 rounded-full">
              <Leaf className="text-blue-600" size={32} />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                Environmental Data Not Available
              </h3>
              <p className="text-gray-700 text-lg mb-4">
                {environmentalData.detailedMessage || environmentalData.message}
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
                      <strong>{environmentalData.activeProjects}</strong> Total Projects
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-gray-700">
                      <strong>{environmentalData.compliantProjects}</strong> Compliant Projects
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
                  Missing Environmental Data
                </h4>
                <ul className="space-y-2 text-sm text-amber-900">
                  {environmentalData.dataNotInProjects ? (
                    ENVIRONMENTAL_DATA_SOURCES.dataNotInProjects.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-500 mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))
                  ) : (
                    <>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-500">•</span>
                        <span>Carbon emissions measurements</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-500">•</span>
                        <span>Waste generation records</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-500">•</span>
                        <span>Water consumption data</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-amber-500">•</span>
                        <span>Energy usage tracking</span>
                      </li>
                    </>
                  )}
                </ul>
              </div>

              <div className="mt-5 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900">
                  <strong>Note:</strong> To track environmental metrics, please add carbon emissions, waste, water, 
                  and energy data fields to your QHSE project records, or use a dedicated environmental management module.
                </p>
              </div>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <MainHeader 
        title="Environmental Management"
        subtitle="Carbon emissions monitoring, waste management, and sustainability initiatives"
      >
        <PageControlButtons {...pageControls} />
      </MainHeader>

      {/* View Tabs */}
      <div className="bg-white rounded-lg shadow-sm p-2 mb-6 border border-gray-200">
        <div className="flex gap-2 overflow-x-auto">
          <ViewTab
            icon={Activity}
            label="Overview"
            active={activeView === 'overview'}
            onClick={() => setActiveView('overview')}
            description="Environmental summary"
          />
          <ViewTab
            icon={Wind}
            label="Carbon & Emissions"
            active={activeView === 'carbon'}
            onClick={() => setActiveView('carbon')}
            description="Track emissions"
          />
          <ViewTab
            icon={Trash2}
            label="Waste & Resources"
            active={activeView === 'waste'}
            onClick={() => setActiveView('waste')}
            description="Manage resources"
          />
          <ViewTab
            icon={Target}
            label="Sustainability"
            active={activeView === 'sustainability'}
            onClick={() => setActiveView('sustainability')}
            description="Goals & compliance"
          />
        </div>
      </div>

      {/* Overview View */}
      {activeView === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <EnvironmentalMetricCard
              title="Carbon Emissions"
              value={(environmentalData.totalCarbonEmissions / 1000).toFixed(1)}
              unit="tons CO2e"
              icon={Wind}
              color="red"
              description={`${(environmentalData.carbonPerProject / 1000).toFixed(2)}t per project`}
              badge={environmentalData.carbonIntensity.label}
            />
            <EnvironmentalMetricCard
              title="Waste Generated"
              value={(environmentalData.totalWaste / 1000).toFixed(1)}
              unit="tons"
              icon={Trash2}
              color="orange"
              description={`${environmentalData.recyclingRate.toFixed(1)}% recycling rate`}
              badge={`${environmentalData.recycledWaste.toFixed(0)}t recycled`}
            />
            <EnvironmentalMetricCard
              title="Water Usage"
              value={(environmentalData.totalWaterUsage / 1000000).toFixed(2)}
              unit="ML"
              icon={Droplets}
              color="blue"
              description={`${(environmentalData.waterPerProject / 1000).toFixed(1)}kL per project`}
            />
            <EnvironmentalMetricCard
              title="Energy Consumption"
              value={(environmentalData.totalEnergyUsage / 1000).toFixed(0)}
              unit="MWh"
              icon={Zap}
              color="purple"
              description={`${environmentalData.renewablePercentage.toFixed(1)}% renewable`}
              badge={`${(environmentalData.renewableEnergy / 1000).toFixed(0)}MWh green`}
            />
          </div>

          {/* Environmental Score & High Impact Projects */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Environmental Score</h3>
                  <Leaf className="text-green-600" size={24} />
                </div>
                <div className="flex justify-center">
                  <EnvironmentalScoreDisplay score={environmentalData.overallScore} size="lg" />
                </div>
                <div className="mt-6 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Active Projects</span>
                    <span className="font-bold text-gray-900">{environmentalData.activeProjects}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">High Impact</span>
                    <span className="font-bold text-red-600">{environmentalData.highImpactProjects}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Compliant</span>
                    <span className="font-bold text-green-600">{environmentalData.compliantProjects}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">High Impact Projects</h3>
                    <p className="text-sm text-gray-500 mt-1">Projects requiring immediate environmental attention</p>
                  </div>
                  <AlertTriangle className="text-orange-500" size={24} />
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {highImpactProjects.length === 0 ? (
                    <EnvironmentalEmptyState message="No high-impact projects found" />
                  ) : (
                    highImpactProjects.slice(0, 5).map((project, index) => (
                      <HighImpactProjectCard key={project.id} project={project} rank={index + 1} />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Carbon Trend & Waste Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Carbon Emissions Trend</h3>
                {carbonTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={carbonTrend}>
                      <defs>
                        <linearGradient id="colorCarbon" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" stroke="#6b7280" />
                      <YAxis stroke="#6b7280" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="emissions" 
                        stroke="#ef4444" 
                        fillOpacity={1} 
                        fill="url(#colorCarbon)"
                        name="Emissions (kg CO2e)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EnvironmentalEmptyState message="No carbon data available" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Waste Distribution</h3>
                {wasteBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={wasteBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percentage }) => `${name}: ${percentage}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {wasteBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EnvironmentalEmptyState message="No waste data available" />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Carbon & Emissions View */}
      {activeView === 'carbon' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <CarbonFootprintIndicator 
              emissions={environmentalData.totalCarbonEmissions}
              intensity={environmentalData.carbonPerProject}
            />
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-blue-100">
                    <Activity className="text-blue-600" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Scope 1 & 2 Emissions</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {(environmentalData.totalCarbonEmissions * 0.7 / 1000).toFixed(1)}t
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">Direct and energy indirect emissions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-orange-100">
                    <Globe className="text-orange-600" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Scope 3 Emissions</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {(environmentalData.totalCarbonEmissions * 0.3 / 1000).toFixed(1)}t
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">Other indirect emissions</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Carbon Emissions by Project Phase</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={carbonTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" label={{ value: 'kg CO2e', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Bar dataKey="emissions" fill="#ef4444" name="Carbon Emissions" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Carbon Emitters</h3>
              <div className="space-y-3">
                {highImpactProjects.slice(0, 8).map((project, index) => (
                  <div key={project.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-600 font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{project.projectTitle}</p>
                      <p className="text-xs text-gray-500">{project.projectNo}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{(project.carbonEmissions / 1000).toFixed(1)}t</p>
                      <p className="text-xs text-gray-500">CO2e</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Waste & Resources View */}
      {activeView === 'waste' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <ResourceBadge 
              resource="Water Consumption"
              value={(environmentalData.totalWaterUsage / 1000000).toFixed(2)}
              unit="ML"
              icon={Droplets}
              color="blue"
            />
            <ResourceBadge 
              resource="Energy Usage"
              value={(environmentalData.totalEnergyUsage / 1000).toFixed(0)}
              unit="MWh"
              icon={Zap}
              color="yellow"
            />
            <ResourceBadge 
              resource="Recycling Rate"
              value={environmentalData.recyclingRate.toFixed(1)}
              unit="%"
              icon={Trash2}
              color="green"
            />
            <ResourceBadge 
              resource="Renewable Energy"
              value={environmentalData.renewablePercentage.toFixed(1)}
              unit="%"
              icon={TreePine}
              color="emerald"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {wasteBreakdown.map((waste, index) => (
              <WasteCategoryCard key={index} waste={waste} />
            ))}
          </div>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Resource Consumption Trends</h3>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={carbonTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="projectCount" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    name="Active Projects"
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sustainability View */}
      {activeView === 'sustainability' && (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">UN Sustainable Development Goals</h3>
                  <p className="text-sm text-gray-500 mt-1">Tracking progress towards global sustainability targets</p>
                </div>
                <Target className="text-blue-600" size={24} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sustainabilityProgress.map((goalData, index) => (
                  <SustainabilityGoalCard key={index} goalData={goalData} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Environmental Compliance Standards</h3>
                  <p className="text-sm text-gray-500 mt-1">Compliance status across major environmental frameworks</p>
                </div>
                <Award className="text-green-600" size={24} />
              </div>
              <div className="space-y-3">
                {complianceMatrix.map((standard, index) => (
                  <ComplianceStandardRow key={index} standard={standard} />
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-green-100">
                    <Award className="text-green-600" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Compliant Projects</p>
                    <p className="text-3xl font-bold text-gray-900">{environmentalData.compliantProjects}</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(environmentalData.compliantProjects / environmentalData.activeProjects) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {((environmentalData.compliantProjects / environmentalData.activeProjects) * 100).toFixed(1)}% compliance rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-blue-100">
                    <TreePine className="text-blue-600" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Sustainability Initiatives</p>
                    <p className="text-3xl font-bold text-gray-900">{sustainabilityProgress.length}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">Active programs tracking {sustainabilityProgress.length} UN SDGs</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-orange-100">
                    <TrendingDown className="text-orange-600" size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Carbon Reduction Target</p>
                    <p className="text-3xl font-bold text-gray-900">25%</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">By 2025 compared to 2020 baseline</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </PageLayout>
  );
};

// View Tab Component
const ViewTab = ({ icon: Icon, label, active, onClick, description }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
      active 
        ? 'bg-green-600 text-white shadow-md' 
        : 'text-gray-600 hover:bg-gray-100'
    }`}
  >
    <Icon size={18} />
    <div className="text-left">
      <div className="font-semibold">{label}</div>
      <div className={`text-xs ${active ? 'text-green-100' : 'text-gray-500'}`}>
        {description}
      </div>
    </div>
  </button>
);

export default withDashboardControls(Environmental, {
  autoRefreshInterval: 30000,
  storageKey: 'qhseEnvironmentalPageControls'
});
