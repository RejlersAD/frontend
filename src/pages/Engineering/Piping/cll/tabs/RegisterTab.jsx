// ============================================================================
// Tab 1 — LINE REGISTER: KPI row, quick filter chips (All · L1 · L2 · L3 ·
// Not flagged but L1 · Cannot evaluate · Overridden), full-width table with
// calculated categories, line detail right drawer ("How the category was
// found"). URL filters from the analysis tab: ?category= · ?status= ·
// ?check= · ?cell=row,col · ?flag=.
// The table is paginated (250/page) — 4,253 rows render fine without
// virtualization.
// ============================================================================
import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCll } from '../CllStore';
import {
  CAT_PILL, NPS_ROW_LABELS, TEMP_LABELS, TEMP_LIMITS, METHOD_TEXT,
  kgcm2ToBarg, CATEGORY_SOFT,
} from '../criticalityEngine';
import { exportRegisterWorkbook, LDT_FIELDS } from '../cllFiles';
import { fmtNum } from '../../../../../features/critical-line-list/analysis/analysisState';

const PAGE_SIZE = 250;

const FLAG_PILL = {
  'agrees': { label: 'Agrees', pill: 'rd-pill-success' },
  'not-flagged-L1': { label: 'Not flagged — Table 2 requires L1', pill: 'rd-pill-danger' },
  'flagged-conservative': { label: 'Flagged Y — Table 2 is L2/L3', pill: 'rd-pill-neutral' },
  'no-flag': { label: 'No line-list flag', pill: 'rd-pill-neutral' },
};

const CHIPS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'L1', label: 'L1', test: e => e.finalCategory === 'L1' },
  { id: 'L2', label: 'L2', test: e => e.finalCategory === 'L2' },
  { id: 'L3', label: 'L3', test: e => e.finalCategory === 'L3' },
  { id: 'not-flagged-L1', label: 'Not flagged but L1', test: e => e.flagCheck === 'not-flagged-L1' },
  { id: 'cannot-evaluate', label: 'Cannot evaluate', test: e => e.status === 'cannot-evaluate' },
  { id: 'overridden', label: 'Overridden', test: e => !!e.override },
];

const CHECK_FILTERS = {
  'duplicate-line-key': e => e.ldtWarnings?.some(w => w.type === 'duplicate-line-key'),
  'class-mismatch': e => e.ldtWarnings?.some(w => w.type === 'class-mismatch'),
  'multiple-sizes': e => e.warnings?.some(w => w.type === 'multiple-sizes'),
  'lower-case': e => e.ldtWarnings?.some(w => w.type === 'lower-case'),
};

export function EmptyState() {
  const { setUploadDrawerOpen, setDrawerFileKind } = useCll();
  const open = (kind) => { setDrawerFileKind(kind); setUploadDrawerOpen(true); };
  return (
    <div className="rd-card" style={{ padding: '3rem', textAlign: 'center' }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--rd-text-faint)" style={{ margin: '0 auto' }}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 16V4m0 0L8 8m4-4l4 4M4 20h16" />
      </svg>
      <p style={{ margin: '0.75rem 0 1.25rem', color: 'var(--rd-text-muted)' }}>
        Upload the Process Line List (LDT) to evaluate every line against the criteria table
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="rd-btn rd-btn-primary" onClick={() => open('processLineList')}>Upload Process Line List (LDT)</button>
        <button className="rd-btn rd-btn-secondary" onClick={() => open('stressCriteria')}>Upload criteria table</button>
      </div>
    </div>
  );
}

/** 3×3 grid crop around the evaluated cell. */
function GridCrop({ criteria, row, col }) {
  if (row == null || col == null || !criteria) return null;
  const rows = [row - 1, row, row + 1].filter(r => r >= 0 && r < 13);
  const cols = [col - 1, col, col + 1].filter(c => c >= 0 && c < 15);
  return (
    <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
      <thead>
        <tr>
          <th />
          {cols.map(c => (
            <th key={c} className="rd-text-muted" style={{ padding: 2, fontWeight: 400 }}>
              ≤{TEMP_LIMITS[c]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r}>
            <td className="rd-text-muted" style={{ padding: 2 }}>{NPS_ROW_LABELS[r]}"</td>
            {cols.map(c => {
              const cell = criteria.grid[r][c];
              const here = r === row && c === col;
              return (
                <td key={c} className="rd-mono" style={{
                  padding: '2px 6px', textAlign: 'center', borderRadius: 3,
                  background: CATEGORY_SOFT[cell],
                  outline: here ? '2px solid var(--rd-accent)' : 'none',
                  fontWeight: here ? 700 : 400,
                }}>
                  {cell}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LineDrawer({ line, onClose }) {
  const { criteria } = useCll();
  if (!line) return null;
  const l = line._line || {};
  const ROWS = [
    ['Line key', line.lineKey], ['Fluid', l.fluidCode],
    ['From', l.from], ['To', l.to],
    ['Pipe class', l.pipeClass],
    ['Operating P', l.operPressKgcm2 != null ? `${l.operPressKgcm2} kg/cm²g (${kgcm2ToBarg(l.operPressKgcm2)} barg)` : '—'],
    ['Operating T', l.operTempC != null ? `${l.operTempC} °C` : '—'],
    ['Test pressure', l.testPressKgcm2 != null ? `${l.testPressKgcm2} kg/cm²g` : '—'],
    ['Test media', l.testMedia],
    ['Insulation', [l.insulCode, l.insulThkMm != null ? `${l.insulThkMm} mm` : ''].filter(Boolean).join(' · ')],
    ['P&ID', l.pidNumber],
    ['Phase', l.phase],
    ['Paint criticality (LDT Appendix 4)', l.paintCriticality != null ? String(l.paintCriticality) : '—'],
    ['Comments', l.comments],
    ['LDT Rev', l.ldtRev],
  ];
  return (
    <>
      <div className="rd-drawer-backdrop" onClick={onClose} />
      <aside className="rd-drawer" role="dialog" aria-label={`Line ${line.lineNumber}`}>
        <header className="rd-drawer-header">
          <span className="rd-mono">{line.lineNumber}</span>
          <button className="rd-btn rd-btn-ghost rd-btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="rd-drawer-body">
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <span className={`rd-pill ${CAT_PILL[line.finalCategory] || 'rd-pill-neutral'}`}>
              {line.finalCategory || 'Cannot evaluate'}
            </span>
            {line.override && <span className="rd-pill rd-pill-warning">Overridden</span>}
            <span className={`rd-pill ${FLAG_PILL[line.flagCheck]?.pill || 'rd-pill-neutral'}`}>
              {FLAG_PILL[line.flagCheck]?.label || line.flagCheck}
            </span>
          </div>

          <h4 className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', fontWeight: 600, margin: '0 0 0.5rem' }}>
            HOW THE CATEGORY WAS FOUND
          </h4>
          {line.status === 'evaluated' ? (
            <div style={{ fontSize: 'var(--rd-text-body)' }}>
              <div>NPS <span className="rd-mono">{line.sizeText}</span> → row <span className="rd-mono">{NPS_ROW_LABELS[line.tableRow]}</span></div>
              <div style={{ marginTop: 2 }}>
                Design T <span className="rd-mono">{line.designTempC} °C</span> → column{' '}
                <span className="rd-mono">{TEMP_LABELS[line.tableCol]}</span>
              </div>
              <div style={{ marginTop: 2 }}>
                Result: <span className={`rd-pill ${CAT_PILL[line.tableCategory]}`}>{line.tableCategory}</span>
                {line.override && (
                  <span className="rd-text-muted" style={{ marginLeft: 6, fontSize: 'var(--rd-text-caption)' }}>
                    overridden to {line.finalCategory} — {line.override.reason}
                  </span>
                )}
              </div>
              <div style={{ marginTop: 8 }}><GridCrop criteria={criteria} row={line.tableRow} col={line.tableCol} /></div>
              <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', marginTop: 6 }}>{line.basis}</div>
              <div className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', marginTop: 2 }}>
                Method: {METHOD_TEXT[line.finalCategory]}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 'var(--rd-text-body)', color: 'var(--rd-warning)', margin: 0 }}>{line.basis}</p>
          )}

          <h4 className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', fontWeight: 600, margin: '1.25rem 0 0.5rem' }}>LINE DATA</h4>
          <dl>
            {ROWS.map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '0.5rem 0', borderBottom: '1px solid var(--rd-border-soft)' }}>
                <dt className="rd-text-muted" style={{ fontSize: 'var(--rd-text-body)' }}>{k}</dt>
                <dd className="rd-mono" style={{ color: 'var(--rd-text)', textAlign: 'right' }}>{v || '—'}</dd>
              </div>
            ))}
          </dl>

          {line.warnings.length > 0 && (
            <>
              <h4 className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)', fontWeight: 600, margin: '1.25rem 0 0.5rem' }}>WARNINGS</h4>
              {line.warnings.map((w, i) => (
                <div key={i} className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>⚠ {w.message}</div>
              ))}
            </>
          )}
        </div>
      </aside>
    </>
  );
}

export default function RegisterTab() {
  const { evaluation, files, reviewItems } = useCll();
  const [chip, setChip] = useState('all');
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();

  const urlCategory = searchParams.get('category');
  const urlStatus = searchParams.get('status');
  const urlCheck = searchParams.get('check');
  const urlCell = searchParams.get('cell');
  const urlFlag = searchParams.get('flag');
  const hasUrlFilter = urlCategory || urlStatus || urlCheck || urlCell || urlFlag;
  const clearUrlFilters = () => { setSearchParams({}, { replace: true }); setPage(0); };

  const kpis = useMemo(() => {
    if (!evaluation) return null;
    const { results, flagCheck } = evaluation;
    return {
      total: evaluation.evaluations.length,
      l1: results.L1, l2: results.L2, l3: results.L3,
      notFlaggedL1: flagCheck.notFlaggedL1,
      review: reviewItems.length,
    };
  }, [evaluation, reviewItems]);

  const filtered = useMemo(() => {
    if (!evaluation) return [];
    let lines = evaluation.evaluations;
    if (urlCategory) lines = lines.filter(e => e.finalCategory === urlCategory);
    if (urlStatus === 'cannot-evaluate') lines = lines.filter(e => e.status === 'cannot-evaluate');
    if (urlCheck && CHECK_FILTERS[urlCheck]) lines = lines.filter(CHECK_FILTERS[urlCheck]);
    if (urlFlag) lines = lines.filter(e => e.flagCheck === urlFlag);
    if (urlCell) {
      const [r, c] = urlCell.split(',').map(Number);
      lines = lines.filter(e => e.tableRow === r && e.tableCol === c);
    }
    const chipDef = CHIPS.find(c => c.id === chip);
    if (chipDef && chip !== 'all') lines = lines.filter(chipDef.test);
    return lines;
  }, [evaluation, chip, urlCategory, urlStatus, urlCheck, urlCell, urlFlag]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (!files.lineList) return <EmptyState />;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          ['Total lines', kpis.total, 'var(--rd-text)'],
          ['L1 · stress critical', kpis.l1, '#DC3545'],
          ['L2', kpis.l2, '#E3A02B'],
          ['L3', kpis.l3, '#12936F'],
          ['Not flagged but L1', kpis.notFlaggedL1, 'var(--rd-danger)'],
          ['Open review items', kpis.review, 'var(--rd-warning)'],
        ].map(([label, value, color]) => (
          <div key={label} className="rd-card rd-kpi">
            <div className="rd-kpi-value" style={{ color }}>{fmtNum(value)}</div>
            <div className="rd-kpi-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Filter chips + export */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {hasUrlFilter && (
          <span className="rd-pill rd-pill-info" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {[
              urlCategory && `Category: ${urlCategory}`,
              urlStatus === 'cannot-evaluate' && 'Cannot evaluate',
              urlCheck && `Check: ${urlCheck}`,
              urlCell && `Grid cell ${urlCell}`,
              urlFlag && FLAG_PILL[urlFlag]?.label,
            ].filter(Boolean).join(' · ')}
            <button onClick={clearUrlFilters} aria-label="Remove filters"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', fontWeight: 700 }}>✕</button>
          </span>
        )}
        {CHIPS.map(c => (
          <button key={c.id} onClick={() => { setChip(c.id); setPage(0); }}
            className={`rd-btn rd-btn-sm ${chip === c.id ? 'rd-btn-primary' : 'rd-btn-secondary'}`}>
            {c.label}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button className="rd-btn rd-btn-secondary rd-btn-sm"
          onClick={() => exportRegisterWorkbook(filtered, files.lineList?.rawHeaders || LDT_FIELDS.filter(f => f.required).map(f => f.label), { revision: files.lineList?.revision })}>
          Export (.xlsx)
        </button>
      </div>

      {/* Table */}
      <div className="rd-card" style={{ overflow: 'auto', maxHeight: '62vh' }}>
        <table className="rd-table">
          <thead>
            <tr>
              <th>Line Number</th><th>Line key</th><th>Fluid</th><th>Size</th><th>Class</th>
              <th>Design T (°C)</th><th>Design P (kg/cm²g)</th><th>Phase</th><th>P&ID</th>
              <th>LDT stress flag</th><th>Table category</th><th>Final category</th><th>Flag check</th><th></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((e, rowIdx) => {
              const l = e._line || {};
              const fp = FLAG_PILL[e.flagCheck] || FLAG_PILL['no-flag'];
              return (
                <tr key={`${e.lineNumber}-${rowIdx}`} style={{ cursor: 'pointer' }} onClick={() => setSelected(e)}>
                  <td className="rd-mono" style={{ color: 'var(--rd-accent)', fontWeight: 500 }}>{e.lineNumber}</td>
                  <td className="rd-mono">{e.lineKey}</td>
                  <td>{l.fluidCode}</td>
                  <td className="rd-mono">{e.sizeText}{e.warnings.some(w => w.type === 'multiple-sizes') ? ' ⚠' : ''}</td>
                  <td className="rd-mono">{l.pipeClass}</td>
                  <td className="rd-mono">{e.designTempC ?? '—'}</td>
                  <td className="rd-mono"
                    title={e.designPressKgcm2 != null ? `${kgcm2ToBarg(e.designPressKgcm2)} barg` : undefined}>
                    {e.designPressKgcm2 ?? '—'}
                  </td>
                  <td>{l.phase || '—'}</td>
                  <td className="rd-mono">{l.pidNumber || '—'}</td>
                  <td className="rd-mono">{e.ldtStressFlag || '—'}</td>
                  <td>{e.tableCategory
                    ? <span className={`rd-pill ${CAT_PILL[e.tableCategory]}`}>{e.tableCategory}</span>
                    : <span className="rd-text-muted">—</span>}</td>
                  <td>
                    {e.finalCategory
                      ? <span className={`rd-pill ${CAT_PILL[e.finalCategory]}`}
                          title={e.override ? `Override: ${e.override.reason}` : undefined}>
                          {e.finalCategory}{e.override ? ' · Overridden' : ''}
                        </span>
                      : <span className={`rd-pill ${CAT_PILL['Cannot evaluate']}`}>Cannot evaluate</span>}
                  </td>
                  <td><span className={`rd-pill ${fp.pill}`} style={{ whiteSpace: 'nowrap' }}>{fp.label}</span></td>
                  <td><button className="rd-btn rd-btn-ghost rd-btn-sm" onClick={ev => { ev.stopPropagation(); setSelected(e); }}>Open</button></td>
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr><td colSpan={14} style={{ textAlign: 'center', padding: '2rem', color: 'var(--rd-text-faint)' }}>
                No lines match the active filters
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <span className="rd-text-muted" style={{ fontSize: 'var(--rd-text-caption)' }}>
            {fmtNum(filtered.length)} lines · page {page + 1} of {pageCount}
          </span>
          <button className="rd-btn rd-btn-secondary rd-btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <button className="rd-btn rd-btn-secondary rd-btn-sm" disabled={page >= pageCount - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}

      <LineDrawer line={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
