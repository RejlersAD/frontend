import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { ArrowDown, ArrowUp, Link2, Plus, Save, Trash2, Undo2 } from 'lucide-react';
import { NEW_BLOCK_TYPES, editProblem, isDirty, moveRow, newRow, toEditable, toPayload } from './proposalSectionEdit';

const TYPE_LABEL = { part: 'Chapter', heading: 'Sub-heading', paragraph: 'Paragraph', bullets: 'Bullet list', table: 'Table' };

function Row({ row, index, count, disabled, onChange, onMove, onRemove }) {
  const label = `${TYPE_LABEL[row.type]} ${index + 1}`;
  const set = (changes) => onChange({ ...row, ...changes });
  if (row.type === 'part') {
    return <li className="spe-row spe-row-part"><strong>{row.text}</strong><span className="spe-muted">Chapter heading (fixed)</span></li>;
  }
  return (
    <li className="spe-row">
      <div className="spe-row-head">
        <span className="spe-type">{TYPE_LABEL[row.type]}</span>
        {row.sourced && <span className="spe-sourced" title="Keeps its tender source references"><Link2 size={12} aria-hidden="true" />Sourced</span>}
        {row.ref === null && <span className="spe-new">New</span>}
        <div className="spe-row-actions">
          <button type="button" aria-label={`Move ${label} up`} disabled={disabled || index === 0} onClick={() => onMove(-1)}><ArrowUp size={14} aria-hidden="true" /></button>
          <button type="button" aria-label={`Move ${label} down`} disabled={disabled || index === count - 1} onClick={() => onMove(1)}><ArrowDown size={14} aria-hidden="true" /></button>
          <button type="button" aria-label={`Remove ${label}`} disabled={disabled} onClick={onRemove}><Trash2 size={14} aria-hidden="true" /></button>
        </div>
      </div>
      {row.type === 'heading' && (
        <input aria-label={`${label} text`} value={row.text} maxLength={200} disabled={disabled} onChange={(event) => set({ text: event.target.value })} />
      )}
      {row.type === 'paragraph' && (
        <textarea aria-label={`${label} text`} rows={Math.min(12, Math.max(3, Math.ceil(row.text.length / 90)))} value={row.text} maxLength={4000} disabled={disabled} onChange={(event) => set({ text: event.target.value })} />
      )}
      {row.type === 'bullets' && (
        <>
          <textarea aria-label={`${label} introduction`} rows={2} placeholder="Introduction (optional)" value={row.text} maxLength={4000} disabled={disabled} onChange={(event) => set({ text: event.target.value })} />
          <ol className="spe-items">
            {row.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <textarea aria-label={`${label} item ${itemIndex + 1}`} rows={2} value={item} maxLength={1000} disabled={disabled}
                  onChange={(event) => set({ items: row.items.map((value, i) => (i === itemIndex ? event.target.value : value)) })} />
                <button type="button" aria-label={`Remove ${label} item ${itemIndex + 1}`} disabled={disabled || row.items.length === 1}
                  onClick={() => set({ items: row.items.filter((_, i) => i !== itemIndex) })}><Trash2 size={13} aria-hidden="true" /></button>
              </li>
            ))}
          </ol>
          <button type="button" className="spe-link" disabled={disabled || row.items.length >= 100} onClick={() => set({ items: [...row.items, ''] })}><Plus size={13} aria-hidden="true" />Add item</button>
        </>
      )}
      {row.type === 'table' && (
        <>
          <textarea aria-label={`${label} introduction`} rows={2} placeholder="Introduction (optional)" value={row.text} maxLength={4000} disabled={disabled} onChange={(event) => set({ text: event.target.value })} />
          <div className="spe-table-wrap">
            <table className="spe-table">
              <thead>
                <tr>{row.columns.map((column, c) => (
                  <th key={c}><input aria-label={`${label} column ${c + 1} name`} value={column} maxLength={120} disabled={disabled}
                    onChange={(event) => set({ columns: row.columns.map((value, i) => (i === c ? event.target.value : value)) })} /></th>
                ))}<th aria-label="Row actions" /></tr>
              </thead>
              <tbody>
                {row.rows.map((cells, r) => (
                  <tr key={r}>
                    {row.columns.map((_, c) => (
                      <td key={c}><textarea aria-label={`${label} row ${r + 1} column ${c + 1}`} rows={1} value={cells[c] || ''} maxLength={600} disabled={disabled}
                        onChange={(event) => set({ rows: row.rows.map((values, i) => (i === r ? row.columns.map((__, k) => (k === c ? event.target.value : values[k] || '')) : values)) })} /></td>
                    ))}
                    <td><button type="button" aria-label={`Remove ${label} row ${r + 1}`} disabled={disabled || row.rows.length === 1}
                      onClick={() => set({ rows: row.rows.filter((_, i) => i !== r) })}><Trash2 size={13} aria-hidden="true" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="spe-link" disabled={disabled || row.rows.length >= 300} onClick={() => set({ rows: [...row.rows, row.columns.map(() => '')] })}><Plus size={13} aria-hidden="true" />Add row</button>
        </>
      )}
    </li>
  );
}

Row.propTypes = {
  row: PropTypes.object.isRequired, index: PropTypes.number.isRequired, count: PropTypes.number.isRequired,
  disabled: PropTypes.bool, onChange: PropTypes.func.isRequired, onMove: PropTypes.func.isRequired, onRemove: PropTypes.func.isRequired,
};

/** Structured editor for one proposal section; saving re-renders the proposal PDF (no AI). */
export default function SalesProposalSectionEditor({ section, disabled, onSave, onDirtyChange }) {
  const [rows, setRows] = useState(() => toEditable(section.blocks));
  const [reason, setReason] = useState('');
  const [adding, setAdding] = useState('paragraph');
  const dirty = useMemo(() => isDirty(section.blocks, rows), [section.blocks, rows]);
  const problem = dirty ? editProblem(rows, reason) : '';

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (index, row) => setRows((previous) => previous.map((item, i) => (i === index ? row : item)));
  const save = (event) => {
    event.preventDefault();
    if (!dirty || problem || disabled) return;
    onSave(toPayload(rows), reason.trim());
  };

  return (
    <form className="spe-editor" aria-label={`Edit ${section.title}`} onSubmit={save}>
      <ol className="spe-rows">
        {rows.map((row, index) => (
          <Row key={row.id} row={row} index={index} count={rows.length} disabled={disabled}
            onChange={(value) => update(index, value)} onMove={(offset) => setRows((previous) => moveRow(previous, index, offset))}
            onRemove={() => setRows((previous) => previous.filter((_, i) => i !== index))} />
        ))}
      </ol>
      <div className="spe-add">
        <label>Add<select aria-label="Block type to add" value={adding} disabled={disabled} onChange={(event) => setAdding(event.target.value)}>
          {NEW_BLOCK_TYPES.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
        </select></label>
        <button type="button" className="spr-button" disabled={disabled || rows.length >= 400} onClick={() => setRows((previous) => [...previous, newRow(adding)])}><Plus size={14} aria-hidden="true" />Add block</button>
      </div>
      <div className="spe-footer">
        <label htmlFor={`spe-reason-${section.key}`}>Reason for the edit</label>
        <textarea id={`spe-reason-${section.key}`} rows={2} maxLength={500} value={reason} disabled={disabled}
          placeholder="For example: clarify the schedule duration requested by the client" onChange={(event) => setReason(event.target.value)} />
        {problem && <p className="spe-problem" role="alert">{problem}</p>}
        <p className="spe-muted">Saving creates the next proposal version: the PDF and Word file are rebuilt in the Rejlers template (no AI) and this section returns to review.</p>
        <div className="spe-footer-actions">
          <button type="button" className="spr-button" disabled={disabled || !dirty} onClick={() => { setRows(toEditable(section.blocks)); setReason(''); }}><Undo2 size={14} aria-hidden="true" />Discard changes</button>
          <button type="submit" className="spr-button spr-button-primary" disabled={disabled || !dirty || Boolean(problem)}><Save size={14} aria-hidden="true" />Save &amp; update PDF</button>
        </div>
      </div>
    </form>
  );
}

SalesProposalSectionEditor.propTypes = {
  section: PropTypes.shape({ key: PropTypes.string.isRequired, title: PropTypes.string.isRequired, blocks: PropTypes.array }).isRequired,
  disabled: PropTypes.bool,
  onSave: PropTypes.func.isRequired,
  onDirtyChange: PropTypes.func,
};
