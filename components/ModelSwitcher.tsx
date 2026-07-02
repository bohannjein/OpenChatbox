"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import clsx from "clsx";
import {
  ChevronDown,
  RefreshCw,
  Check,
  AlertCircle,
  Search,
  Star,
  Sparkles,
  Zap,
} from "lucide-react";
import { useStore } from "@/lib/store";
import {
  loadAllModels,
  parseModelKey,
  displayName,
  unloadModel,
} from "@/lib/providers";
import { useClickOutside } from "@/lib/useClickOutside";
import { SidekickAvatar } from "./SidekickIcon";
import type { ModelOption } from "@/lib/types";

export default function ModelSwitcher() {
  const providers = useStore((s) => s.providers);
  const selectedModelKey = useStore((s) => s.selectedModelKey);
  const selectModel = useStore((s) => s.selectModel);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const favorites = useStore((s) => s.favorites);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const aliases = useStore((s) => s.aliases);
  const sidekicks = useStore((s) => s.sidekicks);
  const chats = useStore((s) => s.chats);
  const activeChatId = useStore((s) => s.activeChatId);
  const setChatSidekick = useStore((s) => s.setChatSidekick);
  const autoRouter = useStore((s) => s.autoRouter);
  const setAutoRouter = useStore((s) => s.setAutoRouter);

  const activeChat = chats.find((c) => c.id === activeChatId);
  const activeSidekickId = activeChat?.sidekickId ?? null;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ModelOption[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const ref = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { options, errors } = await loadAllModels(providers);
      setOptions(options);
      setErrors(errors);
      const stillValid = options.some((o) => o.key === selectedModelKey);
      if (!stillValid && options.length > 0) selectModel(options[0].key);
    } finally {
      setLoading(false);
    }
  }, [providers, selectedModelKey, selectModel]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providers]);

  useClickOutside(ref, () => setOpen(false));

  // Open programmatically (e.g. from the "/" command menu).
  useEffect(() => {
    const open = () => setOpen(true);
    window.addEventListener("openModelSwitcher", open);
    return () => window.removeEventListener("openModelSwitcher", open);
  }, []);

  const name = (o: ModelOption) => displayName(aliases, o.key, o.model);

  // Switch model + free the previously loaded Ollama model server-side.
  const chooseModel = (key: string) => {
    const prev = selectedModelKey;
    selectModel(key);
    setAutoRouter(false); // picking a concrete model leaves Auto mode
    if (activeChatId) setChatSidekick(activeChatId, null); // back to plain model
    setOpen(false);
    if (prev && prev !== key) {
      const { providerId, model } = parseModelKey(prev);
      const p = providers.find((x) => x.id === providerId);
      if (p?.type === "ollama") unloadModel(p.baseUrl, model);
    }
  };

  const chooseSidekick = (id: string) => {
    if (activeChatId) setChatSidekick(activeChatId, id);
    setOpen(false);
  };

  // filter by search (matches alias, model id or provider)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        name(o).toLowerCase().includes(q) ||
        o.model.toLowerCase().includes(q) ||
        o.providerName.toLowerCase().includes(q)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, query, aliases]);

  const favOptions = filtered.filter((o) => favorites.includes(o.key));
  const nonFav = filtered.filter((o) => !favorites.includes(o.key));

  // group non-favorites by provider
  const groups = new Map<string, ModelOption[]>();
  for (const o of nonFav) {
    const arr = groups.get(o.providerName) ?? [];
    arr.push(o);
    groups.set(o.providerName, arr);
  }

  const activeSk = activeSidekickId
    ? sidekicks.find((x) => x.id === activeSidekickId)
    : undefined;
  const current = options.find((o) => o.key === selectedModelKey);
  const label = activeSk
    ? activeSk.name
    : autoRouter
    ? "Auto"
    : current
    ? name(current)
    : selectedModelKey
    ? displayName(aliases, selectedModelKey, parseModelKey(selectedModelKey).model)
    : loading
    ? "Lade Modelle…"
    : "Kein Modell";
  const errorCount = Object.keys(errors).length;

  const Row = ({ o }: { o: ModelOption }) => (
    <div
      className={clsx(
        "group flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm transition",
        "hover:bg-neutral-200/70 dark:hover:bg-white/10"
      )}
    >
      <button
        onClick={() => toggleFavorite(o.key)}
        title={favorites.includes(o.key) ? "Favorit entfernen" : "Favorisieren"}
        className="shrink-0 text-neutral-400 hover:text-amber-400"
      >
        <Star
          size={15}
          className={
            favorites.includes(o.key)
              ? "fill-amber-400 text-amber-400"
              : "opacity-60 group-hover:opacity-100"
          }
        />
      </button>
      <button
        onClick={() => chooseModel(o.key)}
        className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
      >
        <span className="min-w-0 truncate">
          {name(o)}
          {aliases[o.key] && (
            <span className="ml-1.5 text-xs text-neutral-400">{o.model}</span>
          )}
        </span>
        {o.key === selectedModelKey && (
          <Check size={16} className="shrink-0 text-accent" />
        )}
      </button>
    </div>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition hover:bg-neutral-200/70 dark:hover:bg-white/10"
      >
        {activeSk && (
          <SidekickAvatar icon={activeSk.icon} color={activeSk.color} size={20} />
        )}
        <span className="max-w-[50vw] truncate">{label}</span>
        {errorCount > 0 && <AlertCircle size={14} className="text-amber-500" />}
        <ChevronDown
          size={16}
          className={clsx("transition", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 flex max-h-[70vh] w-80 flex-col menu-panel">
          {/* Search */}
          <div className="flex items-center gap-2 border-b border-border-light px-3 py-2 dark:border-border-dark">
            <Search size={15} className="shrink-0 text-neutral-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Modell suchen…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
            />
            <button
              onClick={refresh}
              className="rounded p-1 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-white/10"
              title="Modelle neu laden"
            >
              <RefreshCw size={14} className={clsx(loading && "animate-spin")} />
            </button>
          </div>

          <div className="overflow-y-auto p-1.5">
            {/* Auto router — pick vision/OCR/text per turn automatically */}
            <button
              onClick={() => {
                setAutoRouter(true);
                if (activeChatId) setChatSidekick(activeChatId, null);
                setOpen(false);
              }}
              className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-neutral-200/70 dark:hover:bg-white/10"
            >
              <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-accent/15 text-accent">
                <Zap size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-medium">Auto</span>
                <span className="ml-1.5 text-xs text-neutral-400">
                  Bild→Vision · Doku→OCR · sonst Text
                </span>
              </span>
              {autoRouter && <Check size={16} className="shrink-0 text-accent" />}
            </button>

            {/* Sidekicks — switch the current chat's profile */}
            {sidekicks.length > 0 &&
              (() => {
                const q = query.trim().toLowerCase();
                const sk = q
                  ? sidekicks.filter((s) => s.name.toLowerCase().includes(q))
                  : sidekicks;
                if (sk.length === 0) return null;
                return (
                  <div className="mb-1">
                    <div className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                      <Sparkles size={11} className="text-accent" /> Sidekicks
                    </div>
                    {sk.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => chooseSidekick(s.id)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-neutral-200/70 dark:hover:bg-white/10"
                      >
                        <SidekickAvatar
                          icon={s.icon}
                          color={s.color}
                          size={22}
                        />
                        <span className="min-w-0 flex-1 truncate">{s.name}</span>
                        {s.id === activeSidekickId && (
                          <Check size={16} className="shrink-0 text-accent" />
                        )}
                      </button>
                    ))}
                  </div>
                );
              })()}

            {filtered.length === 0 && !loading && (
              <div className="px-3 py-4 text-sm text-neutral-500">
                Keine Modelle{query ? " gefunden" : ""}.{" "}
                <button
                  className="text-accent underline"
                  onClick={() => {
                    setOpen(false);
                    setSettingsOpen(true);
                  }}
                >
                  Provider prüfen
                </button>
              </div>
            )}

            {/* Favorites pinned on top */}
            {favOptions.length > 0 && (
              <div className="mb-1">
                <div className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  <Star size={11} className="fill-amber-400 text-amber-400" />
                  Favoriten
                </div>
                {favOptions.map((o) => (
                  <Row key={o.key} o={o} />
                ))}
              </div>
            )}

            {[...groups.entries()].map(([provName, opts]) => (
              <div key={provName} className="mb-1">
                <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  {provName}
                </div>
                {opts.map((o) => (
                  <Row key={o.key} o={o} />
                ))}
              </div>
            ))}
          </div>

          {errorCount > 0 && (
            <div className="border-t border-border-light px-3 py-2 text-xs text-amber-600 dark:border-border-dark dark:text-amber-500">
              {Object.entries(errors).map(([pid, msg]) => {
                const p = providers.find((x) => x.id === pid);
                return (
                  <div key={pid} className="truncate" title={msg}>
                    ⚠ {p?.name ?? pid}: {msg}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
