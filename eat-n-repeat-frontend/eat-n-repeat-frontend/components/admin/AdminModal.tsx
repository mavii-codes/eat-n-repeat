"use client";

import type { ReactNode } from "react";

type AdminModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function AdminModal({
  open,
  title,
  onClose,
  children,
  footer,
}: AdminModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex items-start justify-center">
      <button
        type="button"
        aria-label="Close modal backdrop"
        className="fixed inset-0 bg-ink/45 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="admin-panel relative z-10 my-auto w-full max-w-lg rounded-2xl p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="font-serif text-xl font-semibold text-[#800000]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-muted transition-colors hover:bg-accent-light hover:text-accent"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}
