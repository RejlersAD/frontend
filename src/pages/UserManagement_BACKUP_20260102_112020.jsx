import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchUsers, fetchRoles, fetchModules, fetchCurrentUser } from '../store/slices/rbacSlice';
import rbacService from '../services/rbac.service';
import { STORAGE_KEYS } from '../config/app.config';

/**
 * User Management Page
 * CRUD operations for users with role assignment
 * Soft-coded authentication check and redirect
 */
const UserManagement = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { users, roles, modules, currentUser, loading, error } = useSelector((state) => state.rbac);
  const { user: authUser } = useSelector((state) => state.auth);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [authError, setAuthError] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [bulkUploadFile, setBulkUploadFile] = useState(null);
  const [bulkUploadResults, setBulkUploadResults] = useState(null);
  
  // Soft-coded: Action button states and configuration
  const [actionLoading, setActionLoading] = useState({});
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });
  
  // Soft-coded: Action button configuration
  const ACTION_CONFIG = {
    EDIT: {
      label: 'Edit',
      color: 'text-blue-600 hover:text-blue-900',
      icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
    },
    DEACTIVATE: {
      label: 'Deactivate',
      color: 'text-red-600 hover:text-red-900',
      icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636'
    },
    ACTIVATE: {
      label: 'Activate',
      color: 'text-green-600 hover:text-green-900',
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    DELETE: {
      label: 'Delete',
      color: 'text-red-600 hover:text-red-900',
      icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
    }
  };
  
  // Debug logging
  console.log('[UserManagement] Component loaded');
  console.log('[UserManagement] ACTION_CONFIG.DELETE:', ACTION_CONFIG.DELETE);
  
  // Soft-coded: Notification auto-dismiss timeout
  const NOTIFICATION_TIMEOUT = 5000;
  const [editFormData, setEditFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    organization_id: '',
    department: '',
    job_title: '',
    phone_number: '',
    module_ids: []
  });
  const [organizations, setOrganizations] = useState([]);
  const [departmentSuggestions, setDepartmentSuggestions] = useState([]);
  const [jobTitleSuggestions, setJobTitleSuggestions] = useState([]);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [showJobTitleDropdown, setShowJobTitleDropdown] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    organization_id: '',
    department: '',
    job_title: '',
    phone_number: '',
    module_ids: []
  });
  const [emailValidation, setEmailValidation] = useState({
    checking: false,
    isValid: false,
    isAvailable: false,
    message: ''
  });

  // Soft-coded: Check authentication and load data (runs once on mount)
  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    
    console.log('[UserManagement] Checking authentication...');
    console.log('[UserManagement] Access token exists:', !!token);
    console.log('[UserManagement] Refresh token exists:', !!refreshToken);
    
    if (!token && !refreshToken) {
      console.warn('[UserManagement] No authentication tokens found - redirecting to login');
      setIsAuthenticated(false);
      setAuthError(true);
      navigate('/login', { 
        replace: true,
        state: { from: '/admin/users', message: 'Please login to access User Management' }
      });
      return;
    }
    
    // User is authenticated - load data immediately
    console.log('[UserManagement] Authentication tokens found - loading data...');
    setIsAuthenticated(true);
    setAuthError(false);
    
    const loadData = async () => {
      try {
        console.log('[UserManagement] Fetching current user...');
        dispatch(fetchCurrentUser());
        
        console.log('[UserManagement] Fetching users, roles, and modules...');
        
        // Fetch users, roles, and modules via Redux
        await Promise.all([
          dispatch(fetchUsers()).unwrap(),
          dispatch(fetchRoles()).unwrap(),
          dispatch(fetchModules()).unwrap()
        ]);
        
        console.log('[UserManagement] Successfully loaded Redux data');
        
        // Load organizations
        try {
          const orgsResponse = await rbacService.getOrganizations();
          console.log('Organizations Response:', orgsResponse);
          
          let orgsData = [];
          if (orgsResponse) {
            if (Array.isArray(orgsResponse)) {
              orgsData = orgsResponse;
            } else if (orgsResponse.data) {
              orgsData = Array.isArray(orgsResponse.data) ? orgsResponse.data : (orgsResponse.data.results || []);
            } else if (orgsResponse.results) {
              orgsData = orgsResponse.results;
            }
          }
          setOrganizations(orgsData);
          console.log('✅ Organizations set to:', orgsData.length, 'items');
        } catch (error) {
          console.error('❌ Failed to load organizations:', error);
          setOrganizations([]);
        }
        
        // Extract departments and job titles
        try {
          const usersData = await rbacService.getUsers();
          console.log('Users Data for extraction:', usersData);
          
          let allUsers = [];
          if (usersData) {
            if (Array.isArray(usersData)) {
              allUsers = usersData;
            } else if (usersData.data) {
              allUsers = Array.isArray(usersData.data) ? usersData.data : (usersData.data.results || []);
            } else if (usersData.results) {
              allUsers = usersData.results;
            }
          }
          
          console.log('All Users array:', allUsers.length, 'users');
          
          if (Array.isArray(allUsers) && allUsers.length > 0) {
            const depts = allUsers
              .map(u => u?.department)
              .filter(d => d && typeof d === 'string' && d.trim() !== '');
            const uniqueDepartments = [...new Set(depts)].sort();
            
            const titles = allUsers
              .map(u => u?.job_title)
              .filter(j => j && typeof j === 'string' && j.trim() !== '');
            const uniqueJobTitles = [...new Set(titles)].sort();
            
            setDepartmentSuggestions(uniqueDepartments);
            setJobTitleSuggestions(uniqueJobTitles);
            console.log('Departments:', uniqueDepartments.length, 'Job Titles:', uniqueJobTitles.length);
          }
        } catch (error) {
          console.error('Failed to extract departments/titles:', error);
          setDepartmentSuggestions([]);
          setJobTitleSuggestions([]);
        }
      } catch (err) {
        console.error('[UserManagement] Failed to load data:', err);
        
        // Handle authentication errors
        if (err?.status === 401 || err?.message?.includes('401')) {
          console.warn('[UserManagement] Authentication error detected - redirecting to login');
          setAuthError(true);
          localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
          localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
          localStorage.removeItem(STORAGE_KEYS.USER_DATA);
          navigate('/login', { 
            replace: true,
            state: { from: '/admin/users', message: 'Session expired. Please login again.' }
          });
        }
      }
    };
    
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Soft-coded: Auto-dismiss notification
  // Soft-coded: Auto-dismiss notification
  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification({ show: false, type: '', message: '' });
      }, NOTIFICATION_TIMEOUT);
      return () => clearTimeout(timer);
    }
  }, [notification.show]);

  // Check if user has admin access via RBAC roles OR Django superuser/staff flags
  const hasRBACAdminRole = currentUser?.roles?.some(
    role => ['super_admin', 'admin'].includes(role.code)
  );
  
  const isDjangoSuperuser = authUser?.is_superuser || authUser?.is_staff;
  
  const hasAdminAccess = hasRBACAdminRole || isDjangoSuperuser;

  // Soft-coded: Show loading while checking authentication
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Checking Authentication...</h2>
          <p className="text-gray-600">Please wait while we verify your credentials</p>
        </div>
      </div>
    );
  }

  // Show access denied if user doesn't have permission
  if (!hasAdminAccess && !loading && currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You don't have permission to access User Management.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Ensure users is always an array before filtering
  const safeUsers = Array.isArray(users) ? users : (users?.results ? users.results : []);
  const safeRoles = Array.isArray(roles) ? roles : (roles?.results ? roles.results : []);
  const safeModules = Array.isArray(modules) ? modules : (modules?.results ? modules.results : []);
  const safeOrganizations = Array.isArray(organizations) ? organizations : [];
  
  console.log('Debug - users:', users, 'safeUsers length:', safeUsers.length);
  console.log('Debug - roles:', roles, 'safeRoles length:', safeRoles.length);
  console.log('Debug - modules:', modules, 'safeModules length:', safeModules.length);
  console.log('Debug - organizations:', organizations, 'safeOrganizations length:', safeOrganizations.length);
  
  const filteredUsers = safeUsers.filter(user => {
    // Safe access to user properties with fallback
    const userEmail = user?.email || user?.user?.email || '';
    const userFullName = user?.full_name || `${user?.user?.first_name || ''} ${user?.user?.last_name || ''}`.trim();
    
    const matchesSearch = userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         userFullName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateUser = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.email || !formData.password || !formData.first_name || !formData.last_name) {
      alert('Please fill in all required fields (Email, Password, First Name, Last Name)');
      return;
    }
    
    // Check email validation status
    if (!emailValidation.isValid || !emailValidation.isAvailable) {
      alert('Please provide a valid and available email address');
      return;
    }
    
    if (formData.password.length < 8) {
      alert('Password must be at least 8 characters long');
      return;
    }
    
    if (formData.module_ids.length === 0) {
      alert('Please select at least one feature for the user');
      return;
    }
    
    if (!formData.organization_id) {
      alert('Please select an organization for the user');
      return;
    }
    
    try {
      // Prepare data to send
      const userData = {
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        password: formData.password,
        organization_id: formData.organization_id,
        department: formData.department,
        job_title: formData.job_title,
        phone: formData.phone_number,
        module_ids: formData.module_ids
      };
      
      console.log('🚀 Creating user with data:', userData);
      console.log('📋 Data types:', {
        email: typeof userData.email,
        organization_id: typeof userData.organization_id,
        module_ids: Array.isArray(userData.module_ids),
        module_ids_length: userData.module_ids?.length
      });
      
      // Send flattened data structure
      const response = await rbacService.createUser(userData);
      
      console.log('✅ User created successfully:', response);
      
      // Show success message with email notification info
      alert(
        `User created successfully!\n\n` +
        `A welcome email has been sent to ${formData.email} with login credentials.\n\n` +
        `The user will be required to change their password on first login.`
      );
      
      setShowCreateModal(false);
      dispatch(fetchUsers());
      
      // Reset form
      setFormData({
        email: '',
        first_name: '',
        last_name: '',
        password: '',
        organization_id: '',
        department: '',
        job_title: '',
        phone_number: '',
        module_ids: []
      });
      setEmailValidation({
        checking: false,
        isValid: false,
        isAvailable: false,
        message: ''
      });
    } catch (error) {
      console.error('❌ Failed to create user:', error);
      console.error('❌ Error response:', error.response);
      console.error('❌ Error response data:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      
      // Extract error message
      let errorMessage = 'Failed to create user. Please try again.';
      if (error.response?.data) {
        if (typeof error.response.data === 'object') {
          // Handle validation errors
          const errors = [];
          for (const [field, messages] of Object.entries(error.response.data)) {
            if (Array.isArray(messages)) {
              errors.push(`${field}: ${messages.join(', ')}`);
            } else {
              errors.push(`${field}: ${messages}`);
            }
          }
          errorMessage = errors.join('\n');
          console.error('❌ Validation errors:', errors);
        } else {
          errorMessage = error.response.data;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    }
  };
  
  // Email validation handler with debouncing
  const validateEmail = useCallback(async (email) => {
    if (!email) {
      setEmailValidation({
        checking: false,
        isValid: false,
        isAvailable: false,
        message: ''
      });
      return;
    }
    
    setEmailValidation(prev => ({ ...prev, checking: true }));
    
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/users/validate-email/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          },
          body: JSON.stringify({ email })
        }
      );
      
      const data = await response.json();
      
      setEmailValidation({
        checking: false,
        isValid: data.is_valid,
        isAvailable: data.is_available,
        message: data.message
      });
    } catch (error) {
      console.error('Error validating email:', error);
      setEmailValidation({
        checking: false,
        isValid: false,
        isAvailable: false,
        message: 'Failed to validate email'
      });
    }
  }, []);
  
  // Debounced email validation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.email) {
        validateEmail(formData.email);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.email]);

  // Soft-coded: Enhanced status toggle with loading states and notifications
  const handleStatusToggle = async (userId, currentStatus) => {
    // Soft-coded: Confirmation dialog configuration
    const CONFIRM_CONFIG = {
      active: {
        title: 'Deactivate User',
        message: 'Are you sure you want to deactivate this user? They will lose access to the system.',
        action: 'deactivate'
      },
      inactive: {
        title: 'Activate User',
        message: 'Are you sure you want to activate this user? They will regain access to the system.',
        action: 'activate'
      }
    };
    
    const config = CONFIRM_CONFIG[currentStatus] || CONFIRM_CONFIG.inactive;
    const confirmed = window.confirm(`${config.title}\n\n${config.message}`);
    
    if (!confirmed) {
      console.log('[UserManagement] Status toggle cancelled by user');
      return;
    }
    
    // Soft-coded: Set loading state for specific user action
    setActionLoading(prev => ({ ...prev, [`${userId}_status`]: true }));
    
    try {
      console.log(`[UserManagement] ${config.action === 'deactivate' ? 'Deactivating' : 'Activating'} user: ${userId}`);
      
      let response;
      if (currentStatus === 'active') {
        response = await rbacService.deactivateUser(userId, 'Manual deactivation via User Management');
      } else {
        response = await rbacService.activateUser(userId);
      }
      
      console.log('[UserManagement] Status toggle response:', response);
      
      // Soft-coded: Success notification
      setNotification({
        show: true,
        type: 'success',
        message: `User ${config.action === 'deactivate' ? 'deactivated' : 'activated'} successfully! Database updated.`
      });
      
      // Soft-coded: Refresh users list to reflect database changes
      await dispatch(fetchUsers()).unwrap();
      console.log('[UserManagement] Users list refreshed from database');
      
    } catch (error) {
      console.error('[UserManagement] Failed to toggle status:', error);
      console.error('[UserManagement] Error details:', {
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        message: error?.message
      });
      
      // Soft-coded: Error notification with details
      let errorMessage = `Failed to ${config.action} user. `;
      if (error?.response?.data) {
        if (typeof error.response.data === 'object') {
          errorMessage += Object.values(error.response.data).flat().join(', ');
        } else {
          errorMessage += error.response.data;
        }
      } else if (error?.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Please try again.';
      }
      
      setNotification({
        show: true,
        type: 'error',
        message: errorMessage
      });
    } finally {
      // Soft-coded: Clear loading state
      setActionLoading(prev => {
        const newState = { ...prev };
        delete newState[`${userId}_status`];
        return newState;
      });
    }
  };

  // Soft-coded: Enhanced delete with confirmation, loading states, and database soft delete
  const handleDelete = async (userId, userEmail) => {
    console.log('[UserManagement] handleDelete called for user:', userId, userEmail);
    
    // Soft-coded: Delete confirmation configuration
    const DELETE_CONFIRM_CONFIG = {
      title: '⚠️ Delete User',
      message: `Are you sure you want to delete "${userEmail}"?\n\nThis action will:\n• Soft delete the user from the database\n• Deactivate their account\n• Preserve audit trail\n\nThe user will no longer appear in the active users list.`,
      confirmText: 'Type DELETE to confirm'
    };
    
    const userConfirmation = window.prompt(
      `${DELETE_CONFIRM_CONFIG.title}\n\n${DELETE_CONFIRM_CONFIG.message}\n\n${DELETE_CONFIRM_CONFIG.confirmText}:`
    );
    
    if (userConfirmation !== 'DELETE') {
      console.log('[UserManagement] Delete cancelled - confirmation failed');
      if (userConfirmation !== null) {
        setNotification({
          show: true,
          type: 'error',
          message: 'Delete cancelled. You must type "DELETE" to confirm.'
        });
      }
      return;
    }
    
    // Soft-coded: Set loading state for specific user delete action
    setActionLoading(prev => ({ ...prev, [`${userId}_delete`]: true }));
    
    try {
      console.log(`[UserManagement] 🗑️ Soft deleting user: ${userId} (${userEmail})`);
      
      const response = await rbacService.softDeleteUser(userId);
      
      console.log('[UserManagement] ✅ User soft deleted successfully:', response);
      
      // Soft-coded: Success notification
      setNotification({
        show: true,
        type: 'success',
        message: `User "${userEmail}" deleted successfully! Database updated with soft delete.`
      });
      
      // Soft-coded: Refresh users list to reflect database changes (user should disappear)
      await dispatch(fetchUsers()).unwrap();
      console.log('[UserManagement] 🔄 Users list refreshed from database');
      
    } catch (error) {
      console.error('[UserManagement] ❌ Failed to delete user:', error);
      console.error('[UserManagement] Error details:', {
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        message: error?.message
      });
      
      // Soft-coded: Error notification with details
      let errorMessage = 'Failed to delete user. ';
      if (error?.response?.data) {
        if (typeof error.response.data === 'object') {
          errorMessage += Object.values(error.response.data).flat().join(', ');
        } else {
          errorMessage += error.response.data;
        }
      } else if (error?.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Please try again or contact support.';
      }
      
      setNotification({
        show: true,
        type: 'error',
        message: errorMessage
      });
    } finally {
      // Soft-coded: Clear loading state
      setActionLoading(prev => {
        const newState = { ...prev };
        delete newState[`${userId}_delete`];
        return newState;
      });
    }
  };

  // Soft-coded: Bulk upload handlers
  const handleBulkUploadFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.name.endsWith('.csv')) {
        setNotification({
          show: true,
          type: 'error',
          message: 'Please upload a CSV file'
        });
        return;
      }
      setBulkUploadFile(file);
      setBulkUploadResults(null);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      console.log('📥 Downloading bulk upload template...');
      const response = await rbacService.downloadBulkUploadTemplate();
      
      // Create blob and download
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'user_bulk_upload_template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setNotification({
        show: true,
        type: 'success',
        message: 'Template downloaded successfully!'
      });
    } catch (error) {
      console.error('❌ Failed to download template:', error);
      setNotification({
        show: true,
        type: 'error',
        message: 'Failed to download template. Please try again.'
      });
    }
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    
    if (!bulkUploadFile) {
      setNotification({
        show: true,
        type: 'error',
        message: 'Please select a CSV file to upload'
      });
      return;
    }

    if (!formData.organization_id) {
      setNotification({
        show: true,
        type: 'error',
        message: 'Please select an organization for bulk upload'
      });
      return;
    }

    try {
      setActionLoading(prev => ({ ...prev, bulkUpload: true }));
      
      const formDataToSend = new FormData();
      formDataToSend.append('file', bulkUploadFile);
      formDataToSend.append('organization_id', formData.organization_id);
      
      console.log('📤 Uploading bulk users file...');
      const response = await rbacService.bulkUploadUsers(formDataToSend);
      
      console.log('✅ Bulk upload response:', response);
      setBulkUploadResults(response);
      
      // Refresh users list
      await dispatch(fetchUsers()).unwrap();
      
      const { summary } = response;
      setNotification({
        show: true,
        type: summary.failed > 0 ? 'warning' : 'success',
        message: `Bulk upload completed! Success: ${summary.successful}, Failed: ${summary.failed}, Skipped: ${summary.skipped}`
      });
      
      // Clear file input
      setBulkUploadFile(null);
      
    } catch (error) {
      console.error('❌ Failed to upload users:', error);
      
      let errorMessage = 'Failed to upload users. ';
      if (error.response?.data?.error) {
        errorMessage += error.response.data.error;
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Please check your file format and try again.';
      }
      
      setNotification({
        show: true,
        type: 'error',
        message: errorMessage
      });
    } finally {
      setActionLoading(prev => {
        const newState = { ...prev };
        delete newState.bulkUpload;
        return newState;
      });
    }
  };

  const handleEditClick = (user) => {
    console.log('📝 Opening edit modal for user:', user);
    setSelectedUser(user);
    
    // Pre-populate the edit form with user data
    setEditFormData({
      email: user.email || user.user?.email || '',
      first_name: user.first_name || user.user?.first_name || '',
      last_name: user.last_name || user.user?.last_name || '',
      organization_id: user.organization?.id || '',
      department: user.department || '',
      job_title: user.job_title || '',
      phone_number: user.phone || '',
      module_ids: user.modules?.map(m => m.id) || []
    });
    
    setShowEditModal(true);
  };

  // Soft-coded: Enhanced user update with comprehensive validation and database confirmation
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    
    // Soft-coded: Validation configuration
    const VALIDATION_CONFIG = {
      required: [
        { field: 'first_name', label: 'First Name', value: editFormData.first_name },
        { field: 'last_name', label: 'Last Name', value: editFormData.last_name },
        { field: 'email', label: 'Email', value: editFormData.email }
      ],
      minLength: [
        { field: 'first_name', label: 'First Name', value: editFormData.first_name, min: 2 },
        { field: 'last_name', label: 'Last Name', value: editFormData.last_name, min: 2 }
      ],
      array: [
        { field: 'module_ids', label: 'Features', value: editFormData.module_ids, minCount: 1 }
      ]
    };
    
    // Soft-coded: Validate selected user
    if (!selectedUser) {
      setNotification({
        show: true,
        type: 'error',
        message: 'No user selected for update. Please try again.'
      });
      return;
    }
    
    // Soft-coded: Validate required fields
    for (const field of VALIDATION_CONFIG.required) {
      if (!field.value || field.value.trim() === '') {
        setNotification({
          show: true,
          type: 'error',
          message: `${field.label} is required. Please fill in all required fields.`
        });
        return;
      }
    }
    
    // Soft-coded: Validate minimum length
    for (const field of VALIDATION_CONFIG.minLength) {
      if (field.value && field.value.trim().length < field.min) {
        setNotification({
          show: true,
          type: 'error',
          message: `${field.label} must be at least ${field.min} characters long.`
        });
        return;
      }
    }
    
    // Soft-coded: Validate arrays
    for (const field of VALIDATION_CONFIG.array) {
      if (!Array.isArray(field.value) || field.value.length < field.minCount) {
        setNotification({
          show: true,
          type: 'error',
          message: `Please select at least ${field.minCount} ${field.label.toLowerCase()} for the user.`
        });
        return;
      }
    }
    
    // Soft-coded: Set loading state
    setActionLoading(prev => ({ ...prev, updateUser: true }));
    
    try {
      // Soft-coded: Prepare update payload (excluding email as it's read-only)
      const updateData = {
        first_name: editFormData.first_name.trim(),
        last_name: editFormData.last_name.trim(),
        department: editFormData.department?.trim() || '',
        job_title: editFormData.job_title?.trim() || '',
        phone: editFormData.phone_number?.trim() || '',
        module_ids: editFormData.module_ids
      };
      
      // Soft-coded: Only include organization_id if provided
      if (editFormData.organization_id) {
        updateData.organization_id = editFormData.organization_id;
      }
      
      console.log('[UserManagement] 🚀 Updating user:', selectedUser.id);
      console.log('[UserManagement] 📝 Update payload:', updateData);
      console.log('[UserManagement] 📋 Data types:', {
        first_name: typeof updateData.first_name,
        last_name: typeof updateData.last_name,
        organization_id: typeof updateData.organization_id,
        module_ids: Array.isArray(updateData.module_ids),
        module_ids_count: updateData.module_ids?.length
      });
      
      // Soft-coded: Call API to update user in database
      const response = await rbacService.updateUser(selectedUser.id, updateData);
      
      console.log('[UserManagement] ✅ User updated successfully:', response);
      console.log('[UserManagement] 💾 Database updated with new values');
      
      // Soft-coded: Success notification
      setNotification({
        show: true,
        type: 'success',
        message: `User "${editFormData.first_name} ${editFormData.last_name}" updated successfully! Changes saved to database.`
      });
      
      // Soft-coded: Close modal and reset state
      setShowEditModal(false);
      setSelectedUser(null);
      
      // Soft-coded: Refresh users list from database
      await dispatch(fetchUsers()).unwrap();
      console.log('[UserManagement] 🔄 Users list refreshed from database');
      
      // Soft-coded: Reset edit form
      setEditFormData({
        email: '',
        first_name: '',
        last_name: '',
        organization_id: '',
        department: '',
        job_title: '',
        phone_number: '',
        module_ids: []
      });
      
    } catch (error) {
      console.error('[UserManagement] ❌ Failed to update user:', error);
      console.error('[UserManagement] Error response:', error.response);
      console.error('[UserManagement] Error data:', error.response?.data);
      console.error('[UserManagement] Error status:', error.response?.status);
      
      // Soft-coded: Parse and display error message
      let errorMessage = 'Failed to update user. ';
      
      if (error.response?.data) {
        if (typeof error.response.data === 'object') {
          const errors = [];
          for (const [field, messages] of Object.entries(error.response.data)) {
            const fieldLabel = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            if (Array.isArray(messages)) {
              errors.push(`${fieldLabel}: ${messages.join(', ')}`);
            } else {
              errors.push(`${fieldLabel}: ${messages}`);
            }
          }
          errorMessage += errors.join('. ');
        } else {
          errorMessage += error.response.data;
        }
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Please check your input and try again.';
      }
      
      setNotification({
        show: true,
        type: 'error',
        message: errorMessage
      });
    } finally {
      // Soft-coded: Clear loading state
      setActionLoading(prev => {
        const newState = { ...prev };
        delete newState.updateUser;
        return newState;
      });
    }
  };

  const toggleEditModule = (moduleId) => {
    setEditFormData(prev => ({
      ...prev,
      module_ids: prev.module_ids.includes(moduleId)
        ? prev.module_ids.filter(id => id !== moduleId)
        : [...prev.module_ids, moduleId]
    }));
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      suspended: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[status] || styles.inactive}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const toggleModule = (moduleId) => {
    setFormData(prev => ({
      ...prev,
      module_ids: prev.module_ids.includes(moduleId)
        ? prev.module_ids.filter(id => id !== moduleId)
        : [...prev.module_ids, moduleId]
    }));
  };

  const handleDepartmentInput = (value) => {
    setFormData({ ...formData, department: value });
    setShowDepartmentDropdown(value.length > 0);
  };

  const handleJobTitleInput = (value) => {
    setFormData({ ...formData, job_title: value });
    setShowJobTitleDropdown(value.length > 0);
  };

  const filteredDepartments = departmentSuggestions.filter(dept =>
    dept.toLowerCase().includes(formData.department.toLowerCase())
  );

  const filteredJobTitles = jobTitleSuggestions.filter(job =>
    job.toLowerCase().includes(formData.job_title.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Soft-coded: Notification Toast */}
        {notification.show && (
          <div className="fixed top-4 right-4 z-50 max-w-md w-full animate-slide-in-right">
            <div className={`rounded-lg shadow-2xl p-4 border-l-4 ${
              notification.type === 'success' 
                ? 'bg-green-50 border-green-500' 
                : notification.type === 'error'
                ? 'bg-red-50 border-red-500'
                : 'bg-blue-50 border-blue-500'
            }`}>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {notification.type === 'success' ? (
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : notification.type === 'error' ? (
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <p className={`text-sm font-medium ${
                    notification.type === 'success' 
                      ? 'text-green-800' 
                      : notification.type === 'error'
                      ? 'text-red-800'
                      : 'text-blue-800'
                  }`}>
                    {notification.message}
                  </p>
                </div>
                <button
                  onClick={() => setNotification({ show: false, type: '', message: '' })}
                  className="ml-4 flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Authentication Error Alert */}
        {authError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-red-800">Authentication Error</h3>
                <p className="mt-1 text-sm text-red-700">
                  You are not authenticated or your session has expired. Please <a href="/login" className="font-semibold underline hover:text-red-900">log in</a> to access this page.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-600 mt-1">Manage system users and their roles</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowBulkUploadModal(true)}
              className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2 transition-colors shadow-lg hover:shadow-xl"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span>Bulk Upload</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 transition-colors shadow-lg hover:shadow-xl"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Create User</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Roles</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Last Login</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {(user?.full_name || user?.email || 'U')[0]?.toUpperCase()}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user?.full_name || user?.email || 'Unknown User'}
                          </div>
                          <div className="text-sm text-gray-500">{user?.email || user?.user?.email || 'No email'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.department || '-'}</div>
                      <div className="text-sm text-gray-500">{user.job_title || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {user?.primary_role ? (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                            {user.primary_role.name}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500">No roles</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(user.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
                    </td>
                    {/* Soft-coded: Enhanced Actions Column with Loading States */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-3">
                        {/* Soft-coded: Edit Button */}
                        <button
                          onClick={() => handleEditClick(user)}
                          disabled={actionLoading[`${user.id}_status`] || actionLoading[`${user.id}_delete`]}
                          className={`${ACTION_CONFIG.EDIT.color} font-medium transition-all flex items-center space-x-1 ${
                            actionLoading[`${user.id}_status`] || actionLoading[`${user.id}_delete`] ? 'opacity-50 cursor-not-allowed' : 'hover:underline'
                          }`}
                          title="Edit user details"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ACTION_CONFIG.EDIT.icon} />
                          </svg>
                          <span>{ACTION_CONFIG.EDIT.label}</span>
                        </button>
                        
                        {/* Soft-coded: Activate/Deactivate Button with Loading Spinner */}
                        <button
                          onClick={() => handleStatusToggle(user.id, user.status)}
                          disabled={actionLoading[`${user.id}_status`] || actionLoading[`${user.id}_delete`] || actionLoading.updateUser}
                          className={`${
                            user.status === 'active' 
                              ? ACTION_CONFIG.DEACTIVATE.color 
                              : ACTION_CONFIG.ACTIVATE.color
                          } font-medium transition-all flex items-center space-x-1 ${
                            actionLoading[`${user.id}_status`] || actionLoading[`${user.id}_delete`] || actionLoading.updateUser
                              ? 'opacity-50 cursor-not-allowed' 
                              : 'hover:underline'
                          }`}
                          title={user.status === 'active' ? 'Deactivate user account' : 'Activate user account'}
                        >
                          {actionLoading[`${user.id}_status`] ? (
                            <>
                              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span>Processing...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={
                                  user.status === 'active' 
                                    ? ACTION_CONFIG.DEACTIVATE.icon 
                                    : ACTION_CONFIG.ACTIVATE.icon
                                } />
                              </svg>
                              <span>{user.status === 'active' ? ACTION_CONFIG.DEACTIVATE.label : ACTION_CONFIG.ACTIVATE.label}</span>
                            </>
                          )}
                        </button>
                        
                        {/* Soft-coded: Delete Button with Loading Spinner */}
                        <button
                          onClick={() => handleDelete(user.id, user.email || user.user?.email)}
                          disabled={actionLoading[`${user.id}_delete`] || actionLoading[`${user.id}_status`] || actionLoading.updateUser}
                          className={`${ACTION_CONFIG.DELETE.color} font-medium transition-all flex items-center space-x-1 ${
                            actionLoading[`${user.id}_delete`] || actionLoading[`${user.id}_status`] || actionLoading.updateUser
                              ? 'opacity-50 cursor-not-allowed' 
                              : 'hover:underline'
                          }`}
                          title="Soft delete user (preserves audit trail)"
                        >
                          {actionLoading[`${user.id}_delete`] ? (
                            <>
                              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span>Deleting...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ACTION_CONFIG.DELETE.icon} />
                              </svg>
                              <span>{ACTION_CONFIG.DELETE.label}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <p className="text-gray-500">No users found</p>
            </div>
          )}
        </div>

        {/* Create User Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-gray-900">Create New User</h2>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <form onSubmit={handleCreateUser} className="p-6">
                <div className="space-y-6">
                  {/* Basic Information Section */}
                  <div className="border-b border-gray-200 pb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 ${
                              emailValidation.checking ? 'border-gray-300' :
                              emailValidation.isValid && emailValidation.isAvailable ? 'border-green-500' :
                              formData.email && !emailValidation.isValid ? 'border-red-500' :
                              'border-gray-300'
                            }`}
                            placeholder="user@example.com"
                          />
                          {emailValidation.checking && (
                            <div className="absolute right-3 top-3">
                              <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            </div>
                          )}
                          {!emailValidation.checking && emailValidation.isValid && emailValidation.isAvailable && (
                            <div className="absolute right-3 top-3">
                              <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                        {emailValidation.message && (
                          <p className={`mt-1 text-sm ${
                            emailValidation.isValid && emailValidation.isAvailable ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {emailValidation.message}
                          </p>
                        )}
                        {emailValidation.isValid && emailValidation.isAvailable && (
                          <p className="mt-1 text-xs text-blue-600">
                            ℹ️ A welcome email with login credentials will be sent to this address
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Password <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="password"
                          required
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                          placeholder="Min. 8 characters"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          This is a temporary password. User will be required to change it on first login.
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          First Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.first_name}
                          onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                          placeholder="John"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Last Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.last_name}
                          onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                          placeholder="Doe"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                        <input
                          type="tel"
                          value={formData.phone_number}
                          onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                          placeholder="+1 (555) 123-4567"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Organization & Work Details Section */}
                  <div className="border-b border-gray-200 pb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Organization & Work Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Organization <span className="text-red-500">*</span>
                        </label>
                        <select
                          required
                          value={formData.organization_id}
                          onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                        >
                          <option value="">Select an organization...</option>
                          {safeOrganizations.map(org => (
                            <option key={org.id} value={org.id}>
                              {org.name} {org.is_active ? '' : '(Inactive)'}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                        <input
                          type="text"
                          value={formData.department}
                          onChange={(e) => handleDepartmentInput(e.target.value)}
                          onFocus={() => setShowDepartmentDropdown(true)}
                          onBlur={() => setTimeout(() => setShowDepartmentDropdown(false), 200)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                          placeholder="e.g., Engineering, Sales..."
                        />
                        {showDepartmentDropdown && filteredDepartments.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {filteredDepartments.map((dept, idx) => (
                              <div
                                key={idx}
                                onClick={() => {
                                  setFormData({ ...formData, department: dept });
                                  setShowDepartmentDropdown(false);
                                }}
                                className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-gray-900"
                              >
                                {dept}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Job Title</label>
                        <input
                          type="text"
                          value={formData.job_title}
                          onChange={(e) => handleJobTitleInput(e.target.value)}
                          onFocus={() => setShowJobTitleDropdown(true)}
                          onBlur={() => setTimeout(() => setShowJobTitleDropdown(false), 200)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                          placeholder="e.g., Senior Developer..."
                        />
                        {showJobTitleDropdown && filteredJobTitles.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {filteredJobTitles.map((job, idx) => (
                              <div
                                key={idx}
                                onClick={() => {
                                  setFormData({ ...formData, job_title: job });
                                  setShowJobTitleDropdown(false);
                                }}
                                className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-gray-900"
                              >
                                {job}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Features & Access Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Features & Access <span className="text-red-500">*</span>
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">Select the features this user can access</p>
                    
                    {safeModules.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {safeModules
                          .filter(module => module.is_active)
                          .map(module => (
                          <div
                            key={module.id}
                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                              formData.module_ids.includes(module.id)
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 bg-white hover:border-blue-300'
                            }`}
                          >
                            <div className="flex items-start">
                              <div className="flex items-center h-5">
                                <input
                                  type="checkbox"
                                  checked={formData.module_ids.includes(module.id)}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    toggleModule(module.id);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                />
                              </div>
                              <div className="ml-3 flex-1" onClick={() => toggleModule(module.id)}>
                                <label className="font-medium text-gray-900 cursor-pointer">
                                  {module.name}
                                </label>
                                {module.description && (
                                  <p className="text-sm text-gray-600 mt-1">{module.description}</p>
                                )}
                                {module.icon && (
                                  <div className="flex items-center mt-2 text-xs text-gray-500">
                                    <span className="px-2 py-1 bg-gray-100 rounded flex items-center">
                                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                                      </svg>
                                      {module.icon}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-yellow-800">No features available. Please ensure modules are configured properly.</p>
                      </div>
                    )}
                    
                    {formData.module_ids.length > 0 && (
                      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800">
                          <strong>Selected:</strong> {formData.module_ids.length} feature(s)
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg hover:shadow-xl flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Create User</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {showEditModal && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-gray-900">Edit User</h2>
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedUser(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <form onSubmit={handleUpdateUser} className="p-6">
                <div className="space-y-6">
                  {/* Basic Information Section */}
                  <div className="border-b border-gray-200 pb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                        <input
                          type="text"
                          value={editFormData.first_name}
                          onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                        <input
                          type="text"
                          value={editFormData.last_name}
                          onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                          required
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                      <input
                        type="email"
                        value={editFormData.email}
                        onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-100 text-gray-700"
                        required
                        disabled
                        title="Email cannot be changed"
                      />
                      <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                    </div>
                  </div>

                  {/* Organization Information */}
                  <div className="border-b border-gray-200 pb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Organization Details</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Organization</label>
                        <select
                          value={editFormData.organization_id}
                          onChange={(e) => setEditFormData({ ...editFormData, organization_id: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                        >
                          <option value="">Select Organization</option>
                          {organizations.map((org) => (
                            <option key={org.id} value={org.id}>
                              {org.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                        <input
                          type="text"
                          value={editFormData.department}
                          onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                          placeholder="e.g., Engineering..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Job Title</label>
                        <input
                          type="text"
                          value={editFormData.job_title}
                          onChange={(e) => setEditFormData({ ...editFormData, job_title: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                          placeholder="e.g., Senior Developer..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                        <input
                          type="tel"
                          value={editFormData.phone_number}
                          onChange={(e) => setEditFormData({ ...editFormData, phone_number: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                          placeholder="+971 XX XXX XXXX"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Module Assignment */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Access *</h3>
                    <p className="text-sm text-gray-600 mb-4">Select the features this user can access</p>
                    {modules && modules.length > 0 ? (
                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {modules.map((module) => (
                          <div
                            key={module.id}
                            className={`border rounded-lg p-4 cursor-pointer transition-all ${
                              editFormData.module_ids.includes(module.id)
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                            onClick={() => toggleEditModule(module.id)}
                          >
                            <div className="flex items-start">
                              <div className="flex items-center h-5">
                                <input
                                  type="checkbox"
                                  checked={editFormData.module_ids.includes(module.id)}
                                  onChange={() => toggleEditModule(module.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                />
                              </div>
                              <div className="ml-3 flex-1" onClick={() => toggleEditModule(module.id)}>
                                <label className="font-medium text-gray-900 cursor-pointer">
                                  {module.name}
                                </label>
                                {module.description && (
                                  <p className="text-sm text-gray-600 mt-1">{module.description}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-yellow-800">No features available.</p>
                      </div>
                    )}
                    
                    {editFormData.module_ids.length > 0 && (
                      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800">
                          <strong>Selected:</strong> {editFormData.module_ids.length} feature(s)
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedUser(null);
                    }}
                    disabled={actionLoading.updateUser}
                    className={`px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg transition-colors font-medium ${
                      actionLoading.updateUser ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
                    }`}
                  >
                    Cancel
                  </button>
                  {/* Soft-coded: Update button with loading state */}
                  <button
                    type="submit"
                    disabled={actionLoading.updateUser}
                    className={`px-6 py-2.5 bg-blue-600 text-white rounded-lg transition-colors font-medium shadow-lg flex items-center space-x-2 ${
                      actionLoading.updateUser 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:bg-blue-700 hover:shadow-xl'
                    }`}
                  >
                    {actionLoading.updateUser ? (
                      <>
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Updating...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Update User</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Bulk Upload Modal */}
        {showBulkUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-gray-900">Bulk Upload Users</h2>
                  <button
                    onClick={() => {
                      setShowBulkUploadModal(false);
                      setBulkUploadFile(null);
                      setBulkUploadResults(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <form onSubmit={handleBulkUpload} className="p-6">
                <div className="space-y-6">
                  {/* Instructions */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <svg className="w-6 h-6 text-blue-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <h3 className="text-sm font-semibold text-blue-900 mb-2">How to use Bulk Upload:</h3>
                        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                          <li>Download the CSV template using the button below</li>
                          <li>Fill in the user details following the format in the template</li>
                          <li>Select an organization for all users in the upload</li>
                          <li>Upload the completed CSV file</li>
                        </ol>
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={handleDownloadTemplate}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 text-sm transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>Download Template</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Organization Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Organization <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.organization_id}
                      onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">Select Organization</option>
                      {organizations.map(org => (
                        <option key={org.id} value={org.id}>{org.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">All users in the upload will be assigned to this organization</p>
                  </div>

                  {/* File Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      CSV File <span className="text-red-500">*</span>
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleBulkUploadFileChange}
                        className="hidden"
                        id="bulk-upload-file"
                      />
                      <label htmlFor="bulk-upload-file" className="cursor-pointer">
                        <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-sm text-gray-600 mb-1">
                          {bulkUploadFile ? bulkUploadFile.name : 'Click to upload or drag and drop'}
                        </p>
                        <p className="text-xs text-gray-500">CSV file only</p>
                      </label>
                    </div>
                  </div>

                  {/* Upload Results */}
                  {bulkUploadResults && (
                    <div className="space-y-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">Upload Summary</h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-green-100 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-green-700">{bulkUploadResults.summary?.successful || 0}</p>
                            <p className="text-xs text-green-600">Successful</p>
                          </div>
                          <div className="bg-red-100 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-red-700">{bulkUploadResults.summary?.failed || 0}</p>
                            <p className="text-xs text-red-600">Failed</p>
                          </div>
                          <div className="bg-yellow-100 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-yellow-700">{bulkUploadResults.summary?.skipped || 0}</p>
                            <p className="text-xs text-yellow-600">Skipped</p>
                          </div>
                        </div>
                      </div>

                      {/* Detailed Results */}
                      {bulkUploadResults.details && (
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                          {/* Success List */}
                          {bulkUploadResults.details.success?.length > 0 && (
                            <div>
                              <h4 className="font-medium text-green-700 mb-2">✓ Successfully Created</h4>
                              <div className="space-y-1">
                                {bulkUploadResults.details.success.map((item, idx) => (
                                  <div key={idx} className="text-sm bg-green-50 p-2 rounded">
                                    Row {item.row}: {item.name} ({item.email})
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Failed List */}
                          {bulkUploadResults.details.failed?.length > 0 && (
                            <div>
                              <h4 className="font-medium text-red-700 mb-2">✗ Failed</h4>
                              <div className="space-y-1">
                                {bulkUploadResults.details.failed.map((item, idx) => (
                                  <div key={idx} className="text-sm bg-red-50 p-2 rounded">
                                    Row {item.row}: {item.email} - {item.error}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Skipped List */}
                          {bulkUploadResults.details.skipped?.length > 0 && (
                            <div>
                              <h4 className="font-medium text-yellow-700 mb-2">⚠ Skipped</h4>
                              <div className="space-y-1">
                                {bulkUploadResults.details.skipped.map((item, idx) => (
                                  <div key={idx} className="text-sm bg-yellow-50 p-2 rounded">
                                    Row {item.row}: {item.email} - {item.reason}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBulkUploadModal(false);
                      setBulkUploadFile(null);
                      setBulkUploadResults(null);
                    }}
                    disabled={actionLoading.bulkUpload}
                    className={`px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg transition-colors font-medium ${
                      actionLoading.bulkUpload ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'
                    }`}
                  >
                    {bulkUploadResults ? 'Close' : 'Cancel'}
                  </button>
                  {!bulkUploadResults && (
                    <button
                      type="submit"
                      disabled={actionLoading.bulkUpload || !bulkUploadFile || !formData.organization_id}
                      className={`px-6 py-2.5 bg-green-600 text-white rounded-lg transition-colors font-medium shadow-lg flex items-center space-x-2 ${
                        actionLoading.bulkUpload || !bulkUploadFile || !formData.organization_id
                          ? 'opacity-50 cursor-not-allowed' 
                          : 'hover:bg-green-700 hover:shadow-xl'
                      }`}
                    >
                      {actionLoading.bulkUpload ? (
                        <>
                          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <span>Upload Users</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
