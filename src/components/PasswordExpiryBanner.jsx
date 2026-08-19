/**
 * Password Expiry Banner Component
 * Shows warnings and alerts about password expiry
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, AlertCircle, AlertTriangle, Info, Clock } from 'lucide-react';
import passwordExpiryService from '../services/passwordExpiry.service';

const PasswordExpiryBanner = () => {
  const [expiryStatus, setExpiryStatus] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Subscribe to expiry status changes
    const unsubscribe = passwordExpiryService.subscribe((status) => {
      setExpiryStatus(status);
      setDismissed(false); // Reset dismissed state on status change
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  // Don't show if dismissed or no status
  if (dismissed || !expiryStatus) {
    return null;
  }

  // Don't show if exempt or no warning needed
  if (expiryStatus.exempt || (!expiryStatus.in_warning_period && !expiryStatus.in_grace_period && !expiryStatus.requires_change)) {
    return null;
  }

  const alertLevel = passwordExpiryService.getAlertLevel();
  const message = passwordExpiryService.getExpiryMessage();

  // Configure styles based on alert level
  const styles = {
    error: {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-800',
      icon: 'text-red-600',
      button: 'bg-red-600 hover:bg-red-700',
      IconComponent: AlertCircle,
    },
    warning: {
      bg: 'bg-yellow-50 border-yellow-200',
      text: 'text-yellow-800',
      icon: 'text-yellow-600',
      button: 'bg-yellow-600 hover:bg-yellow-700',
      IconComponent: AlertTriangle,
    },
    info: {
      bg: 'bg-blue-50 border-blue-200',
      text: 'text-blue-800',
      icon: 'text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700',
      IconComponent: Info,
    },
  };

  const style = styles[alertLevel] || styles.info;
  const Icon = style.IconComponent;

  const handleChangePassword = () => {
    navigate('/change-password');
  };

  const handleDismiss = () => {
    // Only allow dismissal for warnings, not errors
    if (alertLevel !== 'error') {
      setDismissed(true);
    }
  };

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 ${style.bg} border-b shadow-md`}>
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Icon className={`${style.icon} flex-shrink-0`} size={24} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className={`${style.text} font-semibold`}>
                  {expiryStatus.requires_change ? 'Password Expired' : 'Password Expiry Notice'}
                </p>
                <Clock className={style.icon} size={16} />
              </div>
              <p className={`${style.text} text-sm`}>{message}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleChangePassword}
              className={`${style.button} text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 whitespace-nowrap`}
            >
              Change Password
            </button>
            
            {alertLevel !== 'error' && (
              <button
                onClick={handleDismiss}
                className={`${style.text} hover:opacity-75 p-1 transition-opacity duration-200`}
                aria-label="Dismiss"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasswordExpiryBanner;
