import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import rbacService from '../../services/rbac.service';
import { fetchOrganizations, fetchDepartments, fetchJobTitles, fetchRoles } from '../../store/slices/rbacSlice';
import {
  ROLE_LEVEL_COLORS,
  DEFAULT_LEVEL_COLOR,
  ROLE_LEVEL_LABELS,
  CUSTOM_ROLE_PREFIX,
  SENSITIVE_ROLE_CODES,
  SUPER_ADMIN_ROLE_CODE,
} from '../../config/rbacAccess.config';

/**
 * Simple Create User Form — basic profile + role assignment.
 * The role list is sourced live from Admin › Roles & Access Management
 * (/admin/roles). Module access is derived automatically from the assigned roles.
 */

const FORM_CONFIG = {
  title: 'Create New User',
  subtitle: 'Fill in the required information below',
  requiredFields: ['email', 'first_name', 'last_name', 'password'],
  sections: [
    {
      id: 'basic',
      title: 'Basic Information',
      description: 'Essential user details',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      collapsible: false,
      collapsed: false
    },
    {
      id: 'work',
      title: 'Work Information',
      description: 'Job-related details (Optional)',
      icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      collapsible: true,
      collapsed: true
    },
    {
      id: 'roles',
      title: 'Role Assignment',
      description: 'Pick one or more roles — access to modules follows from roles',
      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
      collapsible: true,
      collapsed: false
    }
  ],
  validation: {
    email: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email format' },
    password: { minLength: 8, message: 'Password must be at least 8 characters' },
    first_name: { minLength: 2, message: 'First name must be at least 2 characters' },
    last_name: { minLength: 2, message: 'Last name must be at least 2 characters' }
  },
  messages: {
    success: 'User created successfully!',
    loading: 'Creating user...',
    error: 'Failed to create user. Please try again.'
  }
};

const SimpleCreateUserForm = ({ onSuccess, onCancel }) => {
  const dispatch = useDispatch();
  const { organizations, departments, jobTitles, roles } = useSelector((state) => state.rbac);
  
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    organization_id: '',
    department: '',
    job_title: '',
    phone: '',
    role_ids: []
  });
  
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});

  // Dynamic role list — excludes internal `custom_*` per-user roles.
  const assignableRoles = useMemo(
    () => (roles || []).filter(r => r?.code && !r.code.startsWith(CUSTOM_ROLE_PREFIX)),
    [roles]
  );

  // Initialize expanded sections based on configuration
  useEffect(() => {
    const initialExpanded = {};
    FORM_CONFIG.sections.forEach(section => {
      initialExpanded[section.id] = !section.collapsed;
    });
    setExpandedSections(initialExpanded);
  }, []);

  useEffect(() => {
    dispatch(fetchOrganizations());
    dispatch(fetchDepartments());
    dispatch(fetchJobTitles());
    dispatch(fetchRoles());
  }, [dispatch]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleToggleRole = (roleId) => {
    setFormData(prev => ({
      ...prev,
      role_ids: prev.role_ids.includes(roleId)
        ? prev.role_ids.filter(id => id !== roleId)
        : [...prev.role_ids, roleId]
    }));
  };

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const validateField = (field, value) => {
    const validation = FORM_CONFIG.validation[field];
    if (!validation) return null;

    if (validation.pattern && !validation.pattern.test(value)) {
      return validation.message;
    }
    if (validation.minLength && value.length < validation.minLength) {
      return validation.message;
    }
    return null;
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Check required fields
    FORM_CONFIG.requiredFields.forEach(field => {
      if (!formData[field] || formData[field].trim() === '') {
        newErrors[field] = `${field.replace('_', ' ')} is required`;
      } else {
        const error = validateField(field, formData[field]);
        if (error) newErrors[field] = error;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      // Prepare payload - trim strings and remove empty optionals
      const payload = {
        email: formData.email.trim(),
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        password: formData.password,
        ...(formData.organization_id && { organization_id: formData.organization_id }),
        ...(formData.department && { department: formData.department.trim() }),
        ...(formData.job_title && { job_title: formData.job_title.trim() }),
        ...(formData.phone && { phone: formData.phone.trim() }),
        ...(formData.role_ids.length > 0 && { role_ids: formData.role_ids })
      };

      console.log('[SimpleCreateUserForm] Submitting:', payload);
      const response = await rbacService.createUser(payload);
      console.log('[SimpleCreateUserForm] Success:', response);
      
      if (onSuccess) {
        onSuccess(response);
      }
    } catch (error) {
      console.error('[SimpleCreateUserForm] Error:', error);
      
      // Parse backend errors
      if (error.response?.data) {
        const backendErrors = {};
        Object.keys(error.response.data).forEach(key => {
          const errorValue = error.response.data[key];
          backendErrors[key] = Array.isArray(errorValue) ? errorValue[0] : errorValue;
        });
        setErrors(backendErrors);
      } else {
        setErrors({ general: FORM_CONFIG.messages.error });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
      {/* Header - Matching EditUserModal */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{FORM_CONFIG.title}</h2>
              <p className="text-blue-100 text-sm">{FORM_CONFIG.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            type="button"
            className="text-white hover:text-gray-200 transition-colors p-2 hover:bg-white hover:bg-opacity-20 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Form Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* General Error */}
          {errors.general && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg flex items-start">
              <svg className="w-5 h-5 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {errors.general}
            </div>
          )}

          {/* Basic Information Section */}
          {renderSection('basic', (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Email */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="user@example.com"
                  disabled={isLoading}
                />
                {errors.email && (
                  <p className="text-xs text-red-600 mt-1 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.email}
                  </p>
                )}
              </div>

              {/* First Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => handleChange('first_name', e.target.value)}
                  className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                    errors.first_name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="John"
                  disabled={isLoading}
                />
                {errors.first_name && (
                  <p className="text-xs text-red-600 mt-1 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.first_name}
                  </p>
                )}
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => handleChange('last_name', e.target.value)}
                  className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                    errors.last_name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Doe"
                  disabled={isLoading}
                />
                {errors.last_name && (
                  <p className="text-xs text-red-600 mt-1 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.last_name}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                    errors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Minimum 8 characters"
                  disabled={isLoading}
                />
                {errors.password && (
                  <p className="text-xs text-red-600 mt-1 flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.password}
                  </p>
                )}
                {!errors.password && (
                  <p className="text-xs text-gray-500 mt-1">Minimum 8 characters required</p>
                )}
              </div>

              {/* Organization */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Organization
                </label>
                <select
                  value={formData.organization_id}
                  onChange={(e) => handleChange('organization_id', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                  disabled={isLoading}
                >
                  <option value="">Select organization (optional)</option>
                  {organizations?.map(org => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">If not selected, default organization will be assigned</p>
              </div>
            </div>
          ))}

          {/* Work Information Section - Collapsible */}
          {renderSection('work', (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Department - Dynamic Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                <select
                  value={formData.department}
                  onChange={(e) => handleChange('department', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                  disabled={isLoading}
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* Job Title - Dynamic Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Job Title</label>
                <select
                  value={formData.job_title}
                  onChange={(e) => handleChange('job_title', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                  disabled={isLoading}
                >
                  <option value="">Select Job Title</option>
                  {jobTitles.map((title) => (
                    <option key={title} value={title}>
                      {title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Phone Number */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="+971501234567"
                  disabled={isLoading}
                />
              </div>
            </div>
          ))}

          {/* Role Assignment Section */}
          {renderSection('roles', (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                <span className="text-xl">🛡️</span>
                <div className="flex-1 text-sm text-blue-900">
                  <p className="font-semibold">Access follows from roles.</p>
                  <p className="text-blue-800 mt-0.5">
                    Roles listed below come from <span className="font-semibold">Admin › Roles & Access Management</span>.
                    Assigned roles grant module access automatically. Users left unassigned get the system Default role.
                  </p>
                </div>
              </div>

              {formData.role_ids.length > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-purple-600 text-white rounded-full text-xs font-bold">
                      {formData.role_ids.length}
                    </span>
                    <span className="text-sm font-semibold text-purple-900">
                      Role{formData.role_ids.length !== 1 ? 's' : ''} selected
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, role_ids: [] }))}
                    className="text-xs text-purple-700 hover:text-purple-900 underline"
                    disabled={isLoading}
                  >
                    Clear all
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto border-2 border-gray-200 rounded-xl p-3 bg-white">
                {assignableRoles.length === 0 ? (
                  <div className="col-span-2 text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                    <div className="text-3xl mb-2">🔒</div>
                    <div className="text-sm font-medium">No assignable roles found.</div>
                    <div className="text-xs mt-1">Define roles at /admin/roles first.</div>
                  </div>
                ) : (
                  assignableRoles.map((role) => {
                    const isSelected = formData.role_ids.includes(role.id);
                    const color = ROLE_LEVEL_COLORS[role.level] || DEFAULT_LEVEL_COLOR;
                    const levelLabel = ROLE_LEVEL_LABELS[role.level] || 'Custom';
                    const isSensitive = SENSITIVE_ROLE_CODES.includes(role.code);
                    const isSuper = role.code === SUPER_ADMIN_ROLE_CODE;
                    return (
                      <label
                        key={role.id}
                        className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? `${color.border || 'border-blue-500'} ${color.bg} shadow-sm`
                            : 'border-gray-200 bg-white hover:border-blue-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRole(role.id)}
                          className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          disabled={isLoading}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${color.bg} ${color.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
                              L{role.level ?? '-'} · {levelLabel}
                            </span>
                            <span className="text-sm font-semibold text-gray-900 truncate">{role.name}</span>
                            {isSuper && <span className="text-xs">👑</span>}
                            {isSensitive && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                                ⚠️ Sensitive
                              </span>
                            )}
                          </div>
                          {role.description && (
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2">{role.description}</p>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          ))}

        </form>
      </div>
      {/* End Form Content */}

      {/* Footer - Fixed */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-6 py-2.5 border-2 border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{FORM_CONFIG.messages.loading}</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <span>Create User</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  // Helper function to render collapsible sections
  function renderSection(sectionId, content) {
    const section = FORM_CONFIG.sections.find(s => s.id === sectionId);
    if (!section) return null;

    const isExpanded = expandedSections[sectionId];
    const isCollapsible = section.collapsible;

    return (
      <div key={sectionId} className="border-b border-gray-200 pb-6 last:border-b-0">
        <div
          className={`flex items-center justify-between mb-4 ${isCollapsible ? 'cursor-pointer' : ''}`}
          onClick={() => isCollapsible && toggleSection(sectionId)}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={section.icon} />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{section.title}</h3>
              {section.description && (
                <p className="text-sm text-gray-600">{section.description}</p>
              )}
            </div>
          </div>
          {isCollapsible && (
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>

        {isExpanded && content}
      </div>
    );
  }
};

export default SimpleCreateUserForm;
