import React from 'react'
import PhaseStubCard from '../components/PhaseStubCard'

export default function EVMTab() {
  return (
    <PhaseStubCard mode={{
      key: 'evm',
      label: 'EVM Forecast',
      phaseFlag: 'phase_3_evm_forecast',
      phaseLabel: 'Phase 3',
    }} />
  )
}
