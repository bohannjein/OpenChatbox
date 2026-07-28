"use client";

import { useEffect, useState } from "react";
import { Trash2, Loader2, CheckCircle2, XCircle, Check } from "lucide-react";
import { fetchModels } from "@/lib/providers";
import { loadServerState } from "@/lib/serverSync";
import { PRESETS } from "@/lib/presets";
import { uid } from "@/lib/uid";
import type { Provider, ProviderType } from "@/lib/types";

type TestState = { status: "idle" | "loading" | "ok" | "err"; msg?: string };

/**
 * Admin provider registry editor. Loads the FULL server config (incl. secret
 * apiKeys) from /api/admin/config, edits locally, and saves back explicitly —
 * so keys are never dropped (unlike an apiKey-stripped client copy). Saving also
 * re-hydrates the store so the (key-stripped) runtime provider list updates.
 */
export default function ProvidersPanel() {
  const [provs, setProvs] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tests, setTests] = useState<Record<string, TestState>>({});

  useEffect(() => {
    fetch("/api/admin/config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setProvs((d?.config?.providers as Provider[]) ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const update = (id: string, patch: Partial<Provider>) =>
    setProvs((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const remove = (id: string) => setProvs((ps) => ps.filter((p) => p.id !== id));
  const addFromPreset = (idx: number) => {
    const preset = PRESETS[idx];
    if (!preset) return;
    setProvs((ps) => [
      ...ps,
      {
        id: uid(),
        name: preset.name,
        type: preset.type,
        baseUrl: preset.baseUrl,
        apiKey: "",
        enabled: true,
        manualModels: preset.suggested ? [...preset.suggested] : undefined,
      },
    ]);
  };

  const test = async (p: Provider) => {
    setTests((t) => ({ ...t, [p.id]: { status: "loading" } }));
    try {
      const models = await fetchModels(p);
      setTests((t) => ({ ...t, [p.id]: { status: "ok", msg: `${models.length} Modelle` } }));
    } catch (e) {
      setTests((t) => ({
        ...t,
        [p.id]: { status: "err", msg: e instanceof Error ? e.message : String(e) },
      }));
    }
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providers: provs }),
      });
      await loadServerState();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-3">
        <h3 className="font-medium">Provider & API-Endpunkte</h3>
        <p className="text-sm text-neutral-500">
          Ollama (lokal) oder OpenAI-kompatible/Anthropic-APIs. Global,
          serverseitig gespeichert (Keys verlassen den Server nicht).
        </p>
      </div>

      {/* Compact add control — its own row, full width on narrow screens. */}
      <select
        value=""
        onChange={(e) => {
          if (e.target.value !== "") addFromPreset(Number(e.target.value));
          e.target.value = "";
        }}
        className="mb-3 w-full rounded-lg border border-border-light px-2 py-2 text-sm dark:border-border-dark dark:bg-sidebar-dark"
        title="Anbieter aus Vorlage hinzufügen"
      >
        <option value="">+ Anbieter hinzufügen…</option>
        {PRESETS.map((p, i) => (
          <option key={p.name} value={i}>
            {p.name}
          </option>
        ))}
      </select>

      {loading ? (
        <p className="py-4 text-center text-sm text-neutral-400">Lädt…</p>
      ) : (
        <div className="space-y-3">
          {provs.map((p) => {
            const t = tests[p.id] ?? { status: "idle" };
            return (
              <div key={p.id} className="rounded-xl border border-border-light p-3 dark:border-border-dark">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    onChange={(e) => update(p.id, { enabled: e.target.checked })}
                    className="h-4 w-4 accent-[rgb(var(--accent))]"
                  />
                  <input
                    value={p.name}
                    onChange={(e) => update(p.id, { name: e.target.value })}
                    placeholder="Anzeigename"
                    className="min-w-0 flex-1 input-base"
                  />
                  <select
                    value={p.type}
                    onChange={(e) => update(p.id, { type: e.target.value as ProviderType })}
                    className="input-base dark:bg-sidebar-dark"
                  >
                    <option value="ollama">Ollama</option>
                    <option value="openai">OpenAI-kompatibel</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                  <button
                    onClick={() => remove(p.id)}
                    className="rounded-lg p-2 text-neutral-400 hover:text-red-500"
                    title="Provider entfernen"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="mt-2 grid gap-2">
                  <div>
                    <label className="text-xs text-neutral-500">Base-URL</label>
                    <input
                      value={p.baseUrl}
                      onChange={(e) => update(p.id, { baseUrl: e.target.value })}
                      placeholder={p.type === "ollama" ? "http://localhost:11434" : "https://api.openai.com/v1"}
                      className="w-full input-base font-mono"
                    />
                  </div>
                  {p.type !== "ollama" && (
                    <div>
                      <label className="text-xs text-neutral-500">API-Key</label>
                      <input
                        type="password"
                        value={p.apiKey ?? ""}
                        onChange={(e) => update(p.id, { apiKey: e.target.value })}
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
                        update(p.id, {
                          manualModels: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="z. B. gpt-4o, claude-sonnet-4-5"
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
                      <Loader2 size={14} className="animate-spin" /> teste…
                    </span>
                  )}
                  {t.status === "ok" && (
                    <span className="flex items-center gap-1 text-sm text-accent">
                      <CheckCircle2 size={14} /> {t.msg}
                    </span>
                  )}
                  {t.status === "err" && (
                    <span className="flex items-center gap-1 truncate text-sm text-red-500" title={t.msg}>
                      <XCircle size={14} /> {t.msg}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Save — always visible directly under the list (also after adding). */}
      <button
        onClick={save}
        disabled={saving || loading}
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
        {saved ? "Gespeichert" : "Anbieter speichern"}
      </button>
    </div>
  );
}
