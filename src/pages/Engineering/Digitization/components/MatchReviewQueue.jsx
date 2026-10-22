import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import specCustomizationAPI from '../../../../services/specCustomizationAPI';
import { codelistLabel } from '../../../../services/buhasaCodelists';
import S3DCandidateDiffs from './S3DCandidateDiffs';
import BuhasaPropertySelect from './BuhasaPropertySelect';

const STATES = ['ambiguous', 'unmatched', 'ineligible', 'invalid_reference', 'unique_match'];
const label = value => value.replaceAll('_', ' ');
const message = err => err?.response?.data?.error || err?.response?.data?.detail || err.message || 'Matching request failed.';

export default function MatchReviewQueue({ jobId, revision = 0 }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [selection, setSelection] = useState({});
  const [remap, setRemap] = useState(null);
  const [code, setCode] = useState('');
  const [editingAttribute, setEditingAttribute] = useState('');
  const dialog = useRef(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await specCustomizationAPI.listMatchDecisions({ job: jobId });
      setItems(data.items || []);
    } catch (err) { setError(message(err)); }
    finally { setLoading(false); }
  }, [jobId]);
  useEffect(() => { load(); }, [load, revision]);
  useEffect(() => {
    if (remap) dialog.current?.showModal();
  }, [remap]);

  const review = async (item, action, finalCode = '') => {
    setBusy(item.id);
    setError('');
    try {
      const updated = await specCustomizationAPI.reviewMatchDecision({
        decision_id: item.id, review_decision: action, final_commodity_code: finalCode,
        ...(item.discriminators_matched?.codelists ? { candidate_id: selection[item.id] || item.candidates?.[0]?.candidate_id } : {}),
      });
      setItems(current => current.map(row => row.id === updated.id ? updated : row));
      if (remap) { dialog.current?.close(); setRemap(null); }
    } catch (err) { setError(message(err)); }
    finally { setBusy(''); }
  };

  const normalize = async (item, category, entry) => {
    setBusy(item.id);
    setError('');
    try {
      const updated = await specCustomizationAPI.reviewMatchDecision({ decision_id: item.id, review_decision: 'normalized',
        codelist_selections: { [category]: entry } });
      setItems(current => current.map(row => row.id === updated.id ? updated : row));
      setSelection(current => ({ ...current, [item.id]: '' }));
      setEditingAttribute('');
    } catch (err) { setError(message(err)); throw err; }
    finally { setBusy(''); }
  };

  const selectedCandidate = item => item.candidates?.find(candidate => (candidate.candidate_id || candidate.commodity_code) === selection[item.id]);
  const finalCode = item => selectedCandidate(item)?.commodity_code || item.matched_commodity_code;
  const unresolved = item => Object.values(item.discriminators_matched?.codelists?.attributes || {}).some(value => ['UNMAPPED_CODELIST', 'AMBIGUOUS'].includes(value.status));

  return <section aria-label="Match review queue" className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-semibold">Match review queue</h2>
      <button type="button" onClick={load} disabled={loading || Boolean(busy)} className="text-sm font-semibold text-blue-700">Refresh decisions</button>
    </div>
    <p className="text-sm text-slate-600">Ambiguous matches require an explicit candidate selection. Ranking scores are aids for review, not probabilities. Review does not issue a released specification.</p>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    <label className="block text-sm">Match state
      <select value={filter} onChange={event => setFilter(event.target.value)} className="ml-3 rounded border border-slate-300 p-2">
        <option value="">All states</option>
        {STATES.map(state => <option key={state} value={state}>{label(state)}</option>)}
      </select>
    </label>
    {loading ? <p role="status">Loading decisions…</p> : <>
      <p role="status" className="text-sm text-slate-600">{items.length} decisions · {items.filter(item => item.review_decision).length} reviewed</p>
      {!items.length && <p className="text-sm text-slate-600">No decisions yet. Run matching against the active reference set.</p>}
      {items.filter(item => !filter || item.state === filter).map(item => <article key={item.id} className="space-y-3 rounded border border-slate-200 p-4">
        <h3 className="font-semibold">{item.pdf_component_name} <span className="text-sm font-normal text-slate-600">· {label(item.state)}</span></h3>
        <p className="text-sm text-slate-600">Size: {item.nominal_size || 'unspecified'} · Rating: {item.pressure_rating || 'unspecified'} · Material: {item.material_grade || 'unspecified'}</p>
        <p className="text-sm text-slate-600">Subtype: {item.sub_type || 'unspecified'} · Connection: {item.end_connection || 'unspecified'}</p>
        {item.discriminators_matched?.reason && <p className="text-sm text-amber-800">{item.discriminators_matched.reason}</p>}
        {item.discriminators_matched?.codelists && <fieldset disabled={Boolean(busy)} className="space-y-2 rounded border border-slate-200 p-3">
          <legend className="text-sm font-semibold">BUHASA codelist values</legend>
          {Object.entries(item.discriminators_matched.codelists.attributes).map(([category, value]) => <div key={category} className="text-sm">
            <p>{category}: {value.shortDesc ? `${value.shortDesc} (${value.code})` : value.raw || 'Not supplied'} · {value.status}</p>
            {value.status === 'AMBIGUOUS' && <p className="text-amber-800">Candidates: {value.candidates.map(codelistLabel).join('; ')}</p>}
            <button type="button" onClick={() => setEditingAttribute(`${item.id}:${category}`)} className="text-blue-700">Choose canonical {category}</button>
            {editingAttribute === `${item.id}:${category}` && <BuhasaPropertySelect id={`canonical-${item.id}-${category}`} label={`Canonical ${category} for ${item.pdf_component_name}`} category={category}
              value={value.raw} entry={value.status === 'RESOLVED' ? value.candidates?.[0] : null} disabled={Boolean(busy)} onSelect={entry => normalize(item, category, entry)} />}
          </div>)}
          {item.discriminators_matched.codelists.differences?.map(difference => <p key={difference} className="text-sm text-amber-800">{difference}</p>)}
          {unresolved(item) && <p className="text-sm text-rose-700">Controlled release is blocked until all supplied codelist values are resolved.</p>}
        </fieldset>}
        <p className="text-sm" aria-live="polite">Review: {item.review_decision || 'pending'}{item.final_commodity_code ? ` · ${item.final_commodity_code}` : ''}</p>
        {item.candidates?.length > 0 && <>
          <label className="block text-sm">Candidate for {item.pdf_component_name}
            <select value={selection[item.id] || ''} onChange={event => setSelection(current => ({ ...current, [item.id]: event.target.value }))} className="ml-2 max-w-full rounded border border-slate-300 p-2">
              <option value="">Select a commodity</option>
              {item.candidates.map((candidate, index) => <option key={candidate.candidate_id || `${candidate.commodity_code}-${index}`} value={candidate.candidate_id || candidate.commodity_code}>{candidate.commodity_code}{candidate.codelists ? ` · ${Object.entries(candidate.codelists).filter(([, value]) => value.values.length).map(([category, value]) => `${category}: ${value.values.join('/')}`).join(' · ')}` : ''}</option>)}
            </select>
          </label>
          <details className="text-sm"><summary className="cursor-pointer text-blue-700">Candidate evidence</summary>
            {item.candidates.map((candidate, index) => <div key={`${candidate.commodity_code}-${index}`} className="mt-2 border-t p-2">
              <p className="font-semibold">{candidate.commodity_code} · {candidate.description}</p>
              <p>Ranking score: {candidate.ranking_score}</p>
              <S3DCandidateDiffs candidate={candidate} attributes={item.discriminators_matched?.codelists?.attributes || {}} />
              {candidate.codelists && Object.entries(candidate.codelists).map(([category, value]) => <p key={category}>{category}: {value.values.join(', ') || 'missing'} · Codes: {value.codes.join(', ') || 'unmapped'}</p>)}
              {Object.entries(candidate.discriminators || {}).map(([key, value]) => <p key={key}>{label(key)}: {value.values?.join(', ') || 'missing'} · {value.matched === null ? 'not supplied' : value.matched ? 'matched' : 'different'}</p>)}
            </div>)}
          </details>
        </>}
        <div className="flex gap-3 text-sm font-semibold">
          <button type="button" disabled={Boolean(busy) || unresolved(item) || !['unique_match', 'ambiguous'].includes(item.state) || !finalCode(item)} onClick={() => review(item, 'approved', finalCode(item))} className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-40">Approve</button>
          <button type="button" disabled={Boolean(busy)} onClick={() => review(item, 'rejected')} className="rounded border border-slate-300 px-3 py-2 disabled:opacity-40">Reject</button>
          <button type="button" disabled={Boolean(busy) || unresolved(item)} onClick={() => { setCode(''); setRemap(item); }} className="rounded border border-slate-300 px-3 py-2 disabled:opacity-40">Remap</button>
        </div>
      </article>)}
    </>}
    <dialog ref={dialog} onCancel={() => setRemap(null)} aria-labelledby="remap-title" className="w-full max-w-lg rounded-lg p-6 shadow-xl backdrop:bg-slate-900/40">
      <form onSubmit={event => { event.preventDefault(); review(remap, 'remapped', code.trim()); }} className="space-y-4">
        <h2 id="remap-title" className="font-semibold">Select commodity code</h2>
        <p className="text-sm text-slate-600">Enter a code from the pinned reference catalog. The server verifies it before saving.</p>
        <label className="block text-sm">Commodity code<input required value={code} maxLength={128} onChange={event => setCode(event.target.value)} list="remap-codes" className="mt-1 block w-full rounded border p-2" /></label>
        <datalist id="remap-codes">{remap?.candidates?.map((candidate, i) => <option key={i} value={candidate.commodity_code} />)}</datalist>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <div className="flex gap-3"><button disabled={Boolean(busy) || !code.trim()} className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-40">Save remap</button>
          <button type="button" disabled={Boolean(busy)} onClick={() => { dialog.current.close(); setRemap(null); }} className="rounded border px-3 py-2">Cancel</button></div>
      </form>
    </dialog>
  </section>;
}

MatchReviewQueue.propTypes = { jobId: PropTypes.string.isRequired, revision: PropTypes.number };
