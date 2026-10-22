// ============================================================================
// Tab 3 — REVIEW QUEUE: discrepancy table + Resolve modal
// (use line list value / use criticality value / enter a value; comment
// mandatory; Cat 1 override or category downgrade needs lead approval).
// ============================================================================
import React, { useState } from 'react';
import { useCll } from '../CllStore';
import { EmptyState } from './RegisterTab';

const SEV_PILL = { danger: 'rd-pill-danger', warning: 'rd-pill-warning', orange: 'rd-pill-orange' };
const CAT_RANK = { 'L1': 3, 'L2': 2, 'L3': 1, 'Non-critical': 0, 'Not assessed': -1 };

function ResolveModal({ item, onClose }) {
  const { resolveDiscrepancy } = useCll();
  const [choice, setChoice] = useState('lineList');
  const [custom, setCustom] = useState('');
  const [comment, setComment] = useState('');
  const [approver, setApprover] = useState('');

  const isCatOverride = item.cat === 'L1';
  const isDowngrade = choice === 'lineList' && (CAT_RANK[item.line?.stress_category] ?? 0) > (CAT_RANK[item.cat] ?? 0);
  const needsApproval = isCatOverride || isDowngrade;

  const canSubmit = comment.trim() && (!needsApproval || approver.trim()) && (choice !== 'custom' || custom.trim());

  const submit = () => {
    resolveDiscrepancy(item.id, {
      choice, value: choice === 'custom' ? custom : choice === 'lineList' ? item.lineListValue : item.criticalityValue,
      comment, approver: needsApproval ? approver : undefined,
    });
    onClose();
  };

  return (
    <>
      <div className="rd-modal-backdrop" onClick={onClose} />
      <div className="rd-modal" role="dialog" aria-label="Resolve discrepancy">
        <header className="rd-drawer-header">
          Resolve — <span className="rd-mono">{item.line_number}</span>
          <button className="rd-btn rd-btn-ghost rd-btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="rd-card-body space-y-4">
          <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-body)' }}>{item.issue}</div>

          <div className="space-y-2" role="radiogroup" aria-label="Resolution">
            {item.lineListValue !== '—' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: 44 }}>
                <input type="radio" checked={choice === 'lineList'} onChange={() => setChoice('lineList')} />
                Use line list value <span className="rd-mono">{item.lineListValue}</span>
              </label>
            )}
            {item.criticalityValue !== '—' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: 44 }}>
                <input type="radio" checked={choice === 'criticality'} onChange={() => setChoice('criticality')} />
                Use criticality value <span className="rd-mono">{item.criticalityValue}</span>
              </label>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: 44 }}>
              <input type="radio" checked={choice === 'custom'} onChange={() => setChoice('custom')} />
              Enter a value
            </label>
            {choice === 'custom' && (
              <input className="rd-input" value={custom} onChange={e => setCustom(e.target.value)} placeholder="Resolved value" />
            )}
          </div>

          <label className="rd-text-muted" style={{ display: 'block', fontSize: 'var(--rd-text-caption)' }}>
            Comment (mandatory)
            <textarea className="rd-input" rows={3} style={{ paddingTop: 8 }} value={comment}
              onChange={e => setComment(e.target.value)} />
          </label>

          {needsApproval && (
            <div className="rd-banner rd-banner-warning" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
              <span>{isCatOverride ? 'Overriding an L1 line' : 'Downgrading a stress level'} requires lead stress engineer approval.</span>
              <input className="rd-input" value={approver} onChange={e => setApprover(e.target.value)}
                placeholder="Lead stress engineer (name)" />
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
  const { files, discrepancies } = useCll();
  const [resolving, setResolving] = useState(null);
  const [assigned, setAssigned] = useState({});

  if (!files.lineList) return <EmptyState />;

  return (
    <div className="space-y-4">
      <div className="rd-card" style={{ overflow: 'auto', maxHeight: '68vh' }}>
        <table className="rd-table">
          <thead>
            <tr>
              <th>Severity</th><th>Issue</th><th>Line Number</th>
              <th>Line list value</th><th>Criticality value</th><th>Assigned to</th><th></th>
            </tr>
          </thead>
          <tbody>
            {discrepancies.map(d => (
              <tr key={d.id}>
                <td><span className={`rd-pill ${SEV_PILL[d.severity] || 'rd-pill-neutral'}`}>{d.severity}</span></td>
                <td>{d.issue}</td>
                <td className="rd-mono">{d.line_number}</td>
                <td className="rd-mono">{String(d.lineListValue)}</td>
                <td className="rd-mono">{String(d.criticalityValue)}</td>
                <td>
                  <input className="rd-input" style={{ minHeight: 32, width: 140, fontSize: 'var(--rd-text-caption)' }}
                    placeholder="Assign…" value={assigned[d.id] || ''}
                    onChange={e => setAssigned(a => ({ ...a, [d.id]: e.target.value }))} />
                </td>
                <td><button className="rd-btn rd-btn-primary rd-btn-sm" onClick={() => setResolving(d)}>Resolve</button></td>
              </tr>
            ))}
            {discrepancies.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--rd-text-faint)' }}>
                No open discrepancies — all matched lines are consistent.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      {resolving && <ResolveModal item={resolving} onClose={() => setResolving(null)} />}
    </div>
  );
}
