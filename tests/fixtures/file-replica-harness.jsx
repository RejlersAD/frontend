import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { BrowserRouter } from 'react-router-dom'
import FileServerReplica from '../../src/pages/Admin/FileServerReplica'
import DocumentsTab from '../../src/pages/Projects/tabs/DocumentsTab'
import '../../src/index.css'

const params = new URLSearchParams(window.location.search)
const store = configureStore({ reducer: { auth: () => ({ user: { id: 1, is_superuser: params.get('admin') === 'true', roles: params.get('inactive_admin') === 'true' ? [{ code: 'admin', is_active: false }] : [] } }) } })
createRoot(document.getElementById('replica-test')).render(
  <Provider store={store}><BrowserRouter>
    {params.get('shell') === 'true' && <style>{'@media (min-width: 1101px) { .replica-test-shell { margin-left: 217px; } }'}</style>}
    <main className={params.get('shell') === 'true' ? 'replica-test-shell' : undefined}>{params.get('view') === 'admin' ? <FileServerReplica /> : <DocumentsTab project={{ id: 17 }} />}</main>
  </BrowserRouter></Provider>,
)
