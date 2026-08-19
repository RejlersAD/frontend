import React from 'react'
import PhaseStubCard from '../components/PhaseStubCard'

export default function RiskTab() {
  return (
    <PhaseStubCard mode={{
      key: 'risk',
      label: 'Risk Analytics',
      phaseFlag: 'phase_4_risk_analytics',
      phaseLabel: 'Phase 4',
    }} />
  )
}
