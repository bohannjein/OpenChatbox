"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import ChatWindow from "@/components/ChatWindow";
import SettingsModal from "@/components/SettingsModal";
import { useStore } from "@/lib/store";

/**
 * Persistent app shell mounted once in the root layout. It survives route
 * changes, so navigating between `/` and `/c/[id]` does NOT remount ChatWindow
 * (unless the active chat actually changes) — an in-flight stream keeps running.
 *
 * - `/`        → start a fresh chat each time we arrive here.
 * - `/c/[id]`  → activate that chat (own URL); bounce to `/` if it's gone.
 */
export default function AppRoot() {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const theme = useStore((s) => s.theme);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const chats = useStore((s) => s.chats);
  const activeChatId = useStore((s) => s.activeChatId);
  const newChat = useStore((s) => s.newChat);
  const selectChat = useStore((s) => s.selectChat);

  const prevPath = useRef<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  // Drive the active chat from the URL.
  useEffect(() => {
    if (!mounted) return;
    if (pathname.startsWith("/c/")) {
      const id = decodeURIComponent(pathname.slice(3));
      if (chats.some((c) => c.id === id)) {
        if (activeChatId !== id) selectChat(id);
      } else {
        router.replace("/");
      }
    } else if (pathname === "/") {
      // fresh chat only when we newly arrive at "/" (not on every chats update)
      if (prevPath.current !== "/") newChat();
    }
    prevPath.current = pathname;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, pathname, chats]);

  // Note: promoting a fresh "/" chat to its own /c/[id] URL happens on send
  // (ChatWindow.handleSend), not via an effect — an effect races the newChat()
  // state update and can bounce back to the previous chat.

  if (!mounted) {
    return <div className="h-dvh w-full bg-main-light dark:bg-main-dark" />;
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar />

      <main className="relative flex min-w-0 flex-1 flex-col bg-main-light transition-[margin] duration-200 dark:bg-main-dark">
        <ChatWindow key={activeChatId ?? "empty"} />
      </main>

      <SettingsModal />
    </div>
  );
}
