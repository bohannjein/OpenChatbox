import type { MetadataRoute } from "next";
import { getBranding } from "@/lib/server/config";
import { normalizeHex } from "@/lib/branding";

export const dynamic = "force-dynamic";

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
    icons: [
      // One entry with sizes "any" and no declared type: the route serves
      // whatever the admin uploaded (SVG, PNG, WebP), so claiming fixed raster
      // sizes or a fixed mime type would be wrong.
      { src: "/api/brand/icon", sizes: "any" },
    ],
  };
}
