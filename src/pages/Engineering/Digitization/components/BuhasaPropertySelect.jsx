import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { codelistLabel, codelistOptions, resolveBuhasaAttribute } from '../../../../services/buhasaCodelists';

export default function BuhasaPropertySelect({ id, label, category, value, entry, disabled, onSelect }) {
  const listId = useId();
  const host = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const [saving, setSaving] = useState(false);
  const display = entry ? `${entry.shortDesc} (${entry.code})` : value || '';
  const options = useMemo(() => codelistOptions(category).map((item, index) => ({ item, index, label: codelistLabel(item) })), [category]);
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    const aliases = resolveBuhasaAttribute(category, query).candidates;
    return options.filter(option => option.label.toLowerCase().includes(search) || option.item.longDesc.toLowerCase().includes(search)
      || aliases.some(entry => entry.code === option.item.code && entry.shortDesc === option.item.shortDesc && JSON.stringify(entry.parents || []) === JSON.stringify(option.item.parents || [])));
  }, [options, query, category]);
  const visible = filtered.slice(0, 80);
  useEffect(() => { if (open && active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [active, open, listId]);
  const close = () => { setOpen(false); setQuery(''); setActive(-1); };
  const choose = async option => {
    if (!option || saving || disabled) return;
    setSaving(true);
    try { await onSelect(option.item); close(); }
    catch { /* The workspace reports the server failure; retain the search. */ }
    finally { setSaving(false); }
  };
  return <div className="s3d-codelist-select" ref={host} onBlur={event => { if (!host.current?.contains(event.relatedTarget)) close(); }}>
    <input id={id} role="combobox" aria-label={label} aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
      aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined} autoComplete="off"
      disabled={disabled || saving} value={open ? query : display} placeholder={open ? 'Search label or code…' : 'Choose a canonical value'}
      onFocus={() => { setOpen(true); setQuery(''); setActive(-1); }} onClick={() => setOpen(true)}
      onChange={event => { setOpen(true); setQuery(event.target.value); setActive(-1); }}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(); }
        if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
          event.preventDefault(); event.stopPropagation(); setOpen(true);
          setActive(previous => Math.max(0, Math.min(visible.length - 1, previous + (event.key === 'ArrowDown' ? 1 : -1))));
        }
        if (event.key === 'Enter') {
          event.preventDefault(); event.stopPropagation();
          if (open && active >= 0) void choose(visible[active]);
          else if (open && filtered.length === 1) void choose(filtered[0]);
        }
      }} />
    {open && !disabled && <div className="s3d-codelist-popup">
      <div id={listId} role="listbox" aria-label={`${label} codelist values`}>
        {visible.map((option, index) => <div role="option" id={`${listId}-${index}`} aria-selected={active === index} key={option.index}
          onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => void choose(option)}>{option.label}</div>)}
      </div>
      <small role="status">{filtered.length ? `${Math.min(80, filtered.length)} of ${filtered.length} values. Select an option to save.` : 'No canonical values found. Search text cannot be saved.'}</small>
    </div>}
  </div>;
}
BuhasaPropertySelect.propTypes = { id: PropTypes.string.isRequired, label: PropTypes.string.isRequired, category: PropTypes.string.isRequired,
  value: PropTypes.string, entry: PropTypes.object, disabled: PropTypes.bool, onSelect: PropTypes.func.isRequired };
