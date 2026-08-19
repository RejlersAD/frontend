import React, { useState } from 'react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';

// Define metrics for the chart
const metricOptions = [
  { key: "rejectionPercent", label: "Rejection of Deliverables (%)", color: "#2563eb", type: "percentage", yAxisId: "left" },
  { key: "costPoorQuality", label: "Cost of Poor Quality (AED)", color: "#ef4444", type: "currency", yAxisId: "right" }
];

// Custom tooltip similar to OverviewChart
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const fullTitle = payload[0]?.payload?.projectTitle || label;
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-3 text-sm border border-slate-200 dark:border-slate-700">
        <p className="font-semibold mb-2 text-slate-700 dark:text-slate-300" title={fullTitle}>
          {fullTitle}
        </p>
        {payload.map((entry, idx) => {
          const metric = metricOptions.find(m => m.key === entry.dataKey);
          let suffix = "";
          if (metric?.type === "percentage") suffix = "%";
          if (metric?.type === "currency") suffix = " AED";
          return (
            <div key={idx} className="flex items-center justify-between gap-3 mb-1">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-slate-600 dark:text-slate-400">{metric?.label || entry.name}:</span>
              </div>
              <span className="font-bold" style={{ color: entry.color }}>
                {typeof entry.value === "number" ? entry.value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : entry.value}{suffix}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

const GrowthChart = ({ data }) => {
  const [selectedMetrics, setSelectedMetrics] = useState(metricOptions.map(m => m.key));

  const toggleMetric = (metricKey) => {
    setSelectedMetrics(prev => 
      prev.includes(metricKey) 
        ? prev.filter(key => key !== metricKey)
        : [...prev, metricKey]
    );
  };

  return (
    <div className="card w-full min-h-[300px] sm:min-h-[350px] md:min-h-[400px] lg:min-h-[280px] xl:min-h-[450px] p-4 sm:p-6 md:p-8">
      <div className="card-header space-y-3 flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <h3 className="card-title text-lg font-semibold">
       Overview for Rejection and Cost of Poor Quality
        </h3>
      </div>
      {/* Metric Toggle Buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {metricOptions.map(metric => (
          <button
            key={metric.key}
            onClick={() => toggleMetric(metric.key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              selectedMetrics.includes(metric.key)
                ? 'text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
            style={{
              backgroundColor: selectedMetrics.includes(metric.key)
                ? metric.color
                : undefined,
            }}
            title={`Toggle ${metric.label} visibility`}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: selectedMetrics.includes(metric.key)
                  ? 'white'
                  : metric.color,
              }}
            />
            {metric.label}
          </button>
        ))}
      </div>
      <div className="card-body p-0">
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart
              data={data}
              margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
              <XAxis
                dataKey="name"
                fontSize={13}
                tickMargin={10}
                axisLine={false}
                tickLine={false}
                tick={<CustomXAxisTick />}
                label={{
                  value: 'Project',
                  position: 'insideBottom',
                  offset: -36,
                  style: {
                    textAnchor: 'middle',
                    fill: "#334155",
                    fontSize: '13px',
                    fontWeight: 600,
                    letterSpacing: 0.2
                  }
                }}
              />
              {/* Left Y Axis for Rejection % */}
              <YAxis
                yAxisId="left"
                fontSize={13}
                tickMargin={10}
                axisLine={false}
                tickLine={false}
                width={55}
                tick={{
                  fill: "#2563eb", // blue for rejection
                  fontWeight: 500,
                  fontSize: 13,
                  letterSpacing: 0.2
                }}
                label={{ 
                  value: 'Rejection %', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { 
                    textAnchor: 'middle',
                    fill: "#2563eb",
                    fontSize: '13px',
                    fontWeight: 600,
                    letterSpacing: 0.2
                  }
                }}
              />
              {/* Right Y Axis for Cost of Poor Quality */}
              <YAxis
                yAxisId="right"
                orientation="right"
                fontSize={13}
                tickMargin={10}
                axisLine={false}
                tickLine={false}
                width={70}
                tick={{
                  fill: "#ef4444", // red for cost
                  fontWeight: 500,
                  fontSize: 13,
                  letterSpacing: 0.2
                }}
                label={{ 
                  value: 'Cost of Poor Quality (AED)', 
                  angle: 90, 
                  position: 'insideRight',
                  style: { 
                    textAnchor: 'middle',
                    fill: "#ef4444",
                    fontSize: '13px',
                    fontWeight: 600,
                    letterSpacing: 0.2
                  }
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {metricOptions.map(metric => 
                selectedMetrics.includes(metric.key) && (
                  <Line
                    key={metric.key}
                    type="monotone"
                    dataKey={metric.key}
                    stroke={metric.color}
                    strokeWidth={3}
                    dot={true}
                    yAxisId={metric.yAxisId}
                  />
                )
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-80 text-slate-500 dark:text-slate-400">
            <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mb-3 opacity-50">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h4 className="font-medium mb-1">No Data Available</h4>
            <p className="text-sm text-center max-w-xs">Chart will display once QHSE data is loaded from your projects</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Add this inside GrowthChart.jsx
const CustomXAxisTick = ({ x, y, payload }) => {
  // payload.value is Project No, payload.payload.projectTitleKey is the key
  const titleKey = payload?.payload?.projectTitleKey || '';
  return (
    <g>
      <text
        x={x}
        y={y + 10}
        textAnchor="middle"
        fill="#334155"
        fontWeight={500}
        fontSize={13}
        style={{ cursor: 'pointer' }}
      >
        {payload.value}
        {titleKey && <title>{titleKey}</title>}
      </text>
    </g>
  );
};

export default GrowthChart;