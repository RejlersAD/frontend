import apiClient from './api.service';

const BASE = '/pid/equipment-registers';

export async function getCurrentEquipmentRegister(projectId) {
  const response = await apiClient.get(`${BASE}/current/`, {
    params: { project_id: projectId },
    validateStatus: status => status === 200 || status === 204,
  });
  return response.status === 204 ? null : response.data;
}

export async function importEquipmentExtraction({
  projectId,
  uploadId,
  files,
  drawingRef,
  items,
}) {
  const response = await apiClient.post(`${BASE}/import-extraction/`, {
    project_id: projectId,
    source_upload_id: uploadId,
    source_files: files,
    drawing_ref: drawingRef || '',
    extraction_mode: 'ai',
    items,
  });
  return response.data;
}

export async function updateEquipmentItem({
  registerId,
  itemId,
  expectedRevisionVersion,
  fields,
  reason = '',
}) {
  const response = await apiClient.patch(
    `${BASE}/${registerId}/items/${itemId}/`,
    {
      expected_revision_version: expectedRevisionVersion,
      set: fields,
      reason,
    },
  );
  return response.data;
}

export async function getEquipmentRegisterChanges(registerId, itemId = '') {
  const response = await apiClient.get(`${BASE}/${registerId}/changes/`, {
    params: itemId ? { item_id: itemId } : undefined,
  });
  return response.data;
}
