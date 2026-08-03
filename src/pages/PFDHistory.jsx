/**
 * PFD to P&ID Conversion History Page
 * View and manage PFD conversion history
 */

import React from 'react';
import AnalysisHistory from '../components/AnalysisHistory';

const PFDHistory = () => {
  return (
    <AnalysisHistory
      type="pfd"
      title="PFD to P&ID Conversion History"
      uploadLabel="PFD Uploads"
      analysisLabel="Conversions"
    />
  );
};

export default PFDHistory;
