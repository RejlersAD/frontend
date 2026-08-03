import React from 'react';
import { 
  Shield, 
  AlertTriangle, 
  Activity,
  UserCheck,
  HardHat,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Clock,
  CheckCircle2
} from 'lucide-react';

/**
 * Safety Metric Card - Enhanced metric display for H&S
 */
export const SafetyMetricCard = ({ 
  title, 
  value, 
  icon: Icon, 
  color = 'blue', 
  description, 
  trend,
  subtitle,
  badge,
  onClick 
}) => {
  const colorClasses = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600', ring: 'ring-blue-200', light: 'bg-blue-50' },
    green: { bg: 'bg-green-100', text: 'text-green-600', ring: 'ring-green-200', light: 'bg-green-50' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-600', ring: 'ring-orange-200', light: 'bg-orange-50' },
    red: { bg: 'bg-red-100', text: 'text-red-600', ring: 'ring-red-200', light: 'bg-red-50' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600', ring: 'ring-purple-200', light: 'bg-purple-50' },
    cyan: { bg: 'bg-cyan-100', text: 'text-cyan-600', ring: 'ring-cyan-200', light: 'bg-cyan-50' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600', ring: 'ring-yellow-200', light: 'bg-yellow-50' }
  };

  const colors = colorClasses[color] || colorClasses.blue;

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
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-sm font-medium ${trend > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {trend > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
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
 * Risk Level Badge
 */
export const RiskLevelBadge = ({ level }) => {
  const levelColors = {
    'Very High': 'bg-red-900 text-white ring-red-700',
    'High': 'bg-red-600 text-white ring-red-400',
    'Medium': 'bg-orange-500 text-white ring-orange-300',
    'Low': 'bg-blue-500 text-white ring-blue-300',
    'Very Low': 'bg-green-500 text-white ring-green-300'
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ring-2 ${levelColors[level] || levelColors.Medium}`}>
      {level}
    </span>
  );
};

/**
 * Safety Score Display with visual indicator
 */
export const SafetyScoreDisplay = ({ score, size = 'md' }) => {
  const getColor = (score) => {
    if (score >= 95) return { color: '#10b981', label: 'Excellent' };
    if (score >= 85) return { color: '#3b82f6', label: 'Very Good' };
    if (score >= 75) return { color: '#22c55e', label: 'Good' };
    if (score >= 60) return { color: '#f59e0b', label: 'Fair' };
    if (score >= 40) return { color: '#ef4444', label: 'Poor' };
    return { color: '#dc2626', label: 'Critical' };
  };

  const { color, label } = getColor(score);
  const radius = size === 'lg' ? 60 : size === 'md' ? 50 : 40;
  const strokeWidth = size === 'lg' ? 8 : size === 'md' ? 6 : 4;
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
          <span className={`font-bold ${size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-2xl' : 'text-xl'}`} style={{ color }}>
            {score}
          </span>
          <span className="text-xs text-gray-500 font-medium">/100</span>
        </div>
      </div>
      <span className={`mt-2 text-sm font-medium`} style={{ color }}>
        {label}
      </span>
    </div>
  );
};

/**
 * High Risk Project Card
 */
export const HighRiskProjectCard = ({ project, rank }) => {
  const getRankColor = (rank) => {
    if (rank === 1) return 'bg-red-600 text-white';
    if (rank === 2) return 'bg-orange-500 text-white';
    if (rank === 3) return 'bg-yellow-500 text-white';
    return 'bg-blue-500 text-white';
  };

  const getRiskColor = (level) => {
    const colors = {
      'Very High': 'border-red-900',
      'High': 'border-red-600',
      'Medium': 'border-orange-500',
      'Low': 'border-blue-500',
      'Very Low': 'border-green-500'
    };
    return colors[level] || 'border-orange-500';
  };

  return (
    <div className={`flex items-start gap-4 p-4 bg-white rounded-lg border-l-4 ${getRiskColor(project.riskLevel.label)} shadow-sm hover:shadow-md transition-shadow`}>
      <div className={`flex items-center justify-center w-10 h-10 rounded-full ${getRankColor(rank)} font-bold text-sm flex-shrink-0`}>
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{project.projectTitle}</p>
            <p className="text-xs text-gray-500 mt-1">{project.projectNo} • {project.projectManager}</p>
          </div>
          <RiskLevelBadge level={project.riskLevel.label} />
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {project.openIncidents > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-1 rounded-md">
              <AlertCircle size={12} />
              {project.openIncidents} open incidents
            </span>
          )}
          {project.nearMisses > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-orange-700 bg-orange-50 px-2 py-1 rounded-md">
              <AlertTriangle size={12} />
              {project.nearMisses} near misses
            </span>
          )}
          {project.delayDays > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded-md">
              <Clock size={12} />
              {project.delayDays} days delayed
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs text-purple-700 bg-purple-50 px-2 py-1 rounded-md">
            <Activity size={12} />
            KPI: {project.kpi}%
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Safety Checklist Item
 */
export const SafetyChecklistItem = ({ item }) => {
  const getStatusColor = (status) => {
    const colors = {
      excellent: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2 },
      good: { bg: 'bg-blue-100', text: 'text-blue-700', icon: CheckCircle2 },
      fair: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: AlertTriangle },
      poor: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertCircle }
    };
    return colors[status] || colors.fair;
  };

  const statusStyle = getStatusColor(item.status);
  const StatusIcon = statusStyle.icon;

  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
      <div className="flex items-center gap-3 flex-1">
        <div className={`p-2 rounded-lg ${statusStyle.bg}`}>
          <StatusIcon className={statusStyle.text} size={20} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">{item.name}</p>
          <p className="text-xs text-gray-500 mt-1">
            {item.compliant} of {item.total} projects • Weight: {item.weight}x
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className={`text-lg font-bold ${statusStyle.text}`}>
            {item.complianceRate.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 capitalize">{item.status}</p>
        </div>
        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full ${statusStyle.bg} transition-all duration-500`}
            style={{ width: `${Math.min(item.complianceRate, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Manager Safety Performance Card
 */
export const ManagerSafetyCard = ({ manager, rank }) => {
  const getScoreColor = (score) => {
    if (score >= 85) return 'text-green-600 bg-green-50';
    if (score >= 70) return 'text-blue-600 bg-blue-50';
    if (score >= 50) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-bold text-sm">
        {rank}
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-gray-900">{manager.name}</p>
        <p className="text-xs text-gray-500 mt-1">
          {manager.projectCount} projects • Avg KPI: {manager.avgKPI}%
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-xs text-gray-500">Incidents</p>
          <p className={`text-sm font-bold ${manager.totalIncidents === 0 ? 'text-green-600' : 'text-red-600'}`}>
            {manager.totalIncidents}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Near Miss</p>
          <p className={`text-sm font-bold ${manager.totalNearMiss === 0 ? 'text-green-600' : 'text-orange-600'}`}>
            {manager.totalNearMiss}
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full ${getScoreColor(manager.safetyScore)}`}>
          <p className="text-sm font-bold">{manager.safetyScore}</p>
        </div>
      </div>
    </div>
  );
};

/**
 * Incident Timeline Item
 */
export const IncidentTimelineItem = ({ incident, index }) => {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-red-500' : 'bg-gray-300'} ring-4 ring-white`} />
        {index !== 'last' && <div className="w-0.5 h-full bg-gray-200 mt-1" />}
      </div>
      <div className="flex-1 pb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="text-sm font-semibold text-gray-900">{incident.title}</p>
              <p className="text-xs text-gray-500 mt-1">{incident.project} • {incident.date}</p>
            </div>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              incident.severity === 'Major' ? 'bg-red-100 text-red-700' :
              incident.severity === 'Minor' ? 'bg-orange-100 text-orange-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {incident.severity}
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-2">{incident.description}</p>
        </div>
      </div>
    </div>
  );
};

/**
 * PPE Status Card
 */
export const PPEStatusCard = ({ ppe, status }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{ppe.icon}</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">{ppe.label}</p>
          <p className="text-xs text-gray-500">{ppe.mandatory ? 'Mandatory' : 'Optional'}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${status >= 90 ? 'text-green-600' : status >= 70 ? 'text-orange-600' : 'text-red-600'}`}>
          {status}% Compliant
        </span>
        <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full ${status >= 90 ? 'bg-green-600' : status >= 70 ? 'bg-orange-600' : 'bg-red-600'} transition-all duration-500`}
            style={{ width: `${status}%` }}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * Safety Empty State
 */
export const SafetyEmptyState = ({ message, icon: Icon = Shield }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
      <Icon className="text-gray-400 mb-4" size={48} />
      <p className="text-gray-600 text-sm text-center">{message}</p>
    </div>
  );
};
