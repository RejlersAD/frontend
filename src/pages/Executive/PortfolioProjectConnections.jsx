/* eslint-disable react/prop-types */
import { useState } from 'react';
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon, LinkIcon } from '@heroicons/react/24/outline';
import { RouteLink } from './ExecutivePrimitives';
import { portfolioSourceRoute } from './portfolioInvoicePresentation';
import { revenueDecimal, revenueIdentity } from './portfolioRevenuePresentation';
import './PortfolioRecordConnections.css';

export function ProjectConnectionLinks({ connection, onReview }) {
  if (!connection) return <span className="prc-muted">Connection not reported</span>;
  return <div className="prc-links"><RouteLink route={portfolioSourceRoute(connection.project?.url)}>Open project</RouteLink>{(connection.departments || []).filter(item => item.status === 'linked' && portfolioSourceRoute(item.url)).map(item => <RouteLink key={item.key} route={portfolioSourceRoute(item.url)}>{item.label}{item.link_scope === 'register' ? ' register' : ''}</RouteLink>)}{connection.match_status !== 'matched' && <button type="button" className="cc-text-button" onClick={onReview}>{connection.match_status === 'restricted' ? 'Restricted link' : 'Review connection'}</button>}</div>;
}

export function ProjectConnectionSummary({ connections, onReview, onProjects }) {
  if (!connections) return null;
  if (['error', 'unavailable'].includes(connections.status)) return <section className="prc-project-summary" aria-label="Project connections"><span>Project connections are unavailable.</span><button type="button" onClick={onReview}>Review connection status</button></section>;
  const totals = connections.totals || {};
  const unresolved = Number(totals.unmatched_rows || 0) + Number(totals.ambiguous_rows || 0);
  return <section className="prc-project-summary" aria-label="Project connections" data-testid="portfolio-project-connections-summary"><LinkIcon aria-hidden="true" /><button type="button" onClick={onProjects}><strong>{revenueDecimal(totals.workbook_projects)}</strong> portfolio projects</button>{totals.registered_projects == null ? <span>Registered projects: restricted</span> : <RouteLink route={portfolioSourceRoute(connections.registered_projects_url || "/projects?view=portfolio")}><strong>{revenueDecimal(totals.registered_projects)}</strong> registered projects</RouteLink>}<span><strong>{revenueDecimal(totals.matched_projects)}</strong> registered projects matched</span><button type="button" className="prc-review-link" onClick={onReview}>{unresolved ? `Review ${revenueDecimal(unresolved)} unresolved source rows` : 'Review project connections'}<ArrowRightIcon aria-hidden="true" /></button></section>;
}

export default function PortfolioProjectConnections({ data, page, onPage, printing = false }) {
  const [status, setStatus] = useState('all');
  const [expanded, setExpanded] = useState(false);
  const connections = data.connections || {};
  const rows = (connections.rows || []).filter(row => status === 'all' || (status === 'unresolved' ? ['unmatched', 'ambiguous'].includes(row.match_status) : row.match_status === status));
  const visible = printing || expanded ? rows : rows.slice(0, 25);
  const limit = 200;
  const total = Number(connections.total_rows ?? data.projects?.total_rows ?? 0);
  const pages = Math.max(1, Math.ceil(total / limit));
  const statuses = { matched: 'Matched', unmatched: 'No registered match', ambiguous: 'Multiple possible matches', restricted: 'Access restricted' };
  return <section className="prv-panel prc-project-review" data-testid="portfolio-project-connections" aria-label="Project connections review"><header className="prv-panel-heading"><div><h2>Project connections review</h2><p>Review the source-to-register matches and linked department records.</p></div><select aria-label="Project connection status" value={status} onChange={event => { setStatus(event.target.value); setExpanded(false); }}><option value="all">All source rows</option><option value="unresolved">Unresolved matches</option><option value="matched">Matched</option><option value="unmatched">Unmatched</option><option value="ambiguous">Ambiguous</option><option value="restricted">Restricted</option></select></header>
    <p className="prv-note">This is a review of existing records. Unmatched or ambiguous source rows remain unresolved until a project mapping is confirmed. No projects or department records are created by this review.</p>
    {visible.length ? <div className="prv-table-wrap" tabIndex={0} role="region" aria-label="Project connections review rows"><table className="prc-project-table"><caption className="cc-sr-only">Workbook project and subproject identities linked to authorized operational records</caption><thead><tr><th scope="col">Source project / subproject</th><th scope="col">Match status</th><th scope="col">Registered project</th><th scope="col">Department records</th></tr></thead><tbody>{visible.map((row, index) => <tr key={row.portfolio_row_id || `${row.project_code}-${row.subproject_code}-${index}`}><th scope="row">{row.title || revenueIdentity(row)}<small>{revenueIdentity(row)}</small></th><td>{statuses[row.match_status] || 'Not reported'}{row.match_level === 'parent' && <small>Parent project match</small>}</td><td>{row.project ? <RouteLink route={portfolioSourceRoute(row.project.url)}>{row.project.code || row.project.name || 'Open project'}</RouteLink> : <span className="prc-muted">{row.match_status === 'restricted' ? 'Restricted' : 'Review required'}</span>}</td><td><div className="prc-department-links">{(row.departments || []).map(item => <div key={item.key}>{portfolioSourceRoute(item.url) && item.status !== 'restricted' ? <RouteLink route={portfolioSourceRoute(item.url)}>{item.label}{item.link_scope === 'register' ? ' register' : ''}</RouteLink> : <span>{item.label}</span>}<small>{item.status === 'restricted' ? 'Access restricted' : item.status === 'error' ? 'Source unavailable' : item.status === 'review_required' ? 'Match requires review' : item.record_count == null ? 'Count unavailable' : `${revenueDecimal(item.record_count)} records`}</small></div>)}</div></td></tr>)}</tbody></table></div> : <p className="prv-note">{connections.status === 'restricted' ? 'Registered project access is restricted.' : ['error', 'unavailable'].includes(connections.status) ? 'Project connections are unavailable. Refresh the portfolio to try again.' : 'No source rows match this review filter on the loaded page.'}</p>}
    {rows.length > 25 && !printing && <button type="button" className="cc-text-button prv-show-all" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show first 25 source rows' : `Show all ${rows.length} loaded source rows`}</button>}
    {total > limit && !printing && <div className="prv-pagination"><span>Source page {page + 1} of {pages} · Review filter applies to loaded rows</span><nav aria-label="Project connection pages"><button type="button" aria-label="Previous project connection page" disabled={page === 0} onClick={() => onPage(page - 1)}><ChevronLeftIcon /></button><button type="button" aria-label="Next project connection page" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}><ChevronRightIcon /></button></nav></div>}
  </section>;
}
