import fs from "fs";
import path from "path";
import { DATA_DIR } from "./paths";
import { decryptSecret } from "./crypto";
import { oidcConfig, type OidcConfig } from "./oidc";
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
  /** optional endpoint override (correct/self-host Bocha/Qureit etc.) */
  baseUrl?: string;
}
export type SearchProviderName = "bing" | "tavily" | "bocha" | "qureit";
export interface SearchConfig {
  bing?: SearchProviderCfg;
  tavily?: SearchProviderCfg;
  bocha?: SearchProviderCfg;
  qureit?: SearchProviderCfg;
}
/** Order in which a usable (enabled + keyed) provider is selected. */
const SEARCH_PROVIDER_ORDER: SearchProviderName[] = [
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

/** BookStack wiki integration (token secret encrypted at rest). */
export interface BookstackConfig {
  enabled: boolean;
  /** allow destructive tools (create/update/delete); false = read-only. */
  writeEnabled: boolean;
  baseUrl?: string;
  tokenId?: string;
  /** encrypted (enc:v1:…) — never returned to any client. */
  tokenSecret?: string;
  /** ignore TLS cert errors (self-signed / .local homelab instances). */
  allowInsecure?: boolean;
}
/** Fully resolved (decrypted) BookStack config — server-side only. */
export interface BookstackResolved {
  baseUrl: string;
  tokenId: string;
  tokenSecret: string;
  writeEnabled: boolean;
  allowInsecure: boolean;
}

/** SMTP mail server for outbound email (password-reset links). Password
 *  encrypted at rest; never returned to any client. */
export interface SmtpConfig {
  enabled: boolean;
  host?: string;
  port?: number;
  /** implicit TLS (true = port 465; false = STARTTLS on 587/25). */
  secure?: boolean;
  user?: string;
  /** encrypted (enc:v1:…) — never returned to any client. */
  passwordSecret?: string;
  /** From: header, e.g. "OpenChatbox <noreply@firma.de>". */
  from?: string;
}
/** Fully resolved (decrypted) SMTP config — server-side only. */
export interface SmtpResolved {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

/**
 * Admin-configurable SSO (OIDC) — an alternative to the ENTRA_ / AUTH_ env vars.
 * `provider` picks the flavor: "entra" derives Microsoft v2.0 endpoints from the
 * tenant; "ad"/generic OIDC needs explicit authorize/token URLs (e.g. ADFS or
 * Keycloak). The client secret is encrypted at rest; never returned to a client.
 */
export interface OidcStoredConfig {
  enabled: boolean;
  provider: "entra" | "ad";
  clientId?: string;
  /** encrypted (enc:v1:…) — never returned to any client. */
  clientSecretEnc?: string;
  /** Entra tenant id (also restricts sign-in to that org via the tid claim). */
  tenantId?: string;
  /** explicit endpoints (required for "ad"/generic OIDC; optional for entra). */
  authorizeUrl?: string;
  tokenUrl?: string;
}

/** Self-registration policy. When disabled, only admins create accounts. */
export interface SelfRegistrationConfig {
  enabled: boolean;
  /** optional allow-list of email domains ("firma.de"); empty = any domain. */
  domains?: string[];
}

/** Guest access: unauthenticated visitors chat with a single, admin-pinned model. */
export interface GuestConfig {
  enabled: boolean;
  /** the only model key (providerId::model) guests may use. */
  model?: string | null;
}

/**
 * Which sign-in methods this instance offers. Lets an org enforce, say,
 * SSO-only by turning `password` off — the login form then hides the
 * username/password fields. Independent of self-registration (that governs
 * whether a NEW password account may be created; `password` governs whether an
 * EXISTING one may sign in). The built-in admin can always sign in with a
 * password regardless — the guaranteed recovery path, enforced server-side.
 */
export interface AuthMethodsConfig {
  /** local username/password sign-in (register + login). */
  password: { enabled: boolean };
  /** Entra ID / OIDC SSO — only effective when the OIDC env is configured too. */
  sso: { enabled: boolean };
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
  /** BookStack wiki integration (token secret encrypted, server-only) */
  bookstack?: BookstackConfig;
  /** SMTP mail server for password-reset emails (password encrypted, server-only) */
  smtp?: SmtpConfig;
  /** admin-configured SSO/OIDC (client secret encrypted, server-only) */
  oidc?: OidcStoredConfig;
  /** self-registration policy (Login-Seite „Registrieren“) */
  selfRegistration?: SelfRegistrationConfig;
  /** guest access policy (chat without an account) */
  guest?: GuestConfig;
  /** which sign-in methods are offered (password / SSO) */
  authMethods?: AuthMethodsConfig;
  /** Company/person proper-noun dictionary for fuzzy search correction. Each
   *  entry is a canonical name (single- or multi-word) that mistyped queries are
   *  corrected TO (Levenshtein) before the search runs. */
  properNouns?: string[];
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

/** Full provider registry (WITH apiKeys) — server-side only. */
export function getProviders(): Provider[] {
  return getConfig().providers ?? [];
}

/** Self-registration policy with defaults + normalized domains (no leading @). */
export function getSelfRegistration(): { enabled: boolean; domains: string[] } {
  const c = getConfig().selfRegistration;
  return {
    enabled: !!c?.enabled,
    domains: (c?.domains ?? [])
      .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
      .filter(Boolean),
  };
}

/** Guest access policy. */
export function getGuestConfig(): { enabled: boolean; model: string | null } {
  const c = getConfig().guest;
  return { enabled: !!c?.enabled, model: c?.model?.trim() || null };
}

/** Sign-in methods with defaults (both on) so upgrades keep working as before. */
export const DEFAULT_AUTH_METHODS: AuthMethodsConfig = {
  password: { enabled: true },
  sso: { enabled: true },
};
export function getAuthMethods(): AuthMethodsConfig {
  const c = getConfig().authMethods;
  return {
    password: { enabled: c?.password?.enabled ?? true },
    sso: { enabled: c?.sso?.enabled ?? true },
  };
}

/** Admin-configured proper-noun dictionary (trimmed, non-empty entries). */
export function getProperNouns(): string[] {
  const arr = getConfig().properNouns;
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((n): n is string => typeof n === "string")
    .map((n) => n.trim())
    .filter(Boolean);
}

/** Web-search config (WITH apiKeys) — server-side only. */
function getSearchConfig(): SearchConfig {
  return getConfig().search ?? {};
}

/** Image-generation config if enabled + has an endpoint — server-side only. */
export function getImageGenConfig(): ImageGenConfig | null {
  const c = getConfig().imageGen;
  return c?.enabled ? c : null;
}

/** The active search provider (first enabled + keyed in order), or null. */
export function activeSearchProvider(): {
  name: SearchProviderName;
  apiKey: string;
  baseUrl?: string;
} | null {
  const sc = getSearchConfig();
  for (const name of SEARCH_PROVIDER_ORDER) {
    const p = sc[name];
    if (p?.enabled && p.apiKey && p.apiKey.trim())
      return { name, apiKey: p.apiKey.trim(), baseUrl: p.baseUrl?.trim() || undefined };
  }
  return null;
}

/** Resolve a provider (incl. secret apiKey) by its id — for /api/chat & /api/models. */
export function getProviderById(id: string): Provider | undefined {
  return getProviders().find((p) => p.id === id);
}

/**
 * Resolved BookStack config (decrypted token) if the integration is enabled and
 * fully configured; otherwise null. Server-side only — never expose the token.
 */
export function getBookstackConfig(): BookstackResolved | null {
  const b = getConfig().bookstack;
  if (!b?.enabled) return null;
  const baseUrl = (b.baseUrl ?? "").replace(/\/+$/, "");
  const tokenId = (b.tokenId ?? "").trim();
  const tokenSecret = decryptSecret(b.tokenSecret).trim();
  if (!baseUrl || !tokenId || !tokenSecret) return null;
  return {
    baseUrl,
    tokenId,
    tokenSecret,
    writeEnabled: !!b.writeEnabled,
    allowInsecure: !!b.allowInsecure,
  };
}

/**
 * Resolved SMTP config (decrypted password) if enabled and fully configured;
 * otherwise null. Server-side only — never expose the password.
 */
export function getSmtpConfig(): SmtpResolved | null {
  const s = getConfig().smtp;
  if (!s?.enabled) return null;
  const host = (s.host ?? "").trim();
  const port = Number(s.port) || 0;
  const user = (s.user ?? "").trim();
  const password = decryptSecret(s.passwordSecret).trim();
  const from = (s.from ?? "").trim() || user;
  if (!host || !port || !from) return null;
  return { host, port, secure: !!s.secure, user, password, from };
}

/** Whether password-reset email is available (SMTP fully configured). */
export function isPasswordResetEnabled(): boolean {
  return !!getSmtpConfig();
}

/**
 * The effective OIDC config: admin-stored settings take precedence; otherwise
 * fall back to the environment-based config (legacy / infra-managed). Returns
 * null when neither is usable. Server-side only (carries the client secret).
 */
export function resolveOidc(): OidcConfig | null {
  const o = getConfig().oidc;
  if (o?.enabled) {
    const clientId = (o.clientId ?? "").trim();
    const clientSecret = decryptSecret(o.clientSecretEnc).trim();
    const tenant = (o.tenantId ?? "").trim();
    // Entra derives Microsoft v2.0 endpoints from the tenant when not given.
    const authorizeUrl =
      (o.authorizeUrl ?? "").trim() ||
      (o.provider === "entra" && tenant
        ? `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`
        : "");
    const tokenUrl =
      (o.tokenUrl ?? "").trim() ||
      (o.provider === "entra" && tenant
        ? `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`
        : "");
    if (clientId && clientSecret && authorizeUrl && tokenUrl)
      return { authorizeUrl, tokenUrl, clientId, clientSecret, tenantId: tenant || undefined };
  }
  return oidcConfig();
}

/** SSO source: "config" (admin UI), "env" (environment), or null (unconfigured). */
export function oidcSource(): "config" | "env" | null {
  const o = getConfig().oidc;
  if (o?.enabled && (o.clientId ?? "").trim() && decryptSecret(o.clientSecretEnc).trim())
    return "config";
  return oidcConfig() ? "env" : null;
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
    // BookStack: expose only availability + base URL + write flag, never token.
    bookstack: {
      enabled: !!c.bookstack?.enabled,
      writeEnabled: !!c.bookstack?.writeEnabled,
      baseUrl: c.bookstack?.baseUrl ?? "",
    },
    // Auth/access policy the login page + app shell need to render correctly.
    selfRegistration: {
      enabled: !!c.selfRegistration?.enabled,
      domains: (c.selfRegistration?.domains ?? [])
        .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
        .filter(Boolean),
    },
    guest: {
      enabled: !!c.guest?.enabled,
      model: c.guest?.model?.trim() || null,
    },
    // Which sign-in methods the login page should render.
    authMethods: {
      password: c.authMethods?.password?.enabled ?? true,
      sso: c.authMethods?.sso?.enabled ?? true,
    },
    // SSO button state: shown only when the OIDC env is configured AND the admin
    // has the SSO method enabled. `configured` lets the admin panel explain why a
    // toggle is inert (env missing) vs. simply turned off.
    sso: {
      enabled: !!resolveOidc() && (c.authMethods?.sso?.enabled ?? true),
      configured: !!resolveOidc(),
    },
    // Whether the login page should show a "forgot password" link (SMTP set up).
    passwordReset: { enabled: !!getSmtpConfig() },
  };
}
