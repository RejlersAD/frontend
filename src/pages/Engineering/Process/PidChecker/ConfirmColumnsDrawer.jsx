/**
 * §2.3 — Confirm register columns drawer.
 * Amber note when the header row was misread; mapping table (column in file
 * → maps to select → sample values); non-conforming rows listed to keep/drop;
 * Cancel · Upload as Excel instead · Confirm mapping (saved per register).
 */
import { useMemo, useState } from 'react'
import { Drawer } from './shared'

// Target fields a document register can map to.
const TARGET_FIELDS = [
  { id: 'ignore', label: 'Do not import' },
  { id: 'document_number', label: 'Document number' },
  { id: 'title', label: 'Title' },
  { id: 'revision', label: 'Revision' },
  { id: 'date', label: 'Date' },
  { id: 'status', label: 'Status' },
]

export default function ConfirmColumnsDrawer({ open, onClose, register, onConfirm, onUploadExcel }) {
  // register: { name, headerMisread?: boolean, columns: [{ name, samples: [] }], badRows?: [] }
  const [mapping, setMapping] = useState({})
  const [dropped, setDropped] = useState({})

  const columns = register?.columns ?? []
  const badRows = register?.badRows ?? []

  const mappedTargets = useMemo(() => new Set(Object.values(mapping).filter(v => v && v !== 'ignore')), [mapping])
  const hasNumber = mappedTargets.has('document_number')

  if (!open) return null

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Confirm columns — ${register?.name ?? 'register'}`}
      wide
      footer={(
        <>
          <button type="button" className="rd-btn rd-btn-ghost" onClick={onClose}>Cancel</button>
          {onUploadExcel && (
            <button type="button" className="rd-btn rd-btn-secondary" onClick={onUploadExcel}>
              Upload as Excel instead
            </button>
          )}
          <button
            type="button"
            className="rd-btn rd-btn-primary"
            disabled={!hasNumber}
            title={hasNumber ? undefined : 'Map a column to “Document number” first'}
            onClick={() => onConfirm?.({ mapping, droppedRows: Object.keys(dropped).filter(k => dropped[k]) })}
          >
            Confirm mapping
          </button>
        </>
      )}
    >
      {register?.headerMisread && (
        <p className="pc-note pc-note-warning" style={{ margin: 0 }}>
          The register header row could not be read reliably. Check every mapping below before confirming.
        </p>
      )}

      {columns.length === 0 ? (
        <p className="pc-empty-text">
          Column detection is available after the register has been parsed. Upload the register again or use
          “Upload as Excel instead”.
        </p>
      ) : (
        <div className="pc-table-wrap pc-card">
          <table className="pc-table">
            <thead>
              <tr><th>Column in file</th><th>Maps to</th><th>Sample values</th></tr>
            </thead>
            <tbody>
              {columns.map((col, i) => (
                <tr key={col.name ?? i}>
                  <td className="pc-mono">{col.name ?? `Column ${i + 1}`}</td>
                  <td>
                    <select
                      className="pc-select"
                      value={mapping[col.name ?? i] ?? 'ignore'}
                      onChange={e => setMapping(prev => ({ ...prev, [col.name ?? i]: e.target.value }))}
                      aria-label={`Mapping for ${col.name ?? `column ${i + 1}`}`}
                    >
                      {TARGET_FIELDS.map(f => (
                        <option
                          key={f.id}
                          value={f.id}
                          disabled={f.id !== 'ignore' && mappedTargets.has(f.id) && mapping[col.name ?? i] !== f.id}
                        >
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="pc-muted">
                    {(col.samples ?? []).slice(0, 3).join(' · ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {badRows.length > 0 && (
        <div className="pc-field">
          <span className="pc-label">Rows that do not conform</span>
          <div className="pc-table-wrap pc-card">
            <table className="pc-table">
              <thead>
                <tr><th>Row</th><th>Content</th><th>Keep</th></tr>
              </thead>
              <tbody>
                {badRows.map((row, i) => (
                  <tr key={i}>
                    <td className="pc-mono">{row.row ?? i + 1}</td>
                    <td className="pc-muted">{row.content ?? '—'}</td>
                    <td>
                      <label className="pc-switch" style={{ minHeight: 30 }}>
                        <input
                          type="checkbox"
                          checked={!dropped[i]}
                          onChange={e => setDropped(prev => ({ ...prev, [i]: !e.target.checked }))}
                        />
                        {dropped[i] ? 'Drop' : 'Keep'}
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="pc-help">The mapping is saved per register and reused on re-upload.</p>
    </Drawer>
  )
}
