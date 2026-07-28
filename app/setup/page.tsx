"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Rocket,
  Loader2,
  ShieldCheck,
  Server,
  KeyRound,
  Check,
} from "lucide-react";
import { useStore } from "@/lib/store";

type ProviderType = "ollama" | "openai";

const BASE_URL_DEFAULTS: Record<ProviderType, string> = {
  ollama: "http://localhost:11434",
  openai: "https://api.openai.com/v1",
};

export default function SetupPage() {
  const router = useRouter();
  const setAppName = useStore((s) => s.setAppName);
  const upsertProvider = useStore((s) => s.upsertProvider);
  const setAuthUser = useStore((s) => s.setAuthUser);

  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // admin account
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // server data
  const [appName, setAppNameField] = useState("OpenChatbox");
  const [providerType, setProviderType] = useState<ProviderType>("ollama");
  const [baseUrl, setBaseUrl] = useState(BASE_URL_DEFAULTS.ollama);
  const [apiKey, setApiKey] = useState("");
  // track whether the user hand-edited the URL, so switching type can safely
  // swap the default without clobbering a custom value.
  const [urlTouched, setUrlTouched] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    fetch("/api/setup")
      .then((r) => r.json())
      .then(({ needsSetup }) => {
        if (!needsSetup) {
          router.replace("/");
          return;
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  const chooseType = (t: ProviderType) => {
    setProviderType(t);
    if (!urlTouched) setBaseUrl(BASE_URL_DEFAULTS[t]);
  };

  const canSubmit =
    !!username.trim() &&
    password.length >= 8 &&
    password === confirm &&
    !!baseUrl.trim() &&
    (providerType !== "openai" || !!apiKey.trim());

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          confirm,
          appName,
          providerType,
          baseUrl,
          apiKey,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Setup fehlgeschlagen.");

      // Adopt the new admin's storage namespace *before* seeding, so the
      // seeded values persist under the right user and AppRoot won't reload.
      try {
        localStorage.setItem("nexus-uid", d.user.id);
      } catch {
        /* ignore */
      }
      // Populate the session immediately so admin-only UI renders on "/"
      // without waiting for a session round-trip or reload.
      if (d.user) setAuthUser(d.user);
      // Seed client store from the server data the admin just entered.
      if (d.config?.appName) setAppName(d.config.appName);
      if (d.provider) {
        if (d.provider.type === "openai") {
          upsertProvider({
            id: "openai",
            name: "OpenAI",
            type: "openai",
            baseUrl: d.provider.baseUrl,
            apiKey: d.provider.apiKey,
            enabled: true,
          });
        } else {
          upsertProvider({
            id: "ollama-local",
            name: "Ollama (Lokal)",
            type: "ollama",
            baseUrl: d.provider.baseUrl,
            enabled: true,
          });
        }
      }
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-main-dark text-neutral-400">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  const pwMismatch = confirm.length > 0 && password !== confirm;
  const pwTooShort = password.length > 0 && password.length < 8;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-main-dark px-4 py-10 text-neutral-100">
      <div className="w-full max-w-md rounded-2xl border border-border-dark bg-sidebar-dark p-6 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-white">
            <Rocket size={26} />
          </div>
          <h1 className="text-xl font-bold">Willkommen bei OpenChatbox</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Ersteinrichtung — lege das Admin-Konto und die Server-Daten fest.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Admin account */}
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          <ShieldCheck size={14} className="text-accent" /> Admin-Konto
        </div>
        <div className="space-y-3">
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Admin-Benutzername"
            className="w-full rounded-lg border border-border-dark bg-transparent px-3 py-2 outline-none focus:border-accent"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Passwort (min. 8 Zeichen)"
            className="w-full rounded-lg border border-border-dark bg-transparent px-3 py-2 outline-none focus:border-accent"
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Passwort bestätigen"
            className="w-full rounded-lg border border-border-dark bg-transparent px-3 py-2 outline-none focus:border-accent"
          />
          {pwTooShort && (
            <p className="text-xs text-amber-400">
              Passwort muss mindestens 8 Zeichen lang sein.
            </p>
          )}
          {pwMismatch && (
            <p className="text-xs text-amber-400">
              Passwörter stimmen nicht überein.
            </p>
          )}
        </div>

        {/* Server data */}
        <div className="mb-2 mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          <Server size={14} className="text-accent" /> Server-Daten
        </div>
        <div className="space-y-3">
          <input
            value={appName}
            onChange={(e) => setAppNameField(e.target.value)}
            placeholder="Instanz-Name (z. B. OpenChatbox)"
            className="w-full rounded-lg border border-border-dark bg-transparent px-3 py-2 outline-none focus:border-accent"
          />

          <div className="grid grid-cols-2 gap-2">
            {(["ollama", "openai"] as ProviderType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => chooseType(t)}
                className={
                  "flex items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium transition " +
                  (providerType === t
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border-dark text-neutral-300 hover:bg-white/5")
                }
              >
                {providerType === t && <Check size={14} />}
                {t === "ollama" ? "Ollama (lokal)" : "OpenAI-kompatibel"}
              </button>
            ))}
          </div>

          <input
            value={baseUrl}
            onChange={(e) => {
              setUrlTouched(true);
              setBaseUrl(e.target.value);
            }}
            placeholder="Base URL"
            className="w-full rounded-lg border border-border-dark bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-accent"
          />

          {providerType === "openai" && (
            <div className="relative">
              <KeyRound
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
              />
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="API-Key"
                className="w-full rounded-lg border border-border-dark bg-transparent py-2 pl-9 pr-3 outline-none focus:border-accent"
              />
            </div>
          )}
        </div>

        <button
          onClick={submit}
          disabled={!canSubmit || busy}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
          Einrichtung abschließen
        </button>
      </div>
    </div>
  );
}
