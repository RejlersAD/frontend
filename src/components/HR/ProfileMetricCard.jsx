import PropTypes from 'prop-types'

export default function ProfileMetricCard({ icon, label, value, sub, tone = 'blue', children }) {
  return <article className="epw-metric" data-tone={tone}>
    {icon && <span className="epw-metric-icon" aria-hidden="true">{icon}</span>}
    <div className="epw-metric-copy">
      <p className="epw-metric-label">{label}</p>
      <strong className="epw-metric-value">{value}</strong>
      {sub && <p className="epw-metric-support">{sub}</p>}
      {children}
    </div>
  </article>
}

ProfileMetricCard.propTypes = {
  icon: PropTypes.node,
  label: PropTypes.string.isRequired,
  value: PropTypes.node,
  sub: PropTypes.node,
  tone: PropTypes.string,
  children: PropTypes.node,
}
