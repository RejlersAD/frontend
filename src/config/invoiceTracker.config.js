/**
 * Invoice Tracker — soft-coded configuration.
 *
 * Edit values here to retune the page without touching JSX or services.
 */

// API & polling
export const TRACKER_API_CONFIG = {
  baseUrl:    '/invoice-tracker',
  refreshMs:  60_000,
  pageSize:   100,
}

// External (customer) vs Internal (Rejlers group)
export const INVOICE_CATEGORIES = [
  { value: '',         label: 'All categories' },
  { value: 'external', label: 'External (Customer)' },
  { value: 'internal', label: 'Internal (Rejlers Group)' },
]

// Payment status — colour palette mirrors the Excel master file legend
export const PAYMENT_STATUSES = [
  { key: '',            label: 'All statuses',   tile: 'from-slate-500 to-slate-700',     badge: 'bg-slate-100 text-slate-700' },
  { key: 'pending',     label: 'Pending',        tile: 'from-amber-500 to-orange-600',    badge: 'bg-amber-100 text-amber-800' },
  { key: 'partial',     label: 'Partially Paid', tile: 'from-blue-500 to-indigo-600',     badge: 'bg-blue-100 text-blue-800' },
  { key: 'paid',        label: 'Paid',           tile: 'from-emerald-500 to-green-700',   badge: 'bg-emerald-100 text-emerald-800' },
  { key: 'overdue',     label: 'Overdue',        tile: 'from-rose-500 to-red-700',        badge: 'bg-rose-100 text-rose-800' },
  { key: 'cancelled',   label: 'Cancelled',      tile: 'from-gray-500 to-gray-700',       badge: 'bg-gray-100 text-gray-700' },
  { key: 'credit_note', label: 'Credit Note',    tile: 'from-purple-500 to-fuchsia-700',  badge: 'bg-purple-100 text-purple-800' },
]

export const CURRENCIES = [
  { value: '',    label: 'All currencies' },
  { value: 'AED', label: 'AED' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'SGD', label: 'SGD' },
]

// Currency formatter — per row uses the row's currency, falling back to AED
export const formatMoney = (value, currency = 'AED') => {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (Number.isNaN(n)) return '—'
  try {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: currency || 'AED',
      maximumFractionDigits: 2,
    }).format(n)
  } catch {
    return `${currency || 'AED'} ${n.toFixed(2)}`
  }
}

export const formatDate = (iso) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return '—'
  }
}

// Table columns — accessors return display strings, sortKeys map to API ordering field.
// Reorder / hide / add freely; the table reads this list.
export const TRACKER_COLUMNS = [
  { key: 'invoice_number',  label: 'Invoice #',     accessor: (r) => r.invoice_number || '—',                                            className: 'font-mono text-xs text-gray-700',                       sortKey: 'invoice_number' },
  { key: 'category',        label: 'Category',      accessor: (r) => (r.category_label || r.category || '—'),                            className: 'text-gray-600 text-xs whitespace-nowrap' },
  { key: 'account',         label: 'Account',       accessor: (r) => r.account || r.company || '—',                                      className: 'text-gray-800' },
  { key: 'project',         label: 'Project',       accessor: (r) => r.project_name || r.rad_project_no || '—',                          className: 'text-gray-700 text-xs max-w-[260px] truncate' },
  { key: 'invoice_date',    label: 'Inv. Date',     accessor: (r) => formatDate(r.invoice_date),                                          className: 'text-gray-500 text-xs whitespace-nowrap',               sortKey: 'invoice_date' },
  { key: 'due_date',        label: 'Due',           accessor: (r) => formatDate(r.due_date),                                              className: 'text-gray-500 text-xs whitespace-nowrap',               sortKey: 'due_date' },
  { key: 'amount',          label: 'Amount',        accessor: (r) => formatMoney(r.grand_total ?? r.invoice_amount, r.currency),         className: 'text-right font-semibold text-gray-800 tabular-nums whitespace-nowrap', sortKey: 'grand_total' },
  { key: 'balance',         label: 'Balance',       accessor: (r) => formatMoney(r.balance_to_be_received, r.currency),                  className: 'text-right text-gray-700 tabular-nums whitespace-nowrap' },
  { key: 'days_overdue',    label: 'Overdue',       accessor: (r) => (r.days_overdue != null ? `${r.days_overdue}d` : '—'),              className: 'text-right text-rose-700 text-xs font-semibold' },
]

// Per-row attachment count cap (displayed as e.g. "3 files")
export const ATTACHMENT_DISPLAY = {
  noneLabel: 'None',
}
