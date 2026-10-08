"use client";

import { useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";
import { loadServerState } from "@/lib/serverSync";
import { useT } from "@/lib/i18n";

type ProviderKey = "bing" | "tavily" | "bocha" | "qureit";
interface ProviderCfg {
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
}
type SearchCfg = Partial<Record<ProviderKey, ProviderCfg>>;

// Selection order matches the server (lib/server/config SEARCH_PROVIDER_ORDER).
const PROVIDERS: { key: ProviderKey; label: string }[] = [
  { key: "tavily", label: "Tavily" },
  { key: "bing", label: "Bing Search (Free)" },
  { key: "bocha", label: "Bocha (博查)" },
  { key: "qureit", label: "Qureit" },
];

/**
 * Admin panel for web-search providers. API keys are stored server-side
 * (config.json → search) and never returned to non-admin clients. The first
 * enabled + keyed provider (in the order above) is used for searches.
 */
export default function SearchProvidersPanel() {
  const t = useT();
  const [cfg, setCfg] = useState<SearchCfg>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/config", { cache: "no-store" })
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
          <h4 className="font-medium">{t("settings.websearch.providers")}</h4>
          <p className="text-sm text-neutral-500">
            {t("settings.websearch.providersDesc")}
            {active && (
              <>
                {" "}
                {t("settings.websearch.active")} <span className="font-medium text-accent">{active.label}</span>.
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
          {saved ? t("common.saved") : t("common.save")}
        </button>
      </div>

      {loading ? (
        <p className="py-4 text-center text-sm text-neutral-400">{t("common.loading")}</p>
      ) : (
        <div className="space-y-3">
          {PROVIDERS.map(({ key, label }) => {
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
                    <div className="truncate text-xs text-neutral-400">{t(`settings.websearch.hint.${key}` as const)}</div>
                  </div>
                </div>
                <input
                  type="password"
                  value={p.apiKey ?? ""}
                  onChange={(e) => patch(key, { apiKey: e.target.value })}
                  placeholder={t("common.apiKey")}
                  className="mt-2 w-full input-base font-mono"
                />
                <input
                  value={p.baseUrl ?? ""}
                  onChange={(e) => patch(key, { baseUrl: e.target.value })}
                  placeholder={t("settings.websearch.endpointPlaceholder")}
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
