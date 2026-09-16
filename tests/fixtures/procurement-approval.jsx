import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import PurchaseRequisitionApproval from '../../src/pages/Procurement/PurchaseRequisitionApproval'
import PurchaseRequisitionDocumentPreview from '../../src/pages/Procurement/PurchaseRequisitionDocumentPreview'
import PurchaseOrderLivePreview from '../../src/pages/Procurement/PurchaseOrderLivePreview'
import ProcurementApprovalPreviewModal from '../../src/components/approvals/ProcurementApprovalPreviewModal'
import '../../src/index.css'

const state = window.approvalFixture
const view = new URLSearchParams(location.search).get('view')
const noAction = () => {}
createRoot(document.getElementById('approval-test')).render(<MemoryRouter>
  {view === 'documents' ? <main className="mx-auto max-w-5xl space-y-8 p-6"><PurchaseRequisitionDocumentPreview requisition={state.pr} /><PurchaseOrderLivePreview formData={state.po} /></main>
    : view === 'queue' || view === 'queue-po' ? <ProcurementApprovalPreviewModal isOpen type={view === 'queue-po' ? 'po' : 'pr'} recordId={view === 'queue-po' ? state.po.id : state.pr.id} onClose={noAction} canDecide />
      : <PurchaseRequisitionApproval isOpen pageMode requisition={state.pr} currentUser={state.actor} onClose={noAction} onApprovalComplete={noAction} />}
</MemoryRouter>)
