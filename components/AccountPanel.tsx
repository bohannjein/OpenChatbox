"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LogOut,
  ShieldCheck,
  ShieldOff,
  KeyRound,
  Loader2,
  UserCog,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { providerLabel } from "@/lib/authProvider";
import { fullNameOf } from "@/lib/personName";
import InfoTip from "./InfoTip";
import { useT, withDetail } from "@/lib/i18n";

export default function AccountPanel() {
  const router = useRouter();
  const authUser = useStore((s) => s.authUser);
  const setAuthUser = useStore((s) => s.setAuthUser);
  const t = useT();

  // Self-service identity. Names stay with the admin (or the directory) — only
  // the login name and the address are the user's own to change.
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [idMsg, setIdMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [idBusy, setIdBusy] = useState(false);
  const [domains, setDomains] = useState<string[]>([]);

  useEffect(() => {
    setUsername(authUser?.username ?? "");
    setEmail(authUser?.email ?? "");
  }, [authUser?.username, authUser?.email]);

  // The allowed email domains are the same list that gates self-registration.
  useEffect(() => {
    fetch("/api/config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setDomains(d?.selfRegistration?.domains ?? []))
      .catch(() => {});
  }, []);

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

  const saveIdentity = async () => {
    setIdBusy(true);
    setIdMsg(null);
    try {
      const r = await fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setIdMsg({ ok: false, text: withDetail(t("account.err.identity"), d?.error) });
        return;
      }
      setIdMsg({ ok: true, text: t("account.saved") });
      await refresh();
    } catch {
      setIdMsg({ ok: false, text: t("common.errNetwork") });
    } finally {
      setIdBusy(false);
    }
  };

  const changePassword = async () => {
    setPwMsg(null);
    try {
      const r = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: cur, next }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        // 400 = new password too short; anything else (usually 401) = wrong current one.
        const main = t(r.status === 400 ? "account.err.pwShort" : "account.err.pw");
        setPwMsg(withDetail(main, d?.error));
        return;
      }
      setPwMsg(t("account.pwChanged"));
      setCur("");
      setNext("");
    } catch {
      setPwMsg(t("common.errNetwork"));
    }
  };

  const startSetup = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/account/2fa");
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d?.secret) {
        setMsg(withDetail(t("account.err.2faStart"), d?.error));
        return;
      }
      setSetup({ secret: d.secret, uri: d.uri });
    } catch {
      setMsg(t("common.errNetwork"));
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
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg(withDetail(t("account.err.2faCode"), d?.error));
      } else {
        setSetup(null);
        setCode("");
        setMsg(t("account.2faOn"));
        await refresh();
      }
    } catch {
      setMsg(t("common.errNetwork"));
    } finally {
      setBusy(false);
    }
  };

  const disable2fa = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/account/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable" }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setMsg(withDetail(t("account.err.2faOff"), d?.error));
        return;
      }
      await refresh();
      setMsg(t("account.2faOff"));
    } catch {
      setMsg(t("common.errNetwork"));
    } finally {
      setBusy(false);
    }
  };

  if (!authUser)
    return <p className="text-sm text-neutral-500">{t("account.notSignedIn")}</p>;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h4 className="font-medium">{fullNameOf(authUser) || authUser.username}</h4>
          <p className="text-sm text-neutral-500">
            {authUser.username}
            {authUser.role === "admin" && " · Admin"} ·{" "}
            {authUser.provider === "local"
              ? t("account.signInPassword")
              : t("account.signInVia", { provider: providerLabel(authUser.provider) })}
          </p>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1 rounded-lg border border-border-light px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
        >
          <LogOut size={15} /> {t("common.signOut")}
        </button>
      </div>

      {/* Login name + address */}
      <div className="mb-4 rounded-xl border border-border-light p-3 dark:border-border-dark">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <UserCog size={15} /> {t("account.identity")}
          {domains.length > 0 && (
            <InfoTip
              text={t("account.domainHint", {
                domains: domains.map((d) => "@" + d).join(", "),
              })}
            />
          )}
        </div>
        {authUser.provider !== "local" ? (
          <p className="text-sm text-neutral-500">
            {t("account.managed")}
          </p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-neutral-500">{t("common.username")}</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full input-base"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-neutral-500">
                  {t("account.email")}
                  {domains.length ? ` (${domains.map((d) => "@" + d).join(", ")})` : ""}
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={domains.length ? `name@${domains[0]}` : t("account.emailPh")}
                  className="w-full input-base"
                />
              </div>
            </div>
            <p className="mt-1.5 text-xs text-neutral-500">
              {t("account.namesByAdmin")}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={saveIdentity}
                disabled={
                  idBusy ||
                  (username === (authUser.username ?? "") && email === (authUser.email ?? ""))
                }
                className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-40"
              >
                {idBusy && <Loader2 size={14} className="animate-spin" />}
                {t("common.save")}
              </button>
              {idMsg && (
                <span className={idMsg.ok ? "text-sm text-accent" : "text-sm text-red-500"}>
                  {idMsg.text}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Password */}
      <div className="mb-4 rounded-xl border border-border-light p-3 dark:border-border-dark">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <KeyRound size={15} /> {t("account.changePw")}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="password"
            value={cur}
            onChange={(e) => setCur(e.target.value)}
            placeholder={t("account.curPw")}
            className="input-base"
          />
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder={t("account.newPw")}
            className="input-base"
          />
        </div>
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={changePassword}
            disabled={!next}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-40"
          >
            {t("common.save")}
          </button>
          {pwMsg && <span className="text-sm text-neutral-500">{pwMsg}</span>}
        </div>
      </div>

      {/* 2FA */}
      <div className="rounded-xl border border-border-light p-3 dark:border-border-dark">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <ShieldCheck size={15} /> {t("account.2fa")}
        </div>

        {authUser.twoFactorEnabled ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-accent">{t("account.2faActive")}</span>
            <button
              onClick={disable2fa}
              disabled={busy}
              className="flex items-center gap-1 rounded-lg border border-border-light px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
            >
              <ShieldOff size={14} /> {t("account.2faDisable")}
            </button>
          </div>
        ) : setup ? (
          <div className="space-y-2">
            <p className="text-sm text-neutral-500">
              {t("account.2faSteps")}
            </p>
            <code className="block break-all rounded bg-neutral-100 px-2 py-1 font-mono text-xs dark:bg-white/10">
              {setup.secret}
            </code>
            <a
              href={setup.uri}
              className="block text-xs text-accent underline"
            >
              {t("account.otpLink")}
            </a>
            <div className="flex gap-2">
              <input
                inputMode="numeric"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder={t("common.code6")}
                className="w-40 rounded-lg border border-border-light bg-transparent px-2 py-1.5 text-center tracking-widest outline-none focus:border-accent dark:border-border-dark"
              />
              <button
                onClick={enable2fa}
                disabled={busy || code.length !== 6}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-40"
              >
                {t("account.2faEnable")}
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
            {t("account.2faSetup")}
          </button>
        )}
        {msg && <p className="mt-2 text-sm text-neutral-500">{msg}</p>}
      </div>
    </section>
  );
}
