/**
 * useActiveProject
 * ================
 * Generic localStorage-backed "active project" hook, mirroring the pattern
 * used by Spec Customization (`specCustomActiveProject`) / Non-TEFF
 * (`nonTeffActiveProject`) — generalized so any tool can adopt it by just
 * passing its own storage key.
 */
import { useCallback, useEffect, useState } from 'react';

export default function useActiveProject(storageKey) {
  const [activeProject, setActiveProjectState] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setActiveProjectState(JSON.parse(raw));
    } catch (_) { /* ignore corrupt storage */ }
    setHydrated(true);
  }, [storageKey]);

  const setActiveProject = useCallback((project) => {
    setActiveProjectState(project);
    try {
      if (project) {
        localStorage.setItem(storageKey, JSON.stringify({
          project_id: project.project_id,
          name:       project.name,
          code:       project.code,
          plant:      project.plant,
          client:     project.client,
          discipline: project.discipline,
        }));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch (_) { /* ignore */ }
  }, [storageKey]);

  const clearActiveProject = useCallback(() => setActiveProject(null), [setActiveProject]);

  return { activeProject, setActiveProject, clearActiveProject, hydrated };
}
