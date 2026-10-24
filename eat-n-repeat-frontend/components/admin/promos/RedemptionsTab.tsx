"use client";

/* Promo Codes — redemptions tab. Pick a code, see who used it and where:
   customer, order, channel, discount, lifecycle status (Reserved / Applied /
   Released), and when. Data comes from the configured /api/admin/promo
   list + /api/admin/promos/:code/redemptions endpoints. */

import { useEffect, useState } from "react";
import { Receipt, Tag } from "lucide-react";
import { AdminPanel } from "@/components/admin/AdminForm";
import {
  fetchPromoPage,
  fetchRedemptions,
} from "./api";
import { shortDateTime } from "./format";
import { usePromoList } from "./use-promo-list";
import {
  EmptyState,
  ErrorBanner,
  RedemptionChip,
  TableSkeleton,
  ToolbarSelect,
} from "./ui";
import type { PromoRow, RedemptionRow } from "./types";

function php(n: number | string): string {
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(2) : String(n);
}

export default function RedemptionsTab() {
  /* A lightweight catalog of codes for the picker (first 100). */
  const codesResult = usePromoList<PromoRow>(fetchPromoPage, {
    page: 1,
    limit: 100,
  });
  const codes = codesResult.data?.rows ?? [];

  const [selected, setSelected] = useState<string>("");
  const [redemptions, setRedemptions] = useState<RedemptionRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!selected) {
      setRedemptions(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      const result = await fetchRedemptions(selected);
      if (cancelled) return;
      if (result.ok) {
        setRedemptions(result.data.rows);
        setError(null);
      } else {
        setRedemptions(null);
        setError(result.message);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, retryToken]);

  return (
    <AdminPanel
      title="Redemption History"
      subtitle="See exactly who used each code and where."
    >
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <ToolbarSelect
          value={selected}
          onChange={(value) => setSelected(value)}
          className="min-w-[220px]"
        >
          <option value="">Choose a code…</option>
          {codes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}
            </option>
          ))}
        </ToolbarSelect>
      </div>

      {selected && error && (
        <ErrorBanner
          message={error}
          onRetry={() => setRetryToken((v) => v + 1)}
        />
      )}

      {selected && loading && (!redemptions || redemptions.length === 0) && (
        <TableSkeleton rows={4} />
      )}

      {selected && !loading && !error && redemptions && redemptions.length === 0 && (
        <EmptyState
          icon={<Receipt className="h-5 w-5" />}
          title="Nothing to show yet"
          hint="No customer has redeemed this code so far."
        />
      )}

      {selected && redemptions && redemptions.length > 0 && (
        <div className="px-3 pb-4 space-y-2">
          {redemptions.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-stone-100 bg-stone-50/60 p-3.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-stone-800 truncate">
                    {r.customer_name || "—"}
                  </p>
                  <p className="text-xs text-stone-400 truncate">
                    Order #{r.order_number}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-black text-[#800000] text-sm">
                    −₱{php(r.discount)}
                  </span>
                  <RedemptionChip status={r.status} />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-stone-500">
                {r.created_at && <span>{shortDateTime(r.created_at)}</span>}
              </div>
            </div>
          ))}
          <p className="px-1 pt-1 text-[11px] text-stone-400">
            {redemptions.length} redemptio{redemptions.length === 1 ? "n" : "ns"} in this code's history
          </p>
        </div>
      )}

      {!selected && (
        <EmptyState
          icon={<Tag className="h-5 w-5" />}
          title="Choose a code"
          hint="Pick a promo code above to view who used it."
        />
      )}
    </AdminPanel>
  );
}
