/**
 * Shared brand layer — the single source of truth for everything company-specific
 * (name, logo, accent, legal links, support contact).
 *
 * Deliberately free of node/next imports so the exact same resolution and
 * validation runs on the server (config.ts, layout metadata, mailer) and on the
 * client (store, login page, branding panel). Every write path — the admin POST,
 * the JSON import and the provisioning bootstrap — funnels through
 * `sanitizeBranding`, so there is one place where a bad value is rejected.
 */

/** Default accent: modern deep indigo (Tailwind indigo-600). */
export const DEFAULT_ACCENT = "#4f46e5";

/** Fallback instance name when nothing is configured. */
export const DEFAULT_APP_NAME = "OpenChatbox";

const HEX = /^#[0-9a-fA-F]{6}$/;

export const normalizeHex = (v: string) =>
  v && HEX.test(v.trim()) ? v.trim().toLowerCase() : DEFAULT_ACCENT;

/** "#10a37f" → "16 163 127" (RGB channels for rgb(var(--accent) / <alpha>)). */
export function hexToRgbChannels(hex: string): string {
  const h = normalizeHex(hex).slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/** Darken a hex color by `factor` (0..1) for hover state. */
export function darkenChannels(hex: string, factor = 0.85): string {
  const h = normalizeHex(hex).slice(1);
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const r = clamp(parseInt(h.slice(0, 2), 16) * factor);
  const g = clamp(parseInt(h.slice(2, 4), 16) * factor);
  const b = clamp(parseInt(h.slice(4, 6), 16) * factor);
  return `${r} ${g} ${b}`;
}

/** Admin-global company branding. Every field is always a string (never null). */
export interface BrandingConfig {
  /** Instance/company name — sidebar, login, tab title, email, 2FA issuer. */
  appName: string;
  /** Public base URL (https://chat.firma.de), no trailing slash. Absolute links. */
  appUrl: string;
  /** Accent color as #rrggbb — always valid after sanitizing. */
  accentColor: string;
  /** Primary logo (data URL or https URL). Used on dark surfaces. */
  logoUrl: string;
  /** Optional logo variant for light surfaces; falls back to `logoUrl`. */
  logoLightUrl: string;
  /** Optional dedicated favicon; falls back to `logoUrl`, then a generated icon. */
  faviconUrl: string;
  /** One-line subtitle under the name on login/setup. */
  tagline: string;
  /** Imprint (Impressum) link. */
  imprintUrl: string;
  /** Privacy policy (Datenschutz) link. */
  privacyUrl: string;
  /** Support mailbox — rendered as a mailto link. */
  supportEmail: string;
  /** Support portal/ticket link — takes precedence over `supportEmail`. */
  supportUrl: string;
}

export const DEFAULT_BRANDING: BrandingConfig = {
  appName: DEFAULT_APP_NAME,
  appUrl: "",
  accentColor: DEFAULT_ACCENT,
  logoUrl: "",
  logoLightUrl: "",
  faviconUrl: "",
  tagline: "",
  imprintUrl: "",
  privacyUrl: "",
  supportEmail: "",
  supportUrl: "",
};

/** The branding keys that also exist as legacy top-level config fields. */
export const LEGACY_BRAND_KEYS = ["appName", "appUrl", "logoUrl", "accentColor"] as const;

/**
 * Anything that might carry branding: the nested `branding` object (current
 * shape) and/or the four flat legacy fields (pre-brand-layer config.json,
 * older clients). Nested wins when both are present.
 */
export type BrandingSource = Partial<BrandingConfig> & {
  branding?: Partial<BrandingConfig> | null;
};

/** Max characters for an inlined asset (data URL) — mirrors the API body cap. */
export const MAX_ASSET_CHARS = 500_000;

/** Image data URLs we accept for logo/favicon. */
const DATA_IMAGE = /^data:image\/(png|jpe?g|webp|svg\+xml|gif|x-icon|vnd\.microsoft\.icon)[;,]/i;

const cleanText = (v: unknown, max: number, fallback = ""): string => {
  if (typeof v !== "string") return fallback;
  const s = v.trim().replace(/\s+/g, " ");
  return s ? s.slice(0, max) : fallback;
};

/** http(s) URL or "" — blocks javascript:/data:/file: and other schemes. */
const cleanUrl = (v: unknown, max = 500): string => {
  if (typeof v !== "string") return "";
  const s = v.trim();
  return /^https?:\/\/\S+$/i.test(s) ? s.slice(0, max) : "";
};

/** Base URL without a trailing slash (used for building absolute links). */
const cleanBaseUrl = (v: unknown): string => cleanUrl(v).replace(/\/+$/, "");

const cleanEmail = (v: unknown): string => {
  if (typeof v !== "string") return "";
  const s = v.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? s.slice(0, 200) : "";
};

/** An image reference: either an allow-listed data URL (size-capped) or http(s). */
const cleanImage = (v: unknown): string => {
  if (typeof v !== "string") return "";
  const s = v.trim();
  if (!s) return "";
  if (s.startsWith("data:"))
    return DATA_IMAGE.test(s) && s.length <= MAX_ASSET_CHARS ? s : "";
  return cleanUrl(s, 2000);
};

/**
 * Validate + clamp arbitrary input into a complete `BrandingConfig`. Invalid
 * values are dropped (or replaced by the default), never stored as-is — this is
 * the only guard in front of `config.json` for admin POSTs, JSON imports and the
 * provisioning bootstrap alike.
 */
export function sanitizeBranding(input: Partial<BrandingConfig> | null | undefined): BrandingConfig {
  const i = (input ?? {}) as Record<string, unknown>;
  return {
    appName: cleanText(i.appName, 80, DEFAULT_APP_NAME),
    appUrl: cleanBaseUrl(i.appUrl),
    accentColor: normalizeHex(typeof i.accentColor === "string" ? i.accentColor : ""),
    logoUrl: cleanImage(i.logoUrl),
    logoLightUrl: cleanImage(i.logoLightUrl),
    faviconUrl: cleanImage(i.faviconUrl),
    tagline: cleanText(i.tagline, 140),
    imprintUrl: cleanUrl(i.imprintUrl),
    privacyUrl: cleanUrl(i.privacyUrl),
    supportEmail: cleanEmail(i.supportEmail),
    supportUrl: cleanUrl(i.supportUrl),
  };
}

/**
 * Read branding out of any config shape: nested `branding` first, then the four
 * flat legacy fields, then defaults. Always returns a complete, valid object, so
 * callers never have to `?? ""` their way through it.
 */
export function resolveBranding(src: BrandingSource | null | undefined): BrandingConfig {
  const nested = (src?.branding ?? {}) as Partial<BrandingConfig>;
  const legacy: Partial<BrandingConfig> = {};
  for (const k of LEGACY_BRAND_KEYS) {
    const v = src?.[k];
    if (typeof v === "string" && v.trim()) legacy[k] = v;
  }
  return sanitizeBranding({ ...legacy, ...stripEmpty(nested) });
}

/** Drop empty/undefined keys so a partial nested object can't blank a legacy value. */
function stripEmpty(o: Partial<BrandingConfig>): Partial<BrandingConfig> {
  const out: Partial<BrandingConfig> = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "string" && v.trim()) out[k as keyof BrandingConfig] = v;
  }
  return out;
}

/** CSS custom properties derived from the accent color. */
export function brandTokens(accent: string): Record<string, string> {
  return {
    "--accent": hexToRgbChannels(accent),
    "--accent-hover": darkenChannels(accent),
  };
}

/** Same tokens as a `:root` rule — server-rendered into <head> to avoid a flash. */
export function brandTokenCss(accent: string): string {
  const t = brandTokens(accent);
  return `:root{--accent:${t["--accent"]};--accent-hover:${t["--accent-hover"]}}`;
}

/** The logo to render on a given surface (light surfaces prefer the variant). */
export function brandLogo(b: Pick<BrandingConfig, "logoUrl" | "logoLightUrl">, dark = true): string {
  return dark ? b.logoUrl : b.logoLightUrl || b.logoUrl;
}

/** Where the support link should point (portal wins over mailbox), or "". */
export function supportHref(b: Pick<BrandingConfig, "supportUrl" | "supportEmail">): string {
  return b.supportUrl || (b.supportEmail ? `mailto:${b.supportEmail}` : "");
}

/** Generated fallback app icon: rounded square in the accent + white bubble. */
export function defaultIconSvg(accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><rect width="32" height="32" rx="7" fill="rgb(${hexToRgbChannels(
    accent
  )})"/><path d="M8 11a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-7l-4 3v-3a3 3 0 0 1-2-3z" fill="#fff"/></svg>`;
}

export function defaultIconDataUrl(accent: string): string {
  return "data:image/svg+xml," + encodeURIComponent(defaultIconSvg(accent));
}
