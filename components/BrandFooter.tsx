"use client";

import { useBrand } from "@/lib/store";
import { supportHref, type BrandingConfig } from "@/lib/branding";

/**
 * Legal + support links (Impressum / Datenschutz / Support) as configured by the
 * admin. Renders nothing when nothing is configured, so instances that don't need
 * it stay clean — and companies that do can satisfy their imprint duty without a
 * code change.
 */
export default function BrandFooter({
  brand,
  className = "",
}: {
  brand?: BrandingConfig;
  className?: string;
}) {
  const live = useBrand();
  const b = brand ?? live;
  const support = supportHref(b);

  const links: { label: string; href: string }[] = [];
  if (b.imprintUrl) links.push({ label: "Impressum", href: b.imprintUrl });
  if (b.privacyUrl) links.push({ label: "Datenschutz", href: b.privacyUrl });
  if (support) links.push({ label: "Support", href: support });
  if (!links.length) return null;

  return (
    <div
      className={
        "flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-neutral-500 " +
        className
      }
    >
      {links.map((l, i) => (
        <span key={l.href} className="flex items-center gap-3">
          {i > 0 && <span className="text-neutral-600">·</span>}
          <a
            href={l.href}
            target={l.href.startsWith("mailto:") ? undefined : "_blank"}
            rel="noopener noreferrer"
            className="underline-offset-2 transition-colors hover:text-accent hover:underline"
          >
            {l.label}
          </a>
        </span>
      ))}
    </div>
  );
}
