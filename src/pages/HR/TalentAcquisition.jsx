import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  BriefcaseIcon,
  ChartBarIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  DocumentTextIcon,
  EllipsisVerticalIcon,
  EnvelopeIcon,
  EyeIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  PlusIcon,
  AcademicCapIcon,
  TableCellsIcon,
  UserGroupIcon,
  UserIcon,
  UserPlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { talentAcquisitionService as service } from "../../services/talentAcquisition.service";
import "./TalentAcquisition.css";
import CandidateFormsWorkspace from "./CandidateFormsWorkspace";
import CandidateSubmissionReview from "./CandidateSubmissionReview";
import CareersPositionSync from "./CareersPositionSync";

const stages = [
  "Invited",
  "Applied",
  "Interview",
  "Selected",
  "Pending docs",
  "Rejected",
];
const blank = {
  name: "",
  email: "",
  position: "",
  department: "",
  status: "Applied",
  mobile: "",
  nationality: "",
  education: "",
  experience: "",
  skills: "",
  interview_notes: "",
  interview_outcome: "",
};
const errorText = (error) => {
  if (error?.response?.status === 403)
    return "HR permission is required to access this recruitment register.";
  const data = error?.response?.data;
  return (
    data?.detail ||
    (data && typeof data === "object"
      ? Object.entries(data)
          .map(
            ([key, value]) =>
              `${key}: ${Array.isArray(value) ? value.join(" ") : String(value)}`,
          )
          .join(" · ")
      : "") ||
    error?.message ||
    "Unable to load recruitment records. Please retry."
  );
};
const initials = (name) =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
const tone = (status) => status.toLowerCase().replaceAll(" ", "-");
const dateText = (value) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      className="ta-dialog"
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="ta-modal-heading">
        <h2>{title}</h2>
        <button
          type="button"
          className="ta-icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <XMarkIcon />
        </button>
      </div>
      {children}
    </dialog>
  );
}
Modal.propTypes = {
  title: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node,
};

function Avatar({ name, candidateId, photo, large = false }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    setUrl("");
    if (!photo?.id || !candidateId) return;
    let active = true, objectUrl;
    service.candidatePhoto(candidateId).then(blob => {
      if (active) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }
    }).catch(() => {});
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [candidateId, photo?.id]);
  return (
    <span
      className={`ta-avatar${large ? " ta-avatar-large" : ""}`}
      aria-hidden="true"
    >
      {url ? <img src={url} alt="" onError={() => setUrl("")} /> : initials(name)}
    </span>
  );
}
Avatar.propTypes = { name: PropTypes.string, candidateId: PropTypes.number, photo: PropTypes.object, large: PropTypes.bool };

function Section({ title, icon: Icon, children }) {
  return (
    <section className="ta-detail-section">
      <h3>
        <Icon />
        {title}
      </h3>
      {children}
    </section>
  );
}
Section.propTypes = {
  title: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  children: PropTypes.node,
};

export default function TalentAcquisition() {
  const [candidates, setCandidates] = useState([]);
  const [openings, setOpenings] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const detailBodyRef = useRef(null);
  useEffect(() => {
    if (detailBodyRef.current) detailBodyRef.current.scrollTop = 0;
  }, [selectedId]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("");
  const [status, setStatus] = useState("");
  const [department, setDepartment] = useState("");
  const [page, setPage] = useState(1);
  const [columns, setColumns] = useState({ position: true, status: true });
  const [columnMenu, setColumnMenu] = useState(false);
  const [rowMenu, setRowMenu] = useState(null);
  const [modal, setModal] = useState(null);
  const [draft, setDraft] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [documentPreview, setDocumentPreview] = useState(null);
  const [documentError, setDocumentError] = useState("");
  const [documentBusy, setDocumentBusy] = useState(null);
  useEffect(() => () => {
    if (documentPreview?.url) URL.revokeObjectURL(documentPreview.url);
  }, [documentPreview]);
  const openDocument = async (file, preview = false) => {
    setDocumentBusy(file.id); setDocumentError("");
    try {
      const blob = await service.formAttachment(file.invitation, file.id);
      const url = URL.createObjectURL(blob);
      if (preview) { setDocumentPreview({url, name: file.name, contentType: file.content_type}); setModal("document-preview"); }
      else { const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch (failure) { setDocumentError(errorText(failure)); }
    finally { setDocumentBusy(null); }
  };
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [people, jobs] = await Promise.all([
        service.candidates(),
        service.openings(),
      ]);
      setCandidates(people);
      setOpenings(jobs);
      setLoaded(true);
      setSelectedId((previous) =>
        people.some((person) => person.id === previous)
          ? previous
          : (people.find((person) => person.status === "Selected") || people[0])
              ?.id || null,
      );
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const selected = candidates.find((candidate) => candidate.id === selectedId);
  const options = (key) =>
    [
      ...new Set(candidates.map((candidate) => candidate[key]).filter(Boolean)),
    ].sort();
  const filtered = useMemo(
    () =>
      candidates.filter(
        (candidate) =>
          `${candidate.name} ${candidate.email} ${candidate.position}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (!position || candidate.position === position) &&
          (!status || candidate.status === status) &&
          (!department || candidate.department === department),
      ),
    [candidates, query, position, status, department],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 7));
  const currentPage = Math.min(page, pages);
  const rows = filtered.slice((currentPage - 1) * 7, currentPage * 7);
  const metrics = [
    {
      label: "Open Jobs",
      count: openings.filter((job) => job.is_open).length,
      icon: BriefcaseIcon,
      action: () => {
        setDraft({ title: "", department: "", is_open: true });
        setSaveError("");
        setModal("openings");
      },
    },
    { label: "Invited", stage: "Invited", icon: EnvelopeIcon },
    { label: "Applied", stage: "Applied", icon: DocumentTextIcon },
    { label: "Selected", stage: "Selected", icon: UserGroupIcon },
    { label: "Pending Docs", stage: "Pending docs", icon: DocumentTextIcon },
  ];
  const edit = (candidate) => {
    setDraft(
      candidate
        ? Object.fromEntries(
            Object.keys(blank).map((key) => [
              key,
              candidate[key] || blank[key],
            ]),
          )
        : { ...blank },
    );
    setEditingId(candidate?.id || null);
    setSaveError("");
    setRowMenu(null);
    setModal("candidate");
  };
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSaveError("");
    try {
      if (modal === "candidate") {
        const saved = await service.saveCandidate(draft, editingId);
        setCandidates((previous) =>
          editingId
            ? previous.map((candidate) =>
                candidate.id === saved.id ? saved : candidate,
              )
            : [saved, ...previous],
        );
        setSelectedId(saved.id);
        setPage(1);
        setQuery("");
        setPosition("");
        setStatus("");
        setDepartment("");
        setModal(null);
      } else {
        const saved = await service.saveOpening(draft);
        setOpenings((previous) => [...previous, saved]);
        setDraft({ title: "", department: "", is_open: true });
      }
    } catch (failure) {
      setSaveError(errorText(failure));
    } finally {
      setSaving(false);
    }
  };
  const toggleOpening = async (job) => {
    setSaving(true);
    setSaveError("");
    try {
      const saved = await service.saveOpening(
        { is_open: !job.is_open },
        job.id,
      );
      setOpenings((previous) =>
        previous.map((item) => (item.id === saved.id ? saved : item)),
      );
    } catch (failure) {
      setSaveError(errorText(failure));
    } finally {
      setSaving(false);
    }
  };
  const filter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };
  return (
    <div
      className="talent-acquisition"
      data-table-typography="preserve"
      aria-busy={loading}
    >
      <header className="ta-heading">
        <h1>Talent Acquisition</h1>
        <div className="ta-actions">
          <button
            className="ta-button ta-primary"
            onClick={() => edit()}
            disabled={!loaded || loading}
          >
            <PlusIcon />
            New Candidate
          </button>
          <button
            className="ta-button ta-outline"
            onClick={() => setModal("invitation")}
          >
            <LinkIcon />
            Create invitation link
          </button>
        </div>
      </header>
      {error && <div role="alert" className="ta-error">{error} 
        <button className="ta-button" disabled={loading} onClick={load}>Retry</button></div>}
      <section className="ta-metrics" aria-label="Recruitment summary">
        {metrics.map(({ label, stage, count, icon: Icon, action }) => (
          <button
            key={label}
            className="ta-metric"
            disabled={!loaded || loading}
            onClick={
              action ||
              (() => {
                setStatus(stage);
                setPage(1);
              })
            }
          >
            <span className="ta-metric-icon">
              <Icon />
            </span>
            <span>
              <span className="ta-metric-label">{label}</span>
              <strong>
                {loaded
                  ? (count ??
                    candidates.filter((candidate) => candidate.status === stage)
                      .length)
                  : "—"}
              </strong>
            </span>
          </button>
        ))}
      </section>
      <div className={`ta-workspace${selected ? "" : " ta-without-selection"}`}>
        <section className="ta-register" aria-label="Candidate list">
          <header className="ta-register-heading">
            <h2>
              Candidate List <span>({filtered.length})</span>
            </h2>
            <label className="ta-search ta-list-search">
              <MagnifyingGlassIcon aria-hidden="true" />
              <input type="search" aria-label="Search candidates" placeholder="Search candidates..." value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} />
            </label>
            <div className="ta-column-wrap">
              <button
                className="ta-button ta-columns"
                aria-expanded={columnMenu}
                onClick={() => setColumnMenu((value) => !value)}
              >
                <TableCellsIcon />
                Columns
                <ChevronDownIcon />
              </button>
              {columnMenu && (
                <div className="ta-column-menu">
                  {Object.keys(columns).map((key) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={columns[key]}
                        onChange={() =>
                          setColumns((previous) => ({
                            ...previous,
                            [key]: !previous[key],
                          }))
                        }
                      />
                      {key[0].toUpperCase() + key.slice(1)}
                    </label>
                  ))}
                  <button onClick={() => setColumnMenu(false)}>Done</button>
                </div>
              )}
            </div>
          </header>
          <div className="ta-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  {columns.position && <th>Position</th>}
                  {columns.status && <th>Status</th>}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((candidate) => (
                  <tr
                    key={candidate.id}
                    className={
                      selectedId === candidate.id ? "ta-row-selected" : ""
                    }
                  >
                    <td>
                      <button
                        className="ta-person"
                        onClick={() => setSelectedId(candidate.id)}
                        aria-label={`View ${candidate.name}`}
                        aria-pressed={selectedId === candidate.id}
                      >
                        <Avatar name={candidate.name} candidateId={candidate.id} photo={candidate.photo} />
                        <span>
                          <strong>{candidate.name}</strong>
                          <small>{candidate.email}</small>
                        </span>
                      </button>
                    </td>
                    {columns.position && <td>{candidate.position}</td>}
                    {columns.status && (
                      <td>
                        <span
                          className={`ta-badge ta-${tone(candidate.status)}`}
                        >
                          {candidate.status}
                        </span>
                      </td>
                    )}
                    <td>
                      <div className="ta-row-actions">
                        <button onClick={() => setSelectedId(candidate.id)}>
                          View
                        </button>
                        <button
                          onClick={() =>
                            candidate.status === "Selected"
                              ? (setSelectedId(candidate.id),
                                setModal("convert"))
                              : edit(candidate)
                          }
                        >
                          {candidate.status === "Selected" ? "Convert" : "Edit"}
                        </button>
                        <div className="ta-row-menu-wrap">
                          <button
                            className="ta-icon-button"
                            aria-label={`More actions for ${candidate.name}`}
                            aria-expanded={rowMenu === candidate.id}
                            onClick={() =>
                              setRowMenu(
                                rowMenu === candidate.id ? null : candidate.id,
                              )
                            }
                          >
                            <EllipsisVerticalIcon />
                          </button>
                          {rowMenu === candidate.id && (
                            <div className="ta-row-menu">
                              <button onClick={() => edit(candidate)}>
                                Edit candidate
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedId(candidate.id);
                                  setModal("form-review");
                                  setRowMenu(null);
                                }}
                              >
                                Review submitted forms
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td
                      className="ta-empty"
                      colSpan={
                        2 + Number(columns.position) + Number(columns.status)
                      }
                    >
                      <UserGroupIcon />
                      <strong>
                        {loading
                          ? "Loading candidates…"
                          : error && !loaded
                            ? "Candidate register unavailable"
                            : candidates.length
                              ? "No matching candidates"
                              : "Your candidate register is ready"}
                      </strong>
                      <p>
                        {!loading &&
                          !error &&
                          (candidates.length
                            ? "Try a different search or filter."
                            : "Add your first candidate to begin recruitment.")}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <footer className="ta-pagination">
            <span>
              {filtered.length
                ? `${(currentPage - 1) * 7 + 1} – ${Math.min(currentPage * 7, filtered.length)}`
                : "0"}{" "}
              of {filtered.length} candidates
            </span>
            <nav aria-label="Candidate pagination">
              <button
                className="ta-page-arrow"
                aria-label="Previous page"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeftIcon />
              </button>
              {Array.from({ length: pages }, (_, index) => index + 1)
                .filter(
                  (number) =>
                    number === 1 ||
                    number === pages ||
                    Math.abs(number - currentPage) <= 1,
                )
                .map((number, index, visible) => (
                  <span key={number}>
                    {index > 0 && number - visible[index - 1] > 1 && (
                      <span className="ta-ellipsis">…</span>
                    )}
                    <button
                      aria-current={currentPage === number ? "page" : undefined}
                      onClick={() => setPage(number)}
                    >
                      {number}
                    </button>
                  </span>
                ))}
              <button
                className="ta-page-arrow"
                aria-label="Next page"
                disabled={currentPage === pages}
                onClick={() => setPage(currentPage + 1)}
              >
                <ChevronRightIcon />
              </button>
            </nav>
          </footer>
        </section>
        {selected && (
          <aside
            className="ta-detail"
            aria-label={`Candidate details: ${selected.name}`}
          >
            <header className="ta-detail-heading">
              <Avatar name={selected.name} candidateId={selected.id} photo={selected.photo} large />
              <div>
                <h2>{selected.name}</h2>
                <p>{selected.position || selected.cv_details?.current_position || "General application"}</p>
                <span className={`ta-badge ta-${tone(selected.status)}`}>
                  {selected.status}
                </span>
                <p className="ta-reference">Ref: {selected.reference}</p>
              </div>
              <button
                className="ta-icon-button ta-close"
                aria-label="Close candidate details"
                onClick={() => setSelectedId(null)}
              >
                <XMarkIcon />
              </button>
            </header>
            <div className="ta-detail-body" ref={detailBodyRef} tabIndex={0} role="region" aria-label="Candidate information">
              <div className="ta-detail-left">
                <Section title="Personal Information" icon={UserIcon}>
                  <dl>
                    {[
                      ["Full Name", selected.name],
                      ["Position Applied", selected.position],
                      ["Nationality", selected.nationality],
                      ...(selected.cv_details?.current_position ? [["Current Position", selected.cv_details.current_position]] : []),
                      ...(selected.cv_details?.current_department ? [["Current Department", selected.cv_details.current_department]] : []),
                      ...(selected.cv_details?.birth_year ? [["Year of Birth", selected.cv_details.birth_year]] : []),
                      ["Email", selected.email],
                      ["Mobile", selected.mobile],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value || "Not provided"}</dd>
                      </div>
                    ))}
                  </dl>
                </Section>
                <Section title="Education" icon={AcademicCapIcon}>
                  <p>{selected.education || "Not provided"}</p>
                </Section>
                <Section title="Experience" icon={BriefcaseIcon}>
                  <p>{selected.experience || "Not provided"}</p>
                </Section>
                {!!selected.cv_details?.languages?.length && <Section title="Languages" icon={AcademicCapIcon}><p>{selected.cv_details.languages.map(row => [row.language, row.proficiency].filter(Boolean).join(" · ")).join("\n")}</p></Section>}
                {selected.cv_details?.achievements && <Section title="Key Achievements" icon={ChartBarIcon}><p>{selected.cv_details.achievements}</p></Section>}
                {selected.cv_details?.certifications && <Section title="Certifications" icon={AcademicCapIcon}><p>{selected.cv_details.certifications}</p></Section>}
                <Section title="Skills" icon={ChartBarIcon}>
                  <div className="ta-skills">
                    {selected.skills ? (
                      selected.skills
                        .split(",")
                        .map((skill) => skill.trim())
                        .filter(Boolean)
                        .map((skill, index) => (
                          <span key={`${skill}-${index}`}>{skill}</span>
                        ))
                    ) : (
                      <p>Not provided</p>
                    )}
                  </div>
                </Section>
              </div>
              <div className="ta-detail-right">
                <Section title="Documents" icon={DocumentTextIcon}>
                  {selected.documents?.length ? <div className="ta-documents">{selected.documents.map(file => <div className="ta-document" key={file.id}>
                    <DocumentTextIcon /><div><strong>{file.name}</strong><small>{file.kind === "photo" ? "Professional photo" : "Submitted CV"} · {Math.ceil(file.size / 1024)} KB</small></div>
                    {(file.content_type === "application/pdf" || file.content_type?.startsWith("image/")) && <button className="ta-icon-button" aria-label={`Preview ${file.name}`} disabled={documentBusy === file.id} onClick={() => openDocument(file, true)}><EyeIcon /></button>}
                    <button className="ta-icon-button" aria-label={`Download ${file.name}`} disabled={documentBusy === file.id} onClick={() => openDocument(file)}><ArrowDownTrayIcon /></button>
                  </div>)}</div> : <div className="ta-document-empty"><DocumentTextIcon /><span>No submitted documents</span></div>}
                  {!!selected.submitted_forms?.length && <button className="ta-button ta-view-submission" onClick={() => setModal("form-review")}>View complete submitted form</button>}
                  {documentError && <p className="ta-error" role="alert">{documentError}</p>}
                </Section>
                <Section title="Interview Notes" icon={DocumentTextIcon}>
                  <div className="ta-notes">
                    {selected.interview_notes || "No interview notes recorded."}
                  </div>
                </Section>
                <Section title="Activities Timeline" icon={ClockIcon}>
                  <ol className="ta-timeline">
                    {selected.timeline?.length ? (
                      selected.timeline.map((event, index) => (
                        <li key={`${event.date}-${index}`}>
                          <span>{event.label}</span>
                          <small>{dateText(event.date)}</small>
                        </li>
                      ))
                    ) : (
                      <li>
                        <span>Candidate created</span>
                        <small>{dateText(selected.created_at)}</small>
                      </li>
                    )}
                  </ol>
                </Section>
              </div>
            </div>
            <footer className="ta-detail-footer">
              <button className="ta-button" onClick={() => edit(selected)}>
                <PencilIcon />
                Edit candidate
              </button>
              <button
                className="ta-button ta-primary"
                disabled={selected.status !== "Selected"}
                onClick={() => setModal("convert")}
              >
                <UserPlusIcon />
                Convert to Employee
              </button>
            </footer>
          </aside>
        )}
      </div>
      {modal === "candidate" && (
        <Modal
          title={editingId ? "Edit candidate" : "New Candidate"}
          onClose={() => {
            if (!saving) setModal(null);
          }}
        >
          <form onSubmit={save}>
            <div className="ta-form-grid">
              {[
                ["name", "Full name", true],
                ["email", "Email", true],
                ["position", "Position applied", true],
                ["department", "Department", true],
                ["mobile", "Mobile"],
                ["nationality", "Nationality"],
              ].map(([key, label, required]) => (
                <label key={key}>
                  {label}
                  {required && " *"}
                  <input
                    list={key === "position" ? "ta-open-positions" : undefined}
                    required={required}
                    maxLength={
                      key === "mobile"
                        ? 40
                        : key === "nationality"
                          ? 100
                          : key === "email"
                            ? 254
                            : 200
                    }
                    type={
                      key === "email"
                        ? "email"
                        : key === "mobile"
                          ? "tel"
                          : "text"
                    }
                    value={draft[key]}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        [key]: event.target.value,
                      }))
                    }
                  />
                </label>
              ))}
              <datalist id="ta-open-positions">
                {openings
                  .filter((job) => job.is_open)
                  .map((job) => (
                    <option key={job.id} value={job.title}>
                      {job.department}
                    </option>
                  ))}
              </datalist>
              <label>
                Status
                <select
                  value={draft.status}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      status: event.target.value,
                    }))
                  }
                >
                  {stages.map((stage) => (
                    <option key={stage}>{stage}</option>
                  ))}
                </select>
              </label>
              <label>
                Skills (separate with commas)
                <input
                  maxLength={1000}
                  value={draft.skills}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      skills: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Interview outcome
                <select
                  aria-label="Interview outcome"
                  value={draft.interview_outcome}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      interview_outcome: event.target.value,
                    }))
                  }
                >
                  <option value="">Not recorded</option>
                  <option value="suitable">Suitable for pre-onboarding</option>
                  <option value="not_proceeding">Not proceeding</option>
                </select>
              </label>
              {[
                ["education", "Education"],
                ["experience", "Experience"],
                ["interview_notes", "Interview notes"],
              ].map(([key, label]) => (
                <label className="ta-form-wide" key={key}>
                  {label}
                  <textarea
                    maxLength={key === "interview_notes" ? 8000 : 4000}
                    value={draft[key]}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        [key]: event.target.value,
                      }))
                    }
                  />
                </label>
              ))}
            </div>
            {saveError && (
              <p role="alert" className="ta-error">
                {saveError}
              </p>
            )}
            <div className="ta-modal-footer">
              <button
                type="button"
                className="ta-button"
                onClick={() => setModal(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button className="ta-button ta-primary" disabled={saving}>
                {saving ? "Saving…" : "Save candidate"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === "openings" && (
        <Modal
          title="Open positions"
          onClose={() => {
            if (!saving) setModal(null);
          }}
        >
          <CareersPositionSync onSynced={load} />
          <div className="ta-opening-list">
            {openings.length ? (
              openings.map((job) => (
                <div key={job.id}>
                  <span>
                    <strong>{job.title}</strong>
                    <small>
                      {job.location ||
                        job.department ||
                        "Department not assigned"}{" "}
                      · {job.is_open ? "Open" : "Closed"}
                    </small>
                  </span>
                  {job.source === "rejlers_careers" ? (
                    <a
                      className="ta-button"
                      href={job.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View vacancy
                    </a>
                  ) : (
                    <button
                      className="ta-button"
                      disabled={saving}
                      onClick={() => toggleOpening(job)}
                    >
                      {job.is_open ? "Close position" : "Reopen"}
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p>No positions recorded.</p>
            )}
          </div>
          <form onSubmit={save}>
            <h3>Add position</h3>
            <div className="ta-form-grid">
              <label>
                Job title *
                <input
                  required
                  maxLength={200}
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      title: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Department *
                <input
                  required
                  maxLength={200}
                  value={draft.department}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      department: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            {saveError && (
              <p className="ta-error" role="alert">
                {saveError}
              </p>
            )}
            <div className="ta-modal-footer">
              <button className="ta-button ta-primary" disabled={saving}>
                {saving ? "Saving…" : "Add position"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === "invitation" && (
        <Modal title="Create invitation link" onClose={() => setModal(null)}>
          <CandidateFormsWorkspace />
        </Modal>
      )}
      {modal === "form-review" && selectedId && (
        <Modal title="Submitted candidate forms" onClose={() => setModal(null)}>
          <CandidateSubmissionReview candidateId={selectedId} />
        </Modal>
      )}
      {modal === "document-preview" && documentPreview && <Modal title={documentPreview.name} onClose={() => {setModal(null); setDocumentPreview(null);}}><div className="ta-file-preview">{documentPreview.contentType.startsWith("image/") ? <img src={documentPreview.url} alt={documentPreview.name} /> : <iframe title={documentPreview.name} src={documentPreview.url} />}</div></Modal>}
      {modal === "convert" && (
        <Modal title="Convert to Employee" onClose={() => setModal(null)}>
          <div className="ta-workflow-message">
            <span className="ta-metric-icon">
              <UserPlusIcon />
            </span>
            <h3>Employee handoff</h3>
            <p>
              {selected?.name || "This candidate"} remains a candidate. After HR
              verifies pre-onboarding information, employee creation continues
              through the existing HR onboarding process.
            </p>
            <p>No employee account or payroll record has been created.</p>
          </div>
          <div className="ta-modal-footer">
            <button
              className="ta-button ta-primary"
              onClick={() => setModal(null)}
            >
              Done
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
