import { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { FileText, Loader2, Paperclip, RefreshCw, Trash2, Upload } from "lucide-react";
import salesService from "../../services/sales.service";

const ACCEPT = ".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls";

const errorText = (failure, fallback) => {
  const data = failure?.response?.data;
  const first = (value) => (Array.isArray(value) ? value[0] : value);
  return first(data?.file) || first(data?.section_key) || first(data?.detail) || fallback;
};

/**
 * Company evidence for one evidence section (project references, CVs, organisation charts).
 * Files are enclosed in that section of the PDF the next time the section is rebuilt.
 */
export default function SalesProposalEvidence({ quoteId, section, disabled, onInclude }) {
  const [state, setState] = useState({ loading: true, files: [], required: [], error: "" });
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState(0);
  const input = useRef(null);
  const enclosed = new Set((section.attachments || []).map((item) => item.id));

  const load = useCallback(async () => {
    try {
      const data = await salesService.getProposalEvidence(quoteId, section.key);
      setState({ loading: false, files: data.files || [], required: data.required || [], error: "" });
    } catch (failure) {
      setState((previous) => ({ ...previous, loading: false, error: errorText(failure, "Evidence could not be loaded.") }));
    }
  }, [quoteId, section.key]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (files) => {
    for (const file of files) {
      setBusy(`upload:${file.name}`);
      setProgress(0);
      try {
        const data = await salesService.uploadProposalEvidence(quoteId, section.key, file, crypto.randomUUID(), {
          onUploadProgress: (event) => event.total && setProgress(Math.round((100 * event.loaded) / event.total)),
        });
        setState({ loading: false, files: data.files || [], required: data.required || [], error: "" });
      } catch (failure) {
        setState((previous) => ({ ...previous, error: `${file.name}: ${errorText(failure, "Upload failed. Try again.")}` }));
        break;
      }
    }
    setBusy("");
    if (input.current) input.current.value = "";
  };

  const remove = async (file) => {
    setBusy(`remove:${file.id}`);
    try {
      const data = await salesService.removeProposalEvidence(quoteId, section.key, file.id);
      setState({ loading: false, files: data.files || [], required: data.required || [], error: "" });
    } catch (failure) {
      setState((previous) => ({ ...previous, error: errorText(failure, "The file could not be removed.") }));
    }
    setBusy("");
  };

  const pending = state.files.some((file) => !enclosed.has(file.id))
    || (section.attachments || []).some((item) => !state.files.some((file) => file.id === item.id));

  return (
    <div className="ssp-evidence" aria-label={`${section.title} evidence`}>
      <h5>Company evidence</h5>
      {state.required.length > 0 && (
        <p className="ssp-muted">Needed: {state.required.join(", ")}.</p>
      )}
      {state.loading ? (
        <p className="ssp-muted" role="status">Loading evidence…</p>
      ) : state.files.length ? (
        <ul className="ssp-documents">
          {state.files.map((file) => (
            <li key={file.id}>
              <FileText size={14} aria-hidden="true" />
              <span>{file.name}</span>
              <span className="ssp-muted">{enclosed.has(file.id) ? "In the PDF" : "Not yet in the PDF"}</span>
              <button
                type="button"
                className="ssp-icon-button"
                aria-label={`Remove ${file.name}`}
                disabled={disabled || Boolean(busy)}
                onClick={() => remove(file)}
              >
                {busy === `remove:${file.id}` ? <Loader2 size={14} className="ssp-spin" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ssp-alert ssp-alert-warn">
          No evidence uploaded yet. Upload the documents for this section; they are enclosed in the proposal PDF.
        </p>
      )}
      {state.error && <p className="ssp-alert ssp-alert-warn" role="alert">{state.error}</p>}
      <div className="ssp-actions">
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT}
          hidden
          aria-label={`Upload evidence for ${section.title}`}
          onChange={(event) => upload(Array.from(event.target.files || []))}
        />
        <button
          type="button"
          className="spg-button"
          disabled={disabled || Boolean(busy)}
          onClick={() => input.current?.click()}
        >
          {busy.startsWith("upload:") ? <Loader2 size={15} className="ssp-spin" aria-hidden="true" /> : <Upload size={15} aria-hidden="true" />}
          {busy.startsWith("upload:") ? `Uploading ${progress}%` : "Upload evidence"}
        </button>
        {pending && (
          <button
            type="button"
            className="spg-button spg-primary"
            disabled={disabled || Boolean(busy)}
            onClick={() => onInclude(section)}
          >
            <RefreshCw size={15} aria-hidden="true" />
            Add evidence to the PDF
          </button>
        )}
      </div>
      <p className="ssp-hint">
        <Paperclip size={12} aria-hidden="true" /> PDF, Word, PowerPoint or Excel. Files are saved in the
        opportunity&apos;s Internal folder under Proposal evidence.
      </p>
    </div>
  );
}

SalesProposalEvidence.propTypes = {
  quoteId: PropTypes.string.isRequired,
  section: PropTypes.shape({
    key: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    attachments: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, name: PropTypes.string })),
  }).isRequired,
  disabled: PropTypes.bool,
  onInclude: PropTypes.func.isRequired,
};
