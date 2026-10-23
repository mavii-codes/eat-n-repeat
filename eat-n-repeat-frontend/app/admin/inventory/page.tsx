"use client";

import { useCallback, useEffect, useId, useRef, useState, Fragment, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  History,
  RefreshCw,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { useAdminData } from "@/context/AdminDataContext";
import type { StockDashboardResponse, StockLayer } from "@/lib/admin/types";
import {
  fmtQty,
  formatMovementDateTime,
  getStockLayerSource,
  getStockMovementBadge,
  peso,
  signedQty,
} from "@/lib/admin/inventory-utils";

/* ══════════════════════════════════════════════════════════════
   Inventory Dashboard (A5) — /admin/inventory
   Section root: reached via the sidebar Inventory submenu instead
   of a hub page; content and behavior are the former combined
   page, moved as-is.
   Stats + alert lists + recent movements + top usage this week.
   Data: GET /api/stock/dashboard via fetchStockDashboard(); writes
   elsewhere funnel back here through refreshBackendStock().
   ══════════════════════════════════════════════════════════════ */

// Card shell shared with Cash Management.
const CARD = "bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden";
const CARD_HEAD = "p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50";

/** Fresh/stale chip — "ONLINE" while the dashboard is current. */
function LiveChip({ isStale }: { isStale: boolean }) {
  return isStale ? (
    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-amber-100 text-amber-800 border border-amber-300">
      Offline
    </span>
  ) : (
    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
      ONLINE
    </span>
  );
}

/** Expansion state of one item's FIFO cost-layer view. */
type LayersEntry = StockLayer[] | "loading" | "error";

/** Context call for PATCH /api/stock/items/:id/layers/:layerId/cost (Phase B). */
type SetLayerCostFn = (
  itemId: string,
  layerId: string,
  unitCost: number,
) => Promise<{ ok: true; layer: StockLayer } | { ok: false; message: string }>;

/** Date-only label ("Oct 25, 2026") for a layer's received / expiry dates. */
function formatLayerDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Amber expiry emphasis: date is within 7 days (or already past). */
function isExpiringWithin(iso: string | null | undefined, days: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t <= Date.now() + days * 24 * 60 * 60 * 1000;
}

/** "Cost not set" chip — same tiny-badge DNA as the Cash Management badges. */
const LAYER_COST_BADGE = "rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border font-mono bg-amber-50 text-amber-700 border-amber-200 whitespace-nowrap";

/** Compact admin form: ₱/unit entry → PATCH via setStockLayerCost. State
 *  (draft/pending/error) lives here so each layer keeps its own history. */
function LayerCostForm({
  layer,
  itemId,
  setStockLayerCost,
  onSaved,
  onCancel,
}: {
  layer: StockLayer;
  itemId: string;
  setStockLayerCost: SetLayerCostFn;
  onSaved: (itemId: string, layer: StockLayer) => void;
  onCancel: () => void;
}) {
  const inputId = useId();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = Number(draft);
  const valid = draft.trim() !== "" && Number.isFinite(parsed) && parsed >= 0;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    const result = await setStockLayerCost(itemId, layer.id, parsed);
    if (result.ok) {
      onSaved(itemId, result.layer);
      onCancel();
      return;
    }
    setSaving(false);
    setError(result.message);
  };

  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor={inputId}
          className="text-[10px] font-black uppercase tracking-wider text-stone-500"
        >
          Cost per unit
        </label>
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400"
          >
            ₱
          </span>
          <input
            id={inputId}
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            autoComplete="off"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void save();
              }
            }}
            disabled={saving}
            placeholder="0.00"
            className="w-28 rounded-lg border border-stone-300 bg-white py-1 pl-6 pr-2 text-sm font-bold tabular-nums text-stone-800 outline-none transition-colors focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/30 disabled:opacity-60"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-bold text-stone-600 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!valid || saving}
            className="rounded-lg bg-gradient-to-r from-accent to-accent-dark px-3 py-1 text-xs font-bold text-white shadow-[var(--shadow-soft)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      {error && (
        <p aria-live="polite" className="mt-1.5 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

/** One cost-layer row: a wrap-friendly card, not a rigid table — quantity
 *  and cost lead, provenance + dates follow, expiry goes amber when close. */
function CostLayerRow({
  layer,
  itemId,
  setStockLayerCost,
  onLayerCostSaved,
}: {
  layer: StockLayer;
  itemId: string;
  setStockLayerCost: SetLayerCostFn;
  onLayerCostSaved: (itemId: string, layer: StockLayer) => void;
}) {
  const [editing, setEditing] = useState(false);

  const opening = layer.isOpening === true;
  // Opening layers always carry the stone "Opening" badge, whatever the raw
  // sourceRef; the rest map through the shared helper (Stock In /
  // Auto-recovered for residuals).
  const source = getStockLayerSource(opening ? "opening" : layer.sourceRef);
  const hasCost = !layer.costNotSet && layer.unitCost != null;
  // The admin inline control is only offered on unpriced opening layers —
  // a cost, once set, is never editable through this panel.
  const canEdit = opening && layer.costNotSet === true;
  const partialTake =
    layer.quantityReceived != null &&
    Number(layer.quantityReceived) !== Number(layer.remaining);
  const expiringSoon =
    layer.expiryDate != null && isExpiringWithin(layer.expiryDate, 7);
  const receivedLabel = formatLayerDate(layer.receivedAt ?? layer.createdAt);

  return (
    <div className="px-3 py-2.5 transition-colors hover:bg-stone-50/60">
      {/* Quantity + cost line */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-baseline gap-1.5 leading-none">
          <span className="text-lg font-black tabular-nums text-stone-900">
            {fmtQty(layer.remaining)}
          </span>
          {partialTake && (
            <span className="text-[11px] font-semibold text-stone-400">
              of {fmtQty(layer.quantityReceived)} left
            </span>
          )}
        </span>

        {/* Currency / provenance cluster */}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {hasCost ? (
            <span className="text-sm font-bold tabular-nums text-[#800000]">
              {peso(layer.unitCost)}
            </span>
          ) : layer.costNotSet === true ? (
            <span className={LAYER_COST_BADGE}>Cost not set</span>
          ) : (
            <span className="text-sm text-stone-300">—</span>
          )}
          {canEdit && !editing && (
            <button
              type="button"
              aria-label={`Set unit cost for the opening layer received ${receivedLabel}`}
              onClick={() => setEditing(true)}
              className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 transition-colors hover:bg-amber-100"
            >
              Set cost
            </button>
          )}
        </div>
      </div>

      {/* Provenance + dates line */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold">
        {source.className && (
          <span className={source.className}>{source.label}</span>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-stone-500">
          <span className="whitespace-nowrap">
            Received{" "}
            <span className="font-bold text-stone-600">{receivedLabel}</span>
          </span>
          {layer.expiryDate != null && (
            <span
              className={`whitespace-nowrap ${expiringSoon ? "text-amber-700" : ""}`}
            >
              Expires{" "}
              <span
                className={
                  expiringSoon
                    ? "font-bold text-amber-800"
                    : "font-bold text-stone-600"
                }
              >
                {formatLayerDate(layer.expiryDate)}
              </span>
            </span>
          )}
        </span>
      </div>

      {editing && canEdit && (
        <LayerCostForm
          layer={layer}
          itemId={itemId}
          setStockLayerCost={setStockLayerCost}
          onSaved={onLayerCostSaved}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}

/** Cost-layer list under an expanded alert row (Phase B): sorted nearest
 *  expiry first; opening layers with no recorded cost expose an admin
 *  "Set cost" control that saves through the context setter. */
function LayersPanel({
  entry,
  onRetry,
  itemId,
  setStockLayerCost,
  onLayerCostSaved,
}: {
  entry: LayersEntry | undefined;
  onRetry?: () => void;
  itemId: string;
  setStockLayerCost: SetLayerCostFn;
  onLayerCostSaved: (itemId: string, layer: StockLayer) => void;
}) {
  if (entry === undefined || entry === "loading") {
    return <p className="text-xs font-bold text-stone-400">Loading layers…</p>;
  }
  if (entry === "error") {
    return (
      <p className="text-xs font-bold text-stone-400">
        Couldn&apos;t load layers.{" "}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="underline underline-offset-2 hover:text-stone-600"
          >
            Retry
          </button>
        )}
      </p>
    );
  }
  if (entry.length === 0) {
    return <p className="text-xs font-bold text-stone-400">No recorded layers.</p>;
  }
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-stone-400">
        Cost Layers — nearest expiry first ({entry.length})
      </p>
      <div className="rounded-lg border border-stone-200 bg-white divide-y divide-stone-100">
        {entry.map((layer) => (
          <CostLayerRow
            key={layer.id}
            layer={layer}
            itemId={itemId}
            setStockLayerCost={setStockLayerCost}
            onLayerCostSaved={onLayerCostSaved}
          />
        ))}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  note,
}: {
  label: string;
  value: string;
  tone: "plain" | "amber" | "red";
  note?: ReactNode;
}) {
  const ring =
    tone === "amber"
      ? "border-amber-300/70 ring-1 ring-amber-200"
      : tone === "red"
        ? "border-red-300/70 ring-1 ring-red-200"
        : "border-stone-200";
  return (
    <div className={`bg-white rounded-xl shadow-sm border p-5 ${ring}`}>
      <p className="text-[10px] font-black uppercase tracking-wider text-stone-500">{label}</p>
      <p className="mt-2 font-serif text-3xl font-bold text-[#800000]">{value}</p>
      {note && <div className="mt-2">{note}</div>}
    </div>
  );
}

export default function InventoryDashboardPage() {
  const {
    fetchStockDashboard,
    refreshBackendStock,
    fetchStockItemLayers,
    setStockLayerCost,
    salesEventsVersion,
  } = useAdminData();
  const [dashboard, setDashboard] = useState<StockDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Cost-layers expansion per item id (Phase B): lazy fetch on first expand,
  // successful results cached so re-expanding never refetches. "error" is
  // retried on the next expand (or via the inline Retry in the panel).
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [layersCache, setLayersCache] = useState<Record<string, LayersEntry>>({});

  // Mirror of expandedItems for the realtime effect: reading through the ref
  // keeps expandedItems out of that effect's dependency list, so toggling a
  // row never churns the (version-guarded) realtime effect. Declared before
  // the realtime effect so this sync always runs first in a commit.
  const expandedItemsRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    expandedItemsRef.current = expandedItems;
  }, [expandedItems]);

  // Recent Movements expansion per movement id — independent from the alert
  // tables so opening a movement never expands unrelated alert rows.
  const [expandedMovements, setExpandedMovements] = useState<Record<string, boolean>>({});

  // Movement id -> stockItemId for currently open movement rows. Mirrored for
  // the realtime effect so it can refetch the same item layer data in place.
  const expandedMovementItemsRef = useRef<Record<string, string>>({});
  useEffect(() => {
    const open: Record<string, string> = {};
    for (const movementId of Object.keys(expandedMovements)) {
      if (expandedMovements[movementId] !== true) continue;
      const stockItemId = expandedMovementItemsRef.current[movementId];
      if (stockItemId) open[movementId] = stockItemId;
    }
    expandedMovementItemsRef.current = open;
  }, [expandedMovements]);

  // Realtime: refetch dashboard + refresh layer data after each debounced
  // admin event. Start from the current version so mounting doesn't double-fetch.
  const lastSalesEventsVersion = useRef(salesEventsVersion);

  const resetLayers = useCallback(() => {
    setLayersCache({});
    setExpandedItems({});
    setExpandedMovements({});
  }, []);

  const fetchLayersFor = useCallback(
    async (itemId: string) => {
      setLayersCache((prev) => ({ ...prev, [itemId]: "loading" }));
      const layers = await fetchStockItemLayers(itemId);
      setLayersCache((prev) => ({ ...prev, [itemId]: layers ?? "error" }));
    },
    [fetchStockItemLayers]
  );

  // Phase B: a saved layer cost is spliced into this page's layers cache
  // (no row refetch) while the dashboard cards refresh — Total Stock Value,
  // the Estimate badge and items-without-cost all react to the new cost.
  const handleLayerCostSaved = useCallback(
    async (itemId: string, layer: StockLayer) => {
      setLayersCache((prev) => {
        const entry = prev[itemId];
        if (!entry || entry === "loading" || entry === "error") return prev;
        return {
          ...prev,
          [itemId]: entry.map((l) => (l.id === layer.id ? layer : l)),
        };
      });
      const dash = await fetchStockDashboard();
      if (dash) {
        setDashboard(dash);
        setIsStale(false);
      } else {
        setIsStale(true);
      }
    },
    [fetchStockDashboard]
  );

  const toggleLayers = useCallback(
    (itemId: string) => {
      const willOpen = expandedItems[itemId] !== true;
      setExpandedItems((prev) => ({ ...prev, [itemId]: willOpen }));
      const cached = layersCache[itemId];
      if (willOpen && (!cached || cached === "error")) void fetchLayersFor(itemId);
    },
    [expandedItems, layersCache, fetchLayersFor]
  );

  const toggleMovementLayers = useCallback(
    (movementId: string, stockItemId: string) => {
      const willOpen = expandedMovements[movementId] !== true;
      if (willOpen) expandedMovementItemsRef.current[movementId] = stockItemId;
      setExpandedMovements((prev) => ({ ...prev, [movementId]: willOpen }));
      const cached = layersCache[stockItemId];
      if (willOpen && (!cached || cached === "error")) void fetchLayersFor(stockItemId);
    },
    [expandedMovements, layersCache, fetchLayersFor]
  );

  const fetchAll = useCallback(async () => {
    setRefreshing(true);
    try {
      // Dashboard (server) + shared stock list resync in parallel: writes on
      // other devices and this page's own writes both flow back here.
      const [dash] = await Promise.all([fetchStockDashboard(), refreshBackendStock()]);
      if (dash) {
        setDashboard(dash);
        setIsStale(false);
      } else {
        setIsStale(true);
      }
      // A refresh can invalidate cached layers (stock-in/adjust happened
      // elsewhere) — drop the cache; expanded rows re-fetch lazily.
      resetLayers();
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [fetchStockDashboard, refreshBackendStock, resetLayers]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Sales movements (SALE_DEDUCTION) and any other admin stock write change
  // quantities and FIFO layers without a manual refresh. Unlike the Refresh
  // button, expanded rows stay open: the layers cache is dropped (it may be
  // stale after the write) and every expanded panel refetches in place — its
  // loading state shows, then fresh layer data lands. Includes this page's
  // own set-cost writes, whose PATCH emits the same debounced event. No
  // polling — only the shared debounced admin event version drives this.
  useEffect(() => {
    if (salesEventsVersion === lastSalesEventsVersion.current) return;
    lastSalesEventsVersion.current = salesEventsVersion;
    if (salesEventsVersion === 0) return;

    let cancelled = false;
    void (async () => {
      const dash = await fetchStockDashboard();
      if (cancelled) return;
      if (dash) {
        setDashboard(dash);
        setIsStale(false);
      } else {
        setIsStale(true);
      }
      // Keep expandedItems / expandedMovements as-is; only the cache is
      // cleared. Refetch layers for every currently open alert or movement
      // row so no panel ends up with stale data and collapsed rows stay
      // uncached (they refetch lazily on next expand).
      setLayersCache({});
      const openIds = new Set<string>([
        ...Object.keys(expandedItemsRef.current).filter(
          (id) => expandedItemsRef.current[id] === true
        ),
        ...Object.values(expandedMovementItemsRef.current),
      ]);
      await Promise.all(Array.from(openIds).map((id) => fetchLayersFor(id)));
    })();

    return () => {
      cancelled = true;
    };
  }, [salesEventsVersion, fetchStockDashboard, fetchLayersFor]);

  const cards = dashboard?.cards;
  const lists = dashboard?.lists;
  const everythingZero =
    cards !== undefined &&
    Number(cards.lowStockCount) === 0 &&
    Number(cards.outOfStockCount) === 0 &&
    (lists?.recentMovements?.length ?? 0) === 0;

  const lowStockList = lists?.lowStockItems ?? [];
  const outOfStockList = lists?.outOfStockItems ?? [];
  const expiringList = lists?.expiringSoon ?? [];
  const movements = lists?.recentMovements ?? [];
  const mostUsed = lists?.mostUsedThisWeek ?? [];

  const expiringCount = Number(cards?.expiringSoonCount ?? expiringList.length);
  const expiringNames = expiringList.slice(0, 3).map((row) => row.name);
  const expiringMore = Math.max(0, expiringList.length - expiringNames.length);
  const expiringNote =
    expiringNames.length > 0
      ? `${expiringNames.join(", ")}${expiringMore > 0 ? ` +${expiringMore} more` : ""}`
      : expiringCount > 0
        ? "Expiring soon"
        : "Nothing expiring soon";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Inventory Dashboard"
        subtitle="Live stock value with low stock, expiry and movement alerts"
        badge="Operations"
        action={
          <button
            type="button"
            onClick={() => void fetchAll()}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-50 border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      {/* ── Stat cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Stock Value"
          value={cards ? peso(cards.totalStockValue) : "…"}
          tone="plain"
          note={
            <>
              {cards?.valueIsEstimate === true && (
                <span className="mr-2 inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-500 border border-stone-200">
                  Estimate
                </span>
              )}
              {cards?.valueIsEstimate === false && (
                <span className="mr-2 text-[11px] font-semibold text-stone-400">
                  From FIFO layers
                </span>
              )}
              <span className="text-xs text-amber-700 font-semibold">
                {cards
                  ? `${Number(cards.itemsWithoutCost)} item${Number(cards.itemsWithoutCost) === 1 ? "" : "s"} without recorded cost`
                  : "—"}
              </span>
            </>
          }
        />
        <StatCard
          label="Low Stock"
          value={cards ? fmtQty(cards.lowStockCount) : "…"}
          tone={cards && Number(cards.lowStockCount) > 0 ? "amber" : "plain"}
          note={
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" /> At or below reorder threshold
            </div>
          }
        />
        <StatCard
          label="Out of Stock"
          value={cards ? fmtQty(cards.outOfStockCount) : "…"}
          tone={cards && Number(cards.outOfStockCount) > 0 ? "red" : "plain"}
          note={
            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
              <XCircle className="h-3.5 w-3.5" /> Nothing on hand
            </div>
          }
        />
        <StatCard
          label="Expiring ≤7 days"
          value={cards ? fmtQty(expiringCount) : "…"}
          tone={cards && expiringCount > 0 ? "amber" : "plain"}
          note={
            <div
              className={`flex items-center gap-1.5 text-xs font-semibold ${
                expiringCount > 0 ? "text-amber-700" : "text-stone-500"
              }`}
            >
              <CalendarClock className="h-3.5 w-3.5 shrink-0" />
              <span className="leading-snug">{expiringNote}</span>
            </div>
          }
        />
      </div>

      {/* Silent-fail banner (token expired / backend unreachable) */}
      {isStale && !loading && (
        <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between gap-3">
          <span>
            Couldn&apos;t reach the backend{dashboard ? " — showing the last loaded dashboard." : "."} Check the connection and retry.
          </span>
          <button
            type="button"
            onClick={() => void fetchAll()}
            className="font-bold underline hover:text-amber-900 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* All-zero empty state */}
      {everythingZero && !loading && (
        <div className="p-10 text-center text-stone-400 font-bold text-sm bg-white rounded-xl border border-stone-200">
          No inventory activity yet.
        </div>
      )}

      {/* ── Alert lists ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Low Stock Items */}
        <div className={CARD}>
          <div className={CARD_HEAD}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h2 className="font-bold text-stone-800">Low Stock Items</h2>
              <LiveChip isStale={isStale} />
            </div>
            <span className="text-xs font-bold text-stone-400">{lowStockList.length}</span>
          </div>
          {loading && !dashboard ? (
            <div className="p-10 text-center text-stone-400 font-bold text-sm">Loading…</div>
          ) : lowStockList.length === 0 ? (
            <div className="p-8 text-center text-stone-400 font-bold text-sm">
              Nothing is low — every item is above its threshold.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="bg-stone-50 border-b border-stone-100 text-stone-500 uppercase text-[10px] font-black tracking-wider">
                  <tr>
                    <th className="px-3 py-2.5">Item</th>
                    <th className="px-3 py-2.5 text-right">On Hand</th>
                    <th className="px-3 py-2.5 text-right">Alert At</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                    <th className="px-3 py-2.5 text-center">Layers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {lowStockList.map((row) => {
                    const expanded = expandedItems[row.id] === true;
                    return (
                      <Fragment key={row.id}>
                        <tr className="hover:bg-stone-50 transition-colors">
                          <td className="px-3 py-2.5 font-bold text-stone-900">{row.name}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-stone-700 whitespace-nowrap">
                            {fmtQty(row.quantity)} {row.unit}
                          </td>
                          <td className="px-3 py-2.5 text-right text-stone-500 whitespace-nowrap">
                            ≤ {fmtQty(row.lowStockThreshold)} {row.unit}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="px-2 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase rounded border border-amber-200 whitespace-nowrap">
                              Low Stock
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              type="button"
                              aria-expanded={expanded}
                              aria-label={`${expanded ? "Hide" : "Show"} cost layers for ${row.name}`}
                              onClick={() => toggleLayers(row.id)}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
                            >
                              <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
                            </button>
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="bg-stone-50/80">
                            <td colSpan={5} className="px-3 pb-3 pt-1">
                              <LayersPanel
                                entry={layersCache[row.id]}
                                onRetry={() => void fetchLayersFor(row.id)}
                                itemId={row.id}
                                setStockLayerCost={setStockLayerCost}
                                onLayerCostSaved={handleLayerCostSaved}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Out of Stock Items */}
        <div className={CARD}>
          <div className={CARD_HEAD}>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <h2 className="font-bold text-stone-800">Out of Stock Items</h2>
              <LiveChip isStale={isStale} />
            </div>
            <span className="text-xs font-bold text-stone-400">{outOfStockList.length}</span>
          </div>
          {loading && !dashboard ? (
            <div className="p-10 text-center text-stone-400 font-bold text-sm">Loading…</div>
          ) : outOfStockList.length === 0 ? (
            <div className="p-8 text-center text-stone-400 font-bold text-sm">
              Nothing is out of stock right now.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[360px] text-left text-sm">
                <thead className="bg-stone-50 border-b border-stone-100 text-stone-500 uppercase text-[10px] font-black tracking-wider">
                  <tr>
                    <th className="px-3 py-2.5">Item</th>
                    <th className="px-3 py-2.5 text-right">On Hand</th>
                    <th className="px-3 py-2.5 text-right">Alert At</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                    <th className="px-3 py-2.5 text-center">Layers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {outOfStockList.map((row) => {
                    const expanded = expandedItems[row.id] === true;
                    return (
                      <Fragment key={row.id}>
                        <tr className="hover:bg-stone-50 transition-colors">
                          <td className="px-3 py-2.5 font-bold text-stone-900">{row.name}</td>
                          <td className="px-3 py-2.5 text-right text-stone-500 whitespace-nowrap">
                            {fmtQty(row.quantity)} {row.unit}
                          </td>
                          <td className="px-3 py-2.5 text-right text-stone-500 whitespace-nowrap">
                            ≤ {fmtQty(row.lowStockThreshold)} {row.unit}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="px-2 py-1 bg-red-50 text-red-700 text-[10px] font-bold uppercase rounded border border-red-200 whitespace-nowrap">
                              Out of Stock
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              type="button"
                              aria-expanded={expanded}
                              aria-label={`${expanded ? "Hide" : "Show"} cost layers for ${row.name}`}
                              onClick={() => toggleLayers(row.id)}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
                            >
                              <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
                            </button>
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="bg-stone-50/80">
                            <td colSpan={5} className="px-3 pb-3 pt-1">
                              <LayersPanel
                                entry={layersCache[row.id]}
                                onRetry={() => void fetchLayersFor(row.id)}
                                itemId={row.id}
                                setStockLayerCost={setStockLayerCost}
                                onLayerCostSaved={handleLayerCostSaved}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Movements ── */}
      <div className={CARD}>
        <div className={CARD_HEAD}>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-[#800000]" />
            <h2 className="font-bold text-stone-800">Recent Movements</h2>
            <LiveChip isStale={isStale} />
          </div>
          <Link
            href="/admin/inventory/history"
            className="text-xs font-bold text-[#800000] hover:underline underline-offset-2"
          >
            View all →
          </Link>
        </div>
        {loading && !dashboard ? (
          <div className="p-10 text-center text-stone-400 font-bold text-sm">Loading…</div>
        ) : movements.length === 0 ? (
          <div className="p-8 text-center text-stone-400 font-bold text-sm">No movements yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-stone-50 border-b border-stone-100 text-stone-500 uppercase text-[10px] font-black tracking-wider">
                <tr>
                  <th className="px-3 py-2.5 whitespace-nowrap">Date / Time</th>
                  <th className="px-3 py-2.5">Item</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5 text-right">Change</th>
                  <th className="px-3 py-2.5 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {movements.map((m) => {
                  const badge = getStockMovementBadge(m.type);
                  const change = Number(m.quantityChange);
                  const expanded = expandedMovements[m.id] === true;
                  return (
                    <Fragment key={m.id}>
                      <tr className="hover:bg-stone-50 transition-colors">
                        <td className="px-3 py-2.5 text-stone-500 whitespace-nowrap">
                          {formatMovementDateTime(m.createdAt)}
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            aria-expanded={expanded}
                            aria-controls={`movement-layers-${m.id}`}
                            aria-label={`${expanded ? "Hide" : "Show"} FIFO layers for ${m.itemName}`}
                            onClick={() => toggleMovementLayers(m.id, m.stockItemId)}
                            className="group inline-flex items-center gap-1.5 -mx-1 rounded-md px-1 py-0.5 font-bold text-stone-900 hover:text-[#800000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#800000]/40"
                          >
                            {m.itemName}
                            <ChevronDown
                              className={`h-3.5 w-3.5 text-stone-400 transition-transform group-hover:text-[#800000] ${
                                expanded ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={badge.className}>{badge.label}</span>
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right font-bold whitespace-nowrap ${
                            change > 0 ? "text-emerald-700" : change < 0 ? "text-rose-600" : "text-stone-600"
                          }`}
                        >
                          {signedQty(m.quantityChange)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-stone-900 whitespace-nowrap">
                          {fmtQty(m.balanceAfter)}
                        </td>
                      </tr>
                      {expanded && (
                        <tr id={`movement-layers-${m.id}`} className="bg-stone-50/80">
                          <td colSpan={5} className="px-3 pb-3 pt-1">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400 pb-2">
                              Current remaining layers for {m.itemName}
                            </p>
                            <LayersPanel
                              entry={layersCache[m.stockItemId]}
                              onRetry={() => void fetchLayersFor(m.stockItemId)}
                              itemId={m.stockItemId}
                              setStockLayerCost={setStockLayerCost}
                              onLayerCostSaved={handleLayerCostSaved}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Most Used This Week ── */}
      <div className={CARD}>
        <div className={CARD_HEAD}>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#800000]" />
            <h2 className="font-bold text-stone-800">Most Used This Week</h2>
            <LiveChip isStale={isStale} />
          </div>
        </div>
        {loading && !dashboard ? (
          <div className="p-10 text-center text-stone-400 font-bold text-sm">Loading…</div>
        ) : mostUsed.length === 0 ? (
          <div className="p-8 text-center text-stone-400 font-bold text-sm">
            No usage recorded this week.
          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {mostUsed.map((u, idx) => (
              <li key={`${u.stockItemId}-${idx}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50 transition-colors">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                    idx === 0
                      ? "bg-amber-100 text-amber-700 border border-amber-300"
                      : "bg-stone-100 text-stone-500 border border-stone-200"
                  }`}
                >
                  {idx + 1}
                </span>
                <span className="flex-1 min-w-0 truncate text-sm font-bold text-stone-900">
                  {u.itemName}
                </span>
                <span className="text-xs font-bold text-[#800000] whitespace-nowrap">
                  {fmtQty(u.used)} used
                </span>
                {u.unit && <span className="text-[10px] uppercase text-stone-400 font-bold">{u.unit}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
