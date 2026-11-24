import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { Check, FileSpreadsheet, FileText, Loader2, Lock, Plug, Plus, Search, X } from "lucide-react";
import { listAIConnectors, searchAIConnector } from "../services/radaiIntelligence.service";

// Pick records from other RADAI modules and attach them to the current chat.
const ICONS = { project_documents: FileText, line_lists: FileSpreadsheet };
const fmtSize = (bytes) => (!bytes ? "" : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`);

export default function RadaiConnectorsDialog({ onClose, onAttach }) {
  const [connectors, setConnectors] = useState(null);
  const [active, setActive] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [attaching, setAttaching] = useState("");
  const [attached, setAttached] = useState({});
  const searchInput = useRef(null);

  useEffect(() => {
    listAIConnectors()
      .then((r) => {
        const rows = r.results || [];
        setConnectors(rows);
        setActive((rows.find((c) => c.available) || rows[0] || {}).id || "");
      })
      .catch(() => { setConnectors([]); setError("Connectors could not be loaded."); });
  }, []);
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const current = connectors?.find((c) => c.id === active);
  useEffect(() => {
    if (!current?.available) { setResults([]); return undefined; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true); setError("");
      searchAIConnector(current.id, query.trim(), controller.signal)
        .then((r) => { if (!controller.signal.aborted) setResults(r.results || []); })
        .catch((exc) => { if (!controller.signal.aborted) { setResults([]); setError(exc?.response?.data?.detail || "Search failed. Try again."); } })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [current, query]);
  useEffect(() => { requestAnimationFrame(() => searchInput.current?.focus()); }, [active]);

  const attach = async (item) => {
    const key = `${active}:${item.id}`;
    setAttaching(key); setError("");
    try {
      await onAttach(active, item);
      setAttached((prev) => ({ ...prev, [key]: true }));
    } catch (exc) {
      setError(exc?.response?.data?.item_id?.[0] || exc?.response?.data?.file?.[0] || exc?.response?.data?.detail || `${item.title} could not be attached.`);
    } finally {
      setAttaching("");
    }
  };
  const count = Object.keys(attached).length;

  return createPortal(
    <div className="radai-ai-portal fixed inset-0 z-[95] grid place-items-center bg-slate-950/45 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="connectors-title" className="flex h-[min(640px,90vh)] w-[min(880px,100%)] flex-col overflow-hidden rounded-2xl border border-[var(--ai-line)] bg-[var(--ai-surface)] text-[var(--ai-ink)] shadow-2xl">
        <header className="flex items-center gap-3 border-b border-[var(--ai-line)] px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--ai-soft)] text-[var(--ai-violet)]"><Plug size={18} /></span>
          <div className="min-w-0 flex-1"><h2 id="connectors-title" className="text-base font-semibold">Connectors</h2><p className="text-xs text-[var(--ai-muted)]">Attach records from other RADAI modules to this chat. Only what you can already open is listed.</p></div>
          <button type="button" className="radai-ai-icon-btn" aria-label="Close connectors" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <nav aria-label="Sources" className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--ai-line)] p-2 sm:w-56 sm:flex-col sm:border-b-0 sm:border-r">
            {connectors === null && <p className="p-2 text-xs text-[var(--ai-muted)]">Loading…</p>}
            {connectors?.map((c) => {
              const Icon = ICONS[c.id] || Plug;
              const on = c.id === active;
              return (
                <button key={c.id} type="button" onClick={() => { setActive(c.id); setQuery(""); }} aria-current={on ? "true" : undefined}
                  className={`flex shrink-0 items-start gap-2.5 rounded-xl px-3 py-2 text-left ${on ? "bg-[var(--ai-soft-nav)] text-[var(--ai-purple)]" : "hover:bg-[var(--ai-soft-hover)]"}`}>
                  <Icon size={16} className="mt-0.5 shrink-0" />
                  <span className="min-w-0"><span className="flex items-center gap-1.5 text-sm font-medium">{c.label}{!c.available && <Lock size={12} className="text-[var(--ai-faint)]" />}</span>
                    <span className="hidden text-[11px] leading-4 text-[var(--ai-faint)] sm:block">{c.description}</span></span>
                </button>
              );
            })}
          </nav>
          <section className="flex min-h-0 min-w-0 flex-1 flex-col">
            {current && !current.available ? (
              <div className="grid flex-1 place-items-center p-8 text-center text-sm text-[var(--ai-muted)]"><div><Lock size={22} className="mx-auto text-[var(--ai-faint)]" /><p className="mt-2">{current.reason}</p></div></div>
            ) : (
              <>
                <div className="relative border-b border-[var(--ai-line)] p-3">
                  <Search size={15} className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-[var(--ai-faint)]" />
                  <input ref={searchInput} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${current?.label.toLowerCase() || ""}`} aria-label="Search records" className="rd-input w-full !pl-9" />
                </div>
                {error && <p role="alert" className="mx-3 mt-3 rounded-lg bg-[var(--rd-danger-soft)] px-3 py-2 text-xs text-[var(--rd-danger)]">{error}</p>}
                <ul className="min-h-0 flex-1 overflow-y-auto p-2" aria-busy={searching}>
                  {searching && <li className="flex items-center gap-2 p-3 text-sm text-[var(--ai-muted)]"><Loader2 size={15} className="animate-spin" />Searching…</li>}
                  {!searching && !results.length && <li className="p-6 text-center text-sm text-[var(--ai-muted)]">{query ? "Nothing matches your search." : "Nothing available here yet."}</li>}
                  {!searching && results.map((item) => {
                    const key = `${active}:${item.id}`;
                    const done = attached[key];
                    const Icon = ICONS[active] || FileText;
                    return (
                      <li key={key} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--ai-soft-hover)]">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--ai-surface-subtle)] text-[var(--ai-muted)]"><Icon size={16} /></span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.title}</span>
                          <span className="block truncate text-xs text-[var(--ai-faint)]">{[item.subtitle, item.meta, fmtSize(item.size)].filter(Boolean).join(" · ")}</span></span>
                        <button type="button" disabled={done || !!attaching} onClick={() => attach(item)}
                          className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold ${done ? "bg-[var(--rd-success-soft)] text-[var(--rd-success)]" : "bg-[var(--ai-soft)] text-[var(--ai-purple)] hover:bg-[var(--ai-soft-nav)]"}`}>
                          {attaching === key ? <Loader2 size={13} className="animate-spin" /> : done ? <Check size={13} /> : <Plus size={13} />}{done ? "Attached" : "Attach"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-[var(--ai-line)] px-5 py-3 text-xs text-[var(--ai-muted)]">
          <span>{count ? `${count} attached to this chat` : "Attached records appear above the message box."}</span>
          <button type="button" onClick={onClose} className="radai-ai-new-chat !h-9 px-4">Done</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

RadaiConnectorsDialog.propTypes = { onClose: PropTypes.func.isRequired, onAttach: PropTypes.func.isRequired };
