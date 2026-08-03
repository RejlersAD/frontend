/**
 * Motor Classification Constants
 * Centralized source of truth for motor electrical classifications
 * Must match backend ELECTRICAL_CLASS_CHOICES in models.py
 */

export const MOTOR_CLASSIFICATIONS = [
  'Class I, Division 1',
  'Class I, Division 2',
  'Class II, Division 1',
  'Class II, Division 2',
  'Non-Hazardous',
  'General Purpose',
];

/**
 * Default motor classification for new entries
 */
export const DEFAULT_MOTOR_CLASSIFICATION = 'General Purpose';

/**
 * Helper function to validate motor classification
 * @param {string} classification - The classification to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function isValidMotorClassification(classification) {
  return MOTOR_CLASSIFICATIONS.includes(classification);
}

/**
 * Helper function to get display label for motor classification
 * @param {string} classification - The classification value
 * @returns {string} Display label
 */
export function getMotorClassificationLabel(classification) {
  return classification || 'Not Specified';
}
