import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import NotificationPanel from '../../src/pages/NotificationPanel'
import '../../src/index.css'

const actor = { id: 12, email: 'approver@example.test', first_name: 'Procurement', last_name: 'Reviewer' }
const state = { auth: { isAuthenticated: true, user: actor }, rbac: { currentUser: actor } }
const store = { getState: () => state, subscribe: () => () => {}, dispatch: () => {} }

function Fixture() {
  const navigate = useNavigate()
  const location = useLocation()
  return <>
    <style>{`
      body { margin: 0; background: #e8eef5; }
      .fixture-sidebar { position: fixed; inset: 0 auto 0 0; width: 240px; padding: 28px 20px; background: #13294b; color: white; z-index: 9000; }
      .fixture-content { margin-left: 240px; padding: 24px; height: 720px; transform: translateZ(0); overflow: hidden; }
      @media (max-width: 640px) { .fixture-sidebar { width: 60px; padding: 16px 8px; } .fixture-content { margin-left: 60px; padding: 10px; } }
    `}</style>
    <aside className="fixture-sidebar" aria-label="Application navigation">RADAI</aside>
    <main className="fixture-content">
      <button type="button" onClick={() => navigate('/notifications?preview=po&id=po-1')} className="mr-3 rounded border bg-white p-2">Open purchase order preview</button>
      <button type="button" onClick={() => navigate('/notifications?preview=pr&id=pr-1')} className="rounded border bg-white p-2">Open purchase recommendation preview</button>
      <NotificationPanel />
      <output aria-label="Current route" className="sr-only">{location.pathname}{location.search}</output>
    </main>
  </>
}

createRoot(document.getElementById('notification-preview-test')).render(
  <Provider store={store}><MemoryRouter initialEntries={['/notifications']}><Fixture /></MemoryRouter></Provider>,
)
