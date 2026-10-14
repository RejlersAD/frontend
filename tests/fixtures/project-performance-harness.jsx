import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { BrowserRouter } from 'react-router-dom'
import ProjectsPage from '../../src/pages/Projects/ProjectsPage'
import '../../src/index.css'

const params = new URLSearchParams(window.location.search)
const store = configureStore({ reducer: { auth: () => ({
  user: { id: 7, is_superuser: true, roles: [], modules: [{ code: 'project_control' }, { code: 'planning_package' }] },
  isAuthenticated: true,
}) } })

createRoot(document.getElementById('performance-test')).render(
  <Provider store={store}><BrowserRouter>
    {params.get('shell') === 'true' && <style>{'@media (min-width: 1101px) { .performance-test-shell { margin-left: 198px; } }'}</style>}
    <main className={params.get('shell') === 'true' ? 'performance-test-shell' : undefined}><ProjectsPage /></main>
  </BrowserRouter></Provider>,
)
