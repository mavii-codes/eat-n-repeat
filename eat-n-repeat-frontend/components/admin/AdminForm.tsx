import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type FieldProps = {
  label: string;
  children: ReactNode;
};

export function AdminField({ label, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

const inputClassName =
  "w-full rounded-xl border border-accent/15 bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/15";

export function AdminInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={inputClassName} {...props} />;
}

export function AdminSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={inputClassName} {...props} />;
}

export function AdminTextarea(
  props: TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return <textarea className={`${inputClassName} min-h-24 resize-y`} {...props} />;
}

type AdminButtonProps = {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
};

const variants = {
  primary:
    "bg-gradient-to-r from-accent to-accent-dark text-white shadow-[var(--shadow-soft)] hover:opacity-90",
  secondary:
    "border border-accent/15 bg-white text-accent hover:bg-accent-light",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export function AdminButton({
  children,
  variant = "primary",
  type = "button",
  onClick,
  disabled,
}: AdminButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

export function CrudActions({
  onEdit,
  onDelete,
  deleteLabel = "Delete",
}: {
  onEdit: () => void;
  onDelete: () => void;
  deleteLabel?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onEdit}
        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent-light"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-50"
      >
        {deleteLabel}
      </button>
    </div>
  );
}

export function RestoreButton({ onRestore }: { onRestore: () => void }) {
  return (
    <button
      type="button"
      onClick={onRestore}
      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent-light"
    >
      Restore
    </button>
  );
}

export function AdminPanel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="admin-panel overflow-hidden rounded-2xl">
      <div className="flex flex-col gap-4 border-b border-accent/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-xl font-semibold text-[#800000]">
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
