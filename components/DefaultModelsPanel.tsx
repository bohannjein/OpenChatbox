"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useStore } from "@/lib/store";
import { loadAllModels, displayName } from "@/lib/providers";
import type { ModelOption } from "@/lib/types";

type RoleKey = "standard" | "coding" | "reasoning" | "vision" | "title" | "search";

const ROLES: { key: RoleKey; label: string; hint: string }[] = [
  { key: "standard", label: "Standard-Chat", hint: "Allrounder für normale Anfragen (auch Antwort-Stufe der OCR-Kette)." },
  { key: "coding", label: "Coding-Modell", hint: "Code, Skripte, Debugging." },
  { key: "reasoning", label: "Reasoning / Mathematik", hint: "Logik, Rechnen, mehrstufige Herleitungen." },
  { key: "vision", label: "OCR-Modell", hint: "Liest Bilder & Scans (Stufe 1 der OCR-Kette)." },
  { key: "title", label: "Thread-Benennung", hint: "Automatischer Chat-Titel." },
  { key: "search", label: "Suchbegriff-Konstruktion", hint: "Baut die Query für die Web-Suche." },
];

/**
 * "Standardmodelle" tab: assign a specific available model to each auto-mode
 * role. The Auto-mode router (lib/autoPipeline) loads exactly the model chosen
 * here for the detected need (code → coding, image → OCR, …). Stored globally in
 * routerModels (admin-managed via server config).
 */
export default function DefaultModelsPanel() {
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
          <h3 className="font-medium">Standardmodelle</h3>
          <p className="text-sm text-neutral-500">
            Weise jeder Aufgabe ein konkretes Modell zu. Im „Auto"-Modus prüft der
            Chat, was gebraucht wird, und lädt genau das hier festgelegte Modell.
            Ohne Zuweisung greift das Standard-Chat-Modell.
          </p>
        </div>
        <button
          onClick={load}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border-light px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
          title="Modell-Liste neu laden"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Aktualisieren
        </button>
      </div>

      {!loading && options.length === 0 && (
        <p className="mb-3 rounded-lg border border-border-light bg-neutral-50 px-3 py-2 text-sm text-neutral-500 dark:border-border-dark dark:bg-white/5">
          Keine Modelle gefunden. Prüfe unter „Modellanbieter & Modelle", ob ein
          Ollama-Anbieter erreichbar ist.
        </p>
      )}

      <div className="space-y-2">
        {ROLES.map(({ key, label, hint }) => (
          <div key={key} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{label}</div>
              <div className="truncate text-xs text-neutral-400">{hint}</div>
            </div>
            <select
              value={routerModels[key] ?? ""}
              onChange={(e) => setRouterModel(key, e.target.value || null)}
              className="input-base w-56 py-1 text-xs dark:bg-sidebar-dark"
            >
              <option value="">— Standard —</option>
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
