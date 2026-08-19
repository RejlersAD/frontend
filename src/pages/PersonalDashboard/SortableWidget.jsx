/**
 * SortableWidget — wraps a dashboard widget with dnd-kit sortable behaviour.
 *
 * In edit mode a floating drag handle + hide button appear in the top-right corner.
 * When idle it renders the widget untouched (zero visual overhead).
 *
 * AI-flair: a soft neon border pulses on hover in edit mode and while dragging
 * — see .ai-widget-shell CSS in AIDashboardStyles.jsx.
 */
import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Bars3Icon, EyeSlashIcon, SparklesIcon } from '@heroicons/react/24/outline'

export default function SortableWidget({ id, editing, onHide, children, label }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !editing })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 220ms cubic-bezier(0.2, 0, 0, 1)',
    zIndex: isDragging ? 40 : 'auto',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        'ai-widget-shell relative rounded-3xl ' +
        (editing ? 'ai-widget-shell--editing ' : '') +
        (isDragging ? 'ai-widget-shell--dragging opacity-95 ' : '')
      }
      {...attributes}
    >
      {editing && (
        <div className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5">
          <button
            type="button"
            {...listeners}
            className="pointer-events-auto flex items-center gap-1 bg-white/95 backdrop-blur shadow-lg ring-1 ring-slate-200 rounded-full px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-white hover:ring-indigo-300 cursor-grab active:cursor-grabbing transition-all"
            title="Drag to reorder"
            aria-label={`Drag ${label || 'widget'}`}
          >
            <Bars3Icon className="h-3.5 w-3.5 text-indigo-500" />
            Move
          </button>
          <button
            type="button"
            onClick={() => onHide?.(id)}
            className="pointer-events-auto flex items-center gap-1 bg-white/95 backdrop-blur shadow-lg ring-1 ring-slate-200 rounded-full px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-rose-50 hover:ring-rose-300 hover:text-rose-700 transition-all"
            title="Hide this widget"
            aria-label={`Hide ${label || 'widget'}`}
          >
            <EyeSlashIcon className="h-3.5 w-3.5" />
            Hide
          </button>
        </div>
      )}

      {/* AI glow ring — visible only in edit mode or while dragging */}
      {(editing || isDragging) && (
        <span className="ai-widget-glow pointer-events-none absolute inset-0 rounded-3xl" aria-hidden />
      )}

      {editing && !isDragging && (
        <SparklesIcon className="pointer-events-none absolute top-2 right-2 h-4 w-4 text-indigo-400/70 animate-pulse" aria-hidden />
      )}

      {children}
    </div>
  )
}
