import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { HelpContextProvider } from '../../src/components/help/HelpContext';
import S3DExtractionFlow from '../../src/pages/Engineering/Digitization/components/S3DExtractionFlow';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}
createRoot(document.getElementById('root')).render(
  <MemoryRouter initialEntries={['/engineering/digitization/smart-plant-3d']}><HelpContextProvider>
    <LocationProbe /><S3DExtractionFlow />
  </HelpContextProvider></MemoryRouter>,
);
