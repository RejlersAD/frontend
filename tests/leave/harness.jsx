import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { BrowserRouter } from 'react-router-dom'
import Reminder from '../../src/components/ProcurementApprovalReminder'
import '../../src/index.css'
const store = configureStore({ reducer: () => ({ auth: { user: { id: 'manager-1' } } }) })
createRoot(document.getElementById('root')).render(<Provider store={store}><BrowserRouter><main><h1>Approval workspace</h1><Reminder /></main></BrowserRouter></Provider>)
