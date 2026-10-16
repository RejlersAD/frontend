// Isolated coverage of the legacy Simple Planning editor. Canonical project
// navigation is exercised by unified-master-schedule.spec.js with ProjectsPage.
import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { BrowserRouter } from 'react-router-dom'
import SimplePlanningWorkspace from '../../src/components/planning/SimplePlanningWorkspace'
import { listProjects } from '../../src/services/projectControl.service'
import '../../src/index.css'
import '../../src/pages/Projects/ProjectPerformance.css'
import '../../src/pages/Projects/SchedulePerformance.css'
import '../../src/pages/Projects/ProjectPlanningHeader.css'

const store = configureStore({ reducer: { auth: () => ({
  user: { id: 7, is_superuser: true, roles: [], modules: [{ code: 'project_control' }, { code: 'planning_package' }] },
  isAuthenticated: true,
}) } })

function SimplePlanningHarness() {
  const [project, setProject] = useState(null)
  const [error, setError] = useState('')
  const selectedId = new URLSearchParams(window.location.search).get('project')
  useEffect(() => {
    let current = true
    listProjects().then(data => {
      if (current) setProject((data.results || data).find(row => String(row.id) === selectedId))
    }).catch(reason => { if (current) setError(reason.message) })
    return () => { current = false }
  }, [selectedId])
  return <main className="project-performance-workspace">
    {error && <p role="alert">{error}</p>}
    {project && <SimplePlanningWorkspace enterpriseProject={project} />}
  </main>
}

createRoot(document.getElementById('performance-test')).render(<Provider store={store}><BrowserRouter><SimplePlanningHarness /></BrowserRouter></Provider>)
