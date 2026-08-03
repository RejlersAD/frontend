/**
 * Workflow Progress Tracker Component
 * Real-time visualization of AI agent workflow execution
 * Soft-coded workflow steps from backend
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
  LinearProgress,
  Alert,
  Avatar
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent
} from '@mui/lab';
import {
  CheckCircle,
  Error as ErrorIcon,
  HourglassEmpty,
  PlayArrow,
  Psychology,
  Assessment,
  Verified,
  Speed
} from '@mui/icons-material';

// Soft-coded agent configurations
const AGENT_CONFIG = {
  document_analyzer: {
    name: 'Document Analyzer',
    icon: <Assessment />,
    color: '#3b82f6',
    description: 'Analyzes document structure and metadata'
  },
  field_extractor: {
    name: 'Field Extractor',
    icon: <Psychology />,
    color: '#8b5cf6',
    description: 'Extracts field values using AI vision'
  },
  validation_agent: {
    name: 'Validation Agent',
    icon: <Verified />,
    color: '#f59e0b',
    description: 'Validates extracted data against rules'
  },
  quality_checker: {
    name: 'Quality Checker',
    icon: <CheckCircle />,
    color: '#10b981',
    description: 'Performs final quality assessment'
  },
  calculation_service: {
    name: 'Calculation Engine',
    icon: <Speed />,
    color: '#06b6d4',
    description: 'Executes engineering calculations'
  }
};

// Soft-coded step status configurations
const STEP_STATUS_CONFIG = {
  pending: {
    icon: <HourglassEmpty />,
    color: 'default',
    label: 'Pending',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-600'
  },
  in_progress: {
    icon: <PlayArrow />,
    color: 'primary',
    label: 'In Progress',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-600'
  },
  completed: {
    icon: <CheckCircle />,
    color: 'success',
    label: 'Completed',
    bgColor: 'bg-green-100',
    textColor: 'text-green-600'
  },
  failed: {
    icon: <ErrorIcon />,
    color: 'error',
    label: 'Failed',
    bgColor: 'bg-red-100',
    textColor: 'text-red-600'
  }
};

/**
 * Agent Step Card
 */
const AgentStepCard = ({ agent, step, status, duration, output }) => {
  const agentConfig = AGENT_CONFIG[agent] || {
    name: agent,
    icon: <Psychology />,
    color: '#6b7280',
    description: 'Processing...'
  };

  const statusConfig = STEP_STATUS_CONFIG[status] || STEP_STATUS_CONFIG.pending;

  return (
    <div className={`rounded-lg p-4 ${statusConfig.bgColor} border-l-4`}
         style={{ borderLeftColor: agentConfig.color }}>
      <div className="flex items-start gap-3">
        <Avatar sx={{ bgcolor: agentConfig.color }}>
          {agentConfig.icon}
        </Avatar>
        
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-gray-800">{agentConfig.name}</h4>
            <Chip
              icon={statusConfig.icon}
              label={statusConfig.label}
              color={statusConfig.color}
              size="small"
            />
          </div>
          
          <p className="text-sm text-gray-600 mb-2">{agentConfig.description}</p>
          
          {status === 'in_progress' && (
            <LinearProgress className="mb-2" />
          )}
          
          {duration && status === 'completed' && (
            <div className="text-xs text-gray-500">
              ⏱️ Completed in {duration.toFixed(2)}s
            </div>
          )}
          
          {output && status === 'completed' && (
            <div className="mt-2 bg-white rounded p-2 text-sm">
              <div className="font-semibold text-gray-700 mb-1">Output:</div>
              <div className="text-gray-600">
                {output.fields_extracted && (
                  <div>📝 Extracted {output.fields_extracted} fields</div>
                )}
                {output.confidence && (
                  <div>✨ Confidence: {(output.confidence * 100).toFixed(0)}%</div>
                )}
                {output.issues_found !== undefined && (
                  <div>🔍 Found {output.issues_found} issues</div>
                )}
                {output.quality_score && (
                  <div>⭐ Quality: {(output.quality_score * 100).toFixed(0)}%</div>
                )}
              </div>
            </div>
          )}
          
          {step.error_message && status === 'failed' && (
            <Alert severity="error" className="mt-2">
              {step.error_message}
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Timeline View of Workflow
 */
const WorkflowTimeline = ({ steps }) => {
  return (
    <Timeline position="alternate">
      {steps.map((step, index) => {
        const statusConfig = STEP_STATUS_CONFIG[step.status] || STEP_STATUS_CONFIG.pending;
        const agentConfig = AGENT_CONFIG[step.agent] || { name: step.agent, color: '#6b7280' };
        
        return (
          <TimelineItem key={index}>
            <TimelineOppositeContent color="text.secondary">
              {step.completed_at ? new Date(step.completed_at).toLocaleTimeString() : '--:--'}
            </TimelineOppositeContent>
            
            <TimelineSeparator>
              <TimelineDot sx={{ bgcolor: agentConfig.color }}>
                {statusConfig.icon}
              </TimelineDot>
              {index < steps.length - 1 && <TimelineConnector />}
            </TimelineSeparator>
            
            <TimelineContent>
              <Card>
                <CardContent>
                  <div className="font-semibold">{agentConfig.name}</div>
                  <div className="text-sm text-gray-600">{step.action}</div>
                  <Chip 
                    label={statusConfig.label} 
                    color={statusConfig.color} 
                    size="small"
                    className="mt-2"
                  />
                </CardContent>
              </Card>
            </TimelineContent>
          </TimelineItem>
        );
      })}
    </Timeline>
  );
};

/**
 * Main Workflow Progress Tracker
 */
const WorkflowProgressTracker = ({ 
  workflowId,
  workflowType,
  steps = [],
  overallStatus = 'pending',
  startTime,
  endTime,
  showTimeline = false
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);

  useEffect(() => {
    // Find current step index
    const inProgressIndex = steps.findIndex(s => s.status === 'in_progress');
    const lastCompletedIndex = steps.map((s, i) => s.status === 'completed' ? i : -1)
                                   .filter(i => i >= 0)
                                   .pop();
    
    if (inProgressIndex >= 0) {
      setCurrentStep(inProgressIndex);
    } else if (lastCompletedIndex >= 0) {
      setCurrentStep(lastCompletedIndex + 1);
    }

    // Calculate total duration
    if (startTime && endTime) {
      const duration = (new Date(endTime) - new Date(startTime)) / 1000;
      setTotalDuration(duration);
    }
  }, [steps, startTime, endTime]);

  // Calculate progress percentage
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const totalSteps = steps.length;
  const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Workflow Header */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Workflow Progress</h2>
              <p className="text-sm text-gray-600">
                {workflowType?.replace(/_/g, ' ').toUpperCase() || 'Processing'}
              </p>
            </div>
            
            <Chip
              icon={STEP_STATUS_CONFIG[overallStatus]?.icon}
              label={STEP_STATUS_CONFIG[overallStatus]?.label}
              color={STEP_STATUS_CONFIG[overallStatus]?.color}
            />
          </div>

          {/* Overall Progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">Overall Progress</span>
              <span className="text-sm font-semibold">
                {completedSteps} / {totalSteps} steps
              </span>
            </div>
            <LinearProgress 
              variant="determinate" 
              value={progressPercent}
              color={
                overallStatus === 'completed' ? 'success' :
                overallStatus === 'failed' ? 'error' :
                'primary'
              }
            />
          </div>

          {/* Timing Info */}
          <div className="flex gap-4 text-sm text-gray-600">
            {startTime && (
              <div>
                <span className="font-semibold">Started:</span>{' '}
                {new Date(startTime).toLocaleString()}
              </div>
            )}
            {totalDuration > 0 && (
              <div>
                <span className="font-semibold">Duration:</span>{' '}
                {totalDuration.toFixed(1)}s
              </div>
            )}
            {workflowId && (
              <div>
                <span className="font-semibold">ID:</span>{' '}
                {workflowId.slice(0, 8)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Workflow Steps */}
      {!showTimeline ? (
        <Card>
          <CardContent>
            <Stepper activeStep={currentStep} orientation="vertical">
              {steps.map((step, index) => (
                <Step key={index} completed={step.status === 'completed'}>
                  <StepLabel error={step.status === 'failed'}>
                    <div className="flex items-center gap-2">
                      {AGENT_CONFIG[step.agent]?.name || step.agent}
                      {step.status === 'in_progress' && (
                        <Chip label="Processing" size="small" color="primary" />
                      )}
                    </div>
                  </StepLabel>
                  <StepContent>
                    <AgentStepCard
                      agent={step.agent}
                      step={step}
                      status={step.status}
                      duration={step.duration}
                      output={step.output}
                    />
                  </StepContent>
                </Step>
              ))}
            </Stepper>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <WorkflowTimeline steps={steps} />
          </CardContent>
        </Card>
      )}

      {/* Workflow Result */}
      {overallStatus === 'completed' && (
        <Alert severity="success" icon={<CheckCircle />}>
          <div className="font-semibold mb-1">Workflow completed successfully!</div>
          <div className="text-sm">
            All {totalSteps} steps completed in {totalDuration.toFixed(1)} seconds.
          </div>
        </Alert>
      )}

      {overallStatus === 'failed' && (
        <Alert severity="error" icon={<ErrorIcon />}>
          <div className="font-semibold mb-1">Workflow failed</div>
          <div className="text-sm">
            One or more steps encountered errors. Please check the details above.
          </div>
        </Alert>
      )}
    </div>
  );
};

/**
 * Compact Progress Indicator (for inline display)
 */
export const CompactWorkflowProgress = ({ steps, status }) => {
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const totalSteps = steps.length;
  const progressPercent = (completedSteps / totalSteps) * 100;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="text-xs text-gray-600 mb-1">
          {completedSteps} / {totalSteps} steps
        </div>
        <LinearProgress 
          variant="determinate" 
          value={progressPercent}
          color={status === 'completed' ? 'success' : 'primary'}
          sx={{ height: 6, borderRadius: 3 }}
        />
      </div>
      <Chip
        icon={STEP_STATUS_CONFIG[status]?.icon}
        label={STEP_STATUS_CONFIG[status]?.label}
        color={STEP_STATUS_CONFIG[status]?.color}
        size="small"
      />
    </div>
  );
};

export default WorkflowProgressTracker;
