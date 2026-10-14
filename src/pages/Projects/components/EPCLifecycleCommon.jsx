/* eslint-disable react/prop-types */
import React, { useEffect, useId, useRef } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

export const epcLabel = value => String(value ?? '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
export const epcDate = value => value && Number.isFinite(Date.parse(value)) ? new Date(String(value).length === 10 ? `${value}T00:00:00Z` : value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Not recorded'
export const epcMoney = (value, currency) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? `${currency || ''} ${Number(value).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`.trim() : 'Not recorded'
export const epcRows = value => Array.isArray(value) ? value : Array.isArray(value?.results) ? value.results : []
export const epcId = value => value?.id ?? value ?? ''
const epcPhases = ['engineering', 'procurement', 'construction', 'commissioning']
export const epcControlScope = (project, supplied) => {
  if (Array.isArray(supplied?.owned_phases) && Array.isArray(supplied?.dependency_phases)) return supplied
  const owned = project?.scope_type === 'detailed_engineering' ? ['engineering'] : project?.scope_type === 'epc' ? epcPhases : []
  return { scope_type: project?.scope_type || '', owned_phases: owned, dependency_phases: owned.length ? epcPhases.filter(phase => !owned.includes(phase)) : [], description: project?.scope_type === 'detailed_engineering' ? 'Engineering is the controlled scope. Procurement, construction and commissioning are external dependencies.' : project?.scope_type === 'epc' ? 'Engineering, procurement, construction and commissioning are controlled project scope.' : 'Confirm the delivery scope before assigning phase ownership.' }
}
export const epcControlRole = (scope, phase) => scope?.owned_phases?.includes(phase) ? 'owned' : scope?.dependency_phases?.includes(phase) ? 'dependency' : 'unconfirmed'
export const epcControlRoleLabel = role => role === 'owned' ? 'Controlled scope' : role === 'dependency' ? 'External dependency' : 'Scope to confirm'
export const epcWbsPhase = (node, nodes = []) => {
  const phaseCodes = { 'EPC-ENG': 'engineering', 'EPC-PROC': 'procurement', 'EPC-CON': 'construction', 'EPC-COM': 'commissioning' }
  const visited = new Set()
  let current = node
  while (current && !visited.has(String(current.id))) {
    if (phaseCodes[current.code]) return phaseCodes[current.code]
    visited.add(String(current.id))
    current = nodes.find(item => String(item.id) === String(epcId(current.parent)))
  }
  return null
}
export const epcError = error => {
  const body = error?.response?.data
  const flatten = (value, prefix = '') => typeof value === 'string' ? `${prefix}${value}` : Array.isArray(value) ? value.map(item => flatten(item, prefix)).join(' ') : value && typeof value === 'object' ? Object.entries(value).map(([key, item]) => flatten(item, ['detail', 'error', 'non_field_errors'].includes(key) ? prefix : `${prefix}${epcLabel(key)}: `)).join(' ') : String(value ?? '')
  return body ? flatten(body) : error?.message || 'The request could not be completed. Refresh and try again.'
}

export function EPCPanel({ title, icon: Icon, children, actions, className = '' }) {
  const id = useId()
  return <section className={`epc-panel ${className}`} aria-labelledby={id}><header><h2 id={id}>{Icon && <Icon size={18} aria-hidden="true" />}{title}</h2>{actions && <div className="epc-panel-actions">{actions}</div>}</header><div className="epc-panel-body">{children}</div></section>
}
export function EPCNotice({ children, error = false, success = false }) {
  if (!children) return null
  const Icon = error ? AlertCircle : success ? CheckCircle2 : Info
  return <div className={`epc-notice${error ? ' epc-danger' : success ? ' epc-success' : ''}`} role={error ? 'alert' : 'status'}><Icon size={17} aria-hidden="true" /><div>{children}</div></div>
}
export function EPCStatus({ value, label }) {
  const tone = ['accepted', 'approved', 'ready', 'linked'].includes(value) ? 'success' : ['rejected', 'blocked', 'unavailable'].includes(value) ? 'danger' : ['submitted', 'reviewed', 'in_review', 'required'].includes(value) ? 'warning' : 'neutral'
  return <span className={`epc-status epc-${tone}`}>{label || epcLabel(value) || 'Not recorded'}</span>
}
export function EPCScroll({ label, children }) { return <div className="epc-table-wrap" role="region" aria-label={label} tabIndex={0}>{children}</div> }
export function EPCEmpty({ children }) { return <p className="epc-empty">{children}</p> }
export function EPCFacts({ rows }) { return <dl className="epc-facts">{rows.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value ?? 'Not recorded'}</dd></div>)}</dl> }
export function EPCBlockers({ blockers = [], title = 'Requirements to complete' }) {
  if (!blockers.length) return null
  return <div className="epc-blockers"><h3><AlertCircle size={15} aria-hidden="true" />{title}</h3><ul>{blockers.map((item, index) => <li key={item.code || item.id || index}>{typeof item === 'string' ? item : item.message || item.detail || item.label || JSON.stringify(item)}</li>)}</ul></div>
}
export function EPCModal({ title, children, footer, busy = false, onClose }) {
  const ref = useRef(null), id = useId()
  useEffect(() => {
    const dialog = ref.current, opener = document.activeElement
    dialog.showModal()
    return () => { dialog.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  return <dialog ref={ref} className="epc-dialog" aria-labelledby={id} onCancel={event => { event.preventDefault(); if (!busy) onClose() }} onClick={event => { if (event.target === event.currentTarget && !busy) onClose() }}><header><h2 id={id}>{title}</h2><button type="button" className="pp-button pp-icon-button" disabled={busy} onClick={onClose} aria-label="Close dialog"><X size={18} aria-hidden="true" /></button></header><div className="epc-dialog-body">{children}</div>{footer && <footer>{footer}</footer>}</dialog>
}
