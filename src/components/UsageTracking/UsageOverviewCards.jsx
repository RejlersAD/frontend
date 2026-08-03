/**
 * Usage Overview Cards Component
 * 
 * Displays key metrics as cards:
 * - Total Requests
 * - Active Users
 * - Total Tokens  * - Avg Response Time
 * - Success Rate
 * - Departments
 */

import React from 'react';
import {
  ChartBarIcon,
  UserGroupIcon,
  CpuChipIcon,
  ClockIcon,
  CheckCircleIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';

const UsageOverviewCards = ({ data, timeRange }) => {
  const cards = [
    {
      title: 'Total Requests',
      value: data.total_requests?.toLocaleString() || '0',
      subValue: `Today: ${data.today_requests?.toLocaleString() || '0'}`,
      icon: ChartBarIcon,
      color: 'blue',
      change: null,
    },
    {
      title: 'Active Users',
      value: data.total_users?.toLocaleString() || '0',
      subValue: 'Unique users',
      icon: UserGroupIcon,
      color: 'green',
      change: null,
    },
    {
      title: 'AI Tokens Used',
      value: (data.total_tokens / 1000).toFixed(1) + 'K' || '0',
      subValue: `${data.total_tokens?.toLocaleString() || '0'} total`,
      icon: CpuChipIcon,
      color: 'purple',
      change: null,
    },
    {
      title: 'Avg Response Time',
      value: data.avg_processing_time?.toFixed(2) || '0',
      subValue: 'seconds',
      icon: ClockIcon,
      color: 'yellow',
      change: null,
    },
    {
      title: 'Success Rate',
      value: data.success_rate?.toFixed(1) + '%' || '0%',
      subValue: `${data.total_errors || 0} errors`,
      icon: CheckCircleIcon,
      color: data.success_rate >= 95 ? 'green' : 'red',
      change: null,
    },
    {
      title: 'Departments',
      value: data.total_departments?.toLocaleString() || '0',
      subValue: 'Active departments',
      icon: BuildingOfficeIcon,
      color: 'indigo',
      change: null,
    },
  ];

  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    red: 'bg-red-100 text-red-600',
    indigo: 'bg-indigo-100 text-indigo-600',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div
            key={index}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${colorClasses[card.color]}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-600 mt-1">{card.title}</p>
              <p className="text-xs text-gray-500 mt-1">{card.subValue}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default UsageOverviewCards;
