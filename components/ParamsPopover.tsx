"use client";

import { useRef, useState } from "react";
import { SlidersHorizontal, RotateCcw, Info } from "lucide-react";
import { useStore } from "@/lib/store";
import { useClickOutside } from "@/lib/useClickOutside";

export default function ParamsPopover() {
  const params = useStore((s) => s.params);
  const setParams = useStore((s) => s.setParams);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, () => setOpen(false));

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Parameter"
        className="rounded-lg p-2 text-neutral-500 transition hover:bg-neutral-200/70 dark:hover:bg-white/10"
      >
        <SlidersHorizontal size={18} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-72 menu-panel p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Parameter
            </span>
            <button
              onClick={() =>
                setParams({ temperature: 0.7, topP: 1, maxTokens: 2048 })
              }
              title="Zurücksetzen"
              className="flex items-center gap-1 rounded p-1 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              <RotateCcw size={12} /> Reset
            </button>
          </div>

          <Slider
            label="Temperatur"
            hint="Kreativität"
            info="Steuert die Zufälligkeit der Antworten. Niedrig (0–0.3) = fokussiert und vorhersehbar, hoch (0.8–2) = kreativer, aber sprunghafter."
            min={0}
            max={2}
            step={0.1}
            value={params.temperature}
            onChange={(v) => setParams({ temperature: v })}
          />
          <Slider
            label="Top_P"
            hint="Nukleus-Sampling"
            info="Begrenzt die Wortauswahl auf die wahrscheinlichsten Tokens, deren Wahrscheinlichkeit zusammen P ergibt. 1.0 = alle erlaubt, niedriger = konservativer. Meist nur Temperatur ODER Top_P anpassen."
            min={0}
            max={1}
            step={0.05}
            value={params.topP}
            onChange={(v) => setParams({ topP: v })}
          />
          <Slider
            label="Max Tokens"
            hint="Antwortlänge"
            info="Obergrenze für die Länge der Antwort in Tokens (~¾ Wort pro Token). Höher erlaubt längere Antworten, kostet aber mehr Rechenzeit."
            min={256}
            max={8192}
            step={256}
            value={params.maxTokens}
            onChange={(v) => setParams({ maxTokens: v })}
            format={(v) => String(v)}
          />
        </div>
      )}
    </div>
  );
}

/** Small "i" affordance with an elegant hover/click/focus tooltip. */
function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label="Erklärung anzeigen"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-4 w-4 items-center justify-center rounded-full text-neutral-400 transition hover:text-accent focus:text-accent focus:outline-none"
      >
        <Info size={13} />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full right-0 z-50 mb-2 w-56 rounded-lg border border-border-light bg-white px-3 py-2 text-xs font-normal normal-case leading-snug text-neutral-600 shadow-lg dark:border-border-dark dark:bg-bubble-dark dark:text-neutral-300"
        >
          {text}
        </span>
      )}
    </span>
  );
}

function Slider({
  label,
  hint,
  info,
  min,
  max,
  step,
  value,
  onChange,
  format,
}: {
  label: string;
  hint: string;
  info: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {label}
          <InfoTip text={info} />
        </span>
        <span className="font-mono text-sm text-neutral-500">
          {format ? format(value) : value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[rgb(var(--accent))]"
      />
      <span className="text-xs text-neutral-400">{hint}</span>
    </div>
  );
}
