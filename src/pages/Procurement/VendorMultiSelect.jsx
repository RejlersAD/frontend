import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function VendorMultiSelect({ label, options, value, onChange, invalid = false }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const container = useRef(null);
  const trigger = useRef(null);
  const panelId = useId();
  const panel = useRef(null);
  const [position, setPosition] = useState({});
  const positionPanel = useCallback(() => {
      const bounds = trigger.current.getBoundingClientRect();
      const width = Math.min(bounds.width, 420, window.innerWidth - 24);
      const below = window.innerHeight - bounds.bottom - 16;
      const above = bounds.top - 16;
      const upwards = below < 280 && above > below;
      setPosition({position:'fixed', width, left:Math.max(12, Math.min(bounds.left, window.innerWidth - width - 12)),
        ...(upwards ? {bottom:window.innerHeight - bounds.top + 6} : {top:bounds.bottom + 6}),
        maxHeight:Math.max(120, Math.min(340, upwards ? above : below))});
  }, []);
  const toggle = () => {
    if (!open) positionPanel();
    setOpen(!open);
    setSearch('');
  };
  const choices = [...options, ...value.filter(item => !options.some(option => option.value === item)).map(item => ({value:item,label:item}))];
  const selected = choices.filter(option => value.includes(option.value));
  useEffect(() => {
    if (!open) return;
    const dismiss = event => { if (!container.current?.contains(event.target) && !panel.current?.contains(event.target)) setOpen(false); };
    const scroll = event => { if (!panel.current?.contains(event.target)) positionPanel(); };
    const resize = positionPanel;
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', resize);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', resize); };
  }, [open, positionPanel]);

  return <div ref={container} className="vendor-multiselect" data-invalid={invalid} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    if (event.key === 'Enter' && event.target.tagName === 'INPUT') event.preventDefault();
  }}>
    <button ref={trigger} type="button" aria-label={label} aria-expanded={open} aria-controls={panelId}
      aria-invalid={invalid} aria-describedby={invalid ? 'vendor-validation-error' : undefined}
      onClick={toggle} className="vendor-multiselect-trigger">
      <span>{selected.length ? `${selected.length} selected` : `Select ${label.toLowerCase()}`}</span>
      <span aria-hidden="true">{open ? '▴' : '▾'}</span>
    </button>
    {open && createPortal(<div ref={panel} id={panelId} style={position} className="vendor-multiselect-panel" role="group" aria-label={`${label} options`}>
      <input type="search" aria-label={`Search ${label}`} placeholder="Search options…" value={search} onChange={event => setSearch(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} className="vendor-multiselect-search" />
      <div className="vendor-multiselect-options">
        {choices.filter(option => `${option.label} ${option.description || ''}`.toLowerCase().includes(search.toLowerCase())).map(option =>
          <label key={option.value} className={`vendor-multiselect-option${value.includes(option.value) ? ' is-selected' : ''}`}>
            <input type="checkbox" checked={value.includes(option.value)} onChange={event => onChange(event.target.checked ? [...value, option.value] : value.filter(item => item !== option.value))} />
            <span>{option.label}{option.description && <small>{option.description}</small>}</span>
          </label>)}
        {!choices.some(option => `${option.label} ${option.description || ''}`.toLowerCase().includes(search.toLowerCase())) && <p>No matching options.</p>}
      </div>
      <div className="vendor-multiselect-footer"><span>{value.length} selected</span><button type="button" onClick={() => { setOpen(false); trigger.current?.focus(); }}>Done</button></div>
    </div>, document.body)}
    {selected.length > 0 && <ul className="vendor-multiselect-tags" aria-label={`Selected ${label}`}>
      {selected.map(option => <li key={option.value}>
        <span>{option.label}</span>
        <button type="button" aria-label={`Remove ${option.label} from ${label}`} onClick={() => onChange(value.filter(item => item !== option.value))}>×</button>
      </li>)}
    </ul>}
  </div>;
}
