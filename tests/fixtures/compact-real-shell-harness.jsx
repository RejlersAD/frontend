import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { BrowserRouter } from 'react-router-dom'
import ProjectsPage from '../../src/pages/Projects/ProjectsPage'
import Footer from '../../src/components/layout/Footer'
import '../../src/index.css'

const store = configureStore({ reducer: { auth: () => ({
  user: { id: 7, is_superuser: true, roles: [], modules: [{ code: 'project_control' }, { code: 'planning_package' }] },
  isAuthenticated: true,
}) } })

// Layout's real flex/scroll containers and Footer; a 60px header reservation
// avoids authentication/navigation side effects unrelated to schedule sizing.
createRoot(document.getElementById('performance-test')).render(
  <Provider store={store}><BrowserRouter>
    <style>{'@media (min-width: 1101px) { .compact-real-shell { margin-left: 198px; } }'}</style>
    <div className="compact-real-shell h-dvh overflow-hidden flex bg-gray-50">
      <div id="application-content" className="isolate flex min-h-0 min-w-0 flex-1 flex-col">
        <header aria-label="Application header reservation" style={{ height: 60, flexShrink: 0, borderBottom: '1px solid #d8e2f0', background: '#fff', padding: 16 }}>RADAI</header>
        <main className="main-content min-w-0 flex-1 overflow-x-hidden transition-all duration-300 min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pt-2 sm:pt-3"><ProjectsPage /></main>
        <Footer />
      </div>
    </div>
  </BrowserRouter></Provider>,
)
