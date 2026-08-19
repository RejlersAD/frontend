import React, { useRef, useState, useMemo } from 'react';
import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import {
  AlertTriangle,
  Clock,
  BarChart2,
  DollarSign,
  Eye
} from 'lucide-react';

// ✅ CORRECTED: Update thresholds for over-billability focus
const THRESHOLDS = {
  CARS_CRITICAL: 5,
  CARS_HIGH: 3,
  AUDIT_CRITICAL: 10,
  AUDIT_HIGH: 5,
  KPI_CRITICAL: 60,
  KPI_HIGH: 70,
  // ✅ FIXED: Over-billability thresholds (high values are the problem)
  BILLABILITY_CRITICAL: 120,  // Over 120% is critical
  BILLABILITY_HIGH: 100,      // Over 100% is high risk
  OBS_CRITICAL_DELAY: 14,
  OBS_HIGH_DELAY: 7,
  OBS_HIGH_COUNT: 10
};

const iconMap = {
  CARs: <AlertTriangle className="w-7 h-7 text-red-500 drop-shadow" />,
  Audit: <Clock className="w-7 h-7 text-orange-500 drop-shadow" />,
  KPI: <BarChart2 className="w-7 h-7 text-red-500 drop-shadow" />,
  Billability: <DollarSign className="w-7 h-7 text-yellow-500 drop-shadow" />,
  Observations: <Eye className="w-7 h-7 text-orange-500 drop-shadow" />
};

const issueTypeMap = {
  "Critical CARs": "CARs",
  "Audit Delays": "Audit",
  "Poor KPI Performance": "KPI",
  "Billability Issues": "Billability"
};

// ✅ OPTIMIZED: Helper functions moved outside component
const parsePercentage = (value) => {
  if (!value || value === '' || value === 'N/A') return 0;
  const numericValue = parseFloat(value.toString().replace('%', ''));
  return isNaN(numericValue) ? 0 : numericValue;
};

const parseNumber = (value) => {
  if (!value || value === '' || value === 'N/A') return 0;
  const numericValue = Number(value);
  return isNaN(numericValue) ? 0 : numericValue;
};

const CriticalIssues = ({ filteredProjects }) => {
  const [selectedType, setSelectedType] = useState(null);
  const detailsRef = useRef(null);

  // ✅ OPTIMIZED: Memoized critical issues detection
  const criticalIssues = useMemo(() => {
    if (!filteredProjects?.length) return [];

    const issues = [];

    filteredProjects.forEach(project => {
      // Parse values once per project
      const projectData = {
        carsOpen: parseNumber(project.carsOpen),
        carsDelayedClosingNoDays: parseNumber(project.carsDelayedClosingNoDays),
        delayInAuditsNoDays: parseNumber(project.delayInAuditsNoDays),
        projectKPIsAchievedPercent: parsePercentage(project.projectKPIsAchievedPercent),
        qualityBillabilityPercent: parsePercentage(project.qualityBillabilityPercent),
        obsOpen: parseNumber(project.obsOpen),
        obsDelayedClosingNoDays: parseNumber(project.obsDelayedClosingNoDays),
        projectTitle: project.projectTitle || 'Unnamed Project',
        projectNo: project.projectNo || project.srNo || 'No Project Number'
      };

      // ✅ STREAMLINED: CARs Issues
      if (projectData.carsOpen > THRESHOLDS.CARS_CRITICAL) {
        issues.push({
          type: 'CARs',
          severity: 'Critical',
          title: `${projectData.carsOpen} Open CARs`,
          project: projectData.projectTitle,
          projectNo: projectData.projectNo,
          details: projectData.carsDelayedClosingNoDays > 0 
            ? `${projectData.carsDelayedClosingNoDays} days delayed closing`
            : 'Multiple open CARs requiring attention',
          count: projectData.carsOpen,
          sortValue: projectData.carsOpen
        });
      } else if (projectData.carsOpen >= THRESHOLDS.CARS_HIGH) {
        issues.push({
          type: 'CARs',
          severity: 'High',
          title: `${projectData.carsOpen} Open CARs`,
          project: projectData.projectTitle,
          projectNo: projectData.projectNo,
          details: projectData.carsDelayedClosingNoDays > 0 
            ? `${projectData.carsDelayedClosingNoDays} days delayed closing`
            : 'Several open CARs need attention',
          count: projectData.carsOpen,
          sortValue: projectData.carsOpen
        });
      }

      // ✅ STREAMLINED: Audit Issues
      if (projectData.delayInAuditsNoDays > THRESHOLDS.AUDIT_CRITICAL) {
        issues.push({
          type: 'Audit',
          severity: 'Critical',
          title: `Audit Delayed ${projectData.delayInAuditsNoDays} Days`,
          project: projectData.projectTitle,
          projectNo: projectData.projectNo,
          details: 'Critical audit timeline breach requiring immediate action',
          count: projectData.delayInAuditsNoDays,
          sortValue: projectData.delayInAuditsNoDays
        });
      } else if (projectData.delayInAuditsNoDays >= THRESHOLDS.AUDIT_HIGH) {
        issues.push({
          type: 'Audit',
          severity: 'High',
          title: `Audit Delayed ${projectData.delayInAuditsNoDays} Days`,
          project: projectData.projectTitle,
          projectNo: projectData.projectNo,
          details: 'Audit schedule needs attention',
          count: projectData.delayInAuditsNoDays,
          sortValue: projectData.delayInAuditsNoDays
        });
      }

      // ✅ STREAMLINED: KPI Issues
      if (projectData.projectKPIsAchievedPercent > 0) {
        if (projectData.projectKPIsAchievedPercent < THRESHOLDS.KPI_CRITICAL) {
          issues.push({
            type: 'KPI',
            severity: 'Critical',
            title: `KPI Achievement: ${projectData.projectKPIsAchievedPercent}%`,
            project: projectData.projectTitle,
            projectNo: projectData.projectNo,
            details: 'Significantly below acceptable performance threshold',
            count: projectData.projectKPIsAchievedPercent,
            sortValue: 100 - projectData.projectKPIsAchievedPercent
          });
        } else if (projectData.projectKPIsAchievedPercent < THRESHOLDS.KPI_HIGH) {
          issues.push({
            type: 'KPI',
            severity: 'High',
            title: `KPI Achievement: ${projectData.projectKPIsAchievedPercent}%`,
            project: projectData.projectTitle,
            projectNo: projectData.projectNo,
            details: 'Below target performance threshold',
            count: projectData.projectKPIsAchievedPercent,
            sortValue: 100 - projectData.projectKPIsAchievedPercent
          });
        }
      }

      // ✅ CORRECTED: Billability Issues Logic
      if (projectData.qualityBillabilityPercent > 0) {
        if (projectData.qualityBillabilityPercent > THRESHOLDS.BILLABILITY_CRITICAL) {
          issues.push({
            type: 'Billability',
            severity: 'Critical',
            title: `Quality Billability: ${projectData.qualityBillabilityPercent}%`,
            project: projectData.projectTitle,
            projectNo: projectData.projectNo,
            details: 'Critical over-billability - potential scope creep and budget impact',
            count: projectData.qualityBillabilityPercent,
            sortValue: projectData.qualityBillabilityPercent // Higher values = worse
          });
        } else if (projectData.qualityBillabilityPercent > THRESHOLDS.BILLABILITY_HIGH) {
          issues.push({
            type: 'Billability',
            severity: 'High',
            title: `Quality Billability: ${projectData.qualityBillabilityPercent}%`,
            project: projectData.projectTitle,
            projectNo: projectData.projectNo,
            details: 'Over-billability detected - monitor for scope creep',
            count: projectData.qualityBillabilityPercent,
            sortValue: projectData.qualityBillabilityPercent
          });
        }
      }

      // ✅ STREAMLINED: Observation Issues
      if (projectData.obsDelayedClosingNoDays > THRESHOLDS.OBS_CRITICAL_DELAY) {
        issues.push({
          type: 'Observations',
          severity: 'Critical',
          title: `${projectData.obsOpen} Open Observations`,
          project: projectData.projectTitle,
          projectNo: projectData.projectNo,
          details: `${projectData.obsDelayedClosingNoDays} days delayed - critical overdue`,
          count: projectData.obsOpen,
          sortValue: projectData.obsDelayedClosingNoDays
        });
      } else if (projectData.obsDelayedClosingNoDays >= THRESHOLDS.OBS_HIGH_DELAY) {
        issues.push({
          type: 'Observations',
          severity: 'Medium',
          title: `${projectData.obsOpen} Open Observations`,
          project: projectData.projectTitle,
          projectNo: projectData.projectNo,
          details: `${projectData.obsDelayedClosingNoDays} days delayed closing`,
          count: projectData.obsOpen,
          sortValue: projectData.obsDelayedClosingNoDays
        });
      } else if (projectData.obsOpen > THRESHOLDS.OBS_HIGH_COUNT) {
        issues.push({
          type: 'Observations',
          severity: 'High',
          title: `${projectData.obsOpen} Open Observations`,
          project: projectData.projectTitle,
          projectNo: projectData.projectNo,
          details: 'High volume of open observations requiring attention',
          count: projectData.obsOpen,
          sortValue: projectData.obsOpen
        });
      }
    });

    // Sort by severity and then by sort value
    return issues.sort((a, b) => {
      const severityOrder = { 'Critical': 3, 'High': 2, 'Medium': 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.sortValue - a.sortValue;
    });
  }, [filteredProjects]);

  // ✅ OPTIMIZED: Memoized summary data
  const issuesData = useMemo(() => [
    {
      title: "Critical CARs",
      bgColor: "bg-gradient-to-br from-red-50 via-white to-red-100 dark:from-red-950 dark:via-slate-900 dark:to-red-900",
      textColor: "text-red-800 dark:text-red-200",
      countColor: "text-red-600 dark:text-red-400",
      borderColor: "border-red-200 dark:border-red-800"
    },
    {
      title: "Audit Delays",
      count: filteredProjects.filter(p => parseNumber(p.delayInAuditsNoDays) > THRESHOLDS.AUDIT_CRITICAL).length,
      description: `Audits delayed >${THRESHOLDS.AUDIT_CRITICAL} days`,
      icon: <Clock className="w-8 h-8 text-orange-500 drop-shadow" />,
      bgColor: "bg-gradient-to-br from-orange-50 via-white to-orange-100",
      textColor: "text-orange-800",
      countColor: "text-orange-600",
      borderColor: "border-orange-200"
    },
    {
      title: "Poor KPI Performance",
      count: filteredProjects.filter(p => {
        const kpiPercent = parsePercentage(p.projectKPIsAchievedPercent);
        return kpiPercent > 0 && kpiPercent < THRESHOLDS.KPI_HIGH;
      }).length,
      description: `KPI achievement <${THRESHOLDS.KPI_HIGH}%`,
      icon: <BarChart2 className="w-8 h-8 text-red-500 drop-shadow" />,
      bgColor: "bg-gradient-to-br from-red-50 via-white to-red-100",
      textColor: "text-red-800",
      countColor: "text-red-600",
      borderColor: "border-red-200"
    },
    {
      title: "Billability Issues",
      // ✅ FIXED: Count projects with over-billability (high values)
      count: filteredProjects.filter(p => {
        const billabilityPercent = parsePercentage(p.qualityBillabilityPercent);
        return billabilityPercent > THRESHOLDS.BILLABILITY_HIGH;
      }).length,
      description: `Quality billability >${THRESHOLDS.BILLABILITY_HIGH}%`, // ✅ FIXED: Show over-billability
      icon: <DollarSign className="w-8 h-8 text-yellow-500 drop-shadow" />,
      bgColor: "bg-gradient-to-br from-yellow-50 via-white to-yellow-100",
      textColor: "text-yellow-800",
      countColor: "text-yellow-600",
      borderColor: "border-yellow-200"
    }
  ], [filteredProjects]);

  // ✅ OPTIMIZED: Memoized filtered details
  const filteredDetails = useMemo(() => 
    selectedType ? criticalIssues.filter(issue => issue.type === selectedType) : criticalIssues,
    [criticalIssues, selectedType]
  );

  const handleViewDetails = (type) => {
    setSelectedType(type);
    setTimeout(() => {
      detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // ✅ EARLY RETURN: Show nothing if no projects
  if (!filteredProjects?.length) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            Critical Issues Overview
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {issuesData.map((issue, index) => (
              <div
                key={index}
                className={`
                  ${issue.bgColor} dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-900
                  p-4 rounded-lg border ${issue.borderColor} dark:border-gray-700
                  hover:shadow-md transition-shadow flex flex-col h-full min-h-[180px]
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className={`font-semibold ${issue.textColor} dark:text-gray-100 text-base`}>{issue.title}</h4>
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span>{issue.icon}</span>
                      <p className={`text-3xl font-bold ${issue.countColor} dark:text-white`}>{issue.count}</p>
                    </div>
                    <p className={`text-sm ${issue.textColor} dark:text-gray-300`}>{issue.description}</p>
                  </div>
                  {issue.count > 0 && (
                    <div className="mt-3">
                      <button
                        className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-gray-700 dark:text-gray-200"
                        onClick={() => handleViewDetails(issueTypeMap[issue.title])}
                      >
                        View Details →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Critical Issues */}
      {criticalIssues.length > 0 && (
        <Card ref={detailsRef}>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-red-500" />
                Detailed Critical Issues ({filteredDetails.length})
              </h3>
              {selectedType && (
                <button
                  className="text-xs px-3 py-1 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 font-medium transition-colors"
                  onClick={() => setSelectedType(null)}
                >
                  Show All ({criticalIssues.length})
                </button>
              )}
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredDetails.length === 0 && (
                <div className="text-gray-500 dark:text-gray-400 text-sm text-center py-8">
                  {selectedType ? 
                    `No ${selectedType} issues found in current data.` :
                    '🎉 No critical issues found! All projects are performing well.'
                  }
                </div>
              )}
              {filteredDetails.map((issue, index) => (
                <div
                  key={index}
                  className="p-4 rounded-lg border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow flex flex-col sm:flex-row justify-between items-start"
                >
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <span>{iconMap[issue.type]}</span>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2 mb-1 flex-wrap">
                        <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-100 break-words">{issue.title}</h4>
                        <Badge variant={
                          issue.severity === 'Critical' ? 'destructive' :
                          issue.severity === 'High' ? 'warning' : 'secondary'
                        }>
                          {issue.severity}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200 break-words">{issue.project}</p>
                      <p className="text-xs opacity-75 text-gray-500 dark:text-gray-400 break-words">Project No: {issue.projectNo}</p>
                      <p className="text-xs mt-1 text-gray-600 dark:text-gray-300 break-words">{issue.details}</p>
                    </div>
                  </div>
                  <div className="text-right mt-3 sm:mt-0 sm:ml-4 flex-shrink-0">
                    <div className="text-lg font-bold text-gray-800 dark:text-gray-100">{issue.count}</div>
                    <div className="text-xs opacity-75 text-gray-500 dark:text-gray-400">{issue.type}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CriticalIssues;