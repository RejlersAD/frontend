import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  ArrowUp,
  BookOpen,
  FileSearch,
  FileText,
  Folder,
  GitCompare,
  History,
  Menu,
  Paperclip,
  Plus,
  Search,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { getProject, listProjects, uploadDocument, linkProjectDocument } from "../services/projectControl.service";
import {
  archiveConversation,
  createConversation,
  getConversation,
  listConversations,
  renameConversation,
  sendConversationMessage,
} from "../services/radaiIntelligence.service";
import RadaiProjectWorkspace from "./RadaiProjectWorkspace";
import RadaiConversationHistory from "./RadaiConversationHistory";
import AssistantMessageCard from "./AssistantMessageCard";

const QUICK_ACTIONS = [
  {
    label: "Review P&ID",
    icon: FileSearch,
    tool: "pid_review",
    prompt:
      "Help me plan a review of this P&ID. Identify the checks and evidence I should examine.",
  },
  {
    label: "Analyze Document",
    icon: FileText,
    tool: "document_analysis",
    prompt: "Help me analyze a project document. What should I check first?",
  },
  {
    label: "Compare Revisions",
    icon: GitCompare,
    tool: "revision_compare",
    prompt:
      "Help me plan a comparison of two document revisions. Which changes and evidence should I review?",
  },
  {
    label: "Sales Bid Decision",
    icon: FileText,
    tool: "sales_bid_decision",
    prompt:
      "Evaluate this tender opportunity and draft a bid/no-bid decision with supporting evidence from project sources.",
  },
  {
    label: "Executive Brief",
    icon: FileText,
    tool: "executive_brief",
    prompt:
      "Generate an executive briefing for this project with key risks, decisions, and next steps, citing project sources.",
  },
];

const navItems = [
  { id: "chat", label: "New Chat", icon: Plus },
  { id: "search", label: "Search", icon: Search },
  { id: "projects", label: "Projects", icon: Folder },
  { id: "knowledge", label: "Knowledge", icon: BookOpen },
  { id: "history", label: "History", icon: History },
  { id: "settings", label: "Settings", icon: Settings, unavailable: true },
];

const projectRows = (response) =>
  Array.isArray(response) ? response : response?.results || [];

const loadRecentIds = () => {
  try {
    const raw = localStorage.getItem("radai_recent_project_ids");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export default function RadaiIntelligencePage({
  canChat = false,
  accessLoading = false,
}) {
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [recentIds, setRecentIds] = useState(loadRecentIds);

  useEffect(() => {
    try {
      localStorage.setItem(
        "radai_recent_project_ids",
        JSON.stringify(recentIds),
      );
    } catch {
      // localStorage unavailable or quota exceeded; recent list is ephemeral.
    }
  }, [recentIds]);

  const [view, setView] = useState("chat");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [messageStatus, setMessageStatus] = useState({});
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const composerRef = useRef(null);
  const pendingRequestRef = useRef(null);
  const fileInput = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [pendingTool, setPendingTool] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const accessible = [];
        let page = 1;
        let next = true;
        while (next && active) {
          const response = await listProjects({ page, page_size: 100 });
          accessible.push(...projectRows(response));
          next = Boolean(response?.next);
          page += 1;
        }
        if (active) setProjects(accessible);
      } catch {
        if (active)
          setProjectsError(
            "Projects could not be loaded. Try refreshing the page.",
          );
      } finally {
        if (active) setProjectsLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const selectedProject = useMemo(
    () => projects.find((project) => String(project.id) === selectedProjectId),
    [projects, selectedProjectId],
  );
  const recentProjects = recentIds
    .map((id) => projects.find((project) => String(project.id) === id))
    .filter(Boolean);
  const filteredProjects = projects.filter((project) =>
    `${project.name || ""} ${project.code || ""}`
      .toLowerCase()
      .includes(projectSearch.toLowerCase()),
  );

  useEffect(() => {
    if (!selectedProjectId || !["history", "search"].includes(view)) return;
    let active = true;
    setHistoryLoading(true);
    setHistoryError("");
    const timer = setTimeout(
      () => {
        listConversations(
          selectedProjectId,
          historyQuery ? { q: historyQuery } : {},
        )
          .then((result) => {
            if (active) setConversations(result.results || []);
          })
          .catch(() => {
            if (active)
              setHistoryError("Conversation history could not be loaded.");
          })
          .finally(() => {
            if (active) setHistoryLoading(false);
          });
      },
      historyQuery ? 250 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedProjectId, view, historyQuery]);

  const selectProject = (project) => {
    if (sending) return;
    const id = String(project.id);
    if (id !== selectedProjectId) {
      setDraft("");
      setMessages([]);
      setConversationId(null);
      pendingRequestRef.current = null;
      setChatError("");
    }
    setSelectedProjectId(id);
    setRecentIds((previous) =>
      [id, ...previous.filter((item) => item !== id)].slice(0, 5),
    );
    setSidebarOpen(false);
  };

  const newChat = () => {
    if (sending) return;
    setDraft("");
    setMessages([]);
    setConversationId(null);
    pendingRequestRef.current = null;
    setChatError("");
    setView("chat");
    setSidebarOpen(false);
    requestAnimationFrame(() => composerRef.current?.focus());
  };

  const openView = (id) => {
    if (id === "chat") return newChat();
    setView(id);
    setSidebarOpen(false);
  };

  const applyQuickAction = (action) => {
    setDraft(action.prompt);
    setPendingTool(action.tool || null);
    setChatError("");
    setView("chat");
    requestAnimationFrame(() => composerRef.current?.focus());
  };

  const openConversation = async (id) => {
    if (!selectedProject || sending) return;
    setHistoryError("");
    try {
      const currentProject = await getProject(selectedProject.id);
      if (String(currentProject?.id) !== String(selectedProject.id))
        throw new Error("Project access changed");
      const conversation = await getConversation(selectedProject.id, id);
      setConversationId(conversation.id);
      setMessages(conversation.messages || []);
      setDraft("");
      setView("chat");
    } catch {
      setHistoryError(
        "This conversation could not be opened. Check project access.",
      );
    }
  };

  const changeTitle = async (conversation, title) => {
    if (!title?.trim() || title.trim() === conversation.title) return;
    try {
      await renameConversation(
        selectedProject.id,
        conversation.id,
        title.trim(),
      );
      setConversations((previous) =>
        previous.map((item) =>
          item.id === conversation.id ? { ...item, title: title.trim() } : item,
        ),
      );
    } catch {
      setHistoryError("Conversation could not be renamed.");
    }
  };

  const archive = async (conversation) => {
    try {
      await archiveConversation(selectedProject.id, conversation.id);
      setConversations((previous) =>
        previous.filter((item) => item.id !== conversation.id),
      );
      if (conversationId === conversation.id) newChat();
    } catch {
      setHistoryError("Conversation could not be archived.");
    }
  };

  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (!selectedProject) {
      setChatError("Select a project before uploading a document.");
      event.target.value = "";
      return;
    }
    const file = files[0];
    if (file.size > 12 * 1024 * 1024) {
      setChatError(`${file.name} exceeds the 12 MB limit.`);
      event.target.value = "";
      return;
    }
    setUploading(true);
    setChatError("");
    try {
      const document = await uploadDocument(selectedProject.id, file, {
        kind: "other",
        title: file.name,
      });
      await linkProjectDocument(selectedProject.id, document.id);
      setChatError("");
    } catch (exc) {
      setChatError(
        exc?.response?.data?.detail || `Failed to upload ${file.name}.`,
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const question = draft.trim();
    if (!question || !canChat || !selectedProject || sending) return;
    setSending(true);
    setChatError("");
    let projectVerified = false;
    try {
      const currentProject = await getProject(selectedProject.id);
      if (String(currentProject?.id) !== String(selectedProject.id))
        throw new Error("Project access changed");
      projectVerified = true;
      const id =
        conversationId || (await createConversation(currentProject.id)).id;
      setConversationId(id);
      const requestId =
        pendingRequestRef.current?.question === question
          ? pendingRequestRef.current.id
          : crypto.randomUUID();
      pendingRequestRef.current = { question, id: requestId };
      const result = await sendConversationMessage(
        currentProject.id,
        id,
        question,
        requestId,
        pendingTool || null,
      );
      if (!result?.conversation?.messages?.length)
        throw new Error("Empty response");
      setMessages(result.conversation.messages);
      pendingRequestRef.current = null;
      setPendingTool(null);
      setDraft("");
    } catch {
      setChatError(
        projectVerified
          ? "The assistant could not answer. Your draft is still here; please try again."
          : "Project access could not be confirmed. Your draft is still here; refresh your projects and try again.",
      );
    } finally {
      setSending(false);
    }
  };

  const handleApprove = (messageId) => {
    setMessageStatus((previous) => ({ ...previous, [messageId]: "approved" }));
  };

  const handleFlag = (messageId) => {
    setMessageStatus((previous) => ({ ...previous, [messageId]: "flagged" }));
  };

  const handleReject = (messageId) => {
    setMessageStatus((previous) => ({ ...previous, [messageId]: "rejected" }));
  };

  const sendExplanation = projectsLoading
    ? "Loading accessible projects…"
    : projectsError
      ? projectsError
      : accessLoading
        ? "Checking assistant access…"
        : !canChat
          ? "Chat requires P&ID Analysis access. Ask an administrator for the appropriate permission."
          : !selectedProject
            ? "Select an accessible project to start a conversation."
            : "Responses use the existing P&ID assistant. Check engineering conclusions against source evidence.";

  return (
    <div className="relative flex h-full min-h-0 w-full overflow-hidden bg-[var(--rd-bg)] font-sans text-[var(--rd-text)]">
      {sidebarOpen && (
        <button
          type="button"
          className="absolute inset-0 z-10 bg-slate-950/30 lg:hidden"
          aria-label="Close workspace navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        id="intelligence-sidebar"
        aria-label="RADAI Intelligence navigation"
        className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} absolute inset-y-0 left-0 z-20 flex w-[220px] flex-none flex-col border-r border-[var(--rd-border-soft)] bg-[var(--rd-surface)] px-3 py-4 transition-transform lg:relative`}
      >
        <div className="mb-6 flex items-center justify-between px-2">
          <span className="text-sm font-semibold tracking-tight">
            Workspace
          </span>
          <button
            type="button"
            className="rounded-md p-2 text-[var(--rd-text-muted)] hover:bg-[var(--rd-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)] lg:hidden"
            aria-label="Close workspace navigation"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <nav className="space-y-1" aria-label="Workspace sections">
          {navItems.slice(0, 5).map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={item.unavailable || (sending && item.id === "chat")}
              onClick={() => openView(item.id)}
              aria-current={view === item.id ? "page" : undefined}
              title={
                item.unavailable
                  ? `${item.label} is not available in this phase`
                  : undefined
              }
              className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)] ${view === item.id ? "bg-[var(--rd-primary-soft)] font-medium text-[var(--rd-primary)]" : "text-[var(--rd-text-muted)] hover:bg-[var(--rd-bg)]"} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <item.icon size={17} aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-7 min-h-0 flex-1 overflow-y-auto border-t border-[var(--rd-border-soft)] pt-5">
          <p className="px-3 text-xs font-semibold uppercase tracking-wide text-[var(--rd-text-faint)]">
            Recent Projects
          </p>
          {recentProjects.length ? (
            recentProjects.map((project) => (
              <button
                type="button"
                key={project.id}
                onClick={() => {
                  selectProject(project);
                  setView("project");
                }}
                className="mt-2 flex min-h-11 w-full items-center gap-2 truncate rounded-lg px-3 text-left text-sm text-[var(--rd-text-muted)] hover:bg-[var(--rd-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)]"
              >
                <Folder size={16} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{project.name}</span>
              </button>
            ))
          ) : (
            <p className="px-3 pt-3 text-xs leading-5 text-[var(--rd-text-faint)]">
              Projects you select appear here for this session.
            </p>
          )}
        </div>
        <button
          type="button"
          disabled
          title="Settings are not available in this phase"
          className="flex min-h-11 items-center gap-3 border-t border-[var(--rd-border-soft)] px-3 pt-3 text-sm text-[var(--rd-text-faint)]"
        >
          <Settings size={17} aria-hidden="true" />
          Settings
        </button>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex h-12 flex-none items-center border-b border-[var(--rd-border-soft)] px-4 lg:hidden">
          <button
            type="button"
            aria-label="Open workspace navigation"
            aria-controls="intelligence-sidebar"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)]"
          >
            <Menu size={19} />
          </button>
          <span className="ml-2 truncate text-sm font-semibold">
            RADAI Intelligence
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-8">
          {view === "projects" ? (
            <div className="mx-auto max-w-2xl">
              <h1 className="text-xl font-semibold">Projects</h1>
              <p className="mt-1 text-sm text-[var(--rd-text-muted)]">
                Choose a project you can access.
              </p>
              <label
                className="mt-7 block text-sm font-medium"
                htmlFor="intelligence-project-search"
              >
                Find a project
              </label>
              <input
                id="intelligence-project-search"
                value={projectSearch}
                onChange={(event) => setProjectSearch(event.target.value)}
                className="rd-input mt-2 w-full"
                placeholder="Search by name or code"
              />
              {projectsLoading ? (
                <p className="mt-6 text-sm" role="status">
                  Loading projects…
                </p>
              ) : projectsError ? (
                <p
                  className="mt-6 text-sm text-[var(--rd-danger)]"
                  role="alert"
                >
                  {projectsError}
                </p>
              ) : filteredProjects.length ? (
                <div className="mt-5 space-y-1">
                  {filteredProjects.map((project) => (
                    <button
                      type="button"
                      key={project.id}
                      onClick={() => {
                        selectProject(project);
                        setView("project");
                      }}
                      className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-sm hover:bg-[var(--rd-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)]"
                    >
                      <span className="truncate">{project.name}</span>
                      <span className="ml-3 text-xs text-[var(--rd-text-faint)]">
                        {project.code}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-6 text-sm text-[var(--rd-text-muted)]">
                  No accessible projects match your search.
                </p>
              )}
            </div>
          ) : (view === "project" || view === "knowledge") &&
            selectedProject ? (
            <RadaiProjectWorkspace
              initialTab={view === "knowledge" ? "Knowledge" : "Overview"}
              projectId={selectedProject.id}
              onStartChat={() => {
                setView("chat");
                requestAnimationFrame(() => composerRef.current?.focus());
              }}
            />
          ) : view === "history" || view === "search" ? (
            <RadaiConversationHistory
              project={selectedProject}
              search={view === "search"}
              query={historyQuery}
              onQueryChange={setHistoryQuery}
              conversations={conversations}
              loading={historyLoading}
              error={historyError}
              onOpen={openConversation}
              onRename={changeTitle}
              onArchive={archive}
            />
          ) : (
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center py-8">
              {!messages.length ? (
                <div className="mb-8 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--rd-ai-soft)] text-[var(--rd-ai)]">
                    <Sparkles size={22} aria-hidden="true" />
                  </div>
                  <p className="mt-4 text-sm font-semibold tracking-wide text-[var(--rd-text-muted)]">
                    RADAI Intelligence
                  </p>
                  <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                    What can we work on today?
                  </h1>
                </div>
              ) : (
                <div aria-live="polite" className="mb-8 space-y-6">
                  {messages.map((message, index) => (
                    <AssistantMessageCard
                      key={message.id || `msg-${index}`}
                      message={message}
                      projectId={selectedProjectId}
                      status={messageStatus[message.id || `msg-${index}`] || "pending"}
                      onApprove={(messageId) => handleApprove(messageId)}
                      onFlag={(messageId) => handleFlag(messageId)}
                      onReject={(messageId) => handleReject(messageId)}
                    />
                  ))}
                </div>
              )}
              <form
                onSubmit={submit}
                className="rounded-2xl border border-[var(--rd-border-soft)] bg-[var(--rd-surface)] p-3 shadow-[var(--rd-shadow-card)] focus-within:border-[var(--rd-accent)]"
              >
                <label htmlFor="intelligence-composer" className="sr-only">
                  Message RADAI Intelligence
                </label>
                <textarea
                  ref={composerRef}
                  id="intelligence-composer"
                  rows={4}
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
                  placeholder="Ask about your project or start with a quick action…"
                  className="w-full resize-none bg-transparent px-2 py-1 text-sm leading-6 outline-none placeholder:text-[var(--rd-text-faint)]"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--rd-border-soft)] pt-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <label className="sr-only" htmlFor="intelligence-project">
                      Project
                    </label>
                    <select
                      id="intelligence-project"
                      value={selectedProjectId}
                      disabled={projectsLoading || !!projectsError || sending}
                      onChange={(event) => {
                        const project = projects.find(
                          (item) => String(item.id) === event.target.value,
                        );
                        if (project) selectProject(project);
                        else setSelectedProjectId("");
                      }}
                      className="max-w-[190px] rounded-lg border border-[var(--rd-border-soft)] bg-[var(--rd-surface)] px-2 py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)] disabled:opacity-50"
                    >
                      <option value="">Select project</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      ref={fileInput}
                      hidden
                      onChange={handleFileSelect}
                      accept=".pdf,.docx,.xlsx,.csv,.txt"
                    />
                    <button
                      type="button"
                      disabled={!selectedProject || uploading}
                      onClick={() => fileInput.current?.click()}
                      title={
                        uploading
                          ? "Uploading document…"
                          : "Attach or upload a project document to this chat"
                      }
                      aria-label="Attach project document"
                      className={`flex h-10 w-10 items-center justify-center rounded-lg text-[var(--rd-text-faint)] disabled:cursor-not-allowed ${uploading ? "opacity-50 animate-pulse" : ""}`}
                    >
                      <Paperclip size={17} />
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={
                      !canChat || !selectedProject || !draft.trim() || sending
                    }
                    aria-label="Send message"
                    className="flex h-10 min-w-10 items-center justify-center rounded-lg bg-[var(--rd-primary)] px-3 text-sm font-medium text-white transition-colors hover:bg-[var(--rd-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {sending ? "Sending…" : <ArrowUp size={17} />}
                  </button>
                </div>
              </form>
              <p
                className="mt-3 text-center text-xs leading-5 text-[var(--rd-text-muted)]"
                role="status"
              >
                {sendExplanation}
              </p>
              <p className="mt-1 text-center text-xs text-[var(--rd-text-faint)]">
                Add project documents through Knowledge before asking a
                source-grounded question.
              </p>
              {chatError && (
                <p
                  role="alert"
                  className="mt-2 text-center text-sm text-[var(--rd-danger)]"
                >
                  {chatError}
                </p>
              )}
              <div
                className="mt-7 flex flex-wrap justify-center gap-2"
                aria-label="Quick actions"
              >
                {QUICK_ACTIONS.map((action) => (
                  <button
                    type="button"
                    key={action.label}
                    onClick={() => applyQuickAction(action)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--rd-border-soft)] bg-[var(--rd-surface)] px-4 text-xs font-medium text-[var(--rd-text-muted)] transition-colors hover:border-[var(--rd-accent)] hover:text-[var(--rd-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--rd-accent)]"
                  >
                    <action.icon size={16} aria-hidden="true" />
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

RadaiIntelligencePage.propTypes = {
  canChat: PropTypes.bool,
  accessLoading: PropTypes.bool,
};
