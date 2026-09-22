/* eslint-disable react/prop-types */
import React, { useState } from 'react';
import { ArrowRightIcon, ChartBarIcon, ExclamationTriangleIcon, InformationCircleIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { EmptyState, RouteLink } from './ExecutivePrimitives';
import { formatDate, formatNumber } from './executivePresentation';
import { numberPresent, PortfolioMetricValue, unknownPortfolioMetric } from './portfolioPresentation';

const REPORTED = new Set(['available', 'partial']);
const HEALTH = [
  { id: 'critical', label: 'Critical' }, { id: 'high', label: 'High' },
  { id: 'medium', label: 'Attention' }, { id: 'low', label: 'Low' },
  { id: 'clear', label: 'No exceptions' }, { id: 'unknown', label: 'Not assessed' },
];
const CAUSES = new Set(['governance', 'reporting', 'data_quality', 'cost', 'schedule']);

function sourceMetric(id, label, description, status = 'unavailable', source = 'Enterprise project register') {
  return { ...unknownPortfolioMetric(id, label, description), status, source };
}

function ExplainButton({ metric, onExplain }) {
  return <button type="button" className="cc-info-button" aria-label={`About ${metric.label}`}
    title={metric.reason || metric.description} onClick={() => onExplain?.(metric)}>
    <InformationCircleIcon aria-hidden="true" />
  </button>;
}

function sectionState(portfolio, section) {
  return ['restricted', 'error'].includes(portfolio?.status) ? portfolio.status : section?.status || 'unavailable';
}

function stateTitle(status, fallback) {
  return status === 'restricted' ? 'Project access required' : status === 'error' ? 'Project source unavailable' : fallback;
}

export function PortfolioHealthSummary({ portfolio, onExplain, printing = false }) {
  const health = portfolio?.health || {};
  const status = sectionState(portfolio, health);
  const counts = health.counts || {};
  const distribution = HEALTH.map(item => ({ ...item, count: counts[item.id] }));
  const valid = REPORTED.has(status) && numberPresent(counts.total) && Number(counts.total) >= 0
    && distribution.every(item => numberPresent(item.count) && Number(item.count) >= 0)
    && distribution.reduce((sum, item) => sum + Number(item.count), 0) === Number(counts.total);
  const total = valid ? Number(counts.total) : null;
  const grouped = valid ? [
    { id: 'clear', label: 'No exceptions', count: Number(counts.clear), color: '#00a877' },
    { id: 'review', label: 'Needs review', count: Number(counts.high) + Number(counts.medium) + Number(counts.low), color: '#ffb21b' },
    { id: 'critical', label: 'Critical', count: Number(counts.critical), color: '#e94152' },
    { id: 'unknown', label: 'Not assessed', count: Number(counts.unknown), color: '#aeb8c9' },
  ] : [];
  const causes = REPORTED.has(status) ? (health.causes || []).filter(item => CAUSES.has(item.category)
    && numberPresent(item.project_count) && Number(item.project_count) >= 0
    && numberPresent(item.exception_count) && Number(item.exception_count) >= 0) : [];
  const causeMaximum = Math.max(1, ...causes.map(item => Number(item.project_count)));
  const metrics = [
    ['contract_value_at_risk', 'Contract value at risk', 'Full recorded contract values of high or critical projects, kept in original currencies. This is neither expected loss nor revenue at risk.'],
    ['revenue_at_risk', 'Revenue at risk', 'Approved remaining revenue and a governed exposure assessment are not connected.'],
  ].map(([id, label, reason]) => {
    const metric = health.metrics?.find(item => item.id === id) || unknownPortfolioMetric(id, label, reason, 'currency');
    return ['restricted', 'error'].includes(status) ? { ...metric, status, value: null, by_currency: [] } : metric;
  });
  const info = { ...sourceMetric('portfolio_health_coverage', 'Portfolio health',
    'Each accessible open project appears once in the highest recorded exception severity. Cause counts can overlap. No recorded exceptions does not establish that a project is on track.', status,
    'Governed portfolio exceptions'), metrics };

  return <section className="pp-panel pp-health-panel" aria-labelledby="pp-health-title" data-testid="portfolio-health-summary">
    <div className="pp-panel-heading"><h2 id="pp-health-title">Portfolio health</h2><ExplainButton metric={info} onExplain={onExplain} />{REPORTED.has(status) && <RouteLink className="pp-heading-link" route="/projects?view=portfolio-exceptions">Review project health<ArrowRightIcon aria-hidden="true" /></RouteLink>}</div>
    <div className="pp-health-layout">
      {valid ? <div className="pp-health-distribution">
        <svg className="pp-health-donut" viewBox="0 0 160 160" data-testid="portfolio-health-bar" role="img"
          aria-label={total > 0 ? grouped.map(item => `${item.label}: ${formatNumber(item.count)} projects`).join('; ') : 'No accessible open projects'}>
          <circle cx="80" cy="80" r="59" fill="none" stroke="#edf1f7" strokeWidth="22" />
          {total > 0 && grouped.map((item, index) => <circle key={item.id} className={`pp-health-segment pp-health-${item.id}`}
            cx="80" cy="80" r="59" fill="none" stroke={item.color} strokeWidth="22" pathLength="100"
            strokeDasharray={`${item.count / total * 100} ${100 - item.count / total * 100}`}
            strokeDashoffset={-grouped.slice(0, index).reduce((sum, group) => sum + group.count, 0) / total * 100}
            transform="rotate(-90 80 80)" aria-hidden="true" />)}
          <text x="80" y="78" textAnchor="middle" className="pp-health-donut-total">{formatNumber(total)}</text>
          <text x="80" y="98" textAnchor="middle" className="pp-health-donut-caption">projects</text>
        </svg>
        <div className="pp-health-legend">{grouped.map(item => <div key={item.id} data-testid={`portfolio-health-count-${item.id}`}>
          <span><i className={`pp-health-swatch pp-health-${item.id}`} style={{ backgroundColor: item.color }} aria-hidden="true" />{item.label}</span>
          <strong>{formatNumber(item.count)}</strong><small className="pp-health-share">{total > 0 ? `${formatNumber(item.count / total * 100, { maximumFractionDigits: 0 })}%` : '—'}</small>
        </div>)}</div>
        <div className="cc-sr-only">{distribution.filter(item => ['high', 'medium', 'low'].includes(item.id)).map(item => <span key={item.id}
          data-testid={`portfolio-health-count-${item.id}`}>{item.label}: {formatNumber(item.count)} projects. </span>)}</div>
        {total === 0 && <p className="pp-panel-note">No accessible open projects</p>}
      </div> : <EmptyState title={stateTitle(status, 'Health distribution not available')} detail="A complete recorded exception distribution is required." />}
      <div className="pp-health-cause-section"><h3>Exception causes</h3>
        {causes.length > 0 ? <><div className="pp-health-causes">{causes.map(item => <div key={item.category}
          data-testid={`portfolio-health-cause-${item.category}`} title={`${formatNumber(item.project_count)} projects; ${formatNumber(item.exception_count)} recorded exceptions`}>
          <span className="pp-health-cause-label">{item.label || item.category.replaceAll('_', ' ')}</span>
          <div className="pp-health-cause-track" aria-hidden="true"><span style={{ width: `${Number(item.project_count) / causeMaximum * 100}%` }} /></div>
          <strong>{formatNumber(item.project_count)}</strong>
        </div>)}</div><p className="pp-panel-note">Projects may have more than one cause.</p></>
          : <p className="pp-panel-note">{REPORTED.has(status) ? 'No exception causes reported.' : 'Exception causes not available.'}</p>}
      </div>
    </div>
    <details className="pp-health-details" open={printing || undefined}><summary>Contract value requiring attention</summary>
      <div className="pp-side-stats">{metrics.map(metric => <button type="button" className="pp-side-stat" key={metric.id}
      data-testid={`portfolio-side-metric-${metric.id}`} onClick={() => onExplain?.(metric)} aria-label={`About ${metric.label}`}
      title={metric.reason || metric.description}><span>{metric.label}</span><strong><PortfolioMetricValue metric={metric} /></strong>
      {metric.status === 'partial' && <small title={metric.incomplete_currencies?.length
        ? `Withheld currencies: ${metric.incomplete_currencies.join(', ')}` : metric.reason}>Partial coverage</small>}
    </button>)}</div></details>

  </section>;
}

export function PortfolioMilestones({ portfolio, onExplain, printing = false }) {
  const [expanded, setExpanded] = useState(false);
  const milestones = portfolio?.milestones || {};
  const status = sectionState(portfolio, milestones);
  const rows = REPORTED.has(status) ? milestones.rows || [] : [];
  const visible = expanded || printing ? rows : rows.slice(0, 3);
  const total = numberPresent(milestones.total_rows) ? Number(milestones.total_rows) : null;
  const info = sourceMetric('portfolio_milestone_coverage', 'Milestones requiring attention',
    milestones.description || 'Incomplete recorded milestones that are overdue or due within 30 days. Readiness is not connected. The displayed owner is the project owner; milestone-specific accountability is not recorded.', status,
    'Project milestone register');

  return <section className="pp-panel pp-milestones-panel" aria-labelledby="pp-milestones-title" data-testid="portfolio-milestones">
    <div className="pp-panel-heading"><h2 id="pp-milestones-title">Upcoming milestone decisions</h2><ExplainButton metric={info} onExplain={onExplain} /></div>
    <div className="pp-side-table-wrap" role="region" aria-label="Milestone attention table" tabIndex={0}>
      <table data-table-typography="preserve" className="pp-side-table pp-milestones-table"><thead><tr>
        <th scope="col">Milestone</th><th scope="col">Project</th><th scope="col">Due date</th><th scope="col">Readiness</th><th scope="col">Action</th>
      </tr></thead><tbody>{visible.map(row => <tr key={row.id} data-testid={`portfolio-milestone-${row.id}`}
        title={`Project owner: ${row.project_owner || 'Unassigned'}. Milestone-specific accountability is not recorded.`}>
        <th scope="row" title={row.name}>{row.name}</th><td title={row.project_name}>{row.project_code || row.project_name || '—'}</td>
        <td className={row.status === 'overdue' ? 'cc-danger-text' : row.status === 'due_today' ? 'pp-due-today' : ''}
          title={row.status === 'overdue' ? 'Overdue' : row.status === 'due_today' ? 'Due today' : row.status === 'upcoming' ? 'Upcoming' : 'Due-date status not assessed'}>
          {row.due_date ? formatDate(row.due_date).replace(/ \d{4}$/, '') : '—'}</td>
        <td title="Milestone readiness requires an approved assessment">{row.readiness?.status === 'approved' && typeof row.readiness.label === 'string' ? row.readiness.label : '—'}</td>
        <td><RouteLink route={row.route} aria-label={`Open milestone ${row.name}`}>Open</RouteLink></td>
      </tr>)}</tbody></table>
    </div>
    {!visible.length && <EmptyState title={stateTitle(status, REPORTED.has(status) && total === 0 ? 'No milestones requiring attention' : 'Milestone reporting not available')}
      detail={REPORTED.has(status) && total === 0 ? 'No incomplete milestones are overdue or due within the next 30 days in this register.' : 'Recorded project milestones and target dates are required.'} />}
    <div className="pp-panel-footer"><span className="pp-panel-note">{REPORTED.has(status) && total != null ? `Showing ${visible.length} of ${formatNumber(total)} milestones` : 'Overdue and next 30 days'}
      {milestones.truncated && REPORTED.has(status) ? ' · API preview limited' : ''}</span>
      {rows.length > 3 && <button type="button" className="cc-text-button cc-screen-only" onClick={() => setExpanded(value => !value)}>
        {expanded ? 'Show top 3' : 'View returned milestones'}
      </button>}
    </div>
  </section>;
}

export function PortfolioDeliveryCapacity({ portfolio, onExplain, onNavigate }) {
  const capacity = portfolio?.delivery_capacity || portfolio?.capacity || {};
  const status = sectionState(portfolio, capacity);
  const info = sourceMetric('portfolio_delivery_capacity', 'Delivery capacity',
    capacity.description || 'Approved discipline staffing, demand and available capacity for a common period are not connected. Employee counts cannot establish discipline utilisation or project capacity gaps.', status,
    'Verified resource and capacity plan required');
  const approved = REPORTED.has(status) && capacity.approval_status === 'approved';
  const stats = [
    ['billable_utilisation', 'Billable utilisation', 'percent', ChartBarIcon],
    ['capacity_gaps', 'Capacity gaps', 'count', ExclamationTriangleIcon],
    ['critical_roles', 'Critical roles', 'count', UserGroupIcon],
  ].map(([id, label, unit, Icon]) => {
    const recorded = approved ? capacity.metrics?.find(item => item.id === id) : null;
    const metric = recorded || { ...sourceMetric(id, label, info.description, ['restricted', 'error'].includes(status) ? status : 'unavailable', info.source), unit };
    return { id, label, Icon, metric };
  });
  const rows = approved ? (capacity.rows || []).filter(row => typeof row.discipline === 'string' && row.discipline.trim()) : [];

  return <section className="pp-panel pp-capacity-panel" aria-labelledby="pp-capacity-title" data-testid="portfolio-delivery-capacity">
    <div className="pp-panel-heading"><h2 id="pp-capacity-title">Delivery capacity</h2><ExplainButton metric={info} onExplain={onExplain} />
      {onNavigate && <button type="button" className="cc-text-button cc-screen-only pp-heading-link" onClick={() => onNavigate('workforce')}>View workforce<ArrowRightIcon aria-hidden="true" /></button>}
    </div>
    <div className="pp-capacity-stats">{stats.map(({ id, label, Icon, metric }) => <button type="button" key={id}
      className={`pp-capacity-stat pp-capacity-stat-${id}`} onClick={() => onExplain?.(metric)} title={metric.description} aria-label={`About ${label}`}>
      <Icon aria-hidden="true" /><span>{label}<strong><PortfolioMetricValue metric={metric} /></strong></span>
    </button>)}</div>
    {rows.length ? <table data-table-typography="preserve" className="pp-side-table pp-capacity-table" aria-label="Discipline capacity reporting"><thead><tr>
      <th scope="col">Discipline</th><th scope="col">Utilisation</th><th scope="col">Capacity gap</th>
    </tr></thead><tbody>{rows.map((row, index) => {
      const utilisation = numberPresent(row.billable_utilisation) && Number(row.billable_utilisation) >= 0 ? Number(row.billable_utilisation) : null;
      return <tr key={row.id || `${row.discipline}-${index}`}><th scope="row">{row.discipline}</th><td>
        <div className="pp-capacity-track" aria-hidden="true">{utilisation !== null && <span style={{ width: `${Math.min(100, utilisation)}%` }} />}</div>
        <span>{utilisation === null ? '—' : `${formatNumber(utilisation)}%`}</span>
      </td><td>{numberPresent(row.capacity_gap) ? formatNumber(row.capacity_gap) : '—'}</td></tr>;
    })}</tbody></table> : <EmptyState title={stateTitle(status, 'Awaiting approved capacity report')}
      detail="Discipline demand and available delivery hours are not connected." />}
    <div className="pp-panel-footer"><span className="pp-panel-note">{approved ? 'Approved delivery capacity source' : 'Capacity and utilisation not assessed'}</span></div>
  </section>;
}

function concentrationDefinition(group) {
  const known = group.status === 'available';
  const missing = numberPresent(group.missing_contract_count) ? Number(group.missing_contract_count) : null;
  return sourceMetric(`portfolio_concentration_${group.currency}`, `${group.currency || 'Unspecified currency'} concentration`,
    known ? `Shares use recorded open-project contract values within ${group.currency}. Total ${formatNumber(group.total)}. These are contract-value concentrations, not revenue concentrations.`
      : group.currency === 'UNSPECIFIED' || !group.currency ? 'Currency is not recorded. Concentration amounts and shares are withheld.'
        : `${missing == null ? 'Required' : formatNumber(missing)} contract values are missing. Concentration amounts and shares are withheld.`,
    known ? 'available' : 'unavailable');
}

export function PortfolioConcentration({ portfolio, onExplain, printing = false }) {
  const [expanded, setExpanded] = useState(false);
  const concentration = portfolio?.concentration || {};
  const status = sectionState(portfolio, concentration);
  const rows = ['available', 'partial', 'incomplete'].includes(status) ? concentration.by_currency || [] : [];
  const visible = expanded || printing ? rows : rows.slice(0, 3);
  const info = sourceMetric('portfolio_concentration_coverage', 'Portfolio concentration',
    concentration.description || 'Top client and top-five project shares use recorded contract value in each original currency. Missing amounts or unspecified currency withhold the affected shares. Contract value is not recognized revenue.', status);

  return <section className="pp-panel pp-concentration-panel" aria-labelledby="pp-concentration-title" data-testid="portfolio-concentration">
    <div className="pp-panel-heading"><h2 id="pp-concentration-title">Portfolio concentration</h2><ExplainButton metric={info} onExplain={onExplain} /></div>
    <div className="pp-side-table-wrap" role="region" aria-label="Portfolio concentration by currency" tabIndex={0}>
      <table data-table-typography="preserve" className="pp-side-table pp-concentration-table"><thead><tr>
        <th scope="col">Currency</th><th scope="col">Top client</th><th scope="col">Client share</th><th scope="col">Top 5 projects</th>
      </tr></thead><tbody>{visible.map(group => {
        const known = group.status === 'available' && numberPresent(group.total);
        const metric = concentrationDefinition(group);
        return <tr key={group.currency} data-testid={`portfolio-concentration-${group.currency}`}>
          <th scope="row"><button type="button" className="pp-concentration-currency" onClick={() => onExplain?.(metric)} aria-label={`About ${group.currency} concentration`} title={metric.description}>{group.currency || 'Unspecified'}</button></th>
          <td title={known ? group.top_client?.label || 'A complete client mapping and positive contract-value denominator are required.' : metric.description}>{known ? group.top_client?.label || '—' : '—'}</td>
          <td title={known && numberPresent(group.top_client?.amount) ? `${group.currency} ${formatNumber(group.top_client.amount)} recorded contract value` : metric.description}>
            {known && numberPresent(group.top_client?.share_pct) ? `${formatNumber(group.top_client.share_pct)}%` : '—'}
          </td><td title={known && numberPresent(group.top_five_projects?.amount) ? `${group.currency} ${formatNumber(group.top_five_projects.amount)} recorded contract value` : metric.description}>
            {known && numberPresent(group.top_five_projects?.share_pct) ? `${formatNumber(group.top_five_projects.share_pct)}%` : '—'}
          </td>
        </tr>;
      })}</tbody></table>
    </div>
    {!visible.length && <EmptyState title={stateTitle(status, REPORTED.has(status) ? 'No contract concentration reported' : 'Concentration not available')}
      detail="Recorded client and contract values are required; currencies remain separate." />}
    {rows.some(group => group.status !== 'available') && <p className="pp-panel-note" data-testid="portfolio-concentration-incomplete">Incomplete or unspecified currency groups have no reported shares.</p>}
    <div className="pp-panel-footer"><span className="pp-panel-note">Share of recorded contract value</span>
      {rows.length > 3 && <button type="button" className="cc-text-button cc-screen-only" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show top 3 currencies' : 'View all currencies'}</button>}
    </div>
  </section>;
}
