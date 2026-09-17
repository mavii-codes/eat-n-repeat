type AdminPageHeaderProps = {
  title: string;
  subtitle: string;
  badge?: string;
  action?: React.ReactNode;
};

export function AdminPageHeader({ title, subtitle, badge, action }: AdminPageHeaderProps) {
  const today = new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="admin-panel mb-8 flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {badge && (
          <span className="mb-3 inline-flex rounded-full bg-accent-light px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
            {badge}
          </span>
        )}
        <h1 className="admin-page-title font-serif text-3xl font-semibold sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-7 text-muted">{subtitle}</p>
      </div>
      <div className="flex flex-col sm:items-end gap-3">
        {action}
        <div className="rounded-xl border border-accent/10 bg-accent-light/60 px-4 py-3 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent/70">
            Today
          </p>
          <p className="mt-1 text-sm font-medium text-ink">{today}</p>
        </div>
      </div>
    </div>
  );
}
