export const WORKSPACE_FOLDERS = [
  { key: 'correspondence', name: 'Correspondence', purpose: 'Client emails and clarifications' },
  { key: 'tender', name: 'Tender', purpose: 'RFQs, scope and tender documents' },
  { key: 'proposal', name: 'Proposal', purpose: 'Technical and commercial drafts' },
  { key: 'internal', name: 'Internal', purpose: 'Estimates, reviews and approvals' },
  { key: 'submitted', name: 'Submitted', purpose: 'Issued proposals and submission receipts' },
  { key: 'award', name: 'Award', purpose: 'Award notices and contract documents' },
];

export const WORKSPACE_STATUS = {
  not_configured: 'SharePoint setup required', not_created: 'Workspace not created',
  pending: 'Workspace queued', creating: 'Creating workspace', ready: 'Workspace ready', failed: 'Workspace setup failed',
};

// External links must remain on SharePoint, including when supplied in file metadata.
export function sharePointUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && url.hostname.endsWith('.sharepoint.com') ? url.href : '';
  } catch { return ''; }
}

export function validateWorkspace(value, opportunityId) {
  if (!value || String(value.opportunity_id) !== String(opportunityId) || !Object.hasOwn(WORKSPACE_STATUS, value.status) || !Array.isArray(value.folders)) {
    throw new Error('The workspace response is unavailable. Retry to load its current status.');
  }
  if (value.status === 'ready' && (!sharePointUrl(value.web_url) || value.folders.length !== WORKSPACE_FOLDERS.length || WORKSPACE_FOLDERS.some(template => value.folders.filter(folder => folder?.key === template.key && sharePointUrl(folder.web_url)).length !== 1))) {
    throw new Error('The workspace folder links could not be verified. Retry to load the current workspace.');
  }
  const folders = WORKSPACE_FOLDERS.map(template => {
    const item = value.folders.find(folder => folder?.key === template.key);
    return { ...template, tag: typeof item?.tag === 'string' ? item.tag : '', tag_token: typeof item?.tag_token === 'string' ? item.tag_token : '', item_count: Number.isSafeInteger(item?.item_count) && item.item_count >= 0 ? item.item_count : null, web_url: sharePointUrl(item?.web_url) };
  });
  let radaiStorage;
  if (value.radai_storage != null) {
    const local = value.radai_storage;
    if (!['ready', 'unavailable'].includes(local.status) || !Array.isArray(local.folders) || (local.status === 'ready' && WORKSPACE_FOLDERS.some(template => local.folders.filter(folder => folder?.key === template.key && Number.isSafeInteger(folder.item_count) && folder.item_count >= 0).length !== 1))) throw new Error('RADAI file storage could not be verified. Refresh the workspace.');
    radaiStorage = { status: local.status, can_upload: local.can_upload === true, message: typeof local.message === 'string' ? local.message : '', max_upload_bytes: Number.isSafeInteger(local.max_upload_bytes) && local.max_upload_bytes > 0 ? local.max_upload_bytes : null, automatic_compression: local.automatic_compression === 'lossless_if_smaller' ? local.automatic_compression : null, folders: WORKSPACE_FOLDERS.map(template => { const item = local.folders.find(folder => folder?.key === template.key); return { ...template, item_count: Number.isSafeInteger(item?.item_count) && item.item_count >= 0 ? item.item_count : null, web_url: '' }; }) };
  }
  if (radaiStorage) radaiStorage.folders = radaiStorage.folders.map(folder => {
    const canonical = folders.find(item => item.key === folder.key);
    return { ...folder, tag: canonical.tag, tag_token: canonical.tag_token };
  });
  return { ...value, folders, radai_storage: radaiStorage, max_upload_bytes: Number.isSafeInteger(value.max_upload_bytes) && value.max_upload_bytes > 0 ? value.max_upload_bytes : null, web_url: sharePointUrl(value.web_url), can_manage: value.can_manage === true, can_upload: value.can_upload === true, can_edit_tags: value.can_edit_tags === true };
}

export function queuedUploadFiles(files, createId = () => crypto.randomUUID()) {
  return Array.from(files, file => ({ id: createId(), requestId: createId(), file, status: 'pending', progress: null, error: '' }));
}

export function retargetUploadQueue(queue, createId = () => crypto.randomUUID()) {
  return queue.map(item => item.status === 'succeeded' ? item : { ...item, requestId: createId(), status: 'pending', progress: null, error: '' });
}

export function uploadFileError(file, limit) {
  if (!Number.isSafeInteger(file?.size) || file.size <= 0) return 'Choose a nonempty file.';
  return Number.isSafeInteger(limit) && limit > 0 && file.size > limit ? `This file exceeds the maximum file size of ${fileSize(limit)}.` : '';
}

export function uploadTransferPercent(event) {
  return Number.isFinite(event?.loaded) && event.loaded >= 0 && Number.isFinite(event.total) && event.total > 0
    ? Math.min(100, Math.floor(event.loaded / event.total * 100)) : null;
}

export function workspaceError(error, fallback) {
  const status = error?.response?.status;
  if (status === 403) return 'You do not have permission to perform this workspace action.';
  if (status === 404) return 'This opportunity workspace is unavailable. Refresh or contact your administrator.';
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  const fileErrors = error?.response?.data?.file;
  if (Array.isArray(fileErrors) && fileErrors.every(value => typeof value === 'string')) return fileErrors.join(' ');
  return error?.response ? fallback : error?.message || fallback;
}

export function fileSize(value) {
  if (!Number.isFinite(value) || value < 0) return 'Size unavailable';
  return value < 1024 ? `${value} B` : value < 1024 ** 2 ? `${(value / 1024).toFixed(1)} KB` : `${(value / 1024 ** 2).toFixed(1)} MB`;
}

export function documentType(file) {
  if (file?.is_folder) return { label: 'Folder', mark: '', tone: 'folder' };
  const name = String(file?.name || '');
  const extension = name.includes('.') ? name.split('.').at(-1)?.toLowerCase() : '';
  if (['doc', 'docx', 'odt'].includes(extension)) return { label: 'Word document', mark: 'W', tone: 'word' };
  if (['xls', 'xlsx', 'xlsm', 'csv', 'ods'].includes(extension)) return { label: 'Spreadsheet', mark: 'X', tone: 'sheet' };
  if (extension === 'pdf') return { label: 'PDF document', mark: 'PDF', tone: 'pdf' };
  if (['ppt', 'pptx'].includes(extension)) return { label: 'Presentation', mark: 'P', tone: 'slides' };
  return { label: extension && extension !== file?.name ? `${extension.toUpperCase()} file` : 'Document', mark: '', tone: 'file' };
}

export function documentDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return { date: 'Not available', time: '' };
  return { date: new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Asia/Dubai' }).format(date), time: new Intl.DateTimeFormat('en-GB', { timeStyle: 'short', timeZone: 'Asia/Dubai' }).format(date) };
}

export function publicationLabel(value) {
  return value === 'published' ? 'Published' : value === 'checkout' ? 'Checked out' : 'Not available';
}
