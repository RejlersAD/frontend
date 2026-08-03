import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ExcelFileUpload from '../../../components/Electrical/ExcelQualityChecker/ExcelFileUpload';
import ExcelDocumentsDashboard from '../../../components/Electrical/ExcelQualityChecker/ExcelDocumentsDashboard';
import ExcelDocumentDetail from '../../../components/Electrical/ExcelQualityChecker/ExcelDocumentDetail';

/**
 * Main Quality Checker Page
 * Routes for Excel datasheet quality checking functionality
 */
const ExcelQualityCheckerPage = () => {
  return (
    <Routes>
      <Route index element={<ExcelDocumentsDashboard />} />
      <Route path="upload" element={<ExcelFileUpload />} />
      <Route path=":id" element={<ExcelDocumentDetail />} />
    </Routes>
  );
};

export default ExcelQualityCheckerPage;
