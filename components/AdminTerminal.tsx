"use client";

import { useEffect, useRef, useState } from "react";
import { TerminalSquare, CornerDownLeft, Square, Trash2 } from "lucide-react";
import clsx from "clsx";

type Line = { kind: "in" | "out" | "err"; text: string };

const QUICK = ["ollama list", "ollama ps", "ollama version", "status", "help"];

/**
 * Admin web-terminal. Sends a command to the admin-only streaming endpoint and
 * renders the NDJSON output live. Only `ollama <cmd>` (mapped to the Ollama
 * HTTP API) and `status`/`help` are accepted; there is no shell on the server.
 */
export default function AdminTerminal({ baseUrl }: { baseUrl?: string }) {
  const [lines, setLines] = useState<Line[]>([
    { kind: "out", text: 'OpenChatbox Admin-Terminal — tippe "help".' },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [hist, setHist] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  const push = (l: Line) => setLines((prev) => [...prev, l]);

  const run = async (raw: string) => {
    const cmd = raw.trim();
    if (!cmd || busy) return;
    setHist((h) => [...h, cmd]);
    setHistIdx(-1);
    setInput("");

    if (cmd === "clear") {
      setLines([]);
      return;
    }
    push({ kind: "in", text: `$ ${cmd}` });
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch("/api/admin/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd, baseUrl }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        push({ kind: "err", text: await res.text().catch(() => `HTTP ${res.status}`) });
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n");
        buf = parts.pop() ?? "";
        for (const p of parts) {
          if (!p.trim()) continue;
          try {
            const evt = JSON.parse(p) as { t: string; v: string };
            if (evt.t === "out") push({ kind: "out", text: evt.v });
            else if (evt.t === "err") push({ kind: "err", text: evt.v });
          } catch {
            /* ignore partial */
          }
        }
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError")
        push({ kind: "err", text: e instanceof Error ? e.message : String(e) });
      else push({ kind: "err", text: "^C abgebrochen" });
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      run(input);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!hist.length) return;
      const i = histIdx < 0 ? hist.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(i);
      setInput(hist[i]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx < 0) return;
      const i = histIdx + 1;
      if (i >= hist.length) {
        setHistIdx(-1);
        setInput("");
      } else {
        setHistIdx(i);
        setInput(hist[i]);
      }
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <TerminalSquare size={16} className="text-accent" />
        <h3 className="font-medium">Server-Terminal</h3>
        <span className="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-600 dark:bg-white/10 dark:text-neutral-300">
          nur Admin · nur Ollama
        </span>
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <button
            key={q}
            onClick={() => run(q)}
            disabled={busy}
            className="rounded-md border border-border-light px-2 py-1 font-mono text-xs text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-40 dark:border-border-dark dark:text-neutral-300 dark:hover:bg-white/5"
          >
            {q}
          </button>
        ))}
        <button
          onClick={() => setLines([])}
          className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
          title="Leeren"
        >
          <Trash2 size={12} /> Clear
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 font-mono text-[13px] leading-relaxed text-neutral-200 shadow-inner">
        <div ref={scrollRef} className="max-h-80 overflow-y-auto px-3 py-2">
          {lines.map((l, i) => (
            <pre
              key={i}
              className={clsx(
                "whitespace-pre-wrap break-words",
                l.kind === "in" && "text-accent",
                l.kind === "err" && "text-red-400",
                l.kind === "out" && "text-neutral-300"
              )}
            >
              {l.text}
            </pre>
          ))}
          {busy && <pre className="animate-pulse text-neutral-500">…</pre>}
        </div>

        <div className="flex items-center gap-2 border-t border-neutral-800 px-3 py-2">
          <span className="select-none text-accent">$</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            placeholder='z. B. "ollama list"'
            className="min-w-0 flex-1 bg-transparent text-neutral-100 outline-none placeholder:text-neutral-600"
          />
          {busy ? (
            <button
              onClick={() => abortRef.current?.abort()}
              title="Abbrechen (^C)"
              className="flex items-center gap-1 rounded-md bg-red-600/80 px-2 py-1 text-xs text-white hover:bg-red-600"
            >
              <Square size={11} /> Stop
            </button>
          ) : (
            <button
              onClick={() => run(input)}
              disabled={!input.trim()}
              title="Ausführen (⏎)"
              className="flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs font-medium text-white transition hover:bg-accent-hover disabled:opacity-40"
            >
              <CornerDownLeft size={12} /> Run
            </button>
          )}
        </div>
      </div>
      {!baseUrl && (
        <p className="mt-1.5 text-xs text-amber-500">
          Kein Ollama-Server gewählt — ollama-Befehle brauchen einen Server.
        </p>
      )}
    </div>
  );
}
