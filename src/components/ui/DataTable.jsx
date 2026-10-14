/* eslint-disable react/prop-types */
import React from 'react'

export default function DataTable({ caption, columns, rows, rowKey = 'id', emptyMessage = 'No records found.' }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900" tabIndex="0" role="region" aria-label={caption}>
      <table className="min-w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <tr>{columns.map(column => <th key={column.key} scope="col" className="px-3 py-3">{column.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {rows.map(row => <tr key={row[rowKey]}>{columns.map(column => <td key={column.key} className="px-3 py-3 text-slate-700 dark:text-slate-200">{column.render ? column.render(row) : row[column.key]}</td>)}</tr>)}
          {!rows.length && <tr><td colSpan={columns.length} className="px-3 py-10 text-center text-slate-500">{emptyMessage}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
