import React, { lazy, Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import SalesEmailIntake from '../../src/pages/Sales/SalesEmailIntake'
import '../../src/index.css'

const Layout = lazy(() => import('../../src/components/Layout/Layout'))
const parameters = new URLSearchParams(window.location.search)
const useShell = parameters.get('shell') === 'true'
const actor = { id: 900, user: { id: 11 }, email: 'first-admin@example.test' }
let state = { auth: { isAuthenticated: true, user: actor }, rbac: { currentUser: actor }, theme: { mode: 'light' } }
const listeners = new Set()
const store = {
  getState: () => state,
  subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
  dispatch: () => {},
}

window.setSalesMailboxMessageActor = nextActor => {
  state = { ...state, auth: { isAuthenticated: Boolean(nextActor), user: nextActor }, rbac: { currentUser: nextActor } }
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
  const navigate = useNavigate()
  const [mounted, setMounted] = useState(true)
  window.setSalesMailboxMessagesMounted = setMounted
  useEffect(() => {
    window.setSalesMailboxMessageView = view => navigate(`/sales/email-intake${view === 'imported' ? '?view=imported' : ''}`)
    return () => { delete window.setSalesMailboxMessageView }
  }, [navigate])
  if (useShell) return mounted && <SalesEmailIntake />
  return <main className="sales-email-fixture-main">{mounted && <SalesEmailIntake />}</main>
}

createRoot(document.getElementById('sales-mailbox-messages-test')).render(
  <Provider store={store}>
    <MemoryRouter initialEntries={[`/sales/email-intake${parameters.get('view') === 'imported' ? '?view=imported' : ''}`]}>
      <style>{'.sales-email-fixture-main { height: 100dvh; min-height: 0; } @media (max-width: 1023px) { .sales-email-fixture-main { height: auto; min-height: 100dvh; } }'}</style>
      {useShell ? <Suspense fallback={<p role="status">Loading application shell</p>}>
        <Routes><Route element={<Layout />}><Route path="/sales/email-intake" element={<Fixture />} /></Route></Routes>
      </Suspense> : <Fixture />}
    </MemoryRouter>
  </Provider>,
)
