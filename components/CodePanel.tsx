"use client";

import { useEffect, useState } from "react";
import { X, Code2, Eye } from "lucide-react";
import clsx from "clsx";
import Markdown from "./Markdown";
import { CodePanelContext } from "./codePanelContext";
import { isPreviewable, buildPreviewDoc } from "@/lib/preview";

/** Isolated, editor-like view of a code block (right splitscreen), with an
 *  optional live "Vorschau" tab that renders HTML/Tailwind/SVG in a sandbox. */
export default function CodePanel({
  code,
  language,
  name,
  onClose,
}: {
  code: string;
  language: string;
  name?: string;
  onClose: () => void;
}) {
  const canPreview = isPreviewable(code, language);
  const [tab, setTab] = useState<"code" | "preview">("code");
  // If a block stops being previewable (e.g. switched to a JS file), fall back.
  useEffect(() => {
    if (!canPreview) setTab("code");
  }, [canPreview]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden border-l border-border-light bg-main-light dark:border-border-dark dark:bg-main-dark">
      <header className="flex shrink-0 items-center gap-2 border-b border-border-light px-4 py-2 dark:border-border-dark">
        <Code2 size={16} className="shrink-0 text-accent" />
        <span className="min-w-0 truncate text-sm font-medium">{name || "Code"}</span>
        {language && language !== "text" && (
          <span className="shrink-0 rounded bg-neutral-200 px-1.5 py-0.5 font-mono text-xs text-neutral-600 dark:bg-white/10 dark:text-neutral-300">
            {language}
          </span>
        )}
        <button
          onClick={onClose}
          title="Schließen"
          className="ml-auto shrink-0 rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-200 dark:hover:bg-white/10"
        >
          <X size={18} />
        </button>
      </header>

      {/* Code / Vorschau tabs — only when the block is renderable. */}
      {canPreview && (
        <div className="flex shrink-0 items-center gap-1 border-b border-border-light px-2 py-1.5 dark:border-border-dark">
          {(
            [
              { id: "code", label: "Code", Icon: Code2 },
              { id: "preview", label: "Vorschau", Icon: Eye },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={clsx(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors duration-150",
                tab === id
                  ? "bg-accent/15 font-medium text-accent"
                  : "text-neutral-500 hover:bg-neutral-200 dark:hover:bg-white/5"
              )}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      )}

      {canPreview && tab === "preview" ? (
        <div className="min-h-0 flex-1 bg-white">
          {/* Sandboxed: opaque origin (no allow-same-origin) so scripts can run
              for interactive HTML but can't touch the app, its cookies or storage. */}
          <iframe
            title="Vorschau"
            sandbox="allow-scripts allow-forms allow-popups allow-modals"
            srcDoc={buildPreviewDoc(code, language)}
            className="h-full w-full border-0"
          />
        </div>
      ) : (
        <div className="min-h-0 min-w-0 flex-1 overflow-auto p-3">
          {/* disable panel context here so the block renders as real code */}
          <CodePanelContext.Provider value={null}>
            <Markdown content={"```" + (language || "") + "\n" + code + "\n```"} />
          </CodePanelContext.Provider>
        </div>
      )}
    </div>
  );
}
