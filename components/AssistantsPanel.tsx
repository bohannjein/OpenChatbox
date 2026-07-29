"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useStore, useBrand } from "@/lib/store";
import { loadAllModels, displayName, modelKey as mkKey } from "@/lib/providers";
import type { ModelOption } from "@/lib/types";
import InfoTip from "./InfoTip";
import Modal from "./Modal";

/** Mirrors lib/server/assistants.ts, minus the key hashes. */
interface KeyView {
  id: string;
  kind: "secret" | "public";
  last4: string;
  label: string;
  createdAt: number;
  lastUsedAt: number;
  revokedAt?: number;
}
interface AssistantView {
  id: string;
  name: string;
  enabled: boolean;
  modelKey: string;
  systemPrompt: string;
  greeting: string;
  temperature?: number;
  maxTokens?: number;
  kbCategoryIds: string[];
  bookstack: { enabled: boolean; bookIds: number[] };
  webSearch: boolean;
  showSources: boolean;
  limits: {
    perMinute: number;
    perDayPerIp: number;
    perDay: number;
    maxInputChars: number;
    maxHistory: number;
  };
  allowedOrigins: string[];
  usage: {
    requests: number;
    denied: number;
    inChars: number;
    outChars: number;
    lastUsedAt: number;
    dayRequests: number;
  };
  keys: KeyView[];
}

const rel = (ts: number): string => {
  if (!ts) return "nie";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "gerade";
  if (s < 3600) return `vor ${Math.floor(s / 60)} Min`;
  if (s < 86400) return `vor ${Math.floor(s / 3600)} Std`;
  return `vor ${Math.floor(s / 86400)} Tg`;
};

/** Labelled row used throughout the editor. */
function Row({
  label,
  info,
  children,
}: {
  label: string;
  info?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1.5 text-xs text-neutral-500">
        {label}
        {info && <InfoTip text={info} />}
      </label>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  info,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  info?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[rgb(var(--accent))]"
      />
      {label}
      {info && <InfoTip text={info} />}
    </label>
  );
}

/**
 * Admin panel for embedded assistants — the identities behind the public API.
 * Each one pins a model and an explicit slice of the knowledge base, so a foreign
 * website can use the AI without reaching anything it wasn't granted.
 */
export default function AssistantsPanel() {
  const providers = useStore((s) => s.providers);
  const aliases = useStore((s) => s.aliases);
  const bookstackAvailable = useStore((s) => s.bookstackAvailable);
  const searchAvailable = useStore((s) => s.searchAvailable);
  const brand = useBrand();

  const [list, setList] = useState<AssistantView[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AssistantView | null>(null);
  const [options, setOptions] = useState<ModelOption[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [books, setBooks] = useState<{ id: number; name: string }[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AssistantView | null>(null);
  const [copied, setCopied] = useState("");

  const apply = (arr: AssistantView[], keepId?: string | null) => {
    setList(arr);
    const id = keepId ?? selId;
    const found = arr.find((a) => a.id === id) ?? arr[0] ?? null;
    setSelId(found?.id ?? null);
    setDraft(found ? structuredClone(found) : null);
  };

  const load = useCallback(async () => {
    const d = await fetch("/api/admin/assistants", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (d?.assistants) apply(d.assistants as AssistantView[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    fetch("/api/kb", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCategories(d?.categories ?? []))
      .catch(() => {});
  }, [load]);

  useEffect(() => {
    if (!bookstackAvailable) return;
    fetch("/api/admin/bookstack/books", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setBooks(d?.books ?? []))
      .catch(() => {});
  }, [bookstackAvailable]);

  const loadModels = useCallback(() => {
    setLoadingModels(true);
    loadAllModels(providers)
      .then((r) => setOptions(r.options))
      .catch(() => setOptions([]))
      .finally(() => setLoadingModels(false));
  }, [providers]);
  useEffect(() => loadModels(), [loadModels]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/assistants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "Fehlgeschlagen.");
      return d as { assistants: AssistantView[]; assistant?: AssistantView; key?: string };
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    try {
      const d = await post({ action: "create", name: "Neuer Assistent" });
      apply(d.assistants, d.assistant?.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler.");
    }
  };

  const save = async () => {
    if (!draft) return;
    try {
      const d = await post({ action: "update", ...draft });
      apply(d.assistants, draft.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler.");
    }
  };

  const remove = async (a: AssistantView) => {
    setConfirmDelete(null);
    try {
      const d = await post({ action: "delete", id: a.id });
      apply(d.assistants, null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler.");
    }
  };

  const mintKey = async (kind: "secret" | "public") => {
    if (!draft) return;
    try {
      const d = await post({ action: "createKey", id: draft.id, kind });
      apply(d.assistants, draft.id);
      setFreshKey(d.key ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler.");
    }
  };

  const revoke = async (keyId: string) => {
    if (!draft) return;
    try {
      const d = await post({ action: "revokeKey", id: draft.id, keyId });
      apply(d.assistants, draft.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler.");
    }
  };

  const copy = (text: string, what: string) => {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(what);
        setTimeout(() => setCopied(""), 1500);
      },
      () => {}
    );
  };

  const set = (patch: Partial<AssistantView>) =>
    setDraft((d) => (d ? { ...d, ...patch } : d));
  const setLimit = (patch: Partial<AssistantView["limits"]>) =>
    setDraft((d) => (d ? { ...d, limits: { ...d.limits, ...patch } } : d));

  const toggleIn = <T,>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const publicKeys = draft?.keys.filter((k) => k.kind === "public" && !k.revokedAt) ?? [];
  const embedSnippet =
    `<script src="${brand.appUrl || "https://chat.example.com"}/embed.js"\n` +
    `        data-key="${publicKeys[0] ? `ocb_pk_…${publicKeys[0].last4}` : "ocb_pk_…"}" defer></script>`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500">
        Ein Assistent ist ein Zugang für fremde Seiten: festes Modell, eigener
        System-Prompt und genau die Wissensbereiche, die du freigibst. Assistenten
        sind keine Benutzerkonten — Chats, Profile und die Verwaltung bleiben ihnen
        verschlossen.
      </p>

      {error && (
        <div className="rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2 text-sm text-red-500">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[13rem_1fr]">
        {/* List */}
        <div className="space-y-1">
          {list.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                setSelId(a.id);
                setDraft(structuredClone(a));
                setFreshKey(null);
              }}
              className={
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors " +
                (a.id === selId
                  ? "bg-neutral-200 font-medium dark:bg-white/10"
                  : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-white/5")
              }
            >
              <Bot size={15} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate">{a.name}</span>
              <span
                title={a.enabled ? "aktiv" : "deaktiviert"}
                className={
                  "h-1.5 w-1.5 shrink-0 rounded-full " +
                  (a.enabled ? "bg-emerald-500" : "bg-neutral-400")
                }
              />
            </button>
          ))}
          <button
            onClick={create}
            disabled={busy}
            className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border-light px-3 py-2 text-sm text-neutral-500 transition hover:bg-neutral-100 disabled:opacity-50 dark:border-border-dark dark:hover:bg-white/5"
          >
            <Plus size={15} /> Assistent anlegen
          </button>
        </div>

        {/* Editor */}
        {!draft ? (
          <div className="rounded-xl border border-dashed border-border-light p-6 text-sm text-neutral-500 dark:border-border-dark">
            Noch kein Assistent angelegt.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Row label="Name">
                <input
                  value={draft.name}
                  onChange={(e) => set({ name: e.target.value })}
                  className="w-full input-base"
                />
              </Row>
              <Row
                label="Modell (fest)"
                info="Der Aufrufer kann das Modell nicht wählen. Ein im Request mitgeschicktes „model“ wird ignoriert."
              >
                <div className="flex gap-2">
                  <select
                    value={draft.modelKey}
                    onChange={(e) => set({ modelKey: e.target.value })}
                    className="min-w-0 flex-1 input-base"
                  >
                    <option value="">— wählen —</option>
                    {options.map((o) => {
                      const k = mkKey(o.providerId, o.model);
                      return (
                        <option key={k} value={k}>
                          {displayName(aliases, k, o.model)}
                        </option>
                      );
                    })}
                  </select>
                  <button
                    onClick={loadModels}
                    title="Modelle neu laden"
                    className="rounded-lg border border-border-light px-2 transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
                  >
                    {loadingModels ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <RefreshCw size={14} />
                    )}
                  </button>
                </div>
              </Row>
            </div>

            <Row
              label="System-Prompt"
              info="Rolle und Tonfall des Assistenten. Der interne App-Prompt gilt hier absichtlich nicht."
            >
              <textarea
                value={draft.systemPrompt}
                onChange={(e) => set({ systemPrompt: e.target.value })}
                rows={4}
                placeholder="Du bist der Support-Assistent der Musterfirma. Antworte knapp und belege jede Aussage mit der Quelle."
                className="w-full input-base"
              />
            </Row>

            <Row label="Begrüßung im Widget">
              <input
                value={draft.greeting}
                onChange={(e) => set({ greeting: e.target.value })}
                placeholder="Hallo! Frag mich etwas zu unseren Produkten."
                className="w-full input-base"
              />
            </Row>

            <div className="space-y-2">
              <div className="text-sm font-medium">Wissen</div>
              <p className="text-xs text-neutral-500">
                Ohne Auswahl hat der Assistent keinen Zugriff auf Dokumente — das ist
                die Voreinstellung.
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {categories.length === 0 && (
                  <span className="text-xs text-neutral-500">
                    Noch keine Kategorien in der Wissensdatenbank.
                  </span>
                )}
                {categories.map((c) => (
                  <Toggle
                    key={c.id}
                    label={c.name}
                    checked={draft.kbCategoryIds.includes(c.id)}
                    onChange={() => set({ kbCategoryIds: toggleIn(draft.kbCategoryIds, c.id) })}
                  />
                ))}
              </div>
            </div>

            {bookstackAvailable && (
              <div className="space-y-2">
                <Toggle
                  label="BookStack-Wiki nutzen"
                  checked={draft.bookstack.enabled}
                  onChange={(enabled) => set({ bookstack: { ...draft.bookstack, enabled } })}
                  info="Nur die unten gewählten Bücher werden durchsucht. Ohne Buchauswahl findet der Assistent nichts."
                />
                {draft.bookstack.enabled && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 pl-6">
                    {books.length === 0 && (
                      <span className="text-xs text-neutral-500">
                        Keine Bücher gefunden (BookStack nicht erreichbar?).
                      </span>
                    )}
                    {books.map((b) => (
                      <Toggle
                        key={b.id}
                        label={b.name}
                        checked={draft.bookstack.bookIds.includes(b.id)}
                        onChange={() =>
                          set({
                            bookstack: {
                              ...draft.bookstack,
                              bookIds: toggleIn(draft.bookstack.bookIds, b.id),
                            },
                          })
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {searchAvailable && (
                <Toggle
                  label="Web-Suche erlauben"
                  checked={draft.webSearch}
                  onChange={(webSearch) => set({ webSearch })}
                  info="Jede fremde Anfrage kann dann Credits beim Suchanbieter kosten."
                />
              )}
              <Toggle
                label="Quellen anzeigen"
                checked={draft.showSources}
                onChange={(showSources) => set({ showSources })}
              />
              <Toggle
                label="Aktiv"
                checked={draft.enabled}
                onChange={(enabled) => set({ enabled })}
                info="Deaktiviert lehnt der Assistent jeden Aufruf ab, ohne dass Schlüssel widerrufen werden müssen."
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Row label="Anfragen / Minute">
                <input
                  type="number"
                  min={1}
                  value={draft.limits.perMinute}
                  onChange={(e) => setLimit({ perMinute: Number(e.target.value) })}
                  className="w-full input-base"
                />
              </Row>
              <Row label="Anfragen / Tag / IP">
                <input
                  type="number"
                  min={1}
                  value={draft.limits.perDayPerIp}
                  onChange={(e) => setLimit({ perDayPerIp: Number(e.target.value) })}
                  className="w-full input-base"
                />
              </Row>
              <Row label="Anfragen / Tag (gesamt)">
                <input
                  type="number"
                  min={1}
                  value={draft.limits.perDay}
                  onChange={(e) => setLimit({ perDay: Number(e.target.value) })}
                  className="w-full input-base"
                />
              </Row>
              <Row label="Max. Zeichen je Anfrage">
                <input
                  type="number"
                  min={200}
                  value={draft.limits.maxInputChars}
                  onChange={(e) => setLimit({ maxInputChars: Number(e.target.value) })}
                  className="w-full input-base"
                />
              </Row>
              <Row label="Verlaufstiefe">
                <input
                  type="number"
                  min={1}
                  value={draft.limits.maxHistory}
                  onChange={(e) => setLimit({ maxHistory: Number(e.target.value) })}
                  className="w-full input-base"
                />
              </Row>
              <Row label="Max. Tokens je Antwort">
                <input
                  type="number"
                  min={64}
                  value={draft.maxTokens ?? 1024}
                  onChange={(e) => set({ maxTokens: Number(e.target.value) })}
                  className="w-full input-base"
                />
              </Row>
            </div>

            <Row
              label="Erlaubte Herkunft (eine je Zeile)"
              info="Gilt nur für Widget-Schlüssel. Genau die Adresse der einbettenden Seite, z. B. https://intranet.firma.de — ohne Pfad."
            >
              <textarea
                value={draft.allowedOrigins.join("\n")}
                onChange={(e) =>
                  set({ allowedOrigins: e.target.value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean) })
                }
                rows={2}
                placeholder="https://intranet.firma.de"
                className="w-full input-base font-mono text-xs"
              />
            </Row>

            {/* Keys */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <KeyRound size={15} /> Schlüssel
              </div>
              <p className="text-xs text-neutral-500">
                Der geheime Schlüssel gehört in ein fremdes Backend, der
                Widget-Schlüssel in eine Webseite. Beide werden nur als Hash
                gespeichert — der Klartext erscheint genau einmal.
              </p>
              {freshKey && (
                <div className="rounded-lg border border-accent/40 bg-accent/10 p-3">
                  <div className="mb-1 text-xs font-medium">
                    Neuer Schlüssel — jetzt kopieren, er wird nicht wieder angezeigt:
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 break-all font-mono text-xs">{freshKey}</code>
                    <button
                      onClick={() => copy(freshKey, "key")}
                      className="flex shrink-0 items-center gap-1 rounded-lg border border-border-light px-2 py-1 text-xs transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
                    >
                      {copied === "key" ? <Check size={12} /> : <Copy size={12} />}
                      Kopieren
                    </button>
                  </div>
                </div>
              )}
              <div className="space-y-1">
                {draft.keys.length === 0 && (
                  <div className="text-xs text-neutral-500">Noch kein Schlüssel.</div>
                )}
                {draft.keys.map((k) => (
                  <div
                    key={k.id}
                    className="flex items-center gap-2 rounded-lg border border-border-light px-3 py-1.5 text-xs dark:border-border-dark"
                  >
                    <span className="font-medium">
                      {k.kind === "secret" ? "Geheim" : "Widget"}
                    </span>
                    <code className="font-mono text-neutral-500">…{k.last4}</code>
                    <span className="text-neutral-500">zuletzt {rel(k.lastUsedAt)}</span>
                    {k.revokedAt ? (
                      <span className="ml-auto text-neutral-400">widerrufen</span>
                    ) : (
                      <button
                        onClick={() => revoke(k.id)}
                        className="ml-auto rounded px-2 py-0.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-red-500 dark:hover:bg-white/5"
                      >
                        Widerrufen
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => mintKey("secret")}
                  disabled={busy}
                  className="rounded-lg border border-border-light px-3 py-1.5 text-sm transition hover:bg-neutral-100 disabled:opacity-50 dark:border-border-dark dark:hover:bg-white/5"
                >
                  Geheimen Schlüssel erzeugen
                </button>
                <button
                  onClick={() => mintKey("public")}
                  disabled={busy}
                  className="rounded-lg border border-border-light px-3 py-1.5 text-sm transition hover:bg-neutral-100 disabled:opacity-50 dark:border-border-dark dark:hover:bg-white/5"
                >
                  Widget-Schlüssel erzeugen
                </button>
              </div>
            </div>

            {/* Embed snippet */}
            <Row label="Einbettung">
              <div className="flex items-start gap-2">
                <pre className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border-light p-2 font-mono text-[11px] dark:border-border-dark">
                  {embedSnippet}
                </pre>
                <button
                  onClick={() => copy(embedSnippet, "snip")}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-border-light px-2 py-1 text-xs transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
                >
                  {copied === "snip" ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
              {!brand.appUrl && (
                <p className="mt-1 text-xs text-amber-500">
                  Setze die öffentliche App-URL unter Marke, damit hier die echte
                  Adresse steht.
                </p>
              )}
            </Row>

            {/* Usage */}
            <div className="rounded-lg border border-border-light p-3 text-xs text-neutral-500 dark:border-border-dark">
              {draft.usage.requests} Anfragen insgesamt · {draft.usage.dayRequests} heute ·{" "}
              {draft.usage.denied} abgewiesen · zuletzt {rel(draft.usage.lastUsedAt)}
              <br />
              Es werden ausschließlich Zähler gespeichert, keine Gesprächsinhalte.
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border-light pt-3 dark:border-border-dark">
              {saved && <span className="mr-auto text-xs text-accent">Gespeichert ✓</span>}
              <button
                onClick={() => setConfirmDelete(draft)}
                className="flex items-center gap-1.5 rounded-lg border border-border-light px-3 py-1.5 text-sm text-neutral-500 transition hover:bg-neutral-100 hover:text-red-500 dark:border-border-dark dark:hover:bg-white/5"
              >
                <Trash2 size={14} /> Löschen
              </button>
              <button
                onClick={save}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                Speichern
              </button>
            </div>
          </div>
        )}
      </div>

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)}>
          <div>
            <h4 className="font-medium">„{confirmDelete.name}" löschen?</h4>
            <p className="mt-1 text-sm text-neutral-500">
              Alle Schlüssel dieses Assistenten werden ungültig. Eingebettete Seiten
              hören sofort auf zu funktionieren.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-border-light px-3 py-1.5 text-sm dark:border-border-dark"
              >
                Abbrechen
              </button>
              <button
                onClick={() => remove(confirmDelete)}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700"
              >
                Löschen
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
