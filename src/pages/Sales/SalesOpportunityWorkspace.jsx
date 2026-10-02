import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, ExternalLink, FileText, Folder, FolderOpen, RefreshCw, Search, Upload, X } from 'lucide-react';
import salesService from '../../services/sales.service';
import SalesOpportunityDocuments from './SalesOpportunityDocuments';
import SalesOpportunityFolderTag from './SalesOpportunityFolderTag';
import { patchDocument } from './salesDocumentControl';
import { WORKSPACE_FOLDERS, WORKSPACE_STATUS, fileSize, queuedUploadFiles, retargetUploadQueue, sharePointUrl, uploadFileError, uploadTransferPercent, validateWorkspace, workspaceError } from './salesOpportunityWorkspace.js';
import './SalesOpportunityWorkspace.css';

export default function SalesOpportunityWorkspace({ record, active = true, explorer = false, initialFolder = '', onOpenExplorer }) {
  const [workspace, setWorkspace] = useState(null);
  const [selectedStorage, setSelectedStorage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [folderKey, setFolderKey] = useState(WORKSPACE_FOLDERS.some(folder => folder.key === initialFolder) ? initialFolder : explorer ? 'correspondence' : '');
  const [listing, setListing] = useState({ files: [], next_cursor: null });
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState('');
  const [settingUp, setSettingUp] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFolder, setUploadFolder] = useState('correspondence');
  const [uploadStorage, setUploadStorage] = useState('sharepoint');
  const [uploadQueue, setUploadQueue] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [stoppingUpload, setStoppingUpload] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadDestinationNotice, setUploadDestinationNotice] = useState('');
  const [notice, setNotice] = useState('');
  const alive = useRef(true);
  const workspaceRequest = useRef(0);
  const filesRequest = useRef(0);
  const uploadDialog = useRef(null);
  const fileInput = useRef(null);
  const uploadRunning = useRef(false);
  const uploadStop = useRef(false);
  const uploadContext = useRef(null);
  const storage = selectedStorage || (workspace?.radai_storage ? 'radai' : 'sharepoint');
  const source = storage === 'radai' ? workspace?.radai_storage : workspace;
  const sourceReady = source?.status === 'ready';
  const uploadSource = uploadStorage === 'radai' ? workspace?.radai_storage : workspace;
  const canSubmitUpload = uploadSource?.status === 'ready' && uploadSource.can_upload && !loading && !error;
  const uploadLimit = uploadSource?.max_upload_bytes;
  const retainedUploads = uploadQueue.filter(item => item.status !== 'succeeded');
  uploadContext.current = { opportunityId: record.id, canSubmit: canSubmitUpload, limit: uploadLimit };

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const loadWorkspace = useCallback(async (quiet = false) => {
    const request = ++workspaceRequest.current;
    if (!quiet) setLoading(true);
    setError('');
    try {
      const response = await salesService.getOpportunityWorkspace(record.id);
      if (alive.current && request === workspaceRequest.current) {
        const current = validateWorkspace(response, record.id);
        setWorkspace(current);
        return current;
      }
    } catch (failure) {
      if (alive.current && request === workspaceRequest.current) {
        setWorkspace(null);
        setError(workspaceError(failure, 'The workspace could not be loaded. Please retry.'));
      }
    } finally { if (alive.current && request === workspaceRequest.current) setLoading(false); }
    return null;
  }, [record.id]);
  useEffect(() => { loadWorkspace(); }, [loadWorkspace]);
  useEffect(() => {
    if (!active || !['pending', 'creating'].includes(workspace?.status)) return undefined;
    const timer = setInterval(() => loadWorkspace(true), 4000);
    return () => clearInterval(timer);
  }, [active, workspace?.status, loadWorkspace]);

  const loadFiles = useCallback(async (key, cursor = null) => {
    if (!key || !sourceReady || error) return;
    const request = ++filesRequest.current;
    setFilesLoading(true); setFilesError('');
    if (!cursor) setListing({ files: [], next_cursor: null });
    try {
      const response = await salesService.getOpportunityWorkspaceFiles(record.id, key, cursor, storage);
      if (!response || !Array.isArray(response.files)) throw new Error('The folder listing could not be read. Please retry.');
      if (storage === 'radai' && response.files.some(file => file.storage_provider !== 'radai' || !String(file.id).startsWith('radai-'))) throw new Error('RADAI attachment details could not be verified. Please refresh.');
      if (alive.current && request === filesRequest.current) setListing(previous => ({
        files: [...new Map([...(cursor ? previous.files : []), ...response.files].map(file => [file.id, file])).values()],
        next_cursor: typeof response.next_cursor === 'string' ? response.next_cursor : null,
      }));
      if (alive.current && request === filesRequest.current && Number.isSafeInteger(response.item_count) && response.item_count >= 0) setWorkspace(previous => {
        if (!previous || (storage === 'radai' && !previous.radai_storage)) return previous;
        const mapFolders = items => items.map(folder => folder.key === key ? { ...folder, item_count: response.item_count } : folder);
        return storage === 'radai' ? { ...previous, radai_storage: { ...previous.radai_storage, folders: mapFolders(previous.radai_storage.folders) } } : { ...previous, folders: mapFolders(previous.folders) };
      });
    } catch (failure) {
      if (alive.current && request === filesRequest.current) {
        if ([403, 404].includes(failure?.response?.status)) setListing({ files: [], next_cursor: null });
        setFilesError(workspaceError(failure, 'Files could not be loaded. Please retry.'));
      }
    } finally { if (alive.current && request === filesRequest.current) setFilesLoading(false); }
  }, [record.id, sourceReady, storage, error]);
  useEffect(() => {
    if (explorer) { setFolderKey(WORKSPACE_FOLDERS.some(folder => folder.key === initialFolder) ? initialFolder : 'correspondence'); setQuery(''); }
  }, [explorer, initialFolder]);
  useEffect(() => {
    if (sourceReady && !error && folderKey) loadFiles(folderKey);
    else { filesRequest.current++; setListing({ files: [], next_cursor: null }); setFilesLoading(false); setFilesError(''); }
  }, [folderKey, sourceReady, error, loadFiles]);
  const openFolder = key => { if (!explorer && onOpenExplorer) { onOpenExplorer(key); return; } setFolderKey(key); setQuery(''); setNotice(''); if (explorer) onOpenExplorer?.(key); };
  const closeFolder = () => { filesRequest.current++; setFolderKey(''); setQuery(''); setFilesError(''); setFilesLoading(false); };

  const setup = async () => {
    if (settingUp) return;
    setSettingUp(true); setError('');
    const request = ++workspaceRequest.current;
    try {
      const response = await salesService.setupOpportunityWorkspace(record.id);
      if (alive.current && request === workspaceRequest.current) setWorkspace(validateWorkspace(response, record.id));
    } catch (failure) {
      if (alive.current && request === workspaceRequest.current) setError(workspaceError(failure, 'Workspace setup could not be started. Please retry.'));
    } finally { if (alive.current) setSettingUp(false); }
  };

  const beginUpload = requestedFolder => {
    if (uploadRunning.current) return;
    const rowFolder = WORKSPACE_FOLDERS.find(folder => folder.key === requestedFolder)?.key;
    if (rowFolder || !retainedUploads.length) {
      const destination = rowFolder || folderKey || 'correspondence';
      if (retainedUploads.length && (destination !== uploadFolder || storage !== uploadStorage)) {
        setUploadQueue(retargetUploadQueue);
        setUploadError('');
        setUploadDestinationNotice(`Your selected ${retainedUploads.length === 1 ? 'file is' : 'files are'} kept. Review the new destination: ${WORKSPACE_FOLDERS.find(folder => folder.key === destination)?.name} in ${storage === 'radai' ? 'RADAI' : 'SharePoint'}. Completed uploads stay in their original folder.`);
      } else setUploadDestinationNotice('');
      setUploadFolder(destination); setUploadStorage(storage);
    }
    setUploadOpen(true);
    uploadDialog.current?.showModal();
  };
  const closeUpload = () => {
    if (uploadRunning.current) return;
    setUploadOpen(false); uploadDialog.current?.close();
  };
  const changeUploadDestination = (destination, provider) => {
    if (uploadRunning.current || (destination === uploadFolder && provider === uploadStorage)) return;
    setUploadFolder(destination); setUploadStorage(provider); setUploadQueue(retargetUploadQueue); setUploadError('');
    setUploadDestinationNotice(retainedUploads.length ? `Your selected ${retainedUploads.length === 1 ? 'file is' : 'files are'} kept for the new destination. Completed uploads stay in their original folder.` : '');
  };
  const selectUploadFiles = event => {
    if (uploadRunning.current) return;
    const selected = queuedUploadFiles(event.target.files || []);
    if (selected.length) { setUploadQueue(previous => [...previous, ...selected]); setUploadError(''); }
    event.target.value = '';
  };
  const upload = async event => {
    event.preventDefault();
    if (!retainedUploads.length || uploadRunning.current || !canSubmitUpload) return;
    uploadRunning.current = true; uploadStop.current = false;
    setUploading(true); setStoppingUpload(false); setUploadError(''); setNotice('');
    const currentOpportunity = record.id;
    const stillCurrent = () => alive.current && uploadContext.current?.opportunityId === currentOpportunity;
    const updateItem = (id, changes, progressOnly = false) => { if (stillCurrent()) setUploadQueue(previous => previous.map(item => item.id === id && (!progressOnly || !['succeeded', 'failed'].includes(item.status)) ? { ...item, ...changes } : item)); };
    let succeeded = 0, failures = 0, firstError = '';
    try {
      for (const item of retainedUploads) {
        if (!stillCurrent() || uploadStop.current) break;
        if (!uploadContext.current.canSubmit) { firstError ||= 'Upload access is unavailable. Your remaining files are kept.'; break; }
        const validation = uploadFileError(item.file, uploadContext.current.limit);
        if (validation) { failures++; firstError ||= validation; updateItem(item.id, { status: 'failed', error: validation, progress: null }); continue; }
        updateItem(item.id, { status: 'uploading', error: '', progress: null });
        try {
          const result = await salesService.uploadOpportunityWorkspaceFile(currentOpportunity, uploadFolder, item.file, item.requestId, uploadStorage, {
            onUploadProgress: progressEvent => {
              const progress = uploadTransferPercent(progressEvent);
              updateItem(item.id, { progress, status: progress === 100 ? 'processing' : 'uploading' }, true);
            },
          });
          if (!stillCurrent()) break;
          succeeded++;
          updateItem(item.id, { status: 'succeeded', progress: 100, error: '', result, destination: `${WORKSPACE_FOLDERS.find(folder => folder.key === uploadFolder)?.name} in ${uploadStorage === 'radai' ? 'RADAI' : 'SharePoint'}` });
        } catch (failure) {
          if (!stillCurrent()) break;
          failures++;
          const message = workspaceError(failure, 'Upload could not be completed. Your file is retained for retry.');
          firstError ||= message;
          updateItem(item.id, { status: 'failed', error: message });
          if ([401, 403, 404].includes(failure?.response?.status)) break;
        }
      }
      if (!stillCurrent()) return;
      if (firstError) setUploadError(firstError);
      if (succeeded) {
        const label = retainedUploads.length === 1 ? retainedUploads[0].file.name : `${succeeded} ${succeeded === 1 ? 'file' : 'files'}`;
        setNotice(`${label} uploaded to ${WORKSPACE_FOLDERS.find(folder => folder.key === uploadFolder)?.name} in ${uploadStorage === 'radai' ? 'RADAI' : 'SharePoint'}.`);
        loadWorkspace(true);
        if (storage === uploadStorage && folderKey === uploadFolder) loadFiles(folderKey);
      }
      if (succeeded === retainedUploads.length && !failures) {
        setUploadQueue([]); setUploadDestinationNotice(''); setUploadOpen(false); uploadDialog.current?.close();
      } else if (uploadStop.current) setUploadDestinationNotice('Upload paused. Completed files are saved; remaining files are kept for your next upload.');
    } finally {
      uploadRunning.current = false;
      if (stillCurrent()) { setUploading(false); setStoppingUpload(false); }
    }
  };

  const ready = sourceReady && !error && !loading;
  const tagSaved = result => {
    const update = items => items.map(folder => folder.key === result.folder_key ? { ...folder, tag: result.tag, tag_token: result.expected_token } : folder);
    setWorkspace(previous => previous ? { ...previous, folders: update(previous.folders), ...(previous.radai_storage ? { radai_storage: { ...previous.radai_storage, folders: update(previous.radai_storage.folders) } } : {}) } : previous);
    setNotice(`${WORKSPACE_FOLDERS.find(folder => folder.key === result.folder_key)?.name} tag ${result.tag ? 'saved' : 'cleared'}.`);
  };
  const documentUpdated = result => setListing(previous => ({ ...previous, files: patchDocument(previous.files, result) }));
  const folders = source?.folders || WORKSPACE_FOLDERS;
  const selected = folders.find(folder => folder.key === folderKey);
  const filterText = query.trim().toLocaleLowerCase();
  const visibleFiles = listing.files.filter(file => String(file.name || '').toLocaleLowerCase().includes(filterText));
  const countKnown = folders.every(folder => Number.isSafeInteger(folder.item_count));
  const totalCount = countKnown ? folders.reduce((sum, folder) => sum + folder.item_count, 0) : null;
  const StatusIcon = ready ? CheckCircle2 : workspace?.status === 'failed' || error ? AlertCircle : Clock3;
  const statusText = loading ? 'Loading workspace…' : error ? 'Workspace unavailable' : storage === 'radai' ? ready ? 'RADAI files ready' : 'RADAI storage unavailable' : WORKSPACE_STATUS[workspace?.status] || 'Workspace unavailable';
  const statusMessage = storage === 'radai' ? source?.message || 'RADAI file storage is unavailable. Please refresh or contact your administrator.' : workspace?.status === 'not_configured' ? 'The SharePoint connection needs administrator setup. The opportunity is saved.' : workspace?.message;
  const uploadBlockedReason = !canSubmitUpload ? loading ? 'Checking file storage. You can choose a file while it loads.' : error || (uploadSource?.status === 'ready' ? 'You have read-only access to this workspace. Upload requires permission from your administrator.' : uploadStorage === 'radai' ? uploadSource?.message || 'RADAI file storage is unavailable. Please refresh or contact your administrator.' : 'The SharePoint connection needs administrator setup. Choose RADAI files to attach documents without SharePoint access.') : '';
  const workspaceNotice = error ? <div className="sow-message sow-error" role="alert"><AlertCircle aria-hidden="true" /><span>{error}</span><button type="button" onClick={() => loadWorkspace()}>Retry workspace</button></div> : !loading && !ready ? <div className="sow-message"><span>{statusMessage || 'Workspace folders will connect after SharePoint setup completes.'}</span>{storage === 'sharepoint' && workspace?.can_manage && ['not_created', 'failed'].includes(workspace.status) && <button type="button" onClick={setup} disabled={settingUp}>{settingUp ? 'Starting…' : workspace.status === 'failed' ? 'Retry setup' : 'Create workspace'}</button>}</div> : null;

  return <section className={`sow-workspace ${explorer ? 'sow-explorer-workspace' : ''}`} aria-label="Opportunity document workspace" aria-busy={loading}>
    <div className="sow-location">
      <div className="sow-breadcrumb"><FolderOpen aria-hidden="true" /><span>Opportunities</span><span>/</span><strong>{record.deal_code}</strong>{explorer && selected && <><span>/</span><strong>{selected.name}</strong></>}</div>
      {workspace?.radai_storage && <label className="sow-storage-choice"><span>Storage</span><select aria-label="Document storage" value={storage} onChange={event => { filesRequest.current++; setListing({ files: [], next_cursor: null }); setFilesError(''); setQuery(''); setNotice(''); setSelectedStorage(event.target.value); }}><option value="radai">RADAI files</option><option value="sharepoint">SharePoint files</option></select></label>}
      <span className={`sow-status ${ready ? 'sow-status-ready' : ''}`} role="status"><StatusIcon aria-hidden="true" />{statusText}</span>
      {storage === 'sharepoint' && ready && workspace.web_url && <a href={workspace.web_url} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />Open SharePoint</a>}
      {!selected && <button type="button" className="sow-icon sow-location-refresh" aria-label="Refresh workspace" title="Refresh workspace" disabled={loading || settingUp} onClick={() => loadWorkspace()}><RefreshCw aria-hidden="true" /></button>}
    </div>
    {!explorer && workspaceNotice}
    {explorer ? <SalesOpportunityDocuments key={storage} storage={storage} record={record} workspace={workspace} folders={folders} folderKey={folderKey} selected={selected} listing={listing} loading={filesLoading || loading} error={filesError} ready={ready} query={query} notice={workspaceNotice} onQuery={setQuery} onFolder={openFolder} onUpload={beginUpload} onRefresh={() => { loadWorkspace(); if (ready && folderKey) loadFiles(folderKey); }} onLoadMore={() => loadFiles(folderKey, listing.next_cursor)} onRetry={() => loadFiles(folderKey)} onDocumentUpdated={documentUpdated} /> : <>
    {selected && <div className="sow-toolbar">
      <label className="sow-search"><Search aria-hidden="true" /><input aria-label="Search loaded files" placeholder="Search loaded files in this folder" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <button type="button" className="sow-upload" onClick={beginUpload}><Upload aria-hidden="true" />Upload files</button>
      <button type="button" className="sow-icon" aria-label="Refresh workspace" title="Refresh workspace" disabled={loading || settingUp} onClick={() => { loadWorkspace(); if (folderKey) loadFiles(folderKey); }}><RefreshCw aria-hidden="true" /></button>
    </div>}
    {!loading && ready && !source?.can_upload && <p className="sow-muted">You have read-only access to files in this workspace.</p>}
    {notice && <p className="sow-message sow-success" role="status"><CheckCircle2 aria-hidden="true" />{notice}</p>}
    {selected ? <div className="sow-files">
      <div className="sow-folder-heading"><button type="button" onClick={closeFolder}><ArrowLeft aria-hidden="true" />All folders</button><h3>{selected.name}</h3>{ready && selected.web_url && <a href={selected.web_url} target="_blank" rel="noopener noreferrer">Open folder<ExternalLink aria-hidden="true" /></a>}</div>
      {filesError && <div className="sow-message sow-error" role="alert"><span>{filesError}</span><button type="button" onClick={() => loadFiles(folderKey)}>Retry files</button></div>}
      {!ready ? <p className="sow-muted">{loading ? 'Loading workspace…' : 'Reload the workspace before browsing its files.'}</p> : <>
        <ul className="sow-file-list" aria-label={`${selected.name} files`}>{visibleFiles.map(file => <li key={file.id}>{file.is_folder ? <Folder aria-hidden="true" /> : <FileText aria-hidden="true" />}<div>{sharePointUrl(file.web_url) ? <a href={sharePointUrl(file.web_url)} target="_blank" rel="noopener noreferrer">{file.name}<ExternalLink aria-hidden="true" /></a> : <strong>{file.name}</strong>}<span>{file.is_folder ? "Folder - opens in SharePoint" : fileSize(file.size)}{file.modified_at && !Number.isNaN(new Date(file.modified_at).getTime()) ? ` · Modified ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Asia/Dubai' }).format(new Date(file.modified_at))}` : ''}</span></div></li>)}</ul>
        {filesLoading && <p className="sow-muted" role="status">Loading files…</p>}
        {!filesLoading && !filesError && !visibleFiles.length && <p className="sow-empty">{query ? 'No loaded files match this search.' : 'No files in this folder yet.'}</p>}
        {listing.next_cursor && <button type="button" className="sor-button" disabled={filesLoading} onClick={() => loadFiles(folderKey, listing.next_cursor)}>{filesLoading ? 'Loading…' : 'Load more files'}</button>}
      </>}
    </div> : <>
      <div className="sow-folder-table" role="table" aria-label="Workspace folders">
        <div className="sow-folder-head" role="row"><span role="columnheader">Folder</span><span role="columnheader">Purpose</span><span role="columnheader">Tag</span><span role="columnheader" className="sow-items-heading">Items</span><span role="columnheader">Action</span></div>
        {folders.map(folder => <div role="row" className="sow-folder-row" key={folder.key}>
          <span role="cell"><button type="button" onClick={() => openFolder(folder.key)} aria-label={`Open ${folder.name}`}><Folder aria-hidden="true" /><strong>{folder.name}</strong></button></span>
          <span role="cell" className="sow-folder-purpose">{folder.purpose}</span>
          <span role="cell"><SalesOpportunityFolderTag key={`${record.id}:${folder.key}`} opportunityId={String(record.id)} folder={folder} canEdit={workspace?.can_edit_tags === true && !loading && !error} onSaved={tagSaved} onReload={async () => (await loadWorkspace(true))?.folders.find(current => current.key === folder.key)} /></span>
          <span role="cell" className="sow-count">{ready && folder.item_count != null ? folder.item_count : '—'}</span>
          <span role="cell"><button className="sow-upload sow-row-upload" type="button" onClick={() => beginUpload(folder.key)} aria-label={`Upload to ${folder.name}`}><Upload aria-hidden="true" />Upload</button></span>
        </div>)}
      </div>
      <p className="sow-folder-summary">6 folders{ready && totalCount !== null ? ` · ${totalCount} items` : ' · Item counts unavailable'}</p>
      <p className="sow-muted">Open a folder to view its files and document details.</p>
    </>}
    {ready && <p className="sow-ready-note"><CheckCircle2 aria-hidden="true" />{storage === 'radai' ? 'RADAI attachments available for' : 'Workspace linked to saved opportunity'} {record.deal_code}.</p>}
    </>}
    {explorer && notice && <p className="sow-message sow-success" role="status"><CheckCircle2 aria-hidden="true" />{notice}</p>}
    <dialog ref={uploadDialog} className="sow-upload-dialog" aria-label="Upload opportunity file" onCancel={event => { event.preventDefault(); closeUpload(); }}>
      <form onSubmit={upload}>
        <header><h3>Upload files</h3><button type="button" className="sow-icon" onClick={closeUpload} disabled={uploading} aria-label="Close upload"><X aria-hidden="true" /></button></header>
        <p>{record.deal_code} · Choose files of any type for this folder. Files upload one at a time.</p>
        {uploadBlockedReason && <p className="sow-message" role="status">{uploadBlockedReason} Your selected files are kept while this workspace stays open.</p>}
        {uploadError && <p className="sow-message sow-error" role="alert">{uploadError}</p>}
        {uploadDestinationNotice && <p className="sow-message" role="status">{uploadDestinationNotice}</p>}
        <fieldset disabled={uploading}>
          {workspace?.radai_storage && <label>Save to<select value={uploadStorage} onChange={event => changeUploadDestination(uploadFolder, event.target.value)}><option value="radai">RADAI files</option><option value="sharepoint">SharePoint files</option></select></label>}
          {uploadStorage === 'radai' && <p className="sow-muted">The attachment is saved in RADAI. SharePoint access is not required.</p>}
          {uploadStorage === 'radai' && uploadSource?.automatic_compression === 'lossless_if_smaller' && <p className="sow-muted">Automatic lossless compression when it reduces file size. Downloads retain the original data.</p>}
          <label>Destination folder<select value={uploadFolder} onChange={event => changeUploadDestination(event.target.value, uploadStorage)}>{WORKSPACE_FOLDERS.map(folder => <option key={folder.key} value={folder.key}>{folder.name}</option>)}</select></label>
          <label>File<input ref={fileInput} type="file" multiple onChange={selectUploadFiles} /></label>
          {uploadLimit > 0 && <p className="sow-muted">Maximum file size: {fileSize(uploadLimit)}.</p>}
        </fieldset>
        {!!uploadQueue.length && <ul className="sow-upload-queue" aria-label="Selected files">{uploadQueue.map(item => <li key={item.id} aria-label={item.file.name}>
          <div className="sow-upload-file-heading"><p className="sow-selected-file">Selected: <strong>{item.file.name}</strong> · {fileSize(item.file.size)}</p>{item.status !== 'succeeded' && <button type="button" className="sow-icon" aria-label={`Remove ${item.file.name}`} disabled={uploading} onClick={() => { setUploadQueue(previous => previous.filter(current => current.id !== item.id)); setUploadError(''); }}><X aria-hidden="true" /></button>}</div>
          <span className={`sow-upload-state sow-upload-state-${item.status}`} role="status">{item.status === 'succeeded' ? `Uploaded to ${item.destination}` : item.status === 'failed' ? 'Needs retry' : item.status === 'processing' ? 'Processing on the server…' : item.status === 'uploading' ? item.progress == null ? 'Uploading…' : `Uploading ${item.progress}%` : 'Waiting'}</span>
          {['uploading', 'processing'].includes(item.status) && <progress aria-label={`Upload progress for ${item.file.name}`} max="100" {...(item.progress == null ? {} : { value: item.progress })} />}
          {item.error && <p className="sow-upload-file-error">{item.error}</p>}
          {item.status === 'succeeded' && item.result?.storage_encoding === 'gzip' && Number.isSafeInteger(item.result.stored_size) && <p className="sow-muted">Stored size: {fileSize(item.result.stored_size)} with lossless compression.</p>}
        </li>)}</ul>}
        <footer>{uploading && <button type="button" className="sor-button" disabled={stoppingUpload} onClick={() => { uploadStop.current = true; setStoppingUpload(true); }}>{stoppingUpload ? 'Stopping after this file…' : 'Stop after this file'}</button>}<button type="button" className="sor-button" onClick={closeUpload} disabled={uploading}>Cancel</button><button type="submit" className="sow-upload" disabled={!uploadOpen || !retainedUploads.length || uploading || !canSubmitUpload}><Upload aria-hidden="true" />{uploading ? 'Uploading…' : uploadError ? retainedUploads.length > 1 ? 'Retry remaining files' : 'Retry upload' : retainedUploads.length > 1 ? `Upload ${retainedUploads.length} files` : 'Upload file'}</button></footer>
      </form>
    </dialog>
  </section>;
}

SalesOpportunityWorkspace.propTypes = { record: PropTypes.object.isRequired, active: PropTypes.bool, explorer: PropTypes.bool, initialFolder: PropTypes.string, onOpenExplorer: PropTypes.func };
