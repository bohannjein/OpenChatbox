"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { loadAllModels } from "@/lib/providers";
import { uid } from "@/lib/uid";
import {
  SidekickIconPicker,
  DEFAULT_ICON,
  DEFAULT_COLOR,
} from "./SidekickIcon";
import type { ModelOption } from "@/lib/types";
import { useT } from "@/lib/i18n";

const MAX_SIDEKICKS = 5;

export default function SidekickManager() {
  const sidekicks = useStore((s) => s.sidekicks);
  const upsertSidekick = useStore((s) => s.upsertSidekick);
  const removeSidekick = useStore((s) => s.removeSidekick);
  const providers = useStore((s) => s.providers);
  const [models, setModels] = useState<ModelOption[]>([]);
  const t = useT();

  useEffect(() => {
    loadAllModels(providers).then((r) => setModels(r.options));
  }, [providers]);

  const atMax = sidekicks.length >= MAX_SIDEKICKS;
  const add = () => {
    if (atMax) return;
    upsertSidekick({
      id: uid(),
      name: t("sidekicks.newName"),
      icon: DEFAULT_ICON,
      color: DEFAULT_COLOR,
      modelKey: "",
      systemPrompt: "",
    });
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h4 className="font-medium">Sidekicks</h4>
          <p className="text-sm text-neutral-500">
            {t("sidekicks.hint", { max: MAX_SIDEKICKS })}
          </p>
        </div>
        <button
          onClick={add}
          disabled={atMax}
          title={atMax ? t("sidekicks.max", { max: MAX_SIDEKICKS }) : undefined}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-40"
        >
          <Plus size={15} /> Sidekick ({sidekicks.length}/{MAX_SIDEKICKS})
        </button>
      </div>

      <div className="space-y-3">
        {sidekicks.length === 0 && (
          <p className="text-sm text-neutral-500">{t("sidekicks.empty")}</p>
        )}
        {sidekicks.map((sk) => (
          <div
            key={sk.id}
            className="rounded-xl border border-border-light p-3 dark:border-border-dark"
          >
            <div className="flex items-center gap-2">
              <SidekickIconPicker
                icon={sk.icon}
                color={sk.color}
                onChange={(icon, color) =>
                  upsertSidekick({ ...sk, icon, color })
                }
              />
              <input
                value={sk.name}
                onChange={(e) => upsertSidekick({ ...sk, name: e.target.value })}
                placeholder={t("sidekicks.namePh")}
                className="min-w-0 flex-1 input-base"
              />
              <select
                value={sk.modelKey}
                onChange={(e) =>
                  upsertSidekick({ ...sk, modelKey: e.target.value })
                }
                className="max-w-[10rem] input-base dark:bg-sidebar-dark"
              >
                <option value="">{t("sidekicks.currentModel")}</option>
                {models.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.model}
                  </option>
                ))}
              </select>
              <button
                onClick={() => removeSidekick(sk.id)}
                className="rounded-lg p-2 text-neutral-400 hover:text-red-500"
                title={t("common.delete")}
              >
                <Trash2 size={16} />
              </button>
            </div>
            <textarea
              value={sk.systemPrompt}
              onChange={(e) =>
                upsertSidekick({ ...sk, systemPrompt: e.target.value })
              }
              rows={3}
              placeholder={t("sidekicks.promptPh")}
              className="mt-2 w-full resize-y input-base"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
