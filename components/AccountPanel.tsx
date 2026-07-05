"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck, ShieldOff, KeyRound, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { providerLabel } from "@/lib/authProvider";

export default function AccountPanel() {
  const router = useRouter();
  const authUser = useStore((s) => s.authUser);
  const setAuthUser = useStore((s) => s.setAuthUser);

  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(
    null
  );
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const d = await fetch("/api/auth/session").then((r) => r.json());
    setAuthUser(d.user ?? null);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    try {
      localStorage.removeItem("nexus-uid");
    } catch {
      /* ignore */
    }
    router.push("/login");
  };

  const changePassword = async () => {
    setPwMsg(null);
    const r = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current: cur, next }),
    });
    const d = await r.json();
    setPwMsg(r.ok ? "Passwort geändert ✓" : d.error || "Fehler");
    if (r.ok) {
      setCur("");
      setNext("");
    }
  };

  const startSetup = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const d = await fetch("/api/account/2fa").then((r) => r.json());
      setSetup({ secret: d.secret, uri: d.uri });
    } finally {
      setBusy(false);
    }
  };

  const enable2fa = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/account/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enable", code }),
      });
      const d = await r.json();
      if (!r.ok) {
        setMsg(d.error || "Fehler");
      } else {
        setSetup(null);
        setCode("");
        setMsg("2FA aktiviert ✓");
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const disable2fa = async () => {
    setBusy(true);
    await fetch("/api/account/2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disable" }),
    });
    await refresh();
    setMsg("2FA deaktiviert");
    setBusy(false);
  };

  if (!authUser)
    return <p className="text-sm text-neutral-500">Nicht angemeldet.</p>;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-medium">Mein Konto</h3>
          <p className="text-sm text-neutral-500">
            {authUser.username}
            {authUser.role === "admin" && " · Admin"} · Anmeldung per{" "}
            {providerLabel(authUser.provider)}
          </p>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1 rounded-lg border border-border-light px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
        >
          <LogOut size={15} /> Abmelden
        </button>
      </div>

      {/* Password */}
      <div className="mb-4 rounded-xl border border-border-light p-3 dark:border-border-dark">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <KeyRound size={15} /> Passwort ändern
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="password"
            value={cur}
            onChange={(e) => setCur(e.target.value)}
            placeholder="Aktuelles Passwort"
            className="input-base"
          />
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="Neues Passwort (min. 6)"
            className="input-base"
          />
        </div>
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={changePassword}
            disabled={!next}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-40"
          >
            Speichern
          </button>
          {pwMsg && <span className="text-sm text-neutral-500">{pwMsg}</span>}
        </div>
      </div>

      {/* 2FA */}
      <div className="rounded-xl border border-border-light p-3 dark:border-border-dark">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <ShieldCheck size={15} /> Zwei-Faktor-Authentifizierung (TOTP)
        </div>

        {authUser.twoFactorEnabled ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-accent">Aktiviert ✓</span>
            <button
              onClick={disable2fa}
              disabled={busy}
              className="flex items-center gap-1 rounded-lg border border-border-light px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
            >
              <ShieldOff size={14} /> Deaktivieren
            </button>
          </div>
        ) : setup ? (
          <div className="space-y-2">
            <p className="text-sm text-neutral-500">
              Secret in Authenticator-App (Google Authenticator, Authy…)
              eintragen, dann Code bestätigen:
            </p>
            <code className="block break-all rounded bg-neutral-100 px-2 py-1 font-mono text-xs dark:bg-white/10">
              {setup.secret}
            </code>
            <a
              href={setup.uri}
              className="block text-xs text-accent underline"
            >
              otpauth-Link öffnen
            </a>
            <div className="flex gap-2">
              <input
                inputMode="numeric"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="6-stelliger Code"
                className="w-40 rounded-lg border border-border-light bg-transparent px-2 py-1.5 text-center tracking-widest outline-none focus:border-accent dark:border-border-dark"
              />
              <button
                onClick={enable2fa}
                disabled={busy || code.length !== 6}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-40"
              >
                Aktivieren
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={startSetup}
            disabled={busy}
            className="flex items-center gap-1 rounded-lg border border-border-light px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            Einrichten
          </button>
        )}
        {msg && <p className="mt-2 text-sm text-neutral-500">{msg}</p>}
      </div>
    </section>
  );
}
