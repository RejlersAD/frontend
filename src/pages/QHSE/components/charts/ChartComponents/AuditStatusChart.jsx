import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import { Clock } from 'lucide-react';
import { LabelList } from "recharts";

// Audit Status Tooltip Component
const AuditStatusTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 px-4 py-3 min-w-[180px]">
        <div className="font-semibold mb-2 text-blue-700 dark:text-blue-300">{label}</div>
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between mb-1 text-xs">
            <span className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: entry.color }} />
              <span className="font-medium" style={{ color: entry.color }}>{entry.name}</span>
            </span>
            <span className="font-bold">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const AuditStatusChart = ({ data }) => {
  return (
    <>
      <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
        <Clock className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
        Audit Status Overview
      </h3>
      <div className="flex-1 flex flex-col justify-between">
        <div className="flex flex-col items-center w-full">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-center">
            Each bar shows how many projects are at each status for each audit.
          </div>
          <div className="flex justify-center gap-4 mb-2 flex-wrap">
            <span className="flex items-center text-xs text-gray-600 dark:text-gray-300">
              <span className="inline-block w-3 h-3 rounded-full mr-1" style={{ background: "#16a34a" }} />
              Completed
            </span>
            <span className="flex items-center text-xs text-gray-600 dark:text-gray-300">
              <span className="inline-block w-3 h-3 rounded-full mr-1" style={{ background: "#facc15" }} />
              Upcoming
            </span>
            <span className="flex items-center text-xs text-gray-600 dark:text-gray-300">
              <span className="inline-block w-3 h-3 rounded-full mr-1" style={{ background: "#64748b" }} />
              Not Applicable
            </span>
          </div>
          <ResponsiveContainer width="100%" minWidth={320} minHeight={220} height={320}>
            <BarChart
              data={data}
              margin={{ top: 16, right: 24, left: 24, bottom: 40 }}
              barCategoryGap="20%"
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#64748b", fontSize: 13, fontWeight: 500 }}
                axisLine={true}
                tickLine={false}
                label={{
                  value: "Audit",
                  position: "insideBottom",
                  offset: -10,
                  fill: "#64748b",
                  fontSize: 14
                }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "#64748b", fontSize: 13 }}
                axisLine={true}
                tickLine={false}
                label={{
                  value: "Number of Projects",
                  angle: -90,
                  position: "insideLeft",
                  offset: 30,
                  fill: "#64748b",
                  fontSize: 14,
                  dy: 120
                }}
              />
              <Tooltip content={<AuditStatusTooltip />} />
              <Bar dataKey="Completed" fill="#16a34a" name="Completed">
                <LabelList dataKey="Completed" position="top" fill="#16a34a" fontSize={12} />
              </Bar>
              <Bar dataKey="Upcoming" fill="#facc15" name="Upcoming">
                <LabelList dataKey="Upcoming" position="top" fill="#facc15" fontSize={12} />
              </Bar>
              <Bar dataKey="NotApplicable" fill="#64748b" name="Not Applicable">
                <LabelList dataKey="NotApplicable" position="top" fill="#64748b" fontSize={12} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center w-full">
            Status of audits across all filtered projects.
          </div>
        </div>
      </div>
    </>
  );
};