import base from './playwright.notification-preview.config.js'

export default {
  ...base,
  testMatch: ['purchase-order-approval-routing.spec.js', 'purchase-order-draft-recovery.spec.js', 'purchase-order-form.spec.js', 'purchase-order-crud.spec.js'],
  outputDir: './test-results-po-approval',
  webServer: {
    ...base.webServer,
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --config tests/vite.po-approval.config.js --host 127.0.0.1 --port 5197 --strictPort`,
    reuseExistingServer: process.env.PO_APPROVAL_REUSE_SERVER === '1',
  },
}
