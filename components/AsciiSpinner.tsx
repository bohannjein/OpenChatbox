"use client";

import { useEffect, useState } from "react";

// A rotating console/bracket sequence — a tiny "scanner" bouncing inside braces.
const FRAMES = [
  "{·    }",
  "{ ·   }",
  "{  ·  }",
  "{   · }",
  "{    ·}",
  "{   ==}",
  "{  ===}",
  "{ ====}",
  "{=====}",
  "{==== }",
  "{===  }",
  "{==   }",
];

/**
 * Animated ASCII placeholder shown in the sidebar while a chat's title is being
 * generated. Frame rotation is JS (reliable text cycling); the subtle pulse is
 * CSS (Tailwind animate-pulse).
 */
export default function AsciiSpinner() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % FRAMES.length), 90);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      aria-label="Titel wird generiert…"
      className="animate-pulse select-none font-mono text-xs tabular-nums text-accent"
    >
      {FRAMES[i]}
    </span>
  );
}
