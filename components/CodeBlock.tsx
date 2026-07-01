"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-border-light dark:border-border-dark">
      <div className="flex items-center justify-between bg-neutral-100 px-4 py-1.5 text-xs text-neutral-500 dark:bg-[#1a1a1a]">
        <span className="font-mono">{language || "text"}</span>
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
      <pre className="overflow-x-auto bg-[#f6f8fa] p-4 text-sm leading-6 dark:bg-[#0d1117]">
        {children}
      </pre>
    </div>
  );
}
