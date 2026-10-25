"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

type AdminModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
  className?: string;
};

const widthClassMap: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
};

export function AdminModal({
  open,
  title,
  onClose,
  children,
  footer,
  maxWidth = "lg",
  className,
}: AdminModalProps) {
  if (!open) return null;

  const widthClass = widthClassMap[maxWidth] || "max-w-lg";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 flex items-center justify-center">
      <button
        type="button"
        aria-label="Close modal backdrop"
        className="fixed inset-0 bg-ink/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div
        className={`admin-panel relative z-10 w-full ${widthClass} max-h-[92vh] flex flex-col rounded-2xl bg-white p-6 shadow-xl border border-stone-200/80 transition-all ${
          className || ""
        }`}
      >
        <div className="mb-4 flex items-center justify-between gap-4 shrink-0 pb-3 border-b border-stone-100">
          <h2 className="font-serif text-xl font-bold text-[#800000]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto pr-1">{children}</div>
        {footer && (
          <div className="mt-5 shrink-0 flex justify-end gap-3 pt-3 border-t border-stone-100">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
