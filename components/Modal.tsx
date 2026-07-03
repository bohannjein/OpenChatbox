"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** Centered modal with a blurred backdrop, rendered via a portal on <body> so
 *  transformed ancestors (e.g. the sliding sidebar) can't offset it. Esc /
 *  click-outside close. */
export default function Modal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 print:hidden">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border-light bg-white p-5 shadow-2xl dark:border-border-dark dark:bg-sidebar-dark">
        {children}
      </div>
    </div>,
    document.body
  );
}
