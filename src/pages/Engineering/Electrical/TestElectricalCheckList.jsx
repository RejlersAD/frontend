/**
 * Test Component - Minimal import test
 */
import React from 'react';
import { 
  TEMPLATE_SECTIONS, 
  TEMPLATE_COLUMNS 
} from '../../../config/electricalChecklistTemplate.config';

const TestElectricalCheckList = () => {
  return (
    <div className="p-8">
      <h1>Test Component</h1>
      <p>Sections: {TEMPLATE_SECTIONS?.length || 0}</p>
      <p>Columns: {TEMPLATE_COLUMNS?.length || 0}</p>
    </div>
  );
};

export default TestElectricalCheckList;
