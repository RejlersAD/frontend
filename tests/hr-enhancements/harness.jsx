import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import CreateEmployeeWizard from '../../src/pages/HR/CreateEmployeeWizard'
import '../../src/index.css'
const store = configureStore({ reducer: () => ({ auth: { user: { id: 'hr-browser-test' } } }) })
createRoot(document.getElementById('root')).render(<Provider store={store}><CreateEmployeeWizard onCancel={() => {}} onCreated={() => {}} /></Provider>)
