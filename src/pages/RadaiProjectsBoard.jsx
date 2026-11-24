import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  Archive, Check, Clock, FileText, Folder, FolderPlus, Lock, MessageCircle, MoreHorizontal,
  Pencil, Plus, Search, Settings2, Sparkles, Users, X,
} from "lucide-react";

// RADAI Intelligence > Projects: a full-width board of AI project cards with filters and quick actions.
const SCOPES = [["all", "All"], ["mine", "Mine"], ["shared", "Shared with me"]];
const SORTS = [["recent", "Recently active"], ["name", "Name (A–Z)"], ["docs", "Most documents"]];
const TILE_TONES = [
  "from-violet-500 to-indigo-700", "from-sky-500 to-blue-700", "from-emerald-500 to-teal-700",
  "from-amber-500 to-orange-600", "from-rose-500 to-pink-700", "from-cyan-500 to-sky-700",
];

const tone = (id) => TILE_TONES[Number(id) % TILE_TONES.length];
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "P";
const ago = (iso) => {
  if (!iso) return "";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
};
const ROLE_LABEL = { owner: "Owner", editor: "Editor", viewer: "Viewer" };

function ProjectCard({ row, busy, onOpenChat, onOpenSettings, onRename, onArchive }) {
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [value, setValue] = useState(row.name);
  const menuRef = useRef(null);
  const owner = row.role === "owner";

  useEffect(() => {
    if (!menu) return undefined;
    const close = (event) => { if (!menuRef.current?.contains(event.target)) setMenu(false); };
    const esc = (event) => { if (event.key === "Escape") { event.preventDefault(); setMenu(false); } };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [menu]);

  return (
    <li className="radai-project-card group relative flex flex-col rounded-2xl border border-[var(--ai-line)] bg-[var(--ai-surface)] p-4 transition-shadow hover:shadow-[0_10px_28px_var(--ai-shadow-soft)]">
      <div className="flex items-start gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${tone(row.id)} text-sm font-bold text-white shadow-sm`} aria-hidden="true">{initials(row.name)}</span>
        <div className="min-w-0 flex-1">
          {renaming ? (
            <form className="flex gap-1" onSubmit={async (event) => { event.preventDefault(); if (await onRename(row, value)) setRenaming(false); }}>
              <label htmlFor={`rename-${row.id}`} className="sr-only">Project name</label>
              <input id={`rename-${row.id}`} autoFocus maxLength={160} value={value} onChange={(event) => setValue(event.target.value)} className="rd-input min-w-0 flex-1 !py-1 text-sm" />
              <button type="submit" className="radai-ai-icon-btn" aria-label="Save name" disabled={busy || !value.trim()}><Check size={15} /></button>
              <button type="button" className="radai-ai-icon-btn" aria-label="Cancel rename" onClick={() => { setRenaming(false); setValue(row.name); }}><X size={15} /></button>
            </form>
          ) : (
            <button type="button" onClick={() => onOpenChat(row)} className="block w-full truncate text-left text-[15px] font-semibold text-[var(--ai-ink)] hover:text-[var(--ai-violet)]">{row.name}</button>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded-full bg-[var(--ai-soft)] px-2 py-0.5 font-medium text-[var(--ai-purple)]">{ROLE_LABEL[row.role] || row.role}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--ai-line)] px-2 py-0.5 text-[var(--ai-muted)]">
              {row.visibility === "shared" ? <Users size={11} /> : <Lock size={11} />}{row.visibility === "shared" ? "Shared" : "Private"}
            </span>
            {row.folder && <span className="inline-flex items-center gap-1 rounded-full border border-[var(--ai-line)] px-2 py-0.5 text-[var(--ai-muted)]"><Folder size={11} />{row.folder}</span>}
          </div>
        </div>
        <div className="relative" ref={menuRef}>
          <button type="button" className="radai-ai-icon-btn" aria-label={`Actions for ${row.name}`} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((open) => !open)}><MoreHorizontal size={17} /></button>
          {menu && (
            <div role="menu" className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-xl border border-[var(--ai-line)] bg-[var(--ai-surface)] py-1 text-sm shadow-[0_12px_32px_var(--ai-shadow-menu)]">
              <button role="menuitem" type="button" className="radai-project-menu-item" onClick={() => { setMenu(false); onOpenChat(row); }}><MessageCircle size={15} />New chat in project</button>
              <button role="menuitem" type="button" className="radai-project-menu-item" onClick={() => { setMenu(false); onOpenSettings(row); }}><Settings2 size={15} />Open project</button>
              {owner && <button role="menuitem" type="button" className="radai-project-menu-item" onClick={() => { setMenu(false); setRenaming(true); }}><Pencil size={15} />Rename</button>}
              {owner && <button role="menuitem" type="button" className="radai-project-menu-item text-[var(--rd-danger)]" onClick={() => { setMenu(false); setConfirming(true); }}><Archive size={15} />Archive</button>}
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-[13px] leading-5 text-[var(--ai-muted)]">{row.description || "No description yet."}</p>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[[FileText, row.document_count, "files"], [Users, row.member_count, "people"], [MessageCircle, row.my_chat_count, "your chats"]].map(([Icon, n, text]) => (
          <div key={text} className="rounded-lg bg-[var(--ai-surface-subtle)] px-2 py-1.5">
            <div className="flex items-center justify-center gap-1 text-sm font-semibold text-[var(--ai-ink)]"><Icon size={13} className="text-[var(--ai-faint)]" />{n ?? "–"}</div>
            <div className="text-[11px] text-[var(--ai-faint)]">{text}</div>
          </div>
        ))}
      </div>

      {confirming ? (
        <div className="mt-3 rounded-lg border border-[var(--rd-danger)]/40 bg-[var(--rd-danger-soft)] p-2.5 text-xs">
          <p className="text-[var(--ai-ink)]">Archive “{row.name}”? It disappears for everyone it&apos;s shared with.</p>
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={busy} onClick={async () => { if (await onArchive(row)) setConfirming(false); }} className="rounded-md bg-[var(--rd-danger)] px-2.5 py-1 font-medium text-white">Archive</button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded-md px-2.5 py-1 text-[var(--ai-muted)] hover:bg-[var(--ai-soft-hover)]">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-[var(--ai-faint)]">
          <Clock size={12} /><span className="truncate">Active {ago(row.last_activity || row.updated_at)}{row.role !== "owner" && row.owner_name ? ` · by ${row.owner_name}` : ""}</span>
          <button type="button" onClick={() => onOpenChat(row)} className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--ai-soft)] px-2.5 py-1 font-medium text-[var(--ai-purple)] opacity-100 transition-opacity hover:bg-[var(--ai-soft-nav)] lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
            <Sparkles size={12} />Chat
          </button>
        </div>
      )}
    </li>
  );
}
ProjectCard.propTypes = {
  row: PropTypes.object.isRequired, busy: PropTypes.bool,
  onOpenChat: PropTypes.func.isRequired, onOpenSettings: PropTypes.func.isRequired,
  onRename: PropTypes.func.isRequired, onArchive: PropTypes.func.isRequired,
};

export default function RadaiProjectsBoard({ projects, loading, busy, onCreate, onOpenChat, onOpenSettings, onRename, onArchive }) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", folder: "", visibility: "private" });
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("all");
  const [folder, setFolder] = useState("");
  const [sort, setSort] = useState("recent");

  const folders = useMemo(() => [...new Set(projects.map((row) => row.folder).filter(Boolean))].sort(), [projects]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = projects.filter((row) =>
      (scope === "all" || (scope === "mine" ? row.role === "owner" : row.role !== "owner"))
      && (!folder || row.folder === folder)
      && (!needle || `${row.name} ${row.description || ""} ${row.folder || ""}`.toLowerCase().includes(needle)));
    const by = {
      recent: (a, b) => new Date(b.last_activity || b.updated_at) - new Date(a.last_activity || a.updated_at),
      name: (a, b) => a.name.localeCompare(b.name),
      docs: (a, b) => (b.document_count || 0) - (a.document_count || 0),
    }[sort];
    return [...rows].sort(by);
  }, [projects, query, scope, folder, sort]);
  const counts = { all: projects.length, mine: projects.filter((r) => r.role === "owner").length, shared: projects.filter((r) => r.role !== "owner").length };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    if (await onCreate({ ...form, name: form.name.trim() })) {
      setForm({ name: "", description: "", folder: "", visibility: "private" });
      setCreating(false);
    }
  };

  return (
    <div className="radai-projects mx-auto w-full max-w-[1400px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ai-ink)]">Projects</h1>
          <p className="mt-1 text-sm text-[var(--ai-muted)]">Workspaces with their own instructions, files and team access. Chats in a project use its knowledge.</p>
        </div>
        <button type="button" onClick={() => setCreating((open) => !open)} className="radai-ai-new-chat !h-10 px-4" aria-expanded={creating}>
          {creating ? <X size={16} /> : <FolderPlus size={16} />}{creating ? "Close" : "New project"}
        </button>
      </div>

      {creating && (
        <form onSubmit={submit} className="mt-5 rounded-2xl border border-[var(--ai-line)] bg-[var(--ai-surface)] p-5 shadow-[0_10px_28px_var(--ai-shadow-soft)]">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="ai-name" className="mb-1 block text-xs font-semibold text-[var(--ai-muted)]">Project name</label>
              <input id="ai-name" required autoFocus maxLength={160} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Piping specification assistant" className="rd-input w-full" />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="ai-desc" className="mb-1 block text-xs font-semibold text-[var(--ai-muted)]">What will it help with?</label>
              <textarea id="ai-desc" maxLength={4000} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Answer questions about Unit 100 P&IDs, line lists and CRS comments" className="rd-input w-full" />
            </div>
            <div>
              <label htmlFor="ai-folder" className="mb-1 block text-xs font-semibold text-[var(--ai-muted)]">Folder (optional)</label>
              <input id="ai-folder" list="ai-folder-options" maxLength={120} value={form.folder} onChange={(e) => setForm({ ...form, folder: e.target.value })} placeholder="Process" className="rd-input w-full" />
              <datalist id="ai-folder-options">{folders.map((f) => <option key={f} value={f} />)}</datalist>
            </div>
            <fieldset>
              <legend className="mb-1 block text-xs font-semibold text-[var(--ai-muted)]">Who can see it</legend>
              <div className="grid grid-cols-2 gap-2">
                {[["private", Lock, "Private", "Only you"], ["shared", Users, "Shared", "People you add"]].map(([value, Icon, title, hint]) => (
                  <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${form.visibility === value ? "border-[var(--ai-focus)] bg-[var(--ai-soft)]" : "border-[var(--ai-line)]"}`}>
                    <input type="radio" name="ai-visibility" value={value} checked={form.visibility === value} onChange={() => setForm({ ...form, visibility: value })} className="sr-only" />
                    <Icon size={15} className="text-[var(--ai-violet)]" /><span><span className="block font-medium text-[var(--ai-ink)]">{title}</span><span className="block text-[11px] text-[var(--ai-faint)]">{hint}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button type="submit" disabled={busy || !form.name.trim()} className="radai-ai-new-chat !h-10 px-4 disabled:opacity-50"><Plus size={16} />Create project</button>
            <span className="text-xs text-[var(--ai-faint)]">Next you can add instructions and upload reference files.</span>
          </div>
        </form>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ai-faint)]" />
          <label htmlFor="ai-filter" className="sr-only">Find projects</label>
          <input id="ai-filter" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects" className="rd-input w-full !pl-9" />
        </div>
        <div className="flex rounded-xl border border-[var(--ai-line)] p-0.5" role="tablist" aria-label="Show">
          {SCOPES.map(([value, text]) => (
            <button key={value} type="button" role="tab" aria-selected={scope === value} onClick={() => setScope(value)}
              className={`rounded-lg px-3 py-1.5 text-sm ${scope === value ? "bg-[var(--ai-soft-nav)] font-semibold text-[var(--ai-purple)]" : "text-[var(--ai-muted)] hover:text-[var(--ai-ink)]"}`}>
              {text} <span className="text-xs opacity-70">{counts[value]}</span>
            </button>
          ))}
        </div>
        {folders.length > 0 && (
          <select value={folder} onChange={(e) => setFolder(e.target.value)} className="rd-input !w-auto" aria-label="Folder">
            <option value="">All folders</option>
            {folders.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        )}
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="rd-input !w-auto" aria-label="Sort by">
          {SORTS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
      </div>

      {loading ? (
        <p role="status" className="mt-8 text-sm text-[var(--ai-muted)]">Loading projects…</p>
      ) : projects.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-[var(--ai-line-strong)] p-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--ai-soft)] text-[var(--ai-violet)]"><FolderPlus size={22} /></span>
          <h2 className="mt-4 text-lg font-semibold text-[var(--ai-ink)]">Create your first project</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--ai-muted)]">Give RADAI a focus: add instructions and reference files once, then every chat in the project uses them.</p>
          <button type="button" onClick={() => setCreating(true)} className="radai-ai-new-chat mx-auto mt-5 !h-10 px-4"><Plus size={16} />New project</button>
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-8 text-sm text-[var(--ai-muted)]">No projects match these filters.</p>
      ) : (
        <ul className="mt-5 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
          {visible.map((row) => (
            <ProjectCard key={row.id} row={row} busy={busy} onOpenChat={onOpenChat} onOpenSettings={onOpenSettings} onRename={onRename} onArchive={onArchive} />
          ))}
        </ul>
      )}
    </div>
  );
}

RadaiProjectsBoard.propTypes = {
  projects: PropTypes.arrayOf(PropTypes.object).isRequired, loading: PropTypes.bool, busy: PropTypes.bool,
  onCreate: PropTypes.func.isRequired, onOpenChat: PropTypes.func.isRequired, onOpenSettings: PropTypes.func.isRequired,
  onRename: PropTypes.func.isRequired, onArchive: PropTypes.func.isRequired,
};
