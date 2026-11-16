import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp,
  Bot,
  ChevronDown,
  Download,
  FileSearch,
  FileText,
  Folder,
  FolderPlus,
  GitCompare,
  Globe,
  History,
  Menu,
  MessageCircle,
  Palette,
  Paperclip,
  Plus,
  Plug,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  archiveAIConversation,
  archiveAIProject,
  createAIConversation,
  createAIProject,
  getAIConversation,
  getAIProject,
  listAIChatModels,
  listAIConversations,
  listAIProjects,
  sendAIMessage,
  updateAIConversation,
  updateAIProject,
  uploadAIAttachment,
  downloadAIKnowledge,
  downloadAIAttachment,
  generateAIDocument,
  downloadAIGeneratedDocument,
  getAIInstructions,
  listAIKnowledge,
} from "../services/radaiIntelligence.service";
import RadaiAIWorkspace from "./RadaiAIWorkspace";
import RadaiConversationHistory from "./RadaiConversationHistory";
import "./RadaiAIProjectPage.css";

const quickActions = [
  {
    label: "Review P&ID",
    icon: FileSearch,
    text: "Help me plan a P&ID review. Cite exact project evidence when a project is selected.",
  },
  {
    label: "Analyze Document",
    icon: FileText,
    text: "Analyze the relevant project documents. Separate source evidence from interpretation.",
  },
  {
    label: "Compare Revisions",
    icon: GitCompare,
    text: "Compare available document revisions. Cite differences you can verify.",
  },
  {
    label: "Check tag consistency",
    icon: Search,
    text: "Check equipment, line, and valve tags across the available project documents. List mismatches with source locations, and identify documents that are missing.",
  },
  {
    label: "Review line list",
    icon: FileSearch,
    text: "Review the available line list against related P&IDs. Identify verifiable differences in line numbers, sizes, services, and connections with citations.",
  },
  {
    label: "Draft review comments",
    icon: MessageCircle,
    text: "Draft review comments for the available engineering documents. Include the exact source location, the observed issue, and a question for the responsible engineer.",
  },
  {
    label: "Identify missing evidence",
    icon: FileSearch,
    text: "Identify missing or conflicting evidence needed for an engineering review. Separate confirmed facts from open questions and cite the available sources.",
  },
  {
    label: "Summarize technical risks",
    icon: FileText,
    text: "Summarize technical risks supported by the available project documents. Cite each source and mark assumptions that need engineering review.",
  },
  {
    label: "Prepare handover questions",
    icon: MessageCircle,
    text: "Prepare concise engineering handover questions from the available project documents. Group them by discipline and cite the evidence behind each question.",
  },
];

const menuEntries = [
  { id: "upload", label: "Upload or add files", icon: Paperclip, supported: true },
  { id: "addProject", label: "Add to project", icon: FolderPlus, supported: false },
  { id: "skills", label: "Skills", icon: Bot, supported: true },
  { id: "connectors", label: "Connectors", icon: Plug, supported: false },
  { id: "design", label: "Design system", icon: Palette, supported: false },
  { id: "web", label: "Web search", icon: Globe, supported: false },
];

const GENERATION_FORMATS = [
  { id: "docx", label: "Word (.docx)", icon: FileText },
  { id: "xlsx", label: "Excel (.xlsx)", icon: FileText },
  { id: "pdf", label: "PDF (.pdf)", icon: FileText },
  { id: "csv", label: "CSV (.csv)", icon: FileText },
  { id: "txt", label: "Text (.txt)", icon: FileText },
];

const FILE_SIZE_LIMIT = 12 * 1024 * 1024;
const getMenuPosition = (trigger) => {
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(280, window.innerWidth - 16);
  const roomAbove = rect.top - 16;
  const roomBelow = window.innerHeight - rect.bottom - 16;
  const above = roomAbove > roomBelow;
  return {
    left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    top: above ? rect.top - 8 : rect.bottom + 8,
    maxHeight: Math.max(48, Math.min(440, (above ? roomAbove : roomBelow) - 8)),
    above,
    width,
  };
};

export default function RadaiAIProjectPage() {
  const [projects, setProjects] = useState([]);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [modelError, setModelError] = useState("");
  const [projectId, setProjectId] = useState("");
  const [view, setView] = useState("chat");
  const [mobileNav, setMobileNav] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [folder, setFolder] = useState("");
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const [contextOpen, setContextOpen] = useState(true);
  const [projectTab, setProjectTab] = useState("Instructions");
  const [projectInstructions, setProjectInstructions] = useState(null);
  const [projectSources, setProjectSources] = useState([]);
  const [contextError, setContextError] = useState("");
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [draft, setDraft] = useState("");
  const [renameId, setRenameId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [addToProjectOpen, setAddToProjectOpen] = useState(false);
  const [menuFocus, setMenuFocus] = useState(0);
  const [attachments, setAttachments] = useState([]);
  const [fileCreationOpen, setFileCreationOpen] = useState(false);
  const [fileCreationFormat, setFileCreationFormat] = useState("docx");
  const [fileCreationContent, setFileCreationContent] = useState("");
  const [fileCreationFilename, setFileCreationFilename] = useState("");
  const [fileCreationBusy, setFileCreationBusy] = useState(false);
  const composer = useRef(null);
  const actionTrigger = useRef(null);
  const actionMenu = useRef(null);
  const fileInput = useRef(null);
  const menuItemRefs = useRef([]);
  const retry = useRef(null);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const reposition = () => {
      if (actionTrigger.current) setMenuAnchor(getMenuPosition(actionTrigger.current));
    };
    const closeOnOutsideClick = (event) => {
      if (!actionTrigger.current?.contains(event.target) && !actionMenu.current?.contains(event.target)) {
        setMenuOpen(false);
        setAddToProjectOpen(false);
      }
    };
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      document.removeEventListener("pointerdown", closeOnOutsideClick);
    };
  }, [menuOpen]);
  const project = projects.find((row) => String(row.id) === projectId);
  const usedSources = [...messages].reverse().find((message) => message.role === "assistant" && message.sources?.length)?.sources || [];
  const selectedProvider = models.find((row) => row.model_id === selectedModel)?.provider;
  const entryDisabled = (entry) => {
    if (entry.id === "addProject") return projects.length === 0;
    if (entry.id === "skills") return false;
    return !entry.supported;
  };
  const entryNotSupportedReason = (entry) => {
    if (entry.id === "addProject") return projects.length === 0 ? "No projects available." : null;
    if (!entry.supported) return "Not available in this phase.";
    return null;
  };
  const reload = async () => {
    const result = await listAIProjects();
    setProjects(result.results || []);
  };

  useEffect(() => {
    let active = true;
    listAIProjects()
      .then((result) => {
        if (active) setProjects(result.results || []);
      })
      .catch(() => {
        if (active) setError("Projects could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    listAIChatModels().then((result) => {
      if (active) {
        setModels(result.models || []);
        setSelectedModel(result.default_model || "");
      }
    }).catch(() => { if (active) { setModels([]); setModelError("Model list could not be loaded. Check the Django connection."); } });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!["search", "history"].includes(view)) return;
    let active = true;
    const timer = setTimeout(
      () =>
        listAIConversations(projectId, query)
          .then((result) => {
            if (active) setHistory(result.results || []);
          })
          .catch(() => {
            if (active) setError("Conversation history is unavailable.");
          }),
      query ? 250 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [projectId, view, query]);
  useEffect(() => {
    let active = true;
    listAIConversations(projectId, "")
      .then((result) => { if (active) setRecentChats((result.results || []).slice(0, 3)); })
      .catch(() => { if (active) setRecentChats([]); });
    return () => { active = false; };
  }, [projectId, conversationId, messages.length]);
  useEffect(() => {
    if (!projectId) {
      setProjectInstructions(null);
      setProjectSources([]);
      setContextError("");
      return;
    }
    let active = true;
    Promise.all([getAIInstructions(projectId), listAIKnowledge(projectId)])
      .then(([instructions, knowledge]) => {
        if (!active) return;
        setProjectInstructions(instructions);
        setProjectSources(knowledge.results || []);
        setContextError("");
      })
      .catch(() => { if (active) setContextError("Project context could not be loaded."); });
    return () => { active = false; };
  }, [projectId, view]);
  const select = (row) => {
    if (busy) return;
    setProjectId(String(row.id));
    setProjectTab("Instructions");
    setView("project");
    setMessages([]);
    setConversationId(null);
    setAttachments([]);
    setDraft("");
    setError("");
    setMobileNav(false);
    retry.current = null;
  };
  const selectProjectInChat = (row) => {
    setProjectId(String(row.id));
    setView("chat");
    setMessages([]);
    setConversationId(null);
    setAttachments([]);
    setDraft("");
    setError("");
    setMobileNav(false);
    setMenuOpen(false);
    setAddToProjectOpen(false);
    retry.current = null;
    requestAnimationFrame(() => composer.current?.focus());
  };
  const newChat = () => {
    if (busy) return;
    setView("chat");
    setMessages([]);
    setConversationId(null);
    setDraft("");
    setError("");
    setAttachments([]);
    setMobileNav(false);
    setMenuOpen(false);
    retry.current = null;
    requestAnimationFrame(() => composer.current?.focus());
  };
  const create = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const row = await createAIProject({
        name: name.trim(),
        description,
        folder,
      });
      await reload();
      setProjectId(String(row.id));
      setProjectTab("Instructions");
      setView("project");
      setName("");
      setDescription("");
      setFolder("");
    } catch {
      setError("Project could not be created.");
    } finally {
      setBusy(false);
    }
  };
  const rename = async (row) => {
    if (!renameValue.trim()) return;
    try {
      await updateAIProject(row.id, { name: renameValue.trim() });
      await reload();
      setRenameId(null);
    } catch {
      setError("Project could not be renamed.");
    }
  };
  const archive = async (row) => {
    try {
      await archiveAIProject(row.id);
      await reload();
      setConfirmArchive(null);
      if (String(row.id) === projectId) {
        setProjectId("");
        newChat();
      }
    } catch {
      setError("Project could not be archived.");
    }
  };
  const open = async (id) => {
    try {
      if (project) await getAIProject(project.id);
      const row = await getAIConversation(project?.id, id);
      setMessages(row.messages || []);
      setConversationId(row.id);
      setView("chat");
      setError("");
      setAttachments([]);
    } catch {
      setError("Project or conversation access changed.");
    }
  };
  const send = async (event) => {
    event.preventDefault();
    const question = draft.trim();
    if (!selectedModel || !question || busy) return;
    setBusy(true);
    setError("");
    try {
      if (project) await getAIProject(project.id);
      const id = conversationId || (await createAIConversation(project?.id)).id;
      setConversationId(id);
      const requestId =
        retry.current?.question === question
          ? retry.current.id
          : crypto.randomUUID();
      retry.current = { id: requestId, question };
      const attachmentIds = attachments.map((a) => a.id);
      const result = await sendAIMessage(project?.id, id, question, requestId, selectedProvider, selectedModel, attachmentIds);
      setMessages(result.conversation.messages || []);
      setDraft("");
      setAttachments([]);
      retry.current = null;
    } catch (exc) {
      setError(
        exc?.response?.data?.provider ||
          exc?.response?.data?.detail ||
          "The assistant could not answer. Your draft remains available. A configured AI provider is required.",
      );
    } finally {
      setBusy(false);
    }
  };
  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setError("");
    const valid = [];
    for (const file of files) {
      if (file.size > FILE_SIZE_LIMIT) {
        setError(`${file.name} exceeds the 12 MB limit.`);
        continue;
      }
      valid.push(file);
    }
    if (!valid.length) {
      event.target.value = "";
      return;
    }
    let targetConversationId = conversationId;
    const newAttachments = [];
    for (const file of valid) {
      try {
        if (!targetConversationId) {
          targetConversationId = (await createAIConversation(project?.id)).id;
          setConversationId(targetConversationId);
        }
        const uploaded = await uploadAIAttachment(project?.id, targetConversationId, file);
        newAttachments.push({
          id: uploaded.id,
          name: uploaded.name,
          size: uploaded.size,
          content_type: uploaded.content_type,
          sha256: uploaded.sha256,
          status: "ready",
        });
      } catch (exc) {
        setError(exc?.response?.data?.file?.[0] || exc?.response?.data?.detail || `Failed to upload ${file.name}.`);
      }
    }
    setAttachments((previous) => [...previous, ...newAttachments]);
    event.target.value = "";
    requestAnimationFrame(() => composer.current?.focus());
  };
  const removeAttachment = (id) => {
    setAttachments((previous) => previous.filter((a) => a.id !== id));
  };
  const clearAttachments = () => {
    setAttachments([]);
  };
  const toggleMenu = (event) => {
    setAddToProjectOpen(false);
    if (event) setMenuAnchor(getMenuPosition(event.currentTarget));
    setMenuOpen((open) => !open);
    if (!menuOpen) {
      setMenuFocus(0);
      requestAnimationFrame(() => {
        const item = menuItemRefs.current[menuFocus];
        if (item) item.focus();
      });
    }
  };
  const closeMenu = () => {
    setMenuOpen(false);
    setAddToProjectOpen(false);
    actionTrigger.current?.focus();
  };
  const onMenuKeyDown = (event) => {
    if (event.key === "Escape") {
      closeMenu();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setMenuFocus((focus) => (focus + 1) % menuEntries.length);
      requestAnimationFrame(() => {
        const item = menuItemRefs.current[menuFocus];
        if (item) item.focus();
      });
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setMenuFocus((focus) => (focus - 1 + menuEntries.length) % menuEntries.length);
      requestAnimationFrame(() => {
        const item = menuItemRefs.current[menuFocus];
        if (item) item.focus();
      });
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && menuFocus >= 0) {
      event.preventDefault();
      menuItemRefs.current[menuFocus]?.click();
    }
  };
  const handleMenuAction = (entry) => {
    if (entryDisabled(entry)) return;
    if (entry.id === "upload") {
      setMenuOpen(false);
      fileInput.current?.click();
      return;
    }
    if (entry.id === "addProject") {
      setAddToProjectOpen(true);
      return;
    }
    if (entry.id === "skills") {
      setMenuOpen(false);
      setDraft(draft ? `${draft}\n\n` : "");
      requestAnimationFrame(() => composer.current?.focus());
      return;
    }
  };

  const openFileCreation = () => {
    setMenuOpen(false);
    setFileCreationContent(draft || "");
    setFileCreationFilename("");
    setFileCreationOpen(true);
    requestAnimationFrame(() => composer.current?.focus());
  };
  const closeFileCreation = () => {
    setFileCreationOpen(false);
    setFileCreationContent("");
    setFileCreationFilename("");
    setFileCreationBusy(false);
  };
  const generateDocument = async (event) => {
    event.preventDefault();
    if (!conversationId || fileCreationBusy) return;
    setFileCreationBusy(true);
    setError("");
    try {
      const result = await generateAIDocument(conversationId, {
        content: fileCreationContent,
        format: fileCreationFormat,
        filename: fileCreationFilename || `radai-${fileCreationFormat}`,
      });
      const messagesUpdate = [...messages, {
        id: `gen-${Date.now()}`,
        role: "assistant",
        content: `Generated ${result.name} (${result.format}, ${result.size} bytes). Ready to download.`,
        attachments: [],
        generated_document: {
          id: result.id,
          name: result.name,
          format: result.format,
          size: result.size,
          status: result.status,
        },
      }];
      setMessages(messagesUpdate);
      closeFileCreation();
    } catch (exc) {
      setError(exc?.response?.data?.detail || "Document could not be generated.");
    } finally {
      setFileCreationBusy(false);
    }
  };
  const downloadAttachment = async (conversationId, attachmentId, fileName) => {
    try {
      const response = await downloadAIAttachment(project?.id, conversationId, attachmentId);
      const blob = response.data;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (exc) {
      setError(exc?.response?.data?.detail || "Attachment could not be downloaded.");
    }
  };
  const downloadSource = async (source) => {
    if (String(source.source_id).startsWith("attachment-")) {
      return downloadAttachment(conversationId, Number(String(source.source_id).slice(11)), source.document);
    }
    if (!project) return;
    try {
      const response = await downloadAIKnowledge(project.id, source.source_id);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = source.document;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (exc) {
      setError(exc?.response?.data?.detail || "Source could not be downloaded.");
    }
  };
  const downloadGeneratedDocument = async (docId, fileName) => {
    if (!conversationId) return;
    try {
      const response = await downloadAIGeneratedDocument(conversationId, docId);
      const blob = response.data;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (exc) {
      setError(exc?.response?.data?.detail || "Document could not be downloaded.");
    }
  };

  return (
    <div className="radai-ai-page relative flex h-full min-h-0 w-full overflow-hidden font-sans">
      {mobileNav && (
        <button
          type="button"
          aria-label="Close workspace navigation"
          onClick={() => setMobileNav(false)}
          className="absolute inset-0 z-10 bg-slate-950/30 lg:hidden"
        />
      )}
      <aside
        id="ai-nav"
        aria-label="RADAI Intelligence navigation"
        className={`${mobileNav ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} radai-ai-nav absolute inset-y-0 left-0 z-20 flex flex-none flex-col transition-transform lg:relative`}
      >
        <div className="radai-ai-nav-heading flex items-center justify-between">
          <span className="flex items-center gap-3 text-sm font-semibold"><Sparkles size={23} /> RADAI Intelligence</span>
          <button
            type="button"
            aria-label="Close workspace navigation"
            onClick={() => setMobileNav(false)}
            className="rounded-md p-2 lg:hidden"
          >
            <X size={18} />
          </button>
        </div>
        <nav aria-label="Workspace sections" className="radai-ai-nav-actions">
          {[
            { id: "chat", label: "New chat", icon: Plus },
            { id: "search", label: "Search", icon: Search },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                item.id === "chat"
                  ? newChat()
                  : (setView(item.id), setMobileNav(false))
              }
              className={`radai-ai-nav-action flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)] ${item.id === "chat" ? "radai-ai-nav-primary" : ""}`}
            >
              <item.icon size={17} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="radai-ai-nav-scroll min-h-0 flex-1 overflow-y-auto">
          <button type="button" onClick={() => setView("projects")} className="radai-ai-nav-section"><Folder size={18} /> Projects</button>
          {projects.slice(0, 8).map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => selectProjectInChat(row)}
              className={`radai-ai-project-row flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm ${projectId === String(row.id) ? "is-active" : ""}`}
            >
              <Folder size={16} className="shrink-0" />
              <span className="truncate">{row.name}</span>
            </button>
          ))}
          {!projects.length && (
            <p className="px-3 pt-3 text-xs text-[var(--rd-text-muted)]">
              No projects yet. You can still start a general chat.
            </p>
          )}
          <button type="button" onClick={() => setView("projects")} className="radai-ai-create-project"><Plus size={17} /> Create project</button>
          <div className="radai-ai-recent">
            <button type="button" onClick={() => setView("history")} className="radai-ai-nav-section"><History size={18} /> Recent chats</button>
            {recentChats.map((row) => <button key={row.id} type="button" onClick={() => open(row.id)} className="radai-ai-recent-row"><MessageCircle size={16} /><span className="truncate">{row.title && row.title !== "New conversation" ? row.title : "Untitled chat"}</span></button>)}
            {!recentChats.length && <p className="px-3 pt-2 text-xs text-[var(--rd-text-muted)]">No recent chats</p>}
          </div>
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex h-12 flex-none items-center border-b border-[var(--rd-border-soft)] px-4 lg:hidden">
          <button type="button" aria-label="Open workspace navigation" aria-controls="ai-nav"
            aria-expanded={mobileNav} onClick={() => setMobileNav(true)}
            className="rounded-md p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)]">
            <Menu size={19} />
          </button>
          <span className="ml-2 truncate text-sm font-semibold">RADAI Intelligence</span>
        </div>
        <div className="radai-ai-content-layout flex min-h-0 flex-1">
        <main className="radai-ai-main min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div className="radai-ai-toolbar">
            <div className="truncate"><button type="button" onClick={() => setView("projects")}>Projects</button><span className="mx-3 text-slate-400">/</span><strong>{project?.name || "General chat"}</strong></div>
            {project && <div className="radai-ai-toolbar-actions flex items-center gap-2">{view !== "project" && <button type="button" onClick={() => { setProjectTab("Members"); setView("project"); }} className="radai-ai-context-toggle"><Users size={16} /> People</button>}<button type="button" onClick={() => setContextOpen((open) => !open)} className="radai-ai-context-toggle"><FileText size={16} /> Project context</button></div>}
          </div>
          <div className="radai-ai-main-inner">
          {error && (
            <p
              role="alert"
              className="mx-auto mb-4 max-w-3xl text-sm text-[var(--rd-danger)]"
            >
              {error}
            </p>
          )}
          {view === "projects" ? (
            <div className="mx-auto max-w-2xl">
              <h1 className="text-xl font-semibold">Projects</h1>
              <p className="mt-1 text-sm text-[var(--rd-text-muted)]">
                Create a private knowledge workspace or open one shared with
                you.
              </p>
              <form
                onSubmit={create}
                className="mt-6 space-y-3 rounded-xl border border-[var(--rd-border-soft)] p-4"
              >
                <h2 className="text-sm font-semibold">Create project</h2>
                <label htmlFor="ai-name" className="sr-only">
                  Project name
                </label>
                <input
                  id="ai-name"
                  required
                  maxLength={160}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Piping Specification Assistant"
                  className="rd-input w-full"
                />
                <label htmlFor="ai-desc" className="sr-only">
                  Description
                </label>
                <textarea
                  id="ai-desc"
                  maxLength={4000}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What will this workspace help with?"
                  className="rd-input w-full"
                  rows={2}
                />
                <label htmlFor="ai-folder" className="sr-only">
                  Folder (optional)
                </label>
                <input
                  id="ai-folder"
                  maxLength={120}
                  value={folder}
                  onChange={(event) => setFolder(event.target.value)}
                  placeholder="Folder (optional)"
                  className="rd-input w-full"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="rd-btn rd-btn-primary"
                >
                  <Plus size={16} />
                  Create project
                </button>
              </form>
              <label
                htmlFor="ai-filter"
                className="mt-7 block text-sm font-medium"
              >
                Find projects
              </label>
              <input
                id="ai-filter"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Search by name or folder"
                className="rd-input mt-2 w-full"
              />
              {loading ? (
                <p role="status" className="mt-5 text-sm">
                  Loading projects…
                </p>
              ) : (
                <ul className="mt-5 divide-y divide-[var(--rd-border-soft)]">
                  {projects
                    .filter((row) =>
                      `${row.name} ${row.folder}`
                        .toLowerCase()
                        .includes(filter.toLowerCase()),
                    )
                    .map((row) => (
                      <li
                        key={row.id}
                        className="flex min-w-0 items-center gap-2 py-2"
                      >
                        <button
                          type="button"
                          onClick={() => select(row)}
                          className="min-w-0 flex-1 rounded-lg p-2 text-left hover:bg-[var(--rd-surface)]"
                        >
                          <span className="block truncate text-sm font-medium">
                            {row.name}
                          </span>
                          <span className="text-xs text-[var(--rd-text-muted)]">
                            {row.folder || row.visibility} · {row.role}
                          </span>
                        </button>
                        {row.role === "owner" && (
                          <>
                            {renameId === row.id ? (
                              <form
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  rename(row);
                                }}
                                className="flex gap-1"
                              >
                                <label
                                  htmlFor={`rename-${row.id}`}
                                  className="sr-only"
                                >
                                  New name
                                </label>
                                <input
                                  id={`rename-${row.id}`}
                                  value={renameValue}
                                  onChange={(event) =>
                                    setRenameValue(event.target.value)
                                  }
                                  className="rd-input w-28"
                                />
                                <button
                                  type="submit"
                                  className="text-xs underline"
                                >
                                  Save
                                </button>
                              </form>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setRenameId(row.id);
                                  setRenameValue(row.name);
                                }}
                                className="text-xs underline"
                              >
                                Rename
                              </button>
                            )}
                            {confirmArchive === row.id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => archive(row)}
                                  className="text-xs underline"
                                >
                                  Confirm archive
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmArchive(null)}
                                  className="text-xs underline"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmArchive(row.id)}
                                className="text-xs underline"
                              >
                                Archive
                              </button>
                            )}
                          </>
                        )}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          ) : view === "project" && project ? (
            <RadaiAIWorkspace
              key={project.id}
              project={project}
              initialTab={projectTab}
              onStartChat={newChat}
              onProjectUpdated={reload}
            />
          ) : view === "history" || view === "search" ? (
            <RadaiConversationHistory
              project={project}
              search={view === "search"}
              query={query}
              onQueryChange={setQuery}
              conversations={history}
              loading={false}
              error=""
              onOpen={open}
              onRename={async (row, title) => {
                await updateAIConversation(project?.id, row.id, title);
                setHistory((previous) =>
                  previous.map((item) =>
                    item.id === row.id ? { ...item, title } : item,
                  ),
                );
              }}
              onArchive={async (row) => {
                await archiveAIConversation(project?.id, row.id);
                setHistory((previous) =>
                  previous.filter((item) => item.id !== row.id),
                );
              }}
            />
          ) : (
            <div className={`radai-ai-chat mx-auto flex min-h-full w-full max-w-5xl flex-col ${messages.length ? "" : "is-empty"}`}>
              {!messages.length ? (
                <div className="mb-8 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--rd-ai-soft)] text-[var(--rd-ai)]">
                    <Sparkles size={22} />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-[var(--rd-text-muted)]">
                    RADAI Intelligence
                  </p>
                  <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
                    What can we work on today?
                  </h1>
                </div>
              ) : (
                <>
                  <div aria-live="polite" className="radai-ai-messages mb-6 space-y-6">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className="flex w-full flex-col"
                      >
                        {message.role === "user" ? (
                          <div className="radai-ai-user-message ml-auto max-w-[75%]">
                            <div className="radai-ai-user-content flex flex-col gap-1">
                              <p className="rounded-xl bg-[var(--rd-surface-subtle)] p-3.5 text-sm leading-6">
                                {message.content}
                              </p>
                              <span className="radai-ai-user-avatar" aria-hidden="true">U</span>
                              {message.created_at && <time className="radai-ai-user-time">{new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>}
                              {Boolean(message.attachments?.length) && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {message.attachments.map((att) => (
                                    <div
                                      key={att.id}
                                      className="flex items-center gap-1.5 rounded-lg border border-[var(--rd-border-soft)] bg-[var(--rd-surface)] px-2 py-1"
                                    >
                                      <FileText size={13} className="shrink-0 text-[var(--rd-text-muted)]" />
                                      <span className="text-xs truncate max-w-[120px]">
                                        {att.name}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => downloadAttachment(message.conversation_id || conversationId, att.id, att.name)}
                                        className="shrink-0 text-[var(--rd-text-muted)] hover:text-[var(--rd-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)]"
                                        aria-label={`Download ${att.name}`}
                                      >
                                        <Download size={13} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="radai-ai-assistant-message max-w-[90%]">
                            <div className="radai-ai-assistant-heading"><span><Sparkles size={19} /></span><strong>RADAI Intelligence</strong>{message.created_at && <time>{new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>}</div>
                            <div className="radai-ai-answer-card">
                            <div className="text-sm leading-7 break-words">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                skipHtml
                                components={{
                                  h1: ({ children }) => <h1 className="mt-4 mb-2 text-base font-semibold">{children}</h1>,
                                  h2: ({ children }) => <h2 className="mt-4 mb-2 text-sm font-semibold">{children}</h2>,
                                  h3: ({ children }) => <h3 className="mt-3 mb-1 font-semibold">{children}</h3>,
                                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                  ul: ({ children }) => <ul className="mb-2 list-disc pl-5">{children}</ul>,
                                  ol: ({ children }) => <ol className="mb-2 list-decimal pl-5">{children}</ol>,
                                  pre: ({ children }) => <pre className="my-2 overflow-x-auto rounded-lg bg-[var(--rd-surface-subtle)] p-3 text-xs">{children}</pre>,
                                  table: ({ children }) => <div className="my-2 overflow-x-auto"><table className="w-full border-collapse text-xs">{children}</table></div>,
                                  th: ({ children }) => <th className="border border-[var(--rd-border-soft)] p-2 text-left">{children}</th>,
                                  td: ({ children }) => <td className="border border-[var(--rd-border-soft)] p-2">{children}</td>,
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                            </div>
                            {message.generated_document && (
                              <div className="mt-3 flex items-center gap-2 rounded-lg border border-[var(--rd-border-soft)] bg-[var(--rd-surface-subtle)] p-2.5">
                                <FileText size={14} className="shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium truncate">
                                    {message.generated_document.name}
                                  </p>
                                  <p className="text-xs text-[var(--rd-text-muted)]">
                                    {message.generated_document.format.toUpperCase()} · {message.generated_document.status} · not engineering-approved
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => downloadGeneratedDocument(message.generated_document.id, message.generated_document.name)}
                                  className="shrink-0 rounded-lg px-2.5 py-1 text-xs text-[var(--rd-primary)] hover:bg-[var(--rd-primary-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)]"
                                >
                                  Download
                                </button>
                              </div>
                            )}
                            {Boolean(message.sources?.length) && (
                              <div className="mt-3 border-t border-[var(--rd-border-soft)] pt-2.5">
                                <p className="text-xs font-semibold text-[var(--rd-text-faint)]">
                                  Sources considered
                                </p>
                                {message.sources.find((source) => source.coverage?.partial) && (
                                  <p className="mt-1 text-xs text-[var(--rd-text-muted)]">
                                    Selected excerpts from {message.sources.find((source) => source.coverage?.partial).coverage.selected_pages} of {message.sources.find((source) => source.coverage?.partial).coverage.total_pages} extracted pages. This is a partial document analysis.
                                  </p>
                                )}
                                {message.sources.map((source, index) => (
                                  <p
                                    key={`${source.source_id}-${index}`}
                                    className="mt-0.5 text-xs text-[var(--rd-text-muted)] leading-5"
                                  >
                                    <button type="button" onClick={() => downloadSource(source)} className="underline underline-offset-2 hover:text-[var(--rd-primary)]" aria-label={`Download source ${source.document}`}>
                                      {source.document}
                                    </button> · {source.revision ? `v${source.revision} · ` : ""}
                                    {source.location} · {source.approval}
                                  </p>
                                ))}
                              </div>
                            )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
              <form
                onSubmit={send}
                className="radai-ai-composer flex w-full flex-col gap-2 rounded-xl border border-[var(--rd-border-soft)] bg-[var(--rd-surface)] p-2.5 shadow-[var(--rd-shadow-card)] relative"
              >
                <input
                  type="file"
                  ref={fileInput}
                  hidden
                  accept=".pdf,.docx,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp,.bmp"
                  multiple
                  onChange={handleFileSelect}
                />
                <div className="radai-ai-composer-actions flex items-center gap-2">
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    aria-label="Add files or actions"
                    onClick={toggleMenu}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--rd-text)] hover:bg-[var(--rd-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)]"
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={newChat}
                    aria-label="New chat"
                    title="New chat"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--rd-text)] hover:bg-[var(--rd-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)]"
                  >
                    <MessageCircle size={16} />
                  </button>
                  <button
                    type="button"
                    aria-disabled
                    aria-label="Cowork"
                    title="Cowork is not available in this phase"
                    className="flex h-9 w-9 items-center justify-center rounded-lg opacity-50 text-[var(--rd-text-muted)] cursor-not-allowed hover:bg-[var(--rd-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)]"
                  >
                    <Users size={16} aria-hidden="true" />
                  </button>
                </div>
                {Boolean(attachments.length) && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-1.5 rounded-lg border border-[var(--rd-border-soft)] bg-[var(--rd-surface)] px-2 py-1"
                      >
                        <FileText size={13} className="shrink-0 text-[var(--rd-text-muted)]" />
                        <span className="text-xs truncate max-w-[140px]">
                          {att.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(att.id)}
                          className="shrink-0 text-[var(--rd-text-muted)] hover:text-[var(--rd-danger)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)]"
                          aria-label={`Remove ${att.name}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={clearAttachments}
                      className="text-xs underline text-[var(--rd-text-muted)] hover:text-[var(--rd-danger)]"
                    >
                      Clear all
                    </button>
                  </div>
                )}
                <textarea
                  ref={composer}
                  id="ai-composer"
                  rows={2}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder={project ? `Ask about ${project.name}...` : "Message RADAI Intelligence"}
                  className="w-full resize-none min-h-[56px] bg-transparent px-3 py-2.5 text-sm leading-6 outline-none placeholder:text-[var(--rd-text-faint)]"
                />
                {menuOpen && menuAnchor && createPortal(
                  <div
                    ref={actionMenu}
                    className={`radai-ai-add-menu ${menuAnchor.above ? "is-above" : ""} flex flex-col gap-1 rounded-lg border border-[var(--rd-border-soft)] bg-[var(--rd-surface)] shadow-[var(--rd-shadow-card)] p-1`}
                    style={{ left: menuAnchor.left, top: menuAnchor.top, width: menuAnchor.width, maxHeight: menuAnchor.maxHeight }}
                    role="menu"
                    aria-label="Add actions"
                    tabIndex={-1}
                    onKeyDown={onMenuKeyDown}
                  >
                    {addToProjectOpen ? (
                      <>
                        <p className="px-2 text-xs font-semibold text-[var(--rd-text-faint)] uppercase">
                          Add to project
                        </p>
                        {projects.length ? (
                          projects.map((row) => (
                            <button
                              key={row.id}
                              type="button"
                              role="menuitem"
                              onClick={() => selectProjectInChat(row)}
                              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--rd-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)]"
                            >
                              <Folder size={15} className="shrink-0" />
                              <span className="truncate">{row.name}</span>
                            </button>
                          ))
                        ) : (
                          <p className="px-2 py-2 text-xs text-[var(--rd-text-muted)]">
                            No projects available.
                          </p>
                        )}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => setAddToProjectOpen(false)}
                          className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--rd-text-muted)] hover:bg-[var(--rd-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)]"
                        >
                          <ChevronDown size={14} className="rotate-180 shrink-0" />
                          Back
                        </button>
                      </>
                    ) : (
                      menuEntries.map((entry, index) => {
                        const disabled = entryDisabled(entry);
                        const reason = entryNotSupportedReason(entry);
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            role="menuitem"
                            aria-disabled={disabled || undefined}
                            ref={(element) => {
                              menuItemRefs.current[index] = element;
                            }}
                            onClick={() => handleMenuAction(entry)}
                            className={`flex w-full cursor-default items-center gap-2 rounded-lg px-3 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)] ${disabled ? "opacity-50 text-[var(--rd-text-faint)] cursor-not-allowed" : "text-[var(--rd-text)] hover:bg-[var(--rd-bg)]"}`}
                            title={reason}
                          >
                            <entry.icon size={15} className="shrink-0" />
                            {entry.label}
                            {!entry.supported && (
                              <span className="ml-auto text-xs text-[var(--rd-text-faint)]">Coming soon</span>
                            )}
                          </button>
                        );
                      })
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={openFileCreation}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--rd-primary)] hover:bg-[var(--rd-primary-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)]"
                    >
                      <Download size={15} className="shrink-0" />
                      Create file from chat
                    </button>
                  </div>, document.body
                )}
                <div className="radai-ai-composer-footer flex flex-wrap items-end justify-between gap-2 border-t border-[var(--rd-border-soft)] pt-2">
                  <button type="button" ref={actionTrigger} onClick={toggleMenu} aria-haspopup="menu" aria-expanded={menuOpen} className="radai-ai-add-context"><Plus size={17} /> Add context</button>
                  <label htmlFor="ai-chat-model" className="sr-only">
                    Chat model
                  </label>
                  <select
                    id="ai-chat-model"
                    aria-label="Chat model"
                    value={selectedModel}
                    onChange={(event) => setSelectedModel(event.target.value)}
                    className="max-w-[170px] shrink-0 rounded-lg border border-[var(--rd-border-soft)] bg-[var(--rd-surface)] px-2 py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)]"
                  >
                    <option value="">{models.length ? "Model" : "No model available"}</option>
                    {models.map((row) => (
                      <option key={row.model_id} value={row.model_id}>
                        {row.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={!selectedModel || !draft.trim() || busy}
                    aria-label="Send message"
                    className="flex h-10 min-w-10 items-center justify-center rounded-lg bg-[var(--rd-primary)] px-3 text-white disabled:opacity-40"
                  >
                    {busy ? "Sending…" : <ArrowUp size={17} />}
                  </button>
                </div>
                {!selectedModel && (
                  <p role="status" className="mt-2 text-xs text-[var(--rd-text-muted)]">
                    {modelError || "No chat model is configured for RADAI Intelligence. An administrator can configure Claude in AI API keys."}
                  </p>
                )}
              </form>
                <section className="radai-ai-prompt-starters" aria-labelledby="radai-ai-prompt-starters-title">
                  <h2 id="radai-ai-prompt-starters-title">Prompt Starters</h2>
                  <div className="radai-ai-prompt-list">
                    {quickActions.map((action) => (
                      <button
                        type="button"
                        key={action.label}
                        onClick={() => {
                          setDraft(action.text);
                          requestAnimationFrame(() => composer.current?.focus());
                        }}
                        className="radai-ai-prompt-chip"
                      >
                        <action.icon size={15} aria-hidden="true" />
                        {action.label}
                      </button>
                    ))}
                  </div>
                </section>
              {fileCreationOpen && (
                <div className="radai-ai-file-creation mt-4 rounded-xl border border-[var(--rd-border-soft)] bg-[var(--rd-surface)] p-3 shadow-[var(--rd-shadow-card)]">
                  <h3 className="text-sm font-semibold mb-2">Create file from chat</h3>
                  <form onSubmit={generateDocument} className="space-y-2">
                    <label className="block text-xs font-medium text-[var(--rd-text-muted)]">
                      Format
                    </label>
                    <div className="flex gap-1">
                      {GENERATION_FORMATS.map((fmt) => (
                        <button
                          type="button"
                          key={fmt.id}
                          onClick={() => setFileCreationFormat(fmt.id)}
                          className={`flex min-w-[60px] items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors ${fileCreationFormat === fmt.id ? "bg-[var(--rd-primary)] text-white" : "bg-[var(--rd-surface)] text-[var(--rd-text)] hover:bg-[var(--rd-surface-subtle)]"}`}
                        >
                          <fmt.icon size={13} />
                          {fmt.label.split(" ")[0]}
                        </button>
                      ))}
                    </div>
                    <label className="block text-xs font-medium text-[var(--rd-text-muted)]">
                      Filename (optional)
                    </label>
                    <input
                      type="text"
                      value={fileCreationFilename}
                      onChange={(event) => setFileCreationFilename(event.target.value)}
                      placeholder="radai-summary"
                      className="rd-input w-full text-xs"
                    />
                    <label className="block text-xs font-medium text-[var(--rd-text-muted)]">
                      Content
                    </label>
                    <textarea
                      value={fileCreationContent}
                      onChange={(event) => setFileCreationContent(event.target.value)}
                      rows={4}
                      className="rd-input w-full text-xs resize-y"
                    />
                    <p className="text-xs text-[var(--rd-text-faint)]">
                      Generated files are proposals, not engineering-approved deliverables. Review before controlled issue.
                    </p>
                    <div className="flex justify-end gap-2 mt-3">
                      <button
                        type="button"
                        onClick={closeFileCreation}
                        className="text-xs text-[var(--rd-text-muted)] hover:bg-[var(--rd-bg)] rounded-lg px-3 py-1"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={fileCreationBusy || !fileCreationContent.trim()}
                        className="rd-btn rd-btn-primary text-xs"
                      >
                        {fileCreationBusy ? "Generating…" : "Create file"}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
          </div>
        </main>
        {project && contextOpen && <aside className="radai-ai-context" aria-label="Project context">
          <div className="radai-ai-context-header"><h2>Project context</h2><button type="button" onClick={() => setContextOpen(false)} aria-label="Close project context"><X size={18} /></button></div>
          <section className="radai-ai-context-section"><h3>Project instructions</h3>
            {contextError ? <p role="alert">{contextError}</p> : projectInstructions ? <div className="radai-ai-instructions">{["role_behavior", "goals", "response_format", "terminology", "standards", "evidence_requirements", "constraints"].map((key) => projectInstructions[key]).filter(Boolean).join("\n\n") || "No project instructions added yet."}</div> : <p>Loading instructions...</p>}
          </section>
          <section className="radai-ai-context-section"><h3>{usedSources.length ? "Sources used" : "Project sources"}</h3>
            {usedSources.length ? <div className="radai-ai-sources">{usedSources.map((source, index) => <button key={`${source.source_id}-${index}`} type="button" onClick={() => downloadSource(source)} className="radai-ai-source"><FileText size={18} /><span className="truncate">{source.document}{source.revision ? ` · Rev ${source.revision}` : ""}</span><span aria-hidden="true">···</span></button>)}</div> : projectSources.length ? <div className="radai-ai-sources">{projectSources.map((source) => <button key={source.id} type="button" onClick={() => { setProjectTab("Knowledge"); setView("project"); }} className="radai-ai-source"><FileText size={18} /><span className="truncate">{source.name}{source.version ? ` · Rev ${source.version}` : ""}</span><span aria-hidden="true">···</span></button>)}</div> : <p>No project sources yet.</p>}
            <button type="button" onClick={() => { setProjectTab("Knowledge"); setView("project"); }} className="radai-ai-source-add"><Plus size={18} /> Add source</button>
          </section>
        </aside>}
        </div>
      </div>
    </div>
  );
}
