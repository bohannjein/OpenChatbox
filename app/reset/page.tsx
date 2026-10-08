"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2, CheckCircle2 } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import BrandFooter from "@/components/BrandFooter";
import { usePublicBrand } from "@/lib/usePublicBrand";
import { useT, withDetail } from "@/lib/i18n";

/**
 * Password-reset completion page. Reached via the tokenized link from the
 * reset email (`/reset?token=…`). Verifies + sets a new password server-side.
 */
export default function ResetPage() {
  const brand = usePublicBrand();
  const t = useT();
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
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(withDetail(t("reset.err"), d?.error));
        return;
      }
      setDone(true);
    } catch {
      setError(t("common.errNetwork"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-main-dark px-4 py-8 text-neutral-100">
      <div className="w-full max-w-sm rounded-2xl border border-border-dark bg-sidebar-dark p-6 shadow-2xl">
        <div className="mb-6 text-center">
          {/* The link arrives by email — showing the company mark makes it
              recognizable instead of looking like a phishing page. */}
          <BrandMark brand={brand} layout="col" className="mb-4 justify-center" />
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-white">
            {done ? <CheckCircle2 size={26} /> : <KeyRound size={26} />}
          </div>
          <h1 className="text-xl font-bold">{t("login.titleReset")}</h1>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {done ? (
          <div className="space-y-4 text-center">
            <p role="status" className="text-sm text-neutral-300">
              {t("reset.done")}
            </p>
            <a
              href="/login"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2 font-medium text-white transition hover:bg-accent-hover"
            >
              {t("reset.toLogin")}
            </a>
          </div>
        ) : !token ? (
          <p className="text-sm text-neutral-400">
            {t("reset.invalid")}
          </p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              autoFocus
              type="password"
              autoComplete="new-password"
              aria-label={t("reset.newPw")}
              required
              aria-invalid={pwTooShort}
              aria-describedby={pwTooShort ? "reset-pw-short" : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("reset.newPwPh")}
              className="w-full rounded-lg border border-border-dark bg-transparent px-3 py-2 outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/60"
            />
            <input
              type="password"
              autoComplete="new-password"
              aria-label={t("reset.confirmPw")}
              required
              aria-invalid={pwMismatch}
              aria-describedby={pwMismatch ? "reset-pw-mismatch" : undefined}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={t("reset.confirmPw")}
              className="w-full rounded-lg border border-border-dark bg-transparent px-3 py-2 outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/60"
            />
            {pwTooShort && (
              <p id="reset-pw-short" className="text-xs text-amber-400">
                {t("reset.tooShort")}
              </p>
            )}
            {pwMismatch && (
              <p id="reset-pw-mismatch" className="text-xs text-amber-400">{t("reset.mismatch")}</p>
            )}
            <button
              type="submit"
              disabled={!canSubmit || busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2 font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              {t("reset.submit")}
            </button>
          </form>
        )}
      </div>

      <BrandFooter brand={brand} />
    </div>
  );
}
