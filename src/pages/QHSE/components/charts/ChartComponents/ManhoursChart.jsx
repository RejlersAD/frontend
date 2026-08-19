import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import { BarChart2, TrendingUp, Info, HelpCircle } from 'lucide-react';

// Enhanced Manhours Tooltip Component with Quality Billability %
const ManhoursTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload || {};
    // ✅ SIMPLIFIED: Use originalTitle (full Project Title) - no truncation
    const projectName = data?.originalTitle || data?.name || "Project";

    // Parse billability percentage
    const parseBillability = (value) => {
      if (typeof value === 'string') {
        return parseFloat(value.replace('%', '')) || 0;
      }
      return Number(value) || 0;
    };

    return (
      <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 min-w-[240px] max-w-[300px]">
        <div className="font-semibold mb-3 text-blue-700 dark:text-blue-300 text-sm border-b border-gray-200 dark:border-gray-600 pb-2">
          {projectName}
        </div>
        <div className="space-y-2.5">
          <div className="flex justify-between items-center bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-lg p-2.5">
            <span className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 shadow-sm" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Quality Manhours</span>
            </span>
            <span className="font-bold text-sm text-blue-600 dark:text-blue-400">
              {Number(data["Manhours for Quality"] || 0).toLocaleString()} hrs
            </span>
          </div>
          <div className="flex justify-between items-center bg-gradient-to-r from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 rounded-lg p-2.5">
            <span className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-gradient-to-r from-red-500 to-red-600 shadow-sm" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Used Manhours</span>
            </span>
            <span className="font-bold text-sm text-red-600 dark:text-red-400">
              {Number(data["Manhours Used"] || 0).toLocaleString()} hrs
            </span>
          </div>
          <div className="flex justify-between items-center bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 rounded-lg p-2.5">
            <span className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-gradient-to-r from-green-500 to-green-600 shadow-sm" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Balance</span>
            </span>
            <span className="font-bold text-sm text-green-600 dark:text-green-400">
              {Number(data["Manhours Balance"] || 0).toLocaleString()} hrs
            </span>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-600 pt-2.5 mt-3">
            <div className="flex justify-between items-center bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-lg p-2.5">
              <span className="flex items-center gap-2">
                <TrendingUp className="w-3 h-3 text-purple-500" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Quality Billability</span>
              </span>
              <span className="font-bold text-sm text-purple-600 dark:text-purple-400">
                {parseBillability(data["Quality Billability %"]).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// ✅ NEW: Management Info Tooltip Component
const InfoTooltip = ({ title, children }) => {
  const [isVisible, setIsVisible] = React.useState(false);

  return (
    <div className="relative inline-block">
      <HelpCircle 
        className="w-3 h-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help transition-colors" 
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      />
      {isVisible && (
        <div className="absolute z-50 bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
          <div className="font-semibold mb-1">{title}</div>
          <div>{children}</div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};

// Helper function to normalize project names
const normalizeProjectName = (name) => {
  if (!name || typeof name !== 'string') return 'Unknown Project';
  
  return name
    .trim()
    .replace(/\s+/g, ' ');
};

// Responsive helper function to get optimal settings based on screen size
const getResponsiveSettings = () => {
  if (typeof window !== 'undefined') {
    const width = window.innerWidth;
    if (width >= 1536) return { textLength: 20, yAxisWidth: 160, leftMargin: 180, needsScroll: false }; // 2xl
    if (width >= 1280) return { textLength: 18, yAxisWidth: 150, leftMargin: 170, needsScroll: false }; // xl
    if (width >= 1024) return { textLength: 16, yAxisWidth: 140, leftMargin: 160, needsScroll: false }; // lg
    if (width >= 768) return { textLength: 14, yAxisWidth: 130, leftMargin: 150, needsScroll: true }; // md
    return { textLength: 12, yAxisWidth: 120, leftMargin: 140, needsScroll: true }; // sm and below
  }
  return { textLength: 16, yAxisWidth: 140, leftMargin: 160, needsScroll: false }; // default
};

// Helper function to split text into two lines without breaking words
const splitTextIntoLines = (text, maxLength = 20) => {
  if (!text || text.length <= maxLength) return [text, ''];
  
  const words = text.split(' ');
  if (words.length === 1) {
    return [text.substring(0, maxLength - 3) + '...', ''];
  }
  
  let line1 = '';
  let line2 = '';
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = line1 + (line1 ? ' ' : '') + word;
    
    if (testLine.length > maxLength && line1) {
      line2 = words.slice(i).join(' ');
      if (line2.length > maxLength) {
        line2 = line2.substring(0, maxLength - 3) + '...';
      }
      break;
    } else {
      line1 = testLine;
    }
  }
  
  return [line1, line2];
};

export const ManhoursChart = ({ data = [] }) => {
  const [responsiveSettings, setResponsiveSettings] = React.useState(getResponsiveSettings());

  React.useEffect(() => {
    const handleResize = () => {
      setResponsiveSettings(getResponsiveSettings());
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Data processing
  const processedData = React.useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data
      .filter(item => {
        const hasValidProjectNo = item?.projectNo &&
          typeof item.projectNo === 'string' &&
          item.projectNo.trim() !== '' &&
          item.projectNo !== 'N/A';
        const hasManhoursData = (Number(item["Manhours for Quality"]) > 0) ||
          (Number(item["Manhours Used"]) > 0) ||
          (Number(item["Manhours Balance"]) !== 0);
        return hasValidProjectNo && hasManhoursData;
      })
      .map(item => ({
        projectNo: item.projectNo,
        name: item.name || item.projectTitle || '',
        originalTitle: item.originalTitle || item.projectTitle || '',
        "Manhours for Quality": Number(item["Manhours for Quality"]) || 0,
        "Manhours Used": Number(item["Manhours Used"]) || 0,
        "Manhours Balance": Number(item["Manhours Balance"]) || 0,
        "Quality Billability %": item["Quality Billability %"] || 0
      }));
  }, [data]);

  const hasData = processedData.length > 0;

  // Calculate summary statistics
  const summaryStats = React.useMemo(() => {
    if (!hasData) return { totalQuality: 0, totalUsed: 0, totalBalance: 0, avgBillability: 0, utilization: 0 };
    
    const totalQuality = processedData.reduce((sum, item) => sum + item["Manhours for Quality"], 0);
    const totalUsed = processedData.reduce((sum, item) => sum + Math.abs(item["Manhours Used"]), 0);
    const totalBalance = processedData.reduce((sum, item) => sum + item["Manhours Balance"], 0);
    const avgBillability = processedData.reduce((sum, item) => sum + item["Quality Billability %"], 0) / processedData.length;
    const utilization = totalQuality > 0 ? (totalUsed / totalQuality * 100) : 0;
    
    return { totalQuality, totalUsed, totalBalance, avgBillability, utilization };
  }, [processedData, hasData]);

  // Empty state
  if (!hasData) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            Manhours Analysis & Quality Billability
          </h3>
          <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
            Google Sheets
          </span>
        </div>

        {/* Empty State */}
        <div className="flex-1 flex items-center justify-center min-h-[400px]">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <BarChart2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-base font-medium mb-2">No manhour data available</p>
            <p className="text-sm">Projects will appear when they have manhour values in Google Sheets</p>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6">
          <div className="flex justify-center gap-4 mb-3 flex-wrap">
            <span className="flex items-center text-sm text-gray-600 dark:text-gray-300">
              <span className="inline-block w-4 h-3 rounded mr-2 bg-blue-500" />
              Quality Hours
            </span>
            <span className="flex items-center text-sm text-gray-600 dark:text-gray-300">
              <span className="inline-block w-4 h-3 rounded mr-2 bg-red-500" />
              Used Hours
            </span>
            <span className="flex items-center text-sm text-gray-600 dark:text-gray-300">
              <span className="inline-block w-4 h-3 rounded mr-2 bg-green-500" />
              Balance
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            📊 Manhour data synced from Google Sheets
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-blue-500 dark:text-blue-400" />
          Manhours Analysis & Quality Billability
        </h3>
        <span className="text-xs bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-full border border-blue-200 dark:border-blue-800">
          {processedData.length} project{processedData.length !== 1 ? 's' : ''} tracked
        </span>
      </div>

      {/* Chart Container with Horizontal Scroll */}
      <div className="flex-1 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 sm:p-6 flex flex-col justify-center items-center">
        <div className="w-full h-full flex justify-center items-center">
          <div className="w-full max-w-full overflow-x-auto scrollbar-thin scrollbar-thumb-blue-200 dark:scrollbar-thumb-blue-900 scrollbar-track-transparent">
            <div className="min-w-[600px] sm:min-w-[700px] md:min-w-[900px] lg:min-w-[1500px] xl:min-w-[1300px] 2xl:min-w-[1600px] mx-auto">
              <ResponsiveContainer
                width="100%"
                minWidth={600}
                height={Math.max(400, processedData.length * 0.8 + 120)}
              >
                <BarChart
                  layout="horizontal"
                  data={processedData}
                  margin={{ top: 20, right: 40, left: 40, bottom: 80 }}
                  barCategoryGap={75}
                  barGap={22}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e5e7eb"
                    strokeOpacity={0.7}
                    horizontal={true}
                    vertical={true}
                  />
                  <XAxis
                    dataKey="projectNo"
                    type="category"
                    tick={({ x, y, payload }) => (
                      <g transform={`translate(${x},${y})`}>
                        <text
                          dy={16}
                          x={0}
                          textAnchor="middle"
                          fill="#374151"
                          fontSize={12}
                          fontWeight={500}
                          className="fill-gray-700 dark:fill-gray-300"
                        >
                          {payload.value}
                        </text>
                      </g>
                    )}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    label={{
                      value: "Project No",
                      position: "insideBottom",
                      offset: -5,
                      style: {
                        textAnchor: 'middle',
                        fill: "#6b7280",
                        fontSize: "13px",
                        fontWeight: "600"
                      }
                    }}
                  />
                  <YAxis
                    type="number"
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: "#d1d5db", strokeWidth: 1 }}
                    tickFormatter={(value) => value.toLocaleString()}
                    label={{
                      value: "Manhours",
                      angle: -90,
                      position: "insideLeft",
                      offset: 0,
                      style: {
                        textAnchor: 'middle',
                        fill: "#6b7280",
                        fontSize: "13px",
                        fontWeight: "600"
                      }
                    }}
                  />
                  <Tooltip content={<ManhoursTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }} />
                  <Bar
                    dataKey="Manhours for Quality"
                    fill="#3b82f6"
                    name="Manhours for Quality"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={25}
                  />
                  <Bar
                    dataKey="Manhours Used"
                    fill="#ef4444"
                    name="Manhours Used"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={25}
                  />
                  <Bar
                    dataKey="Manhours Balance"
                    fill="#22c55e"
                    name="Manhours Balance"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={25}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Legend and Summary */}
      <div className="mt-6 space-y-4">
        {/* Legend */}
        <div className="flex justify-center gap-6">
          <span className="flex items-center text-sm text-gray-600 dark:text-gray-300">
            <span className="inline-block w-4 h-3 rounded mr-2 bg-blue-600" />
            Quality Hours
          </span>
          <span className="flex items-center text-sm text-gray-600 dark:text-gray-300">
            <span className="inline-block w-4 h-3 rounded mr-2 bg-red-600" />
            Used Hours
          </span>
          <span className="flex items-center text-sm text-gray-600 dark:text-gray-300">
            <span className="inline-block w-4 h-3 rounded mr-2 bg-green-500" />
            Balance
          </span>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4">
            <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Total Quality</div>
            <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
              {summaryStats.totalQuality.toLocaleString()}
            </div>
          </div>
          <div className="bg-red-50 dark:bg-red-950 rounded-lg p-4">
            <div className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">Total Used</div>
            <div className="text-xl font-bold text-red-700 dark:text-red-300">
              {summaryStats.totalUsed.toLocaleString()}
            </div>
          </div>
          <div className="bg-green-50 dark:bg-green-950 rounded-lg p-4">
            <div className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">Total Balance</div>
            <div className="text-xl font-bold text-green-700 dark:text-green-300">
              {summaryStats.totalBalance.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Data Source Info */}
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            📊 Manhours data synced from Google Sheets • {processedData.length} projects shown
          </p>
        </div>
      </div>
    </div>
  );
};
