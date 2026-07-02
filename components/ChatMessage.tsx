"use client";

import { useState, useRef, useEffect } from "react";
import clsx from "clsx";
import {
  Copy,
  Check,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Volume2,
  Square,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Brain,
  Download,
  FileSpreadsheet,
  FileType,
} from "lucide-react";
import Markdown from "./Markdown";
import { useStore } from "@/lib/store";
import type { Message } from "@/lib/types";

export default function ChatMessage({
  chatId,
  message,
  streaming,
  onRegenerate,
  onEditUser,
}: {
  chatId: string;
  message: Message;
  streaming?: boolean;
  onRegenerate: (msgId: string) => void;
  onEditUser: (msgId: string, newText: string) => void;
}) {
  const setActiveVariant = useStore((s) => s.setActiveVariant);
  const setFeedback = useStore((s) => s.setFeedback);

  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const isUser = message.role === "user";
  const variants = message.variants;
  const hasVariants = !!variants && variants.length > 1;
  const active = message.activeVariant ?? 0;

  useEffect(() => {
    if (editing && editRef.current) {
      const el = editRef.current;
      el.focus();
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [editing]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const speak = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(message.content);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };

  const saveEdit = () => {
    const t = draft.trim();
    setEditing(false);
    if (t && t !== message.content) onEditUser(message.id, t);
  };

  // ── User message: minimalist colored bubble, right-aligned ─────────────
  if (isUser) {
    return (
      <div id={`msg-${message.id}`} className="group animate-fade-in px-4 py-3">
        <div className="mx-auto flex max-w-3xl flex-col items-end">
          {editing ? (
            <div className="w-full rounded-2xl border border-border-light bg-bubble-light p-2 dark:border-border-dark dark:bg-bubble-dark">
              <textarea
                ref={editRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    saveEdit();
                  }
                  if (e.key === "Escape") setEditing(false);
                }}
                className="max-h-72 w-full resize-none bg-transparent px-2 py-1 leading-7 outline-none"
              />
              <div className="mt-1 flex justify-end gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-lg px-3 py-1 text-sm hover:bg-neutral-200 dark:hover:bg-white/10"
                >
                  Abbrechen
                </button>
                <button
                  onClick={saveEdit}
                  className="rounded-lg bg-accent px-3 py-1 text-sm font-medium text-white hover:bg-accent-hover"
                >
                  Senden
                </button>
              </div>
            </div>
          ) : (
            <>
              {message.images && message.images.length > 0 && (
                <div className="mb-2 flex flex-wrap justify-end gap-2">
                  {message.images.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={src}
                      alt={`Anhang ${i + 1}`}
                      className="max-h-48 rounded-2xl rounded-tr-none border border-border-light object-cover dark:border-border-dark"
                    />
                  ))}
                </div>
              )}
              {message.content && (
                <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-none bg-accent/15 px-4 py-2.5 leading-7">
                  {message.content}
                </div>
              )}
              {/* Actions */}
              <div className="mt-1 flex items-center gap-1 text-neutral-400 print:hidden">
                {message.content && (
                  <IconBtn onClick={copy} title="Kopieren">
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                  </IconBtn>
                )}
                <IconBtn
                  onClick={() => {
                    setDraft(message.content);
                    setEditing(true);
                  }}
                  title="Bearbeiten"
                >
                  <Pencil size={15} />
                </IconBtn>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Assistant message: clean & flat, no header/avatar (Gemini-style) ───
  return (
    <div id={`msg-${message.id}`} className="group animate-fade-in px-4 py-4">
      <div className="mx-auto max-w-3xl">
        <div className="min-w-0">
          {message.reasoning && message.reasoning.trim() && (
            <div className="mb-3 rounded-xl border border-border-light dark:border-border-dark">
              <button
                onClick={() => setShowReasoning((v) => !v)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-500 transition hover:text-neutral-700 dark:hover:text-neutral-300"
              >
                <Brain size={15} />
                <span className="font-medium">
                  {streaming && !message.content
                    ? "Denkt nach…"
                    : "Denkprozess"}
                </span>
                <ChevronDown
                  size={15}
                  className={clsx(
                    "ml-auto transition",
                    showReasoning && "rotate-180"
                  )}
                />
              </button>
              {showReasoning && (
                <div className="whitespace-pre-wrap border-t border-border-light px-3 py-2 text-sm leading-6 text-neutral-500 dark:border-border-dark">
                  {message.reasoning}
                </div>
              )}
            </div>
          )}
          {message.content ? (
            <Markdown content={message.content} />
          ) : streaming && !message.reasoning ? (
            <span className="inline-block h-4 w-2 animate-blink bg-neutral-500 align-middle" />
          ) : null}
          {streaming && message.content && (
            <span className="ml-0.5 inline-block h-4 w-2 animate-blink bg-neutral-500 align-middle" />
          )}

          {/* Auto-generated downloadable files (PDF/Excel) */}
          {message.docs && message.docs.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.docs.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.dataUrl}
                  download={doc.name}
                  title={`${doc.name} herunterladen`}
                  className="group flex items-center gap-2 rounded-xl border border-border-light bg-neutral-50 px-3 py-2 text-sm transition hover:border-accent hover:bg-accent/5 dark:border-border-dark dark:bg-white/5"
                >
                  {doc.mime.includes("pdf") ? (
                    <FileType size={18} className="shrink-0 text-red-500" />
                  ) : (
                    <FileSpreadsheet size={18} className="shrink-0 text-emerald-600" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{doc.name}</span>
                    <span className="block text-xs text-neutral-400">
                      {(doc.size / 1024).toFixed(0)} KB
                    </span>
                  </span>
                  <Download
                    size={15}
                    className="ml-1 shrink-0 text-neutral-400 transition group-hover:text-accent"
                  />
                </a>
              ))}
            </div>
          )}

          {/* Action bar */}
          {!streaming && (
            <div className="mt-2 flex items-center gap-1 text-neutral-400 print:hidden">
              {/* Variant pager (assistant, >1 variant) */}
              {!isUser && hasVariants && (
                <div className="mr-1 flex items-center gap-0.5 text-xs text-neutral-500">
                  <button
                    onClick={() =>
                      setActiveVariant(chatId, message.id, active - 1)
                    }
                    disabled={active <= 0}
                    className="rounded p-0.5 hover:text-neutral-700 disabled:opacity-30 dark:hover:text-neutral-200"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="tabular-nums">
                    {active + 1}/{variants!.length}
                  </span>
                  <button
                    onClick={() =>
                      setActiveVariant(chatId, message.id, active + 1)
                    }
                    disabled={active >= variants!.length - 1}
                    className="rounded p-0.5 hover:text-neutral-700 disabled:opacity-30 dark:hover:text-neutral-200"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}

              {message.content && (
                <IconBtn onClick={copy} title="Kopieren">
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </IconBtn>
              )}

              <IconBtn
                onClick={() => onRegenerate(message.id)}
                title="Neu generieren"
              >
                <RefreshCw size={15} />
              </IconBtn>
              <IconBtn onClick={speak} title="Vorlesen">
                {speaking ? <Square size={15} /> : <Volume2 size={15} />}
              </IconBtn>
              <IconBtn
                onClick={() => setFeedback(chatId, message.id, "up")}
                title="Gute Antwort"
                active={message.feedback === "up"}
              >
                <ThumbsUp size={15} />
              </IconBtn>
              <IconBtn
                onClick={() => setFeedback(chatId, message.id, "down")}
                title="Schlechte Antwort"
                active={message.feedback === "down"}
              >
                <ThumbsDown size={15} />
              </IconBtn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={clsx(
        "rounded-lg p-1.5 transition hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-white/10 dark:hover:text-neutral-200",
        active
          ? "text-accent opacity-100"
          : "opacity-0 group-hover:opacity-100"
      )}
    >
      {children}
    </button>
  );
}
