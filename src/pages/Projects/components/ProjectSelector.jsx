/* eslint-disable react/prop-types */
import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CheckIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { PROJECT_COPY } from '../../../config/projectControl.config'

const projectLabel = (project) => `${project.code} — ${project.name}`

export default function ProjectSelector({ projects, value, onChange, loading, error, label = 'Active Project' }) {
  const inputId = useId()
  const listboxId = `${inputId}-options`
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const selectedProject = projects.find((project) => String(project.id) === String(value)) || null
  const selectedLabel = selectedProject ? projectLabel(selectedProject) : ''
  const [query, setQuery] = useState(selectedLabel)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (!open) setQuery(selectedLabel)
  }, [open, selectedLabel])

  useEffect(() => {
    const closeOnOutsidePointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [])

  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized || query === selectedLabel) return projects
    return projects.filter((project) => [project.code, project.name, project.client_name]
      .filter(Boolean)
      .some((field) => String(field).toLocaleLowerCase().includes(normalized)))
  }, [projects, query, selectedLabel])

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(filteredProjects.length - 1, 0)))
  }, [filteredProjects.length])

  const selectProject = (project) => {
    onChange(project.id)
    setQuery(projectLabel(project))
    setOpen(false)
  }

  const openForSearch = () => {
    if (loading || !projects.length) return
    setOpen(true)
    setActiveIndex(Math.max(projects.findIndex((project) => String(project.id) === String(value)), 0))
  }

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) openForSearch()
      else setActiveIndex((current) => Math.min(current + 1, filteredProjects.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) openForSearch()
      else setActiveIndex((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Enter' && open && filteredProjects[activeIndex]) {
      event.preventDefault()
      selectProject(filteredProjects[activeIndex])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setQuery(selectedLabel)
      setOpen(false)
    }
  }

  const emptyText = loading
    ? PROJECT_COPY.loadingProjects
    : projects.length ? 'No projects match your search.' : PROJECT_COPY.noProjects

  return (
    <div ref={rootRef} className="relative block">
      <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </label>
      <div className="relative">
        <MagnifyingGlassIcon aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open && filteredProjects[activeIndex] ? `${inputId}-option-${filteredProjects[activeIndex].id}` : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          value={query}
          placeholder={loading ? PROJECT_COPY.loadingProjects : 'Search by project code, name or client'}
          disabled={loading || !projects.length}
          onFocus={(event) => {
            openForSearch()
            event.currentTarget.select()
          }}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
            setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-10 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
        />
        <button
          type="button"
          aria-label={open ? 'Close project list' : 'Open project list'}
          tabIndex={-1}
          disabled={loading || !projects.length}
          onClick={() => {
            if (open) setOpen(false)
            else {
              openForSearch()
              inputRef.current?.focus()
            }
          }}
          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
        >
          <ChevronDownIcon aria-hidden="true" className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <ul id={listboxId} role="listbox" aria-label={`${label} results`} className="max-h-72 overflow-y-auto py-1">
            {filteredProjects.length ? filteredProjects.map((project, index) => {
              const selected = String(project.id) === String(value)
              const active = index === activeIndex
              return (
                <li
                  id={`${inputId}-option-${project.id}`}
                  key={project.id}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectProject(project)}
                  className={`flex cursor-pointer items-start gap-2 px-3 py-2.5 text-sm ${active ? 'bg-indigo-50 text-indigo-950 dark:bg-indigo-950/60 dark:text-indigo-100' : 'text-slate-700 dark:text-slate-200'}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{project.code}</span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{project.name}{project.client_name ? ` · ${project.client_name}` : ''}</span>
                  </span>
                  {selected && <CheckIcon aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-indigo-600" />}
                </li>
              )
            }) : (
              <li className="px-3 py-4 text-center text-sm text-slate-500">{emptyText}</li>
            )}
          </ul>
          <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-800">
            {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'} · Type to filter
          </p>
        </div>
      )}
      {error && <p id={`${inputId}-error`} className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  )
}
