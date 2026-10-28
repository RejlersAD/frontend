/**
 * Stub for screens 2 (single drawing) and 3 (drawing set) — replaced by the
 * next build step. Uses the shared EmptyState.
 */
import { useParams } from 'react-router-dom'
import { PageHeader, EmptyState } from './shared'
import './pidchecker.css'

export default function StubPage({ kind = 'drawing' }) {
  const params = useParams()
  const title = kind === 'set' ? 'Drawing set check' : 'P&ID Checker'
  const back = `/engineering/process/pid-verification/projects/${params.projectId ?? ''}`
  return (
    <div className="pc-page">
      <PageHeader
        breadcrumb={[
          { label: 'PFD & P&ID Checker', to: '/engineering/process/pid-verification' },
          { label: 'Project', to: back },
          { label: title },
        ]}
        title={title}
      />
      <div className="pc-card">
        <EmptyState title="Screen under construction — available in the next build step.">
          The workspace, drawings and reference documents for this project are available on the project screen.
        </EmptyState>
      </div>
    </div>
  )
}
