import fs from "fs";
import path from "path";
import { DATA_DIR } from "./paths";
import type { Provider } from "@/lib/types";

/**
 * Global, server-side instance configuration ("system settings") — the master
 * config every session/user reads. Lives next to users.json in the data dir.
 */
export interface PluginFlags {
  /** Office parser (Word/Excel/CSV) in the upload pipeline. */
  officeParser: boolean;
  /** Extended OCR engine (images/PDFs) in the auto-router. */
  ocrEngine: boolean;
  /** Document generator (PDF/Excel export) from chat answers. */
  docGenerator: boolean;
}

/** Admin-global auto-router role → model-key map (default-model assignments). */
export interface RouterModels {
  /** standard chat / allrounder (also OCR-chain stage 2) */
  standard: string | null;
  coding: string | null;
  reasoning: string | null;
  /** OCR / vision model */
  vision: string | null;
  /** automatic chat-title (thread naming) */
  title: string | null;
  /** web-search query construction */
  search: string | null;
}

/** Web-search provider (API key server-only). */
export interface SearchProviderCfg {
  enabled: boolean;
  apiKey?: string;
}
export type SearchProviderName = "bing" | "tavily" | "bocha" | "qureit";
export interface SearchConfig {
  bing?: SearchProviderCfg;
  tavily?: SearchProviderCfg;
  bocha?: SearchProviderCfg;
  qureit?: SearchProviderCfg;
}
/** Order in which a usable (enabled + keyed) provider is selected. */
export const SEARCH_PROVIDER_ORDER: SearchProviderName[] = [
  "tavily",
  "bing",
  "bocha",
  "qureit",
];

/** Image-generation backend (API key server-only). */
export type ImageGenType = "openai" | "automatic1111" | "comfyui";
export interface ImageGenConfig {
  enabled: boolean;
  type: ImageGenType;
  /** endpoint base (OpenAI-compatible /v1, or the A1111/ComfyUI host) */
  baseUrl?: string;
  apiKey?: string;
  /** model id (OpenAI: gpt-image-1 / dall-e-3) */
  model?: string;
  /** image size, e.g. 1024x1024 */
  size?: string;
}

export interface ServerConfig {
  /** display name of this instance (shown in the UI) */
  appName: string;
  /** admin-global branding shown to every user */
  logoUrl?: string;
  accentColor?: string;
  /** default AI provider the first admin configured during setup */
  primaryProvider?: {
    type: "ollama" | "openai";
    baseUrl: string;
    /** never returned by the public getter */
    apiKey?: string;
  };
  /** admin-global provider registry (apiKeys server-only, never in publicConfig) */
  providers?: Provider[];
  /** admin-global auto-router category mapping */
  routerModels?: RouterModels;
  /** admin-global web-search providers (apiKeys server-only) */
  search?: SearchConfig;
  /** Ollama embedding model for the knowledge base (RAG). */
  embeddingModel?: string;
  /** admin-global image generation backend (apiKey server-only) */
  imageGen?: ImageGenConfig;
  /** admin master-switches for server-side background services */
  plugins?: PluginFlags;
  /** epoch ms when setup was completed */
  setupCompletedAt?: number;
}

export const DEFAULT_ROUTER_MODELS: RouterModels = {
  standard: null,
  coding: null,
  reasoning: null,
  vision: null,
  title: null,
  search: null,
};

export const DEFAULT_PLUGINS: PluginFlags = {
  officeParser: true,
  ocrEngine: true,
  docGenerator: true,
};

/** Plugin flags with defaults filled in. */
export function getPlugins(): PluginFlags {
  return { ...DEFAULT_PLUGINS, ...(getConfig().plugins ?? {}) };
}
export function setPlugins(patch: Partial<PluginFlags>): PluginFlags {
  const next = { ...getPlugins(), ...patch };
  setConfig({ plugins: next });
  return next;
}

const FILE = path.join(DATA_DIR, "config.json");

const DEFAULTS: ServerConfig = { appName: "OpenChatbox" };

export function getConfig(): ServerConfig {
  try {
    return { ...DEFAULTS, ...(JSON.parse(fs.readFileSync(FILE, "utf8")) as ServerConfig) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setConfig(patch: Partial<ServerConfig>): ServerConfig {
  const next = { ...getConfig(), ...patch };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  // Atomic write (tmp + rename) so a crash never leaves a truncated config.
  const tmp = `${FILE}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), "utf8");
    fs.renameSync(tmp, FILE);
  } catch (e) {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      /* ignore */
    }
    throw e;
  }
  return next;
}

/** Global auto-router model map with defaults filled in. */
export function getRouterModels(): RouterModels {
  return { ...DEFAULT_ROUTER_MODELS, ...(getConfig().routerModels ?? {}) };
}

/** Full provider registry (WITH apiKeys) — server-side only. */
export function getProviders(): Provider[] {
  return getConfig().providers ?? [];
}

/** Web-search config (WITH apiKeys) — server-side only. */
export function getSearchConfig(): SearchConfig {
  return getConfig().search ?? {};
}

/** Image-generation config if enabled + has an endpoint — server-side only. */
export function getImageGenConfig(): ImageGenConfig | null {
  const c = getConfig().imageGen;
  return c?.enabled ? c : null;
}

/** The active search provider (first enabled + keyed in order), or null. */
export function activeSearchProvider(): { name: SearchProviderName; apiKey: string } | null {
  const sc = getSearchConfig();
  for (const name of SEARCH_PROVIDER_ORDER) {
    const p = sc[name];
    if (p?.enabled && p.apiKey && p.apiKey.trim())
      return { name, apiKey: p.apiKey.trim() };
  }
  return null;
}

/** Resolve a provider (incl. secret apiKey) by its id — for /api/chat & /api/models. */
export function getProviderById(id: string): Provider | undefined {
  return getProviders().find((p) => p.id === id);
}

/** Strip the secret apiKey from a provider before sending it to a client. */
function sanitizeProvider(p: Provider): Omit<Provider, "apiKey"> {
  const { apiKey, ...rest } = p;
  void apiKey;
  return rest;
}

/** Config safe to expose to any client (no secrets). */
export function publicConfig(c: ServerConfig = getConfig()) {
  return {
    appName: c.appName,
    logoUrl: c.logoUrl,
    accentColor: c.accentColor,
    primaryProvider: c.primaryProvider
      ? { type: c.primaryProvider.type, baseUrl: c.primaryProvider.baseUrl }
      : undefined,
    providers: (c.providers ?? []).map(sanitizeProvider),
    routerModels: { ...DEFAULT_ROUTER_MODELS, ...(c.routerModels ?? {}) },
    // Web search: expose only which providers are enabled + the active one —
    // never the apiKeys.
    search: {
      enabled: !!activeSearchProvider(),
      provider: activeSearchProvider()?.name ?? null,
      providers: Object.fromEntries(
        SEARCH_PROVIDER_ORDER.map((n) => [n, !!(c.search?.[n]?.enabled)])
      ) as Record<SearchProviderName, boolean>,
    },
    // Image generation: expose only availability + type, never the key.
    imageGen: { enabled: !!c.imageGen?.enabled, type: c.imageGen?.type ?? null },
    plugins: { ...DEFAULT_PLUGINS, ...(c.plugins ?? {}) },
  };
}
