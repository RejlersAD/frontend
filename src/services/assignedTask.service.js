import api from './api.service'

const taskPath = id => {
  if (!/^\d+$/.test(String(id))) throw new Error('Select an assigned task.')
  return `/dashboard/work-hub/tasks/${id}/`
}

export const assignedTaskService = {
  get: (id, signal) => api.get(taskPath(id), { signal, suppressErrorToast: true }).then(response => response.data),
  update: (id, changes, signal) => api.patch(taskPath(id), changes, { signal, suppressErrorToast: true }).then(response => response.data),
}
