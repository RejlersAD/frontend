import React, { useId, useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

export default function ReportingManagerSelect({ employees, value, selectedEmployee, onChange, loading, error, inputClassName, compact = false }) {
  const id = useId();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const container = useRef(null);
  const trigger = useRef(null);
  const searchInput = useRef(null);
  useEffect(() => {
    if (!open) return;
    searchInput.current?.focus();
    const dismiss = event => {
      if (!container.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = employees.filter(employee => {
    const text = [employee.name, employee.email, employee.employee_id, employee.department, employee.job_title].join(' ').toLowerCase();
    return terms.every(term => text.includes(term));
  });
  const selected = employees.find(employee => employee.id === value) || selectedEmployee;
  const options = value && !matches.some(employee => employee.id === value)
    ? [{ ...selected, id: value, name: selected?.name || 'Current reporting manager' }, ...matches]
    : matches;

  if (compact) {
    const choose = managerId => {
      onChange(managerId);
      setOpen(false);
      setSearch('');
      trigger.current?.focus();
    };
    return <div ref={container} className="reporting-manager-dropdown career-input-field"
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) {
          event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus();
        }
      }}>
      <label htmlFor={id} className="sr-only">Reporting Manager</label>
      <button ref={trigger} id={id} type="button" className={`manager-dropdown-trigger ${inputClassName}`}
        aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${id}-popup` : undefined}
        disabled={loading || Boolean(error)} onClick={() => { setSearch(''); setOpen(previous => !previous); }}>
        <span>{value ? `${selected?.name || 'Current reporting manager'}${selected?.employee_id ? ` · ${selected.employee_id}` : ''}` : 'Select reporting manager'}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m6 9 6 6 6-6" strokeWidth="2" /></svg>
      </button>
      {open && <div id={`${id}-popup`} role="dialog" aria-label="Choose reporting manager" className="manager-dropdown-popup">
        <input ref={searchInput} type="search" aria-label="Search reporting manager employees"
          placeholder="Search name, email, ID, department or title"
          value={search} onChange={event => setSearch(event.target.value)} className={inputClassName}
          onKeyDown={event => {
            if (event.key === 'ArrowDown') {
              event.preventDefault(); container.current?.querySelector('.manager-dropdown-options button')?.focus();
            }
          }} />
        <div className="manager-dropdown-options" onKeyDown={event => {
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
          const buttons = [...event.currentTarget.querySelectorAll('button')];
          const index = buttons.indexOf(document.activeElement);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
          event.preventDefault(); buttons[next]?.focus();
        }}>
          <button type="button" aria-pressed={!value} onClick={() => choose('')}>No reporting manager assigned</button>
          {matches.map(employee => <button type="button" key={employee.id} aria-pressed={employee.id === value} onClick={() => choose(employee.id)}>
            <span>{employee.name}{employee.employee_id ? ` · ${employee.employee_id}` : ''}</span>
            <small>{[employee.email, employee.job_title].filter(Boolean).join(' · ')}</small>
          </button>)}
          {!matches.length && <p role="status">No employees match your search.</p>}
        </div>
      </div>}
      {(loading || error) && <p role="status" className={`text-xs mt-1 ${error ? 'text-red-600' : 'text-gray-500'}`}>{error || 'Loading employees…'}</p>}
    </div>;
  }

  return <div className={compact ? 'reporting-manager-compact' : undefined}>
    <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">Reporting Manager</label>
    <div className={compact ? 'reporting-manager-controls' : undefined}>
    <input
      type="search" aria-label="Search reporting manager employees"
      placeholder={compact ? 'Search employees…' : 'Search by name, email, employee ID, department or job title'}
      value={search} onChange={event => setSearch(event.target.value)}
      className={`${inputClassName} mb-2`} disabled={loading || Boolean(error)}
      aria-describedby={`${id}-status`}
    />
    <select id={id} value={value || ''} onChange={event => onChange(event.target.value)} className={inputClassName} disabled={loading || Boolean(error)}>
      <option value="">No reporting manager assigned</option>
      {options.map(employee => <option key={employee.id} value={employee.id}>
        {employee.name}{employee.employee_id ? ` · ${employee.employee_id}` : ''}{employee.email ? ` · ${employee.email}` : ''}{employee.job_title ? ` · ${employee.job_title}` : ''}
      </option>)}
    </select>
    </div>
    <p id={`${id}-status`} role="status" className={compact && !loading && !error && matches.length ? 'sr-only' : `text-xs mt-1 ${error ? 'text-red-600' : 'text-gray-500'}`}>
      {loading ? 'Loading employees…' : error || (matches.length ? `${matches.length} employees available` : 'No employees match your search.')}
    </p>
  </div>;
}

ReportingManagerSelect.propTypes = {
  employees: PropTypes.array.isRequired, value: PropTypes.string,
  selectedEmployee: PropTypes.object, onChange: PropTypes.func.isRequired,
  loading: PropTypes.bool, error: PropTypes.string, inputClassName: PropTypes.string,
  compact: PropTypes.bool,
};
