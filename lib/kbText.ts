/**
 * Client-side text extraction for knowledge-base uploads. PDFs are parsed with
 * pdfjs in the browser; Office files reuse the server upload parser; plain text
 * is read directly. The extracted text is then sent to /api/kb for indexing.
 */

async function pdfToText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc)
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  const parts: string[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const line = content.items
        .map((it) => ("str" in it ? (it as { str: string }).str : ""))
        .join(" ");
      if (line.trim()) parts.push(line);
    }
  } finally {
    await task.destroy().catch(() => {});
  }
  return parts.join("\n");
}

const OFFICE = /\.(docx|pptx|xlsx|xls|xlsm|xlsb)$/i;

/** Extract plain text from an uploaded knowledge file (pdf/txt/docx/…). */
export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return pdfToText(file);
  if (OFFICE.test(name)) {
    // Reuse the server office parser (mammoth/xlsx/jszip) via the upload route.
    const fd = new FormData();
    fd.append("files", file);
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await r.json().catch(() => ({}));
    return d.files?.[0]?.text ?? "";
  }
  // txt / md / csv / anything else → read as text.
  return file.text();
}
