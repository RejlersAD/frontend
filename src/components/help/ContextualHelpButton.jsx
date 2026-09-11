import React from 'react'
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline'

import { useHelpContext } from './HelpContext'

export default function ContextualHelpButton() {
  const { helpContext, isOpen, openHelp } = useHelpContext()

  return (
    <button
      type="button"
      onClick={event => openHelp(event.currentTarget)}
      className="inline-flex h-10 flex-none items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:bg-blue-950/50 dark:hover:text-blue-100"
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      aria-controls="contextual-help-drawer"
      aria-label={`Open ${helpContext.featureLabel} help`}
      title={`Help: ${helpContext.featureLabel}`}
    >
      <QuestionMarkCircleIcon className="h-5 w-5" aria-hidden="true" />
      <span className="hidden lg:inline">Help</span>
    </button>
  )
}
