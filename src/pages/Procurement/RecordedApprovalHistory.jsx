import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import { getOriginalRecommendationDocuments, getOriginalRecommendationUrl } from './recommendationSourceDocuments';

const approved = row => row.signature_verified === true
  || (row.signature_verified !== false && String(row.status).toLowerCase() === 'approved');
const approverName = row => row.approved_by_name || row.rejected_by_name || row.user_name || row.approver_name || '';
const sourceRow = row => row?.external === true && row.source === 'signed_purchase_requisition_pdf';
const errorText = value => Array.isArray(value) ? value.map(errorText).join(' ')
  : value && typeof value === 'object' ? Object.values(value).map(errorText).join(' ') : String(value || '');

export default function RecordedApprovalHistory({ requisition, expectedUpdatedAt, disabled = false, onSaved, onStaleRecord, onEditingChange, hidePendingAssignments = false }) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [reviewSnapshot, setReviewSnapshot] = useState(null);
  const [draft, setDraft] = useState({ name: '', date: '', verified: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const verification = requisition?.price_remarks_data?.signed_document_verification || {};
  const sourceRows = Array.isArray(verification.source_approval_rows) ? verification.source_approval_rows : [];
  const workflow = Array.isArray(requisition?.approval_workflow_config) ? requisition.approval_workflow_config : [];
  const useSourceRows = sourceRows.length > 0 && (!workflow.length || workflow.every(sourceRow));
  const rejectedSourceHistory = sourceRows.some(row => ['rejected', 'not_approved', 'declined', 'denied', 'cancelled'].includes(String(row?.status).toLowerCase()));
  const rows = useSourceRows ? sourceRows : workflow;
  const original = getOriginalRecommendationDocuments(requisition?.attachments)
    .find(document => document.sha256 === verification.document_sha256);
  const originalUrl = getOriginalRecommendationUrl(original);

  useEffect(() => {
    onEditingChange(editingIndex !== null);
    return () => onEditingChange(false);
  }, [editingIndex, onEditingChange]);

  const edit = (row, index) => {
    setReviewSnapshot({ documentSha: verification.document_sha256, row: JSON.parse(JSON.stringify(row)), expectedUpdatedAt });
    setDraft({ name: approverName(row), date: String(row.approved_at || verification.approval_date || '').slice(0, 10), verified: approved(row) });
    setEditingIndex(index);
    setError('');
    setNotice('');
  };

  const save = async () => {
    if (saving || disabled) return;
    const confirmingSignature = draft.verified && !approved(reviewSnapshot.row);
    if (!draft.name.trim()) {
      setError('Enter the approver name shown on the original PDF.');
      return;
    }
    if (confirmingSignature && !draft.date) {
      setError('Enter the approval date shown on the original PDF.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await apiClient.post(`/procurement/requisitions/${requisition.id}/source-approvals/`, {
        document_sha256: reviewSnapshot.documentSha,
        row_index: editingIndex,
        expected_row: reviewSnapshot.row,
        ...(reviewSnapshot.expectedUpdatedAt !== undefined ? { expected_updated_at: reviewSnapshot.expectedUpdatedAt } : {}),
        approver_name: draft.name.trim(),
        signature_verified: confirmingSignature,
        approval_date: confirmingSignature ? draft.date : '',
      }, { suppressErrorToast: true });
      onSaved(response.data);
      setEditingIndex(null);
      setNotice(draft.verified ? 'Approval record saved.' : 'Approver name saved. Signature remains unverified.');
    } catch (saveError) {
      if (saveError.response?.status === 409 && saveError.response?.data?.code === 'stale_requisition') {
        onStaleRecord?.(saveError.response.data.error);
      }
      setError(errorText(saveError.response?.data) || 'Approval record could not be saved. Please retry.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="space-y-3" aria-label="Recorded approval history">
    {rows.length ? rows.map((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
      if (hidePendingAssignments && !useSourceRows && row.reassignment_snapshot) return null;
      const role = row.role || row.stage || 'Approval';
      const editable = useSourceRows && !rejectedSourceHistory && sourceRow(row) && original && verification.document_sha256
        && (!String(row.user_name || '').trim() || !approved(row));
      const editing = editingIndex === index;
      return <div key={`${role}-${index}`} className="border-b border-gray-200 pb-2 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span><strong>{role}</strong> · {approverName(row) || 'Approver not recorded'}</span>
            {editable && <button type="button" aria-label={`Edit ${role} approval record`} title={`Edit ${role} approval record`}
              disabled={disabled || saving || editingIndex !== null} onClick={() => edit(row, index)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-blue-200 text-blue-700 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50">
              <PencilSquareIcon className="h-4 w-4" />
            </button>}
          </div>
          <span>{String(row.status || 'not recorded').replaceAll('_', ' ')}{row.approved_at ? ` · ${String(row.approved_at).slice(0, 10)}` : ''}</span>
        </div>
        {editing && <div className="mt-3 space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3" role="group" aria-label={`Edit ${role} approval record`}>
          {originalUrl && <a href={originalUrl} target="_blank" rel="noreferrer" className="inline-flex text-sm font-medium text-blue-700 underline">Open original PDF</a>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">Approver name
              <input autoFocus value={draft.name} maxLength={200} disabled={saving} onChange={event => setDraft(previous => ({ ...previous, name: event.target.value }))}
                className="mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Approval date
              <input type="date" value={draft.date} disabled={saving || !draft.verified || approved(row)} onChange={event => setDraft(previous => ({ ...previous, date: event.target.value }))}
                className="mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100" />
            </label>
          </div>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={draft.verified} disabled={saving || approved(row)} onChange={event => setDraft(previous => ({ ...previous, verified: event.target.checked }))} className="mt-0.5 h-4 w-4 shrink-0" />
            I verified this signature on the original PDF
          </label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="prf-button prf-primary" disabled={saving || disabled} onClick={save}>{saving ? 'Saving approval record…' : 'Save approval record'}</button>
            <button type="button" className="prf-button" aria-label="Cancel approval edit" disabled={saving} onClick={() => { setEditingIndex(null); setError(''); }}>Cancel</button>
          </div>
        </div>}
      </div>;
    }) : <p className="text-sm text-gray-600">No approval history recorded.</p>}
    {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
  </div>;
}

RecordedApprovalHistory.propTypes = {
  requisition: PropTypes.object.isRequired,
  expectedUpdatedAt: PropTypes.string,
  disabled: PropTypes.bool,
  onSaved: PropTypes.func.isRequired,
  onStaleRecord: PropTypes.func,
  onEditingChange: PropTypes.func.isRequired,
  hidePendingAssignments: PropTypes.bool,
};
