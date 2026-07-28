"use client";

import { Info } from "lucide-react";

/**
 * Small "i" icon with a hover/focus tooltip — used across the admin settings so
 * each option carries a plain-language explanation. Keyboard-accessible
 * (focusable, shows on focus) and theme-aware.
 */
export default function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <Info
        size={13}
        tabIndex={0}
        role="button"
        aria-label={text}
        className="cursor-help text-neutral-400 outline-none transition hover:text-accent focus-visible:text-accent"
      />
      <span
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 w-60 -translate-x-1/2 rounded-lg border border-border-light bg-white px-2.5 py-2 text-xs font-normal leading-relaxed text-neutral-600 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 dark:border-border-dark dark:bg-sidebar-dark dark:text-neutral-300"
      >
        {text}
      </span>
    </span>
  );
}
