"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Check, Trash2, Layers, Link2 } from "lucide-react";
import { useStore, DEFAULT_WORKSPACE_ID } from "@/lib/store";
import { useClickOutside } from "@/lib/useClickOutside";

/** Compact workspace selector: switch, create, delete (never the default). */
export default function WorkspaceSwitcher() {
  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const switchWorkspace = useStore((s) => s.switchWorkspace);
  const upsertWorkspace = useStore((s) => s.upsertWorkspace);
  const deleteWorkspace = useStore((s) => s.deleteWorkspace);

  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Load invite tokens for the user's server workspaces when the menu opens.
  useEffect(() => {
    if (!open) return;
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((d) => {
        const m: Record<string, string> = {};
        for (const w of d?.workspaces ?? []) if (w.inviteToken) m[w.id] = w.inviteToken;
        setTokens(m);
      })
      .catch(() => {});
  }, [open]);

  const copyInvite = async (id: string) => {
    const t = tokens[id];
    if (!t) return;
    try {
      await navigator.clipboard.writeText(`${location.origin}/join-workspace/${t}`);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      /* ignore */
    }
  };
  useClickOutside(ref, () => {
    setOpen(false);
    setAdding(false);
  });

  const active =
    workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

  // Create server-side so it has an id + invite token shareable across users.
  const add = async () => {
    if (!name.trim()) return;
    try {
      const r = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const d = await r.json();
      if (r.ok && d.workspace) {
        upsertWorkspace({ id: d.workspace.id, name: d.workspace.name });
        switchWorkspace(d.workspace.id);
        if (d.workspace.inviteToken)
          setTokens((m) => ({ ...m, [d.workspace.id]: d.workspace.inviteToken }));
      }
    } catch {
      /* ignore */
    }
    setName("");
    setAdding(false);
    setOpen(false);
  };

  const removeWorkspace = (id: string) => {
    deleteWorkspace(id); // local
    fetch(`/api/workspaces?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(
      () => {}
    );
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
              {tokens[w.id] && (
                <button
                  onClick={() => copyInvite(w.id)}
                  title="Einladungslink kopieren"
                  className={
                    "shrink-0 rounded p-1 transition group-hover:opacity-100 " +
                    (copied === w.id
                      ? "text-emerald-500 opacity-100"
                      : "text-neutral-400 opacity-0 hover:text-accent")
                  }
                >
                  {copied === w.id ? <Check size={13} /> : <Link2 size={13} />}
                </button>
              )}
              {w.id !== DEFAULT_WORKSPACE_ID && (
                <button
                  onClick={() => removeWorkspace(w.id)}
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
