"use client";

import { useState } from "react";
import { Check, Copy, PanelRight, Code2, MessageSquare, Download } from "lucide-react";
import { useCodePanel } from "./codePanelContext";
import { langToExt } from "@/lib/providers";
import { download } from "@/lib/share";
import { isDocBlock } from "@/lib/docIntent";
import { copyText } from "@/lib/clipboard";

export default function CodeBlock({
  code,
  language,
  children,
}: {
  code: string;
  language?: string;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const panel = useCodePanel();
  // Render-lock: once this block is shown in the splitscreen, keep it locked
  // inline even while the answer streams. Exact equality flips token-by-token
  // during streaming (panel + inline grow separately) → prefix-tolerant match
  // keeps the SAME block suppressed and stops the layout from jumping.
  const norm = (s: string) => s.replace(/\s+$/, "");
  const a = panel?.panelCode != null ? norm(panel.panelCode) : null;
  const b = norm(code);
  const isInPanel =
    !!a && b.length > 0 && (a === b || a.startsWith(b) || b.startsWith(a));

  const saveFile = () =>
    download(`code.${langToExt(language || "text")}`, code, "text/plain");

  // Document blocks (generate-file tag or a full HTML document) never show as
  // code — the backend turns them into a real file. Placeholder while streaming.
  const docBlock = isDocBlock(language || "", code);

  const copy = async () => {
    if (await copyText(code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  if (docBlock) {
    return (
      <div className="my-3 flex items-center gap-2 rounded-xl border border-border-light bg-neutral-100 px-4 py-3 text-sm text-neutral-500 dark:border-border-dark dark:bg-white/5">
        <Code2 size={15} className="shrink-0 animate-pulse text-accent" />
        <span className="truncate">Dokument wird erstellt…</span>
      </div>
    );
  }

  // Shown as a compact placeholder while the code lives in the right splitscreen.
  if (isInPanel) {
    return (
      <div className="my-4 flex items-center justify-between gap-3 rounded-lg border border-border-light bg-neutral-100 px-4 py-3 text-sm dark:border-border-dark dark:bg-[#1a1a1a]">
        <span className="flex min-w-0 items-center gap-2 text-neutral-500">
          <Code2 size={15} className="shrink-0 text-accent" />
          <span className="truncate">
            Code im Splitscreen{language ? ` · ${language}` : ""}
          </span>
        </span>
        <button
          onClick={() => panel!.closePanel()}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-border-light px-2 py-1 text-xs transition hover:bg-white dark:border-border-dark dark:hover:bg-white/10"
        >
          <MessageSquare size={13} /> Im Chat anzeigen
        </button>
      </div>
    );
  }

  return (
    <div className="my-4 rounded-lg border border-border-light dark:border-border-dark">
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-lg border-b border-border-light bg-neutral-100 px-4 py-1.5 text-xs text-neutral-500 dark:border-border-dark dark:bg-[#1a1a1a]">
        <span className="font-mono">{language || "text"}</span>
        <div className="flex items-center gap-1">
          {panel && (
            <button
              onClick={() => panel.openInPanel(code, language || "text")}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 transition hover:text-neutral-800 dark:hover:text-neutral-200"
              title="Im Splitscreen öffnen"
            >
              <PanelRight size={13} /> Splitscreen
            </button>
          )}
          <button
            onClick={saveFile}
            title={`Herunterladen (.${langToExt(language || "text")})`}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 transition hover:text-neutral-800 dark:hover:text-neutral-200"
          >
            <Download size={13} /> Download
          </button>
          <button
            onClick={copy}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 transition hover:text-neutral-800 dark:hover:text-neutral-200"
          >
            {copied ? (
              <>
                <Check size={13} /> Kopiert
              </>
            ) : (
              <>
                <Copy size={13} /> Kopieren
              </>
            )}
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto rounded-b-lg bg-[#f6f8fa] p-4 text-sm leading-6 dark:bg-[#0d1117]">
        {children}
      </pre>
    </div>
  );
}
