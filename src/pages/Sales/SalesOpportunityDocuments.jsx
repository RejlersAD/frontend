import { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Folder,
  FolderPlus,
  Info,
  MoreHorizontal,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import salesService from "../../services/sales.service";
import SalesOpportunityFilePreview from "./SalesOpportunityFilePreview";
import { SalesDocumentTag } from "./SalesDocumentType";
import SalesDocumentVersionUpload from "./SalesDocumentVersionUpload";
import useDocumentClassificationPolling from "./useDocumentClassificationPolling";
import {
  documentDate,
  documentType,
  fileSize,
  publicationLabel,
  sharePointUrl,
  workspaceError,
} from "./salesOpportunityWorkspace";
import "./SalesOpportunityDocuments.css";
import "./SalesDocumentControl.css";

function FileIcon({ file }) {
  const type = documentType(file);
  return (
    <span
      className={`sod-file-icon sod-file-icon-${type.tone}`}
      aria-hidden="true"
    >
      {file.is_folder ? <Folder /> : type.mark || <FileText />}
    </span>
  );
}
FileIcon.propTypes = { file: PropTypes.object.isRequired };

function DocumentDetails({
  recordId,
  folder,
  file,
  onClose,
  onPreview,
  onVersionSaved,
}) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("Details");
  const [versions, setVersions] = useState({ versions: [], next_cursor: null });
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const alive = useRef(true);
  const detailRequest = useRef(0);
  const versionRequest = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const loadDetail = useCallback(async () => {
    const request = ++detailRequest.current;
    setLoading(true);
    setError("");
    setDetail(null);
    setDownloadError("");
    try {
      const response = await salesService.getOpportunityWorkspaceFile(
        recordId,
        folder.key,
        file.id,
      );
      if (
        !response ||
        response.id !== file.id ||
        response.folder_key !== folder.key ||
        response.is_folder !== false
      )
        throw new Error("Document details could not be verified.");
      if (alive.current && request === detailRequest.current)
        setDetail(response);
    } catch (failure) {
      if (alive.current && request === detailRequest.current) {
        if ([403, 404].includes(failure?.response?.status)) {
          ++versionRequest.current;
          setVersions({ versions: [], next_cursor: null });
          setVersionsLoading(false);
        }
        setError(
          workspaceError(failure, "Document details could not be loaded."),
        );
      }
    } finally {
      if (alive.current && request === detailRequest.current) setLoading(false);
    }
  }, [recordId, folder.key, file.id]);
  const loadVersions = useCallback(
    async (cursor = null) => {
      const request = ++versionRequest.current;
      setVersionsLoading(true);
      setVersionsError("");
      if (!cursor) setVersions({ versions: [], next_cursor: null });
      try {
        const response = await salesService.getOpportunityWorkspaceVersions(
          recordId,
          folder.key,
          file.id,
          cursor,
        );
        if (response?.file_id !== file.id || !Array.isArray(response.versions))
          throw new Error("Version history could not be verified.");
        if (alive.current && request === versionRequest.current)
          setVersions((previous) => ({
            versions: [
              ...new Map(
                [
                  ...(cursor ? previous.versions : []),
                  ...response.versions,
                ].map((version) => [version.id, version]),
              ).values(),
            ],
            next_cursor:
              typeof response.next_cursor === "string"
                ? response.next_cursor
                : null,
          }));
      } catch (failure) {
        if (alive.current && request === versionRequest.current) {
          if ([403, 404].includes(failure?.response?.status)) {
            setVersions({ versions: [], next_cursor: null });
            ++detailRequest.current;
            setDetail(null);
            setLoading(false);
            setError(
              workspaceError(failure, "Document access could not be verified."),
            );
          }
          setVersionsError(
            workspaceError(failure, "Version history could not be loaded."),
          );
        }
      } finally {
        if (alive.current && request === versionRequest.current)
          setVersionsLoading(false);
      }
    },
    [recordId, folder.key, file.id],
  );
  useEffect(() => {
    loadDetail();
    loadVersions();
  }, [loadDetail, loadVersions]);
  const download = async (version = null) => {
    if (!detail?.can_download || downloading) return;
    const request = detailRequest.current;
    setDownloading(true);
    setDownloadError("");
    try {
      const { blob, filename } =
        await salesService.downloadOpportunityWorkspaceFile(
          recordId,
          folder.key,
          version?.file_id || file.id,
        );
      if (!alive.current || request !== detailRequest.current) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename || version?.name || detail.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      if (alive.current) {
        if ([403, 404].includes(failure?.response?.status)) {
          ++detailRequest.current;
          ++versionRequest.current;
          setDetail(null);
          setVersions({ versions: [], next_cursor: null });
          setVersionsLoading(false);
          setLoading(false);
          setError(
            workspaceError(failure, "Document access could not be verified."),
          );
        }
        setDownloadError(
          workspaceError(
            failure,
            "The document could not be downloaded. Please retry.",
          ),
        );
      }
    } finally {
      if (alive.current) setDownloading(false);
    }
  };
  const removeVersion = async (version = null) => {
    if (!detail?.can_delete || deleting) return;
    const targetLabel = version ? `version ${version.id}` : "this document";
    const confirmed = globalThis.confirm(
      `Delete ${targetLabel}? This keeps newer and older revisions that still exist.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const response = await salesService.deleteOpportunityWorkspaceFile(
        recordId,
        folder.key,
        version?.file_id || file.id,
      );
      if (!response?.deleted_id || !response.current?.id)
        throw new Error("The delete result could not be verified.");
      if (!alive.current) return;
      onVersionSaved({
        _deleted: true,
        id: response.deleted_id,
        document_id: response.document_id,
        current: response.current,
      });
    } catch (failure) {
      if (alive.current)
        setDeleteError(
          workspaceError(failure, "The selected version could not be deleted."),
        );
    } finally {
      if (alive.current) setDeleting(false);
    }
  };
  const modified = documentDate(detail?.modified_at);
  const type = documentType(detail || file);
  return (
    <aside
      className="sod-details"
      aria-label="Document details"
      aria-busy={loading}
    >
      <header>
        <h3>Document details</h3>
        <button
          type="button"
          className="sow-icon"
          onClick={onClose}
          aria-label="Close document details"
        >
          <X />
        </button>
      </header>
      <div className="sod-document-name">
        <FileIcon file={file} />
        <div>
          <strong>{file.name}</strong>
          <span>
            {type.label} · {fileSize(detail?.size ?? file.size)}
          </span>
        </div>
      </div>
      {loading && (
        <p className="sow-muted" role="status">
          Loading document details…
        </p>
      )}
      {error && (
        <div className="sow-message sow-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              loadDetail();
              loadVersions();
            }}
          >
            Retry details
          </button>
        </div>
      )}
      {detail && (
        <>
          <div className="sod-detail-body">
            <div
              className="sod-detail-tabs"
              role="tablist"
              aria-label="Document information"
            >
              {["Details", "Versions"].map((name) => (
                <button
                  type="button"
                  key={name}
                  role="tab"
                  aria-selected={tab === name}
                  tabIndex={tab === name ? 0 : -1}
                  onClick={() => setTab(name)}
                  onKeyDown={(event) => {
                    if (
                      ["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                        event.key,
                      )
                    ) {
                      event.preventDefault();
                      const next =
                        event.key === "Home"
                          ? "Details"
                          : event.key === "End"
                            ? "Versions"
                            : tab === "Details"
                              ? "Versions"
                              : "Details";
                      setTab(next);
                      event.currentTarget.parentElement.children[
                        next === "Details" ? 0 : 1
                      ].focus();
                    }
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
            <div role="tabpanel" aria-label={tab}>
              {tab === "Details" && (
                <dl className="sod-facts">
                  <div>
                    <dt>
                      {detail.storage_provider === "radai"
                        ? "Storage"
                        : "SharePoint status"}
                    </dt>
                    <dd>
                      {detail.storage_provider === "radai"
                        ? "RADAI attachment"
                        : publicationLabel(detail.publication_level)}
                    </dd>
                  </div>
                  <div>
                    <dt>Version</dt>
                    <dd>{detail.version || "Not available"}</dd>
                  </div>
                  <div>
                    <dt>Folder</dt>
                    <dd>{folder.name}</dd>
                  </div>
                  <div>
                    <dt>Created by</dt>
                    <dd>{detail.created_by || "Not available"}</dd>
                  </div>
                  <div>
                    <dt>Modified</dt>
                    <dd title="Time shown in Asia/Dubai">
                      {modified.date}
                      {modified.time && `, ${modified.time}`}
                    </dd>
                  </div>
                  <div>
                    <dt>Modified by</dt>
                    <dd>{detail.modified_by || "Not available"}</dd>
                  </div>
                </dl>
              )}
              <section className="sod-versions" aria-label="Version history">
                <h4>Version history</h4>
                {versionsError && (
                  <div className="sow-message sow-error" role="alert">
                    <span>{versionsError}</span>
                    <button type="button" onClick={() => loadVersions()}>
                      Retry versions
                    </button>
                  </div>
                )}
                <ol>
                  {versions.versions
                    .slice(0, tab === "Details" ? 3 : undefined)
                    .map((version) => {
                      const date = documentDate(version.modified_at);
                      return (
                        <li key={version.id}>
                          <strong>
                            Version {version.id}
                            {version.is_current === true && (
                              <span> · Current</span>
                            )}
                          </strong>
                          <span>
                            {date.date}
                            {date.time && `, ${date.time}`}
                          </span>
                          {tab === "Versions" && (
                            <>
                              <span>
                                {version.modified_by ||
                                  "Modified by unavailable"}{" "}
                                · {fileSize(version.size)}
                              </span>
                              {version.name && <span>{version.name}</span>}
                              {version.revision_note && (
                                <p className="sdc-revision-note">
                                  {version.revision_note}
                                </p>
                              )}
                            </>
                          )}
                          {version.file_id &&
                            (detail.can_download || detail.can_delete) && (
                              <div className="sdc-version-actions">
                                <button
                                  type="button"
                                  className="sod-text-button"
                                  aria-label={`Preview version ${version.id}`}
                                  onClick={() => onPreview(version)}
                                >
                                  Preview
                                </button>
                                <button
                                  type="button"
                                  className="sod-text-button"
                                  aria-label={`Download version ${version.id}`}
                                  disabled={downloading || !detail.can_download}
                                  onClick={() => download(version)}
                                >
                                  Download
                                </button>
                                {detail.can_delete && (
                                  <button
                                    type="button"
                                    className="sod-text-button"
                                    aria-label={`Delete version ${version.id}`}
                                    disabled={deleting}
                                    onClick={() => removeVersion(version)}
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            )}
                        </li>
                      );
                    })}
                </ol>
                {versionsLoading && (
                  <p className="sow-muted" role="status">
                    Loading versions…
                  </p>
                )}
                {!versionsLoading &&
                  !versionsError &&
                  !versions.versions.length && (
                    <p className="sow-muted">
                      {detail.storage_provider === "radai"
                        ? "No version history is available."
                        : "No version history returned by SharePoint."}
                    </p>
                  )}
                {tab === "Details" &&
                  (versions.versions.length > 3 || versions.next_cursor) && (
                    <button
                      type="button"
                      className="sod-text-button"
                      onClick={() => setTab("Versions")}
                    >
                      View all versions
                    </button>
                  )}
                {tab === "Versions" && versions.next_cursor && (
                  <button
                    type="button"
                    className="sod-text-button"
                    disabled={versionsLoading}
                    onClick={() => loadVersions(versions.next_cursor)}
                  >
                    Load more versions
                  </button>
                )}
              </section>
            </div>
          </div>
          <footer>
            {detail.storage_provider === "radai" &&
              typeof detail.can_upload_version === "boolean" && (
                <SalesDocumentVersionUpload
                  recordId={recordId}
                  folderKey={folder.key}
                  file={file}
                  detail={detail}
                  onSaved={onVersionSaved}
                />
              )}
            {detail.storage_provider === "radai" && detail.can_delete && (
              <button
                type="button"
                className="sow-upload"
                onClick={() => removeVersion()}
                disabled={deleting}
              >
                <Trash2 />
                {deleting ? "Deleting…" : "Delete file"}
              </button>
            )}
            <button
              type="button"
              className="sow-upload"
              onClick={() => onPreview()}
              disabled={!detail.can_download}
            >
              <Eye />
              Preview
            </button>
            {sharePointUrl(detail.web_url) && (
              <a
                className="sod-open"
                href={sharePointUrl(detail.web_url)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink />
                Open document
              </a>
            )}
            <button
              type="button"
              className={`sow-upload ${detail.storage_provider === "radai" ? "sod-primary" : ""}`}
              onClick={() => download()}
              disabled={!detail.can_download || downloading}
            >
              <Download />
              {downloading ? "Downloading…" : "Download"}
            </button>
            {!detail.can_download && (
              <p className="sow-muted">
                {detail.storage_provider === "radai"
                  ? "Download is unavailable with your RADAI access or the file size."
                  : "Download is unavailable with your access or the file size. Use SharePoint if permitted."}
              </p>
            )}
            {downloadError && (
              <p className="sow-message sow-error" role="alert">
                {downloadError}
              </p>
            )}
            {deleteError && (
              <p className="sow-message sow-error" role="alert">
                {deleteError}
              </p>
            )}
          </footer>
        </>
      )}
    </aside>
  );
}
DocumentDetails.propTypes = {
  recordId: PropTypes.string.isRequired,
  folder: PropTypes.object.isRequired,
  file: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onPreview: PropTypes.func.isRequired,
  onVersionSaved: PropTypes.func.isRequired,
};

export default function SalesOpportunityDocuments({
  record,
  workspace,
  storage = "sharepoint",
  folders,
  folderKey,
  selected,
  listing,
  loading,
  error,
  ready,
  query,
  notice,
  onQuery,
  onFolder,
  onUpload,
  onRefresh,
  onLoadMore,
  onRetry,
  onDocumentUpdated,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [previewTarget, setPreviewTarget] = useState(null);
  const [sort, setSort] = useState({ key: "modified_at", direction: "desc" });
  const [kind, setKind] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const folderDialog = useRef(null);
  const visible = (ready ? listing.files : [])
    .filter(
      (file) =>
        `${file.name || ""} ${file.document_name || ""} ${file.classification?.custom_tag || ""}`
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()) &&
        (kind === "all" ||
          (kind === "folder" ? file.is_folder : !file.is_folder)),
    )
    .sort((a, b) => {
      const key = sort.key;
      const comparison =
        key === "size"
          ? (a.size ?? -1) - (b.size ?? -1)
          : String(
              key === "custom_tag"
                ? a.classification?.custom_tag || ""
                : a[key] || "",
            ).localeCompare(
              String(
                key === "custom_tag"
                  ? b.classification?.custom_tag || ""
                  : b[key] || "",
              ),
              undefined,
              { numeric: true },
            );
      return sort.direction === "asc" ? comparison : -comparison;
    });
  const selectedFile =
    ready && visible.find((file) => file.id === selectedId && !file.is_folder);
  useDocumentClassificationPolling({
    recordId: record.id,
    folderKey,
    storage,
    files: visible,
    onUpdated: onDocumentUpdated,
  });
  const previewFile =
    previewTarget &&
    previewTarget.recordId === record.id &&
    previewTarget.folderKey === folderKey &&
    previewTarget.storage === storage
      ? previewTarget.file
      : null;
  const openPreview = (file, row) => {
    if (!ready || file.is_folder) return;
    row?.querySelector(".sod-file-cell button")?.focus();
    setSelectedId(file.id);
    setPreviewTarget({
      file,
      selectedId: file.id,
      recordId: record.id,
      folderKey,
      storage,
    });
  };
  const previewVersion = (version) => {
    if (!selectedFile || !version?.file_id || !version.name) return;
    setPreviewTarget({
      file: { ...version, id: version.file_id },
      selectedId: selectedFile.id,
      recordId: record.id,
      folderKey,
      storage,
    });
  };
  const versionSaved = (result) => {
    onDocumentUpdated(result);
    if (result?._deleted) setSelectedId(result.current?.id || null);
    else setSelectedId(result.id);
    setPreviewTarget(null);
  };
  const changeSort = (key) =>
    setSort((previous) => ({
      key,
      direction:
        previous.key === key && previous.direction === "asc" ? "desc" : "asc",
    }));
  return (
    <div className={`sod-explorer ${selectedFile ? "sod-has-selection" : ""}`}>
      <nav className="sod-folders" aria-label="Opportunity folders">
        <h3>Folders</h3>
        <div className="sod-folder-root">
          <ChevronDown />
          <Folder />
          <strong>{record.deal_code}</strong>
        </div>
        {folders.map((folder) => (
          <button
            type="button"
            key={folder.key}
            className={folderKey === folder.key ? "sod-folder-selected" : ""}
            aria-current={folderKey === folder.key ? "page" : undefined}
            aria-label={`Open ${folder.name}`}
            onClick={() => {
              setPreviewTarget(null);
              setSelectedId(null);
              setKind("all");
              onFolder(folder.key);
            }}
          >
            <Folder />
            <span>{folder.name}</span>
            <span className="sod-folder-count">
              {ready && folder.item_count != null ? folder.item_count : "—"}
            </span>
          </button>
        ))}
      </nav>
      <section
        className="sod-documents"
        aria-label={
          selected ? `${selected.name} documents` : "Workspace documents"
        }
        aria-busy={loading}
      >
        <header>
          <div>
            <h3>{selected?.name || "Documents"}</h3>
            <span>
              {ready && selected?.item_count != null
                ? `${selected.item_count} ${selected.item_count === 1 ? "item" : "items"}`
                : "Items —"}
            </span>
          </div>
          <div className="sod-document-actions">
            <button
              type="button"
              className="sow-upload"
              onClick={() => folderDialog.current?.showModal()}
            >
              <FolderPlus />
              New folder
            </button>
            <button
              type="button"
              className="sow-upload sod-primary"
              onClick={onUpload}
            >
              <Upload />
              Upload files
            </button>
          </div>
        </header>
        <div className="sod-tools">
          <label className="sow-search">
            <Search />
            <input
              aria-label="Search files by name or custom tag"
              placeholder="Search by file name or custom tag"
              value={query}
              onChange={(event) => onQuery(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="sow-icon sod-filter-button"
            aria-label="Filter files"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((value) => !value)}
          >
            <Filter />
          </button>
          <button
            type="button"
            className="sow-icon sod-refresh"
            aria-label="Refresh workspace"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw />
          </button>
          {ready && selected?.web_url && (
            <a
              href={selected.web_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink />
              Open SharePoint
            </a>
          )}
        </div>
        {filtersOpen && (
          <label className="sod-file-filter">
            Show
            <select
              aria-label="File type filter"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="all">All items</option>
              <option value="file">Documents</option>
              <option value="folder">Folders</option>
            </select>
          </label>
        )}
        {error && (
          <div className="sow-message sow-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={onRetry}>
              Retry files
            </button>
          </div>
        )}
        <div className="sod-table-scroll">
          <table data-table-typography="preserve" aria-label="Uploaded files">
            <thead>
              <tr>
                {[
                  ["name", "Name"],
                  ["custom_tag", "Custom Tag"],
                  ["version", "Version"],
                  ["publication_level", "Status"],
                  ["modified_at", "Modified"],
                  ["size", "Size"],
                ].map(([key, label]) => (
                  <th
                    key={key}
                    title={
                      key === "publication_level"
                        ? storage === "radai"
                          ? "File is attached in RADAI; not document review or approval"
                          : "SharePoint publication status; not document review or approval"
                        : undefined
                    }
                    className={`sod-column-${key}`}
                    aria-sort={
                      sort.key === key
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    <button type="button" onClick={() => changeSort(key)}>
                      {label}
                      {sort.key === key &&
                        (sort.direction === "asc" ? (
                          <ArrowUp />
                        ) : (
                          <ArrowDown />
                        ))}
                    </button>
                  </th>
                ))}
                <th className="sod-column-actions">
                  <span className="sod-sr-only">Document actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((file) => {
                const date = documentDate(file.modified_at);
                return (
                  <tr
                    key={file.id}
                    aria-selected={file.id === selectedId}
                    className={
                      file.id === selectedId ? "sod-selected-file" : ""
                    }
                    onClick={() => !file.is_folder && setSelectedId(file.id)}
                    onDoubleClick={(event) =>
                      openPreview(file, event.currentTarget)
                    }
                  >
                    <td>
                      <div className="sod-file-cell">
                        <FileIcon file={file} />
                        {file.is_folder ? (
                          sharePointUrl(file.web_url) ? (
                            <a
                              href={sharePointUrl(file.web_url)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {file.name}
                              <ExternalLink />
                            </a>
                          ) : (
                            <span>{file.name}</span>
                          )
                        ) : (
                          <button
                            type="button"
                            title="Double-click to preview"
                            onClick={() => setSelectedId(file.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                openPreview(file);
                              }
                            }}
                          >
                            {file.name}
                          </button>
                        )}
                      </div>
                    </td>
                    <td
                      onClick={(event) => event.stopPropagation()}
                      onDoubleClick={(event) => event.stopPropagation()}
                    >
                      <SalesDocumentTag
                        recordId={record.id}
                        folderKey={folderKey}
                        file={file}
                        onSaved={onDocumentUpdated}
                      />
                    </td>
                    <td>{file.version || "—"}</td>
                    <td>
                      {file.storage_provider === "radai" ? (
                        <span className="sod-publication">Attached</span>
                      ) : file.publication_level ? (
                        <span
                          className={`sod-publication sod-publication-${file.publication_level === "published" ? "published" : "checkout"}`}
                        >
                          {publicationLabel(file.publication_level)}
                        </span>
                      ) : (
                        <span title="SharePoint publication status is unavailable">
                          —
                        </span>
                      )}
                    </td>
                    <td>
                      <time>{date.date}</time>
                      <span className="sod-time">{date.time}</span>
                    </td>
                    <td>{file.is_folder ? "Folder" : fileSize(file.size)}</td>
                    <td>
                      {!file.is_folder && (
                        <button
                          type="button"
                          className="sow-icon"
                          aria-label={`Details for ${file.name}`}
                          onDoubleClick={(event) => event.stopPropagation()}
                          onClick={() => setSelectedId(file.id)}
                        >
                          <MoreHorizontal />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {notice && <div className="sod-connection-notice">{notice}</div>}
        {ready && (
          <>
            {loading && (
              <p className="sow-muted sod-table-message" role="status">
                Loading files…
              </p>
            )}
            {!loading && !error && !visible.length && (
              <p className="sow-empty">
                {query || kind !== "all"
                  ? "No loaded files match this search."
                  : "No files in this folder yet."}
              </p>
            )}
            {listing.next_cursor && (
              <button
                type="button"
                className="sor-button sod-load-more"
                disabled={loading}
                onClick={onLoadMore}
              >
                Load more files
              </button>
            )}
          </>
        )}
        {!ready && !loading && (
          <div className="sod-empty-state">
            <Folder />
            <h4>{selected?.name || "Workspace"} files</h4>
            <p>Files are available after workspace setup is complete.</p>
            <p>You can browse the folders and choose a file to upload.</p>
          </div>
        )}
        <footer>
          <strong>
            {ready
              ? `${visible.length} loaded ${visible.length === 1 ? "item" : "items"}`
              : "Files unavailable"}
          </strong>
          <span>
            {listing.next_cursor || query || kind !== "all"
              ? "Search, filters and sorting apply to loaded items."
              : selected
                ? `Files uploaded here are saved to ${selected.name}.`
                : "Select a folder to browse its files."}
          </span>
        </footer>
      </section>
      {selectedFile ? (
        <DocumentDetails
          key={`${record.id}-${folderKey}-${selectedFile.id}`}
          recordId={record.id}
          folder={selected}
          file={selectedFile}
          onClose={() => setSelectedId(null)}
          onPreview={(version) =>
            version ? previewVersion(version) : openPreview(selectedFile)
          }
          onVersionSaved={versionSaved}
        />
      ) : (
        <aside
          className="sod-details sod-details-empty"
          aria-label="Document details"
        >
          <header>
            <h3>Document details</h3>
            <Info aria-hidden="true" />
          </header>
          <div className="sod-details-placeholder">
            <FileText aria-hidden="true" />
            <h4>Select a document</h4>
            <p>
              Choose a file to see its details, version history and download
              options.
            </p>
          </div>
        </aside>
      )}
      {previewFile && (
        <SalesOpportunityFilePreview
          key={`${record.id}:${storage}:${folderKey}:${previewFile.id}`}
          recordId={record.id}
          folderKey={folderKey}
          storage={storage}
          file={previewFile}
          onClose={() => setPreviewTarget(null)}
        />
      )}
      <dialog
        ref={folderDialog}
        className="sow-upload-dialog sod-folder-dialog"
        aria-label="New folder"
      >
        <header>
          <h3>New folder</h3>
          <button
            type="button"
            className="sow-icon"
            aria-label="Close new folder"
            onClick={() => folderDialog.current?.close()}
          >
            <X />
          </button>
        </header>
        <p>
          {storage === "radai" ? (
            "RADAI attachments use the six standard folders. Choose SharePoint files to manage additional subfolders there."
          ) : (
            <>
              Create subfolders inside {selected?.name || "this workspace"}{" "}
              using SharePoint.
            </>
          )}
        </p>
        {storage === "sharepoint" &&
        ready &&
        (selected?.web_url || workspace?.web_url) ? (
          <a
            className="sod-open"
            href={selected?.web_url || workspace.web_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink />
            Continue in SharePoint
          </a>
        ) : storage === "sharepoint" ? (
          <p className="sow-message">
            The SharePoint connection needs administrator setup before a folder
            can be created.
          </p>
        ) : null}
      </dialog>
    </div>
  );
}
SalesOpportunityDocuments.propTypes = {
  record: PropTypes.object.isRequired,
  workspace: PropTypes.object,
  storage: PropTypes.oneOf(["radai", "sharepoint"]),
  folders: PropTypes.array.isRequired,
  folderKey: PropTypes.string,
  selected: PropTypes.object,
  listing: PropTypes.object.isRequired,
  loading: PropTypes.bool,
  error: PropTypes.string,
  ready: PropTypes.bool,
  query: PropTypes.string.isRequired,
  notice: PropTypes.node,
  onQuery: PropTypes.func.isRequired,
  onFolder: PropTypes.func.isRequired,
  onUpload: PropTypes.func.isRequired,
  onRefresh: PropTypes.func.isRequired,
  onLoadMore: PropTypes.func.isRequired,
  onRetry: PropTypes.func.isRequired,
  onDocumentUpdated: PropTypes.func.isRequired,
};
