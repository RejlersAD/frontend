/**
 * Validation Feedback Display Component
 * Shows validation results with severity levels
 * Soft-coded validation rules from backend
 */

import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  Accordion, 
  AccordionSummary, 
  AccordionDetails,
  Chip,
  Alert,
  LinearProgress,
  Button,
  Tabs,
  Tab,
  Box
} from '@mui/material';
import {
  ExpandMore,
  Error as ErrorIcon,
  Warning as WarningIcon,
  CheckCircle,
  Info as InfoIcon,
  Build
} from '@mui/icons-material';

// Soft-coded severity configurations
const SEVERITY_CONFIG = {
  critical: {
    icon: <ErrorIcon />,
    color: 'error',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    borderColor: 'border-red-500',
    label: 'Critical'
  },
  high: {
    icon: <ErrorIcon />,
    color: 'error',
    bgColor: 'bg-red-50',
    textColor: 'text-red-600',
    borderColor: 'border-red-400',
    label: 'High'
  },
  medium: {
    icon: <WarningIcon />,
    color: 'warning',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    borderColor: 'border-yellow-500',
    label: 'Medium'
  },
  low: {
    icon: <InfoIcon />,
    color: 'info',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-500',
    label: 'Low'
  }
};

const VALIDATION_TYPE_CONFIG = {
  technical: {
    label: 'Technical Validation',
    icon: '🔧',
    description: 'Engineering calculations and sizing'
  },
  safety: {
    label: 'Safety Validation',
    icon: '⚠️',
    description: 'Safety margins and requirements'
  },
  standards: {
    label: 'Standards Compliance',
    icon: '📋',
    description: 'Code and standard adherence'
  },
  consistency: {
    label: 'Consistency Check',
    icon: '🔄',
    description: 'Cross-field relationships'
  },
  completeness: {
    label: 'Completeness Check',
    icon: '✓',
    description: 'Required field completion'
  }
};

/**
 * Validation Issue Card
 */
const ValidationIssue = ({ issue, onFix }) => {
  const severityConfig = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.medium;

  return (
    <div className={`p-4 rounded-lg border-l-4 ${severityConfig.bgColor} ${severityConfig.borderColor} mb-3`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Chip 
              label={severityConfig.label} 
              color={severityConfig.color} 
              size="small"
            />
            <span className={`text-sm font-semibold ${severityConfig.textColor}`}>
              {issue.field_label || issue.field_name}
            </span>
          </div>
          
          <p className="text-gray-700 mb-2">{issue.message}</p>
          
          {issue.suggestion && (
            <div className="bg-white rounded p-2 mt-2">
              <div className="text-sm font-semibold text-gray-700 mb-1">
                💡 Suggestion:
              </div>
              <div className="text-sm text-gray-600">{issue.suggestion}</div>
            </div>
          )}

          {issue.rule_description && (
            <div className="text-xs text-gray-500 mt-2">
              Rule: {issue.rule_description}
            </div>
          )}
        </div>

        {onFix && issue.can_auto_fix && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<Build />}
            onClick={() => onFix(issue)}
          >
            Auto Fix
          </Button>
        )}
      </div>
    </div>
  );
};

/**
 * Validation Type Group
 */
const ValidationTypeGroup = ({ type, issues, onFix }) => {
  const typeConfig = VALIDATION_TYPE_CONFIG[type] || {
    label: type,
    icon: '📝',
    description: ''
  };

  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const highCount = issues.filter(i => i.severity === 'high').length;
  const mediumCount = issues.filter(i => i.severity === 'medium').length;
  const lowCount = issues.filter(i => i.severity === 'low').length;

  return (
    <Accordion defaultExpanded={criticalCount > 0 || highCount > 0}>
      <AccordionSummary expandIcon={<ExpandMore />}>
        <div className="flex items-center justify-between w-full pr-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{typeConfig.icon}</span>
            <div>
              <div className="font-semibold">{typeConfig.label}</div>
              <div className="text-sm text-gray-600">{typeConfig.description}</div>
            </div>
          </div>
          
          <div className="flex gap-2">
            {criticalCount > 0 && (
              <Chip label={criticalCount} color="error" size="small" />
            )}
            {highCount > 0 && (
              <Chip label={highCount} color="error" size="small" variant="outlined" />
            )}
            {mediumCount > 0 && (
              <Chip label={mediumCount} color="warning" size="small" />
            )}
            {lowCount > 0 && (
              <Chip label={lowCount} color="info" size="small" />
            )}
          </div>
        </div>
      </AccordionSummary>
      
      <AccordionDetails>
        {issues.map((issue, index) => (
          <ValidationIssue 
            key={index} 
            issue={issue} 
            onFix={onFix}
          />
        ))}
      </AccordionDetails>
    </Accordion>
  );
};

/**
 * Main Validation Feedback Display
 */
const ValidationFeedback = ({ 
  validationResult, 
  onRevalidate,
  onFixIssue 
}) => {
  const [activeTab, setActiveTab] = useState(0);

  if (!validationResult) {
    return (
      <Alert severity="info">
        No validation results available. Please validate the datasheet.
      </Alert>
    );
  }

  // Calculate overall stats
  const totalIssues = validationResult.issues?.length || 0;
  const criticalIssues = validationResult.issues?.filter(i => i.severity === 'critical').length || 0;
  const highIssues = validationResult.issues?.filter(i => i.severity === 'high').length || 0;
  const mediumIssues = validationResult.issues?.filter(i => i.severity === 'medium').length || 0;
  const lowIssues = validationResult.issues?.filter(i => i.severity === 'low').length || 0;
  
  const validationScore = validationResult.validation_score || 0;
  const completenessScore = validationResult.completeness_score || 0;

  // Group issues by type
  const issuesByType = {};
  validationResult.issues?.forEach(issue => {
    const type = issue.validation_type || 'other';
    if (!issuesByType[type]) {
      issuesByType[type] = [];
    }
    issuesByType[type].push(issue);
  });

  // Group issues by severity
  const issuesBySeverity = {
    critical: validationResult.issues?.filter(i => i.severity === 'critical') || [],
    high: validationResult.issues?.filter(i => i.severity === 'high') || [],
    medium: validationResult.issues?.filter(i => i.severity === 'medium') || [],
    low: validationResult.issues?.filter(i => i.severity === 'low') || []
  };

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Validation Results</h2>
            {onRevalidate && (
              <Button 
                variant="outlined" 
                onClick={onRevalidate}
                size="small"
              >
                Revalidate
              </Button>
            )}
          </div>

          {/* Score Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">Validation Score</span>
                <span className={`text-lg font-bold ${
                  validationScore >= 0.8 ? 'text-green-600' :
                  validationScore >= 0.6 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {(validationScore * 100).toFixed(0)}%
                </span>
              </div>
              <LinearProgress 
                variant="determinate" 
                value={validationScore * 100}
                color={
                  validationScore >= 0.8 ? 'success' :
                  validationScore >= 0.6 ? 'warning' :
                  'error'
                }
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">Completeness</span>
                <span className={`text-lg font-bold ${
                  completenessScore >= 0.9 ? 'text-green-600' :
                  completenessScore >= 0.7 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {(completenessScore * 100).toFixed(0)}%
                </span>
              </div>
              <LinearProgress 
                variant="determinate" 
                value={completenessScore * 100}
                color={
                  completenessScore >= 0.9 ? 'success' :
                  completenessScore >= 0.7 ? 'warning' :
                  'error'
                }
              />
            </div>
          </div>

          {/* Issue Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-gray-50 p-3 rounded text-center">
              <div className="text-2xl font-bold text-gray-700">{totalIssues}</div>
              <div className="text-xs text-gray-600">Total Issues</div>
            </div>
            
            <div className="bg-red-50 p-3 rounded text-center">
              <div className="text-2xl font-bold text-red-600">{criticalIssues}</div>
              <div className="text-xs text-gray-600">Critical</div>
            </div>
            
            <div className="bg-red-50 p-3 rounded text-center">
              <div className="text-2xl font-bold text-red-500">{highIssues}</div>
              <div className="text-xs text-gray-600">High</div>
            </div>
            
            <div className="bg-yellow-50 p-3 rounded text-center">
              <div className="text-2xl font-bold text-yellow-600">{mediumIssues}</div>
              <div className="text-xs text-gray-600">Medium</div>
            </div>
            
            <div className="bg-blue-50 p-3 rounded text-center">
              <div className="text-2xl font-bold text-blue-600">{lowIssues}</div>
              <div className="text-xs text-gray-600">Low</div>
            </div>
          </div>

          {/* Approval Status */}
          {validationResult.is_approved !== undefined && (
            <Alert 
              severity={validationResult.is_approved ? 'success' : 'warning'}
              className="mt-4"
              icon={validationResult.is_approved ? <CheckCircle /> : <WarningIcon />}
            >
              {validationResult.is_approved 
                ? 'Datasheet meets all validation requirements and is approved for use'
                : 'Datasheet has validation issues that must be resolved before approval'
              }
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Issues Display */}
      {totalIssues > 0 && (
        <Card>
          <CardContent>
            <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
              <Tab label="By Type" />
              <Tab label="By Severity" />
            </Tabs>

            <Box className="mt-4">
              {/* By Type View */}
              {activeTab === 0 && (
                <div>
                  {Object.entries(issuesByType).map(([type, issues]) => (
                    <ValidationTypeGroup
                      key={type}
                      type={type}
                      issues={issues}
                      onFix={onFixIssue}
                    />
                  ))}
                </div>
              )}

              {/* By Severity View */}
              {activeTab === 1 && (
                <div className="space-y-4">
                  {Object.entries(issuesBySeverity).map(([severity, issues]) => (
                    issues.length > 0 && (
                      <div key={severity}>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                          {SEVERITY_CONFIG[severity]?.icon}
                          {SEVERITY_CONFIG[severity]?.label} Issues ({issues.length})
                        </h3>
                        {issues.map((issue, index) => (
                          <ValidationIssue 
                            key={index} 
                            issue={issue}
                            onFix={onFixIssue}
                          />
                        ))}
                      </div>
                    )
                  ))}
                </div>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* No Issues */}
      {totalIssues === 0 && (
        <Alert severity="success" icon={<CheckCircle />}>
          <div className="font-semibold mb-1">Perfect! No validation issues found.</div>
          <div className="text-sm">
            The datasheet has passed all validation checks and is ready for approval.
          </div>
        </Alert>
      )}
    </div>
  );
};

export default ValidationFeedback;
