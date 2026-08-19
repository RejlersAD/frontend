import React from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
// Theme support can be added later if needed
import { useState } from "react";

// ✅ UPDATED: Removed billability metric
const metricOptions = [
  { key: "carsOpen", label: "CARs Overview", color: "#ef4444", type: "count" },
  { key: "obsOpen", label: "Observation Overview", color: "#f97316", type: "count" },
  { key: "kpiAchieved", label: "KPI Achievement Overview", color: "#22c55e", type: "percentage" },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-3 text-sm border border-slate-200 dark:border-slate-700">
        <p className="font-semibold mb-2 text-slate-700 dark:text-slate-300">{label}</p>
        {payload.map((entry, idx) => {
          // Show only CARs, Observation, KPI Achievement in tooltip
          let displayLabel = "";
          if (entry.dataKey === "carsOpen") displayLabel = "CARs";
          else if (entry.dataKey === "obsOpen") displayLabel = "Observation";
          else if (entry.dataKey === "kpiAchieved") displayLabel = "KPI Achievement";
          else return null; // Skip other metrics

          const metric = metricOptions.find(m => m.key === entry.dataKey);
          const suffix = metric?.type === "percentage" ? "%" : "";
          return (
            <div key={idx} className="flex items-center justify-between gap-3 mb-1">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-slate-600 dark:text-slate-400">{displayLabel}:</span>
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

const QHSEOverviewChart = ({ monthlyData, yearlyData, className }) => {
  // Theme can be detected from system preferences if needed
  const theme = 'light'; // Default theme
  const [filter, setFilter] = useState("monthly");
  const [selectedMetrics, setSelectedMetrics] = useState(metricOptions.map(m => m.key));

  const chartData = filter === "monthly" ? monthlyData : yearlyData;
  
  // ✅ SMART: Detect data grouping type for dynamic labels
  const hasDateBasedData = chartData && chartData.length > 0 && chartData[0].name?.includes('-');
  const hasCompletionData = chartData && chartData.length > 0 && chartData[0].name?.includes('Complete');
  const hasKPIData = chartData && chartData.length > 0 && chartData[0].name?.includes('KPI');
  
  // Dynamic axis labels based on data type
  const xAxisLabel = hasDateBasedData ? 'Time Period' : hasCompletionData ? 'Project Completion Range' : 'Performance Category';
  const viewLabel = hasDateBasedData ? (filter === "monthly" ? "Monthly View" : "Yearly View") :
                    hasCompletionData ? "By Completion %" : "By KPI Performance";

  const toggleMetric = (metricKey) => {
    setSelectedMetrics(prev => 
      prev.includes(metricKey) 
        ? prev.filter(key => key !== metricKey)
        : [...prev, metricKey]
    );
  };

  return (
    <div className={`card w-full min-h-[300px] sm:min-h-[350px] md:min-h-[400px] lg:min-h-[280px] xl:min-h-[450px] p-4 sm:p-6 md:p-8 ${className}`}>
      <div className="card-header space-y-3 flex flex-col sm:flex-row justify-between items-start sm:items-center">
        {/* Heading */}
        <div>
          <h3 className="card-title text-lg font-semibold">
            QHSE Performance Overview
          </h3>
          {chartData && chartData.length > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {viewLabel} • {chartData.length} categories • {chartData.reduce((sum, d) => sum + (d.count || 0), 0)} projects
            </p>
          )}
        </div>
        {/* Filter Dropdown aligned right */}
        <div>
          <select
            id="overview-filter"
            className="border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            aria-label="Select time period"
          >
            <option value="monthly">{hasDateBasedData ? 'Monthly View' : 'By Completion %'}</option>
            <option value="yearly">{hasDateBasedData ? 'Yearly View' : 'By KPI Performance'}</option>
          </select>
        </div>
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
        {chartData && chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke={theme === "light" ? "#e2e8f0" : "#374151"} 
                opacity={0.4}
                horizontal={true}
                vertical={false}
              />
              <XAxis
                dataKey="name"
                stroke={theme === "light" ? "#64748b" : "#9ca3af"}
                fontSize={12}
                tickMargin={10}
                axisLine={false}
                tickLine={false}
                angle={hasKPIData || hasCompletionData ? -15 : 0}
                textAnchor={hasKPIData || hasCompletionData ? "end" : "middle"}
                height={hasKPIData || hasCompletionData ? 80 : 50}
                label={{ 
                  value: xAxisLabel, 
                  position: 'insideBottom', 
                  offset: hasKPIData || hasCompletionData ? -10 : -16,
                  style: { 
                    textAnchor: 'middle',
                    fill: theme === "light" ? "#64748b" : "#9ca3af",
                    fontSize: '12px',
                    fontWeight: 500
                  }
                }}
              />
              <YAxis
                stroke={theme === "light" ? "#64748b" : "#9ca3af"}
                fontSize={12}
                tickMargin={10}
                axisLine={false}
                tickLine={false}
                width={55}
                label={{ 
                  value: 'Values', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { 
                    textAnchor: 'middle',
                    fill: theme === "light" ? "#64748b" : "#9ca3af",
                    fontSize: '12px',
                    fontWeight: 500
                  }
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              {metricOptions.map(metric => 
                selectedMetrics.includes(metric.key) && (
                  <Bar
                    key={metric.key}
                    dataKey={metric.key}
                    fill={metric.color}
                    radius={[4, 4, 0, 0]}
                    barSize={30}
                    isAnimationActive={true}
                  />
                )
              )}
            </BarChart>
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

export default QHSEOverviewChart;