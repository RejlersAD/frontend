/**
 * Piping Datasheet Upload Page
 * Uses generic component with piping-specific configuration
 */

import React from 'react';
import GenericDatasheetUpload from '../../../components/Datasheet/GenericDatasheetUpload';
import { getDisciplineConfig } from '../../../config/datasheetDisciplines.config';

const PipingDatasheetUpload = () => {
  const pipingConfig = getDisciplineConfig('piping');

  if (!pipingConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Configuration Error</h2>
          <p className="text-gray-600">Piping datasheet configuration not found.</p>
        </div>
      </div>
    );
  }

  return <GenericDatasheetUpload disciplineConfig={pipingConfig} />;
};

export default PipingDatasheetUpload;
