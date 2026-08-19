import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import {
  PROJECT_FORM_CONFIG,
  FIELD_TYPES,
  validateField,
  calculateComputedFields,
  transformFormDataForAPI,
  transformAPIToFormData,
} from '../utils/projectFormConfig';
import { Card, CardHeader, CardContent } from './ui/Card';

/**
 * Input Field Component - Renders appropriate input based on field type
 */
const FormField = ({ field, value, onChange, error, formData }) => {
  const handleChange = (e) => {
    const newValue = field.type === FIELD_TYPES.CHECKBOX ? e.target.checked : e.target.value;
    onChange(field.name, newValue);
  };

  const commonProps = {
    id: field.name,
    name: field.name,
    value: value || '',
    onChange: handleChange,
    className: `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      error ? 'border-red-500' : 'border-gray-300'
    } ${field.readOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`,
    placeholder: field.placeholder,
    required: field.required,
    readOnly: field.readOnly,
    disabled: field.readOnly
  };

  switch (field.type) {
    case FIELD_TYPES.TEXT:
    case FIELD_TYPES.EMAIL:
      return (
        <input
          type={field.type}
          {...commonProps}
        />
      );

    case FIELD_TYPES.NUMBER:
    case FIELD_TYPES.CURRENCY:
    case FIELD_TYPES.PERCENTAGE:
      return (
        <div className="relative">
          {field.type === FIELD_TYPES.CURRENCY && field.currency && (
            <span className="absolute left-3 top-2 text-gray-500">{field.currency}</span>
          )}
          <input
            type="number"
            {...commonProps}
            className={`${commonProps.className} ${
              field.type === FIELD_TYPES.CURRENCY && field.currency ? 'pl-12' : ''
            }`}
            step={field.type === FIELD_TYPES.CURRENCY ? '0.01' : '1'}
            min={field.validation?.min}
            max={field.validation?.max}
          />
          {field.type === FIELD_TYPES.PERCENTAGE && (
            <span className="absolute right-3 top-2 text-gray-500">%</span>
          )}
        </div>
      );

    case FIELD_TYPES.DATE:
      return (
        <input
          type="date"
          {...commonProps}
        />
      );

    case FIELD_TYPES.SELECT:
      return (
        <select {...commonProps}>
          <option value="">Select {field.label}</option>
          {field.options?.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case FIELD_TYPES.TEXTAREA:
      return (
        <textarea
          {...commonProps}
          rows={field.rows || 3}
        />
      );

    case FIELD_TYPES.CHECKBOX:
      return (
        <div className="flex items-center">
          <input
            type="checkbox"
            id={field.name}
            name={field.name}
            checked={value || false}
            onChange={handleChange}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor={field.name} className="ml-2 text-sm text-gray-700">
            {field.helpText || field.label}
          </label>
        </div>
      );

    default:
      return (
        <input
          type="text"
          {...commonProps}
        />
      );
  }
};

/**
 * Project Form Component
 */
export const ProjectForm = ({ project = null, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [currentSection, setCurrentSection] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form data
  useEffect(() => {
    if (project) {
      // Editing existing project — convert API field names → form field names
      setFormData(transformAPIToFormData(project));
    } else {
      // Creating new project - set defaults
      const defaults = {};
      PROJECT_FORM_CONFIG.sections.forEach(section => {
        section.fields.forEach(field => {
          if (field.defaultValue !== undefined) {
            defaults[field.name] = field.defaultValue;
          }
        });
      });
      setFormData(defaults);
    }
  }, [project]);

  // Handle field change
  const handleFieldChange = (fieldName, value) => {
    setFormData(prev => {
      const updated = { ...prev, [fieldName]: value };
      
      // Calculate computed fields
      const computed = calculateComputedFields(updated);
      return { ...updated, ...computed };
    });
    
    // Mark as touched
    setTouched(prev => ({ ...prev, [fieldName]: true }));
    
    // Clear error for this field
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  // Validate section
  const validateSection = (sectionIndex) => {
    const section = PROJECT_FORM_CONFIG.sections[sectionIndex];
    const sectionErrors = {};
    
    section.fields.forEach(field => {
      if (field.computed || field.readOnly) return;
      
      const error = validateField(field, formData[field.name], formData);
      if (error) {
        sectionErrors[field.name] = error;
      }
    });
    
    return sectionErrors;
  };

  // Handle next section
  const handleNext = () => {
    const sectionErrors = validateSection(currentSection);
    
    if (Object.keys(sectionErrors).length > 0) {
      setErrors(sectionErrors);
      // Mark all fields in section as touched
      const sectionFields = PROJECT_FORM_CONFIG.sections[currentSection].fields;
      const touchedFields = {};
      sectionFields.forEach(field => {
        touchedFields[field.name] = true;
      });
      setTouched(prev => ({ ...prev, ...touchedFields }));
      return;
    }
    
    setCurrentSection(prev => Math.min(prev + 1, PROJECT_FORM_CONFIG.sections.length - 1));
  };

  // Handle previous section
  const handlePrevious = () => {
    setCurrentSection(prev => Math.max(prev - 1, 0));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate all sections
    let allErrors = {};
    PROJECT_FORM_CONFIG.sections.forEach((section, index) => {
      const sectionErrors = validateSection(index);
      allErrors = { ...allErrors, ...sectionErrors };
    });
    
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      // Find first section with errors
      const firstErrorSection = PROJECT_FORM_CONFIG.sections.findIndex(section => 
        section.fields.some(field => allErrors[field.name])
      );
      setCurrentSection(firstErrorSection >= 0 ? firstErrorSection : 0);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const transformedData = transformFormDataForAPI(formData);
      await onSubmit(transformedData);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentSectionConfig = PROJECT_FORM_CONFIG.sections[currentSection];
  const totalSections = PROJECT_FORM_CONFIG.sections.length;
  const isLastSection = currentSection === totalSections - 1;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {project ? 'Edit Project' : 'Create New Project'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Section {currentSection + 1} of {totalSections}: {currentSectionConfig.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex gap-2">
            {PROJECT_FORM_CONFIG.sections.map((section, index) => (
              <div
                key={section.id}
                className={`flex-1 h-2 rounded-full transition-colors ${
                  index <= currentSection ? 'bg-blue-500' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-6">
            {/* Section Header */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {currentSectionConfig.title}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {currentSectionConfig.description}
              </p>
            </div>

            {/* Section Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {currentSectionConfig.fields.map(field => (
                <div
                  key={field.name}
                  className={field.type === FIELD_TYPES.TEXTAREA ? 'md:col-span-2' : ''}
                >
                  <label
                    htmlFor={field.name}
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  
                  <FormField
                    field={field}
                    value={formData[field.name]}
                    onChange={handleFieldChange}
                    error={touched[field.name] && errors[field.name]}
                    formData={formData}
                  />
                  
                  {/* Help Text */}
                  {field.helpText && field.type !== FIELD_TYPES.CHECKBOX && (
                    <p className="text-xs text-gray-500 mt-1">{field.helpText}</p>
                  )}
                  
                  {/* Error Message */}
                  {touched[field.name] && errors[field.name] && (
                    <div className="flex items-center gap-1 text-red-600 text-sm mt-1">
                      <AlertCircle className="w-4 h-4" />
                      <span>{errors[field.name]}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div>
            {currentSection > 0 && (
              <button
                type="button"
                onClick={handlePrevious}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
              >
                Previous
              </button>
            )}
          </div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            
            {!isLastSection ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {project ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  project ? 'Update Project' : 'Create Project'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Success/Error Toast Component
 */
export const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const Icon = type === 'success' ? CheckCircle : AlertCircle;
  const bgColor = type === 'success' ? 'bg-green-50' : 'bg-red-50';
  const borderColor = type === 'success' ? 'border-green-500' : 'border-red-500';
  const textColor = type === 'success' ? 'text-green-800' : 'text-red-800';
  const iconColor = type === 'success' ? 'text-green-600' : 'text-red-600';

  return (
    <div className={`fixed top-4 right-4 z-50 ${bgColor} border-l-4 ${borderColor} p-4 rounded-lg shadow-lg max-w-md`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1">
          <p className={`${textColor} font-medium`}>{message}</p>
        </div>
        <button
          onClick={onClose}
          className={`${textColor} hover:opacity-70 transition-opacity`}
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
