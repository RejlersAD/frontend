/**
 * Page header (spec §1): breadcrumb · 26px/700 title · optional neutral pill
 * · one-line subtitle · right side: secondary buttons then ONE primary.
 */
import { Link } from 'react-router-dom'

export default function PageHeader({ breadcrumb = [], title, pill = null, subtitle = null, actions = null }) {
  return (
    <header className="pc-header">
      <div className="pc-header-main">
        {breadcrumb.length > 0 && (
          <nav className="pc-breadcrumb" aria-label="Breadcrumb">
            {breadcrumb.map((crumb, i) => (
              <span key={i} style={{ display: 'inline-flex', gap: '0.375rem', alignItems: 'center' }}>
                {i > 0 && <span aria-hidden="true">/</span>}
                {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : <span>{crumb.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <div className="pc-header-titlerow">
          <h1 className="pc-title">{title}</h1>
          {pill}
        </div>
        {subtitle && <p className="pc-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="pc-header-actions">{actions}</div>}
    </header>
  )
}
