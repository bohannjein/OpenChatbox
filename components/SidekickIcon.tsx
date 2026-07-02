"use client";

import { useRef, useState } from "react";
import { useClickOutside } from "@/lib/useClickOutside";
import {
  Star,
  Smile,
  Briefcase,
  Rocket,
  Heart,
  Lightbulb,
  Code2,
  BookOpen,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";

export const SIDEKICK_ICONS: { id: string; Icon: LucideIcon }[] = [
  { id: "star", Icon: Star },
  { id: "smile", Icon: Smile },
  { id: "briefcase", Icon: Briefcase },
  { id: "rocket", Icon: Rocket },
  { id: "heart", Icon: Heart },
  { id: "lightbulb", Icon: Lightbulb },
  { id: "code", Icon: Code2 },
  { id: "book", Icon: BookOpen },
  { id: "sparkles", Icon: Sparkles },
];

// vibrant solid colors — white icon sits on top
export const SIDEKICK_COLORS: { id: string; color: string }[] = [
  { id: "rose", color: "#f43f5e" },
  { id: "amber", color: "#f59e0b" },
  { id: "emerald", color: "#10b981" },
  { id: "sky", color: "#0ea5e9" },
  { id: "violet", color: "#8b5cf6" },
];

export const iconById = (id: string) =>
  SIDEKICK_ICONS.find((i) => i.id === id) ?? SIDEKICK_ICONS[0];
export const colorById = (id: string) =>
  SIDEKICK_COLORS.find((c) => c.id === id) ?? SIDEKICK_COLORS[3];

export const DEFAULT_ICON = "star";
export const DEFAULT_COLOR = "sky";

/** Colored rounded badge with a white lucide icon. */
export function SidekickAvatar({
  icon,
  color,
  size = 28,
  iconSize,
}: {
  icon: string;
  color: string;
  size?: number;
  iconSize?: number;
}) {
  const { Icon } = iconById(icon);
  const c = colorById(color);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg text-white"
      style={{ background: c.color, width: size, height: size }}
    >
      <Icon size={iconSize ?? Math.round(size * 0.56)} />
    </span>
  );
}

/** Button showing the current avatar; opens a picker (icons + colors). */
export function SidekickIconPicker({
  icon,
  color,
  onChange,
}: {
  icon: string;
  color: string;
  onChange: (icon: string, color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, () => setOpen(false));

  const activeColor = colorById(color).color;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Symbol wählen"
        className="rounded-lg border border-border-light p-1 transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
      >
        <SidekickAvatar icon={icon} color={color} size={30} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 flex items-start gap-3 menu-panel p-3">
          {/* icons grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 2.25rem)",
              gap: "0.375rem",
            }}
          >
            {SIDEKICK_ICONS.map(({ id, Icon }) => {
              const selected = id === icon;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChange(id, color)}
                  className={clsx(
                    "flex h-9 w-9 items-center justify-center rounded-lg transition",
                    selected
                      ? "text-white"
                      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-white/10"
                  )}
                  style={selected ? { background: activeColor } : undefined}
                >
                  <Icon size={18} />
                </button>
              );
            })}
          </div>

          {/* colors — vertical, right of the icons */}
          <div className="flex flex-col gap-2 border-l border-border-light pl-3 dark:border-border-dark">
            {SIDEKICK_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onChange(icon, c.id)}
                title={c.id}
                className={clsx(
                  "h-6 w-6 rounded-full ring-offset-1 transition ring-offset-white dark:ring-offset-sidebar-dark",
                  c.id === color ? "ring-2 ring-neutral-500" : "ring-0"
                )}
                style={{ background: c.color }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
