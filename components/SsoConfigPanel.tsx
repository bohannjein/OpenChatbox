"use client";

import { useEffect, useState } from "react";
import { Building2, Copy, Check } from "lucide-react";
import InfoTip from "./InfoTip";
import { useT } from "@/lib/i18n";

type Provider = "entra" | "ad";

interface OidcView {
  enabled: boolean;
  provider: Provider;
  clientId: string;
  tenantId: string;
  authorizeUrl: string;
  tokenUrl: string;
  buttonLabel: string;
  hasSecret: boolean;
}

/**
 * Admin panel to configure SSO (OIDC) for Microsoft Entra ID or a generic
 * Active Directory / OIDC provider (ADFS, Keycloak, …), as an alternative to
 * environment variables. Client secret is write-only (encrypted at rest).
 */
export default function SsoConfigPanel() {
  const t = useT();
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<Provider>("entra");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [hasSecret, setHasSecret] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [authorizeUrl, setAuthorizeUrl] = useState("");
  const [tokenUrl, setTokenUrl] = useState("");
  const [buttonLabel, setButtonLabel] = useState("");
  const [source, setSource] = useState<"config" | "env" | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [redirectUri, setRedirectUri] = useState("");

  useEffect(() => {
    // Prefer the configured public (HTTPS) app URL — that's what the redirect_uri
    // sent to the provider actually uses. Fall back to the browser origin.
    let origin = "";
    try {
      origin = window.location.origin;
      setRedirectUri(`${origin}/api/auth/oidc/callback`);
    } catch {
      /* ignore */
    }
    fetch("/api/config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const base = (d?.appUrl || origin || "").replace(/\/+$/, "");
        if (base) setRedirectUri(`${base}/api/auth/oidc/callback`);
      })
      .catch(() => {});
    fetch("/api/admin/oidc", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const o: OidcView | undefined = d?.oidc;
        setSource(d?.source ?? null);
        if (!o) return;
        setEnabled(o.enabled);
        setProvider(o.provider);
        setClientId(o.clientId);
        setTenantId(o.tenantId);
        setAuthorizeUrl(o.authorizeUrl);
        setTokenUrl(o.tokenUrl);
        setButtonLabel(o.buttonLabel ?? "");
        setHasSecret(o.hasSecret);
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    const body: Record<string, unknown> = {
      enabled,
      provider,
      clientId,
      tenantId,
      authorizeUrl,
      tokenUrl,
      buttonLabel,
    };
    if (clientSecret) body.clientSecret = clientSecret;
    const r = await fetch("/api/admin/oidc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (r?.ok) {
      const d = await r.json();
      setHasSecret(!!d?.oidc?.hasSecret);
      setSource(d?.source ?? null);
      setClientSecret("");
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  };

  const copyRedirect = async () => {
    try {
      await navigator.clipboard.writeText(redirectUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Building2 size={16} className="text-accent" />
        <h4 className="font-medium">{t("admin.sso.title")}</h4>
        <InfoTip text={t("admin.sso.titleInfo")} />
      </div>
      <p className="mb-3 text-sm text-neutral-500">
        {t("admin.sso.intro")}
        {source === "env" && (
          <span className="mt-1 block text-xs text-amber-600 dark:text-amber-500">
            {t("admin.sso.envActive")}
          </span>
        )}
      </p>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 accent-[rgb(var(--accent))]"
        />
        <span className="flex items-center gap-1.5">
          {t("admin.sso.enable")}
          <InfoTip text={t("admin.sso.enableInfo")} />
        </span>
      </label>

      <div className="mt-3 space-y-3">
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500">
            {t("admin.sso.provider")}
            <InfoTip text={t("admin.sso.providerInfo")} />
          </label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as Provider)}
            className="w-full input-base py-1.5 text-sm dark:bg-sidebar-dark"
          >
            <option value="entra">Microsoft Entra ID</option>
            <option value="ad">{t("admin.sso.providerAd")}</option>
          </select>
        </div>

        {/* Redirect URI to register at the provider */}
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500">
            {t("admin.sso.redirect")}
            <InfoTip text={t("admin.sso.redirectInfo")} />
          </label>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={redirectUri}
              className="w-full input-base py-1.5 font-mono text-xs"
            />
            <button
              onClick={copyRedirect}
              title={t("common.copy")}
              aria-label={t("common.copy")}
              className="shrink-0 rounded-lg border border-border-light p-2 transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
            >
              {copied ? <Check size={14} className="text-accent" /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500">
              {t("admin.sso.clientId")}
              <InfoTip text={t("admin.sso.clientIdInfo")} />
            </label>
            <input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              className="w-full input-base py-1.5 font-mono text-xs"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500">
              {t("admin.sso.secret")}
              <InfoTip text={t("admin.sso.secretInfo")} />
            </label>
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={hasSecret ? t("common.secretStored") : t("admin.sso.secret")}
              className="w-full input-base py-1.5 text-sm"
            />
          </div>
        </div>

        {provider === "entra" ? (
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500">
              {t("admin.sso.tenant")}
              <InfoTip text={t("admin.sso.tenantInfo")} />
            </label>
            <input
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder={t("admin.sso.tenantPh")}
              className="w-full input-base py-1.5 font-mono text-xs"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500">
                {t("admin.sso.authorizeUrl")}
                <InfoTip text={t("admin.sso.authorizeUrlInfo")} />
              </label>
              <input
                value={authorizeUrl}
                onChange={(e) => setAuthorizeUrl(e.target.value)}
                placeholder="https://…/authorize"
                className="w-full input-base py-1.5 font-mono text-xs"
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500">
                {t("admin.sso.tokenUrl")}
                <InfoTip text={t("admin.sso.tokenUrlInfo")} />
              </label>
              <input
                value={tokenUrl}
                onChange={(e) => setTokenUrl(e.target.value)}
                placeholder="https://…/token"
                className="w-full input-base py-1.5 font-mono text-xs"
              />
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500">
            {t("admin.sso.buttonLabel")}
            <InfoTip text={t("admin.sso.buttonLabelInfo")} />
          </label>
          <input
            value={buttonLabel}
            onChange={(e) => setButtonLabel(e.target.value)}
            placeholder={t("login.ssoFallback")}
            maxLength={60}
            className="w-full input-base py-1.5 text-sm"
          />
        </div>
      </div>

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
