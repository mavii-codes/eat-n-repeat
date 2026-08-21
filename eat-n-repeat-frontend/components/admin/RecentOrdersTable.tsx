import type { RecentOrder } from "@/lib/admin/types";

type RecentOrdersTableProps = {
  orders: RecentOrder[];
  onArchive?: (order: RecentOrder) => void;
};

const statusStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
  confirmed: "bg-blue-100 text-blue-800 ring-1 ring-blue-200",
  preparing: "bg-orange-100 text-orange-800 ring-1 ring-orange-200",
  ready: "bg-purple-100 text-purple-800 ring-1 ring-purple-200",
  completed: "bg-green-100 text-green-800 ring-1 ring-green-200",
  cancelled: "bg-red-100 text-red-800 ring-1 ring-red-200",
};

export function RecentOrdersTable({ orders, onArchive }: RecentOrdersTableProps) {
  return (
    <div className="admin-panel overflow-hidden rounded-2xl">
      <div className="border-b border-accent/10 px-6 py-5">
        <h2 className="font-serif text-xl font-semibold text-[#800000]">
          Recent Orders
        </h2>
        <p className="mt-1 text-sm text-muted">Latest customer transactions</p>
      </div>

      <div className="overflow-x-auto px-2 pb-2">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="admin-table-head text-muted">
              <th className="rounded-l-lg px-4 py-3 font-medium">Order ID</th>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Items</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {onArchive && (
                <th className="rounded-r-lg px-4 py-3 font-medium">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td
                  colSpan={onArchive ? 6 : 5}
                  className="px-4 py-14 text-center"
                >
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-light text-accent">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
                        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <path d="M16 10a4 4 0 0 1-8 0" />
                      </svg>
                    </span>
                    <p className="font-medium text-[#800000]">No recent orders yet</p>
                    <p className="text-sm text-muted">
                      New orders will appear here as they come in.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-b border-accent/5 last:border-0">
                  <td className="px-4 py-3 font-medium text-accent">
                    {order.orderId}
                  </td>
                  <td className="px-4 py-3 text-muted">{order.time}</td>
                  <td className="px-4 py-3 text-muted">{order.items}</td>
                  <td className="px-4 py-3 font-semibold text-[#800000]">
                    ₱{order.total.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyles[order.status]}`}
                    >
                      {order.status}
                    </span>
                  </td>
                  {onArchive && (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onArchive(order)}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-50"
                      >
                        Archive
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
