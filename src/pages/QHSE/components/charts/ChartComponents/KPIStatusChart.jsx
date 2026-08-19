import React from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from "recharts";
import { PieChart as PieChartIcon } from 'lucide-react';
import { pieColors } from '@/data/index';

// KPI Status Tooltip Component
const KPIStatusTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const entry = payload[0];
    let status = "";
    if (entry?.name === "Green") status = "On Track";
    else if (entry?.name === "Light Green") status = "Very Good";
    else if (entry?.name === "Yellow") status = "Attention Needed";
    else if (entry?.name === "Orange") status = "Risk";
    else if (entry?.name === "Red") status = "Critical";

    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 px-4 py-3 min-w-[180px]">
        <div className="font-semibold mb-2 text-blue-700 dark:text-blue-300 text-base">
          {entry?.payload?.name || "KPI Status"}
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ background: entry?.payload?.fill || entry?.color }}
          />
          <span className="font-medium" style={{ color: entry?.payload?.fill || entry?.color }}>
            {entry?.name}
          </span>
          <span className="ml-auto font-bold text-gray-700 dark:text-gray-200">
            {entry?.value}
          </span>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {status}
        </div>
      </div>
    );
  }
  return null;
};

export const KPIStatusChart = ({ data }) => {
  // Color mapping for 5 categories
  const colorMap = {
    "Green": "#16a34a",
    "Light Green": "#4ade80",
    "Yellow": "#facc15",
    "Orange": "#f97316",
    "Red": "#ef4444"
  };

  return (
    <>
      <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
        <PieChartIcon className="w-5 h-5 text-blue-500 dark:text-blue-400" />
        KPI Status Distribution
      </h3>
      <div className="flex-1 flex flex-col justify-between">
        <div className="flex flex-col items-center w-full">
          <div className="w-full max-w-full flex justify-center overflow-x-auto scrollbar-thin scrollbar-thumb-blue-200 dark:scrollbar-thumb-blue-900 scrollbar-track-transparent">
            <div className="min-w-[320px] w-full">
              <ResponsiveContainer width="100%" minWidth={220} minHeight={220} height={320}>
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={45}
                    paddingAngle={2}
                    label={({ percent, name }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {data.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={colorMap[entry.name] || "#a3a3a3"}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<KPIStatusTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="mt-6 w-full max-w-2xl mx-auto">
            <div className="flex flex-wrap justify-center gap-4">
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-green-600" />
                <span className="font-medium text-green-700 dark:text-green-400"></span>
                <span className="text-xs text-gray-500 ml-1">100% (On Track)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-green-400" />
                <span className="font-medium text-green-500 dark:text-green-300"></span>
                <span className="text-xs text-gray-500 ml-1">90-99% (Very Good)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-yellow-400" />
                <span className="font-medium text-yellow-600 dark:text-yellow-400"></span>
                <span className="text-xs text-gray-500 ml-1">80-89% (Attention Needed)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-orange-400" />
                <span className="font-medium text-orange-600 dark:text-orange-400"></span>
                <span className="text-xs text-gray-500 ml-1">60-79% (Risk)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
                <span className="font-medium text-red-600 dark:text-red-400"></span>
                <span className="text-xs text-gray-500 ml-1">Below 60% (Critical)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};