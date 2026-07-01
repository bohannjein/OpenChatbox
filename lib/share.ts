import type { Chat } from "./types";

export interface SharedChat {
  title: string;
  messages: { role: string; content: string }[];
}

/** Build a Markdown transcript of a chat. */
export function chatToMarkdown(chat: Chat): string {
  const lines: string[] = [`# ${chat.title}`, ""];
  for (const m of chat.messages) {
    if (m.role === "system") continue;
    lines.push(m.role === "user" ? "**Du:**" : "**Assistant:**");
    lines.push("");
    lines.push(m.content);
    lines.push("");
    lines.push("---");
    lines.push("");
  }
  return lines.join("\n");
}

/** Trigger a client-side file download. */
export function download(filename: string, text: string, mime = "text/markdown") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Unicode-safe base64 (URL-friendly).
const b64encode = (s: string) =>
  btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const b64decode = (s: string) => {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const b = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return decodeURIComponent(escape(atob(b)));
};

/**
 * Build a static, backend-free share link: the whole chat is encoded into the
 * URL hash and rendered read-only at /share. Good for internal sharing where a
 * colleague opens the same self-hosted instance.
 */
export function buildShareLink(chat: Chat): string {
  const payload: SharedChat = {
    title: chat.title,
    messages: chat.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content })),
  };
  const encoded = b64encode(JSON.stringify(payload));
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/share#${encoded}`;
}

export function decodeSharedChat(hash: string): SharedChat | null {
  try {
    const raw = hash.replace(/^#/, "");
    if (!raw) return null;
    const obj = JSON.parse(b64decode(raw));
    if (!obj || !Array.isArray(obj.messages)) return null;
    return obj as SharedChat;
  } catch {
    return null;
  }
}
