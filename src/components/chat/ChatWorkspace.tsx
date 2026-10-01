import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { checkLmStudio } from "../../services/ai/client";
import type { ChatAttachment, ChatMessage, ChatSession, ProjectFile, StudioSettings } from "../../types/studio";
import { CommandPalette } from "../StudioPanels";
import { highlightCode } from "../../utils/highlightCode";
import { createId } from "../../utils/createId";
import "./chat.css";

type ChatWorkspaceProps = {
  messages: ChatMessage[];
  sessions: ChatSession[];
  currentChatId: string;
  projectName: string;
  files: ProjectFile[];
  settings: StudioSettings;
  connectionStatus: string;
  isGenerating: boolean;
  onSend: (content: string, files: ChatAttachment[], includeProject: boolean) => void;
  onStop: () => void;
  onNewChat: () => void;
  onSelectSession: (session: ChatSession) => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onClearChat: () => void;
  onRegenerate: () => void;
  onEditMessage: (messageId: string, content: string) => void;
  onSettings: () => void;
  onCoding: () => void;
  onFileCoding: (file: ChatAttachment) => void;
  onSaveAsFile: (message: ChatMessage) => void;
  onProjects: () => void;
  onSettingsChange: (settings: StudioSettings) => void;
  onModels: (models: string[]) => void;
  availableModels: string[];
  paletteOpen: boolean;
  onClosePalette: () => void;
  onCommand: (command: string) => void;
};

function safeInline(text: string) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function MarkdownContent({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.split("\n");
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    if (line.startsWith("```")) {
      const language = line.slice(3).trim() || "code";
      index += 1;
      const codeLines: string[] = [];
      while (index < lines.length && !lines[index].startsWith("```")) codeLines.push(lines[index++]);
      index += 1;
      const code = codeLines.join("\n");
      blocks.push(<div className="md-code-block" key={`code-${index}`}><div><span>{language}</span><button title="Copy code" onClick={() => void navigator.clipboard?.writeText(code)}>Copy</button></div><pre><code dangerouslySetInnerHTML={{ __html: highlightCode(code) }} /></pre></div>);
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)/);
    if (heading) {
      const level = heading[1].length;
      blocks.push(<div className={`md-heading md-h${level}`} key={`heading-${index}`} dangerouslySetInnerHTML={{ __html: safeInline(heading[2]) }} />);
      index += 1;
      continue;
    }
    if (line.includes("|") && lines[index + 1]?.match(/^\s*\|?\s*:?-{3,}/)) {
      const parseCells = (value: string) => value.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
      const headers = parseCells(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes("|")) rows.push(parseCells(lines[index++]));
      blocks.push(<div className="md-table-wrap" key={`table-${index}`}><table><thead><tr>{headers.map((cell, cellIndex) => <th key={cellIndex} dangerouslySetInnerHTML={{ __html: safeInline(cell) }} />)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{headers.map((_, cellIndex) => <td key={cellIndex} dangerouslySetInnerHTML={{ __html: safeInline(row[cellIndex] ?? "") }} />)}</tr>)}</tbody></table></div>);
      continue;
    }
    const listMarker = line.match(/^\s*([-*+] |\d+\. )/);
    if (listMarker) {
      const ordered = /^\d/.test(listMarker[1]);
      const items: string[] = [];
      while (index < lines.length && lines[index].match(/^\s*([-*+] |\d+\. )/)) items.push(lines[index++].replace(/^\s*([-*+] |\d+\. )/, ""));
      const List = ordered ? "ol" : "ul";
      blocks.push(<List key={`list-${index}`}>{items.map((item, itemIndex) => <li key={itemIndex} dangerouslySetInnerHTML={{ __html: safeInline(item) }} />)}</List>);
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^(#{1,4}\s|```|\s*([-*+] |\d+\. ))/.test(lines[index])) paragraph.push(lines[index++]);
    blocks.push(<p key={`p-${index}`} dangerouslySetInnerHTML={{ __html: paragraph.map(safeInline).join("<br />") }} />);
  }
  return <div className="markdown-body">{blocks}</div>;
}

function fileKind(file: ChatAttachment) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (file.type.startsWith("image/")) return "image";
  if (extension === "pdf" || file.type === "application/pdf") return "pdf";
  if (extension === "md" || extension === "markdown") return "markdown";
  if (["ts", "tsx", "js", "jsx", "html", "css", "json", "svg"].includes(extension)) return "code";
  return "text";
}

function formatSize(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileViewer({ file, onClose, onCoding }: { file: ChatAttachment; onClose: () => void; onCoding: (file: ChatAttachment) => void }) {
  const [maximized, setMaximized] = useState(false);
  const [markdownPreview, setMarkdownPreview] = useState(true);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragOrigin = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const kind = fileKind(file);
  const beginDrag = (event: PointerEvent<HTMLElement>) => {
    if (maximized || (event.target as HTMLElement).closest("button")) return;
    dragOrigin.current = { x: event.clientX, y: event.clientY, left: position.x, top: position.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    if (!dragOrigin.current) return;
    setPosition({ x: dragOrigin.current.left + event.clientX - dragOrigin.current.x, y: dragOrigin.current.top + event.clientY - dragOrigin.current.y });
  };
  return <div className="viewer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`file-viewer ${maximized ? "maximized" : ""}`} style={maximized ? undefined : { translate: `${position.x}px ${position.y}px` }}>
    <header onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={() => { dragOrigin.current = null; }}><div><span className="viewer-file-mark">{kind === "image" ? "▧" : kind === "pdf" ? "▤" : "⌘"}</span><strong>{file.name}</strong><small>{formatSize(file.size)}</small></div><nav>{kind === "markdown" && <button onClick={() => setMarkdownPreview((value) => !value)}>{markdownPreview ? "Source" : "Preview"}</button>}<button title="Copy file content" onClick={() => void navigator.clipboard?.writeText(file.content ?? "")}>Copy</button><button title="Open in Coding mode" onClick={() => onCoding(file)}>Open in Coding</button><button title={maximized ? "Restore" : "Maximize"} onClick={() => setMaximized((value) => !value)}>{maximized ? "❐" : "□"}</button><button title="Close viewer" onClick={onClose}>×</button></nav></header>
    <div className="viewer-content">{kind === "image" ? <img className="viewer-image" src={file.previewUrl ?? file.content} alt={file.name} /> : kind === "pdf" ? <iframe title={file.name} src={file.previewUrl ?? file.content} /> : kind === "markdown" && markdownPreview ? <MarkdownContent text={file.content ?? ""} /> : kind === "code" ? <div className="viewer-code"><div>{(file.content ?? "").split("\n").map((_, lineIndex) => <span key={lineIndex}>{lineIndex + 1}</span>)}</div><pre dangerouslySetInnerHTML={{ __html: highlightCode(file.content ?? "") }} /></div> : <pre className="viewer-text">{file.content || "This file has no text preview."}</pre>}</div>
  </section></div>;
}

function groupForSession(session: ChatSession) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const date = new Date(session.updatedAt);
  const sameDate = (left: Date, right: Date) => left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
  if (sameDate(today, date)) return "Today";
  if (sameDate(yesterday, date)) return "Yesterday";
  if (today.getTime() - date.getTime() < 7 * 86400000) return "Previous 7 Days";
  return "Older";
}

export function ChatWorkspace(props: ChatWorkspaceProps) {
  const { messages, sessions, currentChatId, projectName, files, settings, connectionStatus, isGenerating, availableModels } = props;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [viewerFile, setViewerFile] = useState<ChatAttachment | null>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [includeProject, setIncludeProject] = useState(false);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setSearchOpen(true);
        requestAnimationFrame(() => document.querySelector<HTMLInputElement>(".chat-search-input")?.focus());
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setSidebarOpen((open) => !open);
      } else if (event.key === "Escape") {
        setViewerFile(null);
        setModelOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const visibleSessions = useMemo(() => sessions.filter((session) => session.title.toLowerCase().includes(chatSearch.toLowerCase())), [sessions, chatSearch]);
  const groupedSessions = ["Today", "Yesterday", "Previous 7 Days", "Older"].map((group) => [group, visibleSessions.filter((session) => groupForSession(session) === group)] as const).filter(([, groupSessions]) => groupSessions.length);

  const addFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const selectedFiles = await Promise.all(Array.from(fileList).map((file) => new Promise<ChatAttachment>((resolve) => {
      const reader = new FileReader();
      const isImage = file.type.startsWith("image/");
      reader.onload = () => {
        const result = String(reader.result ?? "");
        resolve({ id: createId(), name: file.name, size: file.size, type: file.type || "text/plain", content: isImage ? result : result, previewUrl: isImage || file.type === "application/pdf" ? result : undefined });
      };
      reader.onerror = () => resolve({ id: createId(), name: file.name, size: file.size, type: file.type || "application/octet-stream" });
      if (isImage || file.type === "application/pdf") reader.readAsDataURL(file);
      else reader.readAsText(file);
    })));
    setAttachments((current) => [...current, ...selectedFiles]);
  };
  const submit = (text = draft, sentFiles = attachments) => {
    if ((!text.trim() && !sentFiles.length && !includeProject) || isGenerating) return;
    props.onSend(text.trim(), sentFiles, includeProject);
    setDraft("");
    setAttachments([]);
    requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }));
  };
  const onComposerKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); }
  };
  const loadModels = async () => {
    setModelLoading(true);
    try { props.onModels(await checkLmStudio(settings.baseUrl)); }
    catch { props.onModels([]); }
    finally { setModelLoading(false); }
  };
  const editMessage = (message: ChatMessage) => { setEditingMessage(message.id); setEditDraft(message.content); };
  const saveEdit = (message: ChatMessage) => { props.onEditMessage(message.id, editDraft); setEditingMessage(null); };
  const runChatCommand = (command: string) => {
    if (command === "search-chats") { setSearchOpen(true); requestAnimationFrame(() => document.querySelector<HTMLInputElement>(".chat-search-input")?.focus()); return; }
    if (command === "coding-mode") { props.onCoding(); return; }
    if (command === "select-model") { setModelOpen(true); void loadModels(); return; }
    if (command === "upload-file") { fileInputRef.current?.click(); return; }
    if (command === "project") { props.onProjects(); return; }
    if (command === "toggle-sidebar") { setSidebarOpen((value) => !value); return; }
    props.onCommand(command);
  };

  return <div className={`chat-app ${settings.compactChat ? "compact-chat" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); void addFiles(event.dataTransfer.files); }}>
    <header className="chat-topbar"><button className="chat-brand" title="Local AI Studio"><span className="chat-brand-mark">L</span><span>LOCAL AI STUDIO</span></button><button className="sidebar-toggle" title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"} onClick={() => setSidebarOpen((value) => !value)}>☰</button><span className="chat-topbar-spacer" /><div className="model-picker"><button onClick={() => { setModelOpen((value) => !value); void loadModels(); }}><span className="model-dot" />{settings.model}<span>⌄</span></button>{modelOpen && <div className="model-popover"><div><strong>Models</strong><button onClick={() => void loadModels()}>{modelLoading ? "Loading…" : "↻"}</button></div>{availableModels.length ? availableModels.map((model) => <button key={model} className={`model-option ${model === settings.model ? "active" : ""}`} onClick={() => { props.onSettingsChange({ ...settings, model }); setModelOpen(false); }}>{model}{model === settings.model && <span>Current</span>}</button>) : settings.model && <button className="model-option active" onClick={() => setModelOpen(false)}>{settings.model}<span>Current</span></button>}<p>{modelLoading ? "Loading models from LM Studio…" : availableModels.length ? `${availableModels.length} model(s) available` : "No model list yet. Check your LM Studio connection."}</p><button className="model-settings-link" onClick={props.onSettings}>AI Settings</button></div>}</div><span className={`connection-pill ${connectionStatus === "Connected" ? "connected" : connectionStatus === "Connection error" ? "error" : ""}`}><i />{connectionStatus === "Connected" ? "Connected" : connectionStatus === "Connection error" ? "Error" : "Local"}</span><button className="chat-settings-button" title="Clear chat" onClick={props.onClearChat}>⌫</button><button className="chat-settings-button" title="Settings" onClick={props.onSettings}>⚙</button><div className="mode-switch"><span className="mode-active">Chat</span><button onClick={props.onCoding}>Coding</button></div></header>
    <div className="chat-layout">
      <aside className={`chat-sidebar ${sidebarOpen ? "" : "collapsed"}`}>
        <button className="new-chat-button" title="New Chat" onClick={props.onNewChat}><span>＋</span><span>New Chat</span></button>
        <div className="chat-sidebar-actions"><span>CHATS</span><button title="Search Chats" onClick={() => { setSearchOpen((value) => !value); setChatSearch(""); }}>⌕</button></div>
        {searchOpen && <input className="chat-search-input" autoFocus value={chatSearch} onChange={(event) => setChatSearch(event.target.value)} placeholder="Search chats" />}
        <div className="chat-session-list">{groupedSessions.map(([group, groupSessions]) => <section key={group}><h2>{group}</h2>{groupSessions.map((session) => <div key={session.id} className={`chat-session-row ${session.id === currentChatId ? "active" : ""}`}><button onClick={() => props.onSelectSession(session)} title={session.title}><span>◌</span><span>{session.title}</span></button><div><button title="Rename chat" onClick={() => { const title = window.prompt("Rename chat", session.title); if (title?.trim()) props.onRenameSession(session.id, title.trim()); }}>···</button><button title="Delete chat" onClick={() => props.onDeleteSession(session.id)}>×</button></div></div>)}</section>)}{groupedSessions.length === 0 && <p className="no-chats">{chatSearch ? "No chats found" : "Your recent chats will show here"}</p>}</div>
        <div className="sidebar-bottom"><button onClick={() => props.onCoding()}><span>⌘</span><span>Coding mode</span><b>↗</b></button><button onClick={props.onProjects}><span>▦</span><span>Projects</span></button><button onClick={props.onSettings}><span>⚙</span><span>Settings</span></button><div className="local-profile"><span>LS</span><div><strong>Local workspace</strong><small>Private · On this device</small></div><button title="Settings" onClick={props.onSettings}>···</button></div></div>
      </aside>
      <main className="chat-main"><div className={`chat-drop-overlay ${dragging ? "visible" : ""}`}>Drop files to attach</div><div className="chat-scroll-area">
        {messages.length === 0 ? <div className="chat-empty-state"><span className="empty-spark">✳</span><h1>What can I help with?</h1><p>Your local assistant, ready when you are.</p><div className="starter-prompts"><button onClick={() => setDraft("Explain a complex topic in simple terms")}>✦ <span>Explain something</span><b>›</b></button><button onClick={() => setDraft("Help me think through an idea")}>◌ <span>Brainstorm an idea</span><b>›</b></button><button onClick={() => setDraft("Review this file and summarize the key points")}>▤ <span>Review a file</span><b>›</b></button></div></div> : <div className="chat-transcript">{messages.map((message, messageIndex) => <article className={`transcript-message ${message.role}`} key={message.id}><span className={`transcript-avatar ${message.role}`}>{message.role === "assistant" ? "✳" : "Y"}</span><div className="transcript-content"><header><strong>{message.role === "assistant" ? "Local AI" : "You"}</strong><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></header>{editingMessage === message.id ? <div className="edit-message-box"><textarea value={editDraft} onChange={(event) => setEditDraft(event.target.value)} /><div><button onClick={() => setEditingMessage(null)}>Cancel</button><button onClick={() => saveEdit(message)}>Save & submit</button></div></div> : <>
          {message.files?.map((file) => <button className="sent-file-card" key={file.id} onClick={() => setViewerFile(file)}>{file.previewUrl && file.type.startsWith("image/") ? <img src={file.previewUrl} alt="" /> : <span>{fileKind(file) === "pdf" ? "▤" : "▧"}</span>}<span><strong>{file.name}</strong><small>{formatSize(file.size)}</small></span><b>↗</b></button>)}
          <MarkdownContent text={message.content} />
          {message.role === "user" && <div className="message-tools"><button title="Copy message" onClick={() => void navigator.clipboard?.writeText(message.content)}>▢</button><button title="Edit message" onClick={() => editMessage(message)}>✎</button></div>}
          {message.role === "assistant" && <div className="message-tools"><button title="Copy response" onClick={() => void navigator.clipboard?.writeText(message.content)}>▢</button><button title="Save response as project file" onClick={() => props.onSaveAsFile(message)}>＋ Save as file</button>{messageIndex === messages.length - 1 && <button title="Regenerate response" onClick={props.onRegenerate}>↻</button>}{message.content.includes("```") && <button className="open-coding-action" onClick={() => props.onCoding()}>Open in Coding mode ↗</button>}</div>}
        </>}</div></article>)}{isGenerating && <div className="chat-thinking"><span><i /><i /><i /></span><strong>Thinking</strong><button onClick={props.onStop}>Stop</button></div>}<div ref={messagesEndRef} /></div>}
      </div><div className="composer-dock">
        {includeProject && <div className="context-chip"><span>▦</span> Project: {projectName} <small>{files.length} files</small><button title="Remove project context" onClick={() => setIncludeProject(false)}>×</button></div>}
        {attachments.length > 0 && <div className="pending-attachments">{attachments.map((file) => <button className="pending-file" key={file.id} onClick={() => setViewerFile(file)}>{file.previewUrl && file.type.startsWith("image/") ? <img src={file.previewUrl} alt="" /> : <span className="pending-file-icon">{fileKind(file) === "pdf" ? "▤" : "▧"}</span>}<span><strong>{file.name}</strong><small>{formatSize(file.size)}</small></span><i onClick={(event) => { event.stopPropagation(); setAttachments((current) => current.filter((item) => item.id !== file.id)); }}>×</i></button>)}</div>}
        <div className="chat-composer"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onComposerKey} placeholder="Message your local AI..." rows={1} /><div className="composer-toolbar"><div><button title="Attach files" onClick={() => fileInputRef.current?.click()}>＋</button><input ref={fileInputRef} type="file" multiple hidden onChange={(event) => { void addFiles(event.target.files); event.target.value = ""; }} /><button className={`project-context-toggle ${includeProject ? "active" : ""}`} title="Include project context" onClick={() => setIncludeProject((value) => !value)}>▦ <span>Project</span></button><span className="chat-model-hint">{settings.model}</span></div><div><span className="enter-hint">Enter to send · Shift+Enter for newline</span><button className="composer-send" disabled={isGenerating || (!draft.trim() && !attachments.length && !includeProject)} onClick={() => isGenerating ? props.onStop() : submit()} title={isGenerating ? "Stop generation" : "Send message"}>{isGenerating ? "■" : "↑"}</button></div></div></div><div className="composer-disclaimer">Your messages stay on this device unless you connect a model server.</div>
      </div></main>
    </div>
    {viewerFile && <FileViewer file={viewerFile} onClose={() => setViewerFile(null)} onCoding={(file) => { props.onFileCoding(file); setViewerFile(null); }} />}
    {props.paletteOpen && <CommandPalette onClose={props.onClosePalette} onCommand={runChatCommand} />}
  </div>;
}