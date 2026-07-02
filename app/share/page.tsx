"use client";

import { useEffect, useState } from "react";
import { Bot, User, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Markdown from "@/components/Markdown";
import { decodeSharedChat, type SharedChat } from "@/lib/share";

export default function SharePage() {
  const [chat, setChat] = useState<SharedChat | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // theme
    try {
      // Store is namespaced per user (key = "openchatbox-store::" + uid).
      const uid = localStorage.getItem("nexus-uid") || "anon";
      const s = JSON.parse(
        localStorage.getItem(`openchatbox-store::${uid}`) ||
          localStorage.getItem(`chatbot-ui-store::${uid}`) ||
          localStorage.getItem("chatbot-ui-store") ||
          "{}"
      );
      if (s?.state?.theme === "dark")
        document.documentElement.classList.add("dark");
    } catch {
      /* ignore */
    }
    setChat(decodeSharedChat(window.location.hash));
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <div className="min-h-dvh bg-main-light dark:bg-main-dark">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border-light bg-main-light/90 px-4 py-3 backdrop-blur dark:border-border-dark dark:bg-main-dark/90">
        <Link
          href="/"
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-200 dark:hover:bg-white/10"
        >
          <ArrowLeft size={16} /> Zur App
        </Link>
        <span className="truncate font-semibold">
          {chat?.title ?? "Geteilter Chat"}
        </span>
        <span className="ml-auto rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-600 dark:bg-white/10 dark:text-neutral-300">
          Nur-Lese-Ansicht
        </span>
      </header>

      {!chat ? (
        <div className="mx-auto max-w-3xl px-4 py-16 text-center text-neutral-500">
          Kein gültiger geteilter Chat in der URL.
        </div>
      ) : (
        <div className="mx-auto max-w-3xl px-4 py-6">
          {chat.messages.map((m, i) => (
            <div key={i} className="flex gap-4 py-5">
              <div
                className={
                  m.role === "user"
                    ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-300 text-neutral-700 dark:bg-neutral-600 dark:text-neutral-100"
                    : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white"
                }
              >
                {m.role === "user" ? <User size={17} /> : <Bot size={17} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 text-sm font-semibold">
                  {m.role === "user" ? "Du" : "Assistant"}
                </div>
                {m.role === "user" ? (
                  <div className="whitespace-pre-wrap break-words leading-7">
                    {m.content}
                  </div>
                ) : (
                  <Markdown content={m.content} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
