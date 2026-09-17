import React, { useEffect, useId, useState } from 'react';
import PropTypes from 'prop-types';
import apiClient from '../../services/api.service';

export default function ProcurementApprovalEmployeeSearch({ value, disabled, onChange, onSelect, label = 'Approved by' }) {
  const inputId = useId();
  const listId = `${inputId}-employees`;
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [selection, setSelection] = useState(null);
  const query = value.trim();

  useEffect(() => {
    if (open && activeIndex >= 0) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open, listId]);

  useEffect(() => {
    setOptions([]);
    setActiveIndex(-1);
    setError('');
    setLoading(false);
    if (!open || disabled || query.length < 2) return undefined;
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(() => {
      apiClient.get('/procurement/po-documents/approval-employees/', {
        params: { search: query, page_size: 20 }, signal: controller.signal, suppressErrorToast: true,
      }).then(({ data }) => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(data?.results)) throw new Error('Invalid employee search response');
        setOptions(data.results);
      }).catch(() => {
        if (!controller.signal.aborted) setError('HR employee search is unavailable. You can enter the name and position manually.');
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, open, disabled, reload]);

  const select = employee => {
    onSelect(employee);
    setSelection(employee);
    setOpen(false);
    setOptions([]);
    setActiveIndex(-1);
  };

  const keyDown = event => {
    if (event.key === 'Escape') { setOpen(false); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      if (options.length) setActiveIndex(previous => event.key === 'ArrowDown'
        ? Math.min(previous + 1, options.length - 1) : Math.max(previous - 1, 0));
    } else if (event.key === 'Enter' && open && options[activeIndex]) {
      event.preventDefault();
      select(options[activeIndex]);
    }
  };

  return <div className="relative min-w-0" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <label htmlFor={inputId} className="text-xs font-semibold text-gray-600">{label}</label>
    <input id={inputId} type="text" role="combobox" aria-autocomplete="list" aria-expanded={open && options.length > 0}
      aria-controls={open && options.length ? listId : undefined} aria-activedescendant={open && options[activeIndex] ? `${listId}-${activeIndex}` : undefined}
      autoComplete="off" value={value} disabled={disabled} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onKeyDown={keyDown}
      onChange={event => {
        onChange(event.target.value, Boolean(selection));
        setSelection(null);
        setOpen(true);
      }} placeholder="Search HR employee or enter a name"
      className="mt-1 block h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-normal disabled:bg-gray-100" />
    {open && options.length > 0 && <div id={listId} role="listbox" aria-label="HR Master employees" className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
      {options.map((employee, index) => <button key={employee.id} id={`${listId}-${index}`} type="button" role="option" tabIndex={-1} aria-selected={activeIndex === index}
        onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)} onClick={() => select(employee)}
        className={`block w-full border-b border-gray-100 px-3 py-2 text-left text-sm last:border-0 ${activeIndex === index ? 'bg-blue-50' : 'hover:bg-blue-50'}`}>
        <span className="block font-semibold text-gray-900">{employee.name}</span>
        <span className="block text-xs text-gray-600">{[employee.position || 'Position not recorded', employee.employee_number].filter(Boolean).join(' · ')}</span>
      </button>)}
    </div>}
    {open && <div className="mt-1 text-xs font-normal text-gray-600" role="status">
      {loading ? 'Searching HR Master…' : error ? <>{error} <button type="button" className="text-blue-700 underline" onClick={() => setReload(previous => previous + 1)}>Retry employee search</button></>
        : query.length < 2 ? 'Type at least 2 characters to search HR Master.'
          : options.length === 0 ? 'No matching HR employee. You can enter the name and position manually.' : ''}
    </div>}
    {!open && selection && value === selection.name && <p className="mt-1 text-xs text-gray-600">{selection.position ? 'Position filled from HR Master.' : 'Position not recorded in HR Master. Enter it below.'}</p>}
  </div>;
}

ProcurementApprovalEmployeeSearch.propTypes = {
  value: PropTypes.string.isRequired,
  disabled: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
  label: PropTypes.string,
};
