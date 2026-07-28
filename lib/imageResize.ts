import { uid } from "./uid";
import type { Attachment } from "./files";

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
