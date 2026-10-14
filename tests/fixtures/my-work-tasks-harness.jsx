import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { BrowserRouter } from 'react-router-dom'
import MyWorkHub from '../../src/pages/MyWorkHub'
import '../../src/index.css'

const user = { id: 7, first_name: 'Maya', last_name: 'Hassan', roles: [], modules: [], is_superuser: false }
const store = configureStore({ reducer: {
  auth: () => ({ user, isAuthenticated: true }),
  rbac: () => ({ currentUser: { id: 7, roles: [], modules: [], module_actions: {} }, loading: false }),
} })
createRoot(document.getElementById('my-work-test')).render(
  <Provider store={store}><BrowserRouter><MyWorkHub /></BrowserRouter></Provider>,
)
