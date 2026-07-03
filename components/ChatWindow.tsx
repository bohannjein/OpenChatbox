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
  FolderOpen,
  Trash2,
} from "lucide-react";
import { useStore } from "@/lib/store";
import {
  parseModelKey,
  streamChat,
  loadAllModels,
  displayName,
  detectCodeBlock,
  extractMemory,
  listCodeBlocks,
  langToExt,
} from "@/lib/providers";
import CodePanel from "./CodePanel";
import ArchivePanel from "./ArchivePanel";
import { CodePanelContext } from "./codePanelContext";
import { SidekickAvatar } from "./SidekickIcon";
import type { ChatFile, Message, Role } from "@/lib/types";
import type { Attachment } from "@/lib/files";
import { buildShareLink, chatToMarkdown, download } from "@/lib/share";
import { useClickOutside } from "@/lib/useClickOutside";
import { useAutoTitle } from "@/lib/useAutoTitle";
import { routeModelKey, wantsOcr, OCR_SYSTEM_HINT } from "@/lib/modelRouter";
import { languageConstraint } from "@/lib/langDetect";
import {
  detectDocIntent,
  parseGenerateFileBlocks,
  stripGenerateFileBlocks,
} from "@/lib/docIntent";
import { useT } from "@/lib/i18n";
import ModelSwitcher from "./ModelSwitcher";
import ParamsPopover from "./ParamsPopover";
import ChatMessage from "./ChatMessage";
import ChatInput, { type ChatInputHandle } from "./ChatInput";
import clsx from "clsx";

// Heuristik: ist der neue Codeblock ein Update des bisherigen (weiterarbeiten
// im selben File) statt ein neues, unabhängiges Snippet?
function isCodeUpdate(
  prev: { code: string; lang: string },
  next: { code: string; lang: string },
  userText: string
): boolean {
  if (prev.lang !== next.lang) return false;
  // explizite Update-Absicht im Prompt
  if (
    /\b(füg|ergänz|änder|hinzu|dort|erweiter|refactor|passe|update|weiter|obig|dazu|verbesser|korrigier|fix|selbe|gleiche)/i.test(
      userText
    )
  )
    return true;
  // sonst: Zeilen-Ähnlichkeit
  const a = new Set(
    prev.code.split("\n").map((l) => l.trim()).filter(Boolean)
  );
  const b = next.code.split("\n").map((l) => l.trim()).filter(Boolean);
  if (a.size === 0 || b.length === 0) return false;
  const inter = b.filter((l) => a.has(l)).length;
  const sim = inter / Math.min(a.size, b.length);
  return sim > 0.3;
}

/** Index of the last assistant message, -1 if none (no array copies). */
function lastAssistantIdx(messages: Message[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") return i;
  }
  return -1;
}

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
  const autoRouter = useStore((s) => s.autoRouter);
  const routerVisionKey = useStore((s) => s.routerVisionKey);
  const routerOcrKey = useStore((s) => s.routerOcrKey);
  const plugins = useStore((s) => s.plugins);
  const attachGeneratedDoc = useStore((s) => s.attachGeneratedDoc);
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
  const keepChat = useStore((s) => s.keepChat);
  const deleteChat = useStore((s) => s.deleteChat);
  const setChatTemporary = useStore((s) => s.setChatTemporary);
  const setDraft = useStore((s) => s.setDraft);
  const addChatFiles = useStore((s) => s.addChatFiles);
  const authUser = useStore((s) => s.authUser);
  const incognito = useStore((s) => s.incognito);
  const setIncognito = useStore((s) => s.setIncognito);
  const aliases = useStore((s) => s.aliases);
  const codeSplitEnabled = useStore((s) => s.codeSplitEnabled);
  const codeSplitThreshold = useStore((s) => s.codeSplitThreshold);
  const ollamaKeepAlive = useStore((s) => s.ollamaKeepAlive);
  const vramManaged = useStore((s) => s.vramManaged);
  const sidekicks = useStore((s) => s.sidekicks);
  const memory = useStore((s) => s.memory);
  const memoryEnabled = useStore((s) => s.memoryEnabled);
  const addMemory = useStore((s) => s.addMemory);

  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [codePanel, setCodePanel] = useState<{
    code: string;
    lang: string;
    name: string;
  } | null>(null);
  const [panelMsgId, setPanelMsgId] = useState<string | null>(null);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const fileSeq = useRef(0);
  const [panelWidth, setPanelWidth] = useState(560);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [ghostMenu, setGhostMenu] = useState(false);
  const ghostRef = useRef<HTMLDivElement>(null);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const move = (ev: MouseEvent) => {
      const w = window.innerWidth - ev.clientX;
      setPanelWidth(Math.min(Math.max(w, 320), window.innerWidth - 300));
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };
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

  // Auto-open / continue the code splitscreen for the latest answer's code.
  useEffect(() => {
    if (!codeSplitEnabled) {
      setCodePanel(null);
      return;
    }
    const idx = lastAssistantIdx(messages);
    if (idx < 0) return;
    const lastAssist = messages[idx];
    const blk = detectCodeBlock(lastAssist.content, codeSplitThreshold);
    if (!blk || dismissedFor === lastAssist.id) return;

    // last user prompt right before this assistant message
    const userText =
      messages
        .slice(0, idx)
        .reverse()
        .find((m) => m.role === "user")?.content ?? "";

    setCodePanel((prev) => {
      // same message still streaming → keep file, just refresh content
      if (panelMsgId === lastAssist.id && prev)
        return { ...prev, code: blk.code, lang: blk.lang };
      // new assistant message → update existing file or start a new one
      const update = prev && isCodeUpdate(prev, blk, userText);
      const name =
        update && prev
          ? prev.name
          : `code-${++fileSeq.current}.${langToExt(blk.lang)}`;
      return { code: blk.code, lang: blk.lang, name };
    });
    setPanelMsgId(lastAssist.id);
  }, [messages, codeSplitEnabled, codeSplitThreshold, dismissedFor]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeCodePanel = () => {
    setCodePanel(null);
    const last = messages[lastAssistantIdx(messages)];
    setDismissedFor(last?.id ?? panelMsgId);
  };

  const openInPanel = (code: string, lang: string) => {
    setCodePanel((prev) =>
      prev && prev.code.trim() === code.trim()
        ? prev
        : { code, lang, name: `code-${++fileSeq.current}.${langToExt(lang)}` }
    );
    const last = messages[lastAssistantIdx(messages)];
    setDismissedFor(last?.id ?? null);
    setPanelMsgId(last?.id ?? null);
  };

  const codeCtx = {
    panelCode: codePanel?.code ?? null,
    openInPanel,
    closePanel: closeCodePanel,
  };

  const jumpToMessage = (messageId: string) => {
    setArchiveOpen(false);
    requestAnimationFrame(() =>
      document
        .getElementById(`msg-${messageId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };

  useClickOutside(shareRef, () => setShareOpen(false));
  useClickOutside(ghostRef, () => setGhostMenu(false));

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreamingId(null);
  };

  // Hidden background request that names the chat after the first answer.
  const autoTitle = useAutoTitle();
  const t = useT();

  /** Resolve the provider + model for a given model key. */
  const resolveModel = (key: string | null) => {
    if (!key) throw new Error("Kein Modell ausgewählt.");
    const { providerId, model } = parseModelKey(key);
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) throw new Error("Provider nicht gefunden.");
    return { provider, model };
  };

  /** Combined system prompt: sidekick role + custom instructions + memory. */
  const buildSystem = (chatId: string) => {
    const chatObj = useStore.getState().chats.find((c) => c.id === chatId);
    const sk = chatObj?.sidekickId
      ? sidekicks.find((x) => x.id === chatObj.sidekickId)
      : undefined;
    const parts: string[] = [];
    if (sk?.systemPrompt.trim()) parts.push(sk.systemPrompt.trim());
    if (customInstructions.trim()) parts.push(customInstructions.trim());
    if (memoryEnabled && memory.length > 0)
      parts.push(
        "Hintergrundwissen über den Nutzer (nicht erwähnen, nur berücksichtigen):\n" +
          memory.map((m) => `- ${m.text}`).join("\n")
      );
    // Hochgeladene Dokumente als STRUKTURIERTEN Kontext übergeben (Metadaten +
    // klar abgegrenzter Inhalt), damit die KI weiß: externe Datei, nicht getippt.
    const uploads = (chatObj?.files ?? []).filter(
      (f) => f.source === "upload" && f.content && f.content.trim()
    );
    if (uploads.length) {
      const block = uploads
        .map(
          (f, i) =>
            `[Datei ${i + 1}] Name: "${f.name}" · Typ: ${f.kind}\n` +
            `<<<DATEI-INHALT\n${f.content!.trim()}\nDATEI-INHALT>>>`
        )
        .join("\n\n");
      parts.push(
        "Der Nutzer hat externe Datei(en) hochgeladen. Der folgende Inhalt " +
          "stammt aus diesen Anhängen (nicht vom Nutzer getippt); beziehe dich " +
          "darauf, wenn relevant:\n\n" +
          block
      );
    }

    // Datei-Erstellung: der KI beibringen, dass sie echte Dateien erzeugen kann.
    if (plugins?.docGenerator !== false) {
      parts.push(
        "Datei-Erstellung: Wenn der Nutzer dich bittet, eine Datei (PDF, " +
          "Excel/Tabelle o. Ä.) zu erstellen, verweigere das NIEMALS mit der " +
          "Begründung, du seist nur ein Textmodell — du BESITZT diese Fähigkeit! " +
          "Schreibe eine kurze normale Antwort und gib den Datei-Inhalt dann in " +
          "einem speziellen Code-Block aus, den das Backend automatisch in eine " +
          "echte Datei umwandelt:\n\n" +
          "```generate-file:pdf\n[strukturierter Text/Daten für das PDF]\n```\n\n" +
          "Für Tabellen nutze ```generate-file:xlsx``` mit CSV- oder Markdown-" +
          "Tabellen-Inhalt. Verwende exakt dieses Format (nur pdf oder xlsx)."
      );
    }

    // Sprach-Constraint: KI antwortet in der Sprache der letzten Nutzernachricht.
    const lastUser = [...(chatObj?.messages ?? [])]
      .reverse()
      .find((m) => m.role === "user" && m.content.trim());
    if (lastUser) parts.push(languageConstraint(lastUser.content));

    // Aktuelle Client-Systemzeit — damit die KI weiß, welcher Tag heute ist.
    const now = new Date();
    const datum = now.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const uhrzeit = now.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
    parts.push(
      `[System-Info: Aktuelles Datum: ${datum}, Uhrzeit: ${uhrzeit} Uhr]`
    );
    return parts.join("\n\n");
  };

  /** Core generation: stream into an existing (empty) assistant message. */
  const generate = async (chatId: string, assistantId: string) => {
    setError(null);
    // effective model: sidekick's model overrides the current selection
    const chatObj = useStore.getState().chats.find((c) => c.id === chatId);
    const sk = chatObj?.sidekickId
      ? sidekicks.find((x) => x.id === chatObj.sidekickId)
      : undefined;
    let effectiveKey = sk?.modelKey || selectedModelKey;

    // Auto-router: pick vision/OCR/text per turn from the attachments of the
    // message we're answering. A sidekick's own model always wins.
    let routeRole: "text" | "vision" | "ocr" = "text";
    if (autoRouter && !sk) {
      const idxU = chatObj?.messages.findIndex((m) => m.id === assistantId) ?? -1;
      const lastUser = [...(chatObj?.messages.slice(0, idxU) ?? [])]
        .reverse()
        .find((m) => m.role === "user");
      const hasImage = !!lastUser?.images?.length;
      const hasDoc = !!chatObj?.files?.some(
        (f) =>
          f.messageId === lastUser?.id &&
          (f.kind === "pdf" || f.kind === "text" || f.kind === "other")
      );
      if (hasImage || hasDoc) {
        try {
          const { options } = await loadAllModels(providers);
          const ocrOn = plugins?.ocrEngine !== false; // admin master-switch
          const routed = routeModelKey(
            { textKey: effectiveKey, visionKey: routerVisionKey, ocrKey: routerOcrKey },
            {
              hasImage,
              hasDoc: hasDoc && ocrOn,
              ocrIntent: ocrOn && wantsOcr(lastUser?.content ?? ""),
            },
            options
          );
          if (routed.key) {
            effectiveKey = routed.key;
            routeRole = routed.role;
          }
        } catch {
          /* routing failed → keep the primary model */
        }
      }
    }

    let provider: ReturnType<typeof resolveModel>["provider"];
    let model: string;
    try {
      ({ provider, model } = resolveModel(effectiveKey));
    } catch (e) {
      setError((e as Error).message);
      setMessageContent(chatId, assistantId, `⚠️ ${(e as Error).message}`);
      return;
    }

    let system = buildSystem(chatId);
    // Quick-OCR pipeline: when routed to a vision/OCR model, instruct it to read
    // & structure the document before answering.
    if (routeRole === "vision" || routeRole === "ocr")
      system = (system ? system + "\n\n" : "") + OCR_SYSTEM_HINT;

    // Build history = all messages before the assistant message.
    const cur = useStore.getState().chats.find((c) => c.id === chatId);
    const idx = cur?.messages.findIndex((m) => m.id === assistantId) ?? -1;
    const prior = idx >= 0 ? cur!.messages.slice(0, idx) : [];
    const history: { role: Role; content: string; images?: string[] }[] = [
      ...(system
        ? [{ role: "system" as Role, content: system }]
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
          keepAlive: vramManaged ? ollamaKeepAlive : undefined,
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
      // archive AI-generated code blocks as downloadable files
      const finalMsg = useStore
        .getState()
        .chats.find((c) => c.id === chatId)
        ?.messages.find((x) => x.id === assistantId);
      const blocks = finalMsg ? listCodeBlocks(finalMsg.content) : [];
      if (blocks.length) {
        const files: ChatFile[] = blocks.map((b, i) => ({
          id: crypto.randomUUID(),
          messageId: assistantId,
          name: `code-${Date.now().toString().slice(-5)}-${i + 1}.${langToExt(
            b.lang
          )}`,
          kind: "code",
          source: "generated",
          content: b.code,
          language: b.lang,
          createdAt: Date.now(),
        }));
        addChatFiles(chatId, files);
      }
      abortRef.current = null;
      setStreamingId(null);
    }
  };

  const handleSend = async (
    text: string,
    images?: string[],
    attachments?: Attachment[]
  ) => {
    let chatId = activeChatId;
    if (!chatId) chatId = newChat();
    const userId = addMessage(chatId, "user", text, images);
    // track uploads in the chat's file archive
    if (attachments && attachments.length) {
      const files: ChatFile[] = attachments.map((a) => ({
        id: crypto.randomUUID(),
        messageId: userId,
        name: a.name,
        kind: a.kind,
        source: "upload",
        dataUrl: a.dataUrl,
        content: a.text,
        createdAt: Date.now(),
      }));
      addChatFiles(chatId, files);
    }
    const assistantId = addMessage(chatId, "assistant", "");
    // Promote a fresh chat to its own URL (no remount: activeChatId unchanged).
    const c = useStore.getState().chats.find((x) => x.id === chatId);
    if (c && !c.temporary) router.push(`/c/${chatId}`);
    await generate(chatId, assistantId);

    // After the first complete answer: name the chat via a hidden model call.
    autoTitle(chatId);

    // Invisible document generator: if the prompt asked for a PDF/Excel and the
    // admin enabled the service, turn the AI's answer into a real file and
    // attach it under the message. Fully automatic — no user action needed.
    if (plugins?.docGenerator !== false) {
      const answer =
        useStore
          .getState()
          .chats.find((c) => c.id === chatId)
          ?.messages.find((m) => m.id === assistantId)?.content ?? "";
      // Primary: explicit ```generate-file:<kind>``` blocks emitted by the model.
      // Fallback: prompt intent → use the whole answer as content.
      const blocks = parseGenerateFileBlocks(answer);
      const fallbackKind = detectDocIntent(text);
      const jobs =
        blocks.length > 0
          ? blocks
          : fallbackKind && answer.trim()
          ? [{ kind: fallbackKind, content: answer }]
          : [];

      if (jobs.length) {
        // Hide the raw generate-file block; show a clean answer + download chip.
        if (blocks.length) {
          const cleaned = stripGenerateFileBlocks(answer);
          setMessageContent(chatId, assistantId, cleaned || "Datei erstellt.");
        }
        for (const job of jobs) {
          try {
            const res = await fetch("/api/generate-doc", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ kind: job.kind, title: text.slice(0, 80), content: job.content }),
            });
            const d = await res.json();
            if (res.status === 403) {
              appendToMessage(chatId, assistantId, `\n\n_(${d.error || "Dienst deaktiviert."})_`);
              break;
            } else if (res.ok && d.dataUrl) {
              attachGeneratedDoc(chatId, assistantId, {
                id: crypto.randomUUID(),
                name: d.name,
                mime: d.mime,
                dataUrl: d.dataUrl,
                size: d.size,
              });
            }
          } catch {
            /* ignore generation errors */
          }
        }
      }
    }

    // Extract durable user facts in the background (non-temporary chats only).
    if (memoryEnabled && text.trim() && !c?.temporary) {
      const chatObj = useStore.getState().chats.find((x) => x.id === chatId);
      const sk = chatObj?.sidekickId
        ? sidekicks.find((x) => x.id === chatObj.sidekickId)
        : undefined;
      const key = sk?.modelKey || selectedModelKey;
      if (key) {
        try {
          const { provider, model } = resolveModel(key);
          const facts = await extractMemory(
            {
              type: provider.type,
              baseUrl: provider.baseUrl,
              apiKey: provider.apiKey,
              model,
            },
            text,
            useStore.getState().memory.map((m) => m.text)
          );
          facts.forEach((f) => addMemory(f));
        } catch {
          /* ignore extraction failures */
        }
      }
    }
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

  // Label reflects the active sidekick (its name + model) when one is set,
  // otherwise the plainly selected model. Matches the effective model used for
  // generation (sk.modelKey overrides selectedModelKey).
  const labelSk = chat?.sidekickId
    ? sidekicks.find((x) => x.id === chat.sidekickId)
    : undefined;
  const labelKey = labelSk?.modelKey || selectedModelKey;
  const modelLabel = labelSk
    ? labelSk.name
    : autoRouter
    ? "Auto"
    : labelKey
    ? displayName(aliases, labelKey, parseModelKey(labelKey).model)
    : null;
  const hasMessages = messages.length > 0;
  const activeSidekick = chat?.sidekickId
    ? sidekicks.find((x) => x.id === chat.sidekickId)
    : undefined;
  const chatFiles = chat?.files ?? [];

  // Random, name-aware greeting per chat.
  const greeting = useMemo(() => {
    const name = authUser?.username || "";
    const suffix = name ? `, ${name}` : "";
    const h = new Date().getHours();
    const daypart = h < 11 ? "Morgen" : h < 18 ? "Tag" : "Abend";
    const options = [
      `Guten ${daypart}${suffix}! Was kann ich heute für dich tun?`,
      `Hallo${suffix}, bereit für neue Projekte?`,
      `Wie kann ich dir heute helfen${suffix}?`,
      `Schön dich zu sehen${suffix}. Womit legen wir los?`,
      `Womit kann ich dir heute helfen${suffix}?`,
    ];
    return options[Math.floor(Math.random() * options.length)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatId, authUser?.username]);

  return (
    <div className="flex h-full overflow-hidden">
      <CodePanelContext.Provider value={codeCtx}>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
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
        {activeSidekick && (
          <span className="flex items-center gap-1.5 rounded-lg bg-accent/15 px-2 py-1 text-sm font-medium text-accent">
            <SidekickAvatar
              icon={activeSidekick.icon}
              color={activeSidekick.color}
              size={20}
            />
            {activeSidekick.name}
          </span>
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
            onClick={() => setArchiveOpen((v) => !v)}
            title="Archiv"
            className={clsx(
              "relative rounded-lg p-2 transition",
              archiveOpen
                ? "bg-accent/15 text-accent"
                : "text-neutral-500 hover:bg-neutral-200 dark:hover:bg-white/10"
            )}
          >
            <FolderOpen size={18} />
            {chatFiles.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium text-white">
                {chatFiles.length}
              </span>
            )}
          </button>
          <div className="relative" ref={ghostRef}>
            <button
              onClick={() => {
                if (isTemp) {
                  setGhostMenu((v) => !v);
                } else {
                  setIncognito(true);
                  if (chat && chat.messages.length === 0)
                    setChatTemporary(chat.id, true); // convert empty chat in place
                  else router.push("/"); // fresh temp chat
                }
              }}
              title={
                isTemp
                  ? "Temporären Chat verwalten"
                  : "Inkognito an (temporärer Chat)"
              }
              className={clsx(
                "rounded-lg p-2 transition",
                isTemp || incognito
                  ? "bg-accent/15 text-accent"
                  : "text-neutral-500 hover:bg-neutral-200 dark:hover:bg-white/10"
              )}
            >
              <Ghost size={18} />
            </button>
            {ghostMenu && isTemp && chat && (
              <div className="absolute right-0 top-full z-40 mt-1 w-56 menu-panel p-1">
                <MenuItem
                  onClick={() => {
                    setGhostMenu(false);
                    keepChat(chat.id);
                    setIncognito(false);
                    router.push(`/c/${chat.id}`);
                  }}
                >
                  <Check size={15} /> Chat behalten & speichern
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setGhostMenu(false);
                    setIncognito(false);
                    deleteChat(chat.id);
                    newChat(false); // fresh normal chat (stays on "/")
                  }}
                >
                  <Trash2 size={15} /> Chat jetzt löschen
                </MenuItem>
              </div>
            )}
          </div>

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
              <div className="absolute right-0 top-full z-40 mt-1 w-56 menu-panel p-1">
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
                <button
                  disabled
                  title="In Kürze verfügbar"
                  className="flex w-full cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-400"
                >
                  <FileDown size={15} /> Als PDF exportieren
                  <span className="ml-auto rounded bg-neutral-200 px-1.5 text-[10px] dark:bg-white/10">
                    bald
                  </span>
                </button>
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
              <h1 className="font-sans text-3xl font-normal tracking-tight sm:text-4xl">
                {greeting}
              </h1>
              <p className="mt-3 text-sm text-neutral-500">
                {modelLabel
                  ? `${labelSk ? "Sidekick" : "Modell"}: ${modelLabel}`
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
              placeholder={t("input.placeholder")}
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
            placeholder={t("input.placeholder")}
          />
        </>
      )}

      {/* Dezenter rechtlicher Hinweis — ganz unten im Chat-Fenster. */}
      <footer className="shrink-0 px-4 pb-2 text-center text-[11px] leading-tight text-neutral-400 dark:text-neutral-500 print:hidden">
        {t("chat.disclaimer")}
      </footer>
      </div>
      </CodePanelContext.Provider>

      {/* Right splitscreen — archive takes precedence, else code. Resizable. */}
      {(archiveOpen || codePanel) && (
        <div
          className="relative flex min-w-0 shrink-0 overflow-hidden"
          style={{ width: panelWidth, maxWidth: "85vw" }}
        >
          <div
            onMouseDown={startResize}
            className="absolute left-0 top-0 z-20 h-full w-1.5 -translate-x-1/2 cursor-col-resize bg-transparent transition hover:bg-accent/40"
            title="Breite ziehen"
          />
          {archiveOpen ? (
            <ArchivePanel
              files={chatFiles}
              onJump={jumpToMessage}
              onClose={() => setArchiveOpen(false)}
            />
          ) : (
            codePanel && (
              <CodePanel
                code={codePanel.code}
                language={codePanel.lang}
                name={codePanel.name}
                onClose={closeCodePanel}
              />
            )
          )}
        </div>
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
