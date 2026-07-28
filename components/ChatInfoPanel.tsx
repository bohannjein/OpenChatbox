"use client";

import { useState } from "react";
import clsx from "clsx";
import { PanelRight, X, Star, ArrowUpRight } from "lucide-react";
import { useStore } from "@/lib/store";
import ArchivePanel from "./ArchivePanel";
import type { Chat } from "@/lib/types";

type Segment = "files" | "starred" | "notes";

/**
 * Everything that belongs to the *current* chat, in one panel: its files, its
 * starred messages and its notes. Replaces the former separate archive and
 * (cross-chat) notes buttons in the header — one icon, one scope, so there is
 * nothing to work out about where a thing lives. The cross-chat personal notes
 * still exist and moved to the sidebar footer.
 */
export default function ChatInfoPanel({
  chat,
  onJump,
  onClose,
}: {
  chat: Chat;
  onJump: (messageId: string) => void;
  onClose: () => void;
}) {
  const setChatNotes = useStore((s) => s.setChatNotes);
  const toggleStar = useStore((s) => s.toggleStar);

  const files = chat.files ?? [];
  const starred = chat.messages.filter((m) => m.starred);

  const [seg, setSeg] = useState<Segment>("files");

  const SEGMENTS: { id: Segment; label: string; count?: number }[] = [
    { id: "files", label: "Dateien", count: files.length },
    { id: "starred", label: "Markiert", count: starred.length },
    { id: "notes", label: "Notizen" },
  ];

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden border-l border-border-light bg-main-light dark:border-border-dark dark:bg-main-dark">
      <header className="flex shrink-0 items-center gap-2 border-b border-border-light px-4 py-2 dark:border-border-dark">
        <PanelRight size={16} className="shrink-0 text-accent" />
        <span className="min-w-0 truncate text-sm font-medium">
          Zu diesem Chat
        </span>
        <button
          onClick={onClose}
          title="Schließen"
          className="ml-auto shrink-0 rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-200 dark:hover:bg-white/10"
        >
          <X size={18} />
        </button>
      </header>

      {/* Segment switch */}
      <div className="flex shrink-0 gap-1 border-b border-border-light p-2 dark:border-border-dark">
        {SEGMENTS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSeg(s.id)}
            className={clsx(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150",
              seg === s.id
                ? "bg-neutral-200 font-medium dark:bg-white/10"
                : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5"
            )}
          >
            {s.label}
            {s.count ? (
              <span className="rounded-full bg-accent/15 px-1.5 text-xs text-accent">
                {s.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {seg === "files" && <ArchivePanel files={files} onJump={onJump} />}

        {seg === "starred" &&
          (starred.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-neutral-500">
              Noch nichts markiert. Der Stern unter einer Nachricht sammelt sie
              hier.
            </p>
          ) : (
            <div className="space-y-1 p-2">
              {starred.map((m) => (
                <div
                  key={m.id}
                  className="group rounded-lg border border-border-light p-2 transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-medium text-neutral-500">
                      {m.role === "user" ? "Du" : "KI"}
                    </span>
                    <button
                      onClick={() => onJump(m.id)}
                      title="Zur Nachricht springen"
                      className="ml-auto rounded-lg p-1 text-neutral-400 transition hover:bg-neutral-200 hover:text-accent dark:hover:bg-white/10"
                    >
                      <ArrowUpRight size={15} />
                    </button>
                    <button
                      onClick={() => toggleStar(chat.id, m.id)}
                      title="Markierung entfernen"
                      className="rounded-lg p-1 text-accent transition hover:bg-neutral-200 dark:hover:bg-white/10"
                    >
                      <Star size={15} fill="currentColor" />
                    </button>
                  </div>
                  <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm text-neutral-600 dark:text-neutral-300">
                    {m.content}
                  </p>
                </div>
              ))}
            </div>
          ))}

        {seg === "notes" && (
          <textarea
            value={chat.notes ?? ""}
            onChange={(e) => setChatNotes(chat.id, e.target.value)}
            placeholder="Notizen zu diesem Chat…"
            className="min-h-0 flex-1 resize-none bg-transparent p-4 text-sm leading-6 outline-none placeholder:text-neutral-400"
          />
        )}
      </div>
    </div>
  );
}
