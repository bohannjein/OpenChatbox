"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import ChatWindow from "@/components/ChatWindow";
import SettingsModal from "@/components/SettingsModal";
import SearchModal from "@/components/SearchModal";
import FileManager from "@/components/FileManager";
import { useStore } from "@/lib/store";
import { loadServerState, startProfileSync, startLiveSync } from "@/lib/serverSync";
import { hexToRgbChannels, darkenChannels } from "@/lib/branding";
import { detectBrowserLang } from "@/lib/i18n";
import clsx from "clsx";

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
  const accentColor = useStore((s) => s.accentColor);
  const logoUrl = useStore((s) => s.logoUrl);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const chats = useStore((s) => s.chats);
  const activeChatId = useStore((s) => s.activeChatId);
  const newChat = useStore((s) => s.newChat);
  const selectChat = useStore((s) => s.selectChat);
  const setAuthUser = useStore((s) => s.setAuthUser);
  const setSearchOpen = useStore((s) => s.setSearchOpen);
  const syncError = useStore((s) => s.syncError);
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  const upsertWorkspace = useStore((s) => s.upsertWorkspace);

  const prevPath = useRef<string | null>(null);
  const hydratedRef = useRef(false);
  const isAuthRoute =
    pathname.startsWith("/login") || pathname.startsWith("/share");
  const isSetupRoute = pathname.startsWith("/setup");
  const isJoinRoute = pathname.startsWith("/join-workspace");

  // First-run gate: null = unknown (still checking), true = must run setup.
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => setMounted(true), []);

  // First load: pick UI language from the browser (only if not chosen yet).
  useEffect(() => {
    if (lang === null) setLang(detectBrowserLang());
    document.documentElement.lang = lang ?? detectBrowserLang();
  }, [lang, setLang]);

  // Redirect to the isolated setup screen until the first admin exists.
  // Runs on the app + /login (funnel new operators to setup), but NOT on
  // /setup (self-checks) or /share (public read-only viewer must stay open).
  useEffect(() => {
    if (isSetupRoute || isJoinRoute || pathname.startsWith("/share")) return;
    fetch("/api/setup")
      .then((r) => r.json())
      .then(({ needsSetup }) => {
        setNeedsSetup(!!needsSetup);
        if (needsSetup) router.replace("/setup");
      })
      .catch(() => setNeedsSetup(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Cmd/Ctrl+K → global chat search
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [setSearchOpen]);

  // Hydrate admin-global config + per-user profile + chats from the server ONCE
  // per load. NOT on every navigation — re-hydrating on the router.push that
  // promotes a brand-new chat would clobber it with the (not-yet-saved) server
  // copy and abort the stream. Cross-device updates come from the live-sync poll.
  useEffect(() => {
    if (isAuthRoute || isSetupRoute || isJoinRoute) return;
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      loadServerState();
    }
    // Server is the source of truth for workspace membership (invites) → merge.
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((d) => {
        for (const w of d?.workspaces ?? []) upsertWorkspace({ id: w.id, name: w.name });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Write-through: push per-user preference changes back to the server (debounced)
  // + periodic live re-hydration so another device's changes appear.
  useEffect(() => {
    startProfileSync();
    const stopLive = startLiveSync();
    return () => stopLive();
  }, []);

  // Load session; ensure the per-user storage namespace matches the user.
  useEffect(() => {
    if (isAuthRoute || isSetupRoute || isJoinRoute) return;
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then(({ user }) => {
        setAuthUser(user ?? null);
        const id = user?.id || "anon";
        try {
          if (localStorage.getItem("nexus-uid") !== id) {
            localStorage.setItem("nexus-uid", id);
            location.reload(); // rehydrate store under the right namespace
          }
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
    // Re-run when leaving /login or /setup for the app, so the freshly created
    // (or logged-in) user's session — and role — is loaded without a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthRoute, isSetupRoute]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  // Apply the chosen accent color as CSS custom properties.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", hexToRgbChannels(accentColor));
    root.style.setProperty("--accent-hover", darkenChannels(accentColor));
  }, [accentColor]);

  // Dynamic favicon: custom logo when set, else a default chat-bubble icon.
  useEffect(() => {
    if (isAuthRoute) return;
    const DEFAULT_ICON =
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="rgb(${hexToRgbChannels(
          accentColor
        )})"/><path d="M8 11a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-7l-4 3v-3a3 3 0 0 1-2-3z" fill="#fff"/></svg>`
      );
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = logoUrl && logoUrl.trim() ? logoUrl : DEFAULT_ICON;
  }, [logoUrl, accentColor, isAuthRoute]);

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

  // On /login, /share and /setup the route's own page renders; shell stays hidden.
  if (isAuthRoute || isSetupRoute || isJoinRoute) return null;

  if (!mounted) {
    return <div className="h-dvh w-full bg-main-light dark:bg-main-dark" />;
  }

  // Hold the app back until we know setup is done — avoids flashing the shell
  // before redirecting a fresh install to /setup.
  if (needsSetup !== false) {
    return <div className="h-dvh w-full bg-main-light dark:bg-main-dark" />;
  }

  const isTemp = chats.find((c) => c.id === activeChatId)?.temporary ?? false;

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar />

      <main
        className={clsx(
          "relative flex min-w-0 flex-1 flex-col transition-[margin] duration-200",
          isTemp
            ? "incognito"
            : "bg-main-light dark:bg-main-dark"
        )}
      >
        <ChatWindow key={activeChatId ?? "empty"} />
      </main>

      <SettingsModal />
      <SearchModal />
      <FileManager />
      {syncError && (
        <div className="fixed bottom-3 left-1/2 z-[70] -translate-x-1/2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 shadow-lg dark:border-red-900 dark:bg-red-950/80 dark:text-red-300">
          Serverspeicherung fehlgeschlagen — Änderungen evtl. nur lokal
          (Speicherplatz voll?).
        </div>
      )}
    </div>
  );
}
