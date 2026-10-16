import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import AIAPIKeys from '../../src/pages/Admin/AIAPIKeys'
import '../../src/index.css'

const actor = new URLSearchParams(location.search).get('actor') === 'staff'
  ? { id: 92, user: { id: 92, is_active: true, is_staff: true }, roles: [] }
  : { id: 91, user: { id: 91, is_active: true, is_superuser: true }, roles: [] }
let state = { auth: { isAuthenticated: true, user: actor } }
const listeners = new Set()
const store = { getState: () => state, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) }, dispatch: () => {} }
window.setAIKeyActor = user => { state = { auth: { isAuthenticated: true, user } }; listeners.forEach(listener => listener()) }
createRoot(document.getElementById('root')).render(<Provider store={store}><MemoryRouter><main><AIAPIKeys /></main></MemoryRouter></Provider>)
