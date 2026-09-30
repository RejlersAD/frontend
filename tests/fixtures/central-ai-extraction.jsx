import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import PIDCheckerV2 from '../../src/pages/Engineering/Process/PIDCheckerV2'
import CrossCheckPanel from '../../src/pages/Engineering/Process/components/CrossCheckPanel'
import '../../src/index.css'
const checks = new URLSearchParams(location.search).get('checks') === 'true'
createRoot(document.getElementById('root')).render(<MemoryRouter><main>{checks ? <CrossCheckPanel tags={['100-P-001']} provider="claude" apiKey="" activeLineList={{ line_list_id: 'list-one', title: 'Synthetic approved list' }} projectId="project-one" /> : <PIDCheckerV2 />}</main></MemoryRouter>)
