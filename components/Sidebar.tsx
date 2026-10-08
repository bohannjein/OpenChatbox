"use client";

import { useRef, useState, type DragEvent } from "react";
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
  LogIn,
  Folder as FolderIcon,
  FolderPlus,
  FolderInput,
  ChevronRight,
  MoreVertical,
  StickyNote,
} from "lucide-react";
import { useStore, inWorkspace } from "@/lib/store";
import { hasUnseenWhatsNew } from "@/lib/version";
import { useClickOutside } from "@/lib/useClickOutside";
import type { Chat, Folder } from "@/lib/types";
import { SidekickAvatar } from "./SidekickIcon";
import BrandMark from "./BrandMark";
import { fullNameOf, initialOf } from "@/lib/personName";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import AsciiSpinner from "./AsciiSpinner";
import Modal from "./Modal";
import { useT } from "@/lib/i18n";

// Soft bottom fade so chat titles melt into the edge instead of hard-cutting.
// The top stays opaque — the first chats sit right under the "new chat" button
// and must read at full contrast.
const LIST_FADE =
  "linear-gradient(to bottom, black 0%, black 95%, transparent 100%)";

// Row actions appear on hover — and also on keyboard focus and on touch
// screens, where there is no hover.
const REVEAL =
  "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100";
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

/** The list shows chat metadata only. A streaming reply replaces the active chat
 *  object on every token (new messages + updatedAt), so keep returning the
 *  previous array while nothing the sidebar renders has changed. */
let listChats: Chat[] = [];
const IGNORED = new Set(["messages", "updatedAt"]);
function selectListChats(chats: Chat[]): Chat[] {
  const same =
    chats.length === listChats.length &&
    chats.every((c, i) => {
      const p = listChats[i] as unknown as Record<string, unknown>;
      const n = c as unknown as Record<string, unknown>;
      if (n === p) return true;
      const keys = Object.keys(n);
      return (
        keys.length === Object.keys(p).length &&
        keys.every((k) => IGNORED.has(k) || n[k] === p[k])
      );
    });
  if (!same) listChats = chats;
  return listChats;
}

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const allChats = useStore((s) => selectListChats(s.chats));
  const chats = allChats.filter((c) => !c.temporary);
  const activeChatId = useStore((s) => s.activeChatId);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const theme = useStore((s) => s.theme);
  const sidekicks = useStore((s) => s.sidekicks);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const titlePendingId = useStore((s) => s.titlePendingId);
  const authUser = useStore((s) => s.authUser);
  const guestMode = useStore((s) => s.guestMode);
  const t = useT();
  const newChat = useStore((s) => s.newChat);
  const deleteChat = useStore((s) => s.deleteChat);
  const renameChat = useStore((s) => s.renameChat);
  const togglePinChat = useStore((s) => s.togglePinChat);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const unlockDracula = useStore((s) => s.unlockDracula);
  const whatsNewSeen = useStore((s) => s.whatsNewSeen);
  const showWhatsNewDot = hasUnseenWhatsNew(whatsNewSeen);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setSettingsTab = useStore((s) => s.setSettingsTab);
  const globalNotesOpen = useStore((s) => s.globalNotesOpen);
  const setGlobalNotesOpen = useStore((s) => s.setGlobalNotesOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);

  const setSearchOpen = useStore((s) => s.setSearchOpen);
  const folders = useStore((s) => s.folders);
  const createFolder = useStore((s) => s.createFolder);
  const renameFolder = useStore((s) => s.renameFolder);
  const deleteFolder = useStore((s) => s.deleteFolder);
  const setChatFolder = useStore((s) => s.setChatFolder);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Chat | null>(null);
  // folders: open/collapsed set, inline rename, 3-dot menu, delete confirm
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [folderDraft, setFolderDraft] = useState("");
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null);
  const [pendingFolderDelete, setPendingFolderDelete] = useState<Folder | null>(null);
  // drag & drop
  const [draggingChatId, setDraggingChatId] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const folderMenuRef = useRef<HTMLDivElement>(null);
  useClickOutside(folderMenuRef, () => setFolderMenuId(null), folderMenuId !== null);

  const toggleFolder = (id: string) =>
    setOpenFolders((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const startFolderEdit = (id: string, name: string) => {
    setFolderMenuId(null);
    setEditingFolderId(id);
    setFolderDraft(name);
  };
  const commitFolderEdit = () => {
    if (editingFolderId && folderDraft.trim())
      renameFolder(editingFolderId, folderDraft.trim());
    setEditingFolderId(null);
  };
  const handleCreateFolder = () => {
    const name = t("sidebar.newFolder");
    const id = createFolder(name);
    setOpenFolders((prev) => new Set(prev).add(id));
    startFolderEdit(id, name);
  };
  const dropOnFolder = (e: DragEvent, folderId: string | null) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/chatid");
    if (id) setChatFolder(id, folderId);
    if (folderId) setOpenFolders((prev) => new Set(prev).add(folderId));
    setDragOverFolder(null);
    setDraggingChatId(null);
  };
  const [menuOpen, setMenuOpen] = useState(false);
  const footerRef = useRef<HTMLDivElement>(null);
  useClickOutside(footerRef, () => setMenuOpen(false), menuOpen);

  const openProfile = () => {
    setMenuOpen(false);
    setSettingsTab("account");
    setSettingsOpen(true);
  };
  const endSession = async () => {
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
  };
  const logout = async () => {
    setMenuOpen(false);
    await endSession();
    router.push("/login");
  };
  // Account wechseln: aktuelle Session beenden und einen frischen Login-Flow
  // starten (statt den Nutzer nur auszuloggen und im leeren Zustand zu lassen).
  const switchAccount = async () => {
    setMenuOpen(false);
    await endSession();
    router.push("/login?switch=1");
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

  // Easter egg: 7 rapid clicks (<600ms apart) on the theme toggle unlock and
  // activate the hidden Dracula theme. A slow click is a normal light/dark flip.
  const themeClicks = useRef({ count: 0, last: 0 });
  const handleThemeClick = () => {
    const t = Date.now();
    const c = themeClicks.current;
    c.count = t - c.last < 600 ? c.count + 1 : 1;
    c.last = t;
    if (c.count >= 7) {
      c.count = 0;
      unlockDracula();
      return;
    }
    toggleTheme();
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
  const wsFolders = folders.filter((f) => inWorkspace(f, activeWorkspaceId));
  const folderIds = new Set(wsFolders.map((f) => f.id));
  const pinned = wsChats.filter((c) => c.pinned);
  // Root = unpinned chats not filed under a (known) folder.
  const rest = wsChats.filter(
    (c) => !c.pinned && !(c.folderId && folderIds.has(c.folderId))
  );

  const chatRow = (c: Chat) => {
    const active = c.id === activeChatId;
    const editing = editingId === c.id;
    return (
      <div
        key={c.id}
        draggable={!editing}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/chatid", c.id);
          e.dataTransfer.effectAllowed = "move";
          setDraggingChatId(c.id);
        }}
        onDragEnd={() => {
          setDraggingChatId(null);
          setDragOverFolder(null);
        }}
        className={clsx(
          "group relative mb-0.5 flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all duration-150 ease-out",
          !editing && "cursor-grab active:cursor-grabbing",
          draggingChatId === c.id && "opacity-40",
          active
            ? "bg-zinc-200/60 dark:bg-white/[0.03]"
            : "hover:bg-zinc-200/40 dark:hover:bg-white/[0.02]"
        )}
      >
        {active && (
          <span
            aria-hidden
            className="absolute left-0 top-1/4 h-1/2 w-[3px] rounded-r bg-accent"
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
              title={t("common.save")}
              aria-label={t("common.save")}
              className={clsx("rounded text-neutral-500 hover:text-accent", FOCUS_RING)}
            >
              <Check size={15} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => setEditingId(null)}
              title={t("common.cancel")}
              aria-label={t("common.cancel")}
              className={clsx("rounded text-neutral-500 hover:text-red-500", FOCUS_RING)}
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
                  {t("sidebar.draft")}
                </span>
              )}
            </button>
            <button
              onClick={() => togglePinChat(c.id)}
              className={clsx(
                "shrink-0 rounded transition",
                FOCUS_RING,
                c.pinned
                  ? "text-accent"
                  : clsx("text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200", REVEAL)
              )}
              title={t(c.pinned ? "sidebar.unpin" : "sidebar.pin")}
              aria-label={t(c.pinned ? "sidebar.unpin" : "sidebar.pin")}
            >
              {c.pinned ? (
                <PinOff size={14} strokeWidth={1.5} />
              ) : (
                <Pin size={14} strokeWidth={1.5} />
              )}
            </button>
            <button
              onClick={() => startEdit(c.id, c.title)}
              className={clsx("shrink-0 rounded text-neutral-400 transition hover:text-neutral-700 dark:hover:text-neutral-200", REVEAL, FOCUS_RING)}
              title={t("common.rename")}
              aria-label={t("common.rename")}
            >
              <Pencil size={14} strokeWidth={1.5} />
            </button>
            {wsFolders.length > 0 && (
              <span
                title={t("sidebar.moveToFolder")}
                className={clsx(
                  "relative shrink-0 rounded text-neutral-400 transition hover:text-neutral-700 dark:hover:text-neutral-200",
                  "[&:has(:focus-visible)]:ring-2 [&:has(:focus-visible)]:ring-accent",
                  REVEAL
                )}
              >
                <FolderInput size={14} strokeWidth={1.5} aria-hidden />
                {/* Native select over the icon: keyboard/touch alternative to drag & drop. */}
                <select
                  aria-label={t("sidebar.moveToFolder")}
                  value={c.folderId && folderIds.has(c.folderId) ? c.folderId : ""}
                  onChange={(e) => {
                    const fid = e.target.value || null;
                    setChatFolder(c.id, fid);
                    if (fid) setOpenFolders((prev) => new Set(prev).add(fid));
                  }}
                  className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 outline-none"
                >
                  <option value="">{t("sidebar.noFolder")}</option>
                  {wsFolders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </span>
            )}
            <button
              onClick={() => setPendingDelete(c)}
              className={clsx("shrink-0 rounded text-neutral-400 transition hover:text-red-500", REVEAL, FOCUS_RING)}
              title={t("common.delete")}
              aria-label={t("common.delete")}
            >
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
          </>
        )}
      </div>
    );
  };

  // Guest mode: a stripped sidebar — no history, folders, workspaces, sidekicks,
  // search or settings. Just a notice + a login button (and the theme toggle).
  if (guestMode) {
    return (
      <aside
        inert={!sidebarOpen}
        className={clsx(
          "z-30 h-dvh shrink-0 overflow-hidden border-r border-border-light bg-sidebar-light dark:border-border-dark dark:bg-sidebar-dark print:hidden",
          "fixed inset-y-0 left-0 md:static",
          "transition-[width,transform] duration-300 ease-in-out motion-reduce:transition-none",
          sidebarOpen ? "w-72 translate-x-0" : "w-72 -translate-x-full md:w-0 md:translate-x-0"
        )}
      >
        <div className="flex h-full w-72 flex-col">
          <div className="flex shrink-0 items-center gap-0.5 px-3 py-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <BrandMark dark={theme !== "light"} />
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              title={t("sidebar.collapse")}
              aria-label={t("sidebar.collapse")}
              className="cursor-pointer rounded-lg p-2 text-zinc-400 transition-all duration-150 hover:text-neutral-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:hover:bg-white/5 dark:hover:text-white"
            >
              <PanelLeftClose size={18} strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex flex-1 flex-col px-3 py-4">
            <div className="rounded-xl border border-border-light bg-white/60 p-4 dark:border-border-dark dark:bg-white/5">
              <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
                <User size={16} className="text-accent" /> {t("sidebar.guestTitle")}
              </div>
              <p className="text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                {t("sidebar.guestBody")}
              </p>
              <button
                onClick={() => router.push("/login")}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2 text-sm font-medium text-white transition hover:bg-accent-hover"
              >
                <LogIn size={16} /> {t("common.signIn")}
              </button>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end border-t border-border-light px-3 py-2 dark:border-border-dark">
            <button
              onClick={handleThemeClick}
              title={t(theme === "light" ? "common.darkMode" : "common.lightMode")}
              aria-label={t(theme === "light" ? "common.darkMode" : "common.lightMode")}
              className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:hover:text-white"
            >
              {theme === "light" ? <Moon size={17} strokeWidth={1.5} /> : <Sun size={17} strokeWidth={1.5} />}
            </button>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <>
    <aside
      inert={!sidebarOpen}
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
            <BrandMark dark={theme !== "light"} />
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              onClick={() => setSearchOpen(true)}
              title={t("sidebar.searchShortcut")}
              aria-label={t("sidebar.searchLabel")}
              className="cursor-pointer rounded-lg p-2 text-zinc-400 transition-all duration-150 hover:text-neutral-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:hover:bg-white/5 dark:hover:text-white"
            >
              <Search size={18} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              title={t("sidebar.collapse")}
              aria-label={t("sidebar.collapse")}
              className="cursor-pointer rounded-lg p-2 text-zinc-400 transition-all duration-150 hover:text-neutral-900 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:hover:bg-white/5 dark:hover:text-white"
            >
              <PanelLeftClose size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Zeile 2 — Workspace (schlank, untergeordnet) */}
        <WorkspaceSwitcher />

        {/* Zeile 3 — Haupt-Aktion: Neuer Chat + Ordner erstellen */}
        <div className="flex items-center gap-2 px-3 pb-1 pt-0.5">
          <button
            onClick={startNewChat}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border-light bg-white px-3 py-2.5 text-sm font-medium tracking-wide text-accent transition-colors duration-150 ease-out hover:border-accent/40 hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:border-border-dark dark:bg-white/[0.04] dark:hover:border-accent/40 dark:hover:bg-accent/10"
          >
            <Plus size={16} />
            {t("sidebar.newChat")}
          </button>
          <button
            onClick={handleCreateFolder}
            title={t("sidebar.createFolder")}
            aria-label={t("sidebar.createFolder")}
            className="flex shrink-0 items-center justify-center rounded-xl border border-border-light bg-white p-2.5 text-zinc-500 transition-colors duration-150 ease-out hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:border-border-dark dark:bg-white/[0.04] dark:hover:border-accent/40"
          >
            <FolderPlus size={16} />
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
        className="flex flex-1 flex-col overflow-y-auto px-2 pb-1 pt-3"
        style={{ WebkitMaskImage: LIST_FADE, maskImage: LIST_FADE }}
      >
        {chats.length === 0 && wsFolders.length === 0 && (
          <p className="px-3 py-4 text-sm text-neutral-500">
            {t("sidebar.noChats")}
          </p>
        )}

        {/* Folders — collapsible accordions + drop zones */}
        {wsFolders.map((f) => {
          const open = openFolders.has(f.id);
          const fChats = wsChats.filter((c) => c.folderId === f.id && !c.pinned);
          const editingF = editingFolderId === f.id;
          return (
            <div
              key={f.id}
              className="mb-0.5"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverFolder !== f.id) setDragOverFolder(f.id);
              }}
              onDragLeave={() =>
                setDragOverFolder((cur) => (cur === f.id ? null : cur))
              }
              onDrop={(e) => {
                e.stopPropagation();
                dropOnFolder(e, f.id);
              }}
            >
              <div
                className={clsx(
                  "group/f relative flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm transition-all duration-150 ease-out",
                  dragOverFolder === f.id
                    ? "border border-accent/40 bg-accent/10"
                    : "border border-transparent hover:bg-neutral-200/40 dark:hover:bg-white/[0.02]"
                )}
              >
                {editingF ? (
                  <>
                    <ChevronRight size={14} className="shrink-0 text-zinc-400" />
                    <FolderIcon size={15} className="shrink-0 text-accent" />
                    <input
                      autoFocus
                      value={folderDraft}
                      onChange={(e) => setFolderDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitFolderEdit();
                        if (e.key === "Escape") setEditingFolderId(null);
                      }}
                      onBlur={commitFolderEdit}
                      className="min-w-0 flex-1 rounded bg-transparent outline-none ring-1 ring-accent"
                    />
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => toggleFolder(f.id)}
                      aria-expanded={open}
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    >
                      <ChevronRight
                        size={14}
                        className={clsx(
                          "shrink-0 text-zinc-400 transition-transform duration-200 ease-out",
                          open && "rotate-90"
                        )}
                      />
                      <FolderIcon size={15} className="shrink-0 text-accent" />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {f.name}
                      </span>
                      {fChats.length > 0 && (
                        <span className="shrink-0 text-[10px] text-neutral-400">
                          {fChats.length}
                        </span>
                      )}
                    </button>
                    <div
                      className="relative"
                      ref={folderMenuId === f.id ? folderMenuRef : undefined}
                    >
                      <button
                        onClick={() =>
                          setFolderMenuId((v) => (v === f.id ? null : f.id))
                        }
                        title={t("sidebar.folderMenu")}
                        aria-label={t("sidebar.folderMenu")}
                        aria-haspopup="menu"
                        aria-expanded={folderMenuId === f.id}
                        className={clsx(
                          "shrink-0 rounded p-1 text-neutral-400 opacity-0 transition hover:text-neutral-700 group-hover/f:opacity-100 group-focus-within/f:opacity-100 [@media(hover:none)]:opacity-100 dark:hover:text-neutral-200",
                          FOCUS_RING
                        )}
                      >
                        <MoreVertical size={14} />
                      </button>
                      {folderMenuId === f.id && (
                        <div className="absolute right-0 top-full z-40 mt-1 w-44 animate-pop-in menu-panel p-1">
                          <button
                            onClick={() => startFolderEdit(f.id, f.name)}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ease-out hover:bg-neutral-100 dark:hover:bg-white/10"
                          >
                            <Pencil size={14} /> {t("common.rename")}
                          </button>
                          <button
                            onClick={() => {
                              setFolderMenuId(null);
                              setPendingFolderDelete(f);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 transition-colors duration-150 ease-out hover:bg-red-500/10"
                          >
                            <Trash2 size={14} /> {t("sidebar.deleteFolder")}
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              {/* Accordion body — grid-rows height animation */}
              <div
                inert={!open}
                className={clsx(
                  "grid transition-all duration-200 ease-out",
                  open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                )}
              >
                <div className="overflow-hidden">
                  <div className="pl-3 pt-0.5">
                    {fChats.length ? (
                      fChats.map(chatRow)
                    ) : (
                      <p className="px-3 py-1 text-xs text-neutral-400">
                        {t("sidebar.folderEmpty")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Root drop zone — fills the rest of the list so dropping a chat
            anywhere below the folders removes it from its folder. */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (dragOverFolder !== "__root__") setDragOverFolder("__root__");
          }}
          onDragLeave={() =>
            setDragOverFolder((cur) => (cur === "__root__" ? null : cur))
          }
          onDrop={(e) => dropOnFolder(e, null)}
          className={clsx(
            "mt-1 flex-1 rounded-xl transition-colors duration-150 ease-out",
            dragOverFolder === "__root__" &&
              draggingChatId &&
              "bg-accent/5 ring-1 ring-accent/20"
          )}
        >
          {pinned.length > 0 && (
            <div className="mb-2">
              <div className="flex items-center gap-1 px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 opacity-60">
                <Pin size={10} /> {t("sidebar.pinned")}
              </div>
              {pinned.map(chatRow)}
            </div>
          )}
          {(wsFolders.length > 0 || pinned.length > 0) && rest.length > 0 && (
            <div className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 opacity-60">
              {t("sidebar.chats")}
            </div>
          )}
          {rest.map(chatRow)}
        </div>
      </nav>

      {/* Footer — floating profile card + popover menu */}
      <div className="relative p-2" ref={footerRef}>
        {/* Cyber-glass popover */}
        <div
          inert={!menuOpen}
          className={clsx(
            "absolute bottom-16 left-2 right-2 z-50 mb-1 flex origin-bottom flex-col gap-1 rounded-2xl border border-white/[0.08] bg-zinc-950/90 p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-md transition-all duration-200 ease-expo",
            menuOpen
              ? "translate-y-0 scale-100 opacity-100"
              : "pointer-events-none translate-y-1 scale-95 opacity-0"
          )}
        >
          {/* Header — current user (non-clickable) */}
          <div className="mb-1 truncate border-b border-white/[0.05] px-3 py-2 font-mono text-xs text-zinc-500">
            {authUser?.username ?? t("sidebar.signedIn")}
          </div>
          <button
            onClick={switchAccount}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-white/[0.04]"
          >
            <Users size={16} strokeWidth={1.5} className="shrink-0 text-zinc-400" />
            {t("sidebar.switchAccount")}
          </button>
          <button
            onClick={openProfile}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-white/[0.04]"
          >
            <User size={16} strokeWidth={1.5} className="shrink-0 text-zinc-400" />
            {t("sidebar.profile")}
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
            {t("common.signOut")}
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-xl border border-black/[0.06] bg-black/[0.02] p-2 backdrop-blur-sm dark:border-white/[0.05] dark:bg-zinc-950/20">
          {/* Profile — opens popover */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            title={t("sidebar.accountMenu")}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left transition-colors"
          >
            <div className="relative shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
                {initialOf(authUser)}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white dark:ring-zinc-900" />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-medium">
                {fullNameOf(authUser) || t("sidebar.user")}
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
              onClick={() => setGlobalNotesOpen(!globalNotesOpen)}
              title={t("sidebar.notesTitle")}
              aria-label={t("sidebar.notes")}
              aria-pressed={globalNotesOpen}
              className={clsx(
                "rounded-lg p-1.5 transition-colors",
                globalNotesOpen
                  ? "text-accent"
                  : "text-zinc-500 hover:text-neutral-900 dark:hover:text-white"
              )}
            >
              <StickyNote size={17} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              title={t(showWhatsNewDot ? "sidebar.settingsUpdates" : "common.settings")}
              aria-label={t(showWhatsNewDot ? "sidebar.settingsUpdates" : "common.settings")}
              className="relative rounded-lg p-1.5 text-zinc-500 transition-colors hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:hover:text-white"
            >
              <Settings size={17} strokeWidth={1.5} />
              {showWhatsNewDot && (
                <span
                  aria-hidden
                  className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-accent ring-2 ring-sidebar-light dark:ring-sidebar-dark"
                />
              )}
            </button>
            <button
              onClick={handleThemeClick}
              title={t(theme === "light" ? "common.darkMode" : "common.lightMode")}
              aria-label={t(theme === "light" ? "common.darkMode" : "common.lightMode")}
              className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:hover:text-white"
            >
              {theme === "light" ? (
                <Moon size={17} strokeWidth={1.5} />
              ) : (
                <Sun size={17} strokeWidth={1.5} />
              )}
            </button>
          </div>
        </div>
      </div>
      </div>
    </aside>

      {pendingDelete && (
        <Modal onClose={() => setPendingDelete(null)}>
          <h2 className="text-lg font-bold">{t("sidebar.deleteChatTitle")}</h2>
          <p className="mt-2 text-sm text-neutral-500">
            {t("sidebar.deleteChatBody")}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setPendingDelete(null)}
              className="rounded-lg border border-border-light px-4 py-2 text-sm font-medium transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={() => {
                deleteChat(pendingDelete.id);
                setPendingDelete(null);
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
            >
              {t("common.delete")}
            </button>
          </div>
        </Modal>
      )}

      {/* Folder delete confirmation — cascades to the chats inside. */}
      {pendingFolderDelete && (
        <Modal onClose={() => setPendingFolderDelete(null)}>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
              <Trash2 size={18} />
            </span>
            <h2 className="text-lg font-bold">
              {t("sidebar.deleteFolderTitle", { name: pendingFolderDelete.name })}
            </h2>
          </div>
          {(() => {
            const n = chats.filter((c) => c.folderId === pendingFolderDelete.id).length;
            const [before, after] = t("sidebar.deleteFolderBody").split("{chats}");
            return (
              <p className="mt-3 text-sm text-neutral-500">
                {before}
                <span className="font-medium text-red-500">
                  {t(n === 1 ? "sidebar.deleteFolderChatsOne" : "sidebar.deleteFolderChats", { n })}
                </span>
                {after}
              </p>
            );
          })()}
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setPendingFolderDelete(null)}
              className="rounded-lg border border-border-light px-4 py-2 text-sm font-medium transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={() => {
                deleteFolder(pendingFolderDelete.id);
                setPendingFolderDelete(null);
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
            >
              {t("sidebar.deleteFolderConfirm")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
