import fs from "fs";
import path from "path";
import { DATA_DIR } from "./paths";

/**
 * Global, server-side instance configuration captured during first-run setup.
 * Lives next to users.json in the data dir and, like it, is prepared to be
 * swapped for a real DB later.
 */
export interface PluginFlags {
  /** Office parser (Word/Excel/CSV) in the upload pipeline. */
  officeParser: boolean;
  /** Extended OCR engine (images/PDFs) in the auto-router. */
  ocrEngine: boolean;
  /** Document generator (PDF/Excel export) from chat answers. */
  docGenerator: boolean;
}

export interface ServerConfig {
  /** display name of this instance (shown in the UI) */
  appName: string;
  /** default AI provider the first admin configured during setup */
  primaryProvider?: {
    type: "ollama" | "openai";
    baseUrl: string;
    /** never returned by the public getter */
    apiKey?: string;
  };
  /** admin master-switches for server-side background services */
  plugins?: PluginFlags;
  /** epoch ms when setup was completed */
  setupCompletedAt?: number;
}

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
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2), "utf8");
  return next;
}

/** Config safe to expose to any client (no secrets). */
export function publicConfig(c: ServerConfig = getConfig()) {
  return {
    appName: c.appName,
    primaryProvider: c.primaryProvider
      ? { type: c.primaryProvider.type, baseUrl: c.primaryProvider.baseUrl }
      : undefined,
    plugins: { ...DEFAULT_PLUGINS, ...(c.plugins ?? {}) },
  };
}
