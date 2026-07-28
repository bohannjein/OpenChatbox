"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import clsx from "clsx";
import {
  Download,
  Loader2,
  Star,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Square,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { fetchModels, modelKey, pullModel } from "@/lib/providers";
import AdminTerminal from "./AdminTerminal";
import RolesEditor from "./RolesEditor";

/** Ready-made display names describing what a model is *for*, offered as
 *  one-click fills next to the free-text alias field. */
const PURPOSE_NAMES = [
  "Schnell",
  "Gründlich",
  "Versteht Bilder",
  "Programmieren",
  "Übersetzen",
];

export default function AdminPanel() {
  const providers = useStore((s) => s.providers);
  const favorites = useStore((s) => s.favorites);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const aliases = useStore((s) => s.aliases);
  const setAlias = useStore((s) => s.setAlias);

  const ollamaProviders = useMemo(
    () => providers.filter((p) => p.type === "ollama"),
    [providers]
  );
  const [serverId, setServerId] = useState(ollamaProviders[0]?.id ?? "");
  const server =
    ollamaProviders.find((p) => p.id === serverId) ?? ollamaProviders[0];

  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // pull state
  const [pullName, setPullName] = useState("");
  const [pulling, setPulling] = useState(false);
  const [percent, setPercent] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [pullError, setPullError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadModels = useCallback(async () => {
    if (!server) return;
    setLoadingModels(true);
    setModelsError(null);
    try {
      setModels(await fetchModels(server));
    } catch (e) {
      setModelsError(e instanceof Error ? e.message : String(e));
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, [server]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const startPull = async () => {
    if (!server || !pullName.trim() || pulling) return;
    setPulling(true);
    setPullError(null);
    setPercent(null);
    setStatus("Starte…");
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await pullModel(
        server.baseUrl,
        pullName.trim(),
        (p) => {
          setStatus(p.status);
          setPercent(p.percent);
        },
        ac.signal
      );
      setStatus("Fertig ✓");
      setPercent(100);
      setPullName("");
      await loadModels();
    } catch (e) {
      if ((e as Error)?.name !== "AbortError")
        setPullError(e instanceof Error ? e.message : String(e));
    } finally {
      abortRef.current = null;
      setPulling(false);
    }
  };

  const stopPull = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPulling(false);
    setStatus("Abgebrochen");
  };

  if (ollamaProviders.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Kein Ollama-Anbieter konfiguriert. Trage oben unter „Anbieter &
        Endpunkte" einen Ollama-Anbieter ein, um Modelle zu verwalten.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Server picker */}
      {ollamaProviders.length > 1 && (
        <div>
          <label className="mb-1 block text-xs text-neutral-500">
            Ollama-Server
          </label>
          <select
            value={serverId}
            onChange={(e) => setServerId(e.target.value)}
            className="w-full input-base dark:bg-sidebar-dark"
          >
            {ollamaProviders.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.baseUrl}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Pull */}
      <section>
        <h4 className="font-medium">Modelle laden</h4>
        <p className="mb-2 text-sm text-neutral-500">
          Modellname aus der Ollama-Bibliothek eingeben (z. B. <code>phi3</code>,{" "}
          <code>llama3.2</code>, <code>qwen2.5:14b</code>). Lädt auf{" "}
          {server?.baseUrl}.
        </p>
        <div className="flex gap-2">
          <input
            value={pullName}
            onChange={(e) => setPullName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && startPull()}
            placeholder="z. B. phi3"
            disabled={pulling}
            className="min-w-0 flex-1 input-base px-3 font-mono disabled:opacity-60"
          />
          {pulling ? (
            <button
              onClick={stopPull}
              className="flex items-center gap-1 rounded-lg border border-border-light px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
            >
              <Square size={14} /> Stop
            </button>
          ) : (
            <button
              onClick={startPull}
              disabled={!pullName.trim()}
              className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-40"
            >
              <Download size={15} /> Laden
            </button>
          )}
        </div>

        {(pulling || percent != null || pullError) && (
          <div className="mt-3">
            {pullError ? (
              <div className="flex items-center gap-1.5 text-sm text-red-500">
                <XCircle size={15} /> {pullError}
              </div>
            ) : (
              <>
                <div className="mb-1 flex items-center gap-2 text-xs text-neutral-500">
                  {pulling ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={13} className="text-accent" />
                  )}
                  <span className="truncate">{status}</span>
                  {percent != null && (
                    <span className="ml-auto tabular-nums">{percent}%</span>
                  )}
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{
                      width: percent != null ? `${percent}%` : "100%",
                      opacity: percent != null ? 1 : 0.4,
                    }}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* Aliases + favorites */}
      <section className="border-t border-border-light pt-4 dark:border-border-dark">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h4 className="font-medium">Anzeigenamen & Favoriten</h4>
            <p className="text-sm text-neutral-500">
              Der Anzeigename ersetzt die Modell-ID überall in der App. Nutzer
              ohne technischen Hintergrund können mit „gemma4:e4b" nichts
              anfangen — ein Name nach Zweck schon.
            </p>
          </div>
          <button
            onClick={loadModels}
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-white/10"
            title="Neu laden"
          >
            <RefreshCw
              size={15}
              className={clsx(loadingModels && "animate-spin")}
            />
          </button>
        </div>

        {modelsError && (
          <div className="mb-2 text-sm text-red-500">⚠ {modelsError}</div>
        )}
        {models.length === 0 && !loadingModels && !modelsError && (
          <p className="text-sm text-neutral-500">Keine Modelle gefunden.</p>
        )}

        <div className="space-y-2">
          {models.map((m) => {
            const key = modelKey(server!.id, m);
            const fav = favorites.includes(key);
            return (
              <div
                key={m}
                className="rounded-lg border border-border-light p-2 dark:border-border-dark"
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleFavorite(key)}
                    title={fav ? "Favorit entfernen" : "Favorisieren"}
                    className="shrink-0 text-neutral-400 hover:text-amber-400"
                  >
                    <Star
                      size={16}
                      className={fav ? "fill-amber-400 text-amber-400" : ""}
                    />
                  </button>
                  <code
                    className="w-40 shrink-0 truncate text-xs text-neutral-500"
                    title={m}
                  >
                    {m}
                  </code>
                  <input
                    value={aliases[key] ?? ""}
                    onChange={(e) => setAlias(key, e.target.value)}
                    placeholder="Anzeigename (Alias)…"
                    className="min-w-0 flex-1 input-base"
                  />
                </div>
                {/* One-click purpose names — the point is to make naming cheap
                    enough that it actually gets done. */}
                <div className="mt-1.5 flex flex-wrap gap-1 pl-[26px]">
                  {PURPOSE_NAMES.map((p) => (
                    <button
                      key={p}
                      onClick={() => setAlias(key, p)}
                      className={clsx(
                        "rounded-md border px-2 py-0.5 text-xs transition",
                        aliases[key] === p
                          ? "border-accent bg-accent/15 text-accent"
                          : "border-border-light text-neutral-500 hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Custom user roles */}
      <section className="border-t border-border-light pt-4 dark:border-border-dark">
        <RolesEditor />
      </section>

      {/* Server terminal (admin-only, Ollama HTTP API — no shell) */}
      <section className="border-t border-border-light pt-4 dark:border-border-dark">
        <AdminTerminal baseUrl={server?.baseUrl} />
      </section>
    </div>
  );
}
