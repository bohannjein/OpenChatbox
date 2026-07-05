"use client";

import { useRef, useState, type CSSProperties } from "react";
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
        <div className="absolute left-0 top-full z-40 mt-2 w-72 origin-top animate-pop-in rounded-2xl border border-white/[0.08] bg-zinc-950/75 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Parameter
            </span>
            <button
              onClick={() =>
                setParams({ temperature: 0.7, topP: 1, maxTokens: 2048 })
              }
              title="Zurücksetzen"
              className="flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-violet-400"
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
        className="flex h-4 w-4 items-center justify-center rounded-full text-zinc-500 transition-colors hover:text-zinc-300 focus:text-zinc-300 focus:outline-none"
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
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-200">
          {label}
          <InfoTip text={info} />
        </span>
        <span className="rounded-md border border-white/[0.05] bg-zinc-900/80 px-2 py-0.5 font-mono text-xs text-violet-400">
          {format ? format(value) : value.toFixed(2)}
        </span>
      </div>
      <div className="mt-0.5 text-[11px] text-zinc-500">{hint}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ "--pct": `${pct}%` } as CSSProperties}
        className="param-range mt-2"
      />
    </div>
  );
}
