import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { KEY_METRICS, CHART_CONFIGS } from '../../config/reportGenerator.config';
import { REJLERS_COLORS } from '../../config/theme.config';

/**
 * ============================================
 * ADVANCED ANALYTICS COMPONENT
 * ============================================
 * 
 * Comprehensive analytics dashboard with interactive charts,
 * real-time metrics, and multi-dimensional analysis.
 */

const AdvancedAnalytics = () => {
  const [selectedMetricCategory, setSelectedMetricCategory] = useState('platform');
  const [timeRange, setTimeRange] = useState('30_days');
  const [comparisonMode, setComparisonMode] = useState(false);
  const [metricsData, setMetricsData] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadMetricsData();
  }, [selectedMetricCategory, timeRange]);

  const loadMetricsData = () => {
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      const mockData = generateMockMetricsData(selectedMetricCategory);
      setMetricsData(mockData);
      setIsLoading(false);
    }, 1000);
  };

  const generateMockMetricsData = (category) => {
    // Generate realistic mock data
    const data = {};
    
    if (category === 'platform') {
      data.totalModules = {
        current: 9,
        previous: 8,
        target: 10,
        trend: '+12.5%',
        sparkline: [6, 7, 7, 8, 8, 9, 9],
        status: 'good'
      };
      data.totalFeatures = {
        current: 52,
        previous: 48,
        target: 50,
        trend: '+8.3%',
        sparkline: [42, 44, 46, 48, 50, 51, 52],
        status: 'excellent'
      };
      data.activeUsers = {
        current: 98,
        previous: 87,
        target: 100,
        trend: '+12.6%',
        sparkline: [78, 82, 85, 87, 92, 95, 98],
        status: 'good'
      };
      data.systemUptime = {
        current: 99.8,
        previous: 99.6,
        target: 99.9,
        trend: '+0.2%',
        sparkline: [99.5, 99.6, 99.7, 99.6, 99.8, 99.8, 99.8],
        status: 'excellent'
      };
    } else if (category === 'performance') {
      data.avgResponseTime = {
        current: 185,
        previous: 210,
        target: 200,
        trend: '-11.9%',
        sparkline: [230, 220, 210, 205, 195, 190, 185],
        status: 'excellent',
        inverse: true
      };
      data.apiSuccessRate = {
        current: 99.6,
        previous: 99.2,
        target: 99.5,
        trend: '+0.4%',
        sparkline: [99.0, 99.1, 99.2, 99.3, 99.5, 99.6, 99.6],
        status: 'excellent'
      };
      data.errorRate = {
        current: 0.4,
        previous: 0.8,
        target: 0.5,
        trend: '-50.0%',
        sparkline: [1.2, 1.0, 0.8, 0.7, 0.5, 0.4, 0.4],
        status: 'excellent',
        inverse: true
      };
      data.throughput = {
        current: 1250,
        previous: 1100,
        target: 1000,
        trend: '+13.6%',
        sparkline: [900, 950, 1000, 1100, 1150, 1200, 1250],
        status: 'excellent'
      };
    } else if (category === 'usage') {
      data.dailyActiveUsers = {
        current: 56,
        previous: 48,
        target: 50,
        trend: '+16.7%',
        sparkline: [42, 44, 46, 48, 52, 54, 56],
        status: 'excellent'
      };
      data.weeklyActiveUsers = {
        current: 85,
        previous: 76,
        target: 80,
        trend: '+11.8%',
        sparkline: [68, 70, 74, 76, 80, 83, 85],
        status: 'excellent'
      };
      data.monthlyActiveUsers = {
        current: 98,
        previous: 87,
        target: 100,
        trend: '+12.6%',
        sparkline: [78, 82, 85, 87, 92, 95, 98],
        status: 'good'
      };
      data.avgSessionDuration = {
        current: 18.5,
        previous: 15.2,
        target: 15,
        trend: '+21.7%',
        sparkline: [13.5, 14.0, 14.5, 15.2, 16.8, 17.5, 18.5],
        status: 'excellent'
      };
      data.featureAdoptionRate = {
        current: 78.5,
        previous: 68.2,
        target: 75,
        trend: '+15.1%',
        sparkline: [62, 65, 68, 70, 74, 76, 78],
        status: 'excellent'
      };
    } else if (category === 'business') {
      data.roiPercentage = {
        current: 178,
        previous: 145,
        target: 150,
        trend: '+22.8%',
        sparkline: [120, 130, 135, 145, 160, 170, 178],
        status: 'excellent'
      };
      data.costSavings = {
        current: 245000,
        previous: 198000,
        target: 100000,
        trend: '+23.7%',
        sparkline: [150000, 165000, 180000, 198000, 220000, 235000, 245000],
        status: 'excellent'
      };
      data.timeEfficiency = {
        current: 325,
        previous: 285,
        target: 300,
        trend: '+14.0%',
        sparkline: [250, 260, 270, 285, 300, 315, 325],
        status: 'excellent'
      };
      data.automationRate = {
        current: 82.5,
        previous: 75.3,
        target: 80,
        trend: '+9.6%',
        sparkline: [68, 70, 73, 75, 78, 80, 82],
        status: 'excellent'
      };
    } else if (category === 'quality') {
      data.aiAccuracy = {
        current: 96.2,
        previous: 94.8,
        target: 95,
        trend: '+1.5%',
        sparkline: [93.5, 94.0, 94.5, 94.8, 95.5, 95.8, 96.2],
        status: 'excellent'
      };
      data.userSatisfaction = {
        current: 4.6,
        previous: 4.3,
        target: 4.5,
        trend: '+7.0%',
        sparkline: [4.0, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6],
        status: 'excellent'
      };
      data.bugResolutionTime = {
        current: 18,
        previous: 26,
        target: 24,
        trend: '-30.8%',
        sparkline: [32, 30, 28, 26, 22, 20, 18],
        status: 'excellent',
        inverse: true
      };
      data.codeQualityScore = {
        current: 88,
        previous: 82,
        target: 85,
        trend: '+7.3%',
        sparkline: [78, 80, 81, 82, 85, 87, 88],
        status: 'excellent'
      };
    }
    
    return data;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'excellent':
        return REJLERS_COLORS.secondary.green.base;
      case 'good':
        return '#10B981';
      case 'warning':
        return '#F59E0B';
      case 'critical':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const renderCategorySelector = () => {
    const categories = [
      { id: 'platform', label: 'Platform', icon: '🖥️' },
      { id: 'performance', label: 'Performance', icon: '⚡' },
      { id: 'usage', label: 'Usage', icon: '👥' },
      { id: 'business', label: 'Business', icon: '💼' },
      { id: 'quality', label: 'Quality', icon: '⭐' }
    ];

    return (
      <div className="flex space-x-4 mb-8 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedMetricCategory(cat.id)}
            className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-all ${
              selectedMetricCategory === cat.id
                ? 'text-white shadow-lg transform scale-105'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
            style={{
              backgroundColor: selectedMetricCategory === cat.id ? REJLERS_COLORS.secondary.green.base : undefined
            }}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>
    );
  };

  const renderTimeRangeSelector = () => {
    const ranges = [
      { id: '7_days', label: '7 Days' },
      { id: '30_days', label: '30 Days' },
      { id: '90_days', label: '90 Days' },
      { id: '1_year', label: '1 Year' },
      { id: 'all_time', label: 'All Time' }
    ];

    return (
      <div className="flex items-center space-x-2 mb-6">
        <span className="text-sm font-semibold text-gray-700">Time Range:</span>
        <div className="flex space-x-2">
          {ranges.map((range) => (
            <button
              key={range.id}
              onClick={() => setTimeRange(range.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                timeRange === range.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
        
        <div className="ml-4 flex items-center">
          <input
            type="checkbox"
            id="comparison"
            checked={comparisonMode}
            onChange={(e) => setComparisonMode(e.target.checked)}
            className="mr-2"
          />
          <label htmlFor="comparison" className="text-sm font-semibold text-gray-700 cursor-pointer">
            Show Comparison
          </label>
        </div>
      </div>
    );
  };

  const renderMetricCard = (metricKey, metric, config) => {
    if (!metric) return null;

    const isGoodTrend = config.inverse
      ? metric.trend.startsWith('-')
      : metric.trend.startsWith('+');

    return (
      <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all duration-300">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">{config.icon}</span>
            <h3 className="text-lg font-semibold text-gray-900">{config.label}</h3>
          </div>
          <span
            className="px-3 py-1 rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: getStatusColor(metric.status) }}
          >
            {metric.status.toUpperCase()}
          </span>
        </div>

        {/* Current Value */}
        <div className="mb-4">
          <div className="flex items-end space-x-2 mb-1">
            <span className="text-4xl font-bold text-gray-900">
              {typeof metric.current === 'number' && metric.current > 999
                ? metric.current.toLocaleString()
                : metric.current}
            </span>
            {config.unit && (
              <span className="text-xl text-gray-500 mb-1">{config.unit}</span>
            )}
          </div>
          
          {/* Trend */}
          <div className="flex items-center space-x-2">
            <span
              className={`text-sm font-semibold ${
                isGoodTrend ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {isGoodTrend ? '↗' : '↘'} {metric.trend}
            </span>
            <span className="text-sm text-gray-500">vs previous period</span>
          </div>
        </div>

        {/* Sparkline */}
        <div className="mb-4">
          <div className="flex items-end space-x-1 h-12">
            {metric.sparkline.map((value, index) => {
              const maxValue = Math.max(...metric.sparkline);
              const height = (value / maxValue) * 100;
              return (
                <div
                  key={index}
                  className="flex-1 rounded-t transition-all hover:opacity-75"
                  style={{
                    height: `${height}%`,
                    background: `linear-gradient(to top, ${REJLERS_COLORS.secondary.green.base}, ${REJLERS_COLORS.secondary.turbine.base})`
                  }}
                ></div>
              );
            })}
          </div>
        </div>

        {/* Target Progress */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600">Target: {metric.target}{config.unit || ''}</span>
            <span className="font-semibold text-gray-900">
              {((metric.current / metric.target) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-500 rounded-full"
              style={{
                width: `${Math.min((metric.current / metric.target) * 100, 100)}%`,
                backgroundColor: getStatusColor(metric.status)
              }}
            ></div>
          </div>
        </div>

        {/* Comparison Mode */}
        {comparisonMode && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Previous Period:</span>
              <span className="font-semibold text-gray-900">
                {metric.previous}{config.unit || ''}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMetricsGrid = () => {
    if (isLoading) {
      return (
        <div className="text-center py-12">
          <div className="text-6xl mb-4 animate-bounce">📊</div>
          <p className="text-lg text-gray-600">Loading metrics...</p>
        </div>
      );
    }

    const categoryMetrics = KEY_METRICS[selectedMetricCategory];
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Object.entries(categoryMetrics).map(([key, config]) => (
          renderMetricCard(key, metricsData[key], config)
        ))}
      </div>
    );
  };

  const renderInsightsSummary = () => {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl shadow-lg p-8 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">💡 Key Insights</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg p-6">
            <div className="text-3xl mb-3">🎯</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Performance Highlights
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>✅ 8 out of 10 metrics exceeding targets</li>
              <li>✅ System uptime at 99.8%</li>
              <li>✅ User satisfaction increased by 7%</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg p-6">
            <div className="text-3xl mb-3">📈</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Growth Trends
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>✅ User base growing 12.6% month-over-month</li>
              <li>✅ Feature adoption up 15.1%</li>
              <li>✅ ROI increased to 178%</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg p-6">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Optimization Wins
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>✅ Response time reduced by 11.9%</li>
              <li>✅ Error rate cut in half</li>
              <li>✅ Bug resolution 30% faster</li>
            </ul>
          </div>
        </div>
      </div>
    );
  };

  const renderComparisonChart = () => {
    if (!comparisonMode) return null;

    return (
      <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          📊 Period Comparison Analysis
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart Comparison */}
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">
              Current vs Previous Period
            </h3>
            <div className="space-y-4">
              {Object.entries(metricsData).slice(0, 5).map(([key, metric]) => {
                const config = KEY_METRICS[selectedMetricCategory][key];
                if (!config) return null;
                
                const maxValue = Math.max(metric.current, metric.previous, metric.target);
                
                return (
                  <div key={key}>
                    <div className="text-sm font-semibold text-gray-700 mb-2">
                      {config.label}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <span className="text-xs text-gray-600 w-20">Current:</span>
                        <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden">
                          <div
                            className="h-full flex items-center px-3 text-white text-sm font-semibold"
                            style={{
                              width: `${(metric.current / maxValue) * 100}%`,
                              backgroundColor: REJLERS_COLORS.secondary.green.base
                            }}
                          >
                            {metric.current}{config.unit || ''}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <span className="text-xs text-gray-600 w-20">Previous:</span>
                        <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden">
                          <div
                            className="h-full flex items-center px-3 text-white text-sm font-semibold"
                            style={{
                              width: `${(metric.previous / maxValue) * 100}%`,
                              backgroundColor: REJLERS_COLORS.secondary.turbine.base
                            }}
                          >
                            {metric.previous}{config.unit || ''}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Performance Summary */}
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">
              Performance Summary
            </h3>
            <div className="space-y-4">
              {Object.entries(metricsData).map(([key, metric]) => {
                const config = KEY_METRICS[selectedMetricCategory][key];
                if (!config) return null;
                
                const improvement = ((metric.current - metric.previous) / metric.previous * 100).toFixed(1);
                const isPositive = config.inverse ? improvement < 0 : improvement > 0;
                
                return (
                  <div
                    key={key}
                    className={`p-4 rounded-lg border-2 ${
                      isPositive ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">
                        {config.label}
                      </span>
                      <span
                        className={`text-lg font-bold ${
                          isPositive ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {isPositive ? '+' : ''}{improvement}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Link
              to="/admin/reports"
              className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
            >
              ← Back to Report Generator
            </Link>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              📈 Advanced Analytics
            </h1>
            <p className="text-lg text-gray-600">
              Comprehensive metrics and performance analysis
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={loadMetricsData}
              className="px-6 py-3 rounded-lg font-semibold text-white transition-all hover:shadow-lg"
              style={{ backgroundColor: REJLERS_COLORS.secondary.green.base }}
            >
              🔄 Refresh Data
            </button>
            <button
              onClick={() => alert('Exporting analytics report...')}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold transition-all hover:shadow-lg"
            >
              📥 Export Report
            </button>
          </div>
        </div>
      </div>

      {/* Category Selector */}
      {renderCategorySelector()}

      {/* Time Range Selector */}
      {renderTimeRangeSelector()}

      {/* Insights Summary */}
      {renderInsightsSummary()}

      {/* Comparison Chart */}
      {renderComparisonChart()}

      {/* Metrics Grid */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {Object.keys(KEY_METRICS).find(k => k === selectedMetricCategory)
            ? KEY_METRICS[selectedMetricCategory][Object.keys(KEY_METRICS[selectedMetricCategory])[0]]?.category
            : 'Metrics'} Dashboard
        </h2>
        {renderMetricsGrid()}
      </div>

      {/* Export Options */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          📤 Export Options
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <button className="p-4 bg-red-50 border-2 border-red-200 rounded-lg hover:bg-red-100 transition-all">
            <div className="text-3xl mb-2">📄</div>
            <div className="font-semibold text-gray-900">PDF Report</div>
          </button>
          <button className="p-4 bg-green-50 border-2 border-green-200 rounded-lg hover:bg-green-100 transition-all">
            <div className="text-3xl mb-2">📊</div>
            <div className="font-semibold text-gray-900">Excel Data</div>
          </button>
          <button className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 transition-all">
            <div className="text-3xl mb-2">🎯</div>
            <div className="font-semibold text-gray-900">PowerPoint</div>
          </button>
          <button className="p-4 bg-purple-50 border-2 border-purple-200 rounded-lg hover:bg-purple-100 transition-all">
            <div className="text-3xl mb-2">{ }</div>
            <div className="font-semibold text-gray-900">JSON API</div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdvancedAnalytics;
