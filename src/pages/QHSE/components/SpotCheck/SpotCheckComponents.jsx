/**
 * Enhanced Spot Check Components
 * Reusable UI components for spot check monitoring and analytics
 */

import React from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Award,
  Users,
  FileText,
  BarChart3,
  AlertCircle
} from 'lucide-react';

/**
 * Spot Check Metric Card
 */
export const SpotCheckMetricCard = ({ title, value, unit, icon: Icon, color = 'blue', trend, subtext }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    gray: 'bg-gray-50 text-gray-600'
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend !== undefined && trend !== 0 && (
          <div className={`flex items-center text-sm font-medium ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-sm text-gray-600">{title}</p>
        <div className="flex items-baseline space-x-2">
          <p className="text-2xl font-bold text-gray-900">{value?.toLocaleString() || 0}</p>
          {unit && <p className="text-sm text-gray-500">{unit}</p>}
        </div>
        {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
      </div>
    </div>
  );
};

/**
 * Compliance Score Display - Circular indicator
 */
export const ComplianceScoreDisplay = ({ score, size = 'large', label = 'Compliance Score' }) => {
  const normalizedScore = Math.max(0, Math.min(100, score));
  const radius = size === 'large' ? 60 : 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalizedScore / 100) * circumference;
  
  const scoreColor = 
    normalizedScore >= 90 ? '#10b981' :
    normalizedScore >= 75 ? '#3b82f6' :
    normalizedScore >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: radius * 2 + 20, height: radius * 2 + 20 }}>
        <svg className="transform -rotate-90" width={radius * 2 + 20} height={radius * 2 + 20}>
          <circle
            cx={radius + 10}
            cy={radius + 10}
            r={radius}
            stroke="#e5e7eb"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx={radius + 10}
            cy={radius + 10}
            r={radius}
            stroke={scoreColor}
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold ${size === 'large' ? 'text-3xl' : 'text-xl'}`} style={{ color: scoreColor }}>
            {Math.round(normalizedScore)}
          </span>
          <span className="text-xs text-gray-500">/ 100</span>
        </div>
      </div>
      <p className="mt-3 text-sm font-medium text-gray-700">{label}</p>
    </div>
  );
};

/**
 * Category Score Card
 */
export const CategoryScoreCard = ({ category, score, count, icon, color }) => {
  const scoreColor = score >= 90 ? '#10b981' : score >= 75 ? '#3b82f6' : score >= 60 ? '#f59e0b' : '#ef4444';
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">{icon}</span>
          <span className="font-medium text-gray-900">{category}</span>
        </div>
        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
          {count} checks
        </span>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Score</span>
          <span className="text-lg font-bold" style={{ color: scoreColor }}>
            {score}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all duration-500"
            style={{ width: `${score}%`, backgroundColor: scoreColor }}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Status Badge
 */
export const StatusBadge = ({ status, count }) => {
  const statusConfig = {
    passed: { color: 'green', icon: CheckCircle, bg: 'bg-green-100', text: 'text-green-700' },
    failed: { color: 'red', icon: XCircle, bg: 'bg-red-100', text: 'text-red-700' },
    pending: { color: 'yellow', icon: Clock, bg: 'bg-yellow-100', text: 'text-yellow-700' },
    in_progress: { color: 'blue', icon: BarChart3, bg: 'bg-blue-100', text: 'text-blue-700' },
    overdue: { color: 'red', icon: AlertTriangle, bg: 'bg-red-100', text: 'text-red-700' }
  };

  const config = statusConfig[status.toLowerCase()] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <div className={`flex items-center space-x-2 px-3 py-2 ${config.bg} rounded-lg`}>
      <Icon className={`w-4 h-4 ${config.text}`} />
      <span className={`text-sm font-medium ${config.text}`}>{status}</span>
      {count && <span className={`text-xs ${config.text}`}>({count})</span>}
    </div>
  );
};

/**
 * Risk Factor Card
 */
export const RiskFactorCard = ({ risk, onViewDetails }) => {
  return (
    <div 
      className="bg-white rounded-lg border-l-4 p-4 hover:shadow-md transition-all cursor-pointer"
      style={{ borderColor: risk.color }}
      onClick={() => onViewDetails && onViewDetails(risk)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <AlertTriangle className="w-5 h-5" style={{ color: risk.color }} />
            <h4 className="font-semibold text-gray-900">{risk.category}</h4>
          </div>
          <p className="text-sm text-gray-600 mb-2">{risk.description}</p>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500">Risk Level:</span>
            <span 
              className="px-2 py-1 text-xs font-medium rounded-full"
              style={{ 
                backgroundColor: `${risk.color}20`, 
                color: risk.color 
              }}
            >
              {risk.level.toUpperCase()}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold" style={{ color: risk.color }}>
            {risk.count}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Compliance Standard Row
 */
export const ComplianceStandardRow = ({ standard }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-medium text-gray-900">{standard.standard}</h4>
          <p className="text-sm text-gray-600">{standard.category}</p>
        </div>
        <span 
          className="px-3 py-1 text-xs font-medium rounded-full"
          style={{ 
            backgroundColor: `${standard.statusColor}20`, 
            color: standard.statusColor 
          }}
        >
          {standard.statusLabel}
        </span>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Target</span>
          <span className="font-semibold">{standard.targetScore}%</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Actual</span>
          <span className="font-semibold" style={{ color: standard.statusColor }}>
            {standard.actualScore}%
          </span>
        </div>
        {standard.gap > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Gap</span>
            <span className="font-semibold text-red-600">-{standard.gap}%</span>
          </div>
        )}
        
        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
          <div
            className="h-2 rounded-full transition-all duration-500"
            style={{ 
              width: `${(standard.actualScore / standard.targetScore) * 100}%`,
              backgroundColor: standard.statusColor
            }}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Engineer Performance Card
 */
export const EngineerPerformanceCard = ({ name, count, rank }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0 w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
          {rank}
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">{name}</h4>
          <p className="text-sm text-gray-600">{count} spot checks completed</p>
        </div>
        {rank === 1 && <Award className="w-6 h-6 text-yellow-500" />}
      </div>
    </div>
  );
};

/**
 * Client Activity Card
 */
export const ClientActivityCard = ({ name, count, projects }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="font-medium text-gray-900">{name}</h4>
          {projects && <p className="text-xs text-gray-500 mt-1">{projects} projects</p>}
        </div>
        <Users className="w-5 h-5 text-gray-400" />
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <span className="text-sm text-gray-600">Total Checks</span>
        <span className="text-lg font-bold text-gray-900">{count}</span>
      </div>
    </div>
  );
};

/**
 * Issue Summary Card
 */
export const IssueSummaryCard = ({ total, critical, resolved }) => {
  const resolutionRate = total > 0 ? (resolved / total) * 100 : 100;
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold mb-4">Issue Summary</h3>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Total Issues</span>
          <span className="text-2xl font-bold text-gray-900">{total}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Critical Issues</span>
          <span className="text-2xl font-bold text-red-600">{critical}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Resolved</span>
          <span className="text-2xl font-bold text-green-600">{resolved}</span>
        </div>
        
        <div className="pt-4 border-t border-gray-200">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Resolution Rate</span>
            <span className="font-semibold">{resolutionRate.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                resolutionRate >= 80 ? 'bg-green-500' : resolutionRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${resolutionRate}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Empty State Component
 */
export const SpotCheckEmptyState = ({ message = "No spot check data available" }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <FileText className="w-16 h-16 text-gray-300 mb-4" />
      <p className="text-gray-500 text-center">{message}</p>
    </div>
  );
};

/**
 * Pass Rate Indicator
 */
export const PassRateIndicator = ({ passRate, total }) => {
  const color = passRate >= 90 ? '#10b981' : passRate >= 75 ? '#3b82f6' : passRate >= 60 ? '#f59e0b' : '#ef4444';
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-gray-900">Pass Rate</h4>
        <CheckCircle className="w-5 h-5" style={{ color }} />
      </div>
      
      <div className="space-y-2">
        <div className="flex items-baseline space-x-2">
          <span className="text-4xl font-bold" style={{ color }}>
            {passRate.toFixed(1)}%
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-3 mt-3">
          <div
            className="h-3 rounded-full transition-all duration-500"
            style={{ width: `${passRate}%`, backgroundColor: color }}
          />
        </div>
        
        <p className="text-sm text-gray-600 mt-2">
          Based on {total} total spot checks
        </p>
      </div>
    </div>
  );
};
