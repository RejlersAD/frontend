import React from 'react'
import { createRoot } from 'react-dom/client'
import Review from '../../src/components/approvals/LeaveApprovalReview'
import '../../src/index.css'
function Harness() {
  const [open, setOpen] = React.useState(true)
  return <main><h1>Approval workspace</h1>{open && <Review requestId="leave-1" onClose={() => setOpen(false)} onUpdated={() => {}} />}</main>
}
createRoot(document.getElementById('root')).render(<Harness />)
