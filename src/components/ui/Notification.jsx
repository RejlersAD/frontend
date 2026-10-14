/* eslint-disable react/prop-types */
import React from 'react'

const TONES = {
  success: 'bg-emerald-700 text-white',
  error: 'bg-rose-700 text-white',
  info: 'bg-sky-800 text-white',
  warning: 'bg-amber-100 text-amber-950 border border-amber-300',
}

export default function Notification({ tone = 'info', children, className = '' }) {
  const isError = tone === 'error'
  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={`rounded-lg px-4 py-3 text-sm shadow-lg ${TONES[tone] || TONES.info} ${className}`}
    >
      {children}
    </div>
  )
}
