import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import apiClient from '../../services/api.service';
import { getOriginalRecommendationDocuments, getOriginalRecommendationUrl } from './recommendationSourceDocuments';

export function RequisitionRevisionHistory({ requisition }) {
  const history = requisition?.price_remarks_data?.approval_revision_history;
  if (!Array.isArray(history) || !history.length) return null;
  return <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm" aria-label="Previous approval rounds">
    <h2 className="font-semibold text-slate-900">Previous approval rounds</h2>
    {getOriginalRecommendationDocuments(requisition.attachments).map((attachment, index) => {
      const url = getOriginalRecommendationUrl(attachment);
      return url ? <a key={attachment.sha256 || index} href={url} target="_blank" rel="noopener noreferrer" className="mt-2 block text-indigo-700 underline">Previous round source: {attachment.filename || 'Original PR PDF'}</a> : null;
    })}
    {history.map((revision, index) => <details key={`${revision.round || index}-${revision.reopened_at || ''}`} className="mt-3">
      <summary className="cursor-pointer font-medium text-slate-800">Round {revision.round || index + 1}: {revision.rejection_reason || 'Rejected'}</summary>
      <p className="mt-2 text-slate-600">Previous decisions are retained as history. The revised request requires a new approval round.</p>
      <ul className="mt-2 space-y-1 text-slate-700">
        {(Array.isArray(revision.approval_workflow_config) ? revision.approval_workflow_config : []).map((stage, stageIndex) => <li key={stageIndex}>
          {stage.stage || stage.role || 'Approval stage'}: {stage.user_name || stage.approved_by_name || stage.rejected_by_name || 'Approver not recorded'} — {String(stage.status || 'pending').replaceAll('_', ' ')}
          {stage.comments || stage.rejection_reason ? <p className="whitespace-pre-wrap">{stage.comments || stage.rejection_reason}</p> : null}
        </li>)}
      </ul>
    </details>)}
  </section>;
}

RequisitionRevisionHistory.propTypes = { requisition: PropTypes.object };

export default function RejectedRequisitionRevision({ requisition, onReopened, onReloaded }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const request = useRef(null);
  useEffect(() => {
    setPending(false);
    setError('');
    setStale(false);
    return () => { request.current?.abort(); request.current = null; };
  }, [requisition.id, requisition.updated_at]);

  const run = async (reload = false) => {
    if (request.current || (!reload && (stale || !requisition.can_reopen || !requisition.updated_at))) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError('');
    try {
      const config = { signal: controller.signal, suppressErrorToast: true };
      const { data } = reload
        ? await apiClient.get(`/procurement/requisitions/${requisition.id}/`, { ...config, params: { _fresh: Date.now() } })
        : await apiClient.post(`/procurement/requisitions/${requisition.id}/reopen/`, { expected_updated_at: requisition.updated_at }, config);
      if (controller.signal.aborted) return;
      if (String(data?.id) !== String(requisition.id) || (!reload && (data.status !== 'draft' || !data.updated_at))) {
        setStale(true);
        throw new Error('The updated recommendation could not be confirmed. Reload its latest version.');
      }
      if (reload) { setStale(false); onReloaded(data); }
      else onReopened(data);
    } catch (problem) {
      if (controller.signal.aborted) return;
      if (problem.response?.status === 409) setStale(true);
      setError(problem.response?.data?.error || problem.response?.data?.detail || problem.message || 'The recommendation could not be reopened. Try again.');
    } finally {
      if (request.current === controller) { request.current = null; setPending(false); }
    }
  };

  return <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-slate-800" aria-label="Revise rejected recommendation" aria-busy={pending}>
    <h2 className="font-semibold text-amber-950">This recommendation was rejected</h2>
    <p className="mt-2 whitespace-pre-wrap"><strong>Rejection reason:</strong> {requisition.rejection_reason || 'No reason recorded.'}</p>
    {requisition.can_reopen ? <>
      <p className="mt-2">Open a draft to correct the request, then choose Send for Approval. Previous decisions stay in the approval history and all stages require approval again.</p>
      <button type="button" onClick={() => run()} disabled={pending || stale || !requisition.updated_at} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{pending && !stale ? 'Opening draft...' : 'Edit and resubmit'}</button>
    </> : <p className="mt-2">You do not have access to reopen this recommendation for editing.</p>}
    {error && <p role="alert" className="mt-3 text-red-800">{error}</p>}
    {(stale || !requisition.updated_at) && <div className="mt-3"><p>Reload and review the latest recommendation before editing.</p><button type="button" disabled={pending} className="mt-2 font-semibold underline" onClick={() => run(true)}>{pending ? 'Reloading...' : 'Reload latest version'}</button></div>}
  </section>;
}

RejectedRequisitionRevision.propTypes = {
  requisition: PropTypes.object.isRequired,
  onReopened: PropTypes.func.isRequired,
  onReloaded: PropTypes.func.isRequired,
};
