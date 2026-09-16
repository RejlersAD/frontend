import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import pushService from '../../src/services/pushNotification.service'
import { authService } from '../../src/services/auth.service'
import { installPushSessionListeners } from '../../src/services/pushDeviceSession'
import NotificationPanel from '../../src/pages/NotificationPanel'
import '../../src/index.css'

function PushSession() {
  const [result, setResult] = useState('Ready')
  const run = action => async () => {
    try { setResult(JSON.stringify(await action()) || 'Done') }
    catch (error) { setResult(error.message) }
  }
  return <main><h1>Push session</h1><button onClick={run(pushService.enable)}>Enable push</button><button onClick={run(pushService.disable)}>Disable push</button><button onClick={run(pushService.getStatus)}>Check push</button><button onClick={run(() => authService.logout())}>Logout</button><p role="status">{result}</p></main>
}
const fixture = window.pushFixture
installPushSessionListeners()
const fixtureState = { auth: { isAuthenticated: true, user: fixture.actor }, rbac: { currentUser: fixture.actor } }
const store = { getState: () => fixtureState, subscribe: () => () => {}, dispatch: () => {} }
createRoot(document.getElementById('push-test')).render(new URLSearchParams(location.search).get('view') === 'notification'
  ? <Provider store={store}><MemoryRouter initialEntries={[`/notifications?preview=${fixture.type || 'pr'}&id=42`]}><NotificationPanel /></MemoryRouter></Provider>
  : <PushSession />)
