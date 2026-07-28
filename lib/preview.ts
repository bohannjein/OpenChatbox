/**
 * Helpers for the live HTML/SVG preview (Claude-Artifacts style). Pure + isomorphic
 * so they're unit-testable and usable from both the chat and the splitscreen.
 */

/** Is this block a standalone SVG image? */
export function isSvgCode(code: string, lang?: string): boolean {
  if ((lang || "").toLowerCase() === "svg") return true;
  return /^\s*<svg[\s>][\s\S]*<\/svg>\s*$/i.test(code);
}

/** Does this block render to something visual (HTML / Tailwind markup / SVG)? */
export function isPreviewable(code: string, lang?: string): boolean {
  const l = (lang || "").toLowerCase();
  if (l === "html" || l === "xml" || l === "svg") return true;
  if (isSvgCode(code, lang)) return true;
  // Heuristic: contains a real HTML element (covers Tailwind fragments, which are
  // just HTML with utility classes). CSS/JS alone isn't visually previewable.
  return /<(!doctype|html|head|body|div|section|main|article|span|p|h[1-6]|ul|ol|li|table|thead|tbody|tr|td|button|a|img|svg|canvas|header|footer|nav|form|input|label|select|textarea|pre|code|style)\b/i.test(
    code
  );
}

const hasFullDoc = (code: string) => /<html[\s>]/i.test(code);
const usesTailwind = (code: string) =>
  /\bclass=["'][^"']*\b(flex|grid|p-\d|m-\d|text-|bg-|rounded|gap-|w-|h-|items-|justify-|font-)/i.test(
    code
  );

/**
 * Build the document rendered inside the sandboxed preview iframe.
 * - Full HTML documents are used verbatim.
 * - SVG is centered on a neutral canvas.
 * - Fragments are wrapped; when they look like Tailwind markup, the Tailwind
 *   Play CDN is injected so utility classes take effect (best-effort, needs net).
 */
export function buildPreviewDoc(code: string, lang?: string): string {
  if (isSvgCode(code, lang)) {
    return (
      `<!doctype html><html><head><meta charset="utf-8">` +
      `<style>html,body{margin:0;height:100%}body{display:grid;place-items:center;` +
      `background:#fff;background-image:linear-gradient(45deg,#eee 25%,transparent 25%),` +
      `linear-gradient(-45deg,#eee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eee 75%),` +
      `linear-gradient(-45deg,transparent 75%,#eee 75%);background-size:20px 20px;` +
      `background-position:0 0,0 10px,10px -10px,-10px 0}svg{max-width:100%;max-height:100vh}</style>` +
      `</head><body>${code}</body></html>`
    );
  }
  if (hasFullDoc(code)) return code;
  const tw = usesTailwind(code)
    ? `<script src="https://cdn.tailwindcss.com"></script>`
    : "";
  return (
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">${tw}` +
    `<style>body{margin:0;padding:16px;font-family:system-ui,-apple-system,sans-serif;color:#111;background:#fff}</style>` +
    `</head><body>${code}</body></html>`
  );
}
