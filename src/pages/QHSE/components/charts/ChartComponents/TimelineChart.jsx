import React from 'react';
import { Badge } from '../../ui/Badge';
import { Progress } from '../../ui/Progress';
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

export const TimelineChart = ({ data, getKPIBadgeVariant }) => {
  // Enhanced helper to get correct badge variant
  const getStatusBadgeVariant = (status) => {
    switch(status) {
      case "Completed": return "success";
      case "Critical": return "destructive";
      case "Delayed": return "warning";
      case "At Risk": return "secondary";
      case "On Track": return "success";
      case "Extended": return "warning";
      default: return getKPIBadgeVariant(status);
    }
  };

  // Enhanced helper to get status text
  const getStatusText = (status) => {
    if (["Completed", "Critical", "Delayed", "At Risk", "On Track", "Extended"].includes(status)) {
      return status;
    }
    switch(status) {
      case "Green": return "On Track";
      case "Yellow": return "Attention Needed";
      case "Red": return "Critical Issues";
      default: return status;
    }
  };

  // Enhanced helper for timeline status with extensions
  const getTimelineStatus = (project) => {
    const completion = project.projectCompletionPercent || project.progress || project.completion || 0;
    const hasExtension = project.projectExtension && project.projectExtension !== "" && project.projectExtension !== "N/A";
    const daysRemaining = project.daysRemaining;
    
    // Completed projects
    if (completion >= 100) {
      return { 
        text: "Completed", 
        color: "text-green-600 dark:text-green-400", 
        dot: "bg-green-400",
        icon: <CheckCircle2 className="w-3 h-3" />
      };
    }
    
    // Extended projects
    if (hasExtension) {
      if (daysRemaining !== undefined && daysRemaining < 0) {
        return { 
          text: `Extended & Overdue by ${Math.abs(daysRemaining)} days`, 
          color: "text-red-600 dark:text-red-400", 
          dot: "bg-red-500",
          icon: <AlertTriangle className="w-3 h-3" />
        };
      } else {
        return { 
          text: `Extended (${daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Due today'})`, 
          color: "text-orange-600 dark:text-orange-400", 
          dot: "bg-orange-400",
          icon: <Clock className="w-3 h-3" />
        };
      }
    }
    
    // Regular timeline logic
    if (daysRemaining !== undefined) {
      if (daysRemaining > 0) {
        return { 
          text: `${daysRemaining} days remaining`, 
          color: "text-gray-600 dark:text-gray-400", 
          dot: "bg-blue-400",
          icon: <Clock className="w-3 h-3" />
        };
      } else if (daysRemaining === 0) {
        return { 
          text: "Due Today", 
          color: "text-yellow-600 dark:text-yellow-400", 
          dot: "bg-yellow-500",
          icon: <AlertTriangle className="w-3 h-3" />
        };
      } else {
        return { 
          text: `Overdue by ${Math.abs(daysRemaining)} days`, 
          color: "text-red-600 dark:text-red-400", 
          dot: "bg-red-500",
          icon: <AlertTriangle className="w-3 h-3" />
        };
      }
    }
    
    return { 
      text: "Timeline pending", 
      color: "text-gray-500 dark:text-gray-400", 
      dot: "bg-gray-400",
      icon: <Clock className="w-3 h-3" />
    };
  };

  // Filter out projects without valid names
  const validProjects = data.filter(project => 
    project.name && 
    project.name.trim() !== "" && 
    project.name !== "N/A"
  );

  return (
    <>
      <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
        <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400" />
        Project Timeline Progress
      </h3>
      <div className="flex-1 flex flex-col justify-between">
        <div className="flex flex-col w-full">
          <div className="space-y-3 max-h-96 overflow-y-auto w-full px-1 sm:px-0">
            {validProjects.length > 0 ? (
              validProjects.map((project, index) => {
                const timelineStatus = getTimelineStatus(project);
                const completion = project.projectCompletionPercent || project.progress || project.completion || 0;
                const hasExtension = project.projectExtension && project.projectExtension !== "" && project.projectExtension !== "N/A";
                
                return (
                  <div
                    key={index}
                    className={`flex flex-col gap-1 p-4 rounded-xl border shadow-sm min-w-0 ${
                      hasExtension 
                        ? 'bg-gradient-to-r from-orange-50/60 via-white to-yellow-50/60 dark:from-orange-900/20 dark:via-gray-800 dark:to-yellow-900/20 border-orange-200 dark:border-orange-800'
                        : 'bg-gradient-to-r from-blue-50/60 via-white to-green-50/60 dark:from-gray-900 dark:via-gray-800 dark:to-green-900 border-gray-100 dark:border-gray-800'
                    }`}
                  >
                    {/* Project Header */}
                    <div className="flex justify-between items-center mb-1 gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-semibold text-gray-800 dark:text-gray-100 text-base truncate">
                          {project.name}
                        </span>
                        {hasExtension && (
                          <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full whitespace-nowrap">
                            Extended
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {Math.round(completion)}%
                      </span>
                    </div>
                    
                    {/* Progress Bar and Status Badge */}
                    <div className="flex items-center gap-2">
                      <Progress value={completion} className="flex-1 h-3 rounded-full" />
                      <Badge
                        variant={getStatusBadgeVariant(project.status)}
                        className="ml-2 text-xs px-2 py-0.5 whitespace-nowrap"
                      >
                        {getStatusText(project.status)}
                      </Badge>
                    </div>
                    
                    {/* Timeline Status with Enhanced Logic */}
                    <div className="text-xs mt-1 flex items-center gap-1">
                      <span className={`inline-block w-2 h-2 rounded-full ${timelineStatus.dot}`} />
                      <span className={`font-semibold ${timelineStatus.color} flex items-center gap-1`}>
                        {timelineStatus.icon}
                        {timelineStatus.text}
                      </span>
                    </div>
                    
                    {/* Extension Details (if applicable) */}
                    {hasExtension && (
                      <div className="text-xs text-orange-600 dark:text-orange-400 mt-1 bg-orange-50 dark:bg-orange-900/20 rounded px-2 py-1">
                        <strong>Extension:</strong> {project.projectExtension}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No projects with valid names to display</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};