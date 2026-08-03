/**
 * Payroll Engine — soft-coded frontend config.
 * Mirrors backend `apps.payroll_engine.catalog`. Some lists are
 * authoritative here for UI only; the rest are hydrated from
 * `/api/v1/payroll-engine/catalog/` at runtime.
 */

// Currency formatter (UAE Dirhams by default)
export const PAYROLL_ENGINE_CURRENCY = 'AED'
export const PAYROLL_ENGINE_LOCALE = 'en-AE'

export const formatCurrency = (value, { withSymbol = true } = {}) => {
  const n = Number(value || 0)
  if (Number.isNaN(n)) return withSymbol ? `${PAYROLL_ENGINE_CURRENCY} 0.00` : '0.00'
  const formatted = n.toLocaleString(PAYROLL_ENGINE_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return withSymbol ? `${PAYROLL_ENGINE_CURRENCY} ${formatted}` : formatted
}

// Generic number formatter (used for the `hours` column). Strips trailing
// zeros so 240.00 renders as "240" but 240.50 still renders as "240.5".
export const formatNumber = (value, { decimals = 2 } = {}) => {
  const n = Number(value)
  if (value === null || value === undefined || value === '' || Number.isNaN(n)) return '—'
  return n.toLocaleString(PAYROLL_ENGINE_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })
}

// Soft-coded: how many biometric hours equal one working day at this
// company. Rejlers Abu Dhabi runs a 9-hour day. Override via Vite env
// `VITE_PAYROLL_HOURS_PER_WORKDAY` without touching code.
export const HOURS_PER_WORKDAY = Number(
  import.meta?.env?.VITE_PAYROLL_HOURS_PER_WORKDAY || 9,
) || 9

/** Convert a live-hours number to working days (hours ÷ HOURS_PER_WORKDAY). */
export const hoursToDays = (hours) => {
  const h = Number(hours)
  if (!Number.isFinite(h) || HOURS_PER_WORKDAY <= 0) return 0
  return h / HOURS_PER_WORKDAY
}

// Workflow status meta (kept in sync with backend catalog.WORKFLOW_STATUSES)
export const WORKFLOW_STATUS = {
  DRAFT: 'draft',
  HR_APPROVED: 'hr_approved',
  FINANCE_APPROVED: 'finance_approved',
  RELEASED: 'released',
}

export const STATUS_META = {
  [WORKFLOW_STATUS.DRAFT]: {
    label: 'Draft',
    tone: 'gray',
    badge: 'bg-gray-100 text-gray-700 border-gray-300',
  },
  [WORKFLOW_STATUS.HR_APPROVED]: {
    label: 'HR Approved',
    tone: 'blue',
    badge: 'bg-blue-50 text-blue-700 border-blue-300',
  },
  [WORKFLOW_STATUS.FINANCE_APPROVED]: {
    label: 'Finance Approved',
    tone: 'amber',
    badge: 'bg-amber-50 text-amber-700 border-amber-300',
  },
  [WORKFLOW_STATUS.RELEASED]: {
    label: 'Released',
    tone: 'green',
    badge: 'bg-green-50 text-green-700 border-green-300',
  },
}

export const WORKFLOW_TRANSITIONS = {
  [WORKFLOW_STATUS.DRAFT]: [WORKFLOW_STATUS.HR_APPROVED],
  [WORKFLOW_STATUS.HR_APPROVED]: [WORKFLOW_STATUS.FINANCE_APPROVED, WORKFLOW_STATUS.DRAFT],
  [WORKFLOW_STATUS.FINANCE_APPROVED]: [WORKFLOW_STATUS.RELEASED, WORKFLOW_STATUS.HR_APPROVED],
  [WORKFLOW_STATUS.RELEASED]: [],
}

// Statuses whose runs can be deleted from the Monthly Runs list.
// Mirrors the backend guard in `PayrollRunViewSet.destroy()` — keep in sync.
// Used by RunsList to decide whether to render an enabled Delete action.
export const RUN_DELETABLE_STATUSES = [WORKFLOW_STATUS.DRAFT]

// ────────────────────────────────────────────────────────────────────────────
// FORCE-OVERRIDE (Super Admin only): allows Delete / Edit / Force-Revert on
// runs that are already HR-Approved, Finance-Approved or Released.
// Mirrors backend env `PAYROLL_RUN_FORCE_OVERRIDE_ROLES`. Every override is
// audited in `PayrollWorkflowLog`.
// ────────────────────────────────────────────────────────────────────────────
export const PAYROLL_RUN_FORCE_OVERRIDE_ROLE_CODES = [
  'superadmin', 'super_admin',
]

/** True when the user may force-edit / force-delete / force-revert any run. */
export function canForcePayrollRun(authUser, rbacUser) {
  const u = authUser?.user ?? authUser
  if (u?.is_superuser) return true
  const allow = new Set(PAYROLL_RUN_FORCE_OVERRIDE_ROLE_CODES.map((c) => c.toLowerCase()))
  const roles = [
    ...(Array.isArray(rbacUser?.roles) ? rbacUser.roles : []),
    ...(Array.isArray(authUser?.roles) ? authUser.roles : []),
  ]
  return roles.some((r) => allow.has((r?.code || '').toLowerCase()))
}

// Frontend sub-tabs inside the engine
export const ENGINE_TABS = [
  { key: 'runs',        label: 'Monthly Runs',  description: 'Generate, review and approve payroll runs' },
  { key: 'employees',   label: 'Employees',     description: 'Master roster of all payroll-eligible staff' },
  { key: 'adjustments', label: 'Adjustments',   description: 'Pending earnings & deductions for upcoming runs' },
  { key: 'comparison',  label: 'Comparison',    description: 'Reconcile a run against external HR files (ValueFrame, Sympa, etc.)' },
  { key: 'excel',       label: 'Excel Hub',     description: 'Upload / download payroll Excel files' },
]

export const DEFAULT_ENGINE_TAB = 'runs'

// Fixed earning fields living directly on the Payslip model. Listed here so
// the modal can render an inline editor for each without hard-coding labels.
// Add a new fixed earning here + on the serializer → it appears automatically.
export const FIXED_EARNING_FIELDS = [
  { key: 'basic',      label: 'Basic'      },
  { key: 'housing',    label: 'Housing'    },
  { key: 'transport',  label: 'Transport'  },
  { key: 'home_leave', label: 'Home Leave' },
]

// Attendance & Leave fields — editable per payslip, separate from salary.
// Mirrors catalog.LEAVE_CATEGORIES_FOR_PAYROLL + hours on the Payslip model.
// step controls the numeric input increment shown in the edit modal.
// Add a new field here + on the model/serializer/migration → appears automatically.
export const ATTENDANCE_LEAVE_FIELDS = [
  { key: 'hours',               label: 'Hours (Live)',      step: '0.1', helpText: 'Total biometric hours or ValueFrame hours' },
  { key: 'total_worked_days',   label: 'Total Worked Days', step: '0.01', helpText: 'Auto-calculated: (Hours ÷ Hours/Day) + Public Holidays + Annual Leave', readOnly: true },
  { key: 'public_holiday_days', label: 'Public Holidays',   step: '1', helpText: 'Official public holidays in this month'    },
  { key: 'annual_leave_days',   label: 'Annual Leave',      step: '0.5', helpText: 'Approved paid annual leave days'  },
  { key: 'unpaid_leave_days',   label: 'Unpaid Leave',      step: '0.5', helpText: 'Unpaid leave days (deducted from salary)'  },
]

// External file upload types — used by ExternalUploadPanel in RunDetail.
// file_type must match catalog.EXTERNAL_IMPORT_FIELD_MAP on the backend.
// fields_updated is informational (shown in the upload history UI).
// To add a new source file type: add an entry here + extend backend catalog.
export const EXTERNAL_UPLOAD_FILE_TYPES = [
  {
    key:            'valueframe',
    label:          'ValueFrame',
    description:    'Wage Type Report — updates Hours (Live), Annual Leave',
    accept:         '.xlsx,.xls',
    fields_updated: ['hours', 'annual_leave_days'],
    color:          'blue',
  },
  {
    key:            'sympa',
    label:          'Sympa',
    description:    'Salary Master — updates Basic, Housing, Transport, Home Leave',
    accept:         '.xlsx,.xls',
    fields_updated: ['basic', 'housing', 'transport', 'home_leave'],
    color:          'violet',
  },
]

// ────────────────────────────────────────────────────────────────────────────
// Bulk percentage deduction — mirrors backend catalog.BULK_DEDUCTION_*.
// Drives the "Apply Deduction" modal: HR picks a % and which fields it
// applies to. Basic is intentionally NOT listed (it's always protected).
// ────────────────────────────────────────────────────────────────────────────
export const BULK_DEDUCTION_FIELDS = [
  { key: 'housing',        label: 'Housing',        defaultChecked: true },
  { key: 'transport',      label: 'Transport',      defaultChecked: true },
  { key: 'home_leave',     label: 'Home Leave',     defaultChecked: true },
  { key: 'other_earnings', label: 'Other Earnings', defaultChecked: true },
]
export const BULK_DEDUCTION_PROTECTED_FIELDS = ['basic']
export const BULK_DEDUCTION_DEFAULT_PCT = 5
export const BULK_DEDUCTION_MIN_PCT     = 0.01
export const BULK_DEDUCTION_MAX_PCT     = 100
export const BULK_DEDUCTION_COMPONENT_CODE = 'bulk_pct_deduction'

// ────────────────────────────────────────────────────────────────────────────
// Canvas modes — soft-coded layout presets for the engine shell.
// Each preset controls (a) the outer container max-width class applied to the
// engine, (b) the horizontal padding, and (c) which payslip columns RunDetail
// surfaces. Add a new preset here and it automatically appears in the cycler.
// ────────────────────────────────────────────────────────────────────────────
export const PAYROLL_ENGINE_CANVAS_STORAGE_KEY = 'payrollEngine.canvasMode'

export const CANVAS_MODES = [
  {
    key: 'comfortable',
    label: 'Comfortable',
    description: 'Default centred layout (max 1536px).',
    icon: 'ArrowsPointingInIcon',
    containerClass: 'max-w-screen-2xl',
    paddingClass: 'px-4 sm:px-6',
    payslipColumnsKey: 'standard',
    tableSize: 'normal',
  },
  {
    key: 'wide',
    label: 'Wide',
    description: 'Stretched canvas with extra payslip columns.',
    icon: 'ArrowsRightLeftIcon',
    containerClass: 'max-w-[110rem]',
    paddingClass: 'px-4 sm:px-6',
    payslipColumnsKey: 'expanded',
    tableSize: 'normal',
  },
  {
    key: 'full',
    label: 'Full Screen',
    description: 'Edge-to-edge layout with compact spacing — best for many columns.',
    icon: 'ArrowsPointingOutIcon',
    containerClass: 'max-w-none',
    paddingClass: 'px-2',
    payslipColumnsKey: 'expanded',
    tableSize: 'compact',
  },
  {
    key: 'ultra',
    label: 'Ultra Wide',
    description: 'Maximum density — smallest text, minimal padding, all columns visible.',
    icon: 'TableCellsIcon',
    containerClass: 'max-w-none',
    paddingClass: 'px-1',
    payslipColumnsKey: 'expanded',
    tableSize: 'ultra-compact',
  },
]

export const DEFAULT_CANVAS_MODE = 'comfortable'

export const getCanvasMode = (key) =>
  CANVAS_MODES.find((m) => m.key === key) || CANVAS_MODES[0]

// Table size classes for different canvas modes
export const TABLE_SIZE_CLASSES = {
  normal: {
    text: 'text-xs',
    headerPadding: 'px-3 py-2',
    cellPadding: 'px-3 py-2',
    minWidth: 'min-w-full',
  },
  compact: {
    text: 'text-[11px]',
    headerPadding: 'px-2 py-1.5',
    cellPadding: 'px-2 py-1.5',
    minWidth: 'min-w-full',
  },
  'ultra-compact': {
    text: 'text-[10px]',
    headerPadding: 'px-1.5 py-1',
    cellPadding: 'px-1.5 py-1',
    minWidth: 'min-w-full',
  },
}

// Run table columns
export const RUN_COLUMNS = [
  { key: 'cycle_code',            label: 'Cycle',           width: 120 },
  { key: 'status_label',          label: 'Status',          width: 160 },
  { key: 'employee_count',        label: 'Employees',       width: 100, align: 'right' },
  { key: 'working_days_in_month', label: 'Working Days',    width: 110, align: 'right' },
  { key: 'public_holidays_in_month', label: 'Public Holidays', width: 110, align: 'right' },
  { key: 'total_hours',      label: 'Hours ⠂(Live)',  width: 110, align: 'right', format: 'number' },
  { key: 'total_days',       label: `Days (÷${HOURS_PER_WORKDAY}h)`, width: 110, align: 'right', format: 'number' },
  { key: 'total_gross',      label: 'Gross',           width: 140, align: 'right', format: 'currency' },
  { key: 'total_deductions', label: 'Deductions',      width: 140, align: 'right', format: 'currency' },
  { key: 'total_net',        label: 'Net Payable',     width: 160, align: 'right', format: 'currency' },
  { key: 'generated_at',     label: 'Generated',       width: 170, format: 'datetime' },
]

// Payslip table columns — compact view (default)
export const PAYSLIP_COLUMNS = [
  { key: 'snapshot_full_name', label: 'Employee',          width: 240 },
  { key: 'snapshot_department','label': 'Department',      width: 160 },
  { key: 'hours',              label: 'Hours ⠲(Live)',    width: 90,  align: 'right', format: 'number' },
  { key: 'days',               label: `Days (÷${HOURS_PER_WORKDAY}h)`, width: 90, align: 'right', format: 'number' },
  { key: 'total_worked_days',  label: 'Total Worked Days', width: 120, align: 'right', format: 'number', helpText: 'Auto: (Hours ÷ Hrs/Day) + PH + AL' },
  { key: 'public_holiday_days',  label: 'Public Holidays', width: 100, align: 'right', format: 'number' },
  { key: 'annual_leave_days',   label: 'Annual Leave',    width: 100, align: 'right', format: 'number' },
  { key: 'unpaid_leave_days',   label: 'Unpaid Leave',    width: 100, align: 'right', format: 'number' },
  { key: 'basic',              label: 'Basic',             width: 110, align: 'right', format: 'currency', editable: true },
  { key: 'housing',            label: 'Housing',           width: 110, align: 'right', format: 'currency', editable: true },
  { key: 'transport',          label: 'Transport',         width: 110, align: 'right', format: 'currency', editable: true },
  { key: 'home_leave',         label: 'Home Leave',        width: 110, align: 'right', format: 'currency', editable: true },
  { key: 'other_earnings',     label: 'Others',            width: 110, align: 'right', format: 'currency' },
  { key: 'gross_earnings',     label: 'Gross',             width: 130, align: 'right', format: 'currency' },
  { key: 'total_deductions',   label: 'Deductions',        width: 130, align: 'right', format: 'currency' },
  { key: 'net_payable',        label: 'Net Payable',       width: 140, align: 'right', format: 'currency' },
  { key: '__edit',             label: 'Edit',              width: 90,  align: 'center', action: 'edit' },
  { key: '__delete',           label: 'Delete',            width: 90,  align: 'center', action: 'delete' },
]

// Payslip table columns — extended view (wide / full canvas)
// Reveals the snapshot fields already on the serializer so HR/finance reviewers
// can audit designation and joining date without opening every payslip.
export const PAYSLIP_COLUMNS_EXPANDED = [
  { key: 'employee_no',         label: 'Emp #',         width: 90 },
  { key: 'snapshot_full_name',  label: 'Employee',      width: 240 },
  { key: 'snapshot_joining_date', label: 'Joined',      width: 110, format: 'date' },
  { key: 'snapshot_department', label: 'Department',    width: 160 },
  { key: 'snapshot_designation',label: 'Designation',   width: 180 },
  { key: 'hours',               label: 'Hours ⠲(Live)', width: 90,  align: 'right', format: 'number' },
  { key: 'days',                label: `Days (÷${HOURS_PER_WORKDAY}h)`, width: 90, align: 'right', format: 'number' },
  { key: 'total_worked_days',   label: 'Total Worked Days', width: 120, align: 'right', format: 'number', helpText: '(Hours ÷ 8h or 9h) + PH + AL' },
  { key: 'employee_category',   label: 'Category', width: 100, align: 'center', helpText: 'Emirates (8h) or Expatriate (9h)' },
  { key: 'public_holiday_days',  label: 'Public Holidays', width: 100, align: 'right', format: 'number' },
  { key: 'annual_leave_days',    label: 'Annual Leave',    width: 100, align: 'right', format: 'number' },
  { key: 'unpaid_leave_days',    label: 'Unpaid Leave',    width: 100, align: 'right', format: 'number' },
  { key: 'basic',               label: 'Basic',         width: 110, align: 'right', format: 'currency', editable: true },
  { key: 'housing',             label: 'Housing',       width: 110, align: 'right', format: 'currency', editable: true },
  { key: 'transport',           label: 'Transport',     width: 110, align: 'right', format: 'currency', editable: true },
  { key: 'home_leave',          label: 'Home Leave',    width: 110, align: 'right', format: 'currency', editable: true },
  { key: 'other_earnings',      label: 'Others',        width: 110, align: 'right', format: 'currency' },
  { key: 'gross_earnings',      label: 'Gross',         width: 130, align: 'right', format: 'currency' },
  { key: 'total_deductions',    label: 'Deductions',    width: 130, align: 'right', format: 'currency' },
  { key: 'net_payable',         label: 'Net Payable',   width: 140, align: 'right', format: 'currency' },
  { key: '__edit',              label: 'Edit',          width: 90,  align: 'center', action: 'edit' },
  { key: '__delete',            label: 'Delete',        width: 90,  align: 'center', action: 'delete' },
]

// Employee table columns
export const EMPLOYEE_COLUMNS = [
  { key: 'employee_no',  label: 'Emp #',         width: 100 },
  { key: 'full_name',    label: 'Name',          width: 240 },
  { key: 'department',   label: 'Department',    width: 160 },
  { key: 'designation',  label: 'Designation',   width: 180 },
  { key: 'grade',        label: 'Grade',         width: 120 },
  { key: 'hours',        label: 'Hours',         width: 80,  align: 'right', format: 'number' },
  { key: 'basic',        label: 'Basic',         width: 110, align: 'right', format: 'currency' },
  { key: 'housing',      label: 'Housing',       width: 110, align: 'right', format: 'currency' },
  { key: 'transport',    label: 'Transport',     width: 110, align: 'right', format: 'currency' },
  { key: 'home_leave',   label: 'Home Leave',    width: 110, align: 'right', format: 'currency' },
  { key: 'default_gross','label': 'Default Gross', width: 130, align: 'right', format: 'currency' },
  { key: 'is_active',    label: 'Active',        width: 80 },
]

// ────────────────────────────────────────────────────────────────────────────
// Employee editor — soft-coded role gate + field schema for the Edit modal.
// Mirrors the backend permission in `PayrollEmployeeWritePermission` and the
// env var `PAYROLL_EMPLOYEE_WRITE_ROLES`. Keep the two lists in sync.
// Add a new field below + on the serializer and it appears in the modal
// automatically — no other UI changes required.
// ────────────────────────────────────────────────────────────────────────────
export const PAYROLL_EMPLOYEE_EDIT_ROLE_CODES = [
  'superadmin', 'super_admin', 'admin',
]

/**
 * Returns true if the user may edit / delete payroll employee records.
 * Mirrors backend `_user_has_payroll_admin_role()`.
 */
export function canEditPayrollEmployee(authUser, rbacUser) {
  const u = authUser?.user ?? authUser
  if (u?.is_superuser || u?.is_staff) return true
  const allow = new Set(PAYROLL_EMPLOYEE_EDIT_ROLE_CODES.map((c) => c.toLowerCase()))
  const roles = [
    ...(Array.isArray(rbacUser?.roles) ? rbacUser.roles : []),
    ...(Array.isArray(authUser?.roles) ? authUser.roles : []),
  ]
  return roles.some((r) => allow.has((r?.code || '').toLowerCase()))
}

// Field schema for the Edit Employee modal. Driven entirely by this list:
//   key       — model field on PayrollEmployee
//   label     — UI label
//   type      — 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea'
//   group     — section header in the modal
//   required  — block save until populated
//   options   — for type='select'; pass a static list or set
//               `optionsFrom: 'payment_modes'` to hydrate from /catalog/
//   readOnly  — render disabled (e.g. employee_no after creation)
//   step      — numeric step (defaults to 0.01 for currency)
//   currency  — true → render with AED suffix
export const EMPLOYEE_EDIT_FIELDS = [
  // ── Identity ─────────────────────────────────────────────────────────────
  { key: 'employee_no',        label: 'Employee #',       type: 'text',   group: 'Identity', required: true, readOnly: true },
  { key: 'full_name',          label: 'Full Name',        type: 'text',   group: 'Identity', required: true },
  { key: 'emirates_id',        label: 'Emirates ID',      type: 'text',   group: 'Identity' },
  { key: 'mol_no',             label: 'MOL #',            type: 'text',   group: 'Identity' },
  { key: 'nationality_group',  label: 'Nationality',      type: 'text',   group: 'Identity' },

  // ── Org ──────────────────────────────────────────────────────────────────────
  // type: 'datalist' renders <input list="..."> for freeform entry with suggestions
  { key: 'department',         label: 'Department',       type: 'datalist', group: 'Organisation', optionsFrom: 'departments'  },
  { key: 'discipline',         label: 'Discipline',       type: 'text',     group: 'Organisation' },
  { key: 'designation',        label: 'Designation',      type: 'datalist', group: 'Organisation', optionsFrom: 'designations' },
  { key: 'grade',              label: 'Grade',            type: 'text',     group: 'Organisation' },
  { key: 'joining_date',       label: 'Joining Date',     type: 'date',     group: 'Organisation' },
  { key: 'leaving_date',       label: 'Leaving Date',     type: 'date',     group: 'Organisation' },

  // ── Banking ─────────────────────────────────────────────────────────────
  { key: 'iban',               label: 'IBAN',             type: 'text',   group: 'Banking' },
  { key: 'bank_name',          label: 'Bank',             type: 'text',   group: 'Banking' },
  { key: 'routing_code',       label: 'Routing Code',     type: 'text',   group: 'Banking' },
  { key: 'default_payment_mode', label: 'Payment Mode',   type: 'select', group: 'Banking', optionsFrom: 'payment_modes' },

  // ── Fixed Earnings ──────────────────────────────────────────────────────  { key: 'hours',              label: 'Hours / Month',    type: 'number', group: 'Fixed Earnings', step: '0.01' },  { key: 'basic',              label: 'Basic',            type: 'number', group: 'Fixed Earnings', currency: true, step: '0.01' },
  { key: 'housing',            label: 'Housing',          type: 'number', group: 'Fixed Earnings', currency: true, step: '0.01' },
  { key: 'transport',          label: 'Transport',        type: 'number', group: 'Fixed Earnings', currency: true, step: '0.01' },
  { key: 'home_leave',         label: 'Home Leave',       type: 'number', group: 'Fixed Earnings', currency: true, step: '0.01' },

  // ── Status & Validity ───────────────────────────────────────────────────
  { key: 'is_active',          label: 'Active',           type: 'checkbox', group: 'Status' },
  { key: 'effective_from',     label: 'Effective From',   type: 'date',   group: 'Status' },
  { key: 'effective_to',       label: 'Effective To',     type: 'date',   group: 'Status' },
  { key: 'notes',              label: 'Notes',            type: 'textarea', group: 'Status' },
]

// Payslip employee-info editable fields — snapshot fields that can be
// corrected in the PayslipDetailModal. Changes sync back to PayrollEmployee.
// type 'datalist' = freeform input with catalog suggestions.
export const PAYSLIP_EMPLOYEE_INFO_FIELDS = [
  { key: 'snapshot_joining_date',  label: 'Joining Date',  type: 'date'     },
  { key: 'snapshot_department',    label: 'Department',    type: 'datalist', optionsFrom: 'departments'  },
  { key: 'snapshot_designation',   label: 'Designation',   type: 'datalist', optionsFrom: 'designations' },
]

// Adjustments table columns
export const ADJUSTMENT_COLUMNS = [
  { key: 'employee_name', label: 'Employee',     width: 200 },
  { key: 'employee_no',   label: 'Emp #',        width: 100 },
  { key: 'kind',          label: 'Kind',         width: 110 },
  { key: 'label',         label: 'Label',        width: 200 },
  { key: 'description',   label: 'Description',  width: 280 },
  { key: 'amount',        label: 'Amount',       width: 130, align: 'right', format: 'currency' },
  { key: 'status',        label: 'Status',       width: 110 },
]

// ────────────────────────────────────────────────────────────────────────────
// Adjustments — soft-coded RBAC, statuses, kinds, and modal field schema.
// Mirrors the backend (PayrollAdjustmentWritePermission +
// PAYROLL_ADJUSTMENT_WRITE_ROLES). Keep the two lists in sync.
// ────────────────────────────────────────────────────────────────────────────
export const PAYROLL_ADJUSTMENT_WRITE_ROLE_CODES = [
  'superadmin', 'super_admin', 'admin', 'hr_manager', 'senior_hr', 'hr',
]

/** True when the current user may create / edit / cancel adjustments. */
export function canEditPayrollAdjustment(authUser, rbacUser) {
  const u = authUser?.user ?? authUser
  if (u?.is_superuser || u?.is_staff) return true
  const allow = new Set(PAYROLL_ADJUSTMENT_WRITE_ROLE_CODES.map((c) => c.toLowerCase()))
  const roles = [
    ...(Array.isArray(rbacUser?.roles) ? rbacUser.roles : []),
    ...(Array.isArray(authUser?.roles) ? authUser.roles : []),
  ]
  return roles.some((r) => allow.has((r?.code || '').toLowerCase()))
}

// Adjustment status meta — matches backend catalog.ADJUSTMENT_STATUSES.
// Adding a status here + on backend instantly shows up in chips & filter.
export const ADJUSTMENT_STATUS = {
  PENDING:   'pending',
  APPLIED:   'applied',
  CANCELLED: 'cancelled',
}

export const ADJUSTMENT_STATUS_META = {
  [ADJUSTMENT_STATUS.PENDING]:   { label: 'Pending',   badge: 'bg-amber-50 text-amber-700 border-amber-300',   icon: 'ClockIcon' },
  [ADJUSTMENT_STATUS.APPLIED]:   { label: 'Applied',   badge: 'bg-emerald-50 text-emerald-700 border-emerald-300', icon: 'CheckCircleIcon' },
  [ADJUSTMENT_STATUS.CANCELLED]: { label: 'Cancelled', badge: 'bg-slate-100 text-slate-500 border-slate-300', icon: 'XCircleIcon' },
}

export const ADJUSTMENT_KIND = {
  EARNING:   'earning',
  DEDUCTION: 'deduction',
}

export const ADJUSTMENT_KIND_META = {
  [ADJUSTMENT_KIND.EARNING]:   { label: 'Earning',   badge: 'bg-emerald-50 text-emerald-700 border-emerald-300', sign: '+' },
  [ADJUSTMENT_KIND.DEDUCTION]: { label: 'Deduction', badge: 'bg-rose-50 text-rose-700 border-rose-300',          sign: '−' },
}

// KPI tiles for the adjustments dashboard. Add an entry to surface a new
// metric — the values are computed from `/adjustments/summary/` on the fly.
export const ADJUSTMENT_KPIS = [
  { id: 'count',          label: 'Total Adjustments', icon: 'AdjustmentsHorizontalIcon', color: 'text-indigo-600',  bg: 'bg-indigo-50' },
  { id: 'pending_total',  label: 'Pending Amount',    icon: 'ClockIcon',                  color: 'text-amber-600',   bg: 'bg-amber-50',  format: 'currency' },
  { id: 'earning_total',  label: 'Earnings',          icon: 'ArrowTrendingUpIcon',        color: 'text-emerald-600', bg: 'bg-emerald-50', format: 'currency' },
  { id: 'deduction_total','label': 'Deductions',      icon: 'ArrowTrendingDownIcon',      color: 'text-rose-600',    bg: 'bg-rose-50',    format: 'currency' },
]

// ────────────────────────────────────────────────────────────────────────────
// LINE ITEM CHANGE LOG CONFIGURATION (Soft-Coded)
// ────────────────────────────────────────────────────────────────────────────
// Action types for line item changes
export const CHANGE_LOG_ACTION = {
  CREATED: 'created',
  UPDATED: 'updated',
  DELETED: 'deleted',
}

// Action meta (labels, icons, badges)
export const CHANGE_LOG_ACTION_META = {
  [CHANGE_LOG_ACTION.CREATED]: {
    label: 'Created',
    icon: 'PlusCircleIcon',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    color: 'text-emerald-600',
  },
  [CHANGE_LOG_ACTION.UPDATED]: {
    label: 'Updated',
    icon: 'PencilSquareIcon',
    badge: 'bg-blue-50 text-blue-700 border-blue-300',
    color: 'text-blue-600',
  },
  [CHANGE_LOG_ACTION.DELETED]: {
    label: 'Deleted',
    icon: 'TrashIcon',
    badge: 'bg-rose-50 text-rose-700 border-rose-300',
    color: 'text-rose-600',
  },
}

// Field labels for change comparison display
export const CHANGE_LOG_FIELD_LABELS = {
  kind: 'Type',
  component_code: 'Component',
  label: 'Label',
  description: 'Description',
  amount: 'Amount',
  source: 'Source',
}

// Maximum number of changes to show per page in change history modal
export const CHANGE_LOG_PAGE_SIZE = 20

// Inline change history display configuration
export const INLINE_CHANGE_HISTORY = {
  DEFAULT_LIMIT: 5,                    // Show first N changes by default
  EXPAND_INCREMENT: 5,                 // Load N more when "Load More" is clicked
  EMPTY_MESSAGE: 'No changes recorded yet',
  SHOW_ACTOR: true,                    // Show who made the change
  SHOW_TIMESTAMP: true,                // Show when change was made
  COMPACT_MODE: true,                  // Use compact display (single line per change)
}

// ────────────────────────────────────────────────────────────────────────────

/**
 * Field schema for the create/edit modal. Each entry maps to a model field
 * on PayrollAdjustment. Same renderer as EmployeeEditModal so adding a new
 * field is one-line + serializer change.
 *
 * type='component' is special: it shows a dependent dropdown whose options
 * come from /catalog/ — earning_components or deduction_components depending
 * on the `kind` value selected.
 */
export const ADJUSTMENT_EDIT_FIELDS = [
  // Target — what run will this materialise into
  { key: 'employee',       label: 'Employee',     type: 'employee',  group: 'Target', required: true },
  { key: 'target_year',    label: 'Year',         type: 'number',    group: 'Target', required: true, step: '1' },
  { key: 'target_month',   label: 'Month',        type: 'select',    group: 'Target', required: true, optionsFrom: 'months' },

  // Classification
  { key: 'kind',           label: 'Kind',         type: 'select',    group: 'Classification', required: true, optionsFrom: 'line_item_kinds' },
  { key: 'component_code', label: 'Component',    type: 'component', group: 'Classification', required: true },
  { key: 'status',         label: 'Status',       type: 'select',    group: 'Classification', optionsFrom: 'adjustment_statuses', editOnly: true },

  // Details
  { key: 'label',          label: 'Label',        type: 'text',      group: 'Details', required: true, maxLength: 128 },
  { key: 'amount',         label: 'Amount',       type: 'number',    group: 'Details', required: true, currency: true, step: '0.01' },
  { key: 'description',    label: 'Description',  type: 'textarea',  group: 'Details' },
]

// Month picker labels
export const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const STATUS_LABEL = (code) => STATUS_META[code]?.label ?? code

export const STATUS_BADGE = (code) =>
  STATUS_META[code]?.badge ?? 'bg-gray-100 text-gray-600 border-gray-300'

// Resolve which payslip column set to render for a given canvas mode.
export const getPayslipColumns = (canvasModeKey) => {
  const mode = getCanvasMode(canvasModeKey)
  return mode.payslipColumnsKey === 'expanded'
    ? PAYSLIP_COLUMNS_EXPANDED
    : PAYSLIP_COLUMNS
}

export default {
  CURRENCY: PAYROLL_ENGINE_CURRENCY,
  LOCALE: PAYROLL_ENGINE_LOCALE,
  WORKFLOW_STATUS,
  STATUS_META,
  WORKFLOW_TRANSITIONS,
  ENGINE_TABS,
  DEFAULT_ENGINE_TAB,
  CANVAS_MODES,
  DEFAULT_CANVAS_MODE,
  RUN_COLUMNS,
  PAYSLIP_COLUMNS,
  PAYSLIP_COLUMNS_EXPANDED,
  EMPLOYEE_COLUMNS,
  ADJUSTMENT_COLUMNS,
  MONTH_NAMES,
  formatCurrency,
  formatNumber,
}

// ────────────────────────────────────────────────────────────────────────────
// COMPARISON — mirrors backend `catalog.COMPARISON_*` / `config.COMPARISON_*`.
// Soft-coded everywhere; no value below is hard-coded in the diff panel.
// ────────────────────────────────────────────────────────────────────────────
export const COMPARISON_STATUS = {
  MATCH:         'match',
  VARIANCE:      'variance',
  EXTERNAL_ONLY: 'external_only',
  PAYROLL_ONLY:  'payroll_only',
}

export const COMPARISON_STATUS_META = {
  [COMPARISON_STATUS.MATCH]: {
    label: 'Match',
    short: 'OK',
    tone:  'emerald',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    rowFill: '',
  },
  [COMPARISON_STATUS.VARIANCE]: {
    label: 'Variance',
    short: 'DIFF',
    tone:  'amber',
    badge: 'bg-amber-50 text-amber-700 border-amber-300',
    rowFill: 'bg-amber-50/40',
  },
  [COMPARISON_STATUS.EXTERNAL_ONLY]: {
    label: 'External only',
    short: 'EXT',
    tone:  'sky',
    badge: 'bg-sky-50 text-sky-700 border-sky-300',
    rowFill: 'bg-sky-50/40',
  },
  [COMPARISON_STATUS.PAYROLL_ONLY]: {
    label: 'Missing from external',
    short: 'MISS',
    tone:  'rose',
    badge: 'bg-rose-50 text-rose-700 border-rose-300',
    rowFill: 'bg-rose-50/40',
  },
}

export const COMPARISON_SEVERITY_META = {
  critical: { label: 'Critical', badge: 'bg-rose-100 text-rose-700 border-rose-300', cell: 'bg-rose-50' },
  warning:  { label: 'Warning',  badge: 'bg-amber-100 text-amber-700 border-amber-300', cell: 'bg-amber-50' },
  info:     { label: 'Info',     badge: 'bg-sky-100 text-sky-700 border-sky-300',     cell: 'bg-sky-50' },
}

/** Field metadata mirrors backend catalog.COMPARISON_FIELDS. */
export const COMPARISON_FIELDS = [
  { field: 'employee_no',      label: 'Employee No',  kind: 'identifier' },
  { field: 'full_name',        label: 'Full Name',    kind: 'identifier' },
  { field: 'basic',            label: 'Basic',        kind: 'money'    },
  { field: 'housing',          label: 'Housing',      kind: 'money'    },
  { field: 'transport',        label: 'Transport',    kind: 'money'    },
  { field: 'home_leave',       label: 'Home Leave',   kind: 'money'    },
  { field: 'other_earnings',   label: 'Other Earn',   kind: 'money'    },
  { field: 'total_deductions', label: 'Deductions',   kind: 'money'    },
  { field: 'gross_earnings',   label: 'Gross',        kind: 'money'    },
  { field: 'net_payable',      label: 'Net Payable',  kind: 'money'    },
  { field: 'hours',            label: 'Hours',        kind: 'hours'    },
  { field: 'leave_days',       label: 'Leave Days',   kind: 'days'     },
]

export const comparisonFieldMeta = (field) => {
  if (field === '__match__') return { field: '__match__', label: 'Roster match', kind: 'identifier' }
  return COMPARISON_FIELDS.find((f) => f.field === field) || { field, label: field, kind: 'money' }
}

/** Format a value based on field metadata (money / hours / days). */
export const formatComparisonValue = (field, value) => {
  if (value === null || value === undefined || value === '') return '—'
  const meta = comparisonFieldMeta(field)
  if (meta.kind === 'money')  return formatCurrency(value)
  if (meta.kind === 'hours')  return `${formatNumber(value, { decimals: 2 })} h`
  if (meta.kind === 'days')   return `${formatNumber(value, { decimals: 2 })} d`
  return String(value)
}

/** Fallback profiles when the backend `/profiles/` call hasn't loaded yet. */
export const COMPARISON_PROFILE_FALLBACK = [
  { code: 'auto',       label: 'Auto-detect' },
  { code: 'valueframe', label: 'ValueFrame (timesheet)' },
  { code: 'sympa',      label: 'Sympa (HR master)' },
  { code: 'generic',    label: 'Generic XLSX' },
]
