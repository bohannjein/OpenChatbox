"use client";

import clsx from "clsx";
import Modal from "./Modal";
import { useT } from "@/lib/i18n";

/** Modal yes/no confirmation — the in-app replacement for window.confirm(). */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  return (
    <Modal onClose={onCancel}>
      <h2 className="text-lg font-bold">{title}</h2>
      {message && <p className="mt-2 text-sm text-neutral-500">{message}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg border border-border-light px-4 py-2 text-sm font-medium transition hover:bg-neutral-100 dark:border-border-dark dark:hover:bg-white/5"
        >
          {cancelLabel ?? t("common.cancel")}
        </button>
        <button
          onClick={onConfirm}
          className={clsx(
            "rounded-lg px-4 py-2 text-sm font-medium text-white transition",
            danger ? "bg-red-600 hover:bg-red-700" : "bg-accent hover:bg-accent-hover"
          )}
        >
          {confirmLabel ?? t("common.confirm")}
        </button>
      </div>
    </Modal>
  );
}
