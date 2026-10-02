import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { AlertCircle, Briefcase, CheckCircle2, Clock3, FileText, MoreHorizontal, Pencil, Plus, RefreshCw } from 'lucide-react';
import { frameworkDate, frameworkLabel, frameworkMoney, frameworkOwner, frameworkRemaining } from './salesFrameworkRegister';

const tabs = ['Overview', 'Rates', 'Eligibility', 'Call-offs', 'Documents', 'Activity'];
const text = value => typeof value === 'string' && value.trim() ? value.trim() : '—';
const listText = value => Array.isArray(value) ? value.filter(item => typeof item === 'string').map(frameworkLabel).join('; ') || '—' : '—';
const timestamp = value => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' }).format(date) : '—';
};

function RecordedValue({ value }) {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? <ul className="sfw-recorded-list">{value.map((item, index) => <li key={index}><RecordedValue value={item} /></li>)}</ul> : '—';
  if (typeof value === 'object') return <dl className="sfw-fields">{Object.entries(value).map(([key, item]) => <div key={key}><dt>{frameworkLabel(key)}</dt><dd><RecordedValue value={item} /></dd></div>)}</dl>;
  return typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value);
}
RecordedValue.propTypes = { value: PropTypes.any };

function Rates({ record, onViewAll, full = false }) {
  const cards = Array.isArray(record.rate_cards) ? record.rate_cards : [];
  const approved = cards.filter(card => card && typeof card === 'object' && card.status === 'approved');
  const visible = full ? cards : approved.slice(0, 3);
  return <><div className="sfw-section-heading"><h3>{full ? 'Rate cards' : 'Approved rates'}</h3>{approved.length > 0 && !full && <span className="sfw-status sfw-status-active">Approved</span>}{!full && <button type="button" className="sfw-link" onClick={onViewAll}>View rate cards</button>}</div>
    <div className="sfw-table-wrap"><table data-table-typography="preserve"><thead><tr><th>Version</th><th>Effective from</th><th>Status</th></tr></thead><tbody>{visible.length ? visible.map((card, index) => <tr key={index}><td>{typeof card === 'object' && card ? text(String(card.version ?? '')) : text(card)}</td><td>{frameworkDate(card?.effective_from)}</td><td>{frameworkLabel(card?.status) || '—'}</td></tr>) : <tr><td colSpan={3} className="sfw-empty-cell">{full ? 'No rate cards recorded.' : 'No approved rate cards recorded.'}</td></tr>}</tbody></table></div>
    {full && <><p className="sfw-note">Role, unit and rate amounts are not available in the recorded rate-card format.</p><h3 className="sfw-subheading">Rate escalation</h3><p className="sfw-prose">{text(record.rate_escalation_method)}</p>{cards.some(card => card && typeof card === 'object' && Object.keys(card).some(key => !['version', 'effective_from', 'status'].includes(key))) && <><h3 className="sfw-subheading">Recorded rate-card details</h3><RecordedValue value={cards} /></>}</>}
  </>;
}
Rates.propTypes = { record: PropTypes.object.isRequired, onViewAll: PropTypes.func, full: PropTypes.bool };

export default function SalesFrameworkWorkspace({ record, loading, error, onRetry, onEdit, onOpenFullRecord, onRefresh, onAction, actions, locked }) {
  const [tab, setTab] = useState('Overview');
  const selectTab = name => { setTab(name); };
  const keyboardTab = event => {
    const index = tabs.indexOf(tab);
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault(); setTab(tabs[next]); event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  if (loading || error || !record) return <section className="sfw-workspace sfw-workspace-state" aria-label="Framework workspace" aria-busy={loading}>{loading ? <RefreshCw size={30} className="sfw-spin" /> : error ? <AlertCircle size={30} /> : <Briefcase size={30} />}<h2>{loading ? 'Loading agreement…' : error ? 'Agreement unavailable' : 'Select a framework'}</h2><p role={error ? 'alert' : undefined}>{loading ? 'Loading the selected agreement.' : error || 'Choose an agreement to view its controls and terms.'}</p>{error && <button type="button" className="sfw-button" onClick={onRetry}>Retry agreement</button>}</section>;

  const money = value => frameworkMoney(value, record.currency);
  const controlMoney = value => {
    const formatted = money(value);
    const prefix = `${record.currency?.trim()} `;
    return record.currency?.trim() && formatted.startsWith(prefix) ? formatted.slice(prefix.length) : formatted;
  };
  const controls = <><div className="sfw-section-heading"><h3>Agreement controls</h3></div><dl className="sfw-fields"><div><dt>Client entity</dt><dd>{text(record.client_name)}</dd></div><div><dt>Owner</dt><dd>{frameworkOwner(record)}</dd></div><div><dt>Valid from</dt><dd>{frameworkDate(record.effective_date)}</dd></div><div><dt>Valid until</dt><dd>{frameworkDate(record.expiry_date)}</dd></div></dl></>;
  const values = <><div className="sfw-section-heading"><h3>Value control</h3><span className="sfw-muted">{text(record.currency)}</span></div><dl className="sfw-values"><div><dt>Agreement ceiling</dt><dd>{controlMoney(record.ceiling_value)}</dd></div><div><dt>Committed</dt><dd>{controlMoney(record.committed_value)}</dd></div><div><dt>Active reservations</dt><dd title="Reservation balances are not recorded">—</dd></div><div className="sfw-value-total"><dt>Remaining</dt><dd>{controlMoney(frameworkRemaining(record))}</dd></div></dl><p className="sfw-note">Ceiling − committed; reservations are not recorded.</p></>;
  const eligibility = <><div className="sfw-section-heading"><h3>Eligibility &amp; limits</h3>{tab === 'Overview' && <button type="button" className="sfw-link" onClick={() => selectTab('Eligibility')}>View eligibility rules</button>}</div><dl className="sfw-fields"><div><dt>Eligible services</dt><dd>{listText(record.included_services)}</dd></div><div><dt>Per call-off limit</dt><dd>Not recorded</dd></div></dl></>;
  const callOffs = <><div className="sfw-section-heading"><h3>{tab === 'Overview' ? 'Recent call-offs' : 'Call-offs'}</h3>{tab === 'Overview' && <button type="button" className="sfw-link" onClick={() => selectTab('Call-offs')}>View details</button>}</div><div className="sfw-table-wrap"><table data-table-typography="preserve"><thead><tr><th>Call-off</th><th>Service</th><th>Value{record.currency ? ` (${record.currency})` : ''}</th><th>Status</th></tr></thead><tbody><tr><td colSpan={4} className="sfw-empty-cell">Call-off records are not available.</td></tr></tbody></table></div><p className="sfw-note">Pending call-off reservations are not recorded.</p>{tab === 'Call-offs' && <><h3 className="sfw-subheading">Call-off procedure</h3><p className="sfw-prose">{text(record.call_off_procedure)}</p></>}</>;

  return <section className="sfw-workspace" aria-label="Framework workspace">
    <header className="sfw-workspace-header"><div className="sfw-agreement-icon"><Briefcase size={30} /></div><div className="sfw-title-block"><div className="sfw-reference">{record.framework_number}<FileText size={16} /></div><h2>{record.title}</h2><div className="sfw-agreement-meta">{record.client ? <Link to={`/sales/clients?record=${encodeURIComponent(record.client)}`}>{text(record.client_name)}</Link> : <span>{text(record.client_name)}</span>}<span className={`sfw-status sfw-status-${record.status}`}>{frameworkLabel(record.status)}</span></div></div><div className="sfw-workspace-actions"><button type="button" className="sfw-button" disabled={locked} title={locked ? 'Expired and closed agreements cannot be edited' : 'Edit the existing agreement fields'} onClick={onEdit}><Pencil size={18} />Edit agreement</button><details className="sfw-menu" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}><summary className="sfw-button sfw-icon-button" aria-label="More framework actions"><MoreHorizontal size={19} /></summary><div className="sfw-menu-content"><button type="button" onClick={onRefresh}><RefreshCw size={16} />Refresh agreement</button><button type="button" onClick={onOpenFullRecord}><FileText size={16} />Open full record</button>{actions.map(action => <button type="button" key={action.id} onClick={() => onAction(action.id)}><CheckCircle2 size={16} />{action.label}</button>)}</div></details></div></header>
    <div className="sfw-workspace-tabs" role="tablist" aria-label="Framework details">{tabs.map(name => <button type="button" key={name} id={`sfw-tab-${name}`} role="tab" aria-selected={tab === name} aria-controls="sfw-detail-panel" tabIndex={tab === name ? 0 : -1} onKeyDown={keyboardTab} onClick={() => selectTab(name)}>{name}</button>)}</div>
    <div className="sfw-workspace-content" id="sfw-detail-panel" role="tabpanel" aria-labelledby={`sfw-tab-${tab}`} tabIndex={0}>
      {tab === 'Overview' && <><section className="sfw-section sfw-controls-grid"><div>{controls}</div><div>{values}</div></section><section className="sfw-section sfw-rates-grid"><div><Rates record={record} onViewAll={() => selectTab('Rates')} /></div><div>{eligibility}</div></section><section className="sfw-section sfw-calloffs">{callOffs}</section></>}
      {tab === 'Rates' && <section className="sfw-section"><Rates record={record} full /></section>}
      {tab === 'Eligibility' && <section className="sfw-section">{eligibility}<dl className="sfw-fields sfw-extended-fields"><div><dt>Current eligibility</dt><dd>{record.is_eligible === true ? 'Eligible by status and validity' : record.is_eligible === false ? 'Not currently eligible' : 'Not recorded'}</dd></div><div><dt>Disciplines</dt><dd>{listText(record.disciplines)}</dd></div><div><dt>Geographic coverage</dt><dd>{listText(record.geographic_coverage)}</dd></div><div><dt>Renewal action date</dt><dd>{frameworkDate(record.renewal_action_date)}</dd></div><div><dt>Payment terms</dt><dd>{text(record.payment_terms)}</dd></div><div><dt>Invoiced</dt><dd>{money(record.invoiced_value)}</dd></div><div><dt>Liability requirements</dt><dd>{text(record.liability_requirements)}</dd></div><div><dt>Insurance requirements</dt><dd>{text(record.insurance_requirements)}</dd></div><div><dt>Compliance requirements</dt><dd><RecordedValue value={record.compliance_requirements} /></dd></div></dl></section>}
      {tab === 'Call-offs' && <section className="sfw-section">{callOffs}</section>}
      {tab === 'Documents' && <section className="sfw-section"><div className="sfw-section-heading"><h3>Agreement documents</h3></div><div className="sfw-document"><FileText size={23} /><div><h4>Signed agreement reference</h4><p>{text(record.signed_document)}</p></div></div><p className="sfw-note">A document preview or download is not available for this reference.</p><h3 className="sfw-subheading">Recorded amendments</h3>{Array.isArray(record.amendments) && record.amendments.length ? <RecordedValue value={record.amendments} /> : <p className="sfw-prose">No amendments recorded.</p>}</section>}
      {tab === 'Activity' && <section className="sfw-section"><div className="sfw-section-heading"><h3>Agreement activity</h3></div><div className="sfw-activity"><Clock3 size={20} /><div><strong>Created</strong><p>{timestamp(record.created_at)}</p></div></div><div className="sfw-activity"><Clock3 size={20} /><div><strong>Last updated</strong><p>{timestamp(record.updated_at)}</p></div></div><div className="sfw-activity"><CheckCircle2 size={20} /><div><strong>Approval</strong><p>{record.approved_at ? timestamp(record.approved_at) : 'No approval recorded'}</p>{record.approved_by && <p>Approver reference: {record.approved_by}</p>}</div></div><p className="sfw-note">These are recorded timestamps; a complete activity history is not available.</p></section>}
    </div>
    <footer className="sfw-workspace-footer"><span title="Call-off creation is not available"><button type="button" disabled className="sfw-button sfw-primary" aria-label="New call-off unavailable"><Plus size={20} />New call-off</button></span><button type="button" className="sfw-button" onClick={onOpenFullRecord}><FileText size={20} />Open agreement</button><p>Call-off issue and reservation controls are not available.</p></footer>
  </section>;
}
SalesFrameworkWorkspace.propTypes = {
  record: PropTypes.object, loading: PropTypes.bool.isRequired, error: PropTypes.string,
  onRetry: PropTypes.func.isRequired, onEdit: PropTypes.func.isRequired, onOpenFullRecord: PropTypes.func.isRequired,
  onRefresh: PropTypes.func.isRequired, onAction: PropTypes.func.isRequired, actions: PropTypes.array.isRequired, locked: PropTypes.bool.isRequired,
};
