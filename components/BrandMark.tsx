"use client";

import { useBrand } from "@/lib/store";
import { brandLogo, type BrandingConfig } from "@/lib/branding";

const SIZES = {
  sm: { box: "h-6 w-6 rounded-md text-xs", logo: "max-h-6", name: "text-sm" },
  md: { box: "h-7 w-7 rounded-lg text-sm", logo: "max-h-7", name: "text-base" },
  lg: { box: "h-12 w-12 rounded-xl text-xl", logo: "max-h-14", name: "text-xl" },
} as const;

/**
 * The instance's brand: uploaded logo when there is one, otherwise an accent
 * square with the first letter of the name. Single place where "how the brand
 * looks" is decided — sidebar, login, setup, share and the admin preview all
 * render this, so a new surface can't reintroduce a hardcoded product name.
 *
 * Pass `brand` to render something other than the live brand (admin preview);
 * pass `dark` when the surface's theme is fixed regardless of the user's (login).
 */
export default function BrandMark({
  brand,
  size = "md",
  layout = "row",
  dark = true,
  showName = true,
  className = "",
}: {
  brand?: BrandingConfig;
  size?: keyof typeof SIZES;
  layout?: "row" | "col";
  dark?: boolean;
  showName?: boolean;
  className?: string;
}) {
  const live = useBrand();
  const b = brand ?? live;
  const s = SIZES[size];
  const logo = brandLogo(b, dark);
  const col = layout === "col";

  return (
    <span
      className={
        (col ? "flex flex-col items-center gap-2" : "flex min-w-0 items-center gap-2") +
        " " +
        className
      }
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        // A logo usually carries the wordmark, so it replaces the name entirely.
        <img src={logo} alt={b.appName} className={`${s.logo} max-w-[70%] object-contain`} />
      ) : (
        <>
          <span
            className={`flex shrink-0 items-center justify-center bg-accent font-bold text-white ${s.box}`}
          >
            {b.appName.trim().charAt(0).toUpperCase()}
          </span>
          {showName && (
            <span className={`truncate font-bold tracking-tight ${s.name}`}>{b.appName}</span>
          )}
        </>
      )}
    </span>
  );
}
