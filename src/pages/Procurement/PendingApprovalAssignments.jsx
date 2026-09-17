import React, { useState } from 'react';
import PropTypes from 'prop-types';

const employeeName = employee => employee?.full_name || [employee?.first_name, employee?.last_name].filter(Boolean).join(' ') || employee?.username || employee?.email || 'Selected employee';
const stageName = stage => stage.role || stage.stage || stage.approval_label || 'Approval';

export function approvalReassignmentCommands(assignments) {
  return Object.values(assignments).map(({ snapshot, employee }) => ({ ...snapshot, user_id: employee.id }));
}

export function retainCurrentApprovalAssignments(assignments, requisition) {
  if (!requisition.can_reassign_approvers) return {};
  const workflow = Array.isArray(requisition.approval_workflow_config) ? requisition.approval_workflow_config : [];
  return Object.fromEntries(Object.values(assignments).flatMap(assignment => {
    const index = workflow.findIndex(stage => stage?.reassignment_snapshot && Object.entries(assignment.snapshot)
      .every(([key, value]) => JSON.stringify(stage.reassignment_snapshot[key]) === JSON.stringify(value)));
    return index < 0 ? [] : [[index, assignment]];
  }));
}

export default function PendingApprovalAssignments({ requisition, assignments, employees, loading, error, disabled, onChange, onRetry }) {
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const workflow = Array.isArray(requisition.approval_workflow_config) ? requisition.approval_workflow_config : [];
  const stages = workflow.map((stage, index) => ({ stage, index }))
    .filter(({ stage }) => stage?.reassignment_snapshot);
  if (!requisition.can_reassign_approvers || !stages.length) return null;
  const matches = employees.filter(employee => [employeeName(employee), employee.email, employee.employee_id, employee.job_title, employee.department]
    .filter(Boolean).join(' ').toLowerCase().includes(search.trim().toLowerCase())).slice(0, 20);
  const select = (index, stage, employee) => {
    const snapshot = stage.reassignment_snapshot;
    const sameId = String(snapshot.expected_user_id ?? '') === String(employee.id);
    const sameEmail = !snapshot.expected_user_email || String(snapshot.expected_user_email).toLowerCase() === String(employee.email || '').toLowerCase();
    onChange(index, sameId && sameEmail ? null : { snapshot, employee });
    setEditing(null);
    setSearch('');
  };

  return <section aria-label="Pending approvers" className="mt-5 space-y-3 border-t border-gray-200 pt-4">
    <div><h3 className="text-base font-semibold text-gray-900">Pending approvers</h3>
      <p className="mt-1 text-sm text-gray-600">Change who receives the remaining approvals, then select Save changes. Completed approvals and original PDF evidence stay in the recorded history.</p></div>
    {error && <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error} <button type="button" onClick={onRetry} disabled={disabled || loading} className="font-semibold underline">Retry approvers</button></div>}
    {stages.map(({ stage, index }) => {
      const role = stageName(stage);
      const pending = assignments[index];
      const currentName = stage.user_name || stage.approver_name || stage.approved_by_name || 'No approver assigned';
      return <div key={index} role="group" aria-label={`${role} assignment`} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-sm font-semibold text-gray-900">{role}</p><p className="text-sm text-gray-700">{pending ? employeeName(pending.employee) : currentName}</p>
            {pending && <p className="mt-1 text-xs text-amber-700">Unsaved reassignment from {currentName}</p>}</div>
          <div className="flex items-center gap-3">
            {pending && <button type="button" disabled={disabled} onClick={() => onChange(index, null)} className="text-xs font-semibold text-gray-600 underline">Undo change</button>}
            <button type="button" aria-label={`Change ${role} approver`} disabled={disabled || loading || Boolean(error)} onClick={() => { setEditing(index); setSearch(''); }} className="prf-button">Change approver</button>
          </div>
        </div>
        {(stage.external || stage.source === 'signed_purchase_requisition_pdf') && <p className="mt-2 text-xs text-gray-600">Reassigning this unrecorded source row starts an internal approval. It does not verify a signature on the PDF.</p>}
        {editing === index && <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700">Search approver for {role}
            <input autoFocus aria-label={`Search approver for ${role}`} value={search} onChange={event => setSearch(event.target.value)} disabled={disabled || loading}
              placeholder="Name, email, employee ID or department" className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm" />
          </label>
          {search.trim() && <div className="mt-1 max-h-52 overflow-auto rounded border border-gray-200 bg-white">
            {matches.length ? matches.map(employee => <button key={employee.id} type="button" disabled={disabled} onClick={() => select(index, stage, employee)} className="block w-full border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-purple-50 last:border-0">
              <span className="block font-semibold">{employeeName(employee)}</span><span className="block text-xs text-gray-500">{employee.job_title || employee.department || employee.email}</span>
            </button>) : <p className="p-3 text-sm text-gray-500">No active employee matches this search.</p>}
          </div>}
          <button type="button" onClick={() => { setEditing(null); setSearch(''); }} className="mt-2 text-xs font-semibold text-gray-600 underline">Cancel selection</button>
        </div>}
      </div>;
    })}
    {loading && <p role="status" className="text-sm text-gray-600">Loading active approvers…</p>}
  </section>;
}

PendingApprovalAssignments.propTypes = {
  requisition: PropTypes.object.isRequired, assignments: PropTypes.object.isRequired,
  employees: PropTypes.arrayOf(PropTypes.object).isRequired, loading: PropTypes.bool, error: PropTypes.string,
  disabled: PropTypes.bool, onChange: PropTypes.func.isRequired, onRetry: PropTypes.func.isRequired,
};
