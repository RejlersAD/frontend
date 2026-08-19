/**
 * PDF Upload Component with AI Extraction
 * Drag & drop interface with real-time progress tracking
 * Integrates with backend workflow system
 */

import React, { useState, useCallback } from 'react';
import { 
  Button, 
  LinearProgress, 
  Alert, 
  Card, 
  CardContent, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel,
  Chip,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import { 
  CloudUpload, 
  Description, 
  Check, 
  Error as ErrorIcon,
  Refresh 
} from '@mui/icons-material';
import api from '../../services/api.service';

// Soft-coded workflow configurations
const WORKFLOW_OPTIONS = {
  pdf_extraction_complete: {
    label: 'Complete Extraction (Recommended)',
    description: 'Full AI pipeline: Analysis → Extraction → Validation → QA',
    duration: '30-60 seconds',
    steps: ['Analyze', 'Extract', 'Validate', 'Quality Check']
  },
  quick_extraction: {
    label: 'Quick Extraction',
    description: 'Fast extraction only, no validation',
    duration: '10-15 seconds',
    steps: ['Extract']
  },
  validation_only: {
    label: 'Validation Only',
    description: 'Validate existing datasheet',
    duration: '15-20 seconds',
    steps: ['Validate', 'Quality Check']
  }
};

/**
 * PDF Upload & Extraction Component
 */
const PDFUploadExtractor = ({ 
  equipmentTypeId, 
  onExtractionComplete,
  onDatasheetCreated 
}) => {
  // State
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extractionJob, setExtractionJob] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState('pdf_extraction_complete');
  const [extractionResult, setExtractionResult] = useState(null);
  const [activeStep, setActiveStep] = useState(0);

  /**
   * Handle file selection
   */
  const handleFileSelect = (file) => {
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setError(null);
      setExtractionResult(null);
      setActiveStep(0);
    } else {
      setError('Please select a valid PDF file');
    }
  };

  /**
   * Handle drag & drop
   */
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  }, []);

  /**
   * Handle file input change
   */
  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    handleFileSelect(file);
  };

  /**
   * Upload and start extraction
   */
  const handleUploadAndExtract = async () => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    if (!equipmentTypeId) {
      setError('Please select an equipment type');
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(10);

    try {
      // Create FormData
      const formData = new FormData();
      formData.append('pdf_file', selectedFile);
      formData.append('equipment_type', equipmentTypeId);
      formData.append('job_type', selectedWorkflow);
      formData.append('extraction_mode', 'hybrid'); // Use hybrid extraction

      setProgress(20);

      // Upload and start extraction
      const response = await api.post(
        '/process-datasheet/extraction-jobs/',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setExtractionJob(response.data);
      setProgress(30);
      setActiveStep(1);

      // Start polling for status
      pollExtractionStatus(response.data.id);

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.detail || 'Failed to upload and extract PDF');
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  /**
   * Poll extraction job status
   */
  const pollExtractionStatus = async (jobId) => {
    const pollInterval = 3000; // 3 seconds - more stable for AI
    const maxAttempts = 200; // 10 minutes (3s × 200 = 600s)
    let attempts = 0;
    let lastProgress = 30;

    const poll = setInterval(async () => {
      try {
        const response = await api.get(
          `/process-datasheet/extraction-jobs/${jobId}/`
        );

        const job = response.data;
        setExtractionJob(job);

        // Calculate elapsed time
        const elapsedSeconds = Math.floor(attempts * (pollInterval / 1000));
        const elapsedMinutes = Math.floor(elapsedSeconds / 60);
        const remainingSeconds = elapsedSeconds % 60;

        // Update progress based on status
        if (job.status === 'processing' || job.status === 'pending') {
          const workflowSteps = WORKFLOW_OPTIONS[selectedWorkflow].steps;
          
          // Smooth progress curve
          const progressCurve = Math.sin((attempts / maxAttempts) * Math.PI);
          const smoothProgress = 30 + progressCurve * 60;
          const newProgress = Math.min(smoothProgress, 90);
          
          if (newProgress > lastProgress) {
            setProgress(newProgress);
            lastProgress = newProgress;
          }
          
          // Update active step based on progress
          const currentStep = Math.min(
            Math.floor((newProgress - 30) / (60 / workflowSteps.length)),
            workflowSteps.length - 1
          );
          setActiveStep(currentStep + 1);

          // Live status messages
          if (elapsedSeconds < 30) {
            setError(`🚀 Starting AI extraction... (${elapsedSeconds}s)`);
          } else if (elapsedSeconds < 120) {
            setError(`🤖 AI analyzing document... (${elapsedMinutes}m ${remainingSeconds}s)`);
          } else if (elapsedSeconds < 300) {
            setError(`⚙️ Processing data... (${elapsedMinutes}m ${remainingSeconds}s)`);
          } else {
            setError(`🔍 Finalizing... (${elapsedMinutes}m ${remainingSeconds}s)`);
          }
        }

        // Check completion
        if (job.status === 'completed') {
          clearInterval(poll);
          setProgress(100);
          setActiveStep(WORKFLOW_OPTIONS[selectedWorkflow].steps.length);
          setExtractionResult(job);
          setError('');
          
          if (onExtractionComplete) {
            onExtractionComplete(job);
          }

          // Create datasheet if not exists
          if (job.datasheet) {
            if (onDatasheetCreated) {
              onDatasheetCreated(job.datasheet);
            }
          }
        }

        // Check failure
        if (job.status === 'failed') {
          clearInterval(poll);
          setError(`❌ ${job.error_message || 'Extraction failed'}`);
          setProgress(0);
        }

        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(poll);
          setError('⏱️ Still processing... Check Dashboard later or try a smaller PDF');
          setProgress(0);
        }

      } catch (err) {
        console.error('Polling error:', err);
        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(poll);
          setError('❌ Connection lost - please try again');
          setProgress(0);
        }
      }
    }, pollInterval);
  };

  /**
   * Reset form
   */
  const handleReset = () => {
    setSelectedFile(null);
    setExtractionJob(null);
    setExtractionResult(null);
    setProgress(0);
    setError(null);
    setActiveStep(0);
  };

  // Get workflow configuration
  const workflowConfig = WORKFLOW_OPTIONS[selectedWorkflow];

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          PDF Extraction & AI Analysis
        </h2>
        <p className="text-gray-600">
          Upload a PDF datasheet for automatic extraction using AI agents
        </p>
      </div>

      {/* Workflow Selection */}
      {!extractionJob && (
        <Card className="mb-6">
          <CardContent>
            <FormControl fullWidth>
              <InputLabel>Extraction Workflow</InputLabel>
              <Select
                value={selectedWorkflow}
                onChange={(e) => setSelectedWorkflow(e.target.value)}
                label="Extraction Workflow"
                disabled={uploading}
              >
                {Object.entries(WORKFLOW_OPTIONS).map(([key, config]) => (
                  <MenuItem key={key} value={key}>
                    <div>
                      <div className="font-semibold">{config.label}</div>
                      <div className="text-sm text-gray-600">{config.description}</div>
                      <div className="text-xs text-gray-500">Duration: {config.duration}</div>
                    </div>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </CardContent>
        </Card>
      )}

      {/* File Upload Area */}
      {!extractionJob && (
        <Card className="mb-6">
          <CardContent>
            <div
              className={`
                border-2 border-dashed rounded-lg p-8 text-center
                transition-colors duration-200
                ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
                ${selectedFile ? 'bg-green-50 border-green-500' : ''}
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {!selectedFile ? (
                <>
                  <CloudUpload className="text-gray-400 mb-4" style={{ fontSize: 64 }} />
                  <h3 className="text-lg font-semibold mb-2">
                    Drag & Drop PDF Here
                  </h3>
                  <p className="text-gray-600 mb-4">or</p>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileInputChange}
                    style={{ display: 'none' }}
                    id="file-input"
                  />
                  <label htmlFor="file-input">
                    <Button
                      variant="contained"
                      component="span"
                      startIcon={<Description />}
                    >
                      Browse Files
                    </Button>
                  </label>
                </>
              ) : (
                <>
                  <Description className="text-green-600 mb-4" style={{ fontSize: 64 }} />
                  <h3 className="text-lg font-semibold mb-2 text-green-700">
                    {selectedFile.name}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button
                      variant="contained"
                      onClick={handleUploadAndExtract}
                      disabled={uploading}
                      startIcon={<CloudUpload />}
                    >
                      {uploading ? 'Uploading...' : 'Upload & Extract'}
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={handleReset}
                      disabled={uploading}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extraction Progress */}
      {extractionJob && extractionJob.status === 'processing' && (
        <Card className="mb-6">
          <CardContent>
            <h3 className="text-lg font-semibold mb-4">Extracting Data...</h3>
            
            {/* Progress Bar */}
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              className="mb-4"
            />
            <p className="text-center text-sm text-gray-600 mb-4">
              {progress}% Complete
            </p>

            {/* Workflow Steps */}
            <Stepper activeStep={activeStep} className="mb-4">
              {workflowConfig.steps.map((step, index) => (
                <Step key={step}>
                  <StepLabel>{step}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {/* Job Details */}
            <div className="bg-gray-50 rounded p-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="font-semibold">Job ID:</span> {extractionJob.id.slice(0, 8)}
                </div>
                <div>
                  <span className="font-semibold">Workflow:</span> {workflowConfig.label}
                </div>
                <div>
                  <span className="font-semibold">Status:</span> 
                  <Chip 
                    label={extractionJob.status} 
                    size="small" 
                    color="primary" 
                    className="ml-2"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extraction Result */}
      {extractionResult && extractionResult.status === 'completed' && (
        <Card className="mb-6">
          <CardContent>
            <div className="flex items-center gap-2 mb-4">
              <Check className="text-green-600" style={{ fontSize: 32 }} />
              <h3 className="text-lg font-semibold text-green-700">
                Extraction Completed Successfully!
              </h3>
            </div>

            {/* Extraction Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-blue-50 p-4 rounded text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {extractionResult.fields_extracted || 0}
                </div>
                <div className="text-sm text-gray-600">Fields Extracted</div>
              </div>
              
              <div className="bg-green-50 p-4 rounded text-center">
                <div className="text-2xl font-bold text-green-600">
                  {extractionResult.confidence_score 
                    ? `${(extractionResult.confidence_score * 100).toFixed(0)}%`
                    : 'N/A'}
                </div>
                <div className="text-sm text-gray-600">Confidence</div>
              </div>
              
              <div className="bg-purple-50 p-4 rounded text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {extractionResult.validation_score 
                    ? `${(extractionResult.validation_score * 100).toFixed(0)}%`
                    : 'N/A'}
                </div>
                <div className="text-sm text-gray-600">Validation Score</div>
              </div>
              
              <div className="bg-yellow-50 p-4 rounded text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {extractionResult.processing_time 
                    ? `${extractionResult.processing_time.toFixed(1)}s`
                    : 'N/A'}
                </div>
                <div className="text-sm text-gray-600">Processing Time</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-center">
              {extractionResult.datasheet && (
                <Button
                  variant="contained"
                  onClick={() => {
                    if (onDatasheetCreated) {
                      onDatasheetCreated(extractionResult.datasheet);
                    }
                  }}
                >
                  View Datasheet
                </Button>
              )}
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={handleReset}
              >
                Extract Another PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert 
          severity="error" 
          className="mb-6"
          action={
            <Button color="inherit" size="small" onClick={handleReset}>
              Try Again
            </Button>
          }
        >
          {error}
        </Alert>
      )}
    </div>
  );
};

export default PDFUploadExtractor;
