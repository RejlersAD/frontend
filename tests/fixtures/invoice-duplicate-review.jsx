import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import InvoiceTracker from '../../src/pages/Finance/InvoiceTracker'
import InvoiceRegisterDetail from '../../src/pages/Finance/InvoiceRegisterDetail'
import '../../src/index.css'

const detail = new URLSearchParams(window.location.search).get('detail')
if (detail) window.history.replaceState(null, '', `/finance/outgoing-invoices/${encodeURIComponent(detail)}`)
createRoot(document.getElementById('duplicate-review-test')).render(<BrowserRouter><Routes>
  <Route path="/finance/outgoing-invoices/:id" element={<InvoiceRegisterDetail direction="outgoing" />} />
  <Route path="*" element={<InvoiceTracker />} />
</Routes></BrowserRouter>)
