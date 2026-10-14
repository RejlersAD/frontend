/* eslint-disable react/prop-types */
import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, ExclamationTriangleIcon, InformationCircleIcon, LockClosedIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { STATUS_LABELS, formatMetric, formatNumber, internalRoute } from './executivePresentation';

export function Status({ status = 'unavailable', children }) {
  const labels = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', clear: 'No exceptions', ...STATUS_LABELS };
  const Icon = ['high', 'critical', 'medium'].includes(status) ? ExclamationTriangleIcon : status === 'restricted' ? LockClosedIcon : InformationCircleIcon;
  return <span className={`cc-status cc-status--${status}`}><Icon aria-hidden="true" />{children || labels[status] || 'Not assessed'}</span>;
}

export function RouteLink({ route, children, className = '', arrow = false, ...props }) {
  const destination = internalRoute(route);
  return destination ? <Link to={destination} className={`cc-link ${className}`} {...props}>{children}{arrow && <ArrowRightIcon aria-hidden="true" />}</Link> : null;
}

export function MetricValue({ metric }) {
  if (!metric) return '—';
  if (['available', 'partial'].includes(metric.status) && metric.by_currency?.length) {
    return <span className="cc-currency-values">{metric.by_currency.map(row => <span key={row.currency}><small>{row.currency}</small> {formatNumber(row.amount, { maximumFractionDigits: 1 })}</span>)}</span>;
  }
  return formatMetric(metric);
}

export function EmptyState({ title = 'Not available', detail, children }) {
  return <div className="cc-empty"><InformationCircleIcon aria-hidden="true" /><strong>{title}</strong>{detail && <p>{detail}</p>}{children}</div>;
}

export function DefinitionsDialog({ selection, onClose, metrics = [] }) {
  const ref = useRef(null);
  useEffect(() => {
    if (selection && !ref.current.open) ref.current.showModal();
    if (!selection && ref.current.open) ref.current.close();
  }, [selection]);
  const rows = selection?.all ? metrics : selection?.metrics || (selection ? [selection] : []);
  const containFocus = event => {
    if (event.key !== 'Tab') return;
    const controls = [...ref.current.querySelectorAll('button:not(:disabled), a[href], input, select, [tabindex="0"]')];
    const first = controls[0];
    const last = controls.at(-1);
    if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    }
  };
  return <dialog ref={ref} className="cc-dialog" aria-labelledby="metric-definition-title" onKeyDown={containFocus} onCancel={onClose} onClose={onClose} onClick={event => { if (event.target === ref.current) onClose(); }}>
    <div className="cc-dialog-heading"><div><span className="cc-eyebrow">Reporting definitions</span><h2 id="metric-definition-title">{selection?.all ? 'Metric definitions' : selection?.label}</h2></div><button className="cc-icon-button" onClick={onClose} aria-label="Close definitions" autoFocus><XMarkIcon /></button></div>
    <p className="cc-note">Current authorised workspace. Missing measures, targets and historical comparisons remain unavailable.</p>
    {rows.map((metric, index) => <section className="cc-definition" key={`${metric.id}-${index}`}>
      {(selection?.all || selection?.metrics) && <h3>{metric.label}</h3>}<Status status={metric.status} />
      <dl><div><dt>Definition</dt><dd>{metric.definition || metric.description || 'Definition not recorded.'}</dd></div><div><dt>Source</dt><dd>{metric.source || 'Source not connected'}</dd></div><div><dt>Coverage</dt><dd>{metric.reason || metric.description || 'Current source register.'}</dd></div><div><dt>Target / comparison</dt><dd>{metric.target == null && metric.trend == null ? 'Not available from the reporting source.' : 'See the source report for the approved comparison.'}</dd></div></dl>
      {metric.status !== 'restricted' && <RouteLink route={metric.route} arrow>Open source workspace</RouteLink>}
    </section>)}
  </dialog>;
}
