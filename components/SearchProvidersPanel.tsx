"use client";

import { useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";
import { loadServerState } from "@/lib/serverSync";

type ProviderKey = "bing" | "tavily" | "bocha" | "qureit";
interface ProviderCfg {
  enabled: boolean;
  apiKey?: string;
}
type SearchCfg = Partial<Record<ProviderKey, ProviderCfg>>;

// Selection order matches the server (lib/server/config SEARCH_PROVIDER_ORDER).
const PROVIDERS: { key: ProviderKey; label: string; hint: string }[] = [
  { key: "tavily", label: "Tavily", hint: "LLM-optimiert · Key tvly-…" },
  { key: "bing", label: "Bing Search (Free)", hint: "Azure Ocp-Apim-Subscription-Key" },
  { key: "bocha", label: "Bocha (博查)", hint: "Bearer-Key" },
  { key: "qureit", label: "Qureit", hint: "Bearer-Key (Best-Effort-Anbindung)" },
];

/**
 * Admin panel for web-search providers. API keys are stored server-side
 * (config.json → search) and never returned to non-admin clients. The first
 * enabled + keyed provider (in the order above) is used for searches.
 */
export default function SearchProvidersPanel() {
  const [cfg, setCfg] = useState<SearchCfg>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCfg((d?.config?.search as SearchCfg) ?? {}))
      .catch(() => setCfg({}))
      .finally(() => setLoading(false));
  }, []);

  const patch = (k: ProviderKey, p: Partial<ProviderCfg>) =>
    setCfg((c) => ({ ...c, [k]: { enabled: false, ...c[k], ...p } }));

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search: cfg }),
      });
      await loadServerState(); // refresh searchAvailable
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const active = PROVIDERS.find((p) => cfg[p.key]?.enabled && cfg[p.key]?.apiKey?.trim());

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">Such-Anbieter</h3>
          <p className="text-sm text-neutral-500">
            API-Keys werden serverseitig gespeichert. Verwendet wird der erste
            aktivierte Anbieter mit Key.
            {active && (
              <>
                {" "}
                Aktiv: <span className="font-medium text-accent">{active.label}</span>.
              </>
            )}
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving || loading}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
          {saved ? "Gespeichert" : "Speichern"}
        </button>
      </div>

      {loading ? (
        <p className="py-4 text-center text-sm text-neutral-400">Lädt…</p>
      ) : (
        <div className="space-y-3">
          {PROVIDERS.map(({ key, label, hint }) => {
            const p = cfg[key] ?? { enabled: false };
            return (
              <div
                key={key}
                className="rounded-xl border border-border-light p-3 dark:border-border-dark"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!p.enabled}
                    onChange={(e) => patch(key, { enabled: e.target.checked })}
                    className="h-4 w-4 accent-[rgb(var(--accent))]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{label}</div>
                    <div className="truncate text-xs text-neutral-400">{hint}</div>
                  </div>
                </div>
                <input
                  type="password"
                  value={p.apiKey ?? ""}
                  onChange={(e) => patch(key, { apiKey: e.target.value })}
                  placeholder="API-Key"
                  className="mt-2 w-full input-base font-mono"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
