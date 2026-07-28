"use client";

import { useEffect } from "react";
import { Github, ExternalLink, Sparkles, Tag } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  APP_VERSION,
  REPO_NAME,
  REPO_URL,
  REPO_CLONE_URL,
  CHANGELOG,
} from "@/lib/version";

/**
 * "Über OpenChatbox / Info" tab: current version, repository link, and the
 * "Was gibt's Neues?" changelog. Merely rendering this panel (i.e. the user
 * opened the Info tab) marks the latest changelog as seen — which clears the
 * notification dot everywhere and is persisted to the server profile.
 */
export default function AboutPanel() {
  const appName = useStore((s) => s.appName);
  const markWhatsNewSeen = useStore((s) => s.markWhatsNewSeen);

  useEffect(() => {
    markWhatsNewSeen();
  }, [markWhatsNewSeen]);

  return (
    <div className="space-y-6">
      {/* Identity + version */}
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Sparkles size={22} strokeWidth={1.5} />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">Über {appName || "OpenChatbox"}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-neutral-500">
            <Tag size={13} className="shrink-0" />
            Version <span className="font-mono text-neutral-700 dark:text-neutral-300">v{APP_VERSION}</span>
          </p>
        </div>
      </div>

      {/* Repository */}
      <div className="rounded-xl border border-border-light p-4 dark:border-border-dark">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Github size={16} strokeWidth={1.5} className="text-accent" />
          Repository
        </div>
        <p className="mt-1 font-mono text-sm text-neutral-600 dark:text-neutral-300">
          {REPO_NAME}
        </p>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 break-all text-sm text-accent underline underline-offset-2 transition-opacity hover:opacity-80"
        >
          {REPO_CLONE_URL}
          <ExternalLink size={13} className="shrink-0" />
        </a>
      </div>

      {/* What's New */}
      <div>
        <h4 className="mb-1 flex items-center gap-2 font-medium">
          <Sparkles size={16} strokeWidth={1.5} className="text-accent" />
          Was gibt&rsquo;s Neues?
        </h4>
        <p className="mb-3 text-sm text-neutral-500">
          Die neuesten Funktionen und Verbesserungen.
        </p>

        <div className="space-y-4">
          {CHANGELOG.map((entry, i) => (
            <div
              key={entry.version}
              className="relative border-l-2 border-border-light pl-4 dark:border-border-dark"
            >
              <span
                className={
                  "absolute -left-[5px] top-1.5 h-2 w-2 rounded-full " +
                  (i === 0 ? "bg-accent" : "bg-neutral-300 dark:bg-neutral-600")
                }
              />
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-sm font-medium">v{entry.version}</span>
                <span className="text-xs text-neutral-400">{entry.date}</span>
                {i === 0 && (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
                    aktuell
                  </span>
                )}
              </div>
              <ul className="mt-1.5 space-y-1">
                {entry.items.map((it, k) => (
                  <li
                    key={k}
                    className="flex gap-2 text-sm text-neutral-600 dark:text-neutral-300"
                  >
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent/60" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
