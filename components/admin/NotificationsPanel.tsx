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
    <div className="admin-panel flex h-full flex-col rounded-2xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl font-semibold text-[#800000]">
            Notifications
          </h2>
          <p className="mt-1 text-sm text-muted">System alerts & activity</p>
        </div>
        <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
          {notifications.length}
        </span>
      </div>

      <ul className="flex flex-1 flex-col gap-3">
        {notifications.map((notification) => (
          <li key={notification.id} className="admin-alert rounded-xl px-4 py-3">
            <div className="flex items-start gap-3">
              <WarningIcon />
              <div>
                <p className="text-sm font-medium text-[#800000]">
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
        className="mt-5 block rounded-xl bg-gradient-to-r from-accent to-accent-dark py-3 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        View Stock Management
      </Link>
    </div>
  );
}
