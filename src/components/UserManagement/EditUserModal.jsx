import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDepartments, fetchJobTitles } from '../../store/slices/rbacSlice';
import { EDIT_USER_CONFIG, initializeFormData, validateField, hasChanges } from '../../config/editUser.config';
import { groupModulesByCategory, MODULE_CATEGORIES_CONFIG } from '../../config/moduleCategories.config';
import {
  ALLOW_PER_USER_MODULE_ASSIGNMENT,
  ACCESS_NOTICE,
  SENSITIVE_MODULE_CODES,
  isSensitiveModule,
} from '../../config/rbacAccess.config';

/**
 * Read-only panel showing the modules a user inherits from their assigned
 * roles. Rendered inside EditUserModal when ALLOW_PER_USER_MODULE_ASSIGNMENT
 * is false (the default). Replaces the legacy editable module checkboxes.
 */
const InheritedModulesReadOnly = ({ user, modules }) => {
  // Build a lookup: module code -> module row (for name/description).
  const moduleByCode = useMemo(() => {
    const m = new Map();
    (Array.isArray(modules) ? modules : []).forEach((mod) => {
      if (mod?.code) m.set(mod.code, mod);
    });
    return m;
  }, [modules]);

  // Normalize accessible_modules into a list of codes (accepts strings or objects).
  const codes = useMemo(() => {
    const list = Array.isArray(user?.accessible_modules) ? user.accessible_modules : [];
    return list
      .map((entry) => (typeof entry === 'string' ? entry : entry?.code))
      .filter(Boolean);
  }, [user]);

  const roleLabels = useMemo(() => {
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    return roles.map((r) => r?.name || r?.code).filter(Boolean);
  }, [user]);

  return (
    <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-white to-blue-50/40 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <span className="text-lg">🛡️</span>
            Modules (inherited from Roles)
          </h4>
          <p className="text-xs text-gray-600 mt-0.5">{ACCESS_NOTICE.BODY}</p>
        </div>
        <span className="shrink-0 text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-800">
          {codes.length} module{codes.length === 1 ? '' : 's'}
        </span>
      </div>

      {roleLabels.length > 0 && (
        <p className="text-xs text-gray-500 mb-3">
          via {roleLabels.join(', ')}
        </p>
      )}

      {codes.length === 0 ? (
        <p className="text-sm text-gray-500 italic">
          No modules granted. Assign a role to give this user access.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {codes.map((code) => {
            const mod = moduleByCode.get(code);
            const label = mod?.name || code;
            const sensitive = isSensitiveModule(code);
            return (
              <span
                key={code}
                title={mod?.description || label}
                className={
                  sensitive
                    ? 'inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border border-amber-300 bg-amber-50 text-amber-900'
                    : 'inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border border-gray-200 bg-white text-gray-700'
                }
              >
                {sensitive && <span aria-hidden>🔒</span>}
                {label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * Comprehensive Edit User Modal
 * Feature-rich, soft-coded user editing interface
 * Supports all user attributes, roles, modules, and advanced features
 */
const EditUserModal = ({
  isOpen,
  onClose,
  user,
  onSave,
  organizations = [],
  modules = [],
  roles = [],
  loading = false,
  currentUser = null
}) => {
  const dispatch = useDispatch();
  const { departments, jobTitles } = useSelector((state) => state.rbac);
  const [formData, setFormData] = useState({});
  const [originalData, setOriginalData] = useState({});
  const [errors, setErrors] = useState({});
  const [expandedSections, setExpandedSections] = useState({});
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [moduleSearch, setModuleSearch] = useState('');

  // Fetch departments and job titles on mount
  useEffect(() => {
    dispatch(fetchDepartments());
    dispatch(fetchJobTitles());
  }, [dispatch]);

  // Initialize form data when user changes
  useEffect(() => {
    if (user) {
      const initialData = initializeFormData(user);
      setFormData(initialData);
      setOriginalData(initialData);
      
      // Initialize expanded sections (collapse only collapsible ones)
      const initialExpanded = {};
      EDIT_USER_CONFIG.sections.forEach(section => {
        initialExpanded[section.id] = !section.collapsed;
      });
      setExpandedSections(initialExpanded);
    }
  }, [user]);

  // Check for unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return hasChanges(originalData, formData);
  }, [originalData, formData]);

  // Handle field change
  const handleFieldChange = (fieldName, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));

    // Clear error for this field
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  // Handle module toggle
  const handleModuleToggle = (moduleId) => {
    setFormData(prev => ({
      ...prev,
      module_ids: prev.module_ids?.includes(moduleId)
        ? prev.module_ids.filter(id => id !== moduleId)
        : [...(prev.module_ids || []), moduleId]
    }));
  };

  // Handle role toggle
  const handleRoleToggle = (roleId) => {
    setFormData(prev => ({
      ...prev,
      role_ids: prev.role_ids?.includes(roleId)
        ? prev.role_ids.filter(id => id !== roleId)
        : [...(prev.role_ids || []), roleId]
    }));
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    EDIT_USER_CONFIG.sections.forEach(section => {
      section.fields.forEach(field => {
        const error = validateField(field, formData[field.name]);
        if (error) {
          newErrors[field.name] = error;
        }
      });
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (EDIT_USER_CONFIG.behavior.confirmBeforeSave) {
      if (!window.confirm(EDIT_USER_CONFIG.messages.confirmation.save)) {
        return;
      }
    }

    // Defensive UUID normalization — backend PrimaryKeyRelatedField rejects
    // role/module objects. Keep this even though initializeFormData normalizes,
    // in case any code path pushes an object into the array.
    const normalizeIds = (arr) =>
      Array.isArray(arr)
        ? arr.map((item) => (typeof item === 'object' && item ? item.id : item)).filter(Boolean)
        : [];

    const cleanFormData = {
      ...formData,
      role_ids: normalizeIds(formData.role_ids),
      module_ids: normalizeIds(formData.module_ids),
    };

    // Access is role-based: strip module_ids unless the flag is on.
    const { module_ids, ...roleOnlyPayload } = cleanFormData;
    const payload = ALLOW_PER_USER_MODULE_ASSIGNMENT ? cleanFormData : roleOnlyPayload;
    await onSave(payload);

    if (EDIT_USER_CONFIG.behavior.closeOnSuccess) {
      handleClose();
    }
  };

  // Handle close with unsaved changes warning
  const handleClose = () => {
    if (hasUnsavedChanges && EDIT_USER_CONFIG.behavior.showUnsavedWarning) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        return;
      }
    }
    onClose();
  };

  // Handle section toggle
  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // Select all modules
  const handleSelectAllModules = () => {
    setFormData(prev => ({
      ...prev,
      module_ids: modules.map(m => m.id)
    }));
  };

  // Clear all modules
  const handleClearAllModules = () => {
    setFormData(prev => ({
      ...prev,
      module_ids: []
    }));
  };

  // Filter modules based on search
  const filteredModules = useMemo(() => {
    if (!moduleSearch) return modules;
    const search = moduleSearch.toLowerCase();
    return modules.filter(module =>
      module.name?.toLowerCase().includes(search) ||
      module.description?.toLowerCase().includes(search)
    );
  }, [modules, moduleSearch]);

  // Sections shown in the modal. Only per-user module access is hidden
  // (that always inherits from roles). Role assignment is shown so admins
  // can pick/replace roles directly here; the source list of roles is
  // managed at Admin › Roles & Access Management.
  const visibleSections = useMemo(() => {
    const hidden = new Set(['module_access']);
    return EDIT_USER_CONFIG.sections.filter((s) => !hidden.has(s.id));
  }, []);

  // Render field based on type
  const renderField = (field) => {
    const value = formData[field.name] || '';
    const error = errors[field.name];

    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
        return (
          <div key={field.name} className={`${field.gridCols || 'col-span-2'}`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type={field.type}
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              disabled={field.disabled}
              required={field.required}
              className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                field.disabled 
                  ? 'bg-gray-100 text-gray-600 cursor-not-allowed' 
                  : 'bg-white text-gray-900'
              } ${
                error ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {field.helpText && !error && (
              <p className="text-xs text-gray-500 mt-1">{field.helpText}</p>
            )}
            {error && (
              <p className="text-xs text-red-600 mt-1 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            )}
          </div>
        );

      case 'select':
        // Determine options based on field name
        let selectOptions = [];
        if (field.name === 'organization_id') {
          selectOptions = organizations;
        } else if (field.name === 'department') {
          selectOptions = departments.map(dept => ({ id: dept, name: dept }));
        } else if (field.name === 'job_title') {
          selectOptions = jobTitles.map(title => ({ id: title, name: title }));
        } else {
          selectOptions = field.options || [];
        }

        return (
          <div key={field.name} className={`${field.gridCols || 'col-span-2'}`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <select
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              required={field.required}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
            >
              <option value="">{field.placeholder || 'Select...'}</option>
              {selectOptions.map((option) => (
                <option key={option.id || option.name} value={option.id || option.name}>
                  {option.name}
                </option>
              ))}
            </select>
            {field.helpText && (
              <p className="text-xs text-gray-500 mt-1">{field.helpText}</p>
            )}
          </div>
        );

      case 'badge':
        const statusConfig = EDIT_USER_CONFIG.statusColors[value] || EDIT_USER_CONFIG.statusColors.active;
        return (
          <div key={field.name} className={`${field.gridCols || 'col-span-1'}`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">{field.label}</label>
            <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </div>
          </div>
        );

      case 'date-display':
        const displayDate = value ? new Date(value).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : 'Never';
        return (
          <div key={field.name} className={`${field.gridCols || 'col-span-1'}`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">{field.label}</label>
            <div className="text-gray-900 font-medium">{displayDate}</div>
          </div>
        );

      case 'number-display':
        return (
          <div key={field.name} className={`${field.gridCols || 'col-span-1'}`}>
            <label className="block text-sm font-medium text-gray-700 mb-2">{field.label}</label>
            <div className="text-2xl font-bold text-blue-600">{value || 0}</div>
          </div>
        );

      case 'toggle':
        return (
          <div key={field.name} className={`${field.gridCols || 'col-span-1'}`}>
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 cursor-pointer transition-colors">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{field.label}</div>
                {field.helpText && (
                  <div className="text-xs text-gray-600 mt-1">{field.helpText}</div>
                )}
              </div>
              <div className="relative inline-block w-12 h-6 ml-4">
                <input
                  type="checkbox"
                  checked={value || false}
                  onChange={(e) => {
                    if (field.requireConfirmation) {
                      if (window.confirm(field.confirmMessage)) {
                        handleFieldChange(field.name, e.target.checked);
                      }
                    } else {
                      handleFieldChange(field.name, e.target.checked);
                    }
                  }}
                  className="sr-only peer"
                />
                <div className={`block w-12 h-6 rounded-full transition-colors ${
                  value ? 'bg-blue-600' : 'bg-gray-300'
                }`}></div>
                <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  value ? 'transform translate-x-6' : ''
                }`}></div>
              </div>
            </label>
          </div>
        );

      case 'checkbox-group':
        // Use centralized category configuration
        const groupedModules = groupModulesByCategory(modules);
        
        // Filter modules by search term if provided
        const filteredGroupedModules = {};
        Object.entries(groupedModules).forEach(([categoryId, categoryData]) => {
          const filteredModules = categoryData.modules.filter(module =>
            !moduleSearch || 
            module.name.toLowerCase().includes(moduleSearch.toLowerCase()) ||
            module.description?.toLowerCase().includes(moduleSearch.toLowerCase()) ||
            module.code?.toLowerCase().includes(moduleSearch.toLowerCase())
          );
          
          if (filteredModules.length > 0) {
            filteredGroupedModules[categoryId] = {
              ...categoryData,
              modules: filteredModules
            };
          }
        });
        
        return (
          <div key={field.name} className={`${field.gridCols || 'col-span-2'}`}>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {field.showSelectAll && MODULE_CATEGORIES_CONFIG.features.enableQuickActions && (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleSelectAllModules}
                    className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1.5 rounded-md font-medium transition-colors"
                  >
                    ✓ Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllModules}
                    className="text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-1.5 rounded-md font-medium transition-colors"
                  >
                    ✕ Clear All
                  </button>
                </div>
              )}
            </div>

            {/* Selected Count Badge */}
            {formData.module_ids?.length > 0 && (
              <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-blue-900">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-xs mr-2">
                      {formData.module_ids.length}
                    </span>
                    Module{formData.module_ids.length !== 1 ? 's' : ''} Selected
                  </p>
                  <span className="text-xs text-blue-700">
                    of {modules.length} total
                  </span>
                </div>
              </div>
            )}

            {/* Search Bar */}
            {field.showSearch && MODULE_CATEGORIES_CONFIG.features.enableSearch && modules.length > 3 && (
              <div className="mb-4">
                <div className="relative">
                  <input
                    type="text"
                    value={moduleSearch}
                    onChange={(e) => setModuleSearch(e.target.value)}
                    placeholder="🔍 Search modules by name, code, or category..."
                    className="w-full pl-4 pr-10 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                  {moduleSearch && (
                    <button
                      type="button"
                      onClick={() => setModuleSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Categorized Modules */}
            <div className="space-y-4 max-h-[500px] overflow-y-auto border-2 border-gray-200 rounded-xl p-4 bg-white">
              {field.showCategoryGroups && Object.keys(filteredGroupedModules).length > 0 ? (
                Object.entries(filteredGroupedModules).map(([categoryId, categoryData]) => {
                  const { config, modules: categoryModules } = categoryData;
                  
                  const selectedInCategory = categoryModules.filter(m => 
                    formData.module_ids?.includes(m.id)
                  ).length;

                  return (
                    <div key={categoryId} className="border-b border-gray-200 last:border-0 pb-4 last:pb-0">
                      {/* Category Header */}
                      <div className={`flex items-center justify-between mb-3 ${config.bgColor} px-3 py-2.5 rounded-lg border ${config.borderColor}`}>
                        <div className="flex items-center gap-2">
                          {MODULE_CATEGORIES_CONFIG.display.showIcons && (
                            <span className="text-lg">{config.icon}</span>
                          )}
                          <h4 className={`text-sm font-bold ${config.textColor} uppercase tracking-wider`}>
                            {config.name}
                          </h4>
                          {MODULE_CATEGORIES_CONFIG.display.showDescriptions && (
                            <span className="hidden lg:inline text-xs text-gray-600 ml-2 font-normal normal-case">
                              {config.description}
                            </span>
                          )}
                        </div>
                        <span className={`text-xs ${config.badgeColor} ${config.textColor} px-2 py-1 rounded-full font-medium`}>
                          {selectedInCategory}/{categoryModules.length}
                        </span>
                      </div>

                      {/* Modules in Category */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 ml-2">
                        {categoryModules.map((module) => {
                          const isSelected = formData.module_ids?.includes(module.id);
                          return (
                            <label
                              key={module.id}
                              className={`flex items-start p-3 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                                isSelected
                                  ? `${config.borderColor} ${config.bgColor} shadow-sm`
                                  : 'border-gray-200 bg-white hover:border-blue-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleModuleToggle(module.id)}
                                className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                              />
                              <div className="ml-3 flex-1">
                                <div className="font-semibold text-gray-900 text-sm">
                                  {module.name}
                                </div>
                                {EDIT_USER_CONFIG.moduleDisplay.showDescription && module.description && (
                                  <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                                    {module.description}
                                  </div>
                                )}
                                {MODULE_CATEGORIES_CONFIG.features.showModuleCodes && module.code && (
                                  <div className="text-xs text-gray-400 mt-1 font-mono">
                                    {module.code}
                                  </div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                /* No modules found */
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">🔍</div>
                  <div className="font-medium">
                    {moduleSearch ? 'No modules found matching your search' : 'No modules available'}
                  </div>
                  {moduleSearch && (
                    <button
                      type="button"
                      onClick={() => setModuleSearch('')}
                      className="mt-3 text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              )}
            </div>

            {field.helpText && (
              <p className="text-xs text-gray-600 mt-3 flex items-start">
                <svg className="w-4 h-4 mr-1 mt-0.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                {field.helpText}
              </p>
            )}
          </div>
        );

      case 'role-selector':
        return (
          <div key={field.name} className={`${field.gridCols || 'col-span-2'}`}>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
            </div>

            {/* Selected Roles Summary */}
            {formData.role_ids?.length > 0 && (
              <div className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-purple-500 rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-purple-900">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-purple-600 text-white rounded-full text-xs mr-2">
                      {formData.role_ids.length}
                    </span>
                    Role{formData.role_ids.length !== 1 ? 's' : ''} Assigned
                  </p>
                  <span className="text-xs text-purple-700">
                    {roles.filter(r => formData.role_ids.includes(r.id)).map(r => r.name).join(', ')}
                  </span>
                </div>
              </div>
            )}

            {/* Roles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto border-2 border-gray-200 rounded-xl p-4 bg-white">
              {roles.length > 0 ? (
                roles.map((role) => {
                  const isSelected = formData.role_ids?.includes(role.id);
                  const isAdmin = role.name?.toLowerCase().includes('admin');
                  const isSuperAdmin = role.name?.toLowerCase().includes('super');
                  
                  // Choose icon based on role type
                  const roleIcon = isSuperAdmin ? '👑' : isAdmin ? '🛡️' : '👤';

                  return (
                    <label
                      key={role.id}
                      className={`flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all hover:shadow-lg ${
                        isSelected
                          ? isAdmin && EDIT_USER_CONFIG.roleDisplay.highlightAdmin
                            ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 shadow-md'
                            : 'border-blue-500 bg-blue-50 shadow-md'
                          : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-25'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleRoleToggle(role.id)}
                        className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{roleIcon}</span>
                            <div className="font-bold text-gray-900">{role.name}</div>
                          </div>
                          {EDIT_USER_CONFIG.roleDisplay.showPermissionCount && role.permissions?.length > 0 && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-semibold">
                              {role.permissions.length} perms
                            </span>
                          )}
                        </div>
                        {EDIT_USER_CONFIG.roleDisplay.showDescription && role.description && (
                          <div className="text-xs text-gray-600 mt-2 line-clamp-2">
                            {role.description}
                          </div>
                        )}
                        {isAdmin && (
                          <div className="mt-2 inline-flex items-center text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-1 rounded-md">
                            ⚡ Elevated Access
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })
              ) : (
                <div className="col-span-2 text-center py-8 text-gray-500 bg-gray-50 rounded-xl">
                  <div className="text-4xl mb-2">🔒</div>
                  <div className="font-medium">No roles available</div>
                </div>
              )}
            </div>

            {field.helpText && (
              <p className="text-xs text-gray-600 mt-3 flex items-start">
                <svg className="w-4 h-4 mr-1 mt-0.5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                {field.helpText}
              </p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // Render section
  const renderSection = (section) => {
    
    const isExpanded = expandedSections[section.id];
    const isCollapsible = section.collapsible;

    return (
      <div key={section.id} className="border-b border-gray-200 pb-6 last:border-b-0">
        <div
          className={`flex items-center justify-between mb-4 ${isCollapsible ? 'cursor-pointer' : ''}`}
          onClick={() => isCollapsible && toggleSection(section.id)}
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

        {isExpanded && (
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${section.readOnly ? 'bg-gray-50 p-4 rounded-lg' : ''}`}>
            {section.fields.map(renderField)}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-xl shadow-2xl ${EDIT_USER_CONFIG.modal.maxWidth} w-full ${EDIT_USER_CONFIG.modal.maxHeight} overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{EDIT_USER_CONFIG.modal.title}</h2>
                <p className="text-blue-100 text-sm">
                  Editing: {formData.first_name} {formData.last_name} ({formData.email})
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-white hover:text-gray-200 transition-colors p-2 hover:bg-white hover:bg-opacity-20 rounded-lg"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {visibleSections.map(renderSection)}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {hasUnsavedChanges && EDIT_USER_CONFIG.behavior.highlightChanges && (
                <div className="flex items-center gap-2 text-orange-600">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium">Unsaved changes</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className={EDIT_USER_CONFIG.buttons.cancel.className}
              >
                {EDIT_USER_CONFIG.buttons.cancel.label}
              </button>

              <button
                type="submit"
                disabled={loading || !hasUnsavedChanges}
                className={`${EDIT_USER_CONFIG.buttons.save.className} ${
                  !hasUnsavedChanges ? 'opacity-50 cursor-not-allowed' : ''
                } flex items-center gap-2`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{EDIT_USER_CONFIG.buttons.save.loadingLabel}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={EDIT_USER_CONFIG.buttons.save.icon} />
                    </svg>
                    <span>{EDIT_USER_CONFIG.buttons.save.label}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserModal;
