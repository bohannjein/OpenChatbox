"use client";

import { useEffect, useState } from "react";
import { DEFAULT_BRANDING, resolveBranding, type BrandingConfig } from "./branding";

/**
 * Branding for pages outside the app shell (reset, share, join) that can't rely
 * on the hydrated store — /api/config serves branding to anonymous callers, so
 * one fetch is enough. Starts at the defaults and swaps in the real brand.
 */
export function usePublicBrand(): BrandingConfig {
  const [brand, setBrand] = useState<BrandingConfig>(DEFAULT_BRANDING);
  useEffect(() => {
    fetch("/api/config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => c && setBrand(resolveBranding(c)))
      .catch(() => {});
  }, []);
  return brand;
}
