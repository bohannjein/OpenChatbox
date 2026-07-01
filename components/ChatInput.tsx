"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useImperativeHandle,
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
} from "lucide-react";
import clsx from "clsx";
import { useStore } from "@/lib/store";
import {
  ACCEPT,
  processFile,
  buildPromptWithAttachments,
  imageDataUrls,
  type Attachment,
} from "@/lib/files";

export interface ChatInputHandle {
  setText: (t: string) => void;
  focus: () => void;
}

interface Props {
  onSend: (text: string, images?: string[]) => void;
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
  const [value, setValue] = useState(initialText ?? "");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picIdx, setPicIdx] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  // "/" picker
  const slashQuery =
    value.startsWith("/") && !value.includes("\n") ? value.slice(1) : null;
  const filtered =
    slashQuery != null
      ? prompts.filter(
          (p) =>
            p.title.toLowerCase().includes(slashQuery.toLowerCase()) ||
            (p.shortcut ?? "").toLowerCase().includes(slashQuery.toLowerCase())
        )
      : [];

  useEffect(() => {
    setPickerOpen(slashQuery != null && filtered.length > 0);
    setPicIdx(0);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyPrompt = (content: string) => {
    changeValue(content);
    setPickerOpen(false);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(content.length, content.length);
      }
    });
  };

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const processed = await Promise.all(Array.from(files).map(processFile));
    setAttachments((a) => [...a, ...processed]);
  };
  const removeAttachment = (id: string) =>
    setAttachments((a) => a.filter((x) => x.id !== id));

  const submit = () => {
    const text = value.trim();
    if ((!text && attachments.length === 0) || streaming) return;
    const finalText = buildPromptWithAttachments(text, attachments);
    const images = imageDataUrls(attachments);
    onSend(finalText || "(Datei angehängt)", images.length ? images : undefined);
    setValue("");
    onDraftChange?.("");
    setAttachments([]);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (pickerOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setPicIdx((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setPicIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        applyPrompt(filtered[picIdx].content);
        return;
      }
      if (e.key === "Escape") {
        setPickerOpen(false);
        return;
      }
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
        {/* Animated multicolor AI glow (start screen) — fades out smoothly */}
        <div
          aria-hidden
          className={clsx(
            "pointer-events-none absolute -inset-0.5 rounded-[26px] bg-gradient-to-r from-fuchsia-500 via-blue-500 to-cyan-400 bg-[length:200%_200%] blur-md transition-opacity duration-700",
            glow
              ? "opacity-40 [animation:glow-pulse_3s_ease-in-out_infinite,gradient-x_8s_linear_infinite]"
              : "opacity-0"
          )}
        />
        {/* "/" prompt picker */}
        {pickerOpen && (
          <div className="absolute bottom-full left-0 z-40 mb-2 w-full overflow-hidden rounded-xl border border-border-light bg-white shadow-xl dark:border-border-dark dark:bg-sidebar-dark">
            <div className="flex items-center gap-1.5 border-b border-border-light px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:border-border-dark">
              <BookText size={13} /> Prompt-Bibliothek
            </div>
            {filtered.map((p, i) => (
              <button
                key={p.id}
                onMouseEnter={() => setPicIdx(i)}
                onClick={() => applyPrompt(p.content)}
                className={clsx(
                  "flex w-full flex-col items-start px-3 py-2 text-left transition",
                  i === picIdx
                    ? "bg-neutral-200/70 dark:bg-white/10"
                    : "hover:bg-neutral-100 dark:hover:bg-white/5"
                )}
              >
                <span className="text-sm font-medium">{p.title}</span>
                <span className="line-clamp-1 text-xs text-neutral-500">
                  {p.content.replace(/\s+/g, " ").trim()}
                </span>
              </button>
            ))}
          </div>
        )}

        <div
          className={clsx(
            "relative rounded-3xl border border-border-light bg-white p-2 shadow-sm transition focus-within:border-neutral-400 dark:border-border-dark dark:bg-bubble-dark dark:focus-within:border-neutral-500",
            disabled && "opacity-60"
          )}
        >
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

            <textarea
              ref={taRef}
              rows={1}
              value={value}
              disabled={disabled}
              onChange={(e) => changeValue(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder ?? "Nachricht senden…  ( / für Prompts )"}
              className="max-h-60 flex-1 resize-none bg-transparent px-2 py-2 leading-6 outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed"
            />

            {streaming ? (
              <button
                onClick={onStop}
                title="Generierung stoppen"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-white transition hover:bg-neutral-700 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
              >
                <Square size={16} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={(!value.trim() && attachments.length === 0) || disabled}
                title="Senden"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-white transition hover:bg-neutral-700 disabled:opacity-30 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
              >
                <ArrowUp size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
      {!bare && (
        <p className="mt-2 text-center text-xs text-neutral-400">
          Enter zum Senden · Shift+Enter für Zeilenumbruch · „/" für Vorlagen ·
          📎 für Dateien
        </p>
      )}
    </div>
  );
});

export default ChatInput;
