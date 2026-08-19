import React from 'react'
import { SparklesIcon } from '@heroicons/react/24/outline'
import { PROJECT_COPY } from '../../../config/projectControl.config'

export default function PhaseStubCard({ mode }) {
  if (!mode) return null
  return (
    <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center">
      <SparklesIcon className="h-10 w-10 text-indigo-300 mx-auto" />
      <h3 className="mt-4 text-lg font-semibold text-slate-700">
        {PROJECT_COPY.phaseStubTitle(mode.label)}
      </h3>
      <p className="mt-2 text-sm text-slate-500 max-w-xl mx-auto">
        {PROJECT_COPY.phaseStubBody(mode.label, mode.phaseFlag)}
      </p>
      {mode.phaseLabel && (
        <span className="inline-block mt-4 text-xs uppercase tracking-wider bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full">
          {mode.phaseLabel}
        </span>
      )}
    </div>
  )
}
