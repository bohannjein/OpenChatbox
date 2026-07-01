"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PanelLeftOpen,
  Ghost,
  Share2,
  Link as LinkIcon,
  FileDown,
  Printer,
  Check,
  Code2,
  Languages,
  Mail,
  Sparkles,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { parseModelKey, streamChat } from "@/lib/providers";
import { buildShareLink, chatToMarkdown, download } from "@/lib/share";
import ModelSwitcher from "./ModelSwitcher";
import ParamsPopover from "./ParamsPopover";
import ChatMessage from "./ChatMessage";
import ChatInput, { type ChatInputHandle } from "./ChatInput";
import clsx from "clsx";
import type { Role } from "@/lib/types";

const STARTERS = [
  { icon: Code2, title: "Python-Skript schreiben", prompt: "Schreibe ein Python-Skript, das " },
  { icon: Languages, title: "Text übersetzen", prompt: "Übersetze den folgenden Text ins Englische:\n\n" },
  { icon: Mail, title: "E-Mail formulieren", prompt: "Formuliere eine professionelle E-Mail an einen Kunden über " },
  { icon: Sparkles, title: "Text analysieren", prompt: "Analysiere den folgenden Text und fasse die Kernaussagen zusammen:\n\n" },
];

export default function ChatWindow() {
  const router = useRouter();
  const chats = useStore((s) => s.chats);
  const activeChatId = useStore((s) => s.activeChatId);
  const providers = useStore((s) => s.providers);
  const selectedModelKey = useStore((s) => s.selectedModelKey);
  const customInstructions = useStore((s) => s.customInstructions);
  const paramsCfg = useStore((s) => s.params);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const addMessage = useStore((s) => s.addMessage);
  const appendToMessage = useStore((s) => s.appendToMessage);
  const appendReasoning = useStore((s) => s.appendReasoning);
  const setMessageContent = useStore((s) => s.setMessageContent);
  const startRegenerate = useStore((s) => s.startRegenerate);
  const finalizeVariant = useStore((s) => s.finalizeVariant);
  const editUserMessage = useStore((s) => s.editUserMessage);
  const newChat = useStore((s) => s.newChat);
  const setDraft = useStore((s) => s.setDraft);
  const incognito = useStore((s) => s.incognito);
  const setIncognito = useStore((s) => s.setIncognito);

  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<ChatInputHandle>(null);
  const shareRef = useRef<HTMLDivElement>(null);

  const chat = useMemo(
    () => chats.find((c) => c.id === activeChatId) ?? null,
    [chats, activeChatId]
  );
  const messages = chat?.messages ?? [];
  const isTemp = !!chat?.temporary;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, streamingId, chat?.messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node))
        setShareOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreamingId(null);
  };

  /** Resolve the provider + model for the current selection. */
  const resolveModel = () => {
    if (!selectedModelKey) throw new Error("Kein Modell ausgewählt.");
    const { providerId, model } = parseModelKey(selectedModelKey);
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) throw new Error("Provider nicht gefunden.");
    return { provider, model };
  };

  /** Core generation: stream into an existing (empty) assistant message. */
  const generate = async (chatId: string, assistantId: string) => {
    setError(null);
    let provider, model;
    try {
      ({ provider, model } = resolveModel());
    } catch (e) {
      setError((e as Error).message);
      setMessageContent(chatId, assistantId, `⚠️ ${(e as Error).message}`);
      return;
    }

    // Build history = all messages before the assistant message.
    const cur = useStore.getState().chats.find((c) => c.id === chatId);
    const idx = cur?.messages.findIndex((m) => m.id === assistantId) ?? -1;
    const prior = idx >= 0 ? cur!.messages.slice(0, idx) : [];
    const history: { role: Role; content: string; images?: string[] }[] = [
      ...(customInstructions.trim()
        ? [{ role: "system" as Role, content: customInstructions.trim() }]
        : []),
      ...prior.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.images && m.images.length ? { images: m.images } : {}),
      })),
    ].filter((m) => m.role === "system" || m.content.trim() || m.images);

    setStreamingId(assistantId);
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      await streamChat(
        {
          type: provider.type,
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
          model,
          messages: history,
          params: paramsCfg,
        },
        (t, text) =>
          t === "r"
            ? appendReasoning(chatId, assistantId, text)
            : appendToMessage(chatId, assistantId, text),
        ac.signal
      );
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        const m = useStore
          .getState()
          .chats.find((c) => c.id === chatId)
          ?.messages.find((x) => x.id === assistantId);
        if (m && !m.content)
          setMessageContent(chatId, assistantId, `⚠️ Fehler: ${msg}`);
      }
    } finally {
      finalizeVariant(chatId, assistantId);
      abortRef.current = null;
      setStreamingId(null);
    }
  };

  const handleSend = async (text: string, images?: string[]) => {
    let chatId = activeChatId;
    if (!chatId) chatId = newChat();
    addMessage(chatId, "user", text, images);
    const assistantId = addMessage(chatId, "assistant", "");
    // Promote a fresh chat to its own URL (no remount: activeChatId unchanged).
    const c = useStore.getState().chats.find((x) => x.id === chatId);
    if (c && !c.temporary) router.push(`/c/${chatId}`);
    await generate(chatId, assistantId);
  };

  const handleRegenerate = async (assistantId: string) => {
    if (!activeChatId || streamingId) return;
    startRegenerate(activeChatId, assistantId);
    await generate(activeChatId, assistantId);
  };

  const handleEditUser = async (userMsgId: string, newText: string) => {
    if (!activeChatId || streamingId) return;
    editUserMessage(activeChatId, userMsgId, newText); // truncates after
    const assistantId = addMessage(activeChatId, "assistant", "");
    await generate(activeChatId, assistantId);
  };

  const doShareLink = async () => {
    if (!chat) return;
    try {
      await navigator.clipboard.writeText(buildShareLink(chat));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  const doExportMd = () => {
    if (!chat) return;
    download(`${chat.title || "chat"}.md`, chatToMarkdown(chat));
    setShareOpen(false);
  };

  const modelLabel = selectedModelKey
    ? parseModelKey(selectedModelKey).model
    : null;
  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <header className="flex items-center gap-1 border-b border-border-light px-3 py-2 dark:border-border-dark print:hidden">
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-200 dark:hover:bg-white/5"
            title="Sidebar öffnen"
          >
            <PanelLeftOpen size={18} />
          </button>
        )}
        <ModelSwitcher />
        <ParamsPopover />

        {isTemp && (
          <span className="ml-1 flex items-center gap-1 rounded-full bg-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600 dark:bg-white/10 dark:text-neutral-300">
            <Ghost size={13} /> Temporär
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => {
              const next = !incognito;
              setIncognito(next);
              router.push("/");
            }}
            title={
              incognito
                ? "Inkognito aus (normalen Chat starten)"
                : "Inkognito an (temporärer Chat)"
            }
            className={clsx(
              "rounded-lg p-2 transition",
              incognito
                ? "bg-accent/15 text-accent"
                : "text-neutral-500 hover:bg-neutral-200 dark:hover:bg-white/10"
            )}
          >
            <Ghost size={18} />
          </button>

          {/* Share menu */}
          <div className="relative" ref={shareRef}>
            <button
              onClick={() => setShareOpen((v) => !v)}
              disabled={!hasMessages}
              title="Teilen / Exportieren"
              className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-200 disabled:opacity-30 dark:hover:bg-white/10"
            >
              <Share2 size={18} />
            </button>
            {shareOpen && (
              <div className="absolute right-0 top-full z-40 mt-1 w-56 rounded-xl border border-border-light bg-white p-1 shadow-xl dark:border-border-dark dark:bg-sidebar-dark">
                <MenuItem onClick={doShareLink}>
                  {copied ? <Check size={15} /> : <LinkIcon size={15} />}
                  {copied ? "Link kopiert!" : "Share-Link kopieren"}
                </MenuItem>
                <MenuItem onClick={doExportMd}>
                  <FileDown size={15} /> Als Markdown
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setShareOpen(false);
                    window.print();
                  }}
                >
                  <Printer size={15} /> Drucken / PDF
                </MenuItem>
                {isTemp && (
                  <p className="px-3 py-1.5 text-xs text-neutral-400">
                    Hinweis: Temporäre Chats werden nicht gespeichert.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {!hasMessages ? (
        /* Gemini-style centered start screen */
        <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8">
          <div className="w-full max-w-3xl animate-fade-in">
            {isTemp && (
              <div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-border-light bg-bubble-light px-4 py-1.5 text-sm text-neutral-600 dark:border-border-dark dark:bg-bubble-dark dark:text-neutral-300">
                <Ghost size={15} />
                Temporärer Chat — nichts wird gespeichert.
              </div>
            )}

            <div className="mb-7 text-center">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Wie kann ich dir heute helfen?
              </h1>
              <p className="mt-3 text-sm text-neutral-500">
                {modelLabel
                  ? `Modell: ${modelLabel}`
                  : "Wähle oben ein Modell, um zu starten."}
              </p>
            </div>

            <ChatInput
              ref={inputRef}
              glow
              bare
              onSend={handleSend}
              onStop={stop}
              streaming={streamingId !== null}
              initialText={chat?.draft ?? ""}
              onDraftChange={(t) => activeChatId && setDraft(activeChatId, t)}
              placeholder={
                modelLabel ? `Nachricht an ${modelLabel}…` : "Nachricht senden…"
              }
            />

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {STARTERS.map((s) => (
                <button
                  key={s.title}
                  onClick={() => inputRef.current?.setText(s.prompt)}
                  className="flex items-start gap-3 rounded-xl border border-border-light p-4 text-left transition hover:bg-neutral-100 hover:shadow-sm dark:border-border-dark dark:hover:bg-white/5"
                >
                  <s.icon size={18} className="mt-0.5 shrink-0 text-accent" />
                  <span className="text-sm font-medium">{s.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto print:overflow-visible"
          >
            {isTemp && (
              <div className="mx-auto mt-4 flex max-w-3xl items-center gap-2 rounded-lg border border-border-light bg-bubble-light px-4 py-2 text-sm text-neutral-600 dark:border-border-dark dark:bg-bubble-dark dark:text-neutral-300">
                <Ghost size={16} />
                Temporärer Chat — wird nicht im Verlauf gespeichert und
                verschwindet beim Schließen.
              </div>
            )}
            <div className="pb-6">
              {messages.map((m) => (
                <ChatMessage
                  key={m.id}
                  chatId={chat!.id}
                  message={m}
                  streaming={m.id === streamingId}
                  onRegenerate={handleRegenerate}
                  onEditUser={handleEditUser}
                />
              ))}
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mx-auto mb-2 w-full max-w-3xl px-4">
              <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            </div>
          )}

          {/* Input (docked bottom) */}
          <ChatInput
            ref={inputRef}
            onSend={handleSend}
            onStop={stop}
            streaming={streamingId !== null}
            initialText={chat?.draft ?? ""}
            onDraftChange={(t) => activeChatId && setDraft(activeChatId, t)}
            placeholder={
              modelLabel ? `Nachricht an ${modelLabel}…` : "Nachricht senden…"
            }
          />
        </>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
        "hover:bg-neutral-100 dark:hover:bg-white/10"
      )}
    >
      {children}
    </button>
  );
}
