import React, { useEffect, useId, useState } from 'react';
import PropTypes from 'prop-types';
import apiClient from '../../services/api.service';

const VENDOR_FIELDS = [
  ['vendor_license_no', 'Vendor trade license', 'text'],
  ['seller_contact_person', 'Vendor contact person', 'text'],
  ['seller_email', 'Vendor email', 'email'],
  ['seller_phone', 'Vendor phone', 'tel'],
  ['seller_country', 'Vendor country', 'text'],
  ['seller_address', 'Vendor address', 'textarea'],
];

export default function ProcurementImportVendorReview({ fields = {}, onChange, disabled = false, compact = false }) {
  const inputId = useId();
  const listId = `${inputId}-vendors`;
  const statusId = `${inputId}-status`;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState({ query: '', options: [], loading: false, error: '' });
  const name = String(fields.vendor_name || '');
  const query = name.trim();
  const current = search.query === query ? search : { options: [], loading: true, error: '' };
  const options = current.options;
  const expanded = open && !disabled && !current.loading && options.length > 0;

  useEffect(() => {
    if (!open || disabled) return undefined;
    const controller = new AbortController();
    setActiveIndex(-1);
    setSearch({ query, options: [], loading: true, error: '' });
    const timer = window.setTimeout(() => {
      apiClient.get('/procurement/vendors/', {
        params: { search: query, page_size: 50 }, signal: controller.signal, suppressErrorToast: true,
      }).then(({ data }) => {
        if (controller.signal.aborted) return;
        const rows = Array.isArray(data) ? data : data?.results;
        if (!Array.isArray(rows)) throw new Error('Invalid vendor search response');
        const active = rows.filter(vendor => vendor?.id && typeof vendor.name === 'string'
          && vendor.is_active !== false && (!vendor.status || vendor.status === 'active'));
        setSearch({ query, options: active, loading: false, error: '' });
      }).catch(() => {
        if (controller.signal.aborted) return;
        setSearch({ query, options: [], loading: false, error: 'Vendor search is unavailable. You can still enter supplier details manually.' });
      });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [name, query, open, disabled, retry]);

  useEffect(() => {
    if (expanded && activeIndex >= 0) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, expanded, listId]);

  const select = vendor => {
    if (disabled || current.loading || current.error || !options.some(option => option.id === vendor.id)) return;
    onChange({ vendor_id: String(vendor.id), vendor_name: vendor.name });
    setOpen(false);
    setActiveIndex(-1);
  };

  const keyDown = event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      if (options.length && !current.loading) setActiveIndex(previous => event.key === 'ArrowDown'
        ? Math.min(previous + 1, options.length - 1)
        : previous < 0 ? options.length - 1 : Math.max(previous - 1, 0));
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      if (options[activeIndex]) select(options[activeIndex]);
    }
  };

  return <section aria-label="Vendor details" className={compact ? 'procurement-import-review__vendor' : 'space-y-3 rounded-xl border border-gray-200 bg-white p-4'}>
    <div>
      <h3 className="text-sm font-semibold text-gray-800">Vendor details</h3>
      {!compact && <p className="mt-1 text-xs text-gray-600">Existing vendors are reused. Contact details are used when registering a new vendor.</p>}
    </div>
    <div className={compact ? 'procurement-import-review__vendor-grid' : 'grid gap-3 sm:grid-cols-2'}>
      <div className={compact ? 'procurement-import-review__vendor-search' : 'relative min-w-0 sm:col-span-2'} onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}>
        <label htmlFor={inputId} className="text-xs font-semibold text-gray-700">{compact ? <>Supplier name<span className="procurement-import-review__required"> *</span></> : 'PO Supplier name'}</label>
        <input id={inputId} aria-label="PO Supplier name" aria-required={compact || undefined} type="text" role="combobox" aria-autocomplete="list" aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined} aria-activedescendant={expanded && options[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          aria-describedby={open && !disabled ? statusId : undefined} autoComplete="off" value={name} disabled={disabled}
          placeholder="Search existing vendors or enter a supplier name" onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onKeyDown={keyDown}
          onChange={event => {
            onChange({ vendor_name: event.target.value, vendor_id: null });
            setSearch({ query: event.target.value.trim(), options: [], loading: true, error: '' });
            setActiveIndex(-1);
            setOpen(true);
          }} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal disabled:bg-gray-100" />
        {expanded && <div id={listId} role="listbox" aria-label="Existing vendors" className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-lg">
          {options.map((vendor, index) => <button key={vendor.id} id={`${listId}-${index}`} type="button" role="option" tabIndex={-1}
            aria-selected={String(fields.vendor_id || '') === String(vendor.id)} onMouseDown={event => event.preventDefault()}
            onMouseEnter={() => setActiveIndex(index)} onClick={() => select(vendor)}
            className={`block w-full border-b border-gray-100 px-3 py-2 text-left text-sm last:border-0 ${activeIndex === index ? 'bg-indigo-50' : 'hover:bg-indigo-50'}`}>
            <span className="block font-semibold text-gray-800">{vendor.name}</span>
            {(vendor.vendor_code || vendor.trade_license_number) && <span className="block text-xs text-gray-600">{[vendor.vendor_code, vendor.trade_license_number].filter(Boolean).join(' · ')}</span>}
          </button>)}
        </div>}
        <div id={statusId} role="status" aria-hidden={!open || disabled} className={`mt-1 min-h-4 text-xs text-gray-600 ${open && !disabled ? '' : 'invisible'}`}>
          {current.loading ? 'Searching vendors...' : current.error ? <>{current.error} <button type="button" onClick={() => setRetry(value => value + 1)} className="font-semibold text-indigo-700 underline">Retry vendor search</button></>
            : options.length ? 'Select an existing vendor or keep the supplier name from the PDF.'
              : 'No matching active vendor found. Keep the supplier details to register a new vendor when saving.'}
        </div>
        {fields.vendor_id && <p className="mt-1 text-xs text-gray-600">Existing vendor selected.</p>}
      </div>
      {VENDOR_FIELDS.map(([key, label, type]) => <label key={key} className={compact ? `procurement-import-review__po-field ${type === 'textarea' ? 'procurement-import-review__vendor-address' : ''}` : `text-xs font-semibold text-gray-700 ${type === 'textarea' ? 'sm:col-span-2' : ''}`}>
        <span>{compact ? ({ vendor_license_no: 'Trade license', seller_contact_person: 'Contact person' })[key] || label : label}</span>
        {type === 'textarea'
          ? <textarea aria-label={label} value={fields[key] ?? ''} rows={compact ? 1 : 3} disabled={disabled} onChange={event => onChange({ [key]: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal disabled:bg-gray-100" />
          : <input aria-label={label} type={type} value={fields[key] ?? ''} disabled={disabled} onChange={event => onChange({ [key]: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal disabled:bg-gray-100" />}
      </label>)}
    </div>
  </section>;
}

ProcurementImportVendorReview.propTypes = {
  fields: PropTypes.object,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  compact: PropTypes.bool,
};
