export type Role = "system" | "user" | "assistant";

export type Feedback = "up" | "down" | null;

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
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
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
