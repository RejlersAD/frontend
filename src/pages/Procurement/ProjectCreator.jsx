/**
 * Procurement Project Creator
 * Smart project creation form with validation and soft-coded configuration
 * Follows RAD AI patterns from DesignIQ, InstrumentProjectManager, PFDVerification
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  BriefcaseIcon,
  UserGroupIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  MapPinIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  SparklesIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';

// ══════════════════════════════════════════════════════════════════════════════
// SOFT-CODED CONFIGURATION — Never hardcode values inline
// ══════════════════════════════════════════════════════════════════════════════

const PROJECT_TYPES = [
  { value: 'engineering', label: 'Engineering Services', icon: '⚙️' },
  { value: 'construction', label: 'Construction', icon: '🏗️' },
  { value: 'maintenance', label: 'Maintenance & Operations', icon: '🔧' },
  { value: 'pmc', label: 'Project Management Consultancy', icon: '📋' },
  { value: 'feasibility', label: 'Feasibility Study', icon: '🔍' },
  { value: 'feed', label: 'Front-End Engineering Design (FEED)', icon: '📐' },
  { value: 'detailed_design', label: 'Detailed Engineering', icon: '📝' },
  { value: 'commissioning', label: 'Commissioning & Startup', icon: '🚀' },
  { value: 'shutdown', label: 'Shutdown & Turnaround', icon: '⏸️' },
  { value: 'brownfield', label: 'Brownfield Modification', icon: '🏭' },
  { value: 'greenfield', label: 'Greenfield Development', icon: '🌱' },
  { value: 'internal', label: 'Internal Project', icon: '🏢' },
];

const PROJECT_STATUSES = [
  { value: 'planning', label: 'Planning', color: 'bg-blue-100 text-blue-800' },
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800' },
  { value: 'on_hold', label: 'On Hold', color: 'bg-yellow-100 text-yellow-800' },
];

const HEALTH_STATUSES = [
  { value: 'green', label: 'On Track', color: 'bg-green-100 text-green-800' },
  { value: 'yellow', label: 'At Risk', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'red', label: 'Critical', color: 'bg-red-100 text-red-800' },
];

const CURRENCIES = [
  { value: 'AED', label: 'AED (UAE Dirham)', symbol: 'د.إ' },
  { value: 'USD', label: 'USD (US Dollar)', symbol: '$' },
  { value: 'EUR', label: 'EUR (Euro)', symbol: '€' },
  { value: 'GBP', label: 'GBP (British Pound)', symbol: '£' },
  { value: 'SAR', label: 'SAR (Saudi Riyal)', symbol: 'ر.س' },
];

const COUNTRIES = [
  'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Oman',
  'Bahrain', 'Egypt', 'Iraq', 'United States', 'United Kingdom', 'Norway'
];

const REGIONS = [
  'Middle East', 'GCC', 'North Africa', 'Europe', 'North America', 'Asia Pacific'
];

// Validation rules (soft-coded)
const VALIDATION = {
  project_number: { min: 3, max: 100, required: true },
  project_name: { min: 5, max: 300, required: true },
  client_name: { min: 2, max: 200, required: false },
  description: { min: 10, max: 5000, required: false },
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

const ProjectCreator = () => {
  const navigate = useNavigate();
  
  // Form state
  const [formData, setFormData] = useState({
    // Identification
    project_number: '',
    project_name: '',
    client_name: '',
    client_reference: '',
    
    // Classification
    project_type: 'engineering',
    status: 'planning',
    health_status: 'green',
    
    // Organization
    cost_center: '',
    project_manager: '',
    project_manager_name: '',
    lead_engineer: '',
    
    // Scope
    description: '',
    scope_of_work: '',
    
    // Timeline
    start_date: '',
    planned_end_date: '',
    
    // Location
    site_location: '',
    country: 'United Arab Emirates',
    region: 'Middle East',
    
    // Financial
    contract_value: '',
    contract_currency: 'AED',
    payment_terms: '',
    
    // Metadata
    is_billable: true,
    is_internal: false,
    notes: '',
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);
  
  // Lookups
  const [costCenters, setCostCenters] = useState([]);
  const [users, setUsers] = useState([]);
  
  // Fetch reference data
  useEffect(() => {
    fetchCostCenters();
    fetchUsers();
  }, []);
  
  const fetchCostCenters = async () => {
    try {
      const response = await apiClient.get('/procurement/cost-centers/?is_active=true');
      setCostCenters(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to fetch cost centers:', error);
    }
  };
  
  const fetchUsers = async () => {
    try {
      const response = await apiClient.get('/rbac/users/?is_active=true&page_size=500');
      setUsers(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };
  
  // Auto-generate project number (soft-coded format: PRJ-YYYY-XXX)
  const generateProjectNumber = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const projectNumber = `PRJ-${year}-${random}`;
    
    setFormData(prev => ({ ...prev, project_number: projectNumber }));
    showNotification('success', 'Project number generated');
  };
  
  // Handle field changes
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
    
    // Derived logic (soft-coded)
    if (field === 'project_type' && value === 'internal') {
      setFormData(prev => ({ ...prev, is_internal: true, is_billable: false }));
    }
  };
  
  // Validate form (soft-coded validation rules)
  const validateForm = () => {
    const newErrors = {};
    
    // Required fields
    if (!formData.project_number || formData.project_number.length < VALIDATION.project_number.min) {
      newErrors.project_number = `Project number must be at least ${VALIDATION.project_number.min} characters`;
    }
    
    if (!formData.project_name || formData.project_name.length < VALIDATION.project_name.min) {
      newErrors.project_name = `Project name must be at least ${VALIDATION.project_name.min} characters`;
    }
    
    if (formData.project_name && formData.project_name.length > VALIDATION.project_name.max) {
      newErrors.project_name = `Project name must not exceed ${VALIDATION.project_name.max} characters`;
    }
    
    // Date validation
    if (formData.start_date && formData.planned_end_date) {
      if (new Date(formData.planned_end_date) < new Date(formData.start_date)) {
        newErrors.planned_end_date = 'End date must be after start date';
      }
    }
    
    // Financial validation
    if (formData.contract_value && isNaN(parseFloat(formData.contract_value))) {
      newErrors.contract_value = 'Contract value must be a valid number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      showNotification('error', 'Please fix the errors in the form');
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Clean up data before submission
      const payload = {
        ...formData,
        contract_value: formData.contract_value ? parseFloat(formData.contract_value) : null,
        cost_center: formData.cost_center || null,
        project_manager: formData.project_manager || null,
        lead_engineer: formData.lead_engineer || null,
      };
      
      const response = await apiClient.post('/procurement/projects/', payload);
      
      showNotification('success', 'Project created successfully!');
      
      // Redirect to project detail page after short delay
      setTimeout(() => {
        navigate(`/procurement/projects/${response.data.id}`);
      }, 1500);
      
    } catch (error) {
      console.error('Failed to create project:', error);
      
      // Extract error messages from response
      if (error.response?.data) {
        const apiErrors = {};
        Object.keys(error.response.data).forEach(key => {
          const value = error.response.data[key];
          apiErrors[key] = Array.isArray(value) ? value[0] : value;
        });
        setErrors(apiErrors);
      }
      
      showNotification('error', error.response?.data?.detail || 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Show notification
  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };
  
  // Render field group
  const FieldGroup = ({ title, icon: Icon, children }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
        <Icon className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
  
  // Render input field
  const InputField = ({ label, field, type = 'text', placeholder, required, helpText, rows }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {rows ? (
        <textarea
          value={formData[field] || ''}
          onChange={(e) => handleChange(field, e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors[field] ? 'border-red-500' : 'border-gray-300'
          }`}
        />
      ) : (
        <input
          type={type}
          value={formData[field] || ''}
          onChange={(e) => handleChange(field, e.target.value)}
          placeholder={placeholder}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors[field] ? 'border-red-500' : 'border-gray-300'
          }`}
        />
      )}
      {helpText && !errors[field] && (
        <p className="text-xs text-gray-500 mt-1">{helpText}</p>
      )}
      {errors[field] && (
        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
          <ExclamationCircleIcon className="h-3 w-3" />
          {errors[field]}
        </p>
      )}
    </div>
  );
  
  // Render select field
  const SelectField = ({ label, field, options, required, helpText }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={formData[field] || ''}
        onChange={(e) => handleChange(field, e.target.value)}
        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          errors[field] ? 'border-red-500' : 'border-gray-300'
        }`}
      >
        <option value="">Select...</option>
        {options.map(opt => (
          <option key={opt.value || opt} value={opt.value || opt}>
            {opt.label || opt}
          </option>
        ))}
      </select>
      {helpText && !errors[field] && (
        <p className="text-xs text-gray-500 mt-1">{helpText}</p>
      )}
      {errors[field] && (
        <p className="text-xs text-red-600 mt-1">{errors[field]}</p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/procurement/projects')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
                <span className="font-medium">Back to Projects</span>
              </button>
              <div className="h-6 w-px bg-gray-300" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Create New Project</h1>
                <p className="text-sm text-gray-600 mt-1">Set up a new procurement project</p>
              </div>
            </div>
            
            <button
              onClick={generateProjectNumber}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <SparklesIcon className="h-4 w-4" />
              Generate Project #
            </button>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
            notification.type === 'success' ? 'bg-green-50 text-green-800' :
            notification.type === 'error' ? 'bg-red-50 text-red-800' :
            'bg-blue-50 text-blue-800'
          }`}>
            {notification.type === 'success' && <CheckCircleIcon className="h-5 w-5" />}
            {notification.type === 'error' && <ExclamationCircleIcon className="h-5 w-5" />}
            {notification.type === 'info' && <InformationCircleIcon className="h-5 w-5" />}
            <span className="font-medium">{notification.message}</span>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* Identification */}
          <FieldGroup title="Project Identification" icon={BriefcaseIcon}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Project Number"
                field="project_number"
                placeholder="PRJ-2026-001"
                required
                helpText="Unique project identifier (auto-generated or custom)"
              />
              <InputField
                label="Client Reference"
                field="client_reference"
                placeholder="PO-1234"
                helpText="Client's PO or contract number"
              />
            </div>
            
            <InputField
              label="Project Name"
              field="project_name"
              placeholder="e.g., ADNOC Offshore Platform Modification"
              required
              helpText="Clear, descriptive project name"
            />
            
            <InputField
              label="Client Name"
              field="client_name"
              placeholder="e.g., ADNOC, Saudi Aramco"
            />
          </FieldGroup>

          {/* Classification */}
          <FieldGroup title="Classification & Status" icon={DocumentTextIcon}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SelectField
                label="Project Type"
                field="project_type"
                options={PROJECT_TYPES}
                required
                helpText="Primary project category"
              />
              <SelectField
                label="Status"
                field="status"
                options={PROJECT_STATUSES}
                required
              />
              <SelectField
                label="Health Status"
                field="health_status"
                options={HEALTH_STATUSES}
                required
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={formData.is_billable}
                  onChange={(e) => handleChange('is_billable', e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <label className="text-sm font-medium text-gray-700">
                  Client-Billable Project
                </label>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={formData.is_internal}
                  onChange={(e) => handleChange('is_internal', e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <label className="text-sm font-medium text-gray-700">
                  Internal R&D / Overhead Project
                </label>
              </div>
            </div>
          </FieldGroup>

          {/* Organization & Team */}
          <FieldGroup title="Organization & Team" icon={UserGroupIcon}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SelectField
                label="Cost Center"
                field="cost_center"
                options={costCenters.map(cc => ({ value: cc.id, label: `${cc.code} - ${cc.name}` }))}
                helpText="Budget allocation cost center"
              />
              
              <SelectField
                label="Project Manager"
                field="project_manager"
                options={users.map(u => ({ value: u.id, label: u.full_name || u.email }))}
                helpText="Primary project manager (from users list)"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="PM Name (Fallback)"
                field="project_manager_name"
                placeholder="If PM not in system"
                helpText="Use if project manager is not a system user"
              />
              
              <SelectField
                label="Lead Engineer"
                field="lead_engineer"
                options={users.map(u => ({ value: u.id, label: u.full_name || u.email }))}
              />
            </div>
          </FieldGroup>

          {/* Scope & Description */}
          <FieldGroup title="Project Scope" icon={DocumentTextIcon}>
            <InputField
              label="Description"
              field="description"
              rows={3}
              placeholder="Brief project overview..."
              helpText="High-level project summary"
            />
            
            <InputField
              label="Scope of Work"
              field="scope_of_work"
              rows={4}
              placeholder="Detailed scope, deliverables, and work breakdown..."
              helpText="Detailed work scope and deliverables"
            />
          </FieldGroup>

          {/* Timeline */}
          <FieldGroup title="Project Timeline" icon={CalendarIcon}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Start Date"
                field="start_date"
                type="date"
              />
              
              <InputField
                label="Planned End Date"
                field="planned_end_date"
                type="date"
              />
            </div>
          </FieldGroup>

          {/* Location */}
          <FieldGroup title="Location" icon={MapPinIcon}>
            <InputField
              label="Site Location"
              field="site_location"
              placeholder="e.g., Abu Dhabi Offshore Field"
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SelectField
                label="Country"
                field="country"
                options={COUNTRIES}
              />
              
              <SelectField
                label="Region"
                field="region"
                options={REGIONS}
              />
            </div>
          </FieldGroup>

          {/* Financial */}
          <FieldGroup title="Financial & Contract" icon={CurrencyDollarIcon}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Contract Value"
                field="contract_value"
                type="number"
                placeholder="0.00"
                helpText="Total contract amount"
              />
              
              <SelectField
                label="Currency"
                field="contract_currency"
                options={CURRENCIES}
              />
            </div>
            
            <InputField
              label="Payment Terms"
              field="payment_terms"
              rows={2}
              placeholder="e.g., Net 30, Milestone-based..."
            />
          </FieldGroup>

          {/* Notes */}
          <FieldGroup title="Additional Notes" icon={DocumentTextIcon}>
            <InputField
              label="Internal Notes"
              field="notes"
              rows={3}
              placeholder="Any additional notes or comments..."
            />
          </FieldGroup>

          {/* Actions */}
          <div className="flex items-center justify-between gap-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate('/procurement/projects')}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Creating Project...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="w-5 h-5" />
                  Create Project
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ProjectCreator;
