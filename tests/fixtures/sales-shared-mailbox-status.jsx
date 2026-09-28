import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import EnterpriseSalesWorkspace from '../../src/pages/Sales/EnterpriseSalesWorkspace'
import SalesSharedMailboxStatus from '../../src/pages/Sales/SalesSharedMailboxStatus'
import '../../src/index.css'

const actor = { id: 900, user: { id: 11 }, email: 'first-admin@example.test' }
let state = { auth: { isAuthenticated: true, user: actor }, rbac: { currentUser: actor } }
const listeners = new Set()
const store = {
  getState: () => state,
  subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
  dispatch: () => {},
}

window.setSalesMailboxFixtureActor = nextActor => {
  state = { auth: { isAuthenticated: Boolean(nextActor), user: nextActor }, rbac: { currentUser: nextActor } }
  if (nextActor) {
    localStorage.setItem('radai_access_token', `mailbox-fixture-user-${nextActor.user?.id ?? nextActor.id}`)
    localStorage.setItem('radai_user_data', JSON.stringify(nextActor))
  } else {
    localStorage.removeItem('radai_access_token')
    localStorage.removeItem('radai_user_data')
  }
  listeners.forEach(listener => listener())
}

function Fixture() {
  const [mounted, setMounted] = useState(true)
  window.setSalesMailboxFixtureMounted = setMounted
  const pageMode = new URLSearchParams(window.location.search).get('mode') === 'page'
  return <main className="mx-auto max-w-5xl p-3 sm:p-6">
    {!pageMode && <h1 className="mb-4 text-xl font-semibold">Sales connection status</h1>}
    {mounted && (pageMode ? <EnterpriseSalesWorkspace /> : <SalesSharedMailboxStatus />)}
  </main>
}

createRoot(document.getElementById('sales-mailbox-test')).render(
  <Provider store={store}>
    <MemoryRouter initialEntries={['/sales']}><Fixture /></MemoryRouter>
  </Provider>,
)
