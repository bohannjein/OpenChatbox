import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  Chat,
  Feedback,
  GenParams,
  Message,
  PromptTemplate,
  Provider,
  Role,
} from "./types";

export type Theme = "light" | "dark";

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const now = () => Date.now();

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
const safeStorage = {
  getItem: (name: string): string | null => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // quota exceeded / private mode — drop persistence rather than crash
      try {
        localStorage.removeItem(name);
      } catch {
        /* ignore */
      }
    }
  },
  removeItem: (name: string): void => {
    try {
      localStorage.removeItem(name);
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
  prompts: PromptTemplate[];
  customInstructions: string;
  params: GenParams;
  /** global incognito switch: new chats are temporary while on. */
  incognito: boolean;
  theme: Theme;
  settingsOpen: boolean;
  sidebarOpen: boolean;

  // chat actions
  newChat: (temporary?: boolean) => string;
  deleteChat: (id: string) => void;
  selectChat: (id: string) => void;
  renameChat: (id: string, title: string) => void;
  clearAllChats: () => void;
  setDraft: (id: string, draft: string) => void;
  setIncognito: (v: boolean) => void;

  addMessage: (
    chatId: string,
    role: Role,
    content: string,
    images?: string[]
  ) => string;
  appendToMessage: (chatId: string, msgId: string, delta: string) => void;
  appendReasoning: (chatId: string, msgId: string, delta: string) => void;
  setMessageContent: (chatId: string, msgId: string, content: string) => void;
  truncateAfter: (chatId: string, msgId: string) => void;
  editUserMessage: (chatId: string, msgId: string, content: string) => void;

  // variants / regenerate
  startRegenerate: (chatId: string, msgId: string) => void;
  finalizeVariant: (chatId: string, msgId: string) => void;
  setActiveVariant: (chatId: string, msgId: string, index: number) => void;
  setFeedback: (chatId: string, msgId: string, fb: Feedback) => void;

  // provider actions
  setProviders: (p: Provider[]) => void;
  upsertProvider: (p: Provider) => void;
  removeProvider: (id: string) => void;
  selectModel: (key: string) => void;

  // prompts
  upsertPrompt: (p: PromptTemplate) => void;
  removePrompt: (id: string) => void;

  // system / params
  setCustomInstructions: (v: string) => void;
  setParams: (patch: Partial<GenParams>) => void;

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
      prompts: defaultPrompts(),
      customInstructions: "",
      params: defaultParams(),
      incognito: false,
      theme: "dark",
      settingsOpen: false,
      sidebarOpen: true,

      newChat: (temporary) => {
        const temp = temporary ?? get().incognito;
        const chat: Chat = {
          id: uid(),
          title: temp ? "Temporärer Chat" : "Neuer Chat",
          messages: [],
          modelKey: get().selectedModelKey ?? undefined,
          temporary: temp,
          createdAt: now(),
          updatedAt: now(),
        };
        set((s) => ({
          // prune the chat we're leaving if it was empty & draftless
          chats: [chat, ...pruneEmpty(s.chats, s.activeChatId)],
          activeChatId: chat.id,
        }));
        return chat.id;
      },

      deleteChat: (id) =>
        set((s) => {
          const chats = s.chats.filter((c) => c.id !== id);
          const activeChatId =
            s.activeChatId === id
              ? chats.find((c) => !c.temporary)?.id ?? chats[0]?.id ?? null
              : s.activeChatId;
          return { chats, activeChatId };
        }),

      selectChat: (id) =>
        set((s) => {
          if (id === s.activeChatId) return {};
          // leaving current chat: drop it if empty & draftless (auto-cleanup)
          const chats = pruneEmpty(s.chats, s.activeChatId, id);
          return { chats, activeChatId: id };
        }),

      setDraft: (id, draft) =>
        set((s) => ({
          chats: s.chats.map((c) => (c.id === id ? { ...c, draft } : c)),
        })),

      setIncognito: (incognito) => set({ incognito }),

      renameChat: (id, title) =>
        set((s) => ({
          chats: s.chats.map((c) =>
            c.id === id ? { ...c, title, updatedAt: now() } : c
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

      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    }),
    {
      name: "chatbot-ui-store",
      version: 2,
      // localStorage-backed, but tolerant of quota errors (see safeStorage).
      storage: createJSONStorage(() => safeStorage),
      // persist everything except transient UI flags + temporary chats.
      // Images (base64 data URLs) are stripped: they'd blow the ~5MB quota.
      partialize: (s) => ({
        chats: s.chats
          .filter((c) => !c.temporary)
          .map((c) => ({
            ...c,
            messages: c.messages.map(({ images, ...m }) => m),
          })),
        activeChatId: s.activeChatId,
        providers: s.providers,
        selectedModelKey: s.selectedModelKey,
        prompts: s.prompts,
        customInstructions: s.customInstructions,
        params: s.params,
        theme: s.theme,
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
    const empty = c.messages.length === 0 && !(c.draft && c.draft.trim());
    return !empty;
  });
}
