import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp,
  Bot,
  ChevronDown,
  Download,
  FileText,
  Folder,
  FolderPlus,
  Globe,
  History,
  Maximize2,
  Menu,
  Minimize2,
  MessageCircle,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Pin,
  Palette,
  Paperclip,
  Plus,
  Plug,
  Search,
  ShieldCheck,
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
  listRecentAIConversations,
  listAIProjects,
  streamAIMessage,
  updateAIConversation,
  updateAIProject,
  uploadAIAttachment,
  connectAIAttachment,
  addChatToProject,
  downloadAIKnowledge,
  downloadAIAttachment,
  generateAIDocument,
  downloadAIGeneratedDocument,
  getAIInstructions,
  listAIKnowledge,
  listAISkills,
} from "../services/radaiIntelligence.service";
import { useSearchParams } from "react-router-dom";
import RadaiAIWorkspace from "./RadaiAIWorkspace";
import RadaiProjectsBoard from "./RadaiProjectsBoard";
import RadaiConnectorsDialog from "./RadaiConnectorsDialog";
import RadaiAddToProjectDialog from "./RadaiAddToProjectDialog";
import RadaiSkillsDialog from "./RadaiSkillsDialog";
import RadaiPromptStarters, { recordSkillUse } from "./RadaiPromptStarters";
import RadaiUsageMeter from "./RadaiUsageMeter";
import RadaiStreamingReply, { AnswerMeta, RejlersMark, answerMarkdownComponents } from "./RadaiStreamingReply";
import RadaiConversationHistory, { chatTitle, readPinnedChats, relativeTime, writePinnedChats } from "./RadaiConversationHistory";
import TeamsGovernancePage from "./TeamsGovernancePage";
import "./RadaiAIProjectPage.css";
import { useSelector } from "react-redux";
import ProfileAvatar from "../components/Common/ProfileAvatar";
import { useCurrentProfilePhoto } from "../components/Layout/ProfilePhotoContext";
import { USER_DISPLAY_CONFIG } from "../config/userDisplay.config";

// The signed-in person's profile photo beside their messages, with their initials when there is none.
function ChatUserAvatar() {
  const user = useSelector((state) => state.auth.user);
  const shared = useCurrentProfilePhoto();
  const account = user?.user || user;
  const photo = shared.photo || user?.profile_photo || account?.profile_photo || user?.employee?.profile_photo || "";
  return (
    <span className="radai-ai-user-avatar" aria-hidden="true">
      <ProfileAvatar name={USER_DISPLAY_CONFIG.formatting.getDisplayName(user)} photoUrl={photo}
        photoEndpoint="/users/employees/my-profile-photo/" className="h-full w-full" />
    </span>
  );
}

const FOCUS_KEY = "radai.intelligence.focus";

// Team & Enterprise lives inside RADAI Intelligence as its own section.
const TEAMS_ON = import.meta.env.VITE_ENABLE_ENTERPRISE_TEAMS === "true";


const menuEntries = [
  { id: "upload", label: "Upload or add files", icon: Paperclip, supported: true },
  { id: "addProject", label: "Add to project", icon: FolderPlus, supported: true, hint: "Move chat, save files" },
  { id: "skills", label: "Skills", icon: Bot, supported: true, hint: "P&ID review, CRS replies…" },
  { id: "connectors", label: "Connectors", icon: Plug, supported: true, hint: "Project documents, line lists" },
  { id: "design", label: "Design system", icon: Palette, supported: true },
  { id: "web", label: "Web search", icon: Globe, supported: true },
  { id: "cowork", label: "Cowork with your team", icon: Users, supported: false },
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
  const [modelScope, setModelScope] = useState("general");  // general chat runs on Gemini Flash
  const [modelError, setModelError] = useState("");
  const [projectId, setProjectId] = useState("");
  const [view, setView] = useState("chat");
  // Teams & Governance opens as a full-window console over the page.
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [connectorsOpen, setConnectorsOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [activeSkill, setActiveSkill] = useState(null);  // stays on for the chat until removed
  // Skills catalogue for prompt starters (built-in + custom). Refreshed when the Skills dialog closes.
  const [skillCatalog, setSkillCatalog] = useState([]);
  const loadSkillCatalog = () => listAISkills().then((r) => setSkillCatalog([...(r.custom || []), ...(r.results || [])])).catch(() => setSkillCatalog([]));
  useEffect(() => { loadSkillCatalog(); }, []);
  // Web search: allowed per organization policy (Claude only); switched on per chat by the user.
  const [webStatus, setWebStatus] = useState({ allowed: false, reason: "" });
  const [webSearch, setWebSearch] = useState(false);
  // Design system for generated Word/PDF/Excel files: Rejlers branding (default) or plain. Remembered per browser.
  const [design, setDesign] = useState(() => { try { return localStorage.getItem("radai.intelligence.design") === "plain" ? "plain" : "rejlers"; } catch { return "rejlers"; } });
  useEffect(() => { try { localStorage.setItem("radai.intelligence.design", design); } catch { /* storage unavailable */ } }, [design]);
  // Focus mode: the chat fills the whole window (app menu and header hidden). Remembered per browser.
  const [focusMode, setFocusMode] = useState(() => { try { return localStorage.getItem(FOCUS_KEY) === "1"; } catch { return false; } });
  // ?view=teams (used by the old /teams address) opens Teams & Governance, then clears itself.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get("view") !== "teams") return;
    if (TEAMS_ON) setTeamsOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("view");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  useEffect(() => {
    try { localStorage.setItem(FOCUS_KEY, focusMode ? "1" : "0"); } catch { /* storage unavailable: keep the in-memory setting */ }
    if (!focusMode) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [focusMode]);
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);  // Recent chat waiting for "Delete?"
  const [deleteError, setDeleteError] = useState("");
  const [recentVersion, setRecentVersion] = useState(0);  // bump to reload Recent from the server
  const [recentMenu, setRecentMenu] = useState(null);  // { row, left, top } for the open "More" menu
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState("");
  const renaming = useRef(null);  // saves once even when Enter and leaving the field both fire
  const [linkRow, setLinkRow] = useState(null);  // Recent chat being added to a project
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [pinnedChats, setPinnedChats] = useState(readPinnedChats);
  const [contextOpen, setContextOpen] = useState(true);
  const [projectTab, setProjectTab] = useState("Instructions");
  const [projectInstructions, setProjectInstructions] = useState(null);
  const [projectSources, setProjectSources] = useState([]);
  const [contextError, setContextError] = useState("");
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  // Esc leaves full-window mode, unless something on top of the chat should take Esc first.
  useEffect(() => {
    if (!focusMode) return undefined;
    const onKey = (event) => {
      if (event.key !== "Escape" || event.defaultPrevented || teamsOpen || menuOpen || mobileNav) return;
      if (document.querySelector("[role=dialog][aria-modal=true]")) return;
      setFocusMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode, teamsOpen, menuOpen, mobileNav]);
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
  // The question being answered and the answer text received so far, until the saved conversation arrives.
  const [pending, setPending] = useState(null);
  const streamAbort = useRef(null);
  useEffect(() => () => streamAbort.current?.abort(), []);
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
    if (entry.id === "web") return !webStatus.allowed;
    if (entry.id === "skills") return false;
    return !entry.supported;
  };
  const entryNotSupportedReason = (entry) => {
    if (entry.id === "web") return webStatus.allowed ? (webSearch ? "Turn web search off" : "Let RADAI search the public web for this chat") : webStatus.reason;
    if (entry.id === "design") return design === "rejlers" ? "Generated Word, PDF and Excel files use Rejlers branding. Click for plain files." : "Generated files are plain. Click to use Rejlers branding.";
    if (entry.id === "addProject") return "Move this chat into a project or save its files as project knowledge";
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
  // Reload the model menu when the project, or the models its owner allows, change.
  const projectModelsKey = project ? `${project.default_chat_model || ""}|${(project.chat_models || []).map((row) => row.model_id).join(",")}` : "";
  useEffect(() => {
    let active = true;
    listAIChatModels(projectId || undefined).then((result) => {
      if (active) {
        setModelScope(result.scope || "general");
        setModels(result.models || []);
        setSelectedModel(result.default_model || "");
        setWebStatus(result.web_search || { allowed: false, reason: "" });
        if (result.policy_restricted && !(result.models || []).length) {
          setModelError("Your organization's approved AI model list doesn't include any model configured here. Ask an organization admin to update it in Teams & Governance.");
        }
      }
    }).catch(() => { if (active) { setModels([]); setModelError("Model list could not be loaded. Check the Django connection."); } });
    return () => { active = false; };
  }, [projectId, projectModelsKey]);
  useEffect(() => {
    if (!["search", "history"].includes(view)) return;
    let active = true;
    setHistoryLoading(true);
    const timer = setTimeout(
      () =>
        listRecentAIConversations(query.trim(), 200)
          .then((result) => {
            if (!active) return;
            setHistory(result.results || []);
            setHistoryError("");
          })
          .catch(() => { if (active) setHistoryError("Chat history is unavailable. Check the Django connection."); })
          .finally(() => { if (active) setHistoryLoading(false); }),
      query ? 250 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [view, query]);
  // Left-panel Recent: your newest chats across general chat and every project (pinned first).
  useEffect(() => {
    let active = true;
    listRecentAIConversations("", 30)
      .then((result) => { if (active) setRecentChats(result.results || []); })
      .catch(() => { if (active) setRecentChats([]); });
    return () => { active = false; };
  }, [conversationId, messages.length, projects.length, recentVersion]);
  // Chats can change in another tab or window: reload Recent when the reader comes back to this one.
  useEffect(() => {
    const reload = () => setRecentVersion((value) => value + 1);
    const reloadIfShown = () => { if (document.visibilityState === "visible") reload(); };
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", reloadIfShown);
    return () => {
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", reloadIfShown);
    };
  }, []);
  const togglePin = (id) => {
    setPinnedChats((previous) => {
      const next = previous.includes(id) ? previous.filter((x) => x !== id) : [id, ...previous];
      writePinnedChats(next);
      return next;
    });
  };
  const forgetChat = (row) => {
    setHistory((previous) => previous.filter((item) => item.id !== row.id));
    setRecentChats((previous) => previous.filter((item) => item.id !== row.id));
    if (pinnedChats.includes(row.id)) togglePin(row.id);
    if (row.id === conversationId) { setConversationId(null); setMessages([]); }
  };
  // Deleting hides the chat for you (archived on the server, as "Archive" in All chats does).
  const deleteRecentChat = async (row) => {
    setDeleteError("");
    try {
      await archiveAIConversation(row.project?.id, row.id);
      setConfirmDelete(null);
      forgetChat(row);
      setRecentVersion((value) => value + 1);
    } catch (error) {
      if (error?.response?.status === 404) {  // already deleted elsewhere: just drop it from the list
        setConfirmDelete(null);
        forgetChat(row);
        setRecentVersion((value) => value + 1);
        return;
      }
      setDeleteError(error?.response?.status === 403 ? "Only the person who started this chat can delete it." : "The chat could not be deleted. Try again.");
    }
  };
  const openRecentMenu = (row, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setRecentMenu((current) => (current?.row.id === row.id ? null : { row, left: Math.min(rect.left, window.innerWidth - 196), top: rect.bottom + 4 }));
  };
  const startRename = (row) => {
    setRecentMenu(null);
    setRenamingId(row.id);
    renaming.current = row.id;
    setRenameDraft(row.title === "New conversation" ? "" : row.title || "");
  };
  const saveRename = async (row) => {
    if (renaming.current !== row.id) return;
    renaming.current = null;
    const title = renameDraft.trim();
    setRenamingId(null);
    if (!title || title === row.title) return;
    setDeleteError("");
    try {
      await updateAIConversation(row.project?.id, row.id, title);
      retitleChat(row, title);
    } catch (error) {
      setDeleteError(error?.response?.status === 403 ? "Only the person who started this chat can rename it." : "The chat could not be renamed. Try again.");
    }
  };
  // Add to project from Recent: move a general chat (messages and files) into a project.
  const linkRecentChat = async (target, payload) => {
    const result = await addChatToProject(null, linkRow.id, { ...payload, workspace_id: target.id });
    if (result.moved && linkRow.id === conversationId) setProjectId(String(target.id));
    await reload();
    setRecentVersion((value) => value + 1);
    return result;
  };
  useEffect(() => {
    if (!recentMenu) return undefined;
    const close = (event) => { if (!event.target?.closest?.(".radai-ai-recent-menu, .radai-ai-recent-more")) setRecentMenu(null); };
    const onKey = (event) => { if (event.key === "Escape") setRecentMenu(null); };
    document.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [recentMenu]);
  const retitleChat = (row, title) => {
    const update = (list) => list.map((item) => (item.id === row.id ? { ...item, title } : item));
    setHistory(update);
    setRecentChats(update);
  };
  const pinnedRecent = recentChats.filter((row) => pinnedChats.includes(row.id));
  const recentList = [...pinnedRecent, ...recentChats.filter((row) => !pinnedChats.includes(row.id))].slice(0, Math.max(7, pinnedRecent.length));
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
    setProjectTab("Overview");
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
  // ?project=<id> (the "Open" link in Teams & Governance) selects that AI project once the list has loaded.
  useEffect(() => {
    const wanted = searchParams.get("project");
    if (!wanted || !projects.length) return;
    const row = projects.find((item) => String(item.id) === wanted);
    if (row) selectProjectInChat(row);
    else setError("You don't have access to that AI project. Ask its owner or your team admin.");
    const next = new URLSearchParams(searchParams);
    next.delete("project");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectProjectInChat only sets state
  }, [searchParams, projects]);
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
  // Projects board actions. Each returns true on success so the board can close its form or prompt.
  const createProject = async (payload) => {
    setBusy(true);
    setError("");
    try {
      const row = await createAIProject(payload);
      await reload();
      setProjectId(String(row.id));
      setProjectTab("Instructions");
      setView("project");
      return true;
    } catch {
      setError("Project could not be created.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const renameProject = async (row, value) => {
    if (!value.trim()) return false;
    try {
      await updateAIProject(row.id, { name: value.trim() });
      await reload();
      return true;
    } catch {
      setError("Project could not be renamed.");
      return false;
    }
  };
  const archiveProject = async (row) => {
    try {
      await archiveAIProject(row.id);
      await reload();
      if (String(row.id) === projectId) {
        setProjectId("");
        newChat();
      }
      return true;
    } catch {
      setError("Project could not be archived.");
      return false;
    }
  };
  // Open any chat: a row from Recent or history carries its project, so switch to that project first.
  const open = async (target) => {
    if (busy) return;
    const row = typeof target === "object" ? target : { id: target, project: project ? { id: project.id } : null };
    const pid = row.project ? String(row.project.id) : "";
    try {
      if (pid) await getAIProject(pid);
      const full = await getAIConversation(pid || undefined, row.id);
      if (pid !== projectId) setProjectId(pid);
      setMessages(full.messages || []);
      setConversationId(full.id);
      setView("chat");
      setError("");
      setAttachments([]);
      setDraft("");
      setMobileNav(false);
      retry.current = null;
    } catch {
      setError("That chat is no longer available. Its project may be archived or your access changed.");
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
      setPending({ question, attachments, text: "" });
      const controller = new AbortController();
      streamAbort.current = controller;
      const result = await streamAIMessage(project?.id, id, question, requestId, selectedProvider, selectedModel, attachmentIds, webSearch && webStatus.allowed, activeSkill?.id, {
        signal: controller.signal,
        onDelta: (text) => setPending((current) => current && { ...current, text: current.text + text }),
      });
      setMessages(result.conversation.messages || []);
      setDraft("");
      setAttachments([]);
      retry.current = null;
    } catch (exc) {
      if (exc?.name === "AbortError") return;
      setError(
        exc?.response?.data?.provider ||
          exc?.response?.data?.detail ||
          "The assistant could not answer. Your draft remains available. A configured AI provider is required.",
      );
    } finally {
      streamAbort.current = null;
      setPending(null);
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
  // Connectors: attach a record from another RADAI module (creates the conversation if needed).
  const attachFromConnector = async (connector, item) => {
    let targetConversationId = conversationId;
    if (!targetConversationId) {
      targetConversationId = (await createAIConversation(project?.id)).id;
      setConversationId(targetConversationId);
    }
    const uploaded = await connectAIAttachment(project?.id, targetConversationId, connector, item.id);
    setAttachments((previous) => [...previous, {
      id: uploaded.id, name: uploaded.name, size: uploaded.size, content_type: uploaded.content_type,
      sha256: uploaded.sha256, status: "ready", source: connector,
    }]);
    return uploaded;
  };
  // Skills: turn one on (prefilling its starting message when the box is empty) and select the first [placeholder].
  const applySkill = (skill) => {
    setSkillsOpen(false);
    setActiveSkill(skill);
    if (skill) recordSkillUse(skill.id);
    if (skill && !draft.trim()) {
      setDraft(skill.starter);
      requestAnimationFrame(() => {
        const box = composer.current;
        if (!box) return;
        box.focus();
        const start = skill.starter.indexOf("[");
        const end = skill.starter.indexOf("]", start);
        if (start >= 0 && end > start && box.setSelectionRange) box.setSelectionRange(start, end + 1);
      });
    } else {
      requestAnimationFrame(() => composer.current?.focus());
    }
  };
  // Add to project: files attached anywhere in this chat (sent or still waiting to be sent).
  const chatFiles = (() => {
    const seen = new Map();
    for (const message of messages) for (const file of message.attachments || []) if (file?.id != null) seen.set(String(file.id), { id: file.id, name: file.name });
    for (const file of attachments) if (file?.id != null) seen.set(String(file.id), { id: file.id, name: file.name });
    return [...seen.values()];
  })();
  const createProjectForChat = async (name) => {
    const row = await createAIProject({ name, description: "", folder: "", visibility: "private" });
    await reload();
    return row;
  };
  const addCurrentChatToProject = async (target, payload) => {
    const result = await addChatToProject(project?.id, conversationId, { ...payload, workspace_id: target.id });
    if (result.moved) setProjectId(String(target.id));  // same conversation, now inside the project
    await reload();
    return result;
  };
  const openProjectChat = async (id) => {
    let row = projects.find((item) => String(item.id) === String(id));
    if (!row) row = (await listAIProjects()).results?.find((item) => String(item.id) === String(id));
    setAddProjectOpen(false);
    if (row) selectProjectInChat(row);
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
      setMenuOpen(false);
      setAddProjectOpen(true);
      return;
    }
    if (entry.id === "connectors") {
      setMenuOpen(false);
      setConnectorsOpen(true);
      return;
    }
    if (entry.id === "design") {
      setDesign((current) => (current === "rejlers" ? "plain" : "rejlers"));
      return;
    }
    if (entry.id === "web") {
      setMenuOpen(false);
      const next = !webSearch;
      // Web search runs on Claude only: switch to the first Claude model when turning it on.
      if (next && selectedProvider !== "anthropic") {
        const claude = models.find((row) => row.provider === "anthropic");
        if (claude) setSelectedModel(claude.model_id);
      }
      setWebSearch(next);
      requestAnimationFrame(() => composer.current?.focus());
      return;
    }
    if (entry.id === "skills") {
      setMenuOpen(false);
      setSkillsOpen(true);
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
        design,
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
    if (source.url) {  // web search result: open the page
      window.open(source.url, "_blank", "noopener,noreferrer");
      return;
    }
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
    <div className={`radai-ai-page relative flex h-full min-h-0 w-full overflow-hidden font-sans ${focusMode ? "radai-ai-focus" : ""}`}>
      {mobileNav && (
        <button
          type="button"
          aria-label="Close workspace navigation"
          onClick={() => setMobileNav(false)}
          className="absolute inset-0 z-10 bg-slate-950/30 xl:hidden"
        />
      )}
      {skillsOpen && <RadaiSkillsDialog activeSkillId={activeSkill?.id || ""} onClose={() => { setSkillsOpen(false); loadSkillCatalog(); requestAnimationFrame(() => composer.current?.focus()); }} onUse={(skill) => { applySkill(skill); loadSkillCatalog(); }} />}
      {addProjectOpen && (
        <RadaiAddToProjectDialog
          projects={projects}
          currentProject={project || null}
          hasConversation={Boolean(conversationId)}
          hasMessages={messages.length > 0}
          chatFiles={chatFiles}
          onClose={() => { setAddProjectOpen(false); requestAnimationFrame(() => composer.current?.focus()); }}
          onCreateProject={createProjectForChat}
          onSubmit={addCurrentChatToProject}
          onOpenProject={openProjectChat}
        />
      )}
      {recentMenu && createPortal(
        <div className="radai-ai-portal radai-ai-recent-menu" role="menu" aria-label={`Actions for ${chatTitle(recentMenu.row)}`}
          style={{ left: recentMenu.left, top: recentMenu.top }}>
          <button type="button" role="menuitem" autoFocus onClick={() => startRename(recentMenu.row)}><Pencil size={14} />Rename</button>
          {recentMenu.row.project ? (
            <span className="radai-ai-recent-menu-note" title="Chats that belong to a project stay there, so their citations keep working.">
              <Folder size={14} />In {recentMenu.row.project.name}
            </span>
          ) : (
            <button type="button" role="menuitem" onClick={() => { setLinkRow(recentMenu.row); setRecentMenu(null); setMobileNav(false); }}><FolderPlus size={14} />Add to project</button>
          )}
          <button type="button" role="menuitem" className="is-danger" onClick={() => { setConfirmDelete(recentMenu.row.id); setDeleteError(""); setRecentMenu(null); }}><Trash2 size={14} />Delete</button>
        </div>,
        document.body,
      )}
      {linkRow && (
        <RadaiAddToProjectDialog
          projects={projects}
          currentProject={null}
          hasConversation
          hasMessages
          chatFiles={[]}
          onClose={() => setLinkRow(null)}
          onCreateProject={createProjectForChat}
          onSubmit={linkRecentChat}
          onOpenProject={(id) => { setLinkRow(null); openProjectChat(id); }}
        />
      )}
      {connectorsOpen && <RadaiConnectorsDialog onClose={() => { setConnectorsOpen(false); requestAnimationFrame(() => composer.current?.focus()); }} onAttach={attachFromConnector} />}
      {teamsOpen && TEAMS_ON && createPortal(<TeamsGovernancePage fullscreen onClose={() => setTeamsOpen(false)} />, document.body)}
      <aside
        id="ai-nav"
        aria-label="RADAI Intelligence navigation"
        className={`${mobileNav ? "translate-x-0" : "-translate-x-full xl:translate-x-0"} radai-ai-nav absolute inset-y-0 left-0 z-20 flex flex-none flex-col transition-transform xl:relative`}
      >
        <div className="radai-ai-nav-heading flex items-center justify-between">
          <span className="radai-ai-brand"><span className="radai-ai-brand-mark" aria-hidden="true"><RejlersMark size={15} /></span>RADAI Intelligence</span>
          <button
            type="button"
            aria-label="Close workspace navigation"
            onClick={() => setMobileNav(false)}
            className="radai-ai-icon-btn xl:hidden"
          >
            <X size={18} />
          </button>
        </div>
        <nav aria-label="Workspace sections" className="radai-ai-nav-actions">
          <button type="button" onClick={() => newChat()} className="radai-ai-new-chat"><Plus size={16} />New chat</button>
          <button
            type="button"
            onClick={() => { setView("search"); setMobileNav(false); }}
            aria-current={view === "search" ? "page" : undefined}
            className={`radai-ai-search-trigger ${view === "search" ? "is-active" : ""}`}
          >
            <Search size={15} /><span>Search chats</span>
          </button>
        </nav>
        <div className="radai-ai-nav-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="radai-ai-nav-group">
            <div className="radai-ai-nav-label">
              <button type="button" onClick={() => setView("projects")}>Projects</button>
              <button type="button" onClick={() => setView("projects")} className="radai-ai-icon-btn" aria-label="Create project" title="Create project"><Plus size={15} /></button>
            </div>
            {projects.slice(0, 8).map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => selectProjectInChat(row)}
                className={`radai-ai-project-row ${projectId === String(row.id) ? "is-active" : ""}`}
              >
                <Folder size={15} className="shrink-0" />
                <span className="truncate">{row.name}</span>
              </button>
            ))}
            {!projects.length && <p className="radai-ai-nav-empty">No projects yet. You can still start a general chat.</p>}
          </div>
          <div className="radai-ai-nav-group">
            <div className="radai-ai-nav-label">
              <button type="button" onClick={() => { setView("history"); setMobileNav(false); }}>Recent</button>
              <button type="button" onClick={() => { setView("history"); setMobileNav(false); }} className="radai-ai-nav-more" title="All chats">
                <History size={13} aria-hidden="true" />All
              </button>
            </div>
            {recentList.map((row) => {
              const isPinned = pinnedChats.includes(row.id);
              const isOpen = view === "chat" && conversationId === row.id;
              return (
                <div key={row.id} className={`radai-ai-recent-item ${isOpen ? "is-active" : ""}`}>
                  {renamingId === row.id ? (
                    <form className="radai-ai-recent-rename" onSubmit={(event) => { event.preventDefault(); saveRename(row); }}>
                      <label className="sr-only" htmlFor={`recent-rename-${row.id}`}>Chat title</label>
                      <input id={`recent-rename-${row.id}`} autoFocus maxLength={160} value={renameDraft} placeholder="Chat title"
                        onChange={(event) => setRenameDraft(event.target.value)} onBlur={() => saveRename(row)}
                        onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); renaming.current = null; setRenamingId(null); } }} />
                    </form>
                  ) : <>
                  <button type="button" onClick={() => open(row)} className="radai-ai-recent-row" aria-current={isOpen ? "true" : undefined}
                    title={`${chatTitle(row)} · ${row.project ? row.project.name : "General"}`}>
                    {isPinned ? <Pin size={13} className="shrink-0" /> : <MessageCircle size={14} className="shrink-0" />}
                    <span className="min-w-0 flex-1">
                      <span className="radai-ai-recent-title">{chatTitle(row)}</span>
                      <span className="radai-ai-recent-meta">{row.project ? <><Folder size={10} aria-hidden="true" />{row.project.name}</> : "General"}<span aria-hidden="true">·</span>{relativeTime(row.updated_at)}</span>
                    </span>
                  </button>
                  {confirmDelete === row.id ? (
                    <span className="radai-ai-recent-confirm" role="group" aria-label={`Delete ${chatTitle(row)}?`}>
                      <button type="button" className="is-danger" onClick={() => deleteRecentChat(row)} autoFocus>Delete</button>
                      <button type="button" onClick={() => { setConfirmDelete(null); setDeleteError(""); }}
                        onKeyDown={(event) => { if (event.key === "Escape") setConfirmDelete(null); }}>Keep</button>
                    </span>
                  ) : (
                    <span className="radai-ai-recent-actions">
                      <button type="button" onClick={() => togglePin(row.id)} className={`radai-ai-recent-pin ${isPinned ? "is-on" : ""}`} aria-pressed={isPinned}
                        aria-label={isPinned ? `Unpin ${chatTitle(row)}` : `Pin ${chatTitle(row)}`} title={isPinned ? "Unpin" : "Pin to top"}>
                        <Pin size={12} />
                      </button>
                      <button type="button" onClick={(event) => openRecentMenu(row, event)} className={`radai-ai-recent-pin radai-ai-recent-more ${recentMenu?.row.id === row.id ? "is-open" : ""}`}
                        aria-label={`More actions for ${chatTitle(row)}`} title="Rename, add to project or delete"
                        aria-haspopup="menu" aria-expanded={recentMenu?.row.id === row.id}>
                        <MoreHorizontal size={13} />
                      </button>
                    </span>
                  )}
                  </>}
                </div>
              );
            })}
            {deleteError && <p className="radai-ai-recent-error" role="alert">{deleteError}</p>}
            {!recentChats.length && <p className="radai-ai-nav-empty">No chats yet. Your questions will appear here.</p>}
            {recentChats.length > recentList.length && (
              <button type="button" onClick={() => { setView("history"); setMobileNav(false); }} className="radai-ai-recent-all">View all chats</button>
            )}
          </div>
        </div>
        {TEAMS_ON && (
          <div className="radai-ai-nav-footer">
            <button
              type="button"
              onClick={() => { setTeamsOpen(true); setMobileNav(false); }}
              aria-haspopup="dialog"
              className="radai-ai-project-row"
            >
              <ShieldCheck size={15} className="shrink-0" />
              <span className="truncate">Teams &amp; Governance</span>
            </button>
          </div>
        )}
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex h-12 flex-none items-center border-b border-[var(--rd-border-soft)] px-4 xl:hidden">
          <button type="button" aria-label="Open workspace navigation" aria-controls="ai-nav"
            aria-expanded={mobileNav} onClick={() => setMobileNav(true)}
            className="rounded-md p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)]">
            <Menu size={19} />
          </button>
          <span className="ml-2 truncate text-sm font-semibold">RADAI Intelligence</span>
          <button type="button" onClick={() => setFocusMode((on) => !on)} aria-pressed={focusMode}
            aria-label={focusMode ? "Exit full window" : "Full window"} title={focusMode ? "Exit full window (Esc)" : "Full window"}
            className="radai-ai-icon-btn ml-auto">
            {focusMode ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
        <div className="radai-ai-content-layout flex min-h-0 flex-1">
        <main className="radai-ai-main min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div className="radai-ai-toolbar">
            <div className="truncate"><button type="button" onClick={() => setView("projects")}>Projects</button><span className="mx-3 text-slate-400">/</span><strong>{project?.name || "General chat"}</strong></div>
            <div className="radai-ai-toolbar-actions flex items-center gap-2">
              {view === "chat" && (messages.length > 0 || pending) && <button type="button" onClick={newChat} className="radai-ai-context-toggle" aria-label="New chat" title="Start a new chat"><MessageSquarePlus size={16} /><span className="radai-ai-toggle-label">New chat</span></button>}
              {project && view !== "project" && <button type="button" onClick={() => { setProjectTab("Members"); setView("project"); }} className="radai-ai-context-toggle" aria-label="People"><Users size={16} /><span className="radai-ai-toggle-label">People</span></button>}
              {project && view !== "project" && view !== "projects" && <button type="button" onClick={() => setContextOpen((open) => !open)} className="radai-ai-context-toggle" aria-label="Project context"><FileText size={16} /><span className="radai-ai-toggle-label">Project context</span></button>}
              <button type="button" onClick={() => setFocusMode((on) => !on)} aria-pressed={focusMode}
                className="radai-ai-context-toggle radai-ai-focus-toggle" aria-label={focusMode ? "Exit full window" : "Full window"} title={focusMode ? "Exit full window (Esc)" : "Use the whole window"}>
                {focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}<span className="radai-ai-toggle-label">{focusMode ? "Exit full window" : "Full window"}</span>
              </button>
            </div>
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
            <RadaiProjectsBoard
              projects={projects}
              loading={loading}
              busy={busy}
              onCreate={createProject}
              onOpenChat={selectProjectInChat}
              onOpenSettings={select}
              onRename={renameProject}
              onArchive={archiveProject}
            />
          ) : view === "project" && project ? (
            <RadaiAIWorkspace
              key={project.id}
              project={project}
              initialTab={projectTab}
              onStartChat={newChat}
              onProjectUpdated={reload}
              onManageTeams={() => setTeamsOpen(true)}
            />
          ) : view === "history" || view === "search" ? (
            <RadaiConversationHistory
              rows={history}
              loading={historyLoading}
              error={historyError}
              query={query}
              onQueryChange={setQuery}
              focusSearch={view === "search"}
              initialFilter={projectId || "all"}
              activeId={conversationId}
              pinned={pinnedChats}
              onTogglePin={togglePin}
              onOpen={open}
              onNewChat={newChat}
              onRename={async (row, title) => {
                await updateAIConversation(row.project?.id, row.id, title);
                retitleChat(row, title);
              }}
              onArchive={async (row) => {
                await archiveAIConversation(row.project?.id, row.id);
                forgetChat(row);
              }}
            />
          ) : (
            <div className={`radai-ai-chat mx-auto flex min-h-full w-full max-w-5xl flex-col ${messages.length || pending ? "" : "is-empty"}`}>
              {!messages.length && !pending ? (
                <div className="radai-ai-hero">
                  <div className="radai-ai-hero-mark" aria-hidden="true">
                    <RejlersMark size={22} />
                  </div>
                  <p className="radai-ai-hero-eyebrow">
                    {project ? <><Folder size={13} aria-hidden="true" />{project.name}</> : "RADAI Intelligence"}
                  </p>
                  <h1 className="radai-ai-hero-title">
                    What can we work on today?
                  </h1>
                  <p className="radai-ai-hero-sub">
                    {project
                      ? "Answers use this project's instructions and sources, with citations."
                      : "Ask about drawings, line lists, CRS comments, tenders or project documents."}
                  </p>
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
                              <ChatUserAvatar />
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
                            <div className="radai-ai-assistant-heading"><span><RejlersMark size={18} /></span><strong>RADAI Intelligence</strong>{message.created_at && <time>{new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>}<AnswerMeta message={message} /></div>
                            <div className="radai-ai-answer-card">
                            <div className="text-sm leading-7 break-words">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                skipHtml
                                components={answerMarkdownComponents}
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
                  {pending && (
                    <div className="radai-ai-messages radai-ai-pending mb-6 space-y-6">
                      <div className="flex w-full flex-col">
                        <div className="radai-ai-user-message ml-auto max-w-[75%]">
                          <div className="radai-ai-user-content flex flex-col gap-1">
                            <p className="rounded-xl bg-[var(--rd-surface-subtle)] p-3.5 text-sm leading-6">{pending.question}</p>
                            <ChatUserAvatar />
                            {Boolean(pending.attachments.length) && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {pending.attachments.map((att) => (
                                  <div key={att.id} className="flex items-center gap-1.5 rounded-lg border border-[var(--rd-border-soft)] bg-[var(--rd-surface)] px-2 py-1">
                                    <FileText size={13} className="shrink-0 text-[var(--rd-text-muted)]" />
                                    <span className="text-xs truncate max-w-[120px]">{att.name}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex w-full flex-col">
                        <RadaiStreamingReply text={pending.text} />
                      </div>
                    </div>
                  )}
                </>
              )}
              <form
                onSubmit={send}
                className={`radai-ai-composer flex w-full flex-col gap-2 rounded-xl border border-[var(--rd-border-soft)] bg-[var(--rd-surface)] p-2.5 shadow-[var(--rd-shadow-card)] relative ${pending ? "is-streaming" : ""}`}
              >
                <input
                  type="file"
                  ref={fileInput}
                  hidden
                  accept=".pdf,.docx,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp,.bmp"
                  multiple
                  onChange={handleFileSelect}
                />
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
                            {entry.id === "design" && (
                              <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${design === "rejlers" ? "bg-[var(--ai-soft-nav)] text-[var(--ai-purple)]" : "bg-[var(--ai-surface-subtle)] text-[var(--ai-muted)]"}`}>
                                {design === "rejlers" ? "Rejlers" : "Plain"}
                              </span>
                            )}
                            {entry.id === "web" && (
                              <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${!webStatus.allowed ? "text-[var(--rd-text-faint)]" : webSearch ? "bg-[var(--ai-soft-nav)] text-[var(--ai-purple)]" : "bg-[var(--ai-surface-subtle)] text-[var(--ai-muted)]"}`}>
                                {!webStatus.allowed ? "Unavailable" : webSearch ? "On" : "Off"}
                              </span>
                            )}
                            {entry.hint && !disabled && <span className="ml-auto truncate pl-2 text-[11px] text-[var(--rd-text-faint)]">{entry.hint}</span>}
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
                <div className="radai-ai-composer-footer flex flex-nowrap items-center justify-between gap-2 border-t border-[var(--rd-border-soft)] pt-2">
                  <div className="radai-ai-composer-tools">
                    <button
                      type="button"
                      ref={actionTrigger}
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                      aria-label="Add files, context or actions"
                      title="Add files, context or actions"
                      onClick={toggleMenu}
                      className="radai-ai-plus"
                    >
                      <Plus size={18} />
                    </button>
                  {activeSkill && (
                    <span className="radai-ai-web-chip" title={activeSkill.description}>
                      <button type="button" className="inline-flex min-w-0 items-center gap-1.5" onClick={() => setSkillsOpen(true)} aria-label={`Skill: ${activeSkill.name}. Change skill`}>
                        <Bot size={14} /><span className="radai-ai-add-context-label max-w-[140px] truncate">{activeSkill.name}</span>
                      </button>
                      <button type="button" onClick={() => setActiveSkill(null)} aria-label="Turn off skill" className="grid place-items-center"><X size={12} /></button>
                    </span>
                  )}
                  {webSearch && webStatus.allowed && (
                    <button type="button" onClick={() => setWebSearch(false)} className="radai-ai-web-chip" title="Web search is on for this chat. Click to turn it off." aria-label="Turn off web search">
                      <Globe size={14} /><span className="radai-ai-add-context-label">Web search</span><X size={12} />
                    </button>
                  )}
                  </div>
                  <div className="radai-ai-composer-send">
                  <RadaiUsageMeter projectId={projectId || undefined} conversationId={conversationId || undefined} refreshKey={messages.length} />
                  <label htmlFor="ai-chat-model" className="sr-only">
                    Chat model
                  </label>
                  <select
                    id="ai-chat-model"
                    aria-label="Chat model"
                    value={selectedModel}
                    onChange={(event) => setSelectedModel(event.target.value)}
                    title={modelScope === "general" && models.length === 1 ? "General chat uses Gemini Flash, the low-cost model. RADAI switches to another model only if it fails." : undefined}
                    className="min-w-0 max-w-[170px] shrink rounded-lg border border-[var(--rd-border-soft)] bg-[var(--rd-surface)] px-2 py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)]"
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
                    className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--rd-primary)] px-3 text-white disabled:opacity-40"
                  >
                    {busy ? "Sending…" : <ArrowUp size={17} />}
                  </button>
                  </div>
                </div>
                {!selectedModel && (
                  <p role="status" className="mt-2 text-xs text-[var(--rd-text-muted)]">
                    {modelError || "No chat model is configured for RADAI Intelligence. An administrator can configure Claude, OpenAI or Gemini in AI API keys."}
                  </p>
                )}
              </form>
                <RadaiPromptStarters
                  skills={skillCatalog}
                  activeSkillId={activeSkill?.id || ""}
                  projectName={project?.name || ""}
                  fileNames={chatFiles.map((file) => file.name || "")}
                  inConversation={messages.length > 0 || Boolean(pending)}
                  onPick={applySkill}
                  onBrowse={() => setSkillsOpen(true)}
                />
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
        {project && contextOpen && view !== "projects" && view !== "project" && <aside className="radai-ai-context" aria-label="Project context">
          <div className="radai-ai-context-header"><h2>Project context</h2><button type="button" onClick={() => setContextOpen(false)} aria-label="Close project context"><X size={18} /></button></div>
          <section className="radai-ai-context-section"><h3>Project instructions</h3>
            {contextError ? <p role="alert">{contextError}</p> : projectInstructions ? <div className="radai-ai-instructions">{["role_behavior", "goals", "response_format", "terminology", "standards", "evidence_requirements", "constraints"].map((key) => projectInstructions[key]).filter(Boolean).join("\n\n") || "No project instructions added yet."}</div> : <p>Loading instructions...</p>}
          </section>
          <section className="radai-ai-context-section"><h3>{usedSources.length ? "Sources used" : "Project sources"}</h3>
            {usedSources.length ? <div className="radai-ai-sources">{usedSources.map((source, index) => <button key={`${source.source_id}-${index}`} type="button" onClick={() => downloadSource(source)} className="radai-ai-source" title={source.url || undefined}>{source.url ? <Globe size={18} /> : <FileText size={18} />}<span className="truncate">{source.document}{source.revision ? ` · Rev ${source.revision}` : ""}</span><span aria-hidden="true">···</span></button>)}</div> : projectSources.length ? <div className="radai-ai-sources">{projectSources.map((source) => <button key={source.id} type="button" onClick={() => { setProjectTab("Knowledge"); setView("project"); }} className="radai-ai-source"><FileText size={18} /><span className="truncate">{source.name}{source.version ? ` · Rev ${source.version}` : ""}</span><span aria-hidden="true">···</span></button>)}</div> : <p>No project sources yet.</p>}
            <button type="button" onClick={() => { setProjectTab("Knowledge"); setView("project"); }} className="radai-ai-source-add"><Plus size={18} /> Add source</button>
          </section>
        </aside>}
        </div>
      </div>
    </div>
  );
}
