"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  FileText,
  ScanText,
  FileOutput,
  BookOpen,
  Check,
} from "lucide-react";

type Flags = { officeParser: boolean; ocrEngine: boolean; docGenerator: boolean };

const ITEMS: { key: keyof Flags; label: string; desc: string; Icon: typeof FileText }[] = [
  {
    key: "officeParser",
    label: "Office-Datei-Parser (Word/Excel/CSV)",
    desc: "Liest .docx/.xlsx/.pptx/.csv beim Upload serverseitig aus.",
    Icon: FileText,
  },
  {
    key: "ocrEngine",
    label: "Erweiterte OCR-Engine (Bilder/PDFs)",
    desc: "Auto-Modus zieht Text aus Bildern/Dokumenten.",
    Icon: ScanText,
  },
  {
    key: "docGenerator",
    label: "Dokumenten-Generator (PDF/Excel-Export)",
    desc: "Erkennt Erstell-Befehle im Chat und generiert echte Dateien.",
    Icon: FileOutput,
  },
];

// ── Reusable toggle switch (matches the plugin rows) ─────────────────────────
function Switch({
  on,
  onClick,
  disabled,
  title,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={
        "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition " +
        (on ? "bg-accent" : "bg-neutral-300 dark:bg-white/20")
      }
    >
      <span
        className={
          "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all " +
          (on ? "left-[18px]" : "left-0.5")
        }
      />
    </button>
  );
}

interface BookstackState {
  enabled: boolean;
  writeEnabled: boolean;
  baseUrl: string;
  tokenId: string;
  hasSecret: boolean;
}

/** BookStack wiki integration: connection + read/write permission + credentials. */
function BookstackSection() {
  const [bs, setBs] = useState<BookstackState | null>(null);
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/bookstack")
      .then((r) => r.json())
      .then((d) => setBs(d.bookstack))
      .catch(() => setErr("Konnte BookStack-Einstellungen nicht laden."));
  }, []);

  const patch = (p: Partial<BookstackState>) =>
    setBs((s) => (s ? { ...s, ...p } : s));

  const save = async () => {
    if (!bs) return;
    setSaving(true);
    setErr(null);
    setSaved(false);
    try {
      const r = await fetch("/api/admin/bookstack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: bs.enabled,
          writeEnabled: bs.writeEnabled,
          baseUrl: bs.baseUrl,
          tokenId: bs.tokenId,
          // empty → keep the stored secret
          ...(secret.trim() ? { tokenSecret: secret.trim() } : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Speichern fehlgeschlagen.");
      setBs(d.bookstack);
      setSecret("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-8 border-t border-border-light pt-6 dark:border-border-dark">
      <h3 className="flex items-center gap-2 font-medium">
        <BookOpen size={16} className="text-emerald-500" /> BookStack-Wiki
        (Integration)
      </h3>
      <p className="mb-3 text-sm text-neutral-500">
        Verbindet die KI über die BookStack-REST-API. Sie kann dann autonom das
        Wiki durchsuchen, lesen und — bei erlaubtem Schreibzugriff — Seiten
        anlegen, ändern und löschen. Der API-Token wird verschlüsselt
        gespeichert.
      </p>
      {err && <div className="mb-2 text-sm text-red-500">⚠ {err}</div>}
      {!bs ? (
        <Loader2 size={16} className="animate-spin text-neutral-400" />
      ) : (
        <div className="space-y-3">
          {/* Enable toggle */}
          <div className="flex items-start gap-3 rounded-xl border border-border-light p-3 dark:border-border-dark">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Integration aktivieren</div>
              <div className="text-xs text-neutral-500">
                Stellt der KI die BookStack-Werkzeuge im Chat bereit.
              </div>
            </div>
            <Switch on={bs.enabled} onClick={() => patch({ enabled: !bs.enabled })} />
          </div>

          {/* Write toggle */}
          <div className="flex items-start gap-3 rounded-xl border border-border-light p-3 dark:border-border-dark">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Schreibzugriff erlauben</div>
              <div className="text-xs text-neutral-500">
                Ohne diese Option stehen nur Lese-/Such-Werkzeuge zur Verfügung —
                die KI kann keine Seiten erstellen, ändern oder löschen.
              </div>
            </div>
            <Switch
              on={bs.writeEnabled}
              onClick={() => patch({ writeEnabled: !bs.writeEnabled })}
            />
          </div>

          {/* Credentials */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-neutral-500">
                BookStack-URL
              </label>
              <input
                value={bs.baseUrl}
                onChange={(e) => patch({ baseUrl: e.target.value })}
                placeholder="https://wiki.mein-homelab.local"
                className="w-full input-base font-mono"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">
                API Token ID
              </label>
              <input
                value={bs.tokenId}
                onChange={(e) => patch({ tokenId: e.target.value })}
                placeholder="z. B. 3xL9…"
                className="w-full input-base font-mono"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">
                API Token Secret
                {bs.hasSecret && (
                  <span className="ml-1 text-emerald-500">(gespeichert)</span>
                )}
              </label>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder={bs.hasSecret ? "•••••••• (leer = beibehalten)" : "Token Secret"}
                className="w-full input-base font-mono"
              />
            </div>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={15} className="animate-spin" />
            ) : saved ? (
              <Check size={15} />
            ) : null}
            {saved ? "Gespeichert" : "BookStack speichern"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Admin master-switches for server-side background services. */
export default function PluginsPanel() {
  const [flags, setFlags] = useState<Flags | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/plugins")
      .then((r) => r.json())
      .then((d) => setFlags(d.plugins))
      .catch(() => setErr("Konnte Dienste nicht laden."));
  }, []);

  const toggle = async (key: keyof Flags) => {
    if (!flags) return;
    const next = { ...flags, [key]: !flags[key] };
    setFlags(next); // optimistic
    setSaving(key);
    setErr(null);
    try {
      const r = await fetch("/api/admin/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next[key] }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Fehler");
      setFlags(d.plugins);
    } catch (e) {
      setFlags(flags); // rollback
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      <h3 className="font-medium">System-Dienste / Plugins</h3>
      <p className="mb-3 text-sm text-neutral-500">
        Globale Ein/Aus-Schalter für serverseitige Hintergrund-Dienste. Wirkt für
        alle Nutzer.
      </p>
      {err && <div className="mb-2 text-sm text-red-500">⚠ {err}</div>}
      {!flags ? (
        <Loader2 size={16} className="animate-spin text-neutral-400" />
      ) : (
        <div className="space-y-2">
          {ITEMS.map(({ key, label, desc, Icon }) => (
            <div
              key={key}
              className="flex items-start gap-3 rounded-xl border border-border-light p-3 dark:border-border-dark"
            >
              <Icon size={18} className="mt-0.5 shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-neutral-500">{desc}</div>
              </div>
              <Switch
                on={flags[key]}
                onClick={() => toggle(key)}
                disabled={saving === key}
                title={flags[key] ? "Aktiv" : "Deaktiviert"}
              />
            </div>
          ))}
        </div>
      )}

      <BookstackSection />
    </div>
  );
}
