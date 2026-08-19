/**
 * Password Reset Request Page - UNIVERSAL ENQUIRY REDIRECT
 * 
 * SMART SOFT-CODED REDIRECT:
 * This page now redirects to the universal /enquiry page with password-reset pre-selected.
 * This allows /forgot-password to be part of the universal enquiry system while maintaining
 * backward compatibility with existing links.
 * 
 * WHY: User requested "make /forgot-password page universal for all types of query and enquiry"
 * SOLUTION: Redirect to /enquiry with service=password-reset parameter
 * 
 * @see ../pages/Enquiry.jsx - Universal enquiry form
 * @see ../config/enquiry.config.js - Enquiry types including password-reset
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Soft-coded redirect configuration
const PASSWORD_RESET_REDIRECT = {
  enabled: true,
  delay: 0, // milliseconds (0 = immediate)
  path: '/enquiry?service=password-reset&subject=Password Reset Request',
  showLoadingMessage: true,
};

const RequestPasswordReset = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!PASSWORD_RESET_REDIRECT.enabled) {
      return; // If redirect disabled, show original form
    }

    const timer = setTimeout(() => {
      navigate(PASSWORD_RESET_REDIRECT.path, { replace: true });
    }, PASSWORD_RESET_REDIRECT.delay);

    return () => clearTimeout(timer);
  }, [navigate]);

  // Show loading message during redirect
  if (!PASSWORD_RESET_REDIRECT.showLoadingMessage) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="text-center">
        <div className="inline-block mb-4">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="text-gray-600 font-medium text-lg">Redirecting to enquiry form...</p>
        <p className="text-gray-500 text-sm mt-2">You can submit any type of query or request</p>
      </div>
    </div>
  );
};

export default RequestPasswordReset;
