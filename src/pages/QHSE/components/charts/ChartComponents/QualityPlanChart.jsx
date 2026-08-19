import React from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { PieChart as PieChartIcon } from 'lucide-react';
import { pieColors } from '@/data/index';

export const QualityPlanChart = ({ data }) => {
  return (
    <>
      <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
        <PieChartIcon className="w-5 h-5 text-blue-500 dark:text-blue-400" />
        Quality Plan Status
      </h3>
      <div className="flex-1 flex flex-col justify-between">
        <div className="flex flex-col items-center w-full">
          <div className="w-full max-w-full flex justify-center overflow-x-auto scrollbar-thin scrollbar-thumb-blue-200 dark:scrollbar-thumb-blue-900 scrollbar-track-transparent">
            <div className="min-w-[220px] w-full">
              <ResponsiveContainer width="100%" minWidth={220} minHeight={220} height={260}>
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {data.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={
                          entry.name === "Approved"
                            ? "#16a34a"
                            : entry.name === "Pending"
                            ? "#facc15"
                            : pieColors[index % pieColors.length]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${value} project${value === 1 ? '' : 's'}`, name]}
                    contentStyle={{
                      background: "#fff",
                      borderRadius: "0.5rem",
                      boxShadow: "0 2px 8px 0 rgba(0,0,0,0.08)"
                    }}
                    labelStyle={{ color: "#3b82f6" }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: 13 }}
                    formatter={(value) => {
                      if (value === "Approved") return <span className="text-green-700 dark:text-green-400 font-medium">Approved</span>;
                      if (value === "Pending") return <span className="text-yellow-700 dark:text-yellow-300 font-medium">Pending</span>;
                      return value;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="flex justify-center gap-6 mt-4 flex-wrap">
            {data.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2 mb-2">
                <span
                  className="inline-block w-4 h-4 rounded-full border border-gray-300 dark:border-gray-700"
                  style={{
                    background:
                      entry.name === "Approved"
                        ? "#16a34a"
                        : entry.name === "Pending"
                        ? "#facc15"
                        : pieColors[index % pieColors.length]
                  }}
                />
                <span className="text-sm text-gray-700 dark:text-gray-200 font-medium">
                  {entry.name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({entry.value})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};