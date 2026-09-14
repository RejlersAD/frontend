/* eslint-disable react/prop-types */
import React, { useState } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { EmptyState, RouteLink, Status } from './ExecutivePrimitives';
import { formatDate, formatNumber } from './executivePresentation';
import { commercialMetric, CommercialMetricValue, numberPresent, unknownCommercialMetric } from './commercialPresentation';

const REPORTED = new Set(['available', 'partial']);
const QUALITY_IDS = ['missing_owner', 'missing_next_action', 'missing_submission_date', 'invalid_probability', 'weighted_value_mismatches'];
const currencyOf = row => row.currency || 'UNSPECIFIED';

function sourceState(commercial, section) {
  return ['restricted', 'error'].includes(commercial?.status) ? commercial.status : section?.status || 'unavailable';
}

function sourceInfo(id, label, description, status = 'unavailable') {
  return { ...unknownCommercialMetric(id, label, description), status, source: 'CRM opportunity register' };
}

function ExplainButton({ metric, onExplain }) {
  return <button type="button" className="cc-info-button" aria-label={`About ${metric.label}`}
    title={metric.reason || metric.description} onClick={() => onExplain?.(metric)}>
    <InformationCircleIcon aria-hidden="true" />
  </button>;
}

function sourceTitle(status, fallback) {
  return status === 'restricted' ? 'Opportunity access required' : status === 'error' ? 'CRM source unavailable' : fallback;
}

function selectedCount(metadata, currency) {
  if (!metadata || typeof metadata !== 'object' || !currency) return null;
  const value = Array.isArray(metadata) ? metadata.find(row => currencyOf(row) === currency)?.count ?? 0
    : Object.hasOwn(metadata, currency) ? metadata[currency] : 0;
  return numberPresent(value) ? Number(value) : null;
}

function pipelineAmount(value, currency, label = 'Recorded opportunity value') {
  return { ...unknownCommercialMetric('opportunity_value', label,
    'Recorded estimated opportunity value in its original currency. This is not awarded revenue.', 'currency'),
    value, currency, status: numberPresent(value) ? 'available' : 'unavailable', source: 'CRM opportunity register' };
}

export function CommercialBidCalendar({ commercial, currency, onExplain, printing = false }) {
  const [expanded, setExpanded] = useState(false);
  const calendar = commercial?.bid_calendar || {};
  const status = sourceState(commercial, calendar);
  const rows = REPORTED.has(status) ? calendar.rows || [] : [];
  const selected = currency ? rows.filter(row => currencyOf(row) === currency) : [];
  const visible = expanded || printing ? selected : selected.slice(0, 3);
  const total = REPORTED.has(status) ? selectedCount(calendar.total_rows_by_currency, currency) : null;
  const emptyKnown = REPORTED.has(status) && (total === 0 || calendar.total_rows === 0);
  const info = sourceInfo('commercial_bid_calendar_coverage', 'Bid calendar',
    calendar.description || 'Current proposal-stage opportunities with a recorded submission target that has passed or falls within the next 30 days. A target date does not establish whether submission is complete. Readiness and bid-specific ownership are not recorded.', status);
  const showCap = REPORTED.has(status) && calendar.truncated;

  return <section className="cp-panel cp-bid-panel" aria-labelledby="cp-bid-title" data-testid="commercial-bid-calendar">
    <div className="cp-panel-heading"><h2 id="cp-bid-title">Bid calendar</h2><ExplainButton metric={info} onExplain={onExplain} /></div>
    <p className="cp-calendar-scope">{currency ? `Dates in ${currency}` : 'No currency data'} · past targets and next 30 days</p>
    <div className="cp-side-table-wrap" role="region" aria-label="Bid submission targets" tabIndex={0}>
      <table className="cp-side-table cp-bid-table"><thead><tr>
        <th scope="col">Date</th><th scope="col">Opportunity</th><th scope="col">Value</th><th scope="col">Readiness</th><th scope="col">Opportunity owner</th><th scope="col">Status</th><th scope="col">Action</th>
      </tr></thead><tbody>{visible.map(row => <tr key={row.id} data-testid={`commercial-bid-${row.id}`}>
        <td title={row.due_date ? formatDate(row.due_date) : 'Submission target not recorded'}>{row.due_date ? formatDate(row.due_date).replace(/ \d{4}$/, '') : '—'}</td>
        <th scope="row" title={`${row.code || ''} · ${row.name}`}><span>{row.name}</span><small>{row.client_name || row.code || '—'}</small></th>
        <td><CommercialMetricValue metric={pipelineAmount(row.estimated_value, currencyOf(row))} /></td>
        <td title="Bid readiness is not recorded">—</td><td title={row.owner || 'Opportunity owner not recorded'}>{row.owner || 'Unassigned'}</td>
        <td><Status status={row.status === 'past_target_date' ? 'medium' : row.status === 'due_today' ? 'medium' : row.status === 'upcoming' ? 'available' : 'unavailable'}>
          {row.status === 'past_target_date' ? 'Target date passed' : row.status === 'due_today' ? 'Due today' : row.status === 'upcoming' ? 'Upcoming' : 'Not assessed'}
        </Status></td><td><RouteLink route={row.route} aria-label={`Open bid opportunity ${row.name}`}>Open</RouteLink></td>
      </tr>)}</tbody></table>
    </div>
    {!visible.length && <EmptyState title={sourceTitle(status, emptyKnown ? 'No submission targets in this scope' : total > 0 ? 'Target rows not included in this preview' : 'Bid calendar not available')}
      detail={emptyKnown ? 'No current proposal targets match this currency and date window.' : total > 0
        ? 'The response limit can omit targets in this currency. Open the opportunity register for all records.'
        : 'Recorded proposal submission dates are required.'} />}
    {showCap && <p className="cp-panel-note" data-testid="commercial-bid-cap">All currencies: {formatNumber(calendar.returned_rows ?? rows.length)} of {formatNumber(calendar.total_rows)} targets returned. The calendar preview is limited.</p>}
    <div className="cp-panel-footer"><span className="cp-panel-note">{currency ? `${currency}: ` : ''}{REPORTED.has(status)
      ? `Showing ${visible.length}${total != null ? ` of ${formatNumber(total)}` : ` of ${selected.length} returned`} targets${total != null && selected.length < total ? ` (${selected.length} returned)` : ''}` : 'Readiness not assessed'}</span>
      {selected.length > 3 && <button type="button" className="cc-text-button cc-screen-only" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show top 3' : 'View returned targets'}</button>}
      {REPORTED.has(status) && <RouteLink route="/sales/opportunities">Open opportunities</RouteLink>}
    </div>
  </section>;
}

export function CommercialClientConcentration({ commercial, currency, onExplain, printing = false }) {
  const [expanded, setExpanded] = useState(false);
  const concentration = commercial?.client_concentration || {};
  const status = sourceState(commercial, concentration);
  const group = ['available', 'partial', 'incomplete'].includes(status)
    ? concentration.by_currency?.find(row => currencyOf(row) === currency) : null;
  const clients = Array.isArray(group?.clients) ? group.clients : [];
  const valid = group?.status === 'available' && numberPresent(group.total) && Number(group.total) > 0
    && clients.length > 0 && clients.every(row => numberPresent(row.amount) && Number(row.amount) >= 0
      && numberPresent(row.share_pct) && Number(row.share_pct) >= 0 && Number(row.share_pct) <= 100);
  const ranked = valid ? [...clients].sort((a, b) => Number(b.amount) - Number(a.amount) || String(a.label).localeCompare(String(b.label))) : [];
  const visible = expanded || printing ? ranked : ranked.slice(0, 5);
  const zero = group?.status === 'available' && numberPresent(group.total) && Number(group.total) === 0;
  const emptyKnown = REPORTED.has(status) && Array.isArray(concentration.by_currency) && concentration.by_currency.length === 0;
  const info = sourceInfo('commercial_client_concentration_coverage', 'Client concentration',
    concentration.description || 'Client shares use the full recorded estimated pipeline value of accessible open opportunities within the selected original currency. Missing values, currencies or client mappings can withhold shares. No concentration risk threshold is supplied.', status);
  const totalMetric = group?.status === 'available' ? pipelineAmount(group.total, currency, 'Open pipeline denominator')
    : unknownCommercialMetric('client_concentration_total', 'Open pipeline denominator', 'A complete currency-specific pipeline total is required.', 'currency');

  return <section className="cp-panel cp-concentration-panel" aria-labelledby="cp-concentration-title" data-testid="commercial-client-concentration">
    <div className="cp-panel-heading"><h2 id="cp-concentration-title">Client concentration</h2><ExplainButton metric={info} onExplain={onExplain} /></div>
    <div className="cp-concentration-summary"><span>Open pipeline · {currency || 'No currency data'}</span><strong data-testid="commercial-concentration-total"><CommercialMetricValue metric={totalMetric} /></strong></div>
    {valid ? <div className="cp-concentration-bars">{visible.map(client => <div className="cp-concentration-row" key={client.id}
      data-testid={`commercial-concentration-client-${client.id}`}>
      <div className="cp-concentration-row-heading"><span title={client.label}>{client.label}</span><strong>{formatNumber(client.share_pct)}%</strong></div>
      <div className="cp-concentration-track" role="img" aria-label={`${client.label}: ${formatNumber(client.share_pct)}% of ${currency} open pipeline`}>
        <span style={{ width: `${Number(client.share_pct)}%` }} />
      </div>
      <span className="cp-concentration-amount"><CommercialMetricValue metric={pipelineAmount(client.amount, currency)} /></span>
    </div>)}</div> : <EmptyState title={sourceTitle(status, emptyKnown ? 'No open pipeline to compare' : zero ? 'No positive pipeline value to compare' : group && group.status !== 'available' ? 'Client concentration incomplete' : 'Client concentration not available')}
      detail={emptyKnown ? 'No open opportunity values are recorded in the accessible source. No currency total is inferred.'
        : zero ? 'The recorded total is zero; a concentration share needs a positive denominator.' : 'Complete estimated values, original currency and client mappings are required.'} />}
    <div className="cp-panel-footer"><span className="cp-panel-note">{valid ? `Showing ${visible.length} of ${ranked.length} clients · full currency denominator` : 'Shares are not a risk rating'}</span>
      {ranked.length > 5 && <button type="button" className="cc-text-button cc-screen-only" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show top 5' : 'View all clients'}</button>}
    </div>
  </section>;
}

export function CommercialResourceDemand({ commercial, onExplain }) {
  const demand = commercial?.resource_demand || {};
  const status = sourceState(commercial, demand);
  const info = { ...sourceInfo('commercial_resource_demand', 'Bid resource demand',
    demand.description || 'Approved bid staffing, dated discipline demand and available capacity are not connected. CRM estimated hours are not an approved resource plan.', status),
    source: 'Approved bid resource plan required' };
  return <section className="cp-panel cp-resource-panel" aria-labelledby="cp-resource-title" data-testid="commercial-resource-demand">
    <div className="cp-panel-heading"><h2 id="cp-resource-title">Bid resource demand</h2><ExplainButton metric={info} onExplain={onExplain} /></div>
    <table className="cp-side-table cp-resource-table" aria-label="Bid resource planning coverage"><thead><tr>
      <th scope="col">Discipline</th><th scope="col">Bid demand</th><th scope="col">Capacity gap</th>
    </tr></thead><tbody><tr><td colSpan={3}><EmptyState title={sourceTitle(status, 'Bid resource plan not connected')}
      detail="Approved staffing, demand dates and available capacity are required." /></td></tr></tbody></table>
    <div className="cp-panel-footer"><span className="cp-panel-note">Demand and capacity not assessed</span></div>
  </section>;
}

export function CommercialQuality({ commercial, currency, onExplain }) {
  const quality = commercial?.commercial_quality || {};
  const status = sourceState(commercial, quality);
  const sourceMetrics = QUALITY_IDS.map(id => quality.metrics?.find(metric => metric.id === id)).filter(Boolean);
  const metrics = sourceMetrics.map(item => {
    const metric = commercialMetric(commercial, item.id, currency);
    return ['restricted', 'error'].includes(status) ? { ...metric, status, value: null } : metric;
  });
  const info = { ...sourceInfo('commercial_quality_coverage', 'Commercial quality',
    quality.description || 'Recorded CRM hygiene checks across all accessible open opportunities and currencies. Missing submission dates apply to proposal-stage records. These counts do not establish legal review, bid readiness or overall commercial approval.', status), metrics };

  return <section className="cp-panel cp-quality-panel" aria-labelledby="cp-quality-title" data-testid="commercial-quality">
    <div className="cp-panel-heading"><h2 id="cp-quality-title">Commercial quality</h2><ExplainButton metric={info} onExplain={onExplain} /></div>
    <table className="cp-side-table cp-quality-table" aria-label="Recorded CRM hygiene checks"><thead><tr>
      <th scope="col">CRM check</th><th scope="col">Count</th><th scope="col">Status</th>
    </tr></thead><tbody>{metrics.map(metric => {
      const known = REPORTED.has(metric.status) && numberPresent(metric.value);
      const positive = known && Number(metric.value) > 0;
      return <tr key={metric.id} data-testid={`commercial-quality-${metric.id}`}>
        <th scope="row"><button type="button" className="cp-quality-name" onClick={() => onExplain?.(metric)} aria-label={`About ${metric.label}`} title={metric.description || metric.reason}>{metric.label}</button></th>
        <td><strong><CommercialMetricValue metric={metric} /></strong></td><td><Status status={positive ? 'medium' : metric.status}>
          {positive ? 'Review' : known && Number(metric.value) === 0 ? 'No recorded issues' : metric.status === 'restricted' ? 'Restricted' : metric.status === 'error' ? 'Source unavailable' : 'Not assessed'}
        </Status></td>
      </tr>;
    })}</tbody></table>
    {!metrics.length && <EmptyState title={sourceTitle(status, 'CRM quality checks not available')} detail="Verified opportunity field checks are required." />}
    <div className="cp-panel-footer"><span className="cp-panel-note">CRM checks · all open opportunities and currencies</span>
      {REPORTED.has(status) && <RouteLink route="/sales/opportunities">Open CRM records</RouteLink>}
    </div>
  </section>;
}
