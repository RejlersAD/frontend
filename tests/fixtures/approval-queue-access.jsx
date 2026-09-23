import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import ApprovalsCommandCenter from '../../src/pages/ApprovalsCommandCenter'
import '../../src/index.css'

const actor = { id: 99, is_superuser: true, email: 'administrator@example.test' }
const state = { auth: { isAuthenticated: true, user: actor }, rbac: { currentUser: { ...actor, roles: [{ code: 'super_admin' }] } } }
const store = { getState: () => state, subscribe: () => () => {}, dispatch: () => {} }

createRoot(document.getElementById('queue-test')).render(
  <Provider store={store}><MemoryRouter><ApprovalsCommandCenter /></MemoryRouter></Provider>,
)
