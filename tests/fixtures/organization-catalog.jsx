import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { BrowserRouter } from 'react-router-dom'
import RoleManagement from '../../src/pages/Admin/RoleManagement'
import Profile from '../../src/pages/Profile'
import '../../src/index.css'

const user = { id: 7, first_name: 'Test', last_name: 'Employee', email: 'test@example.com', is_superuser: true }
const store = configureStore({ reducer: {
  auth: () => ({ user, isAuthenticated: true }),
  rbac: () => ({ currentUser: { user, roles: [{ code: 'super_admin' }] } }),
} })
const profile = new URLSearchParams(window.location.search).get('view') === 'profile'
createRoot(document.getElementById('organization-test')).render(<Provider store={store}><BrowserRouter><main>{profile ? <Profile embedded /> : <RoleManagement />}</main></BrowserRouter></Provider>)
