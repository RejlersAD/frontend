/**
 * Field Suggestion Components
 * Reusable UI components for displaying field recommendations
 */

import React from 'react';
import './FieldSuggestions.css';

/**
 * Badge showing recommendation metadata
 */
export const RecommendationBadge = ({ type = 'common', count, onClick }) => {
  const badges = {
    common: { label: `Used ${count}x`, className: 'badge-common', emoji: '🔥' },
    recent: { label: 'Recent', className: 'badge-recent', emoji: '📅' },
    suggested: { label: 'Suggested', className: 'badge-suggested', emoji: '💡' },
    average: { label: 'Average', className: 'badge-average', emoji: '📊' }
  };

  const badge = badges[type] || badges.suggested;

  return (
    <span 
      className={`recommendation-badge ${badge.className}`}
      onClick={onClick}
      title={`${badge.emoji} ${badge.label}`}
    >
      {badge.emoji} {badge.label}
    </span>
  );
};

/**
 * Suggestion dropdown for text fields
 */
export const SuggestionDropdown = ({ 
  suggestions = [], 
  onSelect, 
  visible = true,
  fieldName 
}) => {
  if (!visible || suggestions.length === 0) return null;

  return (
    <div className="suggestion-dropdown">
      <div className="suggestion-header">
        💡 Suggestions for {fieldName}
      </div>
      <div className="suggestion-list">
        {suggestions.map((suggestion, index) => (
          <div
            key={index}
            className={`suggestion-item priority-${suggestion.priority || 'medium'}`}
            onClick={() => onSelect(suggestion.value)}
            title={suggestion.badge}
          >
            <span className="suggestion-value">{suggestion.label}</span>
            <RecommendationBadge 
              type={suggestion.badge === 'Recent' ? 'recent' : 'common'}
              count={suggestion.count}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Numeric field suggestion with statistics
 */
export const NumericSuggestion = ({ 
  suggestion, 
  onApply, 
  fieldName,
  currentValue 
}) => {
  if (!suggestion) return null;

  const hasSuggestion = suggestion.suggested !== null && suggestion.suggested !== undefined;
  const isDifferent = hasSuggestion && currentValue != suggestion.suggested;

  if (!hasSuggestion) return null;

  return (
    <div className="numeric-suggestion">
      <button
        type="button"
        className={`suggestion-apply-btn ${isDifferent ? 'highlight' : ''}`}
        onClick={() => onApply(suggestion.suggested)}
        title={suggestion.tooltip}
        disabled={!isDifferent}
      >
        💡 Suggested: {suggestion.suggested}
        {isDifferent && ' (Click to apply)'}
      </button>
      <div className="numeric-stats">
        <span className="stat-item">Avg: {suggestion.average?.toFixed(2)}</span>
        <span className="stat-item">Max: {suggestion.max?.toFixed(2)}</span>
      </div>
    </div>
  );
};

/**
 * Auto-fill button for quick form population
 */
export const AutoFillButton = ({ 
  onClick, 
  loading = false, 
  disabled = false,
  fieldsCount = 0 
}) => {
  return (
    <button
      type="button"
      className="auto-fill-button"
      onClick={onClick}
      disabled={disabled || loading}
      title={`Auto-fill ${fieldsCount} fields with intelligent suggestions`}
    >
      {loading ? (
        <>⏳ Loading suggestions...</>
      ) : (
        <>✨ Auto-Fill Suggestions ({fieldsCount} fields)</>
      )}
    </button>
  );
};

/**
 * Smart combination suggestion (e.g., motor type + efficiency)
 */
export const SmartCombinationHint = ({ 
  title, 
  suggestion, 
  onApply 
}) => {
  if (!suggestion) return null;

  return (
    <div className="smart-combination-hint">
      <span className="hint-icon">🧠</span>
      <span className="hint-text">{title}: {suggestion}</span>
      <button
        type="button"
        className="hint-apply-btn"
        onClick={onApply}
      >
        Apply
      </button>
    </div>
  );
};

/**
 * Context info showing what data recommendations are based on
 */
export const RecommendationContext = ({ context }) => {
  if (!context || context.total_records_analyzed === 0) return null;

  return (
    <div className="recommendation-context">
      <span className="context-icon">📊</span>
      <span className="context-text">
        Based on {context.total_records_analyzed} recent records
        {context.project_context !== 'all_projects' && ` from project ${context.project_context}`}
      </span>
    </div>
  );
};

/**
 * Inline suggestion for text inputs
 */
export const InlineSuggestion = ({ 
  value, 
  onApply, 
  badge = 'suggested',
  visible = true 
}) => {
  if (!visible || !value) return null;

  return (
    <div className="inline-suggestion">
      <span className="inline-suggestion-value">💡 {value}</span>
      <button
        type="button"
        className="inline-apply-btn"
        onClick={() => onApply(value)}
      >
        Apply
      </button>
      <RecommendationBadge type={badge} />
    </div>
  );
};

export default {
  RecommendationBadge,
  SuggestionDropdown,
  NumericSuggestion,
  AutoFillButton,
  SmartCombinationHint,
  RecommendationContext,
  InlineSuggestion
};
