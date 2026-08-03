/**
 * Percentage-Based Allowance Deduction Modal
 * AI-Driven Smart Deduction Calculator with Real-Time Preview
 * SOFT-CODED: Uses deductible allowance configuration from backend
 */
import React, { useState, useEffect } from 'react';
import {
  XMarkIcon,
  CalculatorIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

// ═══════════════════════════════════════════════════════════════════════════
// SOFT-CODED CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const DEDUCTION_PRESETS = [5, 10, 15, 20, 25, 30, 50, 75, 100];

const DEDUCTIBLE_COMPONENTS = [
  { key: 'housing_allowance', label: 'Housing Allowance', icon: '🏠' },
  { key: 'transportation_allowance', label: 'Transportation', icon: '🚗' },
  { key: 'home_leave_allowance', label: 'Home Leave', icon: '✈️' },
  { key: 'other_allowance', label: 'Other Allowance', icon: '💰' },
  { key: 'others_allowance', label: 'Other Pay', icon: '💵' },
];

const DeductionModal = ({ slip, onClose, onSuccess }) => {
  const [percentage, setPercentage] = useState(10);
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState(null);
  const [aiRecommendation, setAiRecommendation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);

  // ═══════════════════════════════════════════════════════════════════════
  // AUTO-LOAD AI RECOMMENDATION ON MOUNT
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    fetchPreview(percentage, true);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  // FETCH PREVIEW (DEBOUNCED)
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const timer = setTimeout(() => {
      if (percentage >= 0 && percentage <= 100) {
        fetchPreview(percentage);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [percentage]);

  const fetchPreview = async (pct, isInitial = false) => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `/api/v1/finance/salary-slips/${slip.id}/apply-deduction/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            percentage: pct,
            preview: true,
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Preview failed');
      }

      const data = await response.json();
      setPreview(data);

      if (data.ai_recommendation) {
        setAiRecommendation(data.ai_recommendation);
        
        // Auto-set AI recommendation on initial load
        if (isInitial) {
          setPercentage(data.ai_recommendation.percentage);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // APPLY DEDUCTION
  // ═══════════════════════════════════════════════════════════════════════
  const handleApply = async () => {
    if (!reason.trim()) {
      setError('Please provide a reason for the deduction');
      return;
    }

    setApplying(true);
    setError(null);

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `/api/v1/finance/salary-slips/${slip.id}/apply-deduction/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            percentage,
            preview: false,
            reason,
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to apply deduction');
      }

      const data = await response.json();
      onSuccess?.(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setApplying(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // SEVERITY BADGE COLORS
  // ═══════════════════════════════════════════════════════════════════════
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'info':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'warning':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'error':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'info':
        return <InformationCircleIcon className="h-5 w-5" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5" />;
      case 'error':
        return <ExclamationTriangleIcon className="h-5 w-5" />;
      default:
        return <InformationCircleIcon className="h-5 w-5" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-lg p-2">
              <CalculatorIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                Smart Deduction Calculator
              </h2>
              <p className="text-purple-100 text-sm">
                AI-powered percentage-based allowance deduction
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* AI RECOMMENDATION BANNER */}
          {aiRecommendation && (
            <div
              className={`border rounded-lg p-4 flex items-start gap-3 ${getSeverityColor(
                aiRecommendation.severity
              )}`}
            >
              <SparklesIcon className="h-6 w-6 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold">AI Recommendation</h3>
                  <span className="text-sm font-bold">
                    {aiRecommendation.percentage}%
                  </span>
                </div>
                <p className="text-sm">{aiRecommendation.reason}</p>
                {percentage !== aiRecommendation.percentage && (
                  <button
                    onClick={() => setPercentage(aiRecommendation.percentage)}
                    className="mt-2 text-sm font-medium underline hover:no-underline"
                  >
                    Apply AI Recommendation
                  </button>
                )}
              </div>
            </div>
          )}

          {/* EMPLOYEE INFO */}
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Employee:</span>
                <span className="ml-2 font-medium">{slip.employee_name}</span>
              </div>
              <div>
                <span className="text-slate-500">Department:</span>
                <span className="ml-2 font-medium">{slip.department || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500">Current Net Salary:</span>
                <span className="ml-2 font-bold text-green-600">
                  AED {parseFloat(slip.net_salary).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Slip Number:</span>
                <span className="ml-2 font-medium">{slip.slip_number}</span>
              </div>
            </div>
          </div>

          {/* PERCENTAGE SELECTOR */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Deduction Percentage
            </label>

            {/* PRESET BUTTONS */}
            <div className="flex flex-wrap gap-2 mb-4">
              {DEDUCTION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setPercentage(preset)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    percentage === preset
                      ? 'bg-indigo-600 text-white shadow-md scale-105'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {preset}%
                </button>
              ))}
            </div>

            {/* SLIDER */}
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max="100"
                step="0.5"
                value={percentage}
                onChange={(e) => setPercentage(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">0%</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={percentage}
                  onChange={(e) => setPercentage(parseFloat(e.target.value) || 0)}
                  className="w-20 px-3 py-1 text-center border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-semibold"
                />
                <span className="text-xs text-slate-500">100%</span>
              </div>
            </div>
          </div>

          {/* DEDUCTIBLE COMPONENTS BREAKDOWN */}
          {preview && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                Deduction Breakdown (by Component)
              </h3>
              <div className="bg-slate-50 rounded-lg border border-slate-200 divide-y divide-slate-200">
                {DEDUCTIBLE_COMPONENTS.map((comp) => {
                  const currentAmount = slip.allowances_breakdown?.[comp.key] || 0;
                  const deductionAmount =
                    preview.component_deductions?.[comp.key] || 0;

                  if (currentAmount <= 0) return null;

                  return (
                    <div key={comp.key} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{comp.icon}</span>
                        <span className="text-sm font-medium text-slate-700">
                          {comp.label}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-500">
                          AED {parseFloat(currentAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })} →{' '}
                          <span className="text-red-600 font-medium">
                            -{parseFloat(deductionAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* PREVIEW SUMMARY */}
          {preview && (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-5 border-2 border-indigo-200">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <CalculatorIcon className="h-5 w-5 text-indigo-600" />
                Deduction Summary
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Total Deduction Amount:</span>
                  <span className="text-xl font-bold text-red-600">
                    -AED {parseFloat(preview.total_deduction_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="h-px bg-slate-300"></div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">New Net Salary:</span>
                  <span className="text-2xl font-bold text-green-600">
                    AED {parseFloat(preview.new_net_salary).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">Reduction:</span>
                  <span className="font-medium text-slate-700">
                    AED {(parseFloat(preview.current_net_salary) - parseFloat(preview.new_net_salary)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({percentage}%)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* REASON INPUT */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Reason for Deduction <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Salary adjustment for Q2 2026, Housing allowance reduction, etc."
              rows={3}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-sm"
            />
          </div>

          {/* ERROR DISPLAY */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="bg-slate-50 px-6 py-4 flex items-center justify-between border-t border-slate-200">
          <button
            onClick={onClose}
            disabled={applying}
            className="px-5 py-2.5 text-slate-700 font-medium hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={loading || applying || !reason.trim() || !preview}
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {applying ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Applying...
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-5 w-5" />
                Apply Deduction
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeductionModal;
