import React, { useState, useEffect, useMemo } from 'react';
import MULTI_ROLE_CONFIG from '../config/multiRoleConfig';
import { CUSTOM_ROLE_PREFIX } from '../config/rbacAccess.config';

/**
 * MultiRoleModal Component
 * Allows managing multiple role assignments for a user with primary role selection
 * 
 * Props:
 * - user: User object with current roles
 * - availableRoles: Array of all available roles
 * - onClose: Function to close modal
 * - onSave: Function to save role changes (receives { rolesToAdd, rolesToRemove, primaryRoleId })
 * - loading: Boolean indicating save operation in progress
 * 
 * Note: Custom roles (prefixed with 'custom_') are automatically filtered out.
 */
const MultiRoleModal = ({ user, availableRoles, onClose, onSave, loading = false }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [primaryRoleId, setPrimaryRoleId] = useState(null);
  const [hoveredRole, setHoveredRole] = useState(null);

  // Filter out custom roles from available roles (soft-coded using CUSTOM_ROLE_PREFIX)
  const systemRoles = useMemo(() => {
    return availableRoles.filter(role => !role.code?.startsWith(CUSTOM_ROLE_PREFIX));
  }, [availableRoles]);

  // Initialize selected roles from user's current roles
  useEffect(() => {
    if (user && user.roles) {
      const userRoleIds = user.roles.map(r => r.id || r.role_id);
      setSelectedRoles(userRoleIds);
      
      // Find and set primary role
      const primaryRole = user.roles.find(r => r.is_primary);
      if (primaryRole) {
        setPrimaryRoleId(primaryRole.id || primaryRole.role_id);
      } else if (userRoleIds.length > 0 && MULTI_ROLE_CONFIG.primaryRoleConfig.autoSetPrimary) {
        // Auto-set first role as primary if none exists
        setPrimaryRoleId(userRoleIds[0]);
      }
    }
  }, [user]);

  // Filter roles based on search query (only system roles, no custom roles)
  const filteredRoles = useMemo(() => {
    if (!searchQuery.trim()) return systemRoles;
    
    const query = searchQuery.toLowerCase();
    return systemRoles.filter(role => 
      role.name.toLowerCase().includes(query) ||
      role.code?.toLowerCase().includes(query) ||
      role.description?.toLowerCase().includes(query)
    );
  }, [systemRoles, searchQuery]);

  // Group roles by type (recommended, admin, user)
  // Note: Custom roles are excluded via systemRoles filter above
  const groupedRoles = useMemo(() => {
    if (!MULTI_ROLE_CONFIG.features.enableRoleGrouping) {
      return { all: filteredRoles };
    }

    const groups = {
      recommended: [],
      admin: [],
      user: [],
    };

    filteredRoles.forEach(role => {
      if (MULTI_ROLE_CONFIG.recommendedRoles.includes(role.code)) {
        groups.recommended.push(role);
      } else if (role.code?.includes('admin')) {
        groups.admin.push(role);
      } else {
        groups.user.push(role);
      }
    });

    return groups;
  }, [filteredRoles]);

  const handleRoleToggle = (roleId) => {
    setSelectedRoles(prev => {
      const isSelected = prev.includes(roleId);
      
      if (isSelected) {
        // Removing role
        const newRoles = prev.filter(id => id !== roleId);
        
        // If removing primary role, auto-select new primary
        if (roleId === primaryRoleId && newRoles.length > 0) {
          setPrimaryRoleId(newRoles[0]);
        } else if (newRoles.length === 0) {
          setPrimaryRoleId(null);
        }
        
        return newRoles;
      } else {
        // Adding role
        const newRoles = [...prev, roleId];
        
        // Auto-set as primary if it's the first role
        if (newRoles.length === 1 && MULTI_ROLE_CONFIG.primaryRoleConfig.autoSetPrimary) {
          setPrimaryRoleId(roleId);
        }
        
        // Check max roles validation
        if (MULTI_ROLE_CONFIG.validation.maxRoles && newRoles.length > MULTI_ROLE_CONFIG.validation.maxRoles) {
          alert(`Maximum ${MULTI_ROLE_CONFIG.validation.maxRoles} roles allowed per user`);
          return prev;
        }
        
        return newRoles;
      }
    });
  };

  const handleSetPrimary = (roleId) => {
    if (!selectedRoles.includes(roleId)) {
      // Auto-add role if setting as primary
      setSelectedRoles(prev => [...prev, roleId]);
    }
    setPrimaryRoleId(roleId);
  };

  const handleSave = () => {
    // Validation
    if (MULTI_ROLE_CONFIG.validation.requirePrimary && !primaryRoleId && selectedRoles.length > 0) {
      alert(MULTI_ROLE_CONFIG.primaryRoleConfig.requiredMessage);
      return;
    }

    // Calculate changes
    const currentRoleIds = (user.roles || []).map(r => r.id || r.role_id);
    const rolesToAdd = selectedRoles.filter(id => !currentRoleIds.includes(id));
    const rolesToRemove = currentRoleIds.filter(id => !selectedRoles.includes(id));

    onSave({
      rolesToAdd,
      rolesToRemove,
      primaryRoleId,
      selectedRoles,
    });
  };

  const isRoleSelected = (roleId) => selectedRoles.includes(roleId);
  const isRolePrimary = (roleId) => roleId === primaryRoleId;
  const isRoleRecommended = (roleCode) => MULTI_ROLE_CONFIG.recommendedRoles.includes(roleCode);

  const RoleGroupSection = ({ title, roles, icon }) => {
    if (!roles || roles.length === 0) return null;

    return (
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          {icon && <span>{icon}</span>}
          {title}
        </h4>
        <div className="space-y-2">
          {roles.map(role => (
            <RoleItem key={role.id} role={role} />
          ))}
        </div>
      </div>
    );
  };

  const RoleItem = ({ role }) => {
    const selected = isRoleSelected(role.id);
    const primary = isRolePrimary(role.id);
    const recommended = isRoleRecommended(role.code);
    const isProtected = MULTI_ROLE_CONFIG.validation.protectedRoles.includes(role.code);

    return (
      <div
        className={`
          p-3 rounded-lg border-2 transition-all cursor-pointer
          ${selected 
            ? primary
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-400 bg-gray-50'
            : 'border-gray-200 bg-white hover:border-gray-300'
          }
        `}
        onClick={() => handleRoleToggle(role.id)}
        onMouseEnter={() => setHoveredRole(role.id)}
        onMouseLeave={() => setHoveredRole(null)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            {/* Checkbox */}
            <div className="mt-0.5">
              <input
                type="checkbox"
                checked={selected}
                onChange={() => handleRoleToggle(role.id)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Role Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900">
                  {role.name}
                </span>
                
                {recommended && (
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full border border-green-200">
                    {MULTI_ROLE_CONFIG.recommendedBadgeText}
                  </span>
                )}
                
                {isProtected && (
                  <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full border border-red-200">
                    🔒 Protected
                  </span>
                )}
                
                {primary && (
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full border border-blue-300 font-semibold">
                    PRIMARY
                  </span>
                )}
                
                {MULTI_ROLE_CONFIG.badgeConfig.showRoleLevel && (
                  <span className="text-xs text-gray-500">
                    Level {role.level || 0}
                  </span>
                )}
              </div>
              
              {role.description && (
                <p className="text-sm text-gray-600 mt-1">
                  {role.description}
                </p>
              )}
              
              {MULTI_ROLE_CONFIG.badgeConfig.showModuleCount && role.module_count !== undefined && (
                <p className="text-xs text-gray-500 mt-1">
                  {role.module_count} modules
                </p>
              )}
            </div>
          </div>

          {/* Primary Role Button */}
          {selected && !primary && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSetPrimary(role.id);
              }}
              className="ml-2 px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
              title={MULTI_ROLE_CONFIG.actions.setPrimary.label}
            >
              Set Primary
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className={`inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle ${MULTI_ROLE_CONFIG.modalSettings.width} w-full`}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">
                  {MULTI_ROLE_CONFIG.modalSettings.title}
                </h3>
                <p className="text-sm text-blue-100 mt-1">
                  {MULTI_ROLE_CONFIG.modalSettings.subtitle}
                </p>
              </div>
              <button
                onClick={onClose}
                disabled={loading}
                className="text-white hover:text-gray-200 transition-colors disabled:opacity-50"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* User Info */}
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">
                  {user?.first_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {user?.first_name && user?.last_name 
                    ? `${user.first_name} ${user.last_name}`
                    : user?.email || 'Unknown User'
                  }
                </p>
                <p className="text-sm text-gray-600">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          {MULTI_ROLE_CONFIG.features.enableRoleSearch && (
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={MULTI_ROLE_CONFIG.roleSelectionConfig.searchPlaceholder}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <svg
                  className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          )}

          {/* Role Selection */}
          <div className={`px-6 py-4 overflow-y-auto ${MULTI_ROLE_CONFIG.modalSettings.maxHeight}`}>
            {filteredRoles.length === 0 ? (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mt-2 text-sm text-gray-500">
                  {searchQuery ? MULTI_ROLE_CONFIG.roleSelectionConfig.noResultsMessage : MULTI_ROLE_CONFIG.roleSelectionConfig.emptyStateMessage}
                </p>
              </div>
            ) : MULTI_ROLE_CONFIG.features.enableRoleGrouping ? (
              <>
                <RoleGroupSection title="⭐ Recommended Roles" roles={groupedRoles.recommended} icon="⭐" />
                <RoleGroupSection title="🛡️ Admin Roles" roles={groupedRoles.admin} icon="🛡️" />
                <RoleGroupSection title="👤 User Roles" roles={groupedRoles.user} icon="👤" />
              </>
            ) : (
              <div className="space-y-2">
                {filteredRoles.map(role => (
                  <RoleItem key={role.id} role={role} />
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                Selected: <span className="font-semibold text-gray-900">{selectedRoles.length}</span> role(s)
              </span>
              {primaryRoleId && (
                <span className="text-gray-600">
                  Primary: <span className="font-semibold text-blue-600">
                    {availableRoles.find(r => r.id === primaryRoleId)?.name || 'None'}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiRoleModal;
