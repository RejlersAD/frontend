import React, { useState } from "react";
import { Progress } from "../ui/Progress";
import { Badge } from "../ui/Badge";
import { CheckCircle2, AlertTriangle, Clock, TrendingUp, AlertCircle, User, Shield, FileText, ClipboardCheck, TrendingDown, Building2, Activity } from "lucide-react";

// Enhanced status icon to show QHSE priority status
const getQHSEStatusIcon = (status, qhseScore = 0) => {
  const baseSize = 18;
  const isHighRisk = qhseScore >= 8;
  const pulseClass = isHighRisk ? "animate-pulse" : "";
  
  switch (status) {
    case "QHSE Compliant":
      return <Shield className="text-green-500 hover:text-green-600 transition-colors" size={baseSize} />;
    case "Critical QHSE Issues":
      return <AlertCircle className={`text-red-500 hover:text-red-600 transition-colors ${pulseClass}`} size={baseSize} />;
    case "Quality Issues":
      return <AlertTriangle className={`text-orange-500 hover:text-orange-600 transition-colors ${pulseClass}`} size={baseSize} />;
    case "Audit Required":
      return <ClipboardCheck className={`text-blue-500 hover:text-blue-600 transition-colors ${pulseClass}`} size={baseSize} />;
    case "Documentation Issues":
      return <FileText className="text-yellow-500 hover:text-yellow-600 transition-colors" size={baseSize} />;
    case "Minor Issues":
      return <Clock className="text-blue-500 hover:text-blue-600 transition-colors" size={baseSize} />;
    default:
      return <Shield className="text-gray-400 hover:text-gray-500 transition-colors" size={baseSize} />;
  }
};

// Enhanced badge variant for QHSE status
const getQHSEBadgeVariant = (status) => {
  switch (status) {
    case "Critical QHSE Issues": return "destructive";
    case "Quality Issues": return "warning";
    case "Audit Required": return "secondary";
    case "Documentation Issues": return "secondary";
    case "QHSE Compliant": return "success";
    case "Minor Issues": return "default";
    default: return "default";
  }
};

// ✅ OPTIMIZED: Enhanced tooltip component with QHSE details
const QHSEProjectTooltip = ({ project, children }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative">
      <div
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="cursor-help inline-block"
      >
        {children}
      </div>
      {showTooltip && (
        <div className="absolute z-50 p-3 sm:p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm rounded-lg shadow-lg w-64 sm:w-72 md:w-80 max-w-xs sm:max-w-sm md:max-w-md -top-2 left-8 sm:left-8">
          <div className="space-y-2 sm:space-y-3">
            {/* Header with QHSE indicator */}
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-600">
              {getQHSEStatusIcon(project.qhseStatus, project.qhseScore)}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1 sm:gap-2 flex-wrap">
                  <span className="truncate text-xs sm:text-sm">
                    {project.projectNo && project.projectNo !== "" && project.projectNo !== "N/A" 
                      ? `${project.projectNo} - ${project.name}` 
                      : project.name}
                  </span>
                  {project.qhseScore >= 8 && (
                    <span className="text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-1 sm:px-2 py-0.5 rounded-full animate-pulse">
                      HIGH RISK
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  QHSE Priority Project
                </div>
              </div>
            </div>

            {/* ✅ RESPONSIVE: QHSE Priority Metrics */}
            <div className="grid grid-cols-3 gap-1 sm:gap-2 text-xs">
              <div className="text-center p-1.5 sm:p-2 bg-gray-50 dark:bg-gray-700 rounded">
                <div className="font-semibold text-gray-900 dark:text-gray-100 text-xs">QHSE Risk</div>
                <div className={`text-xs sm:text-sm font-bold ${
                  project.qhseScore >= 8 ? "text-red-600" :
                  project.qhseScore >= 5 ? "text-orange-600" :
                  project.qhseScore >= 3 ? "text-yellow-600" : "text-green-600"
                }`}>
                  {project.qhseScore >= 8 ? "CRITICAL" :
                   project.qhseScore >= 5 ? "HIGH" :
                   project.qhseScore >= 3 ? "MEDIUM" : "LOW"}
                </div>
              </div>
              <div className="text-center p-1.5 sm:p-2 bg-gray-50 dark:bg-gray-700 rounded">
                <div className="font-semibold text-gray-900 dark:text-gray-100 text-xs">KPI Status</div>
                <div className={`text-xs sm:text-sm font-bold ${
                  project.kpiStatus >= 90 ? "text-green-600" :
                  project.kpiStatus >= 70 ? "text-blue-600" :
                  project.kpiStatus >= 50 ? "text-yellow-600" : "text-red-600"
                }`}>
                  {Math.round(project.kpiStatus || 0)}%
                </div>
              </div>
              <div className="text-center p-1.5 sm:p-2 bg-gray-50 dark:bg-gray-700 rounded">
                <div className="font-semibold text-gray-900 dark:text-gray-100 text-xs">Quality</div>
                <div className={`text-xs sm:text-sm font-bold ${
                  project.rejectionRate <= 5 ? "text-green-600" :
                  project.rejectionRate <= 15 ? "text-yellow-600" : "text-red-600"
                }`}>
                  {Math.round(100 - (project.rejectionRate || 0))}%
                </div>
              </div>
            </div>

            {/* ✅ RESPONSIVE: QHSE Issues */}
            {project.qhseIssues && project.qhseIssues.length > 0 && (
              <div className="space-y-1 sm:space-y-2 pt-2 border-t border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />
                  <div className="text-xs text-red-600 dark:text-red-400 uppercase tracking-wide font-semibold">
                    QHSE Issues
                  </div>
                </div>
                <ul className="space-y-1 text-xs max-h-20 sm:max-h-24 overflow-y-auto">
                  {project.qhseIssues.map((issue, idx) => (
                    <li key={idx} className="text-red-600 dark:text-red-400 flex items-start gap-1">
                      <span className="text-red-500 mt-0.5 flex-shrink-0">•</span>
                      <span className="break-words text-xs">{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ✅ RESPONSIVE: Team Info */}
            {(project.qualityEngineer || project.client) && (
              <div className="space-y-1 sm:space-y-2">
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">QHSE Team</div>
                <div className="space-y-1 text-xs sm:text-sm">
                  {project.qualityEngineer && (
                    <div className="flex items-center gap-1 sm:gap-2">
                      <User size={12} className="text-gray-400 flex-shrink-0" />
                      <span className="text-gray-600 dark:text-gray-300 flex-shrink-0">QE:</span>
                      <span className="font-medium truncate">{project.qualityEngineer}</span>
                    </div>
                  )}
                  {project.client && (
                    <div className="flex items-center gap-1 sm:gap-2">
                      <Building2 size={12} className="text-gray-400 flex-shrink-0" />
                      <span className="text-gray-600 dark:text-gray-300 flex-shrink-0">Client:</span>
                      <span className="font-medium truncate">{project.client}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Arrow pointer */}
          <div className="absolute top-4 -left-1 w-2 h-2 bg-white dark:bg-gray-800 border-l border-b border-gray-200 dark:border-gray-600 transform rotate-45"></div>
        </div>
      )}
    </div>
  );
};

const QhseTimeline = ({ timelineData, className = "" }) => {
  // ✅ REAL DATA: Filter and validate projects at component level
  const validProjects = timelineData?.filter(project => 
    project && 
    project.name && 
    project.name !== "" && 
    project.name !== "N/A" &&
    typeof project.qhseScore === 'number'
  ) || [];

  // ✅ DEBUG: Log what we receive from REAL Google Sheets data
  React.useEffect(() => {
    console.log("🛡️ QHSE Timeline - Received LIVE data:", timelineData);
    console.log("✅ Valid projects:", validProjects.length);
    if (validProjects.length > 0) {
      console.log("📋 Sample project:", validProjects[0]);
    }
  }, [timelineData, validProjects]);

  return (
    <div className={`card col-span-1 lg:col-span-1 xl:col-span-3 ${className}`}>
      {/* ✅ FULLY RESPONSIVE: Header Section */}
      <div className="card-header flex-col p-3 sm:p-4 space-y-3">
        {/* ✅ Main Title Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Shield className="text-blue-600 flex-shrink-0" size={18} />
            <h3 className="card-title font-semibold text-sm sm:text-base truncate">
              QHSE Priority - Quality Attention Required
            </h3> 
          </div>
        </div>
        
        {/* ✅ QHSE-Focused Stats Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 justify-start sm:justify-end flex-1">
            {validProjects.length > 0 ? (
              <>
                {validProjects.filter(p => p.qhseScore >= 8).length > 0 && (
                  <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded-full animate-pulse whitespace-nowrap">
                    {validProjects.filter(p => p.qhseScore >= 8).length} critical
                  </span>
                )}
                {validProjects.filter(p => p.qhseScore >= 5 && p.qhseScore < 8).length > 0 && (
                  <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-1 rounded-full whitespace-nowrap">
                    {validProjects.filter(p => p.qhseScore >= 5 && p.qhseScore < 8).length} high risk
                  </span>
                )}
                {validProjects.filter(p => p.qhseScore >= 3 && p.qhseScore < 5).length > 0 && (
                  <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded-full whitespace-nowrap">
                    {validProjects.filter(p => p.qhseScore >= 3 && p.qhseScore < 5).length} medium
                  </span>
                )}
                <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full whitespace-nowrap">
                  {validProjects.length} showing
                </span>
              </>
            ) : (
              <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded-full whitespace-nowrap">
                ✅ All Compliant
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* ✅ FULLY RESPONSIVE: Card Body */}
      <div className="card-body space-y-2 sm:space-y-3 max-h-48 xs:max-h-56 sm:max-h-64 md:max-h-80 lg:max-h-96 xl:max-h-[28rem] overflow-y-auto p-2 sm:p-3 md:p-4">
        {validProjects.length > 0 ? (
          validProjects.map((project, index) => (
            <div
              key={project.id || index}
              className={`space-y-1.5 sm:space-y-2 p-2 sm:p-3 rounded-lg shadow-sm border hover:shadow-md transition-all duration-200 ${
                project.qhseScore >= 8 ? 
                  'bg-gradient-to-r from-red-50 to-red-25 dark:from-red-900/20 dark:to-red-800/10 border-red-200 dark:border-red-700' :
                project.qhseScore >= 5 ?
                  'bg-gradient-to-r from-orange-50 to-orange-25 dark:from-orange-900/20 dark:to-orange-800/10 border-orange-200 dark:border-orange-700' :
                  'bg-gradient-to-r from-blue-50 to-blue-25 dark:from-blue-900/20 dark:to-blue-800/10 border-blue-200 dark:border-blue-700'
              }`}
            >
              {/* ✅ OPTIMIZED: Project Header */}
              <div className="flex flex-col space-y-1.5 sm:space-y-0 sm:flex-row sm:justify-between sm:items-start">
                <div className="flex items-start gap-x-1.5 sm:gap-x-2 flex-1 min-w-0">
                  <div className="pt-0.5 flex-shrink-0">
                    <QHSEProjectTooltip project={project}>
                      {getQHSEStatusIcon(project.qhseStatus, project.qhseScore)}
                    </QHSEProjectTooltip>
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Project Title and Badges */}
                    <div className="flex flex-col space-y-1 sm:space-y-0 sm:flex-row sm:items-start sm:gap-2">
                      <span className="font-semibold text-gray-800 dark:text-slate-200 text-xs sm:text-sm leading-tight break-words">
                        {project.projectNo && project.projectNo !== "" && project.projectNo !== "N/A" 
                          ? `${project.projectNo} - ${project.name}` 
                          : project.name}
                      </span>
                      <div className="flex gap-0.5 sm:gap-1 flex-wrap">
                        {/* ✅ OPTIMIZED BADGES - No redundant icons */}
                        {project.carsOpen > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-1 sm:px-2 py-0.5 rounded-full animate-pulse whitespace-nowrap">
                            <AlertTriangle size={12} className="flex-shrink-0" />
                            <span>{project.carsOpen} CARs</span>
                          </span>
                        )}
                        {project.obsOpen > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 px-1 sm:px-2 py-0.5 rounded-full whitespace-nowrap">
                            <AlertCircle size={12} className="flex-shrink-0" />
                            <span>{project.obsOpen} Obs</span>
                          </span>
                        )}
                        {project.auditDelay > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-1 sm:px-2 py-0.5 rounded-full animate-pulse whitespace-nowrap">
                            <Clock size={12} className="flex-shrink-0" />
                            <span>{project.auditDelay}d</span>
                          </span>
                        )}
                        {project.rejectionRate > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-1 sm:px-2 py-0.5 rounded-full whitespace-nowrap">
                            <TrendingDown size={12} className="flex-shrink-0" />
                            <span>{Math.round(project.rejectionRate)}%</span>
                          </span>
                        )}
                        {project.qualityPlanStatus === "Pending" && (
                          <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 px-1 sm:px-2 py-0.5 rounded-full whitespace-nowrap">
                            <FileText size={12} className="flex-shrink-0" />
                            <span>QP</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ✅ OPTIMIZED: QHSE-Primary Metrics - Unique icons only */}
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1 text-xs">
                      <div className="inline-flex items-center gap-1 text-gray-600 dark:text-slate-400 whitespace-nowrap">
                        <CheckCircle2 size={12} className="flex-shrink-0" />
                        <span>Quality: {Math.round(100 - (project.rejectionRate || 0))}%</span>
                      </div>
                      <div className="inline-flex items-center gap-1 text-gray-600 dark:text-slate-400 whitespace-nowrap">
                        <TrendingUp size={12} className="flex-shrink-0" />
                        <span>Progress: {Math.round(project.progress || 0)}%</span>
                      </div>
                      <div className="inline-flex items-center gap-1 text-gray-600 dark:text-slate-400 whitespace-nowrap">
                        <Activity size={12} className="flex-shrink-0" />
                        <span>KPI: {Math.round(project.kpiStatus || 0)}%</span>
                      </div>
                      {project.qualityEngineer && (
                        <div className="inline-flex items-center gap-1 text-gray-600 dark:text-slate-400 whitespace-nowrap">
                          <User size={12} className="flex-shrink-0" />
                          <span className="truncate max-w-16 sm:max-w-24 md:max-w-32">{project.qualityEngineer}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* ✅ OPTIMIZED: Progress and Risk Score */}
                <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 sm:flex-col sm:items-end sm:space-y-1">
                  <span className="text-base sm:text-lg font-bold text-gray-800 dark:text-slate-200 whitespace-nowrap">
                    {Math.round(project.progress || 0)}%
                  </span>
                  <span className={`text-xs px-1 sm:px-2 py-0.5 sm:py-1 rounded-full font-bold whitespace-nowrap ${
                    project.qhseScore >= 8 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                    project.qhseScore >= 5 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' : 
                    project.qhseScore >= 3 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' : 
                    'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  }`}>
                    Risk: {project.qhseScore || 0}
                  </span>
                </div>
              </div>

              {/* ✅ OPTIMIZED: Progress Bar */}
              <div className="flex items-center space-x-1 sm:space-x-2">
                <Progress
                  value={project.progress || 0}
                  className="flex-1 h-1.5 sm:h-2 rounded-full"
                />
                {project.qhseIssues && project.qhseIssues.length > 0 && (
                  <span className="text-xs text-red-600 dark:text-red-400 font-semibold whitespace-nowrap">
                    {project.qhseIssues.length} issues
                  </span>
                )}
                {project.costOfPoorQualityAED > 0 && (
                  <span className="text-xs text-red-600 dark:text-red-400 font-semibold whitespace-nowrap hidden sm:inline">
                    {project.costOfPoorQualityAED.toLocaleString()} AED
                  </span>
                )}
              </div>

              {/* ✅ OPTIMIZED: QHSE Status - Single icon per status */}
              <div className="text-xs flex flex-col space-y-1 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-x-1 min-w-0">
                  {project.carsOpen > 0 || project.obsOpen > 0 || project.auditDelay > 0 ? (
                    <>
                      <AlertTriangle className="text-red-500 animate-pulse flex-shrink-0" size={14} />
                      <span className="text-red-600 font-bold bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded break-words">
                        URGENT: {project.carsOpen || 0} CARs, {project.obsOpen || 0} Obs
                        {project.auditDelay > 0 && `, ${project.auditDelay}d delay`}
                      </span>
                    </>
                  ) : project.qualityPlanStatus === "Pending" ? (
                    <>
                      <FileText className="text-orange-500 flex-shrink-0" size={14} />
                      <span className="text-orange-600 font-semibold break-words">
                        Quality Plan Pending
                      </span>
                    </>
                  ) : (
                    <>
                      <Shield className="text-green-500 flex-shrink-0" size={14} />
                      <span className="text-green-600 font-semibold">QHSE Compliant</span>
                    </>
                  )}
                </div>
                
                {/* ✅ Quality Engineer Info */}
                {project.qualityEngineer && (
                  <div className="inline-flex items-center gap-1 justify-start sm:justify-end flex-shrink-0">
                    <User size={12} className="text-blue-500 flex-shrink-0" />
                    <span className="text-blue-600 dark:text-blue-400 font-medium truncate max-w-20 sm:max-w-none">
                      {project.qualityEngineer}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-400 py-4 sm:py-6 md:py-8">
            <Shield className="mx-auto mb-2 sm:mb-4 text-3xl sm:text-4xl md:text-6xl text-green-400" />
            <p className="font-medium text-green-600 text-sm sm:text-base md:text-lg">Excellent QHSE Performance!</p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2">All projects are QHSE compliant</p>
            <p className="text-xs text-gray-400 mt-1">Data refreshed from Google Sheets</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QhseTimeline;