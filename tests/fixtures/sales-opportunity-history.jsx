import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import SalesLifecycleArea from '../../src/pages/Sales/SalesLifecycleArea'
import '../../src/index.css'

// The real Opportunity register and record drawer; API responses are intercepted.
const store = configureStore({ reducer: { auth: () => ({ isAuthenticated: true, user: { id: 77 } }) } })
createRoot(document.getElementById('sales-opportunity-history-test')).render(
  <Provider store={store}>
  <MemoryRouter initialEntries={['/sales/opportunities?record=opp-history-synthetic']}>
    <main>
      <Routes><Route path="/sales/:area" element={<SalesLifecycleArea />} /></Routes>
    </main>
  </MemoryRouter></Provider>,
)
