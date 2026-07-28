"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, CheckCircle2, XCircle } from "lucide-react";
import InfoTip from "./InfoTip";

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
          ? { ok: true, msg: "Verbindung erfolgreich." }
          : { ok: false, msg: d.error || "Verbindung fehlgeschlagen." }
      );
    } catch {
      setTestResult({ ok: false, msg: "Verbindung fehlgeschlagen." });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Mail size={16} className="text-accent" />
        <h4 className="font-medium">E-Mail-Versand</h4>
        <InfoTip text="Postausgangsserver, über den die App E-Mails verschickt — aktuell für „Passwort vergessen“-Links. Ohne konfiguriertes SMTP ist der Self-Service-Reset inaktiv." />
      </div>
      <p className="mb-3 text-sm text-neutral-500">
        Nötig, damit Nutzer ihr Passwort per E-Mail-Link selbst zurücksetzen können.
      </p>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 accent-[rgb(var(--accent))]"
        />
        E-Mail-Versand aktivieren
      </label>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500">
            Host
            <InfoTip text="Adresse des Postausgangsservers, z. B. smtp.firma.de oder smtp.office365.com." />
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
            Port
            <InfoTip text="465 für implizite TLS-Verschlüsselung, 587 für STARTTLS (üblich), 25 unverschlüsselt." />
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
              Implizites TLS
              <InfoTip text="An = direkte TLS-Verbindung (Port 465). Aus = STARTTLS (Port 587/25). Im Zweifel: 587 + aus." />
            </span>
          </label>
        </div>

        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500">
            Benutzer
            <InfoTip text="Login-Name beim Mailserver — meist die vollständige E-Mail-Adresse des Absenderkontos." />
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
            Passwort
            <InfoTip text="Passwort des Absenderkontos. Wird verschlüsselt gespeichert und nie zurückgegeben. Leer lassen = gespeichertes Passwort behalten." />
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={hasPassword ? "•••••••• (gespeichert)" : "Passwort"}
            className="w-full input-base py-1.5 text-sm"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500">
            Absender (From)
            <InfoTip text='Die im Postfach angezeigte Absenderadresse, z. B. "OpenChatbox <noreply@firma.de>". Leer = Benutzer wird verwendet.' />
          </label>
          <input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="OpenChatbox <noreply@firma.de>"
            className="w-full input-base py-1.5 text-sm"
          />
        </div>

      </div>

      <p className="mt-3 text-xs text-neutral-500">
        Der Link in der Reset-Mail nutzt die öffentliche App-URL aus den
        Branding-Einstellungen. Ist dort nichts gesetzt, rät die App die Adresse
        aus der Anfrage (hinter Proxy / bei Bind auf 0.0.0.0 evtl. unbrauchbar).
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
        {saved && <span className="text-xs text-accent">Gespeichert ✓</span>}
        <button
          onClick={test}
          disabled={testing}
          className="flex items-center gap-1.5 rounded-lg border border-border-light px-3 py-1.5 text-sm transition hover:bg-neutral-100 disabled:opacity-50 dark:border-border-dark dark:hover:bg-white/5"
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : null}
          Speichern & testen
        </button>
        <button
          onClick={save}
          className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover"
        >
          Speichern
        </button>
      </div>
    </div>
  );
}
