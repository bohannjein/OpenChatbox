"use client";

import { useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import clsx from "clsx";
import {
  Plus,
  MessageSquare,
  Trash2,
  Settings,
  Sun,
  Moon,
  PanelLeftClose,
  Pencil,
  Check,
  X,
  Pin,
  PinOff,
  Search,
  User,
  Users,
  LogOut,
} from "lucide-react";
import { useStore, inWorkspace } from "@/lib/store";
import { useClickOutside } from "@/lib/useClickOutside";
import { SidekickAvatar } from "./SidekickIcon";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import AsciiSpinner from "./AsciiSpinner";
import Modal from "./Modal";
import { useT } from "@/lib/i18n";
import type { Chat } from "@/lib/types";

// Soft top/bottom fade so chat titles melt into the edges instead of hard-cutting.
const LIST_FADE =
  "linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const allChats = useStore((s) => s.chats);
  const chats = allChats.filter((c) => !c.temporary);
  const activeChatId = useStore((s) => s.activeChatId);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const theme = useStore((s) => s.theme);
  const logoUrl = useStore((s) => s.logoUrl);
  const appName = useStore((s) => s.appName);
  const sidekicks = useStore((s) => s.sidekicks);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const titlePendingId = useStore((s) => s.titlePendingId);
  const authUser = useStore((s) => s.authUser);
  const t = useT();
  const newChat = useStore((s) => s.newChat);
  const deleteChat = useStore((s) => s.deleteChat);
  const renameChat = useStore((s) => s.renameChat);
  const togglePinChat = useStore((s) => s.togglePinChat);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setSettingsTab = useStore((s) => s.setSettingsTab);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);

  const setSearchOpen = useStore((s) => s.setSearchOpen);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Chat | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const footerRef = useRef<HTMLDivElement>(null);
  useClickOutside(footerRef, () => setMenuOpen(false));

  const openProfile = () => {
    setMenuOpen(false);
    setSettingsTab("account");
    setSettingsOpen(true);
  };
  const logout = async () => {
    setMenuOpen(false);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem("nexus-uid");
    } catch {
      /* ignore */
    }
    router.push("/login");
  };

  const startEdit = (id: string, title: string) => {
    setEditingId(id);
    setDraft(title);
  };
  const commitEdit = () => {
    if (editingId && draft.trim()) renameChat(editingId, draft.trim());
    setEditingId(null);
  };

  const onSelect = (id: string) => {
    router.push(`/c/${id}`);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const startNewChat = () => {
    // Already on "/" (e.g. a temp chat) → create directly (router.push no-op there).
    if (pathname === "/") newChat();
    else router.push("/");
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const startSidekick = (id: string) => {
    const cid = newChat(false, id);
    router.push(`/c/${cid}`);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  // Scope the sidebar to the active workspace (legacy items → default ws).
  const wsChats = chats.filter((c) => inWorkspace(c, activeWorkspaceId));
  const wsSidekicks = sidekicks.filter((sk) =>
    inWorkspace(sk, activeWorkspaceId)
  );
  const pinned = wsChats.filter((c) => c.pinned);
  const rest = wsChats.filter((c) => !c.pinned);

  const chatRow = (c: Chat) => {
    const active = c.id === activeChatId;
    const editing = editingId === c.id;
    return (
      <div
        key={c.id}
        className={clsx(
          "group relative mb-0.5 flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors duration-200 ease-out",
          active
            ? "bg-zinc-200/60 dark:bg-white/[0.03]"
            : "hover:bg-zinc-200/40 dark:hover:bg-white/[0.02]"
        )}
      >
        {active && (
          <span
            aria-hidden
            className="absolute left-0 top-1/4 h-1/2 w-[3px] rounded-r bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]"
          />
        )}
        {c.pinned ? (
          <Pin size={15} strokeWidth={1.5} className="shrink-0 text-accent" />
        ) : (
          <MessageSquare
            size={16}
            strokeWidth={1.5}
            className="shrink-0 text-zinc-400"
          />
        )}
        {editing ? (
          <>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") setEditingId(null);
              }}
              className="min-w-0 flex-1 rounded bg-transparent outline-none ring-1 ring-accent"
            />
            <button
              onClick={commitEdit}
              className="text-neutral-500 hover:text-accent"
            >
              <Check size={15} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="text-neutral-500 hover:text-red-500"
            >
              <X size={15} strokeWidth={1.5} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onSelect(c.id)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              title={c.title}
            >
              <span className="min-w-0 flex-1 truncate">
                {titlePendingId === c.id ? <AsciiSpinner /> : c.title}
              </span>
              {c.draft && c.draft.trim() && (
                <span className="shrink-0 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                  Entwurf
                </span>
              )}
            </button>
            <button
              onClick={() => togglePinChat(c.id)}
              className={clsx(
                "shrink-0 transition",
                c.pinned
                  ? "text-accent"
                  : "text-neutral-400 opacity-0 hover:text-neutral-700 group-hover:opacity-100 dark:hover:text-neutral-200"
              )}
              title={c.pinned ? "Lösen" : "Anpinnen"}
            >
              {c.pinned ? (
                <PinOff size={14} strokeWidth={1.5} />
              ) : (
                <Pin size={14} strokeWidth={1.5} />
              )}
            </button>
            <button
              onClick={() => startEdit(c.id, c.title)}
              className="shrink-0 text-neutral-400 opacity-0 transition hover:text-neutral-700 group-hover:opacity-100 dark:hover:text-neutral-200"
              title="Umbenennen"
            >
              <Pencil size={14} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => setPendingDelete(c)}
              className="shrink-0 text-neutral-400 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
              title="Löschen"
            >
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <>
    <aside
      className={clsx(
        "z-30 h-dvh shrink-0 overflow-hidden border-r border-border-light bg-sidebar-light dark:border-border-dark dark:bg-sidebar-dark print:hidden",
        "fixed inset-y-0 left-0 md:static",
        "transition-[width,transform] duration-300 ease-in-out motion-reduce:transition-none",
        sidebarOpen
          ? "w-72 translate-x-0"
          : "w-72 -translate-x-full md:w-0 md:translate-x-0"
      )}
    >
      {/* fixed-width inner content — clipped by the animating aside width */}
      <div className="flex h-full w-72 flex-col">
        {/* Zeile 1 — Branding links · Suche + Einklappen rechts */}
        <div className="flex shrink-0 items-center gap-0.5 px-3 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={appName || "Logo"}
                className="max-h-7 max-w-[70%] object-contain"
              />
            ) : (
              <span className="flex min-w-0 items-center gap-2 text-base font-bold tracking-tight">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
                  {(appName || "C").trim().charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{appName || "OpenChatbox"}</span>
              </span>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            title="Sidebar einklappen"
            className="shrink-0 rounded-lg p-2 text-zinc-400 transition hover:bg-neutral-200 hover:text-zinc-200 dark:hover:bg-white/5"
          >
            <PanelLeftClose size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Zeile 2 — Workspace (schlank, untergeordnet) */}
        <WorkspaceSwitcher />

        {/* Suche — flaches Feld, öffnet die Chat-Suche (⌘K) */}
        <div className="px-3 pb-1 pt-0.5">
          <button
            onClick={() => setSearchOpen(true)}
            title="Chats durchsuchen (⌘K)"
            className="flex w-full items-center gap-2 rounded-lg border border-black/[0.06] bg-black/[0.02] px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-black/[0.04] dark:border-white/[0.05] dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
          >
            <Search size={15} strokeWidth={1.5} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">Suche (⌘K)…</span>
          </button>
        </div>

        {/* Zeile 3 — Haupt-Aktion: Neuer Chat (volle Breite, gefüllt) */}
        <div className="px-3 pb-1 pt-0.5">
          <button
            onClick={startNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-500/20 bg-zinc-950/40 px-3 py-2.5 text-sm font-medium tracking-wide text-violet-700 shadow-[0_0_15px_rgba(139,92,246,0.05)] backdrop-blur-md transition-all duration-150 ease-out hover:scale-[1.01] hover:border-violet-400/40 hover:bg-gradient-to-r hover:from-violet-600/10 hover:to-indigo-600/10 hover:text-violet-900 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)] active:scale-[0.98] dark:text-violet-200 dark:hover:text-white"
          >
            <Plus size={16} />
            {t("sidebar.newChat")}
          </button>
        </div>

      {/* Meine Sidekicks */}
      {wsSidekicks.length > 0 && (
        <div className="px-2 pb-1 pt-4">
          <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 opacity-60">
            {t("sidebar.sidekicks")}
          </div>
          {wsSidekicks.map((sk) => (
            <button
              key={sk.id}
              onClick={() => startSidekick(sk.id)}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition hover:bg-neutral-200/60 dark:hover:bg-white/5"
              title={sk.name}
            >
              <SidekickAvatar icon={sk.icon} color={sk.color} size={22} />
              <span className="min-w-0 flex-1 truncate text-left">
                {sk.name}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Chat list */}
      <nav
        className="flex-1 overflow-y-auto px-2 pb-1 pt-3"
        style={{ WebkitMaskImage: LIST_FADE, maskImage: LIST_FADE }}
      >
        {chats.length === 0 && (
          <p className="px-3 py-4 text-sm text-neutral-500">
            {t("sidebar.noChats")}
          </p>
        )}

        {pinned.length > 0 && (
          <div className="mb-2">
            <div className="flex items-center gap-1 px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 opacity-60">
              <Pin size={10} /> Angepinnt
            </div>
            {pinned.map(chatRow)}
          </div>
        )}
        {pinned.length > 0 && rest.length > 0 && (
          <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 opacity-60">
            Chats
          </div>
        )}
        {rest.map(chatRow)}
      </nav>

      {/* Footer — floating profile card + popover menu */}
      <div className="relative p-2" ref={footerRef}>
        {/* Cyber-glass popover */}
        <div
          className={clsx(
            "absolute bottom-16 left-2 right-2 z-50 mb-1 flex origin-bottom flex-col gap-1 rounded-2xl border border-white/[0.08] bg-zinc-950/90 p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-md transition-all duration-200 ease-expo",
            menuOpen
              ? "translate-y-0 scale-100 opacity-100"
              : "pointer-events-none translate-y-1 scale-95 opacity-0"
          )}
        >
          {/* Header — current user (non-clickable) */}
          <div className="mb-1 truncate border-b border-white/[0.05] px-3 py-2 font-mono text-xs text-zinc-500">
            {authUser?.username ?? "Angemeldet"}
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-white/[0.04]"
          >
            <Users size={16} strokeWidth={1.5} className="shrink-0 text-zinc-400" />
            Account wechseln
          </button>
          <button
            onClick={openProfile}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-white/[0.04]"
          >
            <User size={16} strokeWidth={1.5} className="shrink-0 text-zinc-400" />
            Profil &amp; Sicherheit
          </button>
          <div className="my-1 border-t border-white/[0.05]" />
          <button
            onClick={logout}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-red-400/90 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut
              size={16}
              strokeWidth={1.5}
              className="shrink-0 text-red-400/80"
            />
            Abmelden
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-xl border border-black/[0.06] bg-black/[0.02] p-2 backdrop-blur-sm dark:border-white/[0.05] dark:bg-zinc-950/20">
          {/* Profile — opens popover */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            title="Konto-Menü"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left transition-colors"
          >
            <div className="relative shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
                {(authUser?.username ?? "?").trim().charAt(0).toUpperCase()}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white dark:ring-zinc-900" />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-medium">
                {authUser?.username ?? "Nutzer"}
              </div>
              <div className="truncate font-mono text-xs text-zinc-500">
                {authUser?.role
                  ? authUser.role.charAt(0).toUpperCase() + authUser.role.slice(1)
                  : "—"}
              </div>
            </div>
          </button>
          {/* Actions */}
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              onClick={() => setSettingsOpen(true)}
              title="Einstellungen"
              className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:text-neutral-900 dark:hover:text-white"
            >
              <Settings size={17} strokeWidth={1.5} />
            </button>
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Light Mode" : "Dark Mode"}
              className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:text-neutral-900 dark:hover:text-white"
            >
              {theme === "dark" ? (
                <Sun size={17} strokeWidth={1.5} />
              ) : (
                <Moon size={17} strokeWidth={1.5} />
              )}
            </button>
          </div>
        </div>
      </div>
      </div>
    </aside>

      {pendingDelete && (
        <Modal onClose={() => setPendingDelete(null)}>
          <h2 className="text-lg font-bold">Chat löschen?</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Auch Prompts, Antworten, Feedback und von dir erstellte Inhalte
            werden aus deinem Aktivitätsverlauf gelöscht.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setPendingDelete(null)}
              className="rounded-lg border border-border-light px-4 py-2 text-sm font-medium transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
            >
              Abbrechen
            </button>
            <button
              onClick={() => {
                deleteChat(pendingDelete.id);
                setPendingDelete(null);
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
            >
              Löschen
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
