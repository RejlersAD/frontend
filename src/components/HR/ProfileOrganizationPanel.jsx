import React from 'react'
import PropTypes from 'prop-types'
import { User } from 'lucide-react'

const normalize = value => String(value || '').trim().toLowerCase()
const initials = name => String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()

export default function ProfileOrganizationPanel({ profile, employees }) {
  const manager = profile?.manager_detail
  const managerName = manager?.name || profile?.manager_name
  const department = profile?.department
  const colleagues = (employees || []).filter(person =>
    department && normalize(person.department) === normalize(department)
    && String(person.id) !== String(profile?.id)
    && String(person.id) !== String(manager?.id || profile?.manager)
  ).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 6)
  const departmentLabel = profile?.department_display || String(department || '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())

  return <section className="epw-panel epw-organization" aria-labelledby="epw-organization-title">
    <header className="epw-org-header">
      <div><h2 id="epw-organization-title">Organization</h2><p>Reporting line and close colleagues</p></div>
      {departmentLabel && <span className="epw-org-department">{departmentLabel}</span>}
    </header>
    <div className="epw-org-body">
      <div className="epw-org-manager">
        <h3>Manager</h3>
        <div className="epw-org-person">
          <span className="epw-org-avatar manager" aria-hidden="true">{managerName ? initials(managerName) : <User />}</span>
          <div><strong>{profile ? managerName || 'Not assigned' : 'Not available'}</strong><p>Reporting manager</p></div>
        </div>
      </div>
      <div className="epw-org-colleagues">
        <h3>You work with</h3>
        {employees === undefined ? <p role="status" className="epw-org-empty">Loading colleagues…</p>
          : employees === null ? <p className="epw-org-empty">Colleagues are currently unavailable.</p>
          : colleagues.length ? <ul>{colleagues.map(person => <li key={person.id} className="epw-org-person" title={`${person.name}${person.job_title ? ` · ${person.job_title}` : ''}`}>
            <span className="epw-org-avatar" aria-hidden="true">{initials(person.name)}</span>
            <div><strong>{person.name}</strong><p>{person.job_title || 'Job title not available'}</p></div>
          </li>)}</ul>
          : <p className="epw-org-empty">{department ? 'No colleagues listed in your department yet.' : 'Add your department in Career Profile to see colleagues.'}</p>}
      </div>
    </div>
  </section>
}

ProfileOrganizationPanel.propTypes = { profile: PropTypes.object, employees: PropTypes.array }
