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
  Folder as FolderIcon,
  FolderPlus,
  ChevronRight,
  MoreVertical,
} from "lucide-react";
import { useStore, inWorkspace } from "@/lib/store";
import { useClickOutside } from "@/lib/useClickOutside";
import type { Chat, Folder } from "@/lib/types";
import { SidekickAvatar } from "./SidekickIcon";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import AsciiSpinner from "./AsciiSpinner";
import Modal from "./Modal";
import { useT } from "@/lib/i18n";

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
  useClickOutside(folderMenuRef, () => setFolderMenuId(null));

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
    const id = createFolder("Neuer Ordner");
    setOpenFolders((prev) => new Set(prev).add(id));
    startFolderEdit(id, "Neuer Ordner");
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
  useClickOutside(footerRef, () => setMenuOpen(false));

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
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              onClick={() => setSearchOpen(true)}
              title="Chats durchsuchen (⌘K)"
              className="cursor-pointer rounded-lg p-2 text-zinc-400 transition-all duration-150 hover:text-white active:scale-95 dark:hover:bg-white/5"
            >
              <Search size={18} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              title="Sidebar einklappen"
              className="cursor-pointer rounded-lg p-2 text-zinc-400 transition-all duration-150 hover:text-white active:scale-95 dark:hover:bg-white/5"
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
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-violet-500/20 bg-zinc-950/40 px-3 py-2.5 text-sm font-medium tracking-wide text-violet-700 shadow-[0_0_15px_rgba(139,92,246,0.05)] backdrop-blur-md transition-all duration-150 ease-out hover:scale-[1.01] hover:border-violet-400/40 hover:bg-gradient-to-r hover:from-violet-600/10 hover:to-indigo-600/10 hover:text-violet-900 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)] active:scale-[0.98] dark:text-violet-200 dark:hover:text-white"
          >
            <Plus size={16} />
            {t("sidebar.newChat")}
          </button>
          <button
            onClick={handleCreateFolder}
            title="Ordner erstellen"
            className="flex shrink-0 items-center justify-center rounded-xl border border-violet-500/20 bg-zinc-950/40 p-2.5 text-violet-700 shadow-[0_0_15px_rgba(139,92,246,0.05)] backdrop-blur-md transition-all duration-150 ease-out hover:scale-[1.03] hover:border-violet-400/40 hover:text-violet-900 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)] active:scale-95 dark:text-violet-200 dark:hover:text-white"
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
                    ? "scale-[1.02] border border-violet-500/40 bg-violet-500/10 shadow-[0_0_12px_rgba(139,92,246,0.25)]"
                    : "border border-transparent hover:bg-neutral-200/40 dark:hover:bg-white/[0.02]"
                )}
              >
                {editingF ? (
                  <>
                    <ChevronRight size={14} className="shrink-0 text-zinc-400" />
                    <FolderIcon size={15} className="shrink-0 text-violet-400" />
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
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    >
                      <ChevronRight
                        size={14}
                        className={clsx(
                          "shrink-0 text-zinc-400 transition-transform duration-200 ease-out",
                          open && "rotate-90"
                        )}
                      />
                      <FolderIcon size={15} className="shrink-0 text-violet-400" />
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
                        title="Ordner-Menü"
                        className="shrink-0 rounded p-1 text-neutral-400 opacity-0 transition hover:text-neutral-700 group-hover/f:opacity-100 dark:hover:text-neutral-200"
                      >
                        <MoreVertical size={14} />
                      </button>
                      {folderMenuId === f.id && (
                        <div className="absolute right-0 top-full z-40 mt-1 w-44 animate-pop-in menu-panel p-1">
                          <button
                            onClick={() => startFolderEdit(f.id, f.name)}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ease-out hover:bg-neutral-100 dark:hover:bg-white/10"
                          >
                            <Pencil size={14} /> Umbenennen
                          </button>
                          <button
                            onClick={() => {
                              setFolderMenuId(null);
                              setPendingFolderDelete(f);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 transition-colors duration-150 ease-out hover:bg-red-500/10"
                          >
                            <Trash2 size={14} /> Ordner löschen
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              {/* Accordion body — grid-rows height animation */}
              <div
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
                        Leer — zieh Chats hierher.
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
              "bg-violet-500/5 ring-1 ring-violet-500/20"
          )}
        >
          {pinned.length > 0 && (
            <div className="mb-2">
              <div className="flex items-center gap-1 px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 opacity-60">
                <Pin size={10} /> Angepinnt
              </div>
              {pinned.map(chatRow)}
            </div>
          )}
          {(wsFolders.length > 0 || pinned.length > 0) && rest.length > 0 && (
            <div className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 opacity-60">
              Chats
            </div>
          )}
          {rest.map(chatRow)}
        </div>
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
            onClick={switchAccount}
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

      {/* Cyber-Glass folder delete confirmation — cascades to the chats inside. */}
      {pendingFolderDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 print:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-black/50"
            onClick={() => setPendingFolderDelete(null)}
          />
          <div className="relative z-10 w-full max-w-md animate-pop-in rounded-2xl border border-red-500/20 bg-zinc-950/80 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.7)] backdrop-blur-xl">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                <Trash2 size={18} />
              </span>
              <h2 className="text-lg font-bold text-zinc-100">
                Ordner „{pendingFolderDelete.name}" löschen?
              </h2>
            </div>
            {(() => {
              const count = chats.filter(
                (c) => c.folderId === pendingFolderDelete.id
              ).length;
              return (
                <p className="mt-3 text-sm text-zinc-400">
                  Achtung: Dabei werden auch alle{" "}
                  <span className="font-medium text-red-300">
                    {count} darin enthaltenen Chats
                  </span>{" "}
                  unwiderruflich gelöscht.
                </p>
              );
            })()}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setPendingFolderDelete(null)}
                className="rounded-xl px-4 py-2 text-sm text-zinc-400 transition-colors duration-150 ease-out hover:text-zinc-200"
              >
                Abbrechen
              </button>
              <button
                onClick={() => {
                  deleteFolder(pendingFolderDelete.id);
                  setPendingFolderDelete(null);
                }}
                className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-200 transition-all duration-150 ease-out hover:bg-red-900/60 active:scale-95"
              >
                Ordner &amp; Chats löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
