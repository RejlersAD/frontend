import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { ArrowRight, Check, FileText, Folder, FolderPlus, Loader2, Lock, MessageCircle, Plus, Search, X } from "lucide-react";

// RADAI Intelligence > Add context > Add to project.
// General chats can move into a project (keeping messages and files); any chat can save its files as project knowledge.
export default function RadaiAddToProjectDialog({ projects, currentProject: currentProjectProp, hasConversation, hasMessages, chatFiles, onClose, onCreateProject, onSubmit, onOpenProject }) {
  // Keep the chat's project as it was when the dialog opened (a move changes it underneath us).
  const [currentProject] = useState(currentProjectProp);
  const editable = useMemo(() => projects.filter((row) => row.role === "owner" || row.role === "editor"), [projects]);
  const [query, setQuery] = useState("");
  const [targetId, setTargetId] = useState(() => String(editable.find((row) => String(row.id) !== String(currentProject?.id))?.id || ""));
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const canMove = hasConversation && !currentProject;
  const [move, setMove] = useState(canMove && hasMessages);
  const [fileIds, setFileIds] = useState(() => new Set(chatFiles.map((f) => f.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const visible = editable.filter((row) => !query.trim() || `${row.name} ${row.folder || ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  const target = editable.find((row) => String(row.id) === targetId);
  const nothingToAdd = !move && fileIds.size === 0;

  const create = async (event) => {
    event.preventDefault();
    if (!newName.trim()) return;
    setBusy(true); setError("");
    try {
      const row = await onCreateProject(newName.trim());
      setTargetId(String(row.id)); setCreating(false); setNewName("");
    } catch (exc) {
      setError(exc?.response?.data?.name?.[0] || exc?.response?.data?.detail || "The project could not be created.");
    } finally { setBusy(false); }
  };
  const submit = async () => {
    if (!target || nothingToAdd) return;
    setBusy(true); setError("");
    try {
      const result = await onSubmit(target, { move, attachment_ids: [...fileIds] });
      setDone(result);
    } catch (exc) {
      const data = exc?.response?.data || {};
      setError(data.detail || data.move?.[0] || data.workspace_id?.[0] || data.attachment_ids?.[0] || "The chat could not be added to the project.");
    } finally { setBusy(false); }
  };

  const savedCount = done?.documents?.filter((d) => !d.already_present).length || 0;
  const existingCount = done?.documents?.filter((d) => d.already_present).length || 0;

  return createPortal(
    <div className="radai-ai-portal fixed inset-0 z-[95] grid place-items-center bg-slate-950/45 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="add-project-title" className="flex max-h-[90vh] w-[min(620px,100%)] flex-col overflow-hidden rounded-2xl border border-[var(--ai-line)] bg-[var(--ai-surface)] text-[var(--ai-ink)] shadow-2xl">
        <header className="flex items-center gap-3 border-b border-[var(--ai-line)] px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--ai-soft)] text-[var(--ai-violet)]"><FolderPlus size={18} /></span>
          <div className="min-w-0 flex-1">
            <h2 id="add-project-title" className="text-base font-semibold">Add to project</h2>
            <p className="text-xs text-[var(--ai-muted)]">{currentProject ? `This chat is in ${currentProject.name}. You can save its files to another project's knowledge.` : "Keep this conversation and its files with a project."}</p>
          </div>
          <button type="button" className="radai-ai-icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </header>

        {done ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--rd-success-soft)] text-[var(--rd-success)]"><Check size={24} /></span>
            <h3 className="text-lg font-semibold">Added to {done.workspace_name}</h3>
            <ul className="space-y-1 text-sm text-[var(--ai-muted)]">
              {done.moved && <li>This chat now lives in the project and uses its instructions and knowledge.</li>}
              {savedCount > 0 && <li>{savedCount} file{savedCount === 1 ? "" : "s"} saved to the project&apos;s knowledge.</li>}
              {existingCount > 0 && <li>{existingCount} file{existingCount === 1 ? " was" : "s were"} already in the project.</li>}
            </ul>
            <div className="mt-3 flex gap-2">
              {!done.moved && <button type="button" className="rd-btn" onClick={() => onOpenProject(done.workspace_id)}>Open project<ArrowRight size={14} /></button>}
              <button type="button" className="radai-ai-new-chat !h-9 px-4" onClick={onClose}>{done.moved ? "Continue chatting" : "Done"}</button>
            </div>
          </div>
        ) : !hasConversation ? (
          <div className="space-y-3 px-5 py-5">
            <p className="text-sm text-[var(--ai-muted)]">There&apos;s nothing in this chat yet. Pick a project to start a new chat inside it instead.</p>
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {projects.map((row) => (
                <li key={row.id}><button type="button" onClick={() => onOpenProject(row.id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[var(--ai-soft-hover)]">
                  <Folder size={16} className="text-[var(--ai-violet)]" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{row.name}</span><MessageCircle size={14} className="text-[var(--ai-faint)]" />
                </button></li>
              ))}
              {!projects.length && <li className="text-sm text-[var(--ai-muted)]">You don&apos;t have any projects yet.</li>}
            </ul>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <section>
                <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--ai-faint)]">Project</h3>
                  {!creating && <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--ai-violet)] hover:underline" onClick={() => setCreating(true)}><Plus size={13} />New project</button>}</div>
                {creating && (
                  <form onSubmit={create} className="mb-2 flex gap-2">
                    <label htmlFor="add-project-name" className="sr-only">New project name</label>
                    <input id="add-project-name" autoFocus maxLength={160} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Project name" className="rd-input min-w-0 flex-1" />
                    <button type="submit" disabled={busy || !newName.trim()} className="radai-ai-new-chat !h-10 px-3">Create</button>
                    <button type="button" className="radai-ai-icon-btn !h-10 !w-10" aria-label="Cancel new project" onClick={() => setCreating(false)}><X size={15} /></button>
                  </form>
                )}
                {editable.length > 5 && (
                  <div className="relative mb-2"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ai-faint)]" />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a project" aria-label="Find a project" className="rd-input w-full !pl-8" /></div>
                )}
                <ul role="radiogroup" aria-label="Project" className="max-h-56 space-y-1 overflow-y-auto">
                  {visible.map((row) => {
                    const on = String(row.id) === targetId;
                    const same = String(row.id) === String(currentProject?.id);
                    return (
                      <li key={row.id}>
                        <button type="button" role="radio" aria-checked={on} onClick={() => setTargetId(String(row.id))}
                          className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${on ? "border-[var(--ai-focus)] bg-[var(--ai-soft)]" : "border-transparent hover:bg-[var(--ai-soft-hover)]"}`}>
                          <Folder size={16} className="shrink-0 text-[var(--ai-violet)]" />
                          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{row.name}</span>
                            <span className="block truncate text-[11px] text-[var(--ai-faint)]">{[row.role === "owner" ? "Owner" : "Editor", row.folder, same ? "this chat's project" : "", row.document_count != null ? `${row.document_count} files` : ""].filter(Boolean).join(" · ")}</span></span>
                          {on && <Check size={16} className="text-[var(--ai-violet)]" />}
                        </button>
                      </li>
                    );
                  })}
                  {!editable.length && <li className="rounded-xl border border-dashed border-[var(--ai-line-strong)] p-4 text-center text-sm text-[var(--ai-muted)]">You need to be an owner or editor of a project. Create one above.</li>}
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--ai-faint)]">What to add</h3>
                <label className={`flex items-start gap-3 rounded-xl border px-3 py-3 ${canMove ? "cursor-pointer border-[var(--ai-line)]" : "border-dashed border-[var(--ai-line)] opacity-70"}`}>
                  <input type="checkbox" className="mt-0.5 h-4 w-4" checked={move} disabled={!canMove} onChange={(e) => setMove(e.target.checked)} />
                  <span><span className="flex items-center gap-1.5 text-sm font-medium">{canMove ? <MessageCircle size={14} /> : <Lock size={14} />}Move this conversation into the project</span>
                    <span className="block text-xs text-[var(--ai-muted)]">{canMove ? "Messages and files come along. Future answers use the project's instructions and knowledge." : "Chats that already belong to a project stay there, so their citations keep working."}</span></span>
                </label>
                <div className="rounded-xl border border-[var(--ai-line)] px-3 py-3">
                  <div className="flex items-center gap-1.5 text-sm font-medium"><FileText size={14} />Save files to the project&apos;s knowledge</div>
                  <p className="text-xs text-[var(--ai-muted)]">Every chat in the project can then use them. Saving a newer copy of a file creates a new version.</p>
                  {chatFiles.length ? (
                    <ul className="mt-2 space-y-1">
                      {chatFiles.map((file) => (
                        <li key={file.id}><label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--ai-soft-hover)]">
                          <input type="checkbox" className="h-4 w-4" checked={fileIds.has(file.id)} onChange={(e) => setFileIds((prev) => { const next = new Set(prev); if (e.target.checked) next.add(file.id); else next.delete(file.id); return next; })} />
                          <span className="min-w-0 flex-1 truncate">{file.name}</span>
                        </label></li>
                      ))}
                    </ul>
                  ) : <p className="mt-2 text-xs text-[var(--ai-faint)]">This chat has no attached files.</p>}
                </div>
              </section>
              {error && <p role="alert" className="rounded-lg bg-[var(--rd-danger-soft)] px-3 py-2 text-xs text-[var(--rd-danger)]">{error}</p>}
            </div>
            <footer className="flex items-center justify-between gap-3 border-t border-[var(--ai-line)] px-5 py-3">
              <span className="truncate text-xs text-[var(--ai-muted)]">{target ? `To ${target.name}` : "Choose a project"}</span>
              <div className="flex gap-2">
                <button type="button" className="rd-btn" onClick={onClose}>Cancel</button>
                <button type="button" disabled={busy || !target || nothingToAdd} onClick={submit} className="radai-ai-new-chat !h-9 px-4 disabled:opacity-50">
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <FolderPlus size={15} />}Add to project
                </button>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

RadaiAddToProjectDialog.propTypes = {
  projects: PropTypes.arrayOf(PropTypes.object).isRequired, currentProject: PropTypes.object,
  hasConversation: PropTypes.bool, hasMessages: PropTypes.bool,
  chatFiles: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), name: PropTypes.string })).isRequired,
  onClose: PropTypes.func.isRequired, onCreateProject: PropTypes.func.isRequired, onSubmit: PropTypes.func.isRequired, onOpenProject: PropTypes.func.isRequired,
};
