/**
 * Datasheet Form Builder Component
 * Configuration-driven dynamic form generation
 * No hardcoded fields - all from backend config
 */

import React, { useState, useEffect } from 'react';
import { Button, CircularProgress, Alert, Tabs, Tab, Box } from '@mui/material';
import { Save, Calculate, CheckCircle, Refresh } from '@mui/icons-material';
import { FieldGroupRenderer } from './FieldRenderer';
import datasheetConfigService from '../../services/datasheetConfigService';
import api from '../../services/api.service';

/**
 * Main Datasheet Form Builder
 */
const DatasheetFormBuilder = ({
  equipmentTypeId,
  datasheetId = null,
  onSave,
  onCalculate,
  onValidate,
  readonly = false
}) => {
  // State
  const [config, setConfig] = useState(null);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [validationResults, setValidationResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [validating, setValidating] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [calculatedFields, setCalculatedFields] = useState([]);

  // Load configuration and datasheet data
  useEffect(() => {
    loadConfiguration();
  }, [equipmentTypeId, datasheetId]);

  /**
   * Load equipment configuration and existing datasheet
   */
  const loadConfiguration = async () => {
    setLoading(true);
    try {
      // Load configuration
      const configData = await datasheetConfigService.getCompleteConfig(equipmentTypeId);
      setConfig(configData);

      // Get calculated fields
      const calcFields = datasheetConfigService.getCalculatedFields(configData.calculations);
      setCalculatedFields(calcFields);

      // Load existing datasheet or build initial values
      if (datasheetId) {
        const response = await api.get(
          `/process-datasheet/datasheets/${datasheetId}/`
        );
        setValues(response.data.field_values || {});
        setValidationResults(response.data.validation_results || {});
      } else {
        const initialValues = datasheetConfigService.buildInitialValues(configData.fields);
        setValues(initialValues);
      }
    } catch (error) {
      console.error('Error loading configuration:', error);
      setErrors({ _general: 'Failed to load form configuration' });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle field value change
   */
  const handleFieldChange = (fieldName, value) => {
    setValues(prev => ({
      ...prev,
      [fieldName]: value
    }));

    // Clear error for this field
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });

    // Clear validation result for this field
    setValidationResults(prev => {
      const newResults = { ...prev };
      delete newResults[fieldName];
      return newResults;
    });
  };

  /**
   * Validate form
   */
  const validateForm = () => {
    const newErrors = {};
    
    config.fields.forEach(field => {
      const fieldErrors = datasheetConfigService.validateField(field, values[field.field_name]);
      if (fieldErrors.length > 0) {
        newErrors[field.field_name] = fieldErrors[0];
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle save
   */
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      const payload = {
        equipment_type: equipmentTypeId,
        field_values: values,
        status: 'draft'
      };

      let response;
      if (datasheetId) {
        // Update existing
        response = await api.patch(
          `/process-datasheet/datasheets/${datasheetId}/`,
          payload
        );
      } else {
        // Create new
        response = await api.post(
          `/process-datasheet/datasheets/`,
          payload
        );
      }

      if (onSave) {
        onSave(response.data);
      }
    } catch (error) {
      console.error('Error saving datasheet:', error);
      setErrors({ _general: 'Failed to save datasheet' });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle calculate
   */
  const handleCalculate = async () => {
    if (!datasheetId) {
      setErrors({ _general: 'Please save the datasheet before calculating' });
      return;
    }

    setCalculating(true);
    try {
      const response = await api.post(
        `/process-datasheet/datasheets/${datasheetId}/calculate/`
      );

      // Update values with calculated results
      setValues(prev => ({
        ...prev,
        ...response.data.calculated_values
      }));

      if (onCalculate) {
        onCalculate(response.data);
      }
    } catch (error) {
      console.error('Error calculating values:', error);
      setErrors({ _general: 'Failed to calculate values' });
    } finally {
      setCalculating(false);
    }
  };

  /**
   * Handle validate
   */
  const handleValidate = async () => {
    if (!datasheetId) {
      setErrors({ _general: 'Please save the datasheet before validating' });
      return;
    }

    setValidating(true);
    try {
      const response = await api.post(
        `/process-datasheet/datasheets/${datasheetId}/validate/`
      );

      setValidationResults(response.data.validation_results || {});

      if (onValidate) {
        onValidate(response.data);
      }
    } catch (error) {
      console.error('Error validating datasheet:', error);
      setErrors({ _general: 'Failed to validate datasheet' });
    } finally {
      setValidating(false);
    }
  };

  /**
   * Handle refresh/reload
   */
  const handleRefresh = () => {
    loadConfiguration();
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <CircularProgress />
      </div>
    );
  }

  // Error state
  if (!config) {
    return (
      <Alert severity="error" className="m-4">
        Failed to load form configuration
      </Alert>
    );
  }

  // Group sections
  const sectionTabs = config.sections.sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {config.equipmentType.name} Datasheet
            </h1>
            <p className="text-gray-600 mt-1">
              {config.equipmentType.description}
            </p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={handleRefresh}
              disabled={saving || calculating || validating}
            >
              Refresh
            </Button>
            
            {!readonly && (
              <>
                <Button
                  variant="outlined"
                  startIcon={<Calculate />}
                  onClick={handleCalculate}
                  disabled={!datasheetId || calculating || saving}
                >
                  {calculating ? 'Calculating...' : 'Calculate'}
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<CheckCircle />}
                  onClick={handleValidate}
                  disabled={!datasheetId || validating || saving}
                >
                  {validating ? 'Validating...' : 'Validate'}
                </Button>

                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={handleSave}
                  disabled={saving || calculating}
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* General Error */}
        {errors._general && (
          <Alert severity="error" className="mt-4">
            {errors._general}
          </Alert>
        )}
      </div>

      {/* Tabs for Sections */}
      <Box className="bg-white rounded-lg shadow-sm mb-6">
        <Tabs 
          value={activeTab} 
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {sectionTabs.map((section, index) => (
            <Tab 
              key={section.name} 
              label={section.label}
              icon={
                // Show validation status on tab
                Object.keys(errors).some(key => 
                  config.fields.find(f => f.field_name === key && f.section === section.name)
                ) ? '❌' : 
                Object.keys(validationResults).some(key => 
                  config.fields.find(f => f.field_name === key && f.section === section.name) &&
                  validationResults[key].status === 'success'
                ) ? '✅' : null
              }
              iconPosition="end"
            />
          ))}
        </Tabs>
      </Box>

      {/* Section Content */}
      {sectionTabs.map((section, index) => (
        <div
          key={section.name}
          role="tabpanel"
          hidden={activeTab !== index}
        >
          {activeTab === index && (
            <FieldGroupRenderer
              section={section}
              fields={config.fields}
              values={values}
              onChange={handleFieldChange}
              errors={errors}
              validationResults={validationResults}
              calculatedFields={calculatedFields}
              disabled={readonly || saving || calculating}
            />
          )}
        </div>
      ))}

      {/* Form Summary */}
      <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">Form Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded">
            <div className="text-3xl font-bold text-blue-600">
              {config.fields.length}
            </div>
            <div className="text-sm text-gray-600">Total Fields</div>
          </div>
          
          <div className="text-center p-4 bg-green-50 rounded">
            <div className="text-3xl font-bold text-green-600">
              {Object.keys(values).filter(k => values[k]).length}
            </div>
            <div className="text-sm text-gray-600">Filled Fields</div>
          </div>
          
          <div className="text-center p-4 bg-purple-50 rounded">
            <div className="text-3xl font-bold text-purple-600">
              {calculatedFields.length}
            </div>
            <div className="text-sm text-gray-600">Calculated Fields</div>
          </div>
          
          <div className="text-center p-4 bg-yellow-50 rounded">
            <div className="text-3xl font-bold text-yellow-600">
              {Object.keys(errors).length}
            </div>
            <div className="text-sm text-gray-600">Errors</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatasheetFormBuilder;
