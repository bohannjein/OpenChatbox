"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import clsx from "clsx";
import { useStore } from "@/lib/store";
import Modal from "./Modal";
import { SidekickAvatar } from "./SidekickIcon";

/**
 * Virtual conference room: manage which sidekicks are active in a chat. Shows
 * the invited sidekicks' avatars in the header + a button to open the invite
 * modal (multi-select). More than one invited → the chat becomes a group chat.
 */
export default function ParticipantsManager({ chatId }: { chatId: string }) {
  const sidekicks = useStore((s) => s.sidekicks);
  const chat = useStore((s) => s.chats.find((c) => c.id === chatId));
  const setChatSidekicks = useStore((s) => s.setChatSidekicks);
  const setChatModerated = useStore((s) => s.setChatModerated);

  const invited =
    chat?.sidekickIds ?? (chat?.sidekickId ? [chat.sidekickId] : []);

  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string[]>(invited);
  const [mod, setMod] = useState(!!chat?.moderated);

  const invitedSks = invited
    .map((id) => sidekicks.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => !!s);

  const openModal = () => {
    setSel(invited);
    setMod(!!chat?.moderated);
    setOpen(true);
  };
  const toggle = (id: string) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const saveSel = () => {
    setChatSidekicks(chatId, sel);
    setChatModerated(chatId, mod);
    setOpen(false);
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        {/* Invited avatars, slightly overlapping */}
        {invitedSks.length > 0 && (
          <div className="flex items-center -space-x-1.5">
            {invitedSks.slice(0, 5).map((sk) => (
              <span
                key={sk.id}
                title={sk.name}
                className="rounded-lg ring-2 ring-white dark:ring-sidebar-dark"
              >
                <SidekickAvatar icon={sk.icon} color={sk.color} size={22} />
              </span>
            ))}
            {invitedSks.length > 5 && (
              <span className="pl-2 text-xs text-neutral-400">
                +{invitedSks.length - 5}
              </span>
            )}
          </div>
        )}
        <button
          onClick={openModal}
          title="Nutzer einladen / Teilnehmer verwalten"
          className="rounded-lg p-2 text-zinc-400 transition-colors duration-150 hover:bg-neutral-200 hover:text-neutral-900 dark:hover:bg-white/5 dark:hover:text-zinc-100"
        >
          <UserPlus size={18} strokeWidth={1.5} />
        </button>
      </div>

      {open && (
        <Modal onClose={() => setOpen(false)}>
          <h3 className="mb-1 text-lg font-semibold">Teilnehmer verwalten</h3>
          <p className="mb-3 text-sm text-neutral-500">
            Lade mehrere Sidekicks in diesen Chat ein. Bei mehr als einem wird der
            Chat zum Konferenzraum.
          </p>

          {sidekicks.length === 0 ? (
            <p className="py-4 text-center text-sm text-neutral-400">
              Noch keine Sidekicks. Lege welche unter Einstellungen →
              KI-Personalisierung an.
            </p>
          ) : (
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {sidekicks.map((sk) => {
                const checked = sel.includes(sk.id);
                return (
                  <label
                    key={sk.id}
                    className={clsx(
                      "flex cursor-pointer items-center gap-2.5 rounded-xl border p-2 transition",
                      checked
                        ? "border-accent bg-accent/10"
                        : "border-border-light hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(sk.id)}
                      className="h-4 w-4 accent-[rgb(var(--accent))]"
                    />
                    <SidekickAvatar icon={sk.icon} color={sk.color} size={26} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {sk.name}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {/* Moderator mode — only meaningful with >1 sidekick. */}
          <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-xl border border-border-light p-2.5 text-sm dark:border-border-dark">
            <input
              type="checkbox"
              checked={mod}
              onChange={(e) => setMod(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]"
            />
            <span>
              <span className="font-medium">Automatische Moderation</span>
              <span className="block text-xs text-neutral-400">
                Ein Moderator-Modell wählt vor jedem Beitrag den passendsten
                Sidekick (statt fester Reihenfolge).
              </span>
            </span>
          </label>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-1.5 text-sm hover:bg-neutral-200 dark:hover:bg-white/10"
            >
              Abbrechen
            </button>
            <button
              onClick={saveSel}
              className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white transition hover:bg-accent-hover"
            >
              Speichern
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
