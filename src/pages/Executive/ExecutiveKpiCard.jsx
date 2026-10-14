/* eslint-disable react/prop-types */
import React from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

// Decorative category colors are independent of the source's reported status.
export default function ExecutiveKpiCard({ className = '', valueClassName = '', testId, tone = 'blue', icon: Icon, label, metric, value, onExplain, children }) {
  return <article className={`${className} cc-reference-kpi cc-reference-kpi--${tone}`} data-testid={testId}>
    <span className="cc-reference-kpi-icon" aria-hidden="true"><Icon /></span>
    <div className="cc-reference-kpi-body">
      <div className="cc-reference-kpi-heading"><h2>{label}</h2><button className="cc-info-button" type="button" aria-label={`About ${label}`} aria-haspopup="dialog" onClick={() => onExplain(metric)}><InformationCircleIcon aria-hidden="true" /></button></div>
      <strong className={`${valueClassName} cc-reference-kpi-value`}>{value}</strong>
      <div className="cc-reference-kpi-details">{children}</div>
    </div>
  </article>;
}
