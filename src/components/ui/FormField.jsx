/* eslint-disable react/prop-types */
import React, { useId } from 'react'

export default function FormField({ label, hint, error, required = false, children }) {
  const generatedId = useId()
  const controlId = children.props.id || `field-${generatedId}`
  const descriptionId = hint || error ? `${controlId}-description` : undefined
  return (
    <div>
      <label htmlFor={controlId} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}{required && <span aria-hidden="true" className="ml-1 text-rose-600">*</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {React.cloneElement(children, { id: controlId, 'aria-describedby': descriptionId, 'aria-invalid': Boolean(error) })}
      {(error || hint) && <p id={descriptionId} className={`mt-1 text-xs ${error ? 'text-rose-700' : 'text-slate-500 dark:text-slate-400'}`}>{error || hint}</p>}
    </div>
  )
}
