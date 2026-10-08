"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Run `onOutside` on any mousedown outside of `ref` or on Escape
 *  (dropdown/popover close). */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onOutside: () => void
) {
  // latest-callback ref: one stable listener, no re-subscribe per render
  const cb = useRef(onOutside);
  cb.current = onOutside;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb.current();
    };
    const k = (e: KeyboardEvent) => e.key === "Escape" && cb.current();
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [ref]);
}
