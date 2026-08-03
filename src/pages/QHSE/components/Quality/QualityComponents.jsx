import React from 'react';
import { 
  FileCheck, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp,
  Calendar,
  ClipboardCheck,
  Target,
  Award,
  Eye
} from 'lucide-react';

/**
 * Quality Metric Card - Reusable component for displaying metrics
 */
export const QualityMetricCard = ({ 
  title, 
  value, 
  icon: Icon, 
  color = 'blue', 
  description, 
  trend,
  subtitle,
  onClick,
  showDetailButton = false
}) => {
  const colorClasses = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600', ring: 'ring-blue-200' },
    green: { bg: 'bg-green-100', text: 'text-green-600', ring: 'ring-green-200' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-600', ring: 'ring-orange-200' },
    red: { bg: 'bg-red-100', text: 'text-red-600', ring: 'ring-red-200' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600', ring: 'ring-purple-200' },
    cyan: { bg: 'bg-cyan-100', text: 'text-cyan-600', ring: 'ring-cyan-200' }
  };

  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <div 
      className={`bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 ${
        onClick ? 'cursor-pointer hover:border-blue-300' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mb-2">{subtitle}</p>
          )}
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            {trend && (
              <span className={`text-sm font-medium ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-gray-500 mt-2">{description}</p>
          )}
          {showDetailButton && onClick && (
            <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
              <Eye size={14} />
              <span>View Details</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colors.bg} ring-2 ${colors.ring}`}>
          <Icon className={colors.text} size={24} />
        </div>
      </div>
    </div>
  );
};

/**
 * Quality Status Badge
 */
export const QualityStatusBadge = ({ status, label }) => {
  const statusColors = {
    excellent: 'bg-green-100 text-green-700 ring-green-200',
    good: 'bg-blue-100 text-blue-700 ring-blue-200',
    fair: 'bg-yellow-100 text-yellow-700 ring-yellow-200',
    poor: 'bg-orange-100 text-orange-700 ring-orange-200',
    critical: 'bg-red-100 text-red-700 ring-red-200',
    compliant: 'bg-green-100 text-green-700 ring-green-200',
    nonCompliant: 'bg-red-100 text-red-700 ring-red-200'
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ring-1 ${statusColors[status] || statusColors.fair}`}>
      {label}
    </span>
  );
};

/**
 * Quality Progress Bar
 */
export const QualityProgressBar = ({ value, max = 100, color = 'blue', label, showPercentage = true }) => {
  const percentage = (value / max) * 100;
  
  const colorClasses = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    orange: 'bg-orange-600',
    red: 'bg-red-600',
    purple: 'bg-purple-600'
  };

  const bgColorClasses = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    orange: 'bg-orange-100',
    red: 'bg-red-100',
    purple: 'bg-purple-100'
  };

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          {showPercentage && (
            <span className="text-sm font-semibold text-gray-900">{percentage.toFixed(1)}%</span>
          )}
        </div>
      )}
      <div className={`w-full h-2 rounded-full ${bgColorClasses[color] || bgColorClasses.blue}`}>
        <div 
          className={`h-full rounded-full transition-all duration-500 ${colorClasses[color] || colorClasses.blue}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
};

/**
 * Audit Timeline Item
 */
export const AuditTimelineItem = ({ audit }) => {
  const statusColors = {
    COMPLETED: 'bg-green-100 text-green-700',
    DUE_SOON: 'bg-orange-100 text-orange-700',
    SCHEDULED: 'bg-blue-100 text-blue-700',
    DELAYED: 'bg-red-100 text-red-700'
  };

  const typeIcons = {
    PROJECT: ClipboardCheck,
    CLIENT: Award,
    INTERNAL: Target,
    EXTERNAL: FileCheck
  };

  const Icon = typeIcons[audit.auditType] || Calendar;

  return (
    <div className="flex items-start gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
      <div className={`p-2 rounded-lg ${statusColors[audit.status] || statusColors.SCHEDULED}`}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{audit.projectTitle}</p>
            <p className="text-xs text-gray-500 mt-1">
              {audit.auditType} Audit #{audit.auditNumber} • {audit.projectNo}
            </p>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[audit.status]}`}>
            {audit.status.replace('_', ' ')}
          </span>
        </div>
        <div className="flex items-center gap-4 mt-2">
          <span className="text-xs text-gray-600">
            📅 {new Date(audit.auditDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          {!audit.isPast && audit.daysUntil !== null && (
            <span className="text-xs font-medium text-blue-600">
              {audit.daysUntil > 0 ? `In ${audit.daysUntil} days` : audit.daysUntil === 0 ? 'Today' : `${Math.abs(audit.daysUntil)} days overdue`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Project Attention Card
 */
export const ProjectAttentionCard = ({ project, rank }) => {
  const getRankColor = (rank) => {
    if (rank === 1) return 'bg-red-100 text-red-700';
    if (rank === 2) return 'bg-orange-100 text-orange-700';
    if (rank === 3) return 'bg-yellow-100 text-yellow-700';
    return 'bg-blue-100 text-blue-700';
  };

  return (
    <div className="flex items-start gap-4 p-4 bg-white rounded-lg border-l-4 border-red-500 shadow-sm">
      <div className={`flex items-center justify-center w-8 h-8 rounded-full ${getRankColor(rank)} font-bold text-sm`}>
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{project.projectTitle}</p>
        <p className="text-xs text-gray-500 mt-1">{project.projectNo}</p>
        <div className="flex flex-wrap gap-3 mt-3">
          {project.openIssues > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-orange-700 bg-orange-50 px-2 py-1 rounded">
              <AlertTriangle size={12} />
              {project.openIssues} open issues
            </span>
          )}
          {project.delayedDays > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-1 rounded">
              <Calendar size={12} />
              {project.delayedDays} days delayed
            </span>
          )}
          {project.kpi < 70 && (
            <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded">
              <TrendingUp size={12} />
              {project.kpi}% KPI
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Compliance Matrix Row
 */
export const ComplianceMatrixRow = ({ category }) => {
  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">{category.name}</p>
        <p className="text-xs text-gray-500 mt-1">
          {category.compliantCount} / {category.totalCount} projects
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-32">
          <QualityProgressBar 
            value={category.complianceRate} 
            max={100}
            color={category.complianceRate >= 85 ? 'green' : category.complianceRate >= 70 ? 'orange' : 'red'}
            showPercentage={false}
          />
        </div>
        <div className="w-20 text-right">
          <span className={`text-sm font-bold ${category.complianceRate >= 85 ? 'text-green-600' : category.complianceRate >= 70 ? 'text-orange-600' : 'text-red-600'}`}>
            {category.complianceRate.toFixed(1)}%
          </span>
        </div>
        <QualityStatusBadge 
          status={category.complianceRate >= 85 ? 'compliant' : 'nonCompliant'}
          label={category.status.label}
        />
      </div>
    </div>
  );
};

/**
 * Empty State Component
 */
export const QualityEmptyState = ({ message, icon: Icon = FileCheck }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
      <Icon className="text-gray-400 mb-4" size={48} />
      <p className="text-gray-600 text-sm">{message}</p>
    </div>
  );
};
