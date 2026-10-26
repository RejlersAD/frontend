import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { HelpContextProvider } from '../../src/components/help/HelpContext';
import S3DDatabaseBuilder from '../../src/pages/Engineering/Digitization/components/S3DDatabaseBuilder';

createRoot(document.getElementById('root')).render(
  <MemoryRouter><HelpContextProvider>
    <S3DDatabaseBuilder onExtract={() => {}} onHistory={() => {}} onSelectionChange={() => {}} />
  </HelpContextProvider></MemoryRouter>,
);
