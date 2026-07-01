"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import clsx from "clsx";
import { ChevronDown, RefreshCw, Check, AlertCircle } from "lucide-react";
import { useStore } from "@/lib/store";
import { loadAllModels, parseModelKey } from "@/lib/providers";
import type { ModelOption } from "@/lib/types";

export default function ModelSwitcher() {
  const providers = useStore((s) => s.providers);
  const selectedModelKey = useStore((s) => s.selectedModelKey);
  const selectModel = useStore((s) => s.selectModel);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ModelOption[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const ref = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { options, errors } = await loadAllModels(providers);
      setOptions(options);
      setErrors(errors);
      // auto-select first model if none / stale selection
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

  // close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const current = options.find((o) => o.key === selectedModelKey);
  const label = current
    ? current.model
    : selectedModelKey
    ? parseModelKey(selectedModelKey).model
    : loading
    ? "Lade Modelle…"
    : "Kein Modell";

  // group options by provider
  const groups = new Map<string, ModelOption[]>();
  for (const o of options) {
    const arr = groups.get(o.providerName) ?? [];
    arr.push(o);
    groups.set(o.providerName, arr);
  }
  const errorCount = Object.keys(errors).length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition hover:bg-neutral-200/70 dark:hover:bg-white/10"
      >
        <span className="max-w-[50vw] truncate">{label}</span>
        {errorCount > 0 && (
          <AlertCircle size={14} className="text-amber-500" />
        )}
        <ChevronDown
          size={16}
          className={clsx("transition", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-border-light bg-white p-1.5 shadow-xl dark:border-border-dark dark:bg-sidebar-dark">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Modell wählen
            </span>
            <button
              onClick={refresh}
              className="rounded p-1 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-white/10"
              title="Modelle neu laden"
            >
              <RefreshCw size={14} className={clsx(loading && "animate-spin")} />
            </button>
          </div>

          {options.length === 0 && !loading && (
            <div className="px-3 py-4 text-sm text-neutral-500">
              Keine Modelle gefunden.{" "}
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

          {[...groups.entries()].map(([provName, opts]) => (
            <div key={provName} className="mb-1">
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                {provName}
              </div>
              {opts.map((o) => (
                <button
                  key={o.key}
                  onClick={() => {
                    selectModel(o.key);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-neutral-200/70 dark:hover:bg-white/10"
                >
                  <span className="min-w-0 truncate">{o.model}</span>
                  {o.key === selectedModelKey && (
                    <Check size={16} className="shrink-0 text-accent" />
                  )}
                </button>
              ))}
            </div>
          ))}

          {errorCount > 0 && (
            <div className="mt-1 border-t border-border-light px-3 py-2 text-xs text-amber-600 dark:border-border-dark dark:text-amber-500">
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
