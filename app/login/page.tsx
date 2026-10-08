"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, LogIn, UserPlus } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import BrandFooter from "@/components/BrandFooter";
import { DEFAULT_BRANDING, resolveBranding, type BrandingConfig } from "@/lib/branding";
import { useT, withDetail, type StringKey } from "@/lib/i18n";

type Mode = "login" | "register" | "forgot";

interface AccessCfg {
  selfRegistration: { enabled: boolean; domains: string[] };
  guest: { enabled: boolean; model: string | null };
  authMethods: { password: boolean; sso: boolean };
  passwordReset: boolean;
  sso: boolean;
  /** Button wording — admin-configurable; empty = the translated Microsoft default. */
  ssoLabel: string;
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

/** `?error=` codes from the OIDC callback → message keys. */
const SSO_ERRORS: Record<string, StringKey> = {
  sso_not_configured: "login.sso.sso_not_configured",
  sso: "login.sso.sso",
  sso_state: "login.sso.sso_state",
  sso_token: "login.sso.sso_token",
  sso_claims: "login.sso.sso_claims",
  sso_tenant: "login.sso.sso_tenant",
};

export default function LoginPage() {
  const t = useT();
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
    if (e) setError(t(SSO_ERRORS[e] ?? "login.failed"));
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
          sso?: { enabled?: boolean; label?: string };
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
          ssoLabel: c?.sso?.label?.trim() || "",
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
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        // 401 is fully explained by the main text; other refusals (locked,
        // password sign-in off, …) carry their reason in the server detail.
        setError(
          r.status === 401
            ? t("login.err.credentials")
            : withDetail(t("login.err.login"), d?.error)
        );
        return;
      }
      if (d.twoFactor) setTicket(d.ticket);
      else succeed(d.user);
    } catch {
      setError(t("common.errNetwork"));
    } finally {
      setBusy(false);
    }
  };

  const submit2fa = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await post("/api/auth/2fa", { ticket, code });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(withDetail(t("login.err.code"), d?.error));
        return;
      }
      succeed(d.user);
    } catch {
      setError(t("common.errNetwork"));
    } finally {
      setBusy(false);
    }
  };

  const submitRegister = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await post("/api/auth/register", { username, password });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(withDetail(t("login.err.register"), d?.error));
        return;
      }
      succeed(d.user);
    } catch {
      setError(t("common.errNetwork"));
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

  const selfRegEnabled = !!cfg?.selfRegistration.enabled;
  const domains = cfg?.selfRegistration.domains ?? [];
  const ssoEnabled = !!cfg?.sso;
  const ssoLabel = cfg?.ssoLabel || t("login.ssoFallback");
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
          <h1 className="mt-1 text-sm text-neutral-400">
            {ticket
              ? t("login.title2fa")
              : mode === "forgot"
              ? t("login.titleReset")
              : !showCreds
              ? ssoLabel
              : mode === "login"
              ? t("common.signIn")
              : t("login.titleRegister")}
          </h1>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {ticket ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy && code.length === 6) submit2fa();
            }}
          >
            <input
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label={t("login.codeLabel")}
              required
              aria-invalid={!!error}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder={t("common.code6")}
              className="w-full rounded-lg border border-border-dark bg-transparent px-3 py-2 text-center text-lg tracking-[0.3em] outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/60"
            />
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2 font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              {t("common.confirm")}
            </button>
            <button
              type="button"
              onClick={() => {
                setTicket(null);
                setCode("");
              }}
              className="w-full text-sm text-neutral-400 hover:text-neutral-200"
            >
              {t("common.back")}
            </button>
          </form>
        ) : mode === "forgot" ? (
          <div className="space-y-3">
            {forgotSent ? (
              <>
                <p role="status" className="rounded-lg border border-border-dark bg-white/5 px-3 py-3 text-sm text-neutral-300">
                  {t("login.forgotSent")}
                </p>
                <button
                  onClick={() => {
                    setMode("login");
                    setForgotSent(false);
                  }}
                  className="w-full text-sm text-neutral-400 hover:text-neutral-200"
                >
                  {t("login.backToLogin")}
                </button>
              </>
            ) : (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!busy && username) submitForgot();
                }}
              >
                <p className="text-xs text-neutral-500">
                  {t("login.forgotHint")}
                </p>
                <input
                  autoFocus
                  autoComplete="username"
                  aria-label={t("login.userOrEmail")}
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t("login.userOrEmail")}
                  className="w-full rounded-lg border border-border-dark bg-transparent px-3 py-2 outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/60"
                />
                <button
                  type="submit"
                  disabled={busy || !username}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2 font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                  {t("login.requestLink")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                  className="w-full text-sm text-neutral-400 hover:text-neutral-200"
                >
                  {t("login.backToLogin")}
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {showCreds && (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (busy || !username || !password) return;
                  if (mode === "login") submitLogin();
                  else submitRegister();
                }}
              >
                <input
                  autoFocus
                  autoComplete={mode === "register" && domains.length ? "email" : "username"}
                  aria-label={t(mode === "register" && domains.length ? "login.emailAddress" : "common.username")}
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t(mode === "register" && domains.length ? "login.emailAddress" : "common.username")}
                  className="w-full rounded-lg border border-border-dark bg-transparent px-3 py-2 outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/60"
                />
                <input
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  aria-label={t("common.password")}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("common.password")}
                  className="w-full rounded-lg border border-border-dark bg-transparent px-3 py-2 outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/60"
                />
                {mode === "register" && domains.length > 0 && (
                  <p className="text-xs text-neutral-500">
                    {t("login.domainOnly", { domains: domains.map((d) => "@" + d).join(", ") })}
                  </p>
                )}
                <button
                  type="submit"
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
                  {t(mode === "login" ? "common.signIn" : "login.register")}
                </button>
              </form>
            )}

            {ssoEnabled && (
              <>
                {showCreds && (
                  <div className="relative py-1 text-center text-xs text-neutral-500">
                    <span className="bg-sidebar-dark px-2">{t("login.or")}</span>
                    <div className="absolute inset-x-0 top-1/2 -z-10 h-px bg-border-dark" />
                  </div>
                )}
                <a
                  href="/api/auth/oidc/start"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-border-dark py-2 text-sm font-medium transition hover:bg-white/5"
                >
                  <Building2 size={16} /> {ssoLabel}
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
                {t(mode === "login" ? "login.noAccount" : "login.haveAccount")}
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
                {t("login.forgot")}
              </button>
            )}

            {/* Recovery: password sign-in is off, but the built-in admin can
                still sign in with a password. A discreet link reveals the form. */}
            {!passwordEnabled && !showPwFallback && (
              <button
                onClick={() => setShowPwFallback(true)}
                className="w-full pt-1 text-xs text-neutral-500 hover:text-neutral-300"
              >
                {t("login.adminLogin")}
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
