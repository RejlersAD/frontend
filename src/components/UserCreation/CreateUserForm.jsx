/**
 * CreateUserForm - Robust User Creation Form
 * Soft-coded, step-by-step wizard with comprehensive validation
 * Redesigned from scratch for reliability
 */

import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import rbacService from '../../services/rbac.service';

// Soft-coded configuration
const FORM_CONFIG = {
  steps: [
    {
      id: 1,
      title: 'Basic Information',
      subtitle: 'Enter user details',
      icon: '👤',
      fields: ['email', 'first_name', 'last_name']
    },
    {
      id: 2,
      title: 'Password Setup',
      subtitle: 'Create secure password',
      icon: '🔒',
      fields: ['password', 'confirmPassword']
    },
    {
      id: 3,
      title: 'Organization Details',
      subtitle: 'Work information',
      icon: '🏢',
      fields: ['organization_id', 'department', 'job_title', 'phone']
    },
    {
      id: 4,
      title: 'Access Control',
      subtitle: 'Assign permissions',
      icon: '🔑',
      fields: ['role_ids', 'module_ids']
    }
  ],
  
  validation: {
    email: {
      required: true,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: 'Valid email address is required'
    },
    first_name: {
      required: true,
      minLength: 2,
      message: 'First name must be at least 2 characters'
    },
    last_name: {
      required: true,
      minLength: 2,
      message: 'Last name must be at least 2 characters'
    },
    password: {
      required: true,
      minLength: 8,
      message: 'Password must be at least 8 characters'
    },
    confirmPassword: {
      required: true,
      matchField: 'password',
      message: 'Passwords must match'
    }
  },
  
  messages: {
    success: 'User created successfully!',
    error: 'Failed to create user. Please try again.',
    loading: 'Creating user...'
  }
};

const CreateUserForm = ({ onSuccess, onCancel }) => {
  const { roles, modules } = useSelector((state) => state.rbac);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [organizations, setOrganizations] = useState([]);
  
  // Form data state
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    confirmPassword: '',
    organization_id: '',
    department: '',
    job_title: '',
    phone: '',
    role_ids: [],
    module_ids: []
  });
  
  // Load organizations on mount
  useEffect(() => {
    loadOrganizations();
  }, []);
  
  const loadOrganizations = async () => {
    try {
      const response = await rbacService.getOrganizations();
      const orgs = response?.data?.data || response?.data || [];
      setOrganizations(Array.isArray(orgs) ? orgs : []);
      
      // Auto-select first organization if available
      if (orgs.length > 0 && !formData.organization_id) {
        setFormData(prev => ({ ...prev, organization_id: orgs[0].id }));
      }
    } catch (error) {
      console.error('[CreateUserForm] Failed to load organizations:', error);
    }
  };
  
  // Validate current step
  const validateStep = (step) => {
    const stepConfig = FORM_CONFIG.steps.find(s => s.id === step);
    if (!stepConfig) return true;
    
    const stepErrors = {};
    
    stepConfig.fields.forEach(field => {
      const validation = FORM_CONFIG.validation[field];
      if (!validation) return;
      
      const value = formData[field];
      
      // Required validation
      if (validation.required && (!value || (Array.isArray(value) && value.length === 0))) {
        stepErrors[field] = validation.message || `${field} is required`;
        return;
      }
      
      // Pattern validation
      if (validation.pattern && value && !validation.pattern.test(value)) {
        stepErrors[field] = validation.message;
        return;
      }
      
      // Min length validation
      if (validation.minLength && value && value.length < validation.minLength) {
        stepErrors[field] = validation.message;
        return;
      }
      
      // Match field validation
      if (validation.matchField && value !== formData[validation.matchField]) {
        stepErrors[field] = validation.message;
        return;
      }
    });
    
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };
  
  // Handle next step
  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, FORM_CONFIG.steps.length));
    }
  };
  
  // Handle previous step
  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setErrors({});
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    if (!validateStep(currentStep)) {
      return;
    }
    
    setLoading(true);
    setErrors({});
    
    try {
      // Prepare payload (remove confirmPassword)
      const { confirmPassword, ...payload } = formData;
      
      // Ensure data is properly formatted
      const finalPayload = {
        email: payload.email?.trim().toLowerCase(),
        first_name: payload.first_name?.trim(),
        last_name: payload.last_name?.trim(),
        password: payload.password,
        organization_id: payload.organization_id || null,
        department: payload.department?.trim() || null,
        job_title: payload.job_title?.trim() || null,
        phone: payload.phone?.trim() || null,
        role_ids: Array.isArray(payload.role_ids) ? payload.role_ids : [],
        module_ids: Array.isArray(payload.module_ids) ? payload.module_ids : []
      };
      
      console.log('[CreateUserForm] Submitting payload:', finalPayload);
      
      const response = await rbacService.createUser(finalPayload);
      console.log('[CreateUserForm] Success:', response);
      
      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (error) {
      console.error('[CreateUserForm] Error:', error);
      console.error('[CreateUserForm] Error response:', error.response?.data);
      
      // Parse error response
      const errorData = error.response?.data;
      if (errorData && typeof errorData === 'object') {
        const fieldErrors = {};
        Object.entries(errorData).forEach(([field, messages]) => {
          if (field !== 'detail' && field !== 'message') {
            fieldErrors[field] = Array.isArray(messages) ? messages[0] : messages;
          }
        });
        setErrors(fieldErrors);
      } else {
        setErrors({ general: FORM_CONFIG.messages.error });
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Handle input change
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };
  
  // Render step 1: Basic Information
  const renderStep1 = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Email Address <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
            errors.email ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="user@example.com"
          autoFocus
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email}</p>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.first_name}
            onChange={(e) => handleChange('first_name', e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              errors.first_name ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="John"
          />
          {errors.first_name && (
            <p className="mt-1 text-sm text-red-600">{errors.first_name}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Last Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.last_name}
            onChange={(e) => handleChange('last_name', e.target.value)}
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              errors.last_name ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Doe"
          />
          {errors.last_name && (
            <p className="mt-1 text-sm text-red-600">{errors.last_name}</p>
          )}
        </div>
      </div>
    </div>
  );
  
  // Render step 2: Password Setup
  const renderStep2 = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Password <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          value={formData.password}
          onChange={(e) => handleChange('password', e.target.value)}
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
            errors.password ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Enter password (min 8 characters)"
          autoFocus
        />
        {errors.password && (
          <p className="mt-1 text-sm text-red-600">{errors.password}</p>
        )}
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Confirm Password <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => handleChange('confirmPassword', e.target.value)}
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
            errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Confirm password"
        />
        {errors.confirmPassword && (
          <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
        )}
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Password Requirements:</strong>
          <ul className="mt-2 ml-4 list-disc">
            <li>Minimum 8 characters</li>
            <li>At least one uppercase letter recommended</li>
            <li>At least one number recommended</li>
          </ul>
        </p>
      </div>
    </div>
  );
  
  // Render step 3: Organization Details
  const renderStep3 = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Organization
        </label>
        <select
          value={formData.organization_id}
          onChange={(e) => handleChange('organization_id', e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select organization</option>
          {organizations.map(org => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Department
        </label>
        <input
          type="text"
          value={formData.department}
          onChange={(e) => handleChange('department', e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., Engineering"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Job Title
        </label>
        <input
          type="text"
          value={formData.job_title}
          onChange={(e) => handleChange('job_title', e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., Software Engineer"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Phone Number
        </label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="+971501234567"
        />
      </div>
    </div>
  );
  
  // Render step 4: Access Control
  const renderStep4 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Roles (Optional)
        </label>
        <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto p-2">
          {Array.isArray(roles) && roles.map(role => (
            <label
              key={role.id}
              className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                formData.role_ids.includes(role.id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <input
                type="checkbox"
                checked={formData.role_ids.includes(role.id)}
                onChange={(e) => {
                  const newRoles = e.target.checked
                    ? [...formData.role_ids, role.id]
                    : formData.role_ids.filter(id => id !== role.id);
                  handleChange('role_ids', newRoles);
                }}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="ml-3">
                <span className="text-sm font-medium text-gray-900">{role.name}</span>
                {role.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{role.description}</p>
                )}
              </div>
            </label>
          ))}
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Accessible Modules (Optional)
        </label>
        <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto p-2">
          {Array.isArray(modules) && modules.map(module => (
            <label
              key={module.id}
              className={`flex flex-col items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                formData.module_ids.includes(module.id)
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-purple-300'
              }`}
            >
              <input
                type="checkbox"
                checked={formData.module_ids.includes(module.id)}
                onChange={(e) => {
                  const newModules = e.target.checked
                    ? [...formData.module_ids, module.id]
                    : formData.module_ids.filter(id => id !== module.id);
                  handleChange('module_ids', newModules);
                }}
                className="mb-2 w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-gray-900 text-center">{module.name}</span>
            </label>
          ))}
        </div>
        {errors.module_ids && (
          <p className="mt-2 text-sm text-red-600">{errors.module_ids}</p>
        )}
      </div>
    </div>
  );
  
  const currentStepConfig = FORM_CONFIG.steps.find(s => s.id === currentStep);
  
  return (
    <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Create New User</h2>
            <p className="text-blue-100 mt-1">Step {currentStep} of {FORM_CONFIG.steps.length}</p>
          </div>
          <button
            onClick={onCancel}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Progress bar */}
        <div className="mt-4 bg-white/20 rounded-full h-2">
          <div
            className="bg-white rounded-full h-2 transition-all duration-300"
            style={{ width: `${(currentStep / FORM_CONFIG.steps.length) * 100}%` }}
          />
        </div>
      </div>
      
      {/* Content */}
      <div className="p-8 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 240px)' }}>
        {/* Step indicator */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">{currentStepConfig?.icon}</div>
          <h3 className="text-xl font-bold text-gray-900">{currentStepConfig?.title}</h3>
          <p className="text-gray-600 mt-1">{currentStepConfig?.subtitle}</p>
        </div>
        
        {/* General error */}
        {errors.general && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{errors.general}</p>
          </div>
        )}
        
        {/* Form fields */}
        <div className="max-w-2xl mx-auto">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </div>
      </div>
      
      {/* Footer */}
      <div className="border-t border-gray-200 p-6 bg-gray-50 flex items-center justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentStep === 1}
          className="px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Previous
        </button>
        
        <div className="flex items-center space-x-2">
          {FORM_CONFIG.steps.map(step => (
            <div
              key={step.id}
              className={`w-2 h-2 rounded-full ${
                step.id === currentStep ? 'bg-blue-600' : step.id < currentStep ? 'bg-green-500' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
        
        {currentStep < FORM_CONFIG.steps.length ? (
          <button
            onClick={handleNext}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating...
              </>
            ) : (
              '✓ Create User'
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default CreateUserForm;
