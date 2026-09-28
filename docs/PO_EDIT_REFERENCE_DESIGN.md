# Purchase order edit reference design

The 28 September 2026 request applies a supplied screenshot and typography table
to the PO editor. The sidebar, shared header, application layout and global styles
remain unchanged. The adopted scope is in the workspace
[feature brief](../../docs/features/purchase-order-edit-reference-design.md).

- `PurchaseOrderForm.jsx` and its stylesheet arrange the existing editable fields
  into Order & seller, Buyer & commercial, Scope & projects, Approval notes and
  Final signatory cards. Four numbered steps retain narrative, pricing, project,
  delivery, invoicing and attachment access.
- `PurchaseOrderReferenceEditor.jsx` and its stylesheet provide the same layout
  for saved, commercially locked orders. Commercial values remain read-only;
  the existing number-correction command owns persistence and freshness checks.
- `PurchaseOrderNumberEditor.jsx` supplies the existing number-save state to the
  reference layout and retains the inline pencil editor.
- `PurchaseOrderPreviewPane.jsx` and its stylesheet preserve the authenticated
  original PDF, current draft preview and saved-document export paths. Number
  corrections refresh saved exports after success; original source bytes stay
  separate.

The screen reuses the Segoe UI stack and exact requested typography. Its wrapper
uses the existing `data-table-typography="preserve"` escape hatch so the shared
table rules do not replace the requested input and badge sizes. No API or schema
change is needed.

Regression coverage lives in
`tests/accessibility/purchase-order-edit-reference-design.spec.js` alongside the
existing PO number, form, save, approval and preview suites. Final check results
and desktop/narrow screenshots are recorded in the workspace feature brief.
