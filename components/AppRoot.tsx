"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import ChatWindow from "@/components/ChatWindow";
import SettingsModal from "@/components/SettingsModal";
import SearchModal from "@/components/SearchModal";
import FileManager from "@/components/FileManager";
import { useStore, useBrand } from "@/lib/store";
import { loadServerState, startProfileSync, startLiveSync, retrySync } from "@/lib/serverSync";
import { copyText } from "@/lib/clipboard";
import ShortcutsDialog from "@/components/ShortcutsDialog";
import { brandTokens } from "@/lib/branding";
import { detectBrowserLang, useT } from "@/lib/i18n";
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
  const brand = useBrand();
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  // AppRoot wraps the whole shell, so it must not re-render per streamed token:
  // subscribe to the two facts it needs instead of the chats array.
  const urlChatId = pathname.startsWith("/c/")
    ? decodeURIComponent(pathname.slice(3))
    : null;
  const urlChatExists = useStore((s) => s.chats.some((c) => c.id === urlChatId));
  const isTemp = useStore(
    (s) => s.chats.find((c) => c.id === s.activeChatId)?.temporary ?? false
  );
  const activeChatId = useStore((s) => s.activeChatId);
  const newChat = useStore((s) => s.newChat);
  const selectChat = useStore((s) => s.selectChat);
  const setAuthUser = useStore((s) => s.setAuthUser);
  const setGuestMode = useStore((s) => s.setGuestMode);
  const guestMode = useStore((s) => s.guestMode);
  const guestModelKey = useStore((s) => s.guestModelKey);
  const selectModel = useStore((s) => s.selectModel);
  const setAutoRouter = useStore((s) => s.setAutoRouter);
  const setSearchOpen = useStore((s) => s.setSearchOpen);
  const syncError = useStore((s) => s.syncError);
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  const t = useT();
  const upsertWorkspace = useStore((s) => s.upsertWorkspace);

  const prevPath = useRef<string | null>(null);
  const hydratedRef = useRef(false);
  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/reset") ||
    pathname.startsWith("/share");
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

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // Short-lived confirmation (e.g. "Response copied"), announced politely.
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 2000);
    return () => window.clearTimeout(id);
  }, [notice]);

  // Global shortcuts, bound like ChatGPT so switching users keep their habits.
  // The cheat sheet (ShortcutsDialog) lists the same set.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      } else if (mod && (e.key === "/" || e.code === "Slash")) {
        e.preventDefault();
        setShortcutsOpen((o) => !o);
      } else if (e.shiftKey && !mod && e.key === "Escape") {
        e.preventDefault();
        document.getElementById("chat-input")?.focus();
      } else if (mod && e.shiftKey) {
        const st = useStore.getState();
        if (e.code === "KeyO") {
          e.preventDefault();
          if (pathname === "/") st.newChat();
          else router.push("/");
        } else if (e.code === "KeyS") {
          e.preventDefault();
          st.setSidebarOpen(!st.sidebarOpen);
        } else if (e.code === "KeyC") {
          const msgs = st.chats.find((c) => c.id === st.activeChatId)?.messages ?? [];
          const last = [...msgs].reverse().find((m) => m.role === "assistant" && m.content);
          if (!last) return;
          e.preventDefault();
          copyText(last.content).then((ok) => ok && setNotice(t("app.copied")));
        }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [setSearchOpen, pathname, router, t]);

  // Offline banner + automatic re-save when the connection comes back.
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine && useStore.getState().syncError) retrySync();
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

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
      .then(({ user, guest }) => {
        setAuthUser(user ?? null);
        setGuestMode(!!guest);
        // A cookie got us past the middleware but it's neither a valid user nor
        // an (still-enabled) guest → stale/expired/guest-disabled. Back to login.
        if (!user && !guest) {
          router.replace("/login");
          return;
        }
        const id = user?.id || (guest ? "guest" : "anon");
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

  // Reflect the theme onto <html>. Dracula rides on top of `dark` (so every
  // existing `dark:` utility keeps working) plus its own `dracula` class that
  // overrides the surface + accent variables. A short-lived `theme-transition`
  // class cross-fades the switch without slowing down normal hover states.
  const firstThemePaint = useRef(true);
  useEffect(() => {
    const root = document.documentElement;
    const isDarkish = theme === "dark" || theme === "dracula";
    if (!firstThemePaint.current) {
      root.classList.add("theme-transition");
      window.setTimeout(() => root.classList.remove("theme-transition"), 320);
    }
    firstThemePaint.current = false;
    root.classList.toggle("dark", isDarkish);
    root.classList.toggle("dracula", theme === "dracula");
  }, [theme]);

  // Keep the accent CSS variables in sync with the brand. The correct value is
  // already server-rendered into <head> (app/layout.tsx), so this only matters
  // when the admin changes it live or Dracula pins its signature purple.
  useEffect(() => {
    const root = document.documentElement;
    const tokens =
      theme === "dracula"
        ? { "--accent": "189 147 249", "--accent-hover": "165 122 224" } // #bd93f9
        : brandTokens(brand.accentColor);
    for (const [k, v] of Object.entries(tokens)) root.style.setProperty(k, v);
  }, [brand.accentColor, theme]);

  // Guests are pinned to the single admin-configured guest model (and never in
  // Auto mode) — the model switcher is locked in the UI; this enforces it in state.
  useEffect(() => {
    if (guestMode && guestModelKey) {
      selectModel(guestModelKey);
      setAutoRouter(false);
    }
  }, [guestMode, guestModelKey, selectModel, setAutoRouter]);

  // Drive the active chat from the URL.
  useEffect(() => {
    if (!mounted) return;
    if (urlChatId) {
      if (urlChatExists) {
        if (activeChatId !== urlChatId) selectChat(urlChatId);
      } else {
        router.replace("/");
      }
    } else if (pathname === "/") {
      // fresh chat only when we newly arrive at "/" (not on every chats update)
      if (prevPath.current !== "/") newChat();
    }
    prevPath.current = pathname;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, pathname, urlChatExists]);

  // Note: promoting a fresh "/" chat to its own /c/[id] URL happens on send
  // (ChatWindow.handleSend), not via an effect — an effect races the newChat()
  // state update and can bounce back to the previous chat.

  // On /login, /share and /setup the route's own page renders; shell stays hidden.
  if (isAuthRoute || isSetupRoute || isJoinRoute) return null;

  // Hold the app back until mounted and setup is known done — avoids flashing
  // the shell before redirecting a fresh install to /setup. The skeleton keeps
  // the layout steady so the load reads as "opening", not as a blank page.
  if (!mounted || needsSetup !== false) {
    return <AppSkeleton sidebar={!mounted || sidebarOpen} label={t("common.loading")} />;
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

      <main
        className={clsx(
          // Colour + inset ring are transitioned too, so toggling incognito
          // fades to black instead of snapping.
          "relative flex min-w-0 flex-1 flex-col transition-[margin,background-color,box-shadow,color] duration-[400ms] ease-expo motion-reduce:transition-[margin]",
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
      {shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}
      {!online ? (
        <div
          role="status"
          className="fixed bottom-3 left-1/2 z-[70] w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border border-border-light bg-white px-4 py-2 text-sm text-neutral-700 shadow-lg dark:border-border-dark dark:bg-sidebar-dark dark:text-neutral-200">
          {t("app.offline")}
        </div>
      ) : syncError ? (
        <div
          role="alert"
          className="fixed bottom-3 left-1/2 z-[70] flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 shadow-lg dark:border-red-900 dark:bg-red-950/80 dark:text-red-300">
          <span>{t("app.syncError")}</span>
          <button
            onClick={retrySync}
            className="shrink-0 rounded-md px-2 py-1 font-medium underline underline-offset-2 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-900/50">
            {t("app.retry")}
          </button>
        </div>
      ) : null}
      <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-3 left-1/2 z-[70] -translate-x-1/2">
        {notice && (
          <div className="animate-fade-in rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-white dark:text-neutral-900">
            {notice}
          </div>
        )}
      </div>
    </div>
  );
}

/** Placeholder shell shown while the app boots: sidebar column + docked input,
 *  matching the real layout so nothing jumps when it swaps in. */
function AppSkeleton({ sidebar, label }: { sidebar: boolean; label: string }) {
  const bar = "rounded-md bg-black/[0.06] dark:bg-white/[0.06]";
  return (
    <div
      role="status"
      aria-label={label}
      className="flex h-dvh w-full overflow-hidden bg-main-light motion-safe:animate-pulse dark:bg-main-dark"
    >
      {sidebar && (
        <div className="hidden w-72 shrink-0 flex-col gap-3 border-r border-border-light bg-sidebar-light p-3 dark:border-border-dark dark:bg-sidebar-dark md:flex">
          <div className={clsx(bar, "h-10 rounded-xl")} />
          <div className={clsx(bar, "mt-4 h-3 w-16")} />
          {[78, 62, 70, 54, 66, 48].map((w) => (
            <div key={w} className={clsx(bar, "h-4")} style={{ width: `${w}%` }} />
          ))}
        </div>
      )}
      <div className="flex flex-1 flex-col items-center justify-end px-4 pb-10">
        <div className={clsx(bar, "h-14 w-full max-w-3xl rounded-2xl")} />
      </div>
    </div>
  );
}
