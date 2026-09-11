import React, { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { BookOpenIcon, XMarkIcon } from '@heroicons/react/24/outline'

import { useHelpContext } from './HelpContext'
import HelpArticleBrowser from './HelpArticleBrowser'

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',')

function HelpTable({ section }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-400 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-900" role="region" aria-label="Help topics table">
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <colgroup>
          <col className="w-[22%]" />
          <col className="w-[30%]" />
          <col className="w-[48%]" />
        </colgroup>
        <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <tr className="border-b border-slate-400 dark:border-slate-600">
            {section.table.columns.map(column => (
              <th key={column} scope="col" className="border-r border-slate-400 px-4 py-3 font-bold last:border-r-0 dark:border-slate-600">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section.table.rows.map(row => (
            <tr key={row[0]} className="border-b border-slate-400 align-top last:border-b-0 odd:bg-white even:bg-slate-50/70 dark:border-slate-600 dark:odd:bg-slate-900 dark:even:bg-slate-800/50">
              {row.map((cell, index) => index === 0
                ? <th key={cell} scope="row" className="break-words border-r border-slate-400 px-4 py-4 font-bold text-slate-900 last:border-r-0 dark:border-slate-600 dark:text-white">{cell}</th>
                : <td key={`${row[0]}-${index}`} className="break-words border-r border-slate-400 px-4 py-4 leading-6 text-slate-600 last:border-r-0 dark:border-slate-600 dark:text-slate-300">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

HelpTable.propTypes = {
  section: PropTypes.shape({
    table: PropTypes.shape({
      columns: PropTypes.arrayOf(PropTypes.string).isRequired,
      rows: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string)).isRequired,
    }).isRequired,
  }).isRequired,
}

function articleGuidance(helpContext) {
  const firstArticle = helpContext.articles[0]
  if (!firstArticle) return helpContext.summary
  const details = firstArticle.sections.flatMap(section => [
    section.body,
    ...(section.steps || []),
  ]).filter(Boolean)
  return details.join(' ') || firstArticle.summary
}

export default function ContextualHelpDrawer() {
  const { helpContext, isOpen, closeHelp } = useHelpContext()
  const panelRef = useRef(null)
  const closeRef = useRef(null)

  const tableSection = useMemo(() => {
    const configuredTable = helpContext.landingSections.find(section => section.table)
    if (configuredTable) return configuredTable
    return {
      table: {
        columns: ['Area', 'What it is', 'How it works'],
        rows: [[helpContext.featureLabel, helpContext.summary, articleGuidance(helpContext)]],
      },
    }
  }, [helpContext])

  useEffect(() => {
    if (!isOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.setTimeout(() => closeRef.current?.focus(), 0)

    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeHelp()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = [...panelRef.current.querySelectorAll(FOCUSABLE)]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeHelp, isOpen])

  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[80]">
      <button type="button" className="absolute inset-0 h-full w-full cursor-default bg-slate-950/35 backdrop-blur-[1px]" onClick={() => closeHelp()} aria-label="Close contextual help" tabIndex="-1" />
      <aside
        ref={panelRef}
        id="contextual-help-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contextual-help-title"
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-slate-200 bg-slate-50 text-slate-900 shadow-2xl sm:w-[min(48rem,75vw)] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      >
        <header className="flex-none border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-blue-700 dark:text-blue-300">{helpContext.moduleLabel} only</p>
              <h2 id="contextual-help-title" className="mt-1 truncate text-xl font-bold">{helpContext.title}</h2>
            </div>
            <button ref={closeRef} type="button" onClick={() => closeHelp()} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Close help">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <BookOpenIcon className="h-5 w-5 text-blue-700 dark:text-blue-300" aria-hidden="true" />
            Help topics
          </h3>
          {helpContext.searchableArticles
            ? <HelpArticleBrowser key={helpContext.id} articles={helpContext.articles} selectedArticleId={helpContext.selectedArticleId} />
            : <HelpTable section={tableSection} />}
        </div>

        <footer className="flex-none border-t border-slate-200 bg-white px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          Content scope: <strong className="text-slate-700 dark:text-slate-200">{helpContext.moduleLabel}</strong> · Press Esc to close
        </footer>
      </aside>
    </div>,
    document.body,
  )
}
