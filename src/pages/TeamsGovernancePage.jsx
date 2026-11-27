import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  Archive,
  BadgeCheck,
  Bot,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  FolderOpen,
  Globe,
  KeyRound,
  Lock,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  ScrollText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
  XCircle,
} from "lucide-react";
import {
  addOrgAdmin,
  addTeamMember,
  archiveTeam,
  createTeam,
  enterpriseError,
  exportAuditLogs,
  getAuditSummary,
  getEnterpriseContext,
  getRetentionPreview,
  getTeam,
  listAuditLogs,
  listMyWorkspaces,
  listOrgAdmins,
  listOrgModels,
  removeOrgAdmin,
  removeTeamMember,
  shareWorkspace,
  unshareWorkspace,
  updateEdition,
  updatePolicy,
  updateSharedWorkspace,
  updateTeam,
  updateTeamMember,
} from "../services/enterprise.service";
import { searchAIEmployees } from "../services/radaiIntelligence.service";

const RANK = { individual: 0, team: 1, enterprise: 2 };
const EDITION_LABEL = { individual: "Individual", team: "Team", enterprise: "Enterprise" };
const FLAG_ON = import.meta.env.VITE_ENABLE_ENTERPRISE_TEAMS !== "false";

const card = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900";
const input =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
const btn =
  "inline-flex items-center gap-1.5 rounded-lg bg-[#0b2e59] px-3 py-2 text-sm font-medium text-white hover:bg-[#123d73] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500";
const btnGhost =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800";
const label = "mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";

const fmt = value => (value ? new Date(value).toLocaleString() : "—");
const dateOnly = value => (value ? new Date(value).toLocaleDateString() : "—");

function Notice({ tone = "info", children }) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100",
    error: "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
  };
  return <div className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}

function UpgradeHint({ needed }) {
  return (
    <Notice>
      <span className="inline-flex items-start gap-2 sm:items-center">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 sm:mt-0" />
        <span>This needs the <strong>{EDITION_LABEL[needed]}</strong> edition. Ask your platform administrator to upgrade your organization.</span>
      </span>
    </Notice>
  );
}

// ------------------------------------------------------------------ Teams tab
const ROLE_HELP = [
  ["admin", "Manages members and team settings, and can share AI projects with the team."],
  ["lead", "Approves work and can share AI projects with the team."],
  ["engineer", "Works in the team's shared AI projects (edits when a project is shared as Editor)."],
  ["reviewer", "Reads and comments. Always read-only in shared AI projects."],
  ["guest", "External client or contractor. Read-only, and access ends on a set date."],
];
const DAY_MS = 86400000;
const memberStatus = m => {
  if (m.is_expired) return "expired";
  if (m.expires_at && new Date(m.expires_at).getTime() - Date.now() < 7 * DAY_MS) return "expiring";
  return null;
};
const initials = (name, email) => (name || email || "?").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join("");
const employeeName = e => `${e.first_name || ""} ${e.last_name || ""}`.trim() || e.email;
const looksLikeEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

const BADGE_TONES = {
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  sky: "bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  amber: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  red: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200",
  violet: "bg-violet-50 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
};
function Badge({ tone = "slate", children }) {
  return <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE_TONES[tone]}`}>{children}</span>;
}
Badge.propTypes = { tone: PropTypes.string, children: PropTypes.node };

function Stat({ icon: Icon, value, label: text, tone = "slate" }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2.5 dark:border-slate-700">
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><Icon className="h-3.5 w-3.5" />{text}</div>
      <div className={`mt-1 text-xl font-semibold ${tone === "amber" && value ? "text-amber-600 dark:text-amber-300" : "text-slate-900 dark:text-slate-50"}`}>{value}</div>
    </div>
  );
}
Stat.propTypes = { icon: PropTypes.elementType.isRequired, value: PropTypes.number.isRequired, label: PropTypes.string.isRequired, tone: PropTypes.string };

function TeamsTab({ ctx, reload, setFlash }) {
  const [selectedId, setSelectedId] = useState(ctx.teams[0]?.id || null);
  const [team, setTeam] = useState(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [newTeam, setNewTeam] = useState({ name: "", description: "" });
  const [myWorkspaces, setMyWorkspaces] = useState([]);
  const [share, setShare] = useState({ workspace_id: "", role: "viewer" });
  // Add-members form: search employees, collect several, add them in one go.
  const [picked, setPicked] = useState([]);
  const [empQuery, setEmpQuery] = useState("");
  const [empResults, setEmpResults] = useState([]);
  const [empBusy, setEmpBusy] = useState(false);
  const [addRole, setAddRole] = useState("engineer");
  const [addUntil, setAddUntil] = useState("");
  const teamRoles = ctx.choices.team_roles;
  const roleName = code => teamRoles.find(([c]) => c === code)?.[1] || code;
  const canCreate = ctx.capabilities.manage_org && RANK[ctx.edition.effective_edition] >= RANK.team;

  const run = async (fn, success) => {
    setBusy(true);
    try {
      const result = await fn();
      if (success) setFlash({ tone: "success", text: success });
      return result;
    } catch (error) {
      setFlash({ tone: "error", text: enterpriseError(error) });
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const loadTeam = useCallback(async id => {
    if (!id) return setTeam(null);
    try {
      setTeam(await getTeam(id));
    } catch (error) {
      setTeam(null);
      setFlash({ tone: "error", text: enterpriseError(error) });
    }
  }, [setFlash]);

  useEffect(() => { loadTeam(selectedId); setEditing(null); setPicked([]); setEmpQuery(""); }, [selectedId, loadTeam]);
  useEffect(() => {
    listMyWorkspaces().then(r => setMyWorkspaces(r.results || [])).catch(() => setMyWorkspaces([]));
  }, []);

  const memberEmails = useMemo(() => new Set((team?.members || []).map(m => (m.user.email || "").toLowerCase())), [team]);
  useEffect(() => {
    const q = empQuery.trim();
    if (q.length < 2) { setEmpResults([]); setEmpBusy(false); return undefined; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setEmpBusy(true);
      searchAIEmployees(q, controller.signal)
        .then(result => {
          const needle = q.toLocaleLowerCase();
          setEmpResults((result.results || []).filter(e => e.email && [employeeName(e), e.email, e.employee_number, e.employment_id]
            .some(v => String(v || "").toLocaleLowerCase().includes(needle))).slice(0, 8));
        })
        .catch(() => { if (!controller.signal.aborted) setEmpResults([]); })
        .finally(() => { if (!controller.signal.aborted) setEmpBusy(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [empQuery]);

  const pick = person => {
    const email = person.email.trim().toLowerCase();
    if (memberEmails.has(email) || picked.some(p => p.email === email)) return;
    setPicked(prev => [...prev, { email, name: person.name || email }]);
    setEmpQuery("");
    setEmpResults([]);
  };

  const onCreate = async e => {
    e.preventDefault();
    const created = await run(() => createTeam(newTeam), "Team created.");
    if (created) {
      setNewTeam({ name: "", description: "" });
      await reload();
      setSelectedId(created.id);
    }
  };

  const onSaveDetails = async e => {
    e.preventDefault();
    if (await run(() => updateTeam(team.id, { name: editing.name, description: editing.description }), "Team details saved.")) {
      setEditing(null);
      loadTeam(team.id);
      reload();
    }
  };

  const onAddMembers = async e => {
    e.preventDefault();
    const people = [...picked];
    if (!people.length && looksLikeEmail(empQuery)) people.push({ email: empQuery.trim().toLowerCase(), name: empQuery.trim() });
    if (!people.length) return;
    setBusy(true);
    const failed = [];
    for (const person of people) {
      const body = { email: person.email, role: addRole };
      if (addUntil) body.expires_at = addUntil;
      try { await addTeamMember(team.id, body); } catch (error) { failed.push(`${person.name}: ${enterpriseError(error)}`); }
    }
    setBusy(false);
    const added = people.length - failed.length;
    setFlash(failed.length
      ? { tone: "error", text: `${added} added. Not added: ${failed.join(" · ")}` }
      : { tone: "success", text: `${added} ${added === 1 ? "person" : "people"} added. AI project access updated.` });
    setPicked([]);
    setEmpQuery("");
    setAddUntil("");
    loadTeam(team.id);
    reload();
  };

  const onShare = async e => {
    e.preventDefault();
    const result = await run(() => shareWorkspace(team.id, { workspace_id: Number(share.workspace_id), role: share.role }));
    if (result) {
      setFlash({ tone: "success", text: `AI project shared. ${result.sync?.created || 0} member(s) given access.` });
      setShare({ workspace_id: "", role: "viewer" });
      loadTeam(team.id);
      reload();
    }
  };

  const visibleTeams = ctx.teams.filter(t => !query.trim() || `${t.name} ${t.description || ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  const sharedIds = new Set((team?.workspaces || []).map(w => w.workspace_id));
  const shareable = myWorkspaces.filter(w => !sharedIds.has(w.id));
  const activeMembers = (team?.members || []).filter(m => !m.is_expired);
  const guestCount = activeMembers.filter(m => m.role === "guest").length;
  const expiringCount = (team?.members || []).filter(m => memberStatus(m) === "expiring").length;
  const pendingCount = picked.length || (looksLikeEmail(empQuery) ? 1 : 0);

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      <aside className="space-y-4">
        <div className={card}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Teams</h3>
            <span className="text-xs text-slate-500">{ctx.teams.length}</span>
          </div>
          {ctx.teams.length > 0 && (
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className={`${input} pl-9`} placeholder="Search teams" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search teams" />
            </div>
          )}
          {ctx.teams.length === 0 && <p className="text-sm text-slate-500">No teams yet. Create one to share AI projects with a group.</p>}
          {ctx.teams.length > 0 && visibleTeams.length === 0 && <p className="text-sm text-slate-500">No teams match &quot;{query}&quot;.</p>}
          <ul className="space-y-1">
            {visibleTeams.map(t => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  aria-current={selectedId === t.id ? "true" : undefined}
                  className={`w-full rounded-lg px-3 py-2 text-left ${selectedId === t.id ? "bg-sky-50 dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${selectedId === t.id ? "font-semibold text-[#0b2e59] dark:text-sky-200" : "font-medium text-slate-800 dark:text-slate-100"}`}>{t.name}</span>
                    {t.my_role && <Badge tone={t.my_role === "admin" ? "violet" : "slate"}>{roleName(t.my_role).split(" (")[0]}</Badge>}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">{t.member_count} {t.member_count === 1 ? "member" : "members"} · {t.project_count ?? 0} {t.project_count === 1 ? "project" : "projects"}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
        {RANK[ctx.edition.effective_edition] < RANK.team ? (
          <UpgradeHint needed="team" />
        ) : canCreate ? (
          <form onSubmit={onCreate} className={`${card} space-y-3`}>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">New team</h3>
            <input className={input} placeholder="Process – Unit 100" value={newTeam.name} maxLength={120}
              onChange={e => setNewTeam({ ...newTeam, name: e.target.value })} required aria-label="Team name" />
            <textarea className={input} rows={2} placeholder="Purpose (optional)" value={newTeam.description} maxLength={2000}
              onChange={e => setNewTeam({ ...newTeam, description: e.target.value })} aria-label="Team description" />
            <button className={btn} disabled={busy || !newTeam.name.trim()}><Plus className="h-4 w-4" />Create team</button>
            <p className="text-xs text-slate-500">You become the team admin and can add people straight away.</p>
          </form>
        ) : null}
      </aside>

      <section className="min-w-0 space-y-5">
        {!team ? (
          ctx.teams.length ? (
            <div className={`${card} grid min-h-[320px] place-items-center text-center`}>
              <div><Users className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" /><p className="mt-3 text-sm text-slate-500">Select a team on the left to see its people and shared AI projects.</p></div>
            </div>
          ) : (
            <div className={`${card} overflow-hidden !p-0`}>
              <div className="bg-gradient-to-br from-indigo-50 via-white to-sky-50 px-6 py-8 sm:px-10 sm:py-10 dark:from-indigo-950/60 dark:via-slate-900 dark:to-sky-950/40">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-800 text-white shadow-lg shadow-indigo-500/25"><Users className="h-6 w-6" /></span>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Bring your team into RADAI Intelligence</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Teams let a group work from the same AI projects: shared knowledge, instructions and sources, with access that follows team membership automatically.</p>
              </div>
              <ol className="grid gap-px bg-slate-200 sm:grid-cols-3 dark:bg-slate-800">
                {[
                  [Plus, "Create a team", canCreate ? "Name it after a discipline, unit or project. You become its admin." : "An organization admin creates teams."],
                  [UserPlus, "Add people", "Search colleagues by name or employee ID and give each one a role."],
                  [FolderOpen, "Share AI projects", "Share a RADAI Intelligence project once; every member gets access."],
                ].map(([Icon, title, text], i) => (
                  <li key={title} className="bg-white p-6 dark:bg-slate-900">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300"><span className="grid h-6 w-6 place-items-center rounded-full bg-indigo-50 dark:bg-indigo-950">{i + 1}</span>Step {i + 1}</div>
                    <div className="mt-3 flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100"><Icon className="h-4 w-4 text-slate-500" />{title}</div>
                    <p className="mt-1 text-sm text-slate-500">{text}</p>
                  </li>
                ))}
              </ol>
            </div>
          )
        ) : (
          <>
            <div className={card}>
              {editing ? (
                <form onSubmit={onSaveDetails} className="space-y-3">
                  <div><label className={label} htmlFor="team-name">Team name</label>
                    <input id="team-name" className={input} value={editing.name} maxLength={120} required onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
                  <div><label className={label} htmlFor="team-purpose">Purpose</label>
                    <textarea id="team-purpose" className={input} rows={2} maxLength={2000} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} /></div>
                  <div className="flex gap-2">
                    <button className={btn} disabled={busy || !editing.name.trim()}><Check className="h-4 w-4" />Save</button>
                    <button type="button" className={btnGhost} onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{team.name}</h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{team.description || <span className="text-slate-400">No purpose added yet.</span>}</p>
                    <p className="mt-2 text-xs text-slate-500">Your role: {team.my_role ? roleName(team.my_role) : "organization oversight"}</p>
                  </div>
                  {team.can_manage && (
                    <div className="flex gap-2">
                      <button type="button" className={btnGhost} disabled={busy} onClick={() => setEditing({ name: team.name, description: team.description || "" })}>
                        <Pencil className="h-4 w-4" />Edit
                      </button>
                      <button type="button" className={btnGhost} disabled={busy}
                        onClick={async () => {
                          if (!window.confirm(`Archive "${team.name}"? Members lose the AI project access this team gave them.`)) return;
                          if (await run(() => archiveTeam(team.id), "Team archived.") !== undefined) {
                            setSelectedId(null);
                            reload();
                          }
                        }}>
                        <Trash2 className="h-4 w-4" />Archive
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat icon={Users} value={activeMembers.length} label="Members" />
                <Stat icon={FolderOpen} value={team.workspaces.length} label="Shared projects" />
                <Stat icon={Globe} value={guestCount} label="Guests" />
                <Stat icon={Clock} value={expiringCount} label="Ending in 7 days" tone="amber" />
              </div>
            </div>

            <div className={card}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100"><Users className="h-4 w-4" />Members</h3>
                <details className="text-xs text-slate-600 dark:text-slate-300">
                  <summary className="cursor-pointer select-none text-sky-700 dark:text-sky-300">What can each role do?</summary>
                  <dl className="mt-2 max-w-md space-y-1.5 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    {ROLE_HELP.map(([code, help]) => <div key={code}><dt className="font-medium text-slate-800 dark:text-slate-100">{roleName(code)}</dt><dd>{help}</dd></div>)}
                  </dl>
                </details>
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {team.members.map(m => {
                  const status = memberStatus(m);
                  return (
                    <li key={m.user.id} className={`flex flex-wrap items-center gap-3 py-3 ${m.is_expired ? "opacity-60" : ""}`}>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200" aria-hidden="true">{initials(m.user.name, m.user.email)}</span>
                      <div className="min-w-[220px] flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{m.user.name || m.user.email}</span>
                          {m.user.id === ctx.me && <Badge tone="sky">You</Badge>}
                          {m.role === "guest" && <Badge tone="violet">Guest</Badge>}
                          {status === "expiring" && <Badge tone="amber"><Clock className="h-3 w-3" />Ends soon</Badge>}
                          {status === "expired" && <Badge tone="red">Expired</Badge>}
                        </div>
                        <div className="truncate text-xs text-slate-500">{m.user.email}</div>
                      </div>
                      <div className="ml-12 flex flex-wrap items-center gap-2 sm:ml-0">
                        {team.can_manage ? (
                          <select className={`${input} !w-auto`} value={m.role} disabled={busy || m.role === "guest"} aria-label={`Role for ${m.user.email}`}
                            onChange={async e => {
                              if (await run(() => updateTeamMember(team.id, m.user.id, { role: e.target.value }), "Role updated.")) loadTeam(team.id);
                            }}>
                            {teamRoles.filter(([code]) => code !== "guest" || m.role === "guest").map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                          </select>
                        ) : <span className="text-sm text-slate-600 dark:text-slate-300">{roleName(m.role)}</span>}
                        {team.can_manage ? (
                          <input type="date" className={`${input} !w-auto`} value={m.expires_at ? m.expires_at.slice(0, 10) : ""} disabled={busy}
                            aria-label={`Access until for ${m.user.email}`} title="Access until (empty = no end date)"
                            onChange={async e => {
                              const value = e.target.value || null;
                              if (await run(() => updateTeamMember(team.id, m.user.id, { expires_at: value }), value ? "End date updated." : "End date removed.")) loadTeam(team.id);
                            }} />
                        ) : <span className="text-xs text-slate-500">{m.expires_at ? `Until ${dateOnly(m.expires_at)}` : "No end date"}</span>}
                        {team.can_manage && (
                          <button type="button" className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950" disabled={busy} aria-label={`Remove ${m.user.email}`}
                            onClick={async () => {
                              if (!window.confirm(`Remove ${m.user.email} from ${team.name}?`)) return;
                              if (await run(() => removeTeamMember(team.id, m.user.id), "Member removed.") !== undefined) { loadTeam(team.id); reload(); }
                            }}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {team.can_manage && (
                <form onSubmit={onAddMembers} className="mt-4 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <div className="relative">
                    <label className={label} htmlFor="member-search">Add people</label>
                    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5 focus-within:border-sky-600 focus-within:ring-1 focus-within:ring-sky-600 dark:border-slate-600 dark:bg-slate-800">
                      {picked.map(p => (
                        <span key={p.email} className="inline-flex items-center gap-1 rounded-full bg-sky-50 py-0.5 pl-2.5 pr-1 text-xs text-sky-900 dark:bg-sky-950 dark:text-sky-100">
                          {p.name}
                          <button type="button" aria-label={`Remove ${p.name}`} className="rounded-full p-0.5 hover:bg-sky-100 dark:hover:bg-sky-900" onClick={() => setPicked(prev => prev.filter(x => x.email !== p.email))}><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                      <input id="member-search" className="min-w-[180px] flex-1 bg-transparent px-1 py-1 text-sm text-slate-900 outline-none dark:text-slate-100" autoComplete="off"
                        placeholder={picked.length ? "Add another…" : "Search by name, employee ID or email"} value={empQuery}
                        onChange={e => setEmpQuery(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && looksLikeEmail(empQuery) && !empResults.length) { e.preventDefault(); pick({ email: empQuery, name: empQuery.trim() }); } }} />
                    </div>
                    {empQuery.trim().length >= 2 && (
                      <div className="absolute left-0 right-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                        {empBusy && <p className="px-3 py-2 text-xs text-slate-500">Searching…</p>}
                        {!empBusy && empResults.map(emp => {
                          const already = memberEmails.has(emp.email.toLowerCase());
                          return (
                            <button key={emp.user_id || emp.email} type="button" disabled={already}
                              onClick={() => pick({ email: emp.email, name: employeeName(emp) })}
                              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 disabled:cursor-default disabled:opacity-50 dark:hover:bg-slate-800">
                              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-semibold dark:bg-slate-800">{initials(employeeName(emp), emp.email)}</span>
                              <span className="min-w-0"><span className="block truncate text-sm font-medium">{employeeName(emp)}</span>
                                <span className="block truncate text-xs text-slate-500">{[emp.email, emp.employee_number, emp.department].filter(Boolean).join(" · ")}</span></span>
                              {already && <span className="ml-auto text-xs text-slate-500">Already a member</span>}
                            </button>
                          );
                        })}
                        {!empBusy && !empResults.length && (
                          looksLikeEmail(empQuery)
                            ? <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => pick({ email: empQuery, name: empQuery.trim() })}>Add <strong>{empQuery.trim()}</strong> by email</button>
                            : <p className="px-3 py-2 text-xs text-slate-500">No matching employees. You can type an exact email instead.</p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
                    <div><label className={label} htmlFor="member-role">Role</label>
                      <select id="member-role" className={input} value={addRole} onChange={e => setAddRole(e.target.value)}>
                        {teamRoles.filter(([code]) => code !== "guest" || ctx.policy.allow_external_guests).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                      </select></div>
                    <div><label className={label} htmlFor="member-expiry">{addRole === "guest" ? "Access until *" : "Access until"}</label>
                      <input id="member-expiry" type="date" className={input} value={addUntil} required={addRole === "guest"} onChange={e => setAddUntil(e.target.value)} /></div>
                    <div className="flex items-end"><button className={btn} disabled={busy || !pendingCount}><UserPlus className="h-4 w-4" />{pendingCount > 1 ? `Add ${pendingCount} people` : "Add"}</button></div>
                  </div>
                  <p className="text-xs text-slate-500">{ROLE_HELP.find(([c]) => c === addRole)?.[1]}{addRole === "guest" ? ` Guests can be added for up to ${ctx.policy.guest_max_days} days.` : ""}</p>
                </form>
              )}
            </div>

            <div className={card}>
              <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100"><FolderOpen className="h-4 w-4" />Shared AI projects</h3>
              <p className="mb-3 text-xs text-slate-500">Members get access in RADAI Intelligence automatically. Reviewers and guests are always read-only.</p>
              {team.workspaces.length === 0 && <p className="text-sm text-slate-500">No AI projects shared with this team yet.</p>}
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {team.workspaces.map(w => (
                  <li key={w.workspace_id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-200"><FolderOpen className="h-4 w-4" /></span>
                      <div className="min-w-0"><div className="truncate font-medium">{w.workspace_name}</div><div className="text-xs text-slate-500">Owner {w.owner?.name || w.owner?.email} · {w.synced_members} member(s) given access</div></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link to={`/radai-intelligence?project=${w.workspace_id}`} className={btnGhost}><ExternalLink className="h-4 w-4" />Open</Link>
                      {(team.can_link || w.owner?.id === ctx.me) ? (
                        <select className={`${input} !w-auto`} value={w.role} disabled={busy} aria-label={`Team access to ${w.workspace_name}`}
                          onChange={async e => {
                            if (await run(() => updateSharedWorkspace(team.id, w.workspace_id, { role: e.target.value }), "Access updated.")) loadTeam(team.id);
                          }}>
                          <option value="viewer">Viewer</option><option value="editor">Editor</option>
                        </select>
                      ) : <Badge>{w.role === "editor" ? "Editor" : "Viewer"}</Badge>}
                      {team.can_link && (
                        <button type="button" className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950" disabled={busy} aria-label={`Stop sharing ${w.workspace_name}`}
                          onClick={async () => {
                            if (!window.confirm(`Stop sharing "${w.workspace_name}" with ${team.name}?`)) return;
                            if (await run(() => unshareWorkspace(team.id, w.workspace_id), "AI project unshared.") !== undefined) { loadTeam(team.id); reload(); }
                          }}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {team.can_link && (
                shareable.length ? (
                  <form onSubmit={onShare} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-[1fr_160px_auto] dark:border-slate-800">
                    <div><label className={label} htmlFor="share-ws">One of your AI projects</label>
                      <select id="share-ws" className={input} value={share.workspace_id} onChange={e => setShare({ ...share, workspace_id: e.target.value })} required>
                        <option value="">Choose…</option>
                        {shareable.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select></div>
                    <div><label className={label} htmlFor="share-role">Team access</label>
                      <select id="share-role" className={input} value={share.role} onChange={e => setShare({ ...share, role: e.target.value })}>
                        <option value="viewer">Viewer</option><option value="editor">Editor</option>
                      </select></div>
                    <div className="flex items-end"><button className={btn} disabled={busy || !share.workspace_id}><Plus className="h-4 w-4" />Share</button></div>
                  </form>
                ) : <p className="mt-3 text-xs text-slate-500">Only the owner of an AI project can share it. Create one in RADAI Intelligence first.</p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ Audit tab
const AUDIT_RANGES = [["1", "Last 24 hours"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["custom", "Custom dates"]];
const prettyAction = a => (a || "").replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
const actionTone = row => {
  const a = row.action || "";
  if (/delete|revoke|disable/.test(a)) return "red";
  if (row.is_security) return "amber";
  if (/create|upload|grant|assign|enable/.test(a)) return "emerald";
  if (/update|set|change|reset/.test(a)) return "sky";
  return "slate";
};
const AUDIT_TONES = { ...BADGE_TONES, emerald: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" };
const isEmpty = v => v == null || (typeof v === "object" && !Object.keys(v).length) || v === "";

function AuditDetail({ row }) {
  const block = "max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-3 font-mono text-[11px] text-slate-700 dark:bg-slate-950 dark:text-slate-300";
  const { organization_id: _org, ...meta } = row.metadata || {};
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3 text-xs">
        <div><div className={label}>Event</div><div>{prettyAction(row.action)} · {row.resource_type || "—"}{row.resource_repr ? ` · ${row.resource_repr}` : ""}</div></div>
        <div><div className={label}>When</div><div>{fmt(row.timestamp)}</div></div>
        <div><div className={label}>From</div><div>{row.ip_address || "Unknown address"}</div><div className="mt-0.5 text-slate-500">{row.user_agent || "No browser details recorded"}</div></div>
        {!row.success && <div><div className={label}>Error</div><div className="text-red-700 dark:text-red-300">{row.error_message || "Failed without an error message."}</div></div>}
      </div>
      <div className="space-y-3">
        {!isEmpty(row.changes) && <div><div className={label}>Changes</div><pre className={block}>{JSON.stringify(row.changes, null, 2)}</pre></div>}
        <div><div className={label}>Details</div>{isEmpty(meta) ? <p className="text-xs text-slate-500">No extra details recorded.</p> : <pre className={block}>{JSON.stringify(meta, null, 2)}</pre>}</div>
      </div>
    </div>
  );
}
AuditDetail.propTypes = { row: PropTypes.object.isRequired };

function AuditTab({ ctx, setFlash }) {
  const [range, setRange] = useState("7");
  const [custom, setCustom] = useState({ since: "", until: "" });
  const [filters, setFilters] = useState({ q: "", action: "", resource_type: "", security: false, failed: false, hide_routine: true });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ count: 0, results: [], page_size: 50 });
  const [summary, setSummary] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(false);
  const allowed = ctx.capabilities.view_audit && RANK[ctx.edition.effective_edition] >= RANK.enterprise;

  // Debounce the free-text search so typing doesn't fire a request per key.
  useEffect(() => { const t = setTimeout(() => setFilters(f => ({ ...f, q: search.trim() })), 350); return () => clearTimeout(t); }, [search]);

  const params = useMemo(() => {
    const out = {};
    if (range === "custom") {
      if (custom.since) out.since = `${custom.since}T00:00:00`;
      if (custom.until) out.until = custom.until;
    } else {
      out.since = new Date(Date.now() - Number(range) * DAY_MS).toISOString();
    }
    for (const [k, v] of Object.entries(filters)) if (v) out[k] = v === true ? "1" : v;
    return out;
  }, [range, custom, filters]);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    setExpanded(null);
    try {
      const [list, totals] = await Promise.all([
        listAuditLogs({ ...params, page: p, page_size: 50 }),
        p === 1 ? getAuditSummary(params) : Promise.resolve(null),
      ]);
      setData(list);
      if (totals) setSummary(totals);
      setPage(p);
    } catch (error) {
      setFlash({ tone: "error", text: enterpriseError(error) });
    } finally {
      setLoading(false);
    }
  }, [params, setFlash]);

  useEffect(() => { if (allowed) load(1); }, [allowed, load]);

  if (RANK[ctx.edition.effective_edition] < RANK.enterprise) return <UpgradeHint needed="enterprise" />;
  if (!ctx.capabilities.view_audit) return <Notice>Audit access is limited to owners, admins, security officers and auditors.</Notice>;
  const pages = Math.max(1, Math.ceil(data.count / data.page_size));
  // One bar per calendar day in the period (days with no events show as empty), capped at 120 days.
  const days = (() => {
    if (!summary) return [];
    const counts = Object.fromEntries(summary.by_day.map(d => [d.date, d.count]));
    const end = summary.until ? new Date(summary.until) : new Date();
    const start = new Date(summary.since);
    const out = [];
    for (let d = new Date(Math.max(start.getTime(), end.getTime() - 119 * DAY_MS)); d <= end; d = new Date(d.getTime() + DAY_MS)) {
      const key = d.toISOString().slice(0, 10);
      out.push({ date: key, count: counts[key] || 0 });
    }
    return out;
  })();
  const maxDay = Math.max(1, ...days.map(d => d.count));
  const toggle = (key, text) => (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
      <input type="checkbox" className="h-4 w-4" checked={filters[key]} onChange={e => setFilters({ ...filters, [key]: e.target.checked })} />{text}
    </label>
  );

  return (
    <div className="space-y-5">
      {summary && (
        <div className={card}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat icon={Activity} value={summary.total} label="Events" />
            <Stat icon={ShieldAlert} value={summary.security} label="Security events" tone="amber" />
            <Stat icon={XCircle} value={summary.failed} label="Failed" tone="amber" />
            <Stat icon={Users} value={summary.people} label="People" />
          </div>
          <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_260px]">
            <div>
              <div className={label}>Activity per day</div>
              {summary.total ? (
                <div className="flex h-24 items-end gap-[3px]" role="img" aria-label="Events per day">
                  {days.map(d => (
                    <div key={d.date} className="group relative flex-1">
                      <div className="w-full rounded-t bg-sky-500/70 transition-colors group-hover:bg-sky-600 dark:bg-sky-400/60" style={{ height: `${d.count ? Math.max(4, (d.count / maxDay) * 96) : 2}px` }} />
                      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[11px] text-white group-hover:block">{dateOnly(d.date)}: {d.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500">No activity in this period.</p>}
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs lg:grid-cols-1">
              <div><div className={label}>Top actions</div>
                <ul className="space-y-1">{summary.top_actions.map(a => (
                  <li key={a.value}><button type="button" className="flex w-full justify-between gap-2 hover:text-sky-700 dark:hover:text-sky-300" onClick={() => setFilters({ ...filters, action: a.value })}><span className="truncate">{prettyAction(a.value)}</span><span className="text-slate-500">{a.count.toLocaleString()}</span></button></li>
                ))}</ul></div>
              <div><div className={label}>Most active</div>
                <ul className="space-y-1">{summary.top_users.map(u => (
                  <li key={u.value}><button type="button" className="flex w-full justify-between gap-2 hover:text-sky-700 dark:hover:text-sky-300" onClick={() => setSearch(u.value)}><span className="truncate">{u.value || "System"}</span><span className="text-slate-500">{u.count.toLocaleString()}</span></button></li>
                ))}</ul></div>
            </div>
          </div>
        </div>
      )}

      <div className={card}>
        <div className="mb-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_170px_170px_170px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className={`${input} pl-9`} placeholder="Search people, actions or records" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search audit log" />
            </div>
            <select className={input} value={range} onChange={e => setRange(e.target.value)} aria-label="Period">
              {AUDIT_RANGES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
            <select className={input} value={filters.action} onChange={e => setFilters({ ...filters, action: e.target.value })} aria-label="Action">
              <option value="">All actions</option>
              {(summary?.actions || []).map(a => <option key={a} value={a}>{prettyAction(a)}</option>)}
            </select>
            <select className={input} value={filters.resource_type} onChange={e => setFilters({ ...filters, resource_type: e.target.value })} aria-label="Resource">
              <option value="">All resources</option>
              {(summary?.resource_types || []).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {range === "custom" && (
            <div className="grid max-w-md grid-cols-2 gap-3">
              <div><label className={label} htmlFor="audit-from">From</label><input id="audit-from" type="date" className={input} value={custom.since} onChange={e => setCustom({ ...custom, since: e.target.value })} /></div>
              <div><label className={label} htmlFor="audit-to">To</label><input id="audit-to" type="date" className={input} value={custom.until} onChange={e => setCustom({ ...custom, until: e.target.value })} /></div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {toggle("security", "Security events only")}
            {toggle("failed", "Failed only")}
            {toggle("hide_routine", "Hide routine reads")}
            <div className="ml-auto flex gap-2">
              {(filters.action || filters.resource_type || search || filters.security || filters.failed) && (
                <button type="button" className={btnGhost} onClick={() => { setSearch(""); setFilters({ q: "", action: "", resource_type: "", security: false, failed: false, hide_routine: filters.hide_routine }); }}>Clear filters</button>
              )}
              <button type="button" className={btnGhost} disabled={loading} title="Export these events as CSV (up to 10,000 rows)"
                onClick={() => exportAuditLogs(params).catch(error => setFlash({ tone: "error", text: enterpriseError(error) }))}>
                <Download className="h-4 w-4" />Export CSV
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr><th className="w-6" /><th className="py-2 pr-4">When</th><th className="py-2 pr-4">Who</th><th className="py-2 pr-4">Action</th><th className="py-2 pr-4">Record</th><th className="py-2 pr-4">IP</th><th className="py-2">Result</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.results.map(r => {
                const open = expanded === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 ${open ? "bg-slate-50 dark:bg-slate-800/60" : ""}`} onClick={() => setExpanded(open ? null : r.id)}
                      aria-expanded={open} tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(open ? null : r.id); } }}>
                      <td className="py-2 pl-1 text-slate-400">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                      <td className="whitespace-nowrap py-2 pr-4">{fmt(r.timestamp)}</td>
                      <td className="max-w-[220px] truncate py-2 pr-4">{r.user_email || "System"}</td>
                      <td className="py-2 pr-4"><span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${AUDIT_TONES[actionTone(r)]}`}>{prettyAction(r.action)}</span></td>
                      <td className="max-w-[280px] py-2 pr-4"><div className="truncate">{r.resource_repr || "—"}</div><div className="truncate text-xs text-slate-500">{r.resource_type}</div></td>
                      <td className="py-2 pr-4 text-xs">{r.ip_address || "—"}</td>
                      <td className="py-2">{r.success ? <span className="text-emerald-700 dark:text-emerald-300">OK</span> : <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-300"><XCircle className="h-3.5 w-3.5" />Failed</span>}</td>
                    </tr>
                    {open && <tr><td colSpan={7} className="bg-slate-50/60 px-4 py-4 dark:bg-slate-900/60"><AuditDetail row={r} /></td></tr>}
                  </Fragment>
                );
              })}
              {!loading && data.results.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-slate-500">No audit events match these filters.</td></tr>}
              {loading && data.results.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-slate-500">Loading…</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-300">
          <span>{data.count.toLocaleString()} events{filters.hide_routine ? " (routine reads hidden)" : ""}</span>
          <div className="flex gap-2">
            <button type="button" className={btnGhost} disabled={loading || page <= 1} onClick={() => load(page - 1)}>Previous</button>
            <span className="self-center">Page {page} of {pages}</span>
            <button type="button" className={btnGhost} disabled={loading || page >= pages} onClick={() => load(page + 1)}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Organization tab
const ORG_ROLE_HELP = {
  owner: "Full control, including granting other owners.",
  admin: "Manages teams, admins and policy.",
  security: "Changes the security policy and reads the audit log.",
  auditor: "Read-only access to policy and the audit log.",
};
const POSTURE_TONES = {
  enforced: ["emerald", "Enforced"],
  off: ["slate", "Off"],
  recorded: ["amber", "Recorded only"],
  manual: ["sky", "Manual clean-up"],
};

function PostureRow({ icon: Icon, title, detail, state }) {
  const [tone, text] = POSTURE_TONES[state];
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1"><div className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</div><div className="truncate text-xs text-slate-500">{detail}</div></div>
      <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${AUDIT_TONES[tone]}`}>{text}</span>
    </li>
  );
}
PostureRow.propTypes = { icon: PropTypes.elementType.isRequired, title: PropTypes.string.isRequired, detail: PropTypes.string.isRequired, state: PropTypes.string.isRequired };

function PolicyToggle({ checked, disabled, onChange, title, hint, recordedOnly }) {
  return (
    <label className="flex items-start gap-3 py-2">
      <input type="checkbox" className="mt-1 h-4 w-4" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span>
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">{title}{recordedOnly && <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${AUDIT_TONES.amber}`}>Recorded only</span>}</span>
        <span className="text-xs text-slate-500">{hint}</span>
      </span>
    </label>
  );
}
PolicyToggle.propTypes = { checked: PropTypes.bool, disabled: PropTypes.bool, onChange: PropTypes.func.isRequired, title: PropTypes.string.isRequired, hint: PropTypes.string, recordedOnly: PropTypes.bool };

const policyState = p => ({
  require_mfa: p.require_mfa, allow_external_guests: p.allow_external_guests, guest_max_days: p.guest_max_days,
  ai_outputs_require_approval: p.ai_outputs_require_approval, data_residency_region: p.data_residency_region || "",
  allow_web_search: !!p.allow_web_search,
  data_retention_days: p.data_retention_days ?? "", session_timeout_minutes: p.session_timeout_minutes ?? "",
  allowed_chat_models: [...(p.allowed_chat_models || [])], allowed_ip_ranges: (p.allowed_ip_ranges || []).join("\n"),
});

function OrganizationTab({ ctx, reload, setFlash }) {
  const caps = ctx.capabilities;
  const isEnterprise = RANK[ctx.edition.effective_edition] >= RANK.enterprise;
  const canSeePolicy = caps.manage_policy || caps.view_audit;
  const [edition, setEdition] = useState({
    edition: ctx.edition.edition, seat_limit: ctx.edition.seat_limit ?? "", max_teams: ctx.edition.max_teams ?? "",
    valid_until: ctx.edition.valid_until ? ctx.edition.valid_until.slice(0, 10) : "",
  });
  const p = ctx.policy;
  const initial = useMemo(() => policyState(p), [p]);
  const [policy, setPolicy] = useState(initial);
  const [customModel, setCustomModel] = useState("");
  const [models, setModels] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [newAdmin, setNewAdmin] = useState({ email: "", role: "admin" });
  const [busy, setBusy] = useState(false);
  const [retention, setRetention] = useState(null);
  const canEditPolicy = caps.manage_policy && isEnterprise;
  const dirty = JSON.stringify(policy) !== JSON.stringify(initial);
  const set = patch => setPolicy(prev => ({ ...prev, ...patch }));

  const loadAdmins = useCallback(() => {
    if (caps.manage_org || caps.view_audit) listOrgAdmins().then(r => setAdmins(r.results || [])).catch(() => setAdmins([]));
  }, [caps.manage_org, caps.view_audit]);
  useEffect(loadAdmins, [loadAdmins]);
  useEffect(() => {
    if (!isEnterprise || !canSeePolicy) return;
    listOrgModels().then(r => setModels(r.models || [])).catch(() => setModels([]));
  }, [isEnterprise, canSeePolicy]);
  useEffect(() => {
    if (!isEnterprise || !canSeePolicy || !p.data_retention_days) { setRetention(null); return; }
    getRetentionPreview().then(setRetention).catch(() => setRetention(null));
  }, [isEnterprise, canSeePolicy, p.data_retention_days]);

  const save = async (fn, ok) => {
    setBusy(true);
    try { await fn(); setFlash({ tone: "success", text: ok }); await reload(); return true; }
    catch (error) { setFlash({ tone: "error", text: enterpriseError(error) }); return false; }
    finally { setBusy(false); }
  };
  const lines = v => v.split("\n").map(s => s.trim()).filter(Boolean);
  const savePolicy = () => save(() => updatePolicy({
    require_mfa: policy.require_mfa, allow_external_guests: policy.allow_external_guests,
    ai_outputs_require_approval: policy.ai_outputs_require_approval, guest_max_days: policy.guest_max_days,
    allow_web_search: policy.allow_web_search,
    data_residency_region: policy.data_residency_region, data_retention_days: policy.data_retention_days || null,
    session_timeout_minutes: policy.session_timeout_minutes || null,
    allowed_chat_models: policy.allowed_chat_models, allowed_ip_ranges: lines(policy.allowed_ip_ranges),
  }), "Security and governance policy saved.");

  const modelKey = m => m.model_id;
  const toggleModel = id => set({ allowed_chat_models: policy.allowed_chat_models.includes(id) ? policy.allowed_chat_models.filter(x => x !== id) : [...policy.allowed_chat_models, id] });
  const configuredIds = new Set(models.map(modelKey));
  const extraModels = policy.allowed_chat_models.filter(id => !configuredIds.has(id) && !configuredIds.has(id.split(":").slice(1).join(":")));
  const addMyIp = () => {
    if (!ctx.your_ip) return;
    const cidr = ctx.your_ip.includes(":") ? `${ctx.your_ip}/128` : `${ctx.your_ip}/32`;
    if (!lines(policy.allowed_ip_ranges).includes(cidr)) set({ allowed_ip_ranges: [...lines(policy.allowed_ip_ranges), cidr].join("\n") });
  };

  const seatsUsed = ctx.edition.seats_in_use;
  const seatLimit = ctx.edition.seat_limit;
  const daysLeft = ctx.edition.valid_until ? Math.ceil((new Date(ctx.edition.valid_until).getTime() - Date.now()) / DAY_MS) : null;
  const saved = p; // posture shows what is saved (and therefore enforced), not unsaved edits
  const savedRanges = saved.allowed_ip_ranges || [];
  const savedModels = saved.allowed_chat_models || [];
  const section = "space-y-1 rounded-xl border border-slate-200 p-4 dark:border-slate-700";
  const sectionTitle = "mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100";

  return (
    <div className="space-y-5">
      {isEnterprise && canSeePolicy && (
        <div className={card}>
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4" />Security posture</h3>
          <p className="text-xs text-slate-500">What your organization&apos;s saved policy does right now.</p>
          <ul className="mt-2 grid divide-y divide-slate-100 md:grid-cols-2 md:gap-x-8 md:divide-y-0 dark:divide-slate-800">
            <PostureRow icon={Clock} title="Session timeout" state={saved.session_timeout_minutes ? "enforced" : "off"}
              detail={saved.session_timeout_minutes ? `Signed out after ${saved.session_timeout_minutes} minutes of inactivity` : "Standard 24-hour sign-in"} />
            <PostureRow icon={Globe} title="Allowed networks" state={savedRanges.length ? "enforced" : "off"}
              detail={savedRanges.length ? `${savedRanges.length} IP range${savedRanges.length === 1 ? "" : "s"}: ${savedRanges.slice(0, 2).join(", ")}${savedRanges.length > 2 ? "…" : ""}` : "Any network"} />
            <PostureRow icon={Bot} title="Approved AI models" state={savedModels.length ? "enforced" : "off"}
              detail={savedModels.length ? savedModels.join(", ") : "Every configured model is allowed"} />
            <PostureRow icon={Globe} title="Web search" state={saved.allow_web_search ? "enforced" : "off"}
              detail={saved.allow_web_search ? "Allowed with Claude; every search is in the audit log" : "Not allowed: answers use project data only"} />
            <PostureRow icon={Archive} title="Data retention" state={saved.data_retention_days ? "manual" : "off"}
              detail={saved.data_retention_days ? `RADAI Intelligence chats older than ${saved.data_retention_days} days${retention?.enabled ? ` · ${retention.conversations} ready to delete` : ""}` : "Chats are kept"} />
            <PostureRow icon={UserPlus} title="External guests" state="enforced"
              detail={saved.allow_external_guests ? `Allowed, read-only, up to ${saved.guest_max_days} days` : "Not allowed"} />
            <PostureRow icon={KeyRound} title="Multi-factor sign-in" state={saved.require_mfa ? "recorded" : "off"}
              detail={saved.require_mfa ? "Required by policy, not yet enforced at sign-in" : "Not required"} />
            <PostureRow icon={BadgeCheck} title="AI output approval" state={saved.ai_outputs_require_approval ? "recorded" : "off"}
              detail={saved.ai_outputs_require_approval ? "Required by policy, review workflow not built yet" : "Not required"} />
            <PostureRow icon={MapPin} title="Data residency" state={saved.data_residency_region ? "recorded" : "off"}
              detail={saved.data_residency_region ? `Region: ${saved.data_residency_region.toUpperCase()} (hosting decision)` : "No region set"} />
          </ul>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <div className={card}>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Building2 className="h-4 w-4" />Edition and seats</h3>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{EDITION_LABEL[ctx.edition.effective_edition]}</span>
            <span className="text-sm text-slate-500">
              {ctx.edition.valid_until ? (daysLeft > 0 ? `Valid until ${dateOnly(ctx.edition.valid_until)} · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : `Expired ${dateOnly(ctx.edition.valid_until)}`) : "No end date"}
            </span>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-500"><span>Team seats</span><span>{seatsUsed}{seatLimit ? ` of ${seatLimit}` : " (unlimited)"}</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className={`h-full rounded-full ${seatLimit && seatsUsed / seatLimit >= 0.9 ? "bg-amber-500" : "bg-sky-600"}`} style={{ width: `${seatLimit ? Math.min(100, (seatsUsed / seatLimit) * 100) : seatsUsed ? 8 : 0}%` }} />
            </div>
            <div className="mt-3 flex justify-between text-xs text-slate-500"><span>Teams</span><span>{ctx.edition.team_count}{ctx.edition.max_teams ? ` of ${ctx.edition.max_teams}` : " (unlimited)"}</span></div>
          </div>
          {caps.platform_admin && (
            <form className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 dark:border-slate-800"
              onSubmit={e => { e.preventDefault(); save(() => updateEdition({ ...edition, valid_until: edition.valid_until || null }), "Edition updated."); }}>
              <div><label className={label} htmlFor="ed">Edition</label>
                <select id="ed" className={input} value={edition.edition} onChange={e => setEdition({ ...edition, edition: e.target.value })}>
                  {ctx.choices.editions.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                </select></div>
              <div><label className={label} htmlFor="vu">Valid until</label>
                <input id="vu" type="date" className={input} value={edition.valid_until} onChange={e => setEdition({ ...edition, valid_until: e.target.value })} /></div>
              <div><label className={label} htmlFor="sl">Seat limit</label>
                <input id="sl" type="number" min="1" className={input} placeholder="Unlimited" value={edition.seat_limit} onChange={e => setEdition({ ...edition, seat_limit: e.target.value })} /></div>
              <div><label className={label} htmlFor="mt">Max teams</label>
                <input id="mt" type="number" min="1" className={input} placeholder="Unlimited" value={edition.max_teams} onChange={e => setEdition({ ...edition, max_teams: e.target.value })} /></div>
              <div className="sm:col-span-2"><button className={btn} disabled={busy}>Save edition</button>
                <span className="ml-3 text-xs text-slate-500">Only platform administrators can change this.</span></div>
            </form>
          )}
        </div>

        <div className={card}>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4" />Organization admins</h3>
          {!(caps.manage_org || caps.view_audit) ? <p className="text-sm text-slate-500">Visible to organization admins only.</p> : (
            <>
              <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {admins.length === 0 && <li className="py-2 text-slate-500">No named admins yet. RBAC super admins, admins and ICT admins act as organization admins.</li>}
                {admins.map(a => (
                  <li key={a.id} className="flex items-center gap-3 py-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-semibold dark:bg-slate-800" aria-hidden="true">{initials(a.user.name, a.user.email)}</span>
                    <div className="min-w-0 flex-1"><div className="truncate font-medium">{a.user.name || a.user.email}</div><div className="truncate text-xs text-slate-500">{a.user.email}</div></div>
                    <Badge tone={a.role === "owner" ? "violet" : a.role === "auditor" ? "slate" : "sky"}>{ctx.choices.org_roles.find(([c]) => c === a.role)?.[1] || a.role}</Badge>
                    {caps.manage_org && (
                      <button type="button" className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950" aria-label={`Remove ${a.user.email} as ${a.role}`} disabled={busy}
                        onClick={() => window.confirm(`Remove ${a.user.email} as ${a.role}?`) && save(() => removeOrgAdmin(a.id), "Admin role removed.").then(loadAdmins)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {caps.manage_org && (
                <form className="mt-4 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800"
                  onSubmit={e => { e.preventDefault(); save(() => addOrgAdmin(newAdmin), "Admin role granted.").then(ok => { if (ok) { setNewAdmin({ email: "", role: "admin" }); loadAdmins(); } }); }}>
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <input type="email" className={`${input} sm:col-span-2`} placeholder="name@rejlers.ae" value={newAdmin.email} required aria-label="Admin email"
                      onChange={e => setNewAdmin({ ...newAdmin, email: e.target.value })} />
                    <select className={input} value={newAdmin.role} aria-label="Admin role" onChange={e => setNewAdmin({ ...newAdmin, role: e.target.value })}>
                      {ctx.choices.org_roles.filter(([c]) => c !== "owner" || caps.grant_owner).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                    </select>
                    <button className={btn} disabled={busy || !newAdmin.email.trim()}>Grant</button>
                  </div>
                  <p className="text-xs text-slate-500">{ORG_ROLE_HELP[newAdmin.role]}</p>
                </form>
              )}
            </>
          )}
        </div>
      </div>

      <form className={card} onSubmit={e => { e.preventDefault(); savePolicy(); }}>
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold"><Lock className="h-4 w-4" />Security and governance policy</h3>
        {!isEnterprise && <div className="my-3"><UpgradeHint needed="enterprise" /></div>}
        {isEnterprise && !caps.manage_policy && <p className="mb-2 text-xs text-slate-500">Read-only: only owners, admins and security officers can change policy.</p>}
        {isEnterprise && caps.manage_policy && <p className="mb-3 text-xs text-slate-500">Changes apply within a minute of saving. Every change is recorded in the audit log.</p>}

        {canSeePolicy ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className={section}>
              <h4 className={sectionTitle}><KeyRound className="h-4 w-4" />Sign-in and access</h4>
              <PolicyToggle checked={policy.require_mfa} disabled={!canEditPolicy} onChange={v => set({ require_mfa: v })} recordedOnly
                title="Require multi-factor sign-in" hint="Recorded for now: RADAI's sign-in doesn't support MFA yet." />
              <div className="pt-1"><label className={label} htmlFor="sto">Session timeout (minutes)</label>
                <input id="sto" type="number" min="5" max="1440" className={input} disabled={!canEditPolicy} placeholder="Off (24-hour sign-in)" value={policy.session_timeout_minutes} onChange={e => set({ session_timeout_minutes: e.target.value })} />
                <p className="mt-1 text-xs text-slate-500">People are signed out after this long without activity. 5 to 1440.</p></div>
              <div className="pt-3"><div className="flex items-end justify-between"><label className={label} htmlFor="ipr">Allowed IP ranges (CIDR, one per line)</label>
                {canEditPolicy && ctx.your_ip && <button type="button" className="mb-1 text-xs text-sky-700 hover:underline dark:text-sky-300" onClick={addMyIp}>Add my address</button>}</div>
                <textarea id="ipr" rows={3} className={`${input} font-mono`} disabled={!canEditPolicy} placeholder="Empty = any network" value={policy.allowed_ip_ranges} onChange={e => set({ allowed_ip_ranges: e.target.value })} />
                {ctx.your_ip && <p className="mt-1 text-xs text-slate-500">Your current address is {ctx.your_ip}. The list must include it, or saving is refused so you can&apos;t lock yourself out. Platform administrators are always allowed in.</p>}</div>
            </section>

            <section className={section}>
              <h4 className={sectionTitle}><Bot className="h-4 w-4" />AI governance</h4>
              <div className={label}>Approved AI models</div>
              <p className="mb-2 text-xs text-slate-500">{policy.allowed_chat_models.length ? "Only the selected models can be used in RADAI Intelligence." : "None selected: every configured model is allowed."}</p>
              <div className="flex flex-wrap gap-2">
                {models.map(m => {
                  const on = policy.allowed_chat_models.includes(m.model_id);
                  return (
                    <button key={`${m.provider}:${m.model_id}`} type="button" disabled={!canEditPolicy} onClick={() => toggleModel(m.model_id)} aria-pressed={on}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${on ? "border-sky-600 bg-sky-50 text-sky-900 dark:border-sky-400 dark:bg-sky-950 dark:text-sky-100" : "border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"}`}>
                      {on && <Check className="h-3 w-3" />}{m.label}<span className="text-slate-400">{m.provider}</span>
                    </button>
                  );
                })}
                {extraModels.map(id => (
                  <span key={id} className="inline-flex items-center gap-1 rounded-full border border-sky-600 bg-sky-50 py-1 pl-3 pr-1 text-xs text-sky-900 dark:border-sky-400 dark:bg-sky-950 dark:text-sky-100" title="Not configured on this server yet">
                    {id}{canEditPolicy && <button type="button" aria-label={`Remove ${id}`} className="rounded-full p-0.5 hover:bg-sky-100 dark:hover:bg-sky-900" onClick={() => toggleModel(id)}><X className="h-3 w-3" /></button>}
                  </span>
                ))}
                {!models.length && !extraModels.length && <p className="text-xs text-slate-500">No chat models are configured on this server yet.</p>}
              </div>
              {canEditPolicy && (
                <div className="flex gap-2 pt-2">
                  <input className={input} placeholder="Other model ID, e.g. claude-sonnet-4-6" value={customModel} onChange={e => setCustomModel(e.target.value)} aria-label="Other model ID" />
                  <button type="button" className={btnGhost} disabled={!customModel.trim()} onClick={() => { if (!policy.allowed_chat_models.includes(customModel.trim())) toggleModel(customModel.trim()); setCustomModel(""); }}>Add</button>
                </div>
              )}
              <div className="pt-2">
                <PolicyToggle checked={policy.allow_web_search} disabled={!canEditPolicy} onChange={v => set({ allow_web_search: v })}
                  title="Allow web search" hint="People can let RADAI search the public web (Claude models only). Questions leave RADAI, so searches avoid project details and every search is audit-logged." />
                <PolicyToggle checked={policy.ai_outputs_require_approval} disabled={!canEditPolicy} onChange={v => set({ ai_outputs_require_approval: v })} recordedOnly
                  title="AI outputs need engineer approval" hint="AI findings stay draft until a named engineer approves them." />
              </div>
            </section>

            <section className={section}>
              <h4 className={sectionTitle}><Archive className="h-4 w-4" />Data</h4>
              <div><label className={label} htmlFor="ret">Retention for RADAI Intelligence chats (days)</label>
                <input id="ret" type="number" min="30" className={input} disabled={!canEditPolicy} placeholder="Keep chats" value={policy.data_retention_days} onChange={e => set({ data_retention_days: e.target.value })} />
                {retention?.enabled
                  ? <p className="mt-1 text-xs text-slate-500">Preview: {retention.conversations} chats ({retention.messages} messages, {retention.files} files) have had no activity for {retention.retention_days}+ days. Nothing is deleted until an administrator runs the clean-up.</p>
                  : <p className="mt-1 text-xs text-slate-500">At least 30 days. Old chats are only deleted when an administrator runs the clean-up.</p>}</div>
              <div className="pt-3"><label className={label} htmlFor="drr">Data residency region</label>
                <input id="drr" className={input} disabled={!canEditPolicy} placeholder="uae" value={policy.data_residency_region} onChange={e => set({ data_residency_region: e.target.value })} />
                <p className="mt-1 text-xs text-slate-500">For your records: where the data must be hosted is a hosting decision.</p></div>
            </section>

            <section className={section}>
              <h4 className={sectionTitle}><UserPlus className="h-4 w-4" />External guests</h4>
              <PolicyToggle checked={policy.allow_external_guests} disabled={!canEditPolicy} onChange={v => set({ allow_external_guests: v })}
                title="Allow external guests" hint="Clients and contractors get time-limited, read-only access to a team's shared AI projects." />
              <div className="pt-1"><label className={label} htmlFor="gmd">Longest guest access (days)</label>
                <input id="gmd" type="number" min="1" max="365" className={input} disabled={!canEditPolicy || !policy.allow_external_guests} value={policy.guest_max_days} onChange={e => set({ guest_max_days: e.target.value })} /></div>
            </section>
          </div>
        ) : <p className="text-sm text-slate-500">Policy details are visible to owners, admins, security officers and auditors.</p>}

        {p.updated_at && <p className="mt-3 text-xs text-slate-500">Last changed {fmt(p.updated_at)}{p.updated_by ? ` by ${p.updated_by.email}` : ""}</p>}
        {canEditPolicy && (
          <div className={`sticky bottom-0 -mx-5 -mb-5 mt-4 flex flex-wrap items-center justify-end gap-3 rounded-b-xl border-t px-5 py-3 ${dirty ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950" : "border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900"}`}>
            {dirty && <span className="mr-auto text-sm text-amber-900 dark:text-amber-100">You have unsaved changes.</span>}
            {dirty && <button type="button" className={btnGhost} disabled={busy} onClick={() => setPolicy(initial)}>Discard</button>}
            <button className={btn} disabled={busy || !dirty}>Save policy</button>
          </div>
        )}
      </form>
    </div>
  );
}

// ------------------------------------------------------------------ Page
const SECTIONS = [
  { id: "teams", name: "Teams", icon: Users, blurb: "People, roles and shared AI projects" },
  { id: "org", name: "Organization & security", icon: ShieldCheck, blurb: "Edition, admins and security policy" },
  { id: "audit", name: "Audit log", icon: ScrollText, blurb: "Who did what, and when" },
];

// `embedded`: inside a page that already provides padding.
// `fullscreen`: a full-window console over the whole app (RADAI Intelligence opens it this way); `onClose` leaves it.
export default function TeamsGovernancePage({ embedded = false, fullscreen = false, onClose }) {
  const pad = embedded ? "" : "p-6";
  const [ctx, setCtx] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("teams");
  const [flash, setFlash] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    try { setCtx(await getEnterpriseContext()); setError(""); }
    catch (e) { setError(enterpriseError(e)); }
  }, []);
  const refresh = async () => { setRefreshing(true); await reload(); setRefreshing(false); };

  useEffect(() => { if (FLAG_ON) reload(); }, [reload]);
  useEffect(() => { if (!flash) return undefined; const t = setTimeout(() => setFlash(null), 6000); return () => clearTimeout(t); }, [flash]);
  // Full-window mode: Esc closes, and the page underneath doesn't scroll.
  useEffect(() => {
    if (!fullscreen) return undefined;
    const onKey = e => { if (e.key === "Escape" && !e.defaultPrevented && !document.querySelector("dialog[open]")) onClose?.(); };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = previous; };
  }, [fullscreen, onClose]);

  const status = !FLAG_ON || ctx?.enabled === false
    ? <Notice>Team & Enterprise features are not enabled on this environment.</Notice>
    : error ? <Notice tone="error">{error}</Notice>
      : !ctx ? <div className="text-sm text-slate-500">Loading…</div> : null;

  const content = ctx && !status && (
    <>
      {tab === "teams" && <TeamsTab ctx={ctx} reload={reload} setFlash={setFlash} />}
      {tab === "org" && <OrganizationTab key={ctx.policy.updated_at || "p"} ctx={ctx} reload={reload} setFlash={setFlash} />}
      {tab === "audit" && <AuditTab ctx={ctx} setFlash={setFlash} />}
    </>
  );

  if (fullscreen) {
    const current = SECTIONS.find(s => s.id === tab);
    const counts = ctx && !status ? { teams: ctx.teams.length } : {};
    return (
      <div className="fixed inset-0 z-[90] flex flex-col bg-slate-50 text-slate-900 lg:flex-row dark:bg-slate-950 dark:text-slate-100"
        role="dialog" aria-modal="true" aria-label="Teams and Governance">
        {/* Section rail: a column on large screens, a compact bar on small ones. */}
        <aside className="flex shrink-0 flex-col border-b border-slate-200 bg-white lg:w-72 lg:border-b-0 lg:border-r dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 px-4 py-3 lg:px-5 lg:pt-5">
            <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white">
              <ArrowLeft className="h-4 w-4" />RADAI Intelligence
            </button>
            <button type="button" onClick={onClose} aria-label="Close Teams and Governance" className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
          </div>
          <div className="hidden px-5 pb-4 lg:block">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-800 text-white shadow-md shadow-indigo-500/20"><ShieldCheck className="h-5 w-5" /></span>
              <div><div className="text-base font-semibold leading-tight">Teams & Governance</div><div className="text-xs text-slate-500">RADAI Intelligence</div></div>
            </div>
            {ctx && !status && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="truncate text-sm font-medium">{ctx.organization.name}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200">{EDITION_LABEL[ctx.edition.effective_edition]}</span>
                  <span>{ctx.edition.seats_in_use}{ctx.edition.seat_limit ? `/${ctx.edition.seat_limit}` : ""} seats</span>
                  <span>·</span>
                  <span>{ctx.edition.team_count} teams</span>
                </div>
              </div>
            )}
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-3 lg:pb-0" role="tablist" aria-label="Sections">
            {SECTIONS.map(({ id, name, icon: Icon, blurb }) => {
              const on = tab === id;
              return (
                <button key={id} type="button" role="tab" aria-selected={on} onClick={() => setTab(id)}
                  className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-left lg:py-2.5 ${on ? "bg-sky-50 text-[#0b2e59] ring-1 ring-sky-200 dark:bg-slate-800 dark:text-sky-200 dark:ring-slate-700" : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70"}`}>
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${on ? "bg-white text-[#0b2e59] shadow-sm dark:bg-slate-900 dark:text-sky-200" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 whitespace-nowrap text-sm font-medium">{name}{counts[id] != null && <span className="rounded-full bg-slate-200 px-1.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">{counts[id]}</span>}</span>
                    <span className="hidden truncate text-xs text-slate-500 lg:block">{blurb}</span>
                  </span>
                </button>
              );
            })}
          </nav>
          <div className="hidden border-t border-slate-200 px-5 py-3 text-xs text-slate-500 lg:block dark:border-slate-800">Press <kbd className="rounded border border-slate-300 px-1 font-sans dark:border-slate-600">Esc</kbd> to return to RADAI Intelligence</div>
        </aside>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-8 lg:py-4 dark:border-slate-800 dark:bg-slate-950/90">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold sm:text-xl">{current.name}</h1>
              <p className="hidden truncate text-sm text-slate-500 sm:block">{current.blurb}{ctx && !status ? ` · ${ctx.organization.name}` : ""}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" className={btnGhost} onClick={refresh} disabled={refreshing}><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /><span className="hidden sm:inline">Refresh</span></button>
              <button type="button" onClick={onClose} aria-label="Close Teams and Governance" className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-200 lg:block dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
            </div>
          </header>
          <div className="space-y-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
            {flash && <Notice tone={flash.tone}>{flash.text}</Notice>}
            {status || content}
          </div>
        </main>
      </div>
    );
  }

  if (status) return <div className={`mx-auto max-w-3xl ${pad}`}>{status}</div>;
  return (
    <div className={`mx-auto max-w-7xl space-y-5 ${embedded ? "" : "p-4 md:p-6"}`}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Teams & Governance</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {ctx.organization.name} · <span className="font-medium">{EDITION_LABEL[ctx.edition.effective_edition]} edition</span>
            {" · "}{ctx.edition.seats_in_use}{ctx.edition.seat_limit ? `/${ctx.edition.seat_limit}` : ""} seats
          </p>
        </div>
        <button type="button" className={btnGhost} onClick={refresh} disabled={refreshing}><RefreshCw className="h-4 w-4" />Refresh</button>
      </header>
      {flash && <Notice tone={flash.tone}>{flash.text}</Notice>}
      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-700" role="tablist">
        {SECTIONS.map(({ id, name, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`-mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm sm:px-4 ${
              tab === id ? "border-[#0b2e59] font-medium text-[#0b2e59] dark:border-sky-300 dark:text-sky-200" : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-300"
            }`}>
            <Icon className="h-4 w-4" />{name}
          </button>
        ))}
      </nav>
      {content}
    </div>
  );
}

TeamsGovernancePage.propTypes = { embedded: PropTypes.bool, fullscreen: PropTypes.bool, onClose: PropTypes.func };
