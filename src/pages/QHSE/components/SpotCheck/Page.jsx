/**
 * Enhanced Spot Check Page
 * Comprehensive spot check monitoring, analytics, and compliance tracking
 */

import React, { useState, useMemo } from 'react';
import { PageLayout } from '@/layouts/PageLayout';
import { MainHeader } from "../Common/MainHeader";
import { Card, CardContent } from '../ui/Card';
import { LoadingState } from "../Common/LoadingState";
import { ErrorState } from "../Common/ErrorState";
import { EmptyDataState } from "../Common/EmptyDataState";
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  Award,
  FileText,
  Users,
  CheckCircle
} from 'lucide-react';
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
  ResponsiveContainer
} from 'recharts';

// Hooks and utilities
import { useQHSESpotCheckRegister } from '../../hooks/useQHSESpotCheck';
import {
  calculateSpotCheckMetrics,
  generateMonthlyTrend,
  generateRiskAssessment,
  generateComplianceComparison
} from '../../utils/spotCheckMetrics';

// Components
import {
  SpotCheckMetricCard,
  ComplianceScoreDisplay,
  CategoryScoreCard,
  StatusBadge,
  RiskFactorCard,
  ComplianceStandardRow,
  EngineerPerformanceCard,
  ClientActivityCard,
  IssueSummaryCard,
  SpotCheckEmptyState,
  PassRateIndicator
} from './SpotCheckComponents';

import SpotCheckSummaryCards from './SpotCheckSummaryCards';

const SpotCheckPage = () => {
  const [activeView, setActiveView] = useState('overview');
  const { data: spotCheckData, loading, error, lastUpdated, refetch } = useQHSESpotCheckRegister();

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!spotCheckData || spotCheckData.length === 0) return null;
    return calculateSpotCheckMetrics(spotCheckData);
  }, [spotCheckData]);

  const monthlyTrend = useMemo(() => 
    spotCheckData && spotCheckData.length > 0 ? generateMonthlyTrend(spotCheckData) : [],
    [spotCheckData]
  );

  const riskAssessment = useMemo(() => 
    metrics ? generateRiskAssessment(metrics) : [],
    [metrics]
  );

  const complianceComparison = useMemo(() => 
    metrics ? generateComplianceComparison(metrics) : [],
    [metrics]
  );

  // Loading state
  if (loading) {
    return (
      <PageLayout>
        <MainHeader title="Spot Check Register" subtitle="Overview of all spot checks" />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <FileText className="w-12 h-12 text-blue-500 animate-pulse mx-auto mb-4" />
            <p className="text-gray-600">Loading spot check data...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <PageLayout>
        <MainHeader title="Spot Check Register" subtitle="Error loading spot check data" />
        <ErrorState error={error} onRetry={refetch} />
      </PageLayout>
    );
  }

  // Empty state
  if (!spotCheckData || spotCheckData.length === 0 || !metrics) {
    return (
      <PageLayout>
        <MainHeader title="Spot Check Register" subtitle="No spot check data available" />
        <SpotCheckEmptyState message="Start by adding spot check records to track compliance and performance" />
      </PageLayout>
    );
  }

  // View navigation tabs
  const views = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'performance', label: 'Performance & Trends', icon: TrendingUp },
    { id: 'compliance', label: 'Compliance', icon: Award },
    { id: 'details', label: 'Detailed Analysis', icon: FileText }
  ];

  return (
    <PageLayout>
      <MainHeader
        title="Spot Check Register"
        subtitle={`Monitoring ${metrics.totalSpotChecks} spot checks across ${metrics.totalClients} clients`}
        lastUpdated={lastUpdated}
      />

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
            <SpotCheckMetricCard
              title="Total Spot Checks"
              value={metrics.totalSpotChecks}
              icon={FileText}
              color="blue"
              subtext={`${metrics.checksPerMonth.toFixed(1)} checks per month`}
            />
            <SpotCheckMetricCard
              title="Compliance Score"
              value={metrics.overallComplianceScore}
              unit="/100"
              trend={metrics.complianceTrend}
              icon={Award}
              color="green"
              subtext={`${metrics.passRate.toFixed(1)}% pass rate`}
            />
            <SpotCheckMetricCard
              title="Completed Checks"
              value={metrics.completedChecks}
              icon={CheckCircle}
              color="green"
              subtext={`${metrics.pendingChecks} pending, ${metrics.overdueChecks} overdue`}
            />
            <SpotCheckMetricCard
              title="Active Issues"
              value={metrics.totalIssues - metrics.resolvedIssues}
              icon={AlertTriangle}
              color="red"
              subtext={`${metrics.criticalIssues} critical, ${metrics.resolvedIssues} resolved`}
            />
          </div>

          {/* Compliance Score and Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Overall Compliance</h3>
                <div className="flex justify-center py-4">
                  <ComplianceScoreDisplay 
                    score={metrics.overallComplianceScore} 
                    size="large"
                  />
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Safety Score</span>
                    <span className="font-semibold">{metrics.safetyScore.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Quality Score</span>
                    <span className="font-semibold">{metrics.qualityScore.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Resolution Rate</span>
                    <span className="font-semibold">{metrics.issueResolutionRate}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Status Distribution</h3>
                <div className="grid grid-cols-2 gap-3">
                  {metrics.statusBreakdown.map((status, index) => (
                    <div 
                      key={index}
                      className="p-3 rounded-lg"
                      style={{ backgroundColor: `${status.color}20` }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium text-gray-900">{status.status}</span>
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white">
                          {status.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-2xl font-bold" style={{ color: status.color }}>
                        {status.count}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Category Performance */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Performance by Category</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {metrics.categoryBreakdown.map(category => (
                  <CategoryScoreCard
                    key={category.key}
                    category={category.category}
                    score={category.averageScore}
                    count={category.count}
                    icon={category.icon}
                    color={category.color}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Risk Assessment */}
          {riskAssessment.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Risk Assessment</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {riskAssessment.map((risk, index) => (
                    <RiskFactorCard key={index} risk={risk} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Original Summary Cards */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Detailed Register</h3>
              <SpotCheckSummaryCards spotCheckData={spotCheckData} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Performance & Trends View */}
      {activeView === 'performance' && (
        <div className="space-y-6">
          {/* Monthly Trend */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Monthly Trend (Last 12 Months)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="totalChecks" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    name="Total Checks"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="passedChecks" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    name="Passed"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="failedChecks" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    name="Failed"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Compliance Rate Trend */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Compliance Rate Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="complianceRate" fill="#10b981" name="Compliance Rate (%)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Performers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Top Engineers</h3>
                <div className="space-y-3">
                  {Object.entries(metrics.engineerCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([name, count], index) => (
                      <EngineerPerformanceCard
                        key={name}
                        name={name}
                        count={count}
                        rank={index + 1}
                      />
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Top Clients</h3>
                <div className="space-y-3">
                  {Object.entries(metrics.clientCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([name, count]) => (
                      <ClientActivityCard
                        key={name}
                        name={name}
                        count={count}
                      />
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Category Distribution */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Category Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={metrics.categoryBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({category, percentage}) => `${category} ${percentage.toFixed(1)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {metrics.categoryBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Compliance View */}
      {activeView === 'compliance' && (
        <div className="space-y-6">
          {/* Compliance Standards */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Compliance with Standards</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {complianceComparison.map((standard, index) => (
                  <ComplianceStandardRow key={index} standard={standard} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pass Rate and Issues */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PassRateIndicator 
              passRate={metrics.passRate} 
              total={metrics.totalSpotChecks} 
            />
            
            <IssueSummaryCard
              total={metrics.totalIssues}
              critical={metrics.criticalIssues}
              resolved={metrics.resolvedIssues}
            />
          </div>

          {/* Category Scores */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Category Compliance Scores</h3>
              <div className="space-y-4">
                {Object.entries(metrics.categoryScores).map(([key, score]) => (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 capitalize">{key.replace('_', ' ')}</span>
                      <span className="font-semibold">{score}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          score >= 90 ? 'bg-green-500' : score >= 75 ? 'bg-blue-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Analysis View */}
      {activeView === 'details' && (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Detailed Spot Check Register</h3>
              <SpotCheckSummaryCards spotCheckData={spotCheckData} />
            </CardContent>
          </Card>
        </div>
      )}
    </PageLayout>
  );
};

export default SpotCheckPage;