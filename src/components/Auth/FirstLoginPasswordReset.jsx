import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import axios from 'axios';
import { API_BASE_URL } from '../../config/api.config';
import { STORAGE_KEYS } from '../../config/app.config';
import { logout, updateUser } from '../../store/slices/authSlice';
import passwordExpiryService from '../../services/passwordExpiry.service';

// Soft-coded post-change behaviour constants
const POST_CHANGE_REDIRECT       = '/login';
const POST_CHANGE_REDIRECT_DELAY = 2000; // ms
const SUCCESS_HEADING            = 'Password Updated!';
const SUCCESS_BODY               = 'Your password has been changed. Redirecting to login page...';

/**
 * First Login Password Reset Component
 * Forces users to change their password on first login
 * Soft-coded with proper validation and error handling
 */
const FirstLoginPasswordReset = ({ user, onSuccess }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    label: '',
    color: ''
  });

  // Password strength calculator
  const calculatePasswordStrength = (password) => {
    if (!password) {
      return { score: 0, label: '', color: '' };
    }

    let score = 0;
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password)
    };

    score = Object.values(checks).filter(Boolean).length;

    const strengthMap = {
      0: { label: 'Very Weak', color: 'text-red-600' },
      1: { label: 'Very Weak', color: 'text-red-600' },
      2: { label: 'Weak', color: 'text-orange-600' },
      3: { label: 'Fair', color: 'text-yellow-600' },
      4: { label: 'Good', color: 'text-green-600' },
      5: { label: 'Strong', color: 'text-green-700' }
    };

    return { score, ...strengthMap[score] };
  };

  useEffect(() => {
    setPasswordStrength(calculatePasswordStrength(formData.new_password));
  }, [formData.new_password]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.current_password) {
      newErrors.current_password = 'Current password is required';
    }

    if (!formData.new_password) {
      newErrors.new_password = 'New password is required';
    } else if (formData.new_password.length < 8) {
      newErrors.new_password = 'Password must be at least 8 characters';
    } else if (formData.new_password === formData.current_password) {
      newErrors.new_password = 'New password must be different from current password';
    }

    if (!formData.confirm_password) {
      newErrors.confirm_password = 'Please confirm your new password';
    } else if (formData.new_password !== formData.confirm_password) {
      newErrors.confirm_password = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Get token using proper storage key
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || 
                    localStorage.getItem('access_token') || 
                    localStorage.getItem('access');
      
      console.log('[FirstLoginPasswordReset] Token found:', !!token);
      
      if (!token) {
        setErrors({ submit: 'Authentication token not found. Please login again.' });
        setLoading(false);
        return;
      }

      const response = await axios.post(
        `${API_BASE_URL}/users/reset-first-login-password/`,
        {
          current_password: formData.current_password,
          new_password: formData.new_password,
          confirm_password: formData.confirm_password
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        // Show inline success state — no browser alert()
        setSuccess(true);
        // Notify the parent so it can close any other password-required
        // popup (e.g. ChangePasswordModal) that may be showing underneath
        if (onSuccess) onSuccess();
        // Clear expiry banner immediately
        passwordExpiryService.clearAndNotify();
        passwordExpiryService.stopPeriodicCheck();

        // Re-fetch the fresh profile and sync Redux so must_change_password
        // reflects the change immediately instead of the stale login-time value
        try {
          const meResponse = await axios.get(`${API_BASE_URL}/rbac/users/me/`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          dispatch(updateUser(meResponse.data));
        } catch (refreshError) {
          console.error('Failed to refresh user data after password reset:', refreshError);
        }

        // Log out properly via Redux (clears localStorage + Redux state)
        // then redirect to login for a fresh session
        setTimeout(() => {
          dispatch(logout());
          navigate(POST_CHANGE_REDIRECT);
        }, POST_CHANGE_REDIRECT_DELAY);
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      let errorMessage = 'Failed to reset password';
      
      if (error.response) {
        if (error.response.status === 401) {
          errorMessage = 'Authentication failed. Your session may have expired. Please login again.';
        } else if (error.response.status === 400) {
          errorMessage = error.response.data?.error || error.response.data?.message || 'Invalid request. Please check your passwords.';
        } else if (error.response.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.response.data?.message) {
          errorMessage = error.response.data.message;
        }
      } else if (error.request) {
        errorMessage = 'Cannot connect to server. Please check your connection.';
      }
      
      setErrors({ submit: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  // Success screen — shown after password is changed, before redirect
  if (success) {
    return (
      <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-md w-full p-6 text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
            <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{SUCCESS_HEADING}</h2>
          <p className="text-gray-600">{SUCCESS_BODY}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Password Reset Required
          </h2>
          <p className="text-gray-600">
            Welcome, {(() => {
              // Extract nested user object (user.user.first_name)
              const userData = user?.user || user;
              return userData?.first_name || userData?.email?.split('@')[0] || 'User';
            })()}! For security reasons, please change your temporary password before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current (Temporary) Password *
            </label>
            <input
              type="password"
              name="current_password"
              value={formData.current_password}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                errors.current_password ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={loading}
            />
            {errors.current_password && (
              <p className="mt-1 text-sm text-red-600">{errors.current_password}</p>
            )}
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password *
            </label>
            <input
              type="password"
              name="new_password"
              value={formData.new_password}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                errors.new_password ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={loading}
            />
            {formData.new_password && (
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm">Strength:</span>
                <span className={`text-sm font-medium ${passwordStrength.color}`}>
                  {passwordStrength.label}
                </span>
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      passwordStrength.score <= 2 ? 'bg-red-500' :
                      passwordStrength.score === 3 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                  />
                </div>
              </div>
            )}
            {errors.new_password && (
              <p className="mt-1 text-sm text-red-600">{errors.new_password}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Must be at least 8 characters with uppercase, lowercase, numbers, and special characters
            </p>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New Password *
            </label>
            <input
              type="password"
              name="confirm_password"
              value={formData.confirm_password}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                errors.confirm_password ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={loading}
            />
            {errors.confirm_password && (
              <p className="mt-1 text-sm text-red-600">{errors.confirm_password}</p>
            )}
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> You will be logged out after updating your password and will need to login again with your new credentials.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FirstLoginPasswordReset;
