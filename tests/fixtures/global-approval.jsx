import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import InvoiceApproval from '../../src/pages/Finance/InvoiceApproval'
import RunDetail from '../../src/pages/HR/payroll/engine/RunDetail'
import ApprovalReviewDialog from '../../src/components/approvals/ApprovalReviewDialog'
import NotificationBell from '../../src/components/notifications/NotificationBell'
import TrustworthySchedulingPanel from '../../src/components/planning/TrustworthySchedulingPanel'
import GovernancePanel from '../../src/components/planning/GovernancePanel'
import '../../src/index.css'

const data = window.globalApprovalFixture
const state = { auth: { isAuthenticated: true, user: { id: 99, is_superuser: true, email: 'ceo@example.test' } }, rbac: { currentUser: { roles: [{ code: 'super_admin' }] } } }
const store = { getState: () => state, subscribe: () => () => {}, dispatch: () => {} }
const view = new URLSearchParams(location.search).get('view')
const noop = () => {}
createRoot(document.getElementById('approval-test')).render(<Provider store={store}><MemoryRouter initialEntries={['/finance/approve/fixture-token']}>
  {view === 'invoice' ? <Routes><Route path="/finance/approve/:token" element={<InvoiceApproval />} /></Routes>
    : view === 'assurance' ? <TrustworthySchedulingPanel assurance={data.assurance} versionStatus="calculated" canControl onRun={noop} onApprove={noop} />
      : view === 'governance' ? <GovernancePanel projectId="1" versionId="2" versionStatus="calculated" onWorkspaceRefresh={noop} onNotice={noop} />
    : view === 'payroll' ? <RunDetail runId="4" onBack={noop} />
      : view === 'document' ? <ApprovalReviewDialog item={{ id: 4, _approvalType: 'profile_document', _canDecide: true, verification_status: 'pending', ...data.document }} onClose={noop} onDecision={noop} />
        : <div className="flex justify-end p-8"><NotificationBell /></div>}
</MemoryRouter></Provider>)
