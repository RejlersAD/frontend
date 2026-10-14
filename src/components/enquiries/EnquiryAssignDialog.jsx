/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowPathIcon, InformationCircleIcon, MagnifyingGlassIcon, UserPlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import apiService from '../../services/api.service';

const identity = value => value === null || value === undefined ? '' : String(value);
const personName = person => person?.name || person?.email || 'Name not recorded';
const errorMessage = (error, fallback) => {
  const response = error?.response?.data;
  const message = response?.detail || response?.message || response?.assigned_to;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.filter(value => typeof value === 'string').join(' ') || fallback;
  if (error?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  return error?.message || fallback;
};

export default function EnquiryAssignDialog({ item, onClose, onAssigned }) {
  const dialog = useRef(null);
  const searchInput = useRef(null);
  const mounted = useRef(false);
  const savingRef = useRef(false);
  const currentItemId = useRef(item?.id);
  currentItemId.current = item?.id;
  const currentId = identity(item?.assigned_to?.id);
  const [selectedId, setSelectedId] = useState(currentId);
  const [representatives, setRepresentatives] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [directoryError, setDirectoryError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    mounted.current = true;
    const opener = document.activeElement;
    const node = dialog.current;
    if (node && !node.open) node.showModal();
    searchInput.current?.focus();
    return () => {
      mounted.current = false;
      if (node?.open) node.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setDirectoryError('');
    apiService.get('/enquiry/representatives/', { signal: controller.signal, timeout: 15000 })
      .then(({ data }) => {
        if (!Array.isArray(data?.results)) throw new Error('The representative list could not be read.');
        if (!mounted.current || controller.signal.aborted) return;
        const unique = new Map();
        data.results.forEach(person => {
          if (person && typeof person === 'object' && !Array.isArray(person)
            && identity(person.id) && person.is_active !== false) unique.set(identity(person.id), person);
        });
        setRepresentatives([...unique.values()].sort((a, b) => personName(a).localeCompare(personName(b))));
      })
      .catch(error => {
        if (mounted.current && !controller.signal.aborted) setDirectoryError(errorMessage(error, 'Could not load representatives.'));
      })
      .finally(() => {
        if (mounted.current && !controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return representatives.filter(person => !term || [person.name, person.email, person.department, person.job_title]
      .some(value => String(value || '').toLowerCase().includes(term)));
  }, [representatives, search]);
  const selected = representatives.find(person => identity(person.id) === selectedId);
  const selectedOutsideSearch = selected && !filtered.some(person => identity(person.id) === selectedId);
  const missingCurrent = currentId && !representatives.some(person => identity(person.id) === currentId);
  const changed = selectedId !== currentId;
  const validSelection = selectedId === '' || Boolean(selected);
  const canSave = item?.id !== null && item?.id !== undefined && changed && validSelection && !loading && !directoryError && !saving;
  const close = () => { if (!savingRef.current) onClose?.(); };

  const containFocus = event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')];
    const first = controls[0];
    const last = controls.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const save = async event => {
    event.preventDefault();
    if (!canSave || savingRef.current) return;
    const requestId = item.id;
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    let updated;
    try {
      const { data } = await apiService.patch(`/enquiry/${encodeURIComponent(requestId)}/`, {
        assigned_to: selectedId === '' ? null : selected.id,
      });
      if (!data?.enquiry || identity(data.enquiry.id) !== identity(requestId) || data.success === false) {
        throw new Error('The server did not return this enquiry. Refresh its details before retrying.');
      }
      updated = data.enquiry;
    } catch (error) {
      if (mounted.current) setSaveError(errorMessage(error, 'Could not save the assignment.'));
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
    if (updated && mounted.current && identity(currentItemId.current) === identity(requestId)) {
      try { onAssigned?.(updated); } finally { onClose?.(); }
    }
  };

  return <dialog ref={dialog} className="eop-assign-dialog" aria-labelledby="eop-assign-title" aria-describedby="eop-assign-reference"
    aria-busy={saving} data-testid="enquiry-assign-dialog" onKeyDown={containFocus}
    onCancel={event => { event.preventDefault(); close(); }}>
    <header className="eop-assign-header"><span className="eop-assign-icon" aria-hidden="true"><UserPlusIcon /></span>
      <div><h2 id="eop-assign-title">Assign enquiry</h2><p id="eop-assign-reference" className="eop-assign-reference">{item?.reference || 'Reference not recorded'}</p></div>
      <button type="button" className="eop-assign-close" aria-label="Close assignment dialog" disabled={saving} onClick={close}><XMarkIcon aria-hidden="true" /></button>
    </header>
    <form className="eop-assign-form" onSubmit={save}>
      <p className="eop-assign-current">Current owner: <strong>{item?.assigned_to ? personName(item.assigned_to) : 'Unassigned'}</strong></p>
      <label className="eop-assign-search"><span>Search representatives</span><span className="eop-assign-search-field"><MagnifyingGlassIcon aria-hidden="true" />
        <input ref={searchInput} type="search" aria-label="Search representatives" value={search} onChange={event => setSearch(event.target.value)} disabled={saving}
          placeholder="Search name, department or email" />
      </span></label>
      {loading && <p className="eop-assign-loading" role="status"><ArrowPathIcon aria-hidden="true" />Loading representatives…</p>}
      {directoryError && <div className="eop-assign-error" role="alert"><InformationCircleIcon aria-hidden="true" /><p>{directoryError}</p>
        <button type="button" className="eop-button" disabled={saving || loading} onClick={() => setRetry(value => value + 1)}>Retry representatives</button>
      </div>}
      <label className="eop-assign-owner"><span>New owner</span><select aria-label="New owner" value={selectedId} disabled={loading || Boolean(directoryError) || saving}
        onChange={event => { setSelectedId(event.target.value); setSaveError(''); }}>
        <option value="">Unassigned</option>
        {missingCurrent && <option value={currentId} disabled>{personName(item.assigned_to)} (current owner — not listed)</option>}
        {selectedOutsideSearch && <option value={selectedId}>{personName(selected)} (selected)</option>}
        {filtered.map(person => <option key={identity(person.id)} value={identity(person.id)}>
          {personName(person)}{person.department ? ` · ${person.department}` : ''}
        </option>)}
      </select></label>
      {!loading && !directoryError && <p className="eop-assign-count">{filtered.length} {filtered.length === 1 ? 'representative' : 'representatives'} match{filtered.length === 1 ? 'es' : ''}{selectedOutsideSearch ? ' · Selected owner retained' : ''}</p>}
      {!loading && !directoryError && !filtered.length && <p className="eop-assign-empty">{representatives.length ? 'No representatives match this search.' : 'No active representatives are available.'}</p>}
      {selected && <div className="eop-assign-owner-detail"><strong>{personName(selected)}</strong>
        {[selected.job_title, selected.department, selected.email].filter(Boolean).map((value, index) => <span key={`${index}-${value}`}>{value}</span>)}
      </div>}
      {saveError && <p className="eop-assign-error" role="alert">{saveError}</p>}
      <footer className="eop-assign-footer"><button type="button" className="eop-button" disabled={saving} onClick={close}>Cancel</button>
        <button type="submit" className="eop-button eop-button--primary" disabled={!canSave}>{saving ? 'Saving…' : 'Save assignment'}</button>
      </footer>
    </form>
  </dialog>;
}
