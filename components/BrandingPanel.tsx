"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  Loader2,
  RotateCcw,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { useStore } from "@/lib/store";
import {
  DEFAULT_ACCENT,
  DEFAULT_BRANDING,
  brandTokens,
  defaultIconDataUrl,
  normalizeHex,
  sanitizeBranding,
  type BrandingConfig,
} from "@/lib/branding";
import { dominantColorFromDataUrl, resizeLogoToDataUrl } from "@/lib/imageResize";
import { Section, SectionTitle } from "./Section";
import BrandMark from "./BrandMark";
import BrandFooter from "./BrandFooter";
import InfoTip from "./InfoTip";

/** Which asset slots exist, with the max edge length each is downscaled to. */
const ASSETS = [
  {
    key: "logoUrl" as const,
    label: "Logo (dunkler Hintergrund)",
    hint: "PNG mit Transparenz oder SVG. Ersetzt den Namen in der Seitenleiste.",
    maxDim: 512,
    dark: true,
  },
  {
    key: "logoLightUrl" as const,
    label: "Logo (heller Hintergrund)",
    hint: "Optional — nur nötig, wenn das Hauptlogo im hellen Design untergeht.",
    maxDim: 512,
    dark: false,
  },
  {
    key: "faviconUrl" as const,
    label: "Favicon",
    hint: "Optional — ohne Angabe wird das Logo bzw. ein Icon in Akzentfarbe genutzt.",
    maxDim: 128,
    dark: true,
  },
];

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "brand";

/** Labelled text input — the panel is mostly these. */
function Field({
  label,
  value,
  onChange,
  placeholder,
  mono = false,
  info,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  info?: string;
}) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500">
        {label}
        {info && <InfoTip text={info} />}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={"w-full input-base" + (mono ? " font-mono" : "")}
      />
    </div>
  );
}

/**
 * Admin panel for company branding. Edits a local draft and saves explicitly —
 * branding is deliberately excluded from the store's auto-push (lib/serverSync),
 * because that pushed every keystroke live to every user within one sync tick.
 * The preview at the top shows the result before anyone else sees it.
 */
export default function BrandingPanel() {
  const setBrand = useStore((s) => s.setBrand);
  const [draft, setDraft] = useState<BrandingConfig>(DEFAULT_BRANDING);
  const [baseline, setBaseline] = useState<BrandingConfig>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const b = sanitizeBranding(d?.config?.branding ?? d?.config ?? null);
        setDraft(b);
        setBaseline(b);
      })
      .catch(() => setError("Konfiguration konnte nicht geladen werden."))
      .finally(() => setLoading(false));
  }, []);

  const set = (patch: Partial<BrandingConfig>) => {
    setError(null);
    setSaved(false);
    setDraft((d) => ({ ...d, ...patch }));
  };

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branding: draft }),
      });
      if (!r.ok) throw new Error(r.status === 403 ? "Nur Administratoren." : "Speichern fehlgeschlagen.");
      const applied = sanitizeBranding((await r.json())?.config?.branding ?? draft);
      setDraft(applied);
      setBaseline(applied);
      setBrand(applied); // instant effect for this admin; others follow via live sync
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  const pickAsset = async (
    e: React.ChangeEvent<HTMLInputElement>,
    key: (typeof ASSETS)[number]["key"],
    maxDim: number
  ) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      set({ [key]: await resizeLogoToDataUrl(f, maxDim) } as Partial<BrandingConfig>);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bild konnte nicht gelesen werden.");
    }
  };

  const deriveAccent = async () => {
    const src = draft.logoUrl || draft.logoLightUrl;
    if (!src) return setError("Erst ein Logo hochladen.");
    const hex = await dominantColorFromDataUrl(src);
    if (!hex) return setError("Im Logo keine eindeutige Farbe gefunden.");
    set({ accentColor: hex });
  };

  const exportBrand = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `brand-${slug(draft.appName)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importBrand = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      // Same validator as the API — a hand-edited file can't smuggle anything in.
      setDraft(sanitizeBranding(JSON.parse(await f.text())));
      setError(null);
      setSaved(false);
    } catch {
      setError("Datei ist keine gültige Marken-JSON.");
    }
  };

  if (loading)
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-neutral-500">
        <Loader2 size={15} className="animate-spin" /> Marke wird geladen…
      </div>
    );

  const previewIcon = draft.faviconUrl || draft.logoUrl || defaultIconDataUrl(draft.accentColor);

  return (
    <div className="space-y-6">
      {/* ---------- Live preview (scoped accent, does not touch the app) ---------- */}
      <Section>
        <SectionTitle
          title="Vorschau"
          hint="So sieht die Marke aus, sobald du speicherst. Vorher sieht sie niemand sonst."
        />
        <div
          className="grid gap-3 sm:grid-cols-2"
          style={brandTokens(draft.accentColor) as React.CSSProperties}
        >
          {/* Sidebar header, dark + light */}
          <div className="space-y-3">
            <div className="rounded-xl border border-border-dark bg-sidebar-dark p-3">
              <BrandMark brand={draft} dark />
            </div>
            <div className="rounded-xl border border-neutral-200 bg-white p-3 text-neutral-900">
              <BrandMark brand={draft} dark={false} />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border-light px-3 py-2 text-xs text-neutral-500 dark:border-border-dark">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewIcon} alt="" className="h-4 w-4 rounded object-contain" />
              <span className="truncate">{draft.appName} — Browser-Tab</span>
            </div>
          </div>

          {/* Sign-in card */}
          <div className="rounded-xl border border-border-dark bg-main-dark p-4 text-center text-neutral-100">
            <div className="mx-auto max-w-[15rem] rounded-xl border border-border-dark bg-sidebar-dark p-4">
              <BrandMark brand={draft} size="lg" layout="col" />
              {draft.tagline && (
                <p className="mt-1 text-xs text-neutral-500">{draft.tagline}</p>
              )}
              <div className="mt-3 rounded-lg bg-accent py-1.5 text-xs font-medium text-white">
                Anmelden
              </div>
            </div>
            <BrandFooter brand={draft} className="mt-3" />
          </div>
        </div>
      </Section>

      {/* ---------- Name ---------- */}
      <Section>
        <SectionTitle
          title="Name"
          hint="Erscheint in Seitenleiste, Anmeldeseite, Browser-Tab, E-Mails und in der Authenticator-App."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Instanz-/Firmenname"
            value={draft.appName}
            onChange={(appName) => set({ appName })}
            placeholder={DEFAULT_BRANDING.appName}
          />
          <Field
            label="Unterzeile (optional)"
            value={draft.tagline}
            onChange={(tagline) => set({ tagline })}
            placeholder="KI-Assistent der Musterfirma"
          />
        </div>
      </Section>

      {/* ---------- Assets ---------- */}
      <Section>
        <SectionTitle
          title="Logo & Favicon"
          hint="Datei hochladen (PNG/SVG/WebP) oder eine URL eintragen. Uploads werden verkleinert und in der Instanz-Konfiguration gespeichert."
        />
        <div className="space-y-4">
          {ASSETS.map(({ key, label, hint, maxDim, dark }) => (
            <div key={key} className="flex flex-wrap items-start gap-3">
              <div
                className={
                  "flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border " +
                  (dark
                    ? "border-border-dark bg-sidebar-dark"
                    : "border-neutral-200 bg-white")
                }
              >
                {draft[key] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft[key]} alt="" className="max-h-10 max-w-12 object-contain" />
                ) : (
                  <span className="text-[10px] text-neutral-500">leer</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{label}</div>
                <p className="text-xs text-neutral-500">{hint}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border-light px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5">
                    <Upload size={14} /> Datei wählen
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(e) => pickAsset(e, key, maxDim)}
                      className="hidden"
                    />
                  </label>
                  {draft[key] && (
                    <button
                      onClick={() => set({ [key]: "" } as Partial<BrandingConfig>)}
                      className="flex items-center gap-1.5 rounded-lg border border-border-light px-3 py-1.5 text-sm text-neutral-500 transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
                    >
                      <Trash2 size={14} /> Entfernen
                    </button>
                  )}
                  <input
                    value={draft[key].startsWith("data:") ? "" : draft[key]}
                    onChange={(e) => set({ [key]: e.target.value } as Partial<BrandingConfig>)}
                    placeholder={
                      draft[key].startsWith("data:") ? "hochgeladene Datei" : "https://…/logo.png"
                    }
                    disabled={draft[key].startsWith("data:")}
                    className="min-w-0 flex-1 input-base font-mono text-xs disabled:opacity-50"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------- Accent ---------- */}
      <Section>
        <SectionTitle
          title="Akzentfarbe"
          hint="Wird für Buttons, Links und Hervorhebungen verwendet."
        />
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="color"
            value={normalizeHex(draft.accentColor)}
            onChange={(e) => set({ accentColor: e.target.value })}
            title="Akzentfarbe wählen"
            className="h-9 w-12 cursor-pointer rounded-lg border border-border-light bg-transparent dark:border-border-dark"
          />
          <input
            value={draft.accentColor}
            onChange={(e) => set({ accentColor: e.target.value })}
            placeholder={DEFAULT_ACCENT}
            className="w-28 input-base font-mono"
          />
          <button
            onClick={deriveAccent}
            className="flex items-center gap-1.5 rounded-lg border border-border-light px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
          >
            <Wand2 size={14} /> Aus Logo ableiten
          </button>
          <button
            onClick={() => set({ accentColor: DEFAULT_ACCENT })}
            className="rounded-lg border border-border-light px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
          >
            Zurücksetzen (Indigo)
          </button>
          <span
            className="ml-auto h-6 w-6 rounded-full ring-1 ring-black/10"
            style={{ backgroundColor: normalizeHex(draft.accentColor) }}
          />
        </div>
      </Section>

      {/* ---------- Legal + support ---------- */}
      <Section>
        <SectionTitle
          title="Rechtliches & Support"
          hint="Wird unter der Anmeldemaske, im Info-Tab und unter dem Chat verlinkt. Leere Felder erscheinen nicht."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Impressum (URL)"
            value={draft.imprintUrl}
            onChange={(imprintUrl) => set({ imprintUrl })}
            placeholder="https://firma.de/impressum"
            mono
          />
          <Field
            label="Datenschutz (URL)"
            value={draft.privacyUrl}
            onChange={(privacyUrl) => set({ privacyUrl })}
            placeholder="https://firma.de/datenschutz"
            mono
          />
          <Field
            label="Support-E-Mail"
            value={draft.supportEmail}
            onChange={(supportEmail) => set({ supportEmail })}
            placeholder="it-support@firma.de"
            mono
          />
          <Field
            label="Support-Portal (URL)"
            value={draft.supportUrl}
            onChange={(supportUrl) => set({ supportUrl })}
            placeholder="https://intranet.firma.de/ticket"
            mono
            info="Wenn gesetzt, verweist der Support-Link hierauf statt auf die E-Mail-Adresse."
          />
        </div>
      </Section>

      {/* ---------- Public URL ---------- */}
      <Section>
        <SectionTitle
          title="Öffentliche Adresse"
          hint="Basis für absolute Links in E-Mails und SSO-Rücksprüngen."
        />
        <Field
          label="Öffentliche App-URL (HTTPS)"
          value={draft.appUrl}
          onChange={(appUrl) => set({ appUrl })}
          placeholder="https://chat.firma.de"
          mono
          info="Die von außen erreichbare Adresse dieser Instanz, z. B. https://chat.firma.de. Wird für absolute Links in E-Mails (z. B. Passwort-Reset) verwendet. Ohne diese Angabe rät die App die Adresse aus der Anfrage — hinter einem Reverse-Proxy / bei Bind auf 0.0.0.0 ergibt das eine unbrauchbare URL."
        />
      </Section>

      {/* ---------- Provisioning ---------- */}
      <Section>
        <SectionTitle
          title="Übertragen"
          hint="Marke als Datei sichern und auf einer anderen Instanz einlesen. Import landet im Entwurf — gespeichert wird erst unten."
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportBrand}
            className="flex items-center gap-1.5 rounded-lg border border-border-light px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
          >
            <Download size={14} /> Exportieren
          </button>
          <button
            onClick={() => importRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-border-light px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
          >
            <Upload size={14} /> Importieren
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            onChange={importBrand}
            className="hidden"
          />
          <button
            onClick={() => set(DEFAULT_BRANDING)}
            className="flex items-center gap-1.5 rounded-lg border border-border-light px-3 py-1.5 text-sm text-neutral-500 transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
          >
            <RotateCcw size={14} /> Auf Standard zurücksetzen
          </button>
        </div>
      </Section>

      {/* ---------- Save bar ---------- */}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border-light pt-4 dark:border-border-dark">
        {error && <span className="mr-auto text-xs text-red-500">{error}</span>}
        {!error && saved && <span className="text-xs text-accent">Gespeichert ✓</span>}
        {!error && !saved && dirty && (
          <span className="text-xs text-neutral-500">Nicht gespeicherte Änderungen</span>
        )}
        {dirty && (
          <button
            onClick={() => {
              setDraft(baseline);
              setError(null);
            }}
            className="rounded-lg border border-border-light px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
          >
            Verwerfen
          </button>
        )}
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Speichern
        </button>
      </div>
    </div>
  );
}
