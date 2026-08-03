import React from 'react';
import { 
  Leaf, 
  Droplets,
  Zap,
  Trash2,
  Wind,
  TreePine,
  Globe,
  TrendingDown,
  TrendingUp,
  Award,
  AlertTriangle
} from 'lucide-react';

/**
 * Environmental Metric Card
 */
export const EnvironmentalMetricCard = ({ 
  title, 
  value, 
  icon: Icon, 
  color = 'green', 
  description, 
  trend,
  subtitle,
  unit,
  badge,
  onClick 
}) => {
  const colorClasses = {
    green: { bg: 'bg-green-100', text: 'text-green-600', ring: 'ring-green-200', light: 'bg-green-50' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-600', ring: 'ring-blue-200', light: 'bg-blue-50' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-600', ring: 'ring-orange-200', light: 'bg-orange-50' },
    red: { bg: 'bg-red-100', text: 'text-red-600', ring: 'ring-red-200', light: 'bg-red-50' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600', ring: 'ring-purple-200', light: 'bg-purple-50' },
    cyan: { bg: 'bg-cyan-100', text: 'text-cyan-600', ring: 'ring-cyan-200', light: 'bg-cyan-50' },
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', ring: 'ring-emerald-200', light: 'bg-emerald-50' }
  };

  const colors = colorClasses[color] || colorClasses.green;

  return (
    <div 
      className={`bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            {badge && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors.light} ${colors.text}`}>
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-gray-500 mb-2">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colors.bg} ring-2 ${colors.ring}`}>
          <Icon className={colors.text} size={24} />
        </div>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {unit && <span className="text-sm text-gray-500 font-medium">{unit}</span>}
        {trend !== undefined && trend !== 0 && (
          <div className={`flex items-center gap-1 text-sm font-medium ${trend < 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend < 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      {description && (
        <p className="text-xs text-gray-500">{description}</p>
      )}
    </div>
  );
};

/**
 * Environmental Score Display with circular progress
 */
export const EnvironmentalScoreDisplay = ({ score, size = 'md' }) => {
  const getColor = (score) => {
    if (score >= 90) return { color: '#10b981', label: 'Excellent' };
    if (score >= 80) return { color: '#22c55e', label: 'Very Good' };
    if (score >= 70) return { color: '#3b82f6', label: 'Good' };
    if (score >= 55) return { color: '#f59e0b', label: 'Fair' };
    if (score >= 40) return { color: '#ef4444', label: 'Poor' };
    return { color: '#dc2626', label: 'Critical' };
  };

  const { color, label } = getColor(score);
  const radius = size === 'lg' ? 70 : size === 'md' ? 55 : 45;
  const strokeWidth = size === 'lg' ? 10 : size === 'md' ? 8 : 6;
  const circumference = 2 * Math.PI * (radius - strokeWidth / 2);
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative inline-flex items-center justify-center">
        <svg width={radius * 2} height={radius * 2} className="transform -rotate-90">
          <circle
            cx={radius}
            cy={radius}
            r={radius - strokeWidth / 2}
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={radius}
            cy={radius}
            r={radius - strokeWidth / 2}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold ${size === 'lg' ? 'text-4xl' : size === 'md' ? 'text-3xl' : 'text-2xl'}`} style={{ color }}>
            {score}
          </span>
          <span className="text-xs text-gray-500 font-medium mt-1">/100</span>
        </div>
      </div>
      <span className={`mt-3 text-sm font-semibold`} style={{ color }}>
        {label}
      </span>
      <span className="text-xs text-gray-500 mt-1">Environmental Performance</span>
    </div>
  );
};

/**
 * High Impact Project Card
 */
export const HighImpactProjectCard = ({ project, rank }) => {
  const getRankColor = (rank) => {
    if (rank === 1) return 'bg-red-600 text-white';
    if (rank === 2) return 'bg-orange-500 text-white';
    if (rank === 3) return 'bg-yellow-500 text-white';
    return 'bg-blue-500 text-white';
  };

  const getImpactColor = (level) => {
    const colors = {
      'Very High': 'border-red-900',
      'High': 'border-red-600',
      'Moderate': 'border-orange-500',
      'Low': 'border-blue-500',
      'Very Low': 'border-green-500'
    };
    return colors[level] || 'border-orange-500';
  };

  return (
    <div className={`flex items-start gap-4 p-4 bg-white rounded-lg border-l-4 ${getImpactColor(project.impactLevel.label)} shadow-sm hover:shadow-md transition-shadow`}>
      <div className={`flex items-center justify-center w-10 h-10 rounded-full ${getRankColor(rank)} font-bold text-sm flex-shrink-0`}>
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{project.projectTitle}</p>
            <p className="text-xs text-gray-500 mt-1">{project.projectNo} • {project.projectManager}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold text-white`} style={{ backgroundColor: project.impactLevel.color }}>
            {project.impactLevel.label}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="text-center bg-red-50 rounded-lg p-2">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Wind size={12} className="text-red-600" />
              <span className="text-xs font-medium text-gray-600">Carbon</span>
            </div>
            <p className="text-sm font-bold text-gray-900">{(project.carbonEmissions / 1000).toFixed(1)}t</p>
          </div>
          <div className="text-center bg-orange-50 rounded-lg p-2">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Trash2 size={12} className="text-orange-600" />
              <span className="text-xs font-medium text-gray-600">Waste</span>
            </div>
            <p className="text-sm font-bold text-gray-900">{(project.waste / 1000).toFixed(1)}t</p>
          </div>
          <div className="text-center bg-blue-50 rounded-lg p-2">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Droplets size={12} className="text-blue-600" />
              <span className="text-xs font-medium text-gray-600">Water</span>
            </div>
            <p className="text-sm font-bold text-gray-900">{(project.waterUsage / 1000).toFixed(1)}kL</p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Sustainability Goal Progress Card
 */
export const SustainabilityGoalCard = ({ goalData }) => {
  const { goal, progress, target, description } = goalData;
  const percentage = (progress / target) * 100;
  const isOnTrack = progress >= target * 0.8;

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <div 
          className="flex items-center justify-center w-14 h-14 rounded-lg text-white font-bold text-lg flex-shrink-0"
          style={{ backgroundColor: goal.color }}
        >
          SDG {goal.number}
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-gray-900 mb-1">{goal.label}</h4>
          <p className="text-xs text-gray-600 mb-3">{description}</p>
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">Progress</span>
              <span className={`text-xs font-bold ${isOnTrack ? 'text-green-600' : 'text-orange-600'}`}>
                {progress.toFixed(1)}% / {target}%
              </span>
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${isOnTrack ? 'bg-green-500' : 'bg-orange-500'}`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
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
  const isCompliant = standard.status === 'Compliant';
  
  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-semibold text-gray-900">{standard.standard}</p>
          {isCompliant && <Award size={16} className="text-green-600" />}
        </div>
        <p className="text-xs text-gray-500">{standard.description}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-xs text-gray-500 mb-1">Threshold: {standard.threshold}%</p>
          <p className={`text-lg font-bold ${isCompliant ? 'text-green-600' : 'text-red-600'}`}>
            {standard.currentScore.toFixed(1)}%
          </p>
          {!isCompliant && (
            <p className="text-xs text-orange-600 mt-1">Gap: {standard.gap.toFixed(1)}%</p>
          )}
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${isCompliant ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {standard.status}
        </span>
      </div>
    </div>
  );
};

/**
 * Waste Category Card
 */
export const WasteCategoryCard = ({ waste }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{waste.icon}</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">{waste.name}</p>
          <p className="text-xs text-gray-500">{waste.recyclable ? 'Recyclable' : 'Non-recyclable'}</p>
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-gray-900">{(waste.value / 1000).toFixed(1)}<span className="text-sm text-gray-500 ml-1">tons</span></p>
          <p className="text-xs text-gray-500 mt-1">{waste.percentage}% of total</p>
        </div>
        <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: waste.color + '20' }}>
          <span className="text-lg font-bold" style={{ color: waste.color }}>{waste.percentage}%</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Resource Consumption Badge
 */
export const ResourceBadge = ({ resource, value, unit, icon: Icon, color }) => {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg bg-${color}-50 border border-${color}-200`}>
      <Icon className={`text-${color}-600`} size={20} />
      <div>
        <p className="text-xs text-gray-600 font-medium">{resource}</p>
        <p className={`text-lg font-bold text-${color}-700`}>
          {typeof value === 'number' ? value.toLocaleString() : value} <span className="text-xs font-normal">{unit}</span>
        </p>
      </div>
    </div>
  );
};

/**
 * Environmental Empty State
 */
export const EnvironmentalEmptyState = ({ message, icon: Icon = TreePine }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 bg-gradient-to-br from-green-50 to-blue-50 rounded-lg border-2 border-dashed border-green-300">
      <Icon className="text-green-400 mb-4" size={48} />
      <p className="text-gray-600 text-sm text-center">{message}</p>
    </div>
  );
};

/**
 * Carbon Footprint Indicator
 */
export const CarbonFootprintIndicator = ({ emissions, intensity }) => {
  const getEmissionLevel = (emissions) => {
    if (emissions < 5000) return { label: 'Very Low', color: '#10b981', icon: '🌿' };
    if (emissions < 15000) return { label: 'Low', color: '#22c55e', icon: '🌱' };
    if (emissions < 30000) return { label: 'Moderate', color: '#3b82f6', icon: '🔵' };
    if (emissions < 60000) return { label: 'High', color: '#f59e0b', icon: '⚠️' };
    return { label: 'Very High', color: '#ef4444', icon: '🔴' };
  };

  const level = getEmissionLevel(emissions);

  return (
    <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-gray-900">Carbon Footprint</h4>
        <span className="text-2xl">{level.icon}</span>
      </div>
      <div className="text-center mb-4">
        <p className="text-4xl font-bold text-gray-900">{(emissions / 1000).toFixed(1)}</p>
        <p className="text-sm text-gray-500 mt-1">tons CO2e</p>
      </div>
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <span className="text-xs text-gray-600">Intensity per project</span>
        <span className="text-sm font-bold text-gray-900">{(intensity / 1000).toFixed(2)}t</span>
      </div>
      <div className="mt-3">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-white w-full justify-center`} style={{ backgroundColor: level.color }}>
          {level.label} Impact
        </span>
      </div>
    </div>
  );
};
