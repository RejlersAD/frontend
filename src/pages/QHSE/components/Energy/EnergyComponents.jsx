/**
 * Reusable Energy Management Components
 * UI components for energy monitoring, efficiency, and optimization
 */

import React from 'react';
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Battery,
  Sun,
  Wind,
  DollarSign,
  Target,
  Award,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  Leaf
} from 'lucide-react';

/**
 * Energy Metric Card - Display key energy metrics
 */
export const EnergyMetricCard = ({ title, value, unit, change, icon: Icon, color = 'blue', subtext }) => {
  const isPositive = change > 0;
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600'
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        {change !== undefined && (
          <div className={`flex items-center text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
            {Math.abs(change)}%
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
 * Energy Score Display - Circular score indicator
 */
export const EnergyScoreDisplay = ({ score, size = 'large', label = 'Energy Score' }) => {
  const normalizedScore = Math.max(0, Math.min(100, score));
  const radius = size === 'large' ? 60 : 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalizedScore / 100) * circumference;
  
  const scoreColor = 
    normalizedScore >= 80 ? '#10b981' :
    normalizedScore >= 60 ? '#3b82f6' :
    normalizedScore >= 40 ? '#f59e0b' : '#ef4444';

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
 * Energy Source Badge - Colored badge for energy sources
 */
export const EnergySourceBadge = ({ source, value, percentage, color, icon, isRenewable }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">{icon}</span>
          <span className="font-medium text-gray-900">{source}</span>
        </div>
        {isRenewable && (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
            Renewable
          </span>
        )}
      </div>
      <div className="space-y-1">
        <div className="flex items-baseline space-x-2">
          <span className="text-xl font-bold text-gray-900">{value?.toLocaleString()}</span>
          <span className="text-sm text-gray-500">kWh</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%`, backgroundColor: color }}
          />
        </div>
        <p className="text-xs text-gray-600">{percentage}% of total</p>
      </div>
    </div>
  );
};

/**
 * Efficiency Initiative Card - Display initiative details
 */
export const EfficiencyInitiativeCard = ({ initiative, onSelect }) => {
  const statusConfig = {
    implemented: { color: 'green', icon: CheckCircle, text: 'Implemented' },
    in_progress: { color: 'blue', icon: Clock, text: 'In Progress' },
    planned: { color: 'gray', icon: Target, text: 'Planned' }
  };

  const priorityConfig = {
    high: { color: 'red', text: 'High Priority' },
    medium: { color: 'yellow', text: 'Medium Priority' },
    low: { color: 'gray', text: 'Low Priority' }
  };

  const status = statusConfig[initiative.status] || statusConfig.planned;
  const priority = priorityConfig[initiative.priority] || priorityConfig.medium;
  const StatusIcon = status.icon;

  return (
    <div 
      className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-lg transition-all cursor-pointer"
      onClick={() => onSelect && onSelect(initiative)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 mb-1">{initiative.name}</h4>
          <p className="text-sm text-gray-600">{initiative.category}</p>
        </div>
        <StatusIcon className={`w-5 h-5 text-${status.color}-600 flex-shrink-0 ml-2`} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <p className="text-xs text-gray-500">Potential Savings</p>
          <p className="text-lg font-bold text-green-600">{initiative.savingsPotential}%</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Annual Savings</p>
          <p className="text-lg font-bold text-gray-900">${initiative.annualSavings?.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <p className="text-xs text-gray-500">Implementation Cost</p>
          <p className="text-sm font-medium text-gray-700">${initiative.implementationCost?.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Payback Period</p>
          <p className="text-sm font-medium text-gray-700">{initiative.paybackMonths} months</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <span className={`px-3 py-1 bg-${priority.color}-100 text-${priority.color}-700 text-xs font-medium rounded-full`}>
          {priority.text}
        </span>
        <span className={`px-3 py-1 bg-${status.color}-100 text-${status.color}-700 text-xs font-medium rounded-full`}>
          {status.text}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-gray-600">ROI: <span className="font-semibold text-gray-900">{initiative.roi}%</span></span>
      </div>
    </div>
  );
};

/**
 * Smart Technology Status Card
 */
export const SmartTechnologyCard = ({ technology }) => {
  const maturityConfig = {
    deployed: { color: 'green', icon: CheckCircle, text: 'Deployed' },
    testing: { color: 'blue', icon: Clock, text: 'Testing' },
    planned: { color: 'gray', icon: Target, text: 'Planned' }
  };

  const impactConfig = {
    high: { color: 'green', text: 'High Impact', icon: TrendingUp },
    medium: { color: 'yellow', text: 'Medium Impact', icon: BarChart3 },
    low: { color: 'gray', text: 'Low Impact', icon: TrendingDown }
  };

  const maturity = maturityConfig[technology.maturityLevel] || maturityConfig.planned;
  const impact = impactConfig[technology.energyImpact] || impactConfig.medium;
  const MaturityIcon = maturity.icon;
  const ImpactIcon = impact.icon;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-medium text-gray-900 mb-1">{technology.name}</h4>
          <p className="text-sm text-gray-600">{technology.category}</p>
        </div>
        <MaturityIcon className={`w-5 h-5 text-${maturity.color}-600`} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Status</span>
          <span className={`px-2 py-1 bg-${maturity.color}-100 text-${maturity.color}-700 text-xs font-medium rounded-full`}>
            {maturity.text}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Energy Impact</span>
          <div className="flex items-center space-x-1">
            <ImpactIcon className={`w-4 h-4 text-${impact.color}-600`} />
            <span className={`text-xs font-medium text-${impact.color}-700`}>
              {impact.text}
            </span>
          </div>
        </div>

        {technology.dataPoints > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-500">Data Points</span>
            <span className="text-sm font-bold text-gray-900">
              {technology.dataPoints?.toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Cost Optimization Card
 */
export const CostOptimizationCard = ({ opportunity, rank }) => {
  const complexityConfig = {
    low: { color: 'green', text: 'Low', icon: CheckCircle },
    medium: { color: 'yellow', text: 'Medium', icon: AlertCircle },
    high: { color: 'red', text: 'High', icon: AlertCircle }
  };

  const complexity = complexityConfig[opportunity.complexity] || complexityConfig.medium;
  const ComplexityIcon = complexity.icon;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
            {rank}
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-1">{opportunity.category}</h4>
            <p className="text-sm text-gray-600">{opportunity.description}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">Potential Savings</p>
          <div className="flex items-baseline space-x-1">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="text-lg font-bold text-green-600">
              {opportunity.potentialSavings?.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1">{opportunity.savingsPercentage}% reduction</p>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">Complexity</p>
          <div className="flex items-center space-x-1">
            <ComplexityIcon className={`w-4 h-4 text-${complexity.color}-600`} />
            <span className={`text-sm font-medium text-${complexity.color}-700`}>
              {complexity.text}
            </span>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1">Timeframe</p>
          <div className="flex items-center space-x-1">
            <Clock className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">{opportunity.timeframe}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Carbon Reduction Milestone
 */
export const CarbonReductionMilestone = ({ milestone, isLast }) => {
  const statusConfig = {
    completed: { color: 'green', icon: CheckCircle, bg: 'bg-green-100', text: 'text-green-600' },
    in_progress: { color: 'blue', icon: Clock, bg: 'bg-blue-100', text: 'text-blue-600' },
    planned: { color: 'gray', icon: Target, bg: 'bg-gray-100', text: 'text-gray-600' }
  };

  const status = statusConfig[milestone.status] || statusConfig.planned;
  const StatusIcon = status.icon;

  return (
    <div className="flex items-start space-x-4">
      <div className="flex flex-col items-center">
        <div className={`w-10 h-10 ${status.bg} rounded-full flex items-center justify-center`}>
          <StatusIcon className={`w-5 h-5 ${status.text}`} />
        </div>
        {!isLast && <div className="w-0.5 h-16 bg-gray-200 mt-2" />}
      </div>

      <div className="flex-1 pb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h4 className="font-semibold text-gray-900">{milestone.year}</h4>
              <p className="text-sm text-gray-600 mt-1">{milestone.initiative}</p>
            </div>
            <span className={`px-3 py-1 ${status.bg} ${status.text} text-xs font-medium rounded-full`}>
              {status.text.replace('text-', '')}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4">
            <div>
              <p className="text-xs text-gray-500">Target Reduction</p>
              <p className="text-lg font-bold text-green-600">{milestone.targetReduction}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Target Emissions</p>
              <p className="text-lg font-bold text-gray-900">{milestone.targetEmissions} tons</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Cumulative Savings</p>
              <p className="text-lg font-bold text-blue-600">{milestone.cumulativeSavings} tons</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Renewable Energy Progress Bar
 */
export const RenewableEnergyProgress = ({ current, target = 100, label }) => {
  const percentage = Math.min(100, (current / target) * 100);
  const isOnTrack = percentage >= 80;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Leaf className={`w-5 h-5 ${isOnTrack ? 'text-green-600' : 'text-yellow-600'}`} />
          <span className="font-medium text-gray-900">{label}</span>
        </div>
        <span className={`text-sm font-semibold ${isOnTrack ? 'text-green-600' : 'text-yellow-600'}`}>
          {Math.round(percentage)}%
        </span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
        <div
          className={`h-3 rounded-full transition-all duration-500 ${
            isOnTrack ? 'bg-green-500' : 'bg-yellow-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>Current: {current?.toLocaleString()}</span>
        <span>Target: {target?.toLocaleString()}</span>
      </div>
    </div>
  );
};

/**
 * Empty State Component
 */
export const EnergyEmptyState = ({ message = "No energy data available" }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <Zap className="w-16 h-16 text-gray-300 mb-4" />
      <p className="text-gray-500 text-center">{message}</p>
    </div>
  );
};

/**
 * Peak Demand Indicator
 */
export const PeakDemandIndicator = ({ current, peak, threshold }) => {
  const percentage = (current / peak) * 100;
  const isAboveThreshold = current > threshold;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-gray-900">Peak Demand Status</h4>
        <Battery className={`w-5 h-5 ${isAboveThreshold ? 'text-red-600' : 'text-green-600'}`} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Current Demand</span>
          <span className="font-bold text-gray-900">{current?.toLocaleString()} kW</span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              isAboveThreshold ? 'bg-red-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>Threshold: {threshold?.toLocaleString()} kW</span>
          <span className={isAboveThreshold ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
            {isAboveThreshold ? 'Above' : 'Below'} Threshold
          </span>
        </div>
      </div>
    </div>
  );
};
