"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useStore } from "@/lib/store";
import { loadAllModels, displayName } from "@/lib/providers";
import type { ModelOption } from "@/lib/types";
import { useT } from "@/lib/i18n";

type RoleKey = "standard" | "coding" | "reasoning" | "vision" | "title" | "search";

const ROLES: RoleKey[] = ["standard", "coding", "reasoning", "vision", "title", "search"];

/**
 * "Standardmodelle" tab: assign a specific available model to each auto-mode
 * role. The Auto-mode router (lib/autoPipeline) loads exactly the model chosen
 * here for the detected need (code → coding, image → OCR, …). Stored globally in
 * routerModels (admin-managed via server config).
 */
export default function DefaultModelsPanel() {
  const t = useT();
  const providers = useStore((s) => s.providers);
  const aliases = useStore((s) => s.aliases);
  const routerModels = useStore((s) => s.routerModels);
  const setRouterModel = useStore((s) => s.setRouterModel);

  const [options, setOptions] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    loadAllModels(providers)
      .then((r) => setOptions(r.options))
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [providers]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h4 className="font-medium">{t("admin.defaultModels.title")}</h4>
          <p className="text-sm text-neutral-500">
            {t("admin.defaultModels.desc")}
          </p>
        </div>
        <button
          onClick={load}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border-light px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
          title={t("admin.defaultModels.reloadTitle")}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {t("admin.defaultModels.reload")}
        </button>
      </div>

      {!loading && options.length === 0 && (
        <p className="mb-3 rounded-lg border border-border-light bg-neutral-50 px-3 py-2 text-sm text-neutral-500 dark:border-border-dark dark:bg-white/5">
          {t("admin.defaultModels.none")}
        </p>
      )}

      <div className="space-y-2">
        {ROLES.map((key) => (
          <div key={key} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{t(`admin.defaultModels.role.${key}` as const)}</div>
              <div className="truncate text-xs text-neutral-400">{t(`admin.defaultModels.role.${key}Hint` as const)}</div>
            </div>
            <select
              value={routerModels[key] ?? ""}
              onChange={(e) => setRouterModel(key, e.target.value || null)}
              className="input-base w-56 py-1 text-xs dark:bg-sidebar-dark"
            >
              <option value="">{t("admin.defaultModels.default")}</option>
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {displayName(aliases, o.key, o.model)}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
