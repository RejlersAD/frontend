import { Buffer } from 'node:buffer';
import { prepareRegister, opportunity } from './sales-opportunity-register-api';
import { proposalReviewPdf } from './sales-proposal-pdf.fixture';
import { WORKSPACE_FOLDERS } from '../../src/pages/Sales/salesOpportunityWorkspace';

const root = 'https://rejlerssverige.sharepoint.com/sites/Sales/Opportunities/Q-102101';
const defaultSources = [
  { key: 'first', name: 'Engineering_scope.pdf', mime_type: 'application/pdf', bytes: proposalReviewPdf({ title: 'Engineering scope fixture', pages: 3 }) },
  { key: 'second', name: 'Updated_scope.pdf', mime_type: 'application/pdf', bytes: proposalReviewPdf({ title: 'Updated scope fixture', pages: 2 }) },
  { key: 'text', name: 'Review_notes.txt', mime_type: 'text/plain', bytes: Buffer.from('Synthetic review notes\n<script>window.previewContentExecuted = true</script>\nPlain text stays plain text.') },
  { key: 'image', name: 'Site_diagram.png', mime_type: 'image/png', bytes: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') },
  { key: 'active', name: 'Client_page.html', mime_type: 'text/html', bytes: Buffer.from('<script>window.previewContentExecuted = true</script>') },
];

export async function prepareOpportunityPreview(page, configuration = {}) {
  const sources = configuration.sources || defaultSources;
  const fixture = {
    detailStatuses: {}, detailPatches: {}, downloadStatuses: {}, downloadHolds: {}, bytes: {},
    sharepointReady: false, downloads: [], abortedDownloads: [], ...configuration,
  };
  page.on('requestfailed', request => {
    const match = request.url().match(/\/files\/([^/]+)\/download\/$/);
    if (match) fixture.abortedDownloads.push(match[1]);
  });
  const records = Object.fromEntries(['radai', 'sharepoint'].map(provider => [provider, sources.map((source, index) => ({
    id: provider === 'radai' ? `radai-00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}` : `sharepoint-${source.key}`,
    name: source.name, mime_type: source.mime_type, size: source.bytes.length, storage_provider: provider,
    version: '1', publication_level: provider === 'sharepoint' ? 'published' : null,
    is_folder: false, modified_at: '2026-10-01T08:00:00Z',
    web_url: provider === 'sharepoint' ? `${root}/Proposal/${source.name}` : null,
  }))]));
  fixture.file = (key, provider = 'radai') => records[provider][sources.findIndex(source => source.key === key)];
  const allFiles = [...records.radai, ...records.sharepoint];
  const state = await prepareRegister(page, {
    realShell: configuration.realShell,
    entry: '/sales/opportunities?record=opportunity-0&workspace=1&folder=proposal',
    records: [opportunity(0, { deal_name: 'Opportunity file preview fixture' })],
    workspaceHandler: async route => {
      const request = route.request(), url = new URL(request.url()), path = url.pathname;
      const folder = path.split('/folders/')[1]?.split('/')[0];
      if (path.endsWith('/workspace/')) return route.fulfill({ json: {
        opportunity_id: 'opportunity-0', status: fixture.sharepointReady ? 'ready' : 'not_configured',
        web_url: fixture.sharepointReady ? root : '', can_upload: false, can_manage: false, max_upload_bytes: null,
        folders: WORKSPACE_FOLDERS.map(item => ({ ...item, item_count: fixture.sharepointReady ? item.key === 'proposal' ? sources.length : 0 : null, web_url: fixture.sharepointReady ? `${root}/${item.name}` : '' })),
        radai_storage: { status: 'ready', can_upload: false, max_upload_bytes: null,
          folders: WORKSPACE_FOLDERS.map(item => ({ ...item, item_count: item.key === 'proposal' ? sources.length : 0 })),
        },
      } });
      if (path.endsWith('/files/')) {
        const provider = url.searchParams.get('storage') === 'radai' ? 'radai' : 'sharepoint';
        const files = folder === 'proposal' ? records[provider] : [];
        return route.fulfill({ json: { folder_key: folder, files, item_count: files.length, next_cursor: null } });
      }
      const fileId = path.split('/files/')[1]?.split('/')[0];
      const file = allFiles.find(item => item.id === fileId);
      if (!file) return route.fulfill({ status: 404, json: { detail: 'Synthetic file unavailable.' } });
      if (path.endsWith('/versions/')) return route.fulfill({ json: { file_id: fileId, versions: [{ id: '1', is_current: true, size: file.size, modified_at: file.modified_at }], next_cursor: null } });
      if (path.endsWith('/download/')) {
        fixture.downloads.push({ id: fileId, folder, path });
        if (fixture.downloadHolds[fileId]) await fixture.downloadHolds[fileId];
        const status = fixture.downloadStatuses[fileId] || 200;
        if (status !== 200) return route.fulfill({ status, json: { detail: status === 403 ? 'File preview permission denied.' : 'File preview is temporarily unavailable.' } });
        const source = sources.find(item => item.name === file.name);
        return route.fulfill({ contentType: file.mime_type, headers: { 'content-disposition': `attachment; filename="${file.name}"` }, body: fixture.bytes[fileId] || source.bytes });
      }
      const status = fixture.detailStatuses[fileId] || 200;
      return route.fulfill({ status, json: status === 200 ? {
        ...file, size: fixture.bytes[fileId]?.length ?? file.size, folder_key: folder, can_download: true, max_download_bytes: null,
        created_by: 'Synthetic reviewer', modified_by: 'Synthetic reviewer', ...(fixture.detailPatches[fileId] || {}),
      } : { detail: 'File metadata access denied.' } });
    },
  });
  return { fixture, state };
}
