"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, ShieldCheck, LogIn, UserPlus } from "lucide-react";

type Mode = "login" | "register";

const SSO_ERRORS: Record<string, string> = {
  sso_not_configured: "Firmen-Login ist nicht konfiguriert.",
  sso: "Firmen-Login fehlgeschlagen.",
  sso_state: "Sicherheitsprüfung fehlgeschlagen. Bitte erneut versuchen.",
  sso_token: "Token-Austausch fehlgeschlagen.",
  sso_claims: "Kein Benutzername vom Identity-Provider erhalten.",
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [ticket, setTicket] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState("/");

  useEffect(() => {
    try {
      document.documentElement.classList.add("dark");
      const p = new URLSearchParams(window.location.search);
      const e = p.get("error");
      if (e) setError(SSO_ERRORS[e] || "Anmeldung fehlgeschlagen.");
      setFrom(p.get("from") || "/");
    } catch {
      /* ignore */
    }
  }, []);

  const succeed = (user: { id: string }) => {
    try {
      localStorage.setItem("nexus-uid", user.id);
    } catch {
      /* ignore */
    }
    router.push(from);
  };

  const post = (url: string, body: unknown) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const submitLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await post("/api/auth/login", { username, password });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Anmeldung fehlgeschlagen");
      if (d.twoFactor) {
        setTicket(d.ticket);
      } else {
        succeed(d.user);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  const submit2fa = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await post("/api/auth/2fa", { ticket, code });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Code ungültig");
      succeed(d.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  const submitRegister = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await post("/api/auth/register", { username, password });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Registrierung fehlgeschlagen");
      succeed(d.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    if (ticket) submit2fa();
    else if (mode === "login") submitLogin();
    else submitRegister();
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-main-dark px-4 text-neutral-100">
      <div className="w-full max-w-sm rounded-2xl border border-border-dark bg-sidebar-dark p-6 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-white">
            <ShieldCheck size={26} />
          </div>
          <h1 className="text-xl font-bold">OpenChatbox</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {ticket
              ? "Bestätige mit deinem Authenticator-Code"
              : mode === "login"
              ? "Anmelden"
              : "Konto erstellen"}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {ticket ? (
          <div className="space-y-3">
            <input
              autoFocus
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={onKey}
              placeholder="6-stelliger Code"
              className="w-full rounded-lg border border-border-dark bg-transparent px-3 py-2 text-center text-lg tracking-[0.3em] outline-none focus:border-accent"
            />
            <button
              onClick={submit2fa}
              disabled={busy || code.length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2 font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              Bestätigen
            </button>
            <button
              onClick={() => {
                setTicket(null);
                setCode("");
              }}
              className="w-full text-sm text-neutral-400 hover:text-neutral-200"
            >
              Zurück
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={onKey}
              placeholder="Benutzername"
              className="w-full rounded-lg border border-border-dark bg-transparent px-3 py-2 outline-none focus:border-accent"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={onKey}
              placeholder="Passwort"
              className="w-full rounded-lg border border-border-dark bg-transparent px-3 py-2 outline-none focus:border-accent"
            />
            <button
              onClick={mode === "login" ? submitLogin : submitRegister}
              disabled={busy || !username || !password}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2 font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : mode === "login" ? (
                <LogIn size={16} />
              ) : (
                <UserPlus size={16} />
              )}
              {mode === "login" ? "Anmelden" : "Registrieren"}
            </button>

            <div className="relative py-1 text-center text-xs text-neutral-500">
              <span className="bg-sidebar-dark px-2">oder</span>
              <div className="absolute inset-x-0 top-1/2 -z-10 h-px bg-border-dark" />
            </div>

            <a
              href="/api/auth/oidc/start"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border-dark py-2 text-sm font-medium transition hover:bg-white/5"
            >
              <Building2 size={16} /> Mit Firmen-Account anmelden
            </a>

            <button
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError(null);
              }}
              className="w-full pt-1 text-sm text-neutral-400 hover:text-neutral-200"
            >
              {mode === "login"
                ? "Noch kein Konto? Registrieren"
                : "Schon ein Konto? Anmelden"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
