"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useStore } from "@/lib/store";
import { loadAllModels, displayName } from "@/lib/providers";
import type { ModelOption } from "@/lib/types";
import InfoTip from "./InfoTip";
import { useT } from "@/lib/i18n";

/**
 * Admin-only access policy: self-registration (with an optional email-domain
 * allow-list) and guest access (with the single model guests may use). Stored in
 * the admin-global config; enforced server-side in the register/guest/chat routes.
 */
export default function AuthAccessPanel() {
  const t = useT();
  const providers = useStore((s) => s.providers);
  const aliases = useStore((s) => s.aliases);

  const [passwordEnabled, setPasswordEnabled] = useState(true);
  const [ssoEnabled, setSsoEnabled] = useState(true);
  const [ssoConfigured, setSsoConfigured] = useState(false);
  const [pwResetEnabled, setPwResetEnabled] = useState(true);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
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
        setPwResetEnabled(c.passwordReset?.enabled ?? true);
        setSmtpConfigured(!!d?.smtpConfigured);
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
        passwordReset: { enabled: pwResetEnabled },
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
        <h4 className="font-medium">{t("admin.access.title")}</h4>
        <p className="text-sm text-neutral-500">
          {t("admin.access.intro")}
        </p>
      </div>

      {/* Sign-in methods */}
      <div className="mb-4 rounded-lg border border-border-light p-3 dark:border-border-dark">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {t("admin.access.methods")}
        </div>

        <div className="flex items-center gap-1.5">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={passwordEnabled}
              onChange={(e) => setPasswordEnabled(e.target.checked)}
              className="h-4 w-4 accent-[rgb(var(--accent))]"
            />
            {t("admin.access.password")}
          </label>
          <InfoTip text={t("admin.access.passwordTip")} />
        </div>
        {!passwordEnabled && (
          <p className="mt-1 pl-6 text-xs text-neutral-500">
            {t("admin.access.passwordOff")}
          </p>
        )}

        <div className="mt-3 flex items-center gap-1.5">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ssoEnabled}
              onChange={(e) => setSsoEnabled(e.target.checked)}
              className="h-4 w-4 accent-[rgb(var(--accent))]"
            />
            {t("admin.access.sso")}
          </label>
          <InfoTip text={t("admin.access.ssoTip")} />
        </div>
        {ssoEnabled && !ssoConfigured && (
          <p className="mt-1 pl-6 text-xs text-amber-600 dark:text-amber-500">
            {t("admin.access.ssoMissing")}
          </p>
        )}
        {!passwordEnabled && !ssoEnabled && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            {t("admin.access.noMethod")}
          </p>
        )}
      </div>

      {/* Self-service password reset */}
      <div className="mb-4 rounded-lg border border-border-light p-3 dark:border-border-dark">
        <div className="flex items-center gap-1.5">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pwResetEnabled}
              onChange={(e) => setPwResetEnabled(e.target.checked)}
              className="h-4 w-4 accent-[rgb(var(--accent))]"
            />
            {t("admin.access.reset")}
          </label>
          <InfoTip text={t("admin.access.resetTip")} />
        </div>
        {pwResetEnabled && !smtpConfigured && (
          <p className="mt-1 pl-6 text-xs text-amber-600 dark:text-amber-500">
            {t("admin.access.smtpMissing")}
          </p>
        )}
      </div>

      {/* Self-registration */}
      <div className="flex items-center gap-1.5">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selfReg}
            onChange={(e) => setSelfReg(e.target.checked)}
            className="h-4 w-4 accent-[rgb(var(--accent))]"
          />
          {t("admin.access.selfReg")}
        </label>
        <InfoTip text={t("admin.access.selfRegTip")} />
      </div>
      {selfReg && (
        <div className="mt-2 pl-6">
          <label className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500">
            {t("admin.access.domains")}
            <InfoTip text={t("admin.access.domainsTip")} />
          </label>
          <textarea
            value={domains}
            onChange={(e) => setDomains(e.target.value)}
            rows={3}
            placeholder={t("admin.access.domainsPh")}
            className="w-full resize-y input-base font-mono"
          />
        </div>
      )}

      {/* Guest access */}
      <div className="mt-5 flex items-center gap-1.5">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={guestEnabled}
            onChange={(e) => setGuestEnabled(e.target.checked)}
            className="h-4 w-4 accent-[rgb(var(--accent))]"
          />
          {t("admin.access.guest")}
        </label>
        <InfoTip text={t("admin.access.guestTip")} />
      </div>
      {guestEnabled && (
        <div className="mt-2 flex items-center gap-2 pl-6">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs text-neutral-500">
              {t("admin.access.guestModel")}
            </label>
            <select
              value={guestModel}
              onChange={(e) => setGuestModel(e.target.value)}
              className="w-full input-base py-1.5 text-sm dark:bg-sidebar-dark"
            >
              <option value="">{t("admin.access.pickModel")}</option>
              {options.map((o) => (
                <option key={o.key} value={o.key}>
                  {displayName(aliases, o.key, o.model)}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={loadModels}
            title={t("admin.access.reloadModels")}
            className="mt-5 shrink-0 rounded-lg border border-border-light p-2 transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
      )}
      {guestEnabled && !guestModel && (
        <p className="mt-1 pl-6 text-xs text-amber-600 dark:text-amber-500">
          {t("admin.access.guestNoModel")}
        </p>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        {saved && <span className="text-xs text-accent">{t("account.saved")}</span>}
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
