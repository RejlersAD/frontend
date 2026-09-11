import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, Medal, CalendarDays, ShieldCheck, RefreshCw, X, Info } from 'lucide-react';
import analyticsService from '../../services/analyticsService';
import './MonthlyChampion.css';

const monthLabel = value => new Date(`${value}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const monthValue = (year, month) => `${year}-${String(month).padStart(2, '0')}`;
const utcDate = value => new Date(value).toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' });
const describeError = error => {
  const data = error?.response?.data;
  return data ? Object.values(data).flat().join(' ') : 'Could not load the monthly award. Try again.';
};

export default function MonthlyChampion() {
  const today = new Date();
  const [period, setPeriod] = useState(() => {
    const prior = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    return monthValue(prior.getUTCFullYear(), prior.getUTCMonth() + 1);
  });
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [review, setReview] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  const dialog = useRef(null);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setBusy(true); setError(''); setReport(null); setSearch(''); setPage(1);
    const [year, month] = period.split('-').map(Number);
    analyticsService.getMonthlyChampion(year, month, { signal: controller.signal }).then(result => { if (active) setReport(result); })
      .catch(err => { if (active) setError(describeError(err)); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; controller.abort(); };
  }, [period, revision]);
  useEffect(() => { if (review) dialog.current?.showModal(); }, [review]);
  const openReview = () => { setReason(''); setConfirmed(false); setSaveError(''); setReview(true); };
  const closeReview = () => { if (!saving) { dialog.current?.close(); setReview(false); } };
  const publish = async e => {
    e.preventDefault(); if (saving || !confirmed || reason.trim().length < 10) return;
    setSaving(true); setSaveError('');
    try {
      const [year, month] = period.split('-').map(Number);
      await analyticsService.publishMonthlyChampion({ year, month, fingerprint: report.fingerprint, reason: reason.trim() });
      dialog.current?.close(); setReview(false); setNotice(`AI Champion of the Month published for ${monthLabel(period)}.`); setRevision(v => v + 1);
    } catch (err) { setSaveError(describeError(err)); }
    finally { setSaving(false); }
  };
  const candidates = report?.candidates || [];
  const saved = report?.publication;
  const methodology = saved?.methodology || report?.methodology;
  const podium = saved?.podium || candidates.slice(0, 3);
  const winner = podium.find(row => row.rank === 1);
  const filtered = candidates.filter(row => `${row.user.name} ${row.user.email}`.toLowerCase().includes(search.toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const canReview = report?.can_publish && report.period.closed && candidates.length > 0 && !report.period_published;
  return <section className="mc-workspace">
    <header className="mc-heading"><div><h2><Trophy />AI Champion of the Month</h2><p>Monthly recognition based on recorded AI engagement, reviewed before publication.</p></div><div><label><CalendarDays /><span className="mc-sr-only">Award month</span><input aria-label="Award month" type="month" min="2000-01" max={monthValue(today.getUTCFullYear(), today.getUTCMonth() + 1)} value={period} onChange={e => { if (e.target.value) { setPeriod(e.target.value); setNotice(''); } }} /></label><button aria-label="Refresh monthly champion" disabled={busy} onClick={() => setRevision(v => v + 1)}><RefreshCw /></button></div></header>
    {notice && <div className="ad-info" role="status"><ShieldCheck />{notice}</div>}
    {error ? <div className="ad-error" role="alert"><h3>Monthly award unavailable</h3><p>{error}</p><button onClick={() => setRevision(v => v + 1)}>Retry monthly award</button></div> : busy ? <div className="ad-panel ad-empty" role="status">Loading monthly champion...</div> : report && <>
      <div className="mc-status"><span>{monthLabel(period)} · UTC calendar month · {report.scope}</span><span className="ad-chip">{report.period_published ? 'Published' : report.period.closed ? 'Awaiting review' : 'Provisional — month in progress'}</span></div>
      <div className="mc-layout"><div className="mc-main">
        <section className="ad-panel mc-winner"><div className="mc-award-icon"><Trophy /></div><div className="mc-winner-content"><span className="mc-eyebrow">{saved ? 'AI Champion of the Month' : 'Leading candidate · not yet awarded'}</span><h3>{winner?.user.name || (report.period_published ? 'No published winner in this organization' : 'No eligible candidate')}</h3><p>{winner?.user.email || 'At least one successful AI request is required. Browsing activity does not qualify.'}</p>{winner && <div className="mc-winner-stats"><span><strong>{winner.score}</strong>Engagement score / 100</span><span><strong>{winner.successful_requests}</strong>Successful requests</span><span><strong>{winner.active_days}</strong>Active AI days</span></div>}{saved && <p className="mc-citation">{saved.reason}</p>}</div><div className="mc-award-period"><Medal /><strong>{monthLabel(period)}</strong><span>{saved ? 'Reviewed award' : 'Live preview'}</span></div></section>
        {podium.length > 1 && <div className="mc-runners">{podium.filter(r => r.rank !== 1).map(row => <article className="ad-panel" key={row.user_id}><span className="mc-place">{row.rank}</span><div><h3>{row.user.name}</h3><p>{row.score} / 100 · {row.successful_requests} successful requests</p></div><Medal /></article>)}</div>}
        <section className="ad-panel"><div className="ad-panel-heading"><div><h2>{saved ? 'Current telemetry comparison' : 'Monthly candidates'}</h2><p>{saved ? 'Late telemetry may change this preview. The published award above retains its reviewed snapshot.' : 'AI requests only. Rankings use the methodology shown alongside.'}</p></div><span className="ad-count">{candidates.length}</span></div><div className="ad-filters"><input aria-label="Search monthly candidates" placeholder="Search name or email..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div><div className="ad-table-scroll"><table><thead><tr>{['Rank', 'Candidate', 'AI requests', 'Successful', 'Active days', 'Modules', 'Score'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{filtered.slice((page - 1) * 10, page * 10).map(row => <tr key={row.user_id}><td>{row.rank}</td><td>{row.user.name}<small>{row.user.email}</small></td><td>{row.requests}</td><td>{row.successful_requests} ({row.success_rate}%)</td><td>{row.active_days}</td><td>{row.modules}</td><td><strong>{row.score}</strong></td></tr>)}</tbody></table></div>{!filtered.length && <div className="ad-empty"><Trophy /><h3>{candidates.length ? 'No matching candidates' : 'No eligible candidates this month'}</h3><p>{candidates.length ? 'Try a different name or email.' : 'Choose another month with recorded successful AI requests. No award is created from missing data.'}</p></div>}<div className="ad-pagination"><span>{filtered.length} candidates</span><div><button aria-label="Previous candidates page" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>{page} / {pages}</span><button aria-label="Next candidates page" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div></div></section>
        <section className="ad-panel"><div className="ad-panel-heading"><h2>Published awards</h2></div>{report.history.length ? <div className="ad-table-scroll"><table><thead><tr><th>Month</th><th>Champion</th><th>Reviewed by</th><th>Published (UTC)</th></tr></thead><tbody>{report.history.map(award => <tr key={award.id}><td><button className="ad-row-link" onClick={() => setPeriod(monthValue(award.year, award.month))}>{monthLabel(monthValue(award.year, award.month))}</button></td><td>{award.podium.find(r => r.rank === 1)?.user.name || 'Other recognized participants in your organization'}</td><td>{award.reviewer}</td><td>{utcDate(award.published_at)}</td></tr>)}</tbody></table></div> : <p className="ad-footnote">No reviewed monthly awards have been published in this scope. Legacy automatic results remain in Enablement.</p>}</section>
      </div><aside className="ad-panel mc-methodology"><div className="ad-panel-heading"><h2>Recognition methodology</h2><ShieldCheck /></div><p>{methodology.eligibility}</p><div className="mc-weights">{Object.entries(methodology.weights).map(([key, weight]) => <div key={key}><span>{key.replaceAll('_', ' ')}</span><strong>{weight}%</strong>{winner && <small>{winner.breakdown[key]} points awarded</small>}</div>)}</div><p>{methodology.description}</p><div className="mc-method-note"><Info /><p>{methodology.limitations}</p></div><p>Scoring version: {methodology.version}</p><hr /><h3>Review and publication</h3>{saved ? <><p><strong>{saved.reviewer}</strong><br />Published {utcDate(saved.published_at)} UTC</p><p>The award snapshot and review reason are saved permanently. Recomputing legacy rankings cannot overwrite this award.</p></> : <><p>{!report.can_publish ? 'Only a Super Administrator can publish the organization-wide monthly award.' : !report.period.closed ? 'This month is still in progress. Review and publish after the month ends.' : report.period_published ? 'This period already has a published award outside the visible scope.' : 'Review the top three, scoring basis and telemetry limitations, then record the reason for recognition.'}</p><button className="ad-primary" disabled={!canReview} onClick={openReview}>Review monthly award</button></>}</aside></div>
    </>}
    {review && createPortal(<dialog ref={dialog} className="mc-review-dialog" aria-labelledby="mc-review-title" onCancel={e => { e.preventDefault(); closeReview(); }}><form onSubmit={publish}><header><div><h2 id="mc-review-title">Review monthly award</h2><p>{monthLabel(period)} · All organizations</p></div><button type="button" aria-label="Close award review" disabled={saving} onClick={closeReview}><X /></button></header><p>The top candidate becomes AI Champion of the Month. The top three and their scores will be saved as a permanent reviewed snapshot.</p><ol>{candidates.slice(0, 3).map(row => <li key={row.user_id}><strong>{row.user.name}</strong><span>{row.score} / 100 · {row.successful_requests} successful requests</span></li>)}</ol><label>Reason for recognition<textarea aria-label="Reason for recognition" required minLength={10} maxLength={2000} value={reason} disabled={saving} onChange={e => setReason(e.target.value)} placeholder="Explain why these recorded contributions merit recognition..." /></label><label className="mc-confirm"><input type="checkbox" checked={confirmed} disabled={saving} onChange={e => setConfirmed(e.target.checked)} />I reviewed the candidates and telemetry limitations. Request success does not prove verified business outcomes.</label>{saveError && <p role="alert" className="mc-save-error">{saveError} Close this review and refresh the preview before trying again.</p>}<footer><button type="button" onClick={closeReview} disabled={saving}>Cancel</button><button className="mc-publish" disabled={saving || !confirmed || reason.trim().length < 10 || !!saveError}>{saving ? 'Publishing...' : 'Publish monthly award'}</button></footer></form></dialog>, document.body)}
  </section>;
}
