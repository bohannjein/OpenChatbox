"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  X,
  Trash2,
  Plus,
  User,
  Palette,
  MessageSquare,
  Bot,
  Brain,
  Blocks,
  Server,
  Globe,
  Library,
  Database,
  Users,
  KeyRound,
  Image as ImageIcon,
  Paintbrush,
  Gauge,
  Sun,
  Moon,
  Wand2,
  Info,
  type LucideIcon,
} from "lucide-react";
import { useStore, useBrand } from "@/lib/store";
import { hasUnseenWhatsNew } from "@/lib/version";
import { resizeImageToDataUrl } from "@/lib/imageResize";
import { uid } from "@/lib/uid";
import { Section, SectionTitle } from "./Section";
import BrandingPanel from "./BrandingPanel";
import AssistantsPanel from "./AssistantsPanel";
import AdminPanel from "./AdminPanel";
import PluginsPanel from "./PluginsPanel";
import UserManagement from "./UserManagement";
import SidekickManager from "./SidekickManager";
import MemoryManager from "./MemoryManager";
import AccountPanel from "./AccountPanel";
import DefaultModelsPanel from "./DefaultModelsPanel";
import SearchProvidersPanel from "./SearchProvidersPanel";
import KnowledgeBasePanel from "./KnowledgeBasePanel";
import ImageGenPanel from "./ImageGenPanel";
import ProvidersPanel from "./ProvidersPanel";
import AboutPanel from "./AboutPanel";
import AuthAccessPanel from "./AuthAccessPanel";
import SsoConfigPanel from "./SsoConfigPanel";
import SmtpConfigPanel from "./SmtpConfigPanel";
import InfoTip from "./InfoTip";
import Modal from "./Modal";

type TabId =
  | "account"
  | "appearance"
  | "chat"
  | "assistant"
  | "websearch"
  | "knowledge"
  | "data"
  | "admin-users"
  | "admin-login"
  | "admin-models"
  | "admin-imagegen"
  | "admin-integrations"
  | "admin-assistants"
  | "admin-branding"
  | "admin-performance"
  | "about";

type Tab = { id: TabId; label: string; Icon: LucideIcon; desc: string };

/**
 * Grouped like a phone's settings app: identity first, then personalization,
 * then features, admin bundled into one block, "about" last. `adminOnly` sits
 * on the group so the whole heading disappears for non-admins.
 */
const GROUPS: { title: string; adminOnly?: boolean; tabs: Tab[] }[] = [
  {
    title: "Konto",
    tabs: [
      {
        id: "account",
        label: "Mein Konto",
        Icon: User,
        desc: "Profil, Passwort und Zwei-Faktor-Authentifizierung.",
      },
    ],
  },
  {
    title: "Personalisierung",
    tabs: [
      {
        id: "appearance",
        label: "Darstellung",
        Icon: Palette,
        desc: "Design und Sprache der Oberfläche.",
      },
      {
        id: "chat",
        label: "Chat",
        Icon: MessageSquare,
        desc: "Layout und Personalisierung des Chatverlaufs.",
      },
      {
        id: "assistant",
        label: "Assistent",
        Icon: Bot,
        desc: "Wie sich das Modell verhält — Anweisungen, Vorlagen, Sidekicks, Gedächtnis.",
      },
    ],
  },
  {
    title: "Funktionen",
    tabs: [
      {
        id: "websearch",
        label: "Websuche",
        Icon: Globe,
        desc: "Aktuelle Informationen aus dem Web als Kontext für Antworten.",
      },
      {
        id: "knowledge",
        label: "Wissen",
        Icon: Library,
        desc: "Eigene Dokumente als durchsuchbare Wissensdatenbank.",
      },
      {
        id: "data",
        label: "Daten & Verlauf",
        Icon: Database,
        desc: "Gespeicherte Unterhaltungen verwalten und löschen.",
      },
    ],
  },
  {
    title: "Administration",
    adminOnly: true,
    tabs: [
      {
        id: "admin-users",
        label: "Benutzer & Zugriff",
        Icon: Users,
        desc: "Konten, Rollen und wer sich überhaupt anmelden darf.",
      },
      {
        id: "admin-login",
        label: "Anmeldung & E-Mail",
        Icon: KeyRound,
        desc: "Single Sign-On und ausgehender E-Mail-Versand.",
      },
      {
        id: "admin-models",
        label: "Modelle",
        Icon: Server,
        desc: "Anbieter, verfügbare Modelle und Standardzuordnungen.",
      },
      {
        id: "admin-imagegen",
        label: "Bildgenerierung",
        Icon: ImageIcon,
        desc: "Backend für die Bilderzeugung im Chat.",
      },
      {
        id: "admin-integrations",
        label: "Integrationen",
        Icon: Blocks,
        desc: "Externe Dienste und serverseitige Hintergrund-Dienste.",
      },
      {
        id: "admin-assistants",
        label: "Assistenten & API",
        Icon: Bot,
        desc: "Die KI auf anderen Seiten einbetten — festes Modell, freigegebenes Wissen, Schlüssel.",
      },
      {
        id: "admin-branding",
        label: "Marke",
        Icon: Paintbrush,
        desc: "Name, Logo, Farbe, Rechtliches und öffentliche Adresse dieser Instanz.",
      },
      {
        id: "admin-performance",
        label: "Leistung",
        Icon: Gauge,
        desc: "Wie die GPU zwischen mehreren Nutzern geteilt wird.",
      },
    ],
  },
  {
    title: "System",
    tabs: [
      {
        // {app} is substituted with the configured instance name at render time.
        id: "about",
        label: "Über {app}",
        Icon: Info,
        desc: "Version und Änderungsverlauf.",
      },
    ],
  },
];

/** Tab ids from before the settings regroup — persisted state may still hold one. */
const LEGACY_TABS: Record<string, TabId> = {
  general: "appearance",
  providers: "admin-models",
  defaults: "admin-models",
  search: "websearch",
  ai: "assistant",
  plugins: "admin-integrations",
  info: "about",
};

export default function SettingsModal() {
  const open = useStore((s) => s.settingsOpen);
  const setOpen = useStore((s) => s.setSettingsOpen);
  const requestedTab = useStore((s) => s.settingsTab);
  const setRequestedTab = useStore((s) => s.setSettingsTab);
  const clearAllChats = useStore((s) => s.clearAllChats);
  const customInstructions = useStore((s) => s.customInstructions);
  const setCustomInstructions = useStore((s) => s.setCustomInstructions);
  const prompts = useStore((s) => s.prompts);
  const upsertPrompt = useStore((s) => s.upsertPrompt);
  const removePrompt = useStore((s) => s.removePrompt);
  const brand = useBrand();
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
  const draculaUnlocked = useStore((s) => s.draculaUnlocked);
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
  const whatsNewSeen = useStore((s) => s.whatsNewSeen);
  const showWhatsNewDot = hasUnseenWhatsNew(whatsNewSeen);

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

  /** Fill the {app} placeholder in a tab label with the configured brand name. */
  const brandLabel = (l: string) => l.replace("{app}", brand.appName);

  const [tab, setTab] = useState<TabId>("account");
  const [confirmClear, setConfirmClear] = useState(false);

  // Honor a one-shot tab request (e.g. footer → "Mein Konto"), mapping any
  // pre-regroup id onto its replacement.
  useEffect(() => {
    if (open && requestedTab) {
      setTab((LEGACY_TABS[requestedTab] ?? requestedTab) as TabId);
      setRequestedTab(null);
    }
  }, [open, requestedTab, setRequestedTab]);

  if (!open) return null;

  const isAdmin = authUser?.role === "admin";
  const visibleGroups = GROUPS.filter((g) => !g.adminOnly || isAdmin);
  const visibleTabs = visibleGroups.flatMap((g) => g.tabs);
  const active =
    visibleTabs.find((t) => t.id === tab) ?? visibleTabs[0];
  const activeTab = active.id;

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/50 p-4">
      <div className="flex h-[85vh] max-h-[85vh] w-full max-w-3xl origin-center animate-modal-in flex-col overflow-hidden rounded-2xl border border-border-light bg-white shadow-2xl dark:border-border-dark dark:bg-sidebar-dark">
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
          {/* Grouped tab sidebar */}
          <nav className="w-52 shrink-0 overflow-y-auto border-r border-border-light p-2 dark:border-border-dark">
            {visibleGroups.map((group) => (
              <div key={group.title} className="space-y-0.5">
                <div className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 first:pt-1 dark:text-neutral-500">
                  {group.title}
                </div>
                {group.tabs.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={clsx(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150 ease-out",
                      activeTab === id
                        ? "bg-neutral-200 font-medium dark:bg-white/10"
                        : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-white/5"
                    )}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{brandLabel(label)}</span>
                    {id === "about" && showWhatsNewDot && (
                      <span
                        aria-label="Neue Updates"
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                      />
                    )}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          {/* Content */}
          <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden break-words p-5">
            {/* Page title — replaces the per-panel heading */}
            <div className="mb-5">
              <div className="flex items-center gap-2">
                <active.Icon size={18} className="shrink-0 text-accent" />
                <h3 className="text-base font-semibold">{brandLabel(active.label)}</h3>
              </div>
              <p className="mt-0.5 text-sm text-neutral-500">{active.desc}</p>
            </div>

            <div className="space-y-6">
              {activeTab === "account" && (
                <Section>
                  <AccountPanel />
                </Section>
              )}

              {activeTab === "appearance" && (
                <>
                  <Section>
                    <SectionTitle
                      title="Design"
                      hint="Farbschema der gesamten Oberfläche."
                    />
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
                      {draculaUnlocked && (
                        <button
                          onClick={() => setTheme("dracula")}
                          className={clsx(
                            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition",
                            theme === "dracula"
                              ? "border-[#bd93f9] bg-[#bd93f9]/15 text-[#bd93f9]"
                              : "border-border-light hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
                          )}
                        >
                          <Wand2 size={15} /> Dracula
                        </button>
                      )}
                    </div>
                  </Section>

                  <Section>
                    <SectionTitle
                      title="Sprache"
                      hint="Sprache der Bedienoberfläche."
                    />
                    <select
                      value={lang ?? "de"}
                      onChange={(e) => setLang(e.target.value as "de" | "en")}
                      className="input-base py-1.5 text-sm dark:bg-sidebar-dark"
                    >
                      <option value="de">Deutsch</option>
                      <option value="en">English</option>
                    </select>
                  </Section>
                </>
              )}

              {activeTab === "chat" && (
                <>
                  <Section>
                    <SectionTitle
                      title="Layout"
                      hint="Grundform des Chatverlaufs."
                    />
                    <div className="flex gap-2">
                      {(
                        [
                          ["classic", "Klassisch", "Flaches Design"],
                          [
                            "bubble",
                            "Bubble-Layout",
                            "Sprechblasen (KI links, du rechts)",
                          ],
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
                  </Section>

                  <Section>
                    <SectionTitle
                      title="Anzeige"
                      hint="Was neben jeder Nachricht eingeblendet wird."
                    />
                    <div className="space-y-2">
                      {(
                        [
                          [
                            "avatar",
                            "Avatar neben Nachrichten",
                            chatShowAvatar,
                            setChatShowAvatar,
                          ],
                          [
                            "ts",
                            "Zeitstempel anzeigen",
                            chatShowTimestamps,
                            setChatShowTimestamps,
                          ],
                          [
                            "stats",
                            "Statistiken (Wörter & ~Tokens)",
                            chatShowStats,
                            setChatShowStats,
                          ],
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
                  </Section>

                  <Section>
                    <SectionTitle
                      title="Bilder"
                      hint="Profilbild des Assistenten und Hintergrund des Verlaufs."
                    />
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
                              onChange={(e) =>
                                pickImage(e, setAssistantAvatarUrl, 256)
                              }
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
                              onChange={(e) =>
                                pickImage(e, setChatBackgroundUrl, 1600)
                              }
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
                    <SectionTitle
                      title="Code-Panel"
                      hint="Lange Codeblöcke öffnen sich automatisch in einem Panel rechts."
                    />
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
                </>
              )}

              {activeTab === "assistant" && (
                <>
                  <Section>
                    <SectionTitle
                      title="Anweisungen"
                      hint="Dauerhafte Rolle/Regeln für das Modell — wird jeder Unterhaltung als System-Prompt vorangestellt."
                    />
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
                        <h4 className="font-medium">Vorlagen</h4>
                        <p className="text-sm text-neutral-500">
                          Prompt-Bibliothek — im Chat per „/" aufrufbar.
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
                    <SidekickManager />
                  </Section>

                  <Section>
                    <MemoryManager />
                  </Section>
                </>
              )}

              {activeTab === "websearch" && (
                <Section>
                  <SectionTitle
                    title="Websuche"
                    hint={
                      <>
                        Erlaubt dem Modell, für aktuelle Fragen das Web zu
                        durchsuchen. Die Suchanfrage formuliert das Modell
                        „Suchbegriff-Konstruktion" (siehe Modelle →
                        Standardmodelle); die Treffer werden dem Antwortmodell
                        als Kontext übergeben.
                      </>
                    }
                  />
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={webSearchEnabled}
                      onChange={() => toggleWebSearch()}
                      className="h-4 w-4 accent-[rgb(var(--accent))]"
                    />
                    Websuche aktivieren
                  </label>
                  {isAdmin && (
                    <button
                      onClick={() => setTab("admin-integrations")}
                      className="mt-3 text-sm text-accent transition hover:underline"
                    >
                      Suchanbieter konfigurieren →
                    </button>
                  )}
                </Section>
              )}

              {activeTab === "knowledge" && (
                <Section>
                  <KnowledgeBasePanel />
                </Section>
              )}

              {activeTab === "data" && (
                <Section>
                  <h4 className="font-medium text-red-600 dark:text-red-400">
                    Alle Chats löschen
                  </h4>
                  <p className="mb-2 text-sm text-neutral-500">
                    Entfernt alle Unterhaltungen dieses Kontos. Nicht umkehrbar.
                  </p>
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    Alle Chats löschen
                  </button>
                </Section>
              )}

              {activeTab === "admin-users" && isAdmin && (
                <>
                  <Section>
                    <UserManagement />
                  </Section>
                  <Section>
                    <AuthAccessPanel />
                  </Section>
                </>
              )}

              {activeTab === "admin-login" && isAdmin && (
                <>
                  <Section>
                    <SsoConfigPanel />
                  </Section>
                  <Section>
                    <SmtpConfigPanel />
                  </Section>
                </>
              )}

              {activeTab === "admin-models" && isAdmin && (
                <>
                  <Section>
                    <ProvidersPanel />
                  </Section>
                  <Section>
                    <AdminPanel />
                  </Section>
                  <Section>
                    <DefaultModelsPanel />
                  </Section>
                </>
              )}

              {activeTab === "admin-imagegen" && isAdmin && (
                <Section>
                  <ImageGenPanel />
                </Section>
              )}

              {activeTab === "admin-integrations" && isAdmin && (
                <>
                  <Section>
                    <SearchProvidersPanel />
                  </Section>
                  <Section>
                    <PluginsPanel />
                  </Section>
                </>
              )}

              {activeTab === "admin-assistants" && isAdmin && (
                <Section>
                  <AssistantsPanel />
                </Section>
              )}

              {activeTab === "admin-branding" && isAdmin && <BrandingPanel />}

              {activeTab === "admin-performance" && isAdmin && (
                <Section>
                  <SectionTitle
                    title="VRAM-Verwaltung"
                    hint="Steuert, wie schnell Ollama Modelle aus dem VRAM entlädt (GPU im Multi-User-Betrieb teilen). Alleinnutzung? Einfach aus lassen."
                  />
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
              )}

              {activeTab === "about" && (
                <Section>
                  <AboutPanel />
                </Section>
              )}
            </div>
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

      {confirmClear && (
        <Modal onClose={() => setConfirmClear(false)}>
          <h2 className="text-lg font-bold">Alle Chats löschen?</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Sämtliche Unterhaltungen dieses Kontos werden entfernt — mit allen
            Prompts, Antworten und angehängten Dateien. Das lässt sich nicht
            rückgängig machen.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setConfirmClear(false)}
              className="rounded-lg border border-border-light px-4 py-2 text-sm font-medium transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
            >
              Abbrechen
            </button>
            <button
              onClick={() => {
                clearAllChats();
                setConfirmClear(false);
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
            >
              Alle löschen
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
