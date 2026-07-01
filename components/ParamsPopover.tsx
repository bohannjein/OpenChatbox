"use client";

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, RotateCcw } from "lucide-react";
import { useStore } from "@/lib/store";

export default function ParamsPopover() {
  const params = useStore((s) => s.params);
  const setParams = useStore((s) => s.setParams);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

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
        <div className="absolute left-0 top-full z-40 mt-1 w-72 rounded-xl border border-border-light bg-white p-4 shadow-xl dark:border-border-dark dark:bg-sidebar-dark">
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
            min={0}
            max={2}
            step={0.1}
            value={params.temperature}
            onChange={(v) => setParams({ temperature: v })}
          />
          <Slider
            label="Top_P"
            hint="Nukleus-Sampling"
            min={0}
            max={1}
            step={0.05}
            value={params.topP}
            onChange={(v) => setParams({ topP: v })}
          />
          <Slider
            label="Max Tokens"
            hint="Antwortlänge"
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

function Slider({
  label,
  hint,
  min,
  max,
  step,
  value,
  onChange,
  format,
}: {
  label: string;
  hint: string;
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
        <span className="text-sm font-medium">{label}</span>
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
        className="w-full accent-[#10a37f]"
      />
      <span className="text-xs text-neutral-400">{hint}</span>
    </div>
  );
}
