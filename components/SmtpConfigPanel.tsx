"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, CheckCircle2, XCircle } from "lucide-react";
import { useBrand } from "@/lib/store";
import InfoTip from "./InfoTip";
import { useT } from "@/lib/i18n";

interface SmtpView {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from: string;
  hasPassword: boolean;
}

/**
 * Admin panel for the outbound SMTP mail server used to send password-reset
 * links. The password is write-only (stored encrypted; never sent back) — an
 * empty field keeps the stored one.
 */
export default function SmtpConfigPanel() {
  const t = useT();
  const brand = useBrand();
  const [enabled, setEnabled] = useState(false);
  const [host, setHost] = useState("");
  const [port, setPort] = useState(587);
  const [secure, setSecure] = useState(false);
  const [user, setUser] = useState("");
  const [from, setFrom] = useState("");
  const [password, setPassword] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/smtp", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const s: SmtpView | undefined = d?.smtp;
        if (!s) return;
        setEnabled(s.enabled);
        setHost(s.host);
        setPort(s.port || 587);
        setSecure(s.secure);
        setUser(s.user);
        setFrom(s.from);
        setHasPassword(s.hasPassword);
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setTestResult(null);
    const body: Record<string, unknown> = { enabled, host, port, secure, user, from };
    if (password) body.password = password; // empty keeps the stored one
    const r = await fetch("/api/admin/smtp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (r?.ok) {
      const d = await r.json();
      setHasPassword(!!d?.smtp?.hasPassword);
      setPassword("");
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  };

  // Save current values first, then verify the stored connection.
  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await save();
      const r = await fetch("/api/admin/smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const d = await r.json();
      setTestResult(
        r.ok
          ? { ok: true, msg: t("admin.smtp.okTest") }
          : { ok: false, msg: d.error || t("admin.smtp.errTest") }
      );
    } catch {
      setTestResult({ ok: false, msg: t("admin.smtp.errTest") });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Mail size={16} className="text-accent" />
        <h4 className="font-medium">{t("admin.smtp.title")}</h4>
        <InfoTip text={t("admin.smtp.titleInfo")} />
      </div>
      <p className="mb-3 text-sm text-neutral-500">
        {t("admin.smtp.intro")}
      </p>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 accent-[rgb(var(--accent))]"
        />
        {t("admin.smtp.enable")}
      </label>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500">
            {t("admin.smtp.host")}
            <InfoTip text={t("admin.smtp.hostInfo")} />
          </label>
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="smtp.firma.de"
            className="w-full input-base py-1.5 font-mono text-sm"
          />
        </div>

        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500">
            {t("admin.smtp.port")}
            <InfoTip text={t("admin.smtp.portInfo")} />
          </label>
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            placeholder="587"
            className="w-full input-base py-1.5 text-sm"
          />
        </div>

        <div className="flex items-end">
          <label className="flex cursor-pointer items-center gap-2 pb-1.5 text-sm">
            <input
              type="checkbox"
              checked={secure}
              onChange={(e) => setSecure(e.target.checked)}
              className="h-4 w-4 accent-[rgb(var(--accent))]"
            />
            <span className="flex items-center gap-1.5">
              {t("admin.smtp.tls")}
              <InfoTip text={t("admin.smtp.tlsInfo")} />
            </span>
          </label>
        </div>

        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500">
            {t("admin.smtp.user")}
            <InfoTip text={t("admin.smtp.userInfo")} />
          </label>
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="noreply@firma.de"
            className="w-full input-base py-1.5 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500">
            {t("common.password")}
            <InfoTip text={t("admin.smtp.passwordInfo")} />
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={hasPassword ? t("common.secretStored") : t("common.password")}
            className="w-full input-base py-1.5 text-sm"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500">
            {t("admin.smtp.from")}
            <InfoTip
              text={t("admin.smtp.fromInfo", { app: brand.appName })}
            />
          </label>
          <input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="noreply@firma.de"
            className="w-full input-base py-1.5 text-sm"
          />
        </div>

      </div>

      <p className="mt-3 text-xs text-neutral-500">
        {t("admin.smtp.linkNote")}
      </p>

      {testResult && (
        <div
          className={
            "mt-3 flex items-center gap-1.5 text-sm " +
            (testResult.ok ? "text-accent" : "text-red-500")
          }
        >
          {testResult.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          {testResult.msg}
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        {saved && <span className="text-xs text-accent">{t("account.saved")}</span>}
        <button
          onClick={test}
          disabled={testing}
          className="flex items-center gap-1.5 rounded-lg border border-border-light px-3 py-1.5 text-sm transition hover:bg-neutral-100 disabled:opacity-50 dark:border-border-dark dark:hover:bg-white/5"
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : null}
          {t("admin.smtp.saveTest")}
        </button>
        <button
          onClick={save}
          className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover"
        >
          {t("common.save")}
        </button>
      </div>
    </div>
  );
}
