/**
 * Usage Trends Chart Component
 * 
 * Line chart showing usage trends over time
 */

import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ArrowTrendingUpIcon } from '@heroicons/react/24/outline';

const UsageTrendsChart = ({ trendData, timeRange }) => {
  // Transform data for chart
  const chartData = trendData.map((item) => ({
    date: new Date(item.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    requests: item.requests,
    users: item.users,
    avgTime: parseFloat(item.avg_response_time || 0).toFixed(2),
    errorRate: parseFloat(item.error_rate || 0).toFixed(1),
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p
              key={index}
              className="text-sm"
              style={{ color: entry.color }}
            >
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <ArrowTrendingUpIcon className="h-6 w-6 text-indigo-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">
            Usage Trends Over Time
          </h2>
        </div>
        <span className="text-xs text-gray-500">Last 7 Days</span>
      </div>

      {chartData.length > 0 ? (
        <div className="space-y-6">
          {/* Requests & Users Chart */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Requests & Active Users
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="requests"
                  stroke="#3B82F6"
                  fill="url(#colorRequests)"
                  strokeWidth={2}
                  name="Requests"
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="users"
                  stroke="#10B981"
                  fill="url(#colorUsers)"
                  strokeWidth={2}
                  name="Users"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Performance Metrics */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Performance Metrics
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="avgTime"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Avg Response Time (s)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="errorRate"
                  stroke="#EF4444"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Error Rate (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-[400px] text-gray-500">
          No trend data available
        </div>
      )}
    </div>
  );
};

export default UsageTrendsChart;
