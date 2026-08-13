/**
 * Exit Initiation Form Component
 * Allows employees to submit exit/resignation requests
 * Features:
 * - Exit reason selection
 * - Notice period calculation
 * - Resignation letter upload
 * - Real-time validation
 */

import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import apiClient from '../../services/api.service';
import {
  EXIT_REQUEST_TYPES,
  EXIT_REASONS,
  EXIT_API_ENDPOINTS,
  NOTICE_PERIOD_CONFIG,
  validateExitRequest,
  EXIT_STATUS_CONFIG,
} from '../../config/exitWorkflow.config';

const ExitInitiationForm = ({ onSuccess, onCancel }) => {
  const { user } = useSelector((state) => state.auth);

  // Form State
  const [formData, setFormData] = useState({
    request_type: 'resignation',
    exit_reason: '',
    exit_reason_detail: '',
    proposed_last_working_day: '',
    resignation_letter_file: null,
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [noticeDays, setNoticeDays] = useState(null);
  const [warningMessage, setWarningMessage] = useState('');

  // Calculate notice period in real-time
  useEffect(() => {
    if (formData.proposed_last_working_day) {
      const lwd = new Date(formData.proposed_last_working_day);
      const today = new Date();
      const days = Math.ceil((lwd - today) / (1000 * 60 * 60 * 24));
      setNoticeDays(days);

      // Warning if below standard
      if (days >= 0 && days < NOTICE_PERIOD_CONFIG.standard_days) {
        setWarningMessage(
          `Notice period (${days} days) is less than standard ${NOTICE_PERIOD_CONFIG.standard_days} days. Your request may require special approval.`
        );
      } else {
        setWarningMessage('');
      }
    } else {
      setNoticeDays(null);
      setWarningMessage('');
    }
  }, [formData.proposed_last_working_day]);

  // Handle Input Change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  // Handle File Upload
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({
          ...prev,
          resignation_letter_file: 'File size must be less than 5MB',
        }));
        return;
      }
      
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword'];
      if (!allowedTypes.includes(file.type)) {
        setErrors((prev) => ({
          ...prev,
          resignation_letter_file: 'Only PDF, JPG, PNG, or DOC files allowed',
        }));
        return;
      }
      
      setFormData((prev) => ({ ...prev, resignation_letter_file: file }));
      setErrors((prev) => ({ ...prev, resignation_letter_file: null }));
    }
  };

  // Handle Form Submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate
    const validationErrors = validateExitRequest(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare FormData for file upload
      const payload = new FormData();
      payload.append('request_type', formData.request_type);
      payload.append('exit_reason', formData.exit_reason);
      payload.append('exit_reason_detail', formData.exit_reason_detail);
      payload.append('proposed_last_working_day', formData.proposed_last_working_day);
      
      if (formData.resignation_letter_file) {
        payload.append('resignation_letter_file', formData.resignation_letter_file);
      }

      const response = await apiClient.post(
        EXIT_API_ENDPOINTS.submit,
        payload,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      // Success
      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (error) {
      console.error('Exit request submission failed:', error);
      
      if (error.response?.data) {
        // Server validation errors
        setErrors(error.response.data);
      } else {
        setErrors({
          general: 'Failed to submit exit request. Please try again.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get minimum date (today)
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Get suggested date (today + 30 days)
  const getSuggestedDate = () => {
    const suggested = new Date();
    suggested.setDate(suggested.getDate() + NOTICE_PERIOD_CONFIG.standard_days);
    return suggested.toISOString().split('T')[0];
  };

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm border p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Initiate Exit Request</h2>
        <p className="text-sm text-gray-600">
          Please fill out the form below to submit your resignation or exit request. 
          Your request will be sent to your reporting manager for approval, followed by HR.
        </p>
      </div>

      {errors.general && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{errors.general}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Request Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Exit Request Type <span className="text-red-500">*</span>
          </label>
          <select
            name="request_type"
            value={formData.request_type}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {EXIT_REQUEST_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.icon} {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Exit Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason for Exit <span className="text-red-500">*</span>
          </label>
          <select
            name="exit_reason"
            value={formData.exit_reason}
            onChange={handleInputChange}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.exit_reason ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">-- Select a reason --</option>
            {EXIT_REASONS.map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </select>
          {errors.exit_reason && (
            <p className="mt-1 text-sm text-red-600">{errors.exit_reason}</p>
          )}
        </div>

        {/* Exit Reason Detail (conditional) */}
        {(formData.exit_reason === 'other' || formData.exit_reason === 'dissatisfaction') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Please Specify {formData.exit_reason === 'other' && <span className="text-red-500">*</span>}
            </label>
            <textarea
              name="exit_reason_detail"
              value={formData.exit_reason_detail}
              onChange={handleInputChange}
              rows={3}
              placeholder="Provide additional details about your reason for leaving..."
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.exit_reason_detail ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.exit_reason_detail && (
              <p className="mt-1 text-sm text-red-600">{errors.exit_reason_detail}</p>
            )}
          </div>
        )}

        {/* Proposed Last Working Day */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Proposed Last Working Day <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="proposed_last_working_day"
            value={formData.proposed_last_working_day}
            onChange={handleInputChange}
            min={getMinDate()}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.proposed_last_working_day ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.proposed_last_working_day && (
            <p className="mt-1 text-sm text-red-600">{errors.proposed_last_working_day}</p>
          )}
          
          {/* Notice Period Calculation */}
          {noticeDays !== null && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Notice Period:</span> {noticeDays} days
                {noticeDays >= NOTICE_PERIOD_CONFIG.standard_days && (
                  <span className="ml-2 text-green-600">✅ Meets standard notice period</span>
                )}
              </p>
            </div>
          )}

          {/* Warning Message */}
          {warningMessage && (
            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">⚠️ {warningMessage}</p>
            </div>
          )}

          {/* Suggested Date */}
          {!formData.proposed_last_working_day && (
            <p className="mt-2 text-xs text-gray-500">
              💡 Suggested date (standard {NOTICE_PERIOD_CONFIG.standard_days}-day notice): {' '}
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, proposed_last_working_day: getSuggestedDate() }))}
                className="text-blue-600 hover:underline"
              >
                {new Date(getSuggestedDate()).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </button>
            </p>
          )}
        </div>

        {/* Resignation Letter Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Resignation Letter (Optional)
          </label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleFileChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {formData.resignation_letter_file && (
            <p className="mt-2 text-sm text-green-600">
              ✅ {formData.resignation_letter_file.name} ({(formData.resignation_letter_file.size / 1024).toFixed(2)} KB)
            </p>
          )}
          {errors.resignation_letter_file && (
            <p className="mt-1 text-sm text-red-600">{errors.resignation_letter_file}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Accepted formats: PDF, JPG, PNG, DOC (Max 5MB)
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 pt-4 border-t">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Submitting...
              </span>
            ) : (
              'Submit Exit Request'
            )}
          </button>
          
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:opacity-50 transition-all"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Information Box */}
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">📋 What happens next?</h3>
        <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
          <li>Your exit request will be sent to your reporting manager</li>
          <li>Manager will review and approve/reject within 2-3 business days</li>
          <li>If approved by manager, HR will review for final approval</li>
          <li>Once approved by HR, the exit process will be initiated</li>
          <li>You'll be notified at each stage via email and system notifications</li>
        </ol>
      </div>
    </div>
  );
};

export default ExitInitiationForm;
