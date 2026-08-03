/**
 * Dynamic Field Renderer Component
 * Soft-coded field rendering based on field configuration
 * Supports all field types without hardcoding
 */

import React from 'react';
import { TextField, Select, MenuItem, FormControl, InputLabel, FormHelperText, Checkbox, FormControlLabel } from '@mui/material';

// Soft-coded field type configurations
const FIELD_TYPE_CONFIG = {
  text: {
    component: 'TextField',
    props: { type: 'text', fullWidth: true, variant: 'outlined' }
  },
  number: {
    component: 'TextField',
    props: { type: 'number', fullWidth: true, variant: 'outlined' }
  },
  decimal: {
    component: 'TextField',
    props: { type: 'number', inputProps: { step: 0.01 }, fullWidth: true, variant: 'outlined' }
  },
  select: {
    component: 'Select',
    props: { fullWidth: true, variant: 'outlined' }
  },
  multiselect: {
    component: 'Select',
    props: { fullWidth: true, variant: 'outlined', multiple: true }
  },
  checkbox: {
    component: 'Checkbox',
    props: {}
  },
  textarea: {
    component: 'TextField',
    props: { multiline: true, rows: 4, fullWidth: true, variant: 'outlined' }
  },
  date: {
    component: 'TextField',
    props: { type: 'date', fullWidth: true, variant: 'outlined', InputLabelProps: { shrink: true } }
  },
  email: {
    component: 'TextField',
    props: { type: 'email', fullWidth: true, variant: 'outlined' }
  },
  url: {
    component: 'TextField',
    props: { type: 'url', fullWidth: true, variant: 'outlined' }
  },
  password: {
    component: 'TextField',
    props: { type: 'password', fullWidth: true, variant: 'outlined' }
  }
};

// Validation state colors (soft-coded)
const VALIDATION_COLORS = {
  error: '#ef4444',
  warning: '#f59e0b',
  success: '#10b981',
  info: '#3b82f6'
};

/**
 * Dynamic Field Renderer
 * Renders any field type based on configuration
 */
const FieldRenderer = ({
  field,
  value,
  onChange,
  onBlur,
  error,
  helperText,
  disabled = false,
  validation = null,
  calculated = false,
  showUnit = true
}) => {
  // Get field configuration
  const fieldConfig = FIELD_TYPE_CONFIG[field.field_type] || FIELD_TYPE_CONFIG.text;
  
  // Build display label with unit
  const displayLabel = showUnit && field.unit 
    ? `${field.label} (${field.unit})`
    : field.label;

  // Add validation styling
  const validationStyle = validation?.status 
    ? { borderColor: VALIDATION_COLORS[validation.status] }
    : {};

  // Handle calculated field display
  if (calculated) {
    return (
      <TextField
        label={displayLabel}
        value={value || ''}
        fullWidth
        variant="outlined"
        disabled
        helperText={
          <span className="flex items-center gap-1">
            <span className="text-blue-600">🔢 Calculated</span>
            {helperText && <span> • {helperText}</span>}
          </span>
        }
        InputProps={{
          style: { backgroundColor: '#f0f9ff', ...validationStyle }
        }}
      />
    );
  }

  // Render based on field type
  switch (fieldConfig.component) {
    case 'TextField':
      return (
        <TextField
          {...fieldConfig.props}
          label={displayLabel}
          value={value || ''}
          onChange={(e) => onChange(field.field_name, e.target.value)}
          onBlur={onBlur}
          error={!!error}
          helperText={error || helperText || field.help_text}
          disabled={disabled || field.is_readonly}
          required={field.is_required}
          placeholder={field.placeholder}
          InputProps={{
            style: validationStyle
          }}
        />
      );

    case 'Select':
      return (
        <FormControl 
          fullWidth 
          error={!!error} 
          disabled={disabled || field.is_readonly}
          required={field.is_required}
        >
          <InputLabel>{displayLabel}</InputLabel>
          <Select
            {...fieldConfig.props}
            value={value || (fieldConfig.props.multiple ? [] : '')}
            onChange={(e) => onChange(field.field_name, e.target.value)}
            onBlur={onBlur}
            label={displayLabel}
            style={validationStyle}
          >
            {field.choices?.map((choice) => (
              <MenuItem key={choice.value} value={choice.value}>
                {choice.label}
              </MenuItem>
            ))}
          </Select>
          {(error || helperText || field.help_text) && (
            <FormHelperText>{error || helperText || field.help_text}</FormHelperText>
          )}
        </FormControl>
      );

    case 'Checkbox':
      return (
        <FormControlLabel
          control={
            <Checkbox
              checked={!!value}
              onChange={(e) => onChange(field.field_name, e.target.checked)}
              onBlur={onBlur}
              disabled={disabled || field.is_readonly}
              style={validationStyle}
            />
          }
          label={
            <span>
              {displayLabel}
              {field.is_required && <span className="text-red-500 ml-1">*</span>}
            </span>
          }
        />
      );

    default:
      return (
        <TextField
          label={displayLabel}
          value={value || ''}
          onChange={(e) => onChange(field.field_name, e.target.value)}
          onBlur={onBlur}
          error={!!error}
          helperText={error || helperText || field.help_text}
          disabled={disabled || field.is_readonly}
          required={field.is_required}
          fullWidth
          variant="outlined"
        />
      );
  }
};

/**
 * Field Group Renderer
 * Renders a section of related fields
 */
export const FieldGroupRenderer = ({
  section,
  fields,
  values,
  onChange,
  errors = {},
  validationResults = {},
  calculatedFields = [],
  disabled = false
}) => {
  // Filter fields for this section
  const sectionFields = fields.filter(f => f.section === section.name);

  // Get section validation summary
  const sectionErrors = sectionFields.filter(f => errors[f.field_name]).length;
  const sectionWarnings = sectionFields.filter(
    f => validationResults[f.field_name]?.status === 'warning'
  ).length;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">{section.label}</h3>
          {section.description && (
            <p className="text-sm text-gray-600 mt-1">{section.description}</p>
          )}
        </div>
        
        {/* Validation Summary */}
        {(sectionErrors > 0 || sectionWarnings > 0) && (
          <div className="flex gap-2">
            {sectionErrors > 0 && (
              <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-medium">
                {sectionErrors} error{sectionErrors !== 1 ? 's' : ''}
              </span>
            )}
            {sectionWarnings > 0 && (
              <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-medium">
                {sectionWarnings} warning{sectionWarnings !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Fields Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sectionFields.map((field) => {
          const isCalculated = calculatedFields.includes(field.field_name);
          
          return (
            <div 
              key={field.field_name} 
              className={`${field.width_class || 'col-span-1'}`}
            >
              <FieldRenderer
                field={field}
                value={values[field.field_name]}
                onChange={onChange}
                error={errors[field.field_name]}
                validation={validationResults[field.field_name]}
                calculated={isCalculated}
                disabled={disabled}
              />
              
              {/* Validation Feedback */}
              {validationResults[field.field_name]?.message && (
                <div 
                  className="mt-1 text-xs flex items-center gap-1"
                  style={{ color: VALIDATION_COLORS[validationResults[field.field_name].status] }}
                >
                  {validationResults[field.field_name].status === 'error' && '❌'}
                  {validationResults[field.field_name].status === 'warning' && '⚠️'}
                  {validationResults[field.field_name].status === 'success' && '✅'}
                  {validationResults[field.field_name].message}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FieldRenderer;
