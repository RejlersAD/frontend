/**
 * PID Analysis History Page
 * View and manage P&ID analysis history
 */

import React from 'react';
import AnalysisHistory from '../components/AnalysisHistory';

const PIDHistory = () => {
  return (
    <AnalysisHistory
      type="pid"
      title="P&ID Analysis History"
      uploadLabel="P&ID Drawings"
      analysisLabel="Analyses"
    />
  );
};

export default PIDHistory;
