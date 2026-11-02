/**
 * §2.3 — Confirm columns drawer, two modes:
 *  - register: document register column mapping (default mode).
 *  - checklist: client checklist column mapping — amber note on structure
 *    problems (rows without a number become section headings, duplicate
 *    numbers must be renumbered, merged-cell text is ignored), mapping table
 *    (Sl .No / Check List Points / Applicability / Status / Remarks), points
 *    matching no checker rule become Engineer points (listed, never dropped).
 *    Footer: Cancel · Use PRO-001 Rev A · Confirm mapping. Either of the last
 *    two records the checklist as provided; Cancel leaves it missing. The
 *    mapping is saved for later uploads of the same checklist.
 */
import { useMemo, useRef, useState } from 'react'
import { Drawer } from './shared'
import * as svc from './pidChecker.service'

// Target fields a document register can map to.
const TARGET_FIELDS = [
  { id: 'ignore', label: 'Do not import' },
  { id: 'document_number', label: 'Document number' },
  { id: 'title', label: 'Title' },
  { id: 'revision', label: 'Revision' },
  { id: 'date', label: 'Date' },
  { id: 'status', label: 'Status' },
]

// Target fields a client checklist can map to (spec §2.3).
const CHECKLIST_TARGET_FIELDS = [
  { id: 'ignore', label: 'Do not import' },
  { id: 'point_number', label: 'Point number (Sl .No)' },
  { id: 'point_text', label: 'Checklist point' },
  { id: 'applicability', label: 'Applicability' },
  { id: 'status', label: 'Status' },
  { id: 'remarks', label: 'Remarks' },
]

export default function ConfirmColumnsDrawer({ open, onClose, register, onConfirm, onUploadExcel, mode = 'register', onUseDefault = null, projectId = null }) {
  const isChecklist = mode === 'checklist'
  const targetFields = isChecklist ? CHECKLIST_TARGET_FIELDS : TARGET_FIELDS
  // register: { name, headerMisread?: boolean, columns: [{ name, samples: [] }], badRows?: [], engineerPoints?: [] }
  const [mapping, setMapping] = useState({})
  const [dropped, setDropped] = useState({})
  const [tplBusy, setTplBusy] = useState(false)
  const [tplDiff, setTplDiff] = useState(null) // { version, diff, error }
  const tplInputRef = useRef(null)

  // An .xlsx whose row-7 headers match the AI-PID-02 template needs no
  // column mapping: it is imported as a new template version (spec §2.1).
  const uploadTemplate = async file => {
    if (!file || !projectId) return
    setTplBusy(true)
    setTplDiff(null)
    try {
      const res = await svc.uploadChecklistTemplate(projectId, file)
      setTplDiff({ version: res.template.version, diff: res.diff })
    } catch (err) {
      setTplDiff({ error: err?.response?.data?.error || 'Not the AI-PID-02 format — map the columns below instead.' })
    } finally {
      setTplBusy(false)
    }
  }

  const columns = register?.columns ?? []
  const badRows = register?.badRows ?? []
  const engineerPoints = register?.engineerPoints ?? []

  const mappedTargets = useMemo(() => new Set(Object.values(mapping).filter(v => v && v !== 'ignore')), [mapping])
  const hasNumber = mappedTargets.has(isChecklist ? 'point_number' : 'document_number')
  const canConfirm = isChecklist ? hasNumber && mappedTargets.has('point_text') : hasNumber

  if (!open) return null

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isChecklist ? `Client checklist — ${register?.name ?? 'confirm columns'}` : `Confirm columns — ${register?.name ?? 'register'}`}
      wide
      footer={(
        <>
          <button type="button" className="rd-btn rd-btn-ghost" onClick={onClose}>Cancel</button>
          {isChecklist && onUseDefault && (
            <button type="button" className="rd-btn rd-btn-secondary" onClick={onUseDefault}>
              Keep the default checklist
            </button>
          )}
          {!isChecklist && onUploadExcel && (
            <button type="button" className="rd-btn rd-btn-secondary" onClick={onUploadExcel}>
              Upload as Excel instead
            </button>
          )}
          <button
            type="button"
            className="rd-btn rd-btn-primary"
            disabled={!canConfirm}
            title={canConfirm ? undefined : isChecklist ? 'Map columns to “Point number” and “Checklist point” first' : 'Map a column to “Document number” first'}
            onClick={() => onConfirm?.({ mapping, droppedRows: Object.keys(dropped).filter(k => dropped[k]) })}
          >
            Confirm mapping
          </button>
        </>
      )}
    >
      {isChecklist && (
        <p className="pc-note pc-note-warning" style={{ margin: 0 }}>
          Structure problems found in checklist files: rows without a number are taken as section headings;
          duplicate numbers (e.g. two 9.15) must be renumbered; text hidden under merged cells is ignored.
        </p>
      )}
      {!isChecklist && register?.headerMisread && (
        <p className="pc-note pc-note-warning" style={{ margin: 0 }}>
          The register header row could not be read reliably. Check every mapping below before confirming.
        </p>
      )}

      {isChecklist && projectId && (
        <div className="pc-field" style={{ border: '1px solid var(--rd-border-soft)', borderRadius: 8, padding: '0.75rem' }}>
          <span className="pc-label">AI-PID-02 format</span>
          <p className="pc-help" style={{ margin: 0 }}>
            A workbook whose row-7 headers match the AI-PID-02 template needs no column mapping — it is
            imported as a new template version and pinned to this project.
          </p>
          <div>
            <button type="button" className="rd-btn rd-btn-secondary rd-btn-sm" disabled={tplBusy} onClick={() => tplInputRef.current?.click()}>
              {tplBusy ? 'Importing…' : 'Upload revised checklist (.xlsx)'}
            </button>
            <input
              ref={tplInputRef} type="file" accept=".xlsx" hidden
              onChange={e => { uploadTemplate(e.target.files?.[0]); e.target.value = '' }}
              aria-label="Upload revised AI-PID-02 checklist"
            />
          </div>
          {tplDiff?.error && <p className="pc-note pc-note-warning" style={{ margin: 0 }}>{tplDiff.error}</p>}
          {tplDiff?.version && (
            <p className="pc-note pc-note-success" style={{ margin: 0 }}>
              Imported as AI-PID-02 v{tplDiff.version} — added: {tplDiff.diff.added.length}
              {tplDiff.diff.added.length > 0 && ` (${tplDiff.diff.added.join(', ')})`},
              removed: {tplDiff.diff.removed.length}
              {tplDiff.diff.removed.length > 0 && ` (${tplDiff.diff.removed.join(', ')})`},
              reworded: {tplDiff.diff.reworded.length}
              {tplDiff.diff.reworded.length > 0 && ` (${tplDiff.diff.reworded.join(', ')})`}.
            </p>
          )}
        </div>
      )}

      {columns.length === 0 ? (
        <p className="pc-empty-text">
          Column detection is available after the {isChecklist ? 'checklist' : 'register'} has been parsed.
          {isChecklist
            ? ' Upload the client checklist from the Legend & checklist section first.'
            : ' Upload the register again or use “Upload as Excel instead”.'}
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
                      {targetFields.map(f => (
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

      {isChecklist && engineerPoints.length > 0 && (
        <div className="pc-field">
          <span className="pc-label">Engineer points — no checker rule matches these</span>
          <p className="pc-help" style={{ margin: 0 }}>
            They are answered by the engineer on the drawing screen and are never dropped.
          </p>
          <ul className="pc-muted" style={{ margin: 0, paddingLeft: '1.25rem', fontSize: 'var(--rd-text-table)' }}>
            {engineerPoints.map((point, i) => <li key={i}>{point}</li>)}
          </ul>
        </div>
      )}

      {!isChecklist && badRows.length > 0 && (
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

      <p className="pc-help">
        {isChecklist
          ? 'The mapping is saved and reused for later uploads of the same checklist. Confirming the mapping — or “Keep the default checklist” — records the checklist as provided; Cancel leaves it missing.'
          : 'The mapping is saved per register and reused on re-upload.'}
      </p>
    </Drawer>
  )
}
