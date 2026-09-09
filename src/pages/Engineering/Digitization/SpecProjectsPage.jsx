/** Controlled project register for Spec Customization. */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon, ArrowPathIcon, ArrowRightIcon, BuildingOffice2Icon, ChartBarIcon,
  CheckIcon, CpuChipIcon, FolderIcon, FolderPlusIcon, KeyIcon, MagnifyingGlassIcon,
  PencilSquareIcon, TrashIcon, XMarkIcon, ArrowsUpDownIcon, ListBulletIcon,
  Squares2X2Icon, WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../../services/api.service';
import specCustomizationAPI from '../../../services/specCustomizationAPI';

const CFG = {
  list: '/spec-customization/projects/',
  detail: (id) => `/spec-customization/projects/${id}/`,
  route: '/engineering/digitization/spec-customization',
  storageKey: 'specCustomActiveProject',
  statuses: [
    { value: 'active', label: 'Active', bg: 'rgba(16,185,129,.12)', color: '#047857' },
    { value: 'on_hold', label: 'On hold', bg: 'rgba(245,158,11,.15)', color: '#b45309' },
    { value: 'completed', label: 'Completed', bg: 'rgba(37,99,235,.12)', color: '#1d4ed8' },
    { value: 'archived', label: 'Archived', bg: 'rgba(100,116,139,.12)', color: '#64748b' },
  ],
};
const getStatus = (value) => CFG.statuses.find((item) => item.value === value) || CFG.statuses[0];

const SpecProjectsPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('cards');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [aiProject, setAiProject] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keyConfigured, setKeyConfigured] = useState(false);
  const [encryptionConfigured, setEncryptionConfigured] = useState(true);
  const [modelChoices, setModelChoices] = useState({ openai: [], claude: [] });
  const [aiForm, setAiForm] = useState({ enabled: false, provider: 'openai', model: 'gpt-4o', api_key: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (query) params.q = query;
      if (status) params.status = status;
      const response = await apiClient.get(CFG.list, { params });
      setProjects(response.data.items || []);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not load projects.');
    } finally { setLoading(false); }
  }, [query, status]);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    total: projects.length,
    active: projects.filter((project) => project.status === 'active').length,
    ai: projects.filter((project) => project.ai_enabled && project.ai_key_configured).length,
    records: projects.reduce((sum, project) => sum + Number(project.job_count || 0) + Number(project.document_count || 0), 0),
  }), [projects]);
  const visibleProjects = useMemo(() => [...projects].sort((left, right) => {
    if (sortBy === 'name') return String(left.name || '').localeCompare(String(right.name || ''));
    if (sortBy === 'activity') return (Number(right.job_count || 0) + Number(right.document_count || 0)) - (Number(left.job_count || 0) + Number(left.document_count || 0));
    return String(right.updated_at || right.created_at || '').localeCompare(String(left.updated_at || left.created_at || ''));
  }), [projects, sortBy]);

  const saveProject = async (payload) => {
    setBusy(true);
    try {
      if (editing) await apiClient.patch(CFG.detail(editing.project_id), payload);
      else await apiClient.post(CFG.list, payload);
      setCreateOpen(false); setEditing(null); await load();
    } catch (err) { alert(err?.response?.data?.error || 'Could not save project.'); }
    finally { setBusy(false); }
  };
  const deleteProject = async (project) => {
    if (!window.confirm(`Delete project "${project.name}"?\nAssociated extractions remain but become unassigned.`)) return;
    setBusy(true);
    try { await apiClient.delete(CFG.detail(project.project_id)); await load(); }
    catch (err) { alert(err?.response?.data?.error || 'Could not delete project.'); }
    finally { setBusy(false); }
  };
  const openProject = (project, stage = 'extract') => {
    try { localStorage.setItem(CFG.storageKey, JSON.stringify({
      project_id: project.project_id, name: project.name, code: project.code,
      plant: project.plant, client: project.client, discipline: project.discipline,
      ai_enabled: project.ai_enabled, ai_provider: project.ai_provider,
      ai_model: project.ai_model, ai_key_configured: project.ai_key_configured,
    })); } catch (_) { /* optional browser persistence */ }
    navigate(`${CFG.route}?stage=${stage}`);
  };
  const openAi = async (project) => {
    setAiProject(project); setAiBusy(true); setAiError(''); setShowKey(false);
    try {
      const data = await specCustomizationAPI.getProjectAISettings(project.project_id);
      const choices = data?.model_choices || { openai: [], claude: [] };
      const provider = data?.provider || 'openai';
      setModelChoices(choices); setKeyConfigured(Boolean(data?.key_configured));
      setEncryptionConfigured(Boolean(data?.encryption_configured));
      setAiForm({ enabled: Boolean(data?.enabled), provider, model: data?.model || choices?.[provider]?.[0]?.id || '', api_key: '' });
    } catch (err) { setAiError(err?.response?.data?.error || 'Could not load AI settings.'); }
    finally { setAiBusy(false); }
  };
  const saveAi = async () => {
    if (!aiProject) return;
    setAiBusy(true); setAiError('');
    try {
      const payload = { enabled: aiForm.enabled, provider: aiForm.provider, model: aiForm.model };
      if (aiForm.api_key.trim()) payload.api_key = aiForm.api_key.trim();
      await specCustomizationAPI.saveProjectAISettings(aiProject.project_id, payload);
      setAiProject(null); await load();
    } catch (err) { setAiError(err?.response?.data?.error || 'Could not save AI settings.'); }
    finally { setAiBusy(false); }
  };
  const clearAi = async () => {
    if (!aiProject) return;
    setAiBusy(true); setAiError('');
    try { await specCustomizationAPI.clearProjectAISettings(aiProject.project_id); setAiProject(null); await load(); }
    catch (err) { setAiError(err?.response?.data?.error || 'Could not clear AI settings.'); }
    finally { setAiBusy(false); }
  };

  return <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-3 py-5 sm:px-5 sm:py-7 dark:from-gray-950 dark:via-slate-950 dark:to-indigo-950"><div className="mx-auto max-w-7xl">
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
      <div className="flex min-w-0 items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-900/20"><FolderIcon className="h-6 w-6" /></div><div className="min-w-0"><div className="text-[11px] font-bold uppercase tracking-[.16em] text-blue-700 dark:text-blue-300">Digitization workspace</div><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Spec Customization Projects</h1><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Define the controlled workspace for source specifications, reference workbooks and validated exports.</p></div></div>
      <div className="flex shrink-0 gap-2"><button onClick={() => navigate(CFG.route)} className="hidden items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50 sm:inline-flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><ArrowLeftIcon className="h-4 w-4" /> Workspace</button><button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button></div>
    </header>
    <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat label="Projects" value={stats.total} tone="blue" /><Stat label="Active" value={stats.active} tone="emerald" /><Stat label="AI enabled" value={stats.ai} tone="violet" /><Stat label="Documents & jobs" value={stats.records} tone="amber" /></section>
    <section className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-base font-bold text-slate-900 dark:text-white">Project register</h2><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Set the target workbook set before opening the extraction workspace.</p></div><button onClick={() => setCreateOpen(true)} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-2.5 text-sm font-bold text-white shadow-sm hover:from-blue-700 hover:to-indigo-700"><FolderPlusIcon className="h-4 w-4" /> Create project</button></section>
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by project, code, client or plant..." className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white" /></div><div className="mt-3 flex flex-wrap items-center gap-2"><div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-0.5"><Filter label="All" active={!status} onClick={() => setStatus('')} />{CFG.statuses.map((item) => <Filter key={item.value} label={item.label} active={status === item.value} onClick={() => setStatus(item.value)} />)}</div><div className="flex items-center gap-1.5"><ArrowsUpDownIcon className="h-4 w-4 text-slate-400" /><select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"><option value="recent">Recently updated</option><option value="activity">Most active</option><option value="name">Project name</option></select><button title="Card view" onClick={() => setViewMode('cards')} className={`rounded-lg p-1.5 ${viewMode === 'cards' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Squares2X2Icon className="h-4 w-4" /></button><button title="Compact view" onClick={() => setViewMode('compact')} className={`rounded-lg p-1.5 ${viewMode === 'compact' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><ListBulletIcon className="h-4 w-4" /></button></div>{(query || status) && <button onClick={() => { setQuery(''); setStatus(''); }} className="whitespace-nowrap px-2 text-xs font-semibold text-slate-500 hover:text-blue-700 dark:text-slate-400">Reset</button>}</div></section>
    {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">{error}</div>}
    {loading ? <Loading /> : visibleProjects.length === 0 ? <Empty onCreate={() => setCreateOpen(true)} /> : <section className={viewMode === 'cards' ? 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3' : 'grid grid-cols-1 gap-2'}>{visibleProjects.map((project) => <ProjectCard key={project.project_id} compact={viewMode === 'compact'} project={project} onOpen={() => openProject(project)} onReferences={() => openProject(project, 'reference')} onEdit={() => setEditing(project)} onAi={() => openAi(project)} onDelete={() => deleteProject(project)} />)}</section>}
  </div>
  {(createOpen || editing) && <ProjectModal initial={editing} busy={busy} onClose={() => { setCreateOpen(false); setEditing(null); }} onSave={saveProject} />}
  {aiProject && <AiModal project={aiProject} busy={aiBusy} error={aiError} form={aiForm} choices={modelChoices} keyConfigured={keyConfigured} encryptionConfigured={encryptionConfigured} showKey={showKey} onToggleKey={() => setShowKey((value) => !value)} onChange={(patch) => setAiForm((value) => ({ ...value, ...patch }))} onClose={() => setAiProject(null)} onSave={saveAi} onClear={clearAi} />}
  </div>;
};

const Stat = ({ label, value, tone }) => { const map = { blue: ['rgba(37,99,235,.1)', '#1d4ed8'], emerald: ['rgba(16,185,129,.12)', '#047857'], violet: ['rgba(124,58,237,.12)', '#6d28d9'], amber: ['rgba(245,158,11,.16)', '#b45309'] }; const [background, color] = map[tone] || map.blue; return <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div><div className="mt-2 inline-flex rounded-full px-2.5 py-1 text-lg font-extrabold tabular-nums" style={{ background, color }}>{value}</div></div>; };
const Filter = ({ label, active, onClick }) => <button onClick={onClick} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${active ? 'border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'}`}>{label}</button>;
const Loading = () => <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-800" /><div className="mt-5 h-10 rounded bg-slate-100 dark:bg-slate-800" /><div className="mt-6 h-9 rounded bg-slate-100 dark:bg-slate-800" /></div>)}</div>;
const Empty = ({ onCreate }) => <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center dark:border-slate-700 dark:bg-slate-900"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"><FolderIcon className="h-7 w-7" /></div><h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">No projects yet</h2><p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">Create a project to group related paper-spec extractions and piping classes.</p><button onClick={onCreate} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"><FolderPlusIcon className="h-4 w-4" /> Create your first project</button></div>;
const ProjectTag = ({ label, value, icon: Icon }) => value ? <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{Icon && <Icon className="h-3 w-3" />}{label}: {value}</span> : null;
const Action = ({ children, danger, ...props }) => <button {...props} className={`inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${danger ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}>{children}</button>;
const ProjectCard = ({ project, compact, onOpen, onReferences, onEdit, onAi, onDelete }) => { const status = getStatus(project.status); const count = Number(project.job_count || 0) + Number(project.document_count || 0); const aiReady = Boolean(project.ai_enabled && project.ai_key_configured); if (compact) return <article className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-colors hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900"><div className="min-w-[12rem] flex-1"><div className="flex items-center gap-2"><h3 className="truncate text-sm font-bold text-slate-900 dark:text-white">{project.name}</h3><span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: status.bg, color: status.color }}>{status.label}</span></div><p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{project.code || project.client || project.plant || 'No delivery context'}</p></div><div className="text-xs text-slate-500 dark:text-slate-400">{count} records</div><div className="flex gap-2"><Action onClick={onReferences}><WrenchScrewdriverIcon className="h-3.5 w-3.5" /> References</Action><Action onClick={onOpen}><ArrowRightIcon className="h-3.5 w-3.5" /> Extract</Action><Action onClick={onEdit}><PencilSquareIcon className="h-3.5 w-3.5" /> Edit</Action></div></article>; return <article className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-800"><div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600 opacity-0 transition-opacity group-hover:opacity-100" /><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-base font-bold text-slate-900 dark:text-white">{project.name}</h3><div className="mt-1 flex flex-wrap items-center gap-2">{project.code && <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">{project.code}</span>}{aiReady && <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"><CpuChipIcon className="h-3 w-3" /> {project.ai_provider || 'AI'} ready</span>}</div></div><span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: status.bg, color: status.color }}>{status.label}</span></div><p className="mt-4 min-h-10 text-sm leading-5 text-slate-600 dark:text-slate-400">{project.description?.slice(0, 110) || <em>No description.</em>}{project.description?.length > 110 && '...'}</p><div className="mt-3 flex min-h-6 flex-wrap gap-1.5"><ProjectTag label="Plant" value={project.plant} icon={BuildingOffice2Icon} /><ProjectTag label="Client" value={project.client} /><ProjectTag label="Discipline" value={project.discipline} /></div><div className="mt-4 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400"><ChartBarIcon className="h-3.5 w-3.5" />{count} document / job record{count === 1 ? '' : 's'}</div><div className="mt-4 grid gap-2"><div className="grid grid-cols-2 gap-2"><button onClick={onReferences} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm font-bold text-violet-700 hover:bg-violet-100 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300"><WrenchScrewdriverIcon className="h-4 w-4" /> References</button><button onClick={onOpen} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-blue-700">Extract <ArrowRightIcon className="h-4 w-4" /></button></div><div className="grid grid-cols-3 gap-2"><Action onClick={onAi} title="AI settings"><KeyIcon className="h-3.5 w-3.5" /> AI</Action><Action onClick={onEdit}><PencilSquareIcon className="h-3.5 w-3.5" /> Edit</Action><Action onClick={onDelete} danger><TrashIcon className="h-3.5 w-3.5" /> Delete</Action></div></div></article>; };

const Modal = ({ title, subtitle, icon: Icon, onClose, children }) => <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"><div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"><div className="flex items-start gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4 dark:border-slate-800 dark:from-blue-950/40 dark:to-indigo-950/40"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white"><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><h2 className="text-base font-bold text-slate-900 dark:text-white">{title}</h2><p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{subtitle}</p></div><button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"><XMarkIcon className="h-5 w-5" /></button></div>{children}</div></div>;
const Field = ({ label, value, onChange, required, placeholder }) => <label className="block"><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">{label}{required && ' *'}</span><input value={value} required={required} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>;
const Footer = ({ onClose, busy, disabled, label, onSave }) => <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/40"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Cancel</button><button type={onSave ? 'button' : 'submit'} onClick={onSave} disabled={disabled} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><CheckIcon className="h-4 w-4" />{busy ? 'Saving...' : label}</button></div>;
const ProjectModal = ({ initial, busy, onClose, onSave }) => { const [form, setForm] = useState({ name: initial?.name || '', code: initial?.code || '', client: initial?.client || '', plant: initial?.plant || '', discipline: initial?.discipline || '', description: initial?.description || '', status: initial?.status || 'active' }); const [advanced, setAdvanced] = useState(Boolean(initial && (initial.code || initial.client || initial.plant || initial.discipline))); const set = (key, value) => setForm((current) => ({ ...current, [key]: value })); const valid = form.name.trim() && !busy; return <Modal title={initial ? 'Edit project' : 'Create project'} subtitle={initial ? 'Update the project context and delivery state.' : 'Start with the project identity and delivery context.'} icon={FolderPlusIcon} onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); if (valid) onSave(form); }} className="flex max-h-[86vh] flex-col"><div className="space-y-4 overflow-y-auto px-5 py-5"><Field label="Project name" value={form.name} required placeholder="e.g. ADNOC LNG Train-3 PMS" onChange={(value) => set('name', value)} /><label className="block"><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Description <span className="font-normal normal-case text-slate-400">(optional)</span></span><textarea rows={3} value={form.description} onChange={(event) => set('description', event.target.value)} placeholder="Scope, source document or target deliverable..." className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label><button type="button" onClick={() => setAdvanced((value) => !value)} className="text-xs font-bold text-blue-700 hover:text-blue-900 dark:text-blue-300">{advanced ? 'Hide delivery details' : 'Add code, client, plant, discipline and status'}</button>{advanced && <div className="grid grid-cols-1 gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3 sm:grid-cols-2 dark:border-blue-900/50 dark:bg-blue-950/20"><Field label="Code" value={form.code} onChange={(value) => set('code', value)} /><Field label="Client" value={form.client} onChange={(value) => set('client', value)} /><Field label="Plant" value={form.plant} onChange={(value) => set('plant', value)} /><Field label="Discipline" value={form.discipline} onChange={(value) => set('discipline', value)} /><label className="block sm:col-span-2"><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Status</span><select value={form.status} onChange={(event) => set('status', event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white">{CFG.statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div>}</div><Footer onClose={onClose} busy={busy} disabled={!valid} label={initial ? 'Save changes' : 'Create project'} /></form></Modal>; };
const AiModal = ({ project, busy, error, form, choices, keyConfigured, encryptionConfigured, showKey, onToggleKey, onChange, onClose, onSave, onClear }) => { const models = Array.isArray(choices?.[form.provider]) ? choices[form.provider] : []; const disabled = busy || !encryptionConfigured || (form.enabled && !keyConfigured && !form.api_key.trim()); return <Modal title="Project AI settings" subtitle={`${project.name} - configure a project-scoped provider and model.`} icon={KeyIcon} onClose={onClose}><div className="space-y-4 px-5 py-5">{error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">{error}</div>}<label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"><input type="checkbox" checked={Boolean(form.enabled)} disabled={busy} onChange={(event) => onChange({ enabled: event.target.checked })} className="h-4 w-4 rounded border-slate-300 text-blue-600" />Enable project AI key</label><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Select label="Provider" value={form.provider} disabled={busy} onChange={(provider) => onChange({ provider, model: choices?.[provider]?.[0]?.id || '' })}><option value="openai">OpenAI</option><option value="claude">Claude</option></Select><Select label="Model" value={form.model} disabled={busy} onChange={(model) => onChange({ model })}>{models.map((model) => <option key={model.id} value={model.id}>{model.label || model.id}</option>)}</Select></div><label className="block"><span className="mb-1.5 flex justify-between text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">API key <button type="button" onClick={onToggleKey} className="normal-case text-blue-700 hover:underline dark:text-blue-300">{showKey ? 'Hide' : 'Show'}</button></span><input type={showKey ? 'text' : 'password'} value={form.api_key} disabled={busy} onChange={(event) => onChange({ api_key: event.target.value })} placeholder={keyConfigured ? 'Leave empty to retain the current key' : 'Paste API key'} autoComplete="off" spellCheck={false} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label><p className={`text-xs ${encryptionConfigured ? 'text-slate-500 dark:text-slate-400' : 'font-semibold text-amber-700 dark:text-amber-300'}`}>{keyConfigured ? 'A project key is configured. Leave this field blank to retain it.' : 'No project key is stored.'}{!encryptionConfigured && ' Server-side key encryption is not configured, so saving is unavailable.'}</p></div><div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/40"><button onClick={onClear} disabled={busy || (!keyConfigured && !form.enabled)} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40 dark:border-rose-900/60 dark:bg-slate-900 dark:text-rose-300">Clear AI key</button><div className="flex gap-2"><button onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Cancel</button><button onClick={onSave} disabled={disabled} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Saving...' : 'Save AI settings'}</button></div></div></Modal>; };
const Select = ({ label, value, onChange, disabled, children }) => <label className="block"><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">{label}</span><select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white">{children}</select></label>;

export default SpecProjectsPage;
