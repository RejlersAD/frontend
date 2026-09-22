import React from 'react'
import { createRoot } from 'react-dom/client'
import PlanningSourceEvidenceTable from '../../src/components/planning/PlanningSourceEvidenceTable'
import '../../src/index.css'

// Isolated production component with synthetic records; no service calls or writes.
const fixture = window.__sourceEvidenceFixture
document.documentElement.classList.toggle('dark', fixture.dark === true)

createRoot(document.getElementById('evidence-test')).render(<main style={{ padding: 12, maxWidth: 1400, margin: '0 auto' }}>
  <h1 style={{ fontSize: 18 }}>Source evidence fixture</h1>
  <PlanningSourceEvidenceTable tasks={fixture.tasks} review={fixture.review} sourceDocuments={fixture.sourceDocuments} />
</main>)
