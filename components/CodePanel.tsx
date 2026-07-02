"use client";

import { X, Code2 } from "lucide-react";
import Markdown from "./Markdown";
import { CodePanelContext } from "./codePanelContext";

/** Isolated, editor-like view of a code block (right splitscreen). */
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
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden border-l border-border-light bg-main-light dark:border-border-dark dark:bg-main-dark">
      <header className="flex shrink-0 items-center gap-2 border-b border-border-light px-4 py-2 dark:border-border-dark">
        <Code2 size={16} className="shrink-0 text-accent" />
        <span className="min-w-0 truncate text-sm font-medium">
          {name || "Code"}
        </span>
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
      <div className="min-h-0 min-w-0 flex-1 overflow-auto p-3">
        {/* disable panel context here so the block renders as real code */}
        <CodePanelContext.Provider value={null}>
          <Markdown content={"```" + (language || "") + "\n" + code + "\n```"} />
        </CodePanelContext.Provider>
      </div>
    </div>
  );
}
