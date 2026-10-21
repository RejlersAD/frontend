import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import api from '../../../../services/specCustomizationAPI';

const button = 'rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-40';
const field = 'mt-1 block w-full rounded border border-slate-300 bg-white p-2 text-sm';
const metricFields = ['true_positive', 'false_positive', 'false_negative', 'reviewer_minutes', 'provider_cost_usd', 'import_failures'];
const errorText = err => {
  const data = err?.response?.data;
  const status = err?.response?.status;
  if (status === 404) return 'The release workflow is unavailable on the connected server. Reload the local backend with the current S3D routes, then refresh release state.';
  if (typeof data === 'string' && /<(!doctype|html)\b/i.test(data)) return `The release service returned an error page${status ? ` (HTTP ${status})` : ''}. Check the backend connection, then refresh release state.`;
  return data?.blockers?.join(' ') || data?.error || data?.detail || (data ? JSON.stringify(data) : err.message) || 'The operation failed.';
};

export default function ControlledReleasePanel({ jobId }) {
  const [state, setState] = useState(null);
  const [history, setHistory] = useState({});
  const [attempts, setAttempts] = useState([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [target, setTarget] = useState('');
  const [status, setStatus] = useState('planned');
  const [parent, setParent] = useState('');
  const [report, setReport] = useState(null);
  const [rejections, setRejections] = useState('0');
  const [notes, setNotes] = useState('');
  const [metrics, setMetrics] = useState({});
  const [groundTruth, setGroundTruth] = useState('');

  const load = useCallback(async () => {
    const [releaseState, imports, ledger] = await Promise.all([api.getReleaseState(jobId), api.listImportAttempts(jobId), api.getReleaseHistory(jobId)]);
    setState(releaseState);
    setAttempts(imports.items || []);
    setHistory(ledger);
  }, [jobId]);
  useEffect(() => {
    let active = true;
    setState(null);
    load().catch(err => { if (active) setError(errorText(err)); });
    return () => { active = false; };
  }, [load]);

  const run = async (name, action) => {
    setBusy(name); setError(''); setNotice('');
    try { await action(); await load(); setNotice(`${name} completed.`); }
    catch (err) { setError(errorText(err)); }
    finally { setBusy(''); }
  };
  const draft = state?.items?.find(item => item.state === 'draft' && item.manifest?.input_sha256 === state.current_manifest?.input_sha256);
  const frozen = state?.items?.find(item => item.state === 'frozen' && !item.invalidated && item.manifest?.input_sha256 === state.current_manifest?.input_sha256);
  const download = async kind => {
    const blob = kind === 'spec'
      ? await api.exportSmartplantSpec(jobId, { draft: false, releaseId: frozen.id })
      : await api.exportSmartplantCat(jobId, { draft: false, releaseId: frozen.id });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `RELEASED_${frozen.id}_${kind.toUpperCase()}.xlsx`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  };
  const recordAttempt = event => {
    event.preventDefault();
    const payload = new FormData();
    payload.append('release_id', frozen.id);
    payload.append('target_id', target);
    payload.append('status', status);
    payload.append('rejection_count', rejections);
    if (parent) payload.append('parent_id', parent);
    if (report) payload.append('report', report);
    payload.append('result_details', JSON.stringify({ notes }));
    payload.append('measurements', JSON.stringify({
      ...Object.fromEntries(Object.entries(metrics).filter(([, value]) => value !== '').map(([key, value]) => [key, Number(value)])),
      ...(groundTruth ? { ground_truth_reference: groundTruth } : {}),
    }));
    run('Record import attempt', () => api.recordImportAttempt(jobId, payload));
  };

  return <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-5" aria-label="Controlled release and import pilot">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">Controlled release</h2>
      <button type="button" className={button} disabled={Boolean(busy)} onClick={() => run('Refresh release state', async () => {})}>Refresh release state</button></div>
    <p className="text-sm text-slate-600">Create a draft, validate both workbooks, then freeze the reviewed inputs. Frozen SPEC/CAT files retain their original hashes. Edits require a new release cycle.</p>
    {error && <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
    {!state ? <p role="status">{error ? 'Release evidence could not be loaded.' : 'Loading release evidence…'}</p> : <>
      <p className="text-sm font-semibold">Current status: {frozen ? 'Frozen release available' : 'Draft / release required'}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} disabled={Boolean(busy)} onClick={() => run('Create release draft', () => api.createReleaseDraft(jobId))}>Create release draft</button>
        <button type="button" className={button} disabled={Boolean(busy)} onClick={() => run('Validate release', () => api.validateRelease(jobId))}>Validate both workbooks</button>
        <button type="button" className={button} disabled={Boolean(busy) || !draft || !state.can_freeze} onClick={() => run('Freeze release', () => api.freezeRelease(jobId, draft.id))}>Freeze release</button>
        {['spec', 'cat'].map(kind => <button key={kind} type="button" className={button} disabled={Boolean(busy) || !frozen} onClick={() => run(`Download released ${kind.toUpperCase()}`, () => download(kind))}>Released {kind.toUpperCase()}</button>)}
      </div>
      {state.blockers?.length > 0 && <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><h3 className="font-semibold">Release blockers</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">{state.blockers.map(item => <li key={item}>{item}</li>)}</ul></div>}
      {state.validation && <div className="space-y-2 text-sm"><h3 className="font-semibold">Latest persisted validation</h3>
        <p>Errors: {state.validation.error_count} · Findings: {state.validation.results?.issues_total || 0}</p>
        <p>{state.validation.input_sha256 === state.current_manifest?.input_sha256 ? 'Validation matches current inputs.' : 'Validation is stale. Validate again.'}</p>
        {state.validation.results?.issues?.slice(0, 10).map((issue, i) => <p key={i}>{issue.severity}: {issue.sheet_name} — {issue.message}</p>)}
      </div>}
      <details><summary className="cursor-pointer text-sm font-semibold text-blue-700">Release manifests and history</summary>
        <div className="mt-2 space-y-2">{state.items?.map(item => <div key={item.id} className="rounded border p-3 text-xs">
          <p>{item.state}{item.invalidated ? ' · invalidated by later changes' : ''} · {new Date(item.created_at).toLocaleString()}</p>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(item.manifest, null, 2)}</pre>
        </div>)}</div>
      </details>
      <details><summary className="cursor-pointer text-sm font-semibold text-blue-700">Audit and validation history</summary>
        <p className="mt-2 text-sm">{history.validations?.length || 0} validation runs</p>
        {history.events?.map(item => <p key={item.id} className="mt-1 text-xs">{new Date(item.created_at).toLocaleString()} · {item.event} · Actor {item.author ?? 'unavailable'}</p>)}
      </details>

      <div className="space-y-3 border-t pt-4"><h2 className="text-base font-semibold">Import pilot &amp; measurement</h2>
        <p className="text-sm text-slate-600">Record reports from an agreed disposable SP3D target against a current frozen release. Uploading a report records supplied evidence; it does not run SP3D. Accuracy counts require ground truth. No public accuracy percentages are published here.</p>
        {!frozen && <p className="text-sm text-amber-900">Freeze a current release before recording an import attempt.</p>}
        {!state.pilot_targets?.length && <p className="text-sm text-amber-900">The disposable SP3D target, version and import profile are not configured.</p>}
        <form onSubmit={recordAttempt} className="space-y-3">
          <fieldset disabled={Boolean(busy) || !frozen || !state.pilot_targets?.length} className="space-y-3 disabled:opacity-50">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">Disposable target<select required value={target} onChange={e => setTarget(e.target.value)} className={field}><option value="">Select a target</option>{state.pilot_targets?.map(item => <option key={item.id} value={item.id}>{item.label || item.id} · {item.sp3d_version} · {item.import_profile}</option>)}</select></label>
              <label className="text-sm">Import result<select value={status} onChange={e => setStatus(e.target.value)} className={field}>{['planned', 'succeeded', 'failed', 'reconciled'].map(value => <option key={value}>{value}</option>)}</select></label>
              <label className="text-sm">Earlier attempt<select required={status === 'reconciled'} value={parent} onChange={e => setParent(e.target.value)} className={field}><option value="">New attempt</option>{attempts.filter(item => item.release_id === frozen?.id && item.status !== 'reconciled').map(item => <option key={item.id} value={item.id}>{item.status} · {item.id}</option>)}</select></label>
              <label className="text-sm">Rejection count<input required type="number" min="0" step="1" value={rejections} onChange={e => setRejections(e.target.value)} className={field} /></label>
            </div>
            <label className="block text-sm">Target report<input type="file" required={status !== 'planned'} onChange={e => setReport(e.target.files[0] || null)} className={field} /></label>
            <label className="block text-sm">Result / reconciliation notes<textarea value={notes} onChange={e => setNotes(e.target.value)} className={field} /></label>
            <details><summary className="cursor-pointer text-sm font-semibold">Record benchmark evidence</summary>
              <label className="mt-3 block text-sm">Ground-truth reference<input value={groundTruth} maxLength={512} onChange={e => setGroundTruth(e.target.value)} className={field} /></label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">{metricFields.map(key => <label key={key} className="text-sm">{key.replaceAll('_', ' ')}<input type="number" min="0" step={key.includes('minutes') || key.includes('usd') ? 'any' : '1'} value={metrics[key] || ''} onChange={e => setMetrics(value => ({ ...value, [key]: e.target.value }))} className={field} /></label>)}</div>
            </details>
            <button className={button}>Record import attempt</button>
          </fieldset>
        </form>
        {attempts.map(item => <article key={item.id} className="space-y-1 rounded border p-3 text-sm"><h3 className="font-semibold">{item.status} · {item.sp3d_version} · {item.import_profile}</h3>
          <p>Rejected: {item.rejection_count} · Target: {item.disposable_target}</p>
          <p className="break-all text-xs">Report: {item.report_name || 'not recorded'} · SHA-256: {item.report_sha256 || 'not available'}</p>
          <pre className="overflow-auto text-xs">{JSON.stringify(item.measurements, null, 2)}</pre>
        </article>)}
      </div>
    </>}
  </section>;
}

ControlledReleasePanel.propTypes = { jobId: PropTypes.string.isRequired };
