import React from 'react'
import PropTypes from 'prop-types'
import PlanningPackagePage from '../../PlanningPackagePage'

export default function PlanBaselineTab({ project }) {
  return <PlanningPackagePage embedded enterpriseProject={project} />
}

PlanBaselineTab.propTypes = {
  project: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  }).isRequired,
}
