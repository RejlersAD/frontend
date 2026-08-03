import React from 'react'
import { PROJECT_COPY } from '../../../config/projectControl.config'

export default function ProjectSelector({ projects, value, onChange, loading, error }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
        Active Project
      </span>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        disabled={loading || !projects.length}
        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm
                   text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
                   disabled:bg-slate-100 disabled:cursor-not-allowed"
      >
        {!projects.length && (
          <option value="">{loading ? PROJECT_COPY.loadingProjects : PROJECT_COPY.noProjects}</option>
        )}
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.code} — {p.name}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-xs text-rose-600">{error}</p>
      )}
    </label>
  )
}
