import React, { useState, useEffect } from 'react';

/**
 * Analytics Charts Component - Interactive data visualization
 * Features: Usage trends, system metrics, user activity
 * Soft-coded with customizable chart configurations
 */
const AnalyticsCharts = ({ analyticsData }) => {
  const [chartType, setChartType] = useState('line');
  const [timeRange, setTimeRange] = useState('7d');
  const [usageTrends, setUsageTrends] = useState([]);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Generate usage trend data (Last 7 days)
  useEffect(() => {
    generateUsageTrends();
  }, [analyticsData, timeRange]);

  const generateUsageTrends = () => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const data = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Generate realistic data with some variation
      const baseUsers = 45;
      const baseApiCalls = 1200;
      const baseDocuments = 30;
      
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: date.toISOString(),
        activeUsers: Math.floor(baseUsers + Math.random() * 15 - 7),
        apiCalls: Math.floor(baseApiCalls + Math.random() * 400 - 200),
        documentsProcessed: Math.floor(baseDocuments + Math.random() * 20 - 10),
        successRate: (95 + Math.random() * 4).toFixed(1),
        avgResponseTime: Math.floor(120 + Math.random() * 60)
      });
    }
    
    setUsageTrends(data);
  };

  // Chart configuration
  const CHART_CONFIG = {
    width: 800,
    height: 300,
    padding: { top: 20, right: 30, bottom: 50, left: 60 },
    colors: {
      activeUsers: '#3B82F6', // blue
      apiCalls: '#10B981', // green
      documentsProcessed: '#8B5CF6', // purple
      grid: '#E5E7EB',
      text: '#6B7280'
    }
  };

  // Calculate chart dimensions
  const chartWidth = CHART_CONFIG.width - CHART_CONFIG.padding.left - CHART_CONFIG.padding.right;
  const chartHeight = CHART_CONFIG.height - CHART_CONFIG.padding.top - CHART_CONFIG.padding.bottom;

  // Get data range for scaling
  const getDataRange = (metric) => {
    const values = usageTrends.map(d => d[metric]);
    return {
      min: Math.min(...values),
      max: Math.max(...values)
    };
  };

  // Scale value to chart coordinates
  const scaleY = (value, metric) => {
    const range = getDataRange(metric);
    const scale = chartHeight / (range.max - range.min || 1);
    return chartHeight - ((value - range.min) * scale);
  };

  const scaleX = (index) => {
    return (index / (usageTrends.length - 1)) * chartWidth;
  };

  // Generate SVG path for line chart
  const generateLinePath = (metric) => {
    if (usageTrends.length === 0) return '';
    
    const points = usageTrends.map((d, i) => ({
      x: scaleX(i),
      y: scaleY(d[metric], metric)
    }));

    return points.map((p, i) => 
      i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
    ).join(' ');
  };

  // Generate bars for bar chart
  const generateBars = (metric) => {
    const barWidth = chartWidth / usageTrends.length - 5;
    const range = getDataRange(metric);
    
    return usageTrends.map((d, i) => ({
      x: scaleX(i) - barWidth / 2,
      y: scaleY(d[metric], metric),
      width: barWidth,
      height: chartHeight - scaleY(d[metric], metric),
      value: d[metric]
    }));
  };

  // Metrics configuration
  const METRICS = [
    { id: 'activeUsers', label: 'Active Users', color: '#3B82F6', icon: '👥' },
    { id: 'apiCalls', label: 'API Calls', color: '#10B981', icon: '📡' },
    { id: 'documentsProcessed', label: 'Documents', color: '#8B5CF6', icon: '📄' }
  ];

  const [selectedMetric, setSelectedMetric] = useState('activeUsers');

  return (
    <div className="space-y-6">
      {/* Chart Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Chart Type:</span>
            <button
              onClick={() => setChartType('line')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                chartType === 'line'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📈 Line
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                chartType === 'bar'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📊 Bar
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                chartType === 'area'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🗻 Area
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Period:</span>
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                timeRange === '7d'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setTimeRange('30d')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                timeRange === '30d'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setTimeRange('90d')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                timeRange === '90d'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              90 Days
            </button>
          </div>
        </div>

        {/* Metric Selector */}
        <div className="flex items-center space-x-2">
          {METRICS.map(metric => (
            <button
              key={metric.id}
              onClick={() => setSelectedMetric(metric.id)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                selectedMetric === metric.id
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {metric.icon} {metric.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-white rounded-xl p-6 border-2 border-gray-200 shadow-lg">
        <h4 className="font-bold text-gray-900 mb-4">
          Usage Trends - Last {timeRange === '7d' ? '7' : timeRange === '30d' ? '30' : '90'} Days
        </h4>
        
        <div className="relative">
          <svg
            width={CHART_CONFIG.width}
            height={CHART_CONFIG.height}
            className="mx-auto"
            style={{ maxWidth: '100%', height: 'auto' }}
          >
            {/* Grid lines */}
            <g transform={`translate(${CHART_CONFIG.padding.left}, ${CHART_CONFIG.padding.top})`}>
              {/* Horizontal grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                <line
                  key={`grid-h-${i}`}
                  x1={0}
                  y1={chartHeight * ratio}
                  x2={chartWidth}
                  y2={chartHeight * ratio}
                  stroke={CHART_CONFIG.colors.grid}
                  strokeWidth="1"
                  strokeDasharray="4,4"
                />
              ))}

              {/* Chart content based on type */}
              {chartType === 'line' && (
                <>
                  {/* Line path */}
                  <path
                    d={generateLinePath(selectedMetric)}
                    fill="none"
                    stroke={METRICS.find(m => m.id === selectedMetric)?.color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  
                  {/* Data points */}
                  {usageTrends.map((d, i) => (
                    <circle
                      key={i}
                      cx={scaleX(i)}
                      cy={scaleY(d[selectedMetric], selectedMetric)}
                      r={hoveredIndex === i ? 6 : 4}
                      fill={METRICS.find(m => m.id === selectedMetric)?.color}
                      className="transition-all cursor-pointer"
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />
                  ))}
                </>
              )}

              {chartType === 'bar' && (
                <>
                  {generateBars(selectedMetric).map((bar, i) => (
                    <rect
                      key={i}
                      x={bar.x}
                      y={bar.y}
                      width={bar.width}
                      height={bar.height}
                      fill={hoveredIndex === i 
                        ? METRICS.find(m => m.id === selectedMetric)?.color 
                        : `${METRICS.find(m => m.id === selectedMetric)?.color}CC`}
                      className="transition-all cursor-pointer"
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      rx="4"
                    />
                  ))}
                </>
              )}

              {chartType === 'area' && (
                <>
                  {/* Area fill */}
                  <path
                    d={`${generateLinePath(selectedMetric)} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`}
                    fill={`${METRICS.find(m => m.id === selectedMetric)?.color}33`}
                  />
                  {/* Line */}
                  <path
                    d={generateLinePath(selectedMetric)}
                    fill="none"
                    stroke={METRICS.find(m => m.id === selectedMetric)?.color}
                    strokeWidth="3"
                  />
                </>
              )}

              {/* X-axis labels */}
              {usageTrends.map((d, i) => {
                if (i % Math.ceil(usageTrends.length / 7) === 0 || i === usageTrends.length - 1) {
                  return (
                    <text
                      key={`label-${i}`}
                      x={scaleX(i)}
                      y={chartHeight + 20}
                      textAnchor="middle"
                      fontSize="12"
                      fill={CHART_CONFIG.colors.text}
                    >
                      {d.date}
                    </text>
                  );
                }
                return null;
              })}

              {/* Hover tooltip */}
              {hoveredIndex !== null && (
                <g transform={`translate(${scaleX(hoveredIndex)}, ${scaleY(usageTrends[hoveredIndex][selectedMetric], selectedMetric) - 40})`}>
                  <rect
                    x="-50"
                    y="-30"
                    width="100"
                    height="30"
                    rx="6"
                    fill="rgba(0, 0, 0, 0.8)"
                  />
                  <text
                    x="0"
                    y="-15"
                    textAnchor="middle"
                    fontSize="12"
                    fill="white"
                    fontWeight="bold"
                  >
                    {usageTrends[hoveredIndex][selectedMetric]}
                  </text>
                  <text
                    x="0"
                    y="-3"
                    textAnchor="middle"
                    fontSize="10"
                    fill="#CCC"
                  >
                    {usageTrends[hoveredIndex].date}
                  </text>
                </g>
              )}
            </g>
          </svg>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {METRICS.map(metric => {
          const values = usageTrends.map(d => d[metric.id]);
          const total = values.reduce((a, b) => a + b, 0);
          const avg = (total / values.length).toFixed(0);
          const trend = values.length > 1 
            ? ((values[values.length - 1] - values[0]) / values[0] * 100).toFixed(1)
            : 0;

          return (
            <div
              key={metric.id}
              className="bg-gradient-to-br from-white to-gray-50 p-6 rounded-xl border-2 border-gray-200 shadow hover:shadow-lg transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-sm font-semibold text-gray-700">{metric.label}</h5>
                <span className="text-2xl">{metric.icon}</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Average:</span>
                  <span className="text-lg font-bold" style={{ color: metric.color }}>
                    {avg}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Total:</span>
                  <span className="text-sm font-semibold text-gray-900">{total}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Trend:</span>
                  <span className={`text-sm font-bold ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {trend >= 0 ? '↗' : '↘'} {Math.abs(trend)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AnalyticsCharts;
