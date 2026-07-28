"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2, CheckCircle2 } from "lucide-react";

/**
 * Password-reset completion page. Reached via the tokenized link from the
 * reset email (`/reset?token=…`). Verifies + sets a new password server-side.
 */
export default function ResetPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    try {
      document.documentElement.classList.add("dark");
    } catch {
      /* ignore */
    }
    const p = new URLSearchParams(window.location.search);
    setToken(p.get("token"));
  }, []);

  const pwTooShort = password.length > 0 && password.length < 8;
  const pwMismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= 8 && password === confirm && !!token;

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Zurücksetzen fehlgeschlagen.");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-main-dark px-4 text-neutral-100">
      <div className="w-full max-w-sm rounded-2xl border border-border-dark bg-sidebar-dark p-6 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-white">
            {done ? <CheckCircle2 size={26} /> : <KeyRound size={26} />}
          </div>
          <h1 className="text-xl font-bold">Passwort zurücksetzen</h1>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {done ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-neutral-300">
              Dein Passwort wurde geändert. Du kannst dich jetzt anmelden.
            </p>
            <a
              href="/login"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2 font-medium text-white transition hover:bg-accent-hover"
            >
              Zur Anmeldung
            </a>
          </div>
        ) : !token ? (
          <p className="text-sm text-neutral-400">
            Kein gültiger Reset-Link. Fordere über die Anmeldeseite einen neuen an.
          </p>
        ) : (
          <div className="space-y-3">
            <input
              autoFocus
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Neues Passwort (min. 8 Zeichen)"
              className="w-full rounded-lg border border-border-dark bg-transparent px-3 py-2 outline-none focus:border-accent"
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Passwort bestätigen"
              className="w-full rounded-lg border border-border-dark bg-transparent px-3 py-2 outline-none focus:border-accent"
            />
            {pwTooShort && (
              <p className="text-xs text-amber-400">
                Passwort muss mindestens 8 Zeichen lang sein.
              </p>
            )}
            {pwMismatch && (
              <p className="text-xs text-amber-400">Passwörter stimmen nicht überein.</p>
            )}
            <button
              onClick={submit}
              disabled={!canSubmit || busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2 font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              Passwort setzen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
