"use client";

import { useEffect, useId, useRef } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Open dialogs, innermost last: only the topmost handles Esc / Tab, so a Modal
// stacked over Settings closes alone.
const stack: object[] = [];

const focusables = (el: HTMLElement) =>
  [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (n) => n.getClientRects().length > 0
  );

/**
 * Modal-dialog behaviour for the element the returned ref is attached to:
 * Esc closes, Tab/Shift+Tab stay inside, focus moves in on open and returns to
 * the opener on close. Without an explicit aria-label(ledby) the first heading
 * inside labels the dialog. Pass `active` only once the element is rendered.
 */
export function useDialog<T extends HTMLElement = HTMLDivElement>(
  active: boolean,
  onClose: () => void
) {
  const ref = useRef<T>(null);
  // latest-callback ref: callers pass inline arrows
  const cb = useRef(onClose);
  cb.current = onClose;
  const headingId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const token = {};
    stack.push(token);
    const opener = document.activeElement as HTMLElement | null;

    if (!el.hasAttribute("aria-label") && !el.hasAttribute("aria-labelledby")) {
      const h = el.querySelector<HTMLElement>("h1,h2,h3,h4");
      if (h) {
        h.id ||= headingId;
        el.setAttribute("aria-labelledby", h.id);
      }
    }
    // autoFocus children already won; otherwise the first control (or the panel)
    if (!el.contains(document.activeElement)) (focusables(el)[0] ?? el).focus();

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== token) return;
      if (e.key === "Escape") {
        cb.current();
        return;
      }
      if (e.key !== "Tab") return;
      const f = focusables(el);
      const cur = document.activeElement;
      if (!f.length) {
        e.preventDefault();
        el.focus();
      } else if (e.shiftKey ? cur === f[0] || !el.contains(cur) : cur === f[f.length - 1] || !el.contains(cur)) {
        e.preventDefault();
        (e.shiftKey ? f[f.length - 1] : f[0]).focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      stack.splice(stack.indexOf(token), 1);
      if (opener?.isConnected) opener.focus();
    };
  }, [active, headingId]);

  return ref;
}
