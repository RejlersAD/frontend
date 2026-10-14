import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { CheckCircleIcon, PencilSquareIcon, PlusCircleIcon, TrashIcon } from '@heroicons/react/24/outline';
import { isLevelZeroApprover, isUnknownApprover } from './recommendationApprovalEvidence';

export const IMPORT_SIGNER_ROLES = { pm: 'Project Manager', moe: 'Manager of Engineering', mop: 'Manager of Projects', vp: 'VP Operations' };
export const capturedImportSignerName = (detection, role) => {
  const names = (detection?.approval_rows || []).filter(row => row.role_key === role).map(row => row.name || row.raw_name || '').filter(Boolean);
  return [...new Set(names)].join('; ') || detection?.approver_names?.[role] || '';
};

export default function ProcurementImportSigners({ detection, review, setReview, edits, setEdits,
  manualSignatures, setManualSignatures, sourceRowEdits, setSourceRowEdits, loading, defaultApprover, expectedReview, error, clearError }) {
  const focusAdded = useRef(null);
  const addButton = useRef(null);
  const inputs = useRef({});
  const sourceRows = detection.approval_rows || [];
  const additionalRows = review.additional_approvers || [];
  const canonicalRows = Object.entries(IMPORT_SIGNER_ROLES).map(([key, label]) => {
    const rows = sourceRows.filter(row => row.role_key === key);
    const capturedName = capturedImportSignerName(detection, key);
    const unknown = isUnknownApprover(capturedName);
    const detected = Boolean(rows.length ? rows.every(row => row.signature_detected) : detection.signatures?.[key]);
    const recordedVerified = Boolean(detection.manual_signature_overrides?.[key]
      || (rows.length && rows.every(row => row.signature_detected || row.signature_verified === true)));
    const capturedOnly = rows.length > 1 || ((detected || recordedVerified) && !unknown);
    const name = capturedOnly ? capturedName : edits[`${key}_name`] || '';
    return { key, label, rows, capturedName, unknown, detected, recordedVerified, capturedOnly, name };
  });
  const noteRoles = canonicalRows.filter(row => row.rows.length <= 1 && (row.unknown || review.approver_notes?.[row.key]
    || (!row.capturedOnly && (row.name.trim() !== row.capturedName.trim() || manualSignatures[row.key]
      || (review.approval_labels[row.key] || '') !== (expectedReview.approval_labels[row.key] || '')))));
  const updateAdditional = (id, change) => {
    clearError();
    setReview(current => ({ ...current, additional_approvers: current.additional_approvers.map(row => row.id === id ? { ...row, ...change } : row) }));
  };
  const addSigner = () => {
    const id = crypto.randomUUID();
    focusAdded.current = id;
    clearError();
    setReview(current => ({ ...current, additional_approvers: [...current.additional_approvers,
      { id, name: '', approval_label: '', signature_verified: false }] }));
  };
  const sourceDraft = (row, index) => sourceRowEdits[index] || { name: row.name || row.raw_name || '',
    approval_label: row.approval_label || '', special_note: row.special_note || '',
    signature_verified: Boolean(row.signature_detected || row.signature_verified) };
  const updateSource = (row, index, change) => setSourceRowEdits(current => ({ ...current,
    [index]: { ...sourceDraft(row, index), ...change } }));
  const renderSourceSigner = row => {
    const index = sourceRows.indexOf(row);
    const label = `Source signer ${index + 1}`;
    const draft = sourceDraft(row, index);
    const recordedSignature = Boolean(row.signature_detected || row.signature_verified);
    const editable = !recordedSignature || isUnknownApprover(row.name || row.raw_name);
    return <div key={`source-${index}`} className="procurement-import-review__signer" role="group" aria-label={label}>
      <label htmlFor={`import-pr-source-signer-${index}`}>{row.source_role || 'Source signer'}</label>
      <input className="procurement-import-review__approval-level" aria-label={`${label} level`} readOnly={!editable || isLevelZeroApprover(draft.name)} maxLength={20} disabled={loading} value={isLevelZeroApprover(draft.name) ? '0' : draft.approval_label} placeholder="Level" onChange={event => updateSource(row, index, { approval_label: event.target.value })} />
      <div className="procurement-import-review__signer-name">
        <input ref={element => { inputs.current[`source-${index}`] = element; }} id={`import-pr-source-signer-${index}`} aria-label={label} readOnly={!editable} disabled={loading} maxLength={200} list={editable ? 'approved-pr-active-employees' : undefined} value={draft.name} placeholder="Not detected" onChange={event => updateSource(row, index, { name: event.target.value, signature_verified: recordedSignature })} />
        {editable && <button type="button" className="procurement-import-review__signer-edit" aria-label={`Edit source signer ${index + 1}`} title={`Edit source signer ${index + 1}`} disabled={loading} onClick={() => { updateSource(row, index, {}); inputs.current[`source-${index}`]?.focus(); inputs.current[`source-${index}`]?.select(); }}><PencilSquareIcon aria-hidden="true" /></button>}
      </div>
      {recordedSignature ? <span className="procurement-import-review__verified"><CheckCircleIcon aria-hidden="true" />{row.signature_detected ? 'Detected' : 'Verified'}</span>
        : <label className="procurement-import-review__verify"><input type="checkbox" aria-label={`Verify source signer ${index + 1} signature in PDF`} checked={draft.signature_verified} disabled={loading || isUnknownApprover(draft.name)} onChange={event => updateSource(row, index, { signature_verified: event.target.checked })} /><span>Verify</span></label>}
      {row.remarks && <p className="procurement-import-review__source-approval-note">Remarks: {row.remarks}</p>}
    </div>;
  };

  return <>
    <div className="procurement-import-review__signer-headings" aria-hidden="true"><span>Role</span><span>Level</span><span>Signer</span><span>Signature</span></div>
    {!additionalRows.some(row => isLevelZeroApprover(row.name)) && !sourceRows.some(row => isLevelZeroApprover(row.name || row.raw_name)) && <div className="procurement-import-review__signer">
      <label htmlFor="import-pr-level-zero-signer">Procurement</label>
      <input className="procurement-import-review__approval-level" aria-label="Procurement level" readOnly value="0" />
      <input id="import-pr-level-zero-signer" aria-label="Procurement approver, Level 0" readOnly value={defaultApprover?.full_name || 'Richa Hannah Thomas'} />
      <span className="procurement-import-review__signature-status">Not recorded</span>
    </div>}
    {canonicalRows.map(({ key, label, rows, unknown, detected, recordedVerified, capturedOnly, name }) => rows.length > 1 ? rows.map(renderSourceSigner) : <div key={key} className="procurement-import-review__signer" role="group" aria-label={`${label} source signer`}>
      <div><label htmlFor={`import-pr-${key}-signer`}>{label}</label>{rows.length === 1 && rows[0].source_role && <small className="procurement-import-review__source-role">PDF: {rows[0].source_role}</small>}</div>
      <input className="procurement-import-review__approval-level" aria-label={`${label} level`} title="Level label shown in the PDF" maxLength={20} disabled={loading} readOnly={isLevelZeroApprover(name)} value={isLevelZeroApprover(name) ? '0' : review.approval_labels[key] || ''} placeholder="Level" onChange={event => setReview(current => ({ ...current, approval_labels: { ...current.approval_labels, [key]: event.target.value } }))} />
      <div className="procurement-import-review__signer-name">
        <input ref={element => { inputs.current[key] = element; }} id={`import-pr-${key}-signer`} aria-label={label} disabled={loading} readOnly={capturedOnly} maxLength={200} list={capturedOnly ? undefined : 'approved-pr-active-employees'} value={name} placeholder={unknown ? 'Not detected' : 'Select signer'} onChange={event => {
          setEdits(current => ({ ...current, [`${key}_name`]: event.target.value }));
          setManualSignatures(current => ({ ...current, [key]: false }));
        }} />
        {!capturedOnly && <button type="button" className="procurement-import-review__signer-edit" aria-label={`Edit ${label} signer`} title={`Edit ${label} signer`} disabled={loading} onClick={() => { inputs.current[key]?.focus(); inputs.current[key]?.select(); }}><PencilSquareIcon aria-hidden="true" /></button>}
      </div>
      {detected || recordedVerified ? <span className="procurement-import-review__verified"><CheckCircleIcon aria-hidden="true" />{detected ? 'Detected' : 'Verified'}</span>
        : capturedOnly ? <span className="procurement-import-review__signature-status">Not detected</span>
          : <label className="procurement-import-review__verify"><input type="checkbox" disabled={loading || isUnknownApprover(name)} aria-label={manualSignatures[key] ? 'Signature verified in PDF' : 'Verify signature in PDF'} checked={Boolean(manualSignatures[key])} onChange={event => setManualSignatures(current => ({ ...current, [key]: event.target.checked }))} /><span>Verify</span></label>}
      {rows.map((row, index) => (row.remarks || rows.length > 1) && <p key={index} className="procurement-import-review__source-approval-note">{rows.length > 1 && <span>{row.source_role || label}: {row.name || row.raw_name || 'Name not detected'} — {row.signature_detected ? 'Signature detected' : 'Signature not detected'}. </span>}{row.remarks && <span>Remarks: {row.remarks}</span>}</p>)}
    </div>)}
    {sourceRows.filter(row => !Object.hasOwn(IMPORT_SIGNER_ROLES, row.role_key)).map(renderSourceSigner)}
    {additionalRows.map((row, index) => {
      const label = `Additional signer ${index + 1}`;
      return <div key={row.id} className="procurement-import-review__signer procurement-import-review__additional-signer" role="group" aria-label={label}>
        <label htmlFor={`import-pr-additional-${row.id}`}>Additional {index + 1}</label>
        <input className="procurement-import-review__approval-level" aria-label={`${label} level`} maxLength={20} disabled={loading} readOnly={isLevelZeroApprover(row.name)} value={isLevelZeroApprover(row.name) ? '0' : row.approval_label} placeholder="Level" onChange={event => updateAdditional(row.id, { approval_label: event.target.value })} />
        <input ref={element => { if (element && focusAdded.current === row.id) { focusAdded.current = null; element.focus(); } }} id={`import-pr-additional-${row.id}`} aria-label={label} list="approved-pr-active-employees" maxLength={200} disabled={loading} value={row.name} placeholder="Select signer" onChange={event => updateAdditional(row.id, { name: event.target.value, signature_verified: false })} />
        <div className="procurement-import-review__additional-actions">
          <label className="procurement-import-review__verify"><input type="checkbox" disabled={loading || isUnknownApprover(row.name)} aria-label={`Verify additional signer ${index + 1} signature in PDF`} checked={row.signature_verified} onChange={event => updateAdditional(row.id, { signature_verified: event.target.checked })} /><span>Verify</span></label>
          <button type="button" className="procurement-import-review__signer-remove" aria-label={`Remove additional signer ${index + 1}`} title={`Remove additional signer ${index + 1}`} disabled={loading} onClick={() => {
            clearError();
            setReview(current => ({ ...current, additional_approvers: current.additional_approvers.filter(item => item.id !== row.id) }));
            addButton.current?.focus();
          }}><TrashIcon aria-hidden="true" /></button>
        </div>
      </div>;
    })}
    <div className="procurement-import-review__add-signer-row">
      <button ref={addButton} type="button" className="procurement-import-review__add-signer" aria-label="Add signer" title="Add signer" disabled={loading} onClick={addSigner}><PlusCircleIcon aria-hidden="true" /></button>
    </div>
    {error && <p id="import-pr-additional-error" role="alert" className="procurement-import-review__field-error">{error}</p>}
    {(noteRoles.length > 0 || additionalRows.length > 0 || Object.keys(sourceRowEdits).length > 0) && <div className="procurement-import-review__signer-notes" role="group" aria-label="Special note">
      <p className="procurement-import-review__notes-heading">Special note</p>
      {noteRoles.map(({ key, label }) => <label key={key} className="procurement-import-review__signer-note">{label}
        <textarea id={`import-pr-${key}-note`} aria-label={`${label} special note`} rows={1} maxLength={2000} disabled={loading} value={review.approver_notes?.[key] || ''} placeholder="Explain the signer or Level correction" onChange={event => setReview(current => ({ ...current, approver_notes: { ...current.approver_notes, [key]: event.target.value } }))} />
      </label>)}
      {Object.entries(sourceRowEdits).map(([index, draft]) => <label key={`source-${index}`} className="procurement-import-review__signer-note">{`Source signer ${Number(index) + 1}`}
        <textarea id={`import-pr-source-note-${index}`} aria-label={`Source signer ${Number(index) + 1} special note`} rows={1} maxLength={2000} disabled={loading} value={draft.special_note} placeholder="Explain the source signer correction" onChange={event => updateSource(sourceRows[Number(index)], Number(index), { special_note: event.target.value })} />
      </label>)}
      {additionalRows.map((row, index) => <label key={row.id} className="procurement-import-review__signer-note">Additional {index + 1}
        <textarea id={`import-pr-additional-note-${row.id}`} aria-label={`Additional signer ${index + 1} special note`} rows={1} maxLength={2000} disabled={loading} value={row.special_note || ''} placeholder={expectedReview.additional_approvers.some(item => item.id === row.id) ? 'Explain any name or Level correction' : 'Optional source review note'} onChange={event => updateAdditional(row.id, { special_note: event.target.value })} />
      </label>)}
    </div>}
  </>;
}

ProcurementImportSigners.propTypes = {
  detection: PropTypes.object.isRequired,
  review: PropTypes.object.isRequired, setReview: PropTypes.func.isRequired,
  edits: PropTypes.object.isRequired, setEdits: PropTypes.func.isRequired,
  manualSignatures: PropTypes.object.isRequired, setManualSignatures: PropTypes.func.isRequired,
  sourceRowEdits: PropTypes.object.isRequired, setSourceRowEdits: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired, defaultApprover: PropTypes.object,
  expectedReview: PropTypes.object.isRequired, error: PropTypes.string.isRequired, clearError: PropTypes.func.isRequired,
};
