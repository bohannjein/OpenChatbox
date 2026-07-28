"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MessageSquare, Pin, CornerDownLeft } from "lucide-react";
import clsx from "clsx";
import { useStore } from "@/lib/store";

export default function SearchModal() {
  const open = useStore((s) => s.searchOpen);
  const setOpen = useStore((s) => s.setSearchOpen);
  const chats = useStore((s) => s.chats);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const router = useRouter();

  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // reset + focus on open
  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    const list = chats
      .filter((c) => !c.temporary)
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const s = q.trim().toLowerCase();
    return (s ? list.filter((c) => c.title.toLowerCase().includes(s)) : list).slice(
      0,
      50
    );
  }, [chats, q]);

  useEffect(() => setIdx(0), [q]);

  if (!open) return null;

  const go = (id: string) => {
    setOpen(false);
    router.push(`/c/${id}`);
    if (typeof window !== "undefined" && window.innerWidth < 768)
      setSidebarOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[idx]) go(results[idx].id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={() => setOpen(false)}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border-light bg-white shadow-2xl dark:border-border-dark dark:bg-sidebar-dark"
      >
        <div className="flex items-center gap-3 border-b border-border-light px-4 py-3 dark:border-border-dark">
          <Search size={20} className="shrink-0 text-neutral-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Chats durchsuchen…"
            className="min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-neutral-400"
          />
          <kbd className="shrink-0 rounded border border-border-light px-1.5 py-0.5 text-xs text-neutral-400 dark:border-border-dark">
            Esc
          </kbd>
        </div>

        <div className="overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-neutral-500">
              {q ? "Keine Treffer." : "Noch keine Chats."}
            </p>
          ) : (
            <>
              {!q && (
                <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  Zuletzt aktiv
                </div>
              )}
              {results.map((c, i) => (
                <button
                  key={c.id}
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => go(c.id)}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition",
                    i === idx
                      ? "bg-neutral-200/70 dark:bg-white/10"
                      : "hover:bg-neutral-100 dark:hover:bg-white/5"
                  )}
                >
                  {c.pinned ? (
                    <Pin size={16} className="shrink-0 text-accent" />
                  ) : (
                    <MessageSquare
                      size={16}
                      className="shrink-0 text-neutral-500"
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {c.title}
                  </span>
                  {i === idx && (
                    <CornerDownLeft size={14} className="shrink-0 text-neutral-400" />
                  )}
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
