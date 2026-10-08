import { useEffect, useRef, useState } from "react";
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
}) {
  const iframeRef = useRef(null);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  useEffect(() => {
    setPdfLoaded(false);
    setPdfError(null);
    
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      setPdfLoaded(true);
      setPdfError(null);
    };

    const handleError = () => {
      setPdfError("Failed to load PDF preview");
      setPdfLoaded(true);
    };

    iframe.onload = handleLoad;
    iframe.onerror = handleError;

    // Also check if the iframe content is accessible
    const checkLoad = setTimeout(() => {
      try {
        if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
          setPdfLoaded(true);
        }
      } catch (e) {
        // Cross-origin, can't check
      }
    }, 2000);

    return () => {
      clearTimeout(checkLoad);
      iframe.onload = null;
      iframe.onerror = null;
    };
  }, [pdfUrl]);

  const handleDownload = () => {
    onDownload?.();
  };

  const handlePrint = () => {
    onPrint?.();
    // Also try to print via iframe
    const iframe = iframeRef.current;
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        // Cross-origin restriction
      }
    }
  };

  const handleFullscreen = () => {
    onFullscreenToggle?.(!fullscreen);
  };

  const readyFiles = letter?.attachments?.files?.filter((f) => f.status === "ready") || [];
  const failedFiles = letter?.attachments?.files?.filter((f) => f.status !== "ready") || [];

  if (loading && !pdfUrl) {
    return (
      <div className="sl-preview-loading">
        <Loader2 className="sl-spin" size={48} />
        <p>Generating PDF preview...</p>
      </div>
    );
  }

  return (
    <div className={`sl-preview-container ${fullscreen ? 'sl-fullscreen' : ''}`}>
      <div className="sl-preview-header">
        <div className="sl-preview-title">
          <h3>{letter?.letter_type_display || "Letter Preview"}</h3>
          <span className="sl-preview-badge">{letter?.opportunity_code || letter?.deal_code}</span>
          {readyFiles.length > 0 && (
            <span
              className="sl-preview-attached"
              title={readyFiles.map((f) => f.name).join(", ")}
            >
              <Paperclip size={13} /> Attached to Correspondence
              {letter.attachments.version ? ` (v${letter.attachments.version})` : ""}
            </span>
          )}
          {failedFiles.length > 0 && (
            <span
              className="sl-preview-attach-failed"
              title={failedFiles
                .map((f) => `${f.name}: ${f.error || "upload failed"}`)
                .join("\n")}
            >
              <AlertCircle size={13} /> Attach failed:{" "}
              {failedFiles[0].error || "upload failed"}
              {failedFiles.length > 1 ? ` (+${failedFiles.length - 1} more)` : ""}
            </span>
          )}
        </div>
        <div className="sl-preview-actions">
          {regenerating && (
            <button className="sl-btn sl-btn--ghost" disabled>
              <Loader2 className="sl-spin" size={16} /> Regenerating...
            </button>
          )}
          {error && (
            <button
              type="button"
              className="sl-btn sl-btn--ghost sl-btn--error"
              onClick={onRegenerate}
              disabled={regenerating}
            >
              <RefreshCw size={16} /> Retry
            </button>
          )}
          <button
            type="button"
            className="sl-btn sl-btn--ghost"
            onClick={handleDownload}
            title="Download PDF"
            disabled={!pdfUrl}
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
            title="Print"
            disabled={!pdfLoaded}
          >
            <Printer size={16} />
          </button>
          <button
            type="button"
            className="sl-btn sl-btn--ghost"
            onClick={handleFullscreen}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button
            type="button"
            className="sl-btn sl-btn--primary"
            onClick={onEdit}
            disabled={regenerating}
          >
            <ExternalLink size={16} /> Edit
          </button>
        </div>
      </div>

      <div className="sl-preview-content">
        {pdfError && (
          <div className="sl-preview-error">
            <p>{pdfError}</p>
            <button className="sl-btn sl-btn--primary" onClick={onRegenerate}>
              <RefreshCw size={16} /> Regenerate PDF
            </button>
          </div>
        )}

        {!pdfError && pdfUrl && (
          <iframe
            ref={iframeRef}
            src={pdfUrl}
            className="sl-preview-iframe"
            title={`Letter preview: ${letter?.subject}`}
          />
        )}

        {!pdfUrl && !pdfError && (
          <div className="sl-preview-empty">
            <ExternalLink size={48} />
            <p>No PDF available</p>
            <button className="sl-btn sl-btn--primary" onClick={onRegenerate}>
              <RefreshCw size={16} /> Generate PDF
            </button>
          </div>
        )}

        {!pdfLoaded && pdfUrl && !pdfError && (
          <div className="sl-preview-loading-overlay">
            <Loader2 className="sl-spin" size={32} />
            <p>Loading preview...</p>
          </div>
        )}
      </div>
    </div>
  );
}

SalesLetterPreview.propTypes = {
  letter: PropTypes.shape({
    id: PropTypes.string,
    subject: PropTypes.string,
    letter_type_display: PropTypes.string,
    opportunity_code: PropTypes.string,
    deal_code: PropTypes.string,
    attachments: PropTypes.shape({
      version: PropTypes.number,
      files: PropTypes.arrayOf(
        PropTypes.shape({
          kind: PropTypes.string,
          name: PropTypes.string,
          status: PropTypes.string,
        })
      ),
    }),
  }).isRequired,
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
};