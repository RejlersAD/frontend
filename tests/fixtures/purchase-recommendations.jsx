/* eslint-disable react/prop-types -- Harness props are mocked API state, not component parameters. */
import React, { Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import PurchaseRecommendations from '../../src/pages/Procurement/PurchaseRecommendations'
import '../../src/index.css'

const parameters = new URLSearchParams(window.location.search)
const OrderManagement = React.lazy(() => import('../../src/pages/Procurement/OrderManagement'))
window.recommendationActions = []
const action = name => value => window.recommendationActions.push({ name, value: value?.nativeEvent ? undefined : value })

function Harness() {
  const [props, setProps] = useState(null)
  const location = useLocation()
  useEffect(() => { window.recommendationRoute = location.pathname }, [location])
  useEffect(() => {
    window.setRecommendationProps = update => setProps(previous => ({ ...previous, ...update }))
    fetch('/api/v1/__purchase-recommendations-fixture__/').then(response => response.json()).then(setProps)
  }, [])
  if (!props) return <main><p role="status">Loading isolated fixture</p></main>
  if (parameters.get('integration') === 'true') return <main><Suspense fallback={<p role="status">Loading recommendation management</p>}><Routes>
    <Route path="/procurement/requisitions/new" element={<h1>New recommendation route</h1>} />
    <Route path="/procurement/requisitions/:id/edit" element={<h1>Edit recommendation route</h1>} />
    <Route path="/procurement/requisitions/:id" element={<OrderManagement />} />
    <Route path="*" element={<OrderManagement />} />
  </Routes></Suspense></main>
  const permitted = operation => record => !props.readOnly && Boolean(props.permissions?.[record.id]?.[operation])
  return <main className={parameters.get('shell') === 'true' ? 'recommendation-test-shell' : undefined}>
    <PurchaseRecommendations {...props} onRefresh={action('refresh')} onCreate={action('create')}
      onImportPdf={action('importPdf')} onImportExcel={action('importExcel')} onExport={action('export')}
      onOpen={action('open')} onEdit={action('edit')} onDelete={action('delete')} onConvert={action('convert')}
      onPdf={action('pdf')} onApproveSelected={rows => { action('approveSelected')(rows); return props.approvalResult ?? rows.map(row => row.id) }}
      canModify={permitted('modify')} canDelete={permitted('delete')} canConvert={permitted('convert')} canApprove={permitted('approve')} />
  </main>
}

createRoot(document.getElementById('purchase-recommendations-test')).render(<MemoryRouter initialEntries={['/procurement/requisitions']}>
  <style>{'@media (min-width:1101px){.recommendation-test-shell{margin-left:198px;}}'}</style><Harness />
</MemoryRouter>)
