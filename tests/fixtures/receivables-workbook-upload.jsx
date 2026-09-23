import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import InvoiceTracker from '../../src/pages/Finance/InvoiceTracker'
import FinanceCommandCenter from '../../src/components/Finance/FinanceCommandCenter'
import '../../src/index.css'

createRoot(document.getElementById('receivables-upload-test')).render(<BrowserRouter>
  <Routes>
    <Route path="/finance" element={<FinanceCommandCenter />} />
    <Route path="*" element={<InvoiceTracker />} />
  </Routes>
</BrowserRouter>)
