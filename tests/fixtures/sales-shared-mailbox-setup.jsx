import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import SalesEmailIntake from '../../src/pages/Sales/SalesEmailIntake'
import '../../src/index.css'

const initial = window.salesMailboxSetupSession
let state = {
  auth: { isAuthenticated: initial.authenticated !== false, user: initial.authUser },
  rbac: { currentUser: initial.profile },
  theme: { mode: 'light' },
}
const listeners = new Set()
const store = {
  getState: () => state,
  subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
  dispatch: () => {},
}

window.setSalesMailboxSetupSession = ({ authUser, profile, authenticated = true }) => {
  state = {
    ...state,
    auth: { isAuthenticated: authenticated, user: authUser },
    rbac: { currentUser: profile },
  }
  if (authenticated && authUser) {
    localStorage.setItem('radai_access_token', `mailbox-setup-fixture-${authUser.user?.id ?? authUser.id}`)
    localStorage.setItem('radai_user_data', JSON.stringify(authUser))
  } else {
    localStorage.removeItem('radai_access_token')
    localStorage.removeItem('radai_user_data')
  }
  listeners.forEach(listener => listener())
}

createRoot(document.getElementById('sales-mailbox-setup-test')).render(
  <Provider store={store}>
    <MemoryRouter initialEntries={['/sales/email-intake']}>
      <style>{'.sales-email-fixture-main { min-height: 100dvh; }'}</style>
      <main className="sales-email-fixture-main"><SalesEmailIntake /></main>
    </MemoryRouter>
  </Provider>,
)
