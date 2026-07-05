"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Upload, Loader2, FileText, Library } from "lucide-react";
import { useStore } from "@/lib/store";
import { extractText } from "@/lib/kbText";

interface Category {
  id: string;
  name: string;
}
interface Doc {
  id: string;
  categoryId: string;
  name: string;
  chunkCount: number;
}

/**
 * Knowledge-base management: create categories and upload files (PDF/TXT/DOCX).
 * Text is extracted client-side, then indexed server-side (chunk + embed via
 * Ollama) into the per-user local vector store.
 */
export default function KnowledgeBasePanel() {
  const kbEnabled = useStore((s) => s.kbEnabled);
  const toggleKb = useStore((s) => s.toggleKb);
  const isAdmin = useStore((s) => s.authUser?.role === "admin");

  const [cats, setCats] = useState<Category[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [newCat, setNewCat] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // categoryId being indexed
  const [error, setError] = useState<string | null>(null);
  const [embModel, setEmbModel] = useState("");

  const load = useCallback(() => {
    fetch("/api/kb")
      .then((r) => (r.ok ? r.json() : { categories: [], documents: [] }))
      .then((d) => {
        setCats(d.categories ?? []);
        setDocs(d.documents ?? []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    if (isAdmin)
      fetch("/api/admin/config")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setEmbModel(d?.config?.embeddingModel ?? ""))
        .catch(() => {});
  }, [load, isAdmin]);

  const addCategory = async () => {
    const name = newCat.trim();
    if (!name) return;
    setNewCat("");
    await fetch("/api/kb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "category", name }),
    }).catch(() => {});
    load();
  };

  const removeCategory = async (id: string) => {
    await fetch(`/api/kb?category=${id}`, { method: "DELETE" }).catch(() => {});
    load();
  };
  const removeDoc = async (id: string) => {
    await fetch(`/api/kb?document=${id}`, { method: "DELETE" }).catch(() => {});
    load();
  };

  const uploadTo = async (categoryId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(categoryId);
    try {
      for (const f of Array.from(files)) {
        const text = await extractText(f).catch(() => "");
        if (!text.trim()) {
          setError(`Kein Text aus „${f.name}" extrahiert.`);
          continue;
        }
        const r = await fetch("/api/kb", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "document", categoryId, name: f.name, text }),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          setError(d.error || `Indexierung von „${f.name}" fehlgeschlagen.`);
        }
      }
      load();
    } finally {
      setBusy(null);
    }
  };

  const saveEmbModel = async () => {
    await fetch("/api/admin/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeddingModel: embModel.trim() }),
    }).catch(() => {});
  };

  return (
    <div>
      <div className="mb-3">
        <h3 className="font-medium">Wissensdatenbank</h3>
        <p className="text-sm text-neutral-500">
          Eigene Kategorien + Dokumente (PDF, TXT, DOCX). Bei aktivierter Nutzung
          durchsucht der Chat vorab die Datenbank und belegt Antworten mit Quellen.
        </p>
      </div>

      <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={kbEnabled}
          onChange={() => toggleKb()}
          className="h-4 w-4 accent-[rgb(var(--accent))]"
        />
        Wissensdatenbank im Chat verwenden
      </label>

      {isAdmin && (
        <div className="mb-4 flex items-end gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-neutral-500">
              Embedding-Modell (Ollama, global)
            </label>
            <input
              value={embModel}
              onChange={(e) => setEmbModel(e.target.value)}
              placeholder="nomic-embed-text"
              className="w-full input-base font-mono"
            />
          </div>
          <button
            onClick={saveEmbModel}
            className="rounded-lg border border-border-light px-3 py-1.5 text-sm transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
          >
            Speichern
          </button>
        </div>
      )}

      {/* New category */}
      <div className="mb-4 flex gap-2">
        <input
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCategory()}
          placeholder="Neue Kategorie…"
          className="min-w-0 flex-1 input-base"
        />
        <button
          onClick={addCategory}
          className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover"
        >
          <Plus size={15} /> Kategorie
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      )}

      {cats.length === 0 ? (
        <p className="py-4 text-center text-sm text-neutral-400">
          Noch keine Kategorien. Lege eine an, um Dokumente hochzuladen.
        </p>
      ) : (
        <div className="space-y-3">
          {cats.map((cat) => {
            const catDocs = docs.filter((d) => d.categoryId === cat.id);
            return (
              <div
                key={cat.id}
                className="rounded-xl border border-border-light p-3 dark:border-border-dark"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Library size={16} className="shrink-0 text-accent" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {cat.name}
                  </span>
                  <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-border-light px-2.5 py-1 text-xs transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5">
                    {busy === cat.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Upload size={13} />
                    )}
                    Datei
                    <input
                      type="file"
                      accept=".pdf,.txt,.md,.csv,.docx,.pptx,.xlsx"
                      multiple
                      disabled={busy === cat.id}
                      className="hidden"
                      onChange={(e) => {
                        uploadTo(cat.id, e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    onClick={() => removeCategory(cat.id)}
                    className="rounded-lg p-1.5 text-neutral-400 hover:text-red-500"
                    title="Kategorie löschen"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                {catDocs.length > 0 && (
                  <div className="space-y-1">
                    {catDocs.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center gap-2 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-sm dark:bg-white/5"
                      >
                        <FileText size={14} className="shrink-0 text-neutral-400" />
                        <span className="min-w-0 flex-1 truncate">{d.name}</span>
                        <span className="shrink-0 text-xs text-neutral-400">
                          {d.chunkCount} Abschnitte
                        </span>
                        <button
                          onClick={() => removeDoc(d.id)}
                          className="rounded p-1 text-neutral-400 hover:text-red-500"
                          title="Dokument entfernen"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
