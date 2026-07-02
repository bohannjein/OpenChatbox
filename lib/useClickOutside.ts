"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Run `onOutside` on any mousedown outside of `ref` (dropdown/popover close). */
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
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref]);
}
