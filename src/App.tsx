import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import "./App.css";
import "./styles/studio.css";
import { ChatWorkspace } from "./components/chat/ChatWorkspace";
import { ProjectDashboard } from "./components/ProjectDashboard";
import { ChatPanel, CodeEditorPanel, CommandPalette, FileExplorer, ModelStatus, PreviewPanel, SettingsModal, TerminalPanel } from "./components/StudioPanels";
import { defaultSettings, demoFiles } from "./data/demoProject";
import { checkLmStudio, streamChatCompletion } from "./services/ai/client";
import type { ChatAttachment, ChatMessage, ChatSession, FileChangeProposal, ProjectFile, StudioProject, StudioSettings } from "./types/studio";
import { createId } from "./utils/createId";

const storageKeys = { files: "local-ai-studio.files", messages: "local-ai-studio.messages", settings: "local-ai-studio.settings", sessions: "local-ai-studio.sessions", projects: "local-ai-studio.projects", activeProject: "local-ai-studio.active-project", projectName: "local-ai-studio.project-name" };

function readStored<T,>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage quota or privacy mode; keep the session usable in memory. */ }
}

function loadProjects() {
  const savedProjects = readStored<StudioProject[]>(storageKeys.projects, []);
  if (savedProjects.length) return savedProjects;
  return [{
    id: "demo-project",
    name: readStored(storageKeys.projectName, "Demo Project"),
    files: readStored(storageKeys.files, demoFiles),
    lastModified: Date.now(),
    starter: true,
  }];
}

function storageSafeMessages(items: ChatMessage[]) {
  return items.map((message) => ({
    ...message,
    files: message.files?.map((file) => {
      const metadata = { ...file };
      delete metadata.content;
      delete metadata.previewUrl;
      return metadata;
    }),
  }));
}

function createMessage(role: ChatMessage["role"], content: string, attachments?: string[]): ChatMessage {
  return { id: createId(), role, content, createdAt: Date.now(), attachments };
}

function App() {
  const [projects, setProjects] = useState<StudioProject[]>(loadProjects);
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    const savedProjects = readStored<StudioProject[]>(storageKeys.projects, []);
    const requestedId = readStored<string>(storageKeys.activeProject, "demo-project");
    return savedProjects.some((project) => project.id === requestedId) ? requestedId : savedProjects[0]?.id ?? "demo-project";
  });
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0];
  const files = activeProject?.files ?? demoFiles;
  const projectName = activeProject?.name ?? "Demo Project";
  const setFiles = (update: ProjectFile[] | ((current: ProjectFile[]) => ProjectFile[])) => {
    setProjects((current) => current.map((project) => project.id === activeProjectId ? {
      ...project,
      files: typeof update === "function" ? update(project.files) : update,
      lastModified: Date.now(),
    } : project));
  };
  const [messages, setMessages] = useState<ChatMessage[]>(() => readStored(storageKeys.messages, []));
  const [chatHistory, setChatHistory] = useState<ChatSession[]>(() => readStored(storageKeys.sessions, []));
  const [currentChatId, setCurrentChatId] = useState<string>(() => readStored<string>("local-ai-studio.current-chat", createId()));
  const [currentChatTitle, setCurrentChatTitle] = useState("");
  const [mode, setMode] = useState<"chat" | "coding">("chat");
  const [settings, setSettings] = useState<StudioSettings>(() => {
    const stored = readStored<StudioSettings>(storageKeys.settings, defaultSettings);
    const oldDefaultModel = stored.model === "qwen2.5-coder-7b-instruct" || stored.model === "qwen2.5-7b-instruct";
    const oldLocalApiUrl = stored.baseUrl === "http://localhost:1234/v1" || stored.baseUrl === "http://127.0.0.1:1234/v1";
    return {
      ...defaultSettings,
      ...stored,
      model: oldDefaultModel ? defaultSettings.model : stored.model,
      baseUrl: oldLocalApiUrl ? defaultSettings.baseUrl : stored.baseUrl,
      useLmStudio: oldDefaultModel ? true : stored.useLmStudio,
    };
  });
  const [projectQuery, setProjectQuery] = useState("");
  const [openPaths, setOpenPaths] = useState(["src/App.tsx", "index.html"]);
  const [activePath, setActivePath] = useState("src/App.tsx");
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Not connected");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [requestStatus, setRequestStatus] = useState("Idle");
  const [apiError, setApiError] = useState("");
  const [pendingProposal, setPendingProposal] = useState<FileChangeProposal | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    writeStored(storageKeys.projects, projects);
  }, [projects]);
  useEffect(() => { writeStored(storageKeys.activeProject, activeProjectId); }, [activeProjectId]);
  useEffect(() => {
    writeStored(storageKeys.messages, storageSafeMessages(messages));
  }, [messages]);
  useEffect(() => {
    const firstPrompt = messages.find((message) => message.role === "user")?.content ?? "New conversation";
    const savedTitle = currentChatTitle || chatHistory.find((session) => session.id === currentChatId)?.title;
    const activeSession = messages.length ? [{ id: currentChatId, title: savedTitle || firstPrompt.slice(0, 48), messages, updatedAt: messages[messages.length - 1].createdAt }] : [];
    const sessions = [...activeSession, ...chatHistory.filter((item) => item.id !== currentChatId)].slice(0, 20);
    writeStored(storageKeys.sessions, sessions.map((session) => ({ ...session, messages: storageSafeMessages(session.messages) })));
  }, [messages, currentChatId, currentChatTitle, chatHistory]);
  useEffect(() => { writeStored("local-ai-studio.current-chat", currentChatId); }, [currentChatId]);
  useEffect(() => {
    writeStored(storageKeys.settings, settings);
  }, [settings]);
  const saveFiles = () => {
    setFiles((current) => current.map((file) => ({ ...file, status: undefined })));
    setRequestStatus("Files saved locally");
    window.setTimeout(() => setRequestStatus("Idle"), 2200);
  };

  const selectFile = (path: string) => {
    setActivePath(path);
    setOpenPaths((current) => current.includes(path) ? current : [...current, path]);
    setDashboardOpen(false);
  };

  const openAttachmentInCoding = (attachment?: ChatAttachment) => {
    if (attachment) {
      const imported = { path: attachment.name, content: attachment.content ?? "", status: "new" as const };
      setFiles((current) => current.some((file) => file.path === imported.path)
        ? current.map((file) => file.path === imported.path ? { ...imported, status: "modified" as const } : file)
        : [...current, imported]);
      setActivePath(imported.path);
      setOpenPaths((current) => current.includes(imported.path) ? current : [...current, imported.path]);
    }
    setMode("coding");
  };

  const createFile = (folder = "") => {
    const name = window.prompt("File name", "untitled.tsx");
    if (!name?.trim()) return;
    const path = [folder, name.trim()].filter(Boolean).join("/");
    if (files.some((file) => file.path === path)) return window.alert("A file with that name already exists.");
    const file = { path, content: "", status: "new" as const };
    setFiles((current) => [...current, file]);
    selectFile(path);
  };

  const createFolder = (parent = "") => {
    const name = window.prompt("Folder name", "components");
    if (!name?.trim()) return;
    const path = [parent, name.trim().replace(/^\/+|\/+$/g, "")].filter(Boolean).join("/");
    if (files.some((file) => file.path === `${path}/.keep`)) return window.alert("That folder already exists.");
    setFiles((current) => [...current, { path: `${path}/.keep`, content: "", status: "new" }]);
  };

  const startNewProject = () => {
    const name = window.prompt("Project name", "My Project");
    if (!name?.trim()) return;
    if (projects.some((project) => project.name.toLowerCase() === name.trim().toLowerCase())) return window.alert("A project with that name already exists.");
    const project: StudioProject = { id: createId(), name: name.trim(), files: [], lastModified: Date.now() };
    setProjects((current) => [...current, project]);
    setActiveProjectId(project.id);
    setActivePath("");
    setOpenPaths([]);
    setPreviewKey((value) => value + 1);
    setDashboardOpen(false);
  };

  const importProject = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const importedFiles = await Promise.all(Array.from(fileList).map(async (file) => {
      const relativePath = file.webkitRelativePath || file.name;
      const path = relativePath.includes("/") ? relativePath.split("/").slice(1).join("/") : relativePath;
      return { path, content: await file.text() };
    }));
    const textFiles = importedFiles.filter((file) => !/\.(png|jpe?g|gif|webp|pdf|ico)$/i.test(file.path));
    if (!textFiles.length) return;
    const name = fileList[0].webkitRelativePath.split("/")[0] || fileList[0].name.replace(/\.[^.]+$/, "") || "Imported Project";
    const project: StudioProject = { id: createId(), name, files: textFiles, lastModified: Date.now() };
    setProjects((current) => [...current, project]);
    setActiveProjectId(project.id);
    setActivePath(textFiles[0].path);
    setOpenPaths([textFiles[0].path]);
    setPreviewKey((value) => value + 1);
    setDashboardOpen(false);
  };

  const switchProject = (project: StudioProject) => {
    setActiveProjectId(project.id);
    const firstFile = project.files.find((file) => !file.path.endsWith("/.keep"));
    setActivePath(firstFile?.path ?? "");
    setOpenPaths(firstFile ? [firstFile.path] : []);
    setPreviewKey((value) => value + 1);
    setDashboardOpen(false);
  };

  const renameProject = (project: StudioProject, name: string) => {
    if (projects.some((item) => item.id !== project.id && item.name.toLowerCase() === name.toLowerCase())) return window.alert("A project with that name already exists.");
    setProjects((current) => current.map((item) => item.id === project.id ? { ...item, name, lastModified: Date.now() } : item));
  };

  const deleteProject = (project: StudioProject) => {
    if (project.starter) return;
    if (!window.confirm(`Delete project “${project.name}” and all its files?`)) return;
    setProjects((current) => current.filter((item) => item.id !== project.id));
    if (project.id === activeProjectId) {
      const starter = projects.find((item) => item.starter) ?? projects.find((item) => item.id !== project.id);
      if (starter) switchProject(starter);
    }
  };

  const exportProjectZip = async (project = activeProject) => {
    if (!project) return;
    const archive = new JSZip();
    for (const file of project.files) {
      if (!file.path.endsWith("/.keep")) archive.file(file.path, file.content, file.encoding === "base64" ? { base64: true } : undefined);
    }
    const blob = await archive.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.name.replace(/[<>:"/\\|?*]/g, "-") || "project"}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const saveResponseAsFile = async (message: ChatMessage) => {
    const codeBlock = message.content.match(/```([\w.+#-]*)\s*\n([\s\S]*?)```/);
    const extension = codeBlock?.[1] === "typescript" ? "ts" : codeBlock?.[1] === "tsx" ? "tsx" : codeBlock?.[1] === "javascript" ? "js" : codeBlock?.[1] || "md";
    const initialName = extension === "md" ? "response.md" : `response.${extension}`;
    const fileName = window.prompt("Save AI response as", initialName)?.trim();
    if (!fileName) return;
    const path = fileName.split("/").map((part) => part.replace(/[<>:"\\|?*]/g, "-")).join("/");
    let file: ProjectFile;
    if (path.toLowerCase().endsWith(".pdf")) {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF();
      const plainText = message.content.replace(/```[\w.+#-]*\s*\n([\s\S]*?)```/g, "$1").replace(/[*#`]/g, "");
      const lines = pdf.splitTextToSize(plainText, 180);
      pdf.text(lines, 15, 18);
      file = { path, content: pdf.output("datauristring").split(",")[1], encoding: "base64", status: "new" };
    } else {
      file = { path, content: codeBlock?.[2] ?? message.content, status: "new" };
    }
    const exists = files.some((entry) => entry.path === path);
    if (exists && !window.confirm(`${path} already exists. Replace it?`)) return;
    setFiles((current) => [...current.filter((entry) => entry.path !== path), file]);
    setActivePath(path);
    setOpenPaths((current) => current.includes(path) ? current : [...current, path]);
    setMode("coding");
  };

  const renamePath = (path: string) => {
    const nodeIsFolder = files.some((file) => file.path.startsWith(`${path}/`));
    const currentName = path.split("/").pop() ?? path;
    const name = window.prompt("Rename", currentName);
    if (!name?.trim() || name.trim() === currentName) return;
    const parent = path.split("/").slice(0, -1).join("/");
    const nextPath = [parent, name.trim()].filter(Boolean).join("/");
    setFiles((current) => current.map((file) => {
      if (file.path === path) return { ...file, path: nextPath, status: "modified" };
      if (nodeIsFolder && file.path.startsWith(`${path}/`)) return { ...file, path: file.path.replace(path, nextPath), status: "modified" };
      return file;
    }));
    setOpenPaths((current) => current.map((openPath) => openPath === path ? nextPath : nodeIsFolder && openPath.startsWith(`${path}/`) ? openPath.replace(path, nextPath) : openPath));
    if (activePath === path || (nodeIsFolder && activePath.startsWith(`${path}/`))) setActivePath(activePath.replace(path, nextPath));
  };

  const deletePath = (path: string) => {
    const removed = files.filter((file) => file.path === path || file.path.startsWith(`${path}/`));
    if (!removed.length || !window.confirm(`Delete ${path}${removed.length > 1 ? ` and ${removed.length - 1} nested file(s)` : ""}?`)) return;
    setFiles((current) => current.filter((file) => file.path !== path && !file.path.startsWith(`${path}/`)));
    setOpenPaths((current) => current.filter((openPath) => openPath !== path && !openPath.startsWith(`${path}/`)));
    if (activePath === path || activePath.startsWith(`${path}/`)) setActivePath("index.html");
  };

  const updateFile = (path: string, content: string) => setFiles((current) => current.map((file) => file.path === path ? { ...file, content, status: file.status === "new" ? "new" : "modified" } : file));

  const sendMessage = async (content: string, attachments: string[] = [], history = messages, attachedFiles: ChatAttachment[] = [], includeProject = false) => {
    const prompt = content || "Please review the attached files.";
    const userMessage = { ...createMessage("user", prompt, [...attachments, ...attachedFiles.map((file) => file.name)]), files: attachedFiles };
    const assistantMessage = createMessage("assistant", "");
    let apiUserMessage = userMessage;
    if (includeProject) {
      const projectContext = thisProjectContext(attachedFiles);
      apiUserMessage = { ...userMessage, content: `${prompt}\n\nProject context (${projectName}):\n${projectContext}` };
    }
    const conversation = [...history, apiUserMessage];
    setMessages([...history, userMessage, assistantMessage]);
    setIsGenerating(true);
    setApiError("");
    setRequestStatus("Generating");
    const controller = new AbortController();
    abortRef.current = controller;

    let generatedText = "";
    const appendToken = (token: string) => {
      generatedText += token;
      setMessages((current) => current.map((message) => message.id === assistantMessage.id ? { ...message, content: message.content + token } : message));
    };
    try {
      if (settings.useLmStudio) {
        setConnectionStatus("Connecting");
        const requestSettings = mode === "coding" ? { ...settings, systemPrompt: `You are a careful coding assistant working in ${projectName}. ${settings.systemPrompt} When asked to edit a file, return one fenced code block containing the complete replacement for the active file. Never claim the change is applied; it must be reviewed and accepted first.` } : settings;
        await streamChatCompletion({ messages: conversation, settings: requestSettings, signal: controller.signal, onToken: appendToken });
        setConnectionStatus("Connected");
      } else {
        const firstAttachment = attachedFiles.find((file) => file.content && !file.type.startsWith("image/"));
        const response = attachedFiles.length
          ? `I can see ${attachedFiles.map((file) => `**${file.name}**`).join(", ")}.${firstAttachment ? ` The attached text has ${(firstAttachment.content ?? "").split("\n").length} lines; it starts with:\n\n\`\`\`\n${(firstAttachment.content ?? "").split("\n").slice(0, 8).join("\n")}\n\`\`\`` : " This looks like a visual or binary file."}\n\nConnect LM Studio to analyze the complete attachment.`
          : prompt.toLowerCase().includes("relativity")
          ? "Relativity is the idea that measurements like time and distance depend on how an observer moves. Special relativity shows that the speed of light stays constant for all observers, which leads to time dilation and length contraction. General relativity describes gravity as the curvature of spacetime caused by mass and energy."
          : includeProject && prompt.toLowerCase().includes("structure")
          ? "This project is a small React site with a single page, a stylesheet, and a standalone `index.html` preview. The cleanest place to make visual changes is `index.html`; `src/App.tsx` shows the component version."
          : prompt.toLowerCase().includes("improve") || prompt.toLowerCase().includes("design")
            ? "A useful first step is to be clear about the outcome you want, then break it into the smallest testable changes. Tell me a little more about the goal and I’ll help you shape it.\n\nI’m in local demo mode; connect LM Studio in **Settings → Connection** for full responses."
            : `I can help with that. I’m in local demo mode, so connect your general AI model in **Settings → Connection** for a complete response.`;
        for (const token of response.split(/(?<=\s)/)) {
          if (controller.signal.aborted) break;
          appendToken(token);
          await new Promise((resolve) => window.setTimeout(resolve, 18));
        }
      }
      if (mode === "coding" && !controller.signal.aborted && /\b(edit|change|modify|update|implement|fix|refactor|ändere|bearbeite|überarbeite|ergänze|repariere|aktualisiere|implementiere)\b/i.test(prompt)) {
        const blocks = [...generatedText.matchAll(/```(?:[\w.+#-]+)?\s*\n([\s\S]*?)```/g)];
        const replacement = blocks[blocks.length - 1]?.[1];
        const targetFile = files.find((file) => file.path === activePath);
        if (targetFile && replacement?.trim() && replacement !== targetFile.content) {
          setPendingProposal({ id: createId(), path: targetFile.path, before: targetFile.content, after: replacement });
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        const detail = error instanceof Error ? error.message : "Unknown connection error";
        setApiError(detail);
        setConnectionStatus("Connection error");
        appendToken(`Could not reach LM Studio: ${detail}. Check the server URL and ensure the local server is running.`);
      }
    } finally {
      setIsGenerating(false);
      setRequestStatus(controller.signal.aborted ? "Stopped" : "Idle");
      abortRef.current = null;
    }
  };

  const thisProjectContext = (attachedFiles: ChatAttachment[]) => {
    const projectText = files.map((file) => `--- ${file.path} ---\n${file.content}`).join("\n\n");
    const attachedText = attachedFiles.filter((file) => file.content && !file.type.startsWith("image/")).map((file) => `--- ${file.name} ---\n${file.content}`).join("\n\n");
    return [projectText, attachedText].filter(Boolean).join("\n\n");
  };

  const sendChatMessage = (content: string, attachedFiles: ChatAttachment[], includeProject: boolean) => sendMessage(content, [], messages, attachedFiles, includeProject);
  const sendCodingMessage = (content: string, attachmentNames: string[]) => {
    const activeFile = files.find((file) => file.path === activePath);
    const attachedFiles = activeFile ? [{ id: createId(), name: activeFile.path, size: new Blob([activeFile.content]).size, type: "text/plain", content: activeFile.content }] : [];
    return sendMessage(content, attachmentNames, messages, attachedFiles, true);
  };

  const acceptProposal = () => {
    if (!pendingProposal) return;
    const currentFile = files.find((file) => file.path === pendingProposal.path);
    if (!currentFile || currentFile.content !== pendingProposal.before) {
      window.alert("This file changed since the proposal was created. Review the current file before accepting.");
      return;
    }
    updateFile(pendingProposal.path, pendingProposal.after);
    setPendingProposal(null);
  };

  const stopGeneration = () => abortRef.current?.abort();
  const archiveCurrentChat = () => {
    if (!messages.length) return;
    const firstPrompt = messages.find((message) => message.role === "user")?.content ?? "New conversation";
    setChatHistory((current) => [{ id: currentChatId, title: currentChatTitle || firstPrompt.slice(0, 48), messages, updatedAt: Date.now() }, ...current.filter((item) => item.id !== currentChatId)].slice(0, 20));
  };
  const newChat = () => {
    stopGeneration();
    archiveCurrentChat();
    setPendingProposal(null);
    setCurrentChatId(createId());
    setCurrentChatTitle("");
    setMessages([]);
    setApiError("");
  };
  const regenerate = () => {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
    if (!lastUserMessage) return;
    const history = messages.slice(0, messages.findIndex((message) => message.id === lastUserMessage.id));
    setMessages(history);
    void sendMessage(lastUserMessage.content, lastUserMessage.attachments, history, lastUserMessage.files);
  };

  const editChatMessage = (messageId: string, content: string) => {
    const index = messages.findIndex((message) => message.id === messageId);
    if (index < 0) return;
    const previous = messages.slice(0, index);
    const original = messages[index];
    setMessages(previous);
    void sendMessage(content, original.attachments, previous, original.files);
  };

  const renameChat = (sessionId: string, title: string) => {
    setChatHistory((current) => current.map((session) => session.id === sessionId ? { ...session, title } : session));
    if (sessionId === currentChatId) setCurrentChatTitle(title);
  };
  const deleteChat = (sessionId: string) => {
    setChatHistory((current) => current.filter((session) => session.id !== sessionId));
    if (sessionId === currentChatId) { setMessages([]); setCurrentChatId(createId()); setCurrentChatTitle(""); }
  };

  const testConnection = async () => {
    setConnectionStatus("Connecting");
    setApiError("");
    try {
      const models = await checkLmStudio(settings.baseUrl);
      if (models[0]) setSettings((current) => ({ ...current, model: current.model || models[0] }));
      setConnectionStatus("Connected");
    } catch (error) {
      setConnectionStatus("Connection error");
      setApiError(error instanceof Error ? error.message : "Unable to connect");
    }
  };

  const runCommand = (command: string) => {
    if (command === "new-file") { setMode("coding"); createFile(); }
    if (command === "new-folder") { setMode("coding"); createFolder(); }
    if (command === "open-file" || command === "search-files") { setMode("coding"); requestAnimationFrame(() => document.querySelector<HTMLInputElement>(".file-search input")?.focus()); }
    if (command === "terminal") { setMode("coding"); setTerminalOpen((value) => !value); }
    if (command === "preview") { setMode("coding"); setPreviewKey((value) => value + 1); }
    if (command === "new-chat") newChat();
    if (command === "clear-chat") setMessages([]);
    if (command === "connect-ai" || command === "settings") setSettingsOpen(true);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && (event.key.toLowerCase() === "k" || (event.shiftKey && event.key.toLowerCase() === "p"))) { event.preventDefault(); setPaletteOpen(true); }
      else if (mod && event.key.toLowerCase() === "p") { event.preventDefault(); document.querySelector<HTMLInputElement>(".file-search input")?.focus(); }
      else if (mod && event.key.toLowerCase() === "s" && mode === "coding") { event.preventDefault(); saveFiles(); }
      else if (mod && event.key.toLowerCase() === "b" && mode === "coding") { event.preventDefault(); document.body.classList.toggle("sidebar-hidden"); }
      else if (mod && event.key.toLowerCase() === "j") { event.preventDefault(); setMode("coding"); setTerminalOpen((value) => !value); }
      else if (mod && event.key === ",") { event.preventDefault(); setSettingsOpen(true); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const modifiedCount = files.filter((file) => file.status && !file.path.endsWith("/.keep")).length;
  const visibleFileCount = files.filter((file) => !file.path.endsWith("/.keep")).length;
  const sessionsForSidebar = messages.length ? [{ id: currentChatId, title: currentChatTitle || chatHistory.find((item) => item.id === currentChatId)?.title || (messages.find((message) => message.role === "user")?.content ?? "New conversation").slice(0, 48), messages, updatedAt: messages[messages.length - 1].createdAt }, ...chatHistory.filter((session) => session.id !== currentChatId)] : chatHistory;
  const updateModels = (models: string[]) => {
    setAvailableModels(models);
    if (models.length) {
      setConnectionStatus("Connected");
      if (!models.includes(settings.model)) setSettings((current) => ({ ...current, model: models[0] }));
    } else setConnectionStatus("Connection error");
  };

  const codingWorkspace = <div className={`studio-app ${settings.animations ? "motion-on" : "motion-off"}`}>
    <header className="topbar"><button className="brand-button" onClick={() => setDashboardOpen((value) => !value)} title="Project dashboard"><span className="brand-symbol">L</span><span>LOCAL AI <b>STUDIO</b></span></button><span className="topbar-divider" /><button className="project-switcher" onClick={() => setDashboardOpen((value) => !value)}><span className="project-icon">◫</span><span>{projectName}</span><span>⌄</span></button><div className="topbar-center"><span className="branch-indicator">⑂</span><span>main</span><span className="branch-dot">•</span><span>{modifiedCount ? `${modifiedCount} unsaved change${modifiedCount > 1 ? "s" : ""}` : "All changes saved"}</span></div><div className="topbar-right"><span className="request-status"><i className={isGenerating ? "busy" : ""} />{requestStatus}</span><ModelStatus model={settings.model} status={connectionStatus} onClick={() => setSettingsOpen(true)} /><button className="top-icon settings-trigger" title="Settings" onClick={() => setSettingsOpen(true)}>⚙</button><button className="avatar-button" title="Account">S</button><div className="studio-mode-switch"><button onClick={() => setMode("chat")}>Chat</button><button className="active">Coding</button></div></div></header>
    <div className="studio-body">
      <nav className="activity-rail"><button className="rail-button active" title="Explorer" onClick={() => document.body.classList.remove("sidebar-hidden")}>▤<i /></button><button className="rail-button" title="Search" onClick={() => document.querySelector<HTMLInputElement>(".file-search input")?.focus()}>⌕</button><button className="rail-button" title="Source control">⑂</button><span className="rail-spacer" /><button className="rail-button" title="Settings" onClick={() => setSettingsOpen(true)}>⚙</button><div className="rail-user">S</div></nav>
      <FileExplorer files={files} projectName={projectName} activePath={activePath} onSelect={selectFile} onCreateFile={createFile} onCreateFolder={createFolder} onRename={renamePath} onDelete={deletePath} onExport={() => void exportProjectZip()} />
      <main className="work-area">
        <div className="workspace-grid"><div className="code-preview-grid"><CodeEditorPanel files={files} activePath={activePath} openPaths={openPaths} onSelect={selectFile} onClose={(path) => { setOpenPaths((current) => current.filter((item) => item !== path)); if (activePath === path) setActivePath(openPaths.find((item) => item !== path) ?? ""); }} onChange={updateFile} onSave={saveFiles} fontSize={settings.fontSize} /><PreviewPanel files={files} refreshKey={previewKey} onRefresh={() => setPreviewKey((value) => value + 1)} /></div><ChatPanel key={currentChatId} messages={messages} isGenerating={isGenerating} onSend={sendCodingMessage} onStop={stopGeneration} onNewChat={newChat} onClear={() => setMessages([])} onRegenerate={regenerate} history={chatHistory} onSelectHistory={(session) => { stopGeneration(); archiveCurrentChat(); setCurrentChatId(session.id); setCurrentChatTitle(session.title); setMessages(session.messages); setApiError(""); }} proposal={pendingProposal} onAcceptProposal={acceptProposal} onRejectProposal={() => setPendingProposal(null)} onSaveAsFile={saveResponseAsFile} /></div>
        {terminalOpen && <TerminalPanel onClose={() => setTerminalOpen(false)} files={files} />}
        <footer className="statusbar"><div><span>◉</span><span>Local workspace</span><span className="statusbar-divider">│</span><span>{visibleFileCount} files</span></div><div><span className={apiError ? "error-status" : ""}>{apiError ? "⚠ 1 API error" : "✓ No errors"}</span><span>UTF-8</span><span>TypeScript React</span><button onClick={() => setTerminalOpen((value) => !value)}>⌁ Terminal</button></div></footer>
      </main>
    </div>
    {dashboardOpen && <ProjectDashboard projects={projects} query={projectQuery} onQueryChange={setProjectQuery} onClose={() => setDashboardOpen(false)} onCreate={startNewProject} onOpen={(fileList) => { void importProject(fileList); }} onSelect={switchProject} onExport={(project) => { void exportProjectZip(project); }} onDelete={deleteProject} onRename={renameProject} />}
    {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} onCommand={runCommand} />}
    {settingsOpen && <SettingsModal settings={settings} onChange={setSettings} onClose={() => setSettingsOpen(false)} onTest={() => void testConnection()} connectionStatus={connectionStatus} />}
  </div>;

  if (mode === "coding") return codingWorkspace;
  return <>
  <ChatWorkspace
    key={currentChatId}
    messages={messages}
    sessions={sessionsForSidebar}
    currentChatId={currentChatId}
    projectName={projectName}
    files={files}
    settings={settings}
    connectionStatus={connectionStatus}
    isGenerating={isGenerating}
    onSend={sendChatMessage}
    onStop={stopGeneration}
    onNewChat={newChat}
    onSelectSession={(session) => { stopGeneration(); archiveCurrentChat(); setCurrentChatId(session.id); setCurrentChatTitle(session.title); setMessages(session.messages); setApiError(""); }}
    onDeleteSession={deleteChat}
    onRenameSession={renameChat}
    onClearChat={() => setMessages([])}
    onRegenerate={regenerate}
    onEditMessage={editChatMessage}
    onSaveAsFile={saveResponseAsFile}
    onSettings={() => setSettingsOpen(true)}
    onCoding={() => setMode("coding")}
    onFileCoding={openAttachmentInCoding}
    onProjects={() => { setMode("coding"); setDashboardOpen(true); }}
    onSettingsChange={setSettings}
    onModels={updateModels}
    availableModels={availableModels}
    paletteOpen={paletteOpen}
    onClosePalette={() => setPaletteOpen(false)}
    onCommand={runCommand}
  />
  {settingsOpen && <SettingsModal settings={settings} onChange={setSettings} onClose={() => setSettingsOpen(false)} onTest={() => void testConnection()} connectionStatus={connectionStatus} models={availableModels} />}
  </>;
}

export default App;