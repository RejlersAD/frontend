import { useEffect, useRef, useState, useCallback, useId } from "react";
import { API_BASE_URL } from "../../config/api.config";
import CandidateFormView from "./CandidateFormView";
import PropTypes from "prop-types";
import CandidateCVFields from "./CandidateCVFields";
import CandidateCVUploads from "./CandidateCVUploads";
import { completion, cvSections, mergeExtracted } from "./candidateCvUtils";
import { candidateFormRequest as fileRequest } from "../../services/candidateFormsPublic.service";
import "./CandidateOnlineForm.css";

const API = `${API_BASE_URL.replace(/\/$/, "")}/candidate-forms`;
const STORAGE_KEY = "radai-candidate-form-session";
const RESUME_KEY = "radai-candidate-form-resume";
const PENDING_KEY = "radai-candidate-form-pending";
const COMPLETED_KEY = "radai-candidate-cv-completed";

function rememberCompletedCV() {
  [STORAGE_KEY, RESUME_KEY, PENDING_KEY].forEach(key => sessionStorage.removeItem(key));
  sessionStorage.setItem(COMPLETED_KEY, "true");
}

function closeCandidatePage() {
  window.close();
  // Browsers may refuse to close a tab they did not open. Leave a blank page
  // in that case, without returning to an editable form or another application.
  if (!window.closed) window.location.replace("about:blank");
}

const FORM_TITLES = {
  cv: "Candidate CV Submission Form",
  pre_onboarding: "Pre-Onboarding Employee Form",
};

/**
 * Universal JSON request helper with HTTP error & signal handling
 */
async function request(path, payload, session, signal) {
  const response = await fetch(`${API}/${path}/`, {
    method: payload ? "POST" : "GET",
    cache: "no-store",
    credentials: "omit",
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session}` } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    let message = "The form could not be saved. Please retry.";
    if (data?.detail) {
      message = data.detail;
    } else if (data?.fields && typeof data.fields === "object") {
      message = Object.entries(data.fields)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · ");
    }
    const error = new Error(message);
    error.status = response.status;
    error.closedCV = data?.code === "cv_link_closed";
    throw error;
  }

  return data;
}

/**
 * Accessible field component supporting text, year, textarea, and checkbox
 */
function FormField({ field, value, onChange, sectionKey, index }) {
  const generatedId = useId();
  const inputId = `${sectionKey}-${field.key}-${index ?? "static"}-${generatedId}`;
  const isCheckbox = field.type === "checkbox";
  const isTextarea = field.type === "textarea";

  return (
    <div className={`cf-field${isTextarea || isCheckbox ? " cf-field-wide" : ""}`}>
      {!isCheckbox && (
        <label htmlFor={inputId}>
          {field.label}
          {field.required && <span aria-hidden="true"> *</span>}
        </label>
      )}

      {isTextarea ? (
        <textarea
          id={inputId}
          rows={5}
          maxLength={10000}
          required={field.required}
          aria-required={field.required}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : isCheckbox ? (
        <label htmlFor={inputId} className="cf-check">
          <input
            id={inputId}
            type="checkbox"
            required={field.required}
            aria-required={field.required}
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{field.label}</span>
          {field.required && <span aria-hidden="true"> *</span>}
        </label>
      ) : (
        <input
          id={inputId}
          type={field.type === "year" ? "text" : field.type || "text"}
          inputMode={field.type === "year" ? "numeric" : undefined}
          maxLength={500}
          required={field.required}
          aria-required={field.required}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

FormField.propTypes = { field: PropTypes.object.isRequired, value: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]), onChange: PropTypes.func.isRequired, sectionKey: PropTypes.string.isRequired, index: PropTypes.number };

export default function CandidateOnlineForm() {
  const [form, setForm] = useState(null);
  const [data, setData] = useState({});
  const [step, setStep] = useState(0);
  const [session, setSession] = useState("");
  const [verification, setVerification] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const [reloadConfirmation, setReloadConfirmation] = useState(false);
  const [preview, setPreview] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveBlocked, setSaveBlocked] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const latestData = useRef(data);
  latestData.current = data;
  const savingRef = useRef(false);
  const failedSave = useRef(null);

  const applicationToken = useRef("");
  const token = useRef("");

  const createEmptyRow = () => ({
    _uid: typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 9),
  });

  const load = useCallback(async (currentSession, signal) => {
    const loaded = await request("session", null, currentSession, signal);
    if (loaded.kind === "cv" && ["submitted", "verified"].includes(loaded.state)) {
      rememberCompletedCV(); setForm(loaded); setSession(""); setData({}); setAttachments([]); setDirty(false);
      return;
    }
    const draft = { ...loaded.data };

    if (!["submitted", "verified"].includes(loaded.state)) {
      loaded.schema?.sections
        ?.filter((s) => s.repeatable)
        .forEach((s) => {
          if (!draft[s.key]?.length) {
            draft[s.key] = [createEmptyRow()];
          } else {
            draft[s.key] = draft[s.key].map((row) => ({
              ...row,
              _uid: row._uid || createEmptyRow()._uid,
            }));
          }
        });
    }

    setSession(currentSession);
    setForm(loaded);
    setData(draft);
    setDirty(false);
    setAttachments(loaded.attachments || []); setSaveBlocked(false); setSaveStatus("All changes saved");
    sessionStorage.removeItem(PENDING_KEY);
  }, []);

  const loadPreview = useCallback(async (kind, signal) => {
    setBusy(true);
    setError("");
    try {
      const schema = await request(`templates/${kind}`, null, null, signal);
      setForm({ title: FORM_TITLES[kind], kind, schema, state: "draft" });
      setData(
        Object.fromEntries(
          schema.sections.map((s) => [s.key, s.repeatable ? [createEmptyRow()] : {}])
        )
      );
      setAttachments([]);
      setPreview(true);
      setStep(0);
      setDirty(false);
      window.history.replaceState(null, "", `${window.location.pathname}?form=${kind}`);
    } catch (failure) {
      if (failure.name !== "AbortError") {
        setError(failure.message);
      }
    } finally {
      setBusy(false);
    }
  }, []);

  // Initialization & URL resolution
  useEffect(() => {
    const controller = new AbortController();
    document.title = "Rejlers · Candidate online forms";

    let meta = document.querySelector('meta[name="referrer"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "referrer";
      meta.content = "no-referrer";
      document.head.appendChild(meta);
    }

    const fragment = new URLSearchParams(window.location.hash.slice(1));
    token.current = fragment.get("invite") || "";
    applicationToken.current = fragment.get("apply") || "";
    const requestedForm = new URLSearchParams(window.location.search).get("form");

    if (token.current || applicationToken.current) {
      sessionStorage.removeItem(COMPLETED_KEY);
      sessionStorage.setItem(
        PENDING_KEY,
        JSON.stringify({
          invite: token.current,
          apply: applicationToken.current,
        })
      );
    } else if (!requestedForm) {
      try {
        const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "{}");
        token.current = pending.invite || "";
        applicationToken.current = pending.apply || "";
      } catch {
        sessionStorage.removeItem(PENDING_KEY);
      }
    }

    window.history.replaceState(null, "", window.location.pathname + window.location.search);

    const initialize = async () => {
      try {
        if (applicationToken.current) {
          sessionStorage.removeItem(STORAGE_KEY);
          sessionStorage.removeItem(RESUME_KEY);
          

          const result = await request(
            "apply",
            { token: applicationToken.current },
            null,
            controller.signal
          );

          if (result.session) {
            
            sessionStorage.setItem(RESUME_KEY, result.resume_link);
            sessionStorage.setItem(STORAGE_KEY, result.session);
            await load(result.session, controller.signal);
            applicationToken.current = "";
          } else {
            throw new Error("The form could not be opened. Please refresh and retry the invitation.");
          }

        } else if (token.current) {
          sessionStorage.removeItem(STORAGE_KEY);
          const resume = `${window.location.origin}${window.location.pathname}#invite=${token.current}`;
          sessionStorage.setItem(RESUME_KEY, resume);
          

          const result = await request(
            "access",
            { token: token.current },
            null,
            controller.signal
          );

          if (result.verification_required) {
            setVerification(true);
          } else if (result.closed && result.kind === "cv") {
            rememberCompletedCV(); setForm(result);
          } else {
            sessionStorage.setItem(STORAGE_KEY, result.session);
            await load(result.session, controller.signal);
            token.current = "";
          }
        } else {
          if (!requestedForm && sessionStorage.getItem(COMPLETED_KEY)) {
            setForm({kind: "cv", state: "submitted", closed: true});
            return;
          }
          const saved = sessionStorage.getItem(STORAGE_KEY);
          if (requestedForm || !saved) {
            await loadPreview(
              requestedForm === "pre_onboarding" ? "pre_onboarding" : "cv",
              controller.signal
            );
          } else {
            try { await load(saved, controller.signal); } catch (failure) {
              if (failure.status !== 403 || !failure.message.includes("session has expired")) throw failure;
              const resume = sessionStorage.getItem(RESUME_KEY);
              const previousToken = resume ? new URLSearchParams(new URL(resume).hash.slice(1)).get("invite") : "";
              if (!previousToken) throw failure;
              token.current = previousToken;
              const result = await request("access", {token: previousToken}, null, controller.signal);
              if (result.closed && result.kind === "cv") { rememberCompletedCV(); setForm(result); }
              else if (result.verification_required) setVerification(true);
              else { sessionStorage.setItem(STORAGE_KEY, result.session); await load(result.session, controller.signal); token.current = ""; }
            }
          }
        }
      } catch (failure) {
        if (failure.name !== "AbortError") {
          if (failure.closedCV) { rememberCompletedCV(); setForm({kind: "cv", state: "submitted", closed: true, previouslySubmitted: true}); }
          else setError(failure.message);
        }
      } finally {
        setBusy(false);
      }
    };

    initialize();
    return () => controller.abort();
  }, [load, loadPreview]);

  // Prevent accidental close with unsaved data
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const verify = async (sendCode) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await request("access", {
        token: token.current,
        ...(sendCode ? { send_code: true } : { code }),
      });

      if (result.session) {
        sessionStorage.setItem(STORAGE_KEY, result.session);
        await load(result.session);
        token.current = "";
        setVerification(false);
      } else {
        setNotice("A verification code was sent to your email address. It expires in 10 minutes.");
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };

  const handleChange = (sectionKey, fieldKey, value, index) => {
    setData((previous) => {
      if (index == null) {
        return {
          ...previous,
          [sectionKey]: { ...previous[sectionKey], [fieldKey]: value },
        };
      }
      return {
        ...previous,
        [sectionKey]: (previous[sectionKey] || []).map((row, rowIndex) =>
          rowIndex === index ? { ...row, [fieldKey]: value } : row
        ),
      };
    });
    setDirty(!preview);
    setNotice("");
  };

  const save = useCallback(async (action, automatic = false) => {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true); setSaveBlocked(false); setSaveStatus("Saving...");
    if (!automatic) { setBusy(true); setError(""); setNotice(""); }
    const snapshot = latestData.current;
    try {
      const savedData = { ...snapshot };
      form.schema.sections.filter(s => s.repeatable).forEach(s => {
        savedData[s.key] = (savedData[s.key] || []).map(row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== "_uid"))).filter(row => Object.values(row).some(value => value !== "" && value != null && value !== false));
      });
      const result = await request("session", { action, revision: form.revision, data: savedData }, session);
      if (action === "submit" && form.kind === "cv") {
        rememberCompletedCV(); setSession(""); setData({}); setAttachments([]); setDirty(false);
        setForm({kind: "cv", ...result});
        return;
      }
      setForm(previous => ({...previous, ...result})); setDirty(latestData.current !== snapshot); setSaveStatus("All changes saved");
      if (!automatic) setNotice(action === "submit" ? "Your form has been submitted to HR." : "Draft saved.");
    } catch (failure) {
      if (failure.closedCV || (failure.status === 409 && form.kind === "cv" && failure.message.includes("already been submitted"))) {
        rememberCompletedCV(); setForm({kind: "cv", state: "submitted", closed: true}); setSession(""); setData({}); setAttachments([]); setDirty(false);
        return;
      }
      setError(failure.message); setSaveStatus("Changes not saved"); setSaveBlocked(true); failedSave.current = {data: snapshot, status: failure.status};
    } finally { savingRef.current = false; setSaving(false); if (!automatic) setBusy(false); }
  }, [form, session]);
  useEffect(() => {
    if (!dirty || preview || busy || saving || (saveBlocked && (failedSave.current?.status === 409 || failedSave.current?.data === data)) || !form || ["submitted", "verified"].includes(form.state)) return;
    const timer = setTimeout(() => save("save", true), 1000);
    return () => clearTimeout(timer);
  }, [data, dirty, preview, busy, saving, saveBlocked, form, save]);
  const extract = async attachment => {
    setBusy(true); setError(""); setNotice("Reading your CV and filling the form...");
    try {
      const result = await request("extract-cv", {attachment}, session);
      setData(previous => {
        const merged = mergeExtracted(previous, result.data);
        form.schema.sections.filter(section => section.repeatable).forEach(section => {
          merged[section.key] = (merged[section.key] || []).map(row => ({...row, _uid: row._uid || createEmptyRow()._uid}));
        });
        return merged;
      }); setDirty(true);
      setAttachments(previous => previous.map(file => file.id === attachment ? {...file, extracted: true} : file));
      setNotice("CV details filled in. Your existing entries were kept. Review and correct every section, then confirm accuracy at the end.");
    } catch (failure) { setNotice(""); throw failure; }
    finally { setBusy(false); }
  };
  const upload = async (file, kind) => {
    setBusy(true);
    try {
      const body = new FormData(); body.append("kind", kind); body.append("file", file);
      const attachment = await fileRequest("uploads", body, session);
      setAttachments(previous => [...previous.filter(item => item.kind !== kind), attachment]);
      if (kind === "cv") await extract(attachment.id); else setNotice("Professional photo saved.");
    } finally { setBusy(false); }
  };

  const verifyFormEmail = async sendCode => {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await request("session", {action: sendCode ? "send_code" : "verify_email", email: data.contact?.email || "", ...(sendCode ? {} : {code})}, session);
      if (result.email_verified) { setForm(previous => ({...previous, verified_email: result.verified_email})); setCode(""); setNotice("Your email is confirmed. You can submit the form."); }
      else setNotice("A verification code was sent to the personal email address entered in your form.");
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const isCV = form?.kind === "cv";
  const fullPage = isCV || form?.kind === "pre_onboarding";
  const readonly = Boolean(form && ["submitted", "verified"].includes(form.state));
  const sourceSections =
    form?.schema?.sections?.filter(
      (s) => s.key !== "relatives" || data.relatives_question?.has_relatives
    ) || [];

  const sections = isCV && form?.schema ? cvSections(form.schema) : sourceSections;
  const progress = isCV && form?.schema ? completion(form.schema, data, attachments.some(file => file.kind === "photo")) : 0;
  const reviewing = step >= sections.length || readonly;
  const currentSection = sections[Math.min(step, Math.max(0, sections.length - 1))];

  const renderSection = (sec, secIndex) => (
    <section key={sec.viewKey || sec.key} aria-labelledby={`sec-${sec.viewKey || sec.key}`} className="cf-form-section">
      <div className="cf-section-title">
        <span>
          Section {secIndex + 1} of {sections.length}
        </span>
        <h2 id={`sec-${sec.viewKey || sec.key}`}>{sec.title}</h2>
      </div>

      {sec.key === "beneficiary" && form?.schema?.declaration && (
        <div className="cf-declaration">
          <strong>Company-template declaration</strong>
          <p>
            {form.schema.declaration.replace(
              /\{([^}]+)\}/g,
              (_, k) => data.beneficiary?.[k] || "________"
            )}
          </p>
          {form.schema.signature_note && <p>{form.schema.signature_note}</p>}
        </div>
      )}

      {sec.repeatable ? (
        <>
          {(data[sec.key] || []).map((row, index) => (
            <div className={`cf-repeat${["projects", "employment"].includes(sec.key) ? " cf-timeline-entry" : ""}`} key={row._uid || index}>
              <header>
                <h3>{["projects", "employment"].includes(sec.key) ? `${row.period || "Add dates"} - ${row.title || "Role"}${row.company ? ` - ${row.company}` : ""}` : `Entry ${index + 1}`}</h3>
                <button
                  type="button"
                  className="cf-text-button"
                  onClick={() => {
                    setData((prev) => ({
                      ...prev,
                      [sec.key]: prev[sec.key].filter((_, i) => i !== index),
                    }));
                    setDirty(!preview);
                  }}
                >
                  Remove entry {index + 1}
                </button>
              </header>
              <div className="cf-grid">
                {isCV ? <CandidateCVFields section={sec} row={row} onChange={(field, value) => handleChange(sec.key, field, value, index)} /> : sec.fields.map((f) => (
                  <FormField
                    key={f.key}
                    field={f}
                    value={row[f.key]}
                    onChange={(val) => handleChange(sec.key, f.key, val, index)}
                    sectionKey={sec.key}
                    index={index}
                  />
                ))}
              </div>
            </div>
          ))}

          <button
            type="button"
            className="cf-secondary"
            disabled={(data[sec.key] || []).length >= 40}
            onClick={() => {
              setData((prev) => ({
                ...prev,
                [sec.key]: [...(prev[sec.key] || []), createEmptyRow()],
              }));
              setDirty(!preview);
            }}
          >
            + Add {sec.title === "Education" ? "education" : "entry"}
          </button>
        </>
      ) : (
        <div className="cf-grid">
          {isCV ? <CandidateCVFields section={sec} row={data[sec.key] || {}} onChange={(field, value) => handleChange(sec.key, field, value)} /> : sec.fields.map((f) => (
            <FormField
              key={f.key}
              field={f}
              value={data[sec.key]?.[f.key]}
              onChange={(val) => handleChange(sec.key, f.key, val)}
              sectionKey={sec.key}
            />
          ))}
        </div>
      )}
    </section>
  );

  if (isCV && readonly && !busy) return (
    <main className="candidate-online-form cf-acknowledgement">
      <section className="cf-card" aria-labelledby="cv-submission-received">
        <h1 id="cv-submission-received">Submission received</h1>
        <p>{form.previouslySubmitted ? "This CV link has already received a submission." : "Thank you. Your CV has been submitted to HR successfully."}</p>
        <p>This link is now closed and cannot accept another submission.</p>
        <button type="button" onClick={closeCandidatePage}>Close page</button>
      </section>
    </main>
  );

  return (
    <div className="candidate-online-form">
      <header className="cf-brand">
        <a href="/" aria-label="Rejlers home">
          ◿REJLERS
        </a>
        <span>Candidate portal</span>
      </header>

      <main>
        {preview && (
          <div className="cf-template-toolbar">
            <nav aria-label="Choose form">
              {Object.entries(FORM_TITLES).map(([kind, title]) => (
                <button
                  key={kind}
                  type="button"
                  className={form?.kind === kind ? "" : "cf-secondary"}
                  disabled={busy}
                  aria-pressed={form?.kind === kind}
                  onClick={() => loadPreview(kind)}
                >
                  {title}
                </button>
              ))}
            </nav>
            <p>
              You are viewing the actual form template. Open your HR invitation link to save and
              submit your details.
            </p>
          </div>
        )}

        {!form ? (
          <section className="cf-access" aria-labelledby="access-heading">
            <div className="cf-eyebrow">REJLERS · HUMAN RESOURCES</div>
            <h1 id="access-heading">
              {verification ? "Verify your email" : "Candidate online forms"}
            </h1>

            {verification && (
              <>
                <p>
                  Pre-onboarding contains personal information. Verify access using a code sent to
                  your email address.
                </p>
                <button type="button" disabled={busy} onClick={() => verify(true)}>
                  Email verification code
                </button>
                <label>
                  Verification code
                  <input
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.trim())}
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || code.length !== 6}
                  onClick={() => verify(false)}
                >
                  Verify and open form
                </button>
              </>
            )}

            {busy && <p role="status">Opening your form…</p>}
            {error && (
              <p role="alert" className="cf-error">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="cf-notice">
                {notice}
              </p>
            )}
          </section>
        ) : (
          <>
            <div className="cf-title">
              <div className="cf-eyebrow">REJLERS · HUMAN RESOURCES</div>
              <h1>{form.title}</h1>
              {form.expires_at && (
                <p className="cf-expiry">
                  Expires:{" "}
                  <strong>
                    {new Date(form.expires_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </strong>{" "}
                  · Valid for 3 days from invitation creation
                </p>
              )}
              {!preview && form.position && (
                <p>
                  Position applied for: <strong>{form.position}</strong>{" "}
                  <span>
                    {form.location
                      ? `· ${form.location}`
                      : form.department
                      ? `· ${form.department}`
                      : ""}
                  </span>
                </p>
              )}
              <p className="cf-private">
                Your information is shared with authorized HR administrators.
              </p>
            </div>

            {isCV && <>
              <div className="cf-progress-panel"><div><strong>{progress}% Complete</strong><span aria-live="polite">{preview ? "Form preview" : busy ? "Working..." : saveStatus}</span></div><progress max="100" value={progress} aria-label="CV completion" /></div>
              <CandidateCVUploads session={session} attachments={attachments} onUpload={upload} onExtract={extract} disabled={busy || saving} preview={preview} readonly={readonly} />
              {notice && <p className="cf-notice" role="status">{notice}</p>}
            </>}

            {form.correction_note && (
              <div className="cf-correction">
                <strong>HR requested corrections</strong>
                <p>{form.correction_note}</p>
              </div>
            )}

            {readonly && (
              <div className="cf-notice" role="status">
                <strong>
                  {form.state === "verified" ? "Reviewed by HR" : "Submission received"}
                </strong>
                <p>
                  Version {form.version} · Your submitted information is saved. Contact HR if a
                  correction is needed.
                </p>
              </div>
            )}

            <div className="cf-layout">
              {!readonly && !fullPage && (
                <nav className="cf-steps" aria-label="Form sections">
                  {sections.map((item, index) => (
                    <button
                      key={item.key}
                      type="button"
                      aria-current={step === index ? "step" : undefined}
                      onClick={() => setStep(index)}
                    >
                      <span>{index + 1}</span>
                      {item.title}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-current={reviewing ? "step" : undefined}
                    onClick={() => setStep(sections.length)}
                  >
                    <span>✓</span>Review and submit
                  </button>
                </nav>
              )}

              <section className={`cf-card${readonly ? " cf-card-full" : ""}`}>
                {reviewing ? (
                  <>
                    <h2>
                      {readonly
                        ? "Your submitted form"
                        : preview
                        ? "Complete form overview"
                        : "Review your information"}
                    </h2>
                    {!readonly && (
                      <p>
                        Check every section before submitting. Select Back to make corrections.
                      </p>
                    )}
                    <CandidateFormView schema={form.schema} data={data} />
                  </>
                ) : fullPage ? (
                  sections.map((item, index) => renderSection(item, index))
                ) : (
                  currentSection && renderSection(currentSection, step)
                )}

                {reviewing && form.kind === "pre_onboarding" && !readonly && !preview && (
                  <section className="cf-email-confirm" aria-label="Confirm personal email">
                    <h3>Confirm your personal email</h3>
                    {form.verified_email && form.verified_email.toLowerCase() === (data.contact?.email || "").trim().toLowerCase() ? <p className="cf-notice">Email confirmed: {form.verified_email}</p> : <>
                      <p>Send a verification code to <strong>{data.contact?.email || "the personal email entered in your form"}</strong> before submitting.</p>
                      <button type="button" className="cf-secondary" disabled={busy || saving || !data.contact?.email} onClick={() => verifyFormEmail(true)}>Email verification code</button>
                      <label className="cf-field">Verification code<input autoComplete="one-time-code" inputMode="numeric" maxLength={6} value={code} onChange={event => setCode(event.target.value)} /></label>
                      <button type="button" disabled={busy || saving || code.length !== 6} onClick={() => verifyFormEmail(false)}>Confirm email</button>
                    </>}
                  </section>
                )}

                {error && (
                  <div className="cf-error" role="alert">
                    <span>{error}</span>
                    {error.includes("changed") && (
                      <button type="button" onClick={() => setReloadConfirmation(true)}>
                        Reload saved version
                      </button>
                    )}
                  </div>
                )}

                {!isCV && notice && (
                  <p className="cf-notice" role="status">
                    {notice}
                  </p>
                )}

                {reloadConfirmation && (
                  <div className="cf-correction">
                    <p>Reloading replaces unsaved changes in this tab with the saved version.</p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await load(session);
                          setError("");
                          setReloadConfirmation(false);
                        } catch (failure) {
                          setError(failure.message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Discard unsaved changes and reload
                    </button>
                    <button
                      type="button"
                      className="cf-secondary"
                      onClick={() => setReloadConfirmation(false)}
                    >
                      Keep editing
                    </button>
                  </div>
                )}

                <footer className="cf-footer">
                  {preview ? (
                    <>
                      <span>Form template</span>
                      <div>
                        {step > 0 && (
                          <button
                            type="button"
                            className="cf-secondary"
                            disabled={busy}
                            onClick={() => setStep((prev) => prev - 1)}
                          >
                            Back
                          </button>
                        )}
                        {!reviewing && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              setStep((prev) => (fullPage ? sections.length : prev + 1))
                            }
                          >
                            {fullPage ? "Review form" : "Continue"}
                          </button>
                        )}
                      </div>
                    </>
                  ) : readonly ? (
                    <button
                      type="button"
                      className="cf-secondary"
                      onClick={() => window.print()}
                    >
                      Print / Save as PDF
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="cf-secondary"
                        disabled={busy || saving}
                        onClick={() => { setSaveBlocked(false); save("save"); }}
                      >
                        {saving ? "Saving…" : "Save draft"}
                      </button>
                      <span aria-live="polite">
                        {saving ? "Saving..." : dirty ? "Unsaved changes" : "All changes saved"}
                      </span>
                      <div>
                        {step > 0 && (
                          <button
                            type="button"
                            className="cf-secondary"
                            disabled={busy}
                            onClick={() => setStep((prev) => prev - 1)}
                          >
                            Back
                          </button>
                        )}
                        {reviewing ? (
                          <button
                            type="button"
                            disabled={busy || saving || (form.kind === "pre_onboarding" && (!form.verified_email || form.verified_email.toLowerCase() !== (data.contact?.email || "").trim().toLowerCase()))}
                            onClick={() => save("submit")}
                          >
                            {busy ? "Submitting…" : "Submit to HR"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              setStep((prev) => (fullPage ? sections.length : prev + 1))
                            }
                          >
                            {fullPage ? "Review form" : "Continue"}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </footer>
              </section>
            </div>
          </>
        )}

        <footer className="cf-page-footer">
          Rejlers · Candidate CV and pre-onboarding information
        </footer>
      </main>
    </div>
  );
}
