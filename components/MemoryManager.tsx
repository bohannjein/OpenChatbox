"use client";

import { useState } from "react";
import { Plus, Trash2, Brain } from "lucide-react";
import { useStore } from "@/lib/store";
import ConfirmDialog from "./ConfirmDialog";
import { useT } from "@/lib/i18n";

export default function MemoryManager() {
  const memory = useStore((s) => s.memory);
  const memoryEnabled = useStore((s) => s.memoryEnabled);
  const setMemoryEnabled = useStore((s) => s.setMemoryEnabled);
  const addMemory = useStore((s) => s.addMemory);
  const updateMemory = useStore((s) => s.updateMemory);
  const removeMemory = useStore((s) => s.removeMemory);
  const clearMemory = useStore((s) => s.clearMemory);
  const [draft, setDraft] = useState("");
  const t = useT();
  const [confirmClear, setConfirmClear] = useState(false);

  const add = () => {
    if (!draft.trim()) return;
    addMemory(draft);
    setDraft("");
  };

  return (
    <section>
      <div className="mb-1 flex items-center gap-2">
        <Brain size={16} className="text-accent" />
        <h4 className="font-medium">{t("memory.title")}</h4>
      </div>
      <p className="mb-2 text-sm text-neutral-500">
        {t("memory.hint")}
      </p>

      <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={memoryEnabled}
          onChange={(e) => setMemoryEnabled(e.target.checked)}
          className="h-4 w-4 accent-[rgb(var(--accent))]"
        />
        {t("memory.enable")}
      </label>

      <div className="mb-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={t("memory.addPh")}
          className="input-base min-w-0 flex-1 px-3"
        />
        <button
          onClick={add}
          disabled={!draft.trim()}
          aria-label={t("memory.add")}
          className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-40"
        >
          <Plus size={15} />
        </button>
      </div>

      {memory.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("memory.empty")}</p>
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
                aria-label={t("memory.entry")}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <button
                onClick={() => removeMemory(m.id)}
                className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:text-red-500"
                title={t("common.delete")}
                aria-label={t("memory.deleteEntry")}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button
            onClick={() => setConfirmClear(true)}
            className="text-sm text-red-500 hover:underline"
          >
            {t("memory.clearAll")}
          </button>
        </div>
      )}

      {confirmClear && (
        <ConfirmDialog
          title={t("memory.clearTitle")}
          message={t("memory.clearBody")}
          confirmLabel={t("memory.clearAll")}
          danger
          onConfirm={() => {
            clearMemory();
            setConfirmClear(false);
          }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </section>
  );
}
