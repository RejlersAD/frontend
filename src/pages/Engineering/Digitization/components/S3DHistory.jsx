import { useEffect, useState } from "react";
import specAPI from "../../../../services/specCustomizationAPI";

const errorMessage = (error) =>
  error?.response?.data?.error ||
  error?.response?.data?.detail ||
  error?.message ||
  "Unable to load history.";

export default function S3DHistory({ onBack, onOpenJob }) {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [history, setHistory] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    specAPI
      .listProjects()
      .then((data) => {
        if (!active) return;
        const folders = (data.items || []).filter(
          (item) => item.metadata?.creation_source === "s3d_document_upload",
        );
        setProjects(folders);
        setProjectId((current) =>
          folders.some((item) => item.project_id === current)
            ? current
            : folders[0]?.project_id || "",
        );
        setError("");
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);

  useEffect(() => {
    if (!projectId) {
      setHistory(null);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setHistory(null);
    specAPI
      .listProjectJobs(projectId, { page })
      .then((data) => {
        if (active) {
          setHistory(data);
          setError("");
        }
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId, page, retry]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-6 text-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">History Logs</h1>
          <p className="text-sm text-slate-600">
            Project folders and extraction runs. Only explicitly saved results
            are marked as saved.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-blue-600 bg-white px-4 py-2 text-sm font-semibold text-blue-600"
        >
          Upload document
        </button>
      </div>
      {error && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          {error}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      )}
      {loading && (
        <p role="status" className="mt-4 text-sm">
          Loading history…
        </p>
      )}
      {!loading && !error && !projects.length && (
        <p className="mt-6 rounded-lg bg-white p-5 text-sm">
          No project folders yet. Upload a document to start an extraction.
        </p>
      )}
      {projects.length > 0 && (
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(220px,1fr)_minmax(0,3fr)]">
          <nav aria-label="Project folders" className="space-y-2">
            {projects.map((project) => (
              <button
                key={project.project_id}
                type="button"
                onClick={() => {
                  setProjectId(project.project_id);
                  setPage(1);
                }}
                aria-current={
                  projectId === project.project_id ? "true" : undefined
                }
                className={`block w-full rounded-lg border px-4 py-3 text-left text-sm ${projectId === project.project_id ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white"}`}
              >
                <span className="block truncate font-semibold">
                  {project.name}
                </span>
                <span className="block truncate text-xs text-slate-600">
                  {project.metadata?.original_filename || "Source document"}
                </span>
              </button>
            ))}
          </nav>
          <section
            aria-label="Extraction history"
            className="min-w-0 rounded-lg border border-slate-200 bg-white p-5"
          >
            <h2 className="text-lg font-semibold">Extraction runs</h2>
            {!loading && !error && history?.jobs?.length === 0 && (
              <p className="mt-3 text-sm">No extraction runs in this folder.</p>
            )}
            <ol className="mt-3 space-y-3">
              {(history?.jobs || []).map((run) => (
                <li
                  key={run.id}
                  className="rounded-lg border border-slate-200 p-3 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{run.document_name}</p>
                      <p className="text-xs text-slate-600">
                        {new Date(run.created_at).toLocaleString()} ·{" "}
                        {run.status} · {run.classes_count} classes ·{" "}
                        {run.components_count} components
                      </p>
                      <p className="text-xs text-slate-600">
                        {run.saved_at
                          ? `Saved ${new Date(run.saved_at).toLocaleString()}${run.saved_by_name ? ` by ${run.saved_by_name}` : ""}${run.id === history.current_saved_job_id ? " · Current saved result" : ""}`
                          : "Not saved"}
                      </p>
                    </div>
                    {run.status === "completed" && (
                      <button
                        type="button"
                        className="rounded-md border border-blue-600 px-3 py-1 text-xs font-semibold text-blue-600"
                        onClick={() => onOpenJob(run.id)}
                      >
                        Open preview
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            {history?.pagination?.total > history?.pagination?.page_size && (
              <div className="mt-4 flex gap-3 text-sm">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </button>
                <span>Page {page}</span>
                <button
                  type="button"
                  disabled={
                    page * history.pagination.page_size >=
                    history.pagination.total
                  }
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
