/**
 * Password Setup Page
 * Allows new users to set their password via email link
 * Includes token verification and secure password creation
 */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config/api.config';

const SetupPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [tokenValid, setTokenValid] = useState(false);
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    token: '',
    new_password: '',
    confirm_password: ''
  });
  
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    message: '',
    color: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Extract token and email from URL
  useEffect(() => {
    const token = searchParams.get('token');
    const email = searchParams.get('email');
    
    if (!token || !email) {
      setError('Invalid setup link. Please check your email and try again.');
      setLoading(false);
      setVerifying(false);
      return;
    }
    
    setFormData(prev => ({ ...prev, token, email }));
    verifyToken(email, token);
  }, [searchParams]);

  // Verify token with backend
  const verifyToken = async (email, token) => {
    try {
      setVerifying(true);
      const response = await axios.post(`${API_BASE_URL}/users/verify-reset-token/`, {
        email,
        token
      });
      
      if (response.data.valid) {
        setTokenValid(true);
        setUser(response.data.user);
      } else {
        setError(response.data.message || 'Invalid or expired setup link');
      }
    } catch (err) {
      console.error('Token verification error:', err);
      setError(
        err.response?.data?.message || 
        err.response?.data?.error ||
        'Failed to verify setup link. Please request a new one.'
      );
    } finally {
      setVerifying(false);
      setLoading(false);
    }
  };

  // Calculate password strength
  useEffect(() => {
    const password = formData.new_password;
    
    if (!password) {
      setPasswordStrength({ score: 0, message: '', color: '' });
      return;
    }
    
    let score = 0;
    let message = '';
    let color = '';
    
    // Length check
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    
    // Character variety checks
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    
    // Determine strength
    if (score <= 2) {
      message = 'Weak';
      color = 'bg-red-500';
    } else if (score <= 4) {
      message = 'Medium';
      color = 'bg-yellow-500';
    } else {
      message = 'Strong';
      color = 'bg-green-500';
    }
    
    setPasswordStrength({ score, message, color });
  }, [formData.new_password]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // Validation
    if (formData.new_password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    
    if (formData.new_password !== formData.confirm_password) {
      setError('Passwords do not match');
      return;
    }
    
    if (passwordStrength.score < 3) {
      setError('Please choose a stronger password');
      return;
    }
    
    try {
      setSubmitting(true);
      
      const response = await axios.post(`${API_BASE_URL}/users/reset-password/`, {
        email: formData.email,
        token: formData.token,
        new_password: formData.new_password,
        confirm_password: formData.confirm_password
      });
      
      if (response.data.success) {
        setSuccess('Password set successfully! Redirecting to login...');
        
        // Redirect to login after 2 seconds
        setTimeout(() => {
          navigate('/login', { 
            state: { 
              message: 'Password set successfully. Please login with your new password.',
              email: formData.email 
            } 
          });
        }, 2000);
      }
    } catch (err) {
      console.error('Password setup error:', err);
      setError(
        err.response?.data?.error || 
        err.response?.data?.message ||
        'Failed to set password. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading || verifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Verifying your setup link...</p>
        </div>
      </div>
    );
  }

  // Error state (invalid token)
  if (!tokenValid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Setup Link</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-blue-600 text-white rounded-lg px-6 py-3 font-semibold hover:bg-blue-700 transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Success!</h2>
            <p className="text-gray-600">{success}</p>
          </div>
        </div>
      </div>
    );
  }

  // Main form
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Set Up Your Password</h1>
          <p className="text-gray-600">
            Welcome, <span className="font-semibold">{user?.first_name} {user?.last_name}</span>
          </p>
          <p className="text-sm text-gray-500 mt-1">{user?.email}</p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="h-5 w-5 text-red-600 mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* New Password */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.new_password}
                onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                placeholder="Enter your password"
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            
            {/* Password strength indicator */}
            {formData.new_password && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600">Password Strength:</span>
                  <span className={`text-xs font-semibold ${
                    passwordStrength.score <= 2 ? 'text-red-600' :
                    passwordStrength.score <= 4 ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {passwordStrength.message}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${passwordStrength.color}`}
                    style={{ width: `${(passwordStrength.score / 6) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
            
            <p className="mt-2 text-xs text-gray-500">
              Use 8+ characters with a mix of letters, numbers & symbols
            </p>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={formData.confirm_password}
                onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                placeholder="Confirm your password"
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {formData.confirm_password && formData.new_password !== formData.confirm_password && (
              <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={submitting || formData.new_password !== formData.confirm_password}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
              submitting || formData.new_password !== formData.confirm_password
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {submitting ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Setting up password...
              </span>
            ) : (
              'Set Password & Continue'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Already have a password?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-blue-600 hover:text-blue-700 font-semibold"
            >
              Login here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SetupPassword;
