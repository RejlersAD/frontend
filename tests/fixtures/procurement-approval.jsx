import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import PurchaseRequisitionApproval from '../../src/pages/Procurement/PurchaseRequisitionApproval'
import PurchaseRequisitionDocumentPreview from '../../src/pages/Procurement/PurchaseRequisitionDocumentPreview'
import PurchaseOrderLivePreview from '../../src/pages/Procurement/PurchaseOrderLivePreview'
import PurchaseOrderNarrativeEditor from '../../src/pages/Procurement/PurchaseOrderNarrativeEditor'
import '../../src/pages/Procurement/PurchaseOrderForm.css'
import ProcurementApprovalPreviewModal from '../../src/components/approvals/ProcurementApprovalPreviewModal'
import '../../src/index.css'

const state = window.approvalFixture
const view = new URLSearchParams(location.search).get('view')
const noAction = () => {}
function NarrativeFixture() {
  const [value, setValue] = useState(state.po.description || '')
  return <main className="purchase-order-form-workspace" style={{ padding: 16 }}><section className="pof-section-panel"><PurchaseOrderNarrativeEditor value={value} disabled={state.po.commercial_edit_locked === true} onChange={next => { window.narrativeChanges = [...(window.narrativeChanges || []), next]; setValue(next) }} /></section></main>
}
createRoot(document.getElementById('approval-test')).render(<MemoryRouter>
  {view === 'narrative' ? <NarrativeFixture /> : view === 'documents' ? <main className="mx-auto max-w-5xl space-y-8 p-6"><PurchaseRequisitionDocumentPreview requisition={state.pr} /><PurchaseOrderLivePreview formData={state.po} /></main>
    : view === 'queue' || view === 'queue-po' ? <ProcurementApprovalPreviewModal isOpen type={view === 'queue-po' ? 'po' : 'pr'} recordId={view === 'queue-po' ? state.po.id : state.pr.id} onClose={noAction} canDecide />
      : <PurchaseRequisitionApproval isOpen pageMode requisition={state.pr} currentUser={state.actor} onClose={noAction} onApprovalComplete={noAction} />}
</MemoryRouter>)
