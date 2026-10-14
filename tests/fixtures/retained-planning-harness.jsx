/* The retained evidence/WBS components are tested independently from the current
 * Master Schedule route, which has its own integration suites. These fixture
 * controls only provide project selection and the existing form-submit boundary.
 */
import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { BrowserRouter, useSearchParams } from 'react-router-dom'
import PlanningPackagePage from '../../src/pages/PlanningPackagePage'
import ProjectSelector from '../../src/pages/Projects/components/ProjectSelector'
import { listProjects } from '../../src/services/projectControl.service'
import '../../src/index.css'
import '../../src/pages/Projects/ProjectPerformance.css'
import '../../src/pages/Projects/SchedulePerformance.css'
import '../../src/pages/Projects/ProjectPlanningHeader.css'

const store = configureStore({ reducer: { auth: () => ({
  user: { id: 7, is_superuser: true, roles: [], modules: [{ code: 'project_control' }, { code: 'planning_package' }] },
  isAuthenticated: true,
}) } })

function RetainedPlanningHarness() {
  const [params, setParams] = useSearchParams()
  const [projects, setProjects] = useState([])
  const [error, setError] = useState('')
  const selected = projects.find(project => String(project.id) === params.get('project'))
  useEffect(() => {
    let active = true
    listProjects().then(data => { if (active) setProjects(data.results || data) }).catch(reason => { if (active) setError(reason.message) })
    return () => { active = false }
  }, [])
  const save = () => (document.getElementById('project-planning-work-breakdown-form') || document.getElementById('project-planning-inputs-form'))?.requestSubmit()
  return <main className="project-performance-workspace retained-planning-fixture">
    <style>{'.retained-planning-fixture { padding: 16px; min-width: 0; } .retained-planning-fixture > header { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; } @media (min-width: 1101px) { .retained-planning-fixture { margin-left: 198px; } }'}</style>
    <header aria-label="Retained planning component controls">
      <ProjectSelector compact projects={projects} value={params.get('project')} onChange={id => setParams(current => { const next = new URLSearchParams(current); next.set('project', id); return next })} loading={!projects.length && !error} error={error} label="Active Project" />
      <button type="button" className="pp-button" onClick={save} disabled={!selected}>Save draft</button>
    </header>
    {selected && <PlanningPackagePage key={selected.id} embedded enterpriseProject={selected} />}
  </main>
}

createRoot(document.getElementById('performance-test')).render(<Provider store={store}><BrowserRouter><RetainedPlanningHarness /></BrowserRouter></Provider>)
