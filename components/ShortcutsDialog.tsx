"use client";

import Modal from "./Modal";
import { useT, type StringKey } from "@/lib/i18n";

// Same bindings as ChatGPT, so people switching over keep their muscle memory.
// The handlers live in AppRoot; this is only the cheat sheet (Ctrl/⌘ + /).
const SHORTCUTS: { label: StringKey; keys: string[] }[] = [
  { label: "shortcuts.newChat", keys: ["mod", "Shift", "O"] },
  { label: "shortcuts.search", keys: ["mod", "K"] },
  { label: "shortcuts.toggleSidebar", keys: ["mod", "Shift", "S"] },
  { label: "shortcuts.focusInput", keys: ["Shift", "Esc"] },
  { label: "shortcuts.copyLast", keys: ["mod", "Shift", "C"] },
  { label: "shortcuts.newline", keys: ["Shift", "Enter"] },
  { label: "shortcuts.show", keys: ["mod", "/"] },
];

const isMac = () => {
  try {
    return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  } catch {
    return false;
  }
};

export default function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const mod = isMac() ? "⌘" : "Ctrl";
  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-bold">{t("shortcuts.title")}</h2>
      <dl className="mt-4 space-y-2.5 text-sm">
        {SHORTCUTS.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-4">
            <dt className="text-neutral-600 dark:text-neutral-300">{t(s.label)}</dt>
            <dd className="flex shrink-0 gap-1">
              {s.keys.map((k) => (
                <kbd
                  key={k}
                  className="min-w-[1.75rem] rounded-md border border-border-light bg-neutral-50 px-1.5 py-0.5 text-center font-sans text-xs text-neutral-600 dark:border-border-dark dark:bg-white/5 dark:text-neutral-300"
                >
                  {k === "mod" ? mod : k}
                </kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
