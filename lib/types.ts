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
  /** unsent input text, restored when returning to this chat. */
  draft?: string;
  createdAt: number;
  updatedAt: number;
}

/** Reusable prompt template (company prompt library). */
export interface PromptTemplate {
  id: string;
  title: string;
  /** shorthand for the "/" quick-picker */
  shortcut?: string;
  content: string;
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
}
