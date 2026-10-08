import type { MetadataRoute } from "next";
import { getBranding } from "@/lib/server/config";
import { normalizeHex } from "@/lib/branding";

export const dynamic = "force-dynamic";

/**
 * Manifest icons for /api/brand/icon, which serves one image of whatever the
 * admin uploaded — so declare what it really is instead of fake 192/512 sizes.
 * Chrome installs with an SVG at sizes "any" or a raster of at least 144px.
 */
export function brandIcons(src: string | undefined): MetadataRoute.Manifest["icons"] {
  const url = "/api/brand/icon";
  // Default generated SVG: scalable, plus a full-bleed maskable variant.
  if (!src)
    return [
      { src: url, sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: url + "?maskable", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ];
  const mime = /^data:([^;,]+)/.exec(src)?.[1];
  // PNG data URL: width/height are big-endian u32 at bytes 16..24 (IHDR).
  if (mime === "image/png" && src.includes(";base64,")) {
    const head = Buffer.from(src.slice(src.indexOf(",") + 1, src.indexOf(",") + 33), "base64");
    if (head.length >= 24) {
      const w = head.readUInt32BE(16), h = head.readUInt32BE(20);
      return [{ src: url, sizes: `${w}x${h}`, type: mime }];
    }
  }
  // ponytail: other rasters (WebP/JPEG, https logos) get "any"; Chrome may then
  // refuse install. Parse their headers too if admins upload those.
  return [{ src: url, sizes: "any", ...(mime ? { type: mime } : {}) }];
}

/**
 * Web app manifest built from the admin branding, so an instance installed to a
 * home screen / as a desktop PWA carries the company's name, icon and color.
 */
export default function manifest(): MetadataRoute.Manifest {
  const b = getBranding();
  return {
    name: b.appName,
    short_name: b.appName.slice(0, 12),
    description: b.tagline || undefined,
    start_url: "/",
    display: "standalone",
    background_color: "#212121",
    theme_color: normalizeHex(b.accentColor),
    icons: brandIcons(b.faviconUrl || b.logoUrl),
  };
}
