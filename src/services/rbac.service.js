/**
 * RBAC Service - API calls for Super Admin Dashboard
 */
import apiService from './api.service';

const RBAC_BASE_URL = '/rbac';

class RBACService {
  // ==================== Organizations ====================
  async getOrganizations() {
    return apiService.get(`${RBAC_BASE_URL}/organizations/`);
  }

  async createOrganization(data) {
    return apiService.post(`${RBAC_BASE_URL}/organizations/`, data);
  }

  async updateOrganization(id, data) {
    return apiService.patch(`${RBAC_BASE_URL}/organizations/${id}/`, data);
  }

  async deleteOrganization(id) {
    return apiService.delete(`${RBAC_BASE_URL}/organizations/${id}/`);
  }

  // ==================== Users ====================
  async getUsers(params = {}) {
    return apiService.get(`${RBAC_BASE_URL}/users/`, { params });
  }

  async getTotalUserCount() {
    // Company-wide count across all organizations. Super admin only —
    // regular admins get a 403 and should fall back to their org-scoped count.
    return apiService.get(`${RBAC_BASE_URL}/users/total-count/`);
  }

  async getUserById(id) {
    // Returns the full UserProfileSerializer payload (roles, modules,
    // engineer_profile, MFA, security fields) — used by feature pages that
    // need the rich record on demand (e.g. HR detail drawer).
    return apiService.get(`${RBAC_BASE_URL}/users/${id}/`);
  }

  async getCurrentUser() {
    return apiService.get(`${RBAC_BASE_URL}/users/me/`);
  }

  async createUser(data) {
    return apiService.post(`${RBAC_BASE_URL}/users/`, data);
  }

  async updateUser(id, data) {
    return apiService.patch(`${RBAC_BASE_URL}/users/${id}/`, data);
  }

  async deleteUser(id) {
    return apiService.delete(`${RBAC_BASE_URL}/users/${id}/`);
  }

  async assignRole(userId, roleId, isPrimary = false) {
    return apiService.post(`${RBAC_BASE_URL}/users/${userId}/assign_role/`, {
      role_id: roleId,
      is_primary: isPrimary
    });
  }

  async revokeRole(userId, roleId) {
    return apiService.post(`${RBAC_BASE_URL}/users/${userId}/revoke_role/`, {
      role_id: roleId
    });
  }

  // SOFT-CODED: marks role_id as the primary role for userId;
  // backend demotes all other roles for that user automatically.
  async setPrimaryRole(userId, roleId) {
    return apiService.post(`${RBAC_BASE_URL}/users/${userId}/set_primary_role/`, { role_id: roleId });
  }

  async deactivateUser(userId, reason) {
    return apiService.post(`${RBAC_BASE_URL}/users/${userId}/deactivate/`, { reason });
  }

  async bulkDeactivateByRoles(roleCodes = [], roleIds = [], options = {}) {
    /**
     * Bulk deactivate users by their roles
     * @param {Array<string>} roleCodes - Array of role codes (e.g., ['engineer', 'contractor'])
     * @param {Array<number>} roleIds - Array of role IDs (alternative to roleCodes)
     * @param {Object} options - Additional options
     * @param {boolean} options.excludeSuperAdmins - Exclude super admins from deactivation (default: true)
     * @param {boolean} options.dryRun - Preview mode, doesn't actually deactivate (default: false)
     * @returns {Promise<Object>} Response with deactivated count and details
     */
    return apiService.post(`${RBAC_BASE_URL}/users/bulk-deactivate-by-roles/`, {
      role_codes: roleCodes,
      role_ids: roleIds,
      exclude_super_admins: options.excludeSuperAdmins ?? true,
      dry_run: options.dryRun ?? false
    });
  }

  async activateUser(userId) {
    return apiService.post(`${RBAC_BASE_URL}/users/${userId}/activate/`);
  }

  async softDeleteUser(userId) {
    return apiService.delete(`${RBAC_BASE_URL}/users/${userId}/soft_delete/`);
  }

  async resetUserPassword(userId) {
    return apiService.post(`${RBAC_BASE_URL}/users/${userId}/reset-password/`);
  }

  async getUserStats() {
    return apiService.get(`${RBAC_BASE_URL}/users/stats/`);
  }

  async getDepartments() {
    return apiService.get(`${RBAC_BASE_URL}/users/departments/`);
  }

  async getJobTitles() {
    return apiService.get(`${RBAC_BASE_URL}/users/job-titles/`);
  }

  // ==================== Bulk Operations ====================
  async bulkUploadUsers(formData) {
    return apiService.post(`${RBAC_BASE_URL}/users/bulk_upload/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  }

  async downloadBulkUploadTemplate() {
    return apiService.get(`${RBAC_BASE_URL}/users/download_template/`, {
      responseType: 'blob'
    });
  }

  async exportUsers(format = 'csv') {
    // Param is 'file_format', NOT 'format' — DRF intercepts ?format= as a content-negotiation
    // override and raises Http404 when no renderer matches (csv/xlsx have no DRF renderer).
    return apiService.get(`${RBAC_BASE_URL}/users/export/`, {
      params: { file_format: format },
      responseType: 'blob'
    });
  }

  // ==================== Roles ====================
  async getRoles(config = {}) {
    // The backend queryset already hardcodes is_active=True, so no filter
    // param is needed here. No timeout — this is fetched in the background
    // (see UserManagement.jsx) and should never block page load, so let it
    // take as long as it needs instead of failing an otherwise-working call.
    return apiService.get(`${RBAC_BASE_URL}/roles/`, { timeout: 0, ...config });
  }

  // SOFT-CODED: calls the sync-default-role action on the RoleViewSet.
  // Assigns the Default role to every UserProfile that has no active role.
  async syncDefaultRole() {
    return apiService.post(`${RBAC_BASE_URL}/roles/sync-default-role/`);
  }

  // Flush cached module/permission lists for all users.
  // Call after deactivating roles or deploying RBAC fixes so every user's
  // next sidebar load reflects the correct role-based module set.
  async flushModuleCaches() {
    return apiService.post(`${RBAC_BASE_URL}/roles/flush-module-caches/`);
  }

  async createRole(data) {
    return apiService.post(`${RBAC_BASE_URL}/roles/`, data);
  }

  async updateRole(id, data) {
    return apiService.patch(`${RBAC_BASE_URL}/roles/${id}/`, data);
  }

  async deleteRole(id) {
    return apiService.delete(`${RBAC_BASE_URL}/roles/${id}/`);
  }

  // Duplicate an existing role (copies module + permission grants) under a
  // new name. Always creates a plain custom role, even when cloning a
  // system role, so the clone can be freely edited/deleted.
  async duplicateRole(id, data) {
    return apiService.post(`${RBAC_BASE_URL}/roles/${id}/duplicate/`, data);
  }

  async assignPermissionToRole(roleId, permissionId) {
    return apiService.post(`${RBAC_BASE_URL}/roles/${roleId}/assign_permission/`, {
      permission_id: permissionId
    });
  }

  async revokePermissionFromRole(roleId, permissionId) {
    return apiService.post(`${RBAC_BASE_URL}/roles/${roleId}/revoke_permission/`, {
      permission_id: permissionId
    });
  }

  async assignModuleToRole(roleId, moduleId) {
    return apiService.post(`${RBAC_BASE_URL}/roles/${roleId}/assign_module/`, {
      module_id: moduleId
    });
  }

  async revokeModuleFromRole(roleId, moduleId) {
    return apiService.post(`${RBAC_BASE_URL}/roles/${roleId}/revoke_module/`, {
      module_id: moduleId
    });
  }

  // ==================== Permissions ====================
  async getPermissions() {
    return apiService.get(`${RBAC_BASE_URL}/permissions/`);
  }

  async checkPermission(userId, permissionCode) {
    return apiService.post(`${RBAC_BASE_URL}/permissions/check_permission/`, {
      user_id: userId,
      permission_code: permissionCode
    });
  }

  // ==================== Modules ====================
  async getModules() {
    return apiService.get(`${RBAC_BASE_URL}/modules/`);
  }

  async checkModuleAccess(userId, moduleCode) {
    return apiService.post(`${RBAC_BASE_URL}/modules/check_access/`, {
      user_id: userId,
      module_code: moduleCode
    });
  }

  // ==================== Audit Logs ====================
  async getAuditLogs(params = {}) {
    return apiService.get(`${RBAC_BASE_URL}/audit-logs/`, { params });
  }

  async getUserActivity(userId) {
    return apiService.get(`${RBAC_BASE_URL}/audit-logs/user_activity/`, {
      params: { user_id: userId }
    });
  }

  // ==================== Storage ====================
  async generateUploadUrl(fileData) {
    return apiService.post(`${RBAC_BASE_URL}/storage/generate_upload_url/`, fileData);
  }

  async uploadToS3(uploadUrl, fields, file) {
    const formData = new FormData();
    Object.entries(fields).forEach(([key, value]) => {
      formData.append(key, value);
    });
    formData.append('file', file);

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Failed to upload file to S3');
    }

    return response;
  }

  async verifyUpload(storageId, checksum) {
    return apiService.post(`${RBAC_BASE_URL}/storage/${storageId}/verify_upload/`, {
      checksum
    });
  }

  async getDownloadUrl(storageId) {
    return apiService.get(`${RBAC_BASE_URL}/storage/${storageId}/download/`);
  }

  async getFiles(params = {}) {
    return apiService.get(`${RBAC_BASE_URL}/storage/`, { params });
  }

  async getStorageStats() {
    return apiService.get(`${RBAC_BASE_URL}/storage/stats/`);
  }

  async deleteFile(storageId) {
    return apiService.delete(`${RBAC_BASE_URL}/storage/${storageId}/`);
  }

  // Bulk assign modules to all users
  async bulkAssignModules(data) {
    return apiService.post(`${RBAC_BASE_URL}/users/bulk-assign-modules/`, data);
  }

  // ── Access Requests ────────────────────────────────────────────────
  async getAccessRequests(params = {}) {
    return apiService.get(`${RBAC_BASE_URL}/access-requests/`, { params });
  }

  async createAccessRequest(data) {
    return apiService.post(`${RBAC_BASE_URL}/access-requests/`, data);
  }

  async approveAccessRequest(id, adminNote = '') {
    return apiService.post(
      `${RBAC_BASE_URL}/access-requests/${id}/approve/`,
      { admin_note: adminNote }
    );
  }

  async denyAccessRequest(id, adminNote = '') {
    return apiService.post(
      `${RBAC_BASE_URL}/access-requests/${id}/deny/`,
      { admin_note: adminNote }
    );
  }
}

export default new RBACService();
