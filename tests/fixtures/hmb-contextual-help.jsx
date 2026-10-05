import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'

import ContextualHelpButton from '../../src/components/help/ContextualHelpButton'
import ContextualHelpDrawer from '../../src/components/help/ContextualHelpDrawer'
import { HelpContextProvider } from '../../src/components/help/HelpContext'
import '../../src/index.css'

createRoot(document.getElementById('root')).render(
  <MemoryRouter initialEntries={['/engineering/process/hmb-extractor']}>
    <HelpContextProvider>
      <main className="p-6">
        <h1>HMB Extractor fixture</h1>
        <ContextualHelpButton />
        <ContextualHelpDrawer />
      </main>
    </HelpContextProvider>
  </MemoryRouter>,
)
