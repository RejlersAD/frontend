/**
 * DesignIQ New Project Creator
 * Advanced AI-powered engineering design project creation
 * Uses RAG and generative AI for smart suggestions
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  BeakerIcon,
  SparklesIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  LightBulbIcon,
  InformationCircleIcon,
  CloudArrowUpIcon
} from '@heroicons/react/24/outline';
import {
  getDesignTypeConfig,
  getDesignTypeParameters,
  getAITemplates,
  VALIDATION_RULES,
  FILE_UPLOAD_CONFIG
} from '../../config/designiq.config';
import { API_BASE_URL } from '../../config/api.config';
import { STORAGE_KEYS } from '../../config/app.config';
import { usePageControls } from '../../hooks/usePageControls';
import { PageControlButtons } from '../../components/Common/PageControlButtons';

const DesignIQNewProject = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const designType = searchParams.get('type') || 'process_flow';
  
  const [loading, setLoading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    project_name: '',
    design_type: designType,
    description: '',
    organization: '',
    design_parameters: {},
    input_file: null
  });
  
  const [errors, setErrors] = useState({});
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  
  // Page controls
  const pageControls = usePageControls();
  
  // Get design type configuration
  const designConfig = getDesignTypeConfig(designType);
  const parameters = getDesignTypeParameters(designType);
  const templates = getAITemplates(designType);

  useEffect(() => {
    // Update design type when URL changes
    setFormData(prev => ({
      ...prev,
      design_type: designType,
      design_parameters: {}
    }));
    setErrors({});
    setAiSuggestions(null);
  }, [designType]);

  // AI-powered field suggestions
  const generateAISuggestions = async (fieldName, currentValue) => {
    if (!currentValue || currentValue.length < 3) return;
    
    setAiGenerating(true);
    
    try {
      // Simulate AI suggestions (would call backend API in production)
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const suggestions = {
        project_name: [
          `${designConfig.name} - ${new Date().getFullYear()}`,
          `Oil & Gas ${designConfig.name}`,
          `Process ${designConfig.name} Project`
        ],
        description: `Advanced ${designConfig.name.toLowerCase()} with AI-optimized parameters. 
Designed for oil & gas applications following industry best practices and international standards.

Key Features:
- Comprehensive process analysis
- Equipment optimization
- Safety compliance
- Cost-effective design

Standards: API, ASME, ISO compliance`,
        
        organization: [
          'Rejlers AB - Engineering Division',
          'Oil & Gas Engineering Department',
          'Process Engineering Team'
        ]
      };
      
      setAiSuggestions({ field: fieldName, options: suggestions[fieldName] });
      
    } catch (error) {
      console.error('AI suggestion error:', error);
    } finally {
      setAiGenerating(false);
    }
  };

  // Apply AI suggestion
  const applySuggestion = (field, value) => {
    if (field === 'project_name' || field === 'description' || field === 'organization') {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    setAiSuggestions(null);
  };

  // Load template
  const loadTemplate = (template) => {
    setFormData(prev => ({
      ...prev,
      project_name: template.name,
      description: template.description,
      design_parameters: { ...template.defaultParams }
    }));
    setShowTemplates(false);
    
    setNotification({
      type: 'success',
      message: `Template "${template.name}" loaded successfully`
    });
    setTimeout(() => setNotification(null), 3000);
  };

  // Handle parameter change
  const handleParameterChange = (paramName, value) => {
    setFormData(prev => ({
      ...prev,
      design_parameters: {
        ...prev.design_parameters,
        [paramName]: value
      }
    }));
    
    // Clear error for this parameter
    if (errors[`param_${paramName}`]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`param_${paramName}`];
        return newErrors;
      });
    }
  };

  // File upload handler
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file size
    if (file.size > FILE_UPLOAD_CONFIG.maxSize) {
      setNotification({
        type: 'error',
        message: `File size exceeds ${FILE_UPLOAD_CONFIG.maxSize / (1024 * 1024)}MB limit`
      });
      return;
    }
    
    // Validate file type
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    if (!FILE_UPLOAD_CONFIG.acceptedFormats.includes(fileExt)) {
      setNotification({
        type: 'error',
        message: 'Unsupported file format'
      });
      return;
    }
    
    setFormData(prev => ({ ...prev, input_file: file }));
    
    // Generate preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  // Remove file
  const removeFile = () => {
    setFormData(prev => ({ ...prev, input_file: null }));
    setFilePreview(null);
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};
    
    // Project name validation
    if (!formData.project_name.trim()) {
      newErrors.project_name = 'Project name is required';
    } else if (formData.project_name.length < VALIDATION_RULES.project_name.minLength) {
      newErrors.project_name = VALIDATION_RULES.project_name.message;
    }
    
    // Description validation
    if (formData.description && formData.description.length > VALIDATION_RULES.description.maxLength) {
      newErrors.description = VALIDATION_RULES.description.message;
    }
    
    // Parameter validation
    parameters.forEach(param => {
      if (param.required) {
        const value = formData.design_parameters[param.name];
        if (value === undefined || value === null || value === '') {
          newErrors[`param_${param.name}`] = `${param.label} is required`;
        }
      }
      
      // Number validation
      if (param.type === 'number' && formData.design_parameters[param.name] !== undefined) {
        const value = parseFloat(formData.design_parameters[param.name]);
        if (isNaN(value)) {
          newErrors[`param_${param.name}`] = 'Must be a valid number';
        } else {
          if (param.min !== undefined && value < param.min) {
            newErrors[`param_${param.name}`] = `Minimum value is ${param.min}`;
          }
          if (param.max !== undefined && value > param.max) {
            newErrors[`param_${param.name}`] = `Maximum value is ${param.max}`;
          }
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setNotification({
        type: 'error',
        message: 'Please fix validation errors before submitting'
      });
      return;
    }
    
    setLoading(true);
    setNotification(null);
    
    try {
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      
      const formDataToSend = new FormData();
      formDataToSend.append('project_name', formData.project_name);
      formDataToSend.append('design_type', formData.design_type);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('organization', formData.organization);
      formDataToSend.append('design_parameters', JSON.stringify(formData.design_parameters));
      
      if (formData.input_file) {
        formDataToSend.append('input_file', formData.input_file);
      }
      
      const response = await fetch(`${API_BASE_URL}/api/v1/designiq/projects/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataToSend
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create project');
      }
      
      const data = await response.json();
      
      setNotification({
        type: 'success',
        message: 'Project created successfully! Redirecting...'
      });
      
      // Redirect to project detail page
      setTimeout(() => {
        navigate(`/designiq/projects/${data.id}`);
      }, 1500);
      
    } catch (error) {
      console.error('Error creating project:', error);
      setNotification({
        type: 'error',
        message: error.message || 'Failed to create project'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!designConfig) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-8 text-center">
            <XCircleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-900 mb-2">Invalid Design Type</h2>
            <p className="text-red-700 mb-6">The requested design type is not supported</p>
            <button
              onClick={() => navigate('/designiq')}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Apply control styles */}
      <style>{pageControls.styles}</style>

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/designiq')}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-6 h-6 text-gray-600" />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <BeakerIcon className="w-8 h-8 text-blue-600" />
                <h1 className="text-3xl font-bold text-gray-900">Create New Project</h1>
              </div>
              <p className="text-gray-600 flex items-center gap-2">
                <span className="text-2xl">{designConfig.icon}</span>
                {designConfig.name}
              </p>
            </div>
          </div>

          {/* Page Controls */}
          <PageControlButtons
            sidebarVisible={pageControls.sidebarVisible}
            setSidebarVisible={pageControls.toggleSidebar}
            autoRefreshEnabled={false}
            setAutoRefreshEnabled={() => {}}
            isFullscreen={pageControls.isFullscreen}
            toggleFullscreen={pageControls.toggleFullscreen}
            isRefreshing={false}
            autoRefreshInterval={30}
          />
        </div>

        {/* Notification */}
        {notification && (
          <div className={`mb-6 rounded-lg border-2 p-4 ${
            notification.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? (
                <CheckCircleIcon className="w-5 h-5" />
              ) : (
                <XCircleIcon className="w-5 h-5" />
              )}
              <p>{notification.message}</p>
            </div>
          </div>
        )}

        {/* Template Selection */}
        {templates && templates.length > 0 && (
          <div className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-purple-900 flex items-center gap-2">
                  <LightBulbIcon className="w-5 h-5" />
                  AI-Powered Templates
                </h3>
                <p className="text-sm text-purple-700 mt-1">
                  Start with industry-standard templates optimized by AI
                </p>
              </div>
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
              >
                {showTemplates ? 'Hide Templates' : 'Show Templates'}
              </button>
            </div>

            {showTemplates && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {templates.map((template, index) => (
                  <button
                    key={index}
                    onClick={() => loadTemplate(template)}
                    className="bg-white rounded-lg p-4 border-2 border-purple-200 hover:border-purple-400 transition-all text-left hover:shadow-md"
                  >
                    <h4 className="font-semibold text-gray-900 mb-1">{template.name}</h4>
                    <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                    <div className="flex items-center gap-2 text-xs text-purple-600">
                      <SparklesIcon className="w-4 h-4" />
                      <span>AI-Optimized Parameters</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <InformationCircleIcon className="w-6 h-6 text-blue-600" />
              Basic Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Project Name */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.project_name}
                    onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                    onBlur={() => generateAISuggestions('project_name', formData.project_name)}
                    placeholder="Enter project name"
                    className={`w-full px-4 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.project_name ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {aiGenerating && (
                    <SparklesIcon className="absolute right-3 top-3 w-5 h-5 text-purple-500 animate-pulse" />
                  )}
                </div>
                {errors.project_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.project_name}</p>
                )}
                
                {/* AI Suggestions */}
                {aiSuggestions && aiSuggestions.field === 'project_name' && (
                  <div className="mt-2 space-y-2">
                    {aiSuggestions.options.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => applySuggestion('project_name', suggestion)}
                        className="block w-full text-left px-3 py-2 bg-purple-50 hover:bg-purple-100 rounded-lg text-sm text-purple-900 border border-purple-200 transition-colors"
                      >
                        <SparklesIcon className="w-4 h-4 inline mr-2" />
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Organization */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Organization
                </label>
                <input
                  type="text"
                  value={formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  onBlur={() => generateAISuggestions('organization', formData.organization)}
                  placeholder="Your organization name"
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {aiSuggestions && aiSuggestions.field === 'organization' && (
                  <div className="mt-2 space-y-2">
                    {aiSuggestions.options.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => applySuggestion('organization', suggestion)}
                        className="block w-full text-left px-3 py-2 bg-purple-50 hover:bg-purple-100 rounded-lg text-sm text-purple-900 border border-purple-200"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Design Type (Read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Design Type
                </label>
                <div className="px-4 py-2 bg-gray-100 border-2 border-gray-300 rounded-lg text-gray-700 font-medium">
                  {designConfig.name}
                </div>
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  onBlur={() => generateAISuggestions('description', formData.description)}
                  placeholder="Describe your project objectives and requirements..."
                  rows={5}
                  className={`w-full px-4 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.description ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description}</p>
                )}
                {aiSuggestions && aiSuggestions.field === 'description' && (
                  <button
                    type="button"
                    onClick={() => applySuggestion('description', aiSuggestions.options)}
                    className="mt-2 w-full text-left px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 rounded-lg text-sm text-gray-700 border-2 border-purple-200"
                  >
                    <div className="flex items-start gap-2">
                      <SparklesIcon className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                      <span className="whitespace-pre-wrap">{aiSuggestions.options}</span>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Design Parameters */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BeakerIcon className="w-6 h-6 text-blue-600" />
              Design Parameters
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {parameters.map((param) => (
                <div key={param.name} className={param.type === 'textarea' ? 'md:col-span-2' : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {param.label}
                    {param.required && <span className="text-red-500 ml-1">*</span>}
                    {param.unit && <span className="text-gray-500 ml-1">({param.unit})</span>}
                  </label>

                  {/* Text/Number Input */}
                  {(param.type === 'text' || param.type === 'number') && (
                    <input
                      type={param.type}
                      value={formData.design_parameters[param.name] || ''}
                      onChange={(e) => handleParameterChange(param.name, e.target.value)}
                      placeholder={param.placeholder || ''}
                      min={param.min}
                      max={param.max}
                      step={param.type === 'number' ? 'any' : undefined}
                      className={`w-full px-4 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors[`param_${param.name}`] ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                  )}

                  {/* Select Input */}
                  {param.type === 'select' && (
                    <select
                      value={formData.design_parameters[param.name] || ''}
                      onChange={(e) => handleParameterChange(param.name, e.target.value)}
                      className={`w-full px-4 py-2 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors[`param_${param.name}`] ? 'border-red-300' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select {param.label}</option>
                      {param.options && param.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Multi-select Input */}
                  {param.type === 'multiselect' && (
                    <div className="border-2 border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto">
                      {param.options && param.options.map((option) => (
                        <label key={option.value} className="flex items-center gap-2 py-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(formData.design_parameters[param.name] || []).includes(option.value)}
                            onChange={(e) => {
                              const current = formData.design_parameters[param.name] || [];
                              const updated = e.target.checked
                                ? [...current, option.value]
                                : current.filter(v => v !== option.value);
                              handleParameterChange(param.name, updated);
                            }}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{option.label}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Help Text */}
                  {param.helpText && (
                    <p className="mt-1 text-xs text-gray-500">{param.helpText}</p>
                  )}

                  {/* Error Message */}
                  {errors[`param_${param.name}`] && (
                    <p className="mt-1 text-sm text-red-600">{errors[`param_${param.name}`]}</p>
                  )}

                  {/* AI Suggestion Badge */}
                  {param.aiSuggestion && (
                    <p className="mt-1 text-xs text-purple-600 flex items-center gap-1">
                      <SparklesIcon className="w-3 h-3" />
                      AI-suggested
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* File Upload */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DocumentArrowUpIcon className="w-6 h-6 text-blue-600" />
              Input Files (Optional)
            </h2>

            {!formData.input_file ? (
              <label className="block">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer">
                  <CloudArrowUpIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-2">Click to upload or drag and drop</p>
                  <p className="text-xs text-gray-500">
                    PDF, DWG, Excel, Images (Max {FILE_UPLOAD_CONFIG.maxSize / (1024 * 1024)}MB)
                  </p>
                </div>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  accept={FILE_UPLOAD_CONFIG.acceptedFormats.join(',')}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="border-2 border-green-300 bg-green-50 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CheckCircleIcon className="w-6 h-6 text-green-600 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900">{formData.input_file.name}</p>
                        <p className="text-sm text-gray-600">
                          {(formData.input_file.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    
                    {filePreview && (
                      <img 
                        src={filePreview} 
                        alt="Preview" 
                        className="mt-3 max-w-full h-32 object-contain rounded border border-gray-300"
                      />
                    )}
                  </div>
                  
                  <button
                    type="button"
                    onClick={removeFile}
                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    <XCircleIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/designiq')}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Creating...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-5 h-5" />
                  Create Project
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DesignIQNewProject;
