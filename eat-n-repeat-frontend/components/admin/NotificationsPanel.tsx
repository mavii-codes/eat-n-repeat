import Link from "next/link";
import type { AdminNotification } from "@/lib/admin/types";

type NotificationsPanelProps = {
  notifications: AdminNotification[];
};

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 text-amber-600" aria-hidden>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function NotificationsPanel({ notifications }: NotificationsPanelProps) {
  return (
    <div className="admin-panel flex h-full min-w-0 flex-col rounded-2xl p-4 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3 sm:mb-5 sm:items-center">
        <div className="min-w-0">
          <h2 className="font-serif text-lg font-semibold text-[#800000] sm:text-xl">
            Notifications
          </h2>
          <p className="mt-1 text-xs text-muted sm:text-sm">System alerts & activity</p>
        </div>
        <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white sm:h-8 sm:min-w-8">
          {notifications.length}
        </span>
      </div>

      <ul className="flex flex-1 flex-col gap-2.5 sm:gap-3">
        {notifications.length === 0 && (
          <li className="rounded-xl border border-dashed border-accent/20 bg-accent-light/20 px-4 py-6 text-center text-sm text-muted">
            You&apos;re all caught up. There are no new alerts.
          </li>
        )}
        {notifications.map((notification) => (
          <li key={notification.id} className="admin-alert min-w-0 rounded-xl px-3 py-3 sm:px-4">
            <div className="flex items-start gap-2.5 sm:gap-3">
              <WarningIcon />
              <div className="min-w-0">
                <p className="break-words text-sm font-medium leading-5 text-[#800000]">
                  {notification.title}
                </p>
                <p className="mt-1 text-xs text-muted">{notification.timestamp}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Link
        href="/admin/stock"
        className="mt-4 block min-h-11 rounded-xl bg-gradient-to-r from-accent to-accent-dark px-4 py-3 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:mt-5"
      >
        View Stock Management
      </Link>
    </div>
  );
}
