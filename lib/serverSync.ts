import { useStore } from "./store";
import type { Chat, Folder, GlobalConfigPayload, ServerUserProfile } from "./types";

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
let liveTimer: ReturnType<typeof setInterval> | null = null;
let lastPushAt = 0; // epoch ms of the last completed write-through
let unsub: (() => void) | null = null;

const markPushed = () => {
  try {
    lastPushAt = Date.now();
  } catch {
    /* ignore */
  }
};

/** Chat history for server storage — strips volatile blobs (images/docs/
 *  pipeline + file dataUrls) and drops temporary chats, mirroring the local
 *  persist shape. Files themselves live in the server file store. */
function chatsOf(s: State): {
  chats: unknown[];
  folders: Folder[];
  activeChatId: string | null;
} {
  return {
    chats: s.chats
      .filter((c) => !c.temporary)
      .map((c) => ({
        ...c,
        messages: c.messages.map(({ images, docs, pipeline, toolEvents, ...m }) => m),
        files: c.files?.map(({ dataUrl, ...f }) => f),
      })),
    folders: s.folders,
    activeChatId: s.activeChatId,
  };
}

/**
 * Admin-global subset auto-pushed on change (branding + router). Providers are
 * NOT here on purpose: the client only holds an apiKey-stripped copy, so
 * auto-pushing them would wipe the server-side keys. Providers are saved
 * explicitly via the ProvidersPanel (which loads the full config with keys).
 */
function globalOf(s: State): GlobalConfigPayload {
  return {
    appName: s.appName,
    logoUrl: s.logoUrl,
    accentColor: s.accentColor,
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
    // webSearchEnabled / kbEnabled are intentionally not persisted — they are
    // per-turn opt-ins that must always start OFF (see hydrateProfile note).
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
      // Successful fetch → safe to write chats back afterwards.
      chatsLoaded = true;
      const serverChats = (chatsRes.chats ?? []) as Chat[];
      const serverFolders = (chatsRes.folders ?? []) as Folder[];
      st.hydrateChats(serverChats, chatsRes.activeChatId ?? null, serverFolders);
      // First-run migration: server has no chats yet but this device still holds
      // some (from the old local-only store) → push them up once now.
      if (!serverChats.length) {
        const local = chatsOf(useStore.getState());
        if (local.chats.length)
          fetch("/api/chats", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(local),
          })
            .catch(() => {})
            .finally(markPushed);
      }
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
    })
      .then((r) => useStore.getState().setSyncError(!r.ok))
      .catch(() => useStore.getState().setSyncError(true))
      .finally(markPushed);
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
    })
      .then((r) => useStore.getState().setSyncError(!r.ok))
      .catch(() => useStore.getState().setSyncError(true))
      .finally(markPushed);
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
    })
      .catch(() => {
        /* non-admin (403) or offline — ignore */
      })
      .finally(markPushed);
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

/**
 * Live sync across devices: periodically re-hydrate from the server so another
 * device's changes appear. Only runs when idle — no pending write-through
 * (which also covers typing + streaming, since those keep a debounce timer
 * armed) and a short cooldown after the last push (so an in-flight PUT isn't
 * overwritten by a stale read). Reuses loadServerState (sets hydrating +
 * rebaselines, so it never echoes back).
 */
export function startLiveSync(intervalMs = 20000): () => void {
  if (liveTimer) return () => {};
  liveTimer = setInterval(() => {
    if (!ready || hydrating) return;
    if (pushTimer || chatTimer || globalTimer) return; // local changes not settled
    let now = 0;
    try {
      now = Date.now();
    } catch {
      /* ignore */
    }
    if (now && now - lastPushAt < 6000) return; // just wrote — let it land first
    loadServerState().catch(() => {});
  }, intervalMs);
  return () => {
    if (liveTimer) clearInterval(liveTimer);
    liveTimer = null;
  };
}
