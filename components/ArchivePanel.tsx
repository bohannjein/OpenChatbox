"use client";

import {
  FileText,
  File as FileIcon,
  Image as ImageIcon,
  Code2,
  Download,
  ArrowUpRight,
} from "lucide-react";
import { download } from "@/lib/share";
import type { ChatFile } from "@/lib/types";

const iconFor = (k: ChatFile["kind"]) =>
  k === "image"
    ? ImageIcon
    : k === "code"
    ? Code2
    : k === "pdf"
    ? FileIcon
    : FileText;

/** "Dateien" tab of the chat info panel — the files of a single chat. The
 *  surrounding panel owns the header, so this renders the list only. */
export default function ArchivePanel({
  files,
  onJump,
}: {
  files: ChatFile[];
  onJump: (messageId: string) => void;
}) {
  const doDownload = (f: ChatFile) => {
    if (f.dataUrl) {
      const a = document.createElement("a");
      a.href = f.dataUrl;
      a.download = f.name;
      a.click();
    } else if (f.content != null) {
      download(f.name, f.content, "text/plain");
    }
  };

  return (
    <div className="p-2">
        {files.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-neutral-500">
            Noch keine Dateien in diesem Chat.
          </p>
        ) : (
          files
            .slice()
            .reverse()
            .map((f) => {
              const Icon = iconFor(f.kind);
              return (
                <div
                  key={f.id}
                  className="group flex items-center gap-2 rounded-lg px-2 py-2 transition hover:bg-neutral-100 dark:hover:bg-white/5"
                >
                  {f.kind === "image" && f.dataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.dataUrl}
                      alt={f.name}
                      className="h-9 w-9 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-neutral-200 text-neutral-500 dark:bg-white/10">
                      <Icon size={16} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm" title={f.name}>
                      {f.name}
                    </div>
                    <div className="text-xs text-neutral-400">
                      {f.source === "generated" ? "KI-generiert" : "Hochgeladen"}
                    </div>
                  </div>
                  <button
                    onClick={() => onJump(f.messageId)}
                    title="Zur Nachricht springen"
                    className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-200 hover:text-accent dark:hover:bg-white/10"
                  >
                    <ArrowUpRight size={16} />
                  </button>
                  <button
                    onClick={() => doDownload(f)}
                    title="Herunterladen"
                    className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-neutral-200 hover:text-accent dark:hover:bg-white/10"
                  >
                    <Download size={16} />
                  </button>
                </div>
              );
            })
        )}
    </div>
  );
}
