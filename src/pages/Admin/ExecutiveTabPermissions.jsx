import React from 'react';
import PropTypes from 'prop-types';

const TAB_CODES = [
  ['executive_dashboard.view_overview', 'Overview'],
  ['executive_dashboard.view_financial', 'Financial performance'],
  ['executive_dashboard.view_portfolio', 'Project portfolio'],
  ['executive_dashboard.view_commercial', 'Commercial pipeline'],
  ['executive_dashboard.view_workforce', 'Workforce'],
  ['executive_dashboard.view_risk', 'Risk & Compliance'],
];

export const isExecutiveTabPermission = permission => TAB_CODES.some(([code]) => permission.code === code);

export default function ExecutiveTabPermissions({ permissions, disabled, value, onChange, individual = false }) {
  const rows = TAB_CODES.map(([code, label]) => ({ permission: permissions.find(p => p.code === code), label }));
  return <section aria-label="Executive tab access">
    <h3>Executive tab access</h3>
    <p>A tab grant includes company-wide dashboard viewing. Department registers, uploads, edits and approvals keep their separate permissions. Explicit Executive access denials still apply.</p>
    <div className="ra-table-scroll"><table className="ra-matrix"><thead><tr><th>Executive tab</th><th>Access</th></tr></thead><tbody>
      {rows.map(({ permission, label }) => <tr key={label}><th scope="row">{label}</th><td>
        {!permission ? <span>Permission unavailable</span> : individual
          ? <select aria-label={`Executive ${label}: access`} disabled={disabled} value={value(permission)} onChange={event => onChange(permission, event.target.value)}>
            <option value="inherit">Inherit from roles ({permission.inherited ? 'allowed' : 'denied'})</option><option value="allow">Allow</option><option value="deny">Deny</option>
          </select>
          : <input type="checkbox" aria-label={`Executive ${label}: access`} disabled={disabled} checked={value(permission)} onChange={event => onChange(permission, event.target.checked)} />}
      </td></tr>)}
    </tbody></table></div>
  </section>;
}

ExecutiveTabPermissions.propTypes = {
  permissions: PropTypes.arrayOf(PropTypes.shape({ code: PropTypes.string, inherited: PropTypes.bool })).isRequired,
  disabled: PropTypes.bool,
  value: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  individual: PropTypes.bool,
};
