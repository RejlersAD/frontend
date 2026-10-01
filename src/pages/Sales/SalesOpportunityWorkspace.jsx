import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronRight, Clock3, ExternalLink, FileText, Folder, FolderOpen, RefreshCw, Search, Upload, X } from 'lucide-react';
import salesService from '../../services/sales.service';
import SalesOpportunityDocuments from './SalesOpportunityDocuments';
import { WORKSPACE_FOLDERS, WORKSPACE_STATUS, fileSize, sharePointUrl, validateWorkspace, workspaceError } from './salesOpportunityWorkspace.js';
import './SalesOpportunityWorkspace.css';

export default function SalesOpportunityWorkspace({ record, active = true, explorer = false, initialFolder = '', onOpenExplorer, onCloseExplorer }) {
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
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadId, setUploadId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [notice, setNotice] = useState('');
  const alive = useRef(true);
  const workspaceRequest = useRef(0);
  const filesRequest = useRef(0);
  const uploadDialog = useRef(null);
  const fileInput = useRef(null);
  const storage = selectedStorage || (workspace?.radai_storage ? 'radai' : 'sharepoint');
  const source = storage === 'radai' ? workspace?.radai_storage : workspace;
  const sourceReady = source?.status === 'ready';
  const uploadSource = uploadStorage === 'radai' ? workspace?.radai_storage : workspace;
  const canSubmitUpload = uploadSource?.status === 'ready' && uploadSource.can_upload && !loading && !error;
  const uploadLimit = uploadSource?.max_upload_bytes;

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const loadWorkspace = useCallback(async (quiet = false) => {
    const request = ++workspaceRequest.current;
    if (!quiet) setLoading(true);
    setError('');
    try {
      const response = await salesService.getOpportunityWorkspace(record.id);
      if (alive.current && request === workspaceRequest.current) setWorkspace(validateWorkspace(response, record.id));
    } catch (failure) {
      if (alive.current && request === workspaceRequest.current) {
        setWorkspace(null);
        setError(workspaceError(failure, 'The workspace could not be loaded. Please retry.'));
      }
    } finally { if (alive.current && request === workspaceRequest.current) setLoading(false); }
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
    if (explorer) { setFolderKey(previous => WORKSPACE_FOLDERS.some(folder => folder.key === initialFolder) ? initialFolder : previous || 'correspondence'); setQuery(''); }
  }, [explorer, initialFolder]);
  useEffect(() => {
    if (sourceReady && !error && folderKey) loadFiles(folderKey);
    else { filesRequest.current++; setListing({ files: [], next_cursor: null }); setFilesLoading(false); setFilesError(''); }
  }, [folderKey, sourceReady, error, loadFiles]);
  const openFolder = key => { if (!explorer && onOpenExplorer) { onOpenExplorer(key); return; } setFolderKey(key); setQuery(''); setNotice(''); if (explorer) onOpenExplorer?.(key); };
  const closeFolder = () => { filesRequest.current++; setFolderKey(''); setQuery(''); setFilesError(''); setFilesLoading(false); };
  const workspaceOverview = () => { closeFolder(); onCloseExplorer?.(); };

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

  const beginUpload = () => {
    if (!uploadFile) { setUploadFolder(folderKey || 'correspondence'); setUploadStorage(storage); }
    setUploadOpen(true);
    uploadDialog.current?.showModal();
  };
  const closeUpload = () => {
    if (uploading) return;
    setUploadOpen(false); uploadDialog.current?.close();
  };
  const upload = async event => {
    event.preventDefault();
    if (!uploadFile || !uploadId || uploading || !canSubmitUpload) return;
    if (!uploadFile.size || (uploadLimit && uploadFile.size > uploadLimit)) {
      setUploadError(`Choose a nonempty file${uploadLimit ? ` up to ${fileSize(uploadLimit)}` : ''}.`);
      return;
    }
    setUploading(true); setUploadError(''); setNotice('');
    try {
      await salesService.uploadOpportunityWorkspaceFile(record.id, uploadFolder, uploadFile, uploadId, uploadStorage);
      if (!alive.current) return;
      setNotice(`${uploadFile.name} uploaded to ${WORKSPACE_FOLDERS.find(folder => folder.key === uploadFolder)?.name}${uploadStorage === 'radai' ? ' in RADAI' : ' in SharePoint'}.`);
      setUploadFile(null); setUploadId(''); setUploadOpen(false); uploadDialog.current?.close();
      if (fileInput.current) fileInput.current.value = '';
      loadWorkspace(true);
      if (storage === uploadStorage && folderKey === uploadFolder) loadFiles(folderKey);
    } catch (failure) {
      if (alive.current) setUploadError(workspaceError(failure, 'Upload could not be completed. Your file is retained for retry.'));
    } finally { if (alive.current) setUploading(false); }
  };

  const ready = sourceReady && !error && !loading;
  const folders = source?.folders || WORKSPACE_FOLDERS;
  const selected = folders.find(folder => folder.key === folderKey);
  const filterText = query.trim().toLocaleLowerCase();
  const visibleFolders = folders.filter(folder => `${folder.name} ${folder.purpose}`.toLocaleLowerCase().includes(filterText));
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
    </div>
    {!explorer && workspaceNotice}
    {explorer ? <SalesOpportunityDocuments key={storage} storage={storage} record={record} workspace={workspace} folders={folders} folderKey={folderKey} selected={selected} listing={listing} loading={filesLoading || loading} error={filesError} ready={ready} query={query} notice={workspaceNotice} onQuery={setQuery} onFolder={openFolder} onOverview={workspaceOverview} onUpload={beginUpload} onRefresh={() => { loadWorkspace(); if (ready && folderKey) loadFiles(folderKey); }} onLoadMore={() => loadFiles(folderKey, listing.next_cursor)} onRetry={() => loadFiles(folderKey)} /> : <>
    <div className="sow-toolbar">
      <label className="sow-search"><Search aria-hidden="true" /><input aria-label={selected ? 'Search loaded files' : 'Search workspace folders'} placeholder={selected ? 'Search loaded files in this folder' : 'Search this workspace'} value={query} onChange={event => setQuery(event.target.value)} /></label>
      <button type="button" className="sow-upload" onClick={beginUpload}><Upload aria-hidden="true" />Upload files</button>
      <button type="button" className="sow-icon" aria-label="Refresh workspace" title="Refresh workspace" disabled={loading || settingUp} onClick={() => { loadWorkspace(); if (folderKey) loadFiles(folderKey); }}><RefreshCw aria-hidden="true" /></button>
    </div>
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
        <div className="sow-folder-head" role="row"><span role="columnheader">Folder</span><span role="columnheader">Purpose</span><span role="columnheader">Items</span><span role="columnheader" aria-label="Open folder" /></div>
        {visibleFolders.map(folder => <div role="row" className="sow-folder-row" key={folder.key}>
          <span role="cell"><button type="button" onClick={() => openFolder(folder.key)} aria-label={`Open ${folder.name}`}><Folder aria-hidden="true" /><strong>{folder.name}</strong></button></span>
          <span role="cell" className="sow-folder-purpose">{folder.purpose}</span><span role="cell" className="sow-count">{ready && folder.item_count != null ? folder.item_count : '—'}</span>
          <span role="cell"><button className="sow-icon" type="button" onClick={() => openFolder(folder.key)} aria-label={`Browse ${folder.name}`}><ChevronRight aria-hidden="true" /></button></span>
        </div>)}
      </div>
      {!visibleFolders.length && <p className="sow-empty">No folders match this search.</p>}
      <p className="sow-folder-summary">6 folders{ready && totalCount !== null ? ` · ${totalCount} items` : ' · Item counts unavailable'}</p>
      <p className="sow-muted">Open a folder to view its files and document details.</p>
    </>}
    {ready && <p className="sow-ready-note"><CheckCircle2 aria-hidden="true" />{storage === 'radai' ? 'RADAI attachments available for' : 'Workspace linked to saved opportunity'} {record.deal_code}.</p>}
    </>}
    {explorer && notice && <p className="sow-message sow-success" role="status"><CheckCircle2 aria-hidden="true" />{notice}</p>}
    <dialog ref={uploadDialog} className="sow-upload-dialog" aria-label="Upload opportunity file" onCancel={event => { event.preventDefault(); closeUpload(); }}>
      <form onSubmit={upload}>
        <header><h3>Upload a file</h3><button type="button" className="sow-icon" onClick={closeUpload} disabled={uploading} aria-label="Close upload"><X aria-hidden="true" /></button></header>
        <p>{record.deal_code} · Choose the folder for this document.</p>
        {uploadBlockedReason && <p className="sow-message" role="status">{uploadBlockedReason} Your selected file is kept while this workspace stays open.</p>}
        {uploadError && <p className="sow-message sow-error" role="alert">{uploadError}</p>}
        <fieldset disabled={uploading}>
          {workspace?.radai_storage && <label>Save to<select value={uploadStorage} onChange={event => { setUploadStorage(event.target.value); setUploadId(uploadFile ? crypto.randomUUID() : ''); setUploadError(''); }}><option value="radai">RADAI files</option><option value="sharepoint">SharePoint files</option></select></label>}
          {uploadStorage === 'radai' && <p className="sow-muted">The attachment is saved in RADAI. SharePoint access is not required.</p>}
          <label>Destination folder<select value={uploadFolder} onChange={event => { setUploadFolder(event.target.value); setUploadId(uploadFile ? crypto.randomUUID() : ''); }}>{WORKSPACE_FOLDERS.map(folder => <option key={folder.key} value={folder.key}>{folder.name}</option>)}</select></label>
          <label>File<input ref={fileInput} type="file" onChange={event => { setUploadFile(event.target.files?.[0] || null); setUploadId(event.target.files?.length ? crypto.randomUUID() : ''); setUploadError(''); }} /></label>
          {uploadLimit > 0 && <p className="sow-muted">Maximum file size: {fileSize(uploadLimit)}.</p>}
          {uploadFile && <p className="sow-selected-file">Selected: {uploadFile.name} · {fileSize(uploadFile.size)}</p>}
        </fieldset>
        <footer><button type="button" className="sor-button" onClick={closeUpload} disabled={uploading}>Cancel</button><button type="submit" className="sow-upload" disabled={!uploadOpen || !uploadFile || uploading || !canSubmitUpload}><Upload aria-hidden="true" />{uploading ? 'Uploading…' : uploadError ? 'Retry upload' : 'Upload file'}</button></footer>
      </form>
    </dialog>
  </section>;
}

SalesOpportunityWorkspace.propTypes = { record: PropTypes.object.isRequired, active: PropTypes.bool, explorer: PropTypes.bool, initialFolder: PropTypes.string, onOpenExplorer: PropTypes.func, onCloseExplorer: PropTypes.func };
