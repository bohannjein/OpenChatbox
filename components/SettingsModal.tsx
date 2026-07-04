"use client";

import { useState } from "react";
import clsx from "clsx";
import {
  X,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Plus,
  User,
  MessageSquare,
  Brain,
  Blocks,
  SlidersHorizontal,
  Server,
  ListChecks,
  Globe,
  Sun,
  Moon,
  type LucideIcon,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { fetchModels } from "@/lib/providers";
import { PRESETS } from "@/lib/presets";
import { DEFAULT_ACCENT, normalizeHex } from "@/lib/branding";
import { resizeImageToDataUrl } from "@/lib/imageResize";
import { uid } from "@/lib/uid";
import AdminPanel from "./AdminPanel";
import PluginsPanel from "./PluginsPanel";
import UserManagement from "./UserManagement";
import SidekickManager from "./SidekickManager";
import MemoryManager from "./MemoryManager";
import AccountPanel from "./AccountPanel";
import DefaultModelsPanel from "./DefaultModelsPanel";
import type { Provider, ProviderType } from "@/lib/types";

type TestState = { status: "idle" | "loading" | "ok" | "err"; msg?: string };
type TabId =
  | "account"
  | "general"
  | "providers"
  | "defaults"
  | "search"
  | "chat"
  | "ai"
  | "plugins";

const TABS: { id: TabId; label: string; Icon: LucideIcon; adminOnly?: boolean }[] =
  [
    { id: "account", label: "Mein Konto", Icon: User },
    { id: "general", label: "Allgemein", Icon: SlidersHorizontal },
    { id: "providers", label: "Modellanbieter & Modelle", Icon: Server, adminOnly: true },
    { id: "defaults", label: "Standardmodelle", Icon: ListChecks, adminOnly: true },
    { id: "search", label: "Internetsuche", Icon: Globe },
    { id: "chat", label: "Chateinstellungen", Icon: MessageSquare },
    { id: "ai", label: "KI-Personalisierung", Icon: Brain },
    { id: "plugins", label: "System-Dienste/Plugins", Icon: Blocks, adminOnly: true },
  ];

/** Section wrapper — consistent divider + spacing; first section has no border. */
function Section({ children }: { children: React.ReactNode }) {
  return (
    <section className="border-t border-border-light pt-6 first:border-0 first:pt-0 dark:border-border-dark">
      {children}
    </section>
  );
}

export default function SettingsModal() {
  const open = useStore((s) => s.settingsOpen);
  const setOpen = useStore((s) => s.setSettingsOpen);
  const providers = useStore((s) => s.providers);
  const upsertProvider = useStore((s) => s.upsertProvider);
  const removeProvider = useStore((s) => s.removeProvider);
  const clearAllChats = useStore((s) => s.clearAllChats);
  const customInstructions = useStore((s) => s.customInstructions);
  const setCustomInstructions = useStore((s) => s.setCustomInstructions);
  const prompts = useStore((s) => s.prompts);
  const upsertPrompt = useStore((s) => s.upsertPrompt);
  const removePrompt = useStore((s) => s.removePrompt);
  const accentColor = useStore((s) => s.accentColor);
  const setAccentColor = useStore((s) => s.setAccentColor);
  const logoUrl = useStore((s) => s.logoUrl);
  const setLogoUrl = useStore((s) => s.setLogoUrl);
  const appName = useStore((s) => s.appName);
  const setAppName = useStore((s) => s.setAppName);
  const codeSplitEnabled = useStore((s) => s.codeSplitEnabled);
  const setCodeSplitEnabled = useStore((s) => s.setCodeSplitEnabled);
  const codeSplitThreshold = useStore((s) => s.codeSplitThreshold);
  const setCodeSplitThreshold = useStore((s) => s.setCodeSplitThreshold);
  const ollamaKeepAlive = useStore((s) => s.ollamaKeepAlive);
  const setOllamaKeepAlive = useStore((s) => s.setOllamaKeepAlive);
  const vramManaged = useStore((s) => s.vramManaged);
  const setVramManaged = useStore((s) => s.setVramManaged);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  const webSearchEnabled = useStore((s) => s.webSearchEnabled);
  const toggleWebSearch = useStore((s) => s.toggleWebSearch);
  const chatLayout = useStore((s) => s.chatLayout);
  const setChatLayout = useStore((s) => s.setChatLayout);
  const chatShowAvatar = useStore((s) => s.chatShowAvatar);
  const setChatShowAvatar = useStore((s) => s.setChatShowAvatar);
  const chatShowTimestamps = useStore((s) => s.chatShowTimestamps);
  const setChatShowTimestamps = useStore((s) => s.setChatShowTimestamps);
  const chatShowStats = useStore((s) => s.chatShowStats);
  const setChatShowStats = useStore((s) => s.setChatShowStats);
  const assistantAvatarUrl = useStore((s) => s.assistantAvatarUrl);
  const setAssistantAvatarUrl = useStore((s) => s.setAssistantAvatarUrl);
  const chatBackgroundUrl = useStore((s) => s.chatBackgroundUrl);
  const setChatBackgroundUrl = useStore((s) => s.setChatBackgroundUrl);
  const authUser = useStore((s) => s.authUser);

  // Pick + resize an image file → data URL, into the given setter.
  const pickImage = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (v: string) => void,
    maxDim: number
  ) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      setter(await resizeImageToDataUrl(f, maxDim, 0.72));
    } catch {
      /* ignore bad image */
    }
  };

  const [tests, setTests] = useState<Record<string, TestState>>({});
  const [tab, setTab] = useState<TabId>("account");

  if (!open) return null;

  const isAdmin = authUser?.role === "admin";
  const visibleTabs = TABS.filter((t) => !t.adminOnly || isAdmin);
  const activeTab = visibleTabs.some((t) => t.id === tab) ? tab : "account";

  const update = (p: Provider, patch: Partial<Provider>) =>
    upsertProvider({ ...p, ...patch });

  const addFromPreset = (idx: number) => {
    const preset = PRESETS[idx];
    if (!preset) return;
    upsertProvider({
      id: uid(),
      name: preset.name,
      type: preset.type,
      baseUrl: preset.baseUrl,
      apiKey: "",
      enabled: true,
      manualModels: preset.suggested ? [...preset.suggested] : undefined,
    });
  };

  const test = async (p: Provider) => {
    setTests((t) => ({ ...t, [p.id]: { status: "loading" } }));
    try {
      const models = await fetchModels(p);
      setTests((t) => ({
        ...t,
        [p.id]: { status: "ok", msg: `${models.length} Modelle` },
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTests((t) => ({ ...t, [p.id]: { status: "err", msg } }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[85vh] max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border-light bg-white shadow-2xl dark:border-border-dark dark:bg-sidebar-dark">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-light px-5 py-3 dark:border-border-dark">
          <h2 className="text-lg font-semibold">Einstellungen</h2>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Tab sidebar */}
          <nav className="w-52 shrink-0 space-y-0.5 overflow-y-auto border-r border-border-light p-2 dark:border-border-dark">
            {visibleTabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={clsx(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition",
                  activeTab === id
                    ? "bg-neutral-200 font-medium dark:bg-white/10"
                    : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-white/5"
                )}
              >
                <Icon size={16} className="shrink-0" />
                {label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="min-w-0 flex-1 space-y-6 overflow-y-auto p-5">
            {activeTab === "account" && (
              <Section>
                <AccountPanel />
              </Section>
            )}

            {activeTab === "chat" && (
              <>
                <Section>
                  <h3 className="font-medium">Chat-Darstellung</h3>
                  <p className="mb-3 text-sm text-neutral-500">
                    Layout und Personalisierung des Chatverlaufs.
                  </p>

                  {/* Layout */}
                  <label className="mb-1 block text-xs text-neutral-500">Layout</label>
                  <div className="mb-4 flex gap-2">
                    {(
                      [
                        ["classic", "Klassisch", "Flaches Design"],
                        ["bubble", "Bubble-Layout", "Sprechblasen (KI links, du rechts)"],
                      ] as const
                    ).map(([val, label, hint]) => (
                      <button
                        key={val}
                        onClick={() => setChatLayout(val)}
                        className={clsx(
                          "flex-1 rounded-xl border px-3 py-2 text-left text-sm transition",
                          chatLayout === val
                            ? "border-accent bg-accent/10"
                            : "border-border-light hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
                        )}
                      >
                        <div className="font-medium">{label}</div>
                        <div className="text-xs text-neutral-400">{hint}</div>
                      </button>
                    ))}
                  </div>

                  {/* Toggles */}
                  <div className="mb-4 space-y-2">
                    {(
                      [
                        ["avatar", "Avatar neben Nachrichten", chatShowAvatar, setChatShowAvatar],
                        ["ts", "Zeitstempel anzeigen", chatShowTimestamps, setChatShowTimestamps],
                        ["stats", "Statistiken (Wörter & ~Tokens)", chatShowStats, setChatShowStats],
                      ] as const
                    ).map(([id, label, val, setter]) => (
                      <label
                        key={id}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={val}
                          onChange={(e) => setter(e.target.checked)}
                          className="h-4 w-4 accent-[rgb(var(--accent))]"
                        />
                        {label}
                      </label>
                    ))}
                  </div>

                  {/* Image uploads */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-neutral-500">
                        Assistenten-Profilbild
                      </label>
                      <div className="flex items-center gap-3">
                        {assistantAvatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={assistantAvatarUrl}
                            alt="Avatar"
                            className="h-12 w-12 rounded-full object-cover ring-1 ring-border-light dark:ring-border-dark"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
                            <Brain size={20} />
                          </div>
                        )}
                        <label className="cursor-pointer rounded-lg border border-border-light px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5">
                          Bild wählen
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => pickImage(e, setAssistantAvatarUrl, 256)}
                          />
                        </label>
                        {assistantAvatarUrl && (
                          <button
                            onClick={() => setAssistantAvatarUrl("")}
                            className="rounded-lg p-2 text-neutral-400 hover:text-red-500"
                            title="Entfernen"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-neutral-500">
                        Chathintergrund
                      </label>
                      <div className="flex items-center gap-3">
                        {chatBackgroundUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={chatBackgroundUrl}
                            alt="Hintergrund"
                            className="h-12 w-20 rounded-lg object-cover ring-1 ring-border-light dark:ring-border-dark"
                          />
                        ) : (
                          <div className="h-12 w-20 rounded-lg bg-neutral-100 ring-1 ring-border-light dark:bg-white/5 dark:ring-border-dark" />
                        )}
                        <label className="cursor-pointer rounded-lg border border-border-light px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5">
                          Bild wählen
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => pickImage(e, setChatBackgroundUrl, 1600)}
                          />
                        </label>
                        {chatBackgroundUrl && (
                          <button
                            onClick={() => setChatBackgroundUrl("")}
                            className="rounded-lg p-2 text-neutral-400 hover:text-red-500"
                            title="Entfernen"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </Section>

                <Section>
                  <h3 className="font-medium">Benutzerdefinierte Anweisungen</h3>
                  <p className="mb-2 text-sm text-neutral-500">
                    Dauerhafte Rolle/Regeln für das Modell — wird jeder
                    Unterhaltung als System-Prompt vorangestellt.
                  </p>
                  <textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    rows={3}
                    placeholder="z. B. Antworte immer auf Deutsch und fasse dich kurz."
                    className="input-base w-full resize-y px-3 py-2"
                  />
                </Section>

                <Section>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">Prompt-Bibliothek</h3>
                      <p className="text-sm text-neutral-500">
                        Firmen-Vorlagen — im Chat per „/" aufrufbar.
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        upsertPrompt({
                          id: uid(),
                          title: "Neue Vorlage",
                          shortcut: "",
                          content: "",
                        })
                      }
                      className="flex shrink-0 items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover"
                    >
                      <Plus size={15} /> Hinzufügen
                    </button>
                  </div>
                  <div className="space-y-3">
                    {prompts.map((p) => (
                      <div
                        key={p.id}
                        className="rounded-xl border border-border-light p-3 dark:border-border-dark"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            value={p.title}
                            onChange={(e) =>
                              upsertPrompt({ ...p, title: e.target.value })
                            }
                            placeholder="Titel"
                            className="min-w-0 flex-1 input-base"
                          />
                          <input
                            value={p.shortcut ?? ""}
                            onChange={(e) =>
                              upsertPrompt({ ...p, shortcut: e.target.value })
                            }
                            placeholder="/kürzel"
                            className="w-28 input-base font-mono"
                          />
                          <button
                            onClick={() => removePrompt(p.id)}
                            className="rounded-lg p-2 text-neutral-400 hover:text-red-500"
                            title="Vorlage entfernen"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <textarea
                          value={p.content}
                          onChange={(e) =>
                            upsertPrompt({ ...p, content: e.target.value })
                          }
                          rows={2}
                          placeholder="Prompt-Text…"
                          className="mt-2 w-full resize-y input-base"
                        />
                      </div>
                    ))}
                  </div>
                </Section>

                <Section>
                  <h3 className="font-medium">Code-Splitscreen</h3>
                  <p className="mb-2 text-sm text-neutral-500">
                    Lange Codeblöcke öffnen sich automatisch in einem Panel
                    rechts.
                  </p>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={codeSplitEnabled}
                      onChange={(e) => setCodeSplitEnabled(e.target.checked)}
                      className="h-4 w-4 accent-[rgb(var(--accent))]"
                    />
                    Aktiviert
                  </label>
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="text-neutral-500">Ab</span>
                    <input
                      type="number"
                      min={1}
                      value={codeSplitThreshold}
                      onChange={(e) =>
                        setCodeSplitThreshold(Number(e.target.value))
                      }
                      className="w-20 input-base"
                    />
                    <span className="text-neutral-500">Zeilen</span>
                  </div>
                </Section>

                <Section>
                  <h3 className="font-medium text-red-600 dark:text-red-400">
                    Verlauf löschen
                  </h3>
                  <p className="mb-2 text-sm text-neutral-500">
                    Entfernt alle Chats aus dem LocalStorage. Nicht umkehrbar.
                  </p>
                  <button
                    onClick={() => {
                      if (confirm("Wirklich alle Chats löschen?"))
                        clearAllChats();
                    }}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    Alle Chats löschen
                  </button>
                </Section>
              </>
            )}

            {activeTab === "ai" && (
              <>
                <Section>
                  <SidekickManager />
                </Section>
                <Section>
                  <MemoryManager />
                </Section>
              </>
            )}

            {activeTab === "general" && (
              <>
                {/* Appearance — theme + language (all users) */}
                <Section>
                  <h3 className="font-medium">Darstellung</h3>
                  <p className="mb-2 text-sm text-neutral-500">
                    Design und Sprache der Oberfläche.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setTheme("light")}
                      className={clsx(
                        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition",
                        theme === "light"
                          ? "border-accent bg-accent/15 text-accent"
                          : "border-border-light hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
                      )}
                    >
                      <Sun size={15} /> Hell
                    </button>
                    <button
                      onClick={() => setTheme("dark")}
                      className={clsx(
                        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition",
                        theme === "dark"
                          ? "border-accent bg-accent/15 text-accent"
                          : "border-border-light hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
                      )}
                    >
                      <Moon size={15} /> Dunkel
                    </button>
                    <span className="mx-1 text-neutral-300 dark:text-neutral-600">|</span>
                    <select
                      value={lang ?? "de"}
                      onChange={(e) => setLang(e.target.value as "de" | "en")}
                      className="input-base py-1.5 text-sm dark:bg-sidebar-dark"
                    >
                      <option value="de">Deutsch</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                </Section>

                {isAdmin && (
                  <>
                {/* User management */}
                <Section>
                  <UserManagement />
                </Section>

                {/* Branding */}
                <Section>
                  <h3 className="font-medium">Branding</h3>
                  <p className="mb-3 text-sm text-neutral-500">
                    Akzentfarbe, Firmenlogo und App-Name für die gesamte
                    Oberfläche.
                  </p>
                  <label className="mb-1 block text-xs text-neutral-500">
                    Akzentfarbe
                  </label>
                  <div className="mb-4 flex items-center gap-3">
                    <input
                      type="color"
                      value={normalizeHex(accentColor)}
                      onChange={(e) => setAccentColor(e.target.value)}
                      title="Akzentfarbe wählen"
                      className="h-9 w-12 cursor-pointer rounded-lg border border-border-light bg-transparent dark:border-border-dark"
                    />
                    <input
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      placeholder={DEFAULT_ACCENT}
                      className="w-28 input-base font-mono"
                    />
                    <button
                      onClick={() => setAccentColor(DEFAULT_ACCENT)}
                      className="rounded-lg border border-border-light px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
                    >
                      Zurücksetzen (Türkis)
                    </button>
                    <span
                      className="ml-auto h-6 w-6 rounded-full ring-1 ring-black/10"
                      style={{ backgroundColor: normalizeHex(accentColor) }}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-neutral-500">
                        App-Name (Platzhalter, wenn kein Logo)
                      </label>
                      <input
                        value={appName}
                        onChange={(e) => setAppName(e.target.value)}
                        placeholder="OpenChatbox"
                        className="w-full input-base"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-neutral-500">
                        Logo-Bild-URL (optional)
                      </label>
                      <input
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="https://…/logo.png"
                        className="w-full input-base font-mono"
                      />
                    </div>
                  </div>
                </Section>

                  </>
                )}
              </>
            )}

            {activeTab === "providers" && isAdmin && (
              <>
                {/* Providers */}
                <Section>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">Provider & API-Endpunkte</h3>
                      <p className="text-sm text-neutral-500">
                        Ollama (lokal) oder OpenAI-kompatible APIs (Hugging Face
                        TGI, vLLM, OpenAI…).
                      </p>
                    </div>
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value !== "")
                          addFromPreset(Number(e.target.value));
                        e.target.value = "";
                      }}
                      className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover"
                      title="Anbieter aus Vorlage hinzufügen"
                    >
                      <option value="">+ Anbieter hinzufügen</option>
                      {PRESETS.map((p, i) => (
                        <option key={p.name} value={i} className="text-black">
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-3">
                    {providers.map((p) => {
                      const t = tests[p.id] ?? { status: "idle" };
                      return (
                        <div
                          key={p.id}
                          className="rounded-xl border border-border-light p-3 dark:border-border-dark"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={p.enabled}
                              onChange={(e) =>
                                update(p, { enabled: e.target.checked })
                              }
                              className="h-4 w-4 accent-[rgb(var(--accent))]"
                            />
                            <input
                              value={p.name}
                              onChange={(e) =>
                                update(p, { name: e.target.value })
                              }
                              placeholder="Anzeigename"
                              className="min-w-0 flex-1 input-base"
                            />
                            <select
                              value={p.type}
                              onChange={(e) =>
                                update(p, {
                                  type: e.target.value as ProviderType,
                                })
                              }
                              className="input-base dark:bg-sidebar-dark"
                            >
                              <option value="ollama">Ollama</option>
                              <option value="openai">OpenAI-kompatibel</option>
                              <option value="anthropic">Anthropic</option>
                            </select>
                            <button
                              onClick={() => removeProvider(p.id)}
                              className="rounded-lg p-2 text-neutral-400 hover:text-red-500"
                              title="Provider entfernen"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div className="mt-2 grid gap-2">
                            <div>
                              <label className="text-xs text-neutral-500">
                                Base-URL
                              </label>
                              <input
                                value={p.baseUrl}
                                onChange={(e) =>
                                  update(p, { baseUrl: e.target.value })
                                }
                                placeholder={
                                  p.type === "ollama"
                                    ? "http://localhost:11434"
                                    : "https://api.openai.com/v1"
                                }
                                className="w-full input-base font-mono"
                              />
                            </div>
                            {p.type !== "ollama" && (
                              <div>
                                <label className="text-xs text-neutral-500">
                                  API-Key
                                </label>
                                <input
                                  type="password"
                                  value={p.apiKey ?? ""}
                                  onChange={(e) =>
                                    update(p, { apiKey: e.target.value })
                                  }
                                  placeholder="sk-… / API-Key des Anbieters"
                                  className="w-full input-base font-mono"
                                />
                              </div>
                            )}
                            <div>
                              <label className="text-xs text-neutral-500">
                                Modelle manuell (optional, Komma-getrennt)
                              </label>
                              <input
                                value={(p.manualModels ?? []).join(", ")}
                                onChange={(e) =>
                                  update(p, {
                                    manualModels: e.target.value
                                      .split(",")
                                      .map((s) => s.trim())
                                      .filter(Boolean),
                                  })
                                }
                                placeholder="z. B. gpt-4o, claude-sonnet-4-5, sonar-pro"
                                className="w-full input-base font-mono"
                              />
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-3">
                            <button
                              onClick={() => test(p)}
                              className="rounded-lg border border-border-light px-3 py-1 text-sm transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
                            >
                              Verbindung testen
                            </button>
                            {t.status === "loading" && (
                              <span className="flex items-center gap-1 text-sm text-neutral-500">
                                <Loader2 size={14} className="animate-spin" />{" "}
                                teste…
                              </span>
                            )}
                            {t.status === "ok" && (
                              <span className="flex items-center gap-1 text-sm text-accent">
                                <CheckCircle2 size={14} /> {t.msg}
                              </span>
                            )}
                            {t.status === "err" && (
                              <span
                                className="flex items-center gap-1 truncate text-sm text-red-500"
                                title={t.msg}
                              >
                                <XCircle size={14} /> {t.msg}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Section>

                {/* Performance / VRAM */}
                <Section>
                  <h3 className="font-medium">Performance & VRAM</h3>
                  <p className="mb-2 text-sm text-neutral-500">
                    Steuert, wie schnell Ollama Modelle aus dem VRAM entlädt
                    (GPU im Multi-User-Betrieb teilen). Alleinnutzung? Einfach
                    aus lassen.
                  </p>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={vramManaged}
                      onChange={(e) => setVramManaged(e.target.checked)}
                      className="h-4 w-4 accent-[rgb(var(--accent))]"
                    />
                    VRAM-Management aktiv
                  </label>
                  {vramManaged && (
                    <>
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <span className="text-neutral-500">
                          Modell entladen nach (keep_alive)
                        </span>
                        <input
                          value={ollamaKeepAlive}
                          onChange={(e) => setOllamaKeepAlive(e.target.value)}
                          placeholder="2m"
                          className="w-24 input-base font-mono"
                        />
                      </div>
                      <p className="mt-1 text-xs text-neutral-400">
                        Werte: <code>2m</code>, <code>30s</code>, <code>0</code>{" "}
                        (sofort), <code>-1</code> (dauerhaft).
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {[
                          { v: "2m", l: "2m" },
                          { v: "30m", l: "30m" },
                          { v: "-1", l: "Dauerhaft (RAM-Cache)" },
                        ].map((p) => (
                          <button
                            key={p.v}
                            onClick={() => setOllamaKeepAlive(p.v)}
                            className={
                              "rounded-md border px-2 py-1 text-xs transition " +
                              (ollamaKeepAlive === p.v
                                ? "border-accent bg-accent/15 text-accent"
                                : "border-border-light hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5")
                            }
                          >
                            {p.l}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <p className="mt-2 text-xs text-neutral-400">
                    Aus = Ollama-Default (Modell bleibt geladen). Max. Tokens
                    (num_predict) pro Chat über die Parameter. Server-seitig
                    optional: <code>OLLAMA_NUM_PARALLEL=1</code>,{" "}
                    <code>OLLAMA_MAX_LOADED_MODELS=1</code>.
                  </p>
                </Section>

                {/* Ollama pull + model aliases/favorites */}
                <Section>
                  <AdminPanel />
                </Section>
              </>
            )}

            {activeTab === "defaults" && isAdmin && (
              <Section>
                <DefaultModelsPanel />
              </Section>
            )}

            {activeTab === "search" && (
              <Section>
                <h3 className="font-medium">Internetsuche</h3>
                <p className="mb-2 text-sm text-neutral-500">
                  Erlaubt dem Modell, für aktuelle Fragen das Web zu durchsuchen.
                  Die Suchanfrage formuliert das Modell „Suchbegriff-Konstruktion"
                  (siehe Standardmodelle).
                </p>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={webSearchEnabled}
                    onChange={() => toggleWebSearch()}
                    className="h-4 w-4 accent-[rgb(var(--accent))]"
                  />
                  Internetsuche aktivieren
                </label>
              </Section>
            )}

            {activeTab === "plugins" && isAdmin && (
              <Section>
                <PluginsPanel />
              </Section>
            )}
          </div>
        </div>

        <div className="border-t border-border-light px-5 py-3 text-right dark:border-border-dark">
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
}
