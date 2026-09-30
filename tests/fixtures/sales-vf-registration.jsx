import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import SalesLifecycleArea from '../../src/pages/Sales/SalesLifecycleArea'
import EnterpriseSalesWorkspace from '../../src/pages/Sales/EnterpriseSalesWorkspace'
import '../../src/index.css'
const store = configureStore({ reducer: { auth: () => ({ isAuthenticated: true, user: { id: 11, user: { id: 11 } } }) } })
const start = new URLSearchParams(window.location.search).get('overview') ? '/sales' : '/sales/opportunities'
createRoot(document.getElementById('root')).render(<Provider store={store}><MemoryRouter initialEntries={[start]}><Routes><Route path="/sales" element={<EnterpriseSalesWorkspace />} /><Route path="/sales/:area" element={<SalesLifecycleArea />} /></Routes></MemoryRouter></Provider>)
