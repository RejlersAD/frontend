import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import specAPI, {
  SPEC_API_CONFIG,
} from "../../../../services/specCustomizationAPI";
import S3DDatabaseBuilder from "./S3DDatabaseBuilder";
import S3DDataExtractionHub from "./S3DDataExtractionHub";
import S3DHistory from "./S3DHistory";

const root = "/engineering/digitization/smart-plant-3d";
const terminal = new Set(["completed", "failed", "cancelled"]);
const message = (error) =>
  error?.response?.data?.error ||
  error?.response?.data?.detail ||
  error?.message ||
  "Unable to complete this action. Try again.";

export default function S3DExtractionFlow() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const jobId = params.get("job");
  const preview = params.get("screen") === "preview" && jobId;
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const [resuming, setResuming] = useState(Boolean(jobId && !preview));
  const [resumeRetry, setResumeRetry] = useState(0);
  const mounted = useRef(true);
  const submitting = useRef(false);
  const running = job && !terminal.has(job.status);
  const busy = resuming || uploading || Boolean(running);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!jobId || preview || job?.id === jobId) {
      setResuming(false);
      return;
    }
    let active = true;
    setResuming(true);
    setError("");
    specAPI
      .getJob(jobId)
      .then((updated) => {
        if (!active) return;
        setJob(updated);
        if (updated.status === "completed")
          navigate(
            `${root}?screen=preview&job=${encodeURIComponent(updated.id)}`,
            { replace: true },
          );
        else if (terminal.has(updated.status))
          setError(
            updated.error_message ||
              `Extraction ${updated.status}. Select a document to try again.`,
          );
      })
      .catch((error) => {
        if (active) setError(`Could not resume extraction. ${message(error)}`);
      })
      .finally(() => {
        if (active) setResuming(false);
      });
    return () => {
      active = false;
    };
  }, [jobId, preview, job?.id, resumeRetry, navigate]);

  useEffect(() => {
    if (!running || preview) return;
    let active = true;
    let timer;
    const poll = async () => {
      try {
        const updated = await specAPI.getJob(job.id);
        if (!active) return;
        setJob(updated);
        setError("");
        if (updated.status === "completed") {
          navigate(
            `${root}?screen=preview&job=${encodeURIComponent(updated.id)}`,
          );
          return;
        }
        if (terminal.has(updated.status)) {
          setError(
            updated.error_message ||
              `Extraction ${updated.status}. You can try again.`,
          );
          return;
        }
      } catch (error) {
        if (active)
          setError(
            `Could not check extraction status. Retrying… ${message(error)}`,
          );
      }
      if (active) timer = setTimeout(poll, SPEC_API_CONFIG.pollIntervalMs);
    };
    timer = setTimeout(poll, SPEC_API_CONFIG.pollIntervalMs);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [running, job?.id, preview, navigate]);

  const extract = async (file) => {
    if (submitting.current || busy) return;
    submitting.current = true;
    setUploading(true);
    setUploadProgress(0);
    setError("");
    setJob(null);
    navigate(root, { replace: true });
    try {
      const response = await specAPI.upload({
        file,
        autoProject: true,
        onUploadProgress: (event) => {
          if (mounted.current && event.total)
            setUploadProgress(Math.round((event.loaded * 100) / event.total));
        },
      });
      if (!mounted.current) return;
      if (!response.job?.id)
        throw new Error(
          "The upload did not return an extraction job. Please try again.",
        );
      setJob(response.job);
      if (response.job.status === "completed")
        navigate(
          `${root}?screen=preview&job=${encodeURIComponent(response.job.id)}`,
        );
      else if (terminal.has(response.job.status))
        setError(
          response.job.error_message ||
            `Extraction ${response.job.status}. You can try again.`,
        );
      else
        navigate(
          `${root}?screen=upload&job=${encodeURIComponent(response.job.id)}`,
          { replace: true },
        );
    } catch (error) {
      if (mounted.current) setError(message(error));
    } finally {
      submitting.current = false;
      if (mounted.current) {
        setUploading(false);
      }
    }
  };

  if (params.get("screen") === "history")
    return (
      <S3DHistory
        onBack={() => navigate(root)}
        onOpenJob={(selectedJobId) => navigate(
          `${root}?screen=preview&job=${encodeURIComponent(selectedJobId)}`,
        )}
      />
    );

  if (preview)
    return (
      <S3DDataExtractionHub
        jobId={jobId}
        onHistory={() => navigate(`${root}?screen=history`)}
        onUploadAnother={() => {
          setJob(null);
          setError("");
          navigate(root);
        }}
      />
    );

  return (
    <S3DDatabaseBuilder
      onExtract={extract}
      onHistory={() => navigate(`${root}?screen=history`)}
      busy={busy}
      requestError={error}
      uploading={uploading}
      jobStatus={job?.status || ''}
      onSelectionChange={() => { setError(''); setJob(null); navigate(root, { replace: true }); }}
      progressContent={
        <>
          {error && busy && (
            <p className="s3db-error" role="alert">
              {error}
            </p>
          )}
          {jobId && !job && !resuming && error && (
            <button
              className="s3db-back"
              onClick={() => setResumeRetry((value) => value + 1)}
            >
              Retry recovery
            </button>
          )}
          {resuming && <p role="status">Resuming extraction…</p>}
          {(uploading || job) && (
            <div className="s3db-progress" role="status">
              <p>
                {uploading
                    ? `Uploading document… ${uploadProgress}%`
                    : running
                      ? job.current_phase || "Extracting database…"
                      : `Extraction ${job.status}`}
              </p>
              {busy && (
                <progress
                  max="100"
                  value={uploading ? uploadProgress : job.progress_percent || 0}
                  aria-label="Extraction progress"
                />
              )}
              {running && (
                <button
                  onClick={async () => {
                    try {
                      await specAPI.cancelJob(job.id);
                      const updated = await specAPI.getJob(job.id);
                      if (mounted.current) setJob(updated);
                    } catch (error) {
                      if (mounted.current) setError(message(error));
                    }
                  }}
                >
                  Cancel extraction
                </button>
              )}
            </div>
          )}
        </>
      }
    />
  );
}

