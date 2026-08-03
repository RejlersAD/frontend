/**
 * Non-TEFF Smart Features Panel
 * ------------------------------------------------------------------
 * Self-contained slide-over panel that mounts on the Non-TEFF Metadata
 * page. It receives the already-extracted `items` array (and optional
 * `excerpt`) as props and provides 8 AI-powered analytic tabs:
 *
 *   1. Confidence heatmap   ( /smart/confidence/ )
 *   2. Repair Row           ( /smart/repair/ )
 *   3. Consistency issues   ( /smart/consistency/ )
 *   4. NL query bar         ( /smart/query/ )
 *   5. Classifier           ( /smart/classify/ )
 *   6. Tag auto-linker      ( /smart/auto-link/ )
 *   7. Revision timeline    ( /smart/timeline/ )
 *   8. Bulk-edit hints      ( /smart/bulk-suggest/ )
 *
 * The panel is ADDITIVE — it never mutates the parent's `items`. It
 * exposes a `filteredIndexes` callback so the parent can optionally
 * narrow its table when the NL query bar produces a filter spec.
 *
 * All thresholds, tab metadata and palette live in SMART_PANEL_CONFIG.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import apiClient from '../../../services/api.service';

// ---------------------------------------------------------------------------
// SOFT-CODED constants
// ---------------------------------------------------------------------------
const API_PREFIX = '/non-teff/smart';

const SMART_PANEL_CONFIG = {
  tabs: [
    { key: 'confidence',  label: 'Confidence',  icon: '🛡️', color: '#059669' },
    { key: 'repair',      label: 'Repair',      icon: '🛠️', color: '#0891b2' },
    { key: 'consistency', label: 'Consistency', icon: '⚖️', color: '#b45309' },
    { key: 'query',       label: 'Ask AI',      icon: '💬', color: '#7c3aed' },
    { key: 'classify',    label: 'Classify',    icon: '🏷️', color: '#0f766e' },
    { key: 'autolink',    label: 'Links',       icon: '🔗', color: '#1d4ed8' },
    { key: 'timeline',    label: 'Timeline',    icon: '🕒', color: '#9d174d' },
    { key: 'bulk',        label: 'Bulk Hints',  icon: '✨', color: '#b91c1c' },
  ],
  width:       'min(560px, 92vw)',
  zIndex:      9998,
  scoreColors: {
    high:   { bg: 'rgba(16,185,129,0.12)', text: '#047857', border: 'rgba(16,185,129,0.35)' }, // 80-100
    medium: { bg: 'rgba(245,158,11,0.12)', text: '#b45309', border: 'rgba(245,158,11,0.35)' }, // 50-79
    low:    { bg: 'rgba(239,68,68,0.12)',  text: '#b91c1c', border: 'rgba(239,68,68,0.35)' },  // 0-49
  },
  severityColors: {
    high:   '#b91c1c',
    medium: '#b45309',
    low:    '#0891b2',
  },
};

function bandFor(score) {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

// Tiny memoised POST helper — never throws into the UI tree.
async function postSmart(path, body, signal) {
  try {
    const res = await apiClient.post(`${API_PREFIX}${path}`, body, {
      timeout: 60000,
      signal,
    });
    return { ok: true, data: res.data };
  } catch (err) {
    if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
      return { ok: false, cancelled: true };
    }
    const msg = err?.response?.data?.error || err?.message || 'Request failed.';
    return { ok: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Visual primitives
// ---------------------------------------------------------------------------
const Pill = ({ children, tone = 'medium', style = {} }) => {
  const c = SMART_PANEL_CONFIG.scoreColors[tone] || SMART_PANEL_CONFIG.scoreColors.medium;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 999,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      fontSize: '0.7rem', fontWeight: 700, ...style,
    }}>{children}</span>
  );
};

const Section = ({ title, hint, children }) => (
  <div style={{ marginBottom: 18 }}>
    {title && (
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#1f2937' }}>{title}</h4>
        {hint && <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{hint}</span>}
      </div>
    )}
    {children}
  </div>
);

const Spinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: '0.8rem' }}>
    <div style={{
      width: 14, height: 14, borderRadius: '50%',
      border: '2px solid rgba(5,150,105,0.2)', borderTopColor: '#059669',
      animation: 'sfSpin 0.8s linear infinite',
    }} />
    Working…
  </div>
);

const Empty = ({ msg }) => (
  <div style={{
    border: '1px dashed rgba(148,163,184,0.4)', borderRadius: 10,
    padding: '14px 16px', color: '#64748b', fontSize: '0.8rem',
    background: 'rgba(248,250,252,0.6)',
  }}>{msg}</div>
);

const ErrorBox = ({ msg }) => (
  <div style={{
    border: '1px solid rgba(239,68,68,0.35)', borderRadius: 10,
    padding: '10px 14px', color: '#b91c1c', fontSize: '0.78rem',
    background: 'rgba(254,226,226,0.5)',
  }}>{msg}</div>
);

const ActionBtn = ({ onClick, disabled, children, tone = 'primary' }) => {
  const tones = {
    primary: { bg: 'linear-gradient(90deg,#059669,#0891b2)', text: '#fff', border: 'transparent' },
    ghost:   { bg: 'rgba(255,255,255,0.8)', text: '#065f46', border: 'rgba(5,150,105,0.3)' },
  };
  const t = tones[tone] || tones.primary;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '8px 14px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 700,
      background: t.bg, color: t.text, border: `1px solid ${t.border}`,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1,
      transition: 'transform 0.1s ease',
    }}>{children}</button>
  );
};


// ===========================================================================
// 1. CONFIDENCE TAB
// ===========================================================================
const ConfidenceTab = ({ items, columns }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  const run = useCallback(async () => {
    if (!items?.length) return;
    setLoading(true); setErr('');
    const r = await postSmart('/confidence/', { items });
    setLoading(false);
    if (r.ok) setData(r.data); else setErr(r.error || 'Failed.');
  }, [items]);

  useEffect(() => { run(); }, [run]);

  if (loading) return <Spinner />;
  if (err)     return <ErrorBox msg={err} />;
  if (!data)   return <Empty msg="No data yet." />;

  const reviewRows = data.scores.filter(s => s.needs_review);
  const tone = bandFor(data.overall);

  return (
    <>
      <Section title="Overall batch confidence">
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
          borderRadius: 12,
          background: SMART_PANEL_CONFIG.scoreColors[tone].bg,
          border: `1px solid ${SMART_PANEL_CONFIG.scoreColors[tone].border}`,
        }}>
          <div style={{
            fontSize: '2rem', fontWeight: 800,
            color: SMART_PANEL_CONFIG.scoreColors[tone].text,
          }}>{data.overall}<span style={{ fontSize: '0.9rem' }}>/100</span></div>
          <div style={{ fontSize: '0.78rem', color: '#475569' }}>
            {reviewRows.length} of {data.scores.length} row(s) below the review threshold ({data.review_threshold}).
          </div>
        </div>
      </Section>

      <Section title="Cell heatmap" hint="green = high · amber = medium · red = low">
        <div style={{
          maxHeight: 320, overflow: 'auto',
          border: '1px solid rgba(5,150,105,0.12)', borderRadius: 10,
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
            <thead>
              <tr style={{ background: 'rgba(5,150,105,0.06)', position: 'sticky', top: 0 }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: '#374151' }}>#</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: '#374151' }}>Row</th>
                {columns.map(c => (
                  <th key={c.key} style={{ padding: '6px 4px', textAlign: 'center', color: '#374151', whiteSpace: 'nowrap' }}>
                    {c.label.replace(/\..*$/, '')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.scores.map(s => (
                <tr key={s.row_idx} style={{ borderTop: '1px solid rgba(5,150,105,0.06)' }}>
                  <td style={{ padding: '4px 8px', color: '#94a3b8' }}>{s.row_idx + 1}</td>
                  <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>
                    <Pill tone={bandFor(s.row_overall)}>{s.row_overall}</Pill>
                  </td>
                  {columns.map(c => {
                    const v = s.cells[c.key] ?? 0;
                    const tn = SMART_PANEL_CONFIG.scoreColors[bandFor(v)];
                    return (
                      <td key={c.key} title={`${c.label}: ${v}`} style={{
                        padding: 0, textAlign: 'center',
                        background: v === 0 ? 'transparent' : tn.bg,
                        color: tn.text, fontWeight: 700,
                        width: 28,
                      }}>{v === 0 ? '—' : v}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
};


// ===========================================================================
// 2. REPAIR TAB
// ===========================================================================
const RepairTab = ({ items, excerpt }) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [accepted, setAccepted] = useState({});

  const run = useCallback(async () => {
    if (!items?.length) return;
    setLoading(true); setErr(''); setData(null); setAccepted({});
    const r = await postSmart('/repair/', { row: items[selectedIdx] || {}, text_excerpt: excerpt || '' });
    setLoading(false);
    if (r.ok) setData(r.data); else setErr(r.error || 'Failed.');
  }, [items, selectedIdx, excerpt]);

  if (!items?.length) return <Empty msg="Upload a document first." />;

  return (
    <>
      <Section title="Pick a row to repair" hint="AI proposes — you decide.">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={selectedIdx} onChange={e => setSelectedIdx(Number(e.target.value))} style={{
            flex: 1, minWidth: 220, padding: '8px 10px', borderRadius: 8,
            border: '1px solid rgba(5,150,105,0.25)', fontSize: '0.8rem',
            background: '#fff', color: '#334155',
          }}>
            {items.map((r, i) => (
              <option key={i} value={i}>
                #{i + 1} · {(r.document_no || r.document_title || '(blank)').slice(0, 60)}
              </option>
            ))}
          </select>
          <ActionBtn onClick={run} disabled={loading}>Repair Row</ActionBtn>
        </div>
      </Section>

      {loading && <Spinner />}
      {err && <ErrorBox msg={err} />}

      {data && (
        <Section title="Proposed fixes" hint={`provider: ${data.provider || '—'}`}>
          {Object.keys(data.fixes || {}).length === 0 ? (
            <Empty msg="No corrections needed — row looks complete." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(data.fixes).map(([field, fix]) => (
                <div key={field} style={{
                  border: '1px solid rgba(5,150,105,0.18)', borderRadius: 10,
                  padding: '10px 12px', background: 'rgba(240,253,244,0.6)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <strong style={{ fontSize: '0.78rem', color: '#065f46' }}>{field}</strong>
                    <Pill tone={fix.confidence === 'high' ? 'high' : fix.confidence === 'low' ? 'low' : 'medium'}>
                      {fix.confidence}
                    </Pill>
                    {accepted[field] && <span style={{ fontSize: '0.7rem', color: '#059669' }}>✓ accepted</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <code style={{
                      padding: '4px 8px', borderRadius: 6, background: '#ecfdf5',
                      color: '#065f46', fontSize: '0.78rem', fontWeight: 700,
                    }}>{fix.value}</code>
                    <button onClick={() => setAccepted(a => ({ ...a, [field]: true }))} style={{
                      padding: '3px 10px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700,
                      background: 'transparent', color: '#059669',
                      border: '1px solid rgba(5,150,105,0.4)', cursor: 'pointer',
                    }}>Accept</button>
                  </div>
                  <div style={{ marginTop: 6, fontSize: '0.72rem', color: '#475569' }}>
                    {fix.reason}
                  </div>
                </div>
              ))}
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 4 }}>
                Accepted fixes are shown for your reference — copy values into the table or
                Excel export manually. (Auto-apply is intentionally disabled.)
              </div>
            </div>
          )}
        </Section>
      )}
    </>
  );
};


// ===========================================================================
// 3. CONSISTENCY TAB
// ===========================================================================
const ConsistencyTab = ({ items }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!items?.length) return;
      setLoading(true); setErr('');
      const r = await postSmart('/consistency/', { items });
      if (cancelled) return;
      setLoading(false);
      if (r.ok) setData(r.data); else setErr(r.error || 'Failed.');
    })();
    return () => { cancelled = true; };
  }, [items]);

  if (loading) return <Spinner />;
  if (err)     return <ErrorBox msg={err} />;
  if (!data)   return <Empty msg="Run the check by reopening this tab." />;

  if (!data.issues?.length) {
    return (
      <Empty msg="No cross-document inconsistencies detected. 🎉" />
    );
  }

  return (
    <>
      <Section title="Summary">
        <div style={{ display: 'flex', gap: 8 }}>
          <Pill tone="low">{data.summary.high} high</Pill>
          <Pill tone="medium">{data.summary.medium} medium</Pill>
          <Pill tone="high">{data.summary.low} low</Pill>
        </div>
      </Section>
      <Section title="Issues">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.issues.map((iss, i) => (
            <div key={i} style={{
              border: '1px solid rgba(148,163,184,0.25)', borderRadius: 10,
              padding: '10px 12px', background: '#fff',
              borderLeft: `4px solid ${SMART_PANEL_CONFIG.severityColors[iss.severity] || '#94a3b8'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <strong style={{ fontSize: '0.74rem', color: '#1f2937' }}>{iss.type.replace(/_/g, ' ')}</strong>
                <Pill tone={iss.severity === 'high' ? 'low' : iss.severity === 'medium' ? 'medium' : 'high'}>
                  {iss.severity}
                </Pill>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#374151' }}>{iss.message}</div>
              {iss.row_indexes?.length > 0 && (
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 4 }}>
                  Rows: {iss.row_indexes.map(i => i + 1).join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>
    </>
  );
};


// ===========================================================================
// 4. NL QUERY TAB
// ===========================================================================
const QueryTab = ({ items, onApplyFilter }) => {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  const run = useCallback(async () => {
    if (!q.trim()) return;
    setLoading(true); setErr(''); setData(null);
    const r = await postSmart('/query/', { query: q, items });
    setLoading(false);
    if (r.ok) setData(r.data); else setErr(r.error || 'Failed.');
  }, [q, items]);

  const apply = () => {
    if (!data?.filters?.length) return;
    // Compute matching row indexes client-side and bubble up.
    const idxs = [];
    items.forEach((r, i) => {
      const ok = data.filters.every(f => {
        const v = String(r[f.field] ?? '').toLowerCase();
        const target = String(f.value || '').toLowerCase();
        switch (f.op) {
          case 'equals':      return v === target;
          case 'starts_with': return v.startsWith(target);
          case 'ends_with':   return v.endsWith(target);
          case 'regex':
            try { return new RegExp(f.value, 'i').test(v); } catch { return false; }
          default:            return v.includes(target);
        }
      });
      if (ok) idxs.push(i);
    });
    onApplyFilter?.(idxs, q);
  };

  return (
    <>
      <Section title="Ask in plain English" hint="e.g. ‘all IFA documents from October with PT-* tags’">
        <textarea value={q} onChange={e => setQ(e.target.value)} rows={2}
          placeholder="Describe what you want to find…"
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 10,
            border: '1px solid rgba(124,58,237,0.25)', fontSize: '0.85rem',
            color: '#334155', background: '#fff', boxSizing: 'border-box',
            outline: 'none', resize: 'vertical', fontFamily: 'inherit',
          }}
        />
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <ActionBtn onClick={run} disabled={loading || !q.trim()}>Translate</ActionBtn>
          {data?.filters?.length > 0 && (
            <ActionBtn onClick={apply} tone="ghost">
              Apply filter ({data.matched_count} match{data.matched_count === 1 ? '' : 'es'})
            </ActionBtn>
          )}
        </div>
      </Section>

      {loading && <Spinner />}
      {err && <ErrorBox msg={err} />}

      {data && (
        <Section title="Interpretation" hint={`provider: ${data.provider || '—'}`}>
          <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: 8 }}>
            {data.explanation}
          </div>
          {data.filters?.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.filters.map((f, i) => (
                <div key={i} style={{
                  padding: '6px 10px', borderRadius: 8, background: '#faf5ff',
                  border: '1px solid rgba(124,58,237,0.25)', fontSize: '0.78rem', color: '#581c87',
                }}>
                  <code>{f.field}</code> <em>{f.op}</em> <code>{f.value}</code>
                </div>
              ))}
            </div>
          ) : (
            <Empty msg="No structured filter produced — try rephrasing." />
          )}
        </Section>
      )}
    </>
  );
};


// ===========================================================================
// 5. CLASSIFY TAB
// ===========================================================================
const ClassifyTab = ({ items }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!items?.length) return;
      setLoading(true); setErr('');
      const r = await postSmart('/classify/', { items });
      if (cancelled) return;
      setLoading(false);
      if (r.ok) setData(r.data); else setErr(r.error || 'Failed.');
    })();
    return () => { cancelled = true; };
  }, [items]);

  if (loading) return <Spinner />;
  if (err)     return <ErrorBox msg={err} />;
  if (!data)   return <Empty msg="No classifications." />;

  return (
    <>
      <Section title="Document type distribution">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Object.entries(data.type_distribution || {}).map(([t, c]) => (
            <Pill key={t} tone="high">{t} · {c}</Pill>
          ))}
          {Object.keys(data.type_distribution || {}).length === 0 && <Empty msg="No types inferred." />}
        </div>
      </Section>
      <Section title="Discipline distribution">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Object.entries(data.discipline_distribution || {}).map(([t, c]) => (
            <Pill key={t} tone="medium">{t} · {c}</Pill>
          ))}
          {Object.keys(data.discipline_distribution || {}).length === 0 && <Empty msg="No disciplines inferred." />}
        </div>
      </Section>
      <Section title="Per-row classification">
        <div style={{
          maxHeight: 320, overflow: 'auto',
          border: '1px solid rgba(15,118,110,0.15)', borderRadius: 10,
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
            <thead>
              <tr style={{ background: 'rgba(15,118,110,0.06)', position: 'sticky', top: 0 }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: '#374151' }}>#</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: '#374151' }}>Doc No.</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: '#374151' }}>Type</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: '#374151' }}>Discipline</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: '#374151' }}>Conf.</th>
              </tr>
            </thead>
            <tbody>
              {data.classifications.map(c => (
                <tr key={c.row_idx} style={{ borderTop: '1px solid rgba(15,118,110,0.06)' }}>
                  <td style={{ padding: '4px 8px', color: '#94a3b8' }}>{c.row_idx + 1}</td>
                  <td style={{ padding: '4px 8px', color: '#374151' }}>{c.document_no || '—'}</td>
                  <td style={{ padding: '4px 8px', color: '#0f766e', fontWeight: 600 }}>{c.doc_type || '—'}</td>
                  <td style={{ padding: '4px 8px', color: '#374151' }}>{c.discipline || '—'}</td>
                  <td style={{ padding: '4px 8px' }}>
                    <Pill tone={c.confidence === 'high' ? 'high' : c.confidence === 'low' ? 'low' : 'medium'}>
                      {c.confidence}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
};


// ===========================================================================
// 6. AUTO-LINK TAB
// ===========================================================================
const AutoLinkTab = ({ items }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!items?.length) return;
      setLoading(true); setErr('');
      const r = await postSmart('/auto-link/', { items });
      if (cancelled) return;
      setLoading(false);
      if (r.ok) setData(r.data); else setErr(r.error || 'Failed.');
    })();
    return () => { cancelled = true; };
  }, [items]);

  if (loading) return <Spinner />;
  if (err)     return <ErrorBox msg={err} />;
  if (!data)   return <Empty msg="No data." />;

  return (
    <>
      <Section title="Tag index">
        <div style={{ display: 'flex', gap: 10 }}>
          <Pill tone="high">{data.total_tags} unique tags</Pill>
          <Pill tone="medium">{data.total_links} cross-refs</Pill>
        </div>
      </Section>
      <Section title="Cross-references found">
        {!data.links?.length ? (
          <Empty msg="No tag cross-references inside this batch." />
        ) : (
          <div style={{
            maxHeight: 320, overflow: 'auto',
            border: '1px solid rgba(29,78,216,0.15)', borderRadius: 10,
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
              <thead>
                <tr style={{ background: 'rgba(29,78,216,0.06)', position: 'sticky', top: 0 }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>Row</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>Field</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>Tag</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>Kind</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>Linked rows</th>
                </tr>
              </thead>
              <tbody>
                {data.links.map((l, i) => (
                  <tr key={i} style={{ borderTop: '1px solid rgba(29,78,216,0.06)' }}>
                    <td style={{ padding: '4px 8px', color: '#94a3b8' }}>#{l.row_idx + 1}</td>
                    <td style={{ padding: '4px 8px' }}>{l.field}</td>
                    <td style={{ padding: '4px 8px' }}><code style={{ color: '#1d4ed8' }}>{l.tag}</code></td>
                    <td style={{ padding: '4px 8px' }}>{l.tag_kind}</td>
                    <td style={{ padding: '4px 8px' }}>
                      {l.linked_rows.map(i => `#${i + 1}`).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
};


// ===========================================================================
// 7. TIMELINE TAB
// ===========================================================================
const TimelineTab = ({ items }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!items?.length) return;
      setLoading(true); setErr('');
      const r = await postSmart('/timeline/', { items });
      if (cancelled) return;
      setLoading(false);
      if (r.ok) setData(r.data); else setErr(r.error || 'Failed.');
    })();
    return () => { cancelled = true; };
  }, [items]);

  if (loading) return <Spinner />;
  if (err)     return <ErrorBox msg={err} />;
  if (!data)   return <Empty msg="No timeline." />;

  return (
    <>
      <Section title="Overview">
        <div style={{ display: 'flex', gap: 8 }}>
          <Pill tone="high">{data.multi_revision_count} multi-rev docs</Pill>
          <Pill tone="medium">{data.single_revision_count} single-rev</Pill>
        </div>
      </Section>
      {data.groups?.length === 0 ? (
        <Empty msg="No document_no groups." />
      ) : (
        <Section title="Revision history">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {data.groups.map(g => (
              <div key={g.document_no} style={{
                border: '1px solid rgba(157,23,77,0.18)', borderRadius: 10,
                padding: '10px 12px', background: '#fff',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                  <strong style={{ fontSize: '0.78rem', color: '#9d174d' }}>{g.document_no}</strong>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{g.title}</span>
                </div>
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 4,
                  borderLeft: '2px solid rgba(157,23,77,0.25)', paddingLeft: 12, marginLeft: 4,
                }}>
                  {g.revisions.map((rv, i) => (
                    <div key={i} style={{ fontSize: '0.74rem', color: '#374151' }}>
                      <strong style={{ color: '#9d174d' }}>Rev {rv.revision}</strong>
                      {rv.date && <span style={{ color: '#64748b' }}> · {rv.date}</span>}
                      {rv.status && <span style={{ color: '#0891b2' }}> · {rv.status}</span>}
                      <span style={{ color: '#94a3b8' }}> · {rv.tag_count} tags</span>
                      {rv.diff_summary && (
                        <div style={{ fontSize: '0.7rem', color: '#475569', marginLeft: 8 }}>
                          ↳ {rv.diff_summary}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
};


// ===========================================================================
// 8. BULK HINTS TAB
// ===========================================================================
const BulkTab = ({ items }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  const run = useCallback(async () => {
    if (!items?.length) return;
    setLoading(true); setErr(''); setData(null);
    const r = await postSmart('/bulk-suggest/', { items });
    setLoading(false);
    if (r.ok) setData(r.data); else setErr(r.error || 'Failed.');
  }, [items]);

  useEffect(() => { run(); }, [run]);

  if (loading) return <Spinner />;
  if (err)     return <ErrorBox msg={err} />;
  if (!data)   return <Empty msg="No suggestions." />;

  return (
    <>
      <Section title="Pattern-based suggestions" hint={`${data.selected_count} rows analysed`}>
        {data.note && <Empty msg={data.note} />}
        {!data.suggestions?.length && !data.note && (
          <Empty msg="No high-support patterns to suggest. Your data already looks consistent. 👍" />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.suggestions?.map((s, i) => (
            <div key={i} style={{
              border: '1px solid rgba(185,28,28,0.2)', borderRadius: 10,
              padding: '10px 12px', background: 'rgba(254,242,242,0.5)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <strong style={{ fontSize: '0.76rem', color: '#1f2937' }}>{s.field}</strong>
                <Pill tone={s.support >= 0.8 ? 'high' : s.support >= 0.6 ? 'medium' : 'low'}>
                  support {(s.support * 100).toFixed(0)}%
                </Pill>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#374151' }}>
                Apply <code style={{ background: '#fee2e2', padding: '1px 6px', borderRadius: 4, color: '#991b1b' }}>{s.value}</code> to {s.applies_to_rows.length} blank rows
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 4 }}>{s.rationale}</div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
};


// ===========================================================================
// Main panel
// ===========================================================================
const NonTeffSmartFeatures = ({ open, onClose, items, columns, excerpt, onApplyFilter }) => {
  const [active, setActive] = useState('confidence');

  // Keyboard ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const noItems = !items || items.length === 0;

  return (
    <>
      <style>{`
        @keyframes sfSpin   { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes sfSlide  { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes sfFade   { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)',
        backdropFilter: 'blur(2px)', zIndex: SMART_PANEL_CONFIG.zIndex,
        animation: 'sfFade 0.2s ease',
      }} />

      {/* Slide-over panel */}
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: SMART_PANEL_CONFIG.width,
        background: '#f8fafc', boxShadow: '-12px 0 48px rgba(15,23,42,0.18)',
        zIndex: SMART_PANEL_CONFIG.zIndex + 1,
        display: 'flex', flexDirection: 'column',
        animation: 'sfSlide 0.25s cubic-bezier(0.2,0.9,0.25,1)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(90deg,#059669,#0891b2)',
          color: '#fff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.7rem', opacity: 0.85, letterSpacing: 1 }}>NON-TEFF</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>AI Insights</div>
            </div>
            <button onClick={onClose} aria-label="Close" style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: 'rgba(255,255,255,0.18)', color: '#fff', cursor: 'pointer',
              fontSize: '1.1rem', fontWeight: 700,
            }}>✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 4, padding: '8px 12px',
          background: '#fff', borderBottom: '1px solid rgba(148,163,184,0.2)',
          overflowX: 'auto',
        }}>
          {SMART_PANEL_CONFIG.tabs.map(t => {
            const isActive = active === t.key;
            return (
              <button key={t.key} onClick={() => setActive(t.key)} style={{
                padding: '6px 10px', borderRadius: 8, fontSize: '0.72rem',
                fontWeight: 700, whiteSpace: 'nowrap',
                background: isActive ? t.color : 'transparent',
                color: isActive ? '#fff' : '#475569',
                border: `1px solid ${isActive ? t.color : 'rgba(148,163,184,0.3)'}`,
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}>
                <span style={{ marginRight: 4 }}>{t.icon}</span>{t.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '18px 20px' }}>
          {noItems ? (
            <Empty msg="Extract a document first — then come back here." />
          ) : (
            <>
              {active === 'confidence'  && <ConfidenceTab  items={items} columns={columns} />}
              {active === 'repair'      && <RepairTab      items={items} excerpt={excerpt} />}
              {active === 'consistency' && <ConsistencyTab items={items} />}
              {active === 'query'       && <QueryTab       items={items} onApplyFilter={onApplyFilter} />}
              {active === 'classify'    && <ClassifyTab    items={items} />}
              {active === 'autolink'    && <AutoLinkTab    items={items} />}
              {active === 'timeline'    && <TimelineTab    items={items} />}
              {active === 'bulk'        && <BulkTab        items={items} />}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 16px', fontSize: '0.68rem', color: '#94a3b8',
          background: '#fff', borderTop: '1px solid rgba(148,163,184,0.2)',
        }}>
          All suggestions are advisory — the underlying extracted data is never modified.
        </div>
      </aside>
    </>
  );
};

export default NonTeffSmartFeatures;
