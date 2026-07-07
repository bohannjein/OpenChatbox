"use client";

import { useCallback, useEffect, useRef } from "react";

/** How close to the bottom (px) still counts as "parked at the bottom". */
const NEAR_BOTTOM_PX = 120;

/**
 * Stable auto-scroll for a streaming chat view.
 *
 * The old approach forced `scrollTop = scrollHeight` inside an effect that
 * depended on the messages array — so it re-ran on *every* streamed token and
 * fought the user whenever they scrolled up. That is the stutter/glitch users
 * saw on long answers.
 *
 * This hook instead:
 *  - pins the viewport to the bottom via a single `ResizeObserver` on the
 *    growing content (no per-token React effect, no array-identity churn), and
 *  - honours user intent: the moment the user scrolls up past a threshold the
 *    auto-pin disengages, and re-engages once they scroll back near the bottom.
 *
 * The streaming pin uses instant scrolling on purpose — a per-token *smooth*
 * scroll never finishes before the next token arrives, which is exactly what
 * produces the "chasing" jitter. Smooth is reserved for discrete jumps (a new
 * user message) via `scrollToBottom("smooth")`.
 *
 * Both refs are callback refs, so they attach correctly even though the scroll
 * container only mounts once the first message exists.
 */
export function useScrollAnchor() {
  const elRef = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  // User-intent flag: are we still pinned to the bottom? Starts true so a chat
  // opens at its latest message.
  const stick = useRef(true);

  const isAtBottom = () => {
    const el = elRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
  };

  // A programmatic pin always lands at the bottom (distance ~0), so it never
  // trips this into thinking the user scrolled away — only a genuine upward
  // scroll disengages the pin.
  const onScroll = useCallback(() => {
    stick.current = isAtBottom();
  }, []);

  const pin = useCallback(() => {
    const el = elRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, []);

  // Callback ref for the scroll viewport — (de)registers the scroll listener as
  // React mounts/unmounts the node.
  const scrollRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (elRef.current) elRef.current.removeEventListener("scroll", onScroll);
      elRef.current = el;
      if (el) el.addEventListener("scroll", onScroll, { passive: true });
    },
    [onScroll]
  );

  // Callback ref for the growing content — a ResizeObserver keeps the viewport
  // pinned as tokens stream in (only while the user is parked at the bottom).
  const contentRef = useCallback(
    (node: HTMLDivElement | null) => {
      roRef.current?.disconnect();
      roRef.current = null;
      if (!node) return;
      const ro = new ResizeObserver(() => pin());
      ro.observe(node);
      roRef.current = ro;
    },
    [pin]
  );

  /** Force a scroll to the bottom and re-arm the auto-pin (e.g. on send). */
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = elRef.current;
    if (!el) return;
    stick.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  useEffect(() => () => roRef.current?.disconnect(), []);

  return { scrollRef, contentRef, scrollToBottom };
}
