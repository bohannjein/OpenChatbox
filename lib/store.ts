import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "./uid";
import type {
  AuthUser,
  Chat,
  ChatFile,
  Feedback,
  GeneratedDoc,
  GenParams,
  MemoryFact,
  Message,
  PipelineStage,
  GlobalConfigPayload,
  ServerUserProfile,
  PromptTemplate,
  Provider,
  Role,
  Sidekick,
  Workspace,
} from "./types";

export type Theme = "light" | "dark";

const now = () => Date.now();

/** The always-present personal workspace every user starts with. Legacy chats
 *  and sidekicks (no workspaceId) are treated as belonging here. */
export const DEFAULT_WORKSPACE_ID = "ws-default";
const defaultWorkspaces = (): Workspace[] => [
  { id: DEFAULT_WORKSPACE_ID, name: "Persönlich", createdAt: 0 },
];
/** True if an item (chat/sidekick) belongs to the given workspace, treating a
 *  missing workspaceId as the default workspace. */
export const inWorkspace = (
  item: { workspaceId?: string },
  wsId: string
): boolean => (item.workspaceId ?? DEFAULT_WORKSPACE_ID) === wsId;

/** Default: nur lokales Ollama aktiv. Weitere Anbieter per „+ Anbieter hinzufügen". */
const defaultProviders = (): Provider[] => [
  {
    id: "ollama-local",
    name: "Ollama (Lokal)",
    type: "ollama",
    baseUrl: "http://localhost:11434",
    enabled: true,
  },
];

/** Firmen-Prompt-Bibliothek (Standardvorlagen, editierbar in Einstellungen). */
const defaultPrompts = (): PromptTemplate[] => [
  {
    id: "translate",
    title: "Text übersetzen",
    shortcut: "übersetzen",
    content:
      "Übersetze den folgenden Text ins Englische. Gib nur die Übersetzung zurück:\n\n",
  },
  {
    id: "refactor",
    title: "Code refaktorisieren",
    shortcut: "refactor",
    content:
      "Refaktoriere den folgenden Code. Verbessere Lesbarkeit und Struktur, erkläre kurz die Änderungen:\n\n```\n\n```",
  },
  {
    id: "email",
    title: "E-Mail korrigieren",
    shortcut: "email",
    content:
      "Korrigiere Rechtschreibung, Grammatik und Ton der folgenden E-Mail. Behalte die Sprache bei:\n\n",
  },
  {
    id: "summarize",
    title: "Text zusammenfassen",
    shortcut: "zusammenfassen",
    content:
      "Fasse den folgenden Text in 5 prägnanten Stichpunkten zusammen:\n\n",
  },
];

const defaultParams = (): GenParams => ({
  temperature: 0.7,
  topP: 1,
  maxTokens: 2048,
});

/**
 * localStorage wrapper that never throws. A QuotaExceededError (e.g. very long
 * chat history) must not brick the app by making every state write throw.
 */
// Per-user namespace: chats/settings are scoped to the logged-in user id
// (set at login). Prepared for a real DB; today separates users on one browser.
const activeUid = () => {
  try {
    return localStorage.getItem("nexus-uid") || "anon";
  } catch {
    return "anon";
  }
};
const nsKey = (name: string) => `${name}::${activeUid()}`;

// Legacy persist-store name (pre-OpenChatbox rebrand). Read-migrated on access
// so existing users keep their chats/settings after the key was renamed.
const LEGACY_STORE_KEY = "chatbot-ui-store";

const safeStorage = {
  getItem: (name: string): string | null => {
    try {
      const v = localStorage.getItem(nsKey(name));
      if (v !== null) return v;
      // Migration 1 — namespaced legacy key (build that already namespaced but
      // used the old store name): adopt into the new key and drop the old one.
      const nsLegacy = localStorage.getItem(nsKey(LEGACY_STORE_KEY));
      if (nsLegacy !== null) {
        try {
          localStorage.setItem(nsKey(name), nsLegacy);
          localStorage.removeItem(nsKey(LEGACY_STORE_KEY));
        } catch {
          /* ignore quota/write errors — still return the legacy value */
        }
        return nsLegacy;
      }
      // Migration 2 — plain, non-namespaced legacy key from the original build
      // (no per-user namespacing existed then). Copy, do NOT delete: it is not
      // uid-scoped and may still seed the real user's namespace after login.
      const plainLegacy = localStorage.getItem(LEGACY_STORE_KEY);
      if (plainLegacy !== null) {
        try {
          localStorage.setItem(nsKey(name), plainLegacy);
        } catch {
          /* ignore */
        }
        return plainLegacy;
      }
      return null;
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      localStorage.setItem(nsKey(name), value);
    } catch {
      try {
        localStorage.removeItem(nsKey(name));
      } catch {
        /* ignore */
      }
    }
  },
  removeItem: (name: string): void => {
    try {
      localStorage.removeItem(nsKey(name));
    } catch {
      /* ignore */
    }
  },
};

interface State {
  chats: Chat[];
  activeChatId: string | null;
  providers: Provider[];
  selectedModelKey: string | null;
  // Auto model-router: when on, route each turn to a category model automatically.
  autoRouter: boolean;
  routerModels: {
    /** Standard / Allrounder — the answer model (also stage 2 of the OCR chain). */
    standard: string | null;
    coding: string | null;
    reasoning: string | null;
    /** OCR / vision model */
    vision: string | null;
    /** automatic chat-title (thread naming) */
    title: string | null;
    /** web-search query construction */
    search: string | null;
  };
  prompts: PromptTemplate[];
  customInstructions: string;
  params: GenParams;
  /** global incognito switch: new chats are temporary while on. */
  incognito: boolean;
  theme: Theme;
  /** UI language; null = auto-detect from navigator.language on first load. */
  lang: "de" | "en" | null;
  /** chat whose title is being generated → shows the ASCII loader (transient). */
  titlePendingId: string | null;
  // branding
  accentColor: string;
  logoUrl: string;
  appName: string;
  // model management
  favorites: string[]; // model keys pinned to top
  aliases: Record<string, string>; // model key → friendly display name
  // chat appearance (per-user)
  /** use the personal knowledge base (RAG) as chat context */
  kbEnabled: boolean;
  toggleKb: () => void;
  chatLayout: "classic" | "bubble";
  chatShowAvatar: boolean;
  chatShowTimestamps: boolean;
  chatShowStats: boolean;
  /** uploaded assistant profile picture (data URL) */
  assistantAvatarUrl: string;
  /** uploaded chat-window background image (data URL) */
  chatBackgroundUrl: string;
  setChatLayout: (v: "classic" | "bubble") => void;
  setChatShowAvatar: (v: boolean) => void;
  setChatShowTimestamps: (v: boolean) => void;
  setChatShowStats: (v: boolean) => void;
  setAssistantAvatarUrl: (v: string) => void;
  setChatBackgroundUrl: (v: string) => void;
  // code splitscreen
  codeSplitEnabled: boolean;
  codeSplitThreshold: number;
  /** persisted width (px) of the right splitscreen panel */
  codeSplitWidth: number;
  /** VRAM-Management an/aus (aus = Ollama-Default, kein keep_alive gesetzt) */
  vramManaged: boolean;
  /** Ollama keep_alive (VRAM-Freigabe), z.B. "2m", "30s", "0", "-1" */
  ollamaKeepAlive: string;
  // sidekicks + memory
  sidekicks: Sidekick[];
  // workspaces (collaboration spaces): scope chats/sidekicks/files to a team
  workspaces: Workspace[];
  activeWorkspaceId: string;
  memory: MemoryFact[];
  memoryEnabled: boolean;
  /** internet search toggle (client flag) */
  webSearchEnabled: boolean;
  toggleWebSearch: () => void;
  // auth (transient, not persisted)
  authUser: AuthUser | null;
  setAuthUser: (u: AuthUser | null) => void;
  // admin plugin master-switches (transient, fetched from /api/config)
  plugins: { officeParser: boolean; ocrEngine: boolean; docGenerator: boolean } | null;
  setPluginFlags: (p: State["plugins"]) => void;
  /** whether an admin web-search provider is configured (transient, from /api/config) */
  searchAvailable: boolean;
  // Server-persistence bridge: apply admin-global config + per-user profile
  // fetched from the server on load (server is the source of truth).
  applyGlobalConfig: (c: GlobalConfigPayload) => void;
  hydrateProfile: (p: ServerUserProfile) => void;
  settingsOpen: boolean;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  filesOpen: boolean;
  setFilesOpen: (v: boolean) => void;
  sidebarOpen: boolean;

  // chat actions
  newChat: (temporary?: boolean, sidekickId?: string) => string;
  deleteChat: (id: string) => void;
  selectChat: (id: string) => void;
  renameChat: (id: string, title: string) => void;
  keepChat: (id: string) => void;
  setChatTemporary: (id: string, val: boolean) => void;
  togglePinChat: (id: string) => void;
  clearAllChats: () => void;
  setDraft: (id: string, draft: string) => void;
  setIncognito: (v: boolean) => void;
  addChatFiles: (chatId: string, files: ChatFile[]) => void;

  addMessage: (
    chatId: string,
    role: Role,
    content: string,
    images?: string[]
  ) => string;
  appendToMessage: (chatId: string, msgId: string, delta: string) => void;
  appendReasoning: (chatId: string, msgId: string, delta: string) => void;
  setMessageContent: (chatId: string, msgId: string, content: string) => void;
  setMessagePipeline: (
    chatId: string,
    msgId: string,
    stage: PipelineStage | undefined
  ) => void;
  truncateAfter: (chatId: string, msgId: string) => void;
  editUserMessage: (chatId: string, msgId: string, content: string) => void;

  // variants / regenerate
  startRegenerate: (chatId: string, msgId: string) => void;
  finalizeVariant: (chatId: string, msgId: string) => void;
  setActiveVariant: (chatId: string, msgId: string, index: number) => void;
  setFeedback: (chatId: string, msgId: string, fb: Feedback) => void;
  attachGeneratedDoc: (chatId: string, msgId: string, doc: GeneratedDoc) => void;

  // provider actions
  setProviders: (p: Provider[]) => void;
  upsertProvider: (p: Provider) => void;
  removeProvider: (id: string) => void;
  selectModel: (key: string) => void;
  setAutoRouter: (v: boolean) => void;
  setRouterModel: (
    category: "coding" | "reasoning" | "vision" | "standard" | "title" | "search",
    key: string | null
  ) => void;

  // prompts
  upsertPrompt: (p: PromptTemplate) => void;
  removePrompt: (id: string) => void;

  setLang: (lang: "de" | "en") => void;
  setTitlePending: (id: string | null) => void;

  // system / params
  setCustomInstructions: (v: string) => void;
  setParams: (patch: Partial<GenParams>) => void;

  // branding
  setAccentColor: (id: string) => void;
  setLogoUrl: (url: string) => void;
  setAppName: (name: string) => void;

  // model management
  toggleFavorite: (key: string) => void;
  setAlias: (key: string, name: string) => void;

  // code splitscreen
  setCodeSplitEnabled: (v: boolean) => void;
  setCodeSplitThreshold: (n: number) => void;
  setCodeSplitWidth: (n: number) => void;
  setOllamaKeepAlive: (v: string) => void;
  setVramManaged: (v: boolean) => void;

  // sidekicks
  upsertSidekick: (s: Sidekick) => void;
  removeSidekick: (id: string) => void;

  // workspaces
  createWorkspace: (name: string) => string;
  renameWorkspace: (id: string, name: string) => void;
  deleteWorkspace: (id: string) => void;
  switchWorkspace: (id: string) => void;
  /** add/update a workspace from the server (invites, cross-device sync) */
  upsertWorkspace: (ws: { id: string; name: string }) => void;
  setChatSidekick: (chatId: string, sidekickId: string | null) => void;

  // memory
  addMemory: (text: string) => void;
  updateMemory: (id: string, text: string) => void;
  removeMemory: (id: string) => void;
  clearMemory: () => void;
  setMemoryEnabled: (v: boolean) => void;

  // ui
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setSettingsOpen: (v: boolean) => void;
  setSidebarOpen: (v: boolean) => void;
}

const patchMessage = (
  chats: Chat[],
  chatId: string,
  msgId: string,
  fn: (m: Message) => Message
): Chat[] =>
  chats.map((c) =>
    c.id !== chatId
      ? c
      : {
          ...c,
          updatedAt: now(),
          messages: c.messages.map((m) => (m.id === msgId ? fn(m) : m)),
        }
  );

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      chats: [],
      activeChatId: null,
      providers: defaultProviders(),
      selectedModelKey: null,
      autoRouter: false,
      routerModels: {
        standard: null,
        coding: null,
        reasoning: null,
        vision: null,
        title: null,
        search: null,
      },
      prompts: defaultPrompts(),
      customInstructions: "",
      params: defaultParams(),
      incognito: false,
      theme: "dark",
      lang: null,
      titlePendingId: null,
      accentColor: "#10a37f",
      logoUrl: "",
      appName: "OpenChatbox",
      favorites: [],
      aliases: {},
      chatLayout: "classic",
      chatShowAvatar: false,
      chatShowTimestamps: false,
      chatShowStats: false,
      assistantAvatarUrl: "",
      chatBackgroundUrl: "",
      codeSplitEnabled: true,
      codeSplitThreshold: 15,
      codeSplitWidth: 560,
      vramManaged: true,
      ollamaKeepAlive: "2m",
      sidekicks: [],
      workspaces: defaultWorkspaces(),
      activeWorkspaceId: DEFAULT_WORKSPACE_ID,
      memory: [],
      memoryEnabled: true,
      webSearchEnabled: false,
      toggleWebSearch: () =>
        set((s) => ({ webSearchEnabled: !s.webSearchEnabled })),
      kbEnabled: false,
      toggleKb: () => set((s) => ({ kbEnabled: !s.kbEnabled })),
      authUser: null,
      setAuthUser: (authUser) => set({ authUser }),
      plugins: null,
      setPluginFlags: (plugins) => set({ plugins }),
      searchAvailable: false,

      // Apply admin-global config from the server. Only overwrite a field when
      // the server actually provides it, so a fresh instance (empty config)
      // never wipes sensible client defaults (e.g. the local Ollama provider).
      applyGlobalConfig: (c) =>
        set((s) => ({
          // Server provider list is apiKey-stripped; preserve any local apiKey
          // (the admin who entered it) so re-saving never wipes the secret.
          providers:
            c.providers && c.providers.length
              ? c.providers.map((p) => {
                  const local = s.providers.find((x) => x.id === p.id);
                  return local?.apiKey && !p.apiKey ? { ...p, apiKey: local.apiKey } : p;
                })
              : s.providers,
          routerModels: c.routerModels
            ? { ...s.routerModels, ...c.routerModels }
            : s.routerModels,
          appName: c.appName ?? s.appName,
          logoUrl: c.logoUrl ?? s.logoUrl,
          accentColor: c.accentColor || s.accentColor,
          plugins: c.plugins ?? s.plugins,
          searchAvailable: c.search?.enabled ?? s.searchAvailable,
        })),

      // Apply the per-user profile fetched from the server (source of truth).
      hydrateProfile: (p) =>
        set((s) => ({
          theme: (p.theme as State["theme"]) ?? s.theme,
          lang: p.lang !== undefined ? p.lang : s.lang,
          params: p.params ?? s.params,
          customInstructions: p.customInstructions ?? s.customInstructions,
          favorites: p.favorites ?? s.favorites,
          aliases: p.aliases ?? s.aliases,
          codeSplitEnabled: p.codeSplitEnabled ?? s.codeSplitEnabled,
          codeSplitThreshold: p.codeSplitThreshold ?? s.codeSplitThreshold,
          codeSplitWidth: p.codeSplitWidth ?? s.codeSplitWidth,
          chatLayout: p.chatLayout ?? s.chatLayout,
          chatShowAvatar: p.chatShowAvatar ?? s.chatShowAvatar,
          chatShowTimestamps: p.chatShowTimestamps ?? s.chatShowTimestamps,
          chatShowStats: p.chatShowStats ?? s.chatShowStats,
          assistantAvatarUrl: p.assistantAvatarUrl ?? s.assistantAvatarUrl,
          chatBackgroundUrl: p.chatBackgroundUrl ?? s.chatBackgroundUrl,
          memory: p.memory ?? s.memory,
          memoryEnabled: p.memoryEnabled ?? s.memoryEnabled,
          webSearchEnabled: p.webSearchEnabled ?? s.webSearchEnabled,
          kbEnabled: p.kbEnabled ?? s.kbEnabled,
          selectedModelKey:
            p.selectedModelKey !== undefined ? p.selectedModelKey : s.selectedModelKey,
          autoRouter: p.autoRouter ?? s.autoRouter,
          vramManaged: p.vramManaged ?? s.vramManaged,
          ollamaKeepAlive: p.ollamaKeepAlive ?? s.ollamaKeepAlive,
          sidekicks: p.sidekicks ?? s.sidekicks,
          prompts: p.prompts ?? s.prompts,
        })),

      settingsOpen: false,
      searchOpen: false,
      setSearchOpen: (searchOpen) => set({ searchOpen }),
      filesOpen: false,
      setFilesOpen: (filesOpen) => set({ filesOpen }),
      sidebarOpen: true,

      newChat: (temporary, sidekickId) => {
        const s = get();
        // leaving a temporary chat → discard it + turn incognito back off
        const leavingTemp = !!s.chats.find((c) => c.id === s.activeChatId)
          ?.temporary;
        const incognito = leavingTemp ? false : s.incognito;
        const temp = temporary ?? incognito;
        const sk = sidekickId
          ? s.sidekicks.find((x) => x.id === sidekickId)
          : undefined;
        const chat: Chat = {
          id: uid(),
          title: sk ? sk.name : temp ? "Temporärer Chat" : "Neuer Chat",
          messages: [],
          modelKey: (sk?.modelKey || s.selectedModelKey) ?? undefined,
          temporary: temp,
          sidekickId: sk?.id,
          workspaceId: s.activeWorkspaceId,
          createdAt: now(),
          updatedAt: now(),
        };
        set({
          chats: [chat, ...pruneEmpty(s.chats, s.activeChatId)],
          activeChatId: chat.id,
          incognito,
        });
        return chat.id;
      },

      deleteChat: (id) => {
        // Persisted files belong to the chat → remove them server-side too.
        try {
          fetch(`/api/files?chatId=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(
            () => {}
          );
        } catch {
          /* SSR / no fetch — ignore */
        }
        set((s) => {
          const chats = s.chats.filter((c) => c.id !== id);
          const activeChatId =
            s.activeChatId === id
              ? chats.find((c) => !c.temporary)?.id ?? chats[0]?.id ?? null
              : s.activeChatId;
          return { chats, activeChatId };
        });
      },

      selectChat: (id) =>
        set((s) => {
          if (id === s.activeChatId) return {};
          const leavingTemp = !!s.chats.find((c) => c.id === s.activeChatId)
            ?.temporary;
          // leaving: drop if empty/draftless OR temporary (auto-cleanup)
          const chats = pruneEmpty(s.chats, s.activeChatId, id);
          return {
            chats,
            activeChatId: id,
            incognito: leavingTemp ? false : s.incognito,
          };
        }),

      setDraft: (id, draft) =>
        set((s) => ({
          chats: s.chats.map((c) => (c.id === id ? { ...c, draft } : c)),
        })),

      setIncognito: (incognito) => set({ incognito }),

      addChatFiles: (chatId, files) =>
        set((s) => ({
          chats: s.chats.map((c) =>
            c.id === chatId
              ? { ...c, files: [...(c.files ?? []), ...files] }
              : c
          ),
        })),

      renameChat: (id, title) =>
        set((s) => ({
          chats: s.chats.map((c) =>
            c.id === id ? { ...c, title, updatedAt: now() } : c
          ),
        })),

      keepChat: (id) =>
        set((s) => ({
          chats: s.chats.map((c) => {
            if (c.id !== id) return c;
            const firstUser = c.messages.find((m) => m.role === "user");
            const title =
              c.title === "Temporärer Chat" && firstUser
                ? deriveTitle(firstUser.content)
                : c.title;
            return { ...c, temporary: false, title, updatedAt: now() };
          }),
        })),

      setChatTemporary: (id, val) =>
        set((s) => ({
          chats: s.chats.map((c) =>
            c.id === id
              ? {
                  ...c,
                  temporary: val,
                  title: val ? "Temporärer Chat" : c.title,
                  updatedAt: now(),
                }
              : c
          ),
        })),

      togglePinChat: (id) =>
        set((s) => ({
          chats: s.chats.map((c) =>
            c.id === id ? { ...c, pinned: !c.pinned, updatedAt: now() } : c
          ),
        })),

      clearAllChats: () =>
        set((s) => {
          const kept = s.chats.filter((c) => c.temporary);
          return { chats: kept, activeChatId: kept[0]?.id ?? null };
        }),

      addMessage: (chatId, role, content, images) => {
        const msg: Message = {
          id: uid(),
          role,
          content,
          createdAt: now(),
          ...(images && images.length ? { images } : {}),
        };
        set((s) => ({
          chats: s.chats.map((c) => {
            if (c.id !== chatId) return c;
            const isFirstUser =
              role === "user" && !c.messages.some((m) => m.role === "user");
            return {
              ...c,
              title:
                isFirstUser && !c.temporary ? deriveTitle(content) : c.title,
              messages: [...c.messages, msg],
              // once a message is sent the draft is consumed
              draft: role === "user" ? "" : c.draft,
              modelKey: c.modelKey ?? get().selectedModelKey ?? undefined,
              updatedAt: now(),
            };
          }),
        }));
        return msg.id;
      },

      appendToMessage: (chatId, msgId, delta) =>
        set((s) => ({
          chats: patchMessage(s.chats, chatId, msgId, (m) => ({
            ...m,
            content: m.content + delta,
          })),
        })),

      appendReasoning: (chatId, msgId, delta) =>
        set((s) => ({
          chats: patchMessage(s.chats, chatId, msgId, (m) => ({
            ...m,
            reasoning: (m.reasoning ?? "") + delta,
          })),
        })),

      setMessageContent: (chatId, msgId, content) =>
        set((s) => ({
          chats: patchMessage(s.chats, chatId, msgId, (m) => ({
            ...m,
            content,
          })),
        })),

      setMessagePipeline: (chatId, msgId, stage) =>
        set((s) => ({
          chats: patchMessage(s.chats, chatId, msgId, (m) => ({
            ...m,
            pipeline: stage,
          })),
        })),

      truncateAfter: (chatId, msgId) =>
        set((s) => ({
          chats: s.chats.map((c) => {
            if (c.id !== chatId) return c;
            const idx = c.messages.findIndex((m) => m.id === msgId);
            if (idx < 0) return c;
            return {
              ...c,
              messages: c.messages.slice(0, idx + 1),
              updatedAt: now(),
            };
          }),
        })),

      editUserMessage: (chatId, msgId, content) =>
        set((s) => ({
          chats: s.chats.map((c) => {
            if (c.id !== chatId) return c;
            const idx = c.messages.findIndex((m) => m.id === msgId);
            if (idx < 0) return c;
            const messages = c.messages.slice(0, idx + 1);
            messages[idx] = { ...messages[idx], content };
            return { ...c, messages, updatedAt: now() };
          }),
        })),

      startRegenerate: (chatId, msgId) =>
        set((s) => ({
          chats: patchMessage(s.chats, chatId, msgId, (m) => {
            const variants = m.variants ?? [m.content];
            return {
              ...m,
              variants: [...variants, ""],
              activeVariant: variants.length,
              content: "",
              reasoning: "",
              feedback: null,
            };
          }),
        })),

      finalizeVariant: (chatId, msgId) =>
        set((s) => ({
          chats: patchMessage(s.chats, chatId, msgId, (m) => {
            if (!m.variants || m.activeVariant == null) return m;
            const variants = [...m.variants];
            variants[m.activeVariant] = m.content;
            return { ...m, variants };
          }),
        })),

      setActiveVariant: (chatId, msgId, index) =>
        set((s) => ({
          chats: patchMessage(s.chats, chatId, msgId, (m) => {
            if (!m.variants || index < 0 || index >= m.variants.length)
              return m;
            return {
              ...m,
              activeVariant: index,
              content: m.variants[index],
              feedback: null,
            };
          }),
        })),

      setFeedback: (chatId, msgId, fb) =>
        set((s) => ({
          chats: patchMessage(s.chats, chatId, msgId, (m) => ({
            ...m,
            feedback: m.feedback === fb ? null : fb,
          })),
        })),
      attachGeneratedDoc: (chatId, msgId, doc) =>
        set((s) => ({
          chats: patchMessage(s.chats, chatId, msgId, (m) => ({
            ...m,
            docs: [...(m.docs ?? []), doc],
          })),
        })),

      setProviders: (providers) => set({ providers }),
      upsertProvider: (p) =>
        set((s) => ({
          providers: s.providers.some((x) => x.id === p.id)
            ? s.providers.map((x) => (x.id === p.id ? p : x))
            : [...s.providers, p],
        })),
      removeProvider: (id) =>
        set((s) => ({ providers: s.providers.filter((p) => p.id !== id) })),
      selectModel: (key) => set({ selectedModelKey: key }),
      setAutoRouter: (autoRouter) => set({ autoRouter }),
      setRouterModel: (category, key) =>
        set((s) => ({ routerModels: { ...s.routerModels, [category]: key } })),

      upsertPrompt: (p) =>
        set((s) => ({
          prompts: s.prompts.some((x) => x.id === p.id)
            ? s.prompts.map((x) => (x.id === p.id ? p : x))
            : [...s.prompts, p],
        })),
      removePrompt: (id) =>
        set((s) => ({ prompts: s.prompts.filter((p) => p.id !== id) })),

      setCustomInstructions: (customInstructions) =>
        set({ customInstructions }),
      setParams: (patch) => set((s) => ({ params: { ...s.params, ...patch } })),

      setAccentColor: (accentColor) => set({ accentColor }),
      setLogoUrl: (logoUrl) => set({ logoUrl }),
      setAppName: (appName) => set({ appName }),

      toggleFavorite: (key) =>
        set((s) => ({
          favorites: s.favorites.includes(key)
            ? s.favorites.filter((k) => k !== key)
            : [...s.favorites, key],
        })),
      setAlias: (key, name) =>
        set((s) => {
          const aliases = { ...s.aliases };
          if (name.trim()) aliases[key] = name.trim();
          else delete aliases[key];
          return { aliases };
        }),

      setChatLayout: (chatLayout) => set({ chatLayout }),
      setChatShowAvatar: (chatShowAvatar) => set({ chatShowAvatar }),
      setChatShowTimestamps: (chatShowTimestamps) => set({ chatShowTimestamps }),
      setChatShowStats: (chatShowStats) => set({ chatShowStats }),
      setAssistantAvatarUrl: (assistantAvatarUrl) => set({ assistantAvatarUrl }),
      setChatBackgroundUrl: (chatBackgroundUrl) => set({ chatBackgroundUrl }),
      setCodeSplitEnabled: (codeSplitEnabled) => set({ codeSplitEnabled }),
      setCodeSplitThreshold: (codeSplitThreshold) =>
        set({ codeSplitThreshold: Math.max(1, codeSplitThreshold || 15) }),
      setCodeSplitWidth: (codeSplitWidth) =>
        set({ codeSplitWidth: Math.round(codeSplitWidth) || 560 }),
      setOllamaKeepAlive: (ollamaKeepAlive) =>
        set({ ollamaKeepAlive: ollamaKeepAlive.trim() || "2m" }),
      setVramManaged: (vramManaged) => set({ vramManaged }),

      upsertSidekick: (sk) =>
        set((s) => {
          // New sidekicks join the active workspace; existing keep their scope.
          const withWs: Sidekick = {
            ...sk,
            workspaceId: sk.workspaceId ?? s.activeWorkspaceId,
          };
          return {
            sidekicks: s.sidekicks.some((x) => x.id === sk.id)
              ? s.sidekicks.map((x) => (x.id === sk.id ? withWs : x))
              : [...s.sidekicks, withWs],
          };
        }),
      removeSidekick: (id) =>
        set((s) => ({ sidekicks: s.sidekicks.filter((x) => x.id !== id) })),

      createWorkspace: (name) => {
        const id = uid();
        set((s) => ({
          workspaces: [
            ...s.workspaces,
            { id, name: name.trim() || "Workspace", createdAt: now() },
          ],
          activeWorkspaceId: id,
        }));
        return id;
      },
      renameWorkspace: (id, name) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) =>
            w.id === id ? { ...w, name: name.trim() || w.name } : w
          ),
        })),
      deleteWorkspace: (id) =>
        set((s) => {
          // The default workspace is permanent; never orphan its contents.
          if (id === DEFAULT_WORKSPACE_ID) return {};
          return {
            workspaces: s.workspaces.filter((w) => w.id !== id),
            // reassign contents to the default workspace instead of deleting them
            chats: s.chats.map((c) =>
              inWorkspace(c, id)
                ? { ...c, workspaceId: DEFAULT_WORKSPACE_ID }
                : c
            ),
            sidekicks: s.sidekicks.map((sk) =>
              inWorkspace(sk, id)
                ? { ...sk, workspaceId: DEFAULT_WORKSPACE_ID }
                : sk
            ),
            activeWorkspaceId:
              s.activeWorkspaceId === id
                ? DEFAULT_WORKSPACE_ID
                : s.activeWorkspaceId,
          };
        }),
      switchWorkspace: (id) =>
        set((s) =>
          s.workspaces.some((w) => w.id === id)
            ? { activeWorkspaceId: id }
            : {}
        ),
      upsertWorkspace: (ws) =>
        set((s) =>
          s.workspaces.some((w) => w.id === ws.id)
            ? {
                workspaces: s.workspaces.map((w) =>
                  w.id === ws.id ? { ...w, name: ws.name } : w
                ),
              }
            : {
                workspaces: [
                  ...s.workspaces,
                  { id: ws.id, name: ws.name, createdAt: now() },
                ],
              }
        ),
      setChatSidekick: (chatId, sidekickId) =>
        set((s) => ({
          chats: s.chats.map((c) =>
            c.id === chatId
              ? { ...c, sidekickId: sidekickId ?? undefined, updatedAt: now() }
              : c
          ),
        })),

      addMemory: (text) =>
        set((s) => {
          const t = text.trim();
          if (!t) return {};
          if (s.memory.some((m) => m.text.toLowerCase() === t.toLowerCase()))
            return {}; // dedupe
          return {
            memory: [
              ...s.memory,
              { id: uid(), text: t, createdAt: now() },
            ],
          };
        }),
      updateMemory: (id, text) =>
        set((s) => ({
          memory: s.memory.map((m) =>
            m.id === id ? { ...m, text: text.trim() } : m
          ),
        })),
      removeMemory: (id) =>
        set((s) => ({ memory: s.memory.filter((m) => m.id !== id) })),
      clearMemory: () => set({ memory: [] }),
      setMemoryEnabled: (memoryEnabled) => set({ memoryEnabled }),

      setTheme: (theme) => set({ theme }),
      setLang: (lang) => set({ lang }),
      setTitlePending: (titlePendingId) => set({ titlePendingId }),
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    }),
    {
      name: "openchatbox-store",
      version: 7,
      // localStorage-backed, but tolerant of quota errors (see safeStorage).
      storage: createJSONStorage(() => safeStorage),
      // Server is now the source of truth for per-user prefs + admin-global
      // config (hydrated on load via lib/serverSync). localStorage only keeps
      // (a) chats — still local for now (Phase 2), and (b) a small no-flash
      // cache of theme/branding read by the pre-hydration script in layout.tsx.
      // Images (base64 data URLs) are stripped: they'd blow the ~5MB quota.
      partialize: (s) => ({
        chats: s.chats
          .filter((c) => !c.temporary)
          .map((c) => ({
            ...c,
            messages: c.messages.map(({ images, docs, pipeline, ...m }) => m),
            files: c.files?.map(({ dataUrl, ...f }) => f),
          })),
        activeChatId: s.activeChatId,
        workspaces: s.workspaces,
        activeWorkspaceId: s.activeWorkspaceId,
        // provider registry: cached locally so the admin's typed apiKeys survive
        // a reload (server public config is key-stripped). Non-admins just cache
        // the global keyless list.
        providers: s.providers,
        // no-flash cache (authoritative copy lives on the server)
        theme: s.theme,
        lang: s.lang,
        accentColor: s.accentColor,
        appName: s.appName,
        logoUrl: s.logoUrl,
      }),
      migrate: (persisted, version) => {
        const s = persisted as Partial<State>;
        if (version < 1 && Array.isArray(s.providers)) {
          s.providers = s.providers.filter(
            (p) =>
              !(
                p.id === "openai-compat" &&
                !p.apiKey &&
                p.baseUrl === "https://api.openai.com/v1"
              )
          );
        }
        if (version < 2) {
          if (!s.prompts) s.prompts = defaultPrompts();
          if (s.customInstructions == null) s.customInstructions = "";
          if (!s.params) s.params = defaultParams();
        }
        if (version < 3) {
          // Introduce workspaces. Existing chats/sidekicks keep workspaceId
          // undefined → resolved to the default workspace by inWorkspace().
          if (!Array.isArray(s.workspaces) || s.workspaces.length === 0)
            s.workspaces = defaultWorkspaces();
          if (!s.activeWorkspaceId) s.activeWorkspaceId = DEFAULT_WORKSPACE_ID;
        }
        if (version < 4) {
          // Auto-router moved from vision/ocr keys to a category map.
          const legacy = s as unknown as { routerVisionKey?: string | null };
          if (!s.routerModels)
            s.routerModels = {
              standard: null,
              coding: null,
              reasoning: null,
              vision: legacy.routerVisionKey ?? null,
              title: null,
              search: null,
            };
        }
        if (version < 5) {
          // Agentic pipeline: add the "standard"/answer model slot.
          if (s.routerModels && (s.routerModels as { standard?: string | null }).standard === undefined)
            s.routerModels = { ...s.routerModels, standard: null };
        }
        if (version < 7) {
          // Default-model assignments: add title (thread naming) + search
          // (web-search query construction) role slots, keeping existing values.
          if (s.routerModels) {
            const rm = s.routerModels as Record<string, string | null>;
            s.routerModels = {
              standard: rm.standard ?? null,
              coding: rm.coding ?? null,
              reasoning: rm.reasoning ?? null,
              vision: rm.vision ?? null,
              title: rm.title ?? null,
              search: rm.search ?? null,
            };
          }
        }
        return s as State;
      },
    }
  )
);

function deriveTitle(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 40 ? t.slice(0, 40) + "…" : t || "Neuer Chat";
}

/**
 * Remove a chat we're navigating away from if it never got used:
 * no messages AND no draft. `leavingId` is the chat being left, `keepId` is
 * never pruned (the target we switch to).
 */
function pruneEmpty(
  chats: Chat[],
  leavingId: string | null,
  keepId?: string
): Chat[] {
  if (!leavingId || leavingId === keepId) return chats;
  return chats.filter((c) => {
    if (c.id !== leavingId) return true;
    // temporary chats are discarded whenever left (unless explicitly kept)
    if (c.temporary) return false;
    const empty = c.messages.length === 0 && !(c.draft && c.draft.trim());
    return !empty;
  });
}
