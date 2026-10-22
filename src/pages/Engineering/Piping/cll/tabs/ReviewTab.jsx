// ============================================================================
// Tab 3 — REVIEW QUEUE: evaluation review items + Resolve modal.
// Issue types: Line list not flagged for stress analysis (critical) ·
// Cannot evaluate · Multiple sizes · Class mismatch in line number ·
// Duplicate line key · Override pending approval.
// Not-flagged resolve options: Accept L1 — update line list flag to Y ·
// Override category (reason; downgrade from L1 needs Lead approval) ·
// Not applicable (comment).
// ============================================================================
import React, { useState } from 'react';
import { useCll } from '../CllStore';
import { CAT_PILL } from '../criticalityEngine';
import { EmptyState } from './RegisterTab';

const SEV_PILL = { critical: 'rd-pill-danger', warning: 'rd-pill-warning', info: 'rd-pill-info' };

function ResolveModal({ item, onClose }) {
  const { resolveItem, setOverride } = useCll();
  const isNotFlagged = item.type === 'Line list not flagged for stress analysis';
  const [choice, setChoice] = useState(isNotFlagged ? 'accept-l1' : 'acknowledge');
  const [category, setCategory] = useState(item.line?.tableCategory || 'L1');
  const [comment, setComment] = useState('');
  const [approver, setApprover] = useState('');

  const downgrade = isNotFlagged && choice === 'override' && category !== 'L1';
  const needsApproval = downgrade;
  const needsReason = choice === 'override';
  const canSubmit = (comment.trim() || (isNotFlagged && choice === 'accept-l1'))
    && (!needsReason || comment.trim())
    && (!needsApproval || approver.trim());

  const submit = () => {
    if (choice === 'override') {
      setOverride(item.line_number, category, comment, needsApproval ? approver : undefined);
    }
    resolveItem(item.id, {
      choice,
      value: choice === 'accept-l1' ? 'Accept L1 — update line list flag to Y'
        : choice === 'override' ? `Override category to ${category}`
        : choice === 'not-applicable' ? 'Not applicable' : 'Acknowledged',
      comment, approver: needsApproval ? approver : undefined,
    });
    onClose();
  };

  return (
    <>
      <div className="rd-modal-backdrop" onClick={onClose} />
      <div className="rd-modal" role="dialog" aria-label="Resolve review item">
        <header className="rd-drawer-header">
          Resolve — <span className="rd-mono">{item.line_number}</span>
          <button className="rd-btn rd-btn-ghost rd-btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="rd-card-body space-y-4">
          <div>
            <span className={`rd-pill ${SEV_PILL[item.severity] || 'rd-pill-neutral'}`}>{item.type}</span>
            <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-body)', marginTop: 6 }}>{item.detail}</div>
            {item.line?.tableCategory && (
              <div style={{ marginTop: 6, fontSize: 'var(--rd-text-caption)' }} className="rd-text-muted">
                Table 2 category: <span className={`rd-pill ${CAT_PILL[item.line.tableCategory]}`}>{item.line.tableCategory}</span>
              </div>
            )}
          </div>

          <div className="space-y-2" role="radiogroup" aria-label="Resolution">
            {isNotFlagged && (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: 44 }}>
                  <input type="radio" checked={choice === 'accept-l1'} onChange={() => setChoice('accept-l1')} />
                  Accept L1 — update line list flag to Y
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: 44 }}>
                  <input type="radio" checked={choice === 'override'} onChange={() => setChoice('override')} />
                  Override category
                </label>
                {choice === 'override' && (
                  <div style={{ marginLeft: 24, display: 'flex', gap: 6 }}>
                    {['L1', 'L2', 'L3'].map(c => (
                      <button key={c} type="button"
                        className={`rd-btn rd-btn-sm ${category === c ? 'rd-btn-primary' : 'rd-btn-secondary'}`}
                        onClick={() => setCategory(c)}>{c}</button>
                    ))}
                  </div>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: 44 }}>
                  <input type="radio" checked={choice === 'not-applicable'} onChange={() => setChoice('not-applicable')} />
                  Not applicable
                </label>
              </>
            )}
            {!isNotFlagged && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: 44 }}>
                <input type="radio" checked={choice === 'acknowledge'} onChange={() => setChoice('acknowledge')} />
                Acknowledge — no category change
              </label>
            )}
          </div>

          <label className="rd-text-muted" style={{ display: 'block', fontSize: 'var(--rd-text-caption)' }}>
            {needsReason ? 'Reason (mandatory)' : 'Comment'}
            <textarea className="rd-input" rows={3} style={{ paddingTop: 8 }} value={comment}
              onChange={e => setComment(e.target.value)} />
          </label>

          {needsApproval && (
            <div className="rd-banner rd-banner-warning" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
              <span>Downgrading from table L1 requires Lead Stress Engineer approval.</span>
              <input className="rd-input" value={approver} onChange={e => setApprover(e.target.value)}
                placeholder="Lead Stress Engineer (name)" />
            </div>
          )}
        </div>
        <footer className="rd-drawer-footer">
          <button className="rd-btn rd-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="rd-btn rd-btn-primary" disabled={!canSubmit} onClick={submit}>Resolve</button>
        </footer>
      </div>
    </>
  );
}

export default function ReviewTab() {
  const { files, reviewItems } = useCll();
  const [resolving, setResolving] = useState(null);
  const [assigned, setAssigned] = useState({});

  if (!files.lineList) return <EmptyState />;

  return (
    <div className="space-y-4">
      <div className="rd-card" style={{ overflow: 'auto', maxHeight: '68vh' }}>
        <table className="rd-table">
          <thead>
            <tr>
              <th>Severity</th><th>Issue</th><th>Line Number</th><th>Detail</th>
              <th>Table category</th><th>Assigned to</th><th></th>
            </tr>
          </thead>
          <tbody>
            {reviewItems.map(d => (
              <tr key={d.id}>
                <td><span className={`rd-pill ${SEV_PILL[d.severity] || 'rd-pill-neutral'}`}>{d.severity}</span></td>
                <td>{d.type}</td>
                <td className="rd-mono">{d.line_number}</td>
                <td className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>{d.detail}</td>
                <td>{d.line?.tableCategory
                  ? <span className={`rd-pill ${CAT_PILL[d.line.tableCategory]}`}>{d.line.tableCategory}</span>
                  : <span className="rd-text-muted">—</span>}</td>
                <td>
                  <input className="rd-input" style={{ minHeight: 32, width: 140, fontSize: 'var(--rd-text-caption)' }}
                    placeholder="Assign…" value={assigned[d.id] || ''}
                    onChange={e => setAssigned(a => ({ ...a, [d.id]: e.target.value }))} />
                </td>
                <td><button className="rd-btn rd-btn-primary rd-btn-sm" onClick={() => setResolving(d)}>Resolve</button></td>
              </tr>
            ))}
            {reviewItems.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--rd-text-faint)' }}>
                No open review items — all evaluated lines are consistent.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      {resolving && <ResolveModal item={resolving} onClose={() => setResolving(null)} />}
    </div>
  );
}
