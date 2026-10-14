import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import salesService from '../../services/sales.service';
import { loadPreparationOpportunities } from './salesProposalDraft';

export default function SalesProposalOpportunitySelector({ value, selected, busy, onChange }) {
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [refresh, setRefresh] = useState(0);
  const current = useRef(null); current.current = { value, onChange };
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setLoading(true); setError(''); setRows([]); current.current.onChange(current.current.value, null);
    loadPreparationOpportunities(params => salesService.getPreparationOpportunities({ ...params, pending_only: false }, { signal: controller.signal })).then(items => {
      if (!active) return;
      setRows(items);
      const id = current.current.value;
      current.current.onChange(id, items.find(row => String(row.id) === String(id)) || null);
    }).catch(failure => { if (active) setError(failure?.response?.data?.detail || failure.message || 'Opportunity choices are unavailable. Retry loading.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [refresh]);
  return <div className="sm:col-span-2">
    <label className="block text-sm font-semibold text-slate-700">Qualified opportunity<span className="ml-1 text-rose-600">*</span>
      <select required value={value || ''} disabled={loading || busy || Boolean(error)} onChange={event => onChange(event.target.value, rows.find(row => String(row.id) === event.target.value) || null)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
        <option value="">{loading ? 'Loading opportunities…' : 'Select opportunity…'}</option>
        {value && !rows.some(row => String(row.id) === String(value)) && <option value={value} disabled>Selected opportunity unavailable</option>}
        {rows.map(row => <option key={row.id} value={row.id} disabled={!row.can_create_proposal}>{row.deal_code} – {row.deal_name} · {row.client_name}{!row.can_create_proposal ? ` (${row.blocked_reason || 'Unavailable'})` : ''}</option>)}
      </select>
    </label>
    {loading && <p className="mt-1 text-xs text-slate-600" role="status">Loading current opportunity eligibility…</p>}
    {error && <p className="mt-2 text-sm text-rose-800" role="alert">{error}</p>}
    {!loading && !error && !rows.length && <p className="mt-1 text-sm text-slate-600">No opportunities with a Go decision are available in your current access.</p>}
    {!loading && value && !selected?.can_create_proposal && <p className="mt-1 text-sm text-amber-900">{selected?.blocked_reason || 'This opportunity is no longer available for proposal creation. Choose another opportunity or refresh.'}</p>}
    <button type="button" disabled={loading || busy} onClick={() => setRefresh(count => count + 1)} className="mt-1 text-xs text-violet-700 underline">{error ? 'Retry opportunities' : 'Refresh opportunities'}</button>
  </div>;
}
SalesProposalOpportunitySelector.propTypes = { value: PropTypes.string, selected: PropTypes.object, busy: PropTypes.bool, onChange: PropTypes.func.isRequired };
