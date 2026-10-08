import { useEffect, useRef, useState, useCallback } from "react";
import PropTypes from "prop-types";
import ReactQuill from "react-quill";
import { Loader2, RefreshCw } from "lucide-react";
import "react-quill/dist/quill.snow.css";
import "./SalesLetterEditor.css";

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ indent: "-1" }, { indent: "+1" }],
    ["clean"],
  ],
};

const QUILL_FORMATS = [
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "list",
  "bullet",
  "indent",
];

const EMPTY_HEAD = {
  response_label: "EOI Response",
  response_code: "",
  confidential_date: "",
  rev: 0,
  sender_name: "",
  sender_company: "",
  focal_contact: "",
  contact_number: "",
  fax: "",
  email: "",
  recipient_name: "",
  recipient_title: "",
  recipient_company: "",
  recipient_address: "",
  recipient_email: "",
  your_ref: "",
  our_ref: "",
  adnoc_unified_code: "",
  signature_name: "",
  signature_titles: "",
};

function Field({ label, value, onChange, disabled, textarea = false, placeholder = "" }) {
  return (
    <div className="sl-editor-field">
      <label>{label}</label>
      {textarea ? (
        <textarea
          className="sl-editor-input sl-editor-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          rows={2}
        />
      ) : (
        <input
          type="text"
          className="sl-editor-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

Field.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  textarea: PropTypes.bool,
  placeholder: PropTypes.string,
};

export default function SalesLetterEditor({
  letter,
  pdfUrl,
  previewLoading = false,
  previewError = null,
  onRefreshPreview,
  onSave,
  onCancel,
  saving = false,
}) {
  const letterId = letter?.id;
  const [subject, setSubject] = useState(letter?.subject || "");
  const [head, setHead] = useState(() => {
    const lh = letter?.custom_data?.letterhead || {};
    const signatureTitles = Array.isArray(lh.signature_titles)
      ? lh.signature_titles.join("\n")
      : (lh.signature_titles || "");
    return { ...EMPTY_HEAD, ...lh, signature_titles: signatureTitles };
  });
  const [paragraphs, setParagraphs] = useState([]);
  const editorRefs = useRef({});

  useEffect(() => {
    if (!letter?.body) {
      setParagraphs([]);
      return;
    }
    const parts = letter.body
      .split("\n\n")
      .map((p) => p.trim())
      .filter(Boolean);
    // The closing line ("Sincerely yours,") is the last paragraph; keep it editable.
    setParagraphs(parts);
  }, [letterId]); // eslint-disable-line react-hooks/exhaustive-deps

  const setField = useCallback((key, value) => {
    setHead((prev) => ({ ...prev, [key]: value }));
  }, []);

  const buildSavePayload = useCallback(() => {
    const signature_titles = String(head.signature_titles || "")
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
    const custom_data = {
      ...(letter?.custom_data || {}),
      letterhead: { ...head, signature_titles },
    };
    const body = paragraphs.map((p) => p.trim()).filter(Boolean).join("\n\n");
    return { subject, body, custom_data };
  }, [head, letter, paragraphs, subject]);

  const handleSave = useCallback(() => {
    onSave?.(buildSavePayload());
  }, [onSave, buildSavePayload]);

  const handleKeyDown = useCallback(
    (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const attachments = letter?.custom_data?.attachments;
  const attachedFiles =
    attachments?.files?.filter((f) => f.status === "ready") || [];

  return (
    <div className="sl-editor-container" onKeyDown={handleKeyDown}>
      <div className="sl-editor-header">
        <div>
          <h3>Edit Letter</h3>
          <div className="sl-editor-hint">
            Press <kbd>Ctrl+S</kbd> to save. Changes regenerate the PDF/DOCX and
            re-attach them to the Correspondence folder.
          </div>
        </div>
        {attachments ? (
          <div className="sl-editor-attached" title={attachedFiles.map((f) => f.name).join(", ")}>
            Attached to Correspondence (v{attachments.version})
          </div>
        ) : null}
      </div>

      <div className="sl-editor-split">
        <div className="sl-editor-form">
          {/* Subject */}
          <Field
            label="Subject"
            value={subject}
            onChange={setSubject}
            disabled={saving}
            placeholder="Letter subject"
          />

          {/* Response / confidential */}
          <div className="sl-editor-section">
            <h4>Header</h4>
            <div className="sl-editor-grid">
              <Field
                label="Response label"
                value={head.response_label}
                onChange={(v) => setField("response_label", v)}
                disabled={saving}
              />
              <Field
                label="Response code"
                value={head.response_code}
                onChange={(v) => setField("response_code", v)}
                disabled={saving}
              />
              <Field
                label="Confidential date"
                value={head.confidential_date}
                onChange={(v) => setField("confidential_date", v)}
                disabled={saving}
                placeholder="1st October 2026"
              />
              <Field
                label="Revision"
                value={String(head.rev ?? 0)}
                onChange={(v) => setField("rev", v.replace(/[^0-9]/g, ""))}
                disabled={saving}
              />
            </div>
          </div>

          {/* Sender */}
          <div className="sl-editor-section">
            <h4>Sender</h4>
            <div className="sl-editor-grid">
              <Field
                label="From (name)"
                value={head.sender_name}
                onChange={(v) => setField("sender_name", v)}
                disabled={saving}
              />
              <Field
                label="From (company)"
                value={head.sender_company}
                onChange={(v) => setField("sender_company", v)}
                disabled={saving}
              />
              <Field
                label="Bid Focal Contact"
                value={head.focal_contact}
                onChange={(v) => setField("focal_contact", v)}
                disabled={saving}
              />
              <Field
                label="Contact Number"
                value={head.contact_number}
                onChange={(v) => setField("contact_number", v)}
                disabled={saving}
              />
              <Field
                label="Fax"
                value={head.fax}
                onChange={(v) => setField("fax", v)}
                disabled={saving}
              />
              <Field
                label="Email"
                value={head.email}
                onChange={(v) => setField("email", v)}
                disabled={saving}
              />
            </div>
          </div>

          {/* Recipient */}
          <div className="sl-editor-section">
            <h4>Recipient (To)</h4>
            <div className="sl-editor-grid">
              <Field
                label="Name"
                value={head.recipient_name}
                onChange={(v) => setField("recipient_name", v)}
                disabled={saving}
              />
              <Field
                label="Title / Position"
                value={head.recipient_title}
                onChange={(v) => setField("recipient_title", v)}
                disabled={saving}
              />
              <Field
                label="Company"
                value={head.recipient_company}
                onChange={(v) => setField("recipient_company", v)}
                disabled={saving}
              />
              <Field
                label="Address"
                value={head.recipient_address}
                onChange={(v) => setField("recipient_address", v)}
                disabled={saving}
              />
              <Field
                label="Email"
                value={head.recipient_email}
                onChange={(v) => setField("recipient_email", v)}
                disabled={saving}
              />
            </div>
          </div>

          {/* References */}
          <div className="sl-editor-section">
            <h4>References</h4>
            <div className="sl-editor-grid">
              <Field
                label="Your Ref. No."
                value={head.your_ref}
                onChange={(v) => setField("your_ref", v)}
                disabled={saving}
              />
              <Field
                label="Our Ref. No."
                value={head.our_ref}
                onChange={(v) => setField("our_ref", v)}
                disabled={saving}
              />
              <Field
                label="Our ADNOC Unified Code"
                value={head.adnoc_unified_code}
                onChange={(v) => setField("adnoc_unified_code", v)}
                disabled={saving}
              />
            </div>
          </div>

          {/* Body */}
          <div className="sl-editor-section">
            <h4>Body</h4>
            <div className="sl-editor-paragraphs">
              {paragraphs.map((para, index) => (
                <div key={index} className="sl-editor-paragraph-wrapper">
                  <div className="sl-editor-paragraph-index">{index + 1}</div>
                  <ReactQuill
                    ref={(el) => (editorRefs.current[index] = el)}
                    theme="snow"
                    value={para}
                    onChange={(content) => {
                      const next = [...paragraphs];
                      next[index] = content;
                      setParagraphs(next);
                    }}
                    modules={QUILL_MODULES}
                    formats={QUILL_FORMATS}
                    readOnly={saving}
                    className="sl-editor-quill"
                    placeholder={`Paragraph ${index + 1}`}
                  />
                  {paragraphs.length > 1 && (
                    <button
                      type="button"
                      className="sl-editor-remove-para"
                      onClick={() =>
                        setParagraphs(paragraphs.filter((_, i) => i !== index))
                      }
                      title="Remove paragraph"
                      disabled={saving}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="sl-editor-add-para"
                onClick={() => setParagraphs([...paragraphs, ""])}
                disabled={saving}
              >
                + Add Paragraph
              </button>
            </div>
          </div>

          {/* Signature */}
          <div className="sl-editor-section">
            <h4>Signature</h4>
            <div className="sl-editor-grid">
              <Field
                label="Name"
                value={head.signature_name}
                onChange={(v) => setField("signature_name", v)}
                disabled={saving}
              />
              <Field
                label="Titles (one per line)"
                value={head.signature_titles}
                onChange={(v) => setField("signature_titles", v)}
                disabled={saving}
                textarea
                placeholder={"Senior Vice President, Middle East Region\nCEO, Rejlers Abu Dhabi"}
              />
            </div>
          </div>
        </div>

        <div className="sl-editor-preview">
          <div className="sl-editor-preview-header">
            <span>PDF Preview</span>
            <button
              type="button"
              className="sl-btn sl-btn--ghost"
              onClick={onRefreshPreview}
              disabled={previewLoading || saving}
              title="Refresh preview"
            >
              <RefreshCw size={14} />
            </button>
          </div>
          <div className="sl-editor-preview-body">
            {previewError ? (
              <div className="sl-editor-preview-error">
                <p>{previewError}</p>
                <button
                  type="button"
                  className="sl-btn sl-btn--primary"
                  onClick={onRefreshPreview}
                  disabled={previewLoading}
                >
                  <RefreshCw size={14} /> Retry
                </button>
              </div>
            ) : pdfUrl ? (
              <>
                <iframe
                  src={pdfUrl}
                  className="sl-editor-preview-iframe"
                  title="Letter PDF preview"
                />
                {previewLoading && (
                  <div className="sl-editor-preview-loading">
                    <Loader2 className="sl-spin" size={28} />
                  </div>
                )}
              </>
            ) : (
              <div className="sl-editor-preview-empty">
                {previewLoading ? (
                  <>
                    <Loader2 className="sl-spin" size={32} />
                    <p>Generating preview…</p>
                  </>
                ) : (
                  <p>No preview available. Save to regenerate.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="sl-editor-actions">
        <button
          type="button"
          className="sl-btn sl-btn--secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Back to Preview
        </button>
        <button
          type="button"
          className="sl-btn sl-btn--primary"
          onClick={handleSave}
          disabled={saving || !subject.trim()}
        >
          {saving ? (
            <>
              <Loader2 className="sl-spin" size={16} /> Saving…
            </>
          ) : (
            "Save & Regenerate"
          )}
        </button>
      </div>
    </div>
  );
}

SalesLetterEditor.propTypes = {
  letter: PropTypes.shape({
    id: PropTypes.string,
    subject: PropTypes.string,
    body: PropTypes.string,
    custom_data: PropTypes.shape({
      letterhead: PropTypes.object,
      attachments: PropTypes.object,
    }),
  }).isRequired,
  pdfUrl: PropTypes.string,
  previewLoading: PropTypes.bool,
  previewError: PropTypes.string,
  onRefreshPreview: PropTypes.func,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  saving: PropTypes.bool,
};

SalesLetterEditor.defaultProps = {
  pdfUrl: null,
  previewLoading: false,
  previewError: null,
  onRefreshPreview: null,
  saving: false,
};
