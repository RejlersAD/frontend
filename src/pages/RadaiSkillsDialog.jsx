import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { BookOpen, Check, Copy, Loader2, Lock, Pencil, Plus, Search, Sparkles, Trash2, Users, X } from "lucide-react";
import { createAISkill, deleteAISkill, listAISkills, updateAISkill } from "../services/radaiIntelligence.service";
import { SKILL_ICONS, SKILL_TONES } from "./radaiSkillVisuals";

// Add context > Skills: built-in skills plus custom skills people write (private or shared with their organization).
const ICONS = SKILL_ICONS;
const TONES = SKILL_TONES;
const EMPTY_FORM = { name: "", category: "Custom", description: "", instructions: "", starter: "", output: "", needs: "", visibility: "private", based_on: "" };
const toForm = (s, copy = false) => ({
  name: copy ? `${s.name} (my version)` : s.name, category: s.category || "Custom", description: s.description || "",
  instructions: (s.instructions || []).join("\n"), starter: s.starter || "", output: s.output || "",
  needs: (s.needs || []).join("\n"), visibility: copy ? "private" : (s.visibility || "private"), based_on: copy ? s.id : (s.based_on || ""),
});
const lines = (text) => text.split("\n").map((l) => l.trim()).filter(Boolean);
const apiError = (exc, fallback) => {
  const data = exc?.response?.data;
  if (data && typeof data === "object") {
    const first = data.detail || Object.values(data).flat().find((v) => typeof v === "string");
    if (first) return first;
  }
  return fallback;
};

export default function RadaiSkillsDialog({ activeSkillId, onClose, onUse }) {
  const [builtIn, setBuiltIn] = useState(null);
  const [custom, setCustom] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customCategories, setCustomCategories] = useState(["Custom"]);
  const [canShare, setCanShare] = useState(false);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(activeSkillId || "");
  const [editing, setEditing] = useState(null); // null | { id?: string, form }
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const searchInput = useRef(null);

  const load = useCallback(async (selectId) => {
    try {
      const r = await listAISkills();
      setBuiltIn(r.results || []); setCustom(r.custom || []); setCategories(r.categories || []);
      setCustomCategories(r.custom_categories || ["Custom"]); setCanShare(Boolean(r.can_share));
      setSelectedId((id) => selectId || id || r.results?.[0]?.id || "");
    } catch {
      setBuiltIn([]); setError("Skills could not be loaded.");
    }
  }, []);
  useEffect(() => { load(); requestAnimationFrame(() => searchInput.current?.focus()); }, [load]);
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (editing) setEditing(null); else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, editing]);

  const all = useMemo(() => [...custom, ...(builtIn || [])], [custom, builtIn]);
  const visible = all.filter((s) => {
    if (filter === "My skills" && !(s.custom && s.editable)) return false;
    if (filter === "Shared" && !(s.custom && !s.editable)) return false;
    if (!["All", "My skills", "Shared"].includes(filter) && s.category !== filter) return false;
    return !query.trim() || `${s.name} ${s.description} ${s.category}`.toLowerCase().includes(query.trim().toLowerCase());
  });
  const selected = all.find((s) => s.id === selectedId) || visible[0];
  const mineCount = custom.filter((s) => s.editable).length;
  const sharedCount = custom.filter((s) => !s.editable).length;
  const tabs = ["All", "My skills", ...(sharedCount ? ["Shared"] : []), ...categories];

  const startNew = () => { setEditing({ form: { ...EMPTY_FORM } }); setError(""); setConfirmDelete(false); };
  const save = async (event) => {
    event.preventDefault();
    const f = editing.form;
    const payload = { name: f.name, category: f.category, description: f.description, instructions: lines(f.instructions),
      starter: f.starter, output: f.output, needs: lines(f.needs), visibility: f.visibility, ...(f.based_on ? { based_on: f.based_on } : {}) };
    setBusy(true); setError("");
    try {
      const saved = editing.id ? await updateAISkill(editing.id, payload) : await createAISkill(payload);
      setEditing(null);
      await load(saved.id);
      setSelectedId(saved.id);
      setFilter("All");
    } catch (exc) {
      setError(apiError(exc, "The skill could not be saved."));
    } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true); setError("");
    try {
      await deleteAISkill(selected.id);
      setConfirmDelete(false);
      if (activeSkillId === selected.id) onUse(null);
      await load(builtIn?.[0]?.id);
      setSelectedId(builtIn?.[0]?.id || "");
    } catch (exc) {
      setError(apiError(exc, "The skill could not be deleted."));
    } finally { setBusy(false); }
  };

  const label = "text-xs font-semibold uppercase tracking-wide text-[var(--ai-faint)]";
  const set = (patch) => setEditing((e) => ({ ...e, form: { ...e.form, ...patch } }));

  const detail = selected && (() => {
    const Icon = ICONS[selected.icon] || BookOpen;
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${TONES[selected.custom ? "Custom" : selected.category] || TONES.Engineering} text-white shadow-md`}><Icon size={22} /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold">{selected.name}</h3>
            <p className="text-sm text-[var(--ai-muted)]">{selected.description || "No description."}</p>
            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
              <span className="rounded-full bg-[var(--ai-surface-subtle)] px-2 py-0.5 text-[var(--ai-muted)]">{selected.category}</span>
              {selected.custom && (selected.editable
                ? <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ai-soft)] px-2 py-0.5 text-[var(--ai-purple)]">{selected.visibility === "organization" ? <Users size={11} /> : <Lock size={11} />}Your skill · {selected.visibility === "organization" ? "shared with your organization" : "private"}</span>
                : <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ai-soft)] px-2 py-0.5 text-[var(--ai-purple)]"><Users size={11} />Shared by {selected.owner_name || "a colleague"}</span>)}
              {!selected.custom && <span className="rounded-full bg-[var(--ai-surface-subtle)] px-2 py-0.5 text-[var(--ai-muted)]">Built-in</span>}
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            {selected.custom && selected.editable ? (
              <>
                <button type="button" className="radai-ai-icon-btn" title="Edit" aria-label={`Edit ${selected.name}`} onClick={() => { setEditing({ id: selected.id, form: toForm(selected) }); setError(""); }}><Pencil size={15} /></button>
                <button type="button" className="radai-ai-icon-btn hover:!text-[var(--rd-danger)]" title="Delete" aria-label={`Delete ${selected.name}`} onClick={() => setConfirmDelete(true)}><Trash2 size={15} /></button>
              </>
            ) : (
              <button type="button" className="rd-btn !py-1.5 text-xs" onClick={() => { setEditing({ form: toForm(selected, true) }); setError(""); }}><Copy size={13} />Customise</button>
            )}
          </div>
        </div>
        {confirmDelete && (
          <div className="rounded-xl border border-[var(--rd-danger)]/40 bg-[var(--rd-danger-soft)] p-3 text-sm">
            <p>Delete “{selected.name}”?{selected.visibility === "organization" ? " Colleagues using it will lose it too." : ""}</p>
            <div className="mt-2 flex gap-2"><button type="button" disabled={busy} onClick={remove} className="rounded-md bg-[var(--rd-danger)] px-3 py-1 text-xs font-medium text-white">Delete</button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-md px-3 py-1 text-xs">Cancel</button></div>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--ai-line)] p-3"><div className={label}>Works best with</div>
            {selected.needs?.length ? <ul className="mt-1.5 space-y-1 text-sm">{selected.needs.map((n) => <li key={n} className="flex gap-2"><span className="text-[var(--ai-violet)]">•</span>{n}</li>)}</ul> : <p className="mt-1.5 text-sm text-[var(--ai-faint)]">Anything relevant</p>}</div>
          <div className="rounded-xl border border-[var(--ai-line)] p-3"><div className={label}>You get</div><p className="mt-1.5 text-sm">{selected.output || "An answer that follows the steps below"}</p></div>
        </div>
        <div><div className={label}>How RADAI works with this skill</div>
          <ol className="mt-2 space-y-1.5 text-sm text-[var(--ai-muted)]">{selected.instructions.map((line, i) => <li key={i} className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--ai-soft)] text-[11px] font-semibold text-[var(--ai-purple)]">{i + 1}</span><span>{line}</span></li>)}</ol></div>
        {selected.starter && <div><div className={label}>Starting message</div>
          <p className="mt-1.5 whitespace-pre-wrap rounded-xl bg-[var(--ai-surface-subtle)] p-3 text-sm">{selected.starter}</p>
          <p className="mt-1 text-xs text-[var(--ai-faint)]">Replace the [bracketed] parts after you choose the skill.</p></div>}
      </div>
    );
  })();

  const form = editing && (
    <form id="skill-form" onSubmit={save} className="space-y-4">
      <div><h3 className="text-lg font-semibold">{editing.id ? "Edit skill" : editing.form.based_on ? "Customise skill" : "New skill"}</h3>
        <p className="text-sm text-[var(--ai-muted)]">Write the method you want RADAI to follow. It always stays within RADAI&apos;s evidence and safety rules.</p></div>
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <div><label htmlFor="skill-name" className={label}>Name</label>
          <input id="skill-name" required autoFocus maxLength={80} value={editing.form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Datasheet review" className="rd-input mt-1 w-full" /></div>
        <div><label htmlFor="skill-category" className={label}>Category</label>
          <select id="skill-category" value={editing.form.category} onChange={(e) => set({ category: e.target.value })} className="rd-input mt-1 w-full">
            {customCategories.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
      </div>
      <div><label htmlFor="skill-description" className={label}>What it does</label>
        <input id="skill-description" maxLength={300} value={editing.form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Check an instrument datasheet against the project specification." className="rd-input mt-1 w-full" /></div>
      <div><div className="flex items-end justify-between"><label htmlFor="skill-instructions" className={label}>Steps for RADAI (one per line)</label>
        <span className="text-[11px] text-[var(--ai-faint)]">{lines(editing.form.instructions).length}/15 lines</span></div>
        <textarea id="skill-instructions" required rows={6} value={editing.form.instructions} onChange={(e) => set({ instructions: e.target.value })}
          placeholder={"Compare each datasheet field with the project specification.\nReport a table: Field, Datasheet value, Spec value, Status, Source.\nFlag missing mandatory fields."} className="rd-input mt-1 w-full resize-y font-normal" /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="skill-output" className={label}>You get</label>
          <input id="skill-output" maxLength={200} value={editing.form.output} onChange={(e) => set({ output: e.target.value })} placeholder="Comparison table" className="rd-input mt-1 w-full" /></div>
        <div><label htmlFor="skill-needs" className={label}>Works best with (one per line)</label>
          <textarea id="skill-needs" rows={2} value={editing.form.needs} onChange={(e) => set({ needs: e.target.value })} placeholder="The datasheet PDF" className="rd-input mt-1 w-full resize-y" /></div>
      </div>
      <div><label htmlFor="skill-starter" className={label}>Starting message</label>
        <textarea id="skill-starter" rows={2} maxLength={1000} value={editing.form.starter} onChange={(e) => set({ starter: e.target.value })} placeholder="Review the attached datasheet for [tag number] against [specification]." className="rd-input mt-1 w-full resize-y" />
        <p className="mt-1 text-xs text-[var(--ai-faint)]">Put the parts people fill in inside [square brackets].</p></div>
      <fieldset><legend className={label}>Who can use it</legend>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          {[["private", Lock, "Only me", "Private to you"], ["organization", Users, "My organization", canShare ? "Colleagues can use it, not edit it" : "You aren't linked to an organization"]].map(([value, Icon, title, hint]) => (
            <label key={value} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${value === "organization" && !canShare ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${editing.form.visibility === value ? "border-[var(--ai-focus)] bg-[var(--ai-soft)]" : "border-[var(--ai-line)]"}`}>
              <input type="radio" name="skill-visibility" value={value} disabled={value === "organization" && !canShare} checked={editing.form.visibility === value} onChange={() => set({ visibility: value })} className="sr-only" />
              <Icon size={15} className="text-[var(--ai-violet)]" /><span><span className="block font-medium">{title}</span><span className="block text-[11px] text-[var(--ai-faint)]">{hint}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
    </form>
  );

  return createPortal(
    <div className="radai-ai-portal fixed inset-0 z-[95] grid place-items-center bg-slate-950/45 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="skills-title" className="flex h-[min(720px,94vh)] w-[min(1000px,100%)] flex-col overflow-hidden rounded-2xl border border-[var(--ai-line)] bg-[var(--ai-surface)] text-[var(--ai-ink)] shadow-2xl">
        <header className="flex items-center gap-3 border-b border-[var(--ai-line)] px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--ai-soft)] text-[var(--ai-violet)]"><Sparkles size={18} /></span>
          <div className="min-w-0 flex-1"><h2 id="skills-title" className="text-base font-semibold">Skills</h2>
            <p className="text-xs text-[var(--ai-muted)]">Give RADAI a proven method and output format, or write your own. Evidence and safety rules always apply.</p></div>
          <button type="button" onClick={startNew} className="rd-btn !py-1.5 text-sm"><Plus size={15} />New skill</button>
          <button type="button" className="radai-ai-icon-btn" aria-label="Close skills" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--ai-line)] px-5 py-3">
          <div className="relative min-w-[200px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ai-faint)]" />
            <input ref={searchInput} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search skills" aria-label="Search skills" className="rd-input w-full !pl-9" />
          </div>
          <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Show">
            {tabs.map((c) => (
              <button key={c} type="button" role="tab" aria-selected={filter === c} onClick={() => setFilter(c)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${filter === c ? "bg-[var(--ai-soft-nav)] text-[var(--ai-purple)]" : "text-[var(--ai-muted)] hover:bg-[var(--ai-soft-hover)]"}`}>
                {c}{c === "My skills" ? ` ${mineCount}` : c === "Shared" ? ` ${sharedCount}` : ""}</button>
            ))}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <ul className="min-h-0 shrink-0 overflow-y-auto border-b border-[var(--ai-line)] p-2 md:w-[340px] md:border-b-0 md:border-r" aria-label="Skills list">
            {builtIn === null && <li className="flex items-center gap-2 p-3 text-sm text-[var(--ai-muted)]"><Loader2 size={15} className="animate-spin" />Loading skills…</li>}
            {builtIn && filter === "My skills" && !mineCount && (
              <li className="p-4 text-sm text-[var(--ai-muted)]">You haven&apos;t written a skill yet. <button type="button" className="font-medium text-[var(--ai-violet)] hover:underline" onClick={startNew}>Create one</button>, or open a built-in skill and choose Customise.</li>
            )}
            {builtIn && !visible.length && filter !== "My skills" && <li className="p-4 text-sm text-[var(--ai-muted)]">No skills match.</li>}
            {visible.map((s) => {
              const Icon = ICONS[s.icon] || BookOpen;
              const on = !editing && selected?.id === s.id;
              return (
                <li key={s.id}>
                  <button type="button" onClick={() => { setSelectedId(s.id); setEditing(null); setConfirmDelete(false); }} onDoubleClick={() => onUse(s)} aria-current={on ? "true" : undefined}
                    className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left ${on ? "bg-[var(--ai-soft)] ring-1 ring-[var(--ai-focus)]" : "hover:bg-[var(--ai-soft-hover)]"}`}>
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${TONES[s.custom ? "Custom" : s.category] || TONES.Engineering} text-white`}><Icon size={16} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-medium"><span className="truncate">{s.name}</span>
                        {s.custom && <span className="shrink-0 rounded-full bg-[var(--ai-soft)] px-1.5 text-[10px] font-semibold text-[var(--ai-purple)]">{s.editable ? "Yours" : "Shared"}</span>}
                        {activeSkillId === s.id && <Check size={13} className="shrink-0 text-[var(--ai-violet)]" />}</span>
                      <span className="line-clamp-2 text-xs leading-4 text-[var(--ai-muted)]">{s.description}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <section className="min-h-0 min-w-0 flex-1 overflow-y-auto p-5" aria-live="polite">
            {error && <p role="alert" className="mb-4 rounded-lg bg-[var(--rd-danger-soft)] px-3 py-2 text-sm text-[var(--rd-danger)]">{error}</p>}
            {editing ? form : detail || <p className="text-sm text-[var(--ai-muted)]">Choose a skill to see what it does.</p>}
          </section>
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-[var(--ai-line)] px-5 py-3">
          {editing ? (
            <>
              <span className="truncate text-xs text-[var(--ai-muted)]">{editing.form.visibility === "organization" ? "Colleagues in your organization will see this skill." : "Only you will see this skill."}</span>
              <div className="flex gap-2">
                <button type="button" className="rd-btn" onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" form="skill-form" disabled={busy || !editing.form.name.trim() || !lines(editing.form.instructions).length} className="radai-ai-new-chat !h-9 px-4 disabled:opacity-50">
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}{editing.id ? "Save changes" : "Create skill"}</button>
              </div>
            </>
          ) : (
            <>
              <span className="truncate text-xs text-[var(--ai-muted)]">{activeSkillId ? "A skill stays on for this chat until you remove it." : "Double-click a skill to use it straight away."}</span>
              <div className="flex gap-2">
                {activeSkillId && <button type="button" className="rd-btn" onClick={() => onUse(null)}>Turn skill off</button>}
                <button type="button" disabled={!selected} onClick={() => onUse(selected)} className="radai-ai-new-chat !h-9 px-4 disabled:opacity-50"><Sparkles size={15} />Use {selected ? selected.name : "skill"}</button>
              </div>
            </>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  );
}

RadaiSkillsDialog.propTypes = { activeSkillId: PropTypes.string, onClose: PropTypes.func.isRequired, onUse: PropTypes.func.isRequired };
