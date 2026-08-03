import React from 'react'

const STATUS_TONES = {
  planning:   'bg-blue-100   text-blue-700',
  active:     'bg-emerald-100 text-emerald-700',
  on_hold:    'bg-amber-100  text-amber-700',
  completed:  'bg-slate-100  text-slate-700',
  archived:   'bg-slate-100  text-slate-500',
}

const PRIORITY_TONES = {
  low:      'bg-slate-100  text-slate-600',
  medium:   'bg-blue-100   text-blue-700',
  high:     'bg-amber-100  text-amber-700',
  critical: 'bg-rose-100   text-rose-700',
}

export default function ProjectHeaderStrip({ project }) {
  const startDate = project.start_date ? new Date(project.start_date).toLocaleDateString() : '—'
  const endDate   = project.end_date   ? new Date(project.end_date).toLocaleDateString()   : '—'

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-slate-900 truncate">{project.name}</h2>
            <code className="px-2 py-0.5 text-xs bg-slate-100 rounded text-slate-600">{project.code}</code>
            {project.status && (
              <span className={`text-xs px-2 py-0.5 rounded ${STATUS_TONES[project.status] || 'bg-slate-100 text-slate-700'}`}>
                {project.status.replace(/_/g, ' ')}
              </span>
            )}
            {project.priority && (
              <span className={`text-xs px-2 py-0.5 rounded ${PRIORITY_TONES[project.priority] || 'bg-slate-100 text-slate-700'}`}>
                {project.priority}
              </span>
            )}
          </div>
          {project.client_name && (
            <p className="mt-1 text-sm text-slate-500">Client: {project.client_name}</p>
          )}
          {project.description && (
            <p className="mt-2 text-sm text-slate-600 line-clamp-2">{project.description}</p>
          )}
        </div>
        <div className="text-right text-xs text-slate-500">
          <div>Start: <span className="text-slate-700">{startDate}</span></div>
          <div>End: <span className="text-slate-700">{endDate}</span></div>
          {typeof project.progress === 'number' && (
            <div className="mt-2 w-40">
              <div className="flex justify-between text-[10px] uppercase tracking-wider">
                <span>Progress</span>
                <span>{project.progress}%</span>
              </div>
              <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, project.progress))}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
