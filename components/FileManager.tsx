"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Download,
  Trash2,
  FileType,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Upload,
} from "lucide-react";
import { useStore } from "@/lib/store";

/** Mirror of lib/server/files.ts FileMeta (client copy). */
interface FileMeta {
  id: string;
  chatId: string;
  messageId: string;
  name: string;
  kind: "image" | "text" | "code" | "pdf" | "other";
  source: "upload" | "generated";
  mime: string;
  size: number;
  createdAt: number;
}

const iconFor = (kind: FileMeta["kind"]) =>
  kind === "image"
    ? ImageIcon
    : kind === "pdf"
    ? FileType
    : kind === "code"
    ? FileText
    : kind === "other"
    ? FileSpreadsheet
    : FileText;

/**
 * Global, cross-chat file manager. Lists every file the user has uploaded or
 * generated (persisted server-side), grouped by chat, with download + delete.
 */
export default function FileManager() {
  const open = useStore((s) => s.filesOpen);
  const setOpen = useStore((s) => s.setFilesOpen);
  const chats = useStore((s) => s.chats);
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/files")
      .then((r) => (r.ok ? r.json() : { files: [] }))
      .then((d) => setFiles(Array.isArray(d.files) ? d.files : []))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, setOpen]);

  const remove = async (id: string) => {
    await fetch(`/api/files/${id}`, { method: "DELETE" }).catch(() => {});
    setFiles((f) => f.filter((x) => x.id !== id));
  };

  if (!mounted || !open) return null;

  const titleOf = (chatId: string) =>
    chats.find((c) => c.id === chatId)?.title || "Ohne Chat";
  // Group by chat, chats with files first (newest file wins ordering).
  const groups = new Map<string, FileMeta[]>();
  for (const f of files) {
    const arr = groups.get(f.chatId) ?? [];
    arr.push(f);
    groups.set(f.chatId, arr);
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 print:hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border-light bg-white shadow-2xl dark:border-border-dark dark:bg-sidebar-dark">
        <div className="flex items-center justify-between border-b border-border-light px-5 py-3 dark:border-border-dark">
          <h2 className="font-semibold">Dateimanager</h2>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-200/70 hover:text-neutral-700 dark:hover:bg-white/10"
            aria-label="Schließen"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-neutral-400">Lädt…</p>
          ) : files.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-400">
              Noch keine Dateien. Hochgeladene und erzeugte Dateien erscheinen hier.
            </p>
          ) : (
            <div className="space-y-5">
              {[...groups.entries()].map(([chatId, group]) => (
                <div key={chatId}>
                  <div className="mb-2 truncate text-xs font-medium uppercase tracking-wide text-neutral-400">
                    {titleOf(chatId)}
                  </div>
                  <div className="space-y-2">
                    {group.map((f) => {
                      const Icon = iconFor(f.kind);
                      return (
                        <div
                          key={f.id}
                          className="flex items-center gap-3 rounded-xl border border-border-light bg-neutral-50 px-3 py-2 dark:border-border-dark dark:bg-white/5"
                        >
                          <Icon size={18} className="shrink-0 text-accent" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-medium">{f.name}</span>
                              {f.source === "generated" ? (
                                <Sparkles size={12} className="shrink-0 text-emerald-500" />
                              ) : (
                                <Upload size={12} className="shrink-0 text-neutral-400" />
                              )}
                            </div>
                            <div className="text-xs text-neutral-400">
                              {(f.size / 1024).toFixed(0)} KB ·{" "}
                              {f.source === "generated" ? "KI-generiert" : "Hochgeladen"}
                            </div>
                          </div>
                          <a
                            href={`/api/files/${f.id}`}
                            download={f.name}
                            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-200/70 hover:text-accent dark:hover:bg-white/10"
                            title="Herunterladen"
                          >
                            <Download size={16} />
                          </a>
                          <button
                            onClick={() => remove(f.id)}
                            className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950/40"
                            title="Löschen"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
