import React from 'react';
import { Shield, TrendingDown, TrendingUp } from 'lucide-react';
import { HEALTH_SAFETY_UNAVAILABLE_REASONS } from '../../utils/healthSafetyMetrics';

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
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600', ring: 'ring-yellow-200', light: 'bg-yellow-50' },
    slate: { bg: 'bg-slate-100', text: 'text-slate-600', ring: 'ring-slate-200', light: 'bg-slate-50' }
  };

  const unavailable = value === null || value === undefined ||
    (typeof value === 'number' && !Number.isFinite(value));
  const colors = unavailable ? colorClasses.slate : (colorClasses[color] || colorClasses.blue);

  return (
    <div
      role="group"
      aria-label={title}
      className={`bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            {!unavailable && badge && (
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
        <p className={`font-bold text-gray-900 break-words ${unavailable ? 'text-xl' : 'text-3xl'}`}>{unavailable ? 'Unavailable' : value}</p>
        {!unavailable && typeof trend === 'number' && Number.isFinite(trend) && (
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
 * Unsupported safety classifications remain unavailable even if stale numeric
 * props reach these components. The current project feed is quality evidence.
 */
export const RiskLevelBadge = () => (
  <span
    className="inline-flex flex-col gap-1 text-slate-600"
  >
    <span className="inline-flex self-start px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 ring-1 ring-slate-200">
      Unavailable
    </span>
    <span className="text-xs">{HEALTH_SAFETY_UNAVAILABLE_REASONS.riskScore}</span>
  </span>
);

/**
 * Safety score definition and source records have not been established.
 * Ignore legacy numeric score props instead of assigning a reassuring category.
 */
export const SafetyScoreDisplay = ({
  size = 'md',
  reason = HEALTH_SAFETY_UNAVAILABLE_REASONS.safetyScore
}) => (
  <div className="flex flex-col items-center text-center">
    <p className="text-sm font-medium text-gray-600">Safety Score</p>
    <p className={`mt-2 font-bold text-slate-700 ${size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-2xl' : 'text-xl'}`}>
      Unavailable
    </p>
    <p className="mt-2 text-xs text-gray-600">{reason}</p>
  </div>
);

export const HighRiskProjectCard = () => (
  <div className="p-4 bg-white rounded-lg border border-gray-200">
    <p className="text-sm font-semibold text-gray-900">High Risk Projects</p>
    <p className="mt-1 text-sm font-semibold text-slate-600">Unavailable</p>
    <p className="mt-1 text-xs text-gray-600">{HEALTH_SAFETY_UNAVAILABLE_REASONS.highRiskProjects}</p>
  </div>
);

export const SafetyChecklistItem = () => (
  <div className="p-4 bg-white rounded-lg border border-gray-200">
    <p className="text-sm font-medium text-gray-900">Safety Compliance</p>
    <p className="mt-1 text-sm font-semibold text-slate-600">Unavailable</p>
    <p className="mt-1 text-xs text-gray-600">{HEALTH_SAFETY_UNAVAILABLE_REASONS.checklist}</p>
  </div>
);

export const ManagerSafetyCard = () => (
  <div className="p-4 bg-white rounded-lg border border-gray-200">
    <p className="text-sm font-semibold text-gray-900">Manager Safety Performance</p>
    <p className="mt-1 text-sm font-semibold text-slate-600">Unavailable</p>
    <p className="mt-1 text-xs text-gray-600">{HEALTH_SAFETY_UNAVAILABLE_REASONS.managerPerformance}</p>
  </div>
);

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
export const SafetyEmptyState = ({ title, message, icon: Icon = Shield }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
      <Icon className="text-gray-400 mb-4" size={48} />
      {title && <p className="text-base font-semibold text-slate-700 mb-2">{title}</p>}
      <p className="text-gray-600 text-sm text-center">{message}</p>
    </div>
  );
};
