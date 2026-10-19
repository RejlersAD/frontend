import {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import PropTypes from "prop-types";
import {
  AlertCircle,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  Paperclip,
  Printer,
  RefreshCw,
} from "lucide-react";
import "./SalesLetterPreview.css";
import { letterExtractionStatus } from "./salesLetterExtraction";

export default function SalesLetterPreview({
  letter,
  pdfUrl,
  onDownload,
  onDownloadDocx,
  onPrint,
  onFullscreenToggle,
  onRegenerate,
  onEdit,
  fullscreen = false,
  loading = false,
  regenerating = false,
  error = null,
  previewKey = 0,
}) {
  const iframeRef = useRef(null);

  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const [verifiedPreview, setVerifiedPreview] = useState(null);
  const currentPreview = `${previewKey}-${pdfUrl}`;

  const handleLoad = useCallback(() => {
    setPdfLoaded(true);
    setPdfError(null);
  }, []);

  const handleError = useCallback(() => {
    setPdfLoaded(true);
    setPdfError("Failed to load PDF preview");
  }, []);

  useEffect(() => {
    setPdfLoaded(false);
    setPdfError(null);
    setVerifiedPreview(null);

    if (!pdfUrl) return;

    let cancelled = false;
    let timedOut = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 10000);

    const validatePdf = async () => {
      try {
        const response = await fetch(pdfUrl, {
          method: "HEAD",
          signal: controller.signal,
        });

        if (response.status !== 200) {
          throw new Error(`Preview returned HTTP ${response.status}.`);
        }

        const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
        if (contentType !== "application/pdf") {
          throw new Error(`Preview returned ${contentType || "no Content-Type"} instead of application/pdf.`);
        }

        if (!cancelled) {
          setVerifiedPreview(currentPreview);
        }
      } catch (err) {
        if (!cancelled) {
          setPdfError(timedOut
            ? "PDF preview timed out. You can still download the document."
            : `Unable to load PDF preview: ${err.message}`);
        }
      } finally {
        clearTimeout(timeout);
      }
    };

    validatePdf();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [pdfUrl, currentPreview]);

  const handleDownload = () => {
    onDownload?.();
  };

  const handlePrint = () => {
    onPrint?.();

    const iframe = iframeRef.current;

    if (iframe?.contentWindow) {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.warn("Print blocked by browser:", err);
      }
    }
  };

  const handleFullscreen = () => {
    onFullscreenToggle?.(!fullscreen);
  };

  const readyFiles =
    letter?.attachments?.files?.filter(
      (f) => f.status === "ready",
    ) || [];

  const failedFiles =
    letter?.attachments?.files?.filter(
      (f) => f.status !== "ready",
    ) || [];

  if (loading && !pdfUrl) {
    return (
      <div className="sl-preview-loading">
        <Loader2 className="sl-spin" size={48} />
        <p>Generating PDF preview...</p>
      </div>
    );
  }

  return (
    <div
      className={`sl-preview-container ${
        fullscreen ? "sl-fullscreen" : ""
      }`}
    >
      <div className="sl-preview-header">
        <div className="sl-preview-title">
          <h3>
            {letter?.letter_type_display ||
              "Letter Preview"}
          </h3>

          <span className="sl-preview-badge">
            {letter?.opportunity_code ||
              letter?.deal_code}
          </span>

          {readyFiles.length > 0 && (
            <span
              className="sl-preview-attached"
              title={readyFiles
                .map((f) => f.name)
                .join(", ")}
            >
              <Paperclip size={13} />
              {" "}Attached to Correspondence
              {letter?.attachments?.version
                ? ` (v${letter.attachments.version})`
                : ""}
            </span>
          )}

          {failedFiles.length > 0 && (
            <span
              className="sl-preview-attach-failed"
              title={failedFiles
                .map(
                  (f) =>
                    `${f.name}: ${
                      f.error || "upload failed"
                    }`
                )
                .join("\n")}
            >
              <AlertCircle size={13} />
              {" "}Attach failed:{" "}
              {failedFiles[0].error ||
                "upload failed"}
            </span>
          )}
        </div>

        <div className="sl-preview-actions">
          {regenerating && (
            <button
              className="sl-btn sl-btn--ghost"
              disabled
            >
              <Loader2
                size={16}
                className="sl-spin"
              />
              {" "}Regenerating...
            </button>
          )}

          {(error || pdfError) && (
            <button
              type="button"
              className="sl-btn sl-btn--ghost sl-btn--error"
              onClick={onRegenerate}
              disabled={regenerating}
            >
              <RefreshCw size={16} />
              {" "}Retry
            </button>
          )}

          <button
            type="button"
            className="sl-btn sl-btn--ghost"
            onClick={handleDownload}
            disabled={!pdfUrl}
            title="Download PDF"
          >
            <Download size={16} />
          </button>

          <button
            type="button"
            className="sl-btn sl-btn--ghost"
            onClick={() => onDownloadDocx?.()}
            title="Download DOCX"
          >
            <FileText size={16} />
          </button>

          <button
            type="button"
            className="sl-btn sl-btn--ghost"
            onClick={handlePrint}
            disabled={!pdfLoaded}
            title="Print"
          >
            <Printer size={16} />
          </button>

          <button
            type="button"
            className="sl-btn sl-btn--ghost"
            onClick={handleFullscreen}
          >
            {fullscreen ? (
              <Minimize2 size={16} />
            ) : (
              <Maximize2 size={16} />
            )}
          </button>

          <button
            type="button"
            className="sl-btn sl-btn--primary"
            onClick={onEdit}
            disabled={regenerating}
          >
            <ExternalLink size={16} />
            {" "}Edit
          </button>
        </div>
      </div>

      <p className="sl-preview-source" role="status">{letterExtractionStatus(letter)}</p>
      <div className="sl-preview-content">
        {(error || pdfError) && (
          <div className="sl-preview-error">
            <AlertCircle size={48} />
            <p>{error || pdfError}</p>

            <button
              className="sl-btn sl-btn--primary"
              onClick={onRegenerate}
            >
              <RefreshCw size={16} />
              {" "}Regenerate PDF
            </button>
          </div>
        )}

        {!error && !pdfError && pdfUrl && verifiedPreview === currentPreview && (
          <iframe
            key={previewKey}
            ref={iframeRef}
            src={`${pdfUrl}#toolbar=0`}
            referrerPolicy="no-referrer"
            title="Letter PDF preview"
            className="sl-preview-iframe"
            onLoad={handleLoad}
            onError={handleError}
          />
        )}

        {!error && !pdfError && !pdfUrl && (
          <div className="sl-preview-empty">
            <FileText size={48} />

            <p>No PDF available</p>

            <button
              className="sl-btn sl-btn--primary"
              onClick={onRegenerate}
            >
              <RefreshCw size={16} />
              {" "}Generate PDF
            </button>
          </div>
        )}

        {(!pdfLoaded || verifiedPreview !== currentPreview) &&
          pdfUrl &&
          !pdfError &&
          !error && (
            <div className="sl-preview-loading-overlay">
              <Loader2
                className="sl-spin"
                size={32}
              />
              <p>Loading preview...</p>
            </div>
          )}
      </div>
    </div>
  );
}

SalesLetterPreview.propTypes = {
  letter: PropTypes.object.isRequired,
  pdfUrl: PropTypes.string,
  onDownload: PropTypes.func,
  onDownloadDocx: PropTypes.func,
  onPrint: PropTypes.func,
  onFullscreenToggle: PropTypes.func,
  onRegenerate: PropTypes.func,
  onEdit: PropTypes.func,
  fullscreen: PropTypes.bool,
  loading: PropTypes.bool,
  regenerating: PropTypes.bool,
  error: PropTypes.string,
  previewKey: PropTypes.number,
};

SalesLetterPreview.defaultProps = {
  pdfUrl: null,
  onDownload: null,
  onDownloadDocx: null,
  onPrint: null,
  onFullscreenToggle: null,
  onRegenerate: null,
  onEdit: null,
  fullscreen: false,
  loading: false,
  regenerating: false,
  error: null,
  previewKey: 0,
};
