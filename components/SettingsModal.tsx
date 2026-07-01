"use client";

import { useState } from "react";
import clsx from "clsx";
import { X, Trash2, Loader2, CheckCircle2, XCircle, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { fetchModels } from "@/lib/providers";
import { PRESETS } from "@/lib/presets";
import type { Provider, ProviderType } from "@/lib/types";

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

type TestState = { status: "idle" | "loading" | "ok" | "err"; msg?: string };

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

  const [tests, setTests] = useState<Record<string, TestState>>({});

  if (!open) return null;

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
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border-light bg-white shadow-2xl dark:border-border-dark dark:bg-sidebar-dark">
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

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-medium">Provider & API-Endpunkte</h3>
                <p className="text-sm text-neutral-500">
                  Ollama (lokal) oder OpenAI-kompatible APIs (Hugging Face TGI,
                  vLLM, OpenAI…). Alles im Browser gespeichert.
                </p>
              </div>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value !== "") addFromPreset(Number(e.target.value));
                  e.target.value = "";
                }}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover"
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
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={p.enabled}
                          onChange={(e) =>
                            update(p, { enabled: e.target.checked })
                          }
                          className="h-4 w-4 accent-[#10a37f]"
                        />
                      </label>
                      <input
                        value={p.name}
                        onChange={(e) => update(p, { name: e.target.value })}
                        placeholder="Anzeigename"
                        className="min-w-0 flex-1 rounded-lg border border-border-light bg-transparent px-2 py-1.5 text-sm outline-none focus:border-accent dark:border-border-dark"
                      />
                      <select
                        value={p.type}
                        onChange={(e) =>
                          update(p, { type: e.target.value as ProviderType })
                        }
                        className="rounded-lg border border-border-light bg-transparent px-2 py-1.5 text-sm outline-none focus:border-accent dark:border-border-dark dark:bg-sidebar-dark"
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
                          className="w-full rounded-lg border border-border-light bg-transparent px-2 py-1.5 font-mono text-sm outline-none focus:border-accent dark:border-border-dark"
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
                            className="w-full rounded-lg border border-border-light bg-transparent px-2 py-1.5 font-mono text-sm outline-none focus:border-accent dark:border-border-dark"
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-xs text-neutral-500">
                          Modelle manuell (optional, Komma-getrennt) — nötig bei
                          Anbietern ohne Modell-Liste
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
                          className="w-full rounded-lg border border-border-light bg-transparent px-2 py-1.5 font-mono text-sm outline-none focus:border-accent dark:border-border-dark"
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
                          <Loader2 size={14} className="animate-spin" /> teste…
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
          </section>

          {/* Custom instructions */}
          <section className="border-t border-border-light pt-4 dark:border-border-dark">
            <h3 className="font-medium">Benutzerdefinierte Anweisungen</h3>
            <p className="mb-2 text-sm text-neutral-500">
              Dauerhafte Rolle/Regeln für das Modell — wird jeder Unterhaltung
              als System-Prompt vorangestellt.
            </p>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              rows={3}
              placeholder="z. B. Antworte immer auf Deutsch und fasse dich kurz."
              className="w-full resize-y rounded-lg border border-border-light bg-transparent px-3 py-2 text-sm outline-none focus:border-accent dark:border-border-dark"
            />
          </section>

          {/* Prompt library */}
          <section className="border-t border-border-light pt-4 dark:border-border-dark">
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
                      className="min-w-0 flex-1 rounded-lg border border-border-light bg-transparent px-2 py-1.5 text-sm outline-none focus:border-accent dark:border-border-dark"
                    />
                    <input
                      value={p.shortcut ?? ""}
                      onChange={(e) =>
                        upsertPrompt({ ...p, shortcut: e.target.value })
                      }
                      placeholder="/kürzel"
                      className="w-28 rounded-lg border border-border-light bg-transparent px-2 py-1.5 font-mono text-sm outline-none focus:border-accent dark:border-border-dark"
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
                    className="mt-2 w-full resize-y rounded-lg border border-border-light bg-transparent px-2 py-1.5 text-sm outline-none focus:border-accent dark:border-border-dark"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Danger zone */}
          <section className="border-t border-border-light pt-4 dark:border-border-dark">
            <h3 className="font-medium text-red-600 dark:text-red-400">
              Verlauf löschen
            </h3>
            <p className="mb-2 text-sm text-neutral-500">
              Entfernt alle Chats aus dem LocalStorage. Nicht umkehrbar.
            </p>
            <button
              onClick={() => {
                if (confirm("Wirklich alle Chats löschen?")) clearAllChats();
              }}
              className={clsx(
                "rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50",
                "dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
              )}
            >
              Alle Chats löschen
            </button>
          </section>
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
