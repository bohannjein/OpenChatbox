"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  Ghost,
} from "lucide-react";
import { useStore } from "@/lib/store";

export default function Sidebar() {
  const router = useRouter();
  const allChats = useStore((s) => s.chats);
  const chats = allChats.filter((c) => !c.temporary);
  const activeChatId = useStore((s) => s.activeChatId);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const theme = useStore((s) => s.theme);
  const incognito = useStore((s) => s.incognito);
  const setIncognito = useStore((s) => s.setIncognito);
  const deleteChat = useStore((s) => s.deleteChat);
  const renameChat = useStore((s) => s.renameChat);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

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
    router.push("/");
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  return (
    <aside
      className={clsx(
        "z-30 flex h-dvh w-72 flex-col border-r border-border-light bg-sidebar-light dark:border-border-dark dark:bg-sidebar-dark print:hidden",
        "fixed inset-y-0 left-0 transition-transform duration-200 md:static md:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:hidden"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 p-3">
        <button
          onClick={startNewChat}
          className="flex flex-1 items-center gap-2 rounded-lg border border-border-light bg-white px-3 py-2 text-sm font-medium transition hover:bg-neutral-100 dark:border-border-dark dark:bg-transparent dark:hover:bg-white/5"
        >
          <Plus size={16} />
          Neuer Chat
        </button>
        <button
          onClick={() => setSidebarOpen(false)}
          title="Sidebar einklappen"
          className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-200 dark:hover:bg-white/5"
        >
          <PanelLeftClose size={18} />
        </button>
      </div>

      {/* Chat list */}
      <nav className="flex-1 overflow-y-auto px-2 py-1">
        {chats.length === 0 && (
          <p className="px-3 py-4 text-sm text-neutral-500">
            Noch keine Chats.
          </p>
        )}
        {chats.map((c) => {
          const active = c.id === activeChatId;
          const editing = editingId === c.id;
          return (
            <div
              key={c.id}
              className={clsx(
                "group mb-0.5 flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                active
                  ? "bg-neutral-200 dark:bg-white/10"
                  : "hover:bg-neutral-200/60 dark:hover:bg-white/5"
              )}
            >
              <MessageSquare
                size={16}
                className="shrink-0 text-neutral-500"
              />
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
                  <button onClick={commitEdit} className="text-neutral-500 hover:text-accent">
                    <Check size={15} />
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-neutral-500 hover:text-red-500">
                    <X size={15} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => onSelect(c.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    title={c.title}
                  >
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    {c.draft && c.draft.trim() && (
                      <span className="shrink-0 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                        Entwurf
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => startEdit(c.id, c.title)}
                    className="shrink-0 text-neutral-400 opacity-0 transition hover:text-neutral-700 group-hover:opacity-100 dark:hover:text-neutral-200"
                    title="Umbenennen"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => deleteChat(c.id)}
                    className="shrink-0 text-neutral-400 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                    title="Löschen"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border-light p-2 dark:border-border-dark">
        <button
          onClick={() => {
            const next = !incognito;
            setIncognito(next);
            router.push("/");
            if (window.innerWidth < 768) setSidebarOpen(false);
          }}
          className={clsx(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
            incognito
              ? "bg-accent/15 text-accent"
              : "hover:bg-neutral-200/60 dark:hover:bg-white/5"
          )}
        >
          <Ghost size={16} />
          Temporärer Chat {incognito ? "(an)" : ""}
        </button>
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-neutral-200/60 dark:hover:bg-white/5"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-neutral-200/60 dark:hover:bg-white/5"
        >
          <Settings size={16} />
          Einstellungen
        </button>
      </div>
    </aside>
  );
}
