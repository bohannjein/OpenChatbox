"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, LogIn, UserPlus } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import BrandFooter from "@/components/BrandFooter";
import { DEFAULT_BRANDING, resolveBranding, type BrandingConfig } from "@/lib/branding";

type Mode = "login" | "register" | "forgot";

interface AccessCfg {
  selfRegistration: { enabled: boolean; domains: string[] };
  guest: { enabled: boolean; model: string | null };
  authMethods: { password: boolean; sso: boolean };
  passwordReset: boolean;
  sso: boolean;
}

/**
 * Only allow same-origin internal targets for post-auth navigation. Rejects
 * absolute URLs (`http://evil`) and protocol-relative (`//evil`) so a crafted
 * `?from=` can't turn login into an open redirect. Defaults to "/".
 */
const safeFrom = (raw: string | null | undefined): string => {
  const p = raw ?? "/";
  if (!p.startsWith("/") || p.startsWith("//") || p.startsWith("/\\")) return "/";
  return p;
};

/**
 * Navigate to the app after auth via a FULL document load (not client-side
 * router.push). A hard load discards the previous account's in-memory Zustand
 * store + serverSync module state, so the next account hydrates its own chats
 * from the server instead of inheriting the last user's. Without this, an
 * account with no server chats yet keeps the previous user's chats on screen
 * (hydrateChats preserves local state on an empty server response).
 */
const enterApp = (target: string) => {
  window.location.assign(safeFrom(target));
};

const SSO_ERRORS: Record<string, string> = {
  sso_not_configured: "Firmen-Login ist nicht konfiguriert.",
  sso: "Firmen-Login fehlgeschlagen.",
  sso_state: "Sicherheitsprüfung fehlgeschlagen. Bitte erneut versuchen.",
  sso_token: "Token-Austausch fehlgeschlagen.",
  sso_claims: "Kein Benutzername vom Identity-Provider erhalten.",
  sso_tenant: "Dieser Account gehört nicht zur zugelassenen Organisation.",
};

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [ticket, setTicket] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState("/");
  const [cfg, setCfg] = useState<AccessCfg | null>(null);
  // Branding is served to anonymous callers by /api/config, so the sign-in page
  // shows the company's mark instead of the product default.
  const [brand, setBrand] = useState<BrandingConfig>(DEFAULT_BRANDING);
  // Hold the form back until we've decided login-form vs. guest auto-entry.
  const [ready, setReady] = useState(false);
  // Reveal the password form even when password sign-in is off — the built-in
  // admin recovery path (server still accepts the built-in admin's password).
  const [showPwFallback, setShowPwFallback] = useState(false);
  // Whether the "forgot password" request has been submitted (generic confirm).
  const [forgotSent, setForgotSent] = useState(false);

  useEffect(() => {
    try {
      document.documentElement.classList.add("dark");
    } catch {
      /* ignore */
    }
    const p = new URLSearchParams(window.location.search);
    const e = p.get("error");
    if (e) setError(SSO_ERRORS[e] || "Anmeldung fehlgeschlagen.");
    const fromParam = p.get("from") || "/";
    setFrom(fromParam);
    // Auto-enter guest only when redirected from the app (a `from` is present),
    // not on a direct visit to /login — so users can still reach the sign-in form.
    const cameFromApp = !!p.get("from");

    (async () => {
      try {
        // A logged-in user landing on /login → send them straight in.
        const s = await fetch("/api/auth/session", { cache: "no-store" }).then((r) => r.json());
        if (s?.user) {
          enterApp(fromParam);
          return;
        }
        const c = (await fetch("/api/config", { cache: "no-store" }).then((r) => r.json())) as {
          branding?: Partial<BrandingConfig>;
          selfRegistration?: AccessCfg["selfRegistration"];
          guest?: AccessCfg["guest"];
          authMethods?: { password?: boolean; sso?: boolean };
          passwordReset?: { enabled?: boolean };
          sso?: { enabled?: boolean };
        };
        setBrand(resolveBranding(c));
        setCfg({
          selfRegistration: c?.selfRegistration ?? { enabled: false, domains: [] },
          guest: c?.guest ?? { enabled: false, model: null },
          authMethods: {
            password: c?.authMethods?.password ?? true,
            sso: c?.authMethods?.sso ?? true,
          },
          passwordReset: !!c?.passwordReset?.enabled,
          sso: !!c?.sso?.enabled,
        });
        if (cameFromApp && !e && c?.guest?.enabled && c?.guest?.model) {
          const g = await fetch("/api/auth/guest", { method: "POST" });
          if (g.ok) {
            try {
              localStorage.setItem("nexus-uid", "guest");
            } catch {
              /* ignore */
            }
            enterApp(fromParam);
            return;
          }
        }
      } catch {
        /* fall through to the form */
      }
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const succeed = (user: { id: string }) => {
    try {
      localStorage.setItem("nexus-uid", user.id);
    } catch {
      /* ignore */
    }
    enterApp(from);
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
      if (d.twoFactor) setTicket(d.ticket);
      else succeed(d.user);
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

  const submitForgot = async () => {
    setBusy(true);
    setError(null);
    try {
      // Always succeeds from the caller's view (no account enumeration).
      await post("/api/auth/forgot", { identifier: username });
    } catch {
      /* ignore — generic confirmation either way */
    } finally {
      setForgotSent(true);
      setBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    if (ticket) submit2fa();
    else if (mode === "forgot") submitForgot();
    else if (mode === "login") submitLogin();
    else submitRegister();
  };

  const selfRegEnabled = !!cfg?.selfRegistration.enabled;
  const domains = cfg?.selfRegistration.domains ?? [];
  const ssoEnabled = !!cfg?.sso;
  const passwordEnabled = !!cfg?.authMethods.password;
  // Show the username/password fields when password sign-in is on, or when the
  // built-in-admin recovery fallback has been revealed.
  const showCreds = passwordEnabled || showPwFallback;
  // Registering needs password accounts to be usable at all.
  const canRegister = selfRegEnabled && passwordEnabled;
  // "Forgot password" needs SMTP configured AND password sign-in on.
  const passwordResetEnabled = !!cfg?.passwordReset && passwordEnabled;

  // Splash while deciding (guest auto-entry vs. form) — never flash the form.
  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-main-dark text-neutral-400">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-main-dark px-4 py-8 text-neutral-100">
      <div className="w-full max-w-sm rounded-2xl border border-border-dark bg-sidebar-dark p-6 shadow-2xl">
        <div className="mb-6 text-center">
          <BrandMark brand={brand} size="lg" layout="col" className="mb-3" />
          {brand.tagline && (
            <p className="mt-1 text-sm text-neutral-500">{brand.tagline}</p>
          )}
          <p className="mt-1 text-sm text-neutral-400">
            {ticket
              ? "Bestätige mit deinem Authenticator-Code"
              : mode === "forgot"
              ? "Passwort zurücksetzen"
              : !showCreds
              ? "Mit Firmen-Account anmelden"
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
        ) : mode === "forgot" ? (
          <div className="space-y-3">
            {forgotSent ? (
              <>
                <p className="rounded-lg border border-border-dark bg-white/5 px-3 py-3 text-sm text-neutral-300">
                  Falls ein Konto mit dieser Angabe existiert, wurde ein Link zum
                  Zurücksetzen des Passworts per E-Mail verschickt. Prüfe dein
                  Postfach (auch Spam).
                </p>
                <button
                  onClick={() => {
                    setMode("login");
                    setForgotSent(false);
                  }}
                  className="w-full text-sm text-neutral-400 hover:text-neutral-200"
                >
                  Zurück zur Anmeldung
                </button>
              </>
            ) : (
              <>
                <p className="text-xs text-neutral-500">
                  Gib deinen Benutzernamen oder deine E-Mail ein — wir senden dir
                  einen Link zum Zurücksetzen.
                </p>
                <input
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="Benutzername oder E-Mail"
                  className="w-full rounded-lg border border-border-dark bg-transparent px-3 py-2 outline-none focus:border-accent"
                />
                <button
                  onClick={submitForgot}
                  disabled={busy || !username}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2 font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                  Link anfordern
                </button>
                <button
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                  className="w-full text-sm text-neutral-400 hover:text-neutral-200"
                >
                  Zurück zur Anmeldung
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {showCreds && (
              <>
                <input
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={onKey}
                  placeholder={mode === "register" && domains.length ? "E-Mail-Adresse" : "Benutzername"}
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
                {mode === "register" && domains.length > 0 && (
                  <p className="text-xs text-neutral-500">
                    Registrierung nur mit einer erlaubten Domain:{" "}
                    {domains.map((d) => "@" + d).join(", ")}
                  </p>
                )}
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
              </>
            )}

            {ssoEnabled && (
              <>
                {showCreds && (
                  <div className="relative py-1 text-center text-xs text-neutral-500">
                    <span className="bg-sidebar-dark px-2">oder</span>
                    <div className="absolute inset-x-0 top-1/2 -z-10 h-px bg-border-dark" />
                  </div>
                )}
                <a
                  href="/api/auth/oidc/start"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-border-dark py-2 text-sm font-medium transition hover:bg-white/5"
                >
                  <Building2 size={16} /> Mit Firmen-Account anmelden
                </a>
              </>
            )}

            {/* Footer options — shown in both the login and register masks
                whenever the respective feature is enabled, so "create account"
                and "forgot password" are always reachable. */}
            {canRegister && (
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
            )}

            {passwordResetEnabled && (
              <button
                onClick={() => {
                  setMode("forgot");
                  setError(null);
                  setPassword("");
                }}
                className="w-full text-center text-xs text-neutral-500 hover:text-neutral-300"
              >
                Passwort vergessen?
              </button>
            )}

            {/* Recovery: password sign-in is off, but the built-in admin can
                still sign in with a password. A discreet link reveals the form. */}
            {!passwordEnabled && !showPwFallback && (
              <button
                onClick={() => setShowPwFallback(true)}
                className="w-full pt-1 text-xs text-neutral-500 hover:text-neutral-300"
              >
                Administrator-Anmeldung
              </button>
            )}
          </div>
        )}
      </div>

      {/* Imprint / privacy / support — required by many companies, admin-configured */}
      <BrandFooter brand={brand} />
    </div>
  );
}
