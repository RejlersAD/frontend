import React, { useId, useState } from 'react';
import PropTypes from 'prop-types';

export default function ReportingManagerSelect({ employees, value, selectedEmployee, onChange, loading, error, inputClassName }) {
  const id = useId();
  const [search, setSearch] = useState('');
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = employees.filter(employee => {
    const text = [employee.name, employee.email, employee.employee_id, employee.department, employee.job_title].join(' ').toLowerCase();
    return terms.every(term => text.includes(term));
  });
  const selected = employees.find(employee => employee.id === value) || selectedEmployee;
  const options = value && !matches.some(employee => employee.id === value)
    ? [{ ...selected, id: value, name: selected?.name || 'Current reporting manager' }, ...matches]
    : matches;

  return <div>
    <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">Reporting Manager</label>
    <input
      type="search" aria-label="Search reporting manager employees"
      placeholder="Search by name, email, employee ID, department or job title"
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
    <p id={`${id}-status`} role="status" className={`text-xs mt-1 ${error ? 'text-red-600' : 'text-gray-500'}`}>
      {loading ? 'Loading employees…' : error || (matches.length ? `${matches.length} employees available` : 'No employees match your search.')}
    </p>
  </div>;
}

ReportingManagerSelect.propTypes = {
  employees: PropTypes.array.isRequired, value: PropTypes.string,
  selectedEmployee: PropTypes.object, onChange: PropTypes.func.isRequired,
  loading: PropTypes.bool, error: PropTypes.string, inputClassName: PropTypes.string,
};
