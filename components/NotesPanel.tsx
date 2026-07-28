"use client";

import { useEffect, useRef, useState } from "react";
import { X, StickyNote, Check, Loader2 } from "lucide-react";

/** Cross-chat, server-persisted personal notes (right splitscreen panel). */
export default function NotesPanel({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [state, setState] = useState<"loading" | "idle" | "saving" | "saved">("loading");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    fetch("/api/notes")
      .then((r) => r.json())
      .then((d) => {
        setText(d.notes ?? "");
        loaded.current = true;
        setState("idle");
      })
      .catch(() => setState("idle"));
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const onChange = (v: string) => {
    setText(v);
    if (!loaded.current) return;
    setState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await fetch("/api/notes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: v }),
        });
        setState("saved");
        setTimeout(() => setState((s) => (s === "saved" ? "idle" : s)), 1500);
      } catch {
        setState("idle");
      }
    }, 700);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden border-l border-border-light bg-main-light dark:border-border-dark dark:bg-main-dark">
      <header className="flex shrink-0 items-center gap-2 border-b border-border-light px-4 py-2 dark:border-border-dark">
        <StickyNote size={16} className="shrink-0 text-accent" />
        <span className="min-w-0 truncate text-sm font-medium">Notizen</span>
        <span className="ml-auto flex items-center gap-1 text-xs text-neutral-400">
          {state === "loading" || state === "saving" ? (
            <Loader2 size={12} className="animate-spin" />
          ) : state === "saved" ? (
            <>
              <Check size={12} className="text-emerald-500" /> gespeichert
            </>
          ) : null}
        </span>
        <button
          onClick={onClose}
          title="Schließen"
          className="shrink-0 rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-200 dark:hover:bg-white/10"
        >
          <X size={18} />
        </button>
      </header>
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        disabled={state === "loading"}
        placeholder="Deine Notizen — automatisch gespeichert, chatübergreifend…"
        className="min-h-0 flex-1 resize-none bg-transparent p-4 text-sm leading-6 outline-none placeholder:text-neutral-400 disabled:opacity-50"
      />
    </div>
  );
}
