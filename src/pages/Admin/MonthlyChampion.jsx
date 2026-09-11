import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
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

function ChampionPhoto({ user, photos, large = false }) {
  const src = photos?.[user.id];
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return <span className={`mc-avatar${large ? ' mc-avatar-large' : ''}`}>
    {src && !failed ? <img src={src} alt={`${user.name} profile`} onError={() => setFailed(true)} /> : <span aria-hidden="true">{(user.name || user.email || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span>}
  </span>;
}

ChampionPhoto.propTypes = { user: PropTypes.shape({ id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), name: PropTypes.string, email: PropTypes.string }).isRequired, photos: PropTypes.object, large: PropTypes.bool };

export default function MonthlyChampion() {
  const today = new Date();
  const [period, setPeriod] = useState(() => monthValue(today.getUTCFullYear(), today.getUTCMonth() + 1));
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [review, setReview] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [reviewData, setReviewData] = useState(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const selectionPeriod = useRef(null);
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
    analyticsService.getMonthlyChampion(year, month, { signal: controller.signal }).then(result => { if (active) {
      setReport(result);
      const samePeriod = selectionPeriod.current === period;
      setSelectedIds(previous => samePeriod ? previous.filter(id => result.candidates.some(row => String(row.user_id) === id)) : result.candidates.slice(0, 20).map(row => String(row.user_id)));
      selectionPeriod.current = period;
    } })
      .catch(err => { if (active) setError(describeError(err)); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; controller.abort(); };
  }, [period, revision]);
  useEffect(() => { if (review) dialog.current?.showModal(); }, [review]);
  const openReview = async () => {
    setReason(''); setConfirmed(false); setSaveError(''); setReviewData(null); setReview(true); setReviewBusy(true);
    try {
      const [year, month] = period.split('-').map(Number);
      const preview = await analyticsService.getMonthlyChampion(year, month, { params: { selected_user_ids: selectedIds.join(',') } });
      setReviewData(preview);
    } catch (err) { setSaveError(describeError(err)); }
    finally { setReviewBusy(false); }
  };
  const closeReview = () => { if (!saving && !reviewBusy) { dialog.current?.close(); setReview(false); } };
  const publish = async e => {
    e.preventDefault(); if (saving || reviewBusy || !reviewData || !confirmed || reason.trim().length < 10) return;
    setSaving(true); setSaveError('');
    try {
      const [year, month] = period.split('-').map(Number);
      await analyticsService.publishMonthlyChampion({ year, month, fingerprint: reviewData.fingerprint, reason: reason.trim(), selected_user_ids: reviewData.selected_user_ids || selectedIds });
      dialog.current?.close(); setReview(false); setNotice(`AI Champion of the Month published for ${monthLabel(period)}.`); setRevision(v => v + 1);
    } catch (err) { setSaveError(describeError(err)); }
    finally { setSaving(false); }
  };
  const candidates = report?.candidates || [];
  const saved = report?.publication;
  const methodology = saved?.methodology || report?.methodology;
  const shortlist = candidates.filter(row => selectedIds.includes(String(row.user_id))).map((row, index) => ({ ...row, rank: index + 1 }));
  const podium = saved?.podium || shortlist.slice(0, 10);
  const reviewRows = reviewData?.shortlist || reviewData?.candidates || [];
  const toggleSelected = id => setSelectedIds(previous => previous.includes(id) ? previous.filter(value => value !== id) : previous.length < 20 ? [...previous, id] : previous);
  const winner = podium.find(row => row.rank === 1);
  const filtered = candidates.filter(row => `${row.user.name} ${row.user.email}`.toLowerCase().includes(search.toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const canReview = report?.can_publish && report.period.closed && shortlist.length > 0 && !report.period_published;
  return <section className="mc-workspace">
    <header className="mc-heading"><div><h2><Trophy />AI Champion of the Month</h2><p>Monthly recognition based on recorded RADAI activity, including page visits, reviewed before publication.</p></div><div><label><CalendarDays /><span className="mc-sr-only">Award month</span><input aria-label="Award month" type="month" min="2000-01" max={monthValue(today.getUTCFullYear(), today.getUTCMonth() + 1)} value={period} onChange={e => { if (e.target.value) { setPeriod(e.target.value); setNotice(''); } }} /></label><button aria-label="Refresh monthly champion" disabled={busy} onClick={() => setRevision(v => v + 1)}><RefreshCw /></button></div></header>
    {notice && <div className="ad-info" role="status"><ShieldCheck />{notice}</div>}
    {error ? <div className="ad-error" role="alert"><h3>Monthly award unavailable</h3><p>{error}</p><button onClick={() => setRevision(v => v + 1)}>Retry monthly award</button></div> : busy ? <div className="ad-panel ad-empty" role="status">Loading monthly champion...</div> : report && <>
      <div className="mc-status"><span>{monthLabel(period)} · UTC calendar month · {report.scope}</span><span className="ad-chip">{report.period_published ? 'Published' : report.period.closed ? 'Awaiting review' : 'Provisional — month in progress'}</span></div>
      <div className="mc-layout"><div className="mc-main">
        <section className="ad-panel mc-winner"><div className="mc-award-icon">{winner ? <ChampionPhoto user={winner.user} photos={report.profile_photos} large /> : <Trophy />}</div><div className="mc-winner-content"><span className="mc-eyebrow">{saved ? 'AI Champion of the Month' : 'Leading candidate · not yet awarded'}</span><h3>{winner?.user.name || (report.period_published ? 'No published winner in this organization' : candidates.length ? 'Select employees to rank' : 'No eligible candidate')}</h3><p>{winner?.user.email || (candidates.length && !report.period_published ? 'Use the checkboxes below or Select top 20 to build the employee shortlist.' : 'No recorded RADAI activity was found for an active account in this month and scope. Page visits qualify; a model API call is not required.')}</p>{winner && <div className="mc-winner-stats"><span><strong>{winner.score}</strong>Engagement score / 100</span><span><strong>{winner.activity_count ?? winner.successful_requests}</strong>{winner.activity_count != null ? 'RADAI activities' : 'Successful requests'}</span><span><strong>{winner.active_days}</strong>Active RADAI days</span></div>}{saved && <p className="mc-citation">{saved.reason}</p>}</div><div className="mc-award-period"><Medal /><strong>{monthLabel(period)}</strong><span>{saved ? 'Reviewed award' : 'Live preview'}</span></div></section>
        {podium.length > 1 && <div className="mc-runners">{podium.filter(r => r.rank !== 1).map(row => <article className="ad-panel" key={row.user_id}><span className="mc-place">{row.rank}</span><ChampionPhoto user={row.user} photos={report.profile_photos} /><div><h3>{row.user.name}</h3><p>{row.score} / 100 · {row.activity_count ?? row.successful_requests} {row.activity_count != null ? 'RADAI activities' : 'successful requests'}</p></div><Medal /></article>)}</div>}
        <section className="ad-panel"><div className="ad-panel-heading"><div><h2>{saved ? 'Current telemetry comparison' : 'Monthly candidates'}</h2><p>{saved ? 'This comparison uses the current RADAI activity policy. The published award above retains its original reviewed rules and snapshot.' : 'Select up to 20 employees. Their RADAI activity scores determine ranks; the top 10 are recognized. Page visits count.'}</p></div><span className="ad-count">{candidates.length}</span></div><div className="mc-shortlist-toolbar"><strong>{shortlist.length} / 20 employees selected</strong><span>{shortlist.length ? `Ranks 1?${Math.min(10, shortlist.length)} recognized` : "Select employees to rank"}</span><button disabled={report.period_published} onClick={() => setSelectedIds(candidates.slice(0, 20).map(row => String(row.user_id)))}>Select top 20</button><button disabled={report.period_published || !selectedIds.length} onClick={() => setSelectedIds([])}>Clear selection</button></div><div className="ad-filters"><input aria-label="Search monthly candidates" placeholder="Search name or email..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div><div className="ad-table-scroll"><table><thead><tr>{['Select', 'Rank', 'Candidate', 'RADAI activities', 'Recorded success', 'Active days', 'Modules', 'Score'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{filtered.slice((page - 1) * 10, page * 10).map(row => <tr key={row.user_id}><td><input type="checkbox" aria-label={`Shortlist ${row.user.name}`} checked={selectedIds.includes(String(row.user_id))} disabled={report.period_published || (!selectedIds.includes(String(row.user_id)) && selectedIds.length >= 20)} onChange={() => toggleSelected(String(row.user_id))} /></td><td>{shortlist.find(selected => selected.user_id === row.user_id)?.rank || "?"}</td><td><div className="mc-person"><ChampionPhoto user={row.user} photos={report.profile_photos} /><span>{row.user.name}<small>{row.user.email}</small></span></div></td><td>{row.requests}</td><td>{row.successful_requests} ({row.success_rate}%)</td><td>{row.active_days}</td><td>{row.modules}</td><td><strong>{row.score}</strong></td></tr>)}</tbody></table></div>{!filtered.length && <div className="ad-empty"><Trophy /><h3>{candidates.length ? 'No matching candidates' : 'No eligible candidates this month'}</h3><p>{candidates.length ? 'Try a different name or email.' : 'Choose another month with recorded RADAI activity, including page visits. No award is created from missing data.'}</p></div>}<div className="ad-pagination"><span>{filtered.length} candidates</span><div><button aria-label="Previous candidates page" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>{page} / {pages}</span><button aria-label="Next candidates page" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div></div></section>
        <section className="ad-panel"><div className="ad-panel-heading"><h2>Published awards</h2></div>{report.history.length ? <div className="ad-table-scroll"><table><thead><tr><th>Month</th><th>Champion</th><th>Reviewed by</th><th>Published (UTC)</th></tr></thead><tbody>{report.history.map(award => <tr key={award.id}><td><button className="ad-row-link" onClick={() => setPeriod(monthValue(award.year, award.month))}>{monthLabel(monthValue(award.year, award.month))}</button></td><td>{award.podium.find(r => r.rank === 1)?.user.name || 'Other recognized participants in your organization'}</td><td>{award.reviewer}</td><td>{utcDate(award.published_at)}</td></tr>)}</tbody></table></div> : <p className="ad-footnote">No reviewed monthly awards have been published in this scope. Legacy automatic results remain in Enablement.</p>}</section>
      </div><aside className="ad-panel mc-methodology"><div className="ad-panel-heading"><h2>Recognition methodology</h2><ShieldCheck /></div><p>{methodology.eligibility}</p><div className="mc-weights">{Object.entries(methodology.weights).map(([key, weight]) => <div key={key}><span>{key.replaceAll('_', ' ')}</span><strong>{weight}%</strong>{winner && <small>{winner.breakdown[key]} points awarded</small>}</div>)}</div><p>{methodology.description}</p><div className="mc-method-note"><Info /><p>{methodology.limitations}</p></div><p>Scoring version: {methodology.version}</p><hr /><h3>Review and publication</h3>{saved ? <><p><strong>{saved.reviewer}</strong><br />Published {utcDate(saved.published_at)} UTC</p><p>The award snapshot and review reason are saved permanently. Recomputing legacy rankings cannot overwrite this award.</p></> : <><p>{!report.can_publish ? 'Only a Super Administrator can publish the organization-wide monthly award.' : !report.period.closed ? 'This month is still in progress. Review and publish after the month ends.' : report.period_published ? 'This period already has a published award outside the visible scope.' : 'Review the selected employees, top 10 ranks, scoring basis and telemetry limitations, then record the reason for recognition.'}</p><button className="ad-primary" disabled={!canReview} onClick={openReview}>Review monthly award</button></>}</aside></div>
    </>}
    {review && createPortal(<dialog ref={dialog} className="mc-review-dialog" aria-labelledby="mc-review-title" onCancel={e => { e.preventDefault(); closeReview(); }}><form onSubmit={publish}><header><div><h2 id="mc-review-title">Review monthly award</h2><p>{monthLabel(period)} · All organizations</p></div><button type="button" aria-label="Close award review" disabled={saving || reviewBusy} onClick={closeReview}><X /></button></header><p>The top candidate becomes AI Champion of the Month. Up to 20 shortlisted employees and their scores will be saved; ranks 1?10 are recognized. Scores remain relative to all eligible employees in the reporting scope.</p><p>{reviewRows.length} / 20 employees shortlisted ? Top {Math.min(10, reviewRows.length)} recognized</p>{reviewBusy && <p role="status">Loading shortlist for review...</p>}<ol>{reviewRows.slice(0, 10).map(row => <li key={row.user_id}><div className="mc-person"><ChampionPhoto user={row.user} photos={report.profile_photos} /><strong>{row.user.name}</strong></div><span>{row.score} / 100 · {row.activity_count ?? row.successful_requests} {row.activity_count != null ? 'RADAI activities' : 'successful requests'}</span></li>)}</ol><label>Reason for recognition<textarea aria-label="Reason for recognition" required minLength={10} maxLength={2000} value={reason} disabled={saving} onChange={e => setReason(e.target.value)} placeholder="Explain why these recorded contributions merit recognition..." /></label><label className="mc-confirm"><input type="checkbox" checked={confirmed} disabled={saving} onChange={e => setConfirmed(e.target.checked)} />I reviewed the candidates and telemetry limitations. RADAI activity, including page visits, does not prove productivity or verified business outcomes.</label>{saveError && <p role="alert" className="mc-save-error">{saveError} Close this review and refresh the preview before trying again.</p>}<footer><button type="button" onClick={closeReview} disabled={saving || reviewBusy}>Cancel</button><button className="mc-publish" disabled={saving || reviewBusy || !reviewData || !confirmed || reason.trim().length < 10 || !!saveError}>{saving ? 'Publishing...' : 'Publish monthly award'}</button></footer></form></dialog>, document.body)}
  </section>;
}
