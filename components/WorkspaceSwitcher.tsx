"use client";

import { useRef, useState } from "react";
import { ChevronDown, Plus, Check, Trash2, Layers } from "lucide-react";
import { useStore, DEFAULT_WORKSPACE_ID } from "@/lib/store";
import { useClickOutside } from "@/lib/useClickOutside";

/** Compact workspace selector: switch, create, delete (never the default). */
export default function WorkspaceSwitcher() {
  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const switchWorkspace = useStore((s) => s.switchWorkspace);
  const createWorkspace = useStore((s) => s.createWorkspace);
  const deleteWorkspace = useStore((s) => s.deleteWorkspace);

  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => {
    setOpen(false);
    setAdding(false);
  });

  const active =
    workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

  const add = () => {
    if (!name.trim()) return;
    createWorkspace(name.trim());
    setName("");
    setAdding(false);
    setOpen(false);
  };

  return (
    <div className="relative px-3 pb-2" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-neutral-500 transition hover:bg-neutral-200/60 dark:text-neutral-400 dark:hover:bg-white/5"
        title="Workspace wechseln"
      >
        <Layers size={14} className="shrink-0 text-accent/80" />
        <span className="min-w-0 flex-1 truncate text-left">
          {active?.name ?? "Workspace"}
        </span>
        <ChevronDown size={14} className="shrink-0 opacity-70" />
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full z-40 mt-1 menu-panel p-1.5">
          {workspaces.map((w) => (
            <div key={w.id} className="group flex items-center gap-1">
              <button
                onClick={() => {
                  switchWorkspace(w.id);
                  setOpen(false);
                }}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-neutral-200/70 dark:hover:bg-white/10"
              >
                <span className="min-w-0 flex-1 truncate">{w.name}</span>
                {w.id === activeWorkspaceId && (
                  <Check size={15} className="shrink-0 text-accent" />
                )}
              </button>
              {w.id !== DEFAULT_WORKSPACE_ID && (
                <button
                  onClick={() => deleteWorkspace(w.id)}
                  title="Workspace löschen (Inhalte wandern nach „Persönlich“)"
                  className="shrink-0 rounded p-1 text-neutral-400 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}

          <div className="mt-1 border-t border-border-light pt-1 dark:border-border-dark">
            {adding ? (
              <div className="flex items-center gap-1 px-1">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") add();
                    if (e.key === "Escape") setAdding(false);
                  }}
                  placeholder="Workspace-Name…"
                  className="min-w-0 flex-1 input-base"
                />
                <button
                  onClick={add}
                  disabled={!name.trim()}
                  className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-white disabled:opacity-40"
                >
                  OK
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-neutral-600 transition hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-white/10"
              >
                <Plus size={14} /> Neuer Workspace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
