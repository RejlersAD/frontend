import React from 'react'
import { STATUS_BADGE, STATUS_LABEL } from '../../../../config/payrollEngine.config'

export default function StatusBadge({ status, className = '' }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${STATUS_BADGE(status)} ${className}`}
    >
      {STATUS_LABEL(status)}
    </span>
  )
}
