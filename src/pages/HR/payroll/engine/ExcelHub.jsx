import React, { useState } from 'react'
import * as HeroIcons from '@heroicons/react/24/outline'
import payrollEngineService from '../../../../services/payrollEngine.service'
import MonthYearPicker from './MonthYearPicker'

const today = new Date()

export default function ExcelHub({ onAfterImport }) {
  const [period, setPeriod] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const fileInputRef = React.useRef(null)

  const handleImportFull = async () => {
    if (!file) { setError('Pick an Excel file first.'); return }
    setBusy(true); setError(null); setResult(null)
    try {
      const data = await payrollEngineService.importFullXlsx(file, period)
      setResult(data)
      onAfterImport?.(data.run)
    } catch (e) {
      setError(e?.response?.data?.error || e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
          <HeroIcons.DocumentArrowUpIcon className="w-5 h-5 text-blue-600" />
          Full Payroll Import (Excel → Draft Run)
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Upload the monthly master Excel (same format as the source template) to
          create or overwrite the Draft PayrollRun for the chosen period in one shot.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Period</label>
            <MonthYearPicker year={period.year} month={period.month} onChange={setPeriod} />
          </div>

          <div className="flex-1 min-w-[260px]">
            <label className="block text-xs font-medium text-slate-600 mb-1">Excel file</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {file && (
              <p className="text-xs text-slate-500 mt-1">
                Selected: <span className="font-medium">{file.name}</span> ({Math.round(file.size / 1024)} KB)
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleImportFull}
            disabled={!file || busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy
              ? <HeroIcons.ArrowPathIcon className="w-4 h-4 animate-spin" />
              : <HeroIcons.PlayCircleIcon className="w-4 h-4" />
            }
            {busy ? 'Importing…' : 'Import & Generate'}
          </button>
        </div>

        {error && (
          <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
        )}

        {result && (
          <div className="mt-3 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 space-y-0.5">
            <div className="font-semibold">Import successful</div>
            <div>Run: {result.run?.cycle_code} ({result.run?.employee_count} payslips · net {result.run?.total_net} AED)</div>
            <div>
              Employees: {result.import_summary?.employees_created} created /
              {' '}{result.import_summary?.employees_updated} updated /
              {' '}{result.import_summary?.adjustments_created} adjustments queued
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
          <HeroIcons.InformationCircleIcon className="w-5 h-5 text-slate-500" />
          Expected Excel Layout
        </h3>
        <ul className="text-xs text-slate-600 space-y-1 ml-4 list-disc">
          <li>Sheet #1 is the master roster with headers at row 4: Employee #, Name, IBAN, Bank, Department, Designation, Basic, Housing, Transport, Home Leave, Other Pay, Deductions, Payment Method.</li>
          <li>Data rows start at row 5; the row labelled <code className="bg-slate-100 px-1 rounded">TOTAL</code> ends the data block.</li>
          <li>"Other Pay" + "Other Pay Details" become free-form earning adjustments.</li>
          <li>"Salary Deduction" + "Salary Deduction Details" become free-form deductions.</li>
        </ul>
      </div>
    </div>
  )
}
