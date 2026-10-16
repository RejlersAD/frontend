import React from 'react'
import { createRoot } from 'react-dom/client'
import { ToastContainer, toast } from 'react-toastify'
import salesService from '../../src/services/sales.service'
import 'react-toastify/dist/ReactToastify.css'

// Synthetic failure probes exercise the real service and Axios interceptors.
// All API calls are intercepted by the paired browser test.
window.runSalesMailboxFailureProbe = async (mode, privateValues) => {
  const payload = {
    message_id: privateValues.messageId,
    source_token: privateValues.sourceToken,
    deal_name: privateValues.title,
    description: privateValues.description,
    client: 'synthetic-client',
  }
  const requests = mode === 'network'
    ? [salesService.convertMailboxMessage('privacy-connection', payload)]
    : [
      salesService.getMailboxConnections({ page: 1 }),
      salesService.getMailboxMessages('privacy-connection', { cursor: privateValues.cursor }),
      salesService.getMailboxMessage('privacy-connection', privateValues.messageId),
      salesService.convertMailboxMessage('privacy-connection', payload),
      salesService.convertEmailIntake('privacy-intake', payload),
    ]
  const results = await Promise.allSettled(requests)
  return results.map(result => ({
    status: result.status,
    httpStatus: result.reason?.response?.status ?? null,
    isNetworkError: result.reason?.isNetworkError === true,
  }))
}
window.showSalesMailboxPrivacyControlToast = () => toast.info('Public toast control')

createRoot(document.getElementById('sales-mailbox-privacy-test')).render(
  <main>
    <h1>Sales mailbox failure privacy fixture</h1>
    <ToastContainer autoClose={false} />
  </main>,
)
