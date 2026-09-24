import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import ReceiptManagement from '../../src/pages/Procurement/ReceiptManagement';
import ProcurementInvoiceTracker from '../../src/pages/Finance/ProcurementInvoiceTracker';
import AIReceiptCreator from '../../src/pages/Procurement/AIReceiptCreator';
import InvoicePurchaseOrderMatch from '../../src/components/Finance/InvoicePurchaseOrderMatch';
import '../../src/index.css';

function Fixture() {
  const [open, setOpen] = useState(true);
  const [result, setResult] = useState(null);
  const fixture = window.handoffFixture || {};
  const view = new URLSearchParams(window.location.search).get('view');
  return <BrowserRouter>{view === 'creator' ? <><button onClick={() => setOpen(true)}>Open receipt form</button><AIReceiptCreator isOpen={open} initialOrder={fixture.order} reconciliation={fixture.reconciliation} onClose={() => setOpen(false)} onReceiptCreated={setResult} />{result && <p>Saved receipt {result.id} ({result.status})</p>}</> : view === 'match' ? <InvoicePurchaseOrderMatch invoice={fixture.invoice} onSaved={setResult} /> : view === 'finance' ? <ProcurementInvoiceTracker /> : <ReceiptManagement />}{view === 'match' && result && <p>Saved invoice match</p>}</BrowserRouter>;
}
createRoot(document.getElementById('handoff-test')).render(<Fixture />);
