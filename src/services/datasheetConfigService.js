/**
 * Datasheet Configuration Service
 * Fetches and caches equipment type configurations
 * Soft-coded field definitions from backend
 */

import api from './api.service';

/**
 * Configuration Cache
 * Prevents repeated API calls
 */
class ConfigCache {
  constructor() {
    this.cache = new Map();
    this.ttl = 5 * 60 * 1000; // 5 minutes
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  clear() {
    this.cache.clear();
  }
}

const cache = new ConfigCache();

/**
 * Datasheet Configuration Service
 */
class DatasheetConfigService {
  
  /**
   * Get all equipment types
   */
  async getEquipmentTypes() {
    const cacheKey = 'equipment_types';
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await api.get('/process-datasheet/equipment-types/');
      cache.set(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching equipment types:', error);
      throw error;
    }
  }

  /**
   * Get equipment type by ID with full configuration
   */
  async getEquipmentType(equipmentTypeId) {
    const cacheKey = `equipment_type_${equipmentTypeId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await api.get(
        `/process-datasheet/equipment-types/${equipmentTypeId}/`
      );
      cache.set(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching equipment type:', error);
      throw error;
    }
  }

  /**
   * Get field definitions for equipment type
   */
  async getFieldDefinitions(equipmentTypeId) {
    const cacheKey = `fields_${equipmentTypeId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await api.get(
        `/process-datasheet/equipment-types/${equipmentTypeId}/fields/`
      );
      cache.set(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching field definitions:', error);
      throw error;
    }
  }

  /**
   * Get section definitions for equipment type
   */
  async getSectionDefinitions(equipmentTypeId) {
    const cacheKey = `sections_${equipmentTypeId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await api.get(
        `/process-datasheet/equipment-types/${equipmentTypeId}/sections/`
      );
      cache.set(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching section definitions:', error);
      throw error;
    }
  }

  /**
   * Get calculation rules for equipment type
   */
  async getCalculationRules(equipmentTypeId) {
    const cacheKey = `calculations_${equipmentTypeId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await api.get(
        `/process-datasheet/equipment-types/${equipmentTypeId}/calculations/`
      );
      cache.set(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching calculation rules:', error);
      throw error;
    }
  }

  /**
   * Get validation rules for equipment type
   */
  async getValidationRules(equipmentTypeId) {
    const cacheKey = `validations_${equipmentTypeId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await api.get(
        `/process-datasheet/equipment-types/${equipmentTypeId}/validations/`
      );
      cache.set(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching validation rules:', error);
      throw error;
    }
  }

  /**
   * Get complete configuration for equipment type
   * (All-in-one method)
   */
  async getCompleteConfig(equipmentTypeId) {
    const cacheKey = `complete_config_${equipmentTypeId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {
      const [equipmentType, fields, sections, calculations, validations] = await Promise.all([
        this.getEquipmentType(equipmentTypeId),
        this.getFieldDefinitions(equipmentTypeId),
        this.getSectionDefinitions(equipmentTypeId),
        this.getCalculationRules(equipmentTypeId),
        this.getValidationRules(equipmentTypeId)
      ]);

      const config = {
        equipmentType,
        fields,
        sections,
        calculations,
        validations
      };

      cache.set(cacheKey, config);
      return config;
    } catch (error) {
      console.error('Error fetching complete config:', error);
      throw error;
    }
  }

  /**
   * Group fields by section
   */
  groupFieldsBySection(fields, sections) {
    const grouped = {};
    
    // Initialize with sections
    sections.forEach(section => {
      grouped[section.name] = {
        ...section,
        fields: []
      };
    });

    // Add fields to sections
    fields.forEach(field => {
      if (grouped[field.section]) {
        grouped[field.section].fields.push(field);
      }
    });

    // Sort fields within sections
    Object.keys(grouped).forEach(sectionName => {
      grouped[sectionName].fields.sort((a, b) => a.display_order - b.display_order);
    });

    return grouped;
  }

  /**
   * Get calculated field names
   */
  getCalculatedFields(calculations) {
    return calculations
      .filter(calc => calc.is_active)
      .map(calc => calc.output_field);
  }

  /**
   * Get required field names
   */
  getRequiredFields(fields) {
    return fields
      .filter(field => field.is_required)
      .map(field => field.field_name);
  }

  /**
   * Build initial form values from fields
   */
  buildInitialValues(fields) {
    const values = {};
    
    fields.forEach(field => {
      // Set default value if specified
      if (field.default_value !== null && field.default_value !== undefined) {
        values[field.field_name] = field.default_value;
      } else {
        // Set appropriate empty value based on type
        switch (field.field_type) {
          case 'number':
          case 'decimal':
            values[field.field_name] = '';
            break;
          case 'checkbox':
            values[field.field_name] = false;
            break;
          case 'multiselect':
            values[field.field_name] = [];
            break;
          default:
            values[field.field_name] = '';
        }
      }
    });

    return values;
  }

  /**
   * Validate field value against configuration
   */
  validateField(field, value) {
    const errors = [];

    // Required validation
    if (field.is_required && !value) {
      errors.push(`${field.label} is required`);
    }

    // Min/Max validation for numbers
    if (field.field_type === 'number' || field.field_type === 'decimal') {
      const numValue = parseFloat(value);
      
      if (field.min_value !== null && numValue < field.min_value) {
        errors.push(`${field.label} must be at least ${field.min_value}`);
      }
      
      if (field.max_value !== null && numValue > field.max_value) {
        errors.push(`${field.label} must be at most ${field.max_value}`);
      }
    }

    // Pattern validation
    if (field.validation_regex && value) {
      const regex = new RegExp(field.validation_regex);
      if (!regex.test(value)) {
        errors.push(field.validation_message || `${field.label} format is invalid`);
      }
    }

    return errors;
  }

  /**
   * Clear cache
   */
  clearCache() {
    cache.clear();
  }
}

// Export singleton instance
export default new DatasheetConfigService();
