import React, { Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import ProcurementRegister from '../../src/pages/Procurement/ProcurementRegister'
import '../../src/index.css'

const parameters = new URLSearchParams(window.location.search)
const OrderManagement = React.lazy(() => import('../../src/pages/Procurement/OrderManagement'))
window.purchaseOrderActions = []
const action = name => value => window.purchaseOrderActions.push({ name, value: value?.nativeEvent ? undefined : value })

function Harness() {
  const [props, setProps] = useState(null)
  const location = useLocation()
  useEffect(() => { window.purchaseOrderRoute = location.pathname }, [location])
  useEffect(() => {
    window.setPurchaseOrderProps = update => setProps(previous => ({ ...previous, ...update }))
    fetch('/api/v1/__purchase-orders-fixture__/').then(response => response.json()).then(setProps)
  }, [])
  if (!props) return <main><p role="status">Loading isolated fixture</p></main>
  if (parameters.get('integration') === 'true') return <main><Suspense fallback={<p role="status">Loading order management</p>}><OrderManagement /></Suspense></main>
  return <main className={parameters.get('shell') === 'true' ? 'purchase-order-test-shell' : undefined}>
    <ProcurementRegister {...props} onRefresh={action('refresh')} onCreate={action('create')}
      onImportPdf={action('importPdf')} onImportExcel={action('importExcel')} onExport={action('export')}
      onOpen={action('open')} onEdit={action('edit')} onDelete={action('delete')} onIssue={action('issue')}
      onPdf={action('pdf')} onAcknowledge={action('acknowledge')} />
  </main>
}

createRoot(document.getElementById('purchase-orders-test')).render(<MemoryRouter initialEntries={['/procurement/orders']}>
  <style>{'@media (min-width:1101px){.purchase-order-test-shell{margin-left:198px;}}'}</style><Harness />
</MemoryRouter>)
