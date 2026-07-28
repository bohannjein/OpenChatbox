"use client";

import { useEffect, useMemo } from "react";

/** Total run time — must match the sum of the keyframe phases in globals.css. */
const DURATION = 1150;
const SHARDS = 18;

/**
 * Destruction gesture for deleting an incognito chat: the view goes black,
 * collapses toward the centre, bursts, and the fragments drop out of frame.
 * Purely decorative — `onDone` fires on a timer, so the actual delete never
 * depends on animation events landing.
 */
export default function ShatterOverlay({ onDone }: { onDone: () => void }) {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Deterministic-per-mount scatter: computed once so a re-render can't reshuffle
  // shards mid-flight.
  const shards = useMemo(
    () =>
      Array.from({ length: SHARDS }, (_, i) => {
        const angle = (i / SHARDS) * Math.PI * 2 + Math.random() * 0.4;
        const spread = 90 + Math.random() * 190;
        return {
          id: i,
          dx: Math.cos(angle) * spread,
          // Sideways burst first; gravity is applied by the keyframe itself.
          rise: -40 - Math.random() * 90,
          fall: 420 + Math.random() * 380,
          rot: (Math.random() - 0.5) * 900,
          w: 8 + Math.random() * 26,
          h: 6 + Math.random() * 30,
          delay: Math.random() * 70,
        };
      }),
    []
  );

  useEffect(() => {
    if (reduced) {
      onDone();
      return;
    }
    const t = setTimeout(onDone, DURATION);
    return () => clearTimeout(t);
  }, [onDone, reduced]);

  if (reduced) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
    >
      {/* Black plate: fades in, then contracts to the centre and pops. */}
      <div className="shatter-plate absolute inset-0 bg-black" />

      {/* Flash at the moment of the burst. */}
      <div className="shatter-flash absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />

      {/* Fragments. */}
      <div className="absolute left-1/2 top-1/2 h-0 w-0">
        {shards.map((s) => (
          <span
            key={s.id}
            className="shatter-shard absolute block bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.18)]"
            style={
              {
                width: s.w,
                height: s.h,
                animationDelay: `${s.delay}ms`,
                "--dx": `${s.dx}px`,
                "--rise": `${s.rise}px`,
                "--fall": `${s.fall}px`,
                "--rot": `${s.rot}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
