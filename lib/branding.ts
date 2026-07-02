/** Default accent: the original türkis (ChatGPT-Grün). */
export const DEFAULT_ACCENT = "#10a37f";

const HEX = /^#[0-9a-fA-F]{6}$/;

export const normalizeHex = (v: string) =>
  v && HEX.test(v.trim()) ? v.trim() : DEFAULT_ACCENT;

/** "#10a37f" → "16 163 127" (RGB channels for rgb(var(--accent) / <alpha>)). */
export function hexToRgbChannels(hex: string): string {
  const h = normalizeHex(hex).slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/** Darken a hex color by `factor` (0..1) for hover state. */
export function darkenChannels(hex: string, factor = 0.85): string {
  const h = normalizeHex(hex).slice(1);
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const r = clamp(parseInt(h.slice(0, 2), 16) * factor);
  const g = clamp(parseInt(h.slice(2, 4), 16) * factor);
  const b = clamp(parseInt(h.slice(4, 6), 16) * factor);
  return `${r} ${g} ${b}`;
}
