"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useImperativeHandle,
  useMemo,
  forwardRef,
} from "react";
import {
  ArrowUp,
  Square,
  BookText,
  Paperclip,
  X,
  FileText,
  File as FileIcon,
  Cpu,
  Sparkles,
  Globe,
  Library,
} from "lucide-react";
import clsx from "clsx";
import { useStore } from "@/lib/store";
import {
  ACCEPT,
  processFile,
  imageDataUrls,
  type Attachment,
} from "@/lib/files";
import { loadAllModels, displayName } from "@/lib/providers";
import { resizeImageToAttachment } from "@/lib/imageResize";
import { pdfToImages } from "@/lib/pdfToImages";
import { useT } from "@/lib/i18n";
import { uid } from "@/lib/uid";
import type { ModelOption } from "@/lib/types";

// Highlight the matched substring in the accent color.
function highlightMatch(text: string, q: string) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <span className="font-semibold text-accent">
        {text.slice(i, i + q.length)}
      </span>
      {text.slice(i + q.length)}
    </>
  );
}

export interface ChatInputHandle {
  setText: (t: string) => void;
  focus: () => void;
}

interface Props {
  onSend: (
    text: string,
    images?: string[],
    attachments?: Attachment[]
  ) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
  placeholder?: string;
  initialText?: string;
  onDraftChange?: (t: string) => void;
  /** show the animated multicolor AI glow (empty/start screen). */
  glow?: boolean;
  /** remove outer padding/hint (used inside the centered start layout). */
  bare?: boolean;
}

const ChatInput = forwardRef<ChatInputHandle, Props>(function ChatInput(
  {
    onSend,
    onStop,
    streaming,
    disabled,
    placeholder,
    initialText,
    onDraftChange,
    glow,
    bare,
  },
  ref
) {
  const prompts = useStore((s) => s.prompts);
  const toggleWebSearch = useStore((s) => s.toggleWebSearch);
  const webSearchEnabled = useStore((s) => s.webSearchEnabled);
  const toggleKb = useStore((s) => s.toggleKb);
  const kbEnabled = useStore((s) => s.kbEnabled);
  const providers = useStore((s) => s.providers);
  const aliases = useStore((s) => s.aliases);
  const selectModel = useStore((s) => s.selectModel);
  const activeChatId = useStore((s) => s.activeChatId);
  const setChatSidekick = useStore((s) => s.setChatSidekick);
  const t = useT();
  const [modelOpts, setModelOpts] = useState<ModelOption[]>([]);
  useEffect(() => {
    loadAllModels(providers).then((r) => setModelOpts(r.options));
  }, [providers]);
  const [value, setValue] = useState(initialText ?? "");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [picIdx, setPicIdx] = useState(0);
  const [menuClosed, setMenuClosed] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Slash commands (keyboard-driven). Enter runs them, Tab completes the name.
  const COMMANDS = useMemo(
    () => [
      {
        cmd: "/file",
        label: "Datei hochladen",
        Icon: Paperclip,
        inline: false,
        run: () => fileRef.current?.click(),
      },
      {
        // inline: completing "/model " opens the model list INSIDE this menu,
        // so there is no direct `run` action (the inline path never calls it).
        cmd: "/model",
        label: "Modell wählen",
        Icon: Cpu,
        inline: true,
      },
      {
        cmd: "/sidekick",
        label: "Sidekick wechseln / erstellen",
        Icon: Sparkles,
        inline: false,
        run: () => window.dispatchEvent(new Event("openModelSwitcher")),
      },
      {
        cmd: "/search",
        label: "Internetsuche umschalten",
        Icon: Globe,
        inline: false,
        run: () => toggleWebSearch(),
      },
    ],
    [toggleWebSearch]
  );

  useImperativeHandle(ref, () => ({
    setText: (t) => {
      setValue(t);
      onDraftChange?.(t);
      requestAnimationFrame(() => taRef.current?.focus());
    },
    focus: () => taRef.current?.focus(),
  }));

  const autoGrow = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 240) + "px";
  }, []);
  useEffect(autoGrow, [value, autoGrow]);

  const changeValue = (v: string) => {
    setValue(v);
    onDraftChange?.(v);
  };

  // "/" menu: commands + prompt templates, filtered by the text after "/"
  const slashQuery =
    value.startsWith("/") && !value.includes("\n") ? value.slice(1) : null;
  const q = (slashQuery ?? "").toLowerCase();
  type Item =
    | { type: "cmd"; cmd: (typeof COMMANDS)[number] }
    | { type: "prompt"; prompt: (typeof prompts)[number] }
    | { type: "model"; option: ModelOption };

  // "/model <query>" → inline model autocomplete
  const modelMode = slashQuery != null && /^model\s/i.test(slashQuery);
  const modelQuery = modelMode ? slashQuery!.replace(/^model\s*/i, "") : "";
  const nameOf = (o: ModelOption) => displayName(aliases, o.key, o.model);

  const items: Item[] = modelMode
    ? modelOpts
        .filter(
          (o) =>
            nameOf(o).toLowerCase().includes(modelQuery.toLowerCase()) ||
            o.model.toLowerCase().includes(modelQuery.toLowerCase())
        )
        .slice(0, 30)
        .map((o) => ({ type: "model" as const, option: o }))
    : slashQuery == null
    ? []
    : [
        ...COMMANDS.filter(
          (c) =>
            c.cmd.slice(1).startsWith(q) || c.label.toLowerCase().includes(q)
        ).map((c) => ({ type: "cmd" as const, cmd: c })),
        ...prompts
          .filter(
            (p) =>
              p.title.toLowerCase().includes(q) ||
              (p.shortcut ?? "").toLowerCase().includes(q)
          )
          .map((p) => ({ type: "prompt" as const, prompt: p })),
      ];
  const pickerOpen = slashQuery != null && items.length > 0 && !menuClosed;

  // ghost preview: remaining chars of the top model match
  const topModel =
    modelMode && items[0]?.type === "model" ? items[0].option : null;
  const ghost =
    topModel && modelQuery
      ? (() => {
          const n = nameOf(topModel);
          return n.toLowerCase().startsWith(modelQuery.toLowerCase())
            ? n.slice(modelQuery.length)
            : "";
        })()
      : "";

  useEffect(() => {
    setPicIdx(0);
    setMenuClosed(false);
  }, [value]);

  const caretEnd = (text: string) =>
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(text.length, text.length);
      }
    });

  const applyPrompt = (content: string) => {
    changeValue(content);
    setMenuClosed(true);
    caretEnd(content);
  };

  // Complete a command name into the field ("/mo" → "/model ") — used by inline
  // commands (e.g. /model) so their picker opens right here in the slash menu.
  const completeCommand = (cmd: string) => {
    const text = cmd + " ";
    changeValue(text);
    caretEnd(text);
  };

  // Enter / Tab → run the command's action, then clear the slash text
  const runCommand = (c: (typeof COMMANDS)[number]) => {
    changeValue("");
    setMenuClosed(true);
    c.run?.(); // inline commands (e.g. /model) have no run — expanded in-menu
    requestAnimationFrame(() => taRef.current?.focus());
  };

  // Modell wählen: sofort im Hintergrund wechseln (wie Klick im Dropdown),
  // Sidekick des Chats lösen, Textfeld leeren.
  const applyModel = (o: ModelOption) => {
    selectModel(o.key);
    if (activeChatId) setChatSidekick(activeChatId, null);
    changeValue("");
    setMenuClosed(true);
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const chooseItem = (it: Item) => {
    if (it.type === "model") return applyModel(it.option);
    if (it.type === "prompt") return applyPrompt(it.prompt.content);
    // inline commands (e.g. /model) expand into their picker inside this menu;
    // the rest run their action directly.
    if (it.cmd.inline) return completeCommand(it.cmd.cmd);
    runCommand(it.cmd);
  };

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
    const images = list.filter((f) => f.type.startsWith("image/"));
    const pdfs = list.filter(isPdf);
    const others = list.filter((f) => !f.type.startsWith("image/") && !isPdf(f));
    const failedPdfs: File[] = [];
    const collected: Attachment[] = [];

    // Images: downscale + re-encode client-side so the base64 stays small.
    // (Raw photos otherwise exceed the /api/chat body limit → "invalid json".)
    for (const f of images) {
      try {
        collected.push(await resizeImageToAttachment(f));
      } catch {
        try {
          collected.push(await processFile(f));
        } catch {
          collected.push({
            id: uid(),
            name: f.name,
            size: f.size,
            kind: "other",
            note: "Bild konnte nicht verarbeitet werden.",
          });
        }
      }
    }

    // PDFs: render pages to images so vision/OCR models can actually read them.
    for (const f of pdfs) {
      try {
        const pages = await pdfToImages(f);
        if (!pages.length) throw new Error("no pages");
        pages.forEach((dataUrl, i) =>
          collected.push({
            id: uid(),
            name: pages.length > 1 ? `${f.name} · S.${i + 1}` : f.name,
            size: Math.floor((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75),
            kind: "image",
            dataUrl,
          })
        );
      } catch (e) {
        // Surface the real render/worker error — otherwise the PDF silently
        // becomes a note and the vision model sees nothing ("no file content").
        console.error("pdfToImages failed", e);
        failedPdfs.push(f); // fall back to server upload (note)
      }
    }

    // Documents: multipart upload endpoint → clean JSON; fallback local.
    const toUpload = [...others, ...failedPdfs];
    if (toUpload.length) {
      try {
        const fd = new FormData();
        for (const f of toUpload) fd.append("files", f);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok || !Array.isArray(data.files))
          throw new Error(data?.error || `Upload fehlgeschlagen (HTTP ${res.status})`);
        collected.push(...(data.files as Attachment[]));
      } catch {
        const results = await Promise.allSettled(toUpload.map(processFile));
        results.forEach((r, i) =>
          collected.push(
            r.status === "fulfilled"
              ? r.value
              : {
                  id: uid(),
                  name: toUpload[i]?.name ?? "Datei",
                  size: toUpload[i]?.size ?? 0,
                  kind: "other",
                  note: "Datei konnte nicht verarbeitet werden.",
                }
          )
        );
      }
    }

    if (collected.length) setAttachments((a) => [...a, ...collected]);
  };
  const removeAttachment = (id: string) =>
    setAttachments((a) => a.filter((x) => x.id !== id));

  // Drag & Drop: ganze Eingabebox ist Ablagezone.
  const onDragOver = (e: React.DragEvent) => {
    // nur auf Dateien reagieren (nicht auf markierten Text etc.)
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    // Immer als Drop-Ziel beanspruchen — auch wenn disabled — damit der Browser
    // die Datei nicht öffnet/navigiert und den Chat verwirft.
    e.preventDefault();
    if (!disabled && !dragActive) setDragActive(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    // Kind-Elemente lösen leave aus — ignorieren, solange Cursor in der Box bleibt.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragActive(false);
  };
  const onDrop = (e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    e.preventDefault();
    setDragActive(false);
    if (disabled) return;
    addFiles(e.dataTransfer.files);
  };

  // Riesen-Paste (>2000 Zeichen) → als Text-Datei anhängen statt ins Feld.
  const PASTE_LIMIT = 2000;
  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // Eingefügte Dateien/Bilder (Screenshot aus Zwischenablage) → als Anhang.
    const files = e.clipboardData.files;
    if (files && files.length > 0) {
      e.preventDefault();
      addFiles(files);
      return;
    }
    const text = e.clipboardData.getData("text");
    if (text && text.length > PASTE_LIMIT) {
      e.preventDefault();
      const n =
        attachments.filter((a) => a.name.startsWith("eingefügter_text")).length;
      setAttachments((a) => [
        ...a,
        {
          id: uid(),
          name: n ? `eingefügter_text_${n + 1}.txt` : "eingefügter_text.txt",
          size: text.length,
          kind: "text",
          text,
        },
      ]);
    }
  };

  const submit = () => {
    const text = value.trim();
    if ((!text && attachments.length === 0) || streaming) return;
    // Keep the user message clean: attachments travel as structured objects
    // (metadata + content) and are handed to the model as external-file context
    // server-side, not concatenated into the prompt text.
    const images = imageDataUrls(attachments);
    onSend(
      text || (attachments.length ? "(Datei angehängt)" : ""),
      images.length ? images : undefined,
      attachments.length ? attachments : undefined
    );
    setValue("");
    onDraftChange?.("");
    setAttachments([]);
    // Keep the cursor in the field so the user can type the next message right
    // away (a button click would otherwise move focus off the textarea).
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (pickerOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setPicIdx((i) => Math.min(i + 1, items.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setPicIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        // Tab confirms just like Enter — run the command / apply model/prompt.
        e.preventDefault();
        chooseItem(items[picIdx]);
        return;
      }
      if (e.key === " " && modelMode) {
        // im Modell-Modus bestätigt Leertaste; sonst normal tippen
        // (damit man "/model " überhaupt eingeben kann)
        e.preventDefault();
        chooseItem(items[picIdx]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMenuClosed(true);
        return;
      }
      // sonstige Tasten (Buchstaben) filtern normal weiter — Menü bleibt offen
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div
      className={clsx(
        "mx-auto w-full max-w-3xl print:hidden",
        !bare && "px-4 pb-4"
      )}
    >
      <div className="relative">
        {/* Animated multicolor AI glow (start screen) — fades out smoothly.
            Colors are fixed neon (independent of the accent color). */}
        <div
          aria-hidden
          className={clsx(
            "pointer-events-none absolute -inset-2 transition-opacity duration-700",
            glow ? "opacity-100" : "opacity-0"
          )}
        >
          <div className="ai-glow absolute inset-0" />
        </div>
        {/* "/" command + prompt menu */}
        {pickerOpen && (
          <div className="absolute bottom-full left-0 z-40 mb-2 max-h-72 w-full overflow-y-auto menu-panel">
            <div className="flex items-center gap-1.5 border-b border-border-light px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:border-border-dark">
              <BookText size={13} />{" "}
              {modelMode
                ? "Modell wählen · ↑↓ · Tab/⏎ bestätigt"
                : "Befehle & Vorlagen · ↑↓ · Tab/⏎ bestätigt"}
              {modelMode && ghost && (
                <span className="ml-auto normal-case text-neutral-400">
                  <span className="text-neutral-500">{modelQuery}</span>
                  {ghost}
                </span>
              )}
            </div>
            {items.map((it, i) =>
              it.type === "model" ? (
                <button
                  key={it.option.key}
                  onMouseEnter={() => setPicIdx(i)}
                  onClick={() => chooseItem(it)}
                  className={clsx(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition",
                    i === picIdx
                      ? "bg-neutral-200/70 dark:bg-white/10"
                      : "hover:bg-neutral-100 dark:hover:bg-white/5"
                  )}
                >
                  <span className="min-w-0 truncate font-mono text-sm">
                    {highlightMatch(nameOf(it.option), modelQuery)}
                  </span>
                  <span className="shrink-0 text-xs text-neutral-400">
                    {it.option.providerName}
                  </span>
                </button>
              ) : it.type === "cmd" ? (
                <button
                  key={it.cmd.cmd}
                  onMouseEnter={() => setPicIdx(i)}
                  onClick={() => chooseItem(it)}
                  className={clsx(
                    "flex w-full items-center gap-2 px-3 py-2 text-left transition",
                    i === picIdx
                      ? "bg-neutral-200/70 dark:bg-white/10"
                      : "hover:bg-neutral-100 dark:hover:bg-white/5"
                  )}
                >
                  <it.cmd.Icon size={15} className="shrink-0 text-accent" />
                  <span className="font-mono text-sm font-medium">
                    {it.cmd.cmd}
                  </span>
                  <span className="truncate text-xs text-neutral-500">
                    {it.cmd.label}
                  </span>
                </button>
              ) : (
                <button
                  key={it.prompt.id}
                  onMouseEnter={() => setPicIdx(i)}
                  onClick={() => chooseItem(it)}
                  className={clsx(
                    "flex w-full flex-col items-start px-3 py-2 text-left transition",
                    i === picIdx
                      ? "bg-neutral-200/70 dark:bg-white/10"
                      : "hover:bg-neutral-100 dark:hover:bg-white/5"
                  )}
                >
                  <span className="text-sm font-medium">{it.prompt.title}</span>
                  <span className="line-clamp-1 text-xs text-neutral-500">
                    {it.prompt.content.replace(/\s+/g, " ").trim()}
                  </span>
                </button>
              )
            )}
          </div>
        )}

        <div
          onDragOver={onDragOver}
          onDragEnter={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={clsx(
            "relative rounded-3xl border bg-white p-2 shadow-sm transition focus-within:border-neutral-400 dark:bg-bubble-dark dark:focus-within:border-neutral-500",
            dragActive
              ? "border-accent ring-2 ring-accent/40"
              : "border-border-light dark:border-border-dark",
            disabled && "opacity-60"
          )}
        >
          {dragActive && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-3xl bg-accent/10 text-sm font-medium text-accent backdrop-blur-[1px]">
              <Paperclip size={16} /> Dateien hier ablegen
            </div>
          )}
          {/* Attachment tiles (inside the box, above the textarea) */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-1 pb-2 pt-1">
              {attachments.map((a) => (
                <div
                  key={a.id}
                  className="group/att relative flex items-center gap-2 rounded-lg border border-border-light bg-neutral-50 py-1.5 pl-2 pr-7 text-sm dark:border-border-dark dark:bg-white/5"
                  title={a.note ?? a.name}
                >
                  {a.kind === "image" && a.dataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.dataUrl}
                      alt={a.name}
                      className="h-9 w-9 rounded object-cover"
                    />
                  ) : a.kind === "pdf" ? (
                    <FileIcon size={18} className="text-red-500" />
                  ) : (
                    <FileText size={18} className="text-accent" />
                  )}
                  <span className="max-w-[10rem] truncate">{a.name}</span>
                  <button
                    onClick={() => removeAttachment(a.id)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-neutral-400 hover:text-red-500"
                    title="Entfernen"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-1">
            {/* Attach button */}
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={disabled}
              title="Datei anhängen"
              className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-200 disabled:opacity-40 dark:hover:bg-white/10"
            >
              <Paperclip size={18} />
            </button>
            <button
              onClick={() => toggleWebSearch()}
              disabled={disabled}
              title={
                webSearchEnabled
                  ? "Internetsuche: an"
                  : "Internetsuche: aus"
              }
              className={clsx(
                "mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition disabled:opacity-40",
                webSearchEnabled
                  ? "bg-accent/15 text-accent"
                  : "text-neutral-500 hover:bg-neutral-200 dark:hover:bg-white/10"
              )}
            >
              <Globe size={18} />
            </button>
            <button
              onClick={() => toggleKb()}
              disabled={disabled}
              title={kbEnabled ? "Wissensdatenbank: an" : "Wissensdatenbank: aus"}
              className={clsx(
                "mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition disabled:opacity-40",
                kbEnabled
                  ? "bg-accent/15 text-accent"
                  : "text-neutral-500 hover:bg-neutral-200 dark:hover:bg-white/10"
              )}
            >
              <Library size={18} />
            </button>

            <textarea
              ref={taRef}
              rows={1}
              value={value}
              disabled={disabled}
              onChange={(e) => changeValue(e.target.value)}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              placeholder={placeholder ?? t("input.placeholder")}
              className="max-h-60 flex-1 resize-none bg-transparent px-2 py-2 leading-6 outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed"
            />

            {streaming ? (
              <button
                onClick={onStop}
                title="Generierung stoppen"
                className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-white transition-all duration-150 ease-out hover:bg-neutral-700 active:scale-95 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
              >
                <Square size={16} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={(!value.trim() && attachments.length === 0) || disabled}
                title="Senden"
                className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-white transition-all duration-150 ease-out hover:scale-105 hover:bg-neutral-700 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
              >
                <ArrowUp size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
      {!bare && (
        <p className="mt-2 text-center text-xs text-neutral-400">
          {t("input.hint")}
        </p>
      )}
    </div>
  );
});

export default ChatInput;
