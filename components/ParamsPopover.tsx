"use client";

import { useRef, useState, type CSSProperties } from "react";
import clsx from "clsx";
import { SlidersHorizontal, RotateCcw, Info, ChevronDown } from "lucide-react";
import { useStore } from "@/lib/store";
import { useClickOutside } from "@/lib/useClickOutside";

/** Answer style, expressed the way people actually think about it. The raw
 *  sliders stay available under "Erweitert" for anyone who wants them. */
const STYLES = [
  { id: "precise", label: "Präzise", temperature: 0.2, topP: 0.9 },
  { id: "balanced", label: "Ausgewogen", temperature: 0.7, topP: 1 },
  { id: "creative", label: "Kreativ", temperature: 1.2, topP: 1 },
] as const;

const LENGTHS = [
  { id: "short", label: "Kurz", maxTokens: 1024 },
  { id: "normal", label: "Normal", maxTokens: 2048 },
  { id: "long", label: "Ausführlich", maxTokens: 4096 },
] as const;

export default function ParamsPopover() {
  const params = useStore((s) => s.params);
  const setParams = useStore((s) => s.setParams);
  const [open, setOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, () => setOpen(false));

  // Derived, not stored — hand-tuned slider values simply match nothing.
  const activeStyle = STYLES.find(
    (s) => s.temperature === params.temperature && s.topP === params.topP
  );
  const activeLength = LENGTHS.find((l) => l.maxTokens === params.maxTokens);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Antwortstil"
        className="rounded-l-none rounded-r-xl p-2 text-zinc-400 transition-colors duration-150 hover:bg-neutral-200/70 hover:text-neutral-900 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <SlidersHorizontal size={18} strokeWidth={1.5} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 w-72 origin-top animate-pop-in rounded-2xl border border-white/[0.08] bg-zinc-950/75 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Antwortstil
            </span>
            <button
              onClick={() => {
                setParams({ temperature: 0.7, topP: 1, maxTokens: 2048 });
                setAdvanced(false);
              }}
              title="Zurücksetzen"
              className="flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-violet-400"
            >
              <RotateCcw size={12} /> Reset
            </button>
          </div>

          <Choice
            options={STYLES.map((s) => ({
              id: s.id,
              label: s.label,
              onPick: () =>
                setParams({ temperature: s.temperature, topP: s.topP }),
            }))}
            activeId={activeStyle?.id}
            fallback="Eigene Einstellung"
          />

          <div className="mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Länge
          </div>
          <Choice
            options={LENGTHS.map((l) => ({
              id: l.id,
              label: l.label,
              onPick: () => setParams({ maxTokens: l.maxTokens }),
            }))}
            activeId={activeLength?.id}
            fallback="Eigene Länge"
          />

          <button
            onClick={() => setAdvanced((v) => !v)}
            className="mt-4 flex w-full items-center gap-1 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <ChevronDown
              size={13}
              className={clsx(
                "transition-transform duration-150",
                advanced && "rotate-180"
              )}
            />
            Erweitert
          </button>

          {advanced && (
            <div className="mt-3 border-t border-white/[0.06] pt-3">
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
      )}
    </div>
  );
}

/** Segmented picker; shows a hint instead of a selection when the current
 *  values don't line up with any preset. */
function Choice({
  options,
  activeId,
  fallback,
}: {
  options: { id: string; label: string; onPick: () => void }[];
  activeId?: string;
  fallback: string;
}) {
  return (
    <>
      <div className="flex gap-1">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={o.onPick}
            className={clsx(
              "flex-1 rounded-lg px-2 py-1.5 text-xs transition-colors duration-150",
              activeId === o.id
                ? "bg-violet-500/20 font-medium text-violet-300"
                : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {!activeId && (
        <div className="mt-1.5 text-[11px] text-zinc-500">{fallback}</div>
      )}
    </>
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
