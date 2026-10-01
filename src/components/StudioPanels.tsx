import { useMemo, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from "react";
import type { ChatMessage, ChatSession, FileChangeProposal, ProjectFile, StudioSettings } from "../types/studio";
import { highlightCode } from "../utils/highlightCode";

type FileExplorerProps = {
  files: ProjectFile[];
  projectName: string;
  activePath: string;
  onSelect: (path: string) => void;
  onCreateFile: (folder?: string) => void;
  onCreateFolder: (folder?: string) => void;
  onRename: (path: string) => void;
  onDelete: (path: string) => void;
  onExport: () => void;
};

type TreeNode = { name: string; path: string; children: TreeNode[]; isFile: boolean };

function makeTree(files: ProjectFile[]) {
  const root: TreeNode = { name: "", path: "", children: [], isFile: false };
  for (const file of files) {
    let current = root;
    const parts = file.path.split("/");
    parts.forEach((part, index) => {
      let node = current.children.find((child) => child.name === part);
      if (!node) {
        node = { name: part, path: parts.slice(0, index + 1).join("/"), children: [], isFile: index === parts.length - 1 };
        current.children.push(node);
      }
      current = node;
    });
  }
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => Number(a.isFile) - Number(b.isFile) || a.name.localeCompare(b.name));
    nodes.forEach((node) => sortNodes(node.children));
  };
  sortNodes(root.children);
  return root.children;
}

function fileGlyph(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  const glyphs: Record<string, string> = { tsx: "◈", ts: "◈", jsx: "◈", js: "◈", css: "◉", html: "◇", json: "{}", md: "¶", py: "⌘", svg: "◇", png: "▧", jpg: "▧", pdf: "▤" };
  return glyphs[extension ?? ""] ?? "·";
}

export function FileExplorer({ files, projectName, activePath, onSelect, onCreateFile, onCreateFolder, onRename, onDelete, onExport }: FileExplorerProps) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string; isFile: boolean } | null>(null);
  const tree = useMemo(() => makeTree(files), [files]);
  const matchingPaths = useMemo(() => new Set(files.filter((file) => file.path.toLowerCase().includes(query.toLowerCase())).map((file) => file.path)), [files, query]);

  const toggleFolder = (path: string) => setCollapsed((current) => current.includes(path) ? current.filter((entry) => entry !== path) : [...current, path]);
  const renderNodes = (nodes: TreeNode[], depth = 0) => nodes.filter((node) => node.name !== ".keep").filter((node) => {
    if (!query) return true;
    return node.isFile ? matchingPaths.has(node.path) : [...matchingPaths].some((path) => path.startsWith(`${node.path}/`));
  }).map((node) => {
    const isOpen = !collapsed.includes(node.path) || Boolean(query);
    const file = files.find((item) => item.path === node.path);
    return <div key={node.path}>
      <button
        className={`tree-row ${activePath === node.path ? "selected" : ""}`}
        style={{ paddingLeft: `${10 + depth * 14}px` }}
        onClick={() => node.isFile ? onSelect(node.path) : toggleFolder(node.path)}
        onContextMenu={(event) => { event.preventDefault(); setContextMenu({ x: event.clientX, y: event.clientY, path: node.path, isFile: node.isFile }); }}
      >
        <span className={`tree-caret ${node.isFile ? "invisible" : isOpen ? "open" : ""}`}>›</span>
        <span className={`file-glyph ${node.isFile ? `ext-${node.name.split(".").pop()}` : "folder-glyph"}`}>{node.isFile ? fileGlyph(node.path) : isOpen ? "▾" : "▸"}</span>
        <span className="tree-name">{node.name}</span>
        {file?.status && <span className="git-dot" title={file.status === "new" ? "New file" : "Unsaved changes"}>{file.status === "new" ? "U" : "M"}</span>}
      </button>
      {!node.isFile && isOpen && <div>{renderNodes(node.children, depth + 1)}</div>}
    </div>;
  });

  const runContextAction = (action: "new-file" | "new-folder" | "rename" | "delete") => {
    if (!contextMenu) return;
    if (action === "new-file") onCreateFile(contextMenu.isFile ? contextMenu.path.split("/").slice(0, -1).join("/") : contextMenu.path);
    if (action === "new-folder") onCreateFolder(contextMenu.isFile ? contextMenu.path.split("/").slice(0, -1).join("/") : contextMenu.path);
    if (action === "rename") onRename(contextMenu.path);
    if (action === "delete") onDelete(contextMenu.path);
    setContextMenu(null);
  };

  return <aside className="explorer-panel">
    <div className="panel-heading"><span>EXPLORER</span><div className="icon-actions"><button title="New file" onClick={() => onCreateFile()}><span>＋</span></button><button title="New folder" onClick={() => onCreateFolder()}><span>▱</span></button><button title="Download project as ZIP" onClick={onExport}><span>↓</span></button><button title="Collapse folders" onClick={() => setCollapsed(files.map((file) => file.path.split("/").slice(0, -1).join("/")).filter(Boolean))}><span>⌑</span></button></div></div>
    <button className="project-heading" onClick={() => setCollapsed(collapsed.length ? [] : files.map((file) => file.path.split("/").slice(0, -1).join("/")).filter(Boolean))}><span className="chevron">⌄</span><span>{projectName.toUpperCase()}</span><span className="project-more">···</span></button>
    <div className="file-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a file" aria-label="Find a file" /><kbd>⌘ P</kbd></div>
    <div className="tree-list">{renderNodes(tree)}</div>
    {contextMenu && <><button className="context-dismiss" aria-label="Close context menu" onClick={() => setContextMenu(null)} /><div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
      <button onClick={() => runContextAction("new-file")}>＋ <span>New File</span></button>
      <button onClick={() => runContextAction("new-folder")}>▱ <span>New Folder</span></button>
      {contextMenu.isFile && <><hr /><button onClick={() => runContextAction("rename")}>↻ <span>Rename</span></button><button className="danger-action" onClick={() => runContextAction("delete")}>× <span>Delete</span></button></>}
    </div></>}
    <div className="explorer-footer"><span className="footer-git">⑂</span><span>main</span><span className="sync-state">↻</span><span className="file-count">{files.filter((file) => !file.path.endsWith("/.keep")).length} files</span></div>
  </aside>;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

type EditorProps = {
  files: ProjectFile[];
  activePath: string;
  openPaths: string[];
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onChange: (path: string, content: string) => void;
  onSave: () => void;
  fontSize: number;
};

export function CodeEditorPanel({ files, activePath, openPaths, onSelect, onClose, onChange, onSave, fontSize }: EditorProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [replace, setReplace] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeFile = files.find((file) => file.path === activePath);
  const lines = (activeFile?.content ?? "").split("\n");
  const change = (event: ChangeEvent<HTMLTextAreaElement>) => onChange(activePath, event.target.value);
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Tab") {
      event.preventDefault();
      const input = event.currentTarget;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      onChange(activePath, `${input.value.slice(0, start)}  ${input.value.slice(end)}`);
      requestAnimationFrame(() => { input.selectionStart = input.selectionEnd = start + 2; });
    }
    if (event.key === "Enter") {
      const before = event.currentTarget.value.slice(0, event.currentTarget.selectionStart).split("\n").pop() ?? "";
      const indent = before.match(/^\s*/)?.[0] ?? "";
      if (indent) {
        event.preventDefault();
        const input = event.currentTarget;
        const start = input.selectionStart;
        onChange(activePath, `${input.value.slice(0, start)}\n${indent}${input.value.slice(input.selectionEnd)}`);
        requestAnimationFrame(() => { input.selectionStart = input.selectionEnd = start + indent.length + 1; });
      }
    }
  };

  return <section className="editor-panel">
    <div className="editor-tabs">{openPaths.map((path) => {
      const file = files.find((item) => item.path === path);
      return <div key={path} className={`editor-tab ${path === activePath ? "active" : ""}`}><button onClick={() => onSelect(path)}><span className={`file-glyph ext-${path.split(".").pop()}`}>{fileGlyph(path)}</span><span>{path.split("/").pop()}</span>{file?.status && <i className="tab-dirty" />}</button><button className="tab-close" title="Close tab" onClick={() => onClose(path)}>×</button></div>;
    })}<div className="tabs-spacer" /><div className="editor-actions"><button title="Find and replace" onClick={() => setSearchOpen((value) => !value)}>⌕</button><button title="Copy file" onClick={() => void navigator.clipboard?.writeText(activeFile?.content ?? "")}>▢</button><button title="Format document" onClick={() => {
      if (activeFile?.path.endsWith(".json")) {
        try { onChange(activePath, JSON.stringify(JSON.parse(activeFile.content), null, 2)); } catch { return; }
      }
    }}>⟲</button><button className="save-button" title="Save (⌘S)" onClick={onSave}>Save</button></div></div>
    {searchOpen && <div className="find-bar"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find" autoFocus /><button onClick={() => setShowReplace((value) => !value)}>⇅</button><span>{search ? (activeFile?.content.match(new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))?.length ?? 0) : 0} results</span><button onClick={() => setSearchOpen(false)}>×</button>{showReplace && <><input value={replace} onChange={(event) => setReplace(event.target.value)} placeholder="Replace" /><button onClick={() => { if (activeFile && search) onChange(activePath, activeFile.content.replaceAll(search, replace)); }}>Replace all</button></>}</div>}
    {activeFile ? <>
      <div className="breadcrumb"><span>⌂</span>{activePath.split("/").map((part, index) => <span key={`${part}-${index}`}>{index > 0 && <b>›</b>}{part}</span>)}<span className="breadcrumb-status">{activeFile.status ? "● Modified" : "✓ Saved"}</span></div>
      {activeFile.encoding === "base64" && activeFile.path.toLowerCase().endsWith(".pdf") ? <div className="pdf-editor-preview"><iframe title={activePath} src={`data:application/pdf;base64,${activeFile.content}`} /></div> : <><div className="code-editor" style={{ fontSize }}>
        <div className="line-numbers" aria-hidden="true">{lines.map((_, index) => <span key={index}>{index + 1}</span>)}</div>
        <div className="code-input-wrap"><pre className="code-highlight" aria-hidden="true" dangerouslySetInnerHTML={{ __html: `${highlightCode(activeFile.content)}\n` }} /><textarea ref={textareaRef} value={activeFile.content} onChange={change} onKeyDown={handleKeyDown} spellCheck={false} aria-label={`Edit ${activePath}`} /></div>
      </div><div className="editor-status"><span>{activePath.split(".").pop()?.toUpperCase()}</span><span>UTF-8</span><span>LF</span><span>Spaces: 2</span><span className="status-spacer" /><span>Ln {lines.length}, Col 1</span><span>⌘ S to save</span></div></>}
    </> : <div className="empty-editor"><span>◈</span><p>Select a file to start editing</p></div>}
  </section>;
}

type PreviewProps = { files: ProjectFile[]; refreshKey: number; onRefresh: () => void };

export function PreviewPanel({ files, refreshKey, onRefresh }: PreviewProps) {
  const [device, setDevice] = useState("desktop");
  const [showConsole, setShowConsole] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sourceHtml = files.find((file) => file.path === "index.html")?.content ?? "<main style='font:16px system-ui;padding:36px;color:#222'><h1>No HTML preview</h1><p>Create an index.html file to see it here.</p></main>";
  const styles = files.filter((file) => file.path.endsWith(".css")).map((file) => `<style>/* ${file.path} */\n${file.content.replaceAll("</style", "<\\/style")}</style>`).join("\n");
  const html = sourceHtml.includes("</head>") ? sourceHtml.replace("</head>", `${styles}</head>`) : `${styles}${sourceHtml}`;
  const fullScreen = () => void iframeRef.current?.requestFullscreen?.();
  return <section className="preview-panel">
    <div className="preview-toolbar"><span className="preview-label"><span className="live-dot" /> PREVIEW</span><div className="preview-address"><span>⌂</span><span>localhost</span><b>:</b><span>5173</span><span>/</span></div><div className="device-switcher" role="group" aria-label="Preview size">{[["desktop", "▱"], ["tablet", "▯"], ["mobile", "▯"]].map(([name, icon]) => <button key={name} className={device === name ? "active" : ""} title={`${name} preview`} onClick={() => setDevice(name)}>{icon}</button>)}</div><button className="preview-icon" title="Toggle console" onClick={() => setShowConsole((value) => !value)}>⌁</button><button className="preview-icon" title="Refresh preview" onClick={onRefresh}>⟳</button><button className="preview-icon" title="Fullscreen" onClick={fullScreen}>⛶</button></div>
    <div className={`preview-stage ${device}`}><iframe ref={iframeRef} key={refreshKey} title="Live project preview" sandbox="allow-scripts" srcDoc={html} /></div>
    {showConsole && <div className="preview-console"><div><span>CONSOLE</span><button onClick={() => setShowConsole(false)}>×</button></div><p><span>i</span> Console output will appear here when preview instrumentation is connected.</p></div>}
    <div className="preview-status"><span><i /> Preview ready</span><span>index.html</span><span>Reload on save</span></div>
  </section>;
}

function messageHtml(text: string) {
  const pieces = text.split(/```([\w-]*)\n([\s\S]*?)```/g);
  return pieces.map((piece, index) => {
    if (index % 3 === 2) return <pre className="message-code" key={index}><code>{piece}</code></pre>;
    if (index % 3 === 1) return null;
    return <p key={index} dangerouslySetInnerHTML={{ __html: escapeHtml(piece).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br />") }} />;
  });
}

type ChatProps = {
  messages: ChatMessage[];
  isGenerating: boolean;
  onSend: (content: string, attachments: string[]) => void;
  onStop: () => void;
  onNewChat: () => void;
  onClear: () => void;
  onRegenerate: () => void;
  history: ChatSession[];
  onSelectHistory: (session: ChatSession) => void;
  proposal?: FileChangeProposal | null;
  onAcceptProposal?: () => void;
  onRejectProposal?: () => void;
  onSaveAsFile: (message: ChatMessage) => void;
};

export function ChatPanel({ messages, isGenerating, onSend, onStop, onNewChat, onClear, onRegenerate, history, onSelectHistory, proposal, onAcceptProposal, onRejectProposal, onSaveAsFile }: ChatProps) {
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [proposalExpanded, setProposalExpanded] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setAttachments((current) => [...current, ...Array.from(list).map((file) => file.name)]);
  };
  const submit = () => {
    if ((!draft.trim() && !attachments.length) || isGenerating) return;
    onSend(draft.trim(), attachments);
    setDraft("");
    setAttachments([]);
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
  };
  const handleKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); submit(); }
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); };

  return <section className={`chat-panel ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
    <div className="chat-heading"><div className="chat-title-group"><span className="assistant-mark">✳</span><div><strong>Studio assistant</strong><small>Local workspace · Ready</small></div><span className="chat-online" /></div><div className="chat-heading-actions"><button title="Chat history" onClick={() => setHistoryOpen((value) => !value)}>◷</button><button title="New chat" onClick={onNewChat}>＋</button><button title="Clear chat" onClick={onClear}>⌫</button></div></div>
    {historyOpen && <div className="history-popover"><strong>Recent conversations</strong>{history.length ? history.map((session) => <button key={session.id} onClick={() => { onSelectHistory(session); setHistoryOpen(false); }}>{session.title}<span>{new Date(session.updatedAt).toLocaleDateString()}</span></button>) : <p>No saved conversations yet.</p>}<p>Chats are saved on this device.</p></div>}
    <div className="chat-messages">
      {messages.length === 0 ? <div className="chat-welcome"><span className="welcome-spark">✳</span><h2>What are we building?</h2><p>Ask about your code, get a second pair of eyes, or sketch out what comes next.</p><div className="prompt-suggestions"><button onClick={() => setDraft("Explain the structure of this project")}>⌕ <span>Explain this project</span></button><button onClick={() => setDraft("Suggest a visual improvement for the current page")}>✦ <span>Suggest an improvement</span></button></div></div> : messages.map((message, index) => <article key={message.id} className={`chat-message ${message.role}`}>
        <span className="message-avatar">{message.role === "assistant" ? "✳" : "Y"}</span><div className="message-content"><div className="message-meta"><strong>{message.role === "assistant" ? "Studio assistant" : "You"}</strong><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>{message.role === "assistant" && index === messages.length - 1 && <button onClick={onRegenerate} title="Regenerate response">↻</button>}</div>{message.attachments?.map((attachment) => <span className="attachment-chip" key={attachment}>▤ {attachment}</span>)}{messageHtml(message.content)}{message.role === "assistant" && <div className="message-tools"><button title="Save response as project file" onClick={() => onSaveAsFile(message)}>＋ Save as file</button></div>}</div>
      </article>)}
      {proposal && <article className="file-proposal"><header><span>◇</span><div><strong>AI proposed a file change</strong><small>{proposal.path}</small></div><span className="proposal-count">1 file</span></header><div className="proposal-actions"><button onClick={() => setProposalExpanded((value) => !value)}>{proposalExpanded ? "Hide changes" : "View changes"}</button><span /><button className="reject-proposal" onClick={onRejectProposal}>Reject</button><button className="accept-proposal" onClick={onAcceptProposal}>Accept</button></div>{proposalExpanded && <div className="proposal-diff"><section><h3>Current</h3><pre>{proposal.before || "(new file)"}</pre></section><section><h3>Proposed</h3><pre>{proposal.after}</pre></section></div>}</article>}
      {isGenerating && <div className="thinking-indicator"><span className="thinking-dots"><i /><i /><i /></span><span>Thinking</span><button onClick={onStop}>Stop</button></div>}
      <div ref={endRef} />
    </div>
    <div className="composer-wrap">
      {attachments.length > 0 && <div className="attachment-list">{attachments.map((name, index) => <span className="attachment-chip" key={`${name}-${index}`}>▤ {name}<button onClick={() => setAttachments((current) => current.filter((_, item) => item !== index))}>×</button></span>)}</div>}
      <div className="composer"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKey} placeholder="Ask anything about your project..." rows={2} /><div className="composer-actions"><div><button title="Attach files" onClick={() => fileInput.current?.click()}>＋</button><input ref={fileInput} type="file" multiple hidden onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} /><span className="composer-model">◉ General AI model</span></div><button className="send-button" disabled={isGenerating || (!draft.trim() && !attachments.length)} onClick={submit}>{isGenerating ? "···" : "↑"}</button></div></div>
      <div className="composer-footnote"><span>Local AI can make mistakes</span><span>⌘ ↵ to send</span></div>
    </div>
  </section>;
}

type TerminalProps = { onClose: () => void; files: ProjectFile[] };

export function TerminalPanel({ onClose, files }: TerminalProps) {
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState<string[]>(["Local AI Studio terminal · simulated shell", "Type `help` to see available commands."]);
  const [tab, setTab] = useState("zsh");
  const run = () => {
    const value = command.trim();
    if (!value) return;
    let result = "Command is not available in the simulated terminal.";
    if (value === "help") result = "Available: help, ls, pwd, clear, echo <text>, npm run dev";
    else if (value === "ls") result = files.map((file) => file.path).join("   ");
    else if (value === "pwd") result = "/workspace/studio-notes";
    else if (value === "clear") { setOutput([]); setCommand(""); return; }
    else if (value.startsWith("echo ")) result = value.slice(5);
    else if (value === "npm run dev") result = "Preview server is available at http://localhost:5173";
    setOutput((current) => [...current, `$ ${value}`, result]);
    setCommand("");
  };
  return <section className="terminal-panel"><div className="terminal-heading"><div><span className="terminal-label">TERMINAL</span><button className={tab === "zsh" ? "active" : ""} onClick={() => setTab("zsh")}>zsh</button><button className={tab === "output" ? "active" : ""} onClick={() => setTab("output")}>Output</button><button onClick={() => { setOutput([]); }}>Clear</button><button title="Copy terminal output" onClick={() => void navigator.clipboard?.writeText(output.join("\n"))}>Copy</button></div><button title="Close terminal" onClick={onClose}>×</button></div><div className="terminal-output">{output.map((line, index) => <div className={line.startsWith("$") ? "terminal-command" : ""} key={`${index}-${line}`}>{line}</div>)}<label><span>$</span><input value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") run(); }} placeholder="Enter a command..." /></label></div><div className="terminal-note">Shell connection is not configured. Commands run in a local simulation.</div></section>;
}

type SettingsProps = { settings: StudioSettings; onChange: (settings: StudioSettings) => void; onClose: () => void; onTest: () => void; connectionStatus: string; models?: string[] };

export function SettingsModal({ settings, onChange, onClose, onTest, connectionStatus, models = [] }: SettingsProps) {
  const [section, setSection] = useState("General");
  const sections = ["General", "AI", "Connection", "Appearance"];
  const update = (key: keyof StudioSettings, value: string | number | boolean) => onChange({ ...settings, [key]: value });
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="settings-modal"><header><div><span className="settings-icon">⚙</span><div><h2>Settings</h2><p>Configure your local workspace</p></div></div><button onClick={onClose}>×</button></header><div className="settings-body"><nav>{sections.map((item) => <button key={item} className={section === item ? "active" : ""} onClick={() => setSection(item)}>{item}</button>)}</nav><div className="settings-form">
    {section === "General" && <><h3>General</h3><p className="settings-description">Personalize chat and workspace defaults.</p><label>Interface theme<select value={settings.theme} onChange={(event) => update("theme", event.target.value as StudioSettings["theme"])}><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select></label><label>Language<select value={settings.language} onChange={(event) => update("language", event.target.value as StudioSettings["language"])}><option>English</option><option>Deutsch</option></select></label><label>Editor font size<div className="setting-inline"><input type="range" min="11" max="20" value={settings.fontSize} onChange={(event) => update("fontSize", Number(event.target.value))} /><span>{settings.fontSize}px</span></div></label><label className="setting-toggle"><span><strong>Compact chat</strong><small>Fit more messages into the conversation</small></span><input type="checkbox" checked={settings.compactChat} onChange={(event) => update("compactChat", event.target.checked)} /></label></>}
    {section === "AI" && <><h3>AI preferences</h3><p className="settings-description">Configure your general-purpose assistant.</p><label>AI model{models.length ? <select value={settings.model} onChange={(event) => update("model", event.target.value)}>{models.map((model) => <option key={model}>{model}</option>)}</select> : <input value={settings.model} onChange={(event) => update("model", event.target.value)} />}</label><label>Temperature<div className="setting-inline"><input type="range" min="0" max="2" step="0.1" value={settings.temperature} onChange={(event) => update("temperature", Number(event.target.value))} /><span>{settings.temperature.toFixed(1)}</span></div></label><label>Max tokens<div className="setting-inline"><input type="range" min="256" max="8192" step="256" value={settings.maxTokens} onChange={(event) => update("maxTokens", Number(event.target.value))} /><span>{settings.maxTokens}</span></div></label><label>Context length<select value={settings.contextLength} onChange={(event) => update("contextLength", Number(event.target.value))}><option value={4096}>4,096 tokens</option><option value={8192}>8,192 tokens</option><option value={16384}>16,384 tokens</option><option value={32768}>32,768 tokens</option></select></label><label className="setting-toggle"><span><strong>Streaming responses</strong><small>Show output as it is generated</small></span><input type="checkbox" checked={settings.streaming} onChange={(event) => update("streaming", event.target.checked)} /></label><label>System prompt<textarea rows={4} value={settings.systemPrompt} onChange={(event) => update("systemPrompt", event.target.value)} /></label></>}
    {section === "Connection" && <><h3>LM Studio connection</h3><p className="settings-description">Connect LM Studio to use a general-purpose local AI model.</p><label>Base URL<input value={settings.baseUrl} onChange={(event) => update("baseUrl", event.target.value)} /></label><label className="setting-toggle"><span><strong>Use LM Studio</strong><small>Send chat requests to your local model</small></span><input type="checkbox" checked={settings.useLmStudio} onChange={(event) => update("useLmStudio", event.target.checked)} /></label><div className="connection-test"><span className={connectionStatus === "Connected" ? "connected" : ""}>● {connectionStatus}</span><button onClick={onTest}>Test connection</button></div></>}
    {section === "Appearance" && <><h3>Appearance</h3><p className="settings-description">Tune the workspace to your setup.</p><label>Sidebar width<div className="setting-inline"><input type="range" min="190" max="320" defaultValue="232" /><span>232px</span></div></label><label>Animations<div className="setting-inline"><span>Use subtle motion effects</span><input type="checkbox" checked={settings.animations} onChange={(event) => update("animations", event.target.checked)} /></div></label></>}
    </div></div><footer><span>Changes save automatically</span><button onClick={onClose}>Done</button></footer></section></div>;
}

type PaletteProps = { onClose: () => void; onCommand: (command: string) => void };

export function CommandPalette({ onClose, onCommand }: PaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const commands = [
    ["New Chat", "new-chat", "⌘ N"], ["Search Chats", "search-chats", "⌘ P"], ["Open Coding Mode", "coding-mode", ""], ["Select Model", "select-model", ""], ["Upload File", "upload-file", ""], ["Open Project", "project", ""], ["Toggle Sidebar", "toggle-sidebar", "⌘ B"], ["New File", "new-file", ""], ["New Folder", "new-folder", ""], ["Open File", "open-file", ""], ["Search Files", "search-files", ""], ["Toggle Terminal", "terminal", "⌘ J"], ["Toggle Preview", "preview", ""], ["Clear Chat", "clear-chat", ""], ["Connect to AI", "connect-ai", ""], ["Settings", "settings", "⌘ ,"],
  ];
  const filtered = commands.filter(([label]) => label.toLowerCase().includes(query.toLowerCase()));
  const run = (command: string) => { onCommand(command); onClose(); };
  return <div className="palette-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="command-palette"><div className="palette-search"><span>⌕</span><input ref={inputRef} autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type a command or search..." onKeyDown={(event) => { if (event.key === "Escape") onClose(); if (event.key === "Enter" && filtered[0]) run(filtered[0][1]); if (event.key === "ArrowDown") { event.preventDefault(); document.querySelector<HTMLButtonElement>(".palette-results button")?.focus(); } }} /><kbd>ESC</kbd></div><div className="palette-caption">COMMANDS</div><div className="palette-results">{filtered.map(([label, command, shortcut]) => <button key={command} onClick={() => run(command)}><span className="command-icon">⌘</span><span>{label}</span><kbd>{shortcut}</kbd></button>)}{filtered.length === 0 && <p>No matching commands</p>}</div><div className="palette-footer"><span>↑↓ Navigate</span><span>↵ Run command</span><span>esc Close</span></div></div></div>;
}

export function ModelStatus({ model, status, onClick }: { model: string; status: string; onClick: () => void }) {
  return <button className="model-status" onClick={onClick}><span className={`model-led ${status === "Connected" ? "connected" : ""}`} /><span>{status === "Connected" ? model : "AI model"}</span><span className="status-chevron">⌄</span></button>;
}