/**
 * Edit Salary Slip Modal - Individual Employee Payroll Editor
 * Smart auto-calculation with soft-coded component mappings
 * Updates database and recalculates payroll run totals
 */
import React, { useState, useEffect } from 'react';
import { XMarkIcon, CalculatorIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

// ═══════════════════════════════════════════════════════════════════════════
// SOFT-CODED SALARY COMPONENT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const ALLOWANCE_COMPONENTS = [
  { key: 'Housing Allowance', label: 'Housing Allowance', icon: '🏠' },
  { key: 'Transport Allowance', label: 'Transport Allowance', icon: '🚗' },
  { key: 'Home Leave Allowance', label: 'Home Leave Allowance', icon: '✈️' },
  { key: 'Other Allowance', label: 'Other Allowance', icon: '➕' },
  { key: 'Others', label: 'Others', icon: '📝' },
];

const DEDUCTION_COMPONENTS = [
  { key: 'Absent Deduction', label: 'Absent Deduction', icon: '❌' },
  { key: 'Housing Allowance Advance', label: 'Housing Advance', icon: '🏡' },
  { key: 'Salary Advance', label: 'Salary Advance', icon: '💰' },
  { key: 'Sick Leave Deduction', label: 'Sick Leave', icon: '🤒' },
  { key: 'Telephone', label: 'Telephone', icon: '📞' },
  { key: 'Other Deductions', label: 'Other Deductions', icon: '➖' },
];

const VALIDATION_RULES = {
  minBasicSalary: 0,
  maxBasicSalary: 999999.99,
  minWorkingDays: 1,
  maxWorkingDays: 31,
  minAmount: 0,
  maxAmount: 999999.99,
};

/**
 * EditSalarySlipModal Component
 * @param {Object} slip - Salary slip to edit
 * @param {Function} onClose - Close modal callback
 * @param {Function} onUpdate - Success callback (refreshes data)
 */
const EditSalarySlipModal = ({ slip, onClose, onUpdate }) => {
  // Form state
  const [formData, setFormData] = useState({
    basic_salary: 0,
    allowances_breakdown: {},
    deductions_breakdown: {},
    tax_deduction: 0,
    working_days: 30,
    present_days: 30,
    absent_days: 0,
    remarks: '',
  });

  // Calculated totals (auto-update)
  const [totals, setTotals] = useState({
    total_allowances: 0,
    gross_salary: 0,
    total_deductions: 0,
    net_salary: 0,
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  // Initialize form data from slip
  useEffect(() => {
    if (slip) {
      setFormData({
        basic_salary: parseFloat(slip.basic_salary) || 0,
        allowances_breakdown: slip.allowances_breakdown || {},
        deductions_breakdown: slip.deductions_breakdown || {},
        tax_deduction: parseFloat(slip.tax_deduction) || 0,
        working_days: slip.working_days || 30,
        present_days: slip.present_days || 30,
        absent_days: slip.absent_days || 0,
        remarks: slip.remarks || '',
      });
    }
  }, [slip]);

  // Auto-calculate totals whenever form data changes
  useEffect(() => {
    calculateTotals();
  }, [formData]);

  /**
   * Intelligent auto-calculation of all totals
   * SOFT-CODED: Uses breakdown objects for flexibility
   */
  const calculateTotals = () => {
    const basic = parseFloat(formData.basic_salary) || 0;

    // Sum all allowances
    const totalAllowances = Object.values(formData.allowances_breakdown).reduce(
      (sum, val) => sum + (parseFloat(val) || 0),
      0
    );

    // Calculate gross
    const gross = basic + totalAllowances;

    // Sum all deductions
    const totalDeductions =
      Object.values(formData.deductions_breakdown).reduce(
        (sum, val) => sum + (parseFloat(val) || 0),
        0
      ) + (parseFloat(formData.tax_deduction) || 0);

    // Calculate net
    const net = gross - totalDeductions;

    setTotals({
      total_allowances: totalAllowances.toFixed(2),
      gross_salary: gross.toFixed(2),
      total_deductions: totalDeductions.toFixed(2),
      net_salary: net.toFixed(2),
    });
  };

  /**
   * Update basic salary
   */
  const handleBasicSalaryChange = (value) => {
    const numValue = parseFloat(value) || 0;
    setFormData({ ...formData, basic_salary: numValue });
  };

  /**
   * Update allowance component
   */
  const handleAllowanceChange = (key, value) => {
    const numValue = parseFloat(value) || 0;
    setFormData({
      ...formData,
      allowances_breakdown: {
        ...formData.allowances_breakdown,
        [key]: numValue,
      },
    });
  };

  /**
   * Update deduction component
   */
  const handleDeductionChange = (key, value) => {
    const numValue = parseFloat(value) || 0;
    setFormData({
      ...formData,
      deductions_breakdown: {
        ...formData.deductions_breakdown,
        [key]: numValue,
      },
    });
  };

  /**
   * Update working/present days
   */
  const handleDaysChange = (field, value) => {
    const numValue = parseInt(value) || 0;
    const newFormData = { ...formData, [field]: numValue };

    // Auto-calculate absent days
    if (field === 'working_days' || field === 'present_days') {
      newFormData.absent_days = Math.max(0, newFormData.working_days - newFormData.present_days);
    }

    setFormData(newFormData);
  };

  /**
   * Validate form data
   */
  const validateForm = () => {
    const errors = {};

    // Basic salary validation
    if (formData.basic_salary < VALIDATION_RULES.minBasicSalary) {
      errors.basic_salary = `Basic salary must be at least ${VALIDATION_RULES.minBasicSalary}`;
    }
    if (formData.basic_salary > VALIDATION_RULES.maxBasicSalary) {
      errors.basic_salary = `Basic salary cannot exceed ${VALIDATION_RULES.maxBasicSalary}`;
    }

    // Working days validation
    if (formData.working_days < VALIDATION_RULES.minWorkingDays) {
      errors.working_days = `Working days must be at least ${VALIDATION_RULES.minWorkingDays}`;
    }
    if (formData.working_days > VALIDATION_RULES.maxWorkingDays) {
      errors.working_days = `Working days cannot exceed ${VALIDATION_RULES.maxWorkingDays}`;
    }

    // Present days validation
    if (formData.present_days > formData.working_days) {
      errors.present_days = 'Present days cannot exceed working days';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Submit updated salary slip
   */
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/finance/salary-slips/${slip.id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update salary slip');
      }

      const updatedSlip = await response.json();

      // Success! Call parent callback
      if (onUpdate) {
        onUpdate(updatedSlip);
      }

      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!slip) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
          <div>
            <h2 className="text-2xl font-bold">Edit Salary Slip</h2>
            <p className="text-blue-100 mt-1">
              {slip.employee?.full_name || slip.employee_name} ({slip.employee?.employee_id || slip.employee_id})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Error display */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border-l-4 border-red-500 p-4 rounded">
            <p className="text-red-700 font-semibold">Error:</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Form Content */}
        <div className="p-6 space-y-6">
          {/* Basic Salary Section */}
          <div className="bg-blue-50 rounded-lg p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              💵 Basic Salary (AED)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.basic_salary}
              onChange={(e) => handleBasicSalaryChange(e.target.value)}
              className={`w-full px-4 py-3 border-2 rounded-lg text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                validationErrors.basic_salary ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {validationErrors.basic_salary && (
              <p className="text-red-600 text-sm mt-1">{validationErrors.basic_salary}</p>
            )}
          </div>

          {/* Allowances Grid */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="text-2xl">➕</span> Allowances
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ALLOWANCE_COMPONENTS.map((component) => (
                <div key={component.key} className="bg-green-50 rounded-lg p-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {component.icon} {component.label}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.allowances_breakdown[component.key] || 0}
                    onChange={(e) => handleAllowanceChange(component.key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Deductions Grid */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="text-2xl">➖</span> Deductions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DEDUCTION_COMPONENTS.map((component) => (
                <div key={component.key} className="bg-red-50 rounded-lg p-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {component.icon} {component.label}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.deductions_breakdown[component.key] || 0}
                    onChange={(e) => handleDeductionChange(component.key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
              ))}
              <div className="bg-red-50 rounded-lg p-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  🏛️ Tax Deduction
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.tax_deduction}
                  onChange={(e) =>
                    setFormData({ ...formData, tax_deduction: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>
          </div>

          {/* Working Days Section */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">📅 Working Days</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Working Days
                </label>
                <input
                  type="number"
                  value={formData.working_days}
                  onChange={(e) => handleDaysChange('working_days', e.target.value)}
                  className={`w-full px-3 py-2 border-2 rounded-md focus:ring-2 focus:ring-blue-500 ${
                    validationErrors.working_days ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {validationErrors.working_days && (
                  <p className="text-red-600 text-xs mt-1">{validationErrors.working_days}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Present Days
                </label>
                <input
                  type="number"
                  value={formData.present_days}
                  onChange={(e) => handleDaysChange('present_days', e.target.value)}
                  className={`w-full px-3 py-2 border-2 rounded-md focus:ring-2 focus:ring-green-500 ${
                    validationErrors.present_days ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {validationErrors.present_days && (
                  <p className="text-red-600 text-xs mt-1">{validationErrors.present_days}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Absent Days
                </label>
                <input
                  type="number"
                  value={formData.absent_days}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
                />
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              📝 Remarks (Optional)
            </label>
            <textarea
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Add any notes or comments..."
            />
          </div>

          {/* Calculated Totals - Live Preview */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border-2 border-purple-200">
            <div className="flex items-center gap-2 mb-4">
              <CalculatorIcon className="w-6 h-6 text-purple-600" />
              <h3 className="text-lg font-bold text-gray-800">Calculated Totals</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-white rounded-lg">
                <p className="text-xs text-gray-600 uppercase tracking-wide">Total Allowances</p>
                <p className="text-xl font-bold text-green-600 mt-1">
                  AED {parseFloat(totals.total_allowances).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg">
                <p className="text-xs text-gray-600 uppercase tracking-wide">Gross Salary</p>
                <p className="text-xl font-bold text-blue-600 mt-1">
                  AED {parseFloat(totals.gross_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-center p-3 bg-white rounded-lg">
                <p className="text-xs text-gray-600 uppercase tracking-wide">Total Deductions</p>
                <p className="text-xl font-bold text-red-600 mt-1">
                  AED {parseFloat(totals.total_deductions).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-center p-3 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg">
                <p className="text-xs text-purple-100 uppercase tracking-wide">Net Salary</p>
                <p className="text-2xl font-bold text-white mt-1">
                  AED {parseFloat(totals.net_salary).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex items-center justify-between rounded-b-lg border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || Object.keys(validationErrors).length > 0}
            className="px-8 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <CheckCircleIcon className="w-5 h-5" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditSalarySlipModal;
