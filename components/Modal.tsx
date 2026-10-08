"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useDialog } from "@/lib/useDialog";

/** Centered modal with a blurred backdrop, rendered via a portal on <body> so
 *  transformed ancestors (e.g. the sliding sidebar) can't offset it. Esc /
 *  click-outside close; focus is trapped and labelled by the first heading. */
export default function Modal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const ref = useDialog(mounted, onClose);

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 print:hidden">
      <div
        className="absolute inset-0 animate-fade-in bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="relative z-10 w-full max-w-sm origin-center animate-modal-in rounded-2xl border border-border-light bg-white p-5 shadow-2xl outline-none dark:border-border-dark dark:bg-sidebar-dark"
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
