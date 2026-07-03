/**
 * Render a PDF's pages to JPEG data URLs (client-side) so vision/OCR models
 * (Paddle, Qwen-VL, …) can read the document. Capped in pages + resolution to
 * keep the request payload sane.
 *
 * pdfjs is imported dynamically INSIDE the function so its browser-only globals
 * (DOMMatrix, …) are never evaluated during server prerender.
 */
export async function pdfToImages(
  file: File,
  { maxPages = 8, scale = 1.6, quality = 0.8 } = {}
): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  const out: string[] = [];
  try {
    const n = Math.min(doc.numPages, maxPages);
    for (let p = 1; p <= n; p++) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) break;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      out.push(canvas.toDataURL("image/jpeg", quality));
    }
  } finally {
    await task.destroy().catch(() => {});
  }
  return out;
}
