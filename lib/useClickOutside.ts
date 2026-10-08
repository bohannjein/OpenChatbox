"use client";

import { useEffect, useRef, type RefObject } from "react";

/** While `open`, run `onOutside` on any mousedown outside of `ref` or on Escape
 *  (dropdown/popover close). Escape is taken in the capture phase and stopped,
 *  so a popover inside a dialog closes alone instead of taking the dialog
 *  with it. */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onOutside: () => void,
  open: boolean
) {
  // latest-callback ref: one stable listener, no re-subscribe per render
  const cb = useRef(onOutside);
  cb.current = onOutside;

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb.current();
    };
    const k = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      cb.current();
    };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k, true);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k, true);
    };
  }, [ref, open]);
}
