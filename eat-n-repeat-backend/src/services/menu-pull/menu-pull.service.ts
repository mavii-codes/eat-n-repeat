import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { sanitizeSizes } from "@/services/menu/index";

const PROBE_TIMEOUT_MS = 5000;
const FETCH_TIMEOUT_MS = 15000;

export type MenuPullConflict = {
  kind: "category" | "item";
  id: string;
  name: string;
  localUpdatedAt: string | null;
  onlineUpdatedAt: string | null;
  reason: string;
};

export type MenuPullPlan = {
  dryRun: boolean;
  onlineReachable: boolean;
  onlineCounts: { categories: number; items: number };
  toCreateCategories: { id: string; name: string }[];
  toUpdateCategories: { id: string; name: string }[];
  toArchiveCategories: { id: string; name: string }[];
  toCreateItems: { id: string; name: string }[];
  toUpdateItems: { id: string; name: string }[];
  toArchiveItems: { id: string; name: string }[];
  conflicts: MenuPullConflict[];
  blocked: { id: string; name: string; reason: string }[];
  backupPath: string | null;
  applied: boolean;
  error?: string;
};

type OnlineCategory = {
  id: string;
  name: string;
  description?: string | null;
  archived?: boolean;
  updatedAt?: string;
};

type OnlineItem = {
  id: string;
  name: string;
  description?: string | null;
  price: number | string;
  categoryId: string;
  available?: boolean;
  image?: string | null;
  sizes?: unknown;
  archived?: boolean;
  updatedAt?: string;
};

// Pure compare helpers (exported for verification; no I/O, no side effects).
export function toMs(value: unknown): number | null {
  if (!value) return null;
  const t = value instanceof Date ? value.getTime() : new Date(value as string).getTime();
  return Number.isFinite(t) ? t : null;
}

export function samePrice(a: unknown, b: unknown): boolean {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return String(a) === String(b);
  return Math.abs(x - y) < 0.005;
}

export function sameSizes(a: unknown, b: unknown): boolean {
  return JSON.stringify(sanitizeSizes(a)) === JSON.stringify(sanitizeSizes(b));
}

export function categoryDiffers(
  local: { name: string; description: string | null; archived: boolean },
  online: OnlineCategory,
): string[] {
  const diffs: string[] = [];
  if (String(local.name ?? "") !== String(online.name ?? "")) diffs.push("name");
  if (String(local.description ?? "") !== String(online.description ?? "")) diffs.push("description");
  if (Boolean(local.archived) !== Boolean(online.archived)) diffs.push("archived");
  return diffs;
}

export function itemDiffers(
  local: {
    name: string;
    description: string | null;
    price: unknown;
    categoryId: string;
    available: boolean;
    image: string | null;
    sizes: unknown;
    archived: boolean;
  },
  online: OnlineItem,
): string[] {
  const diffs: string[] = [];
  if (String(local.name ?? "") !== String(online.name ?? "")) diffs.push("name");
  if (String(local.description ?? "") !== String(online.description ?? "")) diffs.push("description");
  if (!samePrice(local.price, online.price)) diffs.push("price");
  if (String(local.categoryId ?? "") !== String(online.categoryId ?? "")) diffs.push("category");
  if (Boolean(local.available) !== Boolean(online.available ?? true)) diffs.push("available");
  if (String(local.image ?? "") !== String(online.image ?? "")) diffs.push("image");
  if (!sameSizes(local.sizes, online.sizes)) diffs.push("sizes");
  if (Boolean(local.archived) !== Boolean(online.archived)) diffs.push("archived");
  return diffs;
}

function backupDir(): string {
  //Alongside the backend package so it survives restarts on the café laptop.
  return path.join(process.cwd(), "backups");
}

async function fetchOnlineMenu(baseUrl: string): Promise<{
  categories: OnlineCategory[];
  items: OnlineItem[];
  archivedCategoryIds: string[];
  archivedItemIds: string[];
}> {
  const base = baseUrl.replace(/\/+$/, "");
  const get = async (p: string) => {
    const res = await fetch(`${base}${p}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`Online menu request failed: ${p} -> ${res.status}`);
    return res.json();
  };
  const [catJson, itemJson] = await Promise.all([
    get("/api/menu/categories"),
    get("/api/menu/items"),
  ]);
  return {
    categories: Array.isArray(catJson?.categories) ? catJson.categories : [],
    items: Array.isArray(itemJson?.items) ? itemJson.items : [],
    archivedCategoryIds: Array.isArray(catJson?.archivedIds) ? catJson.archivedIds.map(String) : [],
    archivedItemIds: Array.isArray(itemJson?.archivedIds) ? itemJson.archivedIds.map(String) : [],
  };
}

export class MenuPullService {
  /**
   * Pull the ONLINE menu into THIS (local) database. One direction only:
   * there is deliberately no code path that writes to the online database.
   *
   * dryRun (or SYNC_MENU_DRY_RUN=true) performs ZERO writes: no database
   * changes, no backup file, no sync-state update — preview report only.
   */
  async pull(options?: { dryRun?: boolean }): Promise<MenuPullPlan> {
    const dryRun = options?.dryRun === true || env.menuSyncDryRun;
    const baseUrl = (env.menuSyncUrl || "").trim().replace(/\/+$/, "");
    const plan: MenuPullPlan = {
      dryRun,
      onlineReachable: false,
      onlineCounts: { categories: 0, items: 0 },
      toCreateCategories: [],
      toUpdateCategories: [],
      toArchiveCategories: [],
      toCreateItems: [],
      toUpdateItems: [],
      toArchiveItems: [],
      conflicts: [],
      blocked: [],
      backupPath: null,
      applied: false,
    };

    if (!baseUrl || /example\.com/i.test(baseUrl)) {
      return { ...plan, error: "MENU_SYNC_URL is not configured; pull disabled." };
    }

    // Reachability probe first: never attempt a sync against a dead backend,
    // and never let that break local operation (fail silent, report skipped).
    try {
      const probe = await fetch(`${baseUrl}/api/health`, {
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      if (!probe.ok) {
        return { ...plan, error: `Online backend unreachable (health -> ${probe.status}); offline mode continues.` };
      }
    } catch {
      return { ...plan, error: "Online backend unreachable; offline mode continues." };
    }
    plan.onlineReachable = true;

    let online;
    try {
      online = await fetchOnlineMenu(baseUrl);
    } catch (e: any) {
      return { ...plan, error: `Could not read online menu: ${e?.message ?? e}` };
    }
    plan.onlineCounts = { categories: online.categories.length, items: online.items.length };

    const [localCats, localItems] = await Promise.all([
      prisma.menuCategory.findMany(),
      prisma.menuItem.findMany(),
    ]);
    const localCatById = new Map(localCats.map((c) => [c.id, c]));
    const localItemById = new Map(localItems.map((i) => [i.id, i]));
    const archivedCatIds = new Set(online.archivedCategoryIds);
    const archivedItemIds = new Set(online.archivedItemIds);

    // ---- Categories -------------------------------------------------------
    const createCats: typeof localCats = [];
    for (const oc of online.categories) {
      if (!oc || !oc.id || !oc.name) continue;
      const local = localCatById.get(oc.id);
      if (!local) {
        plan.toCreateCategories.push({ id: oc.id, name: oc.name });
        createCats.push(oc as any);
        continue;
      }
      const onlineMs = toMs(oc.updatedAt);
      const localMs = toMs(local.updatedAt);
      if (onlineMs !== null && localMs !== null && onlineMs > localMs) {
        plan.toUpdateCategories.push({ id: oc.id, name: oc.name });
      } else {
        // Online is NOT strictly newer (older, equal, or unreadable clock).
        // Identical content: silent skip. Differing content: genuine
        // conflict — keep local, report, never overwrite automatically.
        const diffs = categoryDiffers(local as any, oc);
        if (diffs.length > 0) {
          plan.conflicts.push({
            kind: "category",
            id: oc.id,
            name: oc.name,
            localUpdatedAt: local.updatedAt ? new Date(local.updatedAt).toISOString() : null,
            onlineUpdatedAt: oc.updatedAt ?? null,
            reason: `local is not older but content differs (${diffs.join(", ")}); kept local`,
          });
        }
      }
    }
    // Archive propagation: ONLY ids the online backend explicitly reports as
    // archived. Ids merely absent from the response are ignored (never delete
    // or archive locally just because an API response lacks them).
    for (const id of archivedCatIds) {
      const local = localCatById.get(id);
      if (local && !local.archived) {
        plan.toArchiveCategories.push({ id, name: local.name });
      }
    }

    // ---- Items ------------------------------------------------------------
    // Category ids that will exist locally after the category copy (for FK).
    const futureCatIds = new Set([
      ...localCats.map((c) => c.id),
      ...createCats.map((c: any) => c.id),
    ]);
    const createItems: OnlineItem[] = [];
    for (const oi of online.items) {
      if (!oi || !oi.id || !oi.name) continue;
      const local = localItemById.get(oi.id);
      if (!local) {
        if (!futureCatIds.has(oi.categoryId)) {
          plan.blocked.push({
            id: oi.id,
            name: oi.name,
            reason: `category ${oi.categoryId} missing locally and not in copy set (FK safety)`,
          });
          continue;
        }
        plan.toCreateItems.push({ id: oi.id, name: oi.name });
        createItems.push(oi);
        continue;
      }
      const onlineMs = toMs(oi.updatedAt);
      const localMs = toMs(local.updatedAt);
      if (onlineMs !== null && localMs !== null && onlineMs > localMs) {
        if (!futureCatIds.has(oi.categoryId)) {
          plan.blocked.push({
            id: oi.id,
            name: oi.name,
            reason: `target category ${oi.categoryId} missing locally (FK safety)`,
          });
          continue;
        }
        plan.toUpdateItems.push({ id: oi.id, name: oi.name });
      } else {
        // Online is NOT strictly newer (older, equal, or unreadable clock).
        // Identical content: silent skip. Differing content: genuine
        // conflict — keep local, report, never overwrite automatically.
        const diffs = itemDiffers(local as any, oi);
        if (diffs.length > 0) {
          plan.conflicts.push({
            kind: "item",
            id: oi.id,
            name: oi.name,
            localUpdatedAt: local.updatedAt ? new Date(local.updatedAt).toISOString() : null,
            onlineUpdatedAt: oi.updatedAt ?? null,
            reason: `local is not older but content differs (${diffs.join(", ")}); kept local`,
          });
        }
      }
    }
    for (const id of archivedItemIds) {
      const local = localItemById.get(id);
      if (local && !local.archived) {
        plan.toArchiveItems.push({ id, name: local.name });
      }
    }

    if (dryRun) {
      return plan;
    }

    const hasWrites =
      plan.toCreateCategories.length > 0 ||
      plan.toUpdateCategories.length > 0 ||
      plan.toArchiveCategories.length > 0 ||
      plan.toCreateItems.length > 0 ||
      plan.toUpdateItems.length > 0 ||
      plan.toArchiveItems.length > 0;
    if (!hasWrites) {
      await this.recordSync("in-sync (0 changes)");
      return plan;
    }

    // Backup BEFORE any live write. Backup failure aborts the sync.
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDir(), `menu-sync-${stamp}.json`);
    try {
      fs.mkdirSync(backupDir(), { recursive: true });
      const backup = {
        at: new Date().toISOString(),
        direction: "online-to-local",
        categories: localCats,
        items: localItems,
      };
      fs.writeFileSync(backupPath, JSON.stringify(backup));
    } catch (e: any) {
      return { ...plan, error: `Backup failed (${e?.message ?? e}); live sync ABORTED with zero writes.` };
    }
    plan.backupPath = backupPath;

    const byIdCat = new Map(createCats.map((c: any) => [c.id, c]));
    const onlineCatById = new Map(online.categories.map((c) => [c.id, c]));
    const onlineItemById = new Map(online.items.map((i) => [i.id, i]));

    await prisma.$transaction(async (tx) => {
      for (const c of plan.toCreateCategories) {
        const oc = byIdCat.get(c.id) ?? onlineCatById.get(c.id);
        if (!oc) continue;
        await tx.menuCategory.create({
          data: {
            id: oc.id,
            name: oc.name,
            description: oc.description ?? "",
            archived: false,
          },
        });
      }
      for (const c of plan.toUpdateCategories) {
        const oc = onlineCatById.get(c.id);
        if (!oc) continue;
        await tx.menuCategory.update({
          where: { id: c.id },
          data: {
            name: oc.name,
            description: oc.description ?? "",
            archived: Boolean(oc.archived),
          },
        });
      }
      for (const c of plan.toArchiveCategories) {
        await tx.menuCategory.update({
          where: { id: c.id },
          data: { archived: true, archivedAt: new Date() },
        });
      }
      for (const it of plan.toCreateItems) {
        const oi = onlineItemById.get(it.id);
        if (!oi) continue;
        await tx.menuItem.create({
          data: {
            id: oi.id,
            name: oi.name,
            description: oi.description ?? "",
            price: Number(oi.price),
            categoryId: oi.categoryId,
            available: oi.available ?? true,
            image: oi.image ? String(oi.image) : null,
            sizes: sanitizeSizes(oi.sizes) as any,
            archived: false,
          },
        });
      }
      for (const it of plan.toUpdateItems) {
        const oi = onlineItemById.get(it.id);
        if (!oi) continue;
        await tx.menuItem.update({
          where: { id: it.id },
          data: {
            name: oi.name,
            description: oi.description ?? "",
            price: Number(oi.price),
            categoryId: oi.categoryId,
            available: oi.available ?? true,
            image: oi.image ? String(oi.image) : null,
            sizes: sanitizeSizes(oi.sizes) as any,
            archived: Boolean(oi.archived),
          },
        });
      }
      for (const it of plan.toArchiveItems) {
        await tx.menuItem.update({
          where: { id: it.id },
          data: { archived: true, archivedAt: new Date() },
        });
      }
    });

    plan.applied = true;
    const summary =
      `cats +${plan.toCreateCategories.length} ~${plan.toUpdateCategories.length} arch${plan.toArchiveCategories.length}; ` +
      `items +${plan.toCreateItems.length} ~${plan.toUpdateItems.length} arch${plan.toArchiveItems.length}; ` +
      `conflicts ${plan.conflicts.length} blocked ${plan.blocked.length}`;
    await this.recordSync(summary);
    return plan;
  }

  private async recordSync(result: string): Promise<void> {
    try {
      await prisma.menuSyncState.upsert({
        where: { id: 1 },
        update: { lastPulledAt: new Date(), lastResult: result.slice(0, 255) },
        create: { id: 1, lastPulledAt: new Date(), lastResult: result.slice(0, 255) },
      });
    } catch {
      // Sync-state bookkeeping must never break serving traffic.
    }
  }
}

export const menuPullService = new MenuPullService();
