import { prepareRegister, opportunity } from './sales-opportunity-register-api';
import { proposalReviewPdf } from './sales-proposal-pdf.fixture';
import { WORKSPACE_FOLDERS } from '../../src/pages/Sales/salesOpportunityWorkspace';

export const typeCatalog = [
  { value: 'unclassified', label: 'Unclassified', color: 'slate' },
  { value: 'technical_proposal', label: 'Technical Proposal', color: 'violet' },
  { value: 'commercial_proposal', label: 'Commercial Proposal', color: 'violet' },
  { value: 'tq', label: 'TQ', color: 'slate' },
  { value: 'contract', label: 'Contract', color: 'emerald' },
];
export function classification(changes = {}) {
  return { document_type: 'technical_proposal', label: 'Technical Proposal', color: 'violet', origin: 'rule', status: 'completed', revision: 1, suggested_type: 'technical_proposal', custom_tag: '', evidence: [{ source: 'filename', rule: 'technical_proposal', matched_text: 'Technical proposal' }], error_code: '', ai_status: 'not_needed', can_edit: true, can_retry: true, source_upload_id: '00000000-0000-4000-8000-000000000001', ...changes };
}
const id = number => `radai-00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const docId = '00000000-0000-4000-8000-000000000001';

export async function prepareDocumentControl(page, configuration = {}) {
  const firstBytes = proposalReviewPdf({ title: 'Original controlled proposal', pages: 1 });
  const newBytes = proposalReviewPdf({ title: 'Revised controlled proposal', pages: 2 });
  const first = { id: id(1), document_id: docId, document_name: 'Technical_Proposal.pdf', name: 'Technical_Proposal.pdf', size: firstBytes.length, mime_type: 'application/pdf', storage_provider: 'radai', version: '1', is_current: true, head_file_id: id(1), head_token: 'head-1', can_upload_version: true, can_download: true, is_folder: false, web_url: null, modified_at: '2026-10-01T08:00:00Z', created_by: 'Synthetic reviewer', modified_by: 'Synthetic reviewer', classification: classification(configuration.classification) };
  const state = { current: first, uploads: [], confirmations: [], retries: [], classificationReads: [], downloads: [], detailStatus: 200, classificationStatus: 200, saveStatus: 200, uploadStatus: 201, downloadStatus: 200, typeHold: null, versionHold: null, canUpload: true, ...configuration };
  const versions = [{ ...first, id: '1', file_id: first.id, revision_note: 'Initial upload' }];
  const files = new Map([[first.id, first]]);
  const bytes = new Map([[first.id, firstBytes]]);
  const commands = new Map();
  const requests = await prepareRegister(page, {
    realShell: configuration.realShell,
    entry: '/sales/opportunities?record=opportunity-0&workspace=1&folder=proposal',
    records: [opportunity(0, { deal_name: 'Document control fixture' })],
    workspaceHandler: async route => {
      const request = route.request(), url = new URL(request.url()), path = url.pathname;
      const folder = path.split('/folders/')[1]?.split('/')[0];
      const fileId = path.split('/files/')[1]?.split('/')[0];
      if (path.endsWith('/workspace/')) return route.fulfill({ json: { opportunity_id: 'opportunity-0', status: 'not_configured', web_url: '', can_upload: false, folders: WORKSPACE_FOLDERS, type_catalog: typeCatalog, radai_storage: { status: 'ready', can_upload: state.canUpload, max_upload_bytes: null, folders: WORKSPACE_FOLDERS.map(item => ({ ...item, item_count: item.key === 'proposal' ? 1 : 0 })) } } });
      if (path.endsWith('/files/')) return route.fulfill({ json: { folder_key: folder, files: folder === 'proposal' ? [state.current] : [], item_count: folder === 'proposal' ? 1 : 0, next_cursor: null } });
      const source = files.get(fileId);
      if (!source || folder !== 'proposal') return route.fulfill({ status: 404, json: { detail: 'File unavailable.' } });
      if (path.endsWith('/classification/') && request.method() === 'GET') {
        state.classificationReads.push(fileId);
        if (state.typeHold) await state.typeHold;
        return route.fulfill({ status: state.classificationStatus, json: state.classificationStatus === 200 ? { classification: source.classification, type_catalog: typeCatalog } : { detail: 'Classification permission denied.' } });
      }
      if (path.endsWith('/classification/') || path.endsWith('/classification/retry/')) {
        const payload = request.postDataJSON();
        const retry = path.endsWith('/retry/');
        (retry ? state.retries : state.confirmations).push(payload);
        if (commands.has(payload.request_id)) return route.fulfill({ json: { ...commands.get(payload.request_id), replayed: true } });
        if (state.saveStatus !== 200) return route.fulfill({ status: state.saveStatus, json: { detail: state.saveStatus === 409 ? 'This document type changed. Refresh before saving.' : 'Document type could not be saved.' } });
        if (payload.expected_revision !== source.classification.revision) return route.fulfill({ status: 409, json: { detail: 'This document metadata changed. Refresh before saving.' } });
        const option = typeCatalog.find(item => item.value === payload.document_type);
        source.classification = retry ? { ...source.classification, status: 'queued', can_retry: false } : {
          ...source.classification,
          ...(option ? { document_type: option.value, label: option.label, color: option.color, origin: 'confirmed' } : {}),
          ...(Object.hasOwn(payload, 'custom_tag') ? { custom_tag: payload.custom_tag.trim().normalize('NFC') } : {}),
          revision: source.classification.revision + 1,
        };
        const result = { classification: source.classification, replayed: false }; commands.set(payload.request_id, result);
        if (retry && state.abortRetryOnce) { state.abortRetryOnce = false; return route.abort('failed'); }
        if (!retry && state.abortSaveOnce) { state.abortSaveOnce = false; return route.abort('failed'); }
        return route.fulfill({ json: result });
      }
      if (path.endsWith('/versions/upload/')) {
        const body = request.postDataBuffer().toString();
        const value = key => body.match(new RegExp(`name="${key}"\\r\\n\\r\\n([^\\r]+)`))?.[1] || '';
        const attempt = { body, requestId: value('upload_request_id'), token: value('expected_token'), note: value('revision_note') };
        state.uploads.push(attempt);
        if (state.versionHold) await state.versionHold;
        if (commands.has(attempt.requestId)) return route.fulfill({ status: 200, json: commands.get(attempt.requestId) });
        if (state.uploadStatus !== 201) return route.fulfill({ status: state.uploadStatus, json: { detail: state.uploadStatus === 409 ? 'The current version changed. Refresh before uploading.' : 'Version storage is temporarily unavailable.' } });
        const next = { ...state.current, id: id(versions.length + 1), name: body.match(/filename="([^"]+)"/)?.[1] || 'Revised_Proposal.pdf', size: newBytes.length, version: String(versions.length + 1), head_file_id: id(versions.length + 1), head_token: `head-${versions.length + 1}`, modified_at: '2026-10-01T09:00:00Z', classification: { ...state.current.classification, status: 'queued', can_retry: false } };
        source.is_current = false; source.head_token = next.head_token; source.head_file_id = next.id;
        versions.forEach(item => { item.is_current = false; });
        files.set(next.id, next); bytes.set(next.id, newBytes); state.current = next;
        versions.unshift({ ...next, id: next.version, file_id: next.id, revision_note: attempt.note });
        commands.set(attempt.requestId, next);
        if (state.abortUploadOnce) { state.abortUploadOnce = false; return route.abort('failed'); }
        return route.fulfill({ status: 201, json: next });
      }
      if (path.endsWith('/versions/')) return route.fulfill({ json: { file_id: fileId, versions, next_cursor: null } });
      if (path.endsWith('/download/')) {
        state.downloads.push(fileId);
        if (state.downloadHold) await state.downloadHold;
        return state.downloadStatus !== 200 ? route.fulfill({ status: state.downloadStatus, json: { detail: 'Download permission denied.' } }) : route.fulfill({ contentType: 'application/pdf', headers: { 'content-disposition': `attachment; filename="${source.name}"` }, body: bytes.get(fileId) });
      }
      return route.fulfill({ status: state.detailStatus, json: state.detailStatus === 200 ? { ...source, folder_key: folder, max_upload_bytes: null, max_download_bytes: null, can_upload_version: source.can_upload_version && state.canUpload } : { detail: 'File access denied.' } });
    },
  });
  return { state, requests, files, versions, first, newBytes };
}
