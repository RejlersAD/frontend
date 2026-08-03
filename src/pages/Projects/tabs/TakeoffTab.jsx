import React from 'react'
import PhaseStubCard from '../components/PhaseStubCard'

export default function TakeoffTab() {
  return (
    <PhaseStubCard mode={{
      key: 'ai-takeoff',
      label: 'AI Take-Off',
      phaseFlag: 'phase_2_ai_takeoff',
      phaseLabel: 'Phase 2',
    }} />
  )
}
