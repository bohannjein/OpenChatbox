"use client";

import { useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";
import { loadServerState } from "@/lib/serverSync";
import { useT } from "@/lib/i18n";

type ImgType = "openai" | "automatic1111" | "comfyui";
interface ImgCfg {
  enabled: boolean;
  type: ImgType;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  size?: string;
}

const DEFAULTS: ImgCfg = { enabled: false, type: "openai", size: "1024x1024" };

/**
 * Admin panel for the image-generation backend. Key stays server-side. Used by
 * the Auto-mode image-generation scenario (/api/image).
 */
export default function ImageGenPanel() {
  const t = useT();
  const [cfg, setCfg] = useState<ImgCfg>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCfg({ ...DEFAULTS, ...(d?.config?.imageGen ?? {}) }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageGen: cfg }),
      });
      await loadServerState();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const set = (p: Partial<ImgCfg>) => setCfg((c) => ({ ...c, ...p }));

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h4 className="font-medium">Backend</h4>
          <p className="text-sm text-neutral-500">
            {t("admin.imagegen.desc")}
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving || loading}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
          {saved ? t("common.saved") : t("common.save")}
        </button>
      </div>

      {loading ? (
        <p className="py-4 text-center text-sm text-neutral-400">{t("common.loading")}</p>
      ) : (
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={cfg.enabled}
              onChange={(e) => set({ enabled: e.target.checked })}
              className="h-4 w-4 accent-[rgb(var(--accent))]"
            />
            {t("admin.imagegen.enable")}
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Backend</label>
              <select
                value={cfg.type}
                onChange={(e) => set({ type: e.target.value as ImgType })}
                className="w-full input-base dark:bg-sidebar-dark"
              >
                <option value="openai">{t("admin.imagegen.openaiCompat")}</option>
                <option value="automatic1111">Automatic1111 (/sdapi)</option>
                <option value="comfyui">{t("admin.imagegen.comfyui")}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">{t("admin.imagegen.size")}</label>
              <input
                value={cfg.size ?? ""}
                onChange={(e) => set({ size: e.target.value })}
                placeholder="1024x1024"
                className="w-full input-base font-mono"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-neutral-500">
              {t("admin.providers.baseUrl")} {cfg.type === "openai" ? t("admin.imagegen.emptyIsOpenai") : ""}
            </label>
            <input
              value={cfg.baseUrl ?? ""}
              onChange={(e) => set({ baseUrl: e.target.value })}
              placeholder={
                cfg.type === "automatic1111"
                  ? "http://localhost:7860"
                  : "https://api.openai.com/v1"
              }
              className="w-full input-base font-mono"
            />
          </div>

          {cfg.type === "openai" && (
            <>
              <div>
                <label className="mb-1 block text-xs text-neutral-500">{t("admin.imagegen.model")}</label>
                <input
                  value={cfg.model ?? ""}
                  onChange={(e) => set({ model: e.target.value })}
                  placeholder="gpt-image-1 / dall-e-3"
                  className="w-full input-base font-mono"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-neutral-500">{t("common.apiKey")}</label>
                <input
                  type="password"
                  value={cfg.apiKey ?? ""}
                  onChange={(e) => set({ apiKey: e.target.value })}
                  placeholder="sk-…"
                  className="w-full input-base font-mono"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
