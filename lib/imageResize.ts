import { uid } from "./uid";
import type { Attachment } from "./files";
import { MAX_ASSET_CHARS, normalizeHex } from "./branding";

/**
 * Downscale + re-encode an image in the browser so its base64 stays small.
 * Raw phone photos (5–15 MB) otherwise blow the /api/chat JSON body limit and
 * fail with "invalid request body". 1568px is a common vision-model max edge.
 */
export async function resizeImageToDataUrl(
  file: File,
  maxDim = 1568,
  quality = 0.85
): Promise<string> {
  const bmp = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D-Kontext nicht verfügbar.");
    // White backing so transparent PNGs don't turn black in JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);

    // JPEG for maximum vision-provider compatibility (OpenAI/Gemini/Anthropic/
    // Ollama all accept it; WebP is rejected by some, e.g. Gemini → "Failed to
    // load image").
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    bmp.close?.();
  }
}

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    r.readAsDataURL(file);
  });

/**
 * Prepare a logo/favicon for inlining into the admin config.
 *
 * Unlike resizeImageToDataUrl (JPEG on a white backing, for vision models) this
 * preserves transparency — a logo on the dark sidebar must not sit in a white
 * box. SVG is passed through untouched, since rasterizing it would throw away
 * the one format that scales. Falls back to WebP and then to half the size when
 * PNG lands above the config's asset cap.
 */
export async function resizeLogoToDataUrl(file: File, maxDim = 512): Promise<string> {
  if (file.type === "image/svg+xml") {
    const svg = await readAsDataUrl(file);
    if (svg.length > MAX_ASSET_CHARS)
      throw new Error("SVG ist zu groß (max. ~370 kB).");
    return svg;
  }

  const bmp = await createImageBitmap(file);
  try {
    for (const [dim, mime, quality] of [
      [maxDim, "image/png", undefined],
      [maxDim, "image/webp", 0.92],
      [Math.round(maxDim / 2), "image/webp", 0.9],
    ] as const) {
      const scale = Math.min(1, dim / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * scale));
      const h = Math.max(1, Math.round(bmp.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D-Kontext nicht verfügbar.");
      ctx.drawImage(bmp, 0, 0, w, h); // no backing fill → alpha survives
      const out = canvas.toDataURL(mime, quality);
      if (out.length <= MAX_ASSET_CHARS) return out;
    }
    throw new Error("Bild ist zu groß — bitte kleineres Logo verwenden.");
  } finally {
    bmp.close?.();
  }
}

/**
 * Guess a brand accent from a logo: the most common strongly-colored hue, so
 * uploading a logo can propose a matching accent instead of making the admin
 * eyedrop it. Ignores transparent, near-grey and very dark/bright pixels — those
 * are outlines and backgrounds, not the brand color. Returns a #rrggbb string,
 * or "" when the image has no usable color (pure black/white/grey logo).
 */
export async function dominantColorFromDataUrl(src: string): Promise<string> {
  const img = document.createElement("img");
  img.src = src;
  try {
    await img.decode();
  } catch {
    return "";
  }
  const N = 48;
  const canvas = document.createElement("canvas");
  canvas.width = N;
  canvas.height = N;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "";
  ctx.drawImage(img, 0, 0, N, N);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, N, N).data;
  } catch {
    return ""; // cross-origin logo URL → canvas is tainted
  }

  // Bucket by hue (24 buckets of 15°), summing the pixels of each bucket so the
  // winner can be averaged instead of snapped to one arbitrary pixel.
  const buckets = Array.from({ length: 24 }, () => ({ n: 0, r: 0, g: 0, b: 0 }));
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 128) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max < 40 || min > 225) continue; // near-black / near-white
    const sat = max === 0 ? 0 : (max - min) / max;
    if (sat < 0.25) continue; // grey-ish → not a brand color
    let hue = 0;
    if (max === r) hue = ((g - b) / (max - min)) * 60;
    else if (max === g) hue = ((b - r) / (max - min)) * 60 + 120;
    else hue = ((r - g) / (max - min)) * 60 + 240;
    const bk = buckets[Math.floor(((hue + 360) % 360) / 15)];
    bk.n++;
    bk.r += r;
    bk.g += g;
    bk.b += b;
  }

  const win = buckets.reduce((a, b) => (b.n > a.n ? b : a), buckets[0]);
  if (!win.n) return "";
  const hex = [win.r, win.g, win.b]
    .map((c) => Math.round(c / win.n).toString(16).padStart(2, "0"))
    .join("");
  return normalizeHex(`#${hex}`);
}

export async function resizeImageToAttachment(
  file: File,
  maxDim = 1568,
  quality = 0.85
): Promise<Attachment> {
  const dataUrl = await resizeImageToDataUrl(file, maxDim, quality);
  return {
    id: uid(),
    name: file.name,
    size: Math.floor((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75),
    kind: "image",
    dataUrl,
  };
}
