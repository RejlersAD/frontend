import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { MemoryRouter, useLocation } from 'react-router-dom'
import NotificationPanel from '../../src/pages/NotificationPanel'
import '../../src/index.css'

const actor = { id: 12, email: 'recipient@example.test', first_name: 'Inbox', last_name: 'Recipient' }
let state = { auth: { isAuthenticated: true, user: actor }, rbac: { currentUser: actor } }
const listeners = new Set()
const store = {
  getState: () => state,
  subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
  dispatch: () => {},
}
window.setNotificationFixtureActor = nextActor => {
  state = { auth: { isAuthenticated: Boolean(nextActor), user: nextActor }, rbac: { currentUser: nextActor } }
  if (nextActor) {
    localStorage.setItem('radai_user_data', JSON.stringify(nextActor))
    localStorage.setItem('radai_access_token', `notification-center-user-${nextActor.id}`)
  } else {
    localStorage.removeItem('radai_user_data')
    localStorage.removeItem('radai_access_token')
  }
  listeners.forEach(listener => listener())
}

function Fixture() {
  const location = useLocation()
  return <>
    <style>{`
      body { margin: 0; background: #f5f7fb; }
      .notification-center-fixture { padding: 20px; height: 100vh; box-sizing: border-box; }
      @media (max-width: 950px) { .notification-center-fixture { height: auto; min-height: 100vh; } }
      @media (max-width: 640px) { .notification-center-fixture { padding: 12px; } }
    `}</style>
    <main className="notification-center-fixture">
      <NotificationPanel />
      <output aria-label="Current route" className="sr-only">{location.pathname}{location.search}</output>
    </main>
  </>
}

createRoot(document.getElementById('notification-center-test')).render(
  <Provider store={store}><MemoryRouter initialEntries={['/notifications']}><Fixture /></MemoryRouter></Provider>,
)
