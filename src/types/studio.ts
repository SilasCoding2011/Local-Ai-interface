export type ProjectFile = {
  path: string;
  content: string;
  status?: "modified" | "new";
  encoding?: "base64";
};

export type StudioProject = {
  id: string;
  name: string;
  files: ProjectFile[];
  lastModified: number;
  starter?: boolean;
};

export type FileChangeProposal = {
  id: string;
  path: string;
  before: string;
  after: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  attachments?: string[];
  files?: ChatAttachment[];
};

export type ChatAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  content?: string;
  previewUrl?: string;
};

export type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
};

export type StudioSettings = {
  model: string;
  baseUrl: string;
  temperature: number;
  contextLength: number;
  systemPrompt: string;
  useLmStudio: boolean;
  fontSize: number;
  animations: boolean;
  maxTokens: number;
  streaming: boolean;
  compactChat: boolean;
  theme: "dark" | "light" | "system";
  language: "English" | "Deutsch";
};