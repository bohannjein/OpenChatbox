// Copy the pdfjs worker into /public so it is served at a stable, absolute URL
// (/pdf.worker.min.mjs). Loading the worker via `new URL(..., import.meta.url)`
// is fragile in the Next standalone/Turbopack bundle over plain HTTP (the asset
// often 404s), which silently breaks client-side PDF→image rendering for
// vision/OCR models. Runs as a `prebuild`/`predev` npm hook — bundler-agnostic.
import { copyFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const destDir = join(root, "public");
const dest = join(destDir, "pdf.worker.min.mjs");

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`[copy-pdf-worker] ${src} -> ${dest}`);
