import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { MemoryRouter, useLocation } from 'react-router-dom'
import NotificationBell from '../../src/components/notifications/NotificationBell'
import '../../src/index.css'

const actor = { id: 12, email: 'planner@example.test', first_name: 'Project', last_name: 'Planner' }
const state = { auth: { isAuthenticated: true, user: actor }, rbac: { currentUser: actor } }
const store = { getState: () => state, subscribe: () => () => {}, dispatch: () => {} }

function Fixture() {
  const location = useLocation()
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-8">
        <span className="font-semibold tracking-widest">REJLERS | RADAI</span>
        <NotificationBell />
      </header>
      <main className="p-4 sm:p-8">
        <h1 className="text-2xl font-semibold">Supplier Onboarding</h1>
        <p className="mt-2 text-slate-500">Manage supplier registration and approval progress.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {['Total suppliers', 'Pending approval', 'Active suppliers'].map(label => (
            <section key={label} className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-sm font-medium text-slate-600">{label}</h2>
              <p className="mt-3 text-3xl font-semibold">{label === 'Pending approval' ? '12' : '248'}</p>
            </section>
          ))}
        </div>
        <button type="button" className="mt-6 rounded border border-slate-300 bg-white px-4 py-2">Background action</button>
        <output aria-label="Current route" className="sr-only">{location.pathname}{location.search}</output>
      </main>
    </div>
  )
}

createRoot(document.getElementById('notification-test')).render(
  <Provider store={store}><MemoryRouter initialEntries={['/procurement/suppliers']}><Fixture /></MemoryRouter></Provider>,
)
