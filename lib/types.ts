export type Role = "system" | "user" | "assistant";

export type Feedback = "up" | "down" | null;

/** Live Auto-mode pipeline stage shown as a status badge while streaming. */
export type PipelineStage =
  | "ocr"
  | "answer"
  | "coding"
  | "reasoning"
  | "text"
  | "vision"
  | "imagegen";

export interface Message {
  id: string;
  role: Role;
  /** currently visible text. For assistant with variants = variants[activeVariant]. */
  content: string;
  createdAt: number;
  /** user only: attached images as data URLs (for vision models). */
  images?: string[];
  /** assistant only: reasoning / thinking output (reasoning models). */
  reasoning?: string;
  /** assistant only: all generated answer variants (regenerate appends). */
  variants?: string[];
  /** assistant only: index into variants of the shown answer. */
  activeVariant?: number;
  /** assistant only: thumbs up/down for internal logging. */
  feedback?: Feedback;
  /** assistant only: auto-generated downloadable files (PDF/Excel export). */
  docs?: GeneratedDoc[];
  /** assistant only, transient: current Auto-pipeline stage (live badge).
   *  Cleared when streaming finishes; stripped on persist. */
  pipeline?: PipelineStage;
}

/** A backend-generated, downloadable file attached under an assistant answer. */
export interface GeneratedDoc {
  id: string;
  name: string;
  mime: string;
  /** base64 data URL; stripped on persist (regenerated on demand). */
  dataUrl?: string;
  size: number;
}

/** A collaboration space that owns chats, sidekicks and shared files. */
export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  /** owning workspace; undefined = the default personal workspace. */
  workspaceId?: string;
  /** model id used for this chat, e.g. "ollama::llama3.1" */
  modelKey?: string;
  /** temporary (Inkognito) chat: never persisted, not shown in history. */
  temporary?: boolean;
  /** pinned to the top of the sidebar. */
  pinned?: boolean;
  /** id of the Sidekick profile this chat runs under (optional). */
  sidekickId?: string;
  /** unsent input text, restored when returning to this chat. */
  draft?: string;
  /** archive of files uploaded to / generated in this chat. */
  files?: ChatFile[];
  createdAt: number;
  updatedAt: number;
}

/** A file tracked in a chat's archive (upload or AI-generated). */
export interface ChatFile {
  id: string;
  /** id of the message this file belongs to (for jumpback). */
  messageId: string;
  name: string;
  kind: "image" | "text" | "code" | "pdf" | "other";
  source: "upload" | "generated";
  /** images: data URL. */
  dataUrl?: string;
  /** text/code: raw content. */
  content?: string;
  language?: string;
  createdAt: number;
}

/** Reusable prompt template (company prompt library). */
export interface PromptTemplate {
  id: string;
  title: string;
  /** shorthand for the "/" quick-picker */
  shortcut?: string;
  content: string;
}

/** A specialized assistant profile (like Gemini Gems). */
export interface Sidekick {
  id: string;
  name: string;
  /** owning workspace; undefined = the default personal workspace. */
  workspaceId?: string;
  /** vector icon id (see SIDEKICK_ICONS) */
  icon: string;
  /** pastel color id (see SIDEKICK_COLORS) */
  color: string;
  /** assigned base model key (providerId::model); empty = use current selection */
  modelKey: string;
  systemPrompt: string;
}

/** A durable fact about the user (user memory). */
export interface MemoryFact {
  id: string;
  text: string;
  createdAt: number;
}

/** Logged-in user as returned by /api/auth/session (transient, not persisted). */
export interface AuthUser {
  id: string;
  username: string;
  role: string;
  provider: string;
  twoFactorEnabled: boolean;
}

/** Generation parameters passed through to the provider. */
export interface GenParams {
  temperature: number;
  topP: number;
  maxTokens: number;
}

/**
 * Engine that talks to the provider.
 * - `openai`   : OpenAI Chat Completions wire format (covers OpenAI, Gemini via
 *                its openai-compat endpoint, Mistral, Groq, OpenRouter, Together,
 *                DeepSeek, xAI, Fireworks, Perplexity, HF router, vLLM, TGI…).
 * - `anthropic`: Claude Messages API (x-api-key, /messages, SSE deltas).
 * - `ollama`   : local Ollama (/api/tags, /api/chat NDJSON).
 */
export type ProviderType = "ollama" | "openai" | "anthropic";

export interface Provider {
  id: string;
  /** display name shown in settings + model switcher group */
  name: string;
  type: ProviderType;
  /** e.g. http://localhost:11434 (ollama) or https://api.openai.com/v1 (openai-compatible) */
  baseUrl: string;
  apiKey?: string;
  enabled: boolean;
  /** manually entered model ids, merged with (or used instead of) the /models list */
  manualModels?: string[];
}

export interface ModelOption {
  /** unique key: `${providerId}::${model}` */
  key: string;
  providerId: string;
  providerName: string;
  providerType: ProviderType;
  model: string;
}

/** Payload sent to /api/chat and /api/models */
export interface ProviderRequest {
  type: ProviderType;
  baseUrl: string;
  apiKey?: string;
  /** When set, the server resolves the provider (incl. secret apiKey) from its
   *  global registry by id — the client never holds the key. */
  providerId?: string;
}

/** Admin-global config exposed to any client (no secrets). */
export interface GlobalConfigPayload {
  appName?: string;
  logoUrl?: string;
  accentColor?: string;
  providers?: Provider[];
  routerModels?: {
    standard: string | null;
    coding: string | null;
    reasoning: string | null;
    vision: string | null;
    title: string | null;
    search: string | null;
  };
  plugins?: { officeParser: boolean; ocrEngine: boolean; docGenerator: boolean };
}

/** Per-user preferences persisted server-side (mirror of lib/server/profiles). */
export interface ServerUserProfile {
  theme?: string;
  lang?: "de" | "en" | null;
  params?: GenParams;
  customInstructions?: string;
  favorites?: string[];
  aliases?: Record<string, string>;
  codeSplitEnabled?: boolean;
  codeSplitThreshold?: number;
  codeSplitWidth?: number;
  memory?: MemoryFact[];
  memoryEnabled?: boolean;
  webSearchEnabled?: boolean;
  selectedModelKey?: string | null;
  autoRouter?: boolean;
  vramManaged?: boolean;
  ollamaKeepAlive?: string;
  sidekicks?: Sidekick[];
  prompts?: PromptTemplate[];
}

export interface ChatMessagePayload {
  role: Role;
  content: string;
  /** data URLs for images (vision). Server reformats per provider. */
  images?: string[];
}

export interface ChatRequest extends ProviderRequest {
  model: string;
  messages: ChatMessagePayload[];
  params?: GenParams;
  /** Ollama keep_alive (VRAM-Freigabe), z.B. "2m". */
  keepAlive?: string;
}
