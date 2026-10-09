import { useEffect, useMemo, useState, useCallback } from "react";
import PropTypes from "prop-types";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  X,
  XCircle,
} from "lucide-react";
import salesService from "../../services/sales.service";
import SalesLetterPreview from "./SalesLetterPreview";
import SalesLetterEditor from "./SalesLetterEditor";
import "./SalesLetterModal.css";

const LETTER_TYPE_LABELS = {
  eoi: "Expression of Interest",
  regret_expertise: "Regret - Area of Expertise",
  regret_manpower: "Regret - Manpower Availability",
};

const LETTER_TYPE_ICONS = {
  eoi: FileText,
  regret_expertise: XCircle,
  regret_manpower: AlertCircle,
};

const LETTER_TYPE_DESCRIPTIONS = {
  eoi: "Confirm interest in participating. Use after a Bid or Conditional Bid decision.",
  regret_expertise: "Decline due to opportunity falling outside core expertise/specialization.",
  regret_manpower: "Decline due to resource constraints despite alignment with expertise.",
};

const LETTER_TYPE_BADGE_CLASSES = {
  eoi: "sl-letter-badge--eoi",
  regret_expertise: "sl-letter-badge--regret",
  regret_manpower: "sl-letter-badge--regret",
};

function formatDate(dateString) {
  if (!dateString) return "Not provided";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function bidLabel(value) {
  const labels = {
    pending: "Pending",
    bid: "Go",
    conditional_bid: "Conditional Go",
    no_bid: "No-Go",
  };
  return labels[value] || "No decision";
}

export default function SalesLetterModal({
  deal,
  onClose,
  onLetterGenerated,
  onError,
  initialLetterType = null,
  open = false,
}) {
  const [step, setStep] = useState("select"); // select, preview, edit, sent
  const [selectedType, setSelectedType] = useState(initialLetterType);
  const [generatedLetter, setGeneratedLetter] = useState(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  // Bumped after every regenerate so the preview iframe reloads the PDF.
  const [previewEpoch, setPreviewEpoch] = useState(0);

  useEffect(() => {
    if (initialLetterType && step === "select") {
      setSelectedType(initialLetterType);
    }
  }, [initialLetterType, step]);

  // The modal stays mounted while closed, so reset the wizard each time it
  // opens — otherwise reopening shows a stale preview step (or an invisible
  // error state) instead of the letter-type select step.
  useEffect(() => {
    if (!open) return;
    setStep("select");
    setSelectedType(initialLetterType);
    setGeneratedLetter(null);
    setLoading(false);
    setRegenerating(false);
    setError("");
    setPdfError(null);
    setPreviewFullscreen(false);
    setPreviewEpoch(0);
    // Only the open transition matters; state setters are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

// Same-origin URL served by the backend (iframe-friendly, no blob needed).
  // Built from the backend-returned pdf_preview_url so the iframe always
  // points at the real PDF endpoint, never at an application route.
  const pdfUrl = useMemo(() => {
    if (!open || !deal || !generatedLetter) return null;
    if (generatedLetter.pdf_preview_url) {
      return salesService.buildLetterPreviewUrl(generatedLetter, previewEpoch);
    }
    return salesService.getLetterPreviewUrl(deal.id, generatedLetter.id, previewEpoch);
  }, [open, deal, generatedLetter, previewEpoch]);

  const availableTypes = useMemo(() => {
    if (!deal) return [];
    const bidDecision = deal.bid_decision;
    if (bidDecision === "bid" || bidDecision === "conditional_bid") {
      return ["eoi"];
    }
    if (bidDecision === "no_bid") {
      return ["regret_expertise", "regret_manpower"];
    }
    return [];
  }, [deal]);

  const handleGenerate = useCallback(async () => {
    if (!selectedType) return;
    setLoading(true);
    setError("");
    setPdfError(null);
    try {
      const letter = await salesService.prepareLetter(
        deal.id,
        selectedType,
        {}
      );
      setGeneratedLetter(letter);
      setStep("preview");
      onLetterGenerated?.(letter);
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.letter_type?.[0] ||
        "Failed to generate letter";
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }, [deal, selectedType, onLetterGenerated, onError]);

  // The drawer action the user clicked already determines the letter type
  // (e.g. "Prepare Regret Letter (Expertise)"), so skip the select step and
  // generate that letter directly instead of offering both regret variants.
  useEffect(() => {
    if (!open || step !== "select") return;
    if (!selectedType || generatedLetter || loading || error) return;
    if (!availableTypes.includes(selectedType)) return;
    handleGenerate();
  }, [open, step, selectedType, generatedLetter, loading, error, availableTypes, handleGenerate]);

  const handleDownloadPdf = useCallback(async () => {
    if (!generatedLetter) return;
    try {
      const { blob, filename } = await salesService.downloadLetterPdf(deal.id, generatedLetter.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || `${deal.deal_code}-${LETTER_TYPE_LABELS[selectedType].toLowerCase().replace(/\s+/g, "-")}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF download failed:", err);
      // Fallback to text download
      const content = `${generatedLetter.subject}\n\n${generatedLetter.body}`;
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${deal.deal_code}-${LETTER_TYPE_LABELS[selectedType].toLowerCase().replace(/\s+/g, "-")}.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }
  }, [deal, generatedLetter, selectedType]);

  const handleDownloadDocx = useCallback(async () => {
    if (!generatedLetter) return;
    try {
      const { blob, filename } = await salesService.downloadLetterDocx(deal.id, generatedLetter.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || `${deal.deal_code}-${generatedLetter.letter_type}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("DOCX download failed:", err);
      const msg = err.response?.data?.detail || "Failed to download DOCX";
      setError(msg);
      onError?.(msg);
    }
  }, [deal, generatedLetter, onError]);

  const handleEdit = useCallback(() => {
    setStep("edit");
  }, []);

  const handleCancelEdit = useCallback(() => {
    setStep("preview");
    setError("");
    setPdfError(null);
  }, []);

  const handleSaveEdit = useCallback(async (updatedData) => {
    if (!generatedLetter) return;
    setRegenerating(true);
    setPdfError(null);
    try {
      // The regenerate endpoint updates subject/body/custom_data, regenerates
      // the PDF+DOCX, bumps the revision and re-attaches to Correspondence.
      const refreshed = await salesService.regenerateLetterPdf(
        deal.id,
        generatedLetter.id,
        updatedData
      );
      setGeneratedLetter(refreshed);
      
      // Force fetch updated letter from backend to get fresh pdf_preview_url and revision
      const freshLetters = await salesService.getLetters(deal.id);
      const freshLetter = (freshLetters.results || freshLetters).find(l => l.id === generatedLetter.id);
      if (freshLetter) {
        console.log("[LetterPreview] Regenerated letter:", {
          id: freshLetter.id,
          revision: freshLetter.version || freshLetter.revision,
          pdf_preview_url: freshLetter.pdf_preview_url,
        });
        setGeneratedLetter(freshLetter);
      }
      
      // Destroy and recreate iframe with timestamp cache-buster
      setPreviewEpoch(Date.now());
      return refreshed;
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to save changes";
      setError(msg);
      setPdfError(msg);
      onError?.(msg);
      return null;
    } finally {
      setRegenerating(false);
    }
  }, [deal, generatedLetter, onError]);

  const handleRegeneratePdf = useCallback(async () => {
    if (!generatedLetter) return;
    setRegenerating(true);
    setPdfError(null);
    try {
      await salesService.regenerateLetterPdf(deal.id, generatedLetter.id, generatedLetter.custom_data);

      // Refresh letter to surface the bumped revision and attachments.
      const freshLetters = await salesService.getLetters(deal.id);
      const freshLetter = (freshLetters.results || freshLetters).find(l => l.id === generatedLetter.id);
      if (freshLetter) {
        console.log("[LetterPreview] Regenerated letter:", {
          id: freshLetter.id,
          revision: freshLetter.version || freshLetter.revision,
          pdf_preview_url: freshLetter.pdf_preview_url,
        });
        setGeneratedLetter(freshLetter);
      }
      
      // Destroy and recreate iframe with timestamp cache-buster
      setPreviewEpoch(Date.now());
      setPdfError(null);
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to regenerate PDF";
      setPdfError(msg);
      onError?.(msg);
    } finally {
      setRegenerating(false);
    }
  }, [deal, generatedLetter, onError]);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  if (!open) return null;

  const renderSelectStep = () => (
    <div className="sl-modal-step">
      <h3>Select Letter Type</h3>
      <p className="sl-modal-hint">
        Based on the Go/No-Go decision ({bidLabel(deal?.bid_decision)}), the following
        letter types are available:
      </p>
      <div className="sl-letter-options">
        {availableTypes.map((type) => {
          const Icon = LETTER_TYPE_ICONS[type];
          return (
            <button
              key={type}
              type="button"
              className={`sl-letter-option ${LETTER_TYPE_BADGE_CLASSES[type]} ${
                selectedType === type ? "sl-selected" : ""
              }`}
              onClick={() => setSelectedType(type)}
            >
              <div className="sl-letter-option-header">
                <Icon className="sl-letter-icon" size={24} />
                <span className="sl-letter-label">{LETTER_TYPE_LABELS[type]}</span>
                <span className="sl-letter-badge">{LETTER_TYPE_LABELS[type]}</span>
              </div>
              <p className="sl-letter-desc">{LETTER_TYPE_DESCRIPTIONS[type]}</p>
            </button>
          );
        })}
      </div>
      {availableTypes.length === 0 && (
        <div className="sl-no-options">
          <AlertCircle size={24} />
          <p>No letter types available for the current bid decision.</p>
          <p className="sl-hint">
            Complete the Go/No-Go decision to unlock letter preparation.
          </p>
        </div>
      )}
      <div className="sl-modal-actions">
        <button
          type="button"
          className="sl-btn sl-btn--secondary"
          onClick={handleClose}
        >
          <X size={16} /> Cancel
        </button>
        <button
          type="button"
          className="sl-btn sl-btn--primary"
          onClick={handleGenerate}
          disabled={!selectedType || loading}
        >
          {loading ? (
            <>
              <Loader2 className="sl-spin" size={16} /> Generating...
            </>
          ) : (
            <>
              <FileText size={16} /> Generate Letter
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderPreviewStep = () => {
    if (!generatedLetter) return null;

    return (
      <SalesLetterPreview
        letter={generatedLetter}
        pdfUrl={pdfUrl}
        onDownload={handleDownloadPdf}
        onDownloadDocx={handleDownloadDocx}
        onPrint={() => {}}
        onFullscreenToggle={setPreviewFullscreen}
        onRegenerate={handleRegeneratePdf}
        onEdit={handleEdit}
        fullscreen={previewFullscreen}
        loading={!pdfUrl}
        regenerating={regenerating}
        error={pdfError}
        previewKey={previewEpoch}
      />
    );
  };

  const renderEditStep = () => (
    <SalesLetterEditor
      letter={generatedLetter}
      pdfUrl={pdfUrl}
      previewLoading={false}
      previewError={pdfError}
      onRefreshPreview={() => setPreviewEpoch(Date.now())}
      onSave={handleSaveEdit}
      onCancel={handleCancelEdit}
      saving={regenerating}
      previewKey={previewEpoch}
    />
  );

  const renderSentStep = () => (
    <div className="sl-modal-step sl-sent-step">
      <CheckCircle2 className="sl-success-icon" size={48} />
      <h3>Letter Sent</h3>
      <div className="sl-sent-details">
        <p>
          <strong>Type:</strong> {LETTER_TYPE_LABELS[selectedType]}
        </p>
        <p>
          <strong>Sent to:</strong> {generatedLetter?.sent_to}
        </p>
        <p>
          <strong>Sent at:</strong>{" "}
          {generatedLetter?.sent_at
            ? formatDate(generatedLetter.sent_at)
            : "Just now"}
        </p>
      </div>
      <div className="sl-modal-actions">
        <button
          type="button"
          className="sl-btn sl-btn--secondary"
          onClick={handleClose}
        >
          <CheckCircle2 size={16} /> Done
        </button>
      </div>
    </div>
  );

  if (error && step !== "preview" && step !== "edit") {
    return (
      <div className="sl-modal-overlay" onClick={handleClose}>
        <div className="sl-modal" onClick={(e) => e.stopPropagation()}>
          <header className="sl-modal-header">
            <h2>Prepare Letter</h2>
            <button
              type="button"
              className="sl-modal-close"
              onClick={handleClose}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </header>
          <main className="sl-modal-body">
            <div className="sl-modal-error">
              <AlertCircle size={32} />
              <p>{error}</p>
              <button
                type="button"
                className="sl-btn sl-btn--primary"
                onClick={() => {
                  setError("");
                  setStep("select");
                }}
              >
                Try Again
              </button>
              <button
                type="button"
                className="sl-btn sl-btn--secondary"
                onClick={handleClose}
              >
                Cancel
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="sl-modal-overlay" onClick={handleClose}>
      <div
        className={`sl-modal ${step === "preview" || step === "edit" ? "sl-modal--wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sl-modal-header">
          <h2>Prepare Letter</h2>
          <button
            type="button"
            className="sl-modal-close"
            onClick={handleClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </header>
        <main
          className={`sl-modal-body ${
            step === "preview" || step === "edit" ? "sl-modal-body--fill" : ""
          }`}
        >
          {step === "select" && renderSelectStep()}
          {step === "preview" && generatedLetter && renderPreviewStep()}
          {step === "edit" && generatedLetter && renderEditStep()}
          {step === "sent" && renderSentStep()}
        </main>
      </div>
    </div>
  );
}

SalesLetterModal.propTypes = {
  deal: PropTypes.shape({
    id: PropTypes.string.isRequired,
    deal_code: PropTypes.string,
    deal_name: PropTypes.string,
    bid_decision: PropTypes.string,
  }),
  onClose: PropTypes.func.isRequired,
  onLetterGenerated: PropTypes.func,
  onError: PropTypes.func,
  initialLetterType: PropTypes.oneOf(["eoi", "regret_expertise", "regret_manpower"]),
  open: PropTypes.bool,
};