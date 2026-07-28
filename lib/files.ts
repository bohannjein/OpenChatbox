import { uid } from "./uid";

export type AttachmentKind = "image" | "text" | "pdf" | "other";

export interface Attachment {
  id: string;
  name: string;
  size: number;
  kind: AttachmentKind;
  /** images: data URL (data:image/...;base64,...) */
  dataUrl?: string;
  /** text/pdf: extracted text content appended to the prompt */
  text?: string;
  /** true if extraction failed / unsupported */
  note?: string;
}

export const ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,.txt,.md,.csv,.json,.log,text/*,.pdf,.docx,.xlsx,.xlsm,.xls,.pptx";

const TEXT_EXT = /\.(txt|md|markdown|csv|json|log|ya?ml|xml|html?|tsx?|jsx?|py|java|c|cpp|cs|go|rs|rb|php|sh|sql|css)$/i;

export function kindOf(file: File): AttachmentKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name))
    return "pdf";
  if (file.type.startsWith("text/") || TEXT_EXT.test(file.name)) return "text";
  return "other";
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** Process a picked file into an Attachment. */
export async function processFile(file: File): Promise<Attachment> {
  const kind = kindOf(file);
  const base: Attachment = { id: uid(), name: file.name, size: file.size, kind };

  if (kind === "image") {
    return { ...base, dataUrl: await readDataUrl(file) };
  }
  if (kind === "text") {
    const text = await file.text();
    return { ...base, text };
  }
  if (kind === "pdf") {
    // PDFs sind hier nur ein Platzhalter: Textextraktion (pdf.js) und OCR laufen
    // separat in lib/pdfToImages.ts bzw. serverseitig, nicht in diesem Reader.
    return {
      ...base,
      note: "PDF angehängt — Textinhalt wird derzeit nicht ausgelesen.",
    };
  }
  // other: try as text, else note
  try {
    const text = await file.text();
    return { ...base, kind: "text", text };
  } catch {
    return { ...base, note: "Dateityp nicht unterstützt." };
  }
}

export const imageDataUrls = (attachments: Attachment[]) =>
  attachments.filter((a) => a.kind === "image" && a.dataUrl).map((a) => a.dataUrl!);
