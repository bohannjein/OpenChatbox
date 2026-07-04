import { useStore } from "./store";
import type { GlobalConfigPayload, ServerUserProfile } from "./types";

/**
 * Server-persistence bridge. On load we hydrate the store from the server
 * (admin-global config via /api/config + per-user prefs via /api/profile); the
 * server is the source of truth. Changes to the per-user subset are pushed back
 * (debounced write-through) via PUT /api/profile.
 */

type State = ReturnType<typeof useStore.getState>;

let hydrating = false;
let ready = false; // becomes true only after the first server hydration
let lastSnapshot = "";
let lastGlobal = "";
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let globalTimer: ReturnType<typeof setTimeout> | null = null;
let unsub: (() => void) | null = null;

/** Admin-global subset (branding + router + providers incl. locally-held keys). */
function globalOf(s: State): GlobalConfigPayload {
  return {
    appName: s.appName,
    logoUrl: s.logoUrl,
    accentColor: s.accentColor,
    providers: s.providers,
    routerModels: s.routerModels,
  };
}

/** The per-user profile subset — must mirror lib/server/profiles.ts KEYS. */
function profileOf(s: State): ServerUserProfile {
  return {
    theme: s.theme,
    lang: s.lang,
    params: s.params,
    customInstructions: s.customInstructions,
    favorites: s.favorites,
    aliases: s.aliases,
    codeSplitEnabled: s.codeSplitEnabled,
    codeSplitThreshold: s.codeSplitThreshold,
    codeSplitWidth: s.codeSplitWidth,
    memory: s.memory,
    memoryEnabled: s.memoryEnabled,
    webSearchEnabled: s.webSearchEnabled,
    selectedModelKey: s.selectedModelKey,
    autoRouter: s.autoRouter,
    vramManaged: s.vramManaged,
    ollamaKeepAlive: s.ollamaKeepAlive,
    sidekicks: s.sidekicks,
    prompts: s.prompts,
  };
}

/** Fetch admin-global config + per-user profile and apply to the store. */
export async function loadServerState(): Promise<void> {
  hydrating = true;
  try {
    const [cfg, prof] = await Promise.all([
      fetch("/api/config").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/profile").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    const st = useStore.getState();
    if (cfg) st.applyGlobalConfig(cfg as GlobalConfigPayload);
    if (prof?.profile) st.hydrateProfile(prof.profile as ServerUserProfile);
  } finally {
    // Baselines so the initial hydration doesn't immediately echo back.
    const st2 = useStore.getState();
    lastSnapshot = JSON.stringify(profileOf(st2));
    lastGlobal = JSON.stringify(globalOf(st2));
    hydrating = false;
    ready = true;
  }
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    const profile = profileOf(useStore.getState());
    fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile }),
    }).catch(() => {
      /* offline / transient — next change retries */
    });
  }, 1000);
}

function scheduleGlobalPush() {
  if (globalTimer) clearTimeout(globalTimer);
  globalTimer = setTimeout(() => {
    globalTimer = null;
    fetch("/api/admin/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(globalOf(useStore.getState())),
    }).catch(() => {
      /* non-admin (403) or offline — ignore */
    });
  }, 1000);
}

/**
 * Subscribe once: push the per-user profile (any user) and, for admins, the
 * admin-global config to the server when the respective subset changes.
 */
export function startProfileSync(): () => void {
  if (unsub) return unsub;
  unsub = useStore.subscribe((s) => {
    // Never push before the first server hydration completes (would clobber the
    // server with stale local-cache values).
    if (hydrating || !ready) return;
    const snap = JSON.stringify(profileOf(s));
    if (snap !== lastSnapshot) {
      lastSnapshot = snap;
      schedulePush();
    }
    // Admin-global config is only pushed by admins (server 403s otherwise).
    if (s.authUser?.role === "admin") {
      const g = JSON.stringify(globalOf(s));
      if (g !== lastGlobal) {
        lastGlobal = g;
        scheduleGlobalPush();
      }
    }
  });
  return unsub;
}
