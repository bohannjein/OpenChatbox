"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useStore } from "@/lib/store";
import { loadAllModels, displayName } from "@/lib/providers";
import type { ModelOption } from "@/lib/types";

/**
 * Admin-only access policy: self-registration (with an optional email-domain
 * allow-list) and guest access (with the single model guests may use). Stored in
 * the admin-global config; enforced server-side in the register/guest/chat routes.
 */
export default function AuthAccessPanel() {
  const providers = useStore((s) => s.providers);
  const aliases = useStore((s) => s.aliases);

  const [passwordEnabled, setPasswordEnabled] = useState(true);
  const [ssoEnabled, setSsoEnabled] = useState(true);
  const [ssoConfigured, setSsoConfigured] = useState(false);
  const [selfReg, setSelfReg] = useState(false);
  const [domains, setDomains] = useState("");
  const [guestEnabled, setGuestEnabled] = useState(false);
  const [guestModel, setGuestModel] = useState("");
  const [options, setOptions] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const c = d?.config ?? {};
        setPasswordEnabled(c.authMethods?.password?.enabled ?? true);
        setSsoEnabled(c.authMethods?.sso?.enabled ?? true);
        setSsoConfigured(!!d?.ssoConfigured);
        setSelfReg(!!c.selfRegistration?.enabled);
        setDomains((c.selfRegistration?.domains ?? []).join("\n"));
        setGuestEnabled(!!c.guest?.enabled);
        setGuestModel(c.guest?.model ?? "");
      })
      .catch(() => {});
  }, []);

  const loadModels = useCallback(() => {
    setLoading(true);
    loadAllModels(providers)
      .then((r) => setOptions(r.options))
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [providers]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const save = async () => {
    const domainList = domains
      .split(/[\n,]/)
      .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
      .filter(Boolean);
    await fetch("/api/admin/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authMethods: {
          password: { enabled: passwordEnabled },
          sso: { enabled: ssoEnabled },
        },
        selfRegistration: { enabled: selfReg, domains: domainList },
        guest: { enabled: guestEnabled, model: guestModel || null },
      }),
    }).catch(() => {});
    setDomains(domainList.join("\n"));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div>
      <div className="mb-3">
        <h3 className="font-medium">Registrierung & Zugang</h3>
        <p className="text-sm text-neutral-500">
          Welche Anmeldearten verfügbar sind, wer sich registrieren darf, und ob
          nicht angemeldete Gäste den Chatbot testen können.
        </p>
      </div>

      {/* Sign-in methods */}
      <div className="mb-4 rounded-lg border border-border-light p-3 dark:border-border-dark">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Anmeldearten
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={passwordEnabled}
            onChange={(e) => setPasswordEnabled(e.target.checked)}
            className="h-4 w-4 accent-[rgb(var(--accent))]"
          />
          Passwort-Anmeldung erlauben (Benutzername & Passwort)
        </label>
        {!passwordEnabled && (
          <p className="mt-1 pl-6 text-xs text-neutral-500">
            Nutzer melden sich nur per Firmen-Login an. Der Administrator kann sich
            weiterhin per Passwort anmelden (Wiederherstellung).
          </p>
        )}

        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={ssoEnabled}
            onChange={(e) => setSsoEnabled(e.target.checked)}
            className="h-4 w-4 accent-[rgb(var(--accent))]"
          />
          Firmen-Login (SSO / Microsoft Entra ID) erlauben
        </label>
        {ssoEnabled && !ssoConfigured && (
          <p className="mt-1 pl-6 text-xs text-amber-600 dark:text-amber-500">
            SSO ist nicht per Umgebungsvariablen konfiguriert — der Button bleibt
            inaktiv, bis die OIDC-Zugangsdaten hinterlegt sind.
          </p>
        )}
        {!passwordEnabled && !ssoEnabled && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            Achtung: Keine Anmeldeart aktiv. Nur der Administrator kann sich noch
            (per Passwort) anmelden.
          </p>
        )}
      </div>

      {/* Self-registration */}
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={selfReg}
          onChange={(e) => setSelfReg(e.target.checked)}
          className="h-4 w-4 accent-[rgb(var(--accent))]"
        />
        Selbstregistrierung erlauben (zeigt „Registrieren“ auf der Login-Seite)
      </label>
      {selfReg && (
        <div className="mt-2 pl-6">
          <label className="mb-1 block text-xs text-neutral-500">
            Erlaubte E-Mail-Domains (optional, eine pro Zeile). Leer = alle Domains.
          </label>
          <textarea
            value={domains}
            onChange={(e) => setDomains(e.target.value)}
            rows={3}
            placeholder={"firma.de\nfirma.com"}
            className="w-full resize-y input-base font-mono"
          />
        </div>
      )}

      {/* Guest access */}
      <label className="mt-5 flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={guestEnabled}
          onChange={(e) => setGuestEnabled(e.target.checked)}
          className="h-4 w-4 accent-[rgb(var(--accent))]"
        />
        Gast-Zugang erlauben (Nutzung ohne Anmeldung)
      </label>
      {guestEnabled && (
        <div className="mt-2 flex items-center gap-2 pl-6">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs text-neutral-500">
              Gast-Modell (das einzige Modell, das Gäste nutzen dürfen)
            </label>
            <select
              value={guestModel}
              onChange={(e) => setGuestModel(e.target.value)}
              className="w-full input-base py-1.5 text-sm dark:bg-sidebar-dark"
            >
              <option value="">— Modell wählen —</option>
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {displayName(aliases, o.key, o.model)}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={loadModels}
            title="Modelle neu laden"
            className="mt-5 shrink-0 rounded-lg border border-border-light p-2 transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
      )}
      {guestEnabled && !guestModel && (
        <p className="mt-1 pl-6 text-xs text-amber-600 dark:text-amber-500">
          Ohne gewähltes Gast-Modell bleibt der Gast-Zugang inaktiv.
        </p>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        {saved && <span className="text-xs text-accent">Gespeichert ✓</span>}
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
