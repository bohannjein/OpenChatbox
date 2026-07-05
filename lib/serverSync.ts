import { useStore } from "./store";
import type { Chat, GlobalConfigPayload, ServerUserProfile } from "./types";

/**
 * Server-persistence bridge. On load we hydrate the store from the server
 * (admin-global config via /api/config + per-user prefs via /api/profile); the
 * server is the source of truth. Changes to the per-user subset are pushed back
 * (debounced write-through) via PUT /api/profile.
 */

type State = ReturnType<typeof useStore.getState>;

let hydrating = false;
let ready = false; // becomes true only after the first server hydration
let chatsLoaded = false; // true only after a successful /api/chats fetch
let lastSnapshot = "";
let lastGlobal = "";
let lastChats = "";
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let globalTimer: ReturnType<typeof setTimeout> | null = null;
let chatTimer: ReturnType<typeof setTimeout> | null = null;
let unsub: (() => void) | null = null;

/** Chat history for server storage — strips volatile blobs (images/docs/
 *  pipeline + file dataUrls) and drops temporary chats, mirroring the local
 *  persist shape. Files themselves live in the server file store. */
function chatsOf(s: State): { chats: unknown[]; activeChatId: string | null } {
  return {
    chats: s.chats
      .filter((c) => !c.temporary)
      .map((c) => ({
        ...c,
        messages: c.messages.map(({ images, docs, pipeline, ...m }) => m),
        files: c.files?.map(({ dataUrl, ...f }) => f),
      })),
    activeChatId: s.activeChatId,
  };
}

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
    chatLayout: s.chatLayout,
    chatShowAvatar: s.chatShowAvatar,
    chatShowTimestamps: s.chatShowTimestamps,
    chatShowStats: s.chatShowStats,
    assistantAvatarUrl: s.assistantAvatarUrl,
    chatBackgroundUrl: s.chatBackgroundUrl,
    memory: s.memory,
    memoryEnabled: s.memoryEnabled,
    webSearchEnabled: s.webSearchEnabled,
    kbEnabled: s.kbEnabled,
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
    const [cfg, prof, chatsRes] = await Promise.all([
      fetch("/api/config", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/profile", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/chats", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);
    const st = useStore.getState();
    if (cfg) st.applyGlobalConfig(cfg as GlobalConfigPayload);
    if (prof?.profile) st.hydrateProfile(prof.profile as ServerUserProfile);
    if (chatsRes) {
      // Successful fetch → safe to write chats back afterwards. Empty server
      // copy keeps local chats (first-run migration → pushed up on next change).
      chatsLoaded = true;
      st.hydrateChats((chatsRes.chats ?? []) as Chat[], chatsRes.activeChatId ?? null);
    }
  } finally {
    // Baselines so the initial hydration doesn't immediately echo back.
    const st2 = useStore.getState();
    lastSnapshot = JSON.stringify(profileOf(st2));
    lastGlobal = JSON.stringify(globalOf(st2));
    lastChats = JSON.stringify(chatsOf(st2));
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

function scheduleChatPush() {
  if (chatTimer) clearTimeout(chatTimer);
  // Longer debounce: chats change on every streamed token; save ~2s after the
  // last change (i.e. shortly after a stream ends).
  chatTimer = setTimeout(() => {
    chatTimer = null;
    fetch("/api/chats", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chatsOf(useStore.getState())),
    }).catch(() => {
      /* offline / transient — next change retries */
    });
  }, 2000);
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
    // Chats → server (only after a successful initial fetch, so a failed load
    // never clobbers the server copy with an empty local one).
    if (chatsLoaded) {
      const cs = JSON.stringify(chatsOf(s));
      if (cs !== lastChats) {
        lastChats = cs;
        scheduleChatPush();
      }
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
