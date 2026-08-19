/**
 * Mechanical Datasheet Upload Page
 * Uses generic component with mechanical-specific configuration
 */

import React from 'react';
import GenericDatasheetUpload from '../../../components/Datasheet/GenericDatasheetUpload';
import { getDisciplineConfig } from '../../../config/datasheetDisciplines.config';

const MechanicalDatasheetUpload = () => {
  const mechanicalConfig = getDisciplineConfig('mechanical');

  if (!mechanicalConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Configuration Error</h2>
          <p className="text-gray-600">Mechanical datasheet configuration not found.</p>
        </div>
      </div>
    );
  }

  return <GenericDatasheetUpload disciplineConfig={mechanicalConfig} />;
};

export default MechanicalDatasheetUpload;
