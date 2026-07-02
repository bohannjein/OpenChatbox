"use client";

import { useEffect, useState } from "react";
import { Loader2, FileText, ScanText, FileOutput } from "lucide-react";

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
              <button
                role="switch"
                aria-checked={flags[key]}
                onClick={() => toggle(key)}
                disabled={saving === key}
                className={
                  "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition " +
                  (flags[key] ? "bg-accent" : "bg-neutral-300 dark:bg-white/20")
                }
                title={flags[key] ? "Aktiv" : "Deaktiviert"}
              >
                <span
                  className={
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all " +
                    (flags[key] ? "left-[18px]" : "left-0.5")
                  }
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
