/**
 * Change Password Page
 * Allows authenticated users to change their password
 * Includes password policy validation and expiry information
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Eye, EyeOff, Lock, CheckCircle, XCircle, Info } from 'lucide-react';
import apiClient from '../services/api.service';
import { PASSWORD_RESET_API } from '../config/passwordReset.config';
import passwordExpiryService from '../services/passwordExpiry.service';
import { logout } from '../store/slices/authSlice';

// Soft-coded constants for post-change behaviour
const POST_CHANGE_REDIRECT      = '/login';
const POST_CHANGE_REDIRECT_DELAY = 2000; // ms
const SUCCESS_REDIRECT_TEXT      = 'Redirecting to login page...';

const ChangePassword = () => {
  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [expiryStatus, setExpiryStatus] = useState(null);
  
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    // Get current expiry status
    const status = passwordExpiryService.getExpiryStatus();
    setExpiryStatus(status);

    // Subscribe to updates
    const unsubscribe = passwordExpiryService.subscribe(setExpiryStatus);
    
    return () => unsubscribe();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(''); // Clear error on input change
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const validatePassword = (password) => {
    const errors = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate inputs
    if (!formData.current_password || !formData.new_password || !formData.confirm_password) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    if (formData.new_password !== formData.confirm_password) {
      setError('New passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password strength
    const validationErrors = validatePassword(formData.new_password);
    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      setLoading(false);
      return;
    }

    try {
      const response = await apiClient.post(PASSWORD_RESET_API.changePassword, formData);
      
      setSuccess(true);
      setFormData({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });

      // Clear expiry cache and stop polling so the banner hides immediately
      passwordExpiryService.clearAndNotify();
      passwordExpiryService.stopPeriodicCheck();

      // Log out current session and redirect to login for a fresh start
      setTimeout(() => {
        dispatch(logout());
        navigate(POST_CHANGE_REDIRECT);
      }, POST_CHANGE_REDIRECT_DELAY);

    } catch (err) {
      console.error('Password change error:', err);
      setError(
        err.response?.data?.error || 
        'Failed to change password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = (password) => {
    if (!password) return { strength: 0, label: '', color: '' };
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) strength++;
    
    const levels = [
      { strength: 0, label: 'Very Weak', color: 'bg-red-500' },
      { strength: 1, label: 'Weak', color: 'bg-orange-500' },
      { strength: 2, label: 'Fair', color: 'bg-yellow-500' },
      { strength: 3, label: 'Good', color: 'bg-lime-500' },
      { strength: 4, label: 'Strong', color: 'bg-green-500' },
      { strength: 5, label: 'Very Strong', color: 'bg-emerald-600' },
    ];
    
    return levels[strength];
  };

  const passwordStrength = getPasswordStrength(formData.new_password);

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Changed!</h2>
          <p className="text-gray-600 mb-4">
            Your password has been successfully updated.
          </p>
          <p className="text-sm text-gray-500">
            {SUCCESS_REDIRECT_TEXT}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Lock className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Change Password</h2>
            <p className="text-sm text-gray-600">Update your account password</p>
          </div>
        </div>

        {/* Password Expiry Info */}
        {expiryStatus && !expiryStatus.exempt && (
          <div className={`mb-6 p-4 rounded-lg border ${
            expiryStatus.requires_change || expiryStatus.in_grace_period
              ? 'bg-red-50 border-red-200'
              : expiryStatus.in_warning_period
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-start gap-2">
              <Info className={`mt-0.5 flex-shrink-0 ${
                expiryStatus.requires_change || expiryStatus.in_grace_period
                  ? 'text-red-600'
                  : expiryStatus.in_warning_period
                  ? 'text-yellow-600'
                  : 'text-blue-600'
              }`} size={20} />
              <div className="flex-1">
                <p className={`font-semibold text-sm ${
                  expiryStatus.requires_change || expiryStatus.in_grace_period
                    ? 'text-red-800'
                    : expiryStatus.in_warning_period
                    ? 'text-yellow-800'
                    : 'text-blue-800'
                }`}>
                  {passwordExpiryService.getExpiryMessage()}
                </p>
                <p className={`text-xs mt-1 ${
                  expiryStatus.requires_change || expiryStatus.in_grace_period
                    ? 'text-red-700'
                    : expiryStatus.in_warning_period
                    ? 'text-yellow-700'
                    : 'text-blue-700'
                }`}>
                  Password policy: Change password every {expiryStatus.policy_days} days
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <XCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showPasswords.current ? 'text' : 'password'}
                name="current_password"
                value={formData.current_password}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                placeholder="Enter current password"
                required
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('current')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPasswords.current ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPasswords.new ? 'text' : 'password'}
                name="new_password"
                value={formData.new_password}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                placeholder="Enter new password"
                required
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('new')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPasswords.new ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            
            {/* Password Strength Indicator */}
            {formData.new_password && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600">Password Strength:</span>
                  <span className={`text-xs font-medium ${
                    passwordStrength.strength >= 4 ? 'text-green-600' :
                    passwordStrength.strength >= 3 ? 'text-lime-600' :
                    passwordStrength.strength >= 2 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {passwordStrength.label}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                    style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Password Requirements */}
            <div className="mt-3 space-y-1">
              <p className="text-xs font-medium text-gray-700">Password must contain:</p>
              {[
                { test: formData.new_password.length >= 8, label: 'At least 8 characters' },
                { test: /[A-Z]/.test(formData.new_password), label: 'One uppercase letter' },
                { test: /[a-z]/.test(formData.new_password), label: 'One lowercase letter' },
                { test: /[0-9]/.test(formData.new_password), label: 'One number' },
                { test: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(formData.new_password), label: 'One special character' },
              ].map((req, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {req.test ? (
                    <CheckCircle size={14} className="text-green-600" />
                  ) : (
                    <XCircle size={14} className="text-gray-400" />
                  )}
                  <span className={`text-xs ${req.test ? 'text-green-600' : 'text-gray-500'}`}>
                    {req.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showPasswords.confirm ? 'text' : 'password'}
                name="confirm_password"
                value={formData.confirm_password}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                placeholder="Confirm new password"
                required
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('confirm')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPasswords.confirm ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {formData.confirm_password && formData.new_password !== formData.confirm_password && (
              <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Changing Password...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
