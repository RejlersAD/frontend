/**
 * Department Usage Chart Component
 * 
 * Bar chart showing usage by department
 */

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { BuildingOfficeIcon } from '@heroicons/react/24/outline';

const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#6366F1'];

const DepartmentUsageChart = ({ departments, timeRange }) => {
  // Transform data for chart
  const chartData = departments.map((dept) => ({
    name: dept.department,
    requests: dept.total_requests,
    tokens: dept.total_tokens,
    users: dept.total_users,
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900">{data.name}</p>
          <p className="text-sm text-blue-600 mt-1">
            Requests: {data.requests.toLocaleString()}
          </p>
          <p className="text-sm text-purple-600">
            Tokens: {data.tokens.toLocaleString()}
          </p>
          <p className="text-sm text-green-600">
            Users: {data.users}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <BuildingOfficeIcon className="h-6 w-6 text-blue-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">
            Department Usage
          </h2>
        </div>
        <span className="text-xs text-gray-500">Top 5 Departments</span>
      </div>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="requests" fill="#3B82F6" name="Requests" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[300px] text-gray-500">
          No data available
        </div>
      )}
    </div>
  );
};

export default DepartmentUsageChart;
