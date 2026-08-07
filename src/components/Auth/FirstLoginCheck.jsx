import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import FirstLoginPasswordReset from './FirstLoginPasswordReset';
import { API_BASE_URL } from '../../config/api.config';
import { STORAGE_KEYS } from '../../config/app.config';
import { isPublicPath } from '../../config/publicRoutes.config';

/**
 * First Login Check Component
 * Automatically checks if user needs to reset password after authentication
 * Soft-coded with proper error handling
 */
const FirstLoginCheck = ({ children, onPasswordChanged }) => {
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const location = useLocation();
  const isPublicRoute = isPublicPath(location.pathname);
  const [checking, setChecking] = useState(false);
  const [mustResetPassword, setMustResetPassword] = useState(false);
  const [checked, setChecked] = useState(false);

  // Reset state on logout so the check reruns on the next login
  useEffect(() => {
    if (!isAuthenticated) {
      setChecked(false);
      setMustResetPassword(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const checkFirstLogin = async () => {
      if (isPublicRoute || !isAuthenticated || checked) {
        return;
      }

      setChecking(true);

      try {
        const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
        
        if (!token) {
          setChecked(true);
          setChecking(false);
          return;
        }

        const response = await axios.get(
          `${API_BASE_URL}/users/check-first-login/`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            validateStatus: (status) => status < 500 // Don't throw on 404
          }
        );

        // Handle successful response
        if (response.status === 200) {
          console.log('[FirstLoginCheck] Response:', response.data);

          if (response.data.must_reset_password) {
            setMustResetPassword(true);
          }
        } else if (response.status === 404) {
          console.warn('[FirstLoginCheck] Endpoint not available (404) - skipping check');
        }
        
        setChecked(true);
      } catch (error) {
        console.warn('[FirstLoginCheck] Check failed - not blocking app:', error.message);
        
        // Don't block app if check fails
        setChecked(true);
      } finally {
        setChecking(false);
      }
    };

    checkFirstLogin();
  }, [isAuthenticated, checked, isPublicRoute]);

  // Public content never waits for authenticated password/account checks.
  if (isPublicRoute) {
    return children;
  }

  // Show loading while checking
  if (checking) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking account requirements...</p>
        </div>
      </div>
    );
  }

  // Show first login password reset modal if needed
  if (mustResetPassword && isAuthenticated) {
    return (
      <>
        {children}
        <FirstLoginPasswordReset
          user={user}
          onSuccess={() => {
            setMustResetPassword(false);
            setChecked(true);
            if (onPasswordChanged) onPasswordChanged();
          }}
        />
      </>
    );
  }

  return children;
};

export default FirstLoginCheck;
