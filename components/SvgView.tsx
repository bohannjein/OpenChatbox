"use client";

import { useState } from "react";
import { Check, Copy, Download, Code2, Image as ImageIcon } from "lucide-react";
import { buildPreviewDoc } from "@/lib/preview";
import { copyText } from "@/lib/clipboard";
import { download } from "@/lib/share";

/**
 * Renders a model-generated SVG as a live, interactive image instead of raw XML.
 * The SVG is drawn inside a fully locked iframe (sandbox="" — no scripts, opaque
 * origin) so a malicious <script>/onload inside the SVG can't run in the app's
 * origin. The user can copy the XML, export a .svg file, or peek at the source.
 */
export default function SvgView({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const copy = async () => {
    if (await copyText(code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };
  const save = () => download("grafik.svg", code, "image/svg+xml");

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-border-light dark:border-border-dark">
      <div className="flex items-center justify-between border-b border-border-light bg-neutral-100 px-4 py-1.5 text-xs text-neutral-500 dark:border-border-dark dark:bg-[#1a1a1a]">
        <span className="flex items-center gap-1.5 font-mono">
          <ImageIcon size={13} className="text-accent" /> SVG
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowCode((v) => !v)}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 transition hover:text-neutral-800 dark:hover:text-neutral-200"
            title={showCode ? "Vorschau anzeigen" : "Quellcode anzeigen"}
          >
            <Code2 size={13} /> {showCode ? "Vorschau" : "Code"}
          </button>
          <button
            onClick={save}
            title="Als .svg exportieren"
            className="flex items-center gap-1 rounded px-1.5 py-0.5 transition hover:text-neutral-800 dark:hover:text-neutral-200"
          >
            <Download size={13} /> Export
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
      {showCode ? (
        <pre className="max-h-80 overflow-auto bg-[#f6f8fa] p-4 font-mono text-xs leading-6 dark:bg-[#0d1117]">
          {code}
        </pre>
      ) : (
        <iframe
          title="SVG-Vorschau"
          sandbox=""
          srcDoc={buildPreviewDoc(code, "svg")}
          className="h-72 w-full border-0 bg-white"
        />
      )}
    </div>
  );
}
