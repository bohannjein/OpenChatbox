import { NextResponse } from "next/server";
import crypto from "crypto";
import { getBranding } from "@/lib/server/config";
import { defaultIconSvg } from "@/lib/branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Split a data URL into its mime type and raw bytes. */
function decodeDataUrl(u: string): { mime: string; body: Buffer } | null {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(u);
  if (!m) return null;
  const [, mime, isB64, payload] = m;
  return {
    mime,
    body: isB64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8"),
  };
}

/**
 * The instance's app icon: dedicated favicon → logo → a generated icon in the
 * accent color. Serving it from a stable URL (instead of injecting a data URL
 * client-side) means the browser tab, the web manifest and outbound email all
 * show the brand — including on /login, which the app shell never mounts.
 *
 * An admin-set https logo URL is redirected to rather than proxied: the server
 * has no business fetching arbitrary URLs on a request from a browser.
 */
export async function GET(req: Request) {
  const b = getBranding();
  const src = b.faviconUrl || b.logoUrl;

  if (src && !src.startsWith("data:")) return NextResponse.redirect(src, 302);

  const decoded = src ? decodeDataUrl(src) : null;
  const { mime, body } = decoded ?? {
    mime: "image/svg+xml",
    body: Buffer.from(defaultIconSvg(b.accentColor), "utf8"),
  };

  // Short max-age + ETag: a brand change has to show up quickly, but the tab
  // icon shouldn't be re-downloaded on every navigation.
  const etag = `"${crypto.createHash("sha1").update(body).digest("base64url")}"`;
  if (req.headers.get("if-none-match") === etag)
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });

  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, max-age=300, must-revalidate",
      ETag: etag,
    },
  });
}
