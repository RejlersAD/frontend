import React from 'react';
import { createRoot } from 'react-dom/client';
import PaperSpecExtractor from '../../src/pages/Engineering/Digitization/components/PaperSpecExtractor';
import WorkbookCanvas from '../../src/pages/Engineering/Digitization/components/WorkbookCanvas';
import '../../src/index.css';
import '../../src/pages/Engineering/Digitization/spec-customization.css';

const root = createRoot(document.getElementById('specification-fixture'));
window.renderSpecificationFixture = state => root.render(
  state.view === 'workbook' ? <WorkbookCanvas job={state.job} /> : <PaperSpecExtractor jobId={state.job.id} />
);
window.renderSpecificationFixture(window.specificationFixture);
