import React, { useEffect, useRef, useState, useMemo } from "react";
import PropTypes from "prop-types";
import {
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Folder,
  CheckCircle2,
  List,
  LayoutGrid,
  MoreHorizontal,
  ArrowUpDown,
  AlertCircle,
  X,
  RotateCw,
  Loader2,
  FileText,
  Clock,
  Layers,
  Cpu,
} from "lucide-react";
import specAPI, { SPEC_API_CONFIG } from "../../../../services/specCustomizationAPI";

const getErrorMessage = (error) =>
  error?.response?.data?.error ||
  error?.response?.data?.detail ||
  error?.message ||
  "Unable to load data.";

export default function S3DDatabaseBuilder({
  onExtract,
  onHistory,
  onOpenJob,
  onSelectionChange,
  busy = false,
  progressContent,
  requestError = "",
  uploading = false,
  jobStatus = "",
}) {
  const inputRef = useRef(null);

  // Table Data State fetched from specAPI
  const [projects, setProjects] = useState([]);
  const [jobsByProjectId, setJobsByProjectId] = useState({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [retryTrigger, setRetryTrigger] = useState(0);

  // UI Filters, View Mode & Selection
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'grid'
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = viewMode === "grid" ? 12 : 10;

  // File Upload & Modal Extraction Progress State
  const [activeFile, setActiveFile] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [simulatedPercent, setSimulatedPercent] = useState(0);

  // 1. Fetch real projects created via S3D Document Upload
  useEffect(() => {
    let active = true;
    setLoading(true);
    specAPI
      .listProjects()
      .then(async (data) => {
        if (!active) return;
        const s3dProjects = (data.items || []).filter(
          (item) => item.metadata?.creation_source === "s3d_document_upload"
        );
        setProjects(s3dProjects);

        const jobResults = await Promise.all(
          s3dProjects.map((p) =>
            specAPI
              .listProjectJobs(p.project_id, { page: 1 })
              .then((jobData) => ({ projectId: p.project_id, jobs: jobData.jobs || [] }))
              .catch(() => ({ projectId: p.project_id, jobs: [] }))
          )
        );

        if (!active) return;
        const jobMap = {};
        jobResults.forEach(({ projectId, jobs }) => {
          jobMap[projectId] = jobs;
        });
        setJobsByProjectId(jobMap);
        setFetchError("");
      })
      .catch((err) => {
        if (active) setFetchError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [retryTrigger]);

  // 2. Open progress modal when extraction starts
  useEffect(() => {
    if (busy || uploading) {
      setShowProgressModal(true);
    }
  }, [busy, uploading]);

  // 3. Smooth animated progress bar during extraction
  useEffect(() => {
    let timer;
    if (showProgressModal && (busy || uploading)) {
      setSimulatedPercent((prev) => (prev < 15 ? 15 : prev));
      timer = setInterval(() => {
        setSimulatedPercent((prev) => {
          if (uploading && prev < 45) return prev + 5;
          if (busy && prev < 90) return prev + Math.floor(Math.random() * 5 + 2);
          return prev;
        });
      }, 500);
    } else if (!busy && !uploading && showProgressModal) {
      if (requestError) {
        setSimulatedPercent((prev) => prev);
      } else if (jobStatus === "completed" || jobStatus === "confirmed") {
        setSimulatedPercent(100);
      }
    }
    return () => clearInterval(timer);
  }, [showProgressModal, busy, uploading, requestError, jobStatus]);

  // 4. Transform real projects and jobs into row items
  const documents = useMemo(() => {
    const list = [];
    projects.forEach((proj) => {
      const jobs = jobsByProjectId[proj.project_id] || [];
      if (jobs.length > 0) {
        jobs.forEach((run) => {
          list.push({
            id: run.id,
            jobId: run.id,
            name: run.document_name || proj.name,
            originalFile: proj.metadata?.original_filename || run.document_name,
            rawDate: new Date(run.created_at || proj.created_at || Date.now()),
            extracted: run.created_at
              ? new Date(run.created_at).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "Pending",
            status: run.status === "completed" ? "Ready" : run.status === "failed" ? "Error" : "Processing",
            rawStatus: run.status,
            classes: run.classes_count ?? 0,
            components: Number(run.components_count ?? 0).toLocaleString(),
            projectId: proj.project_id,
          });
        });
      } else {
        list.push({
          id: proj.project_id,
          jobId: null,
          name: proj.name,
          originalFile: proj.metadata?.original_filename || proj.name,
          rawDate: new Date(proj.created_at || Date.now()),
          extracted: proj.created_at
            ? new Date(proj.created_at).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            : "Pending",
          status: "Pending",
          rawStatus: "pending",
          classes: "-",
          components: "-",
          projectId: proj.project_id,
        });
      }
    });
    return list;
  }, [projects, jobsByProjectId]);

  // Handle file select and trigger immediate extraction popup
  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    e.target.value = "";
    if (busy || !selected) return;

    const ext = selected.name.split(".").pop().toLowerCase();
    if (!SPEC_API_CONFIG.acceptedExts.includes(ext)) {
      setUploadError("Choose a supported engineering document (PDF, Excel or Word).");
      return;
    }
    if (selected.size > SPEC_API_CONFIG.maxFileSizeMB * 1024 * 1024) {
      setUploadError(`File exceeds the ${SPEC_API_CONFIG.maxFileSizeMB} MB limit.`);
      return;
    }

    setUploadError("");
    setActiveFile(selected);
    setSimulatedPercent(5);
    setShowProgressModal(true);

    if (onSelectionChange) onSelectionChange();
    if (onExtract) onExtract(selected);
  };

  // Filter and Sort
  const filteredDocs = useMemo(() => {
    return documents
      .filter((doc) => {
        const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus =
          statusFilter === "all" || doc.status.toLowerCase() === statusFilter.toLowerCase();
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sortOrder === "newest") return b.rawDate - a.rawDate;
        if (sortOrder === "oldest") return a.rawDate - b.rawDate;
        return a.name.localeCompare(b.name);
      });
  }, [documents, searchQuery, statusFilter, sortOrder]);

  const totalPages = Math.ceil(filteredDocs.length / pageSize) || 1;
  const paginatedDocs = filteredDocs.slice((page - 1) * pageSize, page * pageSize);

  const handleOpenRow = (doc) => {
    if (doc.jobId && onOpenJob) {
      onOpenJob(doc.jobId);
    } else if (onHistory) {
      onHistory();
    }
  };

  const renderStatusBadge = (status) => {
    if (status === "Ready") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#def7ec] text-[#03543f]">
          <CheckCircle2 size={13} className="text-[#0e9f6e] fill-[#def7ec]" />
          Ready
        </span>
      );
    }
    if (status === "Error") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <AlertCircle size={13} />
          Error
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        <Clock size={13} />
        {status}
      </span>
    );
  };

  return (
    <div className="flex-1 min-h-screen bg-[#f8fafc] text-slate-800 px-6 py-6 font-sans">
      <div className="max-w-[1580px] w-full mx-auto">
        {/* Hidden File Input */}
        <input
          ref={inputRef}
          type="file"
          accept={SPEC_API_CONFIG.acceptedExts.map((ext) => `.${ext}`).join(",")}
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Top Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            S3D Database Builder
          </h1>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1b64f2] hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm rounded-lg shadow-sm transition-colors duration-150 disabled:opacity-50"
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>Upload</span>
          </button>
        </div>

        {/* Global Errors */}
        {(uploadError || fetchError || requestError) && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="text-red-500 shrink-0" />
              <span className="text-sm font-medium">
                {uploadError || fetchError || requestError}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {fetchError && (
                <button
                  type="button"
                  onClick={() => setRetryTrigger((v) => v + 1)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-red-300 text-red-700 text-xs font-semibold rounded hover:bg-red-50"
                >
                  <RotateCw size={14} /> Retry
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setUploadError("");
                  setFetchError("");
                }}
                className="text-red-400 hover:text-red-600"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Action Bar / Filters */}
        <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1 max-w-xl">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Status Dropdown */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter documents by status"
                className="appearance-none bg-white border border-slate-200 rounded-lg px-3.5 py-2 pr-8 text-sm text-slate-700 font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
              >
                <option value="all">All statuses</option>
                <option value="ready">Ready</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="error">Error</option>
              </select>
              <ChevronDown
                size={15}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700">
                <ArrowUpDown size={15} className="mr-2 text-slate-500" />
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  aria-label="Sort documents order"
                  className="appearance-none bg-transparent pr-6 font-normal focus:outline-none cursor-pointer"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="name">Document name</option>
                </select>
                <ChevronDown
                  size={15}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
              </div>
            </div>
          </div>

          {/* View Mode Controls */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setViewMode("list");
                setPage(1);
              }}
              aria-label="List view"
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "list"
                  ? "bg-blue-50 text-blue-600"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <List size={18} />
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode("grid");
                setPage(1);
              }}
              aria-label="Grid view"
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "grid"
                  ? "bg-blue-50 text-blue-600"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <LayoutGrid size={18} />
            </button>
            </div>
        </div>

        {/* Content Section: Table (List) or Cards (Grid) */}
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-xl p-16 text-center text-slate-500 shadow-xs">
            <Loader2 size={26} className="animate-spin inline-block mr-2 text-blue-600" />
            Loading projects and extraction runs…
          </div>
        ) : paginatedDocs.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-16 text-center text-slate-500 shadow-xs">
            No documents found. Click &quot;+ Upload&quot; to add an engineering document.
          </div>
        ) : viewMode === "list" ? (
          /* List / Table View with controlled spacing */
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="border-b border-slate-100 text-[13px] font-semibold text-slate-900 tracking-tight bg-slate-50/50">
                    <th className="py-3.5 pl-6 pr-4 w-[42%]">Document</th>
                    <th className="py-3.5 px-4 w-[16%]">Extracted</th>
                    <th className="py-3.5 px-4 w-[14%]">Status</th>
                    <th className="py-3.5 px-4 text-center w-[10%]">Classes</th>
                    <th className="py-3.5 px-4 text-center w-[10%]">Components</th>
                    <th className="py-3.5 pr-6 pl-4 text-right w-[8%]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {paginatedDocs.map((doc) => {
                    const isSelected = selectedJobId === doc.id;

                    return (
                      <tr
                        key={doc.id}
                        onClick={() => setSelectedJobId(doc.id)}
                        onDoubleClick={() => handleOpenRow(doc)}
                        className={`group transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-[#edf5ff] hover:bg-[#e4efff]"
                            : "hover:bg-slate-50/80"
                        }`}
                      >
                        <td className="py-3 pl-6 pr-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <Folder
                              size={18}
                              className="text-[#3b82f6] fill-[#dbeafe] shrink-0"
                            />
                            <span
                              className="font-normal text-slate-700 tracking-tight truncate"
                              title={doc.name}
                            >
                              {doc.name}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-slate-600 font-normal whitespace-nowrap">
                          {doc.extracted}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {renderStatusBadge(doc.status)}
                        </td>

                        <td className="py-3 px-4 text-center text-slate-600 font-normal">
                          {doc.classes}
                        </td>

                        <td className="py-3 px-4 text-center text-slate-600 font-normal">
                          {doc.components}
                        </td>

                        <td className="py-3 pr-6 pl-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-2">
                            {isSelected ? (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenRow(doc);
                                  }}
                                  className="px-3.5 py-1.5 bg-[#1b64f2] hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
                                >
                                  Open
                                </button>
                                <button
                                  type="button"
                                  aria-label="Row options"
                                  className="text-slate-400 hover:text-slate-600 p-1"
                                >
                                  <MoreHorizontal size={17} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  aria-label="Row options"
                                  className="text-slate-400 hover:text-slate-600 p-1"
                                >
                                  <MoreHorizontal size={17} />
                                </button>
                                <ChevronRight
                                  size={17}
                                  className="text-slate-400 group-hover:text-slate-600 transition-colors"
                                />
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 text-xs text-slate-500 bg-white">
              <span>
                {filteredDocs.length === 0
                  ? "0 of 0"
                  : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, filteredDocs.length)} of ${filteredDocs.length}`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label="Previous page"
                  className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="w-6 h-6 flex items-center justify-center rounded bg-blue-50 text-[#1b64f2] font-semibold text-xs border border-blue-200">
                  {page}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Next page"
                  className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Grid / Card View with Fixed Padding & Proportions */
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {paginatedDocs.map((doc) => {
                const isSelected = selectedJobId === doc.id;

                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedJobId(doc.id)}
                    onDoubleClick={() => handleOpenRow(doc)}
                    className={`bg-white rounded-2xl border p-5 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md ${
                      isSelected
                        ? "border-blue-500 ring-2 ring-blue-500/15 bg-blue-50/20"
                        : "border-slate-200/90 hover:border-slate-300"
                    }`}
                  >
                    <div>
                      {/* Card Top: Folder Icon & Status Badge */}
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                          <Folder size={20} className="fill-blue-100/80 text-blue-600" />
                        </div>
                        {renderStatusBadge(doc.status)}
                      </div>

                      {/* Document Name & Date */}
                      <div className="mb-4">
                        <h3
                          className="font-semibold text-slate-900 text-[14px] leading-snug truncate"
                          title={doc.name}
                        >
                          {doc.name}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">{doc.extracted}</p>
                      </div>

                      {/* Metadata Metrics Box with balanced padding */}
                      <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50/90 rounded-xl text-xs border border-slate-100/90 mb-5">
                        <div className="min-w-0">
                          <span className="text-slate-400 flex items-center gap-1.5 mb-1 text-[11px] font-medium">
                            <Layers size={13} className="shrink-0 text-slate-400" /> Classes
                          </span>
                          <span className="font-semibold text-slate-800 text-[13px] block truncate">
                            {doc.classes}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-slate-400 flex items-center gap-1.5 mb-1 text-[11px] font-medium">
                            <Cpu size={13} className="shrink-0 text-slate-400" /> Components
                          </span>
                          <span className="font-semibold text-slate-800 text-[13px] block truncate">
                            {doc.components}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer with explicit separator and padding */}
                    <div className="flex items-center justify-between pt-3.5 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenRow(doc);
                        }}
                        className="text-xs font-semibold text-[#1b64f2] hover:text-blue-700 inline-flex items-center gap-1.5 transition-colors"
                      >
                        Open workspace <ChevronRight size={14} strokeWidth={2.2} />
                      </button>
                      <button
                        type="button"
                        aria-label="Card options"
                        onClick={(e) => e.stopPropagation()}
                        className="text-slate-400 hover:text-slate-600 p-1.5 -mr-1 rounded-md hover:bg-slate-100 transition-colors"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Grid Pagination Footer */}
            <div className="flex items-center justify-between px-6 py-3.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-500 shadow-2xs">
              <span>
                {filteredDocs.length === 0
                  ? "0 of 0"
                  : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, filteredDocs.length)} of ${filteredDocs.length}`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label="Previous page"
                  className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="w-6 h-6 flex items-center justify-center rounded bg-blue-50 text-[#1b64f2] font-semibold text-xs border border-blue-200">
                  {page}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Next page"
                  className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Progress & Extraction Preview Popup Dialog */}
        {showProgressModal && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          >
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {simulatedPercent === 100
                        ? "Extraction Complete"
                        : requestError
                          ? "Extraction Failed"
                          : "Extracting Database"}
                    </h3>
                    <p className="text-xs text-slate-500 truncate max-w-[280px]">
                      {activeFile?.name || "Processing document"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!busy && !uploading) {
                      setShowProgressModal(false);
                      setRetryTrigger((v) => v + 1);
                    }
                  }}
                  disabled={busy || uploading}
                  className="text-slate-400 hover:text-slate-600 disabled:opacity-30 p-1"
                >
                  <X size={18} />
                </button>
              </div>

              {progressContent ? (
                <div className="my-4">{progressContent}</div>
              ) : (
                <div className="my-6">
                  <div className="flex items-center justify-between text-xs font-semibold mb-2 text-slate-700">
                    <span>
                      {uploading
                        ? "Uploading document…"
                        : busy
                          ? jobStatus === "queued"
                            ? "Waiting in queue…"
                            : "Extracting tables and metadata…"
                          : simulatedPercent === 100
                            ? "Ready to view"
                            : "Idle"}
                    </span>
                    <span className="text-blue-600 font-bold">{simulatedPercent}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        requestError
                          ? "bg-red-500"
                          : simulatedPercent === 100
                            ? "bg-emerald-500"
                            : "bg-blue-600"
                      }`}
                      style={{ width: `${simulatedPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Stage Indicators */}
              <div className="grid grid-cols-3 gap-2 my-5 text-center text-xs">
                <div
                  className={`p-2.5 rounded-lg border ${
                    simulatedPercent >= 30
                      ? "border-blue-200 bg-blue-50/50 text-blue-700 font-medium"
                      : "border-slate-100 text-slate-400"
                  }`}
                >
                  1. Upload
                </div>
                <div
                  className={`p-2.5 rounded-lg border ${
                    simulatedPercent >= 70
                      ? "border-blue-200 bg-blue-50/50 text-blue-700 font-medium"
                      : "border-slate-100 text-slate-400"
                  }`}
                >
                  2. Extract Data
                </div>
                <div
                  className={`p-2.5 rounded-lg border ${
                    simulatedPercent === 100
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 font-medium"
                      : "border-slate-100 text-slate-400"
                  }`}
                >
                  3. SPEC / CAT
                </div>
              </div>

              {/* Error Message */}
              {requestError && (
                <p className="text-xs text-red-600 bg-red-50 p-3 rounded-lg border border-red-200 mb-4">
                  {requestError}
                </p>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                {requestError ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowProgressModal(false)}
                      className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (activeFile && onExtract) {
                          setSimulatedPercent(20);
                          onExtract(activeFile);
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg"
                    >
                      Retry extraction
                    </button>
                  </>
                ) : simulatedPercent === 100 || (!busy && !uploading) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowProgressModal(false);
                      setRetryTrigger((v) => v + 1);
                      if (onHistory) onHistory();
                    }}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                  >
                    View in History
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="px-4 py-2 bg-slate-100 text-slate-400 text-xs font-medium rounded-lg cursor-not-allowed flex items-center gap-2"
                  >
                    <Loader2 size={14} className="animate-spin" /> Processing…
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

S3DDatabaseBuilder.propTypes = {
  onExtract: PropTypes.func.isRequired,
  onHistory: PropTypes.func.isRequired,
  onOpenJob: PropTypes.func,
  onSelectionChange: PropTypes.func.isRequired,
  busy: PropTypes.bool,
  progressContent: PropTypes.node,
  requestError: PropTypes.string,
  uploading: PropTypes.bool,
  jobStatus: PropTypes.string,
};