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
  FileText,
  Search,
  Loader2,
  Code,
  Bot,
  User,
  Globe,
  Library,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Markdown from "./Markdown";
import { useStore } from "@/lib/store";
import { copyText } from "@/lib/clipboard";
import { download } from "@/lib/share";
import { useT, type StringKey } from "@/lib/i18n";
import { SidekickAvatar } from "./SidekickIcon";
import type { Message, PipelineStage } from "@/lib/types";

/** Live Auto-pipeline stage → badge icon + i18n label. */
const PIPELINE_BADGE: Record<PipelineStage, { Icon: LucideIcon; key: StringKey }> = {
  ocr: { Icon: Search, key: "pipeline.ocr" },
  answer: { Icon: Brain, key: "pipeline.answer" },
  vision: { Icon: Search, key: "pipeline.vision" },
  coding: { Icon: Code, key: "pipeline.coding" },
  reasoning: { Icon: Brain, key: "pipeline.reasoning" },
  text: { Icon: Loader2, key: "pipeline.text" },
  imagegen: { Icon: Loader2, key: "pipeline.imagegen" },
  search: { Icon: Globe, key: "pipeline.search" },
  knowledge: { Icon: Library, key: "pipeline.knowledge" },
};

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
  const chatFiles = useStore((s) => s.chats.find((c) => c.id === chatId)?.files);
  const chatLayout = useStore((s) => s.chatLayout);
  const showAvatar = useStore((s) => s.chatShowAvatar);
  const showTimestamps = useStore((s) => s.chatShowTimestamps);
  const showStats = useStore((s) => s.chatShowStats);
  const assistantAvatarUrl = useStore((s) => s.assistantAvatarUrl);
  const sidekicks = useStore((s) => s.sidekicks);
  const t = useT();

  // Non-image uploads attached to this message (images already render inline).
  const attachments = (chatFiles ?? []).filter(
    (f) => f.messageId === message.id && f.source === "upload" && f.kind !== "image"
  );
  const attachChips =
    attachments.length > 0 ? (
      <div className="mb-1 flex flex-wrap justify-end gap-2">
        {attachments.map((f) => {
          const Icon = f.kind === "pdf" ? FileType : FileText;
          const clickable = !!f.content;
          return (
            <button
              key={f.id}
              onClick={() => f.content && download(f.name, f.content, "text/plain")}
              disabled={!clickable}
              title={f.content ? `${f.name} herunterladen` : f.name}
              className="flex items-center gap-2 rounded-xl border border-border-light bg-neutral-50 px-3 py-2 text-sm transition enabled:hover:border-accent enabled:hover:bg-accent/5 disabled:cursor-default dark:border-border-dark dark:bg-white/5"
            >
              <Icon size={16} className="shrink-0 text-accent" />
              <span className="max-w-[12rem] truncate">{f.name}</span>
              {clickable && <Download size={13} className="shrink-0 text-neutral-400" />}
            </button>
          );
        })}
      </div>
    ) : null;

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

  // ── Chat appearance (per-user settings) ────────────────────────────────
  const bubble = chatLayout === "bubble";
  // Which sidekick authored this assistant message (virtual conference room).
  const speaker =
    !isUser && message.sidekickId
      ? sidekicks.find((s) => s.id === message.sidekickId)
      : undefined;
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const words = message.content.trim() ? message.content.trim().split(/\s+/).length : 0;
  const approxTokens = Math.round(message.content.length / 4); // rough estimate

  const showModel = !isUser && !!message.model;
  const meta =
    showTimestamps || showStats || showModel ? (
      <div
        className={clsx(
          "mt-1 flex items-center gap-2 text-[11px] text-neutral-400",
          isUser && "justify-end"
        )}
      >
        {showModel && (
          <span
            className="inline-flex items-center gap-1"
            title={`Antwort erzeugt von ${message.model}`}
          >
            <Bot size={11} className="opacity-70" />
            {message.model}
          </span>
        )}
        {showTimestamps && <span>{time}</span>}
        {showStats && message.content && (
          <span>
            {words} Wörter · ~{approxTokens} Tokens
          </span>
        )}
      </div>
    ) : null;

  const assistantAvatar = (
    <div className="mt-0.5 shrink-0">
      {assistantAvatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={assistantAvatarUrl}
          alt="KI"
          className="h-8 w-8 rounded-full object-cover ring-1 ring-border-light dark:ring-border-dark"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Bot size={18} />
        </div>
      )}
    </div>
  );
  const userAvatar = (
    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-500 dark:bg-white/10 dark:text-neutral-300">
      <User size={18} />
    </div>
  );

  useEffect(() => {
    if (editing && editRef.current) {
      const el = editRef.current;
      el.focus();
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [editing]);

  const copy = async () => {
    if (await copyText(message.content)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
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
        <div className="mx-auto flex max-w-3xl justify-end gap-2.5">
          <div className="flex min-w-0 flex-1 flex-col items-end">
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
              {attachChips}
              {message.content && (
                <div
                  className={clsx(
                    "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-none px-4 py-2.5 leading-7",
                    bubble ? "bg-accent text-white" : "bg-accent/15"
                  )}
                >
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
              {meta}
            </>
          )}
          </div>
          {showAvatar && userAvatar}
        </div>
      </div>
    );
  }

  // ── Assistant message: clean & flat, no header/avatar (Gemini-style) ───
  return (
    <div id={`msg-${message.id}`} className="group animate-fade-in px-4 py-4">
      <div className="mx-auto max-w-3xl">
        <div className="flex gap-2.5">
          {showAvatar && !speaker && assistantAvatar}
          <div className="min-w-0 flex-1">
          {speaker && (
            <div className="mb-1.5 flex items-center gap-2">
              <SidekickAvatar icon={speaker.icon} color={speaker.color} size={22} />
              <span className="text-sm font-semibold">{speaker.name}</span>
            </div>
          )}
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
          {streaming && message.pipeline && !message.content && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-border-light px-3 py-2 text-sm text-neutral-500 dark:border-border-dark">
              {(() => {
                const { Icon } = PIPELINE_BADGE[message.pipeline];
                return (
                  <Icon
                    size={15}
                    className={clsx(
                      "shrink-0 text-accent",
                      Icon === Loader2 && "animate-spin"
                    )}
                  />
                );
              })()}
              <span className="animate-pulse font-medium">
                {t(PIPELINE_BADGE[message.pipeline].key)}
              </span>
            </div>
          )}

          {/* BookStack tool-call live status badges */}
          {message.toolEvents && message.toolEvents.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {message.toolEvents.map((ev, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300"
                >
                  <BookOpen size={15} className="shrink-0 text-emerald-500" />
                  <span
                    className={clsx(
                      "min-w-0 flex-1 truncate font-medium",
                      ev.status === "running" && "animate-pulse"
                    )}
                  >
                    {ev.label}
                    {ev.status === "running" ? "…" : ""}
                  </span>
                  {ev.status === "running" ? (
                    <Loader2 size={14} className="shrink-0 animate-spin text-emerald-500" />
                  ) : (
                    <Check size={14} className="shrink-0 text-emerald-500" />
                  )}
                </div>
              ))}
            </div>
          )}
          <div
            className={clsx(
              bubble &&
                "inline-block max-w-full rounded-2xl rounded-tl-none bg-bubble-light px-4 py-3 dark:bg-bubble-dark"
            )}
          >
            {message.content ? (
              <Markdown content={message.content} />
            ) : streaming && !message.reasoning && !message.pipeline ? (
              <span className="inline-block h-4 w-2 animate-blink bg-neutral-500 align-middle" />
            ) : null}
            {streaming && message.content && (
              <span className="ml-0.5 inline-block h-4 w-2 animate-blink bg-neutral-500 align-middle" />
            )}
          </div>

          {/* Generated image(s) — rendered inline. */}
          {message.images && message.images.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.images.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt={`Bild ${i + 1}`}
                  className="max-h-96 rounded-xl border border-border-light object-contain dark:border-border-dark"
                />
              ))}
            </div>
          )}

          {/* Auto-generated downloadable documents — edle Download-Karte */}
          {message.docs && message.docs.length > 0 && (
            <div className="mt-3 space-y-3">
              {message.docs.map((doc) => {
                const isPdf = doc.mime.includes("pdf");
                return (
                  <div
                    key={doc.id}
                    className="flex flex-col items-center gap-3 rounded-2xl border border-border-light bg-neutral-50 p-5 text-center shadow-sm dark:border-border-dark dark:bg-white/5 sm:max-w-sm"
                  >
                    <div
                      className={clsx(
                        "flex h-12 w-12 items-center justify-center rounded-xl",
                        isPdf
                          ? "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                          : "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                      )}
                    >
                      {isPdf ? <FileType size={26} /> : <FileSpreadsheet size={26} />}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{doc.name}</div>
                      <div className="text-xs text-neutral-400">
                        {(doc.size / 1024).toFixed(0)} KB ·{" "}
                        {isPdf ? "PDF-Dokument" : "Excel-Tabelle"}
                      </div>
                    </div>
                    <a
                      href={doc.dataUrl}
                      download={doc.name}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover"
                    >
                      <Download size={16} />
                      {isPdf ? "PDF-Dokument herunterladen" : "Tabelle herunterladen"}
                    </a>
                  </div>
                );
              })}
            </div>
          )}

          {/* BookStack sources — clickable links into the wiki */}
          {message.sources && message.sources.length > 0 && (
            <div className="mt-3 rounded-xl border border-border-light p-3 dark:border-border-dark">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                <BookOpen size={13} className="text-emerald-500" /> BookStack-Quellen
              </div>
              <div className="space-y-1">
                {message.sources.map((src, i) => (
                  <a
                    key={i}
                    href={src.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-accent transition hover:bg-neutral-100 dark:hover:bg-white/5"
                  >
                    <ExternalLink size={13} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{src.title}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {meta}

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
