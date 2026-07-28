"use client";

import { useState } from "react";
import { Plus, Trash2, Brain } from "lucide-react";
import { useStore } from "@/lib/store";

export default function MemoryManager() {
  const memory = useStore((s) => s.memory);
  const memoryEnabled = useStore((s) => s.memoryEnabled);
  const setMemoryEnabled = useStore((s) => s.setMemoryEnabled);
  const addMemory = useStore((s) => s.addMemory);
  const updateMemory = useStore((s) => s.updateMemory);
  const removeMemory = useStore((s) => s.removeMemory);
  const clearMemory = useStore((s) => s.clearMemory);
  const [draft, setDraft] = useState("");

  const add = () => {
    if (!draft.trim()) return;
    addMemory(draft);
    setDraft("");
  };

  return (
    <section>
      <div className="mb-1 flex items-center gap-2">
        <Brain size={16} className="text-accent" />
        <h3 className="font-medium">Mein Gedächtnis</h3>
      </div>
      <p className="mb-2 text-sm text-neutral-500">
        Dauerhafte Fakten über dich. Werden bei jedem Chat unsichtbar als
        Hintergrundwissen an das Modell gehängt. Automatisch aus deinen
        Nachrichten extrahiert — hier editier- und löschbar.
      </p>

      <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={memoryEnabled}
          onChange={(e) => setMemoryEnabled(e.target.checked)}
          className="h-4 w-4 accent-[rgb(var(--accent))]"
        />
        Gedächtnis aktiv (Extraktion + Nutzung)
      </label>

      <div className="mb-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Fakt hinzufügen, z. B. Arbeitet in der Marketing-Abteilung"
          className="input-base min-w-0 flex-1 px-3"
        />
        <button
          onClick={add}
          disabled={!draft.trim()}
          className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-40"
        >
          <Plus size={15} />
        </button>
      </div>

      {memory.length === 0 ? (
        <p className="text-sm text-neutral-500">Noch keine Einträge.</p>
      ) : (
        <div className="space-y-2">
          {memory.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2 rounded-lg border border-border-light p-2 dark:border-border-dark"
            >
              <input
                value={m.text}
                onChange={(e) => updateMemory(m.id, e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <button
                onClick={() => removeMemory(m.id)}
                className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:text-red-500"
                title="Löschen"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              if (confirm("Gesamtes Gedächtnis löschen?")) clearMemory();
            }}
            className="text-sm text-red-500 hover:underline"
          >
            Alles löschen
          </button>
        </div>
      )}
    </section>
  );
}
